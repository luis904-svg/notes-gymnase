/* ios-dialog.js (v64, lot 6) : feuilles à la place de window.prompt / confirm / alert.
   HIG sheets.md : une seule feuille à la fois, une sortie évidente (Annuler), balayage vers le bas pour fermer ; modality.md : un titre qui
   nomme la tâche. Trois fonctions, toutes renvoient une promesse :
     IOSDialog.prompt({ title, message, value, placeholder, inputmode, autocapitalize, maxlength, ok, validate })  -> texte ou null (annulé)
         validate(texte) renvoie un message d'erreur (la feuille reste ouverte) ou une chaîne vide / null (accepté).
     IOSDialog.confirm({ title, message, ok, cancel, danger })                                                   -> true / false
     IOSDialog.alert({ title, message, ok })                                                                    -> undefined
   Les feuilles se mettent en file : jamais deux à l'écran. Échap, un toucher sur le fond ou un balayage vers le bas annulent. */
(function () {
  "use strict";
  var queue = [], current = null, seq = 0;

  function h(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function hap(k) { if (window.FX && FX.haptic) FX.haptic(k); }

  function show(o) {
    return new Promise(function (resolve) {
      queue.push({ o: o, resolve: resolve });
      if (!current) next();
    });
  }
  function next() {
    var q = queue.shift(); if (!q) { current = null; return; }
    current = q; build(q.o, q.resolve);
  }

  function build(o, resolve) {
    var id = "ios-dlg-" + (++seq), prev = document.activeElement, done = false;
    var root = h("div", "ios-dlg"), scrim = h("div", "ios-dlg-scrim"), sheet = h("div", "ios-dlg-sheet");
    sheet.setAttribute("role", o.kind === "alert" ? "alertdialog" : "dialog"); sheet.setAttribute("aria-modal", "true");
    sheet.setAttribute("aria-labelledby", id + "-t");
    root.appendChild(scrim); root.appendChild(sheet);
    sheet.appendChild(h("i", "ios-dlg-grab"));
    var t = h("h2", "ios-dlg-t", o.title || ""); t.id = id + "-t"; sheet.appendChild(t);
    if (o.message) { var m = h("p", "ios-dlg-m", o.message); m.id = id + "-m"; sheet.appendChild(m); sheet.setAttribute("aria-describedby", m.id); }
    var input = null, err = null;
    if (o.kind === "prompt") {
      input = h("input", "ios-dlg-in"); input.type = "text"; input.value = o.value == null ? "" : String(o.value);
      if (o.placeholder) input.placeholder = o.placeholder;
      input.setAttribute("inputmode", o.inputmode || "text"); input.setAttribute("enterkeyhint", "done");
      input.setAttribute("autocomplete", "off"); input.setAttribute("autocorrect", "off"); input.setAttribute("spellcheck", "false");
      input.setAttribute("autocapitalize", o.autocapitalize || "sentences");
      if (o.maxlength) input.maxLength = o.maxlength;
      input.setAttribute("aria-label", o.title || "Saisie");
      err = h("p", "ios-dlg-err"); err.setAttribute("role", "alert"); err.hidden = true;
      sheet.appendChild(input); sheet.appendChild(err);
    }
    var btns = h("div", "ios-dlg-btns"), ok = h("button", "ios-dlg-b ios-dlg-ok" + (o.danger ? " is-danger" : ""), o.ok || "OK"); ok.type = "button";
    btns.appendChild(ok);
    var cancel = null;
    if (o.kind !== "alert") { cancel = h("button", "ios-dlg-b ios-dlg-cancel", o.cancel || "Annuler"); cancel.type = "button"; btns.appendChild(cancel); }
    sheet.appendChild(btns);

    function close(value) {
      if (done) return; done = true;
      document.removeEventListener("keydown", onKey, true);
      if (window.visualViewport) { visualViewport.removeEventListener("resize", kb); visualViewport.removeEventListener("scroll", kb); }
      root.classList.add("is-out");
      var gone = function () { root.remove(); if (!document.querySelector(".ios-dlg")) document.body.classList.remove("ios-dlg-open"); if (prev && prev.focus && document.contains(prev)) { try { prev.focus({ preventScroll: true }); } catch (e) {} } resolve(value); next(); };
      var noAnim = document.documentElement.classList.contains("noanim");
      if (noAnim) gone(); else setTimeout(gone, 220);
    }
    function submit() {
      if (o.kind === "prompt") {
        var v = input.value, msg = o.validate ? o.validate(v) : "";
        if (msg) { err.textContent = msg; err.hidden = false; hap("error"); input.focus(); return; }
        close(v);
      } else close(o.kind === "confirm" ? true : undefined);
    }
    function dismiss() { close(o.kind === "prompt" ? null : (o.kind === "confirm" ? false : undefined)); }
    function onKey(e) {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); dismiss(); return; }
      if (e.key === "Enter" && input && e.target === input) { e.preventDefault(); submit(); return; }
      if (e.key === "Tab") {   // le focus reste dans la feuille
        var f = Array.prototype.filter.call(sheet.querySelectorAll("input, button"), function (x) { return !x.disabled && x.offsetParent !== null; });
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        else if (!sheet.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      }
    }
    function kb() {   // clavier ouvert : la feuille monte au-dessus
      var vv = window.visualViewport; if (!vv) return;
      var lift = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      sheet.style.setProperty("--ios-dlg-kb", lift + "px");
    }

    ok.addEventListener("click", submit);
    if (cancel) cancel.addEventListener("click", dismiss);
    scrim.addEventListener("click", dismiss);
    if (input) input.addEventListener("input", function () { if (!err.hidden) err.hidden = true; });
    document.addEventListener("keydown", onKey, true);
    if (window.visualViewport) { visualViewport.addEventListener("resize", kb); visualViewport.addEventListener("scroll", kb); }

    // Balayage vers le bas pour fermer (depuis la poignée ou le titre, pas depuis un champ ni un bouton).
    var drag = null;
    sheet.addEventListener("pointerdown", function (e) {
      if (e.target.closest("input, button") || e.pointerType === "mouse") return;
      drag = { y: e.clientY, t: Date.now(), dy: 0 }; sheet.setPointerCapture(e.pointerId); sheet.style.transition = "none";
    });
    sheet.addEventListener("pointermove", function (e) {
      if (!drag) return; drag.dy = Math.max(0, e.clientY - drag.y); sheet.style.transform = "translate3d(0," + drag.dy + "px,0)";
    });
    function release() {
      if (!drag) return; var d = drag; drag = null; sheet.style.transition = "";
      var v = d.dy / Math.max(1, Date.now() - d.t);
      if (d.dy > 90 || v > 0.6) { sheet.style.transform = ""; dismiss(); } else sheet.style.transform = "";
    }
    sheet.addEventListener("pointerup", release); sheet.addEventListener("pointercancel", release);

    document.body.appendChild(root); document.body.classList.add("ios-dlg-open");
    kb();
    if (input) { input.focus({ preventScroll: true }); input.select(); } else (o.danger && cancel ? cancel : ok).focus({ preventScroll: true });
  }

  window.IOSDialog = {
    prompt: function (o) { return show(Object.assign({ kind: "prompt" }, o)); },
    confirm: function (o) { return show(Object.assign({ kind: "confirm" }, o)); },
    alert: function (o) { return show(Object.assign({ kind: "alert" }, o)); },
    busy: function () { return !!current; }
  };
})();
