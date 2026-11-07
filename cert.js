/* Notes — certificat de maturité en 3e année (REM art. 17-20, BLV 412.12.1 ; vade-mecum GAP 2024-25).
   14 notes de maturité. Disciplines d'examen : note = (2 × note annuelle + écrit + oral) / 4 (OC : (annuelle + oral) / 2),
   arrondie au demi-point. Réussite : (a) total des 14 notes avec double compensation ≥ 56 ; (b) au plus 4 notes < 4 ;
   (c) total des 11 notes d'examen ≥ 38,5. */
(function () {
  "use strict";
  var KEY = "notes2m01.exams";
  var data = load();
  function load() { try { var d = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; d.exams = d.exams || {}; d.carried = d.carried || {}; return d; } catch (e) { return { exams: {}, carried: {} }; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {} if (window.Sync) Sync.changed(); }
  function half(x) { return Math.floor(x * 2 + 0.5 + 1e-9) / 2; }
  function num(v) { var n = parseFloat(String(v).replace(",", ".")); return isFinite(n) && n >= 1 && n <= 6 ? n : null; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function fmt(n) { return n == null ? "–" : (Number.isInteger(n) ? String(n) : n.toFixed(1)); }
  var app = function () { return window.NotesApp; };

  var EXAM = ["fr", "l2", "l3", "ma", "os"];          // écrit + oral
  var CARRIED = [["ch", "Chimie"], ["ph", "Physique"], ["art", null]]; // notes de 2e reprises

  // Les 14 notes de maturité, avec un examen hypothétique « x » pour chaque épreuve pas encore saisie.
  function compute(x) {
    var subs = app().subjectsAll(), pr = app().profile(), rows = [], examNotes = [], missing = [];
    function na(id) { var a = app().annualAvg(id); return a == null ? null : half(a); }
    function ex(id, k) { var e = data.exams[id] || {}, v = num(e[k]); return v != null ? { v: v, real: true } : (x != null ? { v: x, real: false } : null); }
    EXAM.forEach(function (id) {
      var s = subs.filter(function (z) { return z.id === id; })[0]; if (!s) return;
      var n = na(id), w = ex(id, "w"), o = ex(id, "o");
      if (w) examNotes.push(w.v); if (o) examNotes.push(o.v);
      var f = n != null && w && o ? half((2 * n + w.v + o.v) / 4) : null;
      if (n == null) missing.push(s.name);
      rows.push({ id: id, name: s.name, na: n, w: w, o: o, final: f, exam: true });
    });
    var oc = subs.filter(function (z) { return z.id === "oc"; })[0];
    if (oc) {
      var n = na("oc"), o = ex("oc", "o");
      if (o) examNotes.push(o.v);
      if (n == null) missing.push(oc.name);
      rows.push({ id: "oc", name: oc.name, na: n, o: o, final: n != null && o ? half((n + o.v) / 2) : null, exam: true, oralOnly: true });
    }
    ["bi", "hi", "ge", "phi", "tm"].forEach(function (id) {
      var s = subs.filter(function (z) { return z.id === id; })[0]; if (!s) return;
      var n = na(id); if (n == null) missing.push(s.name);
      rows.push({ id: id, name: s.name, na: n, final: n });
    });
    CARRIED.forEach(function (c) {
      var name = c[1] || (pr && pr.art === "mu" ? "Musique" : "Arts visuels"), v = num(data.carried[c[0]]);
      // Par défaut : la note annuelle de 2e, calculée à partir des notes de 2e encore enregistrées dans l'app.
      var auto = app().storedAvg ? app().storedAvg(c[0], c[0] === "art" ? 0 : 0.25) : null, src = v != null ? "saisie" : auto != null ? "auto" : null;
      if (v == null && auto != null) v = auto;
      if (v == null) missing.push(name + " (note de 2e)");
      rows.push({ id: c[0], name: name, final: v != null ? half(v) : null, carried: true, src: src, auto: auto != null ? half(auto) : null });
    });
    var finals = rows.map(function (r) { return r.final; }), done = finals.every(function (f) { return f != null; });
    var total = 0, dc = 0, fails = 0;
    finals.forEach(function (f) { if (f == null) return; total += f; if (f < 4) { dc += 4 - f; fails++; } });
    var examTotal = examNotes.reduce(function (a, b) { return a + b; }, 0);
    var nExam = EXAM.length * 2 + (oc ? 1 : 0);
    return { rows: rows, complete: done && examNotes.length === nExam, total: total, score: total - dc, fails: fails, examTotal: examTotal,
      nExam: nExam, missing: missing, pass: done && examNotes.length === nExam && total - dc >= 56 - 1e-9 && fails <= 4 && examTotal >= 38.5 - 1e-9 };
  }
  // Plus petite note (demi-point) à obtenir à chaque épreuve encore à passer pour réussir.
  function minimum() {
    for (var x = 1; x <= 6.0001; x += 0.5) { var r = compute(x); if (r.missing.length) return { missing: r.missing }; if (r.pass) return { x: x, r: r }; }
    return { x: null };
  }
  function needFor4(r) {
    if (r.na == null) return null;
    for (var e = 1; e <= 6.0001; e += 0.5) {
      var w = r.w && r.w.real ? r.w.v : e, o = r.o && r.o.real ? r.o.v : e;
      var f = r.oralOnly ? half((r.na + o) / 2) : half((2 * r.na + w + o) / 4);
      if (f >= 4) return e;
    }
    return null;
  }

  var EXAM_IDS = ["fr", "l2", "l3", "ma", "os", "oc"];
  // Moyenne actuelle des notes annuelles dans les branches d'examen.
  function examAverage() {
    var t = 0, n = 0;
    EXAM_IDS.forEach(function (id) { var a = app().annualAvg(id); if (a != null) { t += a; n++; } });
    return n ? t / n : null;
  }
  /* Statut : on compare la note qu'il faudrait à toutes les épreuves restantes (m.x) à la moyenne actuelle.
     Vert si elle ne dépasse pas la moyenne ; orange jusqu'à 1 point au-dessus ; rouge au-delà. */
  function status(real, m) {
    if (real.complete) {
      return real.pass ? { cls: "t-good", label: "Maturité réussie", text: "Les trois conditions du certificat sont remplies." }
        : { cls: "t-crit", label: "Maturité non réussie", text: "Au moins une condition n'est pas remplie. Une session de rattrapage existe si l'échec vient seulement des examens." };
    }
    if (m.missing) return { cls: "t-none", label: "Certificat", text: "Il manque encore : " + m.missing.join(", ") + "." };
    if (m.x == null) return { cls: "t-crit", label: "Compliqué", text: "Même avec 6 à toutes les épreuves restantes, la maturité ne serait pas atteinte avec tes notes actuelles." };
    var avg = examAverage();
    if (avg == null) return { cls: "t-none", label: "Certificat", text: "Ajoute des notes dans tes branches d'examen pour voir où tu en es." };
    var gap = m.x - avg, hint = " Touche une branche d'examen pour voir la note minimale à viser.";
    if (gap <= 1e-9) return { cls: "t-good", label: "Bonne voie", text: "Tes moyennes actuelles te mettent en bonne voie pour réussir la maturité." + hint };
    if (gap <= 1 + 1e-9) return { cls: "t-warn", label: "Serré", text: "C'est possible, mais il te faudra des examens meilleurs que tes moyennes actuelles." + hint };
    return { cls: "t-crit", label: "Compliqué", text: "Il te faudrait des examens nettement meilleurs que tes moyennes actuelles." + hint };
  }
  // Bloc affiché dans le détail d'une branche (feuille qui s'ouvre en touchant la carte).
  function detail(id) {
    var pr = app() && app().profile();
    if (!pr || pr.year !== 3 || EXAM_IDS.indexOf(id) < 0) return "";
    var r = compute(null).rows.filter(function (x) { return x.id === id; })[0];
    if (!r) return "";
    var hasW = !!(r.w && r.w.real), hasO = !!(r.o && r.o.real), line;
    if (r.na == null) line = "Entre des notes de l'année dans cette branche pour calculer la note minimale à l'examen.";
    else if (r.oralOnly ? hasO : (hasW && hasO)) line = "Examen passé : note finale <b>" + fmt(r.final) + "</b>.";
    else {
      var need = needFor4(r), what = r.oralOnly ? "à l'oral" : hasW ? "à l'oral" : hasO ? "à l'écrit" : "à l'écrit et à l'oral";
      if (need == null) line = "Même avec 6 " + what + ", tu n'atteindrais pas 4 dans cette branche.";
      else if (need <= 1) line = "Tu as déjà <b>4</b> dans cette branche, quelle que soit la note de l'examen.";
      else line = "Pour avoir <b>4</b> dans cette branche, il te faut au moins <b>" + fmt(need) + "</b> " + what + ".";
    }
    return '<div class="cert-min"><h3 class="sec">Examen : note minimale</h3><p>' + line + '</p>' +
      '<span class="meta">Note annuelle ' + fmt(r.na) + ' · ' + (r.oralOnly ? "note finale = (annuelle + oral) / 2" : "note finale = (2 × annuelle + écrit + oral) / 4") + ', arrondie au demi-point</span></div>';
  }

  /* ---------- Affichage ---------- */
  var panel = null;
  function metric(label, val, unit, sub, ratio, cls, markAt, markLabel) {
    return '<div class="metric"><span class="lbl">' + label + '</span><span class="val">' + val + ' <small>' + unit + '</small></span>' +
      '<div class="bar ' + cls + '"><i style="width:' + Math.max(0, Math.min(100, ratio * 100)).toFixed(0) + '%"></i>' + (markAt != null ? '<b style="left:' + (markAt * 100).toFixed(1) + '%"></b>' : "") + '</div>' +
      (markAt != null ? '<div class="tick"><span style="left:' + (markAt * 100).toFixed(1) + '%">' + markLabel + '</span></div>' : "") + '<span class="sub">' + sub + '</span></div>';
  }
  function render() {
    var a = app(), pr = a && a.profile(), dash = document.getElementById("view-dash");
    if (!pr || pr.year !== 3) { if (panel) panel.hidden = true; return; }
    var real = compute(null), m = minimum(), promo = document.getElementById("promo");
    // Haut de l'écran : seulement le statut (la note minimale est dans le détail de chaque branche).
    var st = status(real, m);
    promo.innerHTML = '<div class="verdict"><span class="pill ' + st.cls + '">' + st.label + '</span><p>' + esc(st.text) + '</p></div>';

    if (!panel) {
      panel = document.createElement("section"); panel.className = "panel"; panel.id = "cert";
      promo.closest("section").after(panel);
      panel.addEventListener("change", function (e) {
        var t = e.target, v = t.value === "" ? null : num(t.value);
        if (t.dataset.exam) { var r = data.exams[t.dataset.exam] || (data.exams[t.dataset.exam] = {}); r[t.dataset.k] = v; }
        if (t.dataset.carried) data.carried[t.dataset.carried] = v;
        save(); a.redraw();
      });
    }
    panel.hidden = false;
    var rows = real.rows;
    function inp(attr, v) { return '<input type="number" inputmode="decimal" min="1" max="6" step="0.5" ' + attr + ' value="' + (v != null ? v : "") + '" placeholder="–">'; }
    panel.innerHTML = '<h2>Examens et notes de maturité</h2>' +
      '<p class="muted small" style="margin:-8px 0 14px">Entre tes notes d\'examen au fur et à mesure. Note finale = (2 × note annuelle + écrit + oral) / 4, arrondie au demi-point (OC : moyenne de l\'annuelle et de l\'oral).</p>' +
      '<div class="exam-list">' + rows.filter(function (r) { return r.exam; }).map(function (r) {
        var e = data.exams[r.id] || {};
        return '<div class="exam-row"><div class="exam-head"><b>' + esc(r.name) + '</b><span class="muted small">' + "" + '</span></div><div class="exam-fields">' +
          (r.oralOnly ? '<div class="exam-out"><span class="muted small">—</span></div>' : '<label>Écrit' + inp('data-exam="' + r.id + '" data-k="w"', e.w) + '</label>') +
          '<label>Oral' + inp('data-exam="' + r.id + '" data-k="o"', e.o) + '</label>' +
          '<div class="exam-out"><span class="muted small">Annuelle</span><span class="mono">' + fmt(r.na) + '</span></div>' +
          '<div class="exam-out"><span class="muted small">Note finale</span><span class="mono exam-final ' + (r.final != null && r.final < 4 ? "crit" : "") + '">' + fmt(r.final) + '</span></div>' +
          '</div></div>';
      }).join("") + '</div>' +
      '<h3 class="sec" style="margin:18px 0 8px">Notes reprises de 2e</h3><div class="exam-list"><div class="exam-row"><div class="exam-fields">' +
      CARRIED.map(function (c) {
        var r = rows.filter(function (x) { return x.id === c[0]; })[0];
        var field = '<input type="number" inputmode="decimal" min="1" max="6" step="0.5" data-carried="' + c[0] + '" value="' + (data.carried[c[0]] != null ? data.carried[c[0]] : "") + '" placeholder="' + (r.auto != null ? fmt(r.auto) : "–") + '">';
        return '<label>' + esc(r.name) + field + '<span class="muted small">' + (r.src === "saisie" ? "saisie à la main" : r.src === "auto" ? "d\'après tes notes de 2e" : "à saisir") + '</span></label>';
      }).join("") +
      '</div><p class="muted small" style="margin:4px 0 0">Chimie, physique et ' + (pr && pr.art === "mu" ? "musique" : "arts visuels") + ' ne sont plus enseignées en 3e : leur note de maturité est la note annuelle de 2e. L\'app la reprend de tes notes de 2e ; entre-la à la main si elle est différente sur ton bulletin (efface le champ pour revenir au calcul).</p></div></div>' +
      '<h3 class="sec" style="margin:18px 0 8px">Les 14 notes de maturité</h3><ul class="cert-list">' + rows.map(function (r) {
        return '<li><span>' + esc(r.name) + (r.carried ? ' <span class="muted small">(2e)</span>' : "") + '</span><span class="mono ' + (r.final != null && r.final < 4 ? "crit" : "") + '">' + fmt(r.final) + '</span></li>';
      }).join("") + '</ul>' +
      '<p class="muted small" style="margin:12px 0 0">Sans examen, la note de maturité est la note annuelle. Le travail de maturité se saisit comme une note de la discipline « Travail de maturité ». Règles : REM art. 17-20 ; en cas de doute, ton gymnase fait foi.</p>';
  }

  window.Cert = { render: render, reload: function () { data = load(); }, compute: compute, minimum: minimum, detail: detail };
  try { render(); } catch (e) {}
})();
