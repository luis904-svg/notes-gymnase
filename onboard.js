/* Notes — configuration au premier lancement (et « Modifier mon profil »). */
(function () {
  "use strict";
  var G = window.Grid, M = window.Motion || null;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  function canAnim() { return !!M && !reduce.matches; }
  function hap(k) { if (window.FX) window.FX.haptic(k); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function $(s, r) { return (r || document).querySelector(s); }

  var p = {}, step = 0, editing = false, root = null, dir = 1;
  var STEPS = [
    { id: "welcome" },
    { id: "gymnase", title: "Ton gymnase", sub: "Il s'affichera en haut de ton tableau de bord." },
    { id: "year", title: "Ton année", sub: "Les branches et leurs périodes changent d'une année à l'autre." },
    { id: "l2", title: "Deuxième langue (L2)", sub: "La langue nationale que tu suis au gymnase." },
    { id: "l3", title: "Troisième langue (L3)" },
    { id: "os", title: "Option spécifique", sub: "Ton option principale, suivie pendant les trois ans." },
    { id: "math", title: "Mathématiques", sub: "Le niveau choisi à l'inscription." },
    { id: "art", title: "Discipline artistique", sub: "Suivie en 1re et en 2e année." },
    { id: "oc", title: "Option complémentaire", sub: "Suivie en 3e année seulement.", when: function () { return p.year === 3; } },
    { id: "recap", title: "Tes branches" }
  ];
  function visible() { return STEPS.filter(function (s) { return !s.when || s.when(); }); }

  function row(name, sub, value, field, block, extra) {
    var on = p[field] === value, dis = !!block;
    return '<button type="button" class="ob-row' + (on ? " on" : "") + '" data-f="' + field + '" data-v="' + esc(value) + '"' + (dis ? " disabled" : "") + ' role="radio" aria-checked="' + on + '">' +
      '<span class="ob-txt"><span class="ob-n">' + esc(name) + '</span>' + (block ? '<span class="ob-s ob-why">' + esc(block) + '</span>' : (sub ? '<span class="ob-s">' + esc(sub) + '</span>' : "")) + '</span>' +
      (extra || "") + '<svg class="ob-chk" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg></button>';
  }
  function list(items, field, blockFn) {
    return '<div class="ob-list" role="radiogroup">' + items.map(function (it) {
      return row(it.name, it.sub || it.city || "", it.id, field, blockFn ? blockFn(it.id, p) : null);
    }).join("") + '</div>';
  }

  function valid(s) {
    switch (s.id) {
      case "welcome": return true;
      case "gymnase": return !!p.gymnase;
      case "year": return !!p.year;
      case "l2": return !!p.l2;
      case "l3": return !!p.l3;
      case "os": return !!p.os && !G.osBlock(p.os, p);
      case "math": return !!p.math && !G.mathBlock(p.math, p);
      case "art": return !!p.art;
      case "oc": return !!p.oc && !G.ocBlock(p.oc, p);
      default: return true;
    }
  }
  // Un choix devenu impossible (retour en arrière) est effacé.
  function sanitize() {
    if (p.os && G.osBlock(p.os, p)) p.os = null;
    if (p.os === "PAM") p.math = "renf";
    if (p.oc && G.ocBlock(p.oc, p)) p.oc = null;
    if (p.year !== 3) p.oc = p.oc || null;
  }

  function body(s) {
    if (s.id === "welcome") {
      return '<div class="ob-hero"><img src="icon-180.png" alt="" class="ob-icon"><h1>Bienvenue</h1>' +
        '<p>Réponds à quelques questions sur ton cursus pour créer ton tableau de bord. Tes réponses et tes notes restent sur cet appareil.</p>' +
        '<p class="ob-fine">École de maturité vaudoise · règles 2026-2027</p></div>';
    }
    var h = '<h1 class="ob-title">' + esc(s.title) + '</h1>' + (s.sub ? '<p class="ob-sub">' + esc(s.sub) + '</p>' : "");
    if (s.id === "gymnase") {
      h += list(G.GYMNASES, "gymnase");
      var g = G.find(G.GYMNASES, p.gymnase);
      if (g && g.warn) h += '<p class="ob-warn">' + esc(g.warn) + '</p>';
    }
    if (s.id === "year") {
      h += list([{ id: 1, name: "1re année" }, { id: 2, name: "2e année" }, { id: 3, name: "3e année", sub: "moyennes seulement, sans calcul du certificat" }], "year");
      h += '<label class="ob-field"><span>Nom de ta classe (facultatif)</span><input id="ob-classe" type="text" maxlength="12" autocomplete="off" placeholder="2M01" value="' + esc(p.classe || "") + '"></label>';
    }
    if (s.id === "l2") h += list(G.L2, "l2");
    if (s.id === "l3") h += list(G.L3, "l3");
    if (s.id === "os") h += list(G.OS, "os", G.osBlock);
    if (s.id === "math") h += list(G.MATH, "math", G.mathBlock);
    if (s.id === "art") h += list(G.ART, "art");
    if (s.id === "oc") h += list(G.OC, "oc", G.ocBlock);
    if (s.id === "recap") {
      var subs = G.build(p), gname = G.gymnaseName(p.gymnase);
      h = '<h1 class="ob-title">' + esc(s.title) + '</h1><p class="ob-sub">' + esc((gname ? gname + " · " : "") + p.year + (p.year === 1 ? "re" : "e") + " année" + (p.classe ? " · " + p.classe : "")) + '</p>';
      h += '<div class="ob-list ob-recap">' + subs.filter(function (x) { return !x.part; }).map(function (x) {
        var parts = x.parts ? subs.filter(function (c) { return x.parts.indexOf(c.id) >= 0; }).map(function (c) { return c.name + " " + fmtP(c.periods) + (c.tpShare ? " (TP 25 %)" : ""); }).join(" + ") : "";
        return '<div class="ob-row ob-static"><span class="ob-txt"><span class="ob-n">' + esc(x.name) + '</span><span class="ob-s">' +
          fmtP(x.periods) + " par semaine" + (x.tpShare ? " · TP 25 %" : "") + (parts ? " · " + esc(parts) : "") + (x.counts ? "" : " · ne compte pas pour la promotion") + '</span></span></div>';
      }).join("") + '</div>';
      h += '<p class="ob-tip"><b>TP à 25 %.</b> Dans les branches avec des travaux pratiques, les TP comptent pour 25 % de la moyenne et les tests pour 75 %. Si ton prof compte autrement, tu peux changer ce pourcentage pour chaque branche dans Réglages.</p>';
      h += '<p class="ob-fine">Objectifs et périodes restent aussi modifiables dans Réglages. Vérifie les règles avec le vade-mecum de ton gymnase.</p>';
    }
    return h;
  }
  function fmtP(n) { return String(n).replace(".", ",") + " pér."; }

  function render() {
    var vs = visible(), s = vs[step], last = step === vs.length - 1;
    var pct = Math.round((step / (vs.length - 1)) * 100);
    root.innerHTML =
      '<div class="ob-top"><button type="button" class="link ob-back"' + (step === 0 || (editing && step === 1) ? (editing ? ' data-cancel' : " hidden") : "") + '>' + (editing && step === 1 ? "Annuler" : "‹ Retour") + '</button>' +
      (s.id !== "welcome" ? '<div class="ob-prog" aria-hidden="true"><i style="width:' + pct + '%"></i></div>' : "") + '</div>' +
      '<div class="ob-body" id="ob-body">' + body(s) + '</div>' +
      '<div class="ob-foot"><button type="button" class="btn ob-next"' + (valid(s) ? "" : " disabled") + '>' +
      (s.id === "welcome" ? "Commencer" : last ? (editing ? "Enregistrer" : "Créer mon tableau de bord") : "Continuer") + '</button></div>';
    var b = $("#ob-body", root);
    if (canAnim()) {
      M.animate(b, { opacity: [0, 1], x: [dir * 36, 0] }, { type: "spring", stiffness: 340, damping: 30 });
      var rows = b.querySelectorAll(".ob-row");
      if (rows.length) M.animate(rows, { opacity: [0, 1], y: [10, 0] }, { delay: M.stagger(0.025, { startDelay: 0.05 }), type: "spring", stiffness: 380, damping: 30 });
      var bar = $(".ob-prog i", root); if (bar) { var from = Math.round(((step - dir) / (vs.length - 1)) * 100); M.animate(bar, { width: [Math.max(0, from) + "%", pct + "%"] }, { type: "spring", stiffness: 260, damping: 30 }); }
    }
    var input = $("#ob-classe", root);
    if (input) input.addEventListener("input", function () { p.classe = input.value.trim(); });
    root.scrollTop = 0;
  }

  function go(d) {
    var vs = visible();
    if (d > 0 && !valid(vs[step])) return;
    dir = d; step = Math.max(0, Math.min(vs.length - 1, step + d));
    render();
  }

  function finish() {
    var gs = window.NotesApp.grades(), next = G.build(p).map(function (x) { return x.id; });
    var lost = gs.filter(function (g) { return next.indexOf(g.subject) < 0; }).length;
    if (lost && !window.confirm(lost + " note" + (lost > 1 ? "s appartiennent" : " appartient") + " à des branches absentes de ce profil. Elles seront masquées, pas supprimées. Continuer ?")) return;
    window.NotesApp.setProfile(Object.assign({ v: 1 }, p));
    hap("success");
    close();
  }

  function close() {
    var el = root;
    var closed = false;
    function done() { if (closed) return; closed = true; el.remove(); root = null; document.body.classList.remove("ob-open"); if (window.FX) window.FX.view("dash"); }
    if (canAnim()) { M.animate(el, { opacity: [1, 0], scale: [1, 1.04] }, { duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }).then(done); setTimeout(done, 500); }
    else done();
  }

  function open(edit) {
    if (root) return;
    editing = !!edit;
    var cur = window.NotesApp.profile();
    p = cur ? JSON.parse(JSON.stringify(cur)) : {};
    step = editing ? 1 : 0; dir = 1;
    root = document.createElement("div");
    root.className = "ob"; root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true"); root.setAttribute("aria-label", "Configuration");
    document.body.appendChild(root);
    document.body.classList.add("ob-open");
    root.addEventListener("click", function (e) {
      var r = e.target.closest(".ob-row[data-f]");
      if (r && !r.disabled) {
        var f = r.dataset.f, v = r.dataset.v;
        p[f] = f === "year" ? parseInt(v, 10) : v;
        sanitize(); hap("select");
        root.querySelectorAll('.ob-row[data-f="' + f + '"]').forEach(function (x) { var on = x === r; x.classList.toggle("on", on); x.setAttribute("aria-checked", String(on)); });
        if (canAnim()) M.animate(r.querySelector(".ob-chk"), { scale: [0.3, 1] }, { type: "spring", stiffness: 500, damping: 15 });
        var s = visible()[step];
        if (s.id === "gymnase") {
          var g = G.find(G.GYMNASES, p.gymnase), w = root.querySelector(".ob-warn");
          if (w) w.remove();
          if (g && g.warn) { w = document.createElement("p"); w.className = "ob-warn"; w.textContent = g.warn; root.querySelector(".ob-list").after(w); }
        }
        $(".ob-next", root).disabled = !valid(s);
        return;
      }
      if (e.target.closest(".ob-next")) { var vs = visible(); if (step === vs.length - 1) finish(); else go(1); return; }
      var back = e.target.closest(".ob-back");
      if (back) { if (back.hasAttribute("data-cancel")) close(); else go(-1); }
    });
    root.addEventListener("keydown", function (e) { if (e.key === "Enter" && e.target.id === "ob-classe") { e.preventDefault(); go(1); } });
    if (canAnim()) M.animate(root, { opacity: [0, 1] }, { duration: 0.3 });
    render();
  }

  function mountSettingsButton() {
    var host = document.getElementById("set-block"); if (!host || document.getElementById("ob-edit")) return;
    var d = document.createElement("div"); d.className = "backup";
    d.innerHTML = '<h3>Mon cursus</h3><p class="muted small" id="ob-sum"></p><div class="btns"><button type="button" class="btn-ghost" id="ob-edit">Modifier mon profil</button></div>';
    host.insertBefore(d, host.firstChild);
    document.getElementById("ob-edit").addEventListener("click", function () { open(true); });
  }
  function refreshSummary() {
    var el = document.getElementById("ob-sum"), pr = window.NotesApp.profile(); if (!el || !pr) return;
    var os = G.find(G.OS, pr.os), l2 = G.find(G.L2, pr.l2), l3 = G.find(G.L3, pr.l3);
    el.textContent = pr.year + (pr.year === 1 ? "re" : "e") + " année · L2 " + (l2 ? l2.name : "?") + " · L3 " + (l3 ? l3.name : "?") + " · OS " + (os ? os.name : "?") + " · maths " + (pr.math === "renf" ? "renforcé" : "standard");
  }

  /* ---------- Installer d'abord ----------
     Safari et l'app de l'écran d'accueil ont des stockages séparés : on fait installer l'app
     avant la configuration pour ne pas la remplir deux fois. */
  var ua = navigator.userAgent;
  var isIOS = /iP(hone|ad|od)/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var isAndroid = /Android/.test(ua);
  var inApp = /FBAN|FBAV|Instagram|Snapchat|Line\/|TikTok|musical_ly|LinkedInApp/.test(ua);
  function standalone() { return window.navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches; }
  var deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault(); deferredPrompt = e;
    var b = document.getElementById("inst-btn"); if (b) b.hidden = false;
  });

  var ICON_SHARE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5"/><path d="M6 11H5v9h14v-9h-1"/></svg>';
  var ICON_ADD = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8.5v7M8.5 12h7"/></svg>';
  var ICON_DOTS = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/></svg>';
  var ICON_HOME = '<img src="icon-180.png" alt="">';

  function steps() {
    if (inApp) return [["!", "Ce navigateur ne peut pas installer d'app", "Touche le menu de l'app (⋯ ou ⋮) puis « Ouvrir dans Safari » ou « Ouvrir dans le navigateur »."]];
    if (isIOS) return [
      [ICON_SHARE, "Touche le bouton Partager", "En bas de Safari. Si tu ne le vois pas, touche d'abord " + "⋯" + "."],
      [ICON_ADD, "Choisis « Sur l'écran d'accueil »", "Fais défiler la liste si besoin, puis touche « Ajouter »."],
      [ICON_HOME, "Ouvre Notes depuis ton écran d'accueil", "La configuration commencera dans l'app."]
    ];
    return [
      [ICON_DOTS, "Ouvre le menu du navigateur", "Le bouton ⋮ en haut à droite."],
      [ICON_ADD, "Touche « Installer l'application »", "Ou « Ajouter à l'écran d'accueil »."],
      [ICON_HOME, "Ouvre Notes depuis ton écran d'accueil", "La configuration commencera dans l'app."]
    ];
  }

  function openInstall() {
    var el = document.createElement("div");
    el.className = "ob ob-install"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Installer l'app");
    el.innerHTML =
      '<div class="ob-body"><div class="ob-hero"><img src="icon-180.png" alt="" class="ob-icon"><h1>Installe l\'app</h1>' +
      '<p>Ajoute Notes à ton écran d\'accueil avant de commencer. Elle s\'ouvrira en plein écran, marchera sans connexion, et tu ne feras la configuration qu\'une fois.</p></div>' +
      '<ol class="inst-steps">' + steps().map(function (s, i) {
        return '<li><span class="inst-ic' + (s[0] === "!" ? " warn" : "") + '">' + (s[0] === "!" ? "!" : s[0]) + '</span><span class="ob-txt"><span class="ob-n">' + (steps().length > 1 ? (i + 1) + ". " : "") + esc(s[1]) + '</span><span class="ob-s">' + esc(s[2]) + '</span></span></li>';
      }).join("") + '</ol>' +
      '<p class="ob-fine">Pourquoi ? Safari et l\'app de l\'écran d\'accueil gardent leurs données séparément : une configuration faite ici ne serait pas reprise dans l\'app.</p></div>' +
      '<div class="ob-foot"><button type="button" class="btn ob-next" id="inst-btn"' + (deferredPrompt ? "" : " hidden") + '>Installer l\'app</button>' +
      '<button type="button" class="link inst-skip" id="inst-skip">Continuer dans le navigateur</button>' +
      (isIOS && !inApp ? '<div class="inst-arrow" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 4v15M6 13l6 6 6-6"/></svg></div>' : "") + '</div>';
    document.body.appendChild(el);
    document.body.classList.add("ob-open");
    if (canAnim()) {
      M.animate(el.querySelectorAll(".ob-hero > *, .inst-steps li"), { opacity: [0, 1], y: [16, 0] }, { delay: M.stagger(0.07), type: "spring", stiffness: 300, damping: 26 });
      var ar = el.querySelector(".inst-arrow svg");
      if (ar) M.animate(ar, { y: [0, 10, 0] }, { duration: 1.4, repeat: Infinity, ease: "easeInOut" });
    }
    el.querySelector("#inst-btn").addEventListener("click", function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function () { deferredPrompt = null; });
    });
    el.querySelector("#inst-skip").addEventListener("click", function () {
      if (!window.confirm("Si tu configures ici puis installes l'app plus tard, il faudra refaire la configuration dans l'app. Continuer dans le navigateur ?")) return;
      el.remove(); document.body.classList.remove("ob-open");
      open(false);
    });
    // Installée depuis Android pendant que la page est ouverte.
    window.addEventListener("appinstalled", function () { var s = el.querySelector(".ob-hero p"); if (s) s.textContent = "C'est installé ! Ouvre Notes depuis ton écran d'accueil."; });
  }

  window.Onboard = { open: open, refresh: refreshSummary };
  mountSettingsButton(); refreshSummary();
  if (!window.NotesApp.profile()) {
    if ((isIOS || isAndroid) && !standalone()) openInstall();
    else open(false);
  }
})();
