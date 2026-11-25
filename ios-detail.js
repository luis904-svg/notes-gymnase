/* ios-detail.js : détail d'une matière en PAGE ENTIÈRE sur téléphone (≤ 700 px), à la place de la feuille. Spécification :
   design/SPEC-reglages.md (« Additions »). Sur grand écran, rien ne change : la feuille (#sheet) reste, sans animation.
   Principe : renderDetail (index.html) construit toujours son contenu dans #sheet-box ; sur téléphone, IOSDetail.open() prend
   ce contenu et en fait la page #ios-detail, mise en page de la maquette E « façon Bourse » (v47, à la place de F) :
   moyenne et variation, Année / S1 / S2, grande courbe à points touchables, chiffres clés, notes avec leur effet
   (voir buildPage). Chaque nouveau rendu (note supprimée…) refait
   la page en gardant le défilement. L'affichage de la page est piloté par une classe sur <body> (ios-detail-open) :
   l'Accueil et son en-tête disparaissent, la page apparaît ; aucune bascule de `hidden`, donc aucun conflit avec setView.
   Entrée : push (IOSNav.run), sortie : chevron, balayage du bord gauche, onglet Accueil, ou autre onglet (instantané).
   La barre du bas glisse hors de l'écran pendant la page (IOSTitle.pill → body.ios-pill-sub, ios.css), à la demande de
   l'utilisateur (v46) ; elle revient au retour à l'Accueil. Le défilement de l'Accueil est rétabli au retour. */
(function () {
  "use strict";
  var wrap = document.querySelector(".wrap");
  if (!wrap) return;
  var mq = window.matchMedia("all");
  var desk = window.matchMedia("(min-width: 701px)");   // grand écran (session D) : courbe à la largeur réelle
  var container = document.createElement("div");
  container.id = "ios-detail"; container.className = "ios-detail";
  wrap.appendChild(container);
  var active = false, scrollDash = 0, shown = {};

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function ready() { return mq.matches && window.IOSNav && window.IOSTitle && window.IOSIcons && window.NotesApp; }

  /* Icône d'une ligne du bloc « .brk » selon son libellé. */
  function iconFor(text) {
    if (/^Notes saisies/.test(text)) return ["blue", "doc"];
    if (/^Objectif/.test(text)) return ["orange", "target"];
    if (/^Tests/.test(text)) return ["blue", "check"];
    if (/^TP/.test(text)) return ["green", "flask"];
    return ["gray", "list"];
  }

  var TONE_TEXT = { good: "Au-dessus de 4", warn: "Proche du seuil de 4", crit: "Sous le seuil de 4", none: "Pas encore de note" };
  function toneOf(el) { var k = ["good", "warn", "crit"].filter(function (c) { return el && el.classList.contains(c); })[0]; return k || "none"; }
  function el(tag, cls, html) { var n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }

  /* Page de détail, maquette E « façon Bourse » (v47, design/maquettes-detail/Bourse.dc.html), choisie par l'utilisateur
     à la place de F. Le moteur écrit toujours dans #sheet-box ; on en reprend les morceaux et les données de NotesApp :
     1. en-tête : nom de la branche, périodes et objectif ;
     2. panneau (.ios-epanel, redessiné sur place quand on change de période ou de point) : moyenne exacte de la période,
        variation depuis la première note de la période (en points et en %), boutons Année / S1 / S2, grande courbe de la
        moyenne cumulée (échelle fixe jusqu'à 6, seuil 4 en pointillé) qu'on parcourt en glissant le doigt (v49, voir
        plus bas : barre « date · moyenne » au-dessus de la courbe, comme Bourse) ; chiffres clés ;
     3. le bloc « Prochain test » et le certificat (3e) tels quels ;
     4. les notes (liste du moteur, avec son écouteur), de la plus récente à la plus ancienne : date et coef en petites
        capitales, intitulé, note à droite et pastille de son effet sur la moyenne de l'année (+0.17, −0.30…). Toucher une
        ligne ouvre la feuille d'actions (Modifier, Voir les photos, Supprimer : ios-sheets.js) ; un TA reste dépliable. */
  var MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  var LAB = { year: "Année", s1: "Semestre 1", s2: "Semestre 2" };
  var openRow = null;                       // note dont les actions sont montrées (gardée d'un rendu à l'autre)
  var range = "year", cur = null;   // période choisie (remise à « Année » à l'ouverture d'une branche) et données du panneau
  function fmt2(v) { return v == null ? "–" : v.toFixed(2); }
  function fmtN(v) { return String(Math.round(v * 100) / 100); }
  function roundHalf(x) { return x == null ? null : window.Grid && window.NotesApp && NotesApp.bulletin && NotesApp.profile() && Grid.cantonOf(NotesApp.profile()) !== "vd" ? NotesApp.bulletin(x) : Math.floor(x * 2 + 0.5 + 1e-9) / 2; }   // dixième à Genève
  function fmtDay(iso) { return parseInt(iso.slice(8, 10), 10) + " " + MONTHS[parseInt(iso.slice(5, 7), 10) - 1]; }
  function toneV(v) { return v == null ? "none" : v < 4 ? "crit" : v < 4.5 ? "warn" : "good"; }
  function subjOf(id) { return window.NotesApp.subjectsAll().filter(function (x) { return x.id === id; })[0] || null; }
  function noteName(g) { return g.type === "ta" ? "TA" + (g.label ? " · " + g.label : "") : g.label && g.label !== "Exemple" ? g.label : g.type === "tp" ? "TP" : "Test"; }
  function signed(d) { return (d >= 0 ? "+" : "−") + Math.abs(d).toFixed(2); }

  // Date d'une ligne de la liste (pour son effet sur la moyenne).
  function rowDate(li, recs, coll) {
    var ta = li.querySelector("[data-ta]");
    if (ta) { var t = coll.filter(function (x) { return x.id === "ta:" + ta.dataset.ta; })[0]; return t ? t.date : null; }
    var ed = li.querySelector("[data-edit]"), r = ed && recs.filter(function (x) { return x.id === ed.dataset.edit; })[0];
    return r ? r.date : null;
  }

  /* Courbe (v49), comme dans Bourse : on glisse un doigt le long de la moyenne. Le point glisse en continu sur la ligne
     (position interpolée entre deux notes) avec une ligne verticale ; pendant le geste, une barre remplace les boutons
     Année / S1 / S2 au-dessus de la courbe et donne la date et la moyenne de la note la plus proche (petit retour haptique
     quand elle change). Le grand chiffre en haut ne bouge pas. Doigt levé : la barre disparaît, les boutons reviennent.
     touch-action: pan-y (ios.css) laisse défiler la page à la verticale ; le navigateur annule alors le geste
     (pointercancel). Clavier : flèches gauche / droite de note en note, Échap pour revenir. */
  var CW = 358, CH = 176, CL = 4, CR = 40, CT = 10, CB = 30;   // CH 176 ≈ 153 px à l'écran (piste A du canvas, v60)
  var FULLM = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  function fmtLong(iso) { return parseInt(iso.slice(8, 10), 10) + " " + FULLM[parseInt(iso.slice(5, 7), 10) - 1] + " " + iso.slice(0, 4); }
  /* v60 : la courbe est la vraie moyenne dans le temps. Axe horizontal proportionnel aux dates ; entre deux notes, la valeur
     glisse en continu par une interpolation cubique monotone (Fritsch-Carlson : jamais de dépassement ni de creux inventé
     entre deux moyennes). La courbe dessinée et le point qu'on déplace utilisent la même formule, donc le point reste
     toujours sur la ligne. Plusieurs notes le même jour : on garde la moyenne après la dernière. */
  function dayNum(iso) { var q = iso.split("-"); return Date.UTC(+q[0], +q[1] - 1, +q[2]) / 864e5; }
  function dayIso(d) { return new Date(Math.round(d) * 864e5).toISOString().slice(0, 10); }
  function prep(pts) {
    var cp = [];
    pts.forEach(function (p) {
      var d = dayNum(p.date), o = { d: d, avg: p.avg, date: p.date, m: 0 };
      if (cp.length && cp[cp.length - 1].d === d) cp[cp.length - 1] = o; else cp.push(o);
    });
    var n = cp.length, dk = [], i;
    if (n < 2) return cp;
    for (i = 0; i < n - 1; i++) dk[i] = (cp[i + 1].avg - cp[i].avg) / (cp[i + 1].d - cp[i].d);
    cp[0].m = dk[0]; cp[n - 1].m = dk[n - 2];
    for (i = 1; i < n - 1; i++) cp[i].m = dk[i - 1] * dk[i] <= 0 ? 0 : (dk[i - 1] + dk[i]) / 2;
    for (i = 0; i < n - 1; i++) {
      if (dk[i] === 0) { cp[i].m = 0; cp[i + 1].m = 0; continue; }
      var al = cp[i].m / dk[i], be = cp[i + 1].m / dk[i], r = al * al + be * be;
      if (r > 9) { var t = 3 / Math.sqrt(r); cp[i].m = t * al * dk[i]; cp[i + 1].m = t * be * dk[i]; }
    }
    return cp;
  }
  function valAt(cp, d) {
    var n = cp.length; if (n === 1 || d <= cp[0].d) return cp[0].avg; if (d >= cp[n - 1].d) return cp[n - 1].avg;
    var i = 0; while (i < n - 2 && d > cp[i + 1].d) i++;
    var h = cp[i + 1].d - cp[i].d, t = (d - cp[i].d) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * cp[i].avg + (t3 - 2 * t2 + t) * h * cp[i].m + (3 * t2 - 2 * t3) * cp[i + 1].avg + (t3 - t2) * h * cp[i + 1].m;
  }
  var PX0 = CL + 12, PX1 = CW - CR - 12;
  function chartX(d) { var cp = cur.cp, n = cp.length; return n < 2 ? (CL + CW - CR) / 2 : PX0 + (d - cp[0].d) / (cp[n - 1].d - cp[0].d) * (PX1 - PX0); }
  function dayAt(x) { var cp = cur.cp, n = cp.length; return n < 2 ? cp[0].d : cp[0].d + (x - PX0) / (PX1 - PX0) * (cp[n - 1].d - cp[0].d); }
  function curvePath(Y) {   // courbes de Bézier exactes de l'interpolation cubique (points de contrôle à un tiers)
    var cp = cur.cp, d = "M" + chartX(cp[0].d).toFixed(1) + "," + Y(cp[0].avg).toFixed(1);
    for (var i = 0; i < cp.length - 1; i++) {
      var a = cp[i], b = cp[i + 1], h = (b.d - a.d) / 3;
      d += " C" + chartX(a.d + h).toFixed(1) + "," + Y(a.avg + a.m * h).toFixed(1) + " " + chartX(b.d - h).toFixed(1) + "," + Y(b.avg - b.m * h).toFixed(1) + " " + chartX(b.d).toFixed(1) + "," + Y(b.avg).toFixed(1);
    }
    return d;
  }
  function chartHtml(pts, up) {
    var cp = cur.cp = prep(pts), n = cp.length, last = n - 1;
    var lo = Math.max(1, Math.min(3, Math.floor(Math.min.apply(null, pts.map(function (p) { return p.avg; }))))), hi = 6;
    function Y(v) { return CT + (hi - v) / (hi - lo) * (CH - CT - CB); }
    cur.Y = Y;
    var g = "", v;
    for (v = lo; v <= hi; v++) g += '<line class="' + (v === 4 ? "ios-echart-thr" : "ios-echart-grid") + '" x1="0" x2="' + (CW - CR + 4) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '"/>' +
      '<text class="ios-echart-y" x="' + CW + '" y="' + (Y(v) + 4).toFixed(1) + '" text-anchor="end">' + v + (v === 4 ? " · seuil" : "") + '</text>';
    var path = n > 1 ? curvePath(Y) : "";
    var area = n > 1 ? '<path class="ios-echart-area' + (up ? "" : " is-down") + '" d="' + path + " L" + chartX(cp[last].d).toFixed(1) + "," + (CH - CB) + " L" + chartX(cp[0].d).toFixed(1) + "," + (CH - CB) + ' Z"/>' : "";
    var svg = '<svg class="ios-echart-svg" viewBox="0 0 ' + CW + " " + CH + '" aria-hidden="true">' + g + area +
      (n > 1 ? '<path class="ios-echart-line' + (up ? "" : " is-down") + '" d="' + path + '"/>' : "") +
      '<line class="ios-echart-cross" x1="0" x2="0" y1="0" y2="' + (CH - CB) + '"/>' +
      '<circle class="ios-echart-knob' + (up ? "" : " is-down") + '" r="7" cx="0" cy="0"/>' +
      '<text class="ios-echart-x" x="' + chartX(cp[0].d).toFixed(1) + '" y="' + (CH - 8) + '" text-anchor="' + (n > 1 ? "start" : "middle") + '">' + fmtDay(cp[0].date) + '</text>' +
      (n > 1 ? '<text class="ios-echart-x" x="' + chartX(cp[last].d).toFixed(1) + '" y="' + (CH - 8) + '" text-anchor="end">' + fmtDay(cp[last].date) + '</text>' : "") + '</svg>';
    var dots = cp.map(function (p) {
      return '<i class="ios-echart-dot" style="left:' + (chartX(p.d) / CW * 100).toFixed(2) + '%;top:' + (Y(p.avg) / CH * 100).toFixed(2) + '%"></i>';
    }).join("");
    return '<div class="ios-echart" tabindex="0" role="slider" aria-label="Courbe de la moyenne : glisse le doigt le long de la ligne" aria-valuemin="1" aria-valuemax="6">' + svg + dots + '</div>';
  }

  // Panneau : dessiné une fois par période ; le geste ne change que la barre, la ligne verticale et le point.
  function paintPanel(panel) {
    var A = window.NotesApp, c = cur; if (!panel || !c) return;
    var pts = A.series ? A.series(c.id, range) : [], s1End = A.get().cfg.s1End;
    var all = A.subjNotes ? A.subjNotes(c.id) : [];
    var notes = all.filter(function (g) { return range === "year" || (range === "s1" ? g.date <= s1End : g.date > s1End); });
    var btns = '<div class="ios-erange" role="group" aria-label="Période">' + [["year", "Année"], ["s1", "S1"], ["s2", "S2"]].map(function (r) {
      return '<button type="button" data-erange="' + r[0] + '" aria-pressed="' + (r[0] === range) + '">' + r[1] + '</button>';
    }).join("") + '</div>';
    c.pts = pts; c.notes = notes; c.live = false; c.near = null;
    if (!pts.length) {
      panel.innerHTML = '<div class="ios-evalue"><span class="ios-evalue-n">–</span></div><p class="ios-ecap">' + LAB[range] + ' · pas encore de note</p>' + btns +
        '<p class="ios-eempty">' + (range === "year" ? "La courbe apparaît dès la première note de cette branche." : "Aucune note dans ce semestre.") + '</p>';
      return;
    }
    var n = pts.length, first = pts[0].avg, last = pts[n - 1].avg, d = last - first, up = d >= -1e-9;
    c.up = up;
    var vals = notes.map(function (g) { return g.value; });
    var hiV = vals.length ? Math.max.apply(null, vals) : null, loV = vals.length ? Math.min.apply(null, vals) : null;
    var goal = c.s && c.s.goal ? +c.s.goal : null, yearAvg = A.annualAvg(c.id);
    // Piste A (canvas Claude Design, v60) : grand chiffre = note de bulletin ; une seule carte de chiffres clés :
    // bande de trois (moyenne exacte, plus haute, plus basse), puis des lignes à carré d'icône (objectif et écart,
    // note à obtenir pour passer à 4). Le minimum du certificat (3e) reste le bloc de cert.js sous la carte.
    var I = window.Icons ? window.Icons.inner : {};
    function krow(color, ic, label, val, strong) {
      return '<div class="ios-ekey-r"><i class="ios-ic ios-ic-' + color + '"><svg viewBox="0 0 24 24" aria-hidden="true">' + (I[ic] || "") + '</svg></i>' +
        '<span class="ios-ekey-l">' + label + '</span><span class="ios-ekey-v' + (strong ? " is-strong" : "") + '">' + val + '</span></div>';
    }
    function kcell(k, v) { return '<div class="ios-ekey-c"><span>' + k + '</span><b>' + v + '</b></div>'; }
    var key = '<div class="ios-ekey"><div class="ios-ekey-top">' + kcell("Moyenne exacte", fmt2(last)) + kcell("Plus haute", hiV == null ? "–" : fmtN(hiV)) + kcell("Plus basse", loV == null ? "–" : fmtN(loV)) + '</div>' +
      (goal ? krow("orange", "target", "Objectif " + fmtN(goal), yearAvg == null ? "–" : signed(yearAvg - goal)) : "") +
      (c.need ? krow("green", "up", "Pour passer à 4", c.need.v, true) : "") + '</div>';
    panel.innerHTML =
      '<div class="ios-etop">' + btns + '<div class="ios-escrub" aria-live="polite"><span class="ios-escrub-d"></span><b class="ios-escrub-v"></b></div></div>' +
      '<section class="ios-ehero"><span class="ios-dk">Moyenne · ' + LAB[range] + '</span>' +
      '<div class="ios-evalue"><span class="ios-evalue-n">' + roundHalf(last) + '</span></div>' +
      (n > 1 ? '<p class="ios-ecap">' + (Math.abs(d) < 0.005 ? "stable" : (up ? "▲ " : "▼ ") + Math.abs(d).toFixed(2)) + " depuis le " + fmtLong(pts[0].date) + '</p>' : '<p class="ios-ecap">1re note</p>') +
      '<div class="ios-echart-fit"></div>' + '</section>' + key;
    // Grand écran (session D) : la courbe est dessinée à la largeur réelle de la tuile (texte à sa vraie taille) ; on
    // mesure une fois la tuile en place. Téléphone : 358 × 176, inchangé.
    var fitBox = panel.querySelector(".ios-echart-fit"), wide = desk.matches && fitBox && fitBox.clientWidth > 420;
    CW = wide ? Math.round(fitBox.clientWidth) : 358; CH = wide ? 260 : 176; PX1 = CW - CR - 12;
    fitBox.outerHTML = chartHtml(pts, up);
    rest(panel);
  }

  // Repos : boutons visibles, point sur la dernière note, pas de ligne verticale.
  function rest(panel) {
    var c = cur; if (!panel || !c || !c.pts || !c.pts.length || !c.cp) return;
    c.live = false; c.near = null;
    var L = c.cp[c.cp.length - 1]; placeKnob(panel, chartX(L.d), L.avg);
    var top = panel.querySelector(".ios-etop"), ch = panel.querySelector(".ios-echart");
    if (top) top.classList.remove("is-live");
    if (ch) { ch.classList.remove("is-live"); ch.setAttribute("aria-valuenow", L.avg.toFixed(2)); ch.setAttribute("aria-valuetext", "Aujourd'hui : moyenne " + fmt2(L.avg)); }
  }
  // Le point est un cercle du dessin SVG : il suit l'échelle de la courbe sans mesurer l'écran ni refaire la mise en page.
  function placeKnob(panel, x, avg, live) {
    var k = panel.querySelector(".ios-echart-knob"); if (!k) return;
    k.setAttribute("cx", x.toFixed(2)); k.setAttribute("cy", cur.Y(avg).toFixed(2)); k.setAttribute("r", live ? 8 : 7);
  }
  // Doigt à l'abscisse x (repère du dessin) : point sur la courbe lisse, ligne verticale, date et moyenne au dixième à cet
  // instant. La note la plus proche donne le retour haptique et le repère de la barre.
  function scrubTo(panel, x, fromKey) {
    var c = cur, cp = c.cp, n = cp.length; if (!n) return;
    x = Math.max(chartX(cp[0].d), Math.min(chartX(cp[n - 1].d), x));
    var d = dayAt(x), avg = valAt(cp, d), near = 0, k;
    for (k = 1; k < n; k++) if (Math.abs(cp[k].d - d) < Math.abs(cp[near].d - d)) near = k;
    placeKnob(panel, x, avg, true);
    var cross = panel.querySelector(".ios-echart-cross"); if (cross) { cross.setAttribute("x1", x.toFixed(1)); cross.setAttribute("x2", x.toFixed(1)); }
    if (!c.live) { c.live = true; panel.querySelector(".ios-etop").classList.add("is-live"); panel.querySelector(".ios-echart").classList.add("is-live"); }
    var ch = panel.querySelector(".ios-echart"), iso = dayIso(d);
    panel.querySelector(".ios-escrub-d").textContent = fmtLong(iso);
    panel.querySelector(".ios-escrub-v").textContent = "moy. " + avg.toFixed(1);
    ch.setAttribute("aria-valuenow", avg.toFixed(2)); ch.setAttribute("aria-valuetext", fmtLong(iso) + " : moyenne " + avg.toFixed(1));
    if (near !== c.near) {
      c.near = near;
      if (!fromKey && window.FX) FX.haptic("select");
      [].forEach.call(panel.querySelectorAll(".ios-echart-dot"), function (dot, j) { dot.classList.toggle("is-near", j === near); });
    }
  }

  function viewX(chartEl, clientX) { var r = chartEl.getBoundingClientRect(); return (clientX - r.left) / r.width * CW; }
  var scrub = null, raf = 0;
  // Un seul dessin par image (requestAnimationFrame) : le glissement reste fluide même avec des évènements très rapprochés.
  function flush() { raf = 0; if (scrub && scrub.x != null) scrubTo(scrub.panel, scrub.x); }
  container.addEventListener("pointerdown", function (e) {
    var ch = e.target.closest(".ios-echart"); if (!ch || !cur || !cur.pts || !cur.pts.length) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    scrub = { id: e.pointerId, ch: ch, panel: ch.closest(".ios-epanel"), x: null };
    try { ch.setPointerCapture(e.pointerId); } catch (x) {}
    scrubTo(scrub.panel, viewX(ch, e.clientX));
  });
  container.addEventListener("pointermove", function (e) {
    if (!scrub || e.pointerId !== scrub.id) return;
    scrub.x = viewX(scrub.ch, e.clientX);
    if (!raf) raf = requestAnimationFrame(flush);
  });
  function endScrub(e) {
    if (!scrub || e.pointerId !== scrub.id) return;
    var s = scrub; scrub = null; if (raf) { cancelAnimationFrame(raf); raf = 0; } rest(s.panel);
  }
  container.addEventListener("pointerup", endScrub);
  container.addEventListener("pointercancel", endScrub);
  container.addEventListener("keydown", function (e) {
    var ch = e.target.closest && e.target.closest(".ios-echart"); if (!ch || !cur || !cur.pts || !cur.pts.length) return;
    var panel = ch.closest(".ios-epanel"), n = cur.cp.length;
    // Échap : d'abord retour au repos ; au repos, il ferme la page comme ailleurs (index.html).
    if (e.key === "Escape") { if (cur.live) { e.preventDefault(); e.stopPropagation(); rest(panel); } return; }
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    var k = cur.live && cur.near != null ? cur.near : n - 1;
    k = Math.max(0, Math.min(n - 1, k + (e.key === "ArrowRight" ? 1 : -1)));
    scrubTo(panel, chartX(cur.cp[k].d), true);
  });
  container.addEventListener("focusout", function (e) {
    if (e.target.classList && e.target.classList.contains("ios-echart") && cur && cur.live && !scrub) rest(e.target.closest(".ios-epanel"));
  });

  function buildPage() {
    var box = document.getElementById("sheet-box");
    if (!box || !box.firstChild) return null;
    var A = window.NotesApp, id = A.detailId && A.detailId(), s = id ? subjOf(id) : null;
    var h2 = box.querySelector("#sheet-title"), sp = box.querySelector(".sheet-head p"), name = h2 ? h2.textContent : "";
    var page = el("div", "ios-page ios-dpage ios-epage");

    // 1. En-tête.
    var h1 = el("h1", "ios-large"); h1.textContent = name; page.appendChild(h1);
    var subTxt = (sp ? sp.textContent : "") + (s && s.goal ? " · objectif " + s.goal : "");
    if (subTxt) { var sub = el("p", "ios-sub"); sub.textContent = subTxt; page.appendChild(sub); }

    var tiles = [].slice.call(box.querySelectorAll(".tiles .tile")), notesUl = box.querySelector("#sheet-notes"), need = box.querySelector(".need"), cert = box.querySelector(".cert-min");
    var brk = box.querySelector(".brk"), rowsOf = brk ? [].slice.call(brk.children) : [];
    var chart = box.querySelector("#sheet-chart"); if (chart) chart.remove();

    // 2. Panneau « Bourse ».
    var needV = null;   // « Prochain test : au moins 4.35 pour atteindre 4. » -> « ≥ 4.35 » ; sinon le texte du moteur raccourci
    if (need) { var nm = need.textContent.match(/au moins\s+([0-9.,]+)/); needV = nm ? "≥ " + nm[1].replace(/[.,]$/, "") : "plus atteignable"; }
    if (tiles.length) {
      cur = {
        id: id, s: s, need: needV ? { v: needV } : null,
        sem: tiles.slice(1).map(function (t) { var nn = t.querySelector(".num"), lb = t.querySelector(".lbl"); return { k: lb ? lb.textContent : "", v: nn ? nn.textContent : "–", tone: toneOf(nn) }; }),
        extra: rowsOf.map(function (r) {
          var sps = r.querySelectorAll(":scope > span"), a = sps[0];
          if (sps.length < 2 || !a || /^(Notes saisies|Objectif)/.test(a.textContent)) return null;
          return { k: a.textContent.replace(/\s+/g, " ").trim(), v: sps[1].textContent };
        }).filter(Boolean)
      };
      var panel = el("div", "ios-epanel"); page.appendChild(panel); paintPanel(panel);
    } else cur = null;

    // 3. Prochain test, certificat (3e).
    if (cert) { var cg = el("div", "ios-grp ios-cert"); cg.appendChild(cert); page.appendChild(cg); }

    // 4. Notes.
    if (tiles.length) {
      var hd = el("div", "ios-enotes-h", '<span>Notes</span><small>les plus récentes d\'abord</small>'); page.appendChild(hd);   // titre de section (style C)
      if (notesUl) {
        var recs = A.records(), coll = A.collapse(recs), yearPts = A.series ? A.series(id, "year") : [], byDate = {};
        yearPts.forEach(function (pt, i) { byDate[pt.date] = { avg: pt.avg, prev: i ? yearPts[i - 1].avg : null }; });
        [].slice.call(notesUl.children).forEach(function (li) {
          var w = li.querySelector(":scope > .what");
          if (w) {   // dans la page d'une matière, le nom de la matière est inutile sur chaque ligne
            var t = w.textContent, meta = li.querySelector(":scope > .meta");
            if (t === name) w.textContent = meta && /· TP/.test(meta.textContent) ? "TP" : "Test";
            else if (t.indexOf(name + " · ") === 0) w.textContent = t.slice(name.length + 3);
          }
          var dt = rowDate(li, recs, coll), ef = dt && byDate[dt], txt = "début", cls = "is-flat";
          if (ef && ef.prev != null) { var dd = ef.avg - ef.prev; txt = Math.abs(dd) < 0.005 ? "=" : signed(dd); cls = Math.abs(dd) < 0.005 ? "is-flat" : dd > 0 ? "is-up" : "is-down"; }
          if (li.classList.contains("ios-ta-li")) return;
          var v = li.querySelector(":scope > .v"); if (!v) return;
          li.classList.add("ios-nrow", "ios-erow");
          var badge = document.createElement("span"); badge.className = "ios-eff " + cls; badge.textContent = txt;
          badge.setAttribute("aria-label", txt === "début" ? "première note" : "effet sur la moyenne : " + txt);
          li.insertBefore(badge, li.querySelector(":scope > .acts"));
          var ed = li.querySelector("[data-edit]"); if (ed) li.dataset.nid = ed.dataset.edit;
          if (li.dataset.photos) {   // les photos s'ouvrent par un bouton des actions : le toucher de la ligne montre les actions
            var acts = li.querySelector(":scope > .acts"), pb = document.createElement("button");
            pb.type = "button"; pb.className = "link"; pb.setAttribute("data-ph-open", li.dataset.photos); pb.textContent = "Photos";
            if (acts) acts.insertBefore(pb, acts.firstChild);
            li.removeAttribute("data-photos");
          }
          if (li.dataset.nid && li.dataset.nid === openRow) li.classList.add("ios-open");
        });
        var wrapN = el("div", "ios-enotes"); wrapN.appendChild(notesUl); page.appendChild(wrapN);
      } else {
        page.appendChild(el("div", "ios-grp ios-empty", window.Icons.svg("doc", "ios-empty-ic") + '<b>Aucune note pour l\'instant</b><span>Ajoute ta première note dans cette branche : la moyenne et la courbe apparaîtront ici.</span>' +
          '<button type="button" class="btn" data-dadd="1">Ajouter une note</button>'));
      }
    }
    return page;
  }
  // Période (Année, S1, S2) : le panneau est redessiné sur place, sans nouveau rendu du moteur.
  container.addEventListener("click", function (e) {
    var rb = e.target.closest("[data-erange]");
    if (!rb || rb.dataset.erange === range) return;
    range = rb.dataset.erange;
    if (window.FX) FX.haptic("select");
    paintPanel(container.querySelector(".ios-epanel"));
  });
  // Toucher une note ouvre la feuille d'actions (Modifier, Voir les photos, Supprimer) : ios-sheets.js (session B).
  container.addEventListener("click", function (e) {
    var ph = e.target.closest("[data-ph-open]");
    if (ph) { if (window.Photos && Photos.open) Photos.open(ph.dataset.phOpen); return; }
  });

  // « + » de la barre de titre et état vide : « Ajouter une note » ouvre le formulaire sur cette matière.
  // Le « + » vit dans la barre fixe (.ios-bar, hors de .wrap), à droite, comme dans la maquette F ; ios.css ne le montre
  // que pendant la page de détail.
  var addBtn = document.createElement("button");
  addBtn.type = "button"; addBtn.className = "ios-fadd"; addBtn.setAttribute("aria-label", "Ajouter une note dans cette branche");
  addBtn.innerHTML = window.Icons.svg("add");
  var barEl = document.querySelector(".ios-bar"); if (barEl) barEl.appendChild(addBtn);
  addBtn.addEventListener("click", function () { if (active) addHere(); });
  container.addEventListener("click", function (e) {
    if (!e.target.closest("[data-dadd]")) return;
    addHere();
  });
  function addHere() {
    var id = window.NotesApp.detailId && window.NotesApp.detailId();
    window.NotesApp.goAdd();
    var sel = document.getElementById("f-subj");
    if (id && sel) {
      var s = window.NotesApp.subjectsAll().filter(function (x) { return x.id === id; })[0], leaf = s && s.parts ? s.parts[0] : id;
      if ([].some.call(sel.options, function (o) { return o.value === leaf; })) { sel.value = leaf; sel.dispatchEvent(new Event("change", { bubbles: true })); }
    }
  }
  function ctxFor(page) {
    var h1 = page.querySelector(".ios-large");
    return { key: "detail:" + (h1 ? h1.textContent : ""), title: h1 ? h1.textContent : "", large: h1, back: back };
  }

  /* ---------- Entrée et sortie ---------- */
  function open() {
    if (!ready()) return false;
    var page = buildPage(); if (!page) return false;
    if (active) {                                   // nouveau rendu pendant que la page est ouverte : on garde le défilement
      var y = window.scrollY; container.replaceChildren(page); if (desk.matches) refit(); window.scrollTo(0, y); IOSTitle.set(ctxFor(page)); return true;
    }
    scrollDash = window.scrollY; openRow = null; range = "year";
    // Affichage de l'Accueil avant l'ouverture : la copie du balayage de retour le reprend tel quel.
    shown = {};
    ["#view-dash", "header.top", "#demo"].forEach(function (q) { var n = document.querySelector(q); if (n) shown[q] = getComputedStyle(n).display; });
    IOSNav.run("push", function () {
      active = true; document.body.classList.add("ios-detail-open");
      container.replaceChildren(page); window.scrollTo(0, 0);
      IOSTitle.set(ctxFor(page)); IOSTitle.pill("detail", true); IOSNav.setBack(provider);
    });
    if (desk.matches) refit();
    return true;
  }
  function close() {
    if (!active) return false;
    active = false; document.body.classList.remove("ios-detail-open");
    container.replaceChildren(); window.scrollTo(0, scrollDash);
    IOSTitle.pill("detail", false); IOSNav.setBack(null);
    var cur = document.querySelector('.tabbar [aria-current="page"]');
    if (!cur || cur.dataset.tab === "dash") document.dispatchEvent(new CustomEvent("ios:view", { detail: "dash" }));
    return true;
  }
  // Grand écran : la page est dessinée avant d'être dans le document (largeur inconnue) ; on redessine le panneau une fois
  // en place, et quand la fenêtre change de taille.
  function refit() { var p = container.querySelector(".ios-epanel"); if (active && p) paintPanel(p); }
  var rzf = 0;
  window.addEventListener("resize", function () { if (!active) return; cancelAnimationFrame(rzf); rzf = requestAnimationFrame(refit); });
  function back() {
    if (!active) return;
    IOSNav.run("pop", function () { window.NotesApp.closeDetail(); });
  }

  var provider = {
    can: function () { return active && mq.matches; },
    parent: function (clone) {                      // la copie montre l'Accueil à la place de la page
      Object.keys(shown).forEach(function (q) { var n = clone.querySelector(q); if (n) n.style.display = shown[q]; });
      var det = clone.querySelector("#ios-detail"); if (det) det.style.display = "none";
    },
    parentScroll: function () { return scrollDash; },
    parentBar: function () {
      var h1 = document.querySelector("header.top h1");
      return { title: h1 ? h1.textContent : "", on: scrollDash >= IOSTitle.threshold("dash", 48), back: false };
    },
    go: back
  };

  mq.addEventListener && mq.addEventListener("change", function () { if (!mq.matches && active) window.NotesApp.closeDetail(); });
  window.IOSDetail = { open: open, close: close, back: back, active: function () { return active; } };
})();
