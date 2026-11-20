/* ios-sheets.js : feuilles communes (session B, 19 novembre 2026, choix de l'utilisateur ; maquettes dans design/maquettes-composants/).
   Remplacent toutes les fenêtres du navigateur (window.confirm / prompt / alert), qui montraient « localhost indique » et OK / Annuler.
   - IOSSheet.actions({ title, message, actions: [{ label, danger, run }] }) : feuille d'actions iOS (Modifier, Voir les photos,
     Supprimer en rouge), Annuler à part en bas. Promesse : index choisi, ou -1 si annulé.
   - IOSSheet.confirm({ title, message, ok, danger }) : même feuille, un bouton (rouge par défaut) + Annuler. Promesse : true / false.
   - IOSSheet.notice({ title, message }) : information, un seul bouton OK. Promesse résolue à la fermeture.
   - IOSSheet.form({ title, fields: [{ key, label, value, mode, placeholder, max, upper }], foot, ok, check(values) }) : feuille
     haute avec ronds Fermer / Valider, champs dans des lignes ; check() renvoie un message d'erreur (écrit sous le groupe) ou null.
     Promesse : objet { clé: texte saisi } ou null.
   Une seule feuille à la fois : en ouvrir une autre ferme la précédente (comme annulée). Échap ou un toucher sur le voile = Annuler.
   Animation : glissement vers le haut (transition CSS) ; coupée par ?noanim=1 (html.noanim) et « Réduire les animations ». */
(function () {
  "use strict";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function hap(k) { if (window.FX && FX.haptic) FX.haptic(k); }
  function svg(n) { return window.Icons ? Icons.svg(n) : ""; }
  function still() {
    return document.documentElement.classList.contains("noanim") || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  var cur = null;   // { root, done, back }

  function open(html, kind, onKey) {
    if (cur) cur.cancel();
    var root = document.createElement("div");
    root.className = "ios-shx ios-shx-" + kind;
    root.setAttribute("role", kind === "form" ? "dialog" : "alertdialog");
    root.setAttribute("aria-modal", "true");
    root.innerHTML = '<div class="ios-shx-scrim" data-shx="cancel"></div><div class="ios-shx-panel">' + html + "</div>";
    var back = document.activeElement;
    document.body.appendChild(root);
    document.body.classList.add("ios-shx-open");
    // Deux images : la feuille part de sous l'écran, puis la transition l'amène en place.
    if (still()) root.classList.add("is-in");
    else requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.add("is-in"); }); });
    var me = { root: root, closed: false };
    me.close = function (after) {
      if (me.closed) return; me.closed = true;
      if (cur === me) cur = null;
      document.removeEventListener("keydown", key, true);
      root.classList.remove("is-in"); root.classList.add("is-out");
      var gone = function () { if (root.parentNode) root.parentNode.removeChild(root); if (!document.querySelector(".ios-shx")) document.body.classList.remove("ios-shx-open"); };
      if (still()) gone(); else setTimeout(gone, 320);
      if (back && back.focus && document.contains(back)) try { back.focus({ preventScroll: true }); } catch (e) {}
      if (after) after();
    };
    function key(e) {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); me.cancel(); }
      else if (onKey) onKey(e);
    }
    document.addEventListener("keydown", key, true);
    cur = me;
    return me;
  }

  function actions(o) {
    o = o || {};
    return new Promise(function (resolve) {
      var list = o.actions || [];
      var head = o.title || o.message ? '<div class="ios-shx-head">' + (o.title ? "<b>" + esc(o.title) + "</b>" : "") + (o.message ? "<span>" + esc(o.message) + "</span>" : "") + "</div>" : "";
      var rows = list.map(function (a, i) {
        return '<button type="button" class="ios-shx-btn' + (a.danger ? " is-danger" : "") + (a.bold ? " is-bold" : "") + '" data-shx="' + i + '">' + esc(a.label) + "</button>";
      }).join("");
      var cancel = o.cancel === false ? "" : '<div class="ios-shx-grp"><button type="button" class="ios-shx-btn is-bold" data-shx="cancel">' + esc(o.cancel || "Annuler") + "</button></div>";
      var me = open('<div class="ios-shx-grp">' + head + rows + "</div>" + cancel, "acts");
      me.cancel = function () { me.close(function () { resolve(-1); }); };
      me.root.addEventListener("click", function (e) {
        var b = e.target.closest("[data-shx]"); if (!b) return;
        if (b.dataset.shx === "cancel") { hap("tap"); me.cancel(); return; }
        var i = +b.dataset.shx, a = list[i];
        me.close(function () { resolve(i); if (a && a.run) a.run(); });
      });
      var first = me.root.querySelector(".ios-shx-btn");
      if (first) try { first.focus({ preventScroll: true }); } catch (e) {}
    });
  }
  function confirm(o) {
    o = o || {};
    if (o.danger !== false) hap("warn");
    return actions({ title: o.title, message: o.message, actions: [{ label: o.ok || "Continuer", danger: o.danger !== false, bold: o.danger === false }], cancel: o.cancel })
      .then(function (i) { return i === 0; });
  }
  function notice(o) {
    o = o || {};
    return actions({ title: o.title, message: o.message, actions: [{ label: o.ok || "OK", bold: true }], cancel: false }).then(function () {});
  }

  function form(o) {
    o = o || {};
    return new Promise(function (resolve) {
      var fields = o.fields || [];
      var rows = fields.map(function (f, i) {
        var mode = f.mode === "decimal" ? ' inputmode="decimal"' : f.mode === "numeric" ? ' inputmode="numeric"' : "";
        return '<label class="ios-shx-row"><span class="ios-shx-l">' + esc(f.label) + '</span><input type="text" class="ios-shx-in" data-k="' + esc(f.key) + '"' + mode +
          ' value="' + esc(f.value) + '" placeholder="' + esc(f.placeholder || "") + '"' + (f.max ? ' maxlength="' + f.max + '"' : "") +
          (f.upper ? ' autocapitalize="characters"' : ' autocapitalize="sentences"') + ' autocomplete="off" spellcheck="false" enterkeyhint="' + (i === fields.length - 1 ? "done" : "next") + '">' +
          (f.unit ? '<span class="ios-shx-u">' + esc(f.unit) + "</span>" : "") + "</label>";
      }).join("");
      var html = '<div class="ios-shx-bar"><button type="button" class="ob-round" data-shx="cancel" aria-label="Fermer">' + svg("times") + "</button><b>" + esc(o.title) + '</b>' +
        '<button type="button" class="ob-round ios-shx-ok" data-shx="ok" aria-label="' + esc(o.ok || "Valider") + '">' + svg("check") + "</button></div>" +
        '<div class="ios-shx-body"><div class="ios-shx-grp ios-shx-fields">' + rows + '</div><p class="ios-shx-err" aria-live="polite"></p>' +
        (o.foot ? '<p class="ios-shx-foot">' + esc(o.foot) + "</p>" : "") + "</div>";
      var me = open(html, "form", function (e) { if (e.key === "Enter" && e.target.classList && e.target.classList.contains("ios-shx-in")) { e.preventDefault(); submit(); } });
      me.cancel = function () { me.close(function () { resolve(null); }); };
      function values() {
        var v = {}; [].forEach.call(me.root.querySelectorAll(".ios-shx-in"), function (x) { v[x.dataset.k] = x.value.trim(); }); return v;
      }
      function submit() {
        var v = values(), err = o.check ? o.check(v) : null;
        if (err) { me.root.querySelector(".ios-shx-err").textContent = err; hap("error"); return; }
        me.close(function () { resolve(v); });
      }
      me.root.addEventListener("click", function (e) {
        var b = e.target.closest("[data-shx]"); if (!b) return;
        if (b.dataset.shx === "cancel") me.cancel(); else if (b.dataset.shx === "ok") submit();
      });
      me.root.addEventListener("input", function () { me.root.querySelector(".ios-shx-err").textContent = ""; });
      var f0 = me.root.querySelector(".ios-shx-in");
      if (f0) { try { f0.focus({ preventScroll: true }); f0.select(); } catch (e) {} }
    });
  }

  /* Actions d'une note (choix A de la question 2) : sur téléphone, toucher une note (Accueil « Dernières notes », page d'une
     branche, ETA d'un TA) ouvre une feuille Modifier / Voir les photos / Supprimer. Les boutons d'origine du moteur
     ([data-edit], [data-del], cachés) font le travail : la suppression demande ensuite confirmation (patch de build.py).
     Écouteur en capture : il passe avant celui de photos.js, qui ouvrait les photos au toucher de la ligne. */
  function txt(el) { return el ? (el.firstChild && el.firstChild.nodeType === 3 ? el.firstChild.nodeValue : el.textContent).trim() : ""; }
  function noteActions(li) {
    var ed = li.querySelector("[data-edit]"), del = li.querySelector("[data-del]"), pb = li.querySelector("[data-ph-open]");
    var ph = li.dataset.photos || (pb && pb.dataset.phOpen) || "", eta = li.classList.contains("ios-eta");
    var v = li.querySelector(eta ? ".ios-eta-v" : ".v"), w = li.querySelector(eta ? ".ios-eta-what" : ".what"), meta = li.querySelector(eta ? ".ios-eta-d" : ".meta");
    var list = [];
    if (ed) list.push({ label: "Modifier", run: function () { ed.click(); } });
    if (ph && window.Photos && Photos.count(ph)) list.push({ label: "Voir les photos", run: function () { Photos.open(ph); } });
    if (del) list.push({ label: eta ? "Supprimer l'ETA" : "Supprimer la note", danger: true, run: function () { del.click(); } });
    if (!list.length) return false;
    hap("select");
    actions({ title: txt(w) + (v ? " · " + v.textContent.trim() : ""), message: meta ? meta.textContent.trim() : "", actions: list });
    return true;
  }
  var phone = window.matchMedia ? matchMedia("all") : { matches: false };
  document.addEventListener("click", function (e) {
    if (!phone.matches || cur || !e.target.closest || e.target.closest("button, a, input, select, summary, label")) return;
    var li = e.target.closest("#notes > li.ios-dnote, .ios-enotes .notes > li.ios-erow, .notes li.ios-eta"); if (!li) return;
    if (noteActions(li)) { e.stopPropagation(); e.preventDefault(); }
  }, true);

  window.IOSSheet = { actions: actions, confirm: confirm, notice: notice, form: form, noteActions: noteActions, isOpen: function () { return !!cur; }, close: function () { if (cur) cur.cancel(); } };
})();
