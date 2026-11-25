/* Notes — configuration au premier lancement (et « Modifier mon profil »). */
(function () {
  "use strict";
  var G = window.Grid;
  // Animations d'entrée (remises en v44) : IOSMotion.animate ne fait rien avec ?noanim=1 ou « Réduire les animations ».
  function A(t, kf, o) { return window.IOSMotion ? window.IOSMotion.animate(t, kf, o) : Promise.resolve(); }
  function ST(step, o) { return window.IOSMotion ? window.IOSMotion.stagger(step, o) : 0; }
  function canAnim() { return !!(window.IOSMotion && window.IOSMotion.canAnim()); }
  function hap(k) { if (window.FX) window.FX.haptic(k); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function $(s, r) { return (r || document).querySelector(s); }

  var p = {}, step = 0, firstStep = 0, editing = false, root = null, dir = 1, guideTouched = false, allowVoie = false, loading = false, loadErr = false;
  function mat() { return G.isMat(p); }
  function ecg() { return G.voieOf(p) === "ecg" && !!G.ext(p); }
  // Cantons (23 novembre 2026) : un module de canton (canton-ge.js) donne ses champs dans l'ordre (fields), leurs titres (stepText),
  // leurs listes (Grid.list) et ses règles de cohérence (blocked, valid, sanitize).
  function X() { return G.ext(p); }
  function fx(f) { var x = X(); return !!(x && x.fields && x.fields(p).indexOf(f) >= 0); }
  var STEPS = [
    { id: "welcome" },
    // Le canton puis la voie se choisissent d'abord ; en modification, seulement depuis « Canton » ou « Voie » du profil.
    { id: "canton", title: "Ton canton", sub: "Chaque canton a ses propres règles de promotion.", when: function () { return !editing || allowVoie; } },
    { id: "voie", title: "Ta voie", sub: "Les règles de calcul changent d'une voie à l'autre.", when: function () { return !editing || allowVoie; } },
    { id: "guide", when: function () { return !editing; } },
    { id: "gymnase", title: "Ton gymnase", sub: "Il s'affichera en haut de ton tableau de bord." },
    { id: "year", title: "Ton année", sub: "Les branches et leurs périodes changent d'une année à l'autre." },
    { id: "l2", title: "Deuxième langue (L2)", sub: "La langue nationale que tu suis au gymnase." },
    { id: "domaine", title: "Domaine professionnel", sub: "Choisi à la fin de la 1re année.", when: function () { return (ecg() && p.year >= 2) || fx("domaine"); } },
    { id: "l3", title: "Troisième langue (L3)", when: function () { return mat() || fx("l3"); } },
    { id: "os", title: "Option spécifique", sub: "Ton option principale, suivie pendant les trois ans.", when: function () { return mat() || fx("os"); } },
    { id: "math", title: "Mathématiques", sub: "Le niveau choisi à l'inscription.", when: function () { return mat() || fx("math"); } },
    { id: "sci", title: "Science à choix", when: function () { return fx("sci"); } },
    { id: "art", title: "Discipline artistique", sub: "Suivie en 1re et en 2e année.", when: function () { return mat() || (ecg() && G.ext(p).needArt(p)) || fx("art"); } },
    { id: "oc", title: "Option complémentaire", sub: "Suivie en 3e année seulement.", when: function () { return (mat() && p.year === 3) || fx("oc"); } },
    { id: "recap", title: "Tes branches" }
  ];
  // « Pour les parents » (20 novembre 2026, choix de l'utilisateur) : depuis Bienvenue, une page à part pour entrer le code de l'enfant.
  var parentMode = false, pcode = "", pbusy = false;
  var PARENT = { id: "parent", title: "Pour les parents", sub: "Entre le code de synchronisation de ton enfant. Il le trouve dans son app : Réglages → Synchronisation." };
  function codeOk(c) { return String(c || "").replace(/[^A-Za-z0-9]/g, "").length === 16; }
  function visible() { if (parentMode) return [STEPS[0], PARENT]; return STEPS.filter(function (s) { return !s.when || s.when(); }); }

  function row(name, sub, value, field, block, extra) {
    var on = p[field] === value, dis = !!block;
    return '<button type="button" class="ob-row' + (on ? " on" : "") + '" data-f="' + field + '" data-v="' + esc(value) + '"' + (dis ? " disabled" : "") + ' role="radio" aria-checked="' + on + '">' +
      '<span class="ob-txt"><span class="ob-n">' + esc(name) + '</span>' + (block ? '<span class="ob-s ob-why">' + esc(block) + '</span>' : (sub ? '<span class="ob-s">' + esc(sub) + '</span>' : "")) + '</span>' +
      (extra || "") + '<svg class="ob-chk" viewBox="0 0 24 24" aria-hidden="true">' + window.Icons.inner.check + '</svg></button>';
  }
  function list(items, field, blockFn) {
    return '<div class="ob-list" role="radiogroup">' + items.map(function (it) {
      return row(it.name, it.sub || it.city || "", it.id, field, blockFn ? blockFn(it.id, p) : null);
    }).join("") + '</div>';
  }

  function valid(s) {
    if (fx(s.id) && X().valid) return X().valid(s.id, p);
    switch (s.id) {
      case "welcome": return true;
      case "parent": return codeOk(pcode) && !pbusy;
      case "canton": return !!p.canton && !G.find(G.CANTONS, p.canton).soon;
      case "voie": return !!p.voie && !loading && !loadErr;
      case "year": return !!p.year && p.year <= G.years(p);
      case "domaine": return !!p.domaine && !G.ext(p).blocked("domaine", p.domaine, p);
      case "gymnase": return !!p.gymnase;
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
    if (!mat()) { var x = G.ext(p); if (x) x.sanitize(p); var l2 = G.list("l2", p).filter(function (i) { return i.id === p.l2; }); if (p.l2 && !l2.length) p.l2 = null; return; }
    if (p.os && G.osBlock(p.os, p)) p.os = null;
    if (p.os === "PAM") p.math = "renf";
    if (p.oc && G.ocBlock(p.oc, p)) p.oc = null;
    if (p.year !== 3) p.oc = p.oc || null;
  }

  // Changer de voie repart d'un profil neuf (gymnase, classe et année gardés) ; le fichier de la voie est chargé à la demande.
  function chooseCanton(c) {
    if (p.canton === c) return;
    p = { v: 1, canton: c, classe: "", year: p.year || null };
    loading = false; loadErr = false;
    // 24 novembre 2026 : les règles du canton se chargent dès son choix, pour que « Étape n sur N » compte ses questions
    // (sinon le total passait de 11 à 7, puis remontait au choix de la voie). En cas d'échec, « Ta voie » réessaie.
    if (!G.isMat(p) && !G.ext(p)) G.load(G.voieOf(p)).then(counter, function () {});
  }
  function counter() {
    if (!root) return;
    var vs = visible(), s = vs[step], t = $(".ob-bar-t", root), bar = $(".ob-prog i", root);
    if (!s || s.id === "welcome" || s.id === "parent" || !t) return;
    t.textContent = "Étape " + step + " sur " + (vs.length - 1);
    if (bar) bar.style.width = Math.round((step / (vs.length - 1)) * 100) + "%";
  }
  function chooseVoie(v) {
    var c = G.cantonOf(p);
    if ((p.voie || "mat") !== v) p = { v: 1, canton: p.canton || c, voie: v, gymnase: c === "vd" ? p.gymnase || null : null, classe: "", year: p.year || null };
    p.voie = v;
    loadErr = false; loading = !G.ext(p) && !G.isMat(p);
    if (loading) G.load(G.voieOf(p)).then(function () { loading = false; refreshNext(); }, function () { loading = false; loadErr = true; if (root) render(); });
  }
  function refreshNext() { var n = root && $(".ob-next", root), s = root && visible()[step]; if (n && s) n.disabled = !valid(s); }

  function body(s) {
    if (s.id === "welcome") {
      return '<div class="ob-hero"><img src="icon-180.png" alt="" class="ob-icon"><h1>Bienvenue dans Sur6</h1>' +
        '<p>Tes notes, tes moyennes et ta promotion, calculées pour toi. Réponds à quelques questions sur ton cursus : tout reste sur cet appareil.</p>' +
        '<p class="ob-fine">Vaud et Genève · règles 2026-2027</p>' +
        '<p class="ob-fine ob-disc">' + esc(window.Guide ? Guide.disclaimer : "Application non officielle. Résultats indicatifs : seul ton bulletin fait foi.") + '</p>' +
        // Session B : lignes d'action en texte bleu dans un groupe (comme Réglages → Synchronisation).
        // Les parents ont leur bouton « Pour les parents » sous « Commencer » (20 novembre 2026) : plus de petite ligne ici.
        '<div class="ios-grp ios-ob-acts">' + (window.Sync && Sync.available() ? '<button type="button" class="ios-row ios-act" id="ob-sync">J\'ai déjà mes notes sur un autre appareil</button>' : '') +
        '<button type="button" class="ios-row ios-act" id="ob-sheet">J\'ai mes notes dans un tableur (Excel…)</button></div>' + '</div>';
    }
    if (s.id === "parent") {
      return '<h1 class="ob-title">' + esc(s.title) + '</h1><p class="ob-sub">' + esc(s.sub) + '</p>' +
        '<label class="ob-field"><span>Code de ton enfant</span><input id="ob-pcode" type="text" maxlength="24" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" placeholder="XXXX-XXXX-XXXX-XXXX" value="' + esc(pcode) + '"></label>' +
        '<p class="ob-warn" id="ob-pwarn" hidden></p>' +
        '<p class="ob-fine">Les notes de ton enfant s\'affichent ici et se mettent à jour toutes seules. Tu peux aussi recevoir une notification à chaque nouvelle note : Réglages → Synchronisation.</p>';
    }
    if (s.id === "guide") {
      return '<div class="ob-hero"><div class="ob-gi">' + window.Icons.svg("book") + '</div>' +
        '<h1>Un guide en 5 chapitres</h1>' +
        '<p>Environ 15 minutes : ajouter tes notes, tes TA et les photos de tes tests, lire le tableau de bord, comprendre le calcul, régler l\'app et prévenir tes parents.</p>' +
        '<p class="ob-fine">Tu peux la suivre maintenant ou plus tard, dans Réglages → Guide d\'utilisation.</p></div>';
    }
    var sb = s.id === "art" && ecg() ? "Au choix en travail social, en 2e et en 3e année." : s.sub;
    var stx = X() && X().stepText ? X().stepText(s.id, p) : null, ttl = stx ? stx.title : s.title; if (stx) sb = stx.sub;
    var h = '<h1 class="ob-title">' + esc(ttl) + '</h1>' + (sb ? '<p class="ob-sub">' + esc(sb) + '</p>' : "");
    if (s.id === "canton") {
      h += '<div class="ob-list" role="radiogroup">' + G.CANTONS.map(function (c) {
        return row(c.name, c.sub, c.id, "canton", c.soon ? c.sub : null);
      }).join("") + '</div>';
    }
    if (s.id === "voie") {
      h += '<div class="ob-list" role="radiogroup">' + G.voies(G.cantonOf(p)).map(function (v) {
        return row(v.name, v.sub, v.id, "voie", v.soon ? v.sub : null);
      }).join("") + '</div>';
      if (loadErr) h += '<p class="ob-warn">Cette voie se charge à la première utilisation : connecte-toi à Internet, puis réessaie.</p>';
    }
    if (s.id === "domaine") {
      h += list(G.list("domaine", p), "domaine", function (id) { return G.ext(p).blocked("domaine", id, p); });
      var dw = G.ext(p).warn("domaine", p.domaine, p);
      if (dw) h += '<p class="ob-warn">' + esc(dw) + '</p>';
    }
    if (s.id === "gymnase") {
      h += list(G.list("gymnase", p), "gymnase");
      var g = G.find(G.list("gymnase", p), p.gymnase);
      if (g && g.warn) h += '<p class="ob-warn">' + esc(g.warn) + '</p>';
    }
    if (s.id === "year") {
      var ny = G.years(p), yl = [];
      for (var yi = 1; yi <= ny; yi++) yl.push({ id: yi, name: yi + (yi === 1 ? "re" : "e") + " année", sub: yi === ny ? (X() && X().lastYearSub ? X().lastYearSub(p) : ecg() ? "avec le certificat ECG et les examens" : "avec le certificat de maturité et les examens") : "" });
      h += list(yl, "year");
      h += '<label class="ob-field"><span>Nom de ta classe (facultatif)</span><input id="ob-classe" type="text" maxlength="12" autocomplete="off" placeholder="2M01" value="' + esc(p.classe || "") + '"></label>';
    }
    var gb = fx(s.id) ? function (id) { return X().blocked(s.id, id, p); } : null;
    if (s.id === "l2") h += list(G.list("l2", p), "l2", ecg() ? function (id) { return G.ext(p).blocked("l2", id, p); } : gb);
    if (s.id === "l3") h += list(G.list("l3", p), "l3", gb);
    if (s.id === "os") h += list(G.list("os", p), "os", gb || G.osBlock);
    if (s.id === "math") h += list(G.list("math", p), "math", gb || G.mathBlock);
    if (s.id === "sci") h += list(G.list("sci", p), "sci", gb);
    if (s.id === "art") h += list(G.list("art", p), "art", gb);
    if (s.id === "oc") h += list(G.list("oc", p), "oc", gb || G.ocBlock);
    if (s.id === "recap") {
      var subs = G.build(p), gname = G.gymnaseName(p.gymnase);
      h = '<h1 class="ob-title">' + esc(s.title) + '</h1><p class="ob-sub">' + esc((gname ? gname + " · " : "") + p.year + (p.year === 1 ? "re" : "e") + " année" + (p.classe ? " · " + p.classe : "")) + '</p>';
      h += '<div class="ob-list ob-recap">' + subs.filter(function (x) { return !x.part && !x.carried; }).map(function (x) {
        var parts = x.parts ? subs.filter(function (c) { return x.parts.indexOf(c.id) >= 0; }).map(function (c) { return c.name + " " + fmtP(c.periods) + (c.tpShare ? " (" + G.tpLabel(p) + " " + Math.round(c.tpShare * 100) + " %)" : ""); }).join(" + ") : "";
        return '<div class="ob-row ob-static"><span class="ob-txt"><span class="ob-n">' + esc(x.name) + '</span><span class="ob-s">' +
          fmtP(x.periods) + " par semaine" + (x.tpShare ? " · " + G.tpLabel(p) + " " + Math.round(x.tpShare * 100) + " %" : "") + (parts ? " · " + esc(parts) : "") + (x.counts ? "" : " · ne compte pas pour la promotion") + '</span></span></div>';
      }).join("") + '</div>';
      h += X() && X().recapTip ? '<p class="ob-tip">' + X().recapTip(p) + '</p>' : ecg() ? '<p class="ob-tip"><b>Disciplines intégrées.</b> Plusieurs disciplines forment une seule note de bulletin (par exemple les sciences expérimentales) : leur moyenne est pondérée par les périodes. Les TP comptent selon la grille (tu peux changer ce pourcentage branche par branche dans Réglages).</p>'
        : '<p class="ob-tip"><b>TP à 25 %.</b> Dans les branches avec des travaux pratiques, les TP comptent pour 25 % de la moyenne et les tests pour 75 %. Si ton prof compte autrement, tu peux changer ce pourcentage pour chaque branche dans Réglages.</p>';
      h += '<p class="ob-fine">Tes choix, tes objectifs et les périodes restent modifiables dans Réglages → Profil et Réglages → Branches. Vérifie les règles avec le ' + (G.cantonOf(p) === "ge" ? "mémento de ton école" : "vade-mecum de ton gymnase") + '.</p>';
    }
    return h;
  }
  function fmtP(n) { return String(n) + " pér."; }

  function render() {
    var vs = visible(), s = vs[step], last = step === vs.length - 1;
    var pct = Math.round((step / (vs.length - 1)) * 100);
    root.innerHTML =
      // En modification (Réglages → Profil), « Annuler » est proposé dès l'étape d'ouverture : on peut toujours ressortir sans tout parcourir.
      // v58 (style C) : rond Retour (chevron) ou Fermer (croix, en modification), titre « Étape n sur N », fine barre verte.
      '<div class="ob-top ob-top-c"><button type="button" class="ob-back ob-round"' + (editing && step <= firstStep ? ' data-cancel aria-label="Annuler"' : step === 0 ? ' hidden aria-label="Retour"' : ' aria-label="Retour"') + '>' +
      (window.Icons ? Icons.svg(editing && step <= firstStep ? "times" : "chevl") : "‹") + '</button>' +
      (s.id !== "welcome" && s.id !== "parent" ? '<b class="ob-bar-t">Étape ' + step + ' sur ' + (vs.length - 1) + '</b>' : '<span class="ob-bar-t"></span>') + '<span class="ob-round-sp"></span></div>' +
      (s.id !== "welcome" && s.id !== "parent" ? '<div class="ob-prog" aria-hidden="true"><i style="width:' + pct + '%"></i></div>' : "") +
      '<div class="ob-body" id="ob-body">' + body(s) + '</div>' +
      (s.id === "parent"
        ? '<div class="ob-foot"><button type="button" class="btn ob-next" id="ob-pjoin"' + (valid(s) ? "" : " disabled") + '>' + (pbusy ? "Récupération…" : "Voir les notes de mon enfant") + '</button></div>'
        : s.id === "guide"
        ? '<div class="ob-foot"><button type="button" class="btn" id="ob-guide">' + (guideTouched ? "Reprendre le guide" : "Suivre le guide maintenant") + '</button><button type="button" class="link ob-later" id="ob-later">' + (guideTouched ? "Continuer la configuration" : "Plus tard") + '</button></div>'
        : '<div class="ob-foot"><button type="button" class="btn ob-next"' + (valid(s) ? "" : " disabled") + '>' +
          (s.id === "welcome" ? "Commencer" : last ? (editing ? "Enregistrer" : "Créer mon tableau de bord") : "Continuer") + '</button>' +
          // Bienvenue : un vrai bouton pour les parents, sous « Commencer » (à la place de la petite ligne d'avant).
          (s.id === "welcome" && !editing && window.Sync && Sync.available() ? '<button type="button" class="btn ios-ob-parents" id="ob-parents">' + window.Icons.svg("people") + 'Pour les parents</button>' : "") + '</div>');
    var pin = $("#ob-pcode", root);
    if (pin) pin.addEventListener("input", function () { pcode = pin.value; var w = $("#ob-pwarn", root); if (w) w.hidden = true; refreshNext(); var b = $("#ob-pjoin", root); if (b) b.disabled = !valid(PARENT); });
    var input = $("#ob-classe", root);
    if (input) input.addEventListener("input", function () { p.classe = input.value.trim(); });
    root.scrollTop = 0;
    var b = $("#ob-body", root);
    if (canAnim()) {
      A(b, { opacity: [0, 1], x: [dir * 36, 0] }, { type: "spring", stiffness: 340, damping: 30 });
      var rows = b.querySelectorAll(".ob-row");
      if (rows.length) A(rows, { opacity: [0, 1], y: [10, 0] }, { delay: ST(0.025, { startDelay: 0.05 }), type: "spring", stiffness: 380, damping: 30 });
      var bar = $(".ob-prog i", root); if (bar) { var from = Math.round(((step - dir) / (vs.length - 1)) * 100); A(bar, { width: [Math.max(0, from) + "%", pct + "%"] }, { type: "spring", stiffness: 260, damping: 30 }); }
    }
  }

  function go(d) {
    var vs = visible();
    if (d > 0 && !valid(vs[step])) return;
    dir = d; step = Math.max(0, Math.min(vs.length - 1, step + d));
    if (step === 0 && parentMode) parentMode = false; // retour à Bienvenue : on quitte la page des parents
    render();
  }

  function finish() {
    // Confirmations en feuilles (ios-sheets.js), l'une après l'autre ; Annuler laisse l'assistant ouvert.
    var cur0 = window.NotesApp.profile(), nn = window.NotesApp.grades().length, chain = Promise.resolve(true);
    function ask(o) { chain = chain.then(function (ok) { return ok && IOSSheet.confirm(o); }); }
    if (cur0 && p.year !== cur0.year && nn)
      ask({ title: "Changer d'année sans classer tes notes ?", message: "Elles seront comptées dans les moyennes de la nouvelle année. Pour les classer dans « Années précédentes », annule puis utilise « Passer à l'année suivante » dans Réglages.", ok: "Changer quand même", danger: false });
    var voie = !!(cur0 && G.voieOf(cur0) !== G.voieOf(p) && nn);
    if (voie) ask({ title: G.cantonOf(cur0) !== G.cantonOf(p) ? "Changer de canton ?" : "Changer de voie ?", message: "Tes " + nn + " note" + (nn > 1 ? "s" : "") + " actuelle" + (nn > 1 ? "s" : "") + " (et leurs photos) seront supprimée" + (nn > 1 ? "s" : "") + " : les branches ne sont pas les mêmes. Exporte une sauvegarde avant si tu veux les garder.", ok: "Supprimer et changer de voie" });
    chain.then(function (ok) {
      if (!ok) return;
      if (voie) window.NotesApp.remove(window.NotesApp.grades().map(function (g) { return g.id; }));
      var gs = window.NotesApp.grades(), next = G.build(p).map(function (x) { return x.id; });
      var lost = gs.filter(function (g) { return next.indexOf(g.subject) < 0; }).length;
      (lost ? IOSSheet.confirm({ title: "Masquer des notes ?", message: lost + " note" + (lost > 1 ? "s appartiennent" : " appartient") + " à des branches absentes de ce profil. Elles seront masquées, pas supprimées.", ok: "Continuer", danger: false }) : Promise.resolve(true))
        .then(function (ok2) { if (ok2) apply(); });
    });
  }
  function apply() {
    window.NotesApp.setProfile(Object.assign({ v: 1 }, p));
    hap("success");
    // Première configuration : « Hello World » s'écrit à la main, puis le tableau de bord apparaît.
    if (!editing && window.Hello) window.Hello.play({ onCovered: closeNow, onReveal: function () { if (window.FX) window.FX.view("dash"); } });
    else close();
  }
  function closeNow() { if (!root) return; root.remove(); root = null; document.body.classList.remove("ob-open"); window.scrollTo(0, 0); }

  function close() {
    if (!root) return;
    var el = root, closed = false;
    function done() { if (closed) return; closed = true; el.remove(); if (root === el) root = null; if (!root) document.body.classList.remove("ob-open"); if (window.FX) window.FX.view("dash"); }
    root = null;
    if (canAnim()) { el.style.pointerEvents = "none"; A(el, { opacity: [1, 0], scale: [1, 1.04] }, { duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }).then(done); setTimeout(done, 500); }
    else done();
  }

  // Le parent entre le code de l'enfant : les notes arrivent par la synchronisation, puis le tableau de bord s'ouvre.
  function joinParent() {
    if (!root || pbusy || !codeOk(pcode)) return;
    pbusy = true; var b = $("#ob-pjoin", root); if (b) { b.disabled = true; b.textContent = "Récupération…"; }
    window.Sync.join(pcode).then(function (ok) {
      pbusy = false;
      if (ok) { hap("success"); parentMode = false; close(); return; }
      if (!root) return;
      hap("error");
      var w = $("#ob-pwarn", root); if (w) { w.textContent = "Aucune note trouvée pour ce code. Vérifie-le avec ton enfant : 16 lettres ou chiffres, dans son app sous Réglages → Synchronisation."; w.hidden = false; }
      if (b) { b.textContent = "Voir les notes de mon enfant"; b.disabled = !codeOk(pcode); }
    }, function () {
      pbusy = false; if (!root) return;
      var w = $("#ob-pwarn", root); if (w) { w.textContent = "Pas de connexion au serveur. Vérifie Internet, puis réessaie."; w.hidden = false; }
      if (b) { b.textContent = "Voir les notes de mon enfant"; b.disabled = false; }
    });
  }

  function open(edit, startId) {
    if (root) return;
    parentMode = false; pcode = ""; pbusy = false;
    editing = !!edit; allowVoie = startId === "voie" || startId === "canton"; loading = false; loadErr = false;
    var cur = window.NotesApp.profile();
    p = cur ? JSON.parse(JSON.stringify(cur)) : {};
    if (cur && !p.canton) p.canton = "vd";
    step = editing ? 1 : 0; dir = 1;
    if (startId) { var vs0 = visible(); for (var i0 = 0; i0 < vs0.length; i0++) if (vs0[i0].id === startId) step = i0; } guideTouched = false;
    firstStep = step;
    root = document.createElement("div");
    root.className = "ob"; root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true"); root.setAttribute("aria-label", "Configuration");
    document.body.appendChild(root);
    document.body.classList.add("ob-open");
    root.addEventListener("click", function (e) {
      if (e.target.id === "ob-sync") {
        var sb = e.target;
        window.Sync.ask().then(function (code) {
          if (code == null) return;
          sb.textContent = "Récupération…";
          window.Sync.join(code).then(function (ok) {
            if (ok) { hap("success"); close(); }
            else { sb.textContent = "J'ai déjà mes notes sur un autre appareil"; IOSSheet.notice({ title: "Aucune note trouvée", message: "Vérifie le code (16 lettres ou chiffres) sur ton autre appareil, ou continue la configuration." }); }
          });
        });
        return;
      }
      if (e.target.closest("#ob-parents")) { parentMode = true; pcode = ""; pbusy = false; go(1); return; }
      if (e.target.closest("#ob-pjoin")) { joinParent(); return; }
      if (e.target.id === "ob-sheet") {
        window.Grid.script("import.js").then(function () { Import.open({ onDone: close }); }, function () { IOSSheet.notice({ title: "Connexion nécessaire", message: "L'import se charge à la première utilisation : connecte-toi à Internet, puis réessaie." }); });
        return;
      }
      if (e.target.closest("#ob-guide")) {
        window.Guide.open({ start: true, profile: p, onClose: function (res) { guideTouched = true; if (!root) return; if (res && res.completed) go(1); else render(); } });
        return;
      }
      if (e.target.closest("#ob-later")) { go(1); return; }
      var r = e.target.closest(".ob-row[data-f]");
      if (r && !r.disabled) {
        var f = r.dataset.f, v = r.dataset.v;
        if (f === "voie") { chooseVoie(v); }
        else if (f === "canton") { chooseCanton(v); }
        else p[f] = f === "year" ? parseInt(v, 10) : v;
        sanitize(); hap("select");
        A(r.querySelector(".ob-chk"), { scale: [0.3, 1] }, { type: "spring", stiffness: 500, damping: 15 });
        root.querySelectorAll('.ob-row[data-f="' + f + '"]').forEach(function (x) { var on = x === r; x.classList.toggle("on", on); x.setAttribute("aria-checked", String(on)); });
        var s = visible()[step];
        if (s.id === "domaine") {
          var dw = G.ext(p).warn("domaine", p.domaine, p), w2 = root.querySelector(".ob-warn");
          if (w2) w2.remove();
          if (dw) { w2 = document.createElement("p"); w2.className = "ob-warn"; w2.textContent = dw; root.querySelector(".ob-list").after(w2); }
        }
        if (s.id === "gymnase") {
          var g = G.find(G.list("gymnase", p), p.gymnase), w = root.querySelector(".ob-warn");
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
    root.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && e.target.id === "ob-classe") { e.preventDefault(); go(1); }
      if (e.key === "Enter" && e.target.id === "ob-pcode") { e.preventDefault(); joinParent(); }
    });
    render();
    A(root, { opacity: [0, 1] }, { duration: 0.3 });
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
    if (!G.isMat(pr)) { var x = G.ext(pr); el.textContent = x ? x.summary(pr) : ""; return; }
    var os = G.find(G.OS, pr.os), l2 = G.find(G.L2, pr.l2), l3 = G.find(G.L3, pr.l3);
    el.textContent = pr.year + (pr.year === 1 ? "re" : "e") + " année · L2 " + (l2 ? l2.name : "?") + " · L3 " + (l3 ? l3.name : "?") + " · OS " + (os ? os.name : "?") + " · maths " + (pr.math === "renf" ? "renforcé" : "standard");
  }

  /* ---------- Installer d'abord ----------
     Safari et l'app de l'écran d'accueil ont des stockages séparés : on fait installer l'app
     avant la configuration pour ne pas la remplir deux fois. */
  var ua = navigator.userAgent;
  var isAndroid = /Android/.test(ua);
  var isIOS = !isAndroid && (/iP(hone|ad|od)/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
  function standalone() { return window.navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches; }
  // Navigateur intégré à une app (Moodle, réseaux sociaux…) : l'installation y est impossible.
  function detectInApp(u, ios, installed) {
    if (/MoodleMobile/i.test(u) || /FBAN|FBAV|Instagram|Snapchat|Line\/|TikTok|musical_ly|LinkedInApp/.test(u)) return true;
    return !!(ios && !installed && !/Safari\//.test(u)); // sur iOS, seul le vrai Safari (ou Chrome, Firefox) annonce « Safari/ »
  }
  var isMoodle = /MoodleMobile/i.test(ua);
  // Démo animée (session A, 19 novembre 2026) : iPhone dans le vrai Safari seulement. iPad, Chrome ou Firefox sur iOS gardent la liste.
  var isIPhone = /iPhone|iPod/.test(ua), otherIOS = /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua);
  var safariV = parseInt((ua.match(/Version\/(\d+)/) || [])[1], 10) || 0;
  // Android : démo pour Chrome seulement (Samsung Internet, Firefox, Edge… gardent la liste : leurs menus diffèrent).
  var andrChrome = isAndroid && /Chrome\//.test(ua) && !/SamsungBrowser|Firefox|EdgA|OPR|UCBrowser|YaBrowser|wv\)/.test(ua);
  var inApp = detectInApp(ua, isIOS, standalone());
  // Instagram (25 novembre 2026) : Meta bloque x-safari-https:// dans ses navigateurs intégrés ; instagram://extbrowser/ ouvre encore
  // le navigateur. Lien réservé aux bios Instagram : ?ig (si l'agent utilisateur ne dit pas « Instagram »), seulement dans un
  // navigateur intégré qui n'est pas celui d'une autre app connue (jamais dans Safari, Chrome ou Firefox).
  var isInsta = /Instagram/.test(ua) || (inApp && /(^|[?&])ig(=|&|$)/.test(location.search) && !/FBAN|FBAV|Snapchat|TikTok|musical_ly|LinkedInApp|MoodleMobile/i.test(ua));
  var deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault(); deferredPrompt = e;
    var b = document.getElementById("inst-btn"); if (b) { b.hidden = false; window.dispatchEvent(new Event("resize")); } // la démo se remet à l'échelle
  });

  var ICON_SHARE = window.Icons.svg("share");
  var ICON_ADD = window.Icons.svg("addhome");
  var ICON_DOTS = window.Icons.svg("dots");
  var ICON_HOME = '<img src="icon-180.png" alt="">';

  function steps() {
    if (inApp) return [["!", "Ouvre ce lien dans " + (isIOS ? "Safari" : "ton navigateur"), "Cherche « Ouvrir dans " + (isIOS ? "Safari" : "le navigateur") + " » (icône boussole ou ⋯ ou ⋮), ou copie le lien ci-dessous et colle-le dans " + (isIOS ? "Safari" : "ton navigateur") + "."]];
    if (isIOS) return [
      [ICON_SHARE, "Touche le bouton Partager", isIPhone ? "En bas du navigateur, ou en haut à droite dans Chrome. Si tu ne le vois pas, touche d'abord ⋯." : "En haut à droite du navigateur. Si tu ne le vois pas, touche d'abord ⋯."],
      [ICON_ADD, "Choisis « Sur l'écran d'accueil »", "Fais défiler la liste si besoin, puis touche « Ajouter »."],
      [ICON_HOME, "Ouvre Sur6 depuis ton écran d'accueil", "La configuration commencera dans l'app."]
    ];
    return [
      [ICON_DOTS, "Ouvre le menu du navigateur", "Le bouton ⋮ en haut à droite."],
      [ICON_ADD, "Touche « Installer l'application »", "Ou « Ajouter à l'écran d'accueil »."],
      [ICON_HOME, "Ouvre Sur6 depuis ton écran d'accueil", "La configuration commencera dans l'app."]
    ];
  }

  function bindSkip(el, onLeave) {
    el.querySelector("#inst-skip").addEventListener("click", function () {
      function go() { if (onLeave) onLeave(); el.remove(); document.body.classList.remove("ob-open"); open(false); }
      if (isAndroid) { go(); return; }
      IOSSheet.confirm({ title: "Continuer dans le navigateur ?", message: "Si tu configures ici puis installes l'app plus tard, il faudra refaire la configuration dans l'app.", ok: "Continuer ici", danger: false }).then(function (ok) { if (ok) go(); });
    });
  }

  /* ---------- Démo « vidéo » : un seul écran d'arrivée pour tous les appareils ----------
     Au centre, un faux appareil dessiné en HTML (illustration, aria-hidden) où un rond de toucher gris (comme l'option
     « Touchers » d'iOS) rejoue les gestes ; la légende « Étape n sur N » suit chaque geste. Quatre cas (`kind`) :
     - "iphone"  : Safari sur iPhone. ••• (Safari 26 et plus) puis Partager, ou Partager au milieu de la barre (Safari 18),
                   défilement de la feuille, « Sur l'écran d'accueil », « Ajouter », icône sur l'écran d'accueil ;
     - "ipad"    : Safari sur iPad. Partager en haut à droite, la feuille s'ouvre en bulle, même suite ;
     - "android" : Chrome sur Android. ⋮, « Ajouter à l'écran d'accueil », « Installer » ; bouton « Installer Notes »
                   en un toucher dès que Chrome émet beforeinstallprompt ;
     - "inapp"   : tout le reste (Moodle, réseaux sociaux, Chrome ou Firefox sur iPhone, Samsung Internet…). Un seul
                   gros bouton « Ouvrir dans Safari » (x-safari-https://) ou « Ouvrir dans Chrome » (intent://) ; si la
                   page est encore visible 1,5 s après, « Copier le lien » prend la place du bouton.
     Le lien « Continuer ici » n'apparaît qu'après quelques secondes (on touche d'abord ce qu'on voit).
     Ressorts de Motion via IOSMotion.animate ; avec ?noanim=1 ou « Réduire les animations », images fixes avec ‹ ›. */
  var SC_SCROLL = 70; // défilement de la feuille de partage, en px de la scène
  var SKIP_DELAY = 6000;
  function demoSteps(kind) {
    var tail = [["addhome", "Fais défiler, puis touche « Sur l'écran d'accueil »"], ["ok", "Touche « Ajouter »"], ["icon", "Ouvre Sur6 depuis ton écran d'accueil"]];
    if (kind === "inapp") return [["open", "Touche « Ouvrir dans " + target() + " »"], ["safari", target() + " s'ouvre : suis les étapes pour installer Sur6"]];
    if (kind === "android") return [["more", "Touche ⋮ en haut à droite de Chrome"], ["addhome", "Touche « Ajouter à l'écran d'accueil »"], ["ok", "Touche « Installer »"], ["icon", "Ouvre Sur6 depuis ton écran d'accueil"]];
    if (kind === "ipad") return [["share", "Touche Partager, en haut à droite de Safari"]].concat(tail);
    return (safariV >= 26 ? [["more", "Touche ••• en bas à droite de Safari"], ["share", "Touche « Partager »"]]
      : [["share", "Touche Partager, en bas au milieu de Safari"]]).concat(tail);
  }
  function target() { return isIOS ? "Safari" : "Chrome"; }
  // Adresse qui ouvre la page dans Safari (iOS 17+) ou dans Chrome (Android) depuis un navigateur intégré.
  function openURL() {
    var u = location.origin + location.pathname;
    if (isIOS) return isInsta ? "instagram://extbrowser/?url=" + encodeURIComponent(u) : "x-safari-" + u;
    return "intent://" + location.host + location.pathname + "#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=" + encodeURIComponent(u) + ";end";
  }

  function sceneHTML(kind) {
    var I = function (n) { return window.Icons.svg(n); }, host = esc(location.hostname || "notes");
    var li = function (t, ic, id) { return '<div class="ios-sc-li"' + (id ? ' data-t="' + id + '"' : "") + '><span>' + t + '</span>' + I(ic) + '</div>'; };
    var page = function (c) { return '<div class="ios-sc-page' + (c ? " " + c : "") + '"><img src="icon-180.png" alt=""><i class="t"></i><i></i><i class="s"></i><i></i></div>'; };
    var home = '<div class="ios-sc-home">' + new Array(11).join("<i></i>") + '<img src="icon-180.png" alt="" data-t="icon"><b class="ios-sc-name">Sur6</b></div>' +
      '<div class="ios-sc-launch"></div><div class="ios-sc-dot"></div>';
    var top = isIOS ? '<div class="ios-sc-island"></div><div class="ios-sc-status"><span>9:41</span></div>' : '<div class="ios-sc-status ios-sc-astatus"><span>9:41</span></div>';
    var bar26 = '<div class="ios-sc-bar26"><span class="ios-sc-c">' + I("chevl") + '</span><span class="ios-sc-addr">' + host + '</span><span class="ios-sc-c" data-t="more">' + I("dots") + '</span></div>';
    var bar18 = '<div class="ios-sc-bar18"><span class="ios-sc-addr">' + host + '</span><div class="ios-sc-tools"><span>' + I("chevl") + '</span><span>' + I("chevr") + '</span><span data-t="share">' + I("share") + '</span><span>' + I("book") + '</span><span>' + I("copy") + '</span></div></div>';
    var atop = '<div class="ios-sc-atop"><span class="ios-sc-addr">' + host + '</span><span class="ios-sc-c ios-sc-kebab" data-t="more">' + I("dots") + '</span></div>';
    // Navigateur intégré (Moodle…) : la page de Notes avec son gros bouton, puis Safari ou Chrome qui s'ouvre par-dessus.
    // Instagram sur iPhone (plan B, choix de l'utilisateur le 25 novembre 2026) : ✕, adresse, ••• et son menu « Ouvrir dans le navigateur externe ».
    var igB = isInsta && isIOS;
    if (kind === "inapp") return top +
      (igB ? '<div class="ios-sc-inbar"><span>' + I("times") + '</span><b>' + host + '</b><span class="ios-sc-igm" data-t="igmore">' + I("dots") + '</span></div>' +
        '<div class="ios-sc-menu ios-sc-igmenu">' + li("Copier le lien", "copy") + li("Ouvrir dans le navigateur externe", "globe", "extbrowser") + li("Signaler", "info") + '</div>'
      : '<div class="ios-sc-inbar"><span class="ios-sc-blue">' + (isIOS ? "Terminé" : I("times")) + '</span><b>' + (isMoodle ? "Moodle" : host) + '</b><span></span></div>') +
      '<div class="ios-sc-ipage"><img src="icon-180.png" alt=""><b>Ouvre Sur6 dans ' + target() + '</b><span class="ios-sc-btn" data-t="open">Ouvrir dans ' + target() + '</span></div>' +
      '<div class="ios-sc-saf">' + top + (isIOS ? page() + (safariV >= 26 ? bar26 : bar18) : atop + page("ios-sc-apage")) + '</div><div class="ios-sc-dot"></div>';
    // Chrome sur Android : barre d'adresse en haut avec ⋮, menu qui descend, boîte « Installer l'application ».
    if (kind === "android") return top + atop + page("ios-sc-apage") +
      '<div class="ios-sc-menu ios-sc-amenu">' + li("Nouvel onglet", "add") + li("Historique", "clock") + li("Favoris", "star") + li("Partager…", "share") +
      li("Ajouter à l'écran d'accueil", "addhome", "addhome") + li("Paramètres", "settings") + '</div>' +
      '<div class="ios-sc-add ios-sc-dlg"><b>Installer l\'application</b><div class="ios-sc-card"><img src="icon-180.png" alt=""><span><b>Sur6</b><small>' + host + '</small></span></div>' +
      '<div class="ios-sc-dlgb"><span class="ios-sc-blue">Annuler</span><span class="ios-sc-blue ios-sc-ok" data-t="ok">Installer</span></div></div>' + home;
    var sheet = '<div class="ios-sc-sheet"><div class="ios-sc-sheet-in"><div class="ios-sc-head"><img src="icon-180.png" alt=""><span><b>Sur6</b><small>' + host + '</small></span></div>' +
      '<div class="ios-sc-round"><i></i><i></i><i></i><i></i><i></i></div><div class="ios-sc-round ios-sc-apps"><i></i><i></i><i></i><i></i><i></i></div>' +
      '<div class="ios-sc-list">' + li("Copier", "copy") + li("Ajouter à la liste de lecture", "list") + li("Ajouter aux signets", "book") + li("Ajouter aux favoris", "star") +
      li("Rechercher dans la page", "search") + li("Sur l'écran d'accueil", "addhome", "addhome") + li("Imprimer", "doc") + '</div></div></div>' +
      '<div class="ios-sc-add"><div class="ios-sc-addh"><span class="ios-sc-blue">Annuler</span><b>Ajouter à l\'écran d\'accueil</b><span class="ios-sc-blue ios-sc-ok" data-t="ok">Ajouter</span></div>' +
      '<div class="ios-sc-card"><img src="icon-180.png" alt=""><span><b>Sur6</b><small>' + host + '</small></span></div>' +
      '<div class="ios-sc-card ios-sc-tg"><span>Ouvrir comme app web</span><i></i></div></div>';
    // Safari sur iPad : barre en haut, Partager à droite, la feuille s'ouvre en bulle sous le bouton.
    if (kind === "ipad") return '<div class="ios-sc-status"><span>9:41</span></div>' +
      '<div class="ios-sc-ptop"><span class="ios-sc-c">' + I("chevl") + '</span><span class="ios-sc-c">' + I("chevr") + '</span><span class="ios-sc-addr">' + host + '</span>' +
      '<span class="ios-sc-c" data-t="share">' + I("share") + '</span><span class="ios-sc-c">' + I("add") + '</span></div>' + page("ios-sc-ppage") + sheet + home;
    return top + page() + (safariV >= 26 ? bar26 : bar18) +
      (safariV >= 26 ? '<div class="ios-sc-menu">' + li("Partager", "share", "share") + li("Ajouter aux signets", "book") + li("Nouvel onglet", "add") + li("Copier", "copy") + '</div>' : "") +
      sheet + home;
  }

  function openDemo(kind) {
    var STEPS = demoSteps(kind), live = canAnim(), andr = kind === "android", pad = kind === "ipad", inapp = kind === "inapp";
    var nav = andr ? "Chrome" : "Safari", here = inapp ? "ici" : "dans " + nav;
    var el = document.createElement("div");
    el.className = "ob ob-install ios-inst"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Installer l'app");
    el.innerHTML =
      (inapp ? '<div class="ios-inst-head"><h1>Ouvre Sur6 dans ' + target() + '</h1><p>' + (inApp ? "Ici, Sur6 ne peut pas s'installer." : "Sur6 s'installe depuis " + target() + ".") + '</p></div>'
        : '<div class="ios-inst-head"><h1>Installe Sur6</h1><p>Regarde, puis fais pareil dans ' + nav + '.</p></div>') +
      '<div class="ios-inst-stage"><div class="ios-inst-ph" aria-hidden="true"><div class="ios-inst-sc ios-inst-' + kind + (isIOS ? "" : " ios-inst-andr") + '">' + sceneHTML(kind) + '</div></div></div>' +
      '<div class="ios-inst-cap" aria-live="polite"><span class="ios-inst-n"></span><b class="ios-inst-t"></b></div>' +
      '<div class="ios-inst-nav">' + (live ? "" : '<button type="button" class="ob-round" id="inst-prev" aria-label="Étape précédente">' + window.Icons.svg("chevl") + '</button>') +
      '<span class="ios-inst-dots">' + STEPS.map(function () { return "<i></i>"; }).join("") + '</span>' +
      (live ? "" : '<button type="button" class="ob-round" id="inst-next" aria-label="Étape suivante">' + window.Icons.svg("chevr") + '</button>') + '</div>' +
      '<div class="ios-inst-foot">' +
      // Un seul gros bouton quand une action directe existe : installer (Chrome) ou ouvrir le bon navigateur (navigateur intégré).
      (andr ? '<button type="button" class="btn ob-next ios-inst-go" id="inst-btn"' + (deferredPrompt ? "" : " hidden") + '>Installer Sur6</button>' : "") +
      (inapp ? '<a class="btn ob-next ios-inst-go" id="inst-open" href="' + esc(openURL()) + '">Ouvrir dans ' + target() + '</a>' +
        '<button type="button" class="btn ob-next ios-inst-go" id="inst-copy" hidden>Copier le lien</button>' : "") +
      '<p class="ob-fine">' + (andr ? "Sur6 s\'ouvrira en plein écran, comme une vraie app, et marchera sans connexion."
        : inapp ? "Si rien ne s\'ouvre, copie le lien et colle-le dans la barre d\'adresse de " + target() + "."
        : "Safari et l\'app de l\'écran d\'accueil ne partagent pas leurs données : configure Sur6 dans l\'app, pas ici.") + '</p>' +
      '<p class="ob-fine ios-inst-parent">Parent d\'élève ? Installe d\'abord l\'app comme ton enfant, puis touche « Pour les parents ».</p>' +
      '<button type="button" class="link inst-skip ios-inst-later" id="inst-skip">Continuer ' + here + '</button></div>';
    document.body.appendChild(el);
    document.body.classList.add("ob-open");

    var sc = el.querySelector(".ios-inst-sc"), ph = el.querySelector(".ios-inst-ph"), stage = el.querySelector(".ios-inst-stage");
    var q = function (t) { return sc.querySelector('[data-t="' + t + '"]'); };
    var L = { menu: sc.querySelector(".ios-sc-menu"), sheet: sc.querySelector(".ios-sc-sheet"), inner: sc.querySelector(".ios-sc-sheet-in"), add: sc.querySelector(".ios-sc-add"),
      home: sc.querySelector(".ios-sc-home"), icon: q("icon"), name: sc.querySelector(".ios-sc-name"), launch: sc.querySelector(".ios-sc-launch"),
      saf: sc.querySelector(".ios-sc-saf"), dot: sc.querySelector(".ios-sc-dot") };
    var cap = el.querySelector(".ios-inst-t"), num = el.querySelector(".ios-inst-n"), dots = el.querySelectorAll(".ios-inst-dots i");

    // Le faux appareil garde ses proportions et remplit la place libre au centre.
    function fit() {
      var W = sc.offsetWidth, H = sc.offsetHeight, r = stage.getBoundingClientRect();   // tailles avec le cadre
      var k = Math.max(0.5, Math.min(1.5, (r.height - 16) / H, (r.width - 32) / W));
      ph.style.setProperty("--ios-inst-k", k.toFixed(3));
      ph.style.width = Math.round(W * k) + "px"; ph.style.height = Math.round(H * k) + "px";
    }
    fit(); window.addEventListener("resize", fit);

    // Position d'un élément dans la scène (sans les transformations : la scène est mise à l'échelle).
    function at(t) {
      var e = q(t); if (!e) return null;
      var x = e.offsetWidth / 2, y = e.offsetHeight / 2;
      while (e && e !== sc) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; }
      if (t === "addhome" && !andr) y -= SC_SCROLL;
      return { x: x, y: y };
    }
    // Pose sans animation (pour les deux modes : sans Motion, on écrit transform à la main).
    function put(node, v) {
      if (!node) return;
      if (live) { var kf = {}; Object.keys(v).forEach(function (k) { kf[k] = [v[k], v[k]]; }); A(node, kf, { duration: 0 }); return; }
      var st = node._st = Object.assign(node._st || {}, v), u = function (n) { return typeof n === "number" ? n + "px" : n; };
      node.style.transform = "translate(" + u(st.x || 0) + "," + u(st.y || 0) + ") scale(" + (st.scale == null ? 1 : st.scale) + ")";
      if (st.opacity != null) node.style.opacity = st.opacity;
    }
    // Calques qui apparaissent sur place (bulle de l'iPad, boîte d'Android) au lieu de monter du bas.
    var popSheet = pad, popAdd = pad || andr;
    // État de la scène au moment où l'étape i commence (doigt posé sur la cible en mode fixe).
    function state(i) {
      var id = STEPS[i][0], k = ["more", "share", "addhome", "ok", "icon"].indexOf(id);
      var menuOn = inapp ? id === "extbrowser" : andr ? id === "addhome" : safariV >= 26 && !pad && id === "share";
      put(L.menu, { opacity: menuOn ? 1 : 0, scale: menuOn ? 1 : 0.4 });
      put(L.sheet, popSheet ? { opacity: k === 2 ? 1 : 0, scale: k === 2 ? 1 : 0.9 } : { y: k === 2 ? "0%" : "105%" });
      put(L.inner, { y: k === 2 ? -SC_SCROLL : 0 });
      put(L.add, popAdd ? { opacity: k === 3 ? 1 : 0, scale: k === 3 ? 1 : 0.9 } : { y: k === 3 ? "0%" : "105%" });
      put(L.home, { opacity: k === 4 ? 1 : 0 }); put(L.icon, { opacity: 1, scale: 1 }); put(L.name, { opacity: 1 });
      put(L.launch, { opacity: 0, scale: 0.2 });
      put(L.saf, { opacity: id === "safari" ? 1 : 0, scale: 1 });
      var p = at(id);
      if (!live && p) put(L.dot, { x: p.x, y: p.y, opacity: 1 });
      else put(L.dot, { opacity: 0 });
    }
    function caption(i) {
      num.textContent = "Étape " + (i + 1) + " sur " + STEPS.length; cap.textContent = STEPS[i][1];
      dots.forEach(function (d, j) { d.classList.toggle("on", j === i); });
      A(cap, { opacity: [0, 1], y: [6, 0] }, { duration: 0.3, ease: [0.32, 0.72, 0, 1] });
    }

    /* Mode fixe : une image par étape. */
    var cur = 0;
    function show(i) { cur = (i + STEPS.length) % STEPS.length; state(cur); caption(cur); }
    if (!live) {
      el.querySelector("#inst-prev").addEventListener("click", function () { show(cur - 1); });
      el.querySelector("#inst-next").addEventListener("click", function () { show(cur + 1); });
      stage.addEventListener("click", function () { show(cur + 1); });
      show(0);
    }

    /* Mode animé : la séquence se rejoue en boucle tant que l'écran est ouvert. */
    var gen = 0, pos = { x: 0, y: 0 };
    var SP_MOVE = window.IOSMotion ? Object.assign({ type: "spring" }, IOSMotion.appleSpring(0.6, 0)) : {};
    var SP_IN = window.IOSMotion ? Object.assign({ type: "spring" }, IOSMotion.appleSpring(0.5, 0)) : {};
    var SP_POP = window.IOSMotion ? Object.assign({ type: "spring" }, IOSMotion.appleSpring(0.5, 0.3)) : {};
    function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
    function alive(g) { return g === gen && el.isConnected; }
    function moveTo(p) { var a = A(L.dot, { x: [pos.x, p.x], y: [pos.y, p.y] }, SP_MOVE); pos = p; return a; }
    function appear(p) { pos = p; return A(L.dot, { x: [p.x, p.x], y: [p.y, p.y], opacity: [0, 1], scale: [1.4, 1] }, { duration: 0.25 }); }
    function press(target) {
      A(q(target), { opacity: [1, 0.35, 1] }, { duration: 0.35 });
      return A(L.dot, { scale: [1, 0.72, 1] }, { duration: 0.32, ease: "easeInOut" });
    }
    function popIn(node) { return A(node, { opacity: [0, 1], scale: [0.9, 1] }, SP_IN); }
    async function run(g) {
      state(0); pos = { x: sc.offsetWidth * 0.55, y: sc.offsetHeight * 0.62 };
      await wait(500); if (!alive(g)) return;
      for (var i = 0; i < STEPS.length; i++) {
        var id = STEPS[i][0];
        caption(i);
        if (i === 0) { await appear(pos); }
        if (id === "safari") { await wait(2600); if (!alive(g)) return; continue; } // pas de geste : Safari est ouvert
        if (id === "addhome" && !andr) {
          // Geste de défilement : le doigt se pose bas dans la feuille (ou la bulle) et glisse vers le haut.
          var sx = L.sheet.offsetLeft + L.sheet.offsetWidth / 2, y0 = L.sheet.offsetTop + L.sheet.offsetHeight - 60;
          await moveTo({ x: sx, y: y0 }); if (!alive(g)) return;
          await wait(120);
          A(L.inner, { y: [0, -SC_SCROLL] }, SP_IN);
          await moveTo({ x: sx, y: y0 - SC_SCROLL - 20 }); if (!alive(g)) return;
          await wait(200);
        }
        await wait(250); await moveTo(at(id)); if (!alive(g)) return;
        await wait(180); await press(id); if (!alive(g)) return;
        if (id === "more" || id === "igmore") await A(L.menu, { opacity: [0, 1], scale: [0.4, 1] }, SP_POP);
        else if (id === "extbrowser") { A(L.dot, { opacity: [1, 0] }, { duration: 0.2 }); A(L.menu, { opacity: [1, 0] }, { duration: 0.2 }); await A(L.saf, { opacity: [0, 1], scale: [1.06, 1] }, SP_IN); }
        else if (id === "open") { A(L.dot, { opacity: [1, 0] }, { duration: 0.2 }); await A(L.saf, { opacity: [0, 1], scale: [1.06, 1] }, SP_IN); }
        else if (id === "share") { A(L.menu, { opacity: [1, 0] }, { duration: 0.2 }); await (popSheet ? popIn(L.sheet) : A(L.sheet, { y: ["105%", "0%"] }, SP_IN)); }
        else if (id === "addhome" && popAdd) { A(andr ? L.menu : L.sheet, { opacity: [1, 0] }, { duration: 0.2 }); await popIn(L.add); }
        else if (id === "addhome") await A(L.add, { y: ["105%", "0%"] }, SP_IN);
        else if (id === "ok") {
          A(L.dot, { opacity: [1, 0] }, { duration: 0.2 });
          await A(L.home, { opacity: [0, 1] }, { duration: 0.35 });
          await A([L.icon, L.name], { opacity: [0, 1], scale: [0.2, 1] }, SP_POP);
          await wait(300); var p = at("icon"); await appear({ x: p.x + 30, y: p.y + 70 });
        } else if (id === "icon") {
          // L'app s'ouvre depuis son icône, puis la boucle repart.
          A(L.dot, { opacity: [1, 0] }, { duration: 0.2 });
          var c = at("icon"); L.launch.style.left = c.x + "px"; L.launch.style.top = c.y + "px";
          await A(L.launch, { opacity: [0, 1], scale: [0.2, 14] }, SP_IN);
          await wait(1200);
        }
        if (!alive(g)) return;
        await wait(450);
      }
      if (alive(g)) run(g);
    }
    if (live) run(++gen);

    if (canAnim()) A(el.querySelectorAll(".ios-inst-head > *, .ios-inst-ph, .ios-inst-cap, .ios-inst-foot"), { opacity: [0, 1], y: [16, 0] }, { delay: ST(0.07), type: "spring", stiffness: 300, damping: 26 });
    // « Continuer ici » n'apparaît qu'après quelques secondes : on regarde d'abord la démo.
    var skip = el.querySelector("#inst-skip"), skipT = setTimeout(function () { skip.classList.add("on"); }, SKIP_DELAY);
    bindSkip(el, function () { gen++; clearTimeout(skipT); window.removeEventListener("resize", fit); });

    var go = el.querySelector("#inst-btn");
    if (go) go.addEventListener("click", function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function () { deferredPrompt = null; });
    });
    // Navigateur intégré : si la page est encore là 1,5 s après « Ouvrir », le lien s'est perdu : on propose de le copier.
    var op = el.querySelector("#inst-open"), cp = el.querySelector("#inst-copy");
    if (op) op.addEventListener("click", function () {
      hap("select");
      setTimeout(function () {
        if (document.hidden || !el.isConnected) return;
        op.hidden = true; cp.hidden = false;
        if (isInsta && isIOS) {
          // Plan B : la démo montre ••• puis « Ouvrir dans le navigateur externe » ; « Copier le lien » reste dessous, en gris.
          STEPS = [["igmore", "Ça ne s'est pas ouvert ? Touche ••• en haut à droite"], ["extbrowser", "Touche « Ouvrir dans le navigateur externe »"], ["safari", "Safari s'ouvre : suis les étapes pour installer Sur6"]];
          el.querySelector(".ios-inst-dots").innerHTML = STEPS.map(function () { return "<i></i>"; }).join("");
          dots = el.querySelectorAll(".ios-inst-dots i");
          cp.classList.add("ios-inst-alt"); window.dispatchEvent(new Event("resize"));
          if (live) run(++gen); else show(0);
          return;
        }
        gen++; state(0); window.dispatchEvent(new Event("resize"));
        num.textContent = "Ça ne s'est pas ouvert ?"; cap.textContent = "Copie le lien, puis colle-le dans " + target();
      }, 1500);
    });
    if (cp) cp.addEventListener("click", function () {
      var url = location.origin + location.pathname;
      function done() { cp.textContent = "Lien copié ✓"; hap("success"); num.textContent = "Lien copié"; cap.textContent = "Ouvre " + target() + " et colle-le dans la barre d'adresse"; }
      function fallback() {
        if (el.querySelector(".inst-url")) return;
        var p = document.createElement("p"); p.className = "inst-url mono"; p.textContent = url; cp.after(p);
        cp.textContent = "Touche le lien ci-dessous et copie-le";
      }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, fallback);
      else fallback();
    });
    // Installée pendant que la page est ouverte (Android) : on le dit à la place de la légende.
    if (andr) window.addEventListener("appinstalled", function () {
      gen++; if (go) go.hidden = true; state(STEPS.length - 1); dots.forEach(function (d, j) { d.classList.toggle("on", j === STEPS.length - 1); });
      num.textContent = "C'est installé !"; cap.textContent = "Ouvre Sur6 depuis ton écran d'accueil";
    });
  }

  function openInstall() {
    // Un seul écran d'arrivée pour tous : installer depuis Safari (iPhone, iPad) ou Chrome (Android) ; ailleurs, ouvrir le bon navigateur.
    if (inApp || otherIOS || (isAndroid && !andrChrome)) return openDemo("inapp");
    if (isIOS) return openDemo(isIPhone ? "iphone" : "ipad");
    if (andrChrome) return openDemo("android");
    var el = document.createElement("div");
    el.className = "ob ob-install"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Installer l'app");
    el.innerHTML =
      '<div class="ob-body"><div class="ob-hero"><img src="icon-180.png" alt="" class="ob-icon"><h1>' + (inApp ? "Ouvre l\'app dans " + (isIOS ? "Safari" : "ton navigateur") : "Installe l\'app") + '</h1>' +
      '<p>' + (inApp ? "Cette fenêtre" + (isMoodle ? " (l\'app Moodle)" : "") + " ne permet pas d\'installer l\'app. Ouvre le lien dans " + (isIOS ? "Safari" : "ton navigateur") + " puis installe-la depuis là : tu ne feras la configuration qu\'une fois." : "Ajoute Sur6 à ton écran d\'accueil avant de commencer : elle s\'ouvre en plein écran, marche sans connexion et peut envoyer des notifications. Tu ne feras la configuration qu\'une fois.") + '</p></div>' +
      '<ol class="inst-steps">' + steps().map(function (s, i) {
        return '<li><span class="inst-ic' + (s[0] === "!" ? " warn" : "") + '">' + (s[0] === "!" ? "!" : s[0]) + '</span><span class="ob-txt"><span class="ob-n">' + (steps().length > 1 ? (i + 1) + ". " : "") + esc(s[1]) + '</span><span class="ob-s">' + esc(s[2]) + '</span></span></li>';
      }).join("") + '</ol>' +
      (inApp ? '<p class="inst-url mono" id="inst-url">' + esc(location.origin + location.pathname) + '</p>' : '') +
      '<p class="ob-fine">Pourquoi ? Safari et l\'app de l\'écran d\'accueil gardent leurs données séparément : une configuration faite ici ne serait pas reprise dans l\'app.</p></div>' +
      '<div class="ob-foot">' + (inApp ? '<button type="button" class="btn ob-next" id="inst-copy">Copier le lien</button>' : '') +
      '<button type="button" class="btn ob-next" id="inst-btn"' + (deferredPrompt && !inApp ? "" : " hidden") + '>Installer l\'app</button>' +
      '<button type="button" class="link inst-skip" id="inst-skip">Continuer dans le navigateur</button></div>';
    document.body.appendChild(el);
    document.body.classList.add("ob-open");
    if (canAnim()) {
      A(el.querySelectorAll(".ob-hero > *, .inst-steps li"), { opacity: [0, 1], y: [16, 0] }, { delay: ST(0.07), type: "spring", stiffness: 300, damping: 26 });
    }
    var cp = el.querySelector("#inst-copy");
    if (cp) cp.addEventListener("click", function () {
      var url = location.origin + location.pathname, u = el.querySelector("#inst-url");
      function fallback() {
        try { var r = document.createRange(); r.selectNodeContents(u); var sl = window.getSelection(); sl.removeAllRanges(); sl.addRange(r); document.execCommand("copy"); cp.textContent = "Lien copié ✓"; }
        catch (x) { cp.textContent = "Touche le lien et copie-le"; }
      }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(function () { cp.textContent = "Lien copié ✓"; hap("success"); }, fallback);
      else fallback();
    });
    el.querySelector("#inst-btn").addEventListener("click", function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function () { deferredPrompt = null; });
    });
    bindSkip(el);
    // Installée depuis Android pendant que la page est ouverte.
    window.addEventListener("appinstalled", function () { var s = el.querySelector(".ob-hero p"); if (s) s.textContent = "C'est installé ! Ouvre Sur6 depuis ton écran d'accueil."; });
  }

  window.Onboard = { open: open, refresh: refreshSummary, detectInApp: detectInApp };
  mountSettingsButton(); refreshSummary();
  if (!window.NotesApp.profile()) {
    if ((isIOS || isAndroid) && !standalone()) openInstall();
    else open(false);
  }
})();
