/* ios-tabbar.js : barre du bas enrichie (téléphone, ≤ 700 px), v44. La barre reste TOUJOURS en bas de l'écran, y compris
   dans les sous-pages de Réglages et le détail d'une matière (elle n'est plus cachée). Seuls l'assistant, le guide, les
   écrans plein écran (photos, scanner, réussite) et le clavier ouvert la recouvrent, comme sur iOS.
   Structure : un « dock » fixe (.ios-dock, hors de .wrap, au-dessus des fantômes de ios-nav.js) qui contient :
   - l'accessoire (.ios-acc, comme le mini-lecteur de Musique sous iOS 26) : la pastille du verdict de l'Accueil (#promo,
     promotion en 1re-2e, certificat en 3e) et le nombre de branches sous 4 ; toucher = Accueil,
     défilé jusqu'au verdict. Caché sur l'Accueil tant que le verdict est visible, et tant qu'il n'y a pas de notes ;
   - la pilule d'onglets existante (#tabbar, déplacée ici ; appui long glissé et balayage rapide : fx.js) ;
   - le bouton rond Rechercher (.ios-find-btn), à droite de la pilule comme l'onglet de recherche d'iOS 26 : ouvre la
     recherche des branches (.ios-find) ; toucher une branche ouvre son détail, « + » ouvre Ajouter sur cette branche.
   Pastilles : Accueil = nombre de branches sous 4 (note de bulletin arrondie au demi-point, branches qui comptent) ;
   Réglages = point rouge quand la synchronisation est en erreur (événement sync:status de sync.js).
   Onglet déjà actif touché : Réglages revient à la page principale (puis remonte en haut au toucher suivant) ;
   Ajouter met le curseur dans le champ de la note. Le reste (retour du détail, remontée en haut) est dans index.html. */
(function () {
  "use strict";
  var bar = document.getElementById("tabbar");
  if (!bar || !window.NotesApp) return;
  var mq = window.matchMedia("(max-width: 700px)");
  function hap(k) { if (window.FX) FX.haptic(k); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function app() { return window.NotesApp; }
  function roundHalf(x) { return x == null ? null : Math.floor(x * 2 + 0.5 + 1e-9) / 2; }
  function fmt(v) { return v == null ? "–" : (Math.round(v * 100) / 100).toFixed(2); }
  function tab(name) { return bar.querySelector('[data-tab="' + name + '"]'); }
  function view() { var b = bar.querySelector('[aria-current="page"]'); return b ? b.dataset.tab : "dash"; }

  /* ---------- Dock ---------- */
  var dock = document.createElement("div"); dock.className = "ios-dock";
  var acc = document.createElement("button"); acc.type = "button"; acc.className = "ios-acc"; acc.hidden = true;
  var row = document.createElement("div"); row.className = "ios-dock-row";
  var find = document.createElement("button"); find.type = "button"; find.className = "ios-find-btn";
  find.setAttribute("aria-label", "Rechercher une branche");
  find.innerHTML = window.Icons ? Icons.svg("search") : "";
  bar.parentNode.insertBefore(dock, bar);
  row.appendChild(bar); row.appendChild(find);
  dock.appendChild(acc); dock.appendChild(row);
  document.body.classList.add("ios-has-dock");

  /* ---------- Pastilles ---------- */
  function badge(btn, cls) {
    var b = btn && btn.querySelector(".ios-badge");
    if (btn && !b) { b = document.createElement("i"); b.className = "ios-badge"; b.setAttribute("aria-hidden", "true"); btn.appendChild(b); }
    return b;
  }
  function subjects() {
    return app().subjectsAll().filter(function (s) { return !s.part; });
  }
  function lows() {
    if (app().demo && app().demo()) return 0;
    return subjects().filter(function (s) {
      if (s.counts === false) return false;
      var a = app().annualAvg(s.id); return a != null && roundHalf(a) < 4;
    }).length;
  }
  var syncBad = false;
  function paintBadges() {
    var home = tab("dash"), set = tab("settings"), n = lows();
    var bh = badge(home); bh.textContent = n > 9 ? "9+" : String(n); bh.hidden = !n;
    home.setAttribute("aria-label", "Accueil" + (n ? ", " + n + " branche" + (n > 1 ? "s" : "") + " sous 4" : ""));
    var bs = badge(set); bs.classList.add("ios-badge-dot"); bs.textContent = ""; bs.hidden = !syncBad;
    set.setAttribute("aria-label", "Réglages" + (syncBad ? ", synchronisation en erreur" : ""));
  }
  document.addEventListener("sync:status", function (e) {
    syncBad = !!(window.Sync && Sync.enabled()) && (e.detail === "offline" || e.detail === "badcode"); paintBadges();
  });

  /* ---------- Accessoire : le verdict en une ligne ---------- */
  var promoSeen = false;
  function paintAcc() {
    // Le verdict affiché par l'Accueil fait foi (promotion en 1re et 2e, certificat en 3e : cert.js écrit la même pastille).
    var pill = document.querySelector("#promo .pill"), has = app().grades().length > 0 || (app().demo && app().demo());
    var cls = pill ? ((pill.className.match(/\bt-(good|warn|crit|none)\b/) || [])[0] || "t-none") : "t-none";
    var v = pill ? { cls: cls, label: pill.textContent.trim() } : null;
    var show = mq.matches && v && v.label && has && !(view() === "dash" && promoSeen && !document.body.classList.contains("ios-detail-open"));
    if (v) {
      var n = lows();
      acc.innerHTML = '<span class="ios-acc-dot ios-acc-' + esc(v.cls) + '" aria-hidden="true"></span><span class="ios-acc-t">' + esc(v.label) + '</span>' +
        '<span class="ios-acc-s">' + (n ? n + " sous 4" : "aucune sous 4") + '</span>' + (window.Icons ? Icons.svg("chevr", "ios-acc-chev") : "");
      acc.setAttribute("aria-label", "Verdict : " + v.label + (n ? ", " + n + " branche" + (n > 1 ? "s" : "") + " sous 4" : "") + ". Voir le détail sur l'Accueil.");
    }
    if (acc.hidden === !!show) { acc.hidden = !show; document.body.classList.toggle("ios-has-acc", !!show); }
  }
  var promo = document.getElementById("promo");
  if (promo && window.IntersectionObserver) {
    new IntersectionObserver(function (es) { promoSeen = es[0].isIntersecting; paintAcc(); }, { threshold: 0.2 }).observe(promo);
  }
  acc.addEventListener("click", function () {
    hap("select");
    function scroll() { var p = document.getElementById("promo"); if (p) p.scrollIntoView({ behavior: "smooth", block: "center" }); }
    if (window.IOSDetail && IOSDetail.active()) { IOSDetail.back(); setTimeout(scroll, 450); return; }
    if (view() !== "dash") { tab("dash").click(); setTimeout(scroll, 60); return; }
    scroll();
  });

  function paint() { paintBadges(); paintAcc(); }
  document.addEventListener("ios:rendered", paint);
  document.addEventListener("ios:view", function () { setTimeout(paintAcc, 0); });
  new MutationObserver(paintAcc).observe(document.body, { attributes: true, attributeFilter: ["class"] });

  /* ---------- Onglet déjà actif touché ---------- */
  bar.addEventListener("click", function (e) {
    var b = e.target.closest("[data-tab]"); if (!b || b.getAttribute("aria-current") !== "page") return;
    if (b.dataset.tab === "settings" && window.IOSSettings && IOSSettings.depth && IOSSettings.depth() > 1) {
      e.stopImmediatePropagation(); IOSSettings.root(); return;
    }
    if (b.dataset.tab === "add") { var f = document.getElementById("f-val"); if (f && window.scrollY < 40) { e.stopImmediatePropagation(); f.focus(); } }
  }, true);

  /* ---------- Recherche des branches ---------- */
  var page = null, field = null, list = null;
  function rows(q) {
    q = (q || "").trim().toLowerCase();
    var norm = function (s) { return s.normalize ? s.normalize("NFD").replace(/[̀-ͯ]/g, "") : s; };
    var nq = norm(q);
    var items = subjects().filter(function (s) { return !nq || norm(s.name.toLowerCase()).indexOf(nq) >= 0; });
    if (!items.length) return '<p class="ios-find-none">Aucune branche ne correspond.</p>';
    return '<div class="ios-grp ios-find-list">' + items.map(function (s) {
      var a = app().annualAvg(s.id), tone = a == null ? "none" : roundHalf(a) < 4 ? "crit" : a < 4.5 ? "warn" : "good";
      return '<div class="ios-find-row"><button type="button" class="ios-find-go" data-find="' + esc(s.id) + '">' +
        '<span class="ios-find-n">' + esc(s.name) + '</span><span class="ios-find-v ios-tone-' + tone + '">' + fmt(a) + '</span></button>' +
        '<button type="button" class="ios-find-add" data-find-add="' + esc(s.id) + '" aria-label="Ajouter une note en ' + esc(s.name) + '">' + (window.Icons ? Icons.svg("add") : "+") + '</button></div>';
    }).join("") + '</div>';
  }
  function openFind() {
    if (page) return;
    hap("select");
    page = document.createElement("div"); page.className = "ios-find"; page.setAttribute("role", "dialog"); page.setAttribute("aria-modal", "true"); page.setAttribute("aria-label", "Rechercher une branche");
    page.innerHTML = '<div class="ios-find-top"><label class="ios-find-field">' + (window.Icons ? Icons.svg("search") : "") +
      '<input type="search" enterkeyhint="search" autocomplete="off" placeholder="Rechercher une branche" aria-label="Rechercher une branche"></label>' +
      '<button type="button" class="link ios-find-x">Annuler</button></div><div class="ios-find-body"></div>';
    document.body.appendChild(page); document.body.classList.add("ios-find-open");
    field = page.querySelector("input"); list = page.querySelector(".ios-find-body");
    list.innerHTML = rows("");
    field.addEventListener("input", function () { list.innerHTML = rows(field.value); });
    field.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeFind();
      if (e.key === "Enter") { var f = list.querySelector("[data-find]"); if (f) { e.preventDefault(); f.click(); } }
    });
    page.addEventListener("click", function (e) {
      if (e.target.closest(".ios-find-x")) { closeFind(); return; }
      var go = e.target.closest("[data-find]"), add = e.target.closest("[data-find-add]");
      if (go) { var id = go.dataset.find; closeFind(); app().showSubject(id); return; }
      if (add) {
        var sid = add.dataset.findAdd; closeFind(); app().goAdd();
        var sel = document.getElementById("f-subj"), s = app().subjectsAll().filter(function (x) { return x.id === sid; })[0], leaf = s && s.parts ? s.parts[0] : sid;
        if (sel && [].some.call(sel.options, function (o) { return o.value === leaf; })) { sel.value = leaf; sel.dispatchEvent(new Event("change", { bubbles: true })); }
      }
    });
    setTimeout(function () { if (field) field.focus(); }, 30);
  }
  function closeFind() {
    if (!page) return;
    var p = page; page = null; field = null; list = null;
    if (document.activeElement && p.contains(document.activeElement)) document.activeElement.blur();
    document.body.classList.remove("ios-find-open");
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("noanim");
    if (reduce) { p.remove(); return; }
    p.classList.add("ios-find-out"); setTimeout(function () { p.remove(); }, 220);
  }
  find.addEventListener("click", openFind);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && page) closeFind(); });

  /* ---------- Clavier ouvert : la barre passe derrière, comme sur iOS ----------
     Sur iPhone, un élément fixe en bas peut sinon se retrouver au milieu de l'écran quand le clavier est ouvert. */
  var vv = window.visualViewport;
  function kb() {
    var open = !!vv && mq.matches && window.innerHeight - vv.height > 150;
    document.body.classList.toggle("ios-kb", open);
  }
  if (vv) { vv.addEventListener("resize", kb); vv.addEventListener("scroll", kb); }
  document.addEventListener("focusout", function () { setTimeout(kb, 60); });

  if (mq.addEventListener) mq.addEventListener("change", paint);
  paint();
  window.IOSTabbar = { paint: paint, find: openFind, closeFind: closeFind };
})();
