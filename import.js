/* Notes — import depuis un tableur (v73). Chargé à la demande (Grid.script("import.js")) : personne ne le télécharge sans s'en servir.
   Principe : l'élève copie un prompt (adapté à son profil, ou générique), le donne à une IA avec son fichier (Excel, Sheets, PDF, photo…),
   puis colle ici la réponse : un JSON « notes-import v1 ». L'app le lit avec indulgence (guillemets typographiques, virgule décimale,
   virgules en trop, bloc ```), reconnaît les branches par identifiant ou par nom, montre un aperçu (ajouter ou remplacer), puis importe.
   Rien ne part d'ici : le fichier vit sur l'appareil ; seul le fichier de l'élève va à l'IA qu'il a choisie. */
(function () {
  "use strict";
  var A = window.NotesApp, G = window.Grid;
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function $(s, r) { return (r || document).querySelector(s); }
  function hap(k) { if (window.FX) FX.haptic(k); }
  var seq = 0;
  function uid() { return Date.now().toString(36) + (seq++).toString(36).padStart(4, "0") + Math.random().toString(36).slice(2, 5); }
  function today() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function fmtDate(iso) { var p = String(iso).split("-"); return p.length === 3 ? p[2] + "." + p[1] + "." + p[0] : iso; }
  function plural(n, a, b) { return n + " " + (n > 1 ? b : a); }

  /* ================= Prompts ================= */
  var SCHEMA =
    '{\n  "format": "notes-import",\n  "version": 1,\n' +
    '  "profil": { ... },                       // voir « PROFIL » ci-dessous (facultatif si l\'élève a déjà configuré l\'app)\n' +
    '  "fin_semestre_1": "2027-01-29",           // facultatif : dernier jour du semestre 1\n' +
    '  "notes": [\n    { "branche": "ma", "rang": 1, "note": 4.5, "date": "2026-09-20", "coef": 1, "type": "test", "titre": "Fonctions" }\n  ],\n' +
    '  "ta": [                                   // travaux assimilés : un TA regroupe des ETA et compte comme UNE note\n' +
    '    { "branche": "fr", "titre": "Vocabulaire ch. 3", "en_points": true, "pct4": 60,\n' +
    '      "etas": [ { "rang": 1, "date": "2026-10-02", "points": 17, "max": 20, "titre": "Quiz 1" } ] }\n  ],\n' +
    '  "objectifs": [ { "branche": "ma", "objectif": 5 } ],          // facultatif\n' +
    '  "part_tp": [ { "branche": "ph", "pourcent": 25 } ],           // facultatif : part des TP dans la moyenne\n' +
    '  "examens": [ { "branche": "fr", "ecrit": 4, "oral": 4.5 } ],   // 3e année seulement\n' +
    '  "reprises": [ { "branche": "art", "note": 5 } ]                // 3e année seulement : note d\'une branche qui n\'est plus enseignée\n}';

  var RULES =
    'RÈGLES DE CONVERSION\n' +
    '- Échelle suisse : de 1 à 6 (4 = suffisant), demi-points ou décimales acceptés (4.75). Point ou virgule décimale : écris-la avec un POINT dans le JSON. Si le fichier donne autre chose (sur 20, en %, en points), demande-moi comment l\'enseignant convertit ; à défaut, convertis par la règle 1 + 5 × (points ÷ maximum) et dis-le moi.\n' +
    '- "coef" : poids de la note (1 par défaut ; 0.5, 0.25 ou 0.3333 pour 1/3). "type" : "test" (par défaut) ou "tp" (travaux pratiques). Ne mets pas "ta" comme type : les TA vont dans la liste "ta".\n' +
    '- "date" : AAAA-MM-JJ. Une date incomplète (jour et mois seulement) appartient à l\'année scolaire en cours (de septembre à juin) ; si elle manque, laisse le champ "date" absent (ne la devine pas) : l\'app la déduira du rang.\n' +
    '- ORDRE : garde l\'ordre chronologique du fichier. "rang" = la position de la note dans le tableau pour cette branche (1 = la plus ancienne, puis 2, 3…), colonnes lues de gauche à droite (ou lignes de haut en bas). Quand les colonnes sont communes à toutes les branches (colonne 1, colonne 2…), le même rang désigne le même moment pour toutes : une case vide saute le rang sans le décaler. Mets "rang" même quand tu as la date.\n' +
    '- OPTION SPÉCIFIQUE (OS) sur UNE seule ligne qui regroupe plusieurs branches (physique et applications des maths, biologie et chimie, philosophie et psychologie…) : ne sépare pas les notes. Écris-les une seule fois, avec comme branche "os" (ou le nom de la ligne tel qu\'il est écrit). L\'app copie alors chaque note dans les deux parties de l\'option. Fais de même pour une ligne simplement nommée « OS ».\n' +
    '- Un TA regroupe plusieurs petites évaluations (ETA). Sans points : donne "note" dans chaque ETA. En points : donne "points" et "max" (le pourcentage qui vaut 4 est "pct4", 60 par défaut).\n' +
    '- N\'invente rien : une ligne dont tu n\'es pas sûr, pose-moi la question ou laisse-la de côté et signale-la. Garde les moyennes et totaux du fichier hors du JSON : l\'app les recalcule.\n' +
    '- Ne mets aucun nom ni prénom, aucun numéro de dossier.\n';

  var OUTPUT =
    'CE QUE TU RÉPONDS\n' +
    '1) Si une information essentielle manque ou est ambiguë, pose d\'abord tes questions (courtes, numérotées) et attends mes réponses.\n' +
    '2) Ensuite, réponds avec UN SEUL bloc de code JSON valide (guillemets droits ", pas de commentaires, pas de virgule finale), sans autre texte dans ce bloc. Après le bloc, liste en quelques lignes ce que tu as ignoré ou deviné.\n';

  function leafInfo(s, all) {
    var bits = [];
    if (s.parts) bits.push("note COMPOSÉE : si le fichier a une ligne par partie, saisis les notes dans " + s.parts.join(", ") + " ; s'il n'a qu'UNE ligne pour toute l'option, utilise \"" + s.id + "\" (l'app copie chaque note dans les parties)");
    if (s.part) bits.push("fait partie d'une note composée");
    if (s.carried) bits.push("note reprise : ne saisis pas de notes, utilise \"reprises\"");
    if (s.hasTP || s.tpShare) bits.push("TP possibles");
    if (s.counts === false) bits.push("ne compte pas pour la promotion");
    return bits.join(" ; ");
  }
  function subjectTable() {
    var subs = A.subjectsAll();
    return subs.map(function (s) { return s.id + " | " + s.name + " | " + (s.periods || 0) + " pér. | " + leafInfo(s); }).join("\n");
  }
  function examLine(pr) {
    if (pr.year !== 3) return "";
    var vx = G.ext(pr);
    if (vx && vx.examUnits) return "EXAMENS (3e année) : " + vx.examUnits(pr).map(function (u) { return u.id + (u.kinds === "wo" ? " (écrit et oral)" : u.kinds === "w" ? " (écrit)" : " (oral)"); }).join(", ") + ".\n";
    return "EXAMENS (3e année) : fr, l2, l3, ma, os (écrit et oral) ; oc (oral seulement).\n";
  }
  function profileSummary(pr) {
    var v = G.voieOf(pr), out = ["Voie : " + (v === "ecg" ? "École de culture générale (ECG)" : "Maturité gymnasiale"), "Année : " + pr.year + (pr.year === 1 ? "re" : "e")];
    if (pr.gymnase) out.push("Gymnase : " + (G.gymnaseName(pr.gymnase) || pr.gymnase));
    if (pr.classe) out.push("Classe : " + pr.classe);
    if (pr.domaine) out.push("Domaine : " + pr.domaine);
    return out.join(" · ");
  }
  function personalPrompt() {
    var pr = A.profile(); if (!pr) return genericPromptSync();
    var st = A.get();
    return 'Tu es un assistant qui convertit un tableau de notes (Excel, Google Sheets, CSV, PDF, capture d\'écran ou texte collé) en un fichier JSON pour l\'application « Notes », qui suit les notes d\'élèves des écoles vaudoises (calcul des moyennes et de la promotion).\n\n' +
      'PROFIL DÉJÀ CONFIGURÉ DANS L\'APP\n' + profileSummary(pr) + '\nFin du semestre 1 : ' + st.cfg.s1End + '\n\n' +
      'BRANCHES DE L\'APP (utilise EXACTEMENT ces identifiants dans le champ "branche")\nid | nom | périodes par semaine | remarques\n' + subjectTable() + '\n\n' +
      examLine(pr) + '\n' +
      'FORMAT À PRODUIRE (notes-import v1). Le profil est déjà dans l\'app : ne mets pas de champ "profil". "fin_semestre_1" est facultatif.\n' + SCHEMA.replace(/  "profil".*\n/, "") + '\n\n' + RULES + '\n' + OUTPUT +
      '\nVoici mon fichier de notes : (je le joins ou je le colle ci-dessous)';
  }
  function genericPromptSync(ecgReady) {
    var m = function (l) { return l.map(function (x) { return x.id + " = " + x.name; }).join(" ; "); };
    var ecgP = { voie: "ecg" }, ecg = G.ext(ecgP);
    return 'Tu es un assistant qui convertit un tableau de notes (Excel, Google Sheets, CSV, PDF, capture d\'écran ou texte collé) en un fichier JSON pour l\'application « Notes », qui suit les notes d\'élèves des écoles vaudoises (calcul des moyennes et de la promotion). L\'app existe pour la maturité gymnasiale et pour l\'École de culture générale (ECG) ; l\'École de commerce n\'est pas encore prise en charge.\n\n' +
      'ÉTAPE 1 : PROFIL. Pose-moi les questions nécessaires (une par ligne) pour remplir le champ "profil" : voie, année, gymnase, classe, choix de langues, options. Valeurs possibles :\n' +
      '- "voie" : "mat" (maturité) ou "ecg" (culture générale). "annee" : 1, 2 ou 3. "classe" : texte libre (facultatif).\n' +
      '- "gymnase" : ' + m(G.GYMNASES) + '.\n' +
      '- Maturité : "l2" : ' + m(G.L2) + ' ; "l3" : ' + m(G.L3) + ' ; "math" : ' + m(G.MATH) + ' ; "art" : ' + m(G.ART) + ' ; "os" (option spécifique) : ' + m(G.OS) + ' ; "oc" (option complémentaire, 3e année seulement) : ' + m(G.OC) + '.\n' +
      '- Culture générale : "l2" : ' + (ecg ? m(ecg.lists.l2) : "de = Allemand ; it = Italien") + ' (l\'allemand est obligatoire en pédagogie) ; "domaine" (dès la 2e année) : ' + (ecg ? m(ecg.lists.domaine) : "sante = Santé ; social = Travail social ; peda = Pédagogie ; com = Communication et information ; arts = Arts et design ; musique = Musique") + ' ; "art" (travail social, dès la 2e) : ' + (ecg ? m(ecg.lists.art) : "av = Arts visuels ; mu = Musique") + '.\n\n' +
      'ÉTAPE 2 : NOTES. Lis mon fichier et remplis les listes ci-dessous. Dans le champ "branche", écris le nom de la branche tel qu\'il apparaît dans mon fichier (Maths, Français, Allemand, Biologie, etc.) : l\'app reconnaît les noms usuels et me demandera de confirmer les cas douteux.\n\n' +
      'FORMAT À PRODUIRE (notes-import v1) :\n' + SCHEMA.replace('{ ... },                       // voir « PROFIL » ci-dessous (facultatif si l\'élève a déjà configuré l\'app)', '{ "voie": "mat", "annee": 2, "gymnase": "bugnon", "classe": "2M01", "l2": "de", "l3": "en", "math": "std", "art": "av", "os": "ED" },   // OBLIGATOIRE ici') + '\n\n' + RULES + '\n' + OUTPUT +
      '\nVoici mon fichier de notes : (je le joins ou je le colle ci-dessous)';
  }
  function genericPrompt() { return Promise.resolve(genericPromptSync()); }

  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return new Promise(function (ok, ko) {
      var t = document.createElement("textarea"); t.value = text; t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.opacity = "0";
      document.body.appendChild(t); t.select();
      try { document.execCommand("copy") ? ok() : ko(); } catch (e) { ko(e); } t.remove();
    });
  }

  /* ================= Lecture du JSON ================= */
  function lenientJSON(text) {
    var t = String(text || ""), m = t.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
    if (m) t = m[1];
    var a = t.indexOf("{"), b = t.lastIndexOf("}");
    if (a < 0 || b < a) throw new Error("Je ne trouve pas de JSON dans ce texte. Colle toute la réponse de l'IA, le bloc de code compris.");
    t = t.slice(a, b + 1).replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/^\s*\/\/.*$/gm, "").replace(/(:\s*)(-?\d+),(\d+)(?=\s*[,}\]])/g, "$1$2.$3")
      .replace(/(\s)\/\/[^\n"]*$/gm, "$1").replace(/,\s*([}\]])/g, "$1");
    try { return JSON.parse(t); }
    catch (e) { throw new Error("Le JSON n'est pas valide (" + String(e.message).replace(/^JSON\.parse: /, "") + "). Redemande à l'IA : « Corrige ton JSON, il doit être valide. »"); }
  }
  function pick(o, keys) { if (!o || typeof o !== "object") return undefined; for (var i = 0; i < keys.length; i++) { for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k) && k.toLowerCase() === keys[i]) return o[k]; } return undefined; }
  function toNum(v) { if (typeof v === "number") return isFinite(v) ? v : NaN; var n = parseFloat(String(v == null ? "" : v).replace(",", ".")); return isFinite(n) ? n : NaN; }
  function isoDate(v) {
    if (v == null || v === "") return null;
    var s = String(v).trim(), m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (!m) { m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/); if (m) m = [0, m[3].length === 2 ? "20" + m[3] : m[3], m[2], m[1]]; }
    if (!m) return undefined;
    var y = +m[1], mo = +m[2], d = +m[3];
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return undefined;
    return y + "-" + String(mo).padStart(2, "0") + "-" + String(d).padStart(2, "0");
  }
  function score(v) { var n = toNum(v); return isFinite(n) && n >= 1 && n <= 6 ? Math.round(n * 100) / 100 : null; }

  function rankOf(o) { var r = toNum(pick(o, ["rang", "rank", "ordre", "position", "colonne", "col", "n"])); return isFinite(r) && r >= 1 && r <= 500 ? Math.floor(r) : null; }
  // Sans rang écrit, l'ordre du fichier (par branche) fait foi ; un rang écrit remet le compteur à sa valeur.
  function fillRanks(list, keyOf) {
    var cur = {};
    list.forEach(function (x) { var k = keyOf(x); if (x.rank == null) { cur[k] = (cur[k] || 0) + 1; x.rank = cur[k]; } else cur[k] = x.rank; });
  }
  function readModel(raw) {
    var o = raw, issues = [];
    function arr(keys) { var v = pick(o, keys); return Array.isArray(v) ? v : []; }
    var M = { profile: pick(o, ["profil", "profile"]) || null, s1End: null, notes: [], tas: [], exams: [], carried: [], goals: [], tp: [], issues: issues, undated: 0 };
    var s1 = pick(o, ["fin_semestre_1", "s1end", "fin_s1"]); if (s1) { var d = isoDate(s1); if (d) M.s1End = d; else issues.push("fin_semestre_1 ignorée : date illisible (" + s1 + ").") ; }
    arr(["notes", "grades"]).forEach(function (n, i) {
      var br = pick(n, ["branche", "subject", "matiere", "matière", "discipline"]), v = score(pick(n, ["note", "value", "valeur"])), where = "Note " + (i + 1) + (br ? " (" + br + ")" : "");
      if (br == null || br === "") { issues.push(where + " : branche manquante."); return; }
      if (v == null) { issues.push(where + " : note absente ou hors de l'échelle 1 à 6 (" + pick(n, ["note", "value", "valeur"]) + ")."); return; }
      var dt = isoDate(pick(n, ["date"])), c = toNum(pick(n, ["coef", "coefficient", "poids"])), t = String(pick(n, ["type"]) || "test").toLowerCase();
      if (dt === undefined) { issues.push(where + " : date illisible (" + pick(n, ["date"]) + "), traitée comme absente."); dt = null; }
      if (!isFinite(c) || c <= 0 || c > 10) c = 1;
      M.notes.push({ raw: String(br), rank: rankOf(n), value: v, date: dt, coef: Math.round(c * 10000) / 10000, type: t === "tp" ? "tp" : "test", label: String(pick(n, ["titre", "label", "libelle", "libellé"]) || "").slice(0, 60) });
    });
    arr(["ta", "tas"]).forEach(function (t, i) {
      var br = pick(t, ["branche", "subject", "matiere", "matière"]), label = String(pick(t, ["titre", "label", "nom"]) || "TA").slice(0, 50), pts = pick(t, ["en_points", "points"]) === true || String(pick(t, ["en_points"])).toLowerCase() === "true";
      var pct = toNum(pick(t, ["pct4", "pct", "pourcent4"])); if (!isFinite(pct) || pct < 10 || pct > 90) pct = 60;
      var etas = [], list = pick(t, ["etas", "eta"]); list = Array.isArray(list) ? list : [];
      list.forEach(function (e, j) {
        var dt = isoDate(pick(e, ["date"])), lab = String(pick(e, ["titre", "label"]) || "").slice(0, 60), w = "TA « " + label + " », ETA " + (j + 1) + " : ";
        if (dt === undefined) { issues.push(w + "date illisible, traitée comme absente."); dt = null; }
        if (pts) {
          var p = toNum(pick(e, ["points", "pts"])), m = toNum(pick(e, ["max", "maximum"]));
          if (!isFinite(p) || p < 0 || !isFinite(m) || m <= 0 || p > m) { issues.push(w + "points ou maximum invalides, ignoré."); return; }
          etas.push({ date: dt, pts: p, max: m, label: lab, rank: rankOf(e) });
        } else {
          var v = score(pick(e, ["note", "value", "valeur"]));
          if (v == null) { issues.push(w + "note absente ou hors de l'échelle, ignorée."); return; }
          etas.push({ date: dt, value: v, label: lab, rank: rankOf(e) });
        }
      });
      if (br == null || br === "") { issues.push("TA « " + label + " » : branche manquante."); return; }
      if (!etas.length) { issues.push("TA « " + label + " » : aucun ETA valide, ignoré."); return; }
      M.tas.push({ raw: String(br), label: label, points: pts, pct: pct, etas: etas });
    });
    arr(["objectifs", "goals"]).forEach(function (g) {
      var br = pick(g, ["branche", "subject"]), v = score(pick(g, ["objectif", "goal"]));
      if (br && v != null) M.goals.push({ raw: String(br), goal: v }); else issues.push("Objectif ignoré (branche ou valeur invalide).");
    });
    arr(["part_tp", "tp"]).forEach(function (g) {
      var br = pick(g, ["branche", "subject"]), v = toNum(pick(g, ["pourcent", "pct", "percent"]));
      if (br && isFinite(v) && v >= 0 && v <= 100) M.tp.push({ raw: String(br), pct: v }); else issues.push("Part des TP ignorée (branche ou valeur invalide).");
    });
    arr(["examens", "exams"]).forEach(function (g) {
      var br = pick(g, ["branche", "subject"]), w = score(pick(g, ["ecrit", "écrit", "w"])), oo = score(pick(g, ["oral", "o"]));
      if (br && (w != null || oo != null)) M.exams.push({ raw: String(br), w: w, o: oo }); else issues.push("Examen ignoré (branche ou notes invalides).");
    });
    arr(["reprises", "carried"]).forEach(function (g) {
      var br = pick(g, ["branche", "subject"]), v = score(pick(g, ["note", "value"]));
      if (br && v != null) M.carried.push({ raw: String(br), value: v }); else issues.push("Note reprise ignorée (branche ou valeur invalide).");
    });
    fillRanks(M.notes, function (n) { return norm(n.raw); });
    M.tas.forEach(function (t) { fillRanks(t.etas, function () { return "eta"; }); });
    M.notes.forEach(function (n) { if (!n.date) M.undated++; });
    M.tas.forEach(function (t) { t.etas.forEach(function (e) { if (!e.date) M.undated++; }); });
    return M;
  }

  /* ================= Profil du fichier ================= */
  function canon(list, v) { for (var i = 0; i < list.length; i++) if (String(list[i].id).toLowerCase() === String(v).toLowerCase()) return list[i].id; return null; }
  function readProfile(p) {
    var out = { problems: [], profile: null };
    if (!p || typeof p !== "object") return out;
    function g(keys) { return pick(p, keys); }
    var voie = String(g(["voie"]) || "mat").toLowerCase(); voie = voie === "ecg" ? "ecg" : "mat";
    var y = parseInt(g(["annee", "année", "year"]), 10), gy = g(["gymnase"]);
    var np = { v: 1, voie: voie, gymnase: canon(G.GYMNASES, gy) || "autre", year: y, classe: String(g(["classe"]) || "").slice(0, 8) };
    if (!(y >= 1 && y <= 3)) out.problems.push("année");
    function need(field, list, keys) { var v = canon(list, g(keys || [field])); if (v) np[field] = v; else out.problems.push(field); }
    if (voie === "mat") {
      need("l2", G.L2); need("l3", G.L3); need("math", G.MATH); need("art", G.ART); need("os", G.OS);
      if (y === 3) need("oc", G.OC);
    } else {
      var l2 = g(["l2"]), ex = G.ext({ voie: "ecg" });
      if (!ex) { out.problems.push("voie ECG pas encore chargée"); return out; }
      if (canon(ex.lists.l2, l2)) np.l2 = canon(ex.lists.l2, l2); else out.problems.push("l2");
      if (y >= 2) { var d = canon(ex.lists.domaine, g(["domaine"])); if (d) np.domaine = d; else out.problems.push("domaine"); }
      if (y >= 2 && np.domaine === "social") { var a = canon(ex.lists.art, g(["art"])); if (a) np.art = a; else out.problems.push("art"); }
      if (!out.problems.length && ex.blocked && np.domaine && ex.blocked("domaine", np.domaine, np)) out.problems.push("domaine incompatible avec la L2");
    }
    if (!out.problems.length) out.profile = np;
    return out;
  }

  /* ================= Reconnaissance des branches ================= */
  function norm(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9& ]+/g, " ").replace(/\s+/g, " ").trim(); }
  var ALIAS = { maths: "mathematiques", math: "mathematiques", mathe: "mathematiques", all: "allemand", deutsch: "allemand", ital: "italien", angl: "anglais", english: "anglais", fr: "francais", hist: "histoire", geo: "geographie",
    bio: "biologie", chim: "chimie", phys: "physique", info: "informatique", eco: "economie", philo: "philosophie", psy: "psychologie", socio: "sociologie", av: "arts visuels", mus: "musique",
    l2: "deuxieme langue", l3: "troisieme langue", os: "option specifique", oc: "option complementaire", tpl: "travail personnel", "e&d": "economie droit", ed: "economie droit", pam: "physique applications mathematiques", bc: "biologie chimie", pp: "philosophie psychologie" };
  var STOP = { de: 1, du: 1, des: 1, la: 1, le: 1, les: 1, et: 1, en: 1, au: 1, aux: 1, d: 1, l: 1 };
  function tokens(s) {
    var out = {}, n = 0;
    norm(s).split(" ").forEach(function (w) { (ALIAS[w] || w).split(" ").forEach(function (x) { if (x && !STOP[x]) { out[x.length > 4 && /[^s]s$/.test(x) ? x.slice(0, -1) : x] = 1; } }); });
    return out;
  }
  function size(o) { return Object.keys(o).length; }
  function resolve(raw, subs) {
    var r = norm(raw), i;
    for (i = 0; i < subs.length; i++) if (subs[i].id.toLowerCase() === String(raw).trim().toLowerCase()) return subs[i].id;
    for (i = 0; i < subs.length; i++) if (norm(subs[i].name) === r || (subs[i].short && norm(subs[i].short) === r)) return subs[i].id;
    var rt = tokens(raw), best = [], bs = 0;
    if (!size(rt)) return null;
    subs.forEach(function (s) {
      var st = tokens(s.name + " " + (s.id === "l2" || s.id === "l3" || s.id === "os" || s.id === "oc" ? s.id : "")), inter = 0;
      Object.keys(rt).forEach(function (k) { if (st[k]) inter++; });
      if (inter < size(rt)) return;                       // tous les mots du fichier doivent se retrouver dans la branche
      var sc = inter / size(st);
      if (sc > bs + 1e-9) { bs = sc; best = [s.id]; } else if (Math.abs(sc - bs) < 1e-9) best.push(s.id);
    });
    return best.length === 1 ? best[0] : null;
  }

  /* ================= Plan d'import ================= */
  var S = null;       // état de l'écran : { model, fileProfile, mode, map, start, end, align, text, root }
  function leaves(profile) { return G.build(profile).filter(function (s) { return !s.parts && !s.carried; }); }
  function targetProfile() {
    var cur = A.profile();
    if (!cur) return S.fileProfile.profile;
    if (S.mode === "replace" && S.fileProfile.profile) return S.fileProfile.profile;
    return cur;
  }
  function rawLabels() {
    var seen = {}, out = [];
    function add(r, kind) { if (!seen[r]) { seen[r] = { raw: r, n: 0 }; out.push(seen[r]); } seen[r].n++; }
    S.model.notes.forEach(function (n) { add(n.raw); }); S.model.tas.forEach(function (t) { add(t.raw); });
    S.model.goals.forEach(function (g) { add(g.raw); }); S.model.tp.forEach(function (g) { add(g.raw); });
    return out;
  }
  function mapOf(raw, subs) {
    if (Object.prototype.hasOwnProperty.call(S.map, raw)) return S.map[raw];
    var a = S.osAlias && S.osAlias[norm(raw)];
    if (a && subs.some(function (s) { return s.id === a; })) return a;     // « OS », « Option », ou le code de l'option du profil (PAM, BC…)
    return resolve(raw, subs);
  }
  /* --- Dates déduites de l'ordre : rang 1…K répartis à intervalle régulier entre le début de l'année et la dernière note --- */
  function p2(n) { return String(n).padStart(2, "0"); }
  function schoolStart() { var d = new Date(), y = d.getFullYear(); if (d < new Date(y, 7, 25)) y--; return y + "-08-25"; }
  function dayNum(iso) { var p = String(iso).split("-"); return Date.UTC(+p[0], +p[1] - 1, +p[2]) / 864e5; }
  function isoDay(n) { var d = new Date(n * 864e5); return d.getUTCFullYear() + "-" + p2(d.getUTCMonth() + 1) + "-" + p2(d.getUTCDate()); }
  function spread(rank, k) { var a = dayNum(S.start), b = dayNum(S.end); if (!(b > a)) b = a; return isoDay(Math.round(a + (b - a) * rank / Math.max(k, 1))); }
  function rankStats() {
    var all = 0, per = {};
    function see(raw, r) { var k = norm(raw); if (r > all) all = r; if (!per[k] || r > per[k]) per[k] = r; }
    S.model.notes.forEach(function (n) { see(n.raw, n.rank); });
    S.model.tas.forEach(function (t) { t.etas.forEach(function (e) { see(t.raw, e.rank); }); });
    return { all: all, per: per };
  }
  function key(g) { return [g.subject, g.date, g.value, g.coef, g.type, g.label || ""].join("|"); }
  function compile() {
    var prof = targetProfile(), subs = prof ? leaves(prof) : [], ids = {}; subs.forEach(function (s) { ids[s.id] = s; });
    var allS = prof ? G.build(prof) : [], comp = {}; allS.forEach(function (s) { if (s.parts && !s.carried) comp[s.id] = s; });
    var targets = subs.concat(Object.keys(comp).map(function (k) { return comp[k]; }));
    S.osAlias = {}; if (comp.os || ids.os) { S.osAlias.os = S.osAlias.option = S.osAlias["option specifique"] = "os"; if (prof && prof.os) S.osAlias[norm(prof.os)] = "os"; }
    var recs = [], skipped = 0, dup = 0, per = {}, deduced = {}, st = rankStats();
    function when(raw, date, rank) {
      if (date) return date;
      var d = spread(rank, S.align ? st.all : (st.per[norm(raw)] || 1));
      (deduced[raw] = deduced[raw] || []).push(d); return d;
    }
    function dest(raw) { var id = mapOf(raw, targets); if (!id) return []; if (comp[id]) return comp[id].parts.filter(function (p) { return ids[p]; }); return ids[id] ? [id] : []; }
    var have = {}; if (A.profile() && S.mode !== "replace") A.records().forEach(function (r) { if (r.kind !== "tadef") have[key(r)] = 1; });
    // Les notes passent dans l'ordre du fichier (rang), pour que les identifiants croissent avec l'ordre.
    var order = S.model.notes.map(function (n, i) { return { n: n, i: i }; }).sort(function (x, y) { return x.n.rank - y.n.rank || x.i - y.i; });
    order.forEach(function (o) {
      var n = o.n, ds = dest(n.raw); if (!ds.length) { skipped++; return; }
      var date = when(n.raw, n.date, n.rank);
      ds.forEach(function (id) {
        var g = { id: uid(), subject: id, value: n.value, coef: n.coef, type: n.type, date: date, label: n.label };
        if (have[key(g)]) { dup++; return; } have[key(g)] = 1; recs.push(g); per[id] = (per[id] || 0) + 1;
      });
    });
    var taCount = 0, etaCount = 0;
    S.model.tas.forEach(function (t) {
      var ds = dest(t.raw); if (!ds.length) { skipped++; return; }
      var dates = t.etas.slice().sort(function (x, y) { return x.rank - y.rank; }).map(function (e) { return { e: e, date: when(t.raw, e.date, e.rank) }; });
      ds.forEach(function (id) {
        var d = { id: uid(), kind: "tadef", subject: id, label: t.label, points: t.points, value: 0, coef: 0, date: dates[0].date };
        if (t.points) d.pct = t.pct;
        var etas = [];
        dates.forEach(function (x) {
          var e = x.e, g = { id: uid(), subject: id, ta: d.id, coef: 1, type: "ta", date: x.date, label: e.label };
          if (t.points) { g.pts = e.pts; g.max = e.max; g.value = Math.round(A.taScale(e.pts / e.max, t.pct / 100) * 100) / 100; } else g.value = e.value;
          if (have[key(g)]) { dup++; return; } have[key(g)] = 1; etas.push(g);
        });
        if (etas.length) { recs.push(d); etas.forEach(function (g) { recs.push(g); }); taCount++; etaCount += etas.length; per[id] = (per[id] || 0) + 1; }
      });
    });
    var goals = [], tps = [], exams = [], carried = [];
    S.model.goals.forEach(function (g) { var id = mapOf(g.raw, targets); if (id && (ids[id] || comp[id])) goals.push({ id: id, v: g.goal }); });
    S.model.tp.forEach(function (g) { dest(g.raw).forEach(function (id) { tps.push({ id: id, v: g.pct }); }); });
    // Examens et notes reprises : branches de l'année (y compris composées ou reprises), pas seulement les feuilles.
    var all = allS, aid = {}; all.forEach(function (s) { aid[s.id] = s; });
    function anyId(raw) { var id = mapOf(raw, all); return id && aid[id] ? id : null; }
    S.model.exams.forEach(function (e) { var id = anyId(e.raw); if (id) exams.push({ id: id, w: e.w, o: e.o }); });
    S.model.carried.forEach(function (e) { var id = anyId(e.raw); if (id) carried.push({ id: id, v: e.value }); });
    return { recs: recs, skipped: skipped, dup: dup, per: per, subs: subs, nTA: taCount, nETA: etaCount, goals: goals, tps: tps, exams: exams, carried: carried, prof: prof, targets: targets, comp: comp, deduced: deduced };
  }

  /* ================= Application ================= */
  function apply(plan) {
    var cur = A.profile(), fp = S.fileProfile.profile, replace = S.mode === "replace" && !!cur;
    var setProf = fp && (!cur || (S.mode === "replace" && JSON.stringify(Object.assign({}, fp, { classe: "" })) !== JSON.stringify(Object.assign({}, cur, { classe: "" }))));
    return Promise.resolve(setProf ? G.load(fp.voie) : null).then(function () {
      if (replace) A.remove(A.records().map(function (r) { return r.id; }));
      if (setProf) A.setProfile(Object.assign({ v: 1 }, fp));
      if (S.model.s1End && A.setS1End) A.setS1End(S.model.s1End);
      if (plan.recs.length) A.upsert(plan.recs);
      plan.goals.forEach(function (g) { A.setSubj(g.id, "goal", g.v); });
      plan.tps.forEach(function (g) { A.setSubj(g.id, "tp", g.v); });
      if ((plan.exams.length || plan.carried.length) && window.Cert && Cert.data) {
        var d = Cert.data(); d.exams = d.exams || {}; d.carried = d.carried || {};
        plan.exams.forEach(function (e) { var r = d.exams[e.id] = d.exams[e.id] || {}; if (e.w != null) r.w = e.w; if (e.o != null) r.o = e.o; });
        plan.carried.forEach(function (c) { d.carried[c.id] = c.v; });
        Cert.save(); A.redraw();
      }
    });
  }

  /* ================= Écrans ================= */
  function close() { if (!S || !S.root) return; var r = S.root; S.root = null; r.remove(); document.body.classList.remove("ob-open"); }
  /* Sous-pages de Réglages (choix A de l'utilisateur, 20 novembre 2026) : depuis Réglages, l'import n'est plus un écran
     plein à part. Ses deux écrans vivent dans deux blocs gardés (#imp-blk-start, #imp-blk-prev), que ios-settings.js
     place dans ses sous-pages « Importer » et « Aperçu » (comme Synchronisation) : barre « ‹ Réglages », glissement
     depuis la droite, retour par le chevron ou par balayage du bord gauche, barre du bas visible. Depuis Bienvenue
     (pas encore de Réglages), l'écran plein reste, avec un glissement entre ses deux écrans. */
  function blk(id) {
    var n = document.getElementById(id);
    if (!n) {
      n = document.createElement("div"); n.id = id; n.className = "ios-imp ios-imp-in";
      (document.getElementById("set-block") || document.body).appendChild(n);
      n.addEventListener("click", onClick); n.addEventListener("change", onChange); n.addEventListener("input", onInput);
    }
    return n;
  }
  function here(e) { if (S && S.inline && e.currentTarget && e.currentTarget.nodeType === 1) S.root = e.currentTarget; }
  function mount(html, which) {
    if (S.inline) { S.root = blk(which === "prev" ? "imp-blk-prev" : "imp-blk-start"); S.root.innerHTML = html; return; }
    var was = S.screen; S.screen = which || "start";
    if (S.root && was && was !== S.screen && !(window.FX && document.documentElement.classList.contains("noanim"))) {
      S.root.classList.remove("ios-imp-fwd", "ios-imp-bwd"); void S.root.offsetWidth;
      S.root.classList.add(S.screen === "start" ? "ios-imp-bwd" : "ios-imp-fwd");
    }
    if (!S.root) {
      var r = document.createElement("div"); r.className = "ob ios-imp"; r.setAttribute("role", "dialog"); r.setAttribute("aria-modal", "true"); r.setAttribute("aria-label", "Importer depuis un tableur");
      document.body.appendChild(r); document.body.classList.add("ob-open"); S.root = r;
      r.addEventListener("click", onClick); r.addEventListener("change", onChange); r.addEventListener("input", onInput);
    }
    S.root.innerHTML = html;
  }
  function topbar(back, title) {
    return '<div class="ob-top ob-top-c"><button type="button" class="ob-round" data-imp="' + (back ? "back" : "close") + '" aria-label="' + (back ? "Retour" : "Fermer") + '">' + Icons.svg(back ? "chevl" : "times") + '</button><b class="ob-bar-t">' + esc(title) + '</b><span class="ob-round-sp"></span></div>';
  }
  function screenStart(msg) {
    var hasProfile = !!A.profile(), canShare = !!navigator.share;
    mount((S.inline ? "" : topbar(false, "Importer")) +
      '<div class="ob-body">' + (S.inline ? "" : '<h1 class="ob-title">Importer depuis un tableur</h1>') + '<p class="ob-sub">Tu as déjà tes notes dans Excel, Google Sheets, un PDF ou une photo ? Une IA les range pour toi.</p>' +
      // Session B (choix de l'utilisateur) : sections titrées et lignes d'action en texte bleu, comme Réglages → Synchronisation.
      '<p class="ios-grp-head">Comment faire</p><div class="ob-list ob-recap">' +
      '<div class="ob-row ob-static"><span class="ob-txt"><span class="ob-n">1. Copie le prompt</span><span class="ob-s">' + (hasProfile ? "Il contient déjà tes branches : l'IA classe chaque note au bon endroit." : "Sans profil encore : le prompt générique demande d'abord ta voie, ton année et tes options.") + '</span></span></div>' +
      '<div class="ob-row ob-static"><span class="ob-txt"><span class="ob-n">2. Donne-le à une IA avec ton fichier</span><span class="ob-s">ChatGPT, Claude, Gemini… Réponds à ses questions éventuelles.</span></span></div>' +
      '<div class="ob-row ob-static"><span class="ob-txt"><span class="ob-n">3. Colle sa réponse ici</span><span class="ob-s">Tu verras un aperçu avant que quoi que ce soit change.</span></span></div></div>' +
      '<p class="ios-grp-head">Prompt</p><div class="ios-grp">' + (hasProfile ? '<button type="button" class="ios-row ios-act" data-imp="copy-perso">Copier le prompt pour mon profil</button>' : "") +
      '<button type="button" class="ios-row ios-act" data-imp="copy-gen">Copier le prompt générique</button>' +
      (canShare ? '<button type="button" class="ios-row ios-act" data-imp="share-gen">Partager le prompt générique…</button>' : "") + '</div>' +
      '<p class="ios-grp-foot" id="imp-msg">' + esc(msg || "") + '</p>' +
      '<p class="ios-grp-head">Réponse de l\'IA</p><div class="ios-grp ios-imp-ans"><textarea id="imp-ta" class="ios-imp-ta" rows="7" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="Réponse de l\'IA (le JSON)" placeholder="{ &quot;format&quot;: &quot;notes-import&quot;, … }">' + esc(S.text || "") + '</textarea>' +
      '<button type="button" class="ios-row ios-act" data-imp="paste">Coller depuis le presse-papiers</button><button type="button" class="ios-row ios-act" data-imp="file">Choisir un fichier .json ou .txt</button>' +
      '<input type="file" id="imp-file" accept=".json,.txt,application/json,text/plain" hidden></div>' +
      '<p class="ios-grp-foot"><b>Confidentialité.</b> Ton fichier est envoyé à l\'IA que tu choisis, pas à cette app : retire noms et numéros avant de l\'envoyer. L\'import lui-même se fait sur ton appareil.</p></div>' +
      foot('<button type="button" class="btn ob-next" data-imp="read"' + ((S.text || "").trim() ? "" : " disabled") + '>Lire la réponse</button>'), "start");
  }
  // Bouton qui fait avancer : collé en bas dans l'écran plein ; à la fin de la page dans Réglages (la barre du bas reste dessous).
  function foot(btn) { return '<div class="' + (S.inline ? "ios-imp-go" : "ob-foot") + '">' + btn + "</div>"; }
  function say(t, bad) { var m = $("#imp-msg", S.root); if (m) { m.textContent = t; m.style.color = bad ? "var(--ios-red-text)" : ""; } }

  function shortDate(iso) { var p = String(iso).split("-"); return p[2] + "." + p[1]; }
  function screenPreview() {
    var keep = S.root && $(".ob-body", S.root), top = keep ? keep.scrollTop : 0;
    var plan = compile(), cur = A.profile(), M = S.model, labels = rawLabels(), subs = plan.subs, fp = S.fileProfile;
    var needProfile = !cur && !fp.profile, undated = M.undated;
    var rows = labels.map(function (l) {
      var id = mapOf(l.raw, plan.targets), shown = "Ignorer", opts = '<option value="">Ignorer</option>' + plan.targets.map(function (s) {
        var nm = s.name + (plan.comp[s.id] ? " (les deux parties)" : ""); if (s.id === id) shown = nm;
        return '<option value="' + esc(s.id) + '"' + (s.id === id ? " selected" : "") + ">" + esc(nm) + "</option>"; }).join("");
      // Menu iOS (session B, choix A) : la valeur en gris et ⌃⌄ ; le <select> natif, invisible, couvre la ligne et ouvre la liste du téléphone.
      return '<label class="ob-row ob-static ios-imp-map"><span class="ob-txt"><span class="ob-n">' + esc(l.raw) + '</span><span class="ob-s">' + (id ? "reconnue" : "à choisir") + " · " + plural(l.n, "ligne", "lignes") + '</span></span>' +
        '<span class="ios-imp-val">' + esc(shown) + '</span>' + Icons.svg("updown", "ios-imp-ud") + '<select class="ios-imp-sel" data-map="' + esc(l.raw) + '" aria-label="Branche pour ' + esc(l.raw) + '">' + opts + "</select></label>";
    }).join("");
    var summary = [plural(plan.recs.filter(function (r) { return r.kind !== "tadef" && !r.ta; }).length, "note", "notes")];
    if (plan.nTA) summary.push(plural(plan.nTA, "TA", "TA") + " (" + plural(plan.nETA, "ETA", "ETA") + ")");
    if (plan.exams.length) summary.push(plural(plan.exams.length, "examen", "examens"));
    if (plan.carried.length) summary.push(plural(plan.carried.length, "note reprise", "notes reprises"));
    if (plan.goals.length) summary.push(plural(plan.goals.length, "objectif", "objectifs"));
    var profLine = "";
    if (fp.profile) {
      var vx = G.ext(fp.profile), same = cur && JSON.stringify(Object.assign({}, fp.profile, { classe: "" })) === JSON.stringify(Object.assign({}, cur, { classe: "" }));
      profLine = '<p class="ob-sub"><b>Profil du fichier :</b> ' + esc(profileSummary(fp.profile)) + (same ? " (identique au tien)." : cur ? (S.mode === "replace" ? " Il remplacera ton profil actuel." : " Ignoré en mode Ajouter : ton profil reste le même.") : " Il sera créé.") + "</p>";
    } else if (S.model.profile && fp.problems.length) profLine = '<p class="ob-warn">Profil du fichier ignoré : ' + esc(fp.problems.join(", ")) + (cur ? "." : " manquant ou invalide.") + "</p>";
    var modeRows = cur && A.records().length ? '<p class="ios-grp-head">Que faire de tes notes actuelles ?</p><div class="ob-list" role="radiogroup">' +
      ["add|Ajouter|Les notes importées s'ajoutent. Les doublons exacts sont ignorés.", "replace|Remplacer|Toutes tes notes actuelles (et leurs photos) sont supprimées, puis les notes importées arrivent."].map(function (x) {
        x = x.split("|"); var on = S.mode === x[0];
        return '<button type="button" class="ob-row' + (on ? " on" : "") + '" data-imp="mode:' + x[0] + '" role="radio" aria-checked="' + on + '"><span class="ob-txt"><span class="ob-n">' + x[1] + '</span><span class="ob-s">' + x[2] + '</span></span><svg class="ob-chk" viewBox="0 0 24 24" aria-hidden="true">' + Icons.inner.check + "</svg></button>";
      }).join("") + "</div>" : "";
    var datePart = "";
    if (undated) {
      var dl = Object.keys(plan.deduced).map(function (k) { var a = plan.deduced[k]; return "<li>" + esc(k) + " : " + a.slice(0, 12).map(shortDate).join(" · ") + (a.length > 12 ? " …" : "") + "</li>"; }).join("");
      datePart = '<p class="ios-grp-head">Dates des notes sans date</p><div class="ios-grp">' +
        '<label class="ios-row ios-imp-date"><span class="ios-row-l">Début de l\'année</span><input type="date" id="imp-start" value="' + esc(S.start) + '"></label>' +
        '<label class="ios-row ios-imp-date"><span class="ios-row-l">Date de la dernière note</span><input type="date" id="imp-end" value="' + esc(S.end) + '"></label></div>' +
        '<p class="ios-grp-foot">' + plural(undated, "ligne n\'a pas de date", "lignes n\'ont pas de date") + " : l'app les place dans l'ordre du fichier, à intervalle régulier.</p>" +
        '<p class="ios-grp-head">Colonnes du tableau</p><div class="ob-list" role="radiogroup">' + ["1|Même colonne, même date|Le rang 3 tombe le même jour dans toutes les branches (tableau à colonnes communes).", "0|Chaque branche à son rythme|Les notes de chaque branche sont étalées sur toute la période."].map(function (x) {
          x = x.split("|"); var on = (S.align ? "1" : "0") === x[0];
          return '<button type="button" class="ob-row' + (on ? " on" : "") + '" data-imp="align:' + x[0] + '" role="radio" aria-checked="' + on + '"><span class="ob-txt"><span class="ob-n">' + x[1] + '</span><span class="ob-s">' + x[2] + '</span></span><svg class="ob-chk" viewBox="0 0 24 24" aria-hidden="true">' + Icons.inner.check + "</svg></button>";
        }).join("") + "</div>" + (dl ? '<details class="ios-imp-iss"><summary>Dates déduites</summary><ul>' + dl + "</ul></details>" : "");
    }
    var issues = M.issues.slice(); if (plan.skipped) issues.unshift(plural(plan.skipped, "ligne", "lignes") + " sans branche : choisis une branche ci-dessus ou laisse « Ignorer ».");
    if (plan.dup) issues.unshift(plural(plan.dup, "note identique", "notes identiques") + " déjà dans l'app : ignorées.");
    var issueHtml = issues.length ? '<details class="ios-imp-iss"><summary>' + plural(issues.length, "remarque", "remarques") + '</summary><ul>' + issues.slice(0, 40).map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + (issues.length > 40 ? "<li>… et " + (issues.length - 40) + " autres.</li>" : "") + "</ul></details>" : "";
    var nothing = !plan.recs.length && !plan.exams.length && !plan.carried.length && !plan.goals.length && !plan.tps.length && !fp.profile;
    mount((S.inline ? "" : topbar(true, "Aperçu")) + '<div class="ob-body">' + (S.inline ? "" : '<h1 class="ob-title">Vérifie l\'import</h1>') + '<p class="ob-sub">' + esc(summary.join(" · ")) + (plan.prof ? "" : "") + '</p>' + profLine +
      (needProfile ? '<p class="ob-warn">Le fichier ne contient pas de profil complet et tu n\'as pas encore configuré l\'app : demande à l\'IA de remplir « profil » (le prompt générique le fait), ou configure ton profil d\'abord.</p>' : "") +
      modeRows + (rows ? '<p class="ios-grp-head">Branches du fichier</p><div class="ob-list ob-recap">' + rows + "</div>" : "") + datePart + issueHtml + "</div>" +
      foot('<button type="button" class="btn ob-next" data-imp="go"' + (needProfile || nothing ? " disabled" : "") + ">" + (S.mode === "replace" && cur && A.records().length ? "Remplacer et importer" : "Importer") + "</button>"), "prev");
    var nb = $(".ob-body", S.root); if (nb && top) nb.scrollTop = top;
  }
  function screenDone(plan) {
    var n = plan.recs.filter(function (r) { return r.kind !== "tadef" && !r.ta; }).length;
    mount('<div class="ob-body"><div class="ob-hero"><div class="ob-gi">' + Icons.svg("check") + '</div><h1>C\'est importé</h1><p>' + plural(n, "note", "notes") + (plan.nTA ? ", " + plural(plan.nTA, "TA", "TA") + " (" + plural(plan.nETA, "ETA", "ETA") + ")" : "") + (plan.exams.length ? ", " + plural(plan.exams.length, "examen", "examens") : "") +
      ' sont dans ton tableau de bord. Vérifie quelques moyennes avec ton bulletin : seul lui fait foi.</p></div></div>' + foot('<button type="button" class="btn ob-next" data-imp="finish">Voir mon tableau de bord</button>'), "prev");
  }

  /* ================= Événements ================= */
  function readText() {
    var text = S.text; S.fileProfile = { problems: [], profile: null };
    var model; try { model = readModel(lenientJSON(text)); } catch (e) { say(e.message, true); hap("error"); return Promise.resolve(false); }
    S.model = model;
    var p = model.profile, voie = p && String(pick(p, ["voie"]) || "mat").toLowerCase() === "ecg" ? "ecg" : "mat";
    return Promise.resolve(voie === "ecg" ? G.load("ecg") : null).then(function () {
      S.fileProfile = readProfile(model.profile); S.map = {}; S.mode = A.profile() && A.records().length ? "add" : "replace";
      if (!model.notes.length && !model.tas.length && !model.exams.length && !model.carried.length && !model.goals.length && !model.tp.length && !S.fileProfile.profile) { say("Le JSON est valide, mais il ne contient ni note, ni TA, ni profil.", true); return false; }
      screenPreview(); if (S.inline && window.IOSSettings && IOSSettings.current() !== "importp") IOSSettings.push("importp"); return true;
    }, function () { say("La voie « culture générale » doit se charger : connecte-toi à Internet, puis réessaie.", true); return false; });
  }
  function onClick(e) {
    here(e);
    var b = e.target.closest("[data-imp]"); if (!b) return;
    var a = b.dataset.imp;
    if (a === "close") { close(); return; }
    if (a === "back") { screenStart(); return; }
    if (a === "copy-perso") { copy(personalPrompt()).then(function () { say("Prompt copié : colle-le dans ton IA, avec ton fichier.", false); hap("success"); }, function () { say("Impossible de copier automatiquement.", true); }); return; }
    if (a === "copy-gen") { genericPrompt().then(copy).then(function () { say("Prompt générique copié : colle-le dans ton IA, avec ton fichier.", false); hap("success"); }, function () { say("Impossible de copier automatiquement.", true); }); return; }
    if (a === "share-gen") { genericPrompt().then(function (t) { return navigator.share({ title: "Prompt d'import Notes", text: t }); }).catch(function () {}); return; }
    if (a === "paste") {
      if (!navigator.clipboard || !navigator.clipboard.readText) { say("Ton navigateur ne permet pas de coller automatiquement : colle dans le champ.", true); return; }
      navigator.clipboard.readText().then(function (t) { S.text = t; var ta = $("#imp-ta", S.root); if (ta) ta.value = t; var n = $(".ob-next", S.root); if (n) n.disabled = !t.trim(); }, function () { say("Colle la réponse directement dans le champ.", true); });
      return;
    }
    if (a === "file") { $("#imp-file", S.root).click(); return; }
    if (a === "read") { S.text = $("#imp-ta", S.root).value; readText(); return; }
    if (a.indexOf("mode:") === 0) { S.mode = a.slice(5); screenPreview(); return; }
    if (a.indexOf("align:") === 0) { S.align = a.slice(6) === "1"; screenPreview(); return; }
    if (a === "go") {
      var plan = compile();
      var nOld = A.records().filter(function (r) { return r.kind !== "tadef"; }).length;
      var ask = S.mode === "replace" && A.profile() && A.records().length ?
        IOSSheet.confirm({ title: "Remplacer tes " + nOld + " note" + (nOld > 1 ? "s" : "") + " ?", message: "Elles sont remplacées par celles du fichier, et leurs photos sont supprimées. Cette action ne s'annule pas : exporte d'abord une sauvegarde si tu hésites.", ok: "Remplacer et importer" }) : Promise.resolve(true);
      ask.then(function (ok) {
        if (!ok) return;
        b.disabled = true;
        apply(plan).then(function () { hap("success"); S.plan = plan; screenDone(plan); }, function () { b.disabled = false; IOSSheet.notice({ title: "Import impossible", message: "La voie demandée n'a pas pu se charger (connexion ?). Rien n'a été modifié." }); });
      });
      return;
    }
    if (a === "finish") {
      var cb = S.onDone;
      if (S.inline) { if (window.IOSSettings) IOSSettings.root(); } else close();
      // Onglet Accueil (FX.view ne fait que replacer la pastille de la barre).
      var tab = document.querySelector('#tabbar [data-tab="dash"]'); if (tab) tab.click();
      if (cb) cb();
    }
  }
  function onChange(e) {
    here(e);
    var t = e.target;
    if (t.id === "imp-file" && t.files && t.files[0]) {
      var f = t.files[0]; if (f.size > 2e6) { say("Ce fichier est trop gros pour être un JSON de notes.", true); return; }
      var r = new FileReader(); r.onload = function () { S.text = String(r.result || ""); var ta = $("#imp-ta", S.root); if (ta) ta.value = S.text; var n = $(".ob-next", S.root); if (n) n.disabled = !S.text.trim(); readText(); };
      r.readAsText(f); return;
    }
    if (t.dataset && t.dataset.map != null) { S.map[t.dataset.map] = t.value || null; screenPreview(); return; }
    if ((t.id === "imp-start" || t.id === "imp-end") && t.value) { if (t.id === "imp-start") S.start = t.value; else S.end = t.value; screenPreview(); }
  }
  function onInput(e) { here(e); var t = e.target; if (t.id === "imp-ta") { S.text = t.value; var n = $(".ob-next", S.root); if (n) n.disabled = !t.value.trim(); } }

  function open(opts) {
    opts = opts || {};
    if (S && S.root && !S.inline) return;
    S = fresh(opts);
    screenStart();
    // Retour par balayage du bord gauche dans l'écran plein (Bienvenue) : depuis l'Aperçu, revient au premier écran.
    var x0 = null, y0 = 0, r = S.root;
    r.addEventListener("touchstart", function (e) { var t = e.touches[0]; x0 = e.touches.length === 1 && t.clientX <= 24 && S.screen === "prev" ? t.clientX : null; y0 = t.clientY; }, { passive: true });
    r.addEventListener("touchmove", function (e) {
      if (x0 == null) return; var t = e.touches[0], dx = t.clientX - x0, dy = t.clientY - y0;
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { x0 = null; return; }
      if (dx > 60) { x0 = null; hap("tap"); screenStart(); }
    }, { passive: true });
  }
  function fresh(opts) {
    return { text: "", model: null, fileProfile: { problems: [], profile: null }, mode: "add", map: {}, start: schoolStart(), end: today(), align: true, root: null, onDone: (opts && opts.onDone) || null, inline: false, screen: null };
  }
  // Depuis Réglages : prépare le premier écran dans son bloc ; ios-settings.js pousse ensuite la sous-page « Importer ».
  function inline() {
    if (S && S.root && !S.inline) return false;
    S = fresh(); S.inline = true;
    var old = document.getElementById("imp-blk-prev"); if (old) old.innerHTML = "";
    screenStart(); return true;
  }
  window.Import = { open: open, inline: inline, personalPrompt: personalPrompt, genericPrompt: genericPrompt, parse: function (t) { return readModel(lenientJSON(t)); }, resolve: resolve };
})();
