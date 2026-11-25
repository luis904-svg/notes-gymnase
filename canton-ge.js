/* Notes — canton de Genève : Collège de Genève (maturité gymnasiale, 4 ans) et École de culture générale (ECG, 3 ans).
   Chargé seulement pour un profil genevois (grid.js : clés « ge-mat » et « ge-ecg »), jamais dans ASSETS de sw.js.
   Sources (lues en entier, versions consolidées SILGENEVE) : RGymCG rsGE C 1 10.71 (13.03.2024), RECG rsGE C 1 10.70 (17.08.2026),
   REST rsGE C 1 10.31 ; grille horaire du Collège (brochure d'octobre 2025, p. 15) ; mémentos 2025-2026 des collèges de Candolle
   (composition des notes de semestre) et Rousseau ; mémento 2026-2027 de l'ECG Ella-Maillart ; présentation ECG 2026-2027.
   Calculs vérifiés sur des documents réels (bulletins et procès-verbal cités dans les arrêts ATA/999/2018, A/2569/2025, A/3531/2019).
   Recherches : reports/Genève maturité et ECG.md.
   Ce qu'il change dans le moteur (crochets de build.py, sans effet hors de Genève) :
   - moyenne d'une branche : semestres au dixième, de même poids ; dans un semestre, travaux arrondis au dixième puis combinés avec
     l'épreuve regroupée (type « tp » du formulaire, nommé ER) ; à l'ECG en 1re et 2e, épreuve de fin d'année (EFA) pour 1/3 de l'année ;
     note composée = moyenne pondérée des notes annuelles des composantes, au dixième ;
   - note de bulletin au dixième (pas au demi-point), arrondie au plus proche ;
   - promotion par tolérance, certificat de maturité (4e) et certificat ECG (3e). */
(function () {
  "use strict";
  var G = window.Grid; if (!G) return;
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function find(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
  function r1(x) { return x == null ? null : Math.floor(x * 10 + 0.5 + 1e-9) / 10; }      // au dixième, demi vers le haut (2,55 → 2,6)
  function half(x) { return x == null ? null : Math.floor(x * 2 + 0.5 + 1e-9) / 2; }
  function num(v) { var n = parseFloat(String(v).replace(",", ".")); return isFinite(n) && n >= 1 && n <= 6 ? n : null; }
  function fmt(n) { return n == null ? "–" : (Number.isInteger(n) ? String(n) : n.toFixed(1)); }
  function f1(n) { return n == null ? "–" : n.toFixed(1); }
  function ord(y) { return y + (y === 1 ? "re" : "e"); }
  function app() { return window.NotesApp; }
  function store() { return window.Cert && Cert.data ? Cert.data() : { exams: {}, carried: {} }; }
  function isECG(p) { return p && p.voie === "ecg"; }

  /* ================= Listes ================= */
  var COLLEGES = [
    { id: "calvin", name: "Collège Calvin", city: "Genève" },
    { id: "candolle", name: "Collège de Candolle", city: "Chêne-Bourg" },
    { id: "claparede", name: "Collège Claparède", city: "Conches" },
    { id: "rousseau", name: "Collège Rousseau", city: "Genève" },
    { id: "saussure", name: "Collège de Saussure", city: "Petit-Lancy" },
    { id: "sismondi", name: "Collège Sismondi", city: "Genève" },
    { id: "voltaire", name: "Collège Voltaire", city: "Genève" },
    { id: "chavanne", name: "CEC André-Chavanne", city: "Genève" },
    { id: "gourd", name: "CEC Emilie-Gourd", city: "Genève" },
    { id: "stael", name: "CECG Madame-de-Staël", city: "Carouge" },
    { id: "autre", name: "Autre collège", city: "" }
  ];
  var ECGS = [
    { id: "dunant", name: "ECG Henry-Dunant", city: "Genève" },
    { id: "maillart", name: "ECG Ella-Maillart", city: "Genève" },
    { id: "piaget", name: "ECG Jean-Piaget", city: "Genève" },
    { id: "stael", name: "CECG Madame-de-Staël", city: "Carouge" },
    { id: "stitelmann", name: "ECCG Aimée-Stitelmann", city: "Plan-les-Ouates" },
    { id: "autre", name: "Autre école", city: "" }
  ];
  // Collège (brochure p. 7-8 ; RGymCG art. 4-5)
  var C_L2 = [{ id: "de", name: "Allemand", short: "All." }, { id: "it", name: "Italien", short: "Ital." }];
  var C_L3 = [{ id: "de", name: "Allemand", short: "All." }, { id: "it", name: "Italien", short: "Ital." }, { id: "en", name: "Anglais", short: "Angl." },
    { id: "la", name: "Latin", short: "Lat.", sub: "si tu l'as suivi au cycle d'orientation" }];
  var C_MATH = [{ id: "std", name: "Niveau normal (MA1)", sub: "4 périodes chaque année" }, { id: "renf", name: "Niveau avancé (MA2)", sub: "4, 4, puis 6 périodes" }];
  var C_ART = [{ id: "av", name: "Arts visuels", short: "AV" }, { id: "mu", name: "Musique", short: "Mus." }];
  var LANG_P = { de: [3, 3, 3, 3], it: [4, 3, 3, 3], en: [3, 3, 3, 3], la: [3, 3, 3, 3] };
  // OS : [id composante, nom, clé de discipline (poids de l'ER), périodes 1re-4e, poids dans la note]
  var C_OS = [
    { id: "DE", name: "Allemand", lang: "de", periods: [3, 4, 4, 5] },
    { id: "EN", name: "Anglais", lang: "en", periods: [3, 4, 4, 5] },
    { id: "ES", name: "Espagnol", lang: "es", periods: [3, 4, 4, 5], sub: "seulement en option spécifique" },
    { id: "IT", name: "Italien", lang: "it", periods: [4, 4, 4, 5] },
    { id: "LA", name: "Latin", lang: "la", periods: [3, 4, 4, 5] },
    { id: "GR", name: "Grec", lang: "gr", periods: [4, 4, 5, 5], sub: "seulement en option spécifique" },
    { id: "BC", name: "Biologie et chimie", parts: [["osbio", "Biologie OS", "bi", [2, 2, 3, 4], 1], ["oschi", "Chimie OS", "ch", [2, 2, 3, 3], 1]] },
    { id: "PAM", name: "Physique et applications des mathématiques", sub: "impose les maths avancées (MA2)", parts: [["osphy", "Physique OS", "ph", [2, 4, 4, 4], 2], ["appl", "Applications des maths", "am", [0, 0, 2, 2], 1]] },
    { id: "ED", name: "Économie et droit", parts: [["oseco", "Économie OS", "ed", [2, 2, 2, 4], 1], ["osdroit", "Droit OS", "ed", [2, 2, 2, 3], 1]] },
    { id: "AV", name: "Arts visuels", sub: "avec arts visuels en discipline fondamentale", parts: [["osap", "Arts plastiques OS", "ap", [2, 4, 4, 6], 2], ["osha", "Histoire de l'art OS", "haos", [2, 2, 2, 2], 1]] },
    { id: "MU", name: "Musique", sub: "avec musique en discipline fondamentale", parts: [["osmus", "Musique OS", "mu", [3, 5, 5, 5], 2], ["osins", "Pratique instrumentale", "ins", [1, 1, 1, 1], 1]] }
  ];
  var C_OC = [
    { id: "AM", name: "Applications des mathématiques" }, { id: "INFO", name: "Informatique" }, { id: "PHYS", name: "Physique" },
    { id: "CH", name: "Chimie" }, { id: "BIO", name: "Biologie" }, { id: "ED", name: "Économie et droit" }, { id: "HIST", name: "Histoire" },
    { id: "GEO", name: "Géographie" }, { id: "PHILO", name: "Philosophie" }, { id: "AV", name: "Arts visuels" }, { id: "MU", name: "Musique" }, { id: "SPORT", name: "Sport" }
  ];
  // Une même discipline ne peut pas être en OS et en OC ; OS artistique : ni OC arts visuels, ni musique, ni sport (RGymCG art. 5 al. 4).
  var OC_EXCLUDED = { PAM: ["AM", "PHYS"], BC: ["BIO", "CH"], ED: ["ED"], AV: ["AV", "MU", "SPORT"], MU: ["AV", "MU", "SPORT"] };

  // ECG (RECG art. 6, 9, 10 ; présentation ECG 2026-2027)
  var E_LANG = [{ id: "de", name: "Allemand", short: "All." }, { id: "en", name: "Anglais", short: "Angl." }, { id: "it", name: "Italien", short: "Ital." }];
  var E_DOM = [
    { id: "sa", name: "Santé" }, { id: "ts", name: "Travail social" }, { id: "pe", name: "Pédagogie", sub: "allemand et anglais obligatoires" },
    { id: "ci", name: "Communication et information" }, { id: "ad", name: "Arts et design" }, { id: "mu", name: "Musique" }, { id: "th", name: "Théâtre" }
  ];
  var E_SCI = [{ id: "bio", name: "Biologie et science de l'environnement" }, { id: "chi", name: "Chimie" }, { id: "phy", name: "Physique" }];
  var E_ART = [{ id: "dap", name: "Dessin-arts plastiques" }, { id: "adr", name: "Art dramatique" }, { id: "mus", name: "Musique" }];
  function eArt(p) { return p && p.domaine === "pe" ? E_ART.filter(function (a) { return a.id !== "adr"; }) : E_ART; }
  function needSci(p) { return isECG(p) && p.year >= 2 && ["ad", "mu", "th", "ci", "ts"].indexOf(p.domaine) >= 0; }
  function needArt(p) { return isECG(p) && p.year >= 2 && ["ci", "sa", "ts", "pe"].indexOf(p.domaine) >= 0; }

  /* ================= Poids de l'épreuve regroupée (mémento du Collège de Candolle 2025-2026, § 4.6) =================
     Chaque groupe de discipline fixe ce poids entre 1/3 et 2/3 (mémento Rousseau) : valeur par défaut, modifiable dans Réglages. */
  function erShare(k, y) {
    if (["fr", "de", "it", "en", "la", "es", "gr", "ap", "haos"].indexOf(k) >= 0) return y <= 2 ? 1 / 3 : 0.5;
    if (k === "phi") return 2 / 3;
    if (k === "ph") return 1 / 3;
    if (k === "ha" || k === "ep" || k === "tm" || k === "ins" || k === "sport") return 0;
    return 0.5;
  }

  /* ================= Grilles ================= */
  function buildCollege(p) {
    var y = Math.min(4, Math.max(1, p.year | 0)), Y = y - 1, out = [];
    function leaf(o, k) { o.hasTP = erShare(k, y) > 0; o.tpShare = erShare(k, y); return o; }
    function add(o, periods, k) {
      if (!periods[Y]) return null;
      o.periods = periods[Y]; if (o.counts === undefined) o.counts = true;
      if (!o.parts) leaf(o, k);
      out.push(o); return o;
    }
    function parts(o, list) {
      o.parts = [];
      list.forEach(function (c) {
        if (!c[3][Y]) return;
        o.parts.push(c[0]);
        out.push(leaf({ id: c[0], name: c[1], periods: c[3][Y], part: true, w: c[4] }, c[2]));
      });
      return o;
    }
    var l2 = find(C_L2, p.l2) || C_L2[0], l3 = find(C_L3, p.l3) || C_L3[2], renf = p.math === "renf", art = find(C_ART, p.art) || C_ART[0];
    var os = find(C_OS, p.os), oc = find(C_OC, p.oc);
    add({ id: "fr", name: "Français", short: "Fr.", group: "fr" }, [6, 4, 4, 4], "fr");
    add({ id: "l2", name: l2.name + " (L2)", short: l2.short, group: "l2" }, LANG_P[l2.id], l2.id);
    add({ id: "l3", name: l3.name + " (L3)", short: l3.short, group: "l3" }, LANG_P[l3.id], l3.id);
    add({ id: "ma", name: "Mathématiques (" + (renf ? "avancé" : "normal") + ")", short: "Maths", group: "maths" }, renf ? [4, 4, 6, 6] : [4, 4, 4, 4], "ma");
    if (os) {
      var tot = os.parts ? os.parts.reduce(function (t, c) { return t + c[3][Y]; }, 0) : os.periods[Y];
      var o = { id: "os", name: "OS " + os.name, short: "OS", group: "os", periods: tot, counts: true };
      if (os.parts) { out.push(o); parts(o, os.parts.map(function (c) { return c[0] === "osphy" ? [c[0], c[1], c[2], c[3], y <= 2 ? 1 : 2] : c; })); }
      else { leaf(o, os.lang); out.push(o); }
    }
    if (y < 4) {
      add({ id: "ph", name: "Physique", short: "Phys." }, [0, 3, 2, 0], "ph");
      add({ id: "bi", name: "Biologie", short: "Bio." }, [0, 2, 2, 0], "bi");
      add({ id: "ch", name: "Chimie", short: "Chim." }, [2, 2, 0, 0], "ch");
    }
    add({ id: "hi", name: "Histoire", short: "Hist." }, [2, 2, 2, 2], "hi");
    add({ id: "ge", name: "Géographie", short: "Géo." }, [0, 2, 2, 2], "ge");
    add({ id: "phi", name: "Philosophie", short: "Philo" }, [0, 0, 2, 2], "phi");
    if (y <= 2) {
      if (art.id === "av") { var a = add({ id: "art", name: "Arts visuels", short: "AV", parts: [] }, [3, 3, 0, 0]); a.parts = null; parts(a, [["ap", "Arts plastiques", "ap", [2, 2, 0, 0], 2], ["ha", "Histoire de l'art", "ha", [1, 1, 0, 0], 1]]); }
      else add({ id: "art", name: "Musique", short: "Mus." }, [2, 2, 0, 0], "mu");
    }
    if (y === 1) { var ied = add({ id: "ied", name: "Introduction à l'économie et au droit", short: "IED", parts: [] }, [2, 0, 0, 0]); ied.parts = null;
      parts(ied, [["ieco", "Économie (introduction)", "ed", [1, 0, 0, 0], 1], ["idroit", "Droit (introduction)", "ed", [1, 0, 0, 0], 1]]); }
    add({ id: "info", name: "Informatique", short: "Info." }, [2, 1, 1, 0], "info");
    add({ id: "ep", name: "Éducation physique", short: "EP" }, [2, 2, 2, 0], "ep");
    if (oc && y >= 3) add({ id: "oc", name: "OC " + oc.name, short: "OC" }, [0, 0, 2, 2], oc.id === "SPORT" ? "sport" : "oc");
    if (y === 4) {
      add({ id: "tm", name: "Travail de maturité", short: "TM" }, [0, 0, 0, 1], "tm");
      // Notes de maturité des disciplines terminées (RGymCG art. 51 al. 3) : reprises de l'année indiquée.
      [["ph", "Physique", "Phys.", 3], ["ch", "Chimie", "Chim.", 2], ["bi", "Biologie", "Bio.", 3], ["art", art.name, art.short, 2]].forEach(function (c) {
        out.push({ id: c[0], name: c[1], short: c[2], periods: 0, counts: true, carried: true, from: c[3], tpShare: 0 });
      });
    }
    return out;
  }

  function buildEcg(p) {
    var y = Math.min(3, Math.max(1, p.year | 0)), dom = y > 1 && find(E_DOM, p.domaine) ? p.domaine : null, out = [];
    var efa = y <= 2;   // épreuves de fin d'année en 1re et 2e (1/3 de la note annuelle, mémento Ella-Maillart § 13.1)
    function leaf(o) { o.hasTP = efa; o.tpShare = efa ? 1 / 3 : 0; o.efa = efa; return o; }
    function add(o) { if (o.counts === undefined) o.counts = true; if (!o.parts) leaf(o); out.push(o); return o; }
    // parts : [id, nom, périodes, poids]
    function group(id, name, short, list, o) {
      var g = add(Object.assign({ id: id, name: name, short: short, periods: list.reduce(function (t, c) { return t + c[2]; }, 0), parts: list.map(function (c) { return c[0]; }) }, o || {}));
      list.forEach(function (c) { out.push(leaf({ id: c[0], name: c[1], periods: c[2], part: true, w: c[3] })); });
      return g;
    }
    function carried(id, name, from, src) { out.push({ id: id, name: name, periods: 0, counts: true, carried: true, from: from, src: src || id, tpShare: 0 }); }
    var l2 = find(E_LANG, p.l2) || E_LANG[0], l3 = find(E_LANG, p.l3) || E_LANG[1];
    var sci = find(E_SCI, p.sci) || E_SCI[0], art = find(E_ART, p.art) || E_ART[0];
    add({ id: "fr", name: "Français", short: "Fr.", periods: 5 });
    add({ id: "l2", name: l2.name + " (langue 1)", short: l2.short, periods: y === 1 ? 4 : 3 });
    add({ id: "l3", name: l3.name + " (langue 2)", short: l3.short, periods: y === 1 ? 4 : 3 });
    add({ id: "ma", name: "Mathématiques", short: "Maths", periods: dom === "pe" ? 4 : 3 });
    if (y === 1) {
      group("sxi", "Sciences expérimentales, informatique", "Sc. exp.", [["bse", "Biologie et science de l'environnement", 2, 1], ["sx", "Sciences expérimentales", 2, 1], ["inf", "Informatique et culture numérique", 2, 1]]);
      group("shs", "Sciences humaines et sociales", "Sc. hum.", [["dr", "Droit", 1, 1], ["sh", "Sciences humaines", 2, 2]]);
      group("arts", "Disciplines artistiques", "Arts", [["adr", "Art dramatique", 1, 1], ["dap", "Dessin-arts plastiques", 1, 1], ["mus", "Musique", 1, 1]]);
      add({ id: "sport", name: "Sport", short: "Sport", periods: 2 });
      return out;
    }
    if (y === 2) {
      if (needSci(p)) add({ id: "sci", name: sci.name, short: "Sc. exp.", periods: 2 });
      if (dom !== "ci") add({ id: "info", name: "Informatique et culture numérique", short: "Info.", periods: 2 });
      if (["ad", "mu", "th", "ci", "sa"].indexOf(dom) >= 0) group("sh", "Sciences humaines", "Sc. hum.", [["se", "Société et économie", 2, 2], ["hi", "Histoire", 1, 1], ["ge", "Géographie", 1, 1]]);
      if (needArt(p)) add({ id: "art", name: art.name, short: "Art", periods: 2 });
      add({ id: "sport", name: "Sport", short: "Sport", periods: 2 });
      if (dom === "ad") { add({ id: "hart", name: "Histoire de l'art", periods: 2 }); add({ id: "atel", name: "Atelier arts et design", short: "Atelier", periods: 4 }); add({ id: "cv", name: "Communication visuelle", periods: 2 }); }
      if (dom === "mu") { add({ id: "hmus", name: "Histoire de la musique", periods: 2 }); add({ id: "atel", name: "Atelier musique", short: "Atelier", periods: 4 }); add({ id: "solf", name: "Solfège", periods: 2 }); }
      if (dom === "th") { add({ id: "hth", name: "Histoire du théâtre", periods: 2 }); add({ id: "atel", name: "Atelier théâtre", short: "Atelier", periods: 4 }); add({ id: "ctd", name: "Culture théâtrale et dramaturgie", periods: 2 }); }
      if (dom === "ci") { add({ id: "alc", name: "Atelier culture et langue", periods: 2 }); add({ id: "ns", name: "Numérique et société", periods: 2 }); add({ id: "em", name: "Économie et marketing", periods: 2 }); add({ id: "gc", name: "Gestion et comptabilité", periods: 2 }); }
      if (dom === "sa") { add({ id: "bio", name: "Biologie", periods: 2 }); add({ id: "chi", name: "Chimie", periods: 2 }); add({ id: "phy", name: "Physique", periods: 2 }); add({ id: "sante", name: "Santé", periods: 2 }); }
      if (dom === "ts") { add({ id: "ge", name: "Géographie", periods: 2 }); add({ id: "hi", name: "Histoire", periods: 2 }); add({ id: "dr", name: "Droit", periods: 2 }); add({ id: "soc", name: "Sociologie", periods: 2 }); add({ id: "oc", name: "Option complémentaire", short: "OC", periods: 2 }); }
      if (dom === "pe") { add({ id: "ge", name: "Géographie", periods: 2 }); add({ id: "hi", name: "Histoire", periods: 2 }); add({ id: "phi", name: "Philosophie", periods: 2 }); add({ id: "soc", name: "Sociologie", periods: 2 }); add({ id: "bio", name: "Biologie et science de l'environnement", periods: 2 });
        group("sxp", "Sciences expérimentales", "Sc. exp.", [["chi", "Chimie", 1, 1], ["phy", "Physique", 1, 1]]); }
      return out;
    }
    // 3e : les 12 notes du certificat (RECG art. 24-26) ; sport, techniques de communication orale, maths (option) et OC ne comptent pas (art. 28).
    add({ id: "phi", name: "Philosophie", short: "Philo", periods: 2 });
    add({ id: "tpc", name: "Travail personnel de certificat", short: "TPC", periods: 1 });
    if (needSci(p)) carried("sci", sci.name, 2);
    if (needArt(p)) carried("art", art.name, 2);
    if (dom === "ad") { carried("atel1", "Atelier 1 « expérimentation »", 2, "atel"); add({ id: "atel", name: "Atelier 2 « réalisation »", short: "Atelier", periods: 4 }); add({ id: "hart", name: "Histoire de l'art", periods: 2 }); add({ id: "pd", name: "Projets design", periods: 2 });
      group("acdg", "Art contemporain et dessin-graphisme", "AC-DG", [["ac", "Art contemporain", 2, 1], ["dg", "Dessin-graphisme", 2, 1]]); }
    if (dom === "mu") { carried("atel1", "Atelier 1 « pratique instrumentale »", 2, "atel"); add({ id: "atel", name: "Atelier 2 « traitement du son »", short: "Atelier", periods: 4 }); add({ id: "hmus", name: "Histoire de la musique", periods: 2 }); add({ id: "solf", name: "Solfège", periods: 2 });
      group("cmc", "Culture musicale et numérique, composition", "Cult.-comp.", [["cmn", "Culture musicale et numérique", 2, 1], ["comp", "Composition musicale", 2, 1]]); }
    if (dom === "th") { carried("atel1", "Atelier 1 « interprétation 1 »", 2, "atel"); add({ id: "atel", name: "Atelier 2 « interprétation 2 »", short: "Atelier", periods: 4 }); add({ id: "hth", name: "Histoire du théâtre", periods: 2 }); add({ id: "ctd", name: "Culture théâtrale et dramaturgie", periods: 2 });
      group("mcs", "Mouvement et chorégraphie, création de spectacle", "Mouv.-créa.", [["mch", "Mouvement et chorégraphie", 2, 1], ["cs", "Création de spectacle", 2, 1]]); }
    if (dom === "ci") { group("alcm", "Atelier langue et culture, multimédias", "ALC-MM", [["alc", "Atelier langue et culture", 2, 1], ["mm", "Multimédias", 2, 1]]); add({ id: "ns", name: "Numérique et société", periods: 2 }); add({ id: "gc", name: "Gestion et comptabilité", periods: 2 });
      add({ id: "som", name: "Sociologie des médias", periods: 2 }); add({ id: "mo", name: "Mathématiques (option)", periods: 2, counts: false }); add({ id: "oc", name: "Option complémentaire", short: "OC", periods: 2, counts: false }); }
    if (dom === "sa") { add({ id: "bio", name: "Biologie", periods: 3 }); add({ id: "chi", name: "Chimie", periods: 3 }); add({ id: "phy", name: "Physique", periods: 3 }); add({ id: "cm", name: "Calcul médical", periods: 2 }); add({ id: "psy", name: "Psychologie", periods: 2 }); }
    if (dom === "ts") { add({ id: "ge", name: "Géographie", periods: 2 }); add({ id: "hi", name: "Histoire", periods: 2 });
      group("epse", "Économie politique, société-histoire-économie", "Éco.-SHE", [["epol", "Économie politique", 2, 1], ["she", "Société-histoire-économie", 2, 1]]);
      group("psso", "Psychologie et sociologie", "Psy.-socio.", [["psy", "Psychologie", 2, 2], ["soc", "Sociologie", 2, 3]]); }
    if (dom === "pe") { add({ id: "bio", name: "Biologie et science de l'environnement", periods: 2 }); add({ id: "chi", name: "Chimie", periods: 2 }); add({ id: "phy", name: "Physique", periods: 2 });
      group("shpe", "Sciences humaines", "Sc. hum.", [["hi", "Histoire", 1, 1], ["ge", "Géographie", 1, 1]]); add({ id: "psy", name: "Psychologie", periods: 2 });
      add({ id: "tco", name: "Techniques de communication orale", periods: 2, counts: false }); }
    add({ id: "sport", name: "Sport", short: "Sport", periods: 2, counts: false });
    return out;
  }

  /* ================= Moyennes ================= */
  function carriedValue(id) { return carriedInfo(id).v; }
  // Moyenne d'une branche simple, au dixième. Collège : note de semestre = (1 − part) × moyenne des travaux (au dixième) + part × ER, au
  // dixième ; note annuelle = moyenne des semestres notés. ECG 1re-2e : (S1 + S2 + EFA) / 3, les EFA étant les notes de type « tp ».
  function leafAvg(s, notes, C) {
    var mine = notes.filter(function (g) { return g.subject === s.id; });
    if (!mine.length) return { avg: null, n: 0, prov: false };
    var sh = s.tpShare || 0, prov = false;
    function semNote(list) {
      if (!list.length) return null;
      if (s.efa) return r1(C.wavg(list));
      var t = list.filter(function (g) { return g.type !== "tp"; }), e = list.filter(function (g) { return g.type === "tp"; });
      if (sh > 0 && t.length && e.length) return r1((1 - sh) * r1(C.wavg(t)) + sh * C.wavg(e));
      if (sh > 0 && e.length && !t.length) prov = true;
      return r1(C.wavg(list));
    }
    var base = s.efa && sh > 0 ? mine.filter(function (g) { return g.type !== "tp"; }) : mine;
    var s1 = semNote(base.filter(function (g) { return g.date <= C.s1End; })), s2 = semNote(base.filter(function (g) { return g.date > C.s1End; }));
    var sems = [s1, s2].filter(function (v) { return v != null; }), avg = sems.length ? r1(sems.reduce(function (a, b) { return a + b; }, 0) / sems.length) : null;
    if (s.efa) {
      var ef = mine.filter(function (g) { return g.type === "tp"; });
      if (ef.length && sh > 0) { var e1 = half(C.wavg(ef)), m = sems.length ? sems.reduce(function (x, y) { return x + y; }, 0) / sems.length : null; avg = m == null ? e1 : r1((1 - sh) * m + sh * e1); }
    }
    return { avg: avg, n: mine.length, prov: prov, s1: s1, s2: s2 };
  }
  function subjAvg(id, notes, C) {
    var s = C.sub(id); if (!s) return { avg: null, n: 0, prov: false };
    if (s.carried) return { avg: carriedValue(id), n: 0, prov: false, carried: true };
    if (!s.parts) return leafAvg(s, notes, C);
    var w = 0, t = 0, n = 0, prov = false, missing = false;
    s.parts.forEach(function (pid) {
      var p = C.sub(pid); if (!p) return;
      var a = leafAvg(p, notes, C), k = p.w != null ? p.w : p.periods;
      n += a.n;
      if (a.avg != null) { w += k; t += a.avg * k; prov = prov || a.prov; } else missing = true;
    });
    return { avg: w ? r1(t / w) : null, n: n, prov: prov || (missing && w > 0) };
  }

  /* ================= Promotion ================= */
  function ecgLimits(y) { return y === 1 ? { ins: 2, def: 1.5 } : { ins: 3, def: 1.5 }; }
  function evaluate(c) {
    var pr = app().profile(), y = pr.year, ecg = isECG(pr), def = 0, fails = [], mg = c.nb ? r1(c.total / c.nb) : null;
    c.have.forEach(function (s) { if (c.bm[s.id] < 4) def += 4 - c.bm[s.id]; });
    def = r1(def);
    function g(k) { var s = c.rows.filter(function (x) { return x.group === k; })[0]; return s ? c.bm[s.id] : null; }
    var fr = g("fr"), l2 = g("l2"), l3 = g("l3"), ma = g("maths"), os = g("os");
    var gp = !ecg && [fr, l2, l3, ma, os].every(function (x) { return x != null; }) ? r1(fr + (l2 + l3) / 2 + ma + os) : null;
    var lim = ecg ? ecgLimits(y) : { ins: 3, def: 1 };
    if (c.ins > 0) {
      if (mg != null && mg < 4 - 1e-9) fails.push("mg");
      if (c.ins > lim.ins) fails.push("ins");
      if (def > lim.def + 1e-9) fails.push("def");
      if (!ecg && y >= 2 && os != null && os < 4 - 1e-9) fails.push("os");
      if (!ecg && y >= 2 && gp != null && gp < 16 - 1e-9) fails.push("group");
    }
    return { total: c.total, nb: c.nb, ins: c.ins, gp: gp, def: def, mg: mg, os: os, fails: fails, bm: c.bm, lim: lim, y: y, ecg: ecg };
  }
  function tight(r) { return r.ins > 0 || (r.mg != null && r.mg < 4.3) || (r.gp != null && r.gp < 17); }
  function metrics(r, metric) {
    var lim = r.lim, d = r.def, ins = r.ins, out = "";
    out += metric("Écarts sous 4", d.toFixed(1), "/ " + lim.def.toFixed(1) + " max", d > lim.def ? "dépasse de " + (d - lim.def).toFixed(1) + " pt" : d === 0 ? "aucune note sous 4" : (lim.def - d).toFixed(1) + " pt de marge",
      d / (2 * lim.def), d > lim.def ? "crit" : d >= lim.def - 0.3 ? "warn" : "", { at: 0.5, label: lim.def.toFixed(1) + " max" });
    out += metric("Notes inférieures à 4", String(ins), "/ " + lim.ins + " max", ins > lim.ins ? "trop de notes insuffisantes" : (lim.ins - ins) + " en réserve", ins / (lim.ins + 1), ins > lim.ins ? "crit" : ins === lim.ins ? "warn" : "");
    if (!r.ecg && r.y >= 2) {
      var gp = r.gp;
      out += gp == null ? metric("Groupe de 16", "–", "/ 16 min", "français, L2-L3, maths, OS", 0, "", { at: 16 / 24, label: "16 min" })
        : metric("Groupe de 16", f1(gp), "/ 16 min", (gp - 16 >= 0 ? "+" : "−") + Math.abs(gp - 16).toFixed(1) + " pt par rapport à 16" + (r.os != null && r.os < 4 ? " · OS sous 4" : ""), gp / 24, gp < 16 || (r.os != null && r.os < 4) ? "crit" : gp < 17 ? "warn" : "", { at: 16 / 24, label: "16 min" });
    }
    return out;
  }
  var rules = { subjAvg: subjAvg, bulletin: r1, step: 0.2, evaluate: evaluate, tight: tight, metrics: metrics };

  function statusText(k, year) {
    var pr = app() && app().profile(), last = pr && year === years(pr);
    if (last) return null;
    return {
      ok: ["t-good", "Promotion assurée", "Toutes tes notes annuelles sont d'au moins 4 : promotion sans tolérance."],
      tight: ["t-warn", "Marge faible", "Promu au rythme actuel, mais par tolérance ou de justesse : une ou deux notes peuvent tout faire basculer."],
      limit: ["t-warn", "Cas limite", "Deux dixièmes de plus sur une seule note de branche suffiraient. La direction peut accorder une dérogation (une fois par filière)."],
      danger: ["t-crit", "En danger", "Les conditions de la tolérance ne sont pas remplies. Il faut remonter des moyennes."]
    }[k] || null;
  }
  function years(p) { return isECG(p) ? 3 : 4; }

  /* ================= Certificats (Collège 4e, ECG 3e) ================= */
  var KLAB = { w: "Écrit", o: "Oral", p: "Pratique", w2: "Écrit (complément)" };
  // Examens (RGymCG art. 47 ; RECG art. 27). Les clés sont les branches de la dernière année ; « on » = branche qui porte l'examen
  // quand il ne concerne qu'une composante (sociologie de travail social).
  function units(pr) {
    if (!isECG(pr)) return { fr: ["w", "o"], l2: ["w", "o"], l3: ["w", "o"], ma: ["w", "o"], os: [pr.os === "AV" || pr.os === "MU" ? "p" : "w", "o"] };
    var u = { fr: ["w", "o"], l2: ["w", "o"], l3: ["w", "o"], ma: pr.domaine === "ci" ? ["w", "w2"] : pr.domaine === "pe" ? ["w", "o"] : ["w"] };
    var d = { ad: { hart: ["w"], atel: ["p", "o"], pd: ["o"] }, mu: { hmus: ["w"], atel: ["p", "o"], solf: ["w", "o"] }, th: { hth: ["w"], atel: ["p", "o"], ctd: ["w"] },
      ci: { gc: ["w"], ns: ["w"], som: ["w"] }, pe: { chi: ["w"], phy: ["w"], psy: ["o"] }, sa: { bio: ["w"], chi: ["w"], phy: ["w"] }, ts: { ge: ["w"], hi: ["w"], soc: ["w"] } }[pr.domaine] || {};
    Object.keys(d).forEach(function (k) { u[k] = d[k]; });
    return u;
  }
  function compute(x) {
    var A = app(), pr = A.profile(), data = store(), U = units(pr), real = 0, nExam = 0, exReal = 0;
    var subs = A.subjectsAll();
    function sub(id) { return subs.filter(function (s) { return s.id === id; })[0]; }
    function ann(id) { var a = A.annualAvg(id); return a == null ? null : r1(a); }
    // Note à l'examen : moyenne des épreuves au dixième (épreuve manquante : x, ou la note annuelle pour « now »).
    function exam(id, a) {
      var ks = U[id], vals = [], miss = false;
      ks.forEach(function (k) {
        nExam++;
        var v = num(((data.exams || {})[id] || {})[k]);
        if (v != null) { vals.push(v); real++; exReal++; return; }
        if (x === "now" && a != null) vals.push(a); else if (typeof x === "number") vals.push(x); else miss = true;
      });
      return miss || !vals.length ? null : r1(vals.reduce(function (s, v) { return s + v; }, 0) / vals.length);
    }
    function withExam(id, a) { var e = exam(id, a); return { e: e, f: a != null && e != null ? r1((a + e) / 2) : null }; }
    var rows = subs.filter(function (s) { return s.counts && !s.part; }).map(function (s) {
      var r = { id: s.id, name: s.name, carried: !!s.carried, a: ann(s.id) };
      if (U[s.id]) { var q = withExam(s.id, r.a); r.e = q.e; r.final = half(q.f); r.kinds = U[s.id]; r.exam = true; }
      else if (s.parts && s.parts.some(function (pid) { return U[pid]; })) {     // examen sur une composante (sociologie en travail social)
        var w = 0, t = 0, ok = true;
        s.parts.forEach(function (pid) {
          var p = sub(pid), a = ann(pid), k = p && p.w != null ? p.w : (p ? p.periods : 1);
          if (U[pid]) { var q2 = withExam(pid, a); r.e = q2.e; r.kinds = U[pid]; r.examOn = pid; a = q2.f; }
          if (a == null) ok = false; else { w += k; t += a * k; }
        });
        r.final = ok && w ? half(r1(t / w)) : null; r.exam = true;
      } else if (s.id === "art" && s.carried && !isECG(pr) && pr.art === "mu") {
        var ins = num((data.carried || {}).instr); r.final = r.a == null ? null : half(ins != null ? 0.75 * r.a + 0.25 * ins : r.a);
      } else r.final = half(r.a);
      return r;
    });
    var missing = rows.filter(function (r) { return r.a == null && !r.examOn; }).map(function (r) { return r.name; });
    var rated = rows.filter(function (r) { return r.final != null; }), up = 0, down = 0, ins = 0, sum = 0;
    rated.forEach(function (r) { sum += r.final; if (r.final < 4) { down += 4 - r.final; ins++; } else up += r.final - 4; });
    var mg = rated.length ? r1(sum / rated.length) : null, complete = rated.length === rows.length && exReal === nExam;
    function fv(id) { var r = rows.filter(function (z) { return z.id === id; })[0]; return r ? r.final : null; }
    var gp = null;
    if (!isECG(pr) && [fv("fr"), fv("l2"), fv("l3"), fv("ma"), fv("os")].every(function (v) { return v != null; })) gp = fv("fr") + (fv("l2") + fv("l3")) / 2 + fv("ma") + fv("os");
    var ok = rated.length === rows.length && (isECG(pr) ? mg >= 4 - 1e-9 && ins <= 3 && down <= 2 + 1e-9 : 2 * down <= up + 1e-9 && ins <= 4 && gp != null && gp >= 16 - 1e-9);
    return { rows: rows, rated: rated.length, expected: rows.length, up: up, down: down, ins: ins, mg: mg, gp: gp, missing: missing, complete: complete, pass: ok, realExams: exReal, nExam: nExam };
  }
  function minimum() {
    for (var x = 1; x <= 6.0001; x += 0.5) { var r = compute(x); if (r.missing.length) return { missing: r.missing }; if (r.pass) return { x: x }; }
    return { x: null };
  }
  function certName(pr) { return isECG(pr) ? "certificat ECG" : "certificat de maturité"; }
  function status(real, m, pr) {
    var nm = certName(pr), Nm = nm.charAt(0).toUpperCase() + nm.slice(1);
    if (real.complete) return real.pass ? { cls: "t-good", label: isECG(pr) ? "Certificat réussi" : "Maturité réussie", text: "Toutes les conditions du " + nm + " sont remplies" + (real.mg >= 5 ? ", avec mention (moyenne de 5 ou plus)." : ".") }
      : { cls: "t-crit", label: isECG(pr) ? "Certificat non réussi" : "Maturité non réussie", text: "Au moins une condition n'est pas remplie avec les notes saisies." };
    if (m.missing) return { cls: "t-none", label: Nm, text: "Il manque encore : " + m.missing.join(", ") + "." };
    if (m.x == null) return { cls: "t-crit", label: "Compliqué", text: "Même avec 6 à toutes les épreuves restantes, le " + nm + " ne serait pas atteint avec tes notes actuelles." };
    var hint = " Touche une branche d'examen pour saisir tes examens et voir la note minimale à viser.";
    if (m.x <= 4) return { cls: "t-good", label: "Bonne voie", text: "Avec " + fmt(m.x) + " de moyenne aux examens restants, le " + nm + " serait obtenu." + hint };
    if (m.x <= 5) return { cls: "t-warn", label: "Serré", text: "Il te faudrait au moins " + fmt(m.x) + " de moyenne aux examens restants." + hint };
    return { cls: "t-crit", label: "Compliqué", text: "Il te faudrait au moins " + fmt(m.x) + " de moyenne aux examens restants." + hint };
  }
  function metricHtml(label, val, unit, sub, ratio, cls, markAt, markLabel) {
    return '<div class="metric"><span class="lbl">' + label + '</span><span class="val">' + val + ' <small>' + unit + '</small></span>' +
      '<div class="bar ' + cls + '"><i style="width:' + Math.max(0, Math.min(100, ratio * 100)).toFixed(0) + '%"></i>' + (markAt != null ? '<b style="left:' + (markAt * 100).toFixed(1) + '%"></b>' : "") + '</div>' +
      (markAt != null ? '<div class="tick"><span style="left:' + (markAt * 100).toFixed(1) + '%">' + markLabel + '</span></div>' : "") + '<span class="sub">' + sub + '</span></div>';
  }
  function renderCert(pr) {
    var promo = document.getElementById("promo"); if (!promo) return;
    var real = compute(null), now = compute("now"), m = minimum(), st = status(real, m, pr), s = real.complete ? real : now, pre = real.complete ? "" : "au rythme actuel : ";
    var t = "";
    if (isECG(pr)) {
      t += s.mg == null ? metricHtml("Moyenne des notes", "–", "/ 4 min", "aucune note", 0, "", 4 / 6, "4 min")
        : metricHtml("Moyenne des notes", f1(s.mg), "/ 4 min", pre + (s.mg - 4 >= 0 ? "+" : "−") + Math.abs(s.mg - 4).toFixed(1) + " pt par rapport à 4 (" + s.rated + " / " + s.expected + " notes)", s.mg / 6, s.mg < 4 ? "crit" : s.mg < 4.3 ? "warn" : "", 4 / 6, "4 min");
      t += metricHtml("Écarts sous 4", s.down.toFixed(1), "/ 2.0 max", s.down > 2 ? "dépasse de " + (s.down - 2).toFixed(1) + " pt" : s.down === 0 ? "aucune note sous 4" : (2 - s.down).toFixed(1) + " pt de marge", s.down / 4, s.down > 2 ? "crit" : s.down >= 1.5 ? "warn" : "", 0.5, "2.0 max");
      t += metricHtml("Notes inférieures à 4", String(s.ins), "/ 3 max", s.ins > 3 ? "trop de notes insuffisantes" : (3 - s.ins) + " en réserve", s.ins / 4, s.ins > 3 ? "crit" : s.ins === 3 ? "warn" : "");
    } else {
      var bal = s.up - 2 * s.down;
      t += metricHtml("Double compensation", (bal >= 0 ? "+" : "−") + Math.abs(bal).toFixed(1), "pt", pre + "écarts au-dessus de 4 : " + s.up.toFixed(1) + ", deux fois les écarts sous 4 : " + (2 * s.down).toFixed(1), Math.max(0, Math.min(1, 0.5 + bal / 12)), bal < 0 ? "crit" : bal < 1 ? "warn" : "", 0.5, "0 min");
      t += metricHtml("Notes inférieures à 4", String(s.ins), "/ 4 max", s.ins > 4 ? "trop de notes insuffisantes" : (4 - s.ins) + " en réserve", s.ins / 5, s.ins > 4 ? "crit" : s.ins === 4 ? "warn" : "");
      t += s.gp == null ? metricHtml("Groupe de 16", "–", "/ 16 min", "français, L2-L3, maths, OS", 0, "", 16 / 24, "16 min")
        : metricHtml("Groupe de 16", f1(s.gp), "/ 16 min", pre + (s.gp - 16 >= 0 ? "+" : "−") + Math.abs(s.gp - 16).toFixed(1) + " pt par rapport à 16", s.gp / 24, s.gp < 16 ? "crit" : s.gp < 17 ? "warn" : "", 16 / 24, "16 min");
    }
    promo.innerHTML = '<div class="verdict"><span class="pill ' + st.cls + '">' + st.label + '</span><p>' + esc(st.text) + '</p></div><div class="metrics">' + t + '</div>';
  }

  /* Détail d'une branche en dernière année : saisie des examens et note minimale ; note reprise d'une année précédente. */
  function inp(attr, v) { return '<input type="number" inputmode="decimal" min="1" max="6" step="0.5" ' + attr + ' value="' + (v != null ? v : "") + '" placeholder="–">'; }
  function detail(id) {
    var A = app(), pr = A && A.profile();
    if (!pr || pr.year !== years(pr)) return "";
    var s = A.subjectsAll().filter(function (z) { return z.id === id; })[0]; if (!s) return "";
    if (s.carried) {
      var info = carriedInfo(id), v = info.v;
      return '<div class="cert-min"><h3 class="sec">Note de ' + ord(s.from) + ' reprise</h3><p>' + (v == null ? "Aucune note de " + ord(s.from) + " trouvée pour cette branche. Entre-la dans Réglages → Notes reprises."
        : "Ta note du " + certName(pr) + " : <b>" + fmt(half(v)) + "</b> " + (info.src === "auto" ? "(calculée d'après tes notes de " + ord(s.from) + " classées, note annuelle " + f1(v) + ")." : "(saisie à la main).")) +
        '</p><span class="meta">Cette branche n\'est plus enseignée : pour corriger la note, va dans <b>Réglages → Notes reprises</b>.</span></div>';
    }
    var U = units(pr), on = U[id] ? id : (s.parts || []).filter(function (pid) { return U[pid]; })[0];
    if (!on) return "";
    var e = (store().exams || {})[on] || {}, ks = U[on], a = A.annualAvg(on); a = a == null ? null : r1(a);
    var done = ks.every(function (k) { return num(e[k]) != null; }), line;
    if (a == null) line = "Entre des notes de l'année dans cette branche pour calculer la note minimale à l'examen.";
    else if (done) { var ex = r1(ks.reduce(function (t, k) { return t + num(e[k]); }, 0) / ks.length); line = "Examen passé : note à l'examen " + f1(ex) + ", note " + (on === id ? "finale" : "de " + esc((A.subjectsAll().filter(function (z) { return z.id === on; })[0] || {}).name || "") ) + " <b>" + fmt(half(r1((a + ex) / 2))) + "</b>."; }
    else {
      var need = null;
      for (var x = 1; x <= 6.0001; x += 0.5) {
        var vals = ks.map(function (k) { var v = num(e[k]); return v != null ? v : x; }), ex2 = r1(vals.reduce(function (t, v) { return t + v; }, 0) / vals.length);
        if (half(r1((a + ex2) / 2)) >= 4) { need = x; break; }
      }
      line = need == null ? "Même avec 6 aux épreuves restantes, tu n'atteindrais pas 4 dans cette branche." : need <= 1 ? "Tu as déjà <b>4</b> dans cette branche, quelle que soit la note de l'examen."
        : "Pour avoir <b>4</b> dans cette branche, il te faut au moins <b>" + fmt(need) + "</b> de moyenne aux épreuves restantes.";
    }
    var title = on === id ? "Examen" : "Examen · " + ((A.subjectsAll().filter(function (z) { return z.id === on; })[0] || {}).name || "");
    return '<div class="cert-min"><h3 class="sec">' + esc(title) + '</h3><div class="exam-fields">' +
      ks.map(function (k) { return '<label>' + KLAB[k] + inp('data-exam="' + on + '" data-k="' + k + '"', e[k]) + '</label>'; }).join("") +
      '<div class="exam-out"><span class="muted small">Annuelle</span><span class="mono">' + f1(a) + '</span></div></div>' +
      '<p>' + line + '</p><span class="meta">Note finale = (note annuelle + moyenne des épreuves) / 2, arrondie au demi-point.</span></div>';
  }

  /* Notes reprises : saisie à la main, sinon note annuelle de l'année archivée (« Années précédentes »). */
  function autoCarried(s) {
    var A = app(), arch = A.archive ? A.archive() : [];
    for (var i = arch.length - 1; i >= 0; i--) if (arch[i].year === s.from) {
      var r = A.archiveStats(arch[i]).filter(function (x) { return x.id === (s.src || s.id); })[0];
      return r && r.avg != null ? r1(r.avg) : null;
    }
    return null;
  }
  function carriedInfo(id) {
    var m = num((store().carried || {})[id]); if (m != null) return { v: m, src: "saisie" };
    var s = (app().subjectsAll() || []).filter(function (z) { return z.id === id; })[0];
    var a = s && s.carried ? autoCarried(s) : null; return a != null ? { v: a, src: "auto" } : { v: null, src: null };
  }
  function mountCarried(pr) {
    var host = document.getElementById("set-block"); if (!host) return;
    var d = document.getElementById("carriedset"), list = pr.year === years(pr) ? app().subjectsAll().filter(function (s) { return s.carried; }) : [];
    if (!list.length) { if (d) d.hidden = true; return; }
    if (!d) {
      d = document.createElement("div"); d.className = "backup"; d.id = "carriedset";
      var anchor = document.getElementById("yearpass") || (document.getElementById("ob-edit") && document.getElementById("ob-edit").closest(".backup"));
      if (anchor) anchor.after(d); else host.insertBefore(d, host.firstChild);
    }
    if (!d._ge) {
      d._ge = true;
      d.addEventListener("change", function (e) {
        var t = e.target; if (!t.dataset || !t.dataset.carried || !G.ext(app().profile()) || G.cantonOf(app().profile()) !== "ge") return;
        var s = store(); s.carried = s.carried || {}; s.carried[t.dataset.carried] = t.value === "" ? null : num(t.value);
        if (window.Cert && Cert.save) Cert.save(); app().redraw();
      });
    }
    d.hidden = false;
    var withInstr = !isECG(pr) && pr.art === "mu";
    var html = '<h3>Notes reprises</h3><p class="muted small">Ces branches ne sont plus enseignées : leur note du ' + certName(pr) + ' est ta note annuelle de l\'année indiquée. L\'app la calcule d\'après tes notes classées dans « Années précédentes » ; entre-la ici si ton bulletin dit autre chose. Champ vide = calcul automatique.</p>' +
      list.map(function (s) {
        var auto = autoCarried(s), man = num((store().carried || {})[s.id]);
        return '<label class="row">' + esc(s.name) + ' (' + ord(s.from) + ')<input type="number" inputmode="decimal" min="1" max="6" step="0.1" data-carried="' + s.id + '" value="' + (man != null ? man : "") + '" placeholder="' + (auto != null ? f1(auto) + " (auto)" : "–") + '" style="width:110px;text-align:right"></label>';
      }).join("") +
      (withInstr ? '<label class="row">Note d\'instrument<input type="number" inputmode="decimal" min="1" max="6" step="0.1" data-carried="instr" value="' + (num((store().carried || {}).instr) != null ? num(store().carried.instr) : "") + '" placeholder="–" style="width:110px;text-align:right"></label>' +
        '<p class="muted small">Musique : note de maturité = 3/4 de la note de 2e + 1/4 de la note d\'instrument (RGymCG art. 51).</p>' : "");
    if (d._html !== html) { d.innerHTML = html; d._html = html; }
  }

  /* ================= Textes ================= */
  function rulesHtml(pr) {
    var ecg = isECG(pr), y = pr.year, last = y === years(pr);
    var avg = '<div><h3>Moyenne d\'une branche</h3><ul>' +
      '<li>L\'année a deux semestres de même poids. Note de semestre = moyenne de tes travaux, au dixième.</li>' +
      (ecg ? (y <= 2 ? '<li>Épreuve de fin d\'année (EFA) : elle compte pour 1/3 de la note annuelle, (S1 + S2 + EFA) / 3. Sans EFA dans la branche : (S1 + S2) / 2.</li>' : '<li>Note annuelle = (S1 + S2) / 2, au dixième.</li>')
        : '<li>Épreuve regroupée (ER) : dans un semestre, la moyenne des autres travaux est arrondie au dixième puis combinée avec l\'ER. Le poids de l\'ER dépend de la discipline et de l\'année (1/3 à 2/3) : l\'app reprend celui du Collège de Candolle ; corrige-le dans Réglages → Branches si ton collège compte autrement.</li><li>Note annuelle = (S1 + S2) / 2, au dixième.</li>') +
      '<li>Arrondi au dixième le plus proche : 4.25 donne 4.3, 2.55 donne 2.6. Les notes du bulletin restent au dixième (pas de demi-point).</li>' +
      '<li>Note composée (' + (ecg ? 'sciences expérimentales, sciences humaines, disciplines artistiques…' : 'arts visuels, introduction à l\'économie et au droit, OS à deux parties') + ') : moyenne pondérée des notes annuelles des composantes, au dixième.</li></ul></div>';
    var pro;
    if (ecg && last) pro = '<div><h3>Certificat ECG, 3e année</h3><ul><li>12 notes au demi-point : note annuelle de 3e, ou (note annuelle + note d\'examen) / 2 dans les branches d\'examen ; sciences expérimentales et arts reprises de 2e selon le domaine.</li>' +
      '<li>Moyenne des 12 notes d\'au moins 4.0, au plus 3 notes insuffisantes, somme des écarts sous 4 d\'au plus 2.0, et stage validé. Mention dès 5.0.</li><li>Pas de dérogation pour le certificat.</li></ul></div>';
    else if (ecg) { var l = ecgLimits(y); pro = '<div><h3>Promotion de ' + ord(y) + ' année</h3><ul><li>Promu si chaque note annuelle (branche ou regroupement) vaut au moins 4.0.</li>' +
      '<li>Sinon, promu par tolérance si : moyenne générale d\'au moins 4.0, au plus ' + l.ins + ' notes insuffisantes, somme des écarts sous 4 d\'au plus 1.5.</li><li>Le sport compte.</li>' +
      (y === 1 ? '<li>Pédagogie en 2e : français, maths, allemand et anglais d\'au moins 4.0 chacun et un total d\'au moins 18.0.</li>' : '') + '<li>Cas limite : la direction peut accorder une dérogation (une fois par filière).</li></ul></div>'; }
    else if (last) pro = '<div><h3>Certificat de maturité, 4e année</h3><ul><li>14 notes au demi-point. Français, L2, L3, maths et OS : (note annuelle de 4e + moyenne de l\'écrit et de l\'oral) / 2. Chimie et arts : note de 2e ; physique et biologie : note de 3e ; histoire, géographie, philosophie, OC et travail de maturité : note de 4e.</li>' +
      '<li>Double compensation : deux fois la somme des écarts sous 4 ne dépasse pas la somme des écarts au-dessus de 4 ; au plus 4 notes sous 4 ; français + moyenne (L2, L3) + maths + OS d\'au moins 16. Mention dès 5.0 de moyenne.</li></ul></div>';
    else pro = '<div><h3>Promotion de ' + ord(y) + ' année</h3><ul><li>Promu si chaque note annuelle vaut au moins 4.0.</li>' +
      '<li>Sinon, promu par tolérance si : moyenne générale d\'au moins 4.0 et au plus 3 notes insuffisantes dont la somme des écarts sous 4 ne dépasse pas 1.0' + (y >= 2 ? ' ; OS d\'au moins 4.0 ; français + moyenne (L2, L3) + maths + OS d\'au moins 16.0' : '') + '.</li>' +
      '<li>Toutes les branches suivies comptent, y compris l\'éducation physique, l\'informatique' + (y === 1 ? ' et l\'introduction à l\'économie et au droit' : '') + '.</li>' +
      '<li>Cas limite : la direction peut accorder une dérogation (une fois par filière), en général jusqu\'à 0.2 au-delà de la tolérance.</li></ul></div>';
    return { html: avg + pro, caveat: 'Sources : ' + (ecg ? 'règlement de l\'ECG (RECG, rsGE C 1 10.70) art. 14-36, mémento de l\'ECG Ella-Maillart 2026-2027' : 'règlement du Collège de Genève (RGymCG, rsGE C 1 10.71) art. 22-29 et 42-52, grille horaire d\'octobre 2025, mémento du Collège de Candolle 2025-2026') +
      ', règlement de l\'enseignement secondaire II (REST, rsGE C 1 10.31) art. 27 et 30. Vérifie avec ton bulletin : seul lui fait foi.' };
  }
  function head(p) {
    var ecg = isECG(p), last = p.year === years(p);
    return { school: ecg ? "École de culture générale de Genève" : "Collège de Genève", promo: last ? (ecg ? "Certificat ECG" : "Certificat de maturité") : "Promotion en " + ord(p.year + 1) + " année", classe: (p.year || 1) + (ecg ? "C" : "M") };
  }
  function summary(p) {
    if (isECG(p)) { var a = find(E_LANG, p.l2), b = find(E_LANG, p.l3), d = find(E_DOM, p.domaine);
      return ord(p.year) + " année · " + (a ? a.name : "?") + " et " + (b ? b.name : "?") + (p.year > 1 ? " · " + (d ? d.name : "domaine à choisir") : ""); }
    var os = find(C_OS, p.os), l2 = find(C_L2, p.l2), l3 = find(C_L3, p.l3);
    return ord(p.year) + " année · L2 " + (l2 ? l2.name : "?") + " · L3 " + (l3 ? l3.name : "?") + " · OS " + (os ? os.name : "?") + " · maths " + (p.math === "renf" ? "avancé" : "normal");
  }
  // Champs du profil, dans l'ordre de l'assistant et de Réglages → Profil.
  function fields(p) {
    if (isECG(p)) { var f = ["l2", "l3"]; if (p.year >= 2) f.push("domaine"); if (needSci(p)) f.push("sci"); if (needArt(p)) f.push("art"); return f; }
    return ["l2", "l3", "os", "math", "art"].concat(p.year >= 3 ? ["oc"] : []);
  }
  function stepText(f, p) {
    var e = isECG(p);
    return {
      gymnase: { title: e ? "Ton école" : "Ton collège", sub: "Il s'affichera en haut de ton tableau de bord." },
      l2: e ? { title: "Langue seconde 1", sub: "Deux langues à choix parmi l'allemand, l'anglais et l'italien." } : { title: "Deuxième langue (L2)", sub: "La langue nationale : allemand ou italien." },
      l3: e ? { title: "Langue seconde 2", sub: "Pédagogie : allemand et anglais obligatoires." } : { title: "Troisième langue (L3)", sub: "L'autre langue nationale, l'anglais ou le latin." },
      os: { title: "Option spécifique", sub: "Ton option, suivie dès la 1re année." },
      math: { title: "Mathématiques", sub: "Le niveau choisi à l'inscription." },
      art: e ? { title: "Discipline artistique", sub: "Le cours d'art à choix de 2e année." } : { title: "Discipline artistique", sub: "Suivie en 1re et en 2e année." },
      oc: { title: "Option complémentaire", sub: "Suivie en 3e et en 4e année." },
      domaine: { title: "Domaine professionnel", sub: "Choisi pour la 2e année, sans changement en 3e." },
      sci: { title: "Science à choix", sub: "Le cours de sciences de 2e année." }
    }[f] || null;
  }
  function blocked(f, id, np) {
    if (isECG(np)) {
      if (f === "l3" && id === np.l2) return "Déjà choisie en langue 1";
      if (f === "l2" && id === np.l3) return "Déjà choisie en langue 2";
      if (f === "domaine" && id === "pe" && [np.l2, np.l3].sort().join() !== "de,en") return "Pédagogie : allemand et anglais obligatoires";
      if ((f === "l2" || f === "l3") && np.domaine === "pe" && id === "it") return "L'allemand et l'anglais sont obligatoires en pédagogie";
      if (f === "art" && np.domaine === "pe" && id === "adr") return "Dessin ou musique en pédagogie";
      return null;
    }
    if (f === "l3" && id === np.l2) return "Déjà choisie en L2";
    if (f === "l2" && id === np.l3) return "Déjà choisie en L3";
    if (f === "os") { var o = find(C_OS, id); if (o && o.lang && (o.lang === np.l2 || o.lang === np.l3)) return "Tu as déjà cette langue en L2 ou en L3";
      if (id === "AV" && np.art === "mu") return "Impose arts visuels comme discipline artistique";
      if (id === "MU" && np.art === "av") return "Impose musique comme discipline artistique"; }
    if ((f === "l2" || f === "l3") && np.os) { var o2 = find(C_OS, np.os); if (o2 && o2.lang === id) return "Tu as déjà cette langue en option spécifique"; }
    if (f === "art" && ((np.os === "AV" && id === "mu") || (np.os === "MU" && id === "av"))) return "Imposée par ton option spécifique";
    if (f === "math" && id === "std" && np.os === "PAM") return "L'OS physique et applications des maths impose le niveau avancé";
    if (f === "oc" && OC_EXCLUDED[np.os] && OC_EXCLUDED[np.os].indexOf(id) >= 0) return "Exclue avec ton option spécifique";
    return null;
  }
  function sanitize(p) {
    if (isECG(p)) {
      if (p.l3 && p.l3 === p.l2) p.l3 = null;
      if (p.year < 2) { delete p.domaine; delete p.sci; delete p.art; return; }
      if (p.domaine === "pe" && [p.l2, p.l3].sort().join() !== "de,en") p.domaine = null;
      if (!needSci(p)) delete p.sci; if (!needArt(p)) delete p.art;
      if (p.art && blocked("art", p.art, p)) p.art = null;
      return;
    }
    if (p.l3 && p.l3 === p.l2) p.l3 = null;
    if (p.os && blocked("os", p.os, p)) p.os = null;
    if (p.os === "PAM") p.math = "renf";
    if (p.os === "AV") p.art = "av"; if (p.os === "MU") p.art = "mu";
    if (p.year < 3) delete p.oc; else if (p.oc && blocked("oc", p.oc, p)) p.oc = null;
  }
  function valid(f, p) { return !!p[f] && !blocked(f, p[f], p); }
  function guide(pr) {
    var ecg = isECG(pr), note = "<span class='note'>Le détail est dans Réglages → Calcul des moyennes.</span>";
    var g = {
      "Moyenne et arrondi": [
        "L'année a <b>deux semestres de même poids</b> : note annuelle = (S1 + S2) / 2" + (ecg ? ", ou (S1 + S2 + EFA) / 3 avec une épreuve de fin d'année en 1re et 2e" : "") + ". Chaque moyenne est arrondie au <b>dixième</b> le plus proche (4.25 donne 4.3) : la note de bulletin reste au dixième, comme sur ton bulletin genevois.",
        "Seules les notes du " + certName(pr) + " sont arrondies au demi-point."],
      "Fais la configuration": [
        "Choisis ton canton (Genève), ta voie, ton " + (ecg ? "école" : "collège") + ", ton année et tes choix : " + (ecg ? "tes deux langues secondes puis, dès la 2e, ton domaine professionnel et tes cours à choix." : "L2, L3, option spécifique, niveau de maths, discipline artistique et, dès la 3e, l'option complémentaire."),
        "L'app crée tes branches avec leurs périodes. Un choix impossible est grisé, avec la raison. Tu pourras tout changer plus tard dans <b>Réglages → Profil</b>."],
      "Le verdict de promotion": [
        "Le verdict vérifie la règle genevoise : promu si toutes tes notes annuelles valent 4 ; sinon <b>promotion par tolérance</b> si la moyenne générale vaut au moins 4, avec " + (ecg ? "au plus 2 (1re) ou 3 (2e) notes sous 4 et 1.5 point d'écarts" : "au plus 3 notes sous 4 et 1 point d'écarts" + "; dès la 2e, aussi l'OS d'au moins 4 et le groupe de 16 (français, moyenne L2-L3, maths, OS)") + ".",
        "Les notes du bulletin sont <b>au dixième</b> (4.3), comme sur ton bulletin genevois. Sur téléphone, l'Accueil montre une <b>tuile par règle</b> et ta <b>moyenne générale</b>."],
      "En 3e : le certificat de maturité": { t: ecg ? "En 3e : le certificat ECG" : "En 4e : le certificat de maturité", p: [
        ecg ? "En 3e, l'en-tête montre le certificat ECG : moyenne des 12 notes (4 au moins), écarts sous 4 (2 au plus) et notes sous 4 (3 au plus)."
          : "En 4e, l'en-tête montre le certificat de maturité : double compensation, notes sous 4 (4 au plus) et groupe de 16 (français, moyenne L2-L3, maths, OS).",
        "Les examens se saisissent dans le <b>détail de chaque branche d'examen</b>, avec la <b>note minimale</b> à viser pour avoir 4.",
        "Les branches terminées gardent la note de leur dernière année. Pour la corriger, va dans <b>Réglages → Notes reprises</b>."] },
      "TP et options à deux parties": { t: ecg ? "Épreuves de fin d'année et regroupements" : "Épreuves regroupées et options à deux parties", p: [
        ecg ? "En 1re et en 2e, ajoute une note de type <b>EFA</b> pour une épreuve de fin d'année : elle compte pour 1/3 de la note annuelle, les deux semestres pour 2/3. Un regroupement (par exemple « sciences humaines et sociales ») mélange ses disciplines selon leur poids officiel."
          : "Ajoute une note de type <b>ER</b> pour une épreuve regroupée : elle compte pour une part de la note de semestre (1/3 à 2/3 selon la branche et l'année), tes autres travaux pour le reste. Une branche à deux parties (arts visuels, OS) mélange les notes annuelles de ses parties selon leur poids officiel.", note] },
      "Part des TP et périodes": { t: ecg ? "Part de l'EFA et périodes" : "Part de l'ER et périodes", p: [
        ecg ? "<b>Part de l'EFA (%)</b> : 33 par défaut, comme le règlement de ton école." : "<b>Part de l'ER (%)</b> : la valeur du Collège de Candolle par défaut ; mets celle de ton prof (elle est annoncée au début du semestre).",
        "<b>Périodes</b> : le nombre de périodes par semaine. Corrige-le seulement si ton horaire diffère de la grille officielle."] },
      "Passer à l'année suivante": [
        "L'année ne se change pas dans le profil : touche <b>Réglages → Année scolaire → Passer en " + ord(Math.min(years(pr), pr.year + 1)) + " année</b>.",
        "Tes notes de l'année sont <b>classées dans « Années précédentes »</b> (rien n'est supprimé) et les moyennes repartent de zéro. Les notes des branches terminées sont reprises pour le certificat.",
        "<b>Annuler le dernier passage</b> remet tout comme avant."]
    };
    return g;
  }
  function passNotes(pr, next) {
    if (isECG(pr)) return next === 2 ? ["Tu choisiras ton domaine professionnel juste après."] : next === 3 ? ["Ta science et ton cours d'art de 2e sont repris pour le certificat, selon ton domaine."] : [];
    if (next === 3) return ["Tu choisiras ton option complémentaire juste après."];
    if (next === 4) return ["Chimie et " + (pr.art === "mu" ? "musique" : "arts visuels") + " (note de 2e), physique et biologie (note de 3e) sont reprises pour le certificat de maturité."];
    return [];
  }
  function afterPass(next) { var p = app().profile(); return isECG(p) ? (next === 2 ? "domaine" : null) : next === 3 ? "oc" : null; }

  function mod(voie) {
    return {
      id: "ge-" + voie, name: voie === "ecg" ? "Culture générale" : "Maturité gymnasiale", canton: "ge", matLike: voie !== "ecg",
      lists: voie === "ecg" ? { gymnase: ECGS, l2: E_LANG, l3: E_LANG, domaine: E_DOM, sci: E_SCI, art: eArt }
        : { gymnase: COLLEGES, l2: C_L2, l3: C_L3, os: C_OS, math: C_MATH, art: C_ART, oc: C_OC },
      build: voie === "ecg" ? buildEcg : buildCollege, rules: rules, rulesHtml: rulesHtml, head: head, summary: summary, statusText: statusText,
      years: years, bulletin: r1, tpLabel: function (p) { return isECG(p) ? (p.year <= 2 ? ["EFA", "Épreuve de fin d'année"] : null) : ["ER", "Épreuve regroupée"]; },
      fields: fields, stepText: stepText, valid: valid, blocked: blocked, sanitize: sanitize, warn: function () { return null; },
      needDomain: function (p) { return isECG(p) && p.year >= 2; }, needArt: needArt,
      lastYearSub: function (p) { return isECG(p) ? "avec le certificat ECG et les examens" : "avec le certificat de maturité et les examens"; },
      recapTip: function (p) { return isECG(p) ? "<b>Regroupements et EFA.</b> Plusieurs disciplines forment une seule note (par exemple les sciences humaines et sociales), selon les poids du règlement. En 1re et 2e, une épreuve de fin d'année (EFA) compte pour 1/3 de la note annuelle."
        : "<b>Semestres et épreuves regroupées.</b> Chaque semestre compte pour moitié ; dans un semestre, l'épreuve regroupée (ER) pèse 1/3 à 2/3 selon la branche et l'année. Tu peux changer ce pourcentage branche par branche dans Réglages."; },
      certName: certName, guide: guide, passNotes: passNotes, afterPass: afterPass,
      render: function (pr) { mountCarried(pr); if (pr.year === years(pr)) renderCert(pr); },
      detail: detail, carriedValue: carriedValue, carriedTitle: "Notes reprises", classSfx: voie === "ecg" ? "C" : "M"
    };
  }
  G.register("ge-mat", mod("mat"));
  G.register("ge-ecg", mod("ecg"));
})();
