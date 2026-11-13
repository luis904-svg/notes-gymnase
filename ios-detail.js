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
  var mq = window.matchMedia("(max-width: 700px)");
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
        ligne montre ses actions (Modifier, Supprimer, Photos) ; un TA reste dépliable. */
  var MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  var LAB = { year: "Année", s1: "Semestre 1", s2: "Semestre 2" };
  var openRow = null;                       // note dont les actions sont montrées (gardée d'un rendu à l'autre)
  var range = "year", cur = null;   // période choisie (remise à « Année » à l'ouverture d'une branche) et données du panneau
  function fmt2(v) { return v == null ? "–" : v.toFixed(2); }
  function fmtN(v) { return String(Math.round(v * 100) / 100); }
  function roundHalf(x) { return x == null ? null : Math.floor(x * 2 + 0.5 + 1e-9) / 2; }
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
  var CW = 358, CH = 220, CL = 4, CR = 40, CT = 10, CB = 30;
  var FULLM = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  function fmtLong(iso) { return parseInt(iso.slice(8, 10), 10) + " " + FULLM[parseInt(iso.slice(5, 7), 10) - 1] + " " + iso.slice(0, 4); }
  function chartX(i, n) { return n === 1 ? (CL + CW - CR) / 2 : CL + 12 + i * (CW - CL - CR - 24) / (n - 1); }
  function chartHtml(pts, up) {
    var n = pts.length, last = n - 1;
    var lo = Math.max(1, Math.min(3, Math.floor(Math.min.apply(null, pts.map(function (p) { return p.avg; }))))), hi = 6;
    function Y(v) { return CT + (hi - v) / (hi - lo) * (CH - CT - CB); }
    cur.Y = Y;
    var g = "", v;
    for (v = lo; v <= hi; v++) g += '<line class="' + (v === 4 ? "ios-echart-thr" : "ios-echart-grid") + '" x1="0" x2="' + (CW - CR + 4) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '"/>' +
      '<text class="ios-echart-y" x="' + CW + '" y="' + (Y(v) + 4).toFixed(1) + '" text-anchor="end">' + v + (v === 4 ? " · seuil" : "") + '</text>';
    var line = pts.map(function (p, i) { return chartX(i, n).toFixed(1) + "," + Y(p.avg).toFixed(1); }).join(" ");
    var area = n > 1 ? '<polygon class="ios-echart-area' + (up ? "" : " is-down") + '" points="' + line + " " + chartX(last, n).toFixed(1) + "," + (CH - CB) + " " + chartX(0, n).toFixed(1) + "," + (CH - CB) + '"/>' : "";
    var svg = '<svg class="ios-echart-svg" viewBox="0 0 ' + CW + " " + CH + '" aria-hidden="true">' + g + area +
      (n > 1 ? '<polyline class="ios-echart-line' + (up ? "" : " is-down") + '" points="' + line + '"/>' : "") +
      '<line class="ios-echart-cross" x1="0" x2="0" y1="0" y2="' + (CH - CB) + '"/>' +
      '<text class="ios-echart-x" x="' + chartX(0, n).toFixed(1) + '" y="' + (CH - 8) + '" text-anchor="' + (n > 1 ? "start" : "middle") + '">' + fmtDay(pts[0].date) + '</text>' +
      (n > 1 ? '<text class="ios-echart-x" x="' + chartX(last, n).toFixed(1) + '" y="' + (CH - 8) + '" text-anchor="end">' + fmtDay(pts[last].date) + '</text>' : "") + '</svg>';
    var dots = pts.map(function (p, i) {
      return '<i class="ios-echart-dot" style="left:' + (chartX(i, n) / CW * 100).toFixed(2) + '%;top:' + (Y(p.avg) / CH * 100).toFixed(2) + '%"></i>';
    }).join("");
    return '<div class="ios-echart" tabindex="0" role="slider" aria-label="Courbe de la moyenne : glisse le doigt le long de la ligne" aria-valuemin="1" aria-valuemax="6">' + svg + dots +
      '<i class="ios-echart-knob' + (up ? "" : " is-down") + '"></i></div>';
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
    var stats = [
      ["Bulletin", String(roundHalf(last)), toneV(roundHalf(last))],
      ["Notes", String(notes.length), ""],
      ["Plus haute", hiV == null ? "–" : fmtN(hiV), ""],
      ["Plus basse", loV == null ? "–" : fmtN(loV), loV != null && loV < 4 ? "crit" : ""]
    ];
    c.sem.forEach(function (t) { stats.push([t.k, t.v, ""]); });
    if (goal) { stats.push(["Objectif", fmtN(goal), ""]); stats.push(["Écart", yearAvg == null ? "–" : signed(yearAvg - goal), yearAvg == null ? "" : yearAvg >= goal ? "good" : "crit"]); }
    c.extra.forEach(function (x) { stats.push([x.k, x.v, ""]); });
    panel.innerHTML =
      '<div class="ios-evalue"><span class="ios-evalue-n">' + fmt2(last) + '</span>' +
      (n > 1 ? '<span class="ios-evalue-d ' + (up ? "is-up" : "is-down") + '">' + signed(d) + " (" + (d >= 0 ? "+" : "−") + Math.abs(first ? d / first * 100 : 0).toFixed(1) + ' %)</span>' : "") + '</div>' +
      '<p class="ios-ecap">' + LAB[range] + ' · moyenne exacte, bulletin ' + roundHalf(last) + '</p>' +
      '<div class="ios-etop">' + btns + '<div class="ios-escrub" aria-live="polite"><span class="ios-escrub-d"></span><b class="ios-escrub-v"></b></div></div>' +
      chartHtml(pts, up) +
      '<div class="ios-estats">' + stats.map(function (st) { return '<div class="ios-estat"><span>' + st[0] + '</span><b' + (st[2] ? ' class="ios-tone-' + st[2] + '"' : "") + '>' + st[1] + '</b></div>'; }).join("") + '</div>';
    rest(panel);
  }

  // Repos : boutons visibles, point sur la dernière note, pas de ligne verticale.
  function rest(panel) {
    var c = cur; if (!panel || !c || !c.pts || !c.pts.length) return;
    c.live = false; c.near = null;
    var n = c.pts.length; placeKnob(panel, chartX(n - 1, n), c.pts[n - 1].avg);
    var top = panel.querySelector(".ios-etop"), ch = panel.querySelector(".ios-echart");
    if (top) top.classList.remove("is-live");
    if (ch) { ch.classList.remove("is-live"); ch.setAttribute("aria-valuenow", c.pts[n - 1].avg.toFixed(2)); ch.setAttribute("aria-valuetext", "Aujourd'hui : moyenne " + fmt2(c.pts[n - 1].avg)); }
  }
  function placeKnob(panel, x, avg) {
    var k = panel.querySelector(".ios-echart-knob"); if (!k) return;
    k.style.left = (x / CW * 100).toFixed(2) + "%"; k.style.top = (cur.Y(avg) / CH * 100).toFixed(2) + "%";
  }
  // Doigt à l'abscisse x (repère du dessin) : point interpolé sur la ligne, barre = note la plus proche.
  function scrubTo(panel, x, fromKey) {
    var c = cur, pts = c.pts, n = pts.length; if (!n) return;
    var x0 = chartX(0, n), x1 = chartX(n - 1, n);
    x = Math.max(x0, Math.min(x1, x));
    var i = 0, t = 0;
    if (n > 1) { var step = (x1 - x0) / (n - 1); i = Math.min(n - 2, Math.floor((x - x0) / step)); t = (x - chartX(i, n)) / step; }
    var avg = n > 1 ? pts[i].avg + (pts[i + 1].avg - pts[i].avg) * t : pts[0].avg, near = n > 1 ? (t < 0.5 ? i : i + 1) : 0;
    placeKnob(panel, x, avg);
    var cross = panel.querySelector(".ios-echart-cross"); if (cross) { cross.setAttribute("x1", x.toFixed(1)); cross.setAttribute("x2", x.toFixed(1)); }
    if (!c.live) { c.live = true; panel.querySelector(".ios-etop").classList.add("is-live"); panel.querySelector(".ios-echart").classList.add("is-live"); }
    if (near !== c.near) {
      c.near = near;
      if (!fromKey && window.FX) FX.haptic("select");
      var p = pts[near];
      panel.querySelector(".ios-escrub-d").textContent = fmtLong(p.date);
      panel.querySelector(".ios-escrub-v").textContent = "moy. " + fmt2(p.avg);
      var ch = panel.querySelector(".ios-echart"); ch.setAttribute("aria-valuenow", p.avg.toFixed(2)); ch.setAttribute("aria-valuetext", fmtLong(p.date) + " : moyenne " + fmt2(p.avg));
      [].forEach.call(panel.querySelectorAll(".ios-echart-dot"), function (dot, k) { dot.classList.toggle("is-near", k === near); });
    }
  }

  function viewX(chartEl, clientX) { var r = chartEl.getBoundingClientRect(); return (clientX - r.left) / r.width * CW; }
  var scrub = null;
  container.addEventListener("pointerdown", function (e) {
    var ch = e.target.closest(".ios-echart"); if (!ch || !cur || !cur.pts || !cur.pts.length) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    scrub = { id: e.pointerId, ch: ch, panel: ch.closest(".ios-epanel") };
    try { ch.setPointerCapture(e.pointerId); } catch (x) {}
    scrubTo(scrub.panel, viewX(ch, e.clientX));
  });
  container.addEventListener("pointermove", function (e) {
    if (!scrub || e.pointerId !== scrub.id) return;
    scrubTo(scrub.panel, viewX(scrub.ch, e.clientX));
  });
  function endScrub(e) {
    if (!scrub || e.pointerId !== scrub.id) return;
    var s = scrub; scrub = null; rest(s.panel);
  }
  container.addEventListener("pointerup", endScrub);
  container.addEventListener("pointercancel", endScrub);
  container.addEventListener("keydown", function (e) {
    var ch = e.target.closest && e.target.closest(".ios-echart"); if (!ch || !cur || !cur.pts || !cur.pts.length) return;
    var panel = ch.closest(".ios-epanel"), n = cur.pts.length;
    // Échap : d'abord retour au repos ; au repos, il ferme la page comme ailleurs (index.html).
    if (e.key === "Escape") { if (cur.live) { e.preventDefault(); e.stopPropagation(); rest(panel); } return; }
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    var k = cur.live && cur.near != null ? cur.near : n - 1;
    k = Math.max(0, Math.min(n - 1, k + (e.key === "ArrowRight" ? 1 : -1)));
    scrubTo(panel, chartX(k, n), true);
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
    if (tiles.length) {
      cur = {
        id: id, s: s,
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
    if (need) { need.className = "ios-grp ios-need"; page.appendChild(need); }
    if (cert) { var cg = el("div", "ios-grp ios-cert"); cg.appendChild(cert); page.appendChild(cg); }

    // 4. Notes.
    if (tiles.length) {
      var hd = el("div", "ios-enotes-h", '<span>Notes</span><small>les plus récentes d\'abord</small>'); page.appendChild(hd);
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
  // Toucher une note montre ses actions (Modifier, Supprimer, Photos) ; un seul bloc ouvert à la fois.
  container.addEventListener("click", function (e) {
    var ph = e.target.closest("[data-ph-open]");
    if (ph) { if (window.Photos && Photos.open) Photos.open(ph.dataset.phOpen); return; }
    if (e.target.closest("button, a, input, select, summary, details")) return;
    var li = e.target.closest("li.ios-nrow"); if (!li) return;
    var on = !li.classList.contains("ios-open");
    [].forEach.call(container.querySelectorAll("li.ios-nrow.ios-open"), function (x) { x.classList.remove("ios-open"); });
    li.classList.toggle("ios-open", on); openRow = on ? li.dataset.nid || null : null;
    if (window.FX) FX.haptic("select");
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
      var y = window.scrollY; container.replaceChildren(page); window.scrollTo(0, y); IOSTitle.set(ctxFor(page)); return true;
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
