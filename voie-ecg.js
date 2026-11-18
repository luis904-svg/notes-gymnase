/* Notes — voie « Culture générale » (École de culture générale vaudoise, ECG), chargée seulement si l'élève l'a choisie.
   Règles : RECG (BLV 413.05.1, version du 01.08.2025) art. 8-10, 13, 19 ; DRECG 8.1 (arrondi), 9.1 (nombre de notes) ;
   plan d'études ECG 2024 (grilles horaires) ; listes de notes du bulletin : vade-mecum 1C/2C/3C du Gymnase de Burier (mars 2026).
   Recherches : reports/Écoles commerce et culture générale Vaud.md. Ce module ne fait que décrire la voie : le moteur
   (index.html) calcule les moyennes et appelle rules.evaluate / rules.tight / rules.metrics, Grid.build, etc. */
(function () {
  "use strict";
  var G = window.Grid; if (!G) return;
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function find(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }

  /* ---------- Choix du profil ---------- */
  var L2 = [
    { id: "de", name: "Allemand", short: "All." },
    { id: "it", name: "Italien", short: "Ital." }
  ];
  var DOMAINES = [
    { id: "sante", name: "Santé" },
    { id: "social", name: "Travail social" },
    { id: "peda", name: "Pédagogie", sub: "allemand obligatoire" },
    { id: "com", name: "Communication et information" },
    { id: "arts", name: "Arts et design" },
    { id: "musique", name: "Musique" }
  ];
  var ART = [{ id: "av", name: "Arts visuels", short: "AV" }, { id: "mu", name: "Musique", short: "Mus." }];
  // Domaines que le vade-mecum ou la brochure d'un gymnase dit ne pas offrir (indicatif : le choix reste possible).
  var DOMAINES_WARN = {
    burier: { musique: "D'après le vade-mecum de Burier, la musique n'y est pas offerte." },
    gyb: { com: "La Broye n'offre que santé, travail social et pédagogie.", arts: "La Broye n'offre que santé, travail social et pédagogie.", musique: "La Broye n'offre que santé, travail social et pédagogie." }
  };
  function domName(id) { var d = find(DOMAINES, id); return d ? d.name : ""; }

  /* ---------- Grille : les branches de l'année ----------
     Chaque entrée est une « note de bulletin ». Une discipline intégrée (RECG art. 10) est une note composée : ses composantes
     sont des branches `part`, la moyenne de la note est celle des composantes non arrondies, pondérée par leurs périodes.
     La part des TP est déduite des périodes de TP de la grille (0,5 période) : le canton n'en fixe pas, elle se règle dans Réglages. */
  function tpShare(tp, per) { return tp && per ? Math.round(tp / per * 100) / 100 : 0; }
  function build(p) {
    var y = Math.min(3, Math.max(1, p.year | 0)), dom = y > 1 && find(DOMAINES, p.domaine) ? p.domaine : null, out = [];
    var l2 = find(L2, p.l2) || L2[0], art = find(ART, p.art) || ART[0];
    function add(o) { if (!o.periods && !o.carried) return null; if (o.counts === undefined) o.counts = true; out.push(o); return o; }
    // parts : [id, nom, abrégé, périodes, périodes de TP]
    function group(id, name, short, parts, o) {
      var tot = 0; parts.forEach(function (c) { tot += c[3]; });
      add(Object.assign({ id: id, name: name, short: short, periods: tot, parts: parts.map(function (c) { return c[0]; }) }, o || {}));
      parts.forEach(function (c) { out.push({ id: c[0], name: c[1], short: c[2], periods: c[3], part: true, hasTP: !!c[4], tpShare: tpShare(c[4], c[3]) }); });
    }
    function tp(id, name, short, per, tpPer, o) { return add(Object.assign({ id: id, name: name, short: short, periods: per, hasTP: !!tpPer, tpShare: tpShare(tpPer, per) }, o || {})); }
    var Y = y - 1;
    add({ id: "fr", name: "Français", short: "Fr." , periods: [5, 5, 5][Y] });
    add({ id: "l2", name: l2.name + " (L2)", short: l2.short, periods: [4, 4, 3][Y] });
    add({ id: "l3", name: "Anglais (L3)", short: "Angl.", periods: [4, 4, 3][Y] });
    add({ id: "ma", name: "Mathématiques", short: "Maths", periods: [4, 3, 3][Y] });
    if (y < 3) add({ id: "info", name: "Informatique", short: "Info.", periods: 1 });
    if (y === 1) {
      group("sx", "Sciences expérimentales", "Sc. exp.", [["bi", "Biologie", "Bio.", 1.5, 0.5], ["ch", "Chimie", "Chim.", 1.5, 0.5], ["ph", "Physique", "Phys.", 1.5, 0.5]]);
      group("sh", "Sciences humaines", "Sc. hum.", [["hi", "Histoire", "Hist.", 2], ["ge", "Géographie", "Géo.", 2]]);
      add({ id: "ed", name: "Économie et droit", short: "É&D", periods: 3 });
      group("art", "Disciplines artistiques", "Arts", [["av", "Arts visuels", "AV", 1], ["mu", "Musique", "Mus.", 1]]);
      add({ id: "sport", name: "Sport", short: "Sport", periods: 3, counts: false });
      return out;
    }
    if (y === 2) {
      group("sh", "Sciences humaines", "Sc. hum.", [["hi", "Histoire", "Hist.", 2], ["ge", "Géographie", "Géo.", 2]]);
      add({ id: "sport", name: "Sport (théories du sport et santé)", short: "Sport", periods: 1 });
      second(dom, art, group, add, tp);
      return out;
    }
    third(dom, art, group, add, tp);
    return out;
  }
  // Notes propres au domaine, 2e année (vade-mecum Burier 2C ; grilles du plan d'études 2024).
  function second(dom, art, group, add, tp) {
    if (dom === "sante") {
      add({ id: "mo", name: "Mathématiques (option)", short: "Maths opt.", periods: 2 });
      tp("bi", "Biologie", "Bio.", 2.5, 0.5); tp("ch", "Chimie", "Chim.", 2.5, 0.5); tp("ph", "Physique", "Phys.", 2.5, 0.5);
    } else if (dom === "social") {
      add({ id: "ed", name: "Économie et droit", short: "É&D", periods: 2 });
      group("ss", "Sciences sociales", "Sc. soc.", [["phi", "Philosophie", "Philo", 2], ["psy", "Psychologie", "Psy.", 2], ["soc", "Sociologie", "Socio.", 2]]);
      add({ id: "art", name: art.name, short: art.short, periods: 2 });
    } else if (dom === "peda") {
      group("sx", "Sciences expérimentales", "Sc. exp.", [["bi", "Biologie", "Bio.", 1, 0.5], ["ch", "Chimie", "Chim.", 1, 0.5], ["ph", "Physique", "Phys.", 1, 0.5]]);
      add({ id: "phi", name: "Philosophie", short: "Philo", periods: 2 });
      add({ id: "psy", name: "Psychologie", short: "Psy.", periods: 2 });
      add({ id: "art", name: "Arts visuels", short: "AV", periods: 3 });
    } else if (dom === "com") {
      group("lo", "Langues (option)", "Lang. opt.", [["l2o", "L2 (option)", "L2 opt.", 1.5], ["l3o", "L3 (option)", "L3 opt.", 1.5]]);
      add({ id: "io", name: "Informatique (option)", short: "Info. opt.", periods: 1 });
      group("sho", "Sciences humaines (option)", "Sc. hum. opt.", [["ed", "Économie et droit", "É&D", 2], ["soc", "Sociologie", "Socio.", 2]]);
      add({ id: "har", name: "Histoire de l'art", short: "Hist. art", periods: 2 });
    } else if (dom === "arts" || dom === "musique") {
      add({ id: "phi", name: "Philosophie", short: "Philo", periods: 2 });
      add({ id: "atel", name: dom === "arts" ? "Arts visuels (atelier)" : "Musique (atelier)", short: dom === "arts" ? "AV atelier" : "Mus. atelier", periods: 6 });
      group("ham", "Histoire de l'art et de la musique", "Hist. art-mus.", [["har", "Histoire de l'art", "Hist. art", 1], ["hmu", "Histoire de la musique", "Hist. mus.", 1]]);
    }
  }
  // 3e année : les 11 ou 12 notes du certificat (DRECG 18.2, version du 29.06.2026), grilles du plan d'études 2024.
  // Le sport et l'informatique du tronc commun sont suivis mais ne comptent pas (sauf l'informatique « option » de Communication et information).
  // Une discipline qui n'est plus enseignée en 3e garde la note de sa dernière année (RECG art. 18 al. 2) : branche `carried`, reprise de la 1re année.
  function carried(id, name, short) { return { id: id, name: name, short: short, periods: 0, counts: true, carried: true, tpShare: 0 }; }
  function third(dom, art, group, add, tp) {
    add({ id: "hi", name: "Histoire", short: "Hist.", periods: 3 });
    add({ id: "tpl", name: "Travail personnel (TPL)", short: "TPL", periods: 1 });
    if (dom === "sante") {
      add({ id: "mo", name: "Mathématiques (option)", short: "Maths opt.", periods: 2 });
      tp("bi", "Biologie", "Bio.", 2.5, 0.5); tp("ch", "Chimie", "Chim.", 2.5, 0.5); tp("ph", "Physique", "Phys.", 2.5, 0.5);
      group("ss", "Sciences sociales", "Sc. soc.", [["psy", "Psychologie", "Psy.", 1.5], ["phi", "Philosophie", "Philo", 1.5]]);
      add(carried("art", "Arts visuels et musique", "AV-Mus."));
    } else if (dom === "social") {
      add({ id: "ed", name: "Économie et droit", short: "É&D", periods: 2 });
      add({ id: "ge", name: "Géographie", short: "Géo.", periods: 2 });
      group("ss", "Sciences sociales", "Sc. soc.", [["phi", "Philosophie", "Philo", 2], ["psy", "Psychologie", "Psy.", 2], ["soc", "Sociologie", "Socio.", 2]]);
      add({ id: "art", name: art.name, short: art.short, periods: 2 });
      add(carried("sx", "Sciences expérimentales", "Sc. exp."));
    } else if (dom === "peda") {
      group("sx", "Sciences expérimentales", "Sc. exp.", [["bi", "Biologie", "Bio.", 1, 0.5], ["ch", "Chimie", "Chim.", 1, 0.5], ["ph", "Physique", "Phys.", 1, 0.5]]);
      add({ id: "ge", name: "Géographie", short: "Géo.", periods: 2 });
      add({ id: "phi", name: "Philosophie", short: "Philo", periods: 2 });
      add({ id: "psy", name: "Psychologie", short: "Psy.", periods: 2 });
      add({ id: "art", name: "Musique", short: "Mus.", periods: 3 });
    } else if (dom === "com") {
      group("lo", "Langues (option)", "Lang. opt.", [["l2o", "L2 (option)", "L2 opt.", 1.5], ["l3o", "L3 (option)", "L3 opt.", 1.5]]);
      add({ id: "mo", name: "Mathématiques (option)", short: "Maths opt.", periods: 2 });
      add({ id: "io", name: "Informatique (option)", short: "Info. opt.", periods: 1 });
      group("sho", "Sciences humaines (option)", "Sc. hum. opt.", [["ge", "Géographie", "Géo.", 2], ["ed", "Économie et droit", "É&D", 2]]);
      add({ id: "art", name: "Arts visuels", short: "AV", periods: 2 });
      add(carried("sx", "Sciences expérimentales", "Sc. exp."));
    } else if (dom === "arts" || dom === "musique") {
      add({ id: "phi", name: "Philosophie", short: "Philo", periods: 2 });
      add({ id: "soc", name: "Sociologie", short: "Socio.", periods: 2 });
      add({ id: "atel", name: dom === "arts" ? "Arts visuels (atelier)" : "Musique (atelier)", short: dom === "arts" ? "AV atelier" : "Mus. atelier", periods: 6 });
      if (dom === "arts") add({ id: "har", name: "Histoire de l'art", short: "Hist. art", periods: 2 });
      else add({ id: "hmu", name: "Histoire de la musique", short: "Hist. mus.", periods: 2 });
      add(carried("sx", "Sciences expérimentales", "Sc. exp."));
    }
    add({ id: "info", name: "Informatique", short: "Info.", periods: 1, counts: false });
    add({ id: "sport", name: "Sport", short: "Sport", periods: 3, counts: false });
  }

  /* ---------- Règles de verdict (RECG art. 13 et 19) ---------- */
  var rules = {
    // c : { rows, have, bm, total, nb, ins } fournis par le moteur ; on ajoute les écarts sous 4 et les conditions de l'ECG.
    evaluate: function (c) {
      var def = 0;
      c.have.forEach(function (s) { if (c.bm[s.id] < 4) def += 4 - c.bm[s.id]; });
      var fails = [];
      if (c.nb && c.total < 4 * c.nb - 1e-9) fails.push("total");
      if (def > 2 + 1e-9) fails.push("def");
      if (c.ins > 3) fails.push("ins");
      return { total: c.total, nb: c.nb, ins: c.ins, gp: null, def: def, fails: fails, bm: c.bm };
    },
    tight: function (r) { return (r.total - 4 * r.nb < 2) || r.def >= 1.5 || r.ins === 3; },
    metrics: function (r, metric, mTotal) {
      var d = r.def, ins = r.ins;
      var mDef = metric("Écarts sous 4", d.toFixed(1), "/ 2 max", d > 2 ? "dépasse de " + (d - 2).toFixed(1) + " pt" : d === 0 ? "aucune note sous 4" : (2 - d).toFixed(1) + " pt de marge", d / 4, d > 2 ? "crit" : d >= 1.5 ? "warn" : "", { at: 0.5, label: "2 max" });
      var mIns = metric("Notes inférieures à 4", String(ins), "/ 3 max", ins > 3 ? "trop de notes insuffisantes" : (3 - ins) + " en réserve", ins / 4, ins > 3 ? "crit" : ins === 3 ? "warn" : "");
      return mTotal + mDef + mIns;
    }
  };

  /* ---------- Textes ---------- */
  function rulesHtml(pr) {
    var n = { 1: "9 notes, 36 points", 2: { sante: "11 notes, 44 points", peda: "11 notes, 44 points", com: "11 notes, 44 points" } }[pr.year];
    var nn = pr.year === 1 ? n : pr.year === 2 ? (n[pr.domaine] || "10 notes, 40 points") : "11 ou 12 notes, 44 ou 48 points";
    return {
      html: '<div><h3>Moyenne d\'une branche</h3><ul>' +
        '<li>Moyenne pondérée de toutes les notes depuis septembre : Σ(note × coef) ÷ Σ coef. L\'année est cumulative, pas une moyenne de deux semestres.</li>' +
        '<li>Arrondi au demi-point le plus proche, au demi-point supérieur en cas d\'égalité : 4.24 donne 4, 4.25 donne 4.5, 4.75 donne 5.</li>' +
        '<li>Discipline intégrée (sciences expérimentales, sciences humaines…) : moyenne non arrondie des composantes, pondérée par leurs périodes, puis arrondie une seule fois.</li>' +
        '<li>TP : leur part est déduite des périodes de TP de la grille. Le canton n\'en fixe pas : tu peux la corriger dans Réglages.</li>' +
        '<li>Nombre minimum de notes par branche : périodes par semaine + 1 (arrondi à l\'entier supérieur).</li></ul></div>' +
        '<div><h3>' + (pr.year === 3 ? "Certificat ECG, 3e année" : "Promotion de " + pr.year + (pr.year === 1 ? "re" : "e") + " année") + '</h3><ul>' +
        '<li>Total des notes de bulletin d\'au moins 4 × le nombre de notes (' + nn + ').</li>' +
        '<li>Somme des écarts sous 4 d\'au plus 2 points (3 en dessous de 4 pèsent 1 point de déficit).</li>' +
        '<li>Au plus 3 notes inférieures à 4.</li>' +
        '<li>Pas de groupe de 16 points ni de double compensation : ces règles sont celles de la maturité.</li>' +
        '<li>Cas limite : un demi-point sur une seule note suffirait. La conférence des maîtres décide.</li></ul></div>',
      caveat: 'Sources : règlement de l\'ECG (RECG, BLV 413.05.1) art. 8-10 et 13, directives DRECG 8.1 (arrondi), plan d\'études ECG 2024 (grilles). Les listes de notes du bulletin viennent du vade-mecum du Gymnase de Burier : vérifie-les avec ton doyen.'
    };
  }
  function statusText(k, year) {
    if (year !== 3) return null;
    return { ok: ["t-good", "Bonne voie", "Tes moyennes actuelles remplissent les trois conditions du certificat, avec de la marge."],
      tight: ["t-warn", "Serré", "Les conditions sont remplies, mais une ou deux mauvaises notes peuvent les faire basculer."],
      limit: ["t-warn", "Cas limite", "Un demi-point sur une seule note suffirait."],
      danger: ["t-crit", "Compliqué", "Plusieurs conditions du certificat ne sont pas remplies avec tes moyennes actuelles."] }[k] || null;
  }

  /* ---------- 3e année : certificat ECG (RECG art. 17-19 ; DRECG 17.1, 18.1, 18.2) ----------
     Notes définitives : sans examen = note annuelle ; écrit et oral = (2 × annuelle + écrit + oral) / 4 ; un seul examen = (annuelle + examen) / 2,
     arrondies au demi-point. Réussite : total ≥ 4 × nombre de notes, écarts sous 4 ≤ 2, au plus 3 notes sous 4, total des 11 épreuves d'examen ≥ 38,5
     (3,5 × 11 : 4 écrits et 7 oraux ; chiffre confirmé par un document d'examens de gymnase, aucun texte ne le chiffre). Les examens se saisissent
     dans le détail de la branche (même clé de stockage que la maturité : notes2m01.exams, donc synchronisés avec le reste). */
  var EXAM_COMMON = { fr: "wo", l2: "wo", l3: "wo", ma: "w", hi: "o" };
  var EXAM_DOM = { sante: { bi: "o", ch: "o", ph: "o" }, social: { ed: "o", ge: "o", ss: "o" }, peda: { sx: "o", phi: "o", psy: "o" }, com: { io: "o", ge: "o", ed: "o" },
    arts: { phi: "o", atel: "o", har: "o" }, musique: { phi: "o", atel: "o", hmu: "o" } };
  var SHO = ["ge", "ed"];   // Communication et information : « Sciences humaines (option) » = géographie et économie et droit, un oral chacune
  function units(pr) {
    var u = [], d = EXAM_DOM[pr.domaine] || {};
    Object.keys(EXAM_COMMON).forEach(function (id) { u.push({ id: id, kinds: EXAM_COMMON[id], sid: id }); });
    Object.keys(d).forEach(function (id) { u.push({ id: id, kinds: d[id], sid: pr.domaine === "com" && SHO.indexOf(id) >= 0 ? "sho" : id }); });
    return u;
  }
  function half(x) { return Math.floor(x * 2 + 0.5 + 1e-9) / 2; }
  function num(v) { var n = parseFloat(String(v).replace(",", ".")); return isFinite(n) && n >= 1 && n <= 6 ? n : null; }
  function fmt(n) { return n == null ? "–" : (Number.isInteger(n) ? String(n) : n.toFixed(1)); }
  function app() { return window.NotesApp; }
  function store() { return window.Cert && Cert.data ? Cert.data() : { exams: {}, carried: {} }; }

  function compute(x) {
    var A = app(), pr = A.profile(), data = store(), us = units(pr), exNotes = [], real = 0, missing = [];
    function ann(id) { var a = A.annualAvg(id); return a == null ? null : half(a); }
    function ex(id, k, n) {
      var v = num(((data.exams || {})[id] || {})[k]);
      if (v != null) { real++; return { v: v, real: true }; }
      if (x === "now") return n != null ? { v: n, real: false } : null;
      return typeof x === "number" ? { v: x, real: false } : null;
    }
    function unit(u) {
      var a = ann(u.id), w = u.kinds.indexOf("w") >= 0 ? ex(u.id, "w", a) : null, o = u.kinds.indexOf("o") >= 0 ? ex(u.id, "o", a) : null, f = null;
      if (w) exNotes.push(w.v); if (o) exNotes.push(o.v);
      if (a != null) f = u.kinds === "wo" ? (w && o ? half((2 * a + w.v + o.v) / 4) : null) : (w || o ? half((a + (w || o).v) / 2) : null);
      return { id: u.id, a: a, w: w, o: o, final: f };
    }
    var byId = {}; us.forEach(function (u) { if (u.sid !== "sho") byId[u.id] = u; });
    var rows = A.subjectsAll().filter(function (s) { return s.counts && !s.part; }).map(function (s) {
      var r = { id: s.id, name: s.name, carried: !!s.carried };
      if (s.id === "sho") {
        var parts = SHO.map(function (id) { return unit(us.filter(function (u) { return u.id === id; })[0]); });
        r.parts = parts; r.final = parts[0].final != null && parts[1].final != null ? half((parts[0].final + parts[1].final) / 2) : null; r.exam = true;
        if (parts[0].a == null || parts[1].a == null) missing.push(s.name);
        return r;
      }
      if (byId[s.id]) { var q = unit(byId[s.id]); r.a = q.a; r.w = q.w; r.o = q.o; r.final = q.final; r.exam = true; r.kinds = byId[s.id].kinds; if (q.a == null) missing.push(s.name); return r; }
      r.a = ann(s.id); r.final = r.a; if (r.a == null) missing.push(s.name + (s.carried ? " (note de 1re)" : ""));
      return r;
    });
    var nExam = us.reduce(function (n, u) { return n + u.kinds.length; }, 0), total = 0, def = 0, fails = 0, rated = 0;
    rows.forEach(function (r) { if (r.final == null) return; rated++; total += r.final; if (r.final < 4) { def += 4 - r.final; fails++; } });
    var examTotal = exNotes.reduce(function (a, b) { return a + b; }, 0), complete = rows.every(function (r) { return r.final != null; }) && exNotes.length === nExam;
    var thr = 3.5 * nExam;
    return { rows: rows, total: total, def: def, fails: fails, rated: rated, expected: rows.length, examTotal: examTotal, nExamNotes: exNotes.length, realExams: real, nExam: nExam,
      thr: thr, missing: missing, complete: complete, pass: complete && total >= 4 * rows.length - 1e-9 && def <= 2 + 1e-9 && fails <= 3 && examTotal >= thr - 1e-9 };
  }
  function minimum() {
    for (var x = 1; x <= 6.0001; x += 0.5) { var r = compute(x); if (r.missing.length) return { missing: r.missing }; if (r.pass) return { x: x }; }
    return { x: null };
  }
  function examAverage() {
    var us = units(app().profile()), t = 0, n = 0;
    us.forEach(function (u) { var a = app().annualAvg(u.id); if (a != null) { t += a; n++; } });
    return n ? t / n : null;
  }
  function status(real, m) {
    if (real.complete) return real.pass ? { cls: "t-good", label: "Certificat réussi", text: "Les quatre conditions du certificat ECG sont remplies." }
      : { cls: "t-crit", label: "Certificat non réussi", text: "Au moins une condition n'est pas remplie. Une session de rattrapage existe si l'échec vient seulement des examens." };
    if (m.missing) return { cls: "t-none", label: "Certificat", text: "Il manque encore : " + m.missing.join(", ") + "." };
    if (m.x == null) return { cls: "t-crit", label: "Compliqué", text: "Même avec 6 à toutes les épreuves restantes, le certificat ne serait pas atteint avec tes notes actuelles." };
    var avg = examAverage();
    if (avg == null) return { cls: "t-none", label: "Certificat", text: "Ajoute des notes dans tes branches d'examen pour voir où tu en es." };
    var gap = m.x - avg, hint = " Touche une branche d'examen pour saisir tes examens et voir la note minimale à viser.";
    if (gap <= 1e-9) return { cls: "t-good", label: "Bonne voie", text: "Tes moyennes actuelles te mettent en bonne voie pour le certificat." + hint };
    if (gap <= 1 + 1e-9) return { cls: "t-warn", label: "Serré", text: "C'est possible, mais il te faudra des examens meilleurs que tes moyennes actuelles." + hint };
    return { cls: "t-crit", label: "Compliqué", text: "Il te faudrait des examens nettement meilleurs que tes moyennes actuelles." + hint };
  }
  function metric(label, val, unit, sub, ratio, cls, markAt, markLabel) {
    return '<div class="metric"><span class="lbl">' + label + '</span><span class="val">' + val + ' <small>' + unit + '</small></span>' +
      '<div class="bar ' + cls + '"><i style="width:' + Math.max(0, Math.min(100, ratio * 100)).toFixed(0) + '%"></i>' + (markAt != null ? '<b style="left:' + (markAt * 100).toFixed(1) + '%"></b>' : "") + '</div>' +
      (markAt != null ? '<div class="tick"><span style="left:' + (markAt * 100).toFixed(1) + '%">' + markLabel + '</span></div>' : "") + '<span class="sub">' + sub + '</span></div>';
  }
  function delta(d, ref) { return (d >= 0 ? "+" : "−") + Math.abs(d).toFixed(1) + " pt par rapport à " + ref; }
  function renderCert(pr) {
    var promo = document.getElementById("promo"); if (!promo) return;
    var real = compute(null), now = compute("now"), m = minimum(), st = status(real, m), s = real.complete ? real : now, partial = !real.complete;
    var d1 = s.total - 4 * s.rated;
    var t1 = s.rated ? metric("Total des notes", fmt(s.total), "/ " + 6 * s.expected, (s.rated < s.expected ? "au rythme actuel : " : "") + delta(d1, String(4 * s.rated)) + " (" + s.rated + " / " + s.expected + " notes)",
      s.total / (6 * s.expected), d1 < 0 ? "crit" : d1 < 2 ? "warn" : "", 4 / 6, 4 * s.expected + " min") : metric("Total des notes", "–", "/ " + 6 * s.expected, "aucune note", 0, "", 4 / 6, 4 * s.expected + " min");
    var t2 = metric("Écarts sous 4", s.def.toFixed(1), "/ 2 max", s.def > 2 ? "dépasse de " + (s.def - 2).toFixed(1) + " pt" : s.def === 0 ? "aucune note sous 4" : (2 - s.def).toFixed(1) + " pt de marge", s.def / 4, s.def > 2 ? "crit" : s.def >= 1.5 ? "warn" : "", 0.5, "2 max");
    var t3 = metric("Notes inférieures à 4", String(s.fails), "/ 3 max", s.fails > 3 ? "trop de notes insuffisantes" : (3 - s.fails) + " en réserve", s.fails / 4, s.fails > 3 ? "crit" : s.fails === 3 ? "warn" : "");
    var t4;
    if (s.nExamNotes) { var d4 = s.examTotal - 3.5 * s.nExamNotes;
      t4 = metric("Total des examens", fmt(s.examTotal), "/ " + 6 * s.nExam, (partial ? "au rythme actuel : " : "") + delta(d4, fmt(3.5 * s.nExamNotes)) + " (" + s.realExams + " épreuve" + (s.realExams > 1 ? "s" : "") + " passée" + (s.realExams > 1 ? "s" : "") + " sur " + s.nExam + ")",
        s.examTotal / (6 * s.nExam), d4 < 0 ? "crit" : d4 < 2 ? "warn" : "", s.thr / (6 * s.nExam), fmt(s.thr) + " min");
    } else t4 = metric("Total des examens", "–", "/ " + 6 * s.nExam, "aucune épreuve", 0, "", s.thr / (6 * s.nExam), fmt(s.thr) + " min");
    promo.innerHTML = '<div class="verdict"><span class="pill ' + st.cls + '">' + st.label + '</span><p>' + esc(st.text) + '</p></div><div class="metrics">' + t1 + t2 + t3 + t4 + '</div>';
  }

  /* Détail d'une branche : saisie des examens (écrit, oral) et note minimale. */
  function inp(attr, v) { return '<input type="number" inputmode="decimal" min="1" max="6" step="0.5" ' + attr + ' value="' + (v != null ? v : "") + '" placeholder="–">'; }
  function needFor4(a, kinds, w, o) {
    if (a == null) return null;
    for (var e = 1; e <= 6.0001; e += 0.5) {
      var ww = w && w.real ? w.v : e, oo = o && o.real ? o.v : e, f = kinds === "wo" ? half((2 * a + ww + oo) / 4) : half((a + e) / 2);
      if (f >= 4) return e;
    }
    return null;
  }
  function unitBlock(label, id, r, data) {
    var e = (data.exams || {})[id] || {}, kinds = r.kinds || "o", hasW = !!(r.w && r.w.real), hasO = !!(r.o && r.o.real), line;
    if (r.a == null) line = "Entre des notes de l'année dans cette branche pour calculer la note minimale à l'examen.";
    else if (kinds === "wo" ? (hasW && hasO) : (hasW || hasO)) line = "Examen passé : note finale <b>" + fmt(r.final) + "</b>.";
    else {
      var need = needFor4(r.a, kinds, r.w, r.o), what = kinds === "wo" ? (hasW ? "à l'oral" : hasO ? "à l'écrit" : "à l'écrit et à l'oral") : kinds === "w" ? "à l'écrit" : "à l'oral";
      line = need == null ? "Même avec 6 " + what + ", tu n'atteindrais pas 4 dans cette branche." : need <= 1 ? "Tu as déjà <b>4</b> dans cette branche, quelle que soit la note de l'examen."
        : "Pour avoir <b>4</b> dans cette branche, il te faut au moins <b>" + fmt(need) + "</b> " + what + ".";
    }
    return '<div class="cert-min"><h3 class="sec">' + esc(label) + '</h3><div class="exam-fields">' +
      (kinds.indexOf("w") >= 0 ? '<label>Écrit' + inp('data-exam="' + id + '" data-k="w"', e.w) + '</label>' : "") +
      (kinds.indexOf("o") >= 0 ? '<label>Oral' + inp('data-exam="' + id + '" data-k="o"', e.o) + '</label>' : "") +
      '<div class="exam-out"><span class="muted small">Annuelle</span><span class="mono">' + fmt(r.a) + '</span></div>' +
      '<div class="exam-out"><span class="muted small">Note finale</span><span class="mono exam-final ' + (r.final != null && r.final < 4 ? "crit" : "") + '">' + fmt(r.final) + '</span></div></div>' +
      '<p>' + line + '</p><span class="meta">Note finale = ' + (kinds === "wo" ? "(2 × annuelle + écrit + oral) / 4" : "(annuelle + examen) / 2") + ', arrondie au demi-point.</span></div>';
  }
  function detail(id) {
    var A = app(), pr = A && A.profile();
    if (!pr || pr.year !== 3 || !A.subjectsAll().some(function (s) { return s.id === id; })) return "";
    var data = store(), c = compute(null), row = c.rows.filter(function (r) { return r.id === id; })[0];
    if (row && row.carried) {
      var info = carriedInfo(id), v = info.v;
      return '<div class="cert-min"><h3 class="sec">Note de 1re reprise</h3><p>' + (v == null ? "Aucune note de 1re trouvée pour cette branche. Entre-la dans Réglages → Notes reprises de 1re."
        : "Ta note du certificat : <b>" + fmt(half(v)) + "</b> " + (info.src === "auto" ? "(calculée d'après tes notes de 1re classées, moyenne exacte " + v.toFixed(2) + ")." : "(saisie à la main).")) +
        '</p><span class="meta">Cette branche n\'est plus enseignée en 3e : pour corriger la note, va dans <b>Réglages → Notes reprises de 1re</b>.</span></div>';
    }
    if (row && row.parts) return row.parts.map(function (q) { var nm = A.subjectsAll().filter(function (s) { return s.id === q.id; })[0]; return unitBlock("Examen · " + (nm ? nm.name : q.id), q.id, { a: q.a, w: q.w, o: q.o, final: q.final, kinds: "o" }, data); }).join("");
    var u = units(pr).filter(function (z) { return z.id === id; })[0];
    if (!u) return "";
    var r = row || (function () { var q = c.rows.filter(function (z) { return z.parts && z.parts.some(function (pp) { return pp.id === id; }); })[0]; return q ? q.parts.filter(function (pp) { return pp.id === id; })[0] : null; })();
    return r ? unitBlock("Examen", id, Object.assign({ kinds: u.kinds }, r), data) : "";
  }

  /* Notes reprises de 1re : saisie à la main, sinon moyenne exacte de l'année 1 classée (« Années précédentes »). */
  function carriedList(pr) { return app().subjectsAll().filter(function (s) { return s.carried; }); }
  function autoCarried(id) {
    var A = app(), arch = A.archive ? A.archive() : [];
    for (var i = arch.length - 1; i >= 0; i--) if (arch[i].year === 1) {
      var r = A.archiveStats(arch[i]).filter(function (x) { return x.id === id; })[0];
      return r && r.avg != null ? r.avg : null;
    }
    return null;
  }
  function carriedInfo(id) {
    var m = num((store().carried || {})[id]); if (m != null) return { v: m, src: "saisie" };
    var a = autoCarried(id); return a != null ? { v: a, src: "auto" } : { v: null, src: null };
  }
  function mountCarried(pr) {
    var host = document.getElementById("set-block"); if (!host) return;
    var d = document.getElementById("carriedset"), list = pr.year === 3 ? carriedList(pr) : [];
    if (!list.length) { if (d) d.hidden = true; return; }
    if (!d) {
      d = document.createElement("div"); d.className = "backup"; d.id = "carriedset";
      var anchor = document.getElementById("yearpass") || (document.getElementById("ob-edit") && document.getElementById("ob-edit").closest(".backup"));
      if (anchor) anchor.after(d); else host.insertBefore(d, host.firstChild);
      d.addEventListener("change", function (e) {
        var t = e.target; if (!t.dataset || !t.dataset.carried) return;
        var s = store(); s.carried = s.carried || {}; s.carried[t.dataset.carried] = t.value === "" ? null : num(t.value);
        if (window.Cert && Cert.save) Cert.save(); app().redraw();
      });
    }
    d.hidden = false;
    var html = '<h3>Notes reprises de 1re</h3><p class="muted small">' + list.map(function (s) { return esc(s.name); }).join(" et ") + (list.length > 1 ? " ne sont" : " n'est") + ' plus enseignée' + (list.length > 1 ? "s" : "") +
      ' en 3e : sa note du certificat est ta note annuelle de 1re. L\'app la calcule d\'après tes notes de 1re classées ; entre-la ici si ton bulletin dit autre chose. Champ vide = calcul automatique.</p>' +
      list.map(function (s) {
        var auto = autoCarried(s.id), man = num((store().carried || {})[s.id]);
        return '<label class="row">' + esc(s.name) + '<input type="number" inputmode="decimal" min="1" max="6" step="0.5" data-carried="' + s.id + '" value="' + (man != null ? man : "") + '" placeholder="' + (auto != null ? fmt(half(auto)) + " (auto)" : "–") + '" style="width:110px;text-align:right"></label>';
      }).join("");
    if (d._html !== html) { d.innerHTML = html; d._html = html; }
  }

  G.register("ecg", {
    id: "ecg", name: "Culture générale",
    lists: { l2: L2, art: ART, domaine: DOMAINES },
    build: build, rules: rules, rulesHtml: rulesHtml,
    head: function (p) { return { school: "École de culture générale vaudoise", promo: p.year === 3 ? "Certificat ECG" : "Promotion en " + (p.year + 1) + "e année", classe: (p.year || 1) + "C" }; },
    summary: function (p) { var l = find(L2, p.l2); return p.year + (p.year === 1 ? "re" : "e") + " année · L2 " + (l ? l.name : "?") + (p.year > 1 ? " · " + (domName(p.domaine) || "domaine à choisir") : ""); },
    statusText: statusText,
    guide: function (pr) {
      var note = "<span class='note'>Le détail est dans Réglages → Comment les moyennes sont calculées.</span>";
      var g = {
        "Fais la configuration": [
          "Choisis ta voie (culture générale), ton gymnase, ton année, ta deuxième langue et, dès la 2e année, ton domaine professionnel (en travail social, aussi arts visuels ou musique).",
          "L'app crée tes branches avec leurs périodes. Plusieurs disciplines forment une seule note de bulletin (par exemple les sciences expérimentales). Un choix impossible est grisé, avec la raison. Tu pourras tout changer plus tard dans <b>Réglages → Profil</b>."],
        "Le verdict de promotion": [
          "Le verdict (<b>Promotion assurée</b>, <b>Marge faible</b>, <b>Cas limite</b> ou <b>En danger</b>) vérifie trois règles : total des notes d'au moins 4 × le nombre de notes, somme des écarts sous 4 d'au plus 2 points, et 3 notes sous 4 au maximum. Tant qu'une branche n'a aucune note, il reste sur <b>Verdict incomplet</b>.",
          "Sur téléphone, l'Accueil montre en tête une <b>tuile par règle</b> : un anneau qui se remplit, avec une encoche au maximum à ne pas dépasser pour les écarts, et des pastilles pour les notes sous 4. La dernière tuile montre ta <b>moyenne générale</b> et sa courbe.",
          "<span class='note'>En 3e année, ce verdict est remplacé par celui du certificat ECG (étape suivante).</span>"],
        "En 3e : le certificat de maturité": { t: "En 3e : le certificat ECG", p: [
          "En 3e, l'en-tête montre une pastille (<b>Bonne voie</b>, <b>Serré</b> ou <b>Compliqué</b>, puis <b>Certificat réussi</b> ou <b>non réussi</b> quand tous les examens sont saisis) et quatre jauges : le <b>total des notes</b> (44 ou 48 points selon ton domaine), les <b>écarts sous 4</b> (2 au maximum), les <b>notes sous 4</b> (3 au maximum) et le <b>total des examens</b> (38.5 pour 11 épreuves).",
          "Les examens se saisissent dans le <b>détail de chaque branche</b> : l'écrit et l'oral, et lis la <b>note minimale</b> à viser pour avoir 4 dans la branche.",
          pr.domaine === "peda" ? "Aucune note n'est reprise d'une année précédente en pédagogie." : "Les sciences expérimentales (ou les arts, en santé) gardent leur <b>note de 1re</b>. Pour la corriger, va dans <b>Réglages → Notes reprises de 1re</b>."] },
        "TP et options à deux parties": [
          "La part des <b>TP</b> est déduite des périodes de TP de la grille (par exemple 0,5 période sur 2,5 en santé). Une discipline intégrée (par exemple les sciences expérimentales) mélange ses parties selon leurs périodes, puis arrondit une seule fois.", note],
        "Ton profil": [
          "<b>Réglages → Profil</b> : chaque ligne (voie, gymnase, classe, langue, domaine professionnel, discipline artistique en travail social) ouvre une liste et <b>s'enregistre tout de suite</b>.",
          "Changer de langue ou de discipline artistique <b>supprime les notes de l'ancienne branche</b> : l'app te le demande d'abord et te propose d'exporter une sauvegarde. Changer de domaine masque les notes des branches qui n'existent pas dans le nouveau. Changer de voie supprime toutes les notes."],
        "Passer à l'année suivante": [
          "L'année ne se change pas dans le profil : touche <b>Réglages → Année scolaire → Passer en 2e (ou 3e) année</b>.",
          "Tes notes de l'année sont <b>classées dans « Années précédentes »</b> (rien n'est supprimé), les moyennes repartent de zéro et les dates de semestre avancent d'un an. En passant en 2e, tu choisis ton domaine professionnel ; en 3e, les sciences expérimentales (ou les arts, en santé) sont reprises de 1re pour le certificat.",
          "<b>Annuler le dernier passage</b> remet tout comme avant."],
        "Part des TP et périodes": [
          "<b>Part des TP (%)</b> : déduite de la grille (20 à 50 selon la branche) ; mets la valeur de ton prof, ou 0 pour que les TP comptent comme des notes ordinaires.",
          "<b>Périodes</b> : le nombre de périodes par semaine. Il fixe le minimum de notes conseillé (périodes + 1) et le poids de chaque partie dans une discipline intégrée. Corrige-le seulement si ton horaire diffère de la grille officielle."]
      };
      return g;
    },
    passNotes: function (pr, next) {
      if (next === 2) return ["Tu choisiras ton domaine professionnel juste après."];
      if (next === 3 && pr.domaine !== "peda") return ["Les sciences expérimentales (ou les arts, en santé) ne sont plus enseignées en 3e : leur note de 1re sera reprise pour le certificat."];
      return [];
    },
    render: function (pr) { mountCarried(pr); if (pr.year === 3) renderCert(pr); },
    detail: detail,
    examUnits: function (pr) { return units(pr); },
    carriedValue: function (id) { return carriedInfo(id).v; },
    domName: domName,
    warn: function (f, id, p) { return f === "domaine" && DOMAINES_WARN[p.gymnase] && DOMAINES_WARN[p.gymnase][id] || null; },
    blocked: function (f, id, np) {
      if (f === "domaine" && id === "peda" && np.l2 === "it") return "Pédagogie : l'allemand est obligatoire (change d'abord ta L2)";
      if (f === "l2" && id === "it" && np.domaine === "peda") return "L'allemand est obligatoire en pédagogie";
      return null;
    },
    sanitize: function (p) { if (p.domaine === "peda" && p.l2 === "it") p.domaine = null; if (p.year < 2) delete p.domaine; if (p.domaine !== "social") delete p.art; },
    needDomain: function (p) { return p.year >= 2; },
    needArt: function (p) { return p.year >= 2 && p.domaine === "social"; },
    afterPass: function (next) { return next === 2 ? "domaine" : null; }
  });
})();
