/* ios-nav.js : push/pop entre le tableau de bord et les écrans Ajouter / Réglages, et retour par balayage du bord gauche.
   Téléphone seulement (≤ 700 px), avec Motion et sans « Réduire les animations » ; sinon rien ne change (bascule instantanée).
   Principe : deux « fantômes » (copies statiques de .wrap) recouvrent la page pendant le mouvement : l'écran qui part et
   l'écran qui arrive. Le vrai DOM bascule tout de suite en dessous, caché par les fantômes. Aucune transformation sur
   body/html (.hx-catch). Push : l'écran qui arrive glisse depuis la droite, l'ancien recule de 30 % sous un voile.
   Pop : l'inverse. Le défilement du tableau de bord est mémorisé et rétabli au retour.
   Retour par balayage : zone de bord de 20 px, suivi 1:1 ; au relâchement on valide si > 50 % ou vitesse > 500 px/s, le
   ressort reprend la vitesse du doigt. Le vrai DOM n'est touché qu'à la validation (bouton « Retour » déclenché). */
(function () {
  "use strict";
  var IM = window.IOSMotion, wrap = document.querySelector(".wrap");
  if (!IM || !wrap) return;
  var mq = window.matchMedia("(max-width: 700px)"), S = IM.SPRINGS, root = document.documentElement;
  function token(name, def) { var v = parseFloat(getComputedStyle(root).getPropertyValue(name)); return isNaN(v) ? def : v; }
  var PARALLAX = token("--ios-nav-parallax", 0.3), DIM = token("--ios-nav-dim-max", 0.1), EDGE = token("--ios-nav-edge", 20);
  var savedDash = 0, plan = null, running = null, suppress = false;

  function phone() { return mq.matches; }
  function el(id) { return document.getElementById(id); }
  function currentView() { return !el("view-add").hidden ? "add" : !el("view-settings").hidden ? "settings" : "dash"; }

  /* Copie statique de .wrap ; `mutate` retouche la copie avant le retrait des identifiants. */
  function snapshot(role, scrollY, mutate) {
    var g = document.createElement("div");
    g.className = "ios-nav-ghost ios-nav-" + role; g.setAttribute("aria-hidden", "true"); g.inert = true;
    var inner = document.createElement("div");
    inner.style.transform = "translate3d(0," + (-scrollY) + "px,0)";
    var c = wrap.cloneNode(true);
    if (mutate) mutate(c);
    [].forEach.call(c.querySelectorAll("[id]"), function (e) { e.removeAttribute("id"); });
    inner.appendChild(c); g.appendChild(inner);
    if (window.IOSTitle && !c.classList.contains("is-sub")) g.appendChild(IOSTitle.ghost(scrollY));   // barre de titre dans l'état de ce défilement
    return g;
  }
  function mount(under, top) {
    var dim = document.createElement("div"); dim.className = "ios-nav-dim";
    under.classList.add("ios-nav-under"); top.classList.add("ios-nav-top");
    document.body.appendChild(under); document.body.appendChild(dim); document.body.appendChild(top);
    return { under: under, dim: dim, top: top };
  }
  function unmount(L) { [L.under, L.dim, L.top].forEach(function (e) { if (e && e.parentNode) e.parentNode.removeChild(e); }); }
  /* p : avancement du mouvement (0 départ, 1 arrivée). push : l'écran du dessus entre ; pop : il sort. */
  function place(L, p, dir) {
    var W = window.innerWidth;
    var topX = dir === "push" ? (1 - p) * W : p * W;
    var underX = -PARALLAX * W * (dir === "push" ? p : 1 - p);
    L.top.style.transform = "translate3d(" + topX + "px,0,0)";
    L.under.style.transform = "translate3d(" + underX + "px,0,0)";
    L.dim.style.opacity = String(DIM * (dir === "push" ? p : 1 - p));
  }
  function finishNow() { if (running) { running.stop(); unmount(running.L); running = null; } }

  /* ---------- Appelés par setView (index.html) ---------- */
  function before(from, to) {
    finishNow(); plan = null;
    if (from === "dash" && to !== "dash") savedDash = window.scrollY;
    var push = from === "dash" && to !== "dash", pop = from && from !== "dash" && to === "dash";
    if (suppress || !phone() || !IM.canAnim() || !(push || pop)) return;
    try { plan = { dir: push ? "push" : "pop", out: snapshot("out", window.scrollY) }; } catch (e) { plan = null; }
  }
  function after(from, to) {
    if (to === "dash" && from && from !== "dash") window.scrollTo(0, savedDash);   // mémoire de la position
    var pl = plan; plan = null;
    if (!pl) return;
    try {
      var inn = snapshot("in", window.scrollY);
      var L = pl.dir === "push" ? mount(pl.out, inn) : mount(inn, pl.out);
      place(L, 0, pl.dir);
      var a = IM.animateProgress(0, 1, S.dialog, {
        onUpdate: function (p) { place(L, p, pl.dir); },
        onDone: function () { unmount(L); running = null; }
      });
      running = { stop: a.stop, L: L };
    } catch (e) { finishNow(); }
  }

  /* ---------- Retour par balayage du bord gauche ---------- */
  var g = null, tr = IM.tracker();
  function canSwipe() {
    return phone() && IM.canAnim() && currentView() !== "dash" && el("sheet").hidden &&
      !document.body.classList.contains("ob-open") && !document.body.classList.contains("gd-open");
  }
  function toDash(c) {
    c.classList.remove("is-sub");
    var d = c.querySelector("#view-dash"), a = c.querySelector("#view-add"), s = c.querySelector("#view-settings");
    if (d) d.hidden = false; if (a) a.hidden = true; if (s) s.hidden = true;
  }
  document.addEventListener("touchstart", function (e) {
    g = null;
    var t = e.touches[0];
    if (e.touches.length !== 1 || t.clientX > EDGE || !canSwipe()) return;
    finishNow();
    g = { x0: t.clientX, y0: t.clientY, mode: null, L: null, from: currentView() };
    tr.reset(); tr.add(e.timeStamp, t.clientX);
  }, { passive: true });
  document.addEventListener("touchmove", function (e) {
    if (!g || g.mode === "off") return;
    var t = e.touches[0], dx = t.clientX - g.x0, dy = t.clientY - g.y0, W = window.innerWidth;
    if (g.mode === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (dx <= 0 || Math.abs(dy) > Math.abs(dx)) { g.mode = "off"; return; }
      try {
        var top = snapshot("out", window.scrollY), under = snapshot("in", savedDash, toDash);
        g.L = mount(under, top); g.mode = "drag"; g.base = t.clientX;
      } catch (x) { g.mode = "off"; return; }
    }
    if (e.cancelable) e.preventDefault();
    tr.add(e.timeStamp, t.clientX);
    g.p = Math.max(0, Math.min(1, (t.clientX - g.base) / W));
    place(g.L, g.p, "pop");
  }, { passive: false });
  function release() {
    var s = g; g = null;
    if (!s || s.mode !== "drag") return;
    var W = window.innerWidth, vx = tr.velocity(), p = s.p || 0;
    var commit = vx < -500 ? false : (p > 0.5 || vx > 500);
    var target = commit ? 1 : 0;
    var a = IM.animateProgress(p, target, S.dialog, {
      velocity: (commit ? vx : -vx) / W,
      onUpdate: function (q) { place(s.L, q, "pop"); },
      onDone: function () {
        running = null;
        if (commit) {
          suppress = true;
          try { el(s.from === "add" ? "back" : "back-settings").click(); } finally { suppress = false; }
        }
        unmount(s.L);
      }
    });
    running = { stop: a.stop, L: s.L };
  }
  document.addEventListener("touchend", release, { passive: true });
  document.addEventListener("touchcancel", release, { passive: true });

  window.IOSNav = { before: before, after: after, active: function () { return suppress || !!plan; } };
})();
