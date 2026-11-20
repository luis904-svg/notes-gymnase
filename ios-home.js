/* ios-home.js : liste des branches de l'Accueil (téléphone, ≤ 700 px), v50, style C en v51, sans courbe en v52.
   Le moteur dessine toujours ses cartes dans #subjects (index.html, renderSubjects) ; après chaque rendu (événement
   ios:rendered de fx.js), chaque carte devient une ligne :
   - à gauche : nom de la branche, dessous une petite ligne (nombre de notes et périodes ; « Prochain test… » en rouge
     quand la moyenne est sous 3,75 ; « hors promotion » pour une branche qui ne compte pas) ;
   - plus de courbe dans la ligne (retirée en v52 à la demande de l'utilisateur) ; la couleur de la note dit le NIVEAU
     (orange à 4, rouge sous 4), jamais la variation ;
   - à droite : la note de bulletin seule, en noir (v55 : plus de pastille, de couleur ni d'effet de la dernière note).
   La carte garde data-subj, role="button" et ses écouteurs : la toucher ouvre toujours le détail. Tout suit la période
   choisie en haut de l'Accueil. Sur grand écran, rien ne change (les cartes du moteur restent).
   window.IOSSpark.filled (courbe remplie) sert à ios-dash.js (tuile « Moyenne générale »). */
(function () {
  "use strict";
  var box = document.getElementById("subjects");
  if (!box || !window.NotesApp) return;
  var mq = window.matchMedia("all");
  var desk = window.matchMedia("(min-width: 701px)");   // grand écran (session D) : colonnes en plus
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function signed(d) { return (d >= 0 ? "+" : "−") + Math.abs(d).toFixed(2); }

  // Courbe remplie : aire en dégradé sous la ligne, seuil 4 en pointillé, dernier point marqué. tone : ok | warn | crit | none.
  var gid = 0;
  function filled(vals, W, H, tone, cls) {
    var n = vals.length, pad = 4;
    if (!n) return '<span class="' + cls + '" aria-hidden="true"></span>';
    var lo = Math.min(3, Math.min.apply(null, vals) - 0.25), hi = 6;
    function X(i) { return n === 1 ? W - pad : pad + i * (W - 2 * pad) / (n - 1); }
    function Y(v) { return pad + (hi - v) / (hi - lo) * (H - 2 * pad); }
    var pts = vals.map(function (v, i) { return X(i).toFixed(1) + " " + Y(v).toFixed(1); }), line = "M" + pts.join(" L"), id = "ios-sg" + (++gid);
    var area = n > 1 ? '<path class="ios-spk-a" d="' + line + " L" + X(n - 1).toFixed(1) + " " + H + " L" + X(0).toFixed(1) + " " + H + ' Z" fill="url(#' + id + ')"/>' : "";
    return '<svg class="' + cls + ' ios-spk is-' + tone + '" viewBox="0 0 ' + W + " " + H + '" aria-hidden="true">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="ios-spk-s0"/><stop offset="1" class="ios-spk-s1"/></linearGradient></defs>' + area +
      '<line class="ios-spk-thr" x1="0" x2="' + W + '" y1="' + Y(4).toFixed(1) + '" y2="' + Y(4).toFixed(1) + '"/>' +
      (n > 1 ? '<path class="ios-spk-l" d="' + line + '"/>' : "") +
      '<circle class="ios-spk-e" cx="' + X(n - 1).toFixed(1) + '" cy="' + Y(vals[n - 1]).toFixed(1) + '" r="3.5"/></svg>';
  }
  window.IOSSpark = { filled: filled };

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
      var eff = "", effLbl = "pas encore de note";
      if (n === 1) { eff = "1re note"; effLbl = "première note"; }
      if (n > 1) {
        var d = vals[n - 1] - vals[n - 2];
        eff = Math.abs(d) < 0.005 ? "=" : (d > 0 ? "▲ " : "▼ ") + Math.abs(d).toFixed(2);
        effLbl = "dernière note : " + (Math.abs(d) < 0.005 ? "moyenne inchangée" : signed(d) + " sur la moyenne");
      }
      var tone = big ? (big.classList.contains("crit") ? "crit" : big.classList.contains("warn") ? "warn" : big.classList.contains("none") ? "none" : "") : "none";
      var val = big ? big.textContent : "–";
      card.classList.add("ios-srow");
      card.setAttribute("aria-label", name + " : " + (val === "–" ? "pas encore de note" : "bulletin " + val) + ", " + effLbl + ". Voir le détail.");
      // Ligne v55 (demande de l'utilisateur) : nom et petite ligne à gauche, la note de bulletin seule à droite, en noir.
      if (desk.matches) {
        // Grand écran (session D) : même ligne, plus d'informations en colonnes (nombre de notes, S1, S2, moyenne exacte de
        // l'année), chiffres en noir (v56). La note de bulletin de la période choisie reste à droite.
        var raw = lines.filter(function (t) { return /note/.test(t) && !/^moy/.test(t); })[0] || "", m = raw.match(/(\d+) notes?(?: sur (\d+))?/), cnt = m ? m[1] + (m[2] ? " / " + m[2] : "") : "0";
        var sub2 = need ? need.textContent : [per ? per.textContent : "", off ? "hors promotion" : ""].filter(Boolean).join(" · ");
        card.classList.add("ios-srow-wide");
        card.innerHTML = '<span class="ios-srow-l"><b>' + esc(name) + '</b><span class="' + (need ? "ios-srow-need" : "") + '">' + esc(sub2) + '</span></span>' +
          '<span class="ios-srow-c">' + esc(cnt) + '</span><span class="ios-srow-c">' + last(id, "s1") + '</span><span class="ios-srow-c">' + last(id, "s2") + '</span>' +
          '<span class="ios-srow-c">' + last(id, "year") + '</span><span class="ios-srow-v">' + esc(val) + '</span>';
        return;
      }
      card.innerHTML = '<span class="ios-srow-l"><b>' + esc(name) + '</b><span class="' + (need ? "ios-srow-need" : "") + '">' + esc(sub) + '</span></span>' +
        '<span class="ios-srow-v">' + esc(val) + '</span>';
    });
    if (desk.matches && box.querySelector(".ios-srow-wide") && !box.querySelector(".ios-srow-head")) {
      var head = document.createElement("div"); head.className = "ios-srow-head"; head.setAttribute("aria-hidden", "true");
      head.innerHTML = "<span>Branche</span><span>Notes</span><span>S1</span><span>S2</span><span>Année</span><span>Bulletin</span>";
      box.insertBefore(head, box.firstChild);
    }
  }
  // Moyenne exacte (deux décimales) d'une période, pour les colonnes du grand écran.
  function last(id, period) { var pts = window.NotesApp.series ? window.NotesApp.series(id, period) : []; return pts.length ? pts[pts.length - 1].avg.toFixed(2) : "–"; }
  document.addEventListener("ios:rendered", paint);
  // Passage téléphone ↔ grand écran : le moteur redessine ses cartes (événement change, et resize en secours).
  var wasPhone = desk.matches;
  function check() { if (desk.matches !== wasPhone) { wasPhone = desk.matches; if (window.NotesApp.redraw) window.NotesApp.redraw(); } }
  if (desk.addEventListener) desk.addEventListener("change", check);
  window.addEventListener("resize", check);
  paint();
})();
