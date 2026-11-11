/* Notes : scanner de tests. Ouvre la caméra arrière dans l'app (plein écran, hors de .wrap), repère la feuille dans l'image,
   prend la page toute seule quand elle est bien cadrée et immobile, la redresse et la recadre, puis reste ouvert pour la
   page suivante. Détection et redressement : bibliothèque Scanic (scanic.js, MIT, voir NOTICE-Scanic.txt), chargée à la
   première ouverture seulement ; tout se passe sur l'appareil. Le scanner natif d'Apple n'est pas accessible à une app web.
   Scan.open({ onPage(blob) → Promise, onClose(nbPages), onUnavailable(message) }). La caméra demande https (ou localhost). */
(function () {
  "use strict";
  var MAX_SIDE = 1600, QUALITY = 0.82;
  var EVERY = 160;        // ms entre deux détections
  var STABLE = 7;         // détections stables de suite avant la prise automatique (environ 1,1 s)
  var MOVE = 0.025;       // déplacement maximal d'un coin (part de la diagonale) pour rester « stable »
  var MIN_AREA = 0.18;    // la feuille doit couvrir au moins cette part de l'image
  var COOLDOWN = 2200;    // ms sans prise automatique après une page
  function hap(k) { if (window.FX) FX.haptic(k); }
  function available() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.isSecureContext !== false); }

  var libP = null;
  function lib() {
    if (window.scanic) return Promise.resolve(window.scanic);
    if (!libP) libP = new Promise(function (ok, ko) {
      var s = document.createElement("script"); s.src = "scanic.js";
      s.onload = function () { if (window.scanic) ok(window.scanic); else ko(new Error("scanic")); };
      s.onerror = function () { libP = null; ko(new Error("scanic")); };
      document.head.appendChild(s);
    });
    return libP;
  }

  var KEYS = ["topLeft", "topRight", "bottomRight", "bottomLeft"];
  function area(c) {
    var p = KEYS.map(function (k) { return c[k]; }), a = 0;
    for (var i = 0; i < 4; i++) { var q = p[(i + 1) % 4]; a += p[i].x * q.y - q.x * p[i].y; }
    return Math.abs(a) / 2;
  }
  function moved(a, b) { return Math.max.apply(null, KEYS.map(function (k) { return Math.hypot(a[k].x - b[k].x, a[k].y - b[k].y); })); }
  function toBlob(canvas) {
    var w = canvas.width, h = canvas.height, k = Math.min(1, MAX_SIDE / Math.max(w, h)), out = canvas;
    if (k < 1) {
      out = document.createElement("canvas"); out.width = Math.round(w * k); out.height = Math.round(h * k);
      out.getContext("2d").drawImage(canvas, 0, 0, out.width, out.height);
    }
    return new Promise(function (ok, ko) { out.toBlob(function (b) { if (b) ok(b); else ko(new Error("jpeg")); }, "image/jpeg", QUALITY); });
  }

  var root = null;
  function open(o) {
    o = o || {};
    if (root) return;
    if (!available()) { if (o.onUnavailable) o.onUnavailable(""); return; }
    var stream = null, timer = null, busy = false, taking = false, closed = false, auto = true;
    var last = null, stable = 0, current = null, coolUntil = 0, pages = 0, sc = null;

    root = document.createElement("div"); root.className = "ios-scan"; root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true"); root.setAttribute("aria-label", "Scanner le test");
    root.innerHTML = '<video class="ios-scan-video" playsinline autoplay muted></video>' +
      '<svg class="ios-scan-over" aria-hidden="true"><polygon points=""/></svg><div class="ios-scan-flash" aria-hidden="true"></div>' +
      '<div class="ios-scan-top"><button type="button" class="ios-scan-btn" data-sc="close">Terminé</button><span class="ios-scan-count" aria-live="polite"></span>' +
      '<button type="button" class="ios-scan-btn" data-sc="auto" aria-pressed="true">Auto</button></div>' +
      '<div class="ios-scan-bottom"><p class="ios-scan-hint" role="status">Ouverture de la caméra…</p>' +
      '<button type="button" class="ios-scan-shutter" data-sc="shot" aria-label="Prendre la page"></button></div>';
    document.body.appendChild(root); document.body.classList.add("ios-scan-open");
    var video = root.querySelector("video"), svg = root.querySelector("svg"), poly = root.querySelector("polygon"), hint = root.querySelector(".ios-scan-hint");
    function say(t) { if (hint.textContent !== t) hint.textContent = t; }
    function count() { root.querySelector(".ios-scan-count").textContent = pages ? pages + " page" + (pages > 1 ? "s" : "") : ""; }

    function close(msg) {
      if (closed) return; closed = true;
      clearInterval(timer);
      if (stream) stream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });
      root.remove(); root = null; document.body.classList.remove("ios-scan-open");
      document.removeEventListener("visibilitychange", onHide);
      if (msg != null && !pages && o.onUnavailable) o.onUnavailable(msg);
      else if (o.onClose) o.onClose(pages);
    }
    function onHide() { if (document.visibilityState !== "visible") close(); }   // la caméra ne reste pas allumée en arrière-plan

    // Coins (pixels de la vidéo) → points de l'écran (la vidéo remplit l'écran en « cover »).
    function draw(c) {
      if (!c) { poly.setAttribute("points", ""); return; }
      var cw = root.clientWidth, ch = root.clientHeight, vw = video.videoWidth, vh = video.videoHeight;
      var k = Math.max(cw / vw, ch / vh), dx = (cw - vw * k) / 2, dy = (ch - vh * k) / 2;
      svg.setAttribute("viewBox", "0 0 " + cw + " " + ch);
      poly.setAttribute("points", KEYS.map(function (key) { return (c[key].x * k + dx).toFixed(1) + "," + (c[key].y * k + dy).toFixed(1); }).join(" "));
    }
    function detect() {
      if (busy || taking || closed || !sc || video.readyState < 2 || !video.videoWidth) return;
      busy = true;
      Promise.resolve(sc.scanDocument(video, { mode: "detect" })).then(function (r) {
        if (closed || taking) return;
        var c = r && r.success && r.corners && KEYS.every(function (k) { return r.corners[k]; }) ? r.corners : null;
        if (c && area(c) < MIN_AREA * video.videoWidth * video.videoHeight) c = null;
        current = c; draw(c);
        root.classList.toggle("ios-scan-found", !!c);
        if (!c) { last = null; stable = 0; say("Cadre la feuille entière, sur un fond plus sombre si possible."); return; }
        var diag = Math.hypot(video.videoWidth, video.videoHeight);
        stable = last && moved(c, last) < MOVE * diag ? stable + 1 : 0;
        last = c;
        if (!auto) { say("Feuille repérée : touche le bouton pour la prendre."); return; }
        if (Date.now() < coolUntil) { say("Page ajoutée. Présente la page suivante."); return; }
        say(stable >= 2 ? "Ne bouge plus…" : "Feuille repérée.");
        if (stable >= STABLE) shoot(c);
      }, function () {}).then(function () { busy = false; });
    }
    // Prend l'image courante ; avec des coins, la page est redressée et recadrée, sinon l'image entière est gardée.
    function shoot(corners) {
      if (taking || closed || !video.videoWidth) return;
      taking = true;
      var frame = document.createElement("canvas"); frame.width = video.videoWidth; frame.height = video.videoHeight;
      frame.getContext("2d").drawImage(video, 0, 0);
      root.classList.add("ios-scan-shot"); hap("success");
      setTimeout(function () { if (root) root.classList.remove("ios-scan-shot"); }, 220);
      var p = corners && sc ? Promise.resolve(sc.extractDocument(frame, corners, { output: "canvas" })).then(function (r) { return r && r.success && r.output && r.output.width ? r.output : frame; }, function () { return frame; })
        : Promise.resolve(frame);
      p.then(toBlob).then(function (blob) { return o.onPage ? o.onPage(blob) : null; }).then(function () {
        pages++; count(); coolUntil = Date.now() + COOLDOWN; stable = 0; last = null;
        say("Page ajoutée. Présente la page suivante, ou touche Terminé.");
      }, function (m) { say(typeof m === "string" ? m : "La page n'a pas pu être enregistrée."); hap("error"); })
        .then(function () { taking = false; });
    }

    root.addEventListener("click", function (e) {
      var b = e.target.closest("[data-sc]"); if (!b) return;
      if (b.dataset.sc === "close") close();
      if (b.dataset.sc === "shot") shoot(current);
      if (b.dataset.sc === "auto") { auto = !auto; b.setAttribute("aria-pressed", String(auto)); stable = 0; hap("select"); }
    });
    document.addEventListener("visibilitychange", onHide);

    navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } } }).then(function (s) {
      if (closed) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
      stream = s; video.srcObject = s;
      var pl = video.play(); if (pl && pl.catch) pl.catch(function () {});
      say("Cadre la feuille entière.");
      // La détection démarre quand la bibliothèque est prête ; sans elle, le bouton prend quand même la photo.
      lib().then(function (L) { sc = L; if (L.initialize) return L.initialize(); }).then(function () { if (!closed) timer = setInterval(detect, EVERY); },
        function () { say("Détection automatique indisponible : touche le bouton pour prendre la page."); });
    }, function (err) {
      var denied = err && (err.name === "NotAllowedError" || err.name === "SecurityError");
      close(denied ? "L'accès à la caméra est refusé. Autorise-le dans les réglages de l'appareil, ou choisis une photo." : "La caméra n'est pas disponible. Choisis une photo à la place.");
    });
  }

  window.Scan = { open: open, available: available };
})();
