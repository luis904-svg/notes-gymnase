/* ios-home.js : liste des branches de l'Accueil façon Bourse (téléphone, ≤ 700 px), v50.
   Le moteur dessine toujours ses cartes dans #subjects (index.html, renderSubjects) ; après chaque rendu (événement
   ios:rendered de fx.js), chaque carte devient une ligne, comme une action dans la liste de Bourse :
   - à gauche : nom de la branche en gras, dessous une petite ligne (nombre de notes et périodes ; « Prochain test… » en
     rouge quand la moyenne est sous 3,75 ; « ne compte pas » pour une branche hors promotion) ;
   - au milieu : mini-courbe de la moyenne, verte si elle monte sur la période, rouge si elle baisse ;
   - à droite : la moyenne arrondie (note de bulletin) et, dessous, une pastille avec l'effet de la dernière note
     (+0.17 vert, −0.30 rouge, gris si rien n'a changé ou s'il n'y a qu'une note ; pas de pastille sans note).
   Lignes séparées par un filet, dans l'ordre habituel. La carte garde data-subj, role="button" et ses écouteurs : la
   toucher ouvre toujours le détail. Tout suit la période choisie en haut de l'Accueil (Année, Semestre 1, Semestre 2).
   Sur grand écran, rien ne change (les cartes du moteur restent). */
(function () {
  "use strict";
  var box = document.getElementById("subjects");
  if (!box || !window.NotesApp) return;
  var mq = window.matchMedia("(max-width: 700px)");
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function signed(d) { return (d >= 0 ? "+" : "−") + Math.abs(d).toFixed(2); }

  function spark(vals, up) {
    var W = 64, H = 28, n = vals.length;
    if (!n) return '<span class="ios-srow-spark" aria-hidden="true"></span>';
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    if (hi - lo < 0.5) { var m = (hi + lo) / 2; lo = m - 0.25; hi = m + 0.25; }
    function X(i) { return n === 1 ? W / 2 : 2 + i * (W - 4) / (n - 1); }
    function Y(v) { return 3 + (hi - v) / (hi - lo) * (H - 6); }
    var cls = up == null ? "is-flat" : up ? "is-up" : "is-down";
    var body = n === 1 ? '<circle cx="' + X(0) + '" cy="' + Y(vals[0]).toFixed(1) + '" r="2.5"/>' :
      '<polyline points="' + vals.map(function (v, i) { return X(i).toFixed(1) + "," + Y(v).toFixed(1); }).join(" ") + '"/>';
    return '<svg class="ios-srow-spark ' + cls + '" viewBox="0 0 ' + W + " " + H + '" aria-hidden="true">' + body + '</svg>';
  }

  function paint() {
    if (!mq.matches) return;
    var A = window.NotesApp, period = A.period ? A.period() : "year";
    [].forEach.call(box.querySelectorAll(".card[data-subj]"), function (card) {
      if (card.classList.contains("ios-srow")) return;
      var id = card.dataset.subj, h3 = card.querySelector("h3"), per = card.querySelector(".per"), big = card.querySelector(".big");
      var name = h3 ? h3.textContent : id, need = card.querySelector(".need");
      var lines = [].map.call(card.querySelectorAll(".lines > span"), function (s) { return s.textContent; });
      var count = lines.filter(function (t) { return /note/.test(t) && !/^moy/.test(t); })[0] || "";
      count = count.replace(/ sur \d+ min\./, "").replace(/^0 note$/, "aucune note");
      var off = lines.some(function (t) { return /ne compte pas/.test(t); });
      var sub = need ? need.textContent : [count, per ? per.textContent : "", off ? "hors promotion" : ""].filter(Boolean).join(" · ");
      var pts = A.series ? A.series(id, period) : [], vals = pts.map(function (p) { return p.avg; }), n = vals.length;
      var up = n > 1 ? vals[n - 1] - vals[0] >= -1e-9 : null;
      var eff = "–", effCls = "is-flat", effLbl = "pas encore de note";
      if (n === 1) { eff = "1re note"; effLbl = "première note"; }
      if (n > 1) {
        var d = vals[n - 1] - vals[n - 2];
        eff = Math.abs(d) < 0.005 ? "=" : signed(d); effCls = Math.abs(d) < 0.005 ? "is-flat" : d > 0 ? "is-up" : "is-down";
        effLbl = "dernière note : " + (Math.abs(d) < 0.005 ? "moyenne inchangée" : eff + " sur la moyenne");
      }
      var tone = big ? (big.classList.contains("crit") ? "crit" : big.classList.contains("none") ? "none" : "") : "none";
      var val = big ? big.textContent : "–";
      card.classList.add("ios-srow");
      card.setAttribute("aria-label", name + " : " + (val === "–" ? "pas encore de note" : "bulletin " + val) + ", " + effLbl + ". Voir le détail.");
      card.innerHTML = '<span class="ios-srow-l"><b>' + esc(name) + '</b><span class="' + (need ? "ios-srow-need" : "") + '">' + esc(sub) + '</span></span>' +
        spark(vals, up) +
        '<span class="ios-srow-r"><span class="ios-srow-v' + (tone ? " ios-srow-" + tone : "") + '">' + esc(val) + '</span>' +
        (n ? '<span class="ios-srow-p ' + effCls + '">' + eff + '</span>' : "") + '</span>';
    });
  }
  document.addEventListener("ios:rendered", paint);
  // Passage téléphone ↔ grand écran : le moteur redessine ses cartes (événement change, et resize en secours).
  var wasPhone = mq.matches;
  function check() { if (mq.matches !== wasPhone) { wasPhone = mq.matches; if (window.NotesApp.redraw) window.NotesApp.redraw(); } }
  if (mq.addEventListener) mq.addEventListener("change", check);
  window.addEventListener("resize", check);
  paint();
})();
