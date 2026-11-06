/* Grille de l'École de maturité vaudoise (règles 2026-2027, REM BLV 412.12.1, brochure DGEP EM 2024).
   Transforme le profil choisi au premier lancement en liste de branches pour l'année en cours. */
(function () {
  "use strict";

  var GYMNASES = [
    { id: "piccard", name: "Gymnase Auguste Piccard", city: "Lausanne" },
    { id: "beaulieu", name: "Gymnase de Beaulieu", city: "Lausanne" },
    { id: "bugnon", name: "Gymnase du Bugnon", city: "Lausanne" },
    { id: "cite", name: "Gymnase de la Cité", city: "Lausanne" },
    { id: "provence", name: "Gymnase de Provence", city: "Lausanne" },
    { id: "chamblandes", name: "Gymnase de Chamblandes", city: "Pully" },
    { id: "renens", name: "Gymnase de Renens", city: "Renens" },
    { id: "bussigny", name: "Gymnase de Bussigny", city: "Bussigny" },
    { id: "morges", name: "Gymnase de Morges", city: "Morges" },
    { id: "nyon", name: "Gymnase de Nyon", city: "Nyon" },
    { id: "burier", name: "Gymnase de Burier", city: "La Tour-de-Peilz" },
    { id: "yverdon", name: "Gymnase d'Yverdon", city: "Yverdon-les-Bains" },
    { id: "gyb", name: "Gymnase intercantonal de la Broye", city: "Payerne", warn: "Régime intercantonal Vaud-Fribourg : certaines règles peuvent différer de celles calculées ici." },
    { id: "autre", name: "Autre gymnase", city: "" }
  ];

  var L2 = [
    { id: "de", name: "Allemand", short: "All.", periods: [4, 3, 3] },
    { id: "it", name: "Italien", sub: "si tu avais l'option italien au secondaire", short: "Ital.", periods: [4, 3, 3] },
    { id: "itdeb", name: "Italien débutant", sub: "pour commencer l'italien", short: "Ital.", periods: [5, 5, 3] }
  ];
  var L3 = [
    { id: "en", name: "Anglais", short: "Angl.", periods: [4, 3, 3] },
    { id: "la", name: "Latin", sub: "suite du latin du secondaire", short: "Lat.", periods: [3, 3, 3] },
    { id: "gr", name: "Grec", short: "Grec", periods: [3, 3, 3] }
  ];
  var MATH = [
    { id: "std", name: "Niveau standard", sub: "4 périodes chaque année", periods: [4, 4, 4] },
    { id: "renf", name: "Niveau renforcé", sub: "4, puis 5, puis 6 périodes", periods: [4, 5, 6] }
  ];
  var ART = [
    { id: "av", name: "Arts visuels", short: "AV" },
    { id: "mu", name: "Musique", short: "Mus." }
  ];
  // Composantes : [id, nom, périodes, TP]. La note d'OS = moyenne non arrondie des composantes pondérée par les périodes (REM art. 12).
  var OS = [
    { id: "AV", name: "Arts visuels", periods: [4, 4, 5], sub: "atelier et histoire de l'art" },
    { id: "BC", name: "Biologie et chimie", periods: [4.5, 5, 4.5], parts: [["osbio", "Biologie OS", [3, 2.5, 1.5], true], ["oschi", "Chimie OS", [1.5, 2.5, 3], true]] },
    { id: "ED", name: "Économie et droit", periods: [4, 4, 5] },
    { id: "ES", name: "Espagnol", periods: [4, 4, 5], sub: "débutants" },
    { id: "GR", name: "Grec", periods: [5, 4, 5] },
    { id: "IT", name: "Italien", periods: [4, 4, 5], sub: "suite de l'option italien du secondaire" },
    { id: "LA", name: "Latin", periods: [5, 4, 5], sub: "suite de l'option latin du secondaire" },
    { id: "MU", name: "Musique", periods: [4, 4, 5] },
    { id: "PP", name: "Philosophie et psychologie", periods: [4, 4, 5], parts: [["osphilo", "Philosophie OS", [2, 2, 3]], ["ospsy", "Psychologie OS", [2, 2, 2]]] },
    { id: "PAM", name: "Physique et applications des maths", periods: [4.5, 3.5, 5], sub: "impose les maths renforcées", parts: [["osphy", "Physique OS", [2.5, 1.5, 3], true], ["appl", "Applications des maths", [2, 2, 2]]] }
  ];
  var OC = [
    { id: "AM", name: "Applications des mathématiques" }, { id: "AV", name: "Arts visuels" }, { id: "BIO", name: "Biologie", tp: true },
    { id: "CH", name: "Chimie", tp: true }, { id: "ED", name: "Économie et droit" }, { id: "GEO", name: "Géographie" },
    { id: "HIST", name: "Histoire" }, { id: "HSR", name: "Histoire et sciences des religions" }, { id: "INFO", name: "Informatique" },
    { id: "MU", name: "Musique" }, { id: "PHYS", name: "Physique", tp: true }, { id: "SPORT", name: "Sport" }
  ];
  var OC_EXCLUDED = { PAM: ["AM", "PHYS"], BC: ["BIO", "CH"], ED: ["ED"], AV: ["AV", "MU", "SPORT"], MU: ["AV", "MU", "SPORT"] };
  // Notes comptées au bulletin pour la promotion (1re : 11 notes / 44 points, vade-mecum GAP 2024-25 ; 2e : 12 notes, déduit de la grille).
  var COUNTS = {
    1: ["fr", "l2", "l3", "ma", "os", "ph", "ch", "hi", "art", "info", "ed"],
    2: ["fr", "l2", "l3", "ma", "os", "ph", "ch", "bi", "hi", "ge", "art", "info"],
    3: ["fr", "l2", "l3", "ma", "os", "bi", "hi", "ge", "phi", "oc", "tm"]
  };

  // Part des TP par défaut dans les branches à TP (le canton n'en fixe pas : modifiable dans Réglages).
  var TP_SHARE = 0.25;

  function find(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }

  /* Ce qu'un choix interdit, avec la raison à afficher (lettre DGEP 2026-2027, DREM 8.1-8.4). */
  function osBlock(os, p) {
    if (os === "IT" && p.l2 && p.l2.indexOf("it") === 0) return "Tu as déjà l'italien en L2";
    if (os === "LA" && p.l3 === "la") return "Tu as déjà le latin en L3";
    if (os === "GR" && p.l3 === "gr") return "Tu as déjà le grec en L3";
    if (os === "GR" && p.gymnase === "burier") return "Pas ouvert au Gymnase de Burier";
    return null;
  }
  function mathBlock(m, p) { return p.os === "PAM" && m === "std" ? "L'OS physique et applications des maths impose le niveau renforcé" : null; }
  function ocBlock(oc, p) { var ex = OC_EXCLUDED[p.os]; return ex && ex.indexOf(oc) >= 0 ? "Exclue avec ton option spécifique" : null; }

  function build(p) {
    if (!p) return [];
    var y = Math.min(3, Math.max(1, p.year | 0)) - 1, out = [], counts = COUNTS[y + 1];
    function add(o, periods) {
      if (!periods[y]) return null;
      o.periods = periods[y];
      if (o.hasTP) o.tpShare = TP_SHARE;
      if (o.counts === undefined) o.counts = counts.indexOf(o.id) >= 0;
      out.push(o); return o;
    }
    var l2 = find(L2, p.l2) || L2[0], l3 = find(L3, p.l3) || L3[0], m = find(MATH, p.math) || MATH[0], art = find(ART, p.art) || ART[0];
    var os = find(OS, p.os), oc = find(OC, p.oc);
    add({ id: "fr", name: "Français", short: "Fr.", group: "fr" }, [5, 4, 4]);
    add({ id: "l2", name: l2.name + " (L2)", short: l2.short, group: "l2" }, l2.periods);
    add({ id: "l3", name: l3.name + " (L3)", short: l3.short, group: "l3" }, l3.periods);
    add({ id: "ma", name: "Mathématiques (" + (m.id === "renf" ? "renforcé" : "standard") + ")", short: "Maths", group: "maths" }, m.periods);
    if (os) {
      var o = add({ id: "os", name: "OS " + os.name, short: "OS", group: "os" }, os.periods);
      if (o && os.parts) {
        o.parts = [];
        os.parts.forEach(function (c) {
          if (!c[2][y]) return;
          o.parts.push(c[0]);
          out.push({ id: c[0], name: c[1], periods: c[2][y], part: true, hasTP: !!c[3], tpShare: c[3] ? TP_SHARE : 0 });
        });
      }
    }
    add({ id: "ph", name: "Physique", short: "Phys.", hasTP: true }, [1.5, 2.5, 0]);
    add({ id: "ch", name: "Chimie", short: "Chim.", hasTP: true }, [2.5, 1.5, 0]);
    add({ id: "bi", name: "Biologie", short: "Bio.", hasTP: true }, [0, 1.5, 2.5]);
    add({ id: "hi", name: "Histoire", short: "Hist." }, [2, 2, 2]);
    add({ id: "ge", name: "Géographie", short: "Géo." }, [0, 2, 2]);
    add({ id: "phi", name: "Philosophie", short: "Philo" }, [0, 0, 3]);
    add({ id: "art", name: art.name, short: art.short }, [2, 2, 0]);
    add({ id: "info", name: "Informatique", short: "Info." }, [2, 2, 0]);
    add({ id: "ed", name: "Économie et droit", short: "É&D" }, [2, 0, 0]);
    if (oc) add({ id: "oc", name: "OC " + oc.name, short: "OC", hasTP: !!oc.tp }, [0, 0, 3]);
    add({ id: "tm", name: "Travail de maturité", short: "TM" }, [0, 0, 1]);
    return out;
  }

  function gymnaseName(id) { var g = find(GYMNASES, id); return g && g.id !== "autre" ? g.name : ""; }

  window.Grid = {
    GYMNASES: GYMNASES, L2: L2, L3: L3, MATH: MATH, ART: ART, OS: OS, OC: OC,
    osBlock: osBlock, mathBlock: mathBlock, ocBlock: ocBlock, build: build, find: find, gymnaseName: gymnaseName
  };
})();
