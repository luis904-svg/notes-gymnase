/* ios-detail.js : détail d'une matière en PAGE ENTIÈRE sur téléphone (≤ 700 px), à la place de la feuille. Spécification :
   design/SPEC-reglages.md (« Additions »). Sur grand écran, rien ne change : la feuille (#sheet) reste, sans animation.
   Principe : renderDetail (index.html) construit toujours son contenu dans #sheet-box ; sur téléphone, IOSDetail.open() prend
   ce contenu et en fait la page #ios-detail, mise en page de la maquette E « façon Bourse » (v47, à la place de F) :
   moyenne et variation, S1 / S2 / Année, grande courbe à points touchables, chiffres clés, notes avec leur effet
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
        variation depuis la première note de la période (en points et en %), boutons S1 / S2 / Année, grande courbe de la
        moyenne cumulée (échelle fixe jusqu'à 6, seuil 4 en pointillé) dont chaque point se touche ; la carte sous la
        courbe décrit le point choisi (note, intitulé, date, moyenne avant → après) ; tableau des chiffres clés ;
     3. le bloc « Prochain test » et le certificat (3e) tels quels ;
     4. les notes (liste du moteur, avec son écouteur), de la plus récente à la plus ancienne : date et coef en petites
        capitales, intitulé, note à droite et pastille de son effet sur la moyenne de l'année (+0.17, −0.30…). Toucher une
        ligne montre ses actions (Modifier, Supprimer, Photos) ; un TA reste dépliable. */
  var MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  var LAB = { year: "Année", s1: "Semestre 1", s2: "Semestre 2" };
  var openRow = null;                       // note dont les actions sont montrées (gardée d'un rendu à l'autre)
  var range = "year", sel = null, cur = null;   // période et point choisis (remis à zéro à l'ouverture d'une branche)
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

  function chartHtml(pts, selI, up) {
    var W = 358, H = 220, L = 4, R = 40, T = 10, B = 30, n = pts.length;
    var lo = Math.max(1, Math.min(3, Math.floor(Math.min.apply(null, pts.map(function (p) { return p.avg; }))))), hi = 6;
    function X(i) { return n === 1 ? (L + W - R) / 2 : L + 12 + i * (W - L - R - 24) / (n - 1); }
    function Y(v) { return T + (hi - v) / (hi - lo) * (H - T - B); }
    var g = "", v;
    for (v = lo; v <= hi; v++) g += '<line class="' + (v === 4 ? "ios-echart-thr" : "ios-echart-grid") + '" x1="0" x2="' + (W - R + 4) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '"/>' +
      '<text class="ios-echart-y" x="' + W + '" y="' + (Y(v) + 4).toFixed(1) + '" text-anchor="end">' + v + (v === 4 ? " · seuil" : "") + '</text>';
    var line = pts.map(function (p, i) { return X(i).toFixed(1) + "," + Y(p.avg).toFixed(1); }).join(" ");
    var area = n > 1 ? '<polygon class="ios-echart-area' + (up ? "" : " is-down") + '" points="' + line + " " + X(n - 1).toFixed(1) + "," + (H - B) + " " + X(0).toFixed(1) + "," + (H - B) + '"/>' : "";
    var svg = '<svg class="ios-echart-svg" viewBox="0 0 ' + W + " " + H + '" aria-hidden="true">' + g + area +
      (n > 1 ? '<polyline class="ios-echart-line' + (up ? "" : " is-down") + '" points="' + line + '"/>' : "") +
      '<line class="ios-echart-cross" x1="' + X(selI).toFixed(1) + '" x2="' + X(selI).toFixed(1) + '" y1="0" y2="' + (H - B) + '"/>' +
      '<text class="ios-echart-x" x="' + X(0).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="' + (n > 1 ? "start" : "middle") + '">' + fmtDay(pts[0].date) + '</text>' +
      (n > 1 ? '<text class="ios-echart-x" x="' + X(n - 1).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="end">' + fmtDay(pts[n - 1].date) + '</text>' : "") + '</svg>';
    var dots = pts.map(function (p, i) {
      return '<button type="button" class="ios-echart-dot' + (i === selI ? " is-sel" + (up ? "" : " is-down") : "") + '" data-esel="' + i + '" style="left:' + (X(i) / W * 100).toFixed(2) + '%;top:' + (Y(p.avg) / H * 100).toFixed(2) + '%" aria-label="' +
        fmtDay(p.date) + " : moyenne " + fmt2(p.avg) + '"><i></i></button>';
    }).join("");
    return '<div class="ios-echart">' + svg + dots + '</div>';
  }

  function paintPanel(panel) {
    var A = window.NotesApp, c = cur; if (!panel || !c) return;
    var pts = A.series ? A.series(c.id, range) : [], s1End = A.get().cfg.s1End;
    var all = A.subjNotes ? A.subjNotes(c.id) : [];
    var notes = all.filter(function (g) { return range === "year" || (range === "s1" ? g.date <= s1End : g.date > s1End); });
    var btns = '<div class="ios-erange" role="group" aria-label="Période">' + [["s1", "S1"], ["s2", "S2"], ["year", "Année"]].map(function (r) {
      return '<button type="button" data-erange="' + r[0] + '" aria-pressed="' + (r[0] === range) + '">' + r[1] + '</button>';
    }).join("") + '</div>';
    if (!pts.length) {
      panel.innerHTML = '<div class="ios-evalue"><span class="ios-evalue-n">–</span></div><p class="ios-ecap">' + LAB[range] + ' · pas encore de note</p>' + btns +
        '<p class="ios-eempty">' + (range === "year" ? "La courbe apparaît dès la première note de cette branche." : "Aucune note dans ce semestre.") + '</p>';
      return;
    }
    var n = pts.length, first = pts[0].avg, last = pts[n - 1].avg, d = last - first, up = d >= -1e-9;
    var si = sel == null || sel >= n ? n - 1 : sel, p = pts[si], before = si > 0 ? pts[si - 1].avg : null;
    var onDay = notes.filter(function (g) { return g.date === p.date; });
    var selV = onDay.length === 1 ? fmtN(onDay[0].value) : onDay.map(function (g) { return fmtN(g.value); }).join(" · ");
    var selT = onDay.map(noteName).join(", ") || "Note";
    var selM = fmtDay(p.date) + (onDay.length === 1 ? (onDay[0].type === "tp" ? " · TP" : onDay[0].type === "ta" ? "" : " · coef " + fmtN(onDay[0].coef)) : "") +
      " · moyenne " + (before == null ? fmt2(p.avg) : fmt2(before) + " → " + fmt2(p.avg));
    var vals = notes.map(function (g) { return g.value; });
    var hiV = vals.length ? Math.max.apply(null, vals) : null, loV = vals.length ? Math.min.apply(null, vals) : null;
    var goal = c.s && c.s.goal ? +c.s.goal : null, yearAvg = A.annualAvg(c.id);
    var stats = [
      ["Bulletin", String(roundHalf(last)), toneV(roundHalf(last))],
      ["Notes", String(notes.length), ""],
      ["Plus haute", hiV == null ? "–" : fmtN(hiV), ""],
      ["Plus basse", loV == null ? "–" : fmtN(loV), loV != null && loV < 4 ? "crit" : ""]
    ];
    c.sem.forEach(function (t) { stats.push([t.k, t.v, t.tone === "none" ? "" : ""]); });
    if (goal) { stats.push(["Objectif", fmtN(goal), ""]); stats.push(["Écart", yearAvg == null ? "–" : signed(yearAvg - goal), yearAvg == null ? "" : yearAvg >= goal ? "good" : "crit"]); }
    c.extra.forEach(function (x) { stats.push([x.k, x.v, ""]); });
    panel.innerHTML =
      '<div class="ios-evalue"><span class="ios-evalue-n">' + fmt2(last) + '</span>' +
      (n > 1 ? '<span class="ios-evalue-d ' + (up ? "is-up" : "is-down") + '">' + signed(d) + " (" + (d >= 0 ? "+" : "−") + Math.abs(first ? d / first * 100 : 0).toFixed(1) + ' %)</span>' : "") + '</div>' +
      '<p class="ios-ecap">' + LAB[range] + ' · moyenne exacte, bulletin ' + roundHalf(last) + '</p>' + btns + chartHtml(pts, si, up) +
      '<div class="ios-esel"><span class="ios-esel-v ios-tone-' + (onDay.length === 1 ? toneV(onDay[0].value) : "none") + '">' + selV + '</span>' +
      '<span class="ios-esel-t"><b>' + selT.replace(/[&<>"']/g, function (ch) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]; }) + '</b><span>' + selM + '</span></span></div>' +
      '<div class="ios-estats">' + stats.map(function (st) { return '<div class="ios-estat"><span>' + st[0] + '</span><b' + (st[2] ? ' class="ios-tone-' + st[2] + '"' : "") + '>' + st[1] + '</b></div>'; }).join("") + '</div>';
  }

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
  // Période (S1, S2, Année) et point de la courbe : le panneau est redessiné sur place, sans nouveau rendu du moteur.
  container.addEventListener("click", function (e) {
    var rb = e.target.closest("[data-erange]"), pb = e.target.closest("[data-esel]");
    if (!rb && !pb) return;
    if (rb) { if (rb.dataset.erange === range) return; range = rb.dataset.erange; sel = null; }
    else sel = parseInt(pb.dataset.esel, 10);
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
    scrollDash = window.scrollY; openRow = null; range = "year"; sel = null;
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
