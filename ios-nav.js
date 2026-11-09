/* ios-nav.js : navigation « push / pop » à la iOS et retour par balayage du bord gauche (téléphone, ≤ 700 px).
   Les onglets (Accueil, Ajouter, Réglages) changent sans animation de page, comme dans une app iOS. Le mouvement ne sert
   qu'aux sous-pages : IOSNav.run("push" | "pop", mutate) joue le ressort autour d'un changement de DOM fait par `mutate`.
   Principe : deux « fantômes » (copies statiques de .wrap) recouvrent la page pendant le mouvement : l'écran qui part et
   l'écran qui arrive. Le vrai DOM bascule tout de suite en dessous, caché par les fantômes. Les copies gardent leurs
   identifiants (les règles CSS par #id doivent s'appliquer aussi à elles) ; les vrais éléments précèdent les copies dans
   le document, donc getElementById / querySelector trouvent toujours les vrais. Aucune transformation sur body/html (.hx-catch).
   Push : l'écran qui arrive glisse depuis la droite, l'ancien recule de 30 % sous un voile. Pop : l'inverse.
   Retour par balayage : zone de bord de 20 px, suivi 1:1 ; au relâchement on valide si > 50 % ou vitesse > 500 px/s, le
   ressort reprend la vitesse du doigt. Le vrai DOM n'est touché qu'à la validation (provider.go()).
   Un « provider » (IOSNav.setBack) décrit la page qu'on peut quitter par balayage :
   { can(): bool, parent(clone): retouche la copie pour montrer la page du dessous, parentScroll(): défilement de cette page,
     parentBar(): {title, on, back} état de la barre de titre de cette page, go(): vrai retour }. */
(function () {
  "use strict";
  var IM = window.IOSMotion, wrap = document.querySelector(".wrap");
  if (!IM || !wrap) return;
  var mq = window.matchMedia("(max-width: 700px)"), S = IM.SPRINGS, root = document.documentElement;
  function token(name, def) { var v = parseFloat(getComputedStyle(root).getPropertyValue(name)); return isNaN(v) ? def : v; }
  var PARALLAX = token("--ios-nav-parallax", 0.3), DIM = token("--ios-nav-dim-max", 0.1), EDGE = token("--ios-nav-edge", 20);
  var running = null, suppress = false, provider = null;

  function phone() { return mq.matches; }
  function el(id) { return document.getElementById(id); }

  /* Copie statique de .wrap ; `mutate` retouche la copie ; `bar` décrit la barre de titre à y mettre. */
  function snapshot(role, scrollY, mutate, bar) {
    var g = document.createElement("div");
    g.className = "ios-nav-ghost ios-nav-" + role; g.setAttribute("aria-hidden", "true"); g.inert = true;
    var inner = document.createElement("div");
    inner.style.transform = "translate3d(0," + (-scrollY) + "px,0)";
    var c = wrap.cloneNode(true);
    if (mutate) mutate(c);
    inner.appendChild(c); g.appendChild(inner);
    if (window.IOSTitle) g.appendChild(IOSTitle.ghost(scrollY, bar));   // barre de titre dans l'état voulu
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

  /* ---------- Push / pop d'une sous-page ---------- */
  function run(dir, mutate) {
    finishNow();
    var out = null;
    if (!suppress && phone() && IM.canAnim()) { try { out = snapshot("out", window.scrollY); } catch (e) { out = null; } }
    mutate();
    if (!out) return;
    try {
      var inn = snapshot("in", window.scrollY);
      var L = dir === "push" ? mount(out, inn) : mount(inn, out);
      place(L, 0, dir);
      var a = IM.animateProgress(0, 1, S.dialog, {
        onUpdate: function (p) { place(L, p, dir); },
        onDone: function () { unmount(L); running = null; }
      });
      running = { stop: a.stop, L: L };
    } catch (e) { finishNow(); }
  }

  /* ---------- Appelés par setView (index.html) : les onglets changent sans mouvement ---------- */
  function before() { finishNow(); }
  function after(from, to) { document.dispatchEvent(new CustomEvent("ios:view", { detail: to })); }

  /* ---------- Retour par balayage du bord gauche ---------- */
  var g = null, tr = IM.tracker();
  function canSwipe() {
    return phone() && IM.canAnim() && provider && provider.can() && el("sheet").hidden &&
      !document.body.classList.contains("ob-open") && !document.body.classList.contains("gd-open");
  }
  document.addEventListener("touchstart", function (e) {
    g = null;
    var t = e.touches[0];
    if (e.touches.length !== 1 || t.clientX > EDGE || !canSwipe()) return;
    finishNow();
    g = { x0: t.clientX, y0: t.clientY, mode: null, L: null, pv: provider };
    tr.reset(); tr.add(e.timeStamp, t.clientX);
  }, { passive: true });
  document.addEventListener("touchmove", function (e) {
    if (!g || g.mode === "off") return;
    var t = e.touches[0], dx = t.clientX - g.x0, dy = t.clientY - g.y0, W = window.innerWidth;
    if (g.mode === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (dx <= 0 || Math.abs(dy) > Math.abs(dx)) { g.mode = "off"; return; }
      try {
        var top = snapshot("out", window.scrollY), under = snapshot("in", g.pv.parentScroll(), g.pv.parent, g.pv.parentBar());
        g.L = mount(under, top); g.mode = "drag"; g.base = t.clientX;
      } catch (x) { g.mode = "off"; return; }
    }
    if (e.cancelable) e.preventDefault();
    tr.add(e.timeStamp, t.clientX);
    g.p = Math.max(0, Math.min(1, (t.clientX - g.base) / W));
    place(g.L, g.p, "pop");
  }, { passive: false });
  function release(e) {
    var s = g; g = null;
    if (!s || s.mode !== "drag") return;
    var W = window.innerWidth, vx = tr.velocity(e && e.timeStamp), p = s.p || 0;
    var commit = vx < -500 ? false : (p > 0.5 || vx > 500);
    var target = commit ? 1 : 0;
    var a = IM.animateProgress(p, target, S.dialog, {
      velocity: (commit ? vx : -vx) / W,
      onUpdate: function (q) { place(s.L, q, "pop"); },
      onDone: function () {
        running = null;
        if (commit) {
          suppress = true;
          try { s.pv.go(); } finally { suppress = false; }
        }
        unmount(s.L);
      }
    });
    running = { stop: a.stop, L: s.L };
  }
  document.addEventListener("touchend", release, { passive: true });
  document.addEventListener("touchcancel", release, { passive: true });

  window.IOSNav = {
    before: before, after: after, run: run,
    setBack: function (p) { provider = p || null; },
    active: function () { return suppress; }
  };
})();
