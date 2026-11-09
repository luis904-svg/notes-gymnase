/* ios-motion.js : vocabulaire de mouvement iOS (ressorts d'Apple, vitesse du doigt, rebond élastique).
   Chargé après motion.js et fx.js. Règles (voir design/DESIGN-ios.md) :
   - ressorts toujours en paramètres physiques explicites, masse 1 (la conversion durée/rebond de Motion 11.11.17 n'est pas celle d'Apple) ;
   - vitesse de relâchement : px/s du doigt, rapportée à la distance parcourue (progression 0→1), positive vers la cible ;
   - on anime une progression sur le fil principal (pas de voie accélérée), le module appelant écrit transform ;
   - rien n'est animé avec ?noanim=1 ou « Réduire les animations ». */
(function () {
  "use strict";
  var M = /[?&]noanim=1/.test(location.search) ? null : (window.Motion || null);
  // ?noanim=1 : en plus de Motion, on coupe les animations et transitions CSS (voir ios.css, html.noanim).
  if (!M && /[?&]noanim=1/.test(location.search)) document.documentElement.classList.add("noanim");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  function canAnim() { return !!M && !!M.spring && !reduce.matches; }

  /* (durée en s, rebond) d'Apple -> paramètres physiques (masse 1). Valable pour rebond >= 0. */
  function appleSpring(d, b) {
    var w = 2 * Math.PI / d;
    return { stiffness: w * w, damping: 4 * Math.PI * (1 - b) / d, mass: 1 };
  }

  /* Ressorts du rapport « Interactions et animations iOS 27 », section 2.1. */
  var SPRINGS = {
    smooth: appleSpring(0.5, 0),            // officiel : preset .smooth
    snappy: appleSpring(0.5, 0.15),         // officiel : preset .snappy
    bouncy: appleSpring(0.5, 0.3),          // officiel : preset .bouncy
    standard: appleSpring(0.55, 0),         // officiel : .default depuis iOS 17
    interactive: appleSpring(0.15, 0.14),   // officiel (0,15 s / amortissement 0,86)
    snappyShort: appleSpring(0.35, 0.15),   // à choisir
    snappyFast: appleSpring(0.3, 0.15),     // à choisir
    smoothShort: appleSpring(0.35, 0),      // à choisir : sortie de feuille, retour de page
    dialog: { stiffness: 522.35, damping: 45.71, mass: 1 } // communauté : ressort de dialogue UIKit
  };

  /* Anime un nombre de `from` à `to` avec un ressort (SPRINGS.x), avec une vitesse initiale en unités/s
     positive vers la cible. Pilote le fil principal. Rend { stop() } ; sans animation, saute à `to`. */
  function animateProgress(from, to, spring, opt) {
    opt = opt || {};
    var onUpdate = opt.onUpdate || function () {}, onDone = opt.onDone || function () {};
    if (!canAnim() || from === to) { onUpdate(to); onDone(); return { stop: function () {} }; }
    var gen = M.spring(Object.assign({ keyframes: [from, to], velocity: opt.velocity || 0, restDelta: 0.001, restSpeed: 0.02 }, spring));
    var t0 = null, id = 0, stopped = false, last = from;
    function frame(now) {
      if (stopped) return;
      if (t0 === null) t0 = now;
      var r = gen.next(now - t0);
      last = r.value;
      if (r.done) { onUpdate(to); last = to; onDone(); return; }
      onUpdate(last);
      id = window.requestAnimationFrame(frame);
    }
    id = window.requestAnimationFrame(frame);
    return { stop: function () { stopped = true; if (id) window.cancelAnimationFrame(id); }, current: function () { return last; } };
  }

  /* Vitesse du doigt (px/s) sur les ~100 derniers ms. */
  function tracker() {
    var s = [];
    return {
      reset: function () { s = []; },
      add: function (t, y) { s.push([t, y]); while (s.length > 2 && t - s[0][0] > 100) s.shift(); },
      velocity: function () {
        if (s.length < 2) return 0;
        var a = s[0], b = s[s.length - 1], dt = b[0] - a[0];
        return dt > 0 ? (b[1] - a[1]) / dt * 1000 : 0;
      }
    };
  }

  /* Rebond élastique d'UIScrollView : x = déplacement brut, d = dimension de la vue, c = 0,55 (communauté). */
  function rubber(x, d, c) { c = c == null ? 0.55 : c; return (1 - 1 / (x * c / d + 1)) * d; }

  /* Position d'arrivée projetée d'un geste relâché (secondes de vitesse conservées : 0,2 s, à choisir). */
  function project(pos, vel, secs) { return pos + vel * (secs == null ? 0.2 : secs); }

  window.IOSMotion = {
    canAnim: canAnim, appleSpring: appleSpring, SPRINGS: SPRINGS,
    animateProgress: animateProgress, tracker: tracker, rubber: rubber, project: project
  };
})();
