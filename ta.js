/* Notes : travaux assimilés (TA). Un TA regroupe des ETA (petites évaluations) et compte comme une seule note de poids 1.
   Formulaire : type « TA » → choisir un TA de la branche (ou en créer un), puis saisir l'ETA (note, ou points si le TA
   est noté en points). Barème en points : le « % du 4 » du TA (60 % par défaut) ; 0 % → 1, ce % → 4, 100 % → 6.
   Le calcul (taNote, taScale, regroupement) est dans le moteur (build.py, étape TA). Les TA (kind "tadef") et les ETA
   (champ `ta`) sont des enregistrements comme les notes : la sauvegarde et la synchronisation les transportent. */
(function () {
  "use strict";
  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function num(v) { var n = parseFloat(String(v).replace(",", ".")); return isFinite(n) ? n : NaN; }
  function hap(k) { if (window.FX) FX.haptic(k); }
  function show(el, on) { el.classList.toggle("ios-ta-off", !on); }
  var app = function () { return window.NotesApp; };
  var open = {}, editing = null;
  var PCT_MIN = 10, PCT_MAX = 90, PCT_DEF = 60;

  var typeSel = $("#f-type"), subjSel = $("#f-subj");
  if (!typeSel || !subjSel || !$("#form")) return;
  var valField = $("#f-val").closest(".field"), coefField = $("#f-coef").closest(".field"), chips = $("#form .chips");

  /* ---------- Champs du formulaire ---------- */
  var box = document.createElement("div");
  box.id = "ta-fields"; box.className = "ios-ta-fields ios-ta-off";
  box.innerHTML =
    '<div class="field"><label for="f-ta">Travail assimilé</label><select id="f-ta"></select></div>' +
    '<div class="ios-ta-new" id="ta-new">' +
      '<div class="field"><label for="f-ta-label">Nom du TA</label><input id="f-ta-label" type="text" maxlength="50" placeholder="Vocabulaire ch. 3"></div>' +
      '<label class="ios-ta-switch">Noter en points<input type="checkbox" switch id="f-ta-points"></label>' +
      '<div class="field" id="ta-pct"><label for="f-ta-pct">% des points qui donne 4 (de ' + PCT_MIN + ' à ' + PCT_MAX + ')</label><input id="f-ta-pct" type="text" inputmode="decimal" value="' + PCT_DEF + '"></div>' +
    '</div>' +
    '<div class="row2" id="ta-pts">' +
      '<div class="field"><label for="f-pts">Points obtenus</label><input id="f-pts" type="text" inputmode="decimal" placeholder="17"></div>' +
      '<div class="field"><label for="f-max">Points max</label><input id="f-max" type="text" inputmode="decimal" placeholder="20"></div>' +
    '</div>' +
    '<p class="ios-ta-hint muted small" id="ta-hint"></p>';
  typeSel.closest(".row2").after(box);

  function defs(subject) { return app().records().filter(function (r) { return r.kind === "tadef" && (!subject || r.subject === subject); }); }
  function etasOf(tid) { return app().records().filter(function (r) { return r.ta === tid; }); }
  function defOf(tid) { return app().records().filter(function (r) { return r.id === tid && r.kind === "tadef"; })[0] || null; }
  function pctOf(d) { var p = +d.pct; return isFinite(p) && p >= PCT_MIN && p <= PCT_MAX ? p : PCT_DEF; }
  function etaValue(d, p, m) { return Math.round(app().taScale(p / m, pctOf(d) / 100) * 100) / 100; }

  function fillTA(keep) {
    var sel = $("#f-ta"), cur = keep || sel.value, list = defs(subjSel.value).sort(function (a, b) { return a.id < b.id ? 1 : -1; });
    sel.innerHTML = list.map(function (d) {
      return '<option value="' + d.id + '">' + esc(d.label || "TA") + " (" + etasOf(d.id).length + " ETA" + (d.points ? ", en points" : "") + ")</option>";
    }).join("") + '<option value="__new">+ Nouveau TA…</option>';
    sel.value = list.some(function (d) { return d.id === cur; }) ? cur : (list.length ? list[0].id : "__new");
    sync();
  }
  function current() { var v = $("#f-ta").value; return v === "__new" ? null : defOf(v); }
  function sync() {
    var isTA = typeSel.value === "ta";
    show(box, isTA);
    var isNew = isTA && $("#f-ta").value === "__new", d = isTA ? current() : null;
    var points = isNew ? $("#f-ta-points").checked : !!(d && d.points);
    show($("#ta-new"), isNew);
    show($("#ta-pct"), isNew && points);
    show($("#ta-pts"), isTA && points);
    show(valField, !(isTA && points));
    show(coefField, !isTA); if (chips) show(chips, !isTA);
    var lbl = $("label[for=f-val]"); if (lbl) lbl.textContent = isTA ? "Note de l'ETA (1 à 6)" : "Note (1 à 6)";
    var ll = $("label[for=f-label]"); if (ll) ll.textContent = isTA ? "Intitulé de l'ETA (facultatif)" : "Intitulé (facultatif)";
    var hint = "";
    if (isNew) hint = "Un TA regroupe des petites évaluations (ETA). Il compte comme une seule note de coefficient 1.";
    else if (d && d.points) hint = "TA noté en points : " + pctOf(d) + " % des points donne 4. La note se calcule sur le total des points des ETA.";
    else if (d) hint = "La note du TA est la moyenne de ses ETA. Elle compte comme une seule note de coefficient 1.";
    $("#ta-hint").textContent = hint;
  }
  typeSel.addEventListener("change", function () { if (typeSel.value === "ta") fillTA(); else sync(); });
  subjSel.addEventListener("change", function () { if (typeSel.value === "ta") fillTA(); });
  box.addEventListener("change", function (e) { if (e.target.id === "f-ta" || e.target.id === "f-ta-points") sync(); });

  /* ---------- Enregistrement d'un ETA (avant l'écouteur du moteur) ---------- */
  $("#form").addEventListener("submit", function (e) {
    if (typeSel.value !== "ta") return;
    e.preventDefault(); e.stopImmediatePropagation();
    var msg = $("#f-msg"), date = $("#f-date").value, subject = subjSel.value;
    msg.style.color = "";
    function err(t, el) { msg.textContent = t; if (el) el.focus(); hap("error"); }
    if (app().demo()) return err("Quitte le mode exemple pour enregistrer une note.");
    if (!date) return err("Choisis une date.");
    var recs = [], d = current();
    if (!d) {
      var label = $("#f-ta-label").value.trim();
      if (!label) return err("Donne un nom au TA (par exemple « Vocabulaire ch. 3 »).", $("#f-ta-label"));
      d = { id: uid(), kind: "tadef", subject: subject, label: label, points: $("#f-ta-points").checked, value: 0, coef: 0, date: date };
      if (d.points) {
        var pct = num($("#f-ta-pct").value);
        if (!isFinite(pct) || pct < PCT_MIN || pct > PCT_MAX) return err("Le % du 4 doit être entre " + PCT_MIN + " et " + PCT_MAX + ".", $("#f-ta-pct"));
        d.pct = pct;
      }
      recs.push(d);
    }
    var id = editing || app().editing() || uid();
    var eta = { id: id, subject: d.subject, ta: d.id, coef: 1, type: "ta", date: date, label: $("#f-label").value.trim() };
    if (d.points) {
      var p = num($("#f-pts").value), m = num($("#f-max").value);
      if (!isFinite(p) || p < 0) return err("Entre les points obtenus.", $("#f-pts"));
      if (!isFinite(m) || m <= 0) return err("Entre le maximum de points (plus grand que 0).", $("#f-max"));
      if (p > m) return err("Les points obtenus dépassent le maximum.", $("#f-pts"));
      eta.pts = p; eta.max = m; eta.value = etaValue(d, p, m);
    } else {
      var v = num($("#f-val").value);
      if (!isFinite(v) || v < 1 || v > 6) return err("La note doit être entre 1 et 6.", $("#f-val"));
      eta.value = Math.round(v * 100) / 100;
    }
    recs.push(eta);
    var was = !!(editing || app().editing());
    // Un ETA déplacé vers un autre TA peut laisser l'ancien TA vide : on le retire.
    var old = app().records().filter(function (r) { return r.id === id; })[0];
    open[d.id] = true; editing = null;
    if (window.Photos) Photos.commit(eta.id);
    app().upsert(recs, was ? "ETA modifié" : "ETA ajouté");
    if (!was && window.Notify) Notify.added(eta, d);
    if (old && old.ta && old.ta !== d.id && !etasOf(old.ta).length) app().remove([old.ta]);
  }, true);

  /* ---------- Liste : déplier, ajouter, renommer, % du 4, supprimer ---------- */
  document.addEventListener("toggle", function (e) {
    var t = e.target; if (t.classList && t.classList.contains("ios-ta")) open[t.dataset.ta] = t.open;
  }, true);
  document.addEventListener("click", function (e) {
    var t = e.target; if (!t.dataset) return;
    var d;
    if (t.dataset.taAdd && (d = defOf(t.dataset.taAdd))) {
      app().goAdd();
      subjSel.value = d.subject; typeSel.value = "ta"; fillTA(d.id);
      $(d.points ? "#f-pts" : "#f-val").focus({ preventScroll: true });
    }
    // « Modifier le TA » : feuille de saisie (ios-sheets.js) avec le nom et, en points, le % qui donne 4.
    if (t.dataset.taEdit && (d = defOf(t.dataset.taEdit))) {
      var fields = [{ key: "name", label: "Nom", value: d.label || "", placeholder: "Exposé", max: 50 }];
      if (d.points) fields.push({ key: "pct", label: "% des points pour un 4", value: String(pctOf(d)), mode: "decimal", unit: "%" });
      IOSSheet.form({ title: "Modifier le TA", ok: "Enregistrer", fields: fields,
        foot: d.points ? "Le % va de " + PCT_MIN + " à " + PCT_MAX + ". Les notes des ETA suivent le nouveau barème." : "",
        check: function (v) {
          if (!v.name) return "Donne un nom au TA.";
          if (d.points) { var x = num(v.pct); if (!isFinite(x) || x < PCT_MIN || x > PCT_MAX) return "Le % du 4 doit être entre " + PCT_MIN + " et " + PCT_MAX + "."; }
          return null;
        }
      }).then(function (v) {
        if (!v) return;
        var nd = Object.assign({}, d, { label: v.name.slice(0, 50) });
        if (d.points) nd.pct = num(v.pct);
        // La valeur indicative de chaque ETA suit le nouveau barème.
        var upd = d.points && nd.pct !== pctOf(d) ? etasOf(d.id).map(function (x) { return x.max > 0 ? Object.assign({}, x, { value: etaValue(nd, +x.pts || 0, +x.max) }) : x; }) : [];
        if (nd.label === d.label && !upd.length) return;
        app().upsert(upd.concat([nd])); hap("success");
      });
    }
    if (t.dataset.taDel && (d = defOf(t.dataset.taDel))) {
      var n = etasOf(d.id).length, dd = d;
      IOSSheet.confirm({ title: "Supprimer le TA « " + (d.label || "TA") + " » ?", message: (n > 1 ? "Ses " + n + " ETA seront supprimés" : "Son ETA sera supprimé") + ", avec leurs photos. Cette action ne s'annule pas.", ok: "Supprimer le TA" })
        .then(function (ok) { if (ok) { app().remove([dd.id].concat(etasOf(dd.id).map(function (x) { return x.id; }))); hap("heavy"); } });
    }
  });

  window.TA = {
    isOpen: function (tid) { return !!open[tid]; },
    // Appelé par le moteur quand on touche « Modifier » sur une note ou un ETA.
    onEdit: function (g) {
      if (!g.ta) { editing = null; sync(); return; }
      editing = g.id; typeSel.value = "ta"; fillTA(g.ta);
      if (g.pts != null) { $("#f-pts").value = g.pts; $("#f-max").value = g.max; }
    },
    reset: function () {
      editing = null;
      $("#f-ta-label").value = ""; $("#f-ta-points").checked = false; $("#f-ta-pct").value = String(PCT_DEF); $("#f-pts").value = ""; $("#f-max").value = "";
      sync();
    }
  };
  sync();
})();
