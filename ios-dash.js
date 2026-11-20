/* ios-dash.js : Accueil « résumé à tuiles » (proposition C du canvas Claude Design, v51), téléphone seulement (≤ 700 px).
   Le moteur (index.html) et cert.js dessinent toujours leurs panneaux ; après chaque rendu, ce module les reprend pour que
   toute la page parle une seule langue (celle de Réglages : titres de section au-dessus de groupes blancs) :
   - en tête, #ios-dtop : une tuile par condition (le bandeau du verdict est retiré en v59)
     du verdict (.metric du moteur ou de cert.js : anneau avec encoche au minimum, ou pastilles pour « / 4 max ») et une
     tuile « Moyenne générale » (courbe remplie, NotesApp.general). Le panneau d'origine (#promo) est masqué ;
   - « À surveiller » : chaque alerte devient une ligne à carré d'icône coloré ; toucher = détail de la branche ;
   - « Toutes les moyennes » (#ios-bch, v60) : graphique en bâtons sous les tuiles ; la liste de barres horizontales
     « Moyennes par branche » est retirée (panneau masqué, #bars vidé) ;
   - « Dernières notes » : lignes avec la note à droite ; toucher une ligne ouvre la feuille Modifier / Voir les photos / Supprimer ;
   - le graphique « Évolution de la moyenne » est masqué (la tuile Moyenne générale le remplace, la page d'une branche a
     sa propre courbe).
   Couleurs : uniquement le niveau (vert, orange à 4, rouge sous 4), jamais la variation. Ordre des sections par CSS.
   cert.js redessine #promo APRÈS l'événement ios:rendered : la reprise attend donc la fin du rendu (microtâche).
   Sur grand écran, ios.css ignore #ios-dtop et les enveloppes .ios-dgrp : rien ne change. */
(function () {
  "use strict";
  var A = window.NotesApp, dash = document.getElementById("view-dash");
  if (!A || !dash) return;
  var mq = window.matchMedia("all");
  var desk = window.matchMedia("(min-width: 701px)"), lastItems = null;   // grand écran (session D)
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function icon(n) { return window.Icons ? Icons.svg(n) : ""; }
  function txt(root, sel) { var e = root.querySelector(sel); return e ? e.textContent.trim() : ""; }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function half(v) { return Math.round(v * 2) / 2; }
  function toneOf(v) { if (v == null) return "none"; var b = half(v); return b < 4 ? "crit" : b < 4.5 ? "warn" : "ok"; }
  function dateShort(iso) { try { return new Date(iso + "T12:00:00").toLocaleDateString("fr-CH", { day: "numeric", month: "short" }); } catch (e) { return iso; } }

  // Chaque panneau : le titre reste au-dessus, le contenu passe dans un groupe blanc (.ios-dgrp). Fait une seule fois :
  // le moteur ne remplace que l'intérieur de #alerts, #bars, #subjects, #notes.
  function wrapPanels() {
    [].forEach.call(dash.querySelectorAll(".panel"), function (p) {
      if (p.classList.contains("ios-dsec")) return;
      p.classList.add("ios-dsec");
      if (p.querySelector("#promo")) { p.classList.add("ios-dsec-promo"); return; }
      var g = document.createElement("div"); g.className = "ios-dgrp";
      [].slice.call(p.children).forEach(function (c) { if (c.tagName !== "H2" && !c.classList.contains("chart-head")) g.appendChild(c); });
      p.appendChild(g);
      var id = p.querySelector("#alerts") ? "alerts" : p.querySelector("#bars") ? "bars" : p.querySelector("#subjects") ? "subjects" : p.querySelector("#chart") ? "chart" : p.querySelector("#notes") ? "notes" : "";
      if (id) p.classList.add("ios-dsec-" + id);
    });
  }

  /* ---------- Verdict et tuiles ---------- */
  function ring(r, at, tone) {
    var C = 2 * Math.PI * 30, len = Math.max(0, Math.min(1, r || 0)) * C;
    return '<svg class="ios-dring is-' + tone + '" viewBox="0 0 80 80" aria-hidden="true"><circle class="ios-dring-bg" cx="40" cy="40" r="30"/>' +
      (len > 0.5 ? '<circle class="ios-dring-fg" cx="40" cy="40" r="30" stroke-dasharray="' + len.toFixed(1) + " " + C.toFixed(1) + '" transform="rotate(-90 40 40)"/>' : "") +
      (at != null ? '<line class="ios-dring-mk" x1="40" y1="3" x2="40" y2="17" transform="rotate(' + (at * 360).toFixed(1) + ' 40 40)"/>' : "") + '</svg>';
  }
  function tile(label, gfx, val, unit, foot, aria) {
    return '<section class="ios-dtile" role="group" aria-label="' + esc(aria || label) + '"><span class="ios-dk">' + esc(label) + '</span>' + gfx +
      '<span class="ios-dbig">' + esc(val) + (unit ? ' <small>' + esc(unit) + '</small>' : "") + '</span><span class="ios-dfoot">' + esc(foot) + '</span></section>';
  }
  function metricTile(m) {
    var label = txt(m, ".lbl").replace(/\s*\([^)]*\)\s*$/, ""), unit = txt(m, ".val small"), valEl = m.querySelector(".val");
    var val = valEl && valEl.firstChild ? valEl.firstChild.textContent.trim() : "–";
    var bar = m.querySelector(".bar"), fill = bar && bar.querySelector("i"), mark = bar && bar.querySelector("b");
    var ratio = fill ? parseFloat(fill.style.width) / 100 : 0, at = mark ? parseFloat(mark.style.left) / 100 : null;
    var tone = bar && bar.classList.contains("crit") ? "crit" : bar && bar.classList.contains("warn") ? "warn" : "ok";
    var sub = txt(m, ".sub"), min = txt(m, ".tick span"), aria = txt(m, ".lbl") + " : " + val + " " + unit + ". " + sub;
    var mx = unit.match(/(\d+)\s*max/);
    if (mx && /^\d+$/.test(val)) {      // valeur entière : pastilles ; avec décimale (écarts sous 4 de l'ECG) : anneau
      var max = +mx[1], n = parseInt(val, 10) || 0, pips = "";
      for (var i = 0; i < Math.max(max, n); i++) pips += '<i class="' + (i < n ? (n > max ? "is-crit" : "is-warn") : "") + '"></i>';
      return tile(label, '<span class="ios-dpips" aria-hidden="true">' + pips + '</span>', val, unit, sub, aria);
    }
    var d = sub.match(/([+−]\d+(?:\.\d+)?) pt/), foot = d ? [min, d[1] + " pt"].filter(Boolean).join(" · ") + (/rythme actuel/.test(sub) ? " au rythme actuel" : "") : sub;
    return tile(label, ring(ratio, at, tone), val, unit, foot, aria);
  }
  function avgTile() {
    var pts = A.general ? A.general(A.period ? A.period() : "year") : [], n = pts.length;
    var spk = window.IOSSpark ? IOSSpark.filled : null;
    if (!n || !spk) return tile("Moyenne générale", '<span class="ios-dspark"></span>', "–", "", "aucune note");
    var vals = pts.map(function (p) { return p.avg; }), last = vals[n - 1], d = last - vals[0];
    var foot = n === 1 ? "1re note" : (Math.abs(d) < 0.005 ? "stable" : (d > 0 ? "▲ " : "▼ ") + Math.abs(d).toFixed(2)) + " depuis le " + dateShort(pts[0].date);
    return tile("Moyenne générale", spk(vals, 120, 56, toneOf(last), "ios-dspark"), last.toFixed(2), "", foot, "Moyenne générale : " + last.toFixed(2) + ", " + foot);
  }
  function top() {
    var promo = document.getElementById("promo"); if (!promo) return;
    var panel = promo.closest(".panel"), box = document.getElementById("ios-dtop");
    if (!box) { box = document.createElement("div"); box.id = "ios-dtop"; box.className = "ios-dtop"; panel.parentNode.insertBefore(box, panel); }
    // v59 (demande de l'utilisateur) : plus de bandeau du verdict (« Promotion assurée »…) en tête : seulement les tuiles.
    box.innerHTML =
    '<div class="ios-dtiles">' + [].map.call(promo.querySelectorAll(".metric"), metricTile).join("") + avgTile() + '</div>';
  }

  /* ---------- À surveiller ---------- */
  function alerts() {
    var ul = document.getElementById("alerts"); if (!ul) return;
    var subs = A.subjectsAll ? A.subjectsAll() : [];
    [].forEach.call(ul.children, function (li) {
      if (li.classList.contains("ios-arow")) return;
      var b = li.querySelector("b"), name = b ? b.textContent : "", all = li.textContent.trim();
      var rest = name ? all.slice(all.indexOf(name) + name.length).replace(/^\s*:\s*/, "") : "";
      var k = li.classList.contains("t-crit") ? "crit" : li.classList.contains("t-warn") ? "warn" : name ? "goal" : "ok";
      var s = name ? subs.filter(function (x) { return x.name === name; })[0] : null;
      li.classList.add("ios-arow", "is-" + k);
      if (s) { li.dataset.subj = s.id; li.setAttribute("role", "button"); li.tabIndex = 0; }
      li.innerHTML = '<span class="ios-arow-ic">' + icon({ crit: "times", warn: "info", goal: "target", ok: "check" }[k]) + '</span>' +
        '<span class="ios-arow-t"><b>' + esc(name || all) + '</b>' + (rest ? '<span>' + esc(cap(rest)) + '</span>' : "") + '</span>' +
        (s ? '<span class="ios-arow-chev">' + icon("chevr") + '</span>' : "");
    });
  }
  document.addEventListener("click", function (e) {
    var li = e.target.closest && e.target.closest("#alerts li[data-subj]");
    if (li && A.showSubject) { if (window.FX) FX.haptic("select"); A.showSubject(li.dataset.subj); }
  });
  document.addEventListener("keydown", function (e) {
    var li = e.target.closest && e.target.closest("#alerts li[data-subj]");
    if (li && (e.key === "Enter" || e.key === " ") && li === e.target && A.showSubject) { e.preventDefault(); A.showSubject(li.dataset.subj); }
  });

  /* ---------- Graphique en bâtons (v60) : toutes les moyennes d'un coup d'œil, sous les tuiles ----------
     Un bâton par branche (moyenne exacte de la période choisie), axe fixe de 1 à 6 (l'échelle des notes a un sens :
     charts.md › Axes), ligne du seuil 4 bien visible, trait d'objectif sur chaque bâton qui en a un. Couleur = niveau :
     rouge sous 4, orange de 4 à 4,5, vert au-dessus (même règle que les tuiles). Valeur au-dessus du bâton, en noir. */
  function fmtB(b) { return b % 1 === 0 ? String(b) : b.toFixed(1); }   // 4 reste « 4 », 4.5 reste « 4.5 », comme sur le bulletin
  function topRound(x, y, w, h, r) {   // bâton arrondi en haut seulement, à plat sur l'axe
    r = Math.max(0, Math.min(r, w / 2, h));
    return "M" + x.toFixed(1) + "," + (y + h).toFixed(1) + " V" + (y + r).toFixed(1) + " A" + r.toFixed(1) + "," + r.toFixed(1) + " 0 0 1 " + (x + r).toFixed(1) + "," + y.toFixed(1) +
      " H" + (x + w - r).toFixed(1) + " A" + r.toFixed(1) + "," + r.toFixed(1) + " 0 0 1 " + (x + w).toFixed(1) + "," + (y + r).toFixed(1) + " V" + (y + h).toFixed(1) + " Z";
  }
  function chart(items) {
    var top = document.getElementById("ios-dtop"), panel = document.getElementById("ios-bch");
    if (!top) return;
    if (!panel) {
      panel = document.createElement("section"); panel.id = "ios-bch"; panel.className = "panel ios-dsec ios-dsec-bch";
      top.parentNode.insertBefore(panel, top.nextSibling);
    }
    var period = A.period ? A.period() : "year", data = items.map(function (it) {
      var pts = A.series ? A.series(it.id, period) : [], v = pts.length ? pts[pts.length - 1].avg : null;
      var b = v == null ? null : half(v);   // le bâton montre la note de bulletin (demi-point), v garde la moyenne exacte pour la description
      return { id: it.id, name: it.name, short: it.short, goal: it.goal, v: v, b: b, tone: toneOf(v) };
    });
    var n = data.length;
    if (!n) { panel.innerHTML = ""; return; }
    // Axe fixe de 1 à 6 (l'échelle des notes a un sens). Peu de repères : 2, 4 et 6 ; le 4 est la ligne qui compte.
    // Grand écran (session D) : le dessin prend la largeur réelle du groupe (texte à sa vraie taille, pas agrandi), bâtons
    // un peu plus larges ; noms des branches à plat dès qu'il y a la place. Téléphone : 358 de large, inchangé.
    var wide = desk.matches && panel.clientWidth > 420, W = wide ? Math.round(panel.clientWidth - 24) : 358;
    var slot0 = (W - 20) / n, rot = wide ? slot0 < 44 : n > 8, H = wide ? 280 : rot ? 248 : 222, L = 18, R = 2, T = 20, B = rot ? 54 : 30, slot = (W - L - R) / n, bw = Math.min(wide ? 32 : 24, slot * 0.6);
    lastItems = items;
    function Y(v) { return T + (1 - (v - 1) / 5) * (H - T - B); }
    var base = Y(1), g = "", i;
    // Les lignes de repère s'interrompent derrière un chiffre qu'elles traverseraient (pas de liseré autour du chiffre : il ferait une
    // tache sur l'ombre et en mode sombre).
    var boxes = data.map(function (d, k) {
      if (d.b == null) return null;
      var cx = L + slot * (k + 0.5), by = Y(d.b) - 6;
      return { x0: cx - 11, x1: cx + 11, y0: by - 12, y1: by + 3 };
    }).filter(Boolean);
    function rule(cls, v) {
      var yy = Y(v), gaps = boxes.filter(function (q) { return yy >= q.y0 && yy <= q.y1; }), x = L, dd = "";
      gaps.forEach(function (q) { dd += "M" + x.toFixed(1) + "," + yy.toFixed(1) + " H" + q.x0.toFixed(1) + " "; x = q.x1; });
      dd += "M" + x.toFixed(1) + "," + yy.toFixed(1) + " H" + (W - R);
      return '<path class="' + cls + '" d="' + dd + '"/>';
    }
    [2, 3, 5, 6].forEach(function (v) { g += rule("ios-bch-grid", v); });
    for (i = 1; i <= 6; i++) g += '<text class="ios-bch-y' + (i === 4 ? " is-thr" : "") + '" x="' + (L - 5) + '" y="' + (Y(i) + 3.5).toFixed(1) + '" text-anchor="end">' + i + '</text>';
    g += '<line class="ios-bch-base" x1="' + L + '" x2="' + (W - R) + '" y1="' + base.toFixed(1) + '" y2="' + base.toFixed(1) + '"/>';
    var bars = "", ghosts = "";
    data.forEach(function (d, k) {
      var cx = L + slot * (k + 0.5), x = cx - bw / 2, y = d.b == null ? base - 3 : Y(d.b), h = Math.max(0, base - y), gy = d.goal ? Y(d.goal) : null;
      var label = d.name + " : " + (d.v == null ? "pas encore de note" : "note de bulletin " + fmtB(d.b) + ", moyenne exacte " + d.v.toFixed(2)) + (d.goal ? ", objectif " + d.goal : "");
      // Ombre : colonne gris clair derrière le bâton, de l'axe jusqu'à l'objectif (sans trait ni chiffre). Cachée par le bâton
      // quand l'objectif est atteint ; absente quand la branche n'a pas d'objectif.
      if (gy != null) ghosts += '<path class="ios-bch-ghost" d="' + topRound(x, gy, bw, base - gy, 7) + '"/>';
      bars += '<g class="ios-bch-g" data-subj="' + esc(d.id) + '" role="button" tabindex="0" aria-label="' + esc(label) + '">' +
        '<rect class="ios-bch-hit" x="' + (cx - slot / 2).toFixed(1) + '" y="0" width="' + slot.toFixed(1) + '" height="' + H + '"/>' +
        '<path class="ios-bch-bar is-' + d.tone + '" d="' + topRound(x, y, bw, h, 7) + '"/>' +
        (d.b == null ? "" : '<text class="ios-bch-v" x="' + cx.toFixed(1) + '" y="' + (y - 6).toFixed(1) + '" text-anchor="middle">' + fmtB(d.b) + '</text>') +
        (rot ? '<text class="ios-bch-n" transform="translate(' + (cx + 3).toFixed(1) + ' ' + (base + 13) + ') rotate(-45)" text-anchor="end">' + esc(d.short) + '</text>'
             : '<text class="ios-bch-n" x="' + cx.toFixed(1) + '" y="' + (base + 18) + '" text-anchor="middle">' + esc(d.short) + '</text>') + '</g>';
    });
    var thr = rule("ios-bch-thr", 4);
    var lab = data.filter(function (d) { return d.b != null; }).map(function (d) { return d.name + " " + fmtB(d.b); }).join(", ");
    panel.innerHTML = '<h2>Toutes les moyennes</h2><div class="ios-dgrp"><svg class="ios-bch-svg" viewBox="0 0 ' + W + " " + H + '" role="group" aria-label="Moyenne de chaque branche, de 1 à 6, seuil 4. ' + esc(lab) + '">' + g + ghosts + thr + bars + '</svg>' +
      '<p class="ios-bch-leg"><span><i class="ios-bch-k-thr"></i>Seuil 4</span>' + '</p></div>';
  }
  document.addEventListener("click", function (e) {
    var g = e.target.closest && e.target.closest("#ios-bch [data-subj]");
    if (g && A.showSubject) { if (window.FX) FX.haptic("select"); A.showSubject(g.dataset.subj); }
  });
  document.addEventListener("keydown", function (e) {
    var g = e.target.closest && e.target.closest("#ios-bch [data-subj]");
    if (g && (e.key === "Enter" || e.key === " ") && A.showSubject) { e.preventDefault(); A.showSubject(g.dataset.subj); }
  });

  /* ---------- Données du graphique : le moteur redessine #bars à chaque rendu (v60 : la liste de barres horizontales est retirée) ---------- */
  function bars() {
    var box = document.getElementById("bars"); if (!box || !box.querySelector("g.bar[data-subj]")) return;
    var subs = {}; (A.subjectsAll ? A.subjectsAll() : []).forEach(function (s) { subs[s.id] = s; });
    var items = [].map.call(box.querySelectorAll("g.bar[data-subj]"), function (g) {
      var id = g.dataset.subj, s = subs[id] || {}, texts = g.querySelectorAll("text");
      var short = texts.length ? texts[texts.length - 1].textContent : id;
      return { id: id, name: s.name || short, short: short, goal: s.goal ? +s.goal : null };
    });
    chart(items);
    box.innerHTML = "";
  }

  /* ---------- Dernières notes : toucher une ligne ouvre la feuille d'actions (ios-sheets.js, session B) ---------- */
  function notes() {
    var ul = document.getElementById("notes"); if (!ul) return;
    [].forEach.call(ul.children, function (li) {
      if (li.classList.contains("empty") || li.classList.contains("ios-ta-li")) return;
      li.classList.add("ios-dnote");
      var ed = li.querySelector("[data-edit]"); if (ed) li.dataset.nid = ed.dataset.edit;
    });
  }

  function paint() { if (!mq.matches) return; wrapPanels(); top(); alerts(); bars(); notes(); }
  // Grand écran : la largeur du graphique suit la fenêtre (et le passage téléphone ↔ grand écran sans recharger, qui laissait
  // un bloc noir avant la session D).
  var rz = 0;
  window.addEventListener("resize", function () { cancelAnimationFrame(rz); rz = requestAnimationFrame(function () { if (lastItems) chart(lastItems); }); });
  document.addEventListener("ios:rendered", function () { Promise.resolve().then(paint); });
  // Passage grand écran → téléphone : ios-home.js demande déjà un nouveau rendu du moteur (NotesApp.redraw).
  paint();
})();
