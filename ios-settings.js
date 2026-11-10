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
  var mq = window.matchMedia("(max-width: 700px)");
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
  var SVG = {
    person: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/>',
    list: '<path d="M8.5 7h10.5M8.5 12h10.5M8.5 17h10.5M4.5 7h.01M4.5 12h.01M4.5 17h.01"/>',
    calendar: '<rect x="4" y="5.5" width="16" height="14" rx="3"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
    sync: '<path d="M20 12a8 8 0 1 1-2.5-5.8"/><path d="M20 4v5h-5"/>',
    save: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19h14"/>',
    up: '<path d="M12 19V6M7 10.5L12 6l5 4.5"/>',
    archive: '<rect x="4" y="5" width="16" height="4.5" rx="1.5"/><path d="M5.5 9.5V18a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5V9.5M10 13h4"/>',
    book: '<path d="M5 5.5A1.5 1.5 0 0 1 6.5 4H19v14H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19"/>',
    calc: '<rect x="5" y="3.5" width="14" height="17" rx="3"/><path d="M8.5 8h7M8.5 12.5h.01M12 12.5h.01M15.5 12.5h.01M8.5 16.5h.01M12 16.5h.01M15.5 16.5h.01"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',
    building: '<path d="M5 20V8l7-4 7 4v12"/><path d="M3.5 20h17M9.5 20v-5h5v5M9 11h.01M15 11h.01"/>',
    people: '<circle cx="9" cy="9" r="3"/><path d="M3.5 19c0-3 2.4-5 5.5-5s5.5 2 5.5 5M16 6.5a3 3 0 0 1 0 5.8M17.5 14.3c2 .5 3.5 2.2 3.5 4.7"/>',
    bubble: '<path d="M5 6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-6l-4 3.5V16H7a2 2 0 0 1-2-2z"/>',
    star: '<path d="M12 4l2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z"/>',
    plusminus: '<path d="M12 4v8M8 8h8M8 17h8"/>',
    palette: '<path d="M12 4a8 8 0 1 0 0 16c1.6 0 2-1.2 1.3-2.2-.7-1 0-2.3 1.4-2.3H17a3 3 0 0 0 3-3c0-4.4-3.6-8.5-8-8.5z"/><path d="M8 11h.01M11 8h.01M15 9h.01"/>',
    flask: '<path d="M9.5 4h5M10.5 4v5.5L5.5 18a1.8 1.8 0 0 0 1.6 2.7h9.8a1.8 1.8 0 0 0 1.6-2.7l-5-8.5V4M8 15h8"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.4 3.6 5.2 3.6 8.5s-1.1 6.1-3.6 8.5c-2.5-2.4-3.6-5.2-3.6-8.5S9.5 5.9 12 3.5z"/>',
    terminal: '<path d="M5 8l4 4-4 4M11.5 16.5H19"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><path d="M12 12h.01"/>',
    check: '<path d="M5 12.5l4.2 4.2L19 7"/>',
    pencil: '<path d="M5 19l1-4L16.5 4.5a2 2 0 0 1 2.9 2.9L9 18z"/>',
    doc: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M9.5 13h5M9.5 17h5"/>',
    percent: '<path d="M18 6L6 18"/><circle cx="7.5" cy="7.5" r="2"/><circle cx="16.5" cy="16.5" r="2"/>',
    times: '<path d="M7 7l10 10M17 7L7 17"/>',
    tag: '<path d="M4 12V5a1 1 0 0 1 1-1h7l8 8-8 8z"/><path d="M8.5 8.5h.01"/>',
    chart: '<path d="M4 19V5M4 19h16M8 15l3.5-4 3 2.5L20 7"/>'
  };
  var CHEV_L = '<svg class="ios-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
  var CHEV = '<svg class="ios-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
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

  /* ---------- Pages ---------- */
  var PAGES = {
    main: {
      title: "Réglages", large: true,
      html: function () {
        var pr = app().profile() || {}, G = window.Grid, c = cfg(), arch = app().archive();
        var gname = G && pr.gymnase ? G.gymnaseName(pr.gymnase) : "", name = "Notes " + (pr.classe || (pr.year ? pr.year + "M" : ""));
        var initials = esc((pr.classe || (pr.year ? pr.year + "M" : "N")).slice(0, 2));
        var prof = '<div class="ios-grp"><button type="button" class="ios-row ios-prof" data-act="go:profil"><span class="ios-avatar">' + initials + '</span>' +
          '<span class="ios-prof-t"><b>' + esc(name) + '</b><span>' + esc((gname ? gname + " · " : "") + (pr.year ? ORD[pr.year] + " année" : "")) + '</span></span>' + CHEV + '</button></div>';
        var semestre = row({ ic: "red", svg: "calendar", label: "Fin du semestre 1", act: "go:semestre" });
        var an = [];
        if (pr.year && pr.year < 3) an.push(row({ ic: "orange", svg: "up", label: "Passer en " + ORD[pr.year + 1] + " année", act: "click:yp-next" }));
        if (arch.length) an.push(row({ ic: "gray", svg: "archive", label: "Années précédentes", val: String(arch.length), act: "click:yp-hist" }));
        return '<h1 class="ios-large">Réglages</h1>' + prof +
          '<div class="ios-grp">' + row({ ic: "blue", svg: "list", label: "Branches", act: "go:branches" }) + semestre + '</div>' +
          grp([row({ ic: "blue", svg: "sync", label: "Synchronisation", act: "go:sync" }), row({ ic: "green", svg: "save", label: "Sauvegarde", act: "go:backup" })]) +
          (an.length ? grp(an, "Année scolaire") : "") +
          grp([row({ ic: "orange", svg: "book", label: "Guide d'utilisation", act: "click:gd-open" }),
               row({ ic: "gray", svg: "calc", label: "Comment les moyennes sont calculées", act: "go:rules" }),
               row({ ic: "gray", svg: "info", label: "À propos", act: "go:about" })]) +
          '<p class="ios-copy">©louis mutter</p>';
      }
    },
    profil: {
      title: "Profil",
      html: function () {
        var pr = app().profile() || {}, G = window.Grid;
        function nm(list, id) { var it = G.find(list, id); return it ? it.name : "–"; }
        var rows = [
          row({ ic: "blue", svg: "building", label: "Gymnase", val: G.gymnaseName(pr.gymnase) || "–", act: "step:gymnase" }),
          row({ ic: "orange", svg: "calendar", label: "Année", val: pr.year ? ORD[pr.year] : "–", act: "step:year" }),
          row({ ic: "gray", svg: "people", label: "Classe", val: pr.classe || "–", act: "step:year" }),
          row({ ic: "blue", svg: "bubble", label: "Deuxième langue (L2)", val: nm(G.L2, pr.l2), act: "step:l2" }),
          row({ ic: "blue", svg: "bubble", label: "Troisième langue (L3)", val: nm(G.L3, pr.l3), act: "step:l3" }),
          row({ ic: "green", svg: "star", label: "Option spécifique", val: nm(G.OS, pr.os), act: "step:os" }),
          row({ ic: "orange", svg: "plusminus", label: "Mathématiques", val: pr.math === "renf" ? "Renforcé" : "Standard", act: "step:math" }),
          row({ ic: "red", svg: "palette", label: "Discipline artistique", val: nm(G.ART, pr.art), act: "step:art" })
        ];
        if (pr.year === 3) rows.push(row({ ic: "gray", svg: "star", label: "Option complémentaire", val: nm(G.OC, pr.oc), act: "step:oc" }));
        return grp(rows, null, "Changer un choix recalcule la liste des branches. Tes notes sont gardées ; les objectifs et réglages des branches qui existent encore sont conservés.");
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
          num("Objectif", "goal", s.goal || "", 'inputmode="decimal" min="1" max="6" step="0.5"', "orange", "target"),
          num("Part des TP (%)", "tp", Math.round((s.tpShare || 0) * 100), 'inputmode="numeric" min="0" max="100" step="5"', "green", "flask")
        ];
        var promo = s.part ? '<div class="ios-grp"><div class="ios-row has-ic">' + icon("gray", "check") + '<span class="ios-row-l">Compte pour la promotion</span><span class="ios-val">via l\'option spécifique</span></div></div>'
          : '<div class="ios-grp"><label class="ios-row has-ic">' + icon("gray", "check") + '<span class="ios-row-l">Compte pour la promotion</span><input type="checkbox" switch data-k="counts" data-id="' + esc(s.id) + '"' + (s.counts ? " checked" : "") + ' aria-label="Compte pour la promotion"></label></div>';
        return grp(rows, null, s.verify ? "À vérifier avec ton horaire : modifie une valeur pour confirmer." : "") + promo;
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
  var provider = { can: function () { return active && stack.length > 1 && settingsVisible(); }, go: pop };

  /* ---------- Interactions ---------- */
  container.addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-act]"); if (!b) return;
    var a = b.dataset.act.split(":"), kind = a[0];
    if (kind === "go") push(a[1], a[2]);
    else if (kind === "click") {
      var t = document.getElementById(a[1]); if (t) t.click();
      // Un bouton d'origine peut changer l'état tout de suite (ex. « Annuler le dernier passage ») : la page est refaite si aucune fenêtre n'est ouverte.
      if (!document.body.classList.contains("ob-open") && !document.body.classList.contains("gd-open")) show(window.scrollY);
    }
    else if (kind === "step") { if (window.Onboard) Onboard.open(true, a[1]); }
    else if (kind === "cal") { cal.m += a[1] === "next" ? 1 : -1; if (cal.m > 11) { cal.m = 0; cal.y++; } if (cal.m < 0) { cal.m = 11; cal.y--; } show(window.scrollY); }
    else if (kind === "day") { app().setS1End(a[1]); show(window.scrollY); }
  });
  container.addEventListener("change", function (ev) {
    var t = ev.target;
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
  // Après l'assistant de profil, le passage d'année, etc. : les valeurs affichées sont rafraîchies.
  new MutationObserver(function () {
    if (active && settingsVisible() && !document.body.classList.contains("ob-open") && !document.body.classList.contains("gd-open")) show(window.scrollY);
  }).observe(document.body, { attributes: true, attributeFilter: ["class"] });

  // Les autres modules montent leurs blocs dans #set-block pendant le chargement : on démarre une fois la page chargée.
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sync); else sync();

  window.IOSSettings = { push: push, pop: pop };
  window.IOSIcons = { SVG: SVG, icon: icon, domain: domain };
})();
