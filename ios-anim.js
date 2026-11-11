/* ios-anim.js : animations décoratives remises en v43 (objectif 8). Tout le mouvement est en CSS (ios.css, jetons
   --ios-dur-nav, --ios-dur-spring, --ios-dur-fade, --ios-dur-enter, --ios-enter-step, --ios-dur-done, --ios-spring) ;
   ce module ne fait que poser des classes au bon moment :
   - entrée en scène : à chaque changement d'onglet (événement ios:view), .wrap reçoit .ios-enter et ses panneaux et
     cartes entrent décalés ; pas au retour d'une sous-page (le retour a déjà son animation) ;
   - réussite : après l'ajout d'une note, l'animation d'origine (v39) : cercle et coche qui se dessinent au-dessus du
     formulaire flouté, confettis, puis retour à l'Accueil ; un toucher la passe (voir plus bas).
   Rien ne joue avec ?noanim=1 (html.noanim) ni avec le réglage « Réduire les animations ». Pas de chiffres qui défilent. */
(function () {
  "use strict";
  var root = document.documentElement, wrap = document.querySelector(".wrap");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  function canAnim() { return !root.classList.contains("noanim") && !reduce.matches; }
  function ms(name, def) {
    var v = getComputedStyle(root).getPropertyValue(name).trim(), n = parseFloat(v);
    return isFinite(n) ? (/ms$/.test(v) ? n : n * 1000) : def;
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  /* ---------- Entrée en scène des panneaux et des cartes ---------- */
  var enterTimer = null;
  function enter() {
    if (!wrap || !canAnim()) return;
    setTimeout(function () {
      if (window.IOSNav && IOSNav.busy && IOSNav.busy()) return;   // un push/pop vient d'avoir lieu : pas d'entrée par-dessus
      wrap.classList.remove("ios-enter"); void wrap.offsetWidth; wrap.classList.add("ios-enter");
      clearTimeout(enterTimer);
      enterTimer = setTimeout(function () { wrap.classList.remove("ios-enter"); }, ms("--ios-dur-enter", 320) + 12 * ms("--ios-enter-step", 40) + 100);
    }, 0);
  }
  document.addEventListener("ios:view", enter);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", enter); else enter();

  /* ---------- Validation d'une note : l'animation d'origine (v39), remise en v45 à la demande de l'utilisateur ----------
     Au-dessus du formulaire (flouté, classe .glass d'index.html) : un cercle vert se dessine, puis la coche (CSS #done,
     .done-in, keyframes draw/okIn d'index.html) ; l'icône arrive avec un ressort et 22 confettis de six couleurs
     partent en couronne (Motion, via IOSMotion.animate). Texte « Note ajoutée : 5 en Mathématiques ». Après 1,5 s,
     retour à l'Accueil ; un toucher passe l'animation. */
  var CONF = ["green", "blue", "orange", "purple", "pink", "teal"], N = 22, box = null, panel = null, timer = null, after = null;
  function finish() {
    if (!box) return;
    var d = box, next = after; box = null; after = null; clearTimeout(timer);
    d.hidden = true; d.innerHTML = "";
    if (panel) { panel.classList.remove("glass"); panel = null; }
    if (next) next();
  }
  // Renvoie false si rien n'est joué (l'appelant change alors de page tout de suite).
  function done(title, value, name, next) {
    var d = document.getElementById("done");
    if (!canAnim() || !d) return false;
    if (box) finish();
    var add = document.getElementById("view-add");
    panel = add && !add.hidden ? add.querySelector(".panel") : null;
    if (panel) panel.classList.add("glass");
    d.innerHTML = '<div class="done-in"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M7 12.5l3.2 3.2L17 9"/></svg><span>' +
      esc(title) + " : " + esc(value) + (name ? " en " + esc(name) : "") + '</span></div>';
    d.hidden = false; box = d; after = next || null;
    var IM = window.IOSMotion, inner = d.querySelector(".done-in"), svg = d.querySelector("svg");
    if (IM) {
      IM.animate(svg, { scale: [0.4, 1], rotate: [-25, 0] }, { type: "spring", stiffness: 380, damping: 14 });
      for (var i = 0; i < N; i++) {
        var dot = document.createElement("i");
        dot.className = "ios-conf ios-conf-" + CONF[i % CONF.length] + (i % 3 === 0 ? " ios-conf-sq" : "");
        inner.appendChild(dot);
        var a = (Math.PI * 2 * i) / N + Math.random() * 0.4, r = 90 + Math.random() * 70;
        IM.animate(dot, { x: [0, Math.cos(a) * r], y: [0, Math.sin(a) * r + 40], scale: [0, 1.2, 0.6], rotate: [0, Math.random() * 360], opacity: [1, 1, 0] },
          { duration: 1.1, ease: [0.15, 0.85, 0.3, 1], delay: 0.35 });
      }
    }
    timer = setTimeout(finish, ms("--ios-dur-done", 1500));
    return true;
  }
  document.addEventListener("click", function (e) { if (box && box.contains(e.target)) finish(); });

  window.IOSAnim = { done: done, enter: enter };
})();
