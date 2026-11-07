/* Notes — certificat de maturité en 3e année (REM art. 17-20, BLV 412.12.1 ; vade-mecum GAP 2024-25).
   14 notes de maturité. Disciplines d'examen : note = (2 × note annuelle + écrit + oral) / 4 (OC : (annuelle + oral) / 2),
   arrondie au demi-point. Réussite : (a) total des 14 notes avec double compensation ≥ 56 ; (b) au plus 4 notes < 4 ;
   (c) total des 11 notes d'examen ≥ 38,5.
   Présentation : le tableau de bord est le même qu'en 2e (en-tête à trois jauges, cartes, graphiques). Les notes d'examen
   et la note minimale se saisissent dans le détail de chaque branche ; les notes de 2e reprises dans Réglages. */
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
  function app() { return window.NotesApp; }

  var EXAM = ["fr", "l2", "l3", "ma", "os"];            // écrit + oral
  var EXAM_IDS = EXAM.concat(["oc"]);                   // + OC : oral seulement
  var CARRIED = [["ch", "Chimie"], ["ph", "Physique"], ["art", null]]; // notes de 2e reprises
  function artName() { var pr = app() && app().profile(); return pr && pr.art === "mu" ? "Musique" : "Arts visuels"; }
  function carriedName(c) { return c[1] || artName(); }
  function isCarried(id) { return CARRIED.some(function (c) { return c[0] === id; }); }

  /* Note de 2e reprise : saisie à la main (Réglages) sinon calculée d'après les notes de 2e classées. */
  function autoCarried(id) { return app() && app().storedAvg ? app().storedAvg(id, id === "art" ? 0 : 0.25) : null; }
  function carriedInfo(id) {
    var v = num(data.carried[id]);
    if (v != null) return { v: v, src: "saisie" };
    var a = autoCarried(id);
    return a != null ? { v: a, src: "auto" } : { v: null, src: null };
  }

  /* Les 14 notes de maturité. x : null = seulement les examens saisis ; nombre = note hypothétique pour chaque épreuve
     restante ; "now" = chaque épreuve restante vaut la note annuelle de sa branche (« au rythme actuel »). */
  function compute(x) {
    var subs = app().subjectsAll(), rows = [], examNotes = [], real = 0, missing = [];
    function na(id) { var a = app().annualAvg(id); return a == null ? null : half(a); }
    function ex(id, k, n) {
      var e = data.exams[id] || {}, v = num(e[k]);
      if (v != null) { real++; return { v: v, real: true }; }
      if (x === "now") return n != null ? { v: n, real: false } : null;
      return typeof x === "number" ? { v: x, real: false } : null;
    }
    EXAM.forEach(function (id) {
      var s = subs.filter(function (z) { return z.id === id; })[0]; if (!s) return;
      var n = na(id), w = ex(id, "w", n), o = ex(id, "o", n);
      if (w) examNotes.push(w.v); if (o) examNotes.push(o.v);
      if (n == null) missing.push(s.name);
      rows.push({ id: id, name: s.name, na: n, w: w, o: o, final: n != null && w && o ? half((2 * n + w.v + o.v) / 4) : null, exam: true });
    });
    var oc = subs.filter(function (z) { return z.id === "oc"; })[0];
    if (oc) {
      var n2 = na("oc"), o2 = ex("oc", "o", n2);
      if (o2) examNotes.push(o2.v);
      if (n2 == null) missing.push(oc.name);
      rows.push({ id: "oc", name: oc.name, na: n2, o: o2, final: n2 != null && o2 ? half((n2 + o2.v) / 2) : null, exam: true, oralOnly: true });
    }
    ["bi", "hi", "ge", "phi", "tm"].forEach(function (id) {
      var s = subs.filter(function (z) { return z.id === id; })[0]; if (!s) return;
      var n = na(id); if (n == null) missing.push(s.name);
      rows.push({ id: id, name: s.name, na: n, final: n });
    });
    CARRIED.forEach(function (c) {
      var info = carriedInfo(c[0]), name = carriedName(c);
      if (info.v == null) missing.push(name + " (note de 2e)");
      rows.push({ id: c[0], name: name, final: info.v != null ? half(info.v) : null, carried: true, src: info.src });
    });
    var done = rows.every(function (r) { return r.final != null; });
    var total = 0, dc = 0, fails = 0, rated = 0;
    rows.forEach(function (r) { if (r.final == null) return; rated++; total += r.final; if (r.final < 4) { dc += 4 - r.final; fails++; } });
    var examTotal = examNotes.reduce(function (a, b) { return a + b; }, 0), nExam = EXAM.length * 2 + (oc ? 1 : 0);
    var complete = done && examNotes.length === nExam;
    return { rows: rows, complete: complete, total: total, score: total - dc, fails: fails, rated: rated, expected: rows.length,
      examTotal: examTotal, nExamNotes: examNotes.length, realExams: real, nExam: nExam, missing: missing,
      pass: complete && total - dc >= 56 - 1e-9 && fails <= 4 && examTotal >= 38.5 - 1e-9 };
  }
  // Plus petite note (demi-point) à obtenir à chaque épreuve restante pour réussir.
  function minimum() {
    for (var x = 1; x <= 6.0001; x += 0.5) { var r = compute(x); if (r.missing.length) return { missing: r.missing }; if (r.pass) return { x: x, r: r }; }
    return { x: null };
  }
  // Note minimale à l'examen d'une branche pour avoir 4 dans la branche (compte tenu des épreuves déjà passées).
  function needFor4(r) {
    if (r.na == null) return null;
    for (var e = 1; e <= 6.0001; e += 0.5) {
      var w = r.w && r.w.real ? r.w.v : e, o = r.o && r.o.real ? r.o.v : e;
      var f = r.oralOnly ? half((r.na + o) / 2) : half((2 * r.na + w + o) / 4);
      if (f >= 4) return e;
    }
    return null;
  }

  /* Statut : on compare la note qu'il faudrait à toutes les épreuves restantes à la moyenne actuelle des branches d'examen.
     Vert si elle ne dépasse pas la moyenne ; orange jusqu'à 1 point au-dessus ; rouge au-delà. */
  function examAverage() {
    var t = 0, n = 0;
    EXAM_IDS.forEach(function (id) { var a = app().annualAvg(id); if (a != null) { t += a; n++; } });
    return n ? t / n : null;
  }
  function status(real, m) {
    if (real.complete) {
      return real.pass ? { cls: "t-good", label: "Maturité réussie", text: "Les trois conditions du certificat sont remplies." }
        : { cls: "t-crit", label: "Maturité non réussie", text: "Au moins une condition n'est pas remplie. Une session de rattrapage existe si l'échec vient seulement des examens." };
    }
    if (m.missing) return { cls: "t-none", label: "Certificat", text: "Il manque encore : " + m.missing.join(", ") + "." };
    if (m.x == null) return { cls: "t-crit", label: "Compliqué", text: "Même avec 6 à toutes les épreuves restantes, la maturité ne serait pas atteinte avec tes notes actuelles." };
    var avg = examAverage();
    if (avg == null) return { cls: "t-none", label: "Certificat", text: "Ajoute des notes dans tes branches d'examen pour voir où tu en es." };
    var gap = m.x - avg, hint = " Touche une branche d'examen pour saisir tes examens et voir la note minimale à viser.";
    if (gap <= 1e-9) return { cls: "t-good", label: "Bonne voie", text: "Tes moyennes actuelles te mettent en bonne voie pour réussir la maturité." + hint };
    if (gap <= 1 + 1e-9) return { cls: "t-warn", label: "Serré", text: "C'est possible, mais il te faudra des examens meilleurs que tes moyennes actuelles." + hint };
    return { cls: "t-crit", label: "Compliqué", text: "Il te faudrait des examens nettement meilleurs que tes moyennes actuelles." + hint };
  }

  /* ---------- En-tête (même présentation qu'en 2e : pastille + trois jauges) ---------- */
  function metric(label, val, unit, sub, ratio, cls, markAt, markLabel) {
    return '<div class="metric"><span class="lbl">' + label + '</span><span class="val">' + val + ' <small>' + unit + '</small></span>' +
      '<div class="bar ' + cls + '"><i style="width:' + Math.max(0, Math.min(100, ratio * 100)).toFixed(0) + '%"></i>' + (markAt != null ? '<b style="left:' + (markAt * 100).toFixed(1) + '%"></b>' : "") + '</div>' +
      (markAt != null ? '<div class="tick"><span style="left:' + (markAt * 100).toFixed(1) + '%">' + markLabel + '</span></div>' : "") + '<span class="sub">' + sub + '</span></div>';
  }
  function delta(d, ref) { return (d >= 0 ? "+" : "−") + Math.abs(d).toFixed(1) + " pt par rapport à " + ref; }
  function render() {
    var a = app(), pr = a && a.profile();
    mountCarried(pr);
    var promo = document.getElementById("promo");
    if (!pr || pr.year !== 3 || !promo) return;
    var real = compute(null), now = compute("now"), m = minimum(), st = status(real, m), s = real.complete ? real : now;
    var partial = !real.complete, g1, g2;
    if (s.rated) {
      var d1 = s.score - 4 * s.rated;
      g1 = metric("Total des notes (double compensation)", fmt(s.score), "/ " + 6 * s.expected,
        (s.rated < s.expected ? "au rythme actuel : " : "") + delta(d1, (4 * s.rated) + "") + " (" + s.rated + " / " + s.expected + " notes)",
        s.score / (6 * s.expected), d1 < 0 ? "crit" : d1 < 2 ? "warn" : "", 4 / 6, 4 * s.expected + " min");
    } else g1 = metric("Total des notes (double compensation)", "–", "/ " + 6 * s.expected, "aucune note", 0, "", 4 / 6, 4 * s.expected + " min");
    if (s.nExamNotes) {
      var ref = 3.5 * s.nExamNotes, d2 = s.examTotal - ref;
      g2 = metric("Total des examens", fmt(s.examTotal), "/ " + 6 * s.nExam,
        (partial ? "au rythme actuel : " : "") + delta(d2, String(ref).replace(/\.0$/, "")) + " (" + s.realExams + " épreuve" + (s.realExams > 1 ? "s" : "") + " passée" + (s.realExams > 1 ? "s" : "") + " sur " + s.nExam + ")",
        s.examTotal / (6 * s.nExam), d2 < 0 ? "crit" : d2 < 2 ? "warn" : "", 38.5 / (6 * s.nExam), "38,5 min");
    } else g2 = metric("Total des examens", "–", "/ " + 6 * s.nExam, "aucune épreuve", 0, "", 38.5 / (6 * s.nExam), "38,5 min");
    var g3 = metric("Notes inférieures à 4", String(s.fails), "/ 4 max", s.fails > 4 ? "trop de notes insuffisantes" : (4 - s.fails) + " en réserve", s.fails / 5, s.fails > 4 ? "crit" : s.fails === 4 ? "warn" : "");
    promo.innerHTML = '<div class="verdict"><span class="pill ' + st.cls + '">' + st.label + '</span><p>' + esc(st.text) + '</p></div><div class="metrics">' + g1 + g2 + g3 + '</div>';
  }

  /* ---------- Détail d'une branche (feuille qui s'ouvre en touchant la carte) ---------- */
  function inp(attr, v) { return '<input type="number" inputmode="decimal" min="1" max="6" step="0.5" ' + attr + ' value="' + (v != null ? v : "") + '" placeholder="–">'; }
  function detail(id) {
    var pr = app() && app().profile();
    if (!pr || pr.year !== 3) return "";
    if (isCarried(id)) {
      var info = carriedInfo(id), tail = "Cette branche n'est plus enseignée en 3e : pour corriger la note, va dans <b>Réglages → Notes reprises de 2e</b>.";
      var line = info.v == null ? "Aucune note de 2e trouvée pour cette branche. Entre-la dans Réglages → Notes reprises de 2e."
        : "Ta note de maturité : <b>" + fmt(half(info.v)) + "</b> " + (info.src === "auto" ? "(calculée d'après tes notes de 2e, moyenne exacte " + info.v.toFixed(2) + ")." : "(saisie à la main).");
      return '<div class="cert-min"><h3 class="sec">Note de 2e reprise</h3><p>' + line + '</p><span class="meta">' + tail + '</span></div>';
    }
    if (EXAM_IDS.indexOf(id) < 0) return "";
    var r = compute(null).rows.filter(function (x) { return x.id === id; })[0];
    if (!r) return "";
    var e = data.exams[id] || {}, hasW = !!(r.w && r.w.real), hasO = !!(r.o && r.o.real), line2;
    if (r.na == null) line2 = "Entre des notes de l'année dans cette branche pour calculer la note minimale à l'examen.";
    else if (r.oralOnly ? hasO : (hasW && hasO)) line2 = "Examen passé : note finale <b>" + fmt(r.final) + "</b>.";
    else {
      var need = needFor4(r), what = r.oralOnly ? "à l'oral" : hasW ? "à l'oral" : hasO ? "à l'écrit" : "à l'écrit et à l'oral";
      if (need == null) line2 = "Même avec 6 " + what + ", tu n'atteindrais pas 4 dans cette branche.";
      else if (need <= 1) line2 = "Tu as déjà <b>4</b> dans cette branche, quelle que soit la note de l'examen.";
      else line2 = "Pour avoir <b>4</b> dans cette branche, il te faut au moins <b>" + fmt(need) + "</b> " + what + ".";
    }
    return '<div class="cert-min"><h3 class="sec">Examen</h3><div class="exam-fields">' +
      (r.oralOnly ? "" : '<label>Écrit' + inp('data-exam="' + id + '" data-k="w"', e.w) + '</label>') +
      '<label>Oral' + inp('data-exam="' + id + '" data-k="o"', e.o) + '</label>' +
      '<div class="exam-out"><span class="muted small">Annuelle</span><span class="mono">' + fmt(r.na) + '</span></div>' +
      '<div class="exam-out"><span class="muted small">Note finale</span><span class="mono exam-final ' + (r.final != null && r.final < 4 ? "crit" : "") + '">' + fmt(r.final) + '</span></div></div>' +
      '<p>' + line2 + '</p><span class="meta">' + (r.oralOnly ? "Note finale = (annuelle + oral) / 2" : "Note finale = (2 × annuelle + écrit + oral) / 4") + ', arrondie au demi-point.</span></div>';
  }
  // Saisie des examens depuis la feuille de détail.
  document.addEventListener("change", function (e) {
    var t = e.target; if (!t.dataset || !t.dataset.exam) return;
    var r = data.exams[t.dataset.exam] || (data.exams[t.dataset.exam] = {});
    r[t.dataset.k] = t.value === "" ? null : num(t.value);
    save(); app().redraw();
  });

  /* ---------- Réglages : notes reprises de 2e ---------- */
  function mountCarried(pr) {
    var host = document.getElementById("set-block"); if (!host) return;
    var d = document.getElementById("carriedset");
    if (!pr || pr.year !== 3) { if (d) d.hidden = true; return; }
    if (!d) {
      d = document.createElement("div"); d.className = "backup"; d.id = "carriedset";
      var anchor = document.getElementById("yearpass") || (document.getElementById("ob-edit") && document.getElementById("ob-edit").closest(".backup"));
      if (anchor) anchor.after(d); else host.insertBefore(d, host.firstChild);
      d.addEventListener("change", function (e) {
        var t = e.target; if (!t.dataset || !t.dataset.carried) return;
        data.carried[t.dataset.carried] = t.value === "" ? null : num(t.value);
        save(); app().redraw();
      });
    }
    d.hidden = false;
    var html = '<h3>Notes reprises de 2e</h3><p class="muted small">Chimie, physique et ' + esc(artName().toLowerCase()) + ' ne sont plus enseignées en 3e : leur note de maturité est ta note annuelle de 2e. L\'app la calcule d\'après tes notes de 2e classées ; entre-la ici si ton bulletin dit autre chose. Champ vide = calcul automatique.</p>' +
      CARRIED.map(function (c) {
        var auto = autoCarried(c[0]), man = num(data.carried[c[0]]);
        return '<label class="row">' + esc(carriedName(c)) + '<input type="number" inputmode="decimal" min="1" max="6" step="0.5" data-carried="' + c[0] + '" value="' + (man != null ? man : "") + '" placeholder="' + (auto != null ? fmt(half(auto)) + " (auto)" : "–") + '" style="width:110px;text-align:right"></label>';
      }).join("");
    if (d._html !== html) { d.innerHTML = html; d._html = html; }
  }

  window.Cert = { render: render, reload: function () { data = load(); }, compute: compute, minimum: minimum, detail: detail, carriedValue: function (id) { return carriedInfo(id).v; } };
  // Le tableau de bord a déjà été dessiné une fois avant ce script : on le redessine pour y mettre les notes reprises.
  try { var pr0 = app().profile(); if (pr0 && pr0.year === 3) app().redraw(); } catch (e) {}
})();
