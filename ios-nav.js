/* ios-nav.js : navigation des sous-pages (téléphone, ≤ 700 px). Version simple : pas de copie de la page, pas de ressort.
   - Les onglets (Accueil, Ajouter, Réglages) changent sans animation.
   - IOSNav.run("push" | "pop", mutate) : fait le changement de DOM, puis la page qui apparaît entre par une courte
     animation CSS (classes .ios-nav-push / .ios-nav-pop, voir ios.css). Rien ne recouvre la page : un toucher pendant
     l'animation arrive toujours au bon bouton.
   - Retour par balayage : un glissement vers la droite qui part du bord gauche (zone --ios-nav-edge) fait le même retour
     que le chevron. Le « provider » (IOSNav.setBack) décrit la page qu'on peut quitter : { can(): bool, go(): retour }.
   Pas d'animation avec ?noanim=1 ou « Réduire les animations ». */
(function () {
  "use strict";
  var mq = window.matchMedia("(max-width: 700px)"), reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var root = document.documentElement;
  var EDGE = parseFloat(getComputedStyle(root).getPropertyValue("--ios-nav-edge")) || 24;
  var provider = null, animated = null;

  function phone() { return mq.matches; }
  function canAnim() { return !root.classList.contains("noanim") && !reduce.matches; }
  function el(id) { return document.getElementById(id); }

  /* On anime tout le contenu (.wrap) : en-tête, page de Réglages ou détail d'une matière. La barre de titre (.ios-bar),
     la barre du bas et les fenêtres sont hors de .wrap et ne bougent pas. Aucun élément fixe n'est dans .wrap. */
  var wrap = document.querySelector(".wrap");
  function clear() { if (animated) { animated.classList.remove("ios-nav-push", "ios-nav-pop"); animated = null; } }

  function run(dir, mutate) {
    clear();
    mutate();
    if (!phone() || !canAnim()) return;
    var n = wrap; if (!n) return;
    void n.offsetWidth;                       // relance l'animation même si la classe vient d'être retirée
    n.classList.add(dir === "pop" ? "ios-nav-pop" : "ios-nav-push");
    animated = n;
    setTimeout(function () { if (animated === n) clear(); }, 900);   // si animationend n'arrive pas (app en arrière-plan)
  }
  document.addEventListener("animationend", function (e) { if (e.target === animated) clear(); });

  /* ---------- Appelés par setView (index.html) ---------- */
  function before() { clear(); }
  function after(from, to) { document.dispatchEvent(new CustomEvent("ios:view", { detail: to })); }

  /* ---------- Retour par balayage du bord gauche ---------- */
  var g = null;
  function canSwipe() {
    return phone() && provider && provider.can() && el("sheet").hidden &&
      !document.body.classList.contains("ob-open") && !document.body.classList.contains("gd-open");
  }
  document.addEventListener("touchstart", function (e) {
    g = null;
    var t = e.touches[0];
    if (e.touches.length !== 1 || t.clientX > EDGE || !canSwipe()) return;
    g = { x0: t.clientX, y0: t.clientY, pv: provider };
  }, { passive: true });
  document.addEventListener("touchmove", function (e) {
    if (!g) return;
    var t = e.touches[0], dx = t.clientX - g.x0, dy = t.clientY - g.y0;
    if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { g = null; return; }   // défilement vertical : on laisse faire
    if (dx > 60) { var pv = g.pv; g = null; if (pv === provider && pv.can()) pv.go(); }
  }, { passive: true });
  function end() { g = null; }
  document.addEventListener("touchend", end, { passive: true });
  document.addEventListener("touchcancel", end, { passive: true });

  window.IOSNav = {
    before: before, after: after, run: run,
    setBack: function (p) { provider = p || null; }
  };
})();
