/* ios-title.js : grand titre qui se réduit, comme dans Réglages iOS (téléphone, ≤ 700 px).
   Une barre fixe (.ios-bar, hauteur --ios-bar-h sous la zone sûre) reste vide tant que le grand titre « Notes … »
   (h1 de l'en-tête) est visible. Dès que le bas du grand titre passe sous la barre, le petit titre centré apparaît et
   le filet d'un pixel avec lui (classe .is-on). Le texte suit le h1 (renderHead le réécrit). La barre n'existe pas
   dans les sous-écrans Ajouter / Réglages (règle CSS) ni sur grand écran. Aucune animation de défilement en JS :
   un simple écouteur passif, un fondu CSS de 150 ms (supprimé avec « Réduire les animations »). */
(function () {
  "use strict";
  var h1 = document.querySelector("header.top h1");
  if (!h1) return;
  var bar = document.createElement("div");
  bar.className = "ios-bar"; bar.setAttribute("aria-hidden", "true");
  var label = document.createElement("span");
  label.className = "ios-bar-title";
  bar.appendChild(label);
  document.body.appendChild(bar);

  var on = false;
  function sync() { if (label.textContent !== h1.textContent) label.textContent = h1.textContent; }
  /* Défilement à partir duquel le bas du grand titre passe sous la barre. */
  function threshold() {
    var barBottom = bar.getBoundingClientRect().bottom, h = h1.getBoundingClientRect();
    return h.bottom + window.scrollY - barBottom;
  }
  function update() {
    var next = window.scrollY >= threshold();
    if (next === on) return;
    on = next; bar.classList.toggle("is-on", on);
  }
  new MutationObserver(sync).observe(h1, { childList: true, characterData: true, subtree: true });
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  sync(); update();

  /* Pour les fantômes de ios-nav.js : copie de la barre dans l'état qu'elle aurait à ce défilement. */
  window.IOSTitle = {
    ghost: function (scrollY) {
      var c = bar.cloneNode(true);
      c.classList.add("ios-bar-ghost");
      c.classList.toggle("is-on", scrollY >= threshold());
      return c;
    }
  };
})();
