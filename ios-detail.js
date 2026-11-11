/* ios-detail.js : détail d'une matière en PAGE ENTIÈRE sur téléphone (≤ 700 px), à la place de la feuille. Spécification :
   design/SPEC-reglages.md (« Additions »). Sur grand écran, rien ne change : la feuille (#sheet) reste, sans animation.
   Principe : renderDetail (index.html) construit toujours son contenu dans #sheet-box ; sur téléphone, IOSDetail.open() prend
   ce contenu et en fait la page #ios-detail, mise en page de la maquette F (v46) : anneau de la moyenne, tuiles des
   semestres, courbe simple de la moyenne, notes groupées par semestre (voir buildPage). Chaque nouveau rendu (note supprimée…) refait
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

  /* Page de détail, maquette F (v46, design/maquettes-detail/Mix.dc.html). Le moteur écrit toujours dans #sheet-box ;
     on en reprend les morceaux et les données de NotesApp :
     1. en-tête centré (nom, périodes, objectif) avec le bouton « + » (Ajouter une note dans cette branche) ;
     2. l'anneau de la moyenne de l'année (échelle 1 à 6, repères 4 et objectif), le bulletin au centre, une ligne d'état ;
     3. les tuiles Semestre 1 / Semestre 2 ; le bloc « Prochain test » et le certificat (3e) tels quels ;
     4. la carte « Évolution » : la courbe simple de la moyenne (NotesApp.series) ; dessous, s'il y en a, le détail
        tests / TP ou les parties d'une branche composée ;
     5. les notes groupées par semestre, une ligne par note (valeur dans une pastille colorée, intitulé, date et coef,
        chevron). Toucher une ligne montre ses actions (Modifier, Supprimer, Photos) ; un TA reste dépliable. La liste
        reste celle du moteur (#sheet-notes, avec son écouteur) : on n'y ajoute que des titres de semestre. */
  var MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  var openRow = null;                       // note dont les actions sont montrées (gardée d'un rendu à l'autre)
  function fmt2(v) { return v == null ? "–" : v.toFixed(2); }
  function subjOf(id) { return window.NotesApp.subjectsAll().filter(function (x) { return x.id === id; })[0] || null; }

  function ringSvg(avg, goal, tone) {
    var R = 88, C = 2 * Math.PI * R, frac = avg == null ? 0 : Math.max(0, Math.min(1, (avg - 1) / 5));
    function tick(v, cls) {
      var a = (-90 + (v - 1) / 5 * 360) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
      return '<line class="' + cls + '" x1="' + (110 + 76 * c).toFixed(1) + '" y1="' + (110 + 76 * s).toFixed(1) + '" x2="' + (110 + 100 * c).toFixed(1) + '" y2="' + (110 + 100 * s).toFixed(1) + '"/>';
    }
    function lbl(v, cls) {
      var a = (-90 + (v - 1) / 5 * 360) * Math.PI / 180;
      return '<span class="ios-ring-lbl ' + cls + '" style="left:' + (110 + 116 * Math.cos(a)).toFixed(0) + 'px;top:' + (110 + 116 * Math.sin(a)).toFixed(0) + 'px">' + v + '</span>';
    }
    return '<svg class="ios-ring-svg" width="220" height="220" viewBox="0 0 220 220" aria-hidden="true">' +
      '<circle class="ios-ring-track" cx="110" cy="110" r="' + R + '"/>' +
      (frac > 0 ? '<circle class="ios-ring-val ios-ring-' + tone + '" cx="110" cy="110" r="' + R + '" stroke-dasharray="' + (frac * C).toFixed(1) + " " + C.toFixed(1) + '" transform="rotate(-90 110 110)"/>' : "") +
      tick(4, "ios-ring-t4") + (goal && goal !== 4 ? tick(goal, "ios-ring-tg") : "") + '</svg>' +
      lbl(4, "ios-ring-l4") + (goal && goal !== 4 ? lbl(goal, "ios-ring-lg") : "");
  }

  function chartSvg(pts) {
    if (!pts.length) return '<p class="ios-chart-empty">La courbe apparaît dès la première note de cette branche.</p>';
    var W = 340, H = 150, L = 30, R = 12, T = 12, B = 26;
    var vals = pts.map(function (p) { return p.avg; });
    var lo = Math.max(1, Math.min(4, Math.floor(Math.min.apply(null, vals) * 2) / 2)), hi = Math.min(6, Math.max(lo + 1, Math.ceil(Math.max.apply(null, vals) * 2) / 2));
    var step = hi - lo > 2 ? 1 : 0.5, n = pts.length;
    function X(i) { return n === 1 ? (L + W - R) / 2 : L + i * (W - L - R) / (n - 1); }
    function Y(v) { return T + (hi - v) / (hi - lo) * (H - T - B); }
    var g = "", v;
    for (v = lo; v <= hi + 1e-9; v += step) g += '<line class="ios-chart-grid" x1="' + L + '" x2="' + W + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '"/><text class="ios-chart-y" x="0" y="' + (Y(v) + 4).toFixed(1) + '">' + v + '</text>';
    var xl = "", seen = {}, k = Math.min(6, n);
    for (var i = 0; i < k; i++) {
      var j = k === 1 ? 0 : Math.round(i * (n - 1) / (k - 1)), m = MONTHS[parseInt(pts[j].date.slice(5, 7), 10) - 1];
      if (seen[m]) continue; seen[m] = 1;
      xl += '<text class="ios-chart-x" x="' + X(j).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="' + (j === 0 && n > 1 ? "start" : j === n - 1 && n > 1 ? "end" : "middle") + '">' + m + '</text>';
    }
    var line = pts.map(function (p, i) { return X(i).toFixed(1) + "," + Y(p.avg).toFixed(1); }).join(" ");
    var last = pts[n - 1];
    return '<svg class="ios-chart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Moyenne au fil des notes : ' + vals.map(fmt2).join(", ") + '">' + g +
      (n > 1 ? '<polyline class="ios-chart-line" points="' + line + '"/>' : "") +
      '<circle class="ios-chart-end" cx="' + X(n - 1).toFixed(1) + '" cy="' + Y(last.avg).toFixed(1) + '" r="5.5"/>' + xl + '</svg>';
  }

  // Date d'une ligne de la liste (pour la ranger dans son semestre) et identifiant de ses actions.
  function rowDate(li, recs, coll) {
    var ta = li.querySelector("[data-ta]");
    if (ta) { var t = coll.filter(function (x) { return x.id === "ta:" + ta.dataset.ta; })[0]; return t ? t.date : null; }
    var ed = li.querySelector("[data-edit]"), r = ed && recs.filter(function (x) { return x.id === ed.dataset.edit; })[0];
    return r ? r.date : null;
  }

  function buildPage() {
    var box = document.getElementById("sheet-box");
    if (!box || !box.firstChild) return null;
    var A = window.NotesApp, id = A.detailId && A.detailId(), s = id ? subjOf(id) : null;
    var h2 = box.querySelector("#sheet-title"), sp = box.querySelector(".sheet-head p"), name = h2 ? h2.textContent : "";
    var page = el("div", "ios-page ios-dpage ios-fpage");

    // 1. En-tête.
    var head = el("div", "ios-fhead");
    var h1 = el("h1", "ios-large"); h1.textContent = name; head.appendChild(h1);
    var subTxt = (sp ? sp.textContent : "") + (s && s.goal ? " · objectif " + s.goal : "");
    if (subTxt) { var sub = el("p", "ios-sub"); sub.textContent = subTxt; head.appendChild(sub); }
    var tiles = [].slice.call(box.querySelectorAll(".tiles .tile"));
    page.appendChild(head);

    var chart = box.querySelector("#sheet-chart"), notesUl = box.querySelector("#sheet-notes"), need = box.querySelector(".need"), cert = box.querySelector(".cert-min");
    var brk = box.querySelector(".brk"), rowsOf = brk ? [].slice.call(brk.children) : [];

    if (tiles.length) {
      // 2. Anneau de la moyenne de l'année.
      var y = tiles[0], num = y.querySelector(".num"), tone = toneOf(num), avg = A.annualAvg(id), goal = s && s.goal ? +s.goal : null;
      var status = TONE_TEXT[tone];
      if (avg != null && goal) status += avg >= goal ? " · objectif atteint" : " · encore " + (goal - avg).toFixed(2).replace(/0$/, "") + " pour l'objectif";
      var ring = el("div", "ios-ring", ringSvg(avg, goal, tone) +
        '<div class="ios-ring-in"><span class="ios-ring-k">Bulletin</span><span class="ios-ring-num">' + esc(num ? num.textContent : "–") + '</span>' +
        '<span class="ios-ring-s">' + (avg != null ? "exacte " + fmt2(avg) : "pas encore de note") + '</span></div>');
      ring.setAttribute("role", "img");
      ring.setAttribute("aria-label", "Note de bulletin " + (num ? num.textContent : "–") + (avg != null ? ", moyenne exacte " + fmt2(avg) : "") + ", sur une échelle de 1 à 6");
      page.appendChild(ring);
      var st = el("p", "ios-ring-st ios-tone-" + tone); st.textContent = status; page.appendChild(st);

      // 3. Semestres.
      var grid = el("div", "ios-ftiles");
      tiles.slice(1).forEach(function (t) {
        var n = t.querySelector(".num"), sb = t.querySelector(".sub"), lb = t.querySelector(".lbl");
        grid.appendChild(el("div", "ios-ftile", '<span class="ios-ftile-k">' + esc(lb ? lb.textContent : "") + '</span><span class="ios-ftile-v ios-tone-' + toneOf(n) + '">' +
          esc(n ? n.textContent : "–") + '</span><span class="ios-ftile-s">' + esc(sb ? sb.textContent : "") + '</span>'));
      });
      page.appendChild(grid);
    }
    if (need) { need.className = "ios-grp ios-need"; page.appendChild(need); }
    if (cert) { var cg = el("div", "ios-grp ios-cert"); cg.appendChild(cert); page.appendChild(cg); }

    // 4. Évolution (courbe simple de la moyenne) et détail tests / TP ou parties.
    if (tiles.length) {
      var pts = A.series ? A.series(id) : [];
      var card = el("div", "ios-grp ios-fchart", '<div class="ios-fchart-h"><span>Évolution</span>' +
        (pts.length > 1 ? '<span class="ios-fchart-r">' + MONTHS[parseInt(pts[0].date.slice(5, 7), 10) - 1] + " → " + MONTHS[parseInt(pts[pts.length - 1].date.slice(5, 7), 10) - 1] + '</span>' : "") + '</div>' + chartSvg(pts));
      var extra = rowsOf.filter(function (r) { var a = r.querySelector("span"); return a && !/^(Notes saisies|Objectif)/.test(a.textContent); });
      if (extra.length) {
        var dl = el("div", "ios-fchart-rows");
        extra.forEach(function (r) {
          var sps = r.querySelectorAll(":scope > span"); if (sps.length < 2) return;
          dl.appendChild(el("div", "ios-fchart-row", '<span>' + sps[0].innerHTML + '</span><span class="mono">' + sps[1].innerHTML + '</span>'));
        });
        card.appendChild(dl);
      }
      page.appendChild(card);
      if (chart) chart.remove();
    }

    // 5. Notes, groupées par semestre.
    if (tiles.length) {
      if (notesUl) {
        var recs = A.records(), coll = A.collapse(recs), s1End = A.get().cfg.s1End, groups = { s2: [], s1: [] };
        [].slice.call(notesUl.children).forEach(function (li) {
          var w = li.querySelector(":scope > .what");
          if (w) {   // dans la page d'une matière, le nom de la matière est inutile sur chaque ligne
            var t = w.textContent, meta = li.querySelector(":scope > .meta");
            if (t === name) w.textContent = meta && /· TP/.test(meta.textContent) ? "TP" : "Test";
            else if (t.indexOf(name + " · ") === 0) w.textContent = t.slice(name.length + 3);
          }
          var v = li.querySelector(":scope > .v");
          if (v && !li.classList.contains("ios-ta-li")) {
            var x = parseFloat(v.textContent);
            v.classList.add(x < 4 ? "ios-nv-crit" : x >= 5 ? "ios-nv-good" : "ios-nv-mid");
            li.classList.add("ios-nrow");
            var ed = li.querySelector("[data-edit]"); if (ed) li.dataset.nid = ed.dataset.edit;
            if (li.dataset.photos) {   // les photos s'ouvrent par un bouton des actions : le toucher de la ligne montre les actions
              var acts = li.querySelector(":scope > .acts"), pb = document.createElement("button");
              pb.type = "button"; pb.className = "link"; pb.setAttribute("data-ph-open", li.dataset.photos); pb.textContent = "Photos";
              if (acts) acts.insertBefore(pb, acts.firstChild);
              li.removeAttribute("data-photos");
            }
            if (li.dataset.nid && li.dataset.nid === openRow) li.classList.add("ios-open");
          }
          var d = rowDate(li, recs, coll);
          (d && s1End && d <= s1End ? groups.s1 : groups.s2).push(li);
        });
        var multi = groups.s1.length && groups.s2.length;
        [["s2", "Semestre 2"], ["s1", "Semestre 1"]].forEach(function (gk) {
          var list = groups[gk[0]]; if (!list.length) return;
          if (multi || s1End) { var hd = el("li", "ios-nsem"); hd.setAttribute("aria-hidden", "true"); hd.textContent = gk[1] + " · " + list.length + " note" + (list.length > 1 ? "s" : ""); notesUl.appendChild(hd); }
          list.forEach(function (li, i) { li.classList.toggle("ios-nfirst", i === 0); li.classList.toggle("ios-nlast", i === list.length - 1); notesUl.appendChild(li); });
        });
        var wrapN = el("div", "ios-fnotes"); wrapN.appendChild(notesUl); page.appendChild(wrapN);
      } else {
        page.appendChild(el("div", "ios-grp ios-empty", window.Icons.svg("doc", "ios-empty-ic") + '<b>Aucune note pour l\'instant</b><span>Ajoute ta première note dans cette branche : la moyenne et la courbe apparaîtront ici.</span>' +
          '<button type="button" class="btn" data-dadd="1">Ajouter une note</button>'));
      }
    }
    return page;
  }
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
    scrollDash = window.scrollY; openRow = null;
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
