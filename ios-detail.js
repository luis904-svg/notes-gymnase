/* ios-detail.js : détail d'une matière en PAGE ENTIÈRE sur téléphone (≤ 700 px), à la place de la feuille. Spécification :
   design/SPEC-reglages.md (« Additions »). Sur grand écran, rien ne change : la feuille (#sheet) reste, sans animation.
   Principe : renderDetail (index.html) construit toujours son contenu dans #sheet-box ; sur téléphone, IOSDetail.open() prend
   ce contenu et en fait la page #ios-detail (grand titre = nom de la matière, trois cartes, lignes à icônes, graphique dans
   une carte, liste de notes avec ses boutons « Modifier » / « Supprimer »). Chaque nouveau rendu (note supprimée…) refait
   la page en gardant le défilement. L'affichage de la page est piloté par une classe sur <body> (ios-detail-open) :
   l'Accueil et son en-tête disparaissent, la page apparaît ; aucune bascule de `hidden`, donc aucun conflit avec setView.
   Entrée : push (IOSNav.run), sortie : chevron, balayage du bord gauche, onglet Accueil, ou autre onglet (instantané).
   La barre du bas disparaît pendant la page (IOSTitle.pill). Le défilement de l'Accueil est rétabli au retour. */
(function () {
  "use strict";
  var wrap = document.querySelector(".wrap");
  if (!wrap) return;
  var mq = window.matchMedia("(max-width: 700px)");
  var container = document.createElement("div");
  container.id = "ios-detail"; container.className = "ios-detail";
  wrap.appendChild(container);
  var active = false, scrollDash = 0;

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function ready() { return mq.matches && window.IOSNav && window.IOSTitle && window.IOSIcons && window.NotesApp; }

  /* Icône d'une ligne du bloc « .brk » selon son libellé. */
  function iconFor(text) {
    if (/^Notes saisies/.test(text)) return ["blue", "doc"];
    if (/^Objectif/.test(text)) return ["orange", "target"];
    if (/^Tests/.test(text)) return ["blue", "check"];
    if (/^TP/.test(text)) return ["green", "flask"];
    return ["gray", "list"];
  }

  function buildPage() {
    var box = document.getElementById("sheet-box");
    if (!box || !box.firstChild) return null;
    var h2 = box.querySelector("#sheet-title"), sp = box.querySelector(".sheet-head p");
    var page = document.createElement("div"); page.className = "ios-page ios-dpage";
    var h1 = document.createElement("h1"); h1.className = "ios-large"; h1.textContent = h2 ? h2.textContent : "";
    page.appendChild(h1);
    if (sp) { var sub = document.createElement("p"); sub.className = "ios-sub"; sub.textContent = sp.textContent; page.appendChild(sub); }
    [].slice.call(box.children).forEach(function (c) {
      if (c.classList.contains("grab") || c.classList.contains("sheet-head")) return;
      page.appendChild(c);
    });
    // Lignes d'information : groupe à icônes.
    var brk = page.querySelector(".brk");
    if (brk) {
      brk.className = "ios-grp";
      [].slice.call(brk.children).forEach(function (r) {
        var sps = r.querySelectorAll(":scope > span"); if (sps.length < 2) return;
        var ic = iconFor(sps[0].textContent);
        r.className = "ios-row has-ic";
        r.innerHTML = window.IOSIcons.icon(ic[0], ic[1]) + '<span class="ios-row-l">' + sps[0].innerHTML + '</span><span class="ios-val mono">' + sps[1].innerHTML + '</span>';
      });
    }
    // Sections « Évolution » et « Toutes les notes » : titre au-dessus, contenu dans un groupe.
    [].slice.call(page.querySelectorAll(":scope > div")).forEach(function (d) {
      var h = d.querySelector(":scope > h3.sec"); if (!h) return;
      var head = document.createElement("p"); head.className = "ios-grp-head"; head.textContent = h.textContent;
      var grp = document.createElement("div"); grp.className = "ios-grp " + (d.querySelector("#sheet-chart") ? "ios-chart" : "ios-notes");
      [].slice.call(d.children).forEach(function (c) { if (c !== h) grp.appendChild(c); });
      d.replaceWith(head, grp);
    });
    return page;
  }
  function ctxFor(page) {
    var h1 = page.querySelector(".ios-large");
    return { key: "detail:" + (h1 ? h1.textContent : ""), title: h1 ? h1.textContent : "", large: h1, back: back };
  }

  /* ---------- Entrée et sortie ---------- */
  function open() {
    if (!ready()) return false;
    var page = buildPage(); if (!page) return false;
    if (active) {                                   // nouveau rendu pendant que la page est ouverte : on garde le défilement
      var y = window.scrollY; container.replaceChildren(page); window.scrollTo(0, y); IOSTitle.set(ctxFor(page)); return true;
    }
    scrollDash = window.scrollY;
    IOSNav.run("push", function () {
      active = true; document.body.classList.add("ios-detail-open");
      container.replaceChildren(page); window.scrollTo(0, 0);
      IOSTitle.set(ctxFor(page)); IOSTitle.pill("detail", true); IOSNav.setBack(provider);
    });
    return true;
  }
  function close() {
    if (!active) return false;
    active = false; document.body.classList.remove("ios-detail-open");
    container.replaceChildren(); window.scrollTo(0, scrollDash);
    IOSTitle.pill("detail", false); IOSNav.setBack(null);
    var cur = document.querySelector('.tabbar [aria-current="page"]');
    if (!cur || cur.dataset.tab === "dash") document.dispatchEvent(new CustomEvent("ios:view", { detail: "dash" }));
    return true;
  }
  function back() {
    if (!active) return;
    IOSNav.run("pop", function () { window.NotesApp.closeDetail(); });
  }

  var provider = { can: function () { return active && mq.matches; }, go: back };

  mq.addEventListener && mq.addEventListener("change", function () { if (!mq.matches && active) window.NotesApp.closeDetail(); });
  window.IOSDetail = { open: open, close: close, back: back, active: function () { return active; } };
})();
