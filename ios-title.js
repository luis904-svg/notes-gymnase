/* ios-title.js : barre de titre à la iOS (téléphone, ≤ 700 px) : grand titre qui se réduit, titre inline, bouton retour.
   Une barre fixe (.ios-bar, hauteur --ios-bar-h sous la zone sûre) suit un « contexte » : IOSTitle.set({ key, title, large, back }).
   - large : l'élément « grand titre » de la page (h1). La barre reste vide tant qu'il est visible ; dès que son bas passe
     sous la barre, le petit titre centré apparaît avec le filet d'un pixel (classe .is-on).
   - sans large (sous-page) : titre inline et filet toujours affichés.
   - back : fonction du bouton de retour (chevron seul dans un rond opaque, à gauche) ; absent sur les pages d'onglet.
   Contextes par défaut : Accueil (h1 de l'en-tête « Notes … ») et Ajouter (grand titre « Ajouter »). Réglages et ses
   sous-pages sont gérés par ios-settings.js. Un simple écouteur de défilement passif, fondu CSS de 150 ms. */
(function () {
  "use strict";
  var h1 = document.querySelector("header.top h1"), addView = document.getElementById("view-add");
  if (!h1) return;
  var bar = document.createElement("div");
  bar.className = "ios-bar"; bar.setAttribute("aria-hidden", "true");
  var back = document.createElement("button");
  back.type = "button"; back.className = "ios-bar-back"; back.setAttribute("aria-label", "Retour");
  back.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
  var label = document.createElement("span");
  label.className = "ios-bar-title";
  bar.appendChild(back); bar.appendChild(label);
  document.body.appendChild(bar);

  // Grand titre de la page Ajouter (téléphone seulement, voir ios.css).
  var addTitle = null;
  if (addView) {
    addTitle = document.createElement("h1"); addTitle.className = "ios-large"; addTitle.textContent = "Ajouter";
    addView.insertBefore(addTitle, addView.firstChild);
  }

  var ctx = null, on = false, thr = {};
  function titleOf(c) { return typeof c.title === "function" ? c.title() : c.title; }
  function threshold() {
    if (!ctx || !ctx.large) return 0;
    var t = ctx.large.getBoundingClientRect().bottom + window.scrollY - bar.getBoundingClientRect().bottom;
    if (ctx.key) thr[ctx.key] = t;
    return t;
  }
  function update() {
    var next = !ctx ? false : !ctx.large ? true : window.scrollY >= threshold();
    if (next !== on) { on = next; bar.classList.toggle("is-on", on); }
  }
  function set(c) {
    ctx = c || null;
    bar.classList.toggle("is-empty", !ctx);
    bar.classList.toggle("has-back", !!(ctx && ctx.back));
    if (ctx) { var t = titleOf(ctx); if (label.textContent !== t) label.textContent = t; }
    update();
  }
  back.addEventListener("click", function () { if (ctx && ctx.back) ctx.back(); });
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);

  var dashCtx = { key: "dash", title: function () { return h1.textContent; }, large: h1 };
  var addCtx = { key: "add", title: "Ajouter", large: addTitle };
  // Le texte du h1 d'Accueil est réécrit par renderHead : la barre le suit.
  // Le titre d'Ajouter suit l'intitulé du formulaire (« Ajouter une note » / « Modifier la note »).
  var hAdd = document.getElementById("h-add");
  if (hAdd && addTitle) new MutationObserver(function () {
    var t = /^Modifier/.test(hAdd.textContent) ? "Modifier la note" : "Ajouter";
    addTitle.textContent = t; addCtx.title = t; if (ctx === addCtx) set(addCtx);
  }).observe(hAdd, { childList: true, characterData: true, subtree: true });
  new MutationObserver(function () { if (ctx === dashCtx) set(dashCtx); }).observe(h1, { childList: true, characterData: true, subtree: true });
  document.addEventListener("ios:view", function (e) {
    if (e.detail === "dash") set(dashCtx);
    else if (e.detail === "add") set(addCtx);
    // « settings » : ios-settings.js
  });
  set(dashCtx);

  // Barre du bas : cachée tant qu'une raison est active (sous-page de Réglages, page de détail d'une matière).
  var pillWhy = {};
  function pill(k, hide) {
    pillWhy[k] = !!hide;
    document.body.classList.toggle("ios-pill-hidden", Object.keys(pillWhy).some(function (x) { return pillWhy[x]; }));
  }

  window.IOSTitle = {
    set: set, update: update, pill: pill,
    /* Copie de la barre pour les fantômes de ios-nav.js. ov : { title, on, back } pour imposer un état (page du dessous). */
    ghost: function (scrollY, ov) {
      var c = bar.cloneNode(true);
      c.classList.add("ios-bar-ghost");
      if (ov) {
        if (ov.title != null) c.querySelector(".ios-bar-title").textContent = ov.title;
        c.classList.toggle("has-back", !!ov.back);
        c.classList.toggle("is-on", !!ov.on);
        c.classList.remove("is-empty");
      } else {
        c.classList.toggle("is-on", ctx && ctx.large ? scrollY >= threshold() : !!ctx);
      }
      return c;
    },
    /* Seuil mémorisé d'un grand titre (défilement à partir duquel la barre est « on »), pour la page du dessous. */
    threshold: function (key, dflt) { return thr[key] != null ? thr[key] : dflt; }
  };
})();
