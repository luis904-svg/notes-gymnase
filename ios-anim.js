/* ios-anim.js : animations décoratives remises en v43 (objectif 8). Tout le mouvement est en CSS (ios.css, jetons
   --ios-dur-nav, --ios-dur-spring, --ios-dur-fade, --ios-dur-enter, --ios-enter-step, --ios-dur-done, --ios-spring) ;
   ce module ne fait que poser des classes au bon moment :
   - entrée en scène : à chaque changement d'onglet (événement ios:view), .wrap reçoit .ios-enter et ses panneaux et
     cartes entrent décalés ; pas au retour d'une sous-page (le retour a déjà son animation) ;
   - réussite : après l'ajout d'une note, un écran plein (hors de .wrap) montre la coche, la note et des confettis,
     puis revient à l'Accueil ; un toucher le passe.
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
      if (wrap.classList.contains("ios-nav-pop") || wrap.classList.contains("ios-nav-push")) return;
      wrap.classList.remove("ios-enter"); void wrap.offsetWidth; wrap.classList.add("ios-enter");
      clearTimeout(enterTimer);
      enterTimer = setTimeout(function () { wrap.classList.remove("ios-enter"); }, ms("--ios-dur-enter", 320) + 12 * ms("--ios-enter-step", 40) + 100);
    }, 0);
  }
  document.addEventListener("ios:view", enter);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", enter); else enter();

  /* ---------- Écran de réussite et confettis ---------- */
  var COLORS = ["blue", "green", "orange", "red"], N = 36, layer = null, timer = null, after = null;
  function finish() {
    if (!layer) return;
    var l = layer, next = after; layer = null; after = null; clearTimeout(timer);
    l.classList.add("ios-done-out");
    setTimeout(function () { l.remove(); }, ms("--ios-dur-fade", 200));
    if (next) next();
  }
  // Renvoie false si rien n'est joué (l'appelant change alors de page tout de suite).
  function done(title, value, name, next) {
    if (!canAnim() || !document.body) return false;
    if (layer) finish();
    var bits = "";
    for (var i = 0; i < N; i++) {
      var a = Math.random() * Math.PI * 2, d = 90 + Math.random() * 170;
      bits += '<i class="ios-confetti ios-confetti-' + COLORS[i % COLORS.length] + (i % 3 === 0 ? " ios-confetti-sq" : "") + '" style="--dx:' + Math.round(Math.cos(a) * d) + "px;--dy:" + Math.round(Math.sin(a) * d - 60) +
        "px;--rot:" + Math.round(Math.random() * 720 - 360) + "deg;animation-delay:" + Math.round(Math.random() * 120) + 'ms"></i>';
    }
    layer = document.createElement("div"); layer.className = "ios-done"; layer.setAttribute("role", "status");
    layer.innerHTML = '<div class="ios-done-in"><span class="ios-done-burst" aria-hidden="true">' + bits + '</span>' + (window.Icons ? Icons.svg("done", "ios-done-ic") : "") +
      '<p class="ios-done-t">' + esc(title) + '</p><p class="ios-done-s">' + esc(value) + (name ? " en " + esc(name) : "") + '</p></div>';
    layer.addEventListener("click", finish);
    after = next || null;
    document.body.appendChild(layer);
    timer = setTimeout(finish, ms("--ios-dur-done", 1100));
    return true;
  }

  window.IOSAnim = { done: done, enter: enter };
})();
