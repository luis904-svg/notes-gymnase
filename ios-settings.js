/* ios-settings.js : Réglages « comme Apple » sur téléphone (≤ 700 px). Spécification : design/SPEC-reglages.md.
   Réglages est une page d'onglet (grand titre « Réglages », pas de bouton Retour). Les sous-pages (Profil, Branches, une
   branche, Synchronisation, Sauvegarde, Calcul des moyennes, À propos) sont poussées avec IOSNav.run (ressort, parallaxe)
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
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>'
  };
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
        var semestre = '<label class="ios-row has-ic"><i class="ios-ic ios-ic-red"><svg viewBox="0 0 24 24" aria-hidden="true">' + SVG.calendar + '</svg></i>' +
          '<span class="ios-row-l">Fin du semestre 1</span><input class="ios-date" type="date" data-s1 value="' + esc(c.s1End) + '" aria-label="Fin du semestre 1"></label>';
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
          row({ label: "Gymnase", val: G.gymnaseName(pr.gymnase) || "–", act: "step:gymnase" }),
          row({ label: "Année", val: pr.year ? ORD[pr.year] : "–", act: "step:year" }),
          row({ label: "Classe", val: pr.classe || "–", act: "step:year" }),
          row({ label: "Deuxième langue (L2)", val: nm(G.L2, pr.l2), act: "step:l2" }),
          row({ label: "Troisième langue (L3)", val: nm(G.L3, pr.l3), act: "step:l3" }),
          row({ label: "Option spécifique", val: nm(G.OS, pr.os), act: "step:os" }),
          row({ label: "Mathématiques", val: pr.math === "renf" ? "Renforcé" : "Standard", act: "step:math" }),
          row({ label: "Discipline artistique", val: nm(G.ART, pr.art), act: "step:art" })
        ];
        if (pr.year === 3) rows.push(row({ label: "Option complémentaire", val: nm(G.OC, pr.oc), act: "step:oc" }));
        return grp(rows, null, "Changer un choix recalcule la liste des branches. Tes notes sont gardées ; les objectifs et réglages des branches qui existent encore sont conservés.");
      }
    },
    branches: {
      title: "Branches",
      html: function () {
        var rows = subjects().map(function (s) {
          return row({ label: s.name, val: s.goal ? fmtNum(s.goal) : "–", act: "go:branch:" + s.id });
        });
        return grp(rows, null, "Valeur à droite : ton objectif. Les périodes viennent de la grille officielle de ton année ; corrige-les si ton horaire est différent.");
      }
    },
    branch: {
      title: function (a) { var s = subOf(a); return s ? s.name : "Branche"; },
      html: function (a) {
        var s = subOf(a); if (!s) return '<p class="ios-grp-foot">Cette branche n\'existe plus.</p>';
        function num(label, k, val, attrs) {
          return '<label class="ios-row"><span class="ios-row-l">' + label + '</span><input class="ios-in" type="number" ' + attrs + ' data-k="' + k + '" data-id="' + esc(s.id) + '" value="' + esc(val) + '" placeholder="–" aria-label="' + label + '"></label>';
        }
        var rows = [
          num("Périodes", "periods", s.periods, 'inputmode="numeric" min="1" max="10" step="1"'),
          num("Objectif", "goal", s.goal || "", 'inputmode="decimal" min="1" max="6" step="0.5"'),
          num("Part des TP (%)", "tp", Math.round((s.tpShare || 0) * 100), 'inputmode="numeric" min="0" max="100" step="5"')
        ];
        var promo = s.part ? '<div class="ios-grp"><div class="ios-row"><span class="ios-row-l">Compte pour la promotion</span><span class="ios-val">via l\'option spécifique</span></div></div>'
          : '<div class="ios-grp"><label class="ios-row"><span class="ios-row-l">Compte pour la promotion</span><input type="checkbox" switch data-k="counts" data-id="' + esc(s.id) + '"' + (s.counts ? " checked" : "") + ' aria-label="Compte pour la promotion"></label></div>';
        return grp(rows, null, s.verify ? "À vérifier avec ton horaire : modifie une valeur pour confirmer." : "") + promo;
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
  }
  function run(dir, mutate) { if (window.IOSNav) IOSNav.run(dir, mutate); else mutate(); }
  function push(id, arg) {
    scrolls[key(top())] = window.scrollY;
    run("push", function () { stack.push({ id: id, arg: arg }); show(0); });
  }
  function pop() {
    if (stack.length < 2) return;
    run("pop", function () { stack.pop(); show(scrolls[key(top())] || 0); });
  }
  var provider = {
    can: function () { return active && stack.length > 1 && settingsVisible(); },
    parent: function (clone) {
      var c = clone.querySelector("#ios-set"); if (c) c.replaceChildren(build(stack[stack.length - 2]));
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
    var b = ev.target.closest("[data-act]"); if (!b) return;
    var a = b.dataset.act.split(":"), kind = a[0];
    if (kind === "go") push(a[1], a[2]);
    else if (kind === "click") { var t = document.getElementById(a[1]); if (t) t.click(); }
    else if (kind === "step") { if (window.Onboard) Onboard.open(true, a[1]); }
  });
  container.addEventListener("change", function (ev) {
    var t = ev.target;
    if (t.matches && t.matches("[data-s1]")) { app().setS1End(t.value); return; }
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
    active = false; releaseBlocks(); container.replaceChildren();
    if (window.IOSNav) IOSNav.setBack(null);
  }
  function sync() { if (mq.matches) start(); else stop(); }
  if (mq.addEventListener) mq.addEventListener("change", sync); else if (mq.addListener) mq.addListener(sync);

  document.addEventListener("ios:view", function (e) {
    if (e.detail !== "settings" || !active) return;
    show(0);
  });
  // Après l'assistant de profil, le passage d'année, etc. : les valeurs affichées sont rafraîchies.
  new MutationObserver(function () {
    if (active && settingsVisible() && !document.body.classList.contains("ob-open") && !document.body.classList.contains("gd-open")) show(window.scrollY);
  }).observe(document.body, { attributes: true, attributeFilter: ["class"] });

  // Les autres modules montent leurs blocs dans #set-block pendant le chargement : on démarre une fois la page chargée.
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sync); else sync();

  window.IOSSettings = { push: push, pop: pop };
})();
