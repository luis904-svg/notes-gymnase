/* ios-settings.js : Réglages « comme Apple » sur téléphone (≤ 700 px). Spécification : design/SPEC-reglages.md.
   Réglages est une page d'onglet (grand titre « Réglages », pas de bouton Retour). Les sous-pages (Profil, Branches, une
   branche, Synchronisation, Sauvegarde, Calcul des moyennes, À propos) sont poussées avec IOSNav.run (courte entrée CSS)
   et se quittent par le chevron de la barre ou par balayage du bord gauche (IOSNav.setBack).
   Une seule page est dans le DOM à la fois (#ios-set). Les blocs que d'autres modules montent dans #set-block (Sauvegarde,
   Synchronisation, À propos) sont déplacés dans leur sous-page, puis rendus à #set-block quand on la quitte : leurs
   boutons et leurs écouteurs restent ceux d'origine. Le guide, le passage d'année et les années précédentes gardent leurs
   écrans actuels : les lignes déclenchent leurs boutons d'origine (cachés). Profil : chaque ligne rouvre l'assistant
   (Onboard.open(true, étape)) qui garde les règles de cohérence entre choix.
   Sur grand écran, rien ne change : ce module se retire et rend les blocs à #set-block. */
(function () {
  "use strict";
  var view = document.getElementById("view-settings");
  if (!view) return;
  var mq = window.matchMedia("all");
  var container = document.createElement("div");
  container.id = "ios-set"; container.className = "ios-set";
  view.insertBefore(container, view.firstChild);

  function app() { return window.NotesApp; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function $(s, r) { return (r || document).querySelector(s); }
  var ORD = { 1: "1re", 2: "2e", 3: "3e" };
  var MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  var cal = null;   // mois affiché dans le calendrier de la page « Fin du semestre 1 »
  function fmtDate(iso) { var p = String(iso || "").split("-"); return p.length === 3 ? p[2] + "." + p[1] + "." + p[0] : "–"; }
  function fmtNum(x) { return x == null || x === "" ? "–" : String(Math.round(x * 100) / 100); }

  /* ---------- Éléments de liste ---------- */
  var SVG = window.Icons.inner;   // banque d'icônes (icons.js, Lucide)
  var CHEV_L = '<svg class="ios-chev" viewBox="0 0 24 24" aria-hidden="true">' + SVG.chevl + '</svg>';
  var CHEV = '<svg class="ios-chev" viewBox="0 0 24 24" aria-hidden="true">' + SVG.chevr + '</svg>';
  function icon(color, svg) { return '<i class="ios-ic ios-ic-' + color + '"><svg viewBox="0 0 24 24" aria-hidden="true">' + SVG[svg] + '</svg></i>'; }
  /* act : "go:page[:arg]" (pousse une sous-page), "click:id" (déclenche un bouton d'origine), "step:id" (assistant de profil). */
  function row(o) {
    return '<button type="button" class="ios-row' + (o.ic ? " has-ic" : "") + '" data-act="' + esc(o.act) + '">' +
      (o.ic ? icon(o.ic, o.svg) : "") + '<span class="ios-row-l">' + esc(o.label) + '</span>' +
      (o.val != null ? '<span class="ios-val">' + esc(o.val) + '</span>' : "") + CHEV + '</button>';
  }
  function grp(rows, head, foot) {
    return (head ? '<p class="ios-grp-head">' + esc(head) + '</p>' : "") + '<div class="ios-grp">' + rows.join("") + '</div>' + (foot ? '<p class="ios-grp-foot">' + esc(foot) + '</p>' : "");
  }
  /* Apparence (v63, lot 8) : Auto suit le réglage de l'iPhone ; Clair et Sombre le forcent sur cet appareil (NotesTheme, script de l'en-tête). */
  function appearanceGrp() {
    var cur = window.NotesTheme ? NotesTheme.get() : "auto";
    var seg = '<div class="ios-appseg" role="group" aria-label="Apparence">' + [["auto", "Auto"], ["light", "Clair"], ["dark", "Sombre"]].map(function (o) {
      return '<button type="button" data-theme-set="' + o[0] + '" aria-pressed="' + (cur === o[0]) + '">' + o[1] + '</button>';
    }).join("") + '</div>';
    // Grand écran (session D) : l'ordinateur a son propre réglage clair / sombre.
    var foot = window.matchMedia("(min-width: 701px)").matches ? "Auto suit le réglage clair ou sombre de ton ordinateur. Ce choix reste sur cet appareil." :
      "Auto suit le réglage de ton iPhone (Réglages > Affichage et luminosité). Ce choix reste sur cet appareil.";
    return grp([seg], "Apparence", foot);
  }
  function cfg() { return app().get().cfg; }
  function subjects() { return app().subjectsAll().filter(function (s) { return !s.carried; }); }
  function subOf(id) { return subjects().filter(function (s) { return s.id === id; })[0]; }

  /* Domaine d'une branche -> [couleur, symbole] (langues bleu, maths orange, sciences vert, humanités rouge, autres gris). */
  var DOM = {
    lang: ["blue", "bubble"], math: ["orange", "plusminus"], sci: ["green", "flask"], hum: ["red", "globe"], art: ["gray", "palette"], info: ["gray", "terminal"], other: ["gray", "book"]
  };
  var BY = { fr: "lang", l2: "lang", l3: "lang", phi: "hum", art: "art", tm: "other", de: "lang", it: "lang", itdeb: "lang", en: "lang", la: "lang", gr: "lang", es: "lang",
    ma: "math", appl: "math", am: "math", ph: "sci", bi: "sci", ch: "sci", osphy: "sci", osbio: "sci", oschi: "sci",
    hi: "hum", ge: "hum", ed: "hum", osphilo: "hum", ospsy: "hum", hsr: "hum", ar: "art", av: "art", mu: "art", in: "info", info: "info" };
  var OSDOM = { AV: "art", BC: "sci", ED: "hum", ES: "lang", GR: "lang", IT: "lang", LA: "lang", MU: "art", PP: "hum", PAM: "math" };
  var OCDOM = { AM: "math", AV: "art", BIO: "sci", CH: "sci", ED: "hum", GEO: "hum", HIST: "hum", HSR: "hum", INFO: "info", MU: "art", PHYS: "sci" };
  function domain(id) {
    var k = BY[id], pr = app().profile() || {};
    if (!k && id === "os") k = OSDOM[pr.os];
    if (!k && id === "oc") k = OCDOM[pr.oc];
    return DOM[k || "other"];
  }

  /* ---------- Profil modifiable en direct ----------
     Chaque champ : titre, liste des choix, et `drop` = la branche liée au choix (ses notes sont supprimées si le choix change :
     l'identifiant de branche « l2 », « os »… reste le même d'un choix à l'autre, les notes ne doivent pas changer de matière). */
  var pending = null;
  var FIELDS = {
    gymnase: { title: "Gymnase", list: function () { return Grid.GYMNASES; } },
    domaine: { title: "Domaine professionnel", list: function () { return Grid.list("domaine", app().profile()); }, foot: "Changer de domaine masque les notes des branches qui n'existent pas dans le nouveau domaine : elles reviennent si tu reprends l'ancien." },
    l2: { title: "Deuxième langue (L2)", list: function () { return Grid.list("l2", app().profile()); }, drop: "l2" },
    l3: { title: "Troisième langue (L3)", list: function () { return Grid.L3; }, drop: "l3" },
    os: { title: "Option spécifique", list: function () { return Grid.OS; }, drop: "os", foot: "L'option physique et applications des maths impose les maths renforcées : le niveau est ajusté automatiquement." },
    math: { title: "Mathématiques", list: function () { return Grid.MATH; }, foot: "Changer de niveau garde tes notes de mathématiques." },
    art: { title: "Discipline artistique", list: function () { return Grid.list("art", app().profile()); }, drop: "art" },
    oc: { title: "Option complémentaire", list: function () { return Grid.OC; }, drop: "oc" }
  };
  // Profil obtenu en choisissant `id` pour le champ `f` (l'OS PAM impose les maths renforcées).
  function withChoice(f, id) {
    var np = Object.assign({}, app().profile()); np[f] = id;
    if (f === "os" && id === "PAM") np.math = "renf";
    return np;
  }
  // Raison pour laquelle un choix est impossible avec le reste du profil, ou null.
  function blocked(f, id) {
    var G = window.Grid, np = withChoice(f, id), why, vx = G.ext(app().profile());
    if (vx) return vx.blocked(f, id, np);
    if (f === "gymnase") return np.os === "GR" && id === "burier" ? "Le grec en option spécifique n'y est pas ouvert" : null;
    if ((why = G.mathBlock(np.math, np))) return f === "math" ? why : "Incompatible avec ton niveau de maths";
    if ((why = G.osBlock(np.os, np))) return f === "os" ? why : "Tu as déjà cette langue en option spécifique";
    if (np.year === 3 && np.oc && (why = G.ocBlock(np.oc, np))) return f === "oc" ? why : "Incompatible avec ton option complémentaire";
    return null;
  }
  // Notes (TA regroupés) de la branche liée au champ, avec ses composantes (OS composée).
  function branchOf(f) {
    var id = FIELDS[f].drop; if (!id) return null;
    var all = app().subjectsAll(), s = all.filter(function (x) { return x.id === id && !x.carried; })[0]; if (!s) return null;
    var ids = [id].concat(s.parts || []);
    var recs = app().records().filter(function (r) { return ids.indexOf(r.subject) >= 0; });
    return { name: s.name, n: app().collapse(recs).length, ids: recs.map(function (r) { return r.id; }), subs: ids };
  }
  function pick(f, id) {
    var pr = app().profile(); if (!pr || !FIELDS[f] || pr[f] === id || blocked(f, id)) return;
    var np = withChoice(f, id), b = branchOf(f);
    if (b && b.n) { pending = { field: f, np: np, name: b.name, n: b.n, ids: b.ids, subs: b.subs }; hap("warn"); push("retire"); return; }
    if (b && b.ids.length) app().remove(b.ids);       // définitions de TA sans ETA, par sécurité
    app().setProfile(np, b ? b.subs : null); hap("success"); pop();
  }
  function hap(k) { if (window.FX) FX.haptic(k); }

  /* ---------- Tuiles d'état de la page principale (v58) ---------- */
  function dateShort(iso) { var p = String(iso || "").split("-"); if (p.length !== 3) return "–"; try { return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString("fr-CH", { day: "numeric", month: "short" }); } catch (e) { return fmtDate(iso); } }
  function agoShort(t) {
    if (!t) return "";
    var m = Math.round((Date.now() - t) / 60000);
    return m < 1 ? "à l'instant" : m < 60 ? "il y a " + m + " min" : m < 1440 ? "il y a " + Math.round(m / 60) + " h" : "il y a " + Math.round(m / 1440) + " j";
  }
  function stile(label, st, text, foot, act) {
    return '<button type="button" class="ios-stile" data-act="' + act + '"><span class="ios-dk">' + label + '</span><b><i class="ios-sdot is-' + st + '"></i>' + esc(text) + '</b>' +
      (foot ? '<span class="ios-dfoot">' + esc(foot) + '</span>' : "") + '</button>';
  }
  function syncTile() {
    var S = window.Sync;
    if (!S || !S.available || !S.available()) return stile("Synchronisation", "none", "Indisponible", "", "go:sync");
    if (!S.enabled()) return stile("Synchronisation", "none", "Désactivée", "Retrouve tes notes partout", "go:sync");
    var st = S.status ? S.status() : "ok", last = S.last ? S.last() : 0;
    if (st === "offline") return stile("Synchronisation", "warn", "Hors connexion", last ? "dernière fois " + agoShort(last) : "", "go:sync");
    if (st === "badcode") return stile("Synchronisation", "crit", "Code refusé", "vérifie le code", "go:sync");
    return stile("Synchronisation", "ok", st === "sync" ? "En cours…" : "À jour", last ? agoShort(last) : "", "go:sync");
  }
  function backupTile() {
    var t = window.FX && FX.backupAt ? FX.backupAt() : 0;
    if (!t) return stile("Sauvegarde", "warn", "Jamais", "Exporte un fichier", "go:backup");
    var d = Math.floor((Date.now() - t) / 86400000);
    return stile("Sauvegarde", d > 30 ? "warn" : "ok", d <= 0 ? "Aujourd'hui" : d === 1 ? "Hier" : "Il y a " + d + " j", d > 30 ? "Exporte un nouveau fichier" : "Fichier exporté", "go:backup");
  }

  /* ---------- Pages ---------- */
  var PAGES = {
    main: {
      title: "Réglages", large: true,
      // v58 (style C du canvas) : tuile Profil, deux tuiles d'état (synchronisation, sauvegarde), puis des sections titrées.
      html: function () {
        var pr = app().profile() || {}, G = window.Grid, c = cfg(), arch = app().archive();
        var sfx = G && !G.isMat(pr) ? "C" : "M";
        var gname = G && pr.gymnase ? G.gymnaseName(pr.gymnase) : "", name = "Notes " + (pr.classe || (pr.year ? pr.year + sfx : ""));
        var initials = esc((pr.classe || (pr.year ? pr.year + sfx : "N")).slice(0, 2));
        var prof = '<div class="ios-grp"><button type="button" class="ios-row ios-prof" data-act="go:profil"><span class="ios-avatar">' + initials + '</span>' +
          '<span class="ios-prof-t"><span class="ios-dk">Profil</span><b>' + esc(name) + '</b><span>' + esc((gname ? gname + " · " : "") + (pr.year ? ORD[pr.year] + " année" : "")) + '</span></span>' + CHEV + '</button></div>';
        var tiles = '<div class="ios-stiles">' + syncTile() + backupTile() + '</div>';
        var an = [];
        if (pr.year && pr.year < 3) an.push(row({ ic: "green", svg: "up", label: "Passer en " + ORD[pr.year + 1] + " année", act: "go:yearpass" }));
        // 3e année : notes de 2e reprises (chimie, physique, art), bloc #carriedset de cert.js.
        if (pr.year === 3 && app().subjectsAll().some(function (x) { return x.carried; })) an.push(row({ ic: "green", svg: "flask", label: G.isMat(pr) ? "Notes reprises de 2e" : "Notes reprises de 1re", act: "go:carried" }));
        if (arch.length) an.push(row({ ic: "gray", svg: "archive", label: "Années précédentes", val: String(arch.length), act: "go:history" }));
        var hap = document.getElementById("bk-haptic");
        var hapRow = '<label class="ios-row has-ic">' + icon("gray", "phone") + '<span class="ios-row-l">Retours haptiques</span><input type="checkbox" switch id="ios-haptic"' + (!hap || hap.checked ? " checked" : "") + '></label>';
        return '<h1 class="ios-large">Réglages</h1>' + prof + tiles +
          grp([row({ ic: "green", svg: "list", label: "Branches et objectifs", val: String(subjects().length), act: "go:branches" }),
               row({ ic: "orange", svg: "calendar", label: "Fin du semestre 1", val: dateShort(c.s1End), act: "go:semestre" })], "Branches") +
          grp([row({ ic: "blue", svg: "sync", label: "Synchronisation", act: "go:sync" }), row({ ic: "gray", svg: "save", label: "Sauvegarde", act: "go:backup" }), row({ ic: "green", svg: "doc", label: "Importer depuis un tableur", act: "imp:open" }), hapRow], "Données") +
          appearanceGrp() +
          (an.length ? grp(an, "Année scolaire") : "") +
          grp([row({ ic: "orange", svg: "book", label: "Guide d'utilisation", act: "gdopen" }),
               row({ ic: "gray", svg: "calc", label: "Calcul des moyennes", act: "go:rules" }),
               row({ ic: "gray", svg: "info", label: "À propos", act: "go:about" })], "Aide") +
          '<p class="ios-copy">©louis mutter</p>';
      }
    },
    profil: {
      title: "Profil",
      html: function () {
        var pr = app().profile() || {}, G = window.Grid;
        function nm(list, id) { var it = G.find(list, id); return it ? it.name : "–"; }
        var vx = G.ext(pr), vn = G.VOIES.filter(function (v) { return v.id === G.voieOf(pr); })[0];
        var rows = [
          row({ ic: "gray", svg: "list", label: "Voie", val: vn ? vn.name : "", act: "step:voie" }),
          row({ ic: "blue", svg: "building", label: "Gymnase", val: G.gymnaseName(pr.gymnase) || "Autre", act: "go:choix:gymnase" }),
          '<div class="ios-row has-ic">' + icon("orange", "calendar") + '<span class="ios-row-l">Année</span><span class="ios-val">' + (pr.year ? ORD[pr.year] : "–") + '</span></div>',
          row({ ic: "gray", svg: "people", label: "Classe", val: pr.classe || "–", act: "go:classe" }),
          ].concat(vx ? [
          row({ ic: "blue", svg: "bubble", label: "Deuxième langue (L2)", val: nm(G.list("l2", pr), pr.l2), act: "go:choix:l2" })
        ].concat(pr.year >= 2 ? [row({ ic: "green", svg: "star", label: "Domaine professionnel", val: nm(G.list("domaine", pr), pr.domaine), act: "go:choix:domaine" })] : [])
          .concat(vx.needArt(pr) ? [row({ ic: "red", svg: "palette", label: "Discipline artistique", val: nm(G.list("art", pr), pr.art), act: "go:choix:art" })] : []) : [
          row({ ic: "blue", svg: "bubble", label: "Deuxième langue (L2)", val: nm(G.L2, pr.l2), act: "go:choix:l2" }),
          row({ ic: "blue", svg: "bubble", label: "Troisième langue (L3)", val: nm(G.L3, pr.l3), act: "go:choix:l3" }),
          row({ ic: "green", svg: "star", label: "Option spécifique", val: nm(G.OS, pr.os), act: "go:choix:os" }),
          row({ ic: "orange", svg: "plusminus", label: "Mathématiques", val: pr.math === "renf" ? "Renforcé" : "Standard", act: "go:choix:math" }),
          row({ ic: "red", svg: "palette", label: "Discipline artistique", val: nm(G.ART, pr.art), act: "go:choix:art" })
        ]);
        if (pr.year === 3 && !vx) rows.push(row({ ic: "gray", svg: "star", label: "Option complémentaire", val: nm(G.OC, pr.oc), act: "go:choix:oc" }));
        return grp(rows, null, "Chaque choix s'enregistre tout de suite et recalcule les branches. L'année se change avec « Passer à l'année suivante ». Changer de langue, d'option ou de discipline artistique supprime les notes de l'ancienne branche, après confirmation.");
      }
    },
    /* Un choix du profil : la liste des possibilités, la valeur actuelle cochée ; toucher enregistre tout de suite. */
    choix: {
      title: function (f) { return FIELDS[f] ? FIELDS[f].title : "Profil"; },
      html: function (f) {
        var F = FIELDS[f], pr = app().profile() || {}; if (!F) return "";
        var rows = F.list().map(function (o) {
          var cur = pr[f] === o.id, why = cur ? null : blocked(f, o.id), sub = why || o.sub || o.city || "";
          return '<button type="button" class="ios-row ios-opt" data-act="pick:' + f + ':' + o.id + '"' + (why ? " disabled" : "") + '>' +
            '<span class="ios-row-l">' + esc(o.name) + (sub ? '<small class="ios-row-s">' + esc(sub) + '</small>' : "") + '</span>' +
            (cur ? '<svg class="ios-check" viewBox="0 0 24 24" aria-label="Choix actuel">' + SVG.check + '</svg>' : "") + '</button>';
        });
        return grp(rows, null, F.foot || "");
      }
    },
    classe: {
      title: "Classe",
      html: function () {
        var pr = app().profile() || {};
        return '<div class="ios-grp"><label class="ios-row"><span class="ios-row-l">Classe</span><input type="text" id="ios-classe" class="ios-input" maxlength="8" autocapitalize="characters" autocomplete="off" value="' + esc(pr.classe || "") + '" placeholder="' + (pr.year || 1) + (window.Grid && !Grid.isMat(pr) ? "C01" : "M01") + '"></label></div>' +
          '<p class="ios-grp-foot">Le nom de ta classe apparaît en haut de l\'Accueil. Il s\'enregistre quand tu quittes le champ. Son premier chiffre suit l\'année au passage d\'année.</p>';
      }
    },
    /* Confirmation avant de retirer une branche qui a des notes (pending est posé par pick()). */
    retire: {
      title: "Supprimer des notes ?",
      html: function () {
        var q = pending; if (!q) return "";
        return '<p class="ios-grp-head">' + esc(FIELDS[q.field].title) + '</p><div class="ios-grp ios-warn"><p>Ce changement retire la branche <b>' + esc(q.name) + '</b> et supprime ' +
          (q.n > 1 ? 'ses <b>' + q.n + ' notes</b>' : 'sa <b>note</b>') + ', avec leurs TA et leurs photos. Les autres branches gardent leurs notes.</p></div>' +
          '<p class="ios-grp-foot">Pour garder une trace, exporte une sauvegarde avant de supprimer.</p>' +
          grp([row({ ic: "green", svg: "save", label: "Exporter une sauvegarde", act: "click:bk-export" })]) +
          '<div class="ios-grp"><button type="button" class="ios-row ios-danger" data-act="retire:oui"><span class="ios-row-l">Supprimer</span></button>' +
          '<button type="button" class="ios-row" data-act="retire:non"><span class="ios-row-l">Annuler</span></button></div>';
      }
    },
    branches: {
      title: "Branches",
      html: function () {
        var rows = subjects().map(function (s) {
          var d = domain(s.id);
          return row({ ic: d[0], svg: d[1], label: s.name, val: s.goal ? fmtNum(s.goal) : "–", act: "go:branch:" + s.id });
        });
        return grp(rows, null, "Valeur à droite : ton objectif. Les périodes viennent de la grille officielle de ton année ; corrige-les si ton horaire est différent.");
      }
    },
    branch: {
      title: function (a) { var s = subOf(a); return s ? s.name : "Branche"; },
      html: function (a) {
        var s = subOf(a); if (!s) return '<p class="ios-grp-foot">Cette branche n\'existe plus.</p>';
        function num(label, k, val, attrs, ic, svg) {
          return '<label class="ios-row has-ic">' + icon(ic, svg) + '<span class="ios-row-l">' + label + '</span><input class="ios-in" type="number" ' + attrs + ' data-k="' + k + '" data-id="' + esc(s.id) + '" value="' + esc(val) + '" placeholder="–" aria-label="' + label + '"></label>';
        }
        var rows = [
          num("Périodes", "periods", s.periods, 'inputmode="numeric" min="1" max="10" step="1"', "blue", "clock"),
          num("Part des TP (%)", "tp", Math.round((s.tpShare || 0) * 100), 'inputmode="numeric" min="0" max="100" step="5"', "green", "flask")
        ];
        var promo = s.part ? '<div class="ios-grp"><div class="ios-row has-ic">' + icon("gray", "check") + '<span class="ios-row-l">Compte pour la promotion</span><span class="ios-val">via l\'option spécifique</span></div></div>'
          : '<div class="ios-grp"><label class="ios-row has-ic">' + icon("gray", "check") + '<span class="ios-row-l">Compte pour la promotion</span><input type="checkbox" switch data-k="counts" data-id="' + esc(s.id) + '"' + (s.counts ? " checked" : "") + ' aria-label="Compte pour la promotion"></label></div>';
        var g = s.goal ? +s.goal : null;
        var goal = '<div class="ios-grp ios-goal" data-goal-id="' + esc(s.id) + '"><div class="ios-row has-ic">' + icon("orange", "target") + '<span class="ios-row-l">Objectif</span>' +
          '<button type="button" class="ios-goal-val" data-goal-edit aria-label="Objectif, modifier au clavier">' + (g ? fmtNum(g) : "–") + '</button></div>' +
          '<div class="ios-goal-sl"><span aria-hidden="true">1</span><input type="range" class="ios-range" min="1" max="6" step="0.5" value="' + halfGoal(g || 4) + '" style="--ios-fillf:' + ((halfGoal(g || 4) - 1) / 5).toFixed(3) + '" data-goal-range aria-label="Objectif de ' + esc(s.name) + '"><span aria-hidden="true">6</span></div>' +
          (g ? '<button type="button" class="ios-row ios-goal-clear" data-act="goalclear:' + esc(s.id) + '"><span class="ios-row-l">Retirer l\'objectif</span></button>' : "") + '</div>';
        return grp(rows.slice(0, 1), null, "") + goal + grp(rows.slice(1), null, s.verify ? "À vérifier avec ton horaire : modifie une valeur pour confirmer." : "") + promo;
      }
    },
    semestre: {
      title: "Fin du semestre 1",
      html: function () {
        var c = cfg(), iso = c.s1End, sel = String(iso || "");
        if (!cal) { var q = sel.split("-"); cal = { y: parseInt(q[0], 10) || new Date().getFullYear(), m: (parseInt(q[1], 10) || 1) - 1 }; }
        var first = new Date(cal.y, cal.m, 1), lead = (first.getDay() + 6) % 7, n = new Date(cal.y, cal.m + 1, 0).getDate();
        var today = new Date(), ti = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
        var days = "";
        for (var i = 0; i < lead; i++) days += '<span class="ios-day-x"></span>';
        for (var d = 1; d <= n; d++) {
          var di = cal.y + "-" + String(cal.m + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
          days += '<button type="button" class="ios-day' + (di === sel ? " is-sel" : "") + (di === ti ? " is-today" : "") + '" data-act="day:' + di + '" aria-label="' + d + " " + MONTHS[cal.m] + " " + cal.y + '">' + d + '</button>';
        }
        return '<div class="ios-grp"><div class="ios-row has-ic">' + icon("red", "calendar") + '<span class="ios-row-l">Fin du semestre 1</span><span class="ios-val">' + esc(fmtDate(iso)) + '</span></div></div>' +
          '<div class="ios-grp ios-cal"><div class="ios-cal-head"><b>' + MONTHS[cal.m] + " " + cal.y + '</b><span><button type="button" data-act="cal:prev" aria-label="Mois précédent">' + CHEV_L + '</button><button type="button" data-act="cal:next" aria-label="Mois suivant">' + CHEV + '</button></span></div>' +
          '<div class="ios-cal-wd" aria-hidden="true"><span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span></div><div class="ios-cal-days">' + days + '</div></div>' +
          '<p class="ios-grp-foot">Les notes datées jusqu\'à ce jour comptent pour le semestre 1, les suivantes pour le semestre 2.</p>';
      }
    },
    sync: { title: "Synchronisation", adopt: "sync", html: function () { return '<div class="ios-slot" data-slot="sync"></div>'; } },
    backup: { title: "Sauvegarde", adopt: "backup", html: function () { return '<div class="ios-slot" data-slot="backup"></div>'; } },
    // Exporter (22 novembre 2026, demande de l'utilisateur) : contenu du fichier façon Stockage iPhone et interrupteur « Inclure les photos », contenu donné par fx.js.
    export: { title: "Exporter", html: function () { return '<div class="ios-bx">' + (window.FX && FX.exportHtml ? FX.exportHtml() : "") + '</div>'; } },
    carried: { title: function () { return window.Grid && !Grid.isMat(app().profile()) ? "Notes reprises de 1re" : "Notes reprises de 2e"; }, adopt: "carriedset", html: function () { return '<div class="ios-slot" data-slot="carriedset"></div>'; } },
    // Guide d'utilisation (20 novembre 2026, comme l'import) : blocs gardés par guide.js.
    guide: { title: "Guide", adopt: "gd", html: function () { return '<div class="ios-slot" data-slot="gd-blk-list"></div>'; } },
    guidech: { title: function () { return window.Guide && Guide.pageTitle ? Guide.pageTitle() : "Guide"; }, adopt: "gd", html: function () { return '<div class="ios-slot" data-slot="gd-blk-step"></div>'; } },
    // Passage d'année et années précédentes (20 novembre 2026, comme l'import) : contenu donné par year.js.
    yearpass: { title: function () { var pr = app().profile() || {}; return pr.year && pr.year < 3 ? "Passer en " + ORD[pr.year + 1] + " année" : "Année scolaire"; },
      html: function () { return '<div class="ios-sub-in">' + (window.YearPass ? YearPass.passHtml(true) : "") + '</div>'; } },
    history: { title: "Années précédentes", html: function () { return '<div class="ios-sub-in">' + (window.YearPass ? YearPass.historyHtml(true) : "") + '</div>'; } },
    // Import depuis un tableur (choix A, 20 novembre 2026) : deux sous-pages, blocs gardés par import.js.
    import: { title: "Importer", adopt: "imp", html: function () { return '<div class="ios-slot" data-slot="imp-blk-start"></div>'; } },
    importp: { title: "Aperçu", adopt: "imp", html: function () { return '<div class="ios-slot" data-slot="imp-blk-prev"></div>'; } },
    about: { title: "À propos", adopt: "about", html: function () { return '<div class="ios-slot" data-slot="about"></div>'; } },
    rules: {
      title: "Calcul des moyennes",
      html: function () {
        var src = document.querySelector("details.panel .rules");
        return '<div class="ios-grp ios-rules">' + (src ? src.outerHTML : "") + '</div>';
      }
    }
  };
  function titleOf(e) { var t = PAGES[e.id].title; return typeof t === "function" ? t(e.arg) : t; }
  function key(e) { return e.id + (e.arg ? ":" + e.arg : ""); }

  /* ---------- Blocs d'autres modules (déplacés le temps d'une sous-page) ---------- */
  var adopted = [];
  function home() { return document.getElementById("set-block"); }
  function releaseBlocks() { var h = home(); adopted.forEach(function (n) { if (h) h.appendChild(n); else if (n.parentNode) n.parentNode.removeChild(n); }); adopted = []; }
  function adoptInto(node) {
    [].forEach.call(node.querySelectorAll("[data-slot]"), function (slot) {
      var n = document.getElementById(slot.dataset.slot);
      if (n) { slot.appendChild(n); adopted.push(n); } else slot.innerHTML = '<p class="ios-grp-foot">Indisponible pour le moment.</p>';
    });
  }

  /* ---------- Pile de pages ---------- */
  var stack = [{ id: "main" }], scrolls = {}, active = false;
  function top() { return stack[stack.length - 1]; }
  function build(e) {
    var node = document.createElement("div"); node.className = "ios-page ios-page-" + e.id;
    node.innerHTML = PAGES[e.id].html(e.arg); return node;
  }
  function ctxFor(e) {
    var p = PAGES[e.id];
    return { key: "set-" + key(e), title: titleOf(e), large: p.large ? container.querySelector(".ios-large") : null, back: stack.length > 1 ? pop : null };
  }
  function settingsVisible() { return !view.hidden; }
  function show(scrollY) {
    releaseBlocks();
    var e = top(), node = build(e);
    container.replaceChildren(node);
    if (PAGES[e.id].adopt) adoptInto(node);
    window.scrollTo(0, scrollY || 0);
    if (settingsVisible() && window.IOSTitle) IOSTitle.set(ctxFor(e));
    if (window.IOSNav) IOSNav.setBack(stack.length > 1 ? provider : null);
    pillSync();
  }
  function pillSync() { if (window.IOSTitle) IOSTitle.pill("settings", active && settingsVisible() && stack.length > 1); }
  function run(dir, mutate) { if (window.IOSNav) IOSNav.run(dir, mutate); else mutate(); }
  function push(id, arg) {
    scrolls[key(top())] = window.scrollY;
    if (id === "semestre") cal = null;
    run("push", function () { stack.push({ id: id, arg: arg }); show(0); });
  }
  function pop() {
    if (stack.length < 2) return;
    run("pop", function () { stack.pop(); show(scrolls[key(top())] || 0); });
  }
  // Onglet Réglages touché alors qu'une sous-page est ouverte : retour à la page principale (comme iOS).
  function root() {
    if (stack.length < 2) return false;
    run("pop", function () { stack = [stack[0]]; show(scrolls[key(top())] || 0); });
    return true;
  }
  var provider = {
    can: function () { return active && stack.length > 1 && settingsVisible(); },
    parent: function (clone) {                    // la copie montre la page du dessous
      var c = clone.querySelector("#ios-set"); if (!c) return;
      var pg = build(stack[stack.length - 2]);
      // Une page à bloc gardé (ex. Importer sous Aperçu) : la copie montre une copie du bloc, sinon elle serait vide.
      [].forEach.call(pg.querySelectorAll("[data-slot]"), function (slot) { var n = document.getElementById(slot.dataset.slot); if (n) slot.appendChild(n.cloneNode(true)); });
      c.replaceChildren(pg);
    },
    parentScroll: function () { return scrolls[key(stack[stack.length - 2])] || 0; },
    parentBar: function () {
      var pe = stack[stack.length - 2], p = PAGES[pe.id], y = scrolls[key(pe)] || 0;
      return { title: titleOf(pe), on: p.large ? y >= window.IOSTitle.threshold("set-" + key(pe), 48) : true, back: stack.length - 2 > 0 };
    },
    go: pop
  };

  /* ---------- Interactions ---------- */
  container.addEventListener("click", function (ev) {
    var th = ev.target.closest("[data-theme-set]");
    if (th && window.NotesTheme) {
      NotesTheme.set(th.dataset.themeSet);
      Array.prototype.forEach.call(container.querySelectorAll("[data-theme-set]"), function (x) { x.setAttribute("aria-pressed", String(x.dataset.themeSet === NotesTheme.get())); });
      return;
    }
    var b = ev.target.closest("[data-act]"); if (!b) return;
    var a = b.dataset.act.split(":"), kind = a[0];
    if (kind === "go") push(a[1], a[2]);
    else if (kind === "click") {
      var t = document.getElementById(a[1]); if (t) t.click();
      // Un bouton d'origine peut changer l'état tout de suite (ex. « Annuler le dernier passage ») : la page est refaite si aucune fenêtre n'est ouverte.
      if (!document.body.classList.contains("ob-open") && !document.body.classList.contains("gd-open")) show(window.scrollY);
    }
    else if (kind === "goalclear") { app().setSubj(a[1], "goal", null); hap("tap"); show(window.scrollY); }
    else if (kind === "pick") pick(a[1], a[2]);
    else if (kind === "retire") {
      var q = pending; pending = null;
      if (a[1] === "oui" && q) {
        app().remove(q.ids); app().setProfile(q.np, q.subs); hap("heavy");
        // Retour à la page Profil (on quitte la confirmation et la liste de choix).
        run("pop", function () { stack.pop(); stack.pop(); show(scrolls[key(top())] || 0); });
      } else pop();
    }
    else if (kind === "imp") { openImport(); }
    else if (kind === "gdopen") { if (window.Guide && Guide.inline && Guide.inline()) push("guide"); else document.getElementById("gd-open").click(); }
    else if (kind === "ypgo") { YearPass.doPass(); root(); }
    else if (kind === "ypundo") { YearPass.undo().then(function (ok) { if (ok) root(); }); }
    else if (kind === "step") { if (window.Onboard) Onboard.open(true, a[1]); }
    else if (kind === "cal") { cal.m += a[1] === "next" ? 1 : -1; if (cal.m > 11) { cal.m = 0; cal.y++; } if (cal.m < 0) { cal.m = 11; cal.y--; } show(window.scrollY); }
    else if (kind === "day") { app().setS1End(a[1]); show(window.scrollY); }
  });
  function openImport() {
    Grid.script("import.js").then(function () { if (Import.inline()) push("import"); }, function () { IOSSheet.notice({ title: "Connexion nécessaire", message: "L'import se charge à la première utilisation : connecte-toi à Internet, puis réessaie." }); });
  }
  /* Objectif : slider de 1 à 6 (pas 0,5) ; toucher la valeur ouvre le clavier numérique, ancienne valeur sélectionnée
     (la première touche l'efface). Le réglage est enregistré au relâchement ou à la validation, jamais pendant le glissement. */
  function clampGoal(v) { return Math.min(6, Math.max(1, Math.round(v * 100) / 100)); }
  // Curseur : de 0,5 en 0,5 (22 novembre 2026, demande de l'utilisateur) ; la saisie au clavier garde le centième.
  function halfGoal(v) { return Math.min(6, Math.max(1, Math.round(v * 2) / 2)); }
  function goalBox(el) { return el.closest(".ios-goal"); }
  function goalShow(box, g) {
    var v = box.querySelector(".ios-goal-val"); if (v) v.textContent = g == null ? "–" : fmtNum(g);
    var r = box.querySelector(".ios-range"); if (r && g != null) { r.value = halfGoal(g); r.style.setProperty("--ios-fillf", ((halfGoal(g) - 1) / 5).toFixed(3)); }
  }
  function goalSave(box, g) { app().setSubj(box.dataset.goalId, "goal", g); goalShow(box, g); }
  function goalEdit(box) {
    var b = box.querySelector(".ios-goal-val"); if (!b || b.tagName === "INPUT") return;
    var cur = subOf(box.dataset.goalId), inp = document.createElement("input");
    inp.type = "text"; inp.className = "ios-goal-val ios-goal-in"; inp.inputMode = "decimal"; inp.setAttribute("enterkeyhint", "done");
    inp.autocomplete = "off"; inp.setAttribute("aria-label", "Objectif"); inp.value = cur && cur.goal ? String(cur.goal) : "";
    b.replaceWith(inp); inp.focus(); inp.select();
    var done = false;
    function finish(ok) {
      if (done) return; done = true;
      var raw = inp.value.trim().replace(",", "."), n = parseFloat(raw), back = document.createElement("button");
      back.type = "button"; back.className = "ios-goal-val"; back.setAttribute("data-goal-edit", ""); back.setAttribute("aria-label", "Objectif, modifier au clavier");
      if (inp.parentNode) inp.replaceWith(back);
      if (ok && raw === "") { goalSave(box, null); hap("tap"); show(window.scrollY); }
      else if (ok && isFinite(n)) { goalSave(box, clampGoal(n)); hap("tap"); show(window.scrollY); }
      else { var c = subOf(box.dataset.goalId); goalShow(box, c && c.goal ? +c.goal : null); }
    }
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); inp.blur(); } else if (e.key === "Escape") { done = false; finish(false); } });
    inp.addEventListener("blur", function () { finish(true); });
  }
  container.addEventListener("click", function (ev) { var b = ev.target.closest && ev.target.closest("[data-goal-edit]"); if (b) goalEdit(goalBox(b)); });
  container.addEventListener("input", function (ev) {
    var t = ev.target; if (!t.matches || !t.matches("[data-goal-range]")) return;
    var box = goalBox(t), g = halfGoal(parseFloat(t.value)), last = box._tick;
    goalShow(box, g);
    if (last !== g.toFixed(1)) { box._tick = g.toFixed(1); hap("tap"); }
  });
  container.addEventListener("change", function (ev) {
    var t = ev.target; if (!t.matches || !t.matches("[data-goal-range]")) return;
    var box = goalBox(t); goalSave(box, halfGoal(parseFloat(t.value))); show(window.scrollY);
  });
  container.addEventListener("change", function (ev) {
    var t = ev.target;
    if (t.id === "ios-haptic") {   // interrupteur de la page principale : relais vers celui du bloc Sauvegarde (fx.js)
      var hb = document.getElementById("bk-haptic");
      if (hb) { hb.checked = t.checked; hb.dispatchEvent(new Event("change", { bubbles: true })); }
      return;
    }
    if (t.id === "ios-classe") {
      var pr = app().profile(), c = t.value.trim().toUpperCase().slice(0, 8);
      if (pr && c && c !== pr.classe) { app().setProfile(Object.assign({}, pr, { classe: c })); hap("success"); }
      t.value = c || (pr && pr.classe) || "";
      return;
    }
    if (t.dataset && t.dataset.k) {
      var v = t.type === "checkbox" ? t.checked : t.value;
      app().setSubj(t.dataset.id, t.dataset.k, v);
    }
  });

  /* ---------- Cycle de vie ---------- */
  function start() {
    if (active || !mq.matches) return;
    active = true; stack = [{ id: "main" }]; scrolls = {};
    show(window.scrollY);
  }
  function stop() {
    if (!active) return;
    active = false; releaseBlocks(); container.replaceChildren(); if (window.IOSTitle) IOSTitle.pill("settings", false);
    if (window.IOSNav) IOSNav.setBack(null);
  }
  function sync() { if (mq.matches) start(); else stop(); }
  if (mq.addEventListener) mq.addEventListener("change", sync); else if (mq.addListener) mq.addListener(sync);

  document.addEventListener("ios:view", function (e) {
    if (e.detail !== "settings") { if (window.IOSTitle) IOSTitle.pill("settings", false); return; }
    if (!active) return;
    show(0);
  });
  // État de la synchronisation changé : la tuile de la page principale suit.
  document.addEventListener("sync:status", function () { if (active && settingsVisible() && top().id === "main") show(window.scrollY); });
  // Après l'assistant de profil, le passage d'année, etc. : les valeurs affichées sont rafraîchies.
  // Seule la fermeture d'une fenêtre (assistant, guide) refait la page : un autre changement de classe, comme body.ios-kb à
  // l'ouverture du clavier, la refaisait aussi et faisait perdre le champ en cours de saisie (objectifs impossibles à modifier).
  var wasModal = document.body.classList.contains("ob-open") || document.body.classList.contains("gd-open");
  new MutationObserver(function () {
    var cl = document.body.classList, modal = cl.contains("ob-open") || cl.contains("gd-open");
    var closed = wasModal && !modal; wasModal = modal;
    if (closed && active && settingsVisible()) show(window.scrollY);
  }).observe(document.body, { attributes: true, attributeFilter: ["class"] });

  // Les autres modules montent leurs blocs dans #set-block pendant le chargement : on démarre une fois la page chargée.
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sync); else sync();

  window.IOSSettings = { push: push, pop: pop, root: root, openImport: openImport, retitle: function () { if (active && settingsVisible() && window.IOSTitle) IOSTitle.set(ctxFor(top())); }, active: function () { return active; }, current: function () { return active ? top().id : null; }, depth: function () { return active ? stack.length : 1; } };
  window.IOSIcons = { SVG: SVG, icon: icon, domain: domain };
})();
