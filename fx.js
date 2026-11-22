/* Notes — couche app : haptique, indicateurs, petites animations iOS, sauvegarde, installation.
   v44 : les animations retirées en v40 reviennent, en CSS (ios.css) : la pastille de la barre du bas glisse avec un
   ressort, l'icône d'onglet rebondit, le formulaire tremble sur une erreur, le verdict pulse quand il change, le bandeau
   d'installation se replie. Tout est coupé par ?noanim=1 (html.noanim) et par « Réduire les animations ». */
(function () {
  "use strict";
  function $(s, r) { return (r || document).querySelector(s); }
  // .fx : les pastilles .ind remplacent le fond des onglets et segments actifs (fx.css).
  document.documentElement.classList.add("fx");
  // ?noanim=1 : plus aucune animation ni transition CSS (voir ios.css, html.noanim).
  if (/[?&]noanim=1/.test(location.search)) document.documentElement.classList.add("noanim");
  var reduceMq = window.matchMedia("(prefers-reduced-motion: reduce)");
  function canAnim() { return !document.documentElement.classList.contains("noanim") && !reduceMq.matches; }
  // Rejoue une animation CSS : retire la classe, force le calcul, la remet ; elle part seule à la fin.
  function replay(node, cls, ms) {
    if (!node || !canAnim()) return;
    node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls);
    clearTimeout(node["_t" + cls]); node["_t" + cls] = setTimeout(function () { node.classList.remove(cls); }, ms || 700);
  }

  /* ---------- Haptique ----------
     Android : API Vibration. iPhone (iOS 18+) : Safari n'a pas d'API, mais basculer un
     <input type="checkbox" switch> déclenche le « tic » système. On clique donc un
     interrupteur invisible, toujours en réponse à un geste de l'utilisateur. */
  var HK = "notes2m01.haptics";
  var hapticsOn = true;
  try { hapticsOn = localStorage.getItem(HK) !== "off"; } catch (e) {}
  var IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  // Méthode éprouvée (même principe que la librairie ios-haptics) : un interrupteur neuf à chaque tic,
  // caché, ajouté au <head>, cliqué via son libellé puis retiré.
  function tick() {
    var l = document.createElement("label"); l.className = "hx"; l.setAttribute("aria-hidden", "true"); l.style.display = "none";
    var i = document.createElement("input"); i.type = "checkbox"; i.setAttribute("switch", "");
    l.appendChild(i); document.head.appendChild(l);
    try { l.click(); } finally { document.head.removeChild(l); }
  }
  var VIB = { tap: 8, select: 6, success: [12, 90, 20], warn: [20, 70, 20], error: [30, 60, 30, 60, 30], heavy: 30 };
  var TICKS = { tap: 1, select: 1, success: 2, warn: 2, error: 3, heavy: 1 };
  var lastTick = 0;
  function haptic(kind) {
    if (!hapticsOn) return;
    kind = kind || "tap";
    // Un seul tic par geste : un tic simple juste après un autre est ignoré (les motifs longs passent toujours).
    var now = Date.now(), simple = kind === "tap" || kind === "select";
    if (simple && now - lastTick < 90) return;
    lastTick = now;
    // Sur iPhone, toujours l'interrupteur : navigator.vibrate peut exister mais ne fait rien.
    if (!IOS && navigator.vibrate) { try { navigator.vibrate(VIB[kind] || 8); } catch (e) {} return; }
    var n = TICKS[kind] || 1;
    tick();
    for (var k = 1; k < n; k++) setTimeout(tick, k * 120);
  }

  /* Une vibration à chaque interaction. Exceptions : taper dans un champ texte (le tic volerait le
     clavier ; utiliser le retour clavier d'iOS) et les interrupteurs natifs, qui vibrent déjà seuls. */
  var TAPPABLE = "button, a[href], [data-subj], [data-close], summary, .grab, .bars .bar, .ob-row, input[type=checkbox]:not([switch]), input[type=radio]";
  document.addEventListener("click", function (e) {
    if (e.target.closest(".hx, .hx-catch")) return;
    if (catchTarget && !forwarded) release(); // le clic est arrivé directement au bouton
    var t = e.target.closest(TAPPABLE);
    if (!t || t.disabled) return;
    if (t.matches("[data-del]") || t.type === "submit") return; // retours dédiés (avertissement, réussite, erreur)
    haptic(t.matches("[data-tab], [data-period], [data-coef], .ob-row") ? "select" : "tap");
  }, true);
  // Valeur validée dans une liste, une date ou un nombre (au moment où le champ se ferme).
  document.addEventListener("change", function (e) {
    var t = e.target;
    if (t.matches("select, input[type=date], input[type=number], input[type=text]")) haptic("select");
  }, true);
  // Feuille de détail relâchée : petit tic quand elle revient en place.
  document.addEventListener("pointerup", function (e) { if (e.target.closest && e.target.closest(".grab")) haptic("tap"); }, true);

  /* ---------- iPhone : interrupteur sous le doigt ----------
     Safari ne fait vibrer qu'un vrai interrupteur touché par l'utilisateur (un clic par script ne
     suffit pas). Au moment où le doigt se pose sur un bouton, on glisse donc un interrupteur
     invisible exactement sous le doigt : c'est lui que le doigt touche (vraie vibration iOS), puis
     on transmet l'appui au bouton. Si le doigt glisse (défilement), on retire l'interrupteur. */
  var HXTEST = /[?&]hxtest=1/.test(location.search);
  /* L'interrupteur reste toujours affiché (coin haut gauche, inerte). Le faire apparaître au moment
     de l'appui faisait croire à iOS que la page changeait sous le doigt : il prenait le 1er appui pour
     un survol et il fallait toucher deux fois. On ne fait donc que le déplacer et le rendre touchable. */
  var catcher = null, catchTarget = null, catchTimer = null, upTimer = null, forwarded = true, x0 = 0, y0 = 0;
  function park() {
    if (!catcher) return;
    catcher.style.pointerEvents = "none";
    catcher.style.left = "0px"; catcher.style.top = "0px";
  }
  function release() {
    park();
    if (catchTarget) catchTarget.classList.remove("is-pressed");
    catchTarget = null; clearTimeout(catchTimer); clearTimeout(upTimer);
  }
  function forward() {
    if (forwarded || !catchTarget) return;
    forwarded = true;
    var t = catchTarget;
    release();
    lastTick = Date.now(); // la vibration vient de l'interrupteur : pas de second tic
    if (typeof t.click === "function") t.click();
    else t.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  }
  function makeCatcher() {
    var l = document.createElement("label"); l.className = "hx-catch"; l.setAttribute("aria-hidden", "true");
    var i = document.createElement("input"); i.type = "checkbox"; i.setAttribute("switch", ""); i.tabIndex = -1;
    l.appendChild(i); document.body.appendChild(l);
    // Le toucher active l'interrupteur (vibration), puis on relaie l'appui une seule fois.
    l.addEventListener("click", function (e) { e.stopPropagation(); setTimeout(forward, 0); });
    return l;
  }
  if (IOS || HXTEST) {
    catcher = makeCatcher(); park();
    document.addEventListener("pointerdown", function (e) {
      if (!hapticsOn || (e.pointerType !== "touch" && !HXTEST)) return;
      if (e.target.closest(".hx, .hx-catch")) return;
      var t = e.target.closest(TAPPABLE);
      if (!t || t.disabled || t.matches("input, select, textarea, label")) return;
      catchTarget = t; forwarded = false; x0 = e.clientX; y0 = e.clientY;
      t.classList.add("is-pressed");
      catcher.style.left = (e.clientX - 32) + "px";
      catcher.style.top = (e.clientY - 32) + "px";
      catcher.style.pointerEvents = "auto";
      clearTimeout(catchTimer); catchTimer = setTimeout(release, 1500);
    }, true);
    document.addEventListener("pointermove", function (e) {
      if (catchTarget && Math.abs(e.clientX - x0) + Math.abs(e.clientY - y0) > 14) release();
    }, true);
    // Filet de sécurité : si iOS n'envoie pas le clic à l'interrupteur, l'appui passe quand même (sans vibration).
    document.addEventListener("pointerup", function () {
      if (catchTarget && !forwarded) { clearTimeout(upTimer); upTimer = setTimeout(forward, 450); }
    }, true);
    document.addEventListener("pointercancel", release, true);
    window.addEventListener("scroll", function () { if (catchTarget) release(); }, { passive: true, capture: true });
  }

  /* ---------- Pastilles des onglets et du sélecteur de période ----------
     La pastille glisse d'un onglet à l'autre par une transition CSS à ressort (ios.css, classe .ios-ind-ready posée
     après le premier placement pour ne pas animer l'arrivée). */
  function indicator(container, activeSel) {
    if (!container) return function () {};
    var ind = document.createElement("span"); ind.className = "ind"; ind.setAttribute("aria-hidden", "true");
    container.insertBefore(ind, container.firstChild);
    return function place() {
      var b = $(activeSel, container);
      if (!b || !b.offsetWidth) { ind.style.opacity = "0"; return; }
      ind.style.left = b.offsetLeft + "px"; ind.style.width = b.offsetWidth + "px"; ind.style.opacity = "1";
      if (!ind.classList.contains("ios-ind-ready")) requestAnimationFrame(function () { ind.classList.add("ios-ind-ready"); });
    };
  }
  var placeTab = indicator($("#tabbar"), '[aria-current="page"]');
  var placeSeg = indicator($(".seg"), '[aria-pressed="true"]');
  window.addEventListener("resize", function () { placeTab(); placeSeg(); });

  /* ---------- Barre du bas : appui long, la pastille suit le doigt ----------
     Appui court : rien ne change (clic habituel). Appui long (250 ms sans bouger) : la pastille grossit un peu et suit le
     doigt ; la page ne change qu'au relâchement, sur l'onglet le plus proche. Doigt remonté de 60 px au-dessus de la
     barre au relâchement : annulation. Le zoom ne touche que la pastille (jetons --ios-scrub-scale, --ios-dur-scrub). */
  (function () {
    var bar = $("#tabbar"), ind = bar && $(".ind", bar);
    if (!bar || !ind) return;
    var HOLD = 250, SLOP = 10, CANCEL = 60;
    var timer = null, pid = null, sx = 0, sy = 0, st = 0, scrub = false, over = null, swallowUntil = 0, own = false;
    var FLICK = 36, FLICK_MS = 450;
    function tabs() { return [].slice.call(bar.querySelectorAll("[data-tab]")).filter(function (b) { return b.offsetWidth; }); }
    function nearest(x) {
      var best = null, d = Infinity;
      tabs().forEach(function (b) { var r = b.getBoundingClientRect(), k = Math.abs(x - (r.left + r.width / 2)); if (k < d) { d = k; best = b; } });
      return best;
    }
    function follow(x) {
      var r = bar.getBoundingClientRect(), w = ind.offsetWidth, list = tabs();
      var min = list.length ? list[0].offsetLeft : 0, max = list.length ? list[list.length - 1].offsetLeft : r.width - w;
      ind.style.left = Math.min(max, Math.max(min, x - r.left - w / 2)) + "px";
      var b = nearest(x);
      if (b !== over) { if (over) haptic("select"); over = b; }
    }
    function settle() {
      bar.classList.remove("ios-scrub"); bar.classList.add("ios-scrub-settle");
      setTimeout(function () { bar.classList.remove("ios-scrub-settle"); }, 400);
    }
    function stop() { clearTimeout(timer); timer = null; pid = null; scrub = false; over = null; }
    bar.addEventListener("pointerdown", function (e) {
      if (pid != null || (e.pointerType === "mouse" && e.button !== 0)) return;
      pid = e.pointerId; sx = e.clientX; sy = e.clientY; st = Date.now();
      clearTimeout(timer);
      timer = setTimeout(function () {
        timer = null; if (pid == null) return;
        scrub = true; over = null;
        release();                                   // l'interrupteur haptique ne doit pas relayer ce geste comme un clic
        try { bar.setPointerCapture(pid); } catch (x) {}
        bar.classList.remove("ios-scrub-settle"); bar.classList.add("ios-scrub");
        haptic("select"); follow(sx);
      }, HOLD);
    });
    bar.addEventListener("pointermove", function (e) {
      if (e.pointerId !== pid) return;
      if (scrub) { follow(e.clientX); return; }
      if (timer && Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > SLOP) { clearTimeout(timer); timer = null; }
    });
    function end(e, cancelled) {
      if (e.pointerId !== pid) return;
      var was = scrub, target = was && !cancelled && e.clientY >= bar.getBoundingClientRect().top - CANCEL ? nearest(e.clientX) : null;
      stop();
      if (!was) {
        // Balayage rapide sur la barre (sans appui long) : onglet voisin, dans le sens du doigt.
        var dx = e.clientX - sx, dy = e.clientY - sy;
        if (!cancelled && Math.abs(dx) > FLICK && Math.abs(dx) > 2 * Math.abs(dy) && Date.now() - st < FLICK_MS) {
          var list = tabs(), cur = bar.querySelector('[aria-current="page"]'), i = list.indexOf(cur), next = list[i + (dx > 0 ? 1 : -1)];
          swallowUntil = Date.now() + 400;
          if (i >= 0 && next) { haptic("select"); own = true; try { next.click(); } finally { own = false; } }
        }
        return;
      }
      swallowUntil = Date.now() + 500;               // le clic natif qui suit le relâchement est ignoré
      settle();
      if (target && target.getAttribute("aria-current") !== "page") { own = true; try { target.click(); } finally { own = false; } }
      else placeTab();                               // annulation ou même onglet : la pastille revient
    }
    bar.addEventListener("pointerup", function (e) { end(e, false); });
    bar.addEventListener("pointercancel", function (e) { end(e, true); });
    bar.addEventListener("click", function (e) { if (!own && Date.now() < swallowUntil) { e.preventDefault(); e.stopPropagation(); } }, true);
    bar.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    // Icône de l'onglet touché : petit rebond (comme les symboles animés d'iOS).
    bar.addEventListener("click", function (e) { var b = e.target.closest("[data-tab]"); if (b) replay(b.querySelector("svg"), "ios-tab-pop", 600); });
  })();

  /* ---------- Téléphone en paysage : écran « Tourne ton téléphone » ----------
     L'app est faite pour la verticale. L'écran est toujours dans la page (hors de .wrap) ; ios.css ne l'affiche que sur un
     téléphone couché (paysage, peu de hauteur, écran tactile). Aucun script ne suit l'orientation. */
  (function () {
    var r = document.createElement("div"); r.className = "ios-rotate"; r.setAttribute("role", "alert");
    r.innerHTML = window.Icons.svg("phone") +
      '<p class="ios-rotate-t">Tourne ton téléphone</p><p class="ios-rotate-s">Notes s\'utilise à la verticale.</p>';
    document.body.appendChild(r);
  })();

  /* ---------- Erreur dans le formulaire : vibration et le formulaire tremble ---------- */
  var msg = $("#f-msg");
  if (msg && window.MutationObserver) {
    new MutationObserver(function () { if (msg.textContent.trim()) { haptic("error"); replay($("#view-add .panel"), "ios-shake", 600); } })
      .observe(msg, { childList: true, characterData: true, subtree: true });
  }

  /* ---------- Défilement : filet sous l'en-tête ---------- */
  var head = $("header.top");
  function onScroll() { if (head) head.classList.toggle("scrolled", window.scrollY > 8); }
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();

  /* ---------- Sauvegarde : exporter / importer ---------- */
  function stamp() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function say(t, bad) { [].forEach.call(document.querySelectorAll("#bk-msg, #bx-msg"), function (o) { o.textContent = t; o.style.color = bad ? "var(--crit)" : ""; }); }
  // Date du dernier export (tuile « Sauvegarde » de Réglages, v58).
  var BK = "notes2m01.backupAt";
  function backupAt() { try { return +localStorage.getItem(BK) || 0; } catch (e) { return 0; } }
  function markBackup() { try { localStorage.setItem(BK, String(Date.now())); } catch (e) {} lastLine(); }
  function lastLine() {
    var o = $("#bk-last"); if (!o) return;
    var t = backupAt();
    o.textContent = t ? "Dernier export : " + new Date(t).toLocaleDateString("fr-CH", { day: "numeric", month: "long", year: "numeric" }) + "." : "Aucun export pour l'instant.";
  }
  /* Sauvegarde avec les photos (22 novembre 2026). D'abord un interrupteur (option B), remplacé le même jour à la demande
     de l'utilisateur : « Exporter » ouvre la sous-page « Exporter » de Réglages (exportHtml, rendue par ios-settings.js)
     avec le contenu du fichier et l'interrupteur « Inclure les photos » (.json sans, .zip avec), puis le bouton Exporter.
     Fichier .zip sans compression (les photos sont déjà en JPEG) : notes-sauvegarde.json (même contenu que l'export
     simple, plus la liste des photos) et photos/0001.jpg… Le dernier choix est gardé dans notes2m01.bkPhotos.
     « Importer un fichier » lit le .zip et l'ancien .json. */
  var PK = "notes2m01.bkPhotos", busy = false;
  function photosOn() { try { return localStorage.getItem(PK) === "on"; } catch (e) { return false; } }
  function photoPages() { return window.Photos && Photos.pages ? Photos.pages() : 0; }
  function sizeText(n) { return n < 1e6 ? "≈ " + Math.max(1, Math.round(n / 1e3)) + " Ko" : "≈ " + Math.max(1, Math.round(n / 1e6)) + " Mo"; }
  // Examens et notes reprises de 3e (cert.js, clé notes2m01.exams) : dans la sauvegarde depuis le 22 novembre 2026.
  var EK = "notes2m01.exams";
  function examsData() { try { var d = JSON.parse(localStorage.getItem(EK) || "null"); return d && (Object.keys(d.exams || {}).length || Object.keys(d.carried || {}).length) ? d : null; } catch (e) { return null; } }
  function payload() { var p = { app: "notes2m01", version: 1, exported: new Date().toISOString(), state: window.NotesApp.get() }, ex = examsData(); if (ex) p.exams = ex; return p; }
  var CRC = null;
  function crc32(u8) {
    if (!CRC) { CRC = new Uint32Array(256); for (var n = 0; n < 256; n++) { var k = n; for (var j = 0; j < 8; j++) k = k & 1 ? 0xEDB88320 ^ (k >>> 1) : k >>> 1; CRC[n] = k >>> 0; } }
    var c = -1; for (var i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  }
  // entries : [{ name, data: Uint8Array }] → Blob .zip (méthode « stored », noms en UTF-8).
  function zipBlob(entries) {
    var d = new Date(), tm = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), dt = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    var parts = [], cd = [], off = 0, cdSize = 0, enc = new TextEncoder();
    entries.forEach(function (e) {
      var nm = enc.encode(e.name), sz = e.data.length, crc = crc32(e.data), h = new DataView(new ArrayBuffer(30)), c = new DataView(new ArrayBuffer(46));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(10, tm, true); h.setUint16(12, dt, true);
      h.setUint32(14, crc, true); h.setUint32(18, sz, true); h.setUint32(22, sz, true); h.setUint16(26, nm.length, true);
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(12, tm, true); c.setUint16(14, dt, true);
      c.setUint32(16, crc, true); c.setUint32(20, sz, true); c.setUint32(24, sz, true); c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
      parts.push(h.buffer, nm, e.data); cd.push(c.buffer, nm);
      off += 30 + nm.length + sz; cdSize += 46 + nm.length;
    });
    var z = new DataView(new ArrayBuffer(22));
    z.setUint32(0, 0x06054b50, true); z.setUint16(8, entries.length, true); z.setUint16(10, entries.length, true); z.setUint32(12, cdSize, true); z.setUint32(16, off, true);
    return new Blob(parts.concat(cd, [z.buffer]), { type: "application/zip" });
  }
  // Lecture d'un .zip « stored » (celui de l'export) : { nom: Uint8Array }. Un .zip compressé (refait à la main) est refusé.
  function unzip(buf) {
    var v = new DataView(buf), u8 = new Uint8Array(buf), dec = new TextDecoder(), e = -1, out = {};
    for (var i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) if (v.getUint32(i, true) === 0x06054b50) { e = i; break; }
    if (e < 0) throw new Error("zip");
    for (var k = 0, n = v.getUint16(e + 10, true), p = v.getUint32(e + 16, true); k < n; k++) {
      if (v.getUint32(p, true) !== 0x02014b50) throw new Error("zip");
      var meth = v.getUint16(p + 10, true), cs = v.getUint32(p + 20, true), nl = v.getUint16(p + 28, true), lo = v.getUint32(p + 42, true);
      var name = dec.decode(u8.subarray(p + 46, p + 46 + nl)), ds = lo + 30 + v.getUint16(lo + 26, true) + v.getUint16(lo + 28, true);
      if (meth !== 0) throw new Error("compressed");
      out[name] = u8.subarray(ds, ds + cs);
      p += 46 + nl + v.getUint16(p + 30, true) + v.getUint16(p + 32, true);
    }
    return out;
  }
  // Partage (iPhone : Fichiers, AirDrop…) ou téléchargement. « late » : fichier préparé après coup (lecture des photos),
  // le navigateur demande alors un nouveau toucher pour partager : feuille « Sauvegarde prête ».
  function deliver(blob, name, late, info) {
    var file = null;
    try { file = new File([blob], name, { type: blob.type }); } catch (e) {}
    var canShare = file && navigator.canShare && navigator.canShare({ files: [file] });
    function go() {
      if (canShare) {
        navigator.share({ files: [file], title: "Sauvegarde Notes" }).then(function () { markBackup(); say("Sauvegarde partagée."); }, function () {});
      } else {
        var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
        document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
        markBackup(); say("Fichier " + name + " téléchargé.");
      }
    }
    if (late && canShare) { haptic("success"); IOSSheet.confirm({ title: "Sauvegarde prête", message: info, ok: "Partager le fichier", danger: false }).then(function (ok) { if (ok) go(); else say(""); }); }
    else go();
  }
  function exportData(withPhotos) {
    if (!window.NotesApp || busy) return;
    if (!withPhotos || !photoPages() || !window.Photos || !Photos.all) {
      deliver(new Blob([JSON.stringify(payload(), null, 2)], { type: "application/json" }), "notes-sauvegarde-" + stamp() + ".json");
      return;
    }
    busy = true; say("Préparation de la sauvegarde…");
    var list = [], meta = [], entries = [];
    Photos.all().then(function (l) {
      list = l; var i = 0;
      function next() {
        if (i >= list.length) return Promise.resolve();
        var r = list[i++], name = "photos/" + String(i).padStart(4, "0") + ".jpg";
        meta.push({ file: name, note: r.note, n: r.n, at: r.at });
        return r.blob.arrayBuffer().then(function (b) { entries.push({ name: name, data: new Uint8Array(b) }); say("Préparation des photos : " + i + " sur " + list.length + "…"); return next(); });
      }
      return next();
    }).then(function () {
      var p = payload(); p.photos = meta;
      entries.unshift({ name: "notes-sauvegarde.json", data: new TextEncoder().encode(JSON.stringify(p, null, 2)) });
      var blob = zipBlob(entries); busy = false; say("");
      deliver(blob, "notes-sauvegarde-" + stamp() + "-photos.zip", true, "Notes et " + list.length + " page" + (list.length > 1 ? "s" : "") + " photo, " + sizeText(blob.size).replace("≈ ", "") + ".");
    }).catch(function () { busy = false; haptic("error"); say("Impossible de préparer la sauvegarde avec les photos. Réessaie, ou exporte sans les photos.", true); });
  }
  function readState(obj) { var st = obj && obj.state ? obj.state : (obj && obj.data ? obj.data : obj); return st && Array.isArray(st.grades) ? st : null; }
  function importFile(f) {
    var zip = /\.zip$/i.test(f.name) || /zip/.test(f.type), r = new FileReader();
    r.onload = function () {
      var obj, files = null, photos = [];
      try {
        if (zip) {
          files = unzip(r.result);
          obj = JSON.parse(new TextDecoder().decode(files["notes-sauvegarde.json"]));
          (obj.photos || []).forEach(function (m) { var d = files[m.file]; if (d && m.note) photos.push({ note: m.note, n: m.n, at: m.at, blob: new Blob([d], { type: "image/jpeg" }) }); });
        } else obj = JSON.parse(r.result);
      } catch (e) {
        haptic("error");
        say(e && e.message === "compressed" ? "Ce .zip a été recompressé : utilise le fichier exporté par l'app, tel quel." : "Ce fichier n'est pas une sauvegarde valide.", true); return;
      }
      var st = readState(obj);
      if (!st) { haptic("error"); say("Aucune note trouvée dans ce fichier.", true); return; }
      var n = st.grades.length, P = photos.length;
      haptic("warn");
      IOSSheet.confirm({ title: P ? "Remplacer tes notes et tes photos ?" : "Remplacer tes notes ?",
        message: P ? "Les notes et les photos de cet appareil sont remplacées par les " + n + " notes et les " + P + " pages photo du fichier. Cette action ne s'annule pas."
          : "Les notes de cet appareil sont remplacées par les " + n + " notes du fichier. Cette action ne s'annule pas.", ok: "Remplacer" }).then(function (ok) {
        if (!ok) return;
        window.NotesApp.replace(st);
        if (obj.exams) { try { localStorage.setItem(EK, JSON.stringify(obj.exams)); } catch (x) {} if (window.Cert && Cert.reload) { Cert.reload(); window.NotesApp.redraw(); } if (window.Sync) Sync.changed(); }
        if (!P) { haptic("success"); say(n + " notes importées."); return; }
        say("Restauration des photos…");
        Photos.replaceAll(photos).then(function () { haptic("success"); say(n + " notes et " + P + " pages photo importées."); },
          function () { haptic("error"); say(n + " notes importées, mais les photos n'ont pas pu être enregistrées (espace plein ?).", true); });
      });
    };
    if (zip) r.readAsArrayBuffer(f); else r.readAsText(f);
  }
  /* Page « Exporter » (Réglages → Sauvegarde → Exporter), mise en page B choisie par l'utilisateur le 22 novembre 2026
     (maquettes : design/maquettes-sauvegarde/exporter-v2.html), comme Réglages → Général → Stockage iPhone : taille totale
     en grand et barre partagée par couleur, puis une ligne par contenu (pastille, nombre, taille), puis l'interrupteur
     « Inclure les photos » avec seulement le stockage en plus, et le bouton Exporter. */
  var photoBytes = null;
  function choice() { return photosOn() && photoPages() ? "zip" : "json"; }
  function bytes(x) { try { return JSON.stringify(x, null, 2).length; } catch (e) { return 0; } }
  function plural(n, one, many) { return n + " " + (n > 1 ? many : one); }
  function parts() {
    var st = window.NotesApp.get(), g = st.grades || [], cfg = st.cfg || {}, subs = cfg.subjects || {};
    var notes = g.filter(function (r) { return r.kind !== "tadef" && !r.ta; }), tas = g.filter(function (r) { return r.kind === "tadef"; }), etas = g.filter(function (r) { return r.ta; });
    var goals = {}; Object.keys(subs).forEach(function (k) { if (subs[k] && subs[k].goal) goals[k] = subs[k].goal; });
    var ng = Object.keys(goals).length, ex = examsData(), list = [];
    list.push({ k: "notes", c: "blue", name: "Notes", sub: notes.length ? plural(notes.length, "test ou TP", "tests et TP") : "Aucune note", b: bytes(notes) });
    if (tas.length) list.push({ k: "ta", c: "purple", name: "Travaux assimilés", sub: plural(tas.length, "TA", "TA") + ", " + plural(etas.length, "ETA", "ETA"), b: bytes(tas) + bytes(etas) });
    list.push({ k: "goal", c: "orange", name: "Objectifs", sub: ng ? plural(ng, "branche", "branches") : "Aucun objectif", b: bytes(goals) });
    if (ex) { var ne = 0; (function walk(o) { for (var q in o) { if (typeof o[q] === "number") ne++; else if (o[q] && typeof o[q] === "object") walk(o[q]); } })(ex); list.push({ k: "exam", c: "pink", name: "Examens et notes reprises", sub: plural(ne, "note", "notes"), b: bytes(ex) }); }
    var pr = cfg.profile || {}, nb = window.NotesApp.subjectsAll ? window.NotesApp.subjectsAll().filter(function (s) { return !s.part; }).length : 0;
    list.push({ k: "set", c: "gray", name: "Profil et réglages", sub: [pr.classe, nb ? plural(nb, "branche", "branches") : ""].filter(Boolean).join(" · "), b: Math.max(0, bytes(cfg) - bytes(goals)) });
    return list;
  }
  function exportHtml() {
    var n = photoPages(), on = choice() === "zip", list = parts(), json = bytes(payload()), pb = photoBytes || 0;
    var total = json + (on ? pb : 0), segs = list.slice(), min = total * 0.025;
    if (on && pb) segs.push({ c: "teal", name: "Photos", b: pb });
    var bar = segs.map(function (s) { return '<i class="is-' + s.c + '" style="flex-grow:' + Math.max(s.b, min).toFixed(0) + '"></i>'; }).join("");
    var leg = segs.map(function (s) { return '<span class="is-' + s.c + '">' + (s.k === "set" ? "Réglages" : s.k === "exam" ? "Examens" : s.k === "ta" ? "TA" : s.name) + '</span>'; }).join("");
    var rows = list.map(function (s) {
      return '<div class="ios-row ios-bx-row"><i class="ios-bx-dot is-' + s.c + '" aria-hidden="true"></i><span class="ios-row-l">' + s.name + (s.sub ? '<small class="ios-row-s">' + s.sub + '</small>' : "") + '</span><span class="ios-val">' + (s.b < 500 ? "&lt; 1 Ko" : sizeText(s.b).replace("≈ ", "")) + '</span></div>';
    }).join("");
    var photoRow = n
      ? '<div class="ios-grp ios-bx-ph"><label class="ios-row"><span class="ios-row-l">Inclure les photos</span><span class="ios-val">' + (photoBytes == null ? "" : "+ " + sizeText(pb).replace("≈ ", "")) + '</span><input type="checkbox" switch data-bxp' + (on ? " checked" : "") + ' aria-label="Inclure les photos"></label></div>' +
        '<p class="ios-grp-foot">' + plural(n, "page photo", "pages photo") + '. Avec les photos, le fichier devient un .zip. Elles ne sont pas synchronisées : c\'est le seul moyen de les garder en changeant de téléphone.</p>'
      : '<div class="ios-grp ios-bx-ph"><div class="ios-row ios-bx-off"><span class="ios-row-l">Inclure les photos</span><span class="ios-val">Aucune photo</span></div></div>' +
        '<p class="ios-grp-foot">Aucune photo de test sur cet appareil.</p>';
    return '<div class="ios-grp ios-bx-stor"><div class="ios-bx-tot"><b>' + sizeText(total) + '</b><span>fichier ' + (on ? ".zip" : ".json") + '</span></div>' +
      '<div class="ios-bx-bar" aria-hidden="true">' + bar + '</div><div class="ios-bx-leg" aria-hidden="true">' + leg + '</div></div>' +
      '<p class="ios-grp-head">Contenu</p><div class="ios-grp">' + rows + '</div>' + photoRow +
      '<button type="button" class="btn ios-bx-btn" data-bx="go">Exporter</button>' +
      '<p class="ios-grp-foot" id="bx-msg" role="status"></p>';
  }
  function paintExport() {
    var box = $(".ios-bx"); if (!box) return;
    var msg = $("#bx-msg", box), keep = msg ? [msg.textContent, msg.style.color] : null;
    box.innerHTML = exportHtml();
    if (keep) { var m = $("#bx-msg", box); m.textContent = keep[0]; m.style.color = keep[1]; }
  }
  function measure() {
    if (!photoPages() || !window.Photos || !Photos.all) { photoBytes = 0; paintExport(); return; }
    Photos.all().then(function (l) { var b = 0; l.forEach(function (r) { b += r.blob.size || 0; }); photoBytes = b; paintExport(); }, function () {});
  }
  document.addEventListener("photos:changed", function () { photoBytes = null; if ($(".ios-bx")) measure(); });
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-bx]"); if (!b || b.disabled) return;
    if (b.dataset.bx === "go") exportData(choice() === "zip");
  });
  // Interrupteur « Inclure les photos » : la taille totale et la barre suivent tout de suite.
  document.addEventListener("change", function (e) {
    if (!e.target.matches || !e.target.matches("[data-bxp]")) return;
    try { localStorage.setItem(PK, e.target.checked ? "on" : "off"); } catch (x) {}
    paintExport();
  });
  function mountBackup() {
    var host = $("#set-block"); if (!host || $("#backup")) return;
    var div = document.createElement("div"); div.className = "backup"; div.id = "backup";
    var phone = window.matchMedia("all").matches;
    var txt = "Tes notes restent sur ce téléphone. Exporte-les de temps en temps (Fichiers, AirDrop) pour ne rien perdre. Les photos des tests ne sont pas synchronisées : pour les garder en changeant d'iPhone, touche Exporter et active « Inclure les photos ».";
    // Grand écran (session D) : même texte, pour un ordinateur.
    if (window.matchMedia("(min-width: 701px)").matches) txt = "Tes notes restent dans ce navigateur. Exporte-les de temps en temps pour ne rien perdre. Les photos des tests ne sont pas synchronisées : pour les garder, touche Exporter et active « Inclure les photos ».";
    var hapRow = '<label class="row ios-bk-hap">Retours haptiques<input type="checkbox" switch id="bk-haptic"' + (hapticsOn ? " checked" : "") + '></label>';
    // Téléphone (v58, style C) : groupe de lignes iOS ; l'interrupteur haptique vit dans Réglages › Données (ios-settings.js).
    div.innerHTML = phone ?
      '<p class="ios-grp-head">Fichier de sauvegarde</p><div class="ios-grp">' +
        '<button type="button" class="ios-row ios-act" id="bk-export">Exporter</button>' +
        '<button type="button" class="ios-row ios-act" id="bk-import">Importer un fichier</button><button type="button" class="ios-row ios-act" id="bk-sheet">Importer depuis un tableur</button></div>' +
        '<p class="ios-grp-foot" id="bk-last"></p><p class="ios-grp-foot">' + txt + '</p>' +
        '<input type="file" id="bk-file" accept="application/json,.json,application/zip,.zip"><p class="ok ios-grp-foot" id="bk-msg" role="status"></p>' + hapRow :
      '<h3>Sauvegarde</h3><p class="muted small">' + txt + '</p>' +
      '<div class="btns"><button type="button" class="btn" id="bk-export">Exporter</button>' +
      '<button type="button" class="btn-ghost" id="bk-import">Importer un fichier</button><button type="button" class="btn-ghost" id="bk-sheet">Importer depuis un tableur</button></div>' +
      '<input type="file" id="bk-file" accept="application/json,.json,application/zip,.zip">' +
      '<p class="ok" id="bk-msg" role="status"></p>' + hapRow;
    host.appendChild(div);
    // Exporter : page « Exporter » (choix avec ou sans photos) ; hors de Réglages, export simple comme avant.
    $("#bk-export").addEventListener("click", function () {
      if (window.IOSSettings && IOSSettings.active()) { photoBytes = null; IOSSettings.push("export"); measure(); }
      else exportData(false);
    });
    lastLine();
    $("#bk-import").addEventListener("click", function () { $("#bk-file").click(); });
    // Import depuis un tableur (Excel…) via une IA : import.js n'est téléchargé qu'à cet instant.
    $("#bk-sheet").addEventListener("click", function () {
      // Dans Réglages (Sauvegarde) : sous-page « Importer », comme depuis la ligne de Réglages.
      if (window.IOSSettings && IOSSettings.active() && IOSSettings.openImport) { IOSSettings.openImport(); return; }
      Grid.script("import.js").then(function () { Import.open(); }, function () { IOSSheet.notice({ title: "Connexion nécessaire", message: "L'import se charge à la première utilisation : connecte-toi à Internet, puis réessaie." }); });
    });
    $("#bk-file").addEventListener("change", function (e) { var f = e.target.files && e.target.files[0]; if (f) importFile(f); e.target.value = ""; });
    $("#bk-haptic").addEventListener("change", function (e) {
      hapticsOn = e.target.checked;
      try { localStorage.setItem(HK, hapticsOn ? "on" : "off"); } catch (x) {}
      if (hapticsOn) haptic("success");
    });
  }

  /* ---------- Installation ---------- */
  function mountInstallTip() {
    var ua = navigator.userAgent;
    var ios = !/Android/i.test(ua) && (/iP(hone|ad|od)/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
    var dots = (parseInt((ua.match(/Version\/(\d+)/) || [])[1], 10) || 0) >= 26;
    var standalone = window.navigator.standalone || window.matchMedia("(display-mode: standalone)").matches;
    var dismissed = false; try { dismissed = localStorage.getItem("notes2m01.tip") === "off"; } catch (e) {}
    if (!ios || standalone || dismissed) return;
    var tip = document.createElement("div"); tip.className = "install-tip";
    tip.innerHTML = window.Icons.svg("share") +
      '<p>Installe l\'app : touche ' + (dots ? '<b>•••</b>, puis ' : '') + '<b>Partager</b>, puis <b>Sur l\'écran d\'accueil</b>.</p><button type="button" class="link" id="tip-x">OK</button>';
    var wrap = $(".wrap"); wrap.insertBefore(tip, $("#demo"));
    $("#tip-x").addEventListener("click", function () {
      try { localStorage.setItem("notes2m01.tip", "off"); } catch (e) {}
      if (!canAnim()) { tip.remove(); return; }
      tip.style.height = tip.offsetHeight + "px"; void tip.offsetHeight; tip.classList.add("ios-tip-out");
      setTimeout(function () { tip.remove(); }, 400);
    });
  }

  /* ---------- Changement de verdict : la pastille pulse ---------- */
  var lastPill = null;
  function pulsePill() {
    var p = $("#promo .pill"); if (!p) return;
    var t = p.textContent;
    if (lastPill !== null && t !== lastPill) replay(p, "ios-pulse", 700);
    lastPill = t;
  }

  /* ---------- Branchements ---------- */
  window.FX = {
    haptic: haptic,
    exportHtml: exportHtml,
    rendered: function () {
      placeSeg(); pulsePill();
      document.dispatchEvent(new CustomEvent("ios:rendered"));   // barre du bas (ios-tabbar.js) : pastilles et verdict
    },
    view: function () { placeTab(); },
    success: function () { haptic("success"); },
    backupAt: backupAt
  };
  mountBackup(); mountInstallTip();
  placeSeg(); placeTab();

  if ("serviceWorker" in navigator && location.protocol === "https:") {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
  }
})();
