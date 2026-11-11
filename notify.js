/* Notes : notifications aux appareils reliés au même code de synchronisation (par exemple ceux des parents).
   Événements : une note ajoutée (un ETA compte comme une note) et tout changement de verdict, envoyés par l'appareil
   auteur à tous les autres appareils du code. Le message est chiffré avec la clé du code (Sync.seal) : le serveur ne
   relaie que du chiffré, et le service worker (sw.js) le déchiffre avec la clé gardée dans IndexedDB (« notes2m01-push »).
   Activation : volontaire, sur chaque appareil (Réglages → Synchronisation). Sur iPhone, l'app doit être sur l'écran
   d'accueil (iOS 16.4 ou plus). « Tout couper » est un réglage partagé (cfg.notifOff, synchronisé avec le reste) :
   aucun appareil n'envoie plus rien tant qu'il est actif. */
(function () {
  "use strict";
  var KEY = "notes2m01.notif", DB = "notes2m01-push";
  var meta = load(), host = null, busy = false, note = "";

  function load() { try { return JSON.parse(localStorage.getItem(KEY) || "null") || {}; } catch (e) { return {}; } }
  function store() { try { localStorage.setItem(KEY, JSON.stringify(meta)); } catch (e) {} }
  function app() { return window.NotesApp; }
  function hap(k) { if (window.FX) FX.haptic(k); }
  function device() {
    if (!meta.device) {
      var b = new Uint8Array(12), s = ""; crypto.getRandomValues(b);
      for (var i = 0; i < b.length; i++) s += ("0" + b[i].toString(16)).slice(-2);
      meta.device = s; store();
    }
    return meta.device;
  }
  function ctx() { return window.Sync && Sync.enabled() && Sync.ctx ? Sync.ctx() : null; }
  function off() { var st = app() && app().get(); return !!(st && st.cfg && st.cfg.notifOff); }

  /* ---------- Clé de déchiffrement pour le service worker ---------- */
  function kv(mode, fn) {
    return new Promise(function (ok, ko) {
      var rq = indexedDB.open(DB, 1);
      rq.onupgradeneeded = function () { rq.result.createObjectStore("kv"); };
      rq.onerror = function () { ko(rq.error); };
      rq.onsuccess = function () {
        var d = rq.result, t = d.transaction("kv", mode); fn(t.objectStore("kv"));
        t.oncomplete = function () { d.close(); ok(); }; t.onerror = t.onabort = function () { d.close(); ko(t.error); };
      };
    });
  }
  function saveKey(key) { return kv("readwrite", function (s) { s.put(key, "key"); }); }
  function dropKey() { return kv("readwrite", function (s) { s.delete("key"); }).catch(function () {}); }

  /* ---------- Serveur ---------- */
  function api(c, method, body) {
    return fetch(c.url.replace(/\/$/, "") + "/v1/" + c.id + "/push", { method: method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j.status = r.status; return j; }); });
  }
  function unb64u(s) {
    var bin = atob(String(s).replace(/-/g, "+").replace(/_/g, "/")), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }

  /* ---------- Activer / désactiver sur cet appareil ---------- */
  function supported() { return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && !!window.indexedDB; }
  function iosBrowser() {
    var ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    var standalone = navigator.standalone === true || (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
    return ios && !standalone;
  }
  function fail(t) { throw { msg: t }; }
  function enable() {
    var c = ctx();
    if (!c) return Promise.reject({ msg: "Active d'abord la synchronisation." });
    if (iosBrowser()) return Promise.reject({ msg: "Sur iPhone, ajoute d'abord l'app à l'écran d'accueil (Partager → Sur l'écran d'accueil), puis ouvre-la depuis son icône." });
    if (!supported()) return Promise.reject({ msg: "Ce navigateur ne prend pas en charge les notifications. Sur iPhone, il faut iOS 16.4 ou plus et l'app sur l'écran d'accueil." });
    var reg, sub;
    return Promise.resolve(Notification.requestPermission()).then(function (p) {
      if (p !== "granted") fail("Les notifications sont refusées pour cette app. Autorise-les dans les réglages de l'appareil, puis réessaie.");
      return Promise.race([navigator.serviceWorker.ready, new Promise(function (ok, ko) { setTimeout(function () { ko({ msg: "L'app n'est pas encore prête pour les notifications. Ferme-la, rouvre-la, puis réessaie." }); }, 8000); })]);
    }).then(function (r) {
      reg = r;
      return fetch(c.url.replace(/\/$/, "") + "/v1/push-key", { cache: "no-store" }).then(function (x) { return x.json(); });
    }).then(function (j) {
      if (!j || !j.key) fail("Les notifications ne sont pas encore disponibles sur le serveur.");
      return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: unb64u(j.key) });
    }).then(function (s) {
      sub = s;
      return api(c, "PUT", { device: device(), sub: s.toJSON() });
    }).then(function (j) {
      if (j.status === 409) fail("Trop d'appareils reçoivent déjà les notifications de ce code (10 au plus).");
      if (j.status !== 200) fail("Le serveur a refusé l'abonnement. Réessaie plus tard.");
      return saveKey(c.key);
    }).then(function () { meta.on = true; store(); }, function (e) {
      if (sub) try { sub.unsubscribe(); } catch (x) {}
      throw e && e.msg ? e : { msg: "L'activation a échoué. Vérifie la connexion, puis réessaie." };
    });
  }
  function disable() {
    var c = ctx();
    meta.on = false; store();
    var p = supported() ? navigator.serviceWorker.getRegistration().then(function (r) { return r ? r.pushManager.getSubscription() : null; })
      .then(function (s) { return s ? s.unsubscribe() : null; }).catch(function () {}) : Promise.resolve();
    return p.then(function () { return c ? api(c, "DELETE", { device: device() }).catch(function () {}) : null; }).then(dropKey);
  }

  /* ---------- Envoi ---------- */
  function send(msg) {
    var c = ctx();
    if (!c || off() || !Sync.seal) return;
    Sync.seal(msg).then(function (data) { return api(c, "POST", { device: device(), data: data }); }).catch(function () {});
  }
  function fmt(v) { return String(Math.round(v * 100) / 100); }
  function subjName(id) {
    var all = app().subjectsAll(), s = all.filter(function (x) { return x.id === id; })[0];
    return s ? s.name : id;
  }
  // Appelé après l'enregistrement d'une nouvelle note (g) ou d'un nouvel ETA (g avec son TA `def`).
  function added(g, def) {
    if (!g || !ctx() || off()) return;
    var name = subjName(g.subject), avg = app().annualAvg(g.subject);
    var what = def ? "ETA du TA " + (def.label || "") + " : " + (def.points ? fmt(+g.pts) + " / " + fmt(+g.max) + " points" : fmt(g.value))
      : "Note : " + fmt(g.value) + (g.label ? " (" + g.label + ")" : "");
    send({ t: "note", title: "Nouvelle note · " + name, body: what + (avg != null ? " · Moyenne : " + avg.toFixed(2) : "") });
  }
  // Verdict affiché pour l'année entière (1re et 2e : promotion ; 3e : statut du certificat, lu sur le tableau de bord).
  function verdictNow() {
    var pr = app().profile(); if (!pr) return null;
    if (pr.year !== 3) { var v = app().verdict(); return v.status === "none" ? null : v.label; }
    var per = document.querySelector('[data-period][aria-pressed="true"]');
    if ((per && per.dataset.period !== "year") || (app().demo && app().demo())) return undefined;
    var pill = document.querySelector("#promo .pill"), t = pill ? pill.textContent.trim() : "";
    return t && t !== "3e année" ? t : null;
  }
  // Appelé après chaque rendu : un changement de verdict fait sur CET appareil est annoncé aux autres.
  function rendered() {
    if (!app() || !app().profile()) return;
    var cur = verdictNow(); if (cur === undefined) return;
    var prev = meta.verdict;
    if (cur === prev) return;
    meta.verdict = cur; store();
    var remote = window.Sync && Sync.applying && Sync.applying();
    if (remote || prev === undefined || !prev || !cur) return;
    send({ t: "verdict", title: "Verdict modifié", body: "Avant : " + prev + " · Maintenant : " + cur });
  }

  /* ---------- Interface (Réglages → Synchronisation) ---------- */
  function paint() {
    if (!host) return;
    var granted = meta.on && window.Notification && Notification.permission === "granted";
    host.innerHTML = '<h3>Notifications</h3>' +
      '<p class="muted small">Les appareils reliés à ce code (par exemple ceux de tes parents) peuvent recevoir une notification quand une note est ajoutée ou que le verdict change. Le message est chiffré avec le code : le serveur ne peut pas le lire.</p>' +
      (granted ? '<p class="small">Notifications activées sur cet appareil.</p><div class="btns"><button type="button" class="link danger" id="nt-off">Désactiver sur cet appareil</button></div>'
        : '<div class="btns"><button type="button" class="btn" id="nt-on"' + (busy ? " disabled" : "") + '>' + (busy ? "Activation…" : "Activer les notifications") + '</button></div>') +
      '<label class="row">Tout couper<input type="checkbox" switch id="nt-all"' + (off() ? " checked" : "") + '></label>' +
      '<p class="muted small">« Tout couper » arrête les notifications pour tous les appareils du code, jusqu\'à ce que quelqu\'un le réactive.</p>' +
      '<p class="small" id="nt-msg" role="status">' + note + '</p>';
  }
  function onClick(e) {
    var t = e.target;
    if (t.id === "nt-on" && !busy) {
      busy = true; note = ""; paint();
      enable().then(function () { note = ""; hap("success"); }, function (err) { note = (err && err.msg) || "L'activation a échoué."; hap("error"); })
        .then(function () { busy = false; paint(); });
    }
    if (t.id === "nt-off") { disable().then(paint); note = ""; hap("tap"); paint(); }
  }
  function onChange(e) {
    if (e.target.id === "nt-all" && app().setNotifOff) { app().setNotifOff(e.target.checked); hap("select"); }
  }

  window.Notify = {
    // sync.js appelle mount(el) à chaque fois qu'il redessine son bloc (el = conteneur vide, ou null si la synchronisation est coupée).
    mount: function (el) {
      host = el || null;
      if (host && !host.dataset.bound) { host.dataset.bound = "1"; host.addEventListener("click", onClick); host.addEventListener("change", onChange); }
      paint();
    },
    added: added, rendered: rendered,
    // Synchronisation désactivée sur cet appareil : plus d'abonnement.
    stop: function () { return meta.on ? disable() : Promise.resolve(); }
  };

  // Au démarrage : si les notifications sont actives, la clé et l'abonnement sont rafraîchis (un abonnement peut changer).
  if (meta.on && supported()) {
    setTimeout(function () {
      var c = ctx(); if (!c || Notification.permission !== "granted") return;
      saveKey(c.key).catch(function () {});
      navigator.serviceWorker.ready.then(function (r) { return r.pushManager.getSubscription(); }).then(function (s) {
        if (s) return api(c, "PUT", { device: device(), sub: s.toJSON() });
        meta.on = false; store(); paint();
      }).catch(function () {});
    }, 4000);
  }
})();
