/* ios-add.js : formulaire « Ajouter » au style C du canvas (v58), téléphone seulement (≤ 700 px).
   Le formulaire du moteur (#form, index.html), les champs TA (ta.js) et les photos (photos.js) gardent leurs éléments et
   leurs écouteurs ; ce module ne fait que :
   - regrouper les champs de la note dans un groupe blanc (.ios-add-grp) sous un titre de section « Note », et la photo
     sous « Photo du test » (titres .ios-grp-head, cachés sur grand écran) ;
   - doubler la liste « Type » par un sélecteur Test · TP · TA (.ios-tseg) : toucher un bouton change la liste d'origine
     et envoie son événement change (ta.js ouvre alors ses champs) ;
   - marquer la pastille de coefficient qui correspond au champ (.is-on).
   Chargé après photos.js. Sur grand écran, ios.css cache les ajouts et le formulaire garde son aspect. */
(function () {
  "use strict";
  var form = document.getElementById("form"), typeSel = document.getElementById("f-type"), coef = document.getElementById("f-coef");
  if (!form || !typeSel) return;
  function head(t) { var p = document.createElement("p"); p.className = "ios-grp-head ios-add-h"; p.textContent = t; return p; }

  // Groupe « Note » : tout ce qui précède le bloc photo.
  var ph = form.querySelector(".ios-ph-box"), stop = ph || document.getElementById("f-msg");
  var grp = document.createElement("div"); grp.className = "ios-add-grp";
  while (form.firstChild && form.firstChild !== stop) grp.appendChild(form.firstChild);
  form.insertBefore(grp, stop);
  form.insertBefore(head("Note"), grp);
  if (ph) form.insertBefore(head("Photo du test"), ph);

  // Sélecteur Test · TP · TA à la place de la liste déroulante.
  var seg = document.createElement("div"); seg.className = "ios-tseg"; seg.setAttribute("role", "group"); seg.setAttribute("aria-label", "Type");
  seg.innerHTML = [].map.call(typeSel.options, function (o) { return '<button type="button" data-type="' + o.value + '">' + o.textContent + '</button>'; }).join("");
  typeSel.after(seg);
  function paintSeg() { [].forEach.call(seg.children, function (b) { b.setAttribute("aria-pressed", String(b.dataset.type === typeSel.value)); }); }
  seg.addEventListener("click", function (e) {
    var b = e.target.closest("[data-type]"); if (!b || b.dataset.type === typeSel.value) return;
    typeSel.value = b.dataset.type; typeSel.dispatchEvent(new Event("change", { bubbles: true }));
    if (window.FX) FX.haptic("select");
    paintSeg();
  });

  // Pastille de coefficient active.
  var chips = form.querySelector(".chips");
  function val(t) { t = String(t || "").replace(",", ".").trim(); if (/^\d+\/\d+$/.test(t)) { var q = t.split("/"); return +q[0] / +q[1]; } return parseFloat(t); }
  function paintCoef() {
    if (!chips || !coef) return;
    var v = val(coef.value);
    [].forEach.call(chips.querySelectorAll("[data-coef]"), function (b) { b.classList.toggle("is-on", Math.abs(val(b.dataset.coef) - v) < 1e-6); });
  }
  function paint() { paintSeg(); paintCoef(); }
  typeSel.addEventListener("change", paintSeg);
  if (coef) coef.addEventListener("input", paintCoef);
  if (chips) chips.addEventListener("click", function () { setTimeout(paintCoef, 0); });
  // Le moteur et ta.js changent le type et le coefficient sans événement (modifier une note, remise à zéro) : on relit.
  document.addEventListener("ios:rendered", paint);
  document.addEventListener("ios:view", paint);
  document.addEventListener("click", function (e) { if (e.target.closest && e.target.closest("[data-edit], [data-ta-add], #f-cancel")) setTimeout(paint, 0); }, true);
  form.addEventListener("submit", function () { setTimeout(paint, 0); });
  paint();
})();
