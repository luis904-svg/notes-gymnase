/* ios-desk.js : grand écran (≥ 701 px), session D du 19 novembre 2026, option A choisie par l'utilisateur
   (maquettes : design/maquettes-grand-ecran/option-A.png). Depuis la v75, les modules ios-* s'appliquent à toutes les
   largeurs (même apparence partout) ; sur grand écran, ce module remplace la barre du bas par une barre latérale façon
   Réglages de l'iPad / du Mac, et ios.css (bloc « Grand écran ») met les pages en colonnes.
   Barre latérale (.ios-side, hors de .wrap) :
   - champ Rechercher : filtre la liste des branches en direct ; Entrée ouvre la première, Échap vide le champ ;
     raccourcis « / » et ⌘F / Ctrl+F pour y aller ;
   - Accueil, Ajouter une note, Réglages (carré d'icône coloré, comme Réglages) : même chemin que les onglets du bas
     (clic sur le bouton [data-tab] du moteur), donc rien ne change dans la logique ;
   - Branches : nom, point de niveau (vert, orange à 4, rouge sous 4 : aplat seulement) et note de bulletin en noir (v56) ;
     clic = NotesApp.showSubject (page de la branche dans le contenu) ;
   - ligne sélectionnée = page affichée (onglet, ou branche ouverte) ; ↑ ↓ passent d'une ligne à l'autre, Début / Fin.
   Le téléphone n'est pas touché : sous 701 px la barre latérale n'est pas affichée (body sans .ios-desk). */
(function () {
  "use strict";
  var A = window.NotesApp, tabbar = document.getElementById("tabbar");
  if (!A || !tabbar) return;
  var mq = window.matchMedia("(min-width: 701px)");
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function ic(n) { return window.Icons ? Icons.svg(n) : ""; }
  function half(v) { return v == null ? null : window.Grid && window.NotesApp && NotesApp.bulletin && NotesApp.profile() && Grid.cantonOf(NotesApp.profile()) !== "vd" ? NotesApp.bulletin(v) : Math.floor(v * 2 + 0.5 + 1e-9) / 2; }   // dixième à Genève
  function fmtB(b) { return b == null ? "–" : b % 1 === 0 ? String(b) : b.toFixed(1); }
  function norm(s) { return (s.normalize ? s.normalize("NFD").replace(/[̀-ͯ]/g, "") : s).toLowerCase(); }
  function view() { var b = tabbar.querySelector('[aria-current="page"]'); return b ? b.dataset.tab : "dash"; }

  var side = document.createElement("nav");
  side.className = "ios-side"; side.setAttribute("aria-label", "Navigation");
  side.innerHTML =
    '<label class="ios-side-find">' + ic("search") + '<input type="search" autocomplete="off" placeholder="Rechercher" aria-label="Rechercher une branche" aria-keyshortcuts="/ Control+F Meta+F"></label>' +
    '<div class="ios-side-grp" data-grp="nav">' +
      '<button type="button" class="ios-side-row" data-go="dash"><span class="ios-side-sq is-blue">' + ic("home") + '</span><span class="ios-side-n">Accueil</span><i class="ios-side-dot" hidden></i></button>' +
      '<button type="button" class="ios-side-row" data-go="add"><span class="ios-side-sq is-green">' + ic("add") + '</span><span class="ios-side-n">Ajouter une note</span></button>' +
      '<button type="button" class="ios-side-row" data-go="settings"><span class="ios-side-sq is-gray">' + ic("settings") + '</span><span class="ios-side-n">Réglages</span><i class="ios-side-dot" hidden></i></button>' +
    '</div>' +
    '<p class="ios-side-h">Branches</p><div class="ios-side-grp ios-side-subj" data-grp="subj"></div>' +
    '<p class="ios-side-none" hidden>Aucune branche ne correspond.</p>';
  document.body.appendChild(side);
  var field = side.querySelector("input"), list = side.querySelector(".ios-side-subj"), none = side.querySelector(".ios-side-none");

  /* ---------- Branches ---------- */
  function subjects() { return A.subjectsAll().filter(function (s) { return !s.part; }); }
  function paintSubjects() {
    var q = norm(field.value.trim()), html = "", n = 0;
    subjects().forEach(function (s) {
      if (q && norm(s.name).indexOf(q) < 0) return;
      // En mode exemple, annualAvg lit les vraies notes : on prend alors la courbe de l'année (notes d'exemple), comme le tableau.
      var ser = A.demo && A.demo() && A.series ? A.series(s.id, "year") : null;
      var a = ser ? (ser.length ? ser[ser.length - 1].avg : null) : A.annualAvg(s.id), b = half(a), tone = b == null ? "none" : b < 4 ? "crit" : b < 4.5 ? "warn" : "good";
      n++;
      html += '<button type="button" class="ios-side-row" data-subj-go="' + esc(s.id) + '" aria-label="' + esc(s.name) + (b == null ? ", pas encore de note" : ", bulletin " + fmtB(b)) + '">' +
        '<i class="ios-side-lv is-' + tone + '" aria-hidden="true"></i><span class="ios-side-n">' + esc(s.name) + '</span><span class="ios-side-v">' + fmtB(b) + '</span></button>';
    });
    list.innerHTML = html; list.hidden = !n; none.hidden = !!n;
    select();
  }
  /* Ligne sélectionnée : la branche ouverte, sinon l'onglet affiché. */
  function select() {
    var open = document.body.classList.contains("ios-detail-open") && A.detailId ? A.detailId() : null, v = view();
    [].forEach.call(side.querySelectorAll(".ios-side-row"), function (r) {
      var on = open ? r.dataset.subjGo === open : r.dataset.go === v;
      r.classList.toggle("is-sel", !!on);
      if (on) r.setAttribute("aria-current", "page"); else r.removeAttribute("aria-current");
    });
  }

  /* ---------- Clic ---------- */
  side.addEventListener("click", function (e) {
    var r = e.target.closest(".ios-side-row"); if (!r) return;
    if (r.dataset.go) {
      var t = r.dataset.go, b = tabbar.querySelector('[data-tab="' + t + '"]');
      if (t === "dash" && window.IOSDetail && IOSDetail.active()) { IOSDetail.back(); return; }
      if (t === "settings" && view() === "settings" && window.IOSSettings && IOSSettings.depth() > 1) { IOSSettings.root(); return; }
      if (b) b.click();
    } else if (r.dataset.subjGo) {
      A.showSubject(r.dataset.subjGo);
    }
    select();
  });

  /* ---------- Clavier ---------- */
  function rows() { return [].slice.call(side.querySelectorAll(".ios-side-row")).filter(function (r) { return r.offsetParent; }); }
  side.addEventListener("keydown", function (e) {
    var r = e.target.closest && e.target.closest(".ios-side-row");
    if (e.target === field) {
      if (e.key === "Escape") { if (field.value) { field.value = ""; paintSubjects(); } else field.blur(); e.preventDefault(); return; }
      // Entrée : ouvre la première branche trouvée, puis vide la recherche (toute la liste revient, la branche reste choisie).
      if (e.key === "Enter") {
        var f = list.querySelector("[data-subj-go]"); if (!f) return;
        e.preventDefault(); var id = f.dataset.subjGo; f.click(); field.value = ""; paintSubjects();
        var again = list.querySelector('[data-subj-go="' + id + '"]'); if (again) again.focus();
        return;
      }
      if (e.key === "ArrowDown") { var first = list.querySelector("[data-subj-go]"); if (first) { e.preventDefault(); first.focus(); } }
      return;
    }
    if (!r) return;
    var all = rows(), i = all.indexOf(r), k = e.key, to = null;
    if (k === "ArrowDown") to = all[Math.min(all.length - 1, i + 1)];
    else if (k === "ArrowUp") to = i === 0 ? field : all[i - 1];
    else if (k === "Home") to = all[0];
    else if (k === "End") to = all[all.length - 1];
    if (to) { e.preventDefault(); to.focus(); }
  });
  field.addEventListener("input", paintSubjects);
  document.addEventListener("keydown", function (e) {
    if (!mq.matches) return;
    var t = e.target, typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
    var modal = document.body.classList.contains("ob-open") || document.body.classList.contains("gd-open") || (window.IOSSheet && IOSSheet.isOpen());
    if (modal) return;
    if ((e.key === "/" && !typing) || ((e.metaKey || e.ctrlKey) && (e.key === "f" || e.key === "F"))) { e.preventDefault(); field.focus(); field.select(); return; }
    // Échap sur la page d'une branche : retour à l'Accueil (comme le chevron).
    if (e.key === "Escape" && !typing && window.IOSDetail && IOSDetail.active()) { e.preventDefault(); IOSDetail.back(); }
  });

  /* ---------- Pastilles : branches sous 4 (Accueil), synchronisation en erreur (Réglages) ---------- */
  var syncBad = false;
  function dots() {
    var low = subjects().filter(function (s) { if (s.counts === false || (A.demo && A.demo())) return false; var b = half(A.annualAvg(s.id)); return b != null && b < 4; }).length;
    var d1 = side.querySelector('[data-go="dash"] .ios-side-dot'), d2 = side.querySelector('[data-go="settings"] .ios-side-dot');
    d1.hidden = !low; d1.textContent = low > 9 ? "9+" : String(low || "");
    d2.hidden = !syncBad;
    side.querySelector('[data-go="dash"]').setAttribute("aria-label", "Accueil" + (low ? ", " + low + " branche" + (low > 1 ? "s" : "") + " sous 4" : ""));
    side.querySelector('[data-go="settings"]').setAttribute("aria-label", "Réglages" + (syncBad ? ", synchronisation en erreur" : ""));
  }
  document.addEventListener("sync:status", function (e) {
    syncBad = !!(window.Sync && Sync.enabled()) && (e.detail === "offline" || e.detail === "badcode"); dots();
  });

  function paint() { paintSubjects(); dots(); }
  // Les pastilles des sélecteurs (fx.js) et le graphique « Toutes les moyennes » (ios-dash.js) ont été mesurés avant la
  // mise en page grand écran : un événement resize les remesure.
  function layout() {
    var was = document.body.classList.contains("ios-desk");
    document.body.classList.toggle("ios-desk", mq.matches);
    if (was !== mq.matches) requestAnimationFrame(function () { window.dispatchEvent(new Event("resize")); });
  }
  document.addEventListener("ios:rendered", paint);
  document.addEventListener("ios:view", function () { setTimeout(select, 0); });
  new MutationObserver(select).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  if (mq.addEventListener) mq.addEventListener("change", layout); else if (mq.addListener) mq.addListener(layout);
  layout(); paint();
  window.IOSDesk = { paint: paint, find: function () { field.focus(); } };
})();
