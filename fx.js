/* Notes — couche app : haptique, indicateurs, sauvegarde, installation.
   Aucune animation décorative : les écrans et les chiffres s'affichent tout de suite. */
(function () {
  "use strict";
  function $(s, r) { return (r || document).querySelector(s); }
  // .fx : les pastilles .ind remplacent le fond des onglets et segments actifs (fx.css).
  document.documentElement.classList.add("fx");
  // ?noanim=1 : plus aucune animation ni transition CSS (voir ios.css, html.noanim).
  if (/[?&]noanim=1/.test(location.search)) document.documentElement.classList.add("noanim");

  /* ---------- Haptique ----------
     Android : API Vibration. iPhone (iOS 18+) : Safari n'a pas d'API, mais basculer un
     <input type="checkbox" switch> déclenche le « tic » système. On clique donc un
     interrupteur invisible, toujours en réponse à un geste de l'utilisateur. */
  var HK = "notes2m01.haptics";
  var hapticsOn = true;
  try { hapticsOn = localStorage.getItem(HK) !== "off"; } catch (e) {}
  var IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  // Méthode éprouvée (même principe que la librairie ios-haptics) : un interrupteur neuf à chaque tic,
  // caché, ajouté au <head>, cliqué via son libellé puis retiré.
  function tick() {
    var l = document.createElement("label"); l.className = "hx"; l.setAttribute("aria-hidden", "true"); l.style.display = "none";
    var i = document.createElement("input"); i.type = "checkbox"; i.setAttribute("switch", "");
    l.appendChild(i); document.head.appendChild(l);
    try { l.click(); } finally { document.head.removeChild(l); }
  }
  var VIB = { tap: 8, select: 6, success: [12, 90, 20], warn: [20, 70, 20], error: [30, 60, 30, 60, 30], heavy: 30 };
  var TICKS = { tap: 1, select: 1, success: 2, warn: 2, error: 3, heavy: 1 };
  var lastTick = 0;
  function haptic(kind) {
    if (!hapticsOn) return;
    kind = kind || "tap";
    // Un seul tic par geste : un tic simple juste après un autre est ignoré (les motifs longs passent toujours).
    var now = Date.now(), simple = kind === "tap" || kind === "select";
    if (simple && now - lastTick < 90) return;
    lastTick = now;
    // Sur iPhone, toujours l'interrupteur : navigator.vibrate peut exister mais ne fait rien.
    if (!IOS && navigator.vibrate) { try { navigator.vibrate(VIB[kind] || 8); } catch (e) {} return; }
    var n = TICKS[kind] || 1;
    tick();
    for (var k = 1; k < n; k++) setTimeout(tick, k * 120);
  }

  /* Une vibration à chaque interaction. Exceptions : taper dans un champ texte (le tic volerait le
     clavier ; utiliser le retour clavier d'iOS) et les interrupteurs natifs, qui vibrent déjà seuls. */
  var TAPPABLE = "button, a[href], [data-subj], [data-close], summary, .grab, .bars .bar, .ob-row, input[type=checkbox]:not([switch]), input[type=radio]";
  document.addEventListener("click", function (e) {
    if (e.target.closest(".hx, .hx-catch")) return;
    if (catchTarget && !forwarded) release(); // le clic est arrivé directement au bouton
    var t = e.target.closest(TAPPABLE);
    if (!t || t.disabled) return;
    if (t.matches("[data-del]") || t.type === "submit") return; // retours dédiés (avertissement, réussite, erreur)
    haptic(t.matches("[data-tab], [data-period], [data-coef], .ob-row") ? "select" : "tap");
  }, true);
  // Valeur validée dans une liste, une date ou un nombre (au moment où le champ se ferme).
  document.addEventListener("change", function (e) {
    var t = e.target;
    if (t.matches("select, input[type=date], input[type=number], input[type=text]")) haptic("select");
  }, true);
  // Feuille de détail relâchée : petit tic quand elle revient en place.
  document.addEventListener("pointerup", function (e) { if (e.target.closest && e.target.closest(".grab")) haptic("tap"); }, true);

  /* ---------- iPhone : interrupteur sous le doigt ----------
     Safari ne fait vibrer qu'un vrai interrupteur touché par l'utilisateur (un clic par script ne
     suffit pas). Au moment où le doigt se pose sur un bouton, on glisse donc un interrupteur
     invisible exactement sous le doigt : c'est lui que le doigt touche (vraie vibration iOS), puis
     on transmet l'appui au bouton. Si le doigt glisse (défilement), on retire l'interrupteur. */
  var HXTEST = /[?&]hxtest=1/.test(location.search);
  /* L'interrupteur reste toujours affiché (coin haut gauche, inerte). Le faire apparaître au moment
     de l'appui faisait croire à iOS que la page changeait sous le doigt : il prenait le 1er appui pour
     un survol et il fallait toucher deux fois. On ne fait donc que le déplacer et le rendre touchable. */
  var catcher = null, catchTarget = null, catchTimer = null, upTimer = null, forwarded = true, x0 = 0, y0 = 0;
  function park() {
    if (!catcher) return;
    catcher.style.pointerEvents = "none";
    catcher.style.left = "0px"; catcher.style.top = "0px";
  }
  function release() {
    park();
    if (catchTarget) catchTarget.classList.remove("is-pressed");
    catchTarget = null; clearTimeout(catchTimer); clearTimeout(upTimer);
  }
  function forward() {
    if (forwarded || !catchTarget) return;
    forwarded = true;
    var t = catchTarget;
    release();
    lastTick = Date.now(); // la vibration vient de l'interrupteur : pas de second tic
    if (typeof t.click === "function") t.click();
    else t.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  }
  function makeCatcher() {
    var l = document.createElement("label"); l.className = "hx-catch"; l.setAttribute("aria-hidden", "true");
    var i = document.createElement("input"); i.type = "checkbox"; i.setAttribute("switch", ""); i.tabIndex = -1;
    l.appendChild(i); document.body.appendChild(l);
    // Le toucher active l'interrupteur (vibration), puis on relaie l'appui une seule fois.
    l.addEventListener("click", function (e) { e.stopPropagation(); setTimeout(forward, 0); });
    return l;
  }
  if (IOS || HXTEST) {
    catcher = makeCatcher(); park();
    document.addEventListener("pointerdown", function (e) {
      if (!hapticsOn || (e.pointerType !== "touch" && !HXTEST)) return;
      if (e.target.closest(".hx, .hx-catch")) return;
      var t = e.target.closest(TAPPABLE);
      if (!t || t.disabled || t.matches("input, select, textarea, label")) return;
      catchTarget = t; forwarded = false; x0 = e.clientX; y0 = e.clientY;
      t.classList.add("is-pressed");
      catcher.style.left = (e.clientX - 32) + "px";
      catcher.style.top = (e.clientY - 32) + "px";
      catcher.style.pointerEvents = "auto";
      clearTimeout(catchTimer); catchTimer = setTimeout(release, 1500);
    }, true);
    document.addEventListener("pointermove", function (e) {
      if (catchTarget && Math.abs(e.clientX - x0) + Math.abs(e.clientY - y0) > 14) release();
    }, true);
    // Filet de sécurité : si iOS n'envoie pas le clic à l'interrupteur, l'appui passe quand même (sans vibration).
    document.addEventListener("pointerup", function () {
      if (catchTarget && !forwarded) { clearTimeout(upTimer); upTimer = setTimeout(forward, 450); }
    }, true);
    document.addEventListener("pointercancel", release, true);
    window.addEventListener("scroll", function () { if (catchTarget) release(); }, { passive: true, capture: true });
  }

  /* ---------- Pastilles des onglets et du sélecteur de période ----------
     Placées sans animation (le segment glisse par une simple transition CSS, voir ios.css). */
  function indicator(container, activeSel) {
    if (!container) return function () {};
    var ind = document.createElement("span"); ind.className = "ind"; ind.setAttribute("aria-hidden", "true");
    container.insertBefore(ind, container.firstChild);
    return function place() {
      var b = $(activeSel, container);
      if (!b || !b.offsetWidth) { ind.style.opacity = "0"; return; }
      ind.style.left = b.offsetLeft + "px"; ind.style.width = b.offsetWidth + "px"; ind.style.opacity = "1";
    };
  }
  var placeTab = indicator($("#tabbar"), '[aria-current="page"]');
  var placeSeg = indicator($(".seg"), '[aria-pressed="true"]');
  window.addEventListener("resize", function () { placeTab(); placeSeg(); });

  /* ---------- Barre du bas : appui long, la pastille suit le doigt ----------
     Appui court : rien ne change (clic habituel). Appui long (250 ms sans bouger) : la pastille grossit un peu et suit le
     doigt ; la page ne change qu'au relâchement, sur l'onglet le plus proche. Doigt remonté de 60 px au-dessus de la
     barre au relâchement : annulation. Le zoom ne touche que la pastille (jetons --ios-scrub-scale, --ios-dur-scrub). */
  (function () {
    var bar = $("#tabbar"), ind = bar && $(".ind", bar);
    if (!bar || !ind) return;
    var HOLD = 250, SLOP = 10, CANCEL = 60;
    var timer = null, pid = null, sx = 0, sy = 0, scrub = false, over = null, swallowUntil = 0, own = false;
    function tabs() { return [].slice.call(bar.querySelectorAll("[data-tab]")).filter(function (b) { return b.offsetWidth; }); }
    function nearest(x) {
      var best = null, d = Infinity;
      tabs().forEach(function (b) { var r = b.getBoundingClientRect(), k = Math.abs(x - (r.left + r.width / 2)); if (k < d) { d = k; best = b; } });
      return best;
    }
    function follow(x) {
      var r = bar.getBoundingClientRect(), w = ind.offsetWidth, list = tabs();
      var min = list.length ? list[0].offsetLeft : 0, max = list.length ? list[list.length - 1].offsetLeft : r.width - w;
      ind.style.left = Math.min(max, Math.max(min, x - r.left - w / 2)) + "px";
      var b = nearest(x);
      if (b !== over) { if (over) haptic("select"); over = b; }
    }
    function settle() {
      bar.classList.remove("ios-scrub"); bar.classList.add("ios-scrub-settle");
      setTimeout(function () { bar.classList.remove("ios-scrub-settle"); }, 400);
    }
    function stop() { clearTimeout(timer); timer = null; pid = null; scrub = false; over = null; }
    bar.addEventListener("pointerdown", function (e) {
      if (pid != null || (e.pointerType === "mouse" && e.button !== 0)) return;
      pid = e.pointerId; sx = e.clientX; sy = e.clientY;
      clearTimeout(timer);
      timer = setTimeout(function () {
        timer = null; if (pid == null) return;
        scrub = true; over = null;
        release();                                   // l'interrupteur haptique ne doit pas relayer ce geste comme un clic
        try { bar.setPointerCapture(pid); } catch (x) {}
        bar.classList.remove("ios-scrub-settle"); bar.classList.add("ios-scrub");
        haptic("select"); follow(sx);
      }, HOLD);
    });
    bar.addEventListener("pointermove", function (e) {
      if (e.pointerId !== pid) return;
      if (scrub) { follow(e.clientX); return; }
      if (timer && Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > SLOP) { clearTimeout(timer); timer = null; }
    });
    function end(e, cancelled) {
      if (e.pointerId !== pid) return;
      var was = scrub, target = was && !cancelled && e.clientY >= bar.getBoundingClientRect().top - CANCEL ? nearest(e.clientX) : null;
      stop();
      if (!was) return;
      swallowUntil = Date.now() + 500;               // le clic natif qui suit le relâchement est ignoré
      settle();
      if (target && target.getAttribute("aria-current") !== "page") { own = true; try { target.click(); } finally { own = false; } }
      else placeTab();                               // annulation ou même onglet : la pastille revient
    }
    bar.addEventListener("pointerup", function (e) { end(e, false); });
    bar.addEventListener("pointercancel", function (e) { end(e, true); });
    bar.addEventListener("click", function (e) { if (!own && Date.now() < swallowUntil) { e.preventDefault(); e.stopPropagation(); } }, true);
    bar.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  })();

  /* ---------- Téléphone en paysage : écran « Tourne ton téléphone » ----------
     L'app est faite pour la verticale. L'écran est toujours dans la page (hors de .wrap) ; ios.css ne l'affiche que sur un
     téléphone couché (paysage, peu de hauteur, écran tactile). Aucun script ne suit l'orientation. */
  (function () {
    var r = document.createElement("div"); r.className = "ios-rotate"; r.setAttribute("role", "alert");
    r.innerHTML = window.Icons.svg("phone") +
      '<p class="ios-rotate-t">Tourne ton téléphone</p><p class="ios-rotate-s">Notes s\'utilise à la verticale.</p>';
    document.body.appendChild(r);
  })();

  /* ---------- Erreur dans le formulaire : vibration seulement ---------- */
  var msg = $("#f-msg");
  if (msg && window.MutationObserver) {
    new MutationObserver(function () { if (msg.textContent.trim()) haptic("error"); })
      .observe(msg, { childList: true, characterData: true, subtree: true });
  }

  /* ---------- Défilement : filet sous l'en-tête ---------- */
  var head = $("header.top");
  function onScroll() { if (head) head.classList.toggle("scrolled", window.scrollY > 8); }
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();

  /* ---------- Sauvegarde : exporter / importer ---------- */
  function stamp() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function say(t, bad) { var o = $("#bk-msg"); if (!o) return; o.textContent = t; o.style.color = bad ? "var(--crit)" : ""; }
  function exportData() {
    if (!window.NotesApp) return;
    var json = JSON.stringify({ app: "notes2m01", version: 1, exported: new Date().toISOString(), state: window.NotesApp.get() }, null, 2);
    var name = "notes-sauvegarde-" + stamp() + ".json";
    var file = null;
    try { file = new File([json], name, { type: "application/json" }); } catch (e) {}
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: "Sauvegarde Notes" }).then(function () { say("Sauvegarde partagée."); }, function () {});
    } else {
      var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([json], { type: "application/json" })); a.download = name;
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      say("Fichier " + name + " téléchargé.");
    }
  }
  function importFile(f) {
    var r = new FileReader();
    r.onload = function () {
      var obj; try { obj = JSON.parse(r.result); } catch (e) { haptic("error"); say("Ce fichier n'est pas une sauvegarde valide.", true); return; }
      var st = obj && obj.state ? obj.state : (obj && obj.data ? obj.data : obj);
      if (!st || !Array.isArray(st.grades)) { haptic("error"); say("Aucune note trouvée dans ce fichier.", true); return; }
      haptic("warn");
      if (!window.confirm("Remplacer les notes de cet appareil par les " + st.grades.length + " notes du fichier ?")) return;
      window.NotesApp.replace(st);
      haptic("success"); say(st.grades.length + " notes importées.");
    };
    r.readAsText(f);
  }
  function mountBackup() {
    var host = $("#set-block"); if (!host || $("#backup")) return;
    var div = document.createElement("div"); div.className = "backup"; div.id = "backup";
    div.innerHTML =
      '<h3>Sauvegarde</h3>' +
      '<p class="muted small">Tes notes restent sur ce téléphone. Exporte-les de temps en temps (Fichiers, AirDrop) pour ne rien perdre. Les photos des tests ne sont ni dans la sauvegarde ni synchronisées : changer d\'iPhone ou supprimer l\'icône de l\'app les fait perdre.</p>' +
      '<div class="btns"><button type="button" class="btn" id="bk-export">Exporter</button>' +
      '<button type="button" class="btn-ghost" id="bk-import">Importer un fichier</button></div>' +
      '<input type="file" id="bk-file" accept="application/json,.json">' +
      '<p class="ok" id="bk-msg" role="status"></p>' +
      '<label class="row">Retours haptiques<input type="checkbox" switch id="bk-haptic"' + (hapticsOn ? " checked" : "") + '></label>';
    host.appendChild(div);
    $("#bk-export").addEventListener("click", exportData);
    $("#bk-import").addEventListener("click", function () { $("#bk-file").click(); });
    $("#bk-file").addEventListener("change", function (e) { var f = e.target.files && e.target.files[0]; if (f) importFile(f); e.target.value = ""; });
    $("#bk-haptic").addEventListener("change", function (e) {
      hapticsOn = e.target.checked;
      try { localStorage.setItem(HK, hapticsOn ? "on" : "off"); } catch (x) {}
      if (hapticsOn) haptic("success");
    });
  }

  /* ---------- Installation ---------- */
  function mountInstallTip() {
    var ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    var standalone = window.navigator.standalone || window.matchMedia("(display-mode: standalone)").matches;
    var dismissed = false; try { dismissed = localStorage.getItem("notes2m01.tip") === "off"; } catch (e) {}
    if (!ios || standalone || dismissed) return;
    var tip = document.createElement("div"); tip.className = "install-tip";
    tip.innerHTML = window.Icons.svg("share") +
      '<p>Installe l\'app : touche <b>Partager</b>, puis <b>Sur l\'écran d\'accueil</b>.</p><button type="button" class="link" id="tip-x">OK</button>';
    var wrap = $(".wrap"); wrap.insertBefore(tip, $("#demo"));
    $("#tip-x").addEventListener("click", function () {
      try { localStorage.setItem("notes2m01.tip", "off"); } catch (e) {}
      tip.remove();
    });
  }

  /* ---------- Branchements ---------- */
  window.FX = {
    haptic: haptic,
    rendered: function () { placeSeg(); },
    view: function () { placeTab(); },
    success: function () { haptic("success"); }
  };
  mountBackup(); mountInstallTip();
  placeSeg(); placeTab();

  if ("serviceWorker" in navigator && location.protocol === "https:") {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
  }
})();
