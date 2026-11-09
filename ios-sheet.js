/* ios-sheet.js : la feuille de détail (#sheet) à la iOS, sur téléphone (≤ 700 px).
   Un seul propriétaire de transform sur #sheet-box : ce module. L'app (index.html) l'appelle à l'ouverture
   (IOSSheet.open) et à la fermeture (IOSSheet.close) ; cinq chemins mènent à la fermeture (fond, Fermer, Échap,
   onglet, Ajouter) et tous passent par renderDetail → IOSSheet.close.
   Tirage : depuis toute la feuille. Au début du geste, si le contenu est tout en haut (scrollTop 0), tirer vers le
   bas déplace la feuille 1:1 ; sinon le contenu défile (relais décidé au toucher : iOS ne laisse pas reprendre un
   défilement déjà lancé). Tirer vers le haut sans contenu défilant donne un rebond élastique (c = 0,55).
   Relâchement : fermeture si la position projetée (0,2 s de vitesse) dépasse la moitié de la hauteur ; le ressort
   reprend la vitesse du doigt, sans dépassement.
   Sans Motion, avec ?noanim=1 ou « Réduire les animations » : ouverture et fermeture instantanées, pas de tirage.
   Sur grand écran : la boîte centrée garde son animation CSS (sheetPop) et se ferme sans animation. */
(function () {
  "use strict";
  var IM = window.IOSMotion, sheet = document.getElementById("sheet");
  if (!IM || !sheet) return;
  var box = document.getElementById("sheet-box"), bg = sheet.querySelector(".sheet-bg");
  var mq = window.matchMedia("(max-width: 700px)"), S = IM.SPRINGS;
  var p = 0;            // fraction de la hauteur sortie de l'écran : 0 ouverte, 1 fermée (< 0 : étirée vers le haut)
  var anim = null, closing = false;

  function phone() { return mq.matches; }
  function height() { return box.offsetHeight || 1; }
  function reset() { p = 0; box.style.transform = ""; bg.style.opacity = ""; box.style.willChange = ""; }
  function apply(v) {
    p = v;
    box.style.transform = v ? "translate3d(0," + (v * height()) + "px,0)" : "";
    bg.style.opacity = String(Math.max(0, Math.min(1, 1 - v)));   // voile lié à la position
  }
  function stop() { if (anim) { anim.stop(); anim = null; } }
  function finish() { closing = false; sheet.hidden = true; document.body.style.overflow = ""; reset(); }

  function open() {
    if (!sheet.hidden && !closing) return;            // déjà ouverte : simple nouveau rendu du contenu
    var fresh = sheet.hidden;
    stop(); closing = false;
    sheet.hidden = false; document.body.style.overflow = "hidden";
    if (!phone() || !IM.canAnim()) { reset(); return; }
    if (fresh) apply(1);                              // départ hors écran (mesure après affichage)
    box.style.willChange = "transform";
    anim = IM.animateProgress(p, 0, S.smooth, { onUpdate: apply, onDone: function () { anim = null; reset(); } });
  }

  function close(vel) {
    if (closing || sheet.hidden) return;
    if (!phone() || !IM.canAnim()) { finish(); return; }
    stop(); closing = true;
    box.style.willChange = "transform";
    anim = IM.animateProgress(p, 1, S.smoothShort, { velocity: vel || 0, onUpdate: apply, onDone: function () { anim = null; finish(); } });
  }

  /* ---------- Tirage ---------- */
  var mode = null, startY = 0, startX = 0, base = 0, fromGrab = false, track = IM.tracker(), suppress = false;
  var THRESH = 6;       // px avant de décider entre tirage et défilement

  function setPos(px) {
    // vers le bas : 1:1 ; au-delà du haut : rebond élastique
    var pos = px >= 0 ? px : -IM.rubber(-px, window.innerHeight);
    apply(pos / height());
  }
  function begin(y, x, t, target) {
    if (!phone() || !IM.canAnim() || sheet.hidden) { mode = "off"; return; }
    mode = null; fromGrab = !!(target && target.closest && target.closest(".grab"));
    startY = y; startX = x; track.reset(); track.add(t, y);
    base = p * height();                                // reprise possible pendant une animation
  }
  function move(y, x, t, prevent) {
    if (mode === "off" || mode === "scroll") return;
    var dy = y - startY, dx = x - startX;
    if (mode === null) {
      if (Math.abs(dy) < THRESH && Math.abs(dx) < THRESH) return;
      if (!fromGrab && Math.abs(dx) > Math.abs(dy)) { mode = "scroll"; return; }
      var atTop = box.scrollTop <= 0, scrollable = box.scrollHeight > box.clientHeight + 1;
      if (fromGrab || (dy > 0 && atTop) || (dy < 0 && atTop && !scrollable) || p !== 0) {
        mode = "drag"; stop(); closing = false;
        box.style.willChange = "transform";
        startY = y; startX = x; track.reset();           // le tirage part de 0 à cet instant
      } else { mode = "scroll"; return; }
    }
    prevent();
    track.add(t, y);
    setPos(base + (y - startY));
  }
  function end(t) {
    var m = mode; mode = null;
    if (m !== "drag") return;
    suppress = true; setTimeout(function () { suppress = false; }, 0);
    var h = height(), pos = p * h, vy = track.velocity();           // px/s, positif vers le bas
    if (pos > 0 && IM.project(pos, vy) > h * 0.5) {
      closing = true;
      stop();
      anim = IM.animateProgress(p, 1, S.smoothShort, { velocity: vy / h, onUpdate: apply, onDone: function () { anim = null; finish(); } });
    } else {
      anim = IM.animateProgress(p, 0, S.smoothShort, { velocity: -vy / h, onUpdate: apply, onDone: function () { anim = null; reset(); } });
    }
  }

  // Doigt : les événements « touch » permettent d'annuler le défilement natif quand on tire la feuille.
  box.addEventListener("touchstart", function (e) {
    var t = e.touches[0]; begin(t.clientY, t.clientX, e.timeStamp, e.target);
  }, { passive: true });
  box.addEventListener("touchmove", function (e) {
    var t = e.touches[0];
    move(t.clientY, t.clientX, e.timeStamp, function () { if (e.cancelable) e.preventDefault(); });
  }, { passive: false });
  box.addEventListener("touchend", function (e) { end(e.timeStamp); }, { passive: true });
  box.addEventListener("touchcancel", function (e) { end(e.timeStamp); }, { passive: true });
  // Souris (bureau étroit, tests).
  var mouseDown = false;
  box.addEventListener("pointerdown", function (e) {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    mouseDown = true; begin(e.clientY, e.clientX, e.timeStamp, e.target);
    try { box.setPointerCapture(e.pointerId); } catch (x) {}
  });
  box.addEventListener("pointermove", function (e) {
    if (mouseDown && e.pointerType === "mouse") move(e.clientY, e.clientX, e.timeStamp, function () {});
  });
  function mouseUp(e) { if (mouseDown && e.pointerType === "mouse") { mouseDown = false; end(e.timeStamp); } }
  box.addEventListener("pointerup", mouseUp);
  box.addEventListener("pointercancel", mouseUp);
  // Un tirage à la souris ne doit pas déclencher de clic en fin de geste.
  box.addEventListener("click", function (e) { if (suppress) { e.stopPropagation(); e.preventDefault(); } }, true);

  window.IOSSheet = { open: open, close: close };
})();
