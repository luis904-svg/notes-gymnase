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

  var TONE_TEXT = { good: "Au-dessus de 4", warn: "Proche du seuil de 4", crit: "Sous le seuil de 4", none: "Pas encore de note" };
  function toneOf(el) { var k = ["good", "warn", "crit"].filter(function (c) { return el && el.classList.contains(c); })[0]; return k || "none"; }
  function el(tag, cls, html) { var n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }

  /* Page de détail (objectif 9), style Réglages iOS. Le moteur écrit toujours dans #sheet-box ; on en reprend les morceaux :
     1. en haut, la moyenne de l'année (grand chiffre, statut par rapport à l'objectif ou au seuil de 4) et la courbe ;
     2. les semestres et les informations en lignes groupées ; le bloc du certificat (3e) tel quel ;
     3. la liste des notes, de la plus récente à la plus ancienne (TA dépliables, photos), ou un état vide. */
  function buildPage() {
    var box = document.getElementById("sheet-box");
    if (!box || !box.firstChild) return null;
    var h2 = box.querySelector("#sheet-title"), sp = box.querySelector(".sheet-head p"), name = h2 ? h2.textContent : "";
    var page = el("div", "ios-page ios-dpage");
    var h1 = el("h1", "ios-large"); h1.textContent = name; page.appendChild(h1);
    if (sp) { var sub = el("p", "ios-sub"); sub.textContent = sp.textContent; page.appendChild(sub); }

    var tiles = [].slice.call(box.querySelectorAll(".tiles .tile")), brk = box.querySelector(".brk"), chart = box.querySelector("#sheet-chart");
    var notesUl = box.querySelector("#sheet-notes"), need = box.querySelector(".need"), cert = box.querySelector(".cert-min");
    var rowsOf = brk ? [].slice.call(brk.children) : [], goalRow = null;
    rowsOf.forEach(function (r) { var a = r.querySelector("span"); if (a && /^Objectif/.test(a.textContent)) goalRow = r; });

    // 1. Moyenne et courbe.
    if (tiles.length) {
      var y = tiles[0], num = y.querySelector(".num"), tone = toneOf(num), status = TONE_TEXT[tone], stTone = tone;
      if (goalRow && tone !== "none") {
        var gv = goalRow.querySelectorAll(":scope > span")[1].textContent, below = /−/.test(gv);
        status = "Objectif " + gv.replace(/[()]/g, "").replace(/\s+/, " : "); stTone = below ? "warn" : "good";
        if (tone === "crit") stTone = "crit";
      }
      var hero = el("div", "ios-grp ios-hero",
        '<div class="ios-hero-top"><span class="ios-hero-num ios-tone-' + tone + '">' + esc(num ? num.textContent : "–") + '</span>' +
        '<span class="ios-hero-side"><b>Moyenne de l\'année</b><span>' + esc(y.querySelector(".sub") ? y.querySelector(".sub").textContent : "") + '</span>' +
        '<span class="ios-hero-st ios-tone-' + stTone + '">' + esc(status) + '</span></span></div>');
      if (chart && chart.querySelector("svg")) { var cw = el("div", "ios-hero-chart"); cw.appendChild(chart); hero.appendChild(cw); }
      page.appendChild(hero);
    }
    if (need) { need.className = "ios-grp ios-need"; page.appendChild(need); }

    // 2. Semestres et informations, en lignes.
    var info = el("div", "ios-grp");
    tiles.slice(1).forEach(function (t) {
      var n = t.querySelector(".num"), sb = t.querySelector(".sub"), lb = t.querySelector(".lbl");
      info.appendChild(el("div", "ios-row has-ic", window.IOSIcons.icon("orange", "calendar") + '<span class="ios-row-l">' + esc(lb ? lb.textContent : "") +
        '<small class="ios-row-s">' + esc(sb ? sb.textContent : "") + '</small></span><span class="ios-val mono ios-tone-' + toneOf(n) + '">' + esc(n ? n.textContent : "–") + '</span>'));
    });
    rowsOf.forEach(function (r) {
      var sps = r.querySelectorAll(":scope > span"); if (sps.length < 2) return;
      var ic = iconFor(sps[0].textContent);
      info.appendChild(el("div", "ios-row has-ic", window.IOSIcons.icon(ic[0], ic[1]) + '<span class="ios-row-l">' + sps[0].innerHTML + '</span><span class="ios-val mono">' + sps[1].innerHTML + '</span>'));
    });
    if (info.firstChild) page.appendChild(info);
    if (cert) { var cg = el("div", "ios-grp ios-cert"); cg.appendChild(cert); page.appendChild(cg); }

    // 3. Notes.
    if (tiles.length) {
      var count = notesUl ? notesUl.children.length : 0, head = el("p", "ios-grp-head"); head.textContent = count ? "Notes (" + count + ")" : "Notes";
      var grp = el("div", "ios-grp ios-notes");
      if (notesUl) {
        // Dans la page d'une matière, le nom de la matière est inutile sur chaque ligne : on garde l'intitulé, sinon le type.
        [].forEach.call(notesUl.querySelectorAll(".what"), function (w) {
          var t = w.textContent, meta = w.parentNode.querySelector(".meta");
          if (t === name) w.textContent = meta && /· TP/.test(meta.textContent) ? "TP" : "Test";
          else if (t.indexOf(name + " · ") === 0) w.textContent = t.slice(name.length + 3);
        });
        grp.appendChild(notesUl);
      } else {
        grp.appendChild(el("div", "ios-empty", window.Icons.svg("doc", "ios-empty-ic") + '<b>Aucune note pour l\'instant</b><span>Ajoute ta première note dans cette branche : la moyenne et la courbe apparaîtront ici.</span>' +
          '<button type="button" class="btn" data-dadd="1">Ajouter une note</button>'));
      }
      page.appendChild(head); page.appendChild(grp);
    }
    return page;
  }
  // État vide : « Ajouter une note » ouvre le formulaire sur cette matière.
  container.addEventListener("click", function (e) {
    if (!e.target.closest("[data-dadd]")) return;
    var id = window.NotesApp.detailId && window.NotesApp.detailId();
    window.NotesApp.goAdd();
    var sel = document.getElementById("f-subj");
    if (id && sel) {
      var s = window.NotesApp.subjectsAll().filter(function (x) { return x.id === id; })[0], leaf = s && s.parts ? s.parts[0] : id;
      if ([].some.call(sel.options, function (o) { return o.value === leaf; })) { sel.value = leaf; sel.dispatchEvent(new Event("change", { bubbles: true })); }
    }
  });
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
