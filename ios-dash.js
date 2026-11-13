/* ios-dash.js : Accueil « résumé à tuiles » (proposition C du canvas Claude Design, v51), téléphone seulement (≤ 700 px).
   Le moteur (index.html) et cert.js dessinent toujours leurs panneaux ; après chaque rendu, ce module les reprend pour que
   toute la page parle une seule langue (celle de Réglages : titres de section au-dessus de groupes blancs) :
   - en tête, #ios-dtop : le verdict en bandeau (icône ronde verte, orange, rouge ou grise) puis une tuile par condition
     du verdict (.metric du moteur ou de cert.js : anneau avec encoche au minimum, ou pastilles pour « / 4 max ») et une
     tuile « Moyenne générale » (courbe remplie, NotesApp.general). Le panneau d'origine (#promo) est masqué ;
   - « À surveiller » : chaque alerte devient une ligne à carré d'icône coloré ; toucher = détail de la branche ;
   - « Moyennes par branche » : barres horizontales de 1 à 6, seuil 4 en pointillé, encoche à l'objectif ; toucher =
     détail (écouteur du moteur sur #bars) ;
   - « Dernières notes » : lignes avec la note à droite ; toucher une ligne montre Modifier / Supprimer ;
   - le graphique « Évolution de la moyenne » est masqué (la tuile Moyenne générale le remplace, la page d'une branche a
     sa propre courbe).
   Couleurs : uniquement le niveau (vert, orange à 4, rouge sous 4), jamais la variation. Ordre des sections par CSS.
   cert.js redessine #promo APRÈS l'événement ios:rendered : la reprise attend donc la fin du rendu (microtâche).
   Sur grand écran, ios.css ignore #ios-dtop et les enveloppes .ios-dgrp : rien ne change. */
(function () {
  "use strict";
  var A = window.NotesApp, dash = document.getElementById("view-dash");
  if (!A || !dash) return;
  var mq = window.matchMedia("(max-width: 700px)");
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
    if (mx) {
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
    var pill = promo.querySelector(".pill"), p = promo.querySelector(".verdict p"), h = document.getElementById("h-promo");
    var m = pill && pill.className.match(/t-(good|warn|crit|none)/), cls = m ? m[1] : "none";
    var ic = { good: "check", warn: "info", crit: "times", none: "clock" }[cls];
    box.innerHTML = '<section class="ios-dtile ios-dverdict is-' + cls + '" role="status"><span class="ios-dverdict-ic">' + icon(ic) + '</span>' +
      '<span class="ios-dverdict-t"><span class="ios-dk">' + esc(h ? h.textContent : "") + '</span><b>' + esc(pill ? pill.textContent : "") + '</b>' +
      (p ? '<span>' + esc(p.textContent) + '</span>' : "") + '</span></section>' +
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

  /* ---------- Moyennes par branche : barres horizontales ---------- */
  function bars() {
    var box = document.getElementById("bars"); if (!box || box.querySelector(".ios-hb")) return;
    var subs = {}; (A.subjectsAll ? A.subjectsAll() : []).forEach(function (s) { subs[s.id] = s; });
    var rows = [].map.call(box.querySelectorAll("g.bar[data-subj]"), function (g) {
      var id = g.dataset.subj, s = subs[id] || {}, texts = g.querySelectorAll("text"), vt = g.querySelector("text.val");
      var short = texts.length ? texts[texts.length - 1].textContent : id, name = s.name && s.name.length <= 10 ? s.name : short;
      var v = vt ? parseFloat(vt.textContent) : null, tone = g.classList.contains("crit") ? "crit" : g.classList.contains("warn") ? "warn" : v == null ? "none" : "ok";
      var w = v == null ? 0 : Math.max(0, (v - 1) / 5 * 100), goal = s.goal ? '<u style="left:' + ((s.goal - 1) / 5 * 100).toFixed(1) + '%"></u>' : "";
      var t = g.querySelector("title");
      return '<div class="ios-hb is-' + tone + '" data-subj="' + esc(id) + '" role="button" tabindex="0" aria-label="' + esc(t ? t.textContent : name) + '">' +
        '<span class="ios-hb-n">' + esc(name) + '</span><span class="ios-hb-t"><i style="width:' + w.toFixed(1) + '%"></i>' + goal + '</span><b>' + (vt ? esc(vt.textContent) : "–") + '</b></div>';
    }).join("");
    box.innerHTML = '<div class="ios-hbs" role="list" aria-label="Note de bulletin de chaque branche, de 1 à 6, seuil 4">' + rows + '</div>';
  }

  /* ---------- Dernières notes : toucher une ligne montre ses actions ---------- */
  var openNote = null;
  function notes() {
    var ul = document.getElementById("notes"); if (!ul) return;
    [].forEach.call(ul.children, function (li) {
      if (li.classList.contains("empty") || li.classList.contains("ios-ta-li")) return;
      li.classList.add("ios-dnote");
      var ed = li.querySelector("[data-edit]"); if (ed) li.dataset.nid = ed.dataset.edit;
      if (openNote && li.dataset.nid === openNote) li.classList.add("ios-open");
    });
  }
  document.addEventListener("click", function (e) {
    if (!mq.matches || !e.target.closest) return;
    var li = e.target.closest("#notes > li.ios-dnote"); if (!li || e.target.closest("button, a, input, summary")) return;
    var on = !li.classList.contains("ios-open");
    [].forEach.call(document.querySelectorAll("#notes > li.ios-open"), function (x) { x.classList.remove("ios-open"); });
    li.classList.toggle("ios-open", on); openNote = on ? li.dataset.nid || null : null;
    if (window.FX) FX.haptic("select");
  });

  function paint() { if (!mq.matches) return; wrapPanels(); top(); alerts(); bars(); notes(); }
  document.addEventListener("ios:rendered", function () { Promise.resolve().then(paint); });
  // Passage grand écran → téléphone : ios-home.js demande déjà un nouveau rendu du moteur (NotesApp.redraw).
  paint();
})();
