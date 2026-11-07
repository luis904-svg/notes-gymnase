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
    // Verdict en haut (remplace « Promotion »)
    var pill, text;
    if (real.complete) { pill = real.pass ? ["t-good", "Maturité réussie"] : ["t-crit", "Conditions non remplies"]; text = real.pass ? "Les trois conditions du certificat sont remplies." : "Au moins une condition n'est pas remplie. Une session de rattrapage existe si l'échec vient seulement des examens."; }
    else if (m.missing) { pill = ["t-none", "Certificat"]; text = "Il manque encore : " + m.missing.join(", ") + "."; }
    else if (m.x == null) { pill = ["t-crit", "Très difficile"]; text = "Même avec 6 à toutes les épreuves restantes, les conditions ne seraient pas remplies avec les notes actuelles."; }
    else { pill = [m.x <= 4 ? "t-good" : m.x <= 5 ? "t-warn" : "t-crit", "Il te faut " + fmt(m.x) + " aux examens"]; text = "Avec tes notes actuelles, il te faut au moins " + fmt(m.x) + " à chaque épreuve encore à passer pour obtenir la maturité" + (m.x <= 1 ? " (les épreuves ne sont plus décisives)" : "") + "."; }
    var show = real.complete ? real : (m.r || real);
    var tag = real.complete ? "" : " (avec " + (m.x != null ? fmt(m.x) : "?") + " aux examens restants)";
    promo.innerHTML = '<div class="verdict"><span class="pill ' + pill[0] + '">' + pill[1] + '</span><p>' + esc(text) + '</p></div><div class="metrics">' +
      metric("Total avec double compensation" + tag, fmt(show.score), "/ 84", "chaque point manquant sous 4 compte double · seuil 56", show.score / 84, show.score < 56 ? "crit" : show.score < 58 ? "warn" : "", 56 / 84, "56 min") +
      metric("Notes inférieures à 4", String(show.fails), "/ 4 max", show.fails > 4 ? "trop de notes insuffisantes" : (4 - show.fails) + " en réserve", show.fails / 5, show.fails > 4 ? "crit" : show.fails === 4 ? "warn" : "") +
      metric("Total des examens" + tag, fmt(show.examTotal), "/ " + show.nExam * 6, show.nExam + " épreuves · seuil 38,5", show.examTotal / (show.nExam * 6), show.examTotal < 38.5 ? "crit" : show.examTotal < 40.5 ? "warn" : "", 38.5 / (show.nExam * 6), "38,5 min") +
      '</div>';

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
        var e = data.exams[r.id] || {}, need = needFor4(r);
        return '<div class="exam-row"><div class="exam-head"><b>' + esc(r.name) + '</b><span class="muted small">' + (need != null ? "au moins " + fmt(need) + " " + (r.oralOnly ? "à l'oral" : "à l'écrit et à l'oral") + " pour 4" : "") + '</span></div><div class="exam-fields">' +
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

  window.Cert = { render: render, reload: function () { data = load(); }, compute: compute, minimum: minimum };
  try { render(); } catch (e) {}
})();
