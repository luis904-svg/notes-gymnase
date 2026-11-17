/* Notes (gymnase) — passage d'une année à l'autre.
   « Passer à l'année suivante » classe les notes de l'année dans « Années précédentes » (rien n'est supprimé),
   remet les moyennes à zéro, passe au profil de l'année suivante et décale les dates de semestre.
   « Annuler le dernier passage » remet tout comme avant. */
(function () {
  "use strict";
  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function hap(k) { if (window.FX) FX.haptic(k); }
  function app() { return window.NotesApp; }
  var ORD = { 1: "1re", 2: "2e", 3: "3e" };
  // Fondu d'entrée (remis en v44) : rien avec ?noanim=1 ou « Réduire les animations ».
  function A(t, kf, o) { return window.IOSMotion ? window.IOSMotion.animate(t, kf, o) : Promise.resolve(); }
  var root = null;

  function fmtB(b) { return b == null ? "–" : (Number.isInteger(b) ? String(b) : b.toFixed(1)); }
  function fmtDate(iso) { var p = String(iso).split("-"); return p.length === 3 ? p[2] + "." + p[1] + "." + p[0] : iso; }
  function years() { var y = parseInt(app().get().cfg.s1End.slice(0, 4), 10); return { cur: (y - 1) + "–" + y, next: y + "–" + (y + 1), y: y }; }

  /* ---------- Fenêtre plein écran (même style que la configuration) ---------- */
  function show(html, wire) {
    if (root) return;
    root = document.createElement("div");
    root.className = "ob"; root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true");
    root.innerHTML = html;
    document.body.appendChild(root); document.body.classList.add("ob-open");
    root.scrollTop = 0;
    A(root, { opacity: [0, 1] }, { duration: 0.25 });
    root.addEventListener("click", function (e) {
      if (e.target.closest("[data-yp-close]")) { close(); return; }
      if (wire) wire(e);
    });
  }
  function close() {
    if (!root) return;
    var el = root; root = null;
    document.body.classList.remove("ob-open");
    el.remove();
  }

  /* ---------- Passer à l'année suivante ---------- */
  function openPass() {
    var pr = app().profile();
    if (!pr || pr.year >= 3 || root) return;
    var next = pr.year + 1, v = app().verdict(), st = app().get(), yr = years(), n = st.grades.length;
    var art = pr.art === "mu" ? "la musique" : "les arts visuels";
    var items = [
      "Tes " + n + " note" + (n > 1 ? "s" : "") + " de " + yr.cur + " sont classées dans « Années précédentes ». Rien n'est supprimé.",
      "Les moyennes repartent de zéro pour " + yr.next + ".",
      "Tes choix (langues, option spécifique, maths) sont conservés.",
      "Les dates de semestre passent à " + (yr.y + 1) + "."
    ];
    if (next === 3) {
      items.splice(2, 0, "Chimie, physique et " + art + " ne sont plus enseignées en 3e : leur note de 2e sera reprise pour le certificat.");
      items.push("Tu choisiras ton option complémentaire juste après.");
    }
    var verdict = v.status === "none" ? "" :
      '<p class="ob-sub">Verdict actuel : <span class="pill ' + v.cls + '">' + esc(v.label) + '</span></p>';
    show(
      '<div class="ob-top ob-top-c"><button type="button" class="ob-round" data-yp-close aria-label="Annuler">' + (window.Icons ? Icons.svg("times") : "×") + '</button><b class="ob-bar-t">Année scolaire</b><span class="ob-round-sp"></span></div>' +
      '<div class="ob-body"><h1 class="ob-title">Passer en ' + ORD[next] + ' année</h1>' + (verdict || '<p class="ob-sub">Ton année ' + yr.cur + ' est terminée ?</p>') +
      '<div class="ob-list ob-recap">' + items.map(function (t) { return '<div class="ob-row ob-static"><span class="ob-txt"><span class="ob-n" style="font-weight:400">' + esc(t) + '</span></span></div>'; }).join("") + '</div>' +
      '<p class="ob-tip"><b>Tu peux annuler.</b> Réglages → « Annuler le dernier passage » remet tes notes de ' + yr.cur + ' dans le tableau de bord, même après le passage.</p>' +
      '<p class="ob-fine">Le verdict est indicatif et ne bloque pas le passage : seul ton bulletin fait foi.</p></div>' +
      '<div class="ob-foot"><button type="button" class="btn ob-next" id="yp-go">Passer en ' + ORD[next] + ' année</button></div>',
      function (e) {
        if (!e.target.closest("#yp-go")) return;
        app().passYear(next); hap("success"); close();
        if (next === 3 && window.Onboard) setTimeout(function () { Onboard.open(true, "oc"); }, 300);
      });
  }

  /* ---------- Années précédentes ---------- */
  function rowHtml(e, r) {
    var notes = (app().collapse ? app().collapse(e.grades) : e.grades).filter(function (g) { return r.ids.indexOf(g.subject) >= 0; }).sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
    var sub = (r.avg != null ? "moy. exacte " + r.avg.toFixed(2) + " · " : "") + r.n + " note" + (r.n > 1 ? "s" : "") + (r.counts ? "" : " · ne compte pas");
    var head = '<span class="ob-txt"><span class="ob-n">' + esc(r.name) + '</span><span class="ob-s">' + esc(sub) + '</span></span><span class="yp-b ' + (r.bulletin != null && r.bulletin < 4 ? "crit" : "") + '">' + fmtB(r.bulletin) + '</span>';
    if (!notes.length) return '<div class="yp-br yp-empty"><div class="yp-sum">' + head + '</div></div>';
    return '<details class="yp-br"><summary class="yp-sum">' + head + '</summary><ul class="yp-notes">' + notes.map(function (g) {
      var s = (g.label && g.label !== "Exemple" ? esc(g.label) : "note");
      return '<li><span>' + fmtDate(g.date) + ' · ' + s + (g.type === "tp" ? ' · TP' : '') + (g.taBlock ? ' · TA (' + g.taBlock.etas.length + ' ETA)' : '') + (g.coef && g.coef !== 1 ? ' · coef ' + g.coef : '') + '</span><span class="mono ' + (g.value < 4 ? "crit" : "") + '">' + g.value + '</span></li>';
    }).join("") + '</ul></details>';
  }
  function openHistory() {
    var arch = app().archive().slice().reverse();
    if (!arch.length || root) return;
    show('<div class="ob-top ob-top-c"><button type="button" class="ob-round" data-yp-close aria-label="Retour">' + (window.Icons ? Icons.svg("chevl") : "‹") + '</button><b class="ob-bar-t">Années précédentes</b><span class="ob-round-sp"></span></div>' +
      '<div class="ob-body"><h1 class="ob-title">Années précédentes</h1><p class="ob-sub">Tes notes et tes moyennes de chaque année terminée.</p>' +
      arch.map(function (e) {
        var rows = app().archiveStats(e), n = e.grades.length;
        return '<section class="yp-year"><h2>' + esc(e.label) + ' · ' + ORD[e.year] + ' année</h2>' +
          '<p class="muted small" style="margin:2px 0 10px">' + (e.verdict ? "Verdict en fin d'année : " + esc(e.verdict) + " · " : "") + n + " note" + (n > 1 ? "s" : "") + '</p>' +
          '<div class="ob-list">' + rows.map(function (r) { return rowHtml(e, r); }).join("") + '</div></section>';
      }).join("") +
      '<button type="button" class="link danger" id="yp-undo-h" style="padding-left:0;margin-top:18px">Annuler le dernier passage…</button>' +
      '<p class="ob-fine">Remet les notes de ' + esc(arch[0].label) + ' dans le tableau de bord et revient en ' + ORD[arch[0].year] + ' année.</p></div>',
      function (e) { if (e.target.closest("#yp-undo-h") && undo()) close(); });
  }

  /* ---------- Annuler le dernier passage ---------- */
  function undo() {
    var arch = app().archive(); if (!arch.length) return;
    var e = arch[arch.length - 1], n = app().grades().length;
    if (!window.confirm("Revenir à la " + ORD[e.year] + " année (" + e.label + ") ? Tes notes de " + e.label + " reviennent dans le tableau de bord." +
      (n ? (n > 1 ? " Les " + n + " notes saisies depuis le passage seront supprimées." : " La note saisie depuis le passage sera supprimée.") : ""))) return;
    app().undoPass(); hap("heavy");
    return true;
  }

  /* ---------- Bloc dans Réglages ---------- */
  var last = "";
  function refresh() {
    var d = $("#yearpass"), pr = app() && app().profile();
    if (!d || !pr) return;
    var arch = app().archive(), html = '<h3>Année scolaire</h3><p class="muted small">' +
      (pr.year < 3 ? "Quand ton année est terminée, passe à la suivante : tes notes sont classées dans l'historique et les moyennes repartent de zéro." : "Tu es en dernière année : le certificat de maturité s'affiche en haut du tableau de bord.") + '</p><div class="btns">' +
      (pr.year < 3 ? '<button type="button" class="btn-ghost" id="yp-next">Passer en ' + ORD[pr.year + 1] + ' année</button>' : "") +
      (arch.length ? '<button type="button" class="btn-ghost" id="yp-hist">Années précédentes (' + arch.length + ')</button>' : "") + '</div>' +
      (arch.length ? '<button type="button" class="link danger" id="yp-undo" style="padding-left:0;align-self:flex-start">Annuler le dernier passage…</button>' : "");
    if (html !== last) { d.innerHTML = html; last = html; }
  }
  function mount() {
    var anchor = $("#ob-edit"); if (!anchor || $("#yearpass")) return;
    var d = document.createElement("div"); d.className = "backup"; d.id = "yearpass";
    anchor.closest(".backup").after(d);
    d.addEventListener("click", function (e) {
      var id = e.target.id;
      if (id === "yp-next") openPass();
      if (id === "yp-hist") openHistory();
      if (id === "yp-undo") undo();
    });
    refresh();
  }

  window.YearPass = { refresh: refresh, openPass: openPass, openHistory: openHistory };
  mount();
})();
