/* Notes : photos des tests. Chaque photo est une page rattachée à une note (ou à un ETA) par son identifiant.
   Stockage : IndexedDB, base à part (« notes2m01-photos »). Les photos restent sur l'appareil : elles ne passent ni par la
   synchronisation ni par la sauvegarde JSON (sauf l'export avec « Inclure les photos » en .zip de fx.js, 22 novembre 2026). Elles sont réduites avant l'enregistrement (côté long 2400 px, JPEG 85 %,
   environ 1 Mo par page, choix de l'utilisateur en v52 avec le retrait du scanner).
   Formulaire : « Photographier le test » ouvre l'appareil photo du téléphone (une page à la fois ; le bouton devient
   ensuite « Ajouter une page ») et « Choisir une photo » la photothèque (plusieurs à la fois). Les pages sont enregistrées
   tout de suite sous la clé « pending » (une erreur d'espace plein apparaît donc dans le formulaire), puis rattachées à
   la note quand elle est enregistrée (Photos.commit).
   Liste : une note avec photos porte data-photos ; la toucher ouvre la visionneuse plein écran (défilement horizontal).
   Aucune lecture automatique : la note est toujours tapée à la main. */
(function () {
  "use strict";
  function $(s, r) { return (r || document).querySelector(s); }
  function hap(k) { if (window.FX) FX.haptic(k); }
  var DB = "notes2m01-photos", STORE = "pages", PENDING = "pending", MAX_SIDE = 2400, QUALITY = 0.85;
  var FULL = "Impossible d'enregistrer la photo : l'espace de stockage de l'appareil est plein ou refusé. Libère de la place, puis réessaie.";
  var counts = {}, dbp = null;

  /* ---------- Base ---------- */
  function db() {
    if (dbp) return dbp;
    dbp = new Promise(function (ok, ko) {
      if (!window.indexedDB) return ko(new Error("indexedDB"));
      var rq = indexedDB.open(DB, 1);
      rq.onupgradeneeded = function () { rq.result.createObjectStore(STORE, { keyPath: "id", autoIncrement: true }).createIndex("note", "note"); };
      rq.onsuccess = function () { ok(rq.result); };
      rq.onerror = rq.onblocked = function () { ko(rq.error || new Error("indexedDB")); };
    });
    dbp.catch(function () { dbp = null; });
    return dbp;
  }
  // Exécute fn(store) dans une transaction ; résout avec la valeur renvoyée par fn (ou le résultat de la requête renvoyée).
  function tx(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (ok, ko) {
        var t = d.transaction(STORE, mode), out, r = fn(t.objectStore(STORE));
        if (r && "onsuccess" in r) r.onsuccess = function () { out = r.result; }; else out = r;
        t.oncomplete = function () { ok(out); };
        t.onerror = t.onabort = function () { ko(t.error || new Error("tx")); };
      });
    });
  }
  function pagesOf(note) {
    return tx("readonly", function (s) { return s.index("note").getAll(note); }).then(function (l) { return (l || []).sort(function (a, b) { return a.n - b.n || a.id - b.id; }); });
  }
  function add(note, blob) {
    return tx("readwrite", function (s) { return s.add({ note: note, n: Date.now(), blob: blob, at: Date.now() }); }).then(function (id) {
      counts[note] = (counts[note] || 0) + 1; changed(); return id;
    });
  }
  function delPage(id, note) {
    return tx("readwrite", function (s) { s.delete(id); }).then(function () { counts[note] = Math.max(0, (counts[note] || 1) - 1); changed(); });
  }
  function drop(notes) {
    notes = (notes || []).filter(function (n) { return counts[n]; });
    if (!notes.length) return Promise.resolve();
    notes.forEach(function (n) { delete counts[n]; });
    return tx("readwrite", function (s) {
      notes.forEach(function (n) {
        s.index("note").openKeyCursor(IDBKeyRange.only(n)).onsuccess = function (e) { var c = e.target.result; if (c) { s.delete(c.primaryKey); c.continue(); } };
      });
    }).then(changed).catch(function () {});
  }
  // Sauvegarde (fx.js) : le nombre de pages et la taille de l'export avec photos suivent chaque changement.
  function changed() { try { document.dispatchEvent(new Event("photos:changed")); } catch (e) {} }
  // Toutes les pages rattachées à une note (pas celles en attente du formulaire), dans l'ordre.
  function all() {
    return tx("readonly", function (s) { return s.getAll(); }).then(function (l) {
      return (l || []).filter(function (r) { return r.note !== PENDING && r.blob; }).sort(function (a, b) { return a.n - b.n || a.id - b.id; });
    });
  }
  // Restauration d'une sauvegarde avec photos : les pages du fichier remplacent toutes celles de l'appareil.
  function replaceAll(list) {
    return tx("readwrite", function (s) {
      s.clear();
      (list || []).forEach(function (r) { s.add({ note: r.note, n: r.n || Date.now(), blob: r.blob, at: r.at || Date.now() }); });
    }).then(loadCounts).then(function () { changed(); if (window.NotesApp) NotesApp.redraw(); });
  }
  function loadCounts() {
    return tx("readonly", function (s) {
      var c = {}; s.index("note").openKeyCursor().onsuccess = function (e) { var k = e.target.result; if (k) { c[k.key] = (c[k.key] || 0) + 1; k.continue(); } };
      return c;
    }).then(function (c) { counts = c; });
  }

  /* ---------- Réduction d'une image ---------- */
  function shrink(file) {
    return new Promise(function (ok, ko) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, MAX_SIDE / Math.max(w, h));
        var c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { if (b) ok(b); else ko(new Error("jpeg")); }, "image/jpeg", QUALITY);
      };
      img.onerror = function () { URL.revokeObjectURL(url); ko(new Error("image")); };
      img.src = url;
    });
  }
  // Ajoute les fichiers choisis à une note, l'un après l'autre. Résout avec le nombre de pages ajoutées ; rejette avec un message.
  function addFiles(note, files) {
    var list = [].slice.call(files || []).filter(function (f) { return /^image\//.test(f.type) || !f.type; }), n = 0;
    return list.reduce(function (p, f) {
      return p.then(function () { return shrink(f).then(null, function () { throw "Cette image n'a pas pu être lue. Essaie une photo au format JPEG ou PNG."; }); })
        .then(function (b) { return add(note, b).then(function () { n++; }, function () { throw FULL; }); });
    }, Promise.resolve()).then(function () { return n; }, function (m) { throw typeof m === "string" ? m : FULL; });
  }
  // camera : ouvre directement l'appareil photo (capture="environment", une photo) ; sinon la photothèque (plusieurs).
  function picker(cb, camera) {
    var i = document.createElement("input"); i.type = "file"; i.accept = "image/*"; i.className = "ios-ph-file";
    if (camera) i.setAttribute("capture", "environment"); else i.multiple = true;
    i.addEventListener("change", function () { var f = i.files; if (f && f.length) cb(f); i.remove(); });
    document.body.appendChild(i); i.click();
  }

  /* ---------- Formulaire « Ajouter une note » ---------- */
  var form = $("#form"), msg = $("#f-msg"), box = null, editId = null, urls = [];
  function freeUrls() { urls.forEach(function (u) { URL.revokeObjectURL(u); }); urls = []; }
  function drawPending() {
    if (!box) return;
    pagesOf(PENDING).then(function (l) {
      freeUrls();
      var had = editId && counts[editId] ? counts[editId] : 0;
      $("#ph-list", box).innerHTML = l.map(function (p, k) {
        var u = URL.createObjectURL(p.blob); urls.push(u);
        return '<span class="ios-ph-thumb"><img src="' + u + '" alt="Page ' + (k + 1) + '"><button type="button" class="ios-ph-x" data-ph-x="' + p.id + '" aria-label="Retirer la page ' + (k + 1) + '">×</button></span>';
      }).join("");
      $("#ph-add .ios-ph-t", box).textContent = l.length || had ? "Ajouter une page" : "Photographier le test";
      $("#ph-info", box).textContent = (had ? had + " photo" + (had > 1 ? "s" : "") + " déjà jointe" + (had > 1 ? "s" : "") + " à cette note. " : "") +
        "Les photos restent sur cet appareil : elles ne sont pas synchronisées. Pour les garder, Réglages → Sauvegarde → Exporter, puis « Inclure les photos ».";
    }, function () {});
  }
  if (form && msg) {
    box = document.createElement("div"); box.className = "ios-ph-box";
    // Sur téléphone (v58, style C), ios.css montre les deux boutons comme des lignes à carré d'icône dans un groupe.
    var I = window.Icons ? Icons.inner : {}, sq = function (c, n) { return '<i class="ios-ph-ic ios-ic ios-ic-' + c + '"><svg viewBox="0 0 24 24" aria-hidden="true">' + (I[n] || "") + '</svg></i>'; };
    var chev = '<svg class="ios-ph-chev ios-chev" viewBox="0 0 24 24" aria-hidden="true">' + (I.chevr || "") + '</svg>';
    box.innerHTML = '<div class="ios-ph-list" id="ph-list"></div><div class="ios-ph-btns"><button type="button" class="btn-ghost" id="ph-add">' + sq("blue", "camera") + '<span class="ios-ph-t">Photographier le test</span>' + chev + '</button>' +
      '<button type="button" class="link" id="ph-lib">' + sq("gray", "doc") + '<span class="ios-ph-t">Choisir une photo</span>' + chev + '</button></div><p class="muted small ios-ph-info" id="ph-info"></p>';
    msg.before(box);
    box.addEventListener("click", function (e) {
      var x = e.target.closest("[data-ph-x]");
      if (x) { delPage(+x.dataset.phX, PENDING).then(drawPending, drawPending); hap("tap"); return; }
      function pick(camera) {
        picker(function (files) {
          msg.style.color = ""; msg.textContent = "";
          addFiles(PENDING, files).then(function () { hap("success"); }, function (m) { msg.textContent = m; hap("error"); }).then(drawPending);
        }, camera);
      }
      if (e.target.closest("#ph-lib")) { pick(false); return; }
      // « Photographier le test » / « Ajouter une page » : l'appareil photo du téléphone (sur ordinateur : choix de fichier).
      if (e.target.closest("#ph-add")) pick(true);
    });
  }

  /* ---------- Visionneuse plein écran ---------- */
  var view = null, vNote = null, vUrls = [];
  var themeMeta = document.querySelector('meta[name="theme-color"]'), themeWas = null;
  function theme(on) { if (!themeMeta) return; if (on) { themeWas = themeMeta.content; themeMeta.content = "#000000"; } else if (themeWas != null) { themeMeta.content = themeWas; themeWas = null; } }
  function closeView() {
    if (!view) return;
    theme(false); document.removeEventListener("keydown", onKey);
    view.remove(); view = null; vNote = null; vUrls.forEach(function (u) { URL.revokeObjectURL(u); }); vUrls = [];
    document.removeEventListener("keydown", onKey);
    if (window.NotesApp) NotesApp.redraw();
  }
  function onKey(e) {
    if (e.key === "Escape") closeView();
    var t = view && $(".ios-ph-track", view);
    if (t && (e.key === "ArrowLeft" || e.key === "ArrowRight")) t.scrollBy({ left: (e.key === "ArrowRight" ? 1 : -1) * t.clientWidth, behavior: "smooth" });
  }
  function curIndex() { var t = $(".ios-ph-track", view); return t && t.clientWidth ? Math.round(t.scrollLeft / t.clientWidth) : 0; }
  function setCount() { var n = view.querySelectorAll(".ios-ph-page").length; $(".ios-ph-count", view).textContent = n ? (curIndex() + 1) + " / " + n : ""; }
  function drawView(goTo) {
    return pagesOf(vNote).then(function (l) {
      if (!view) return;
      if (!l.length) { closeView(); return; }
      vUrls.forEach(function (u) { URL.revokeObjectURL(u); }); vUrls = [];
      var t = $(".ios-ph-track", view);
      t.innerHTML = l.map(function (p, k) { var u = URL.createObjectURL(p.blob); vUrls.push(u); return '<div class="ios-ph-page" data-id="' + p.id + '"><img src="' + u + '" draggable="false" alt="Page ' + (k + 1) + ' sur ' + l.length + '"></div>'; }).join("");
      var i = Math.min(l.length - 1, Math.max(0, goTo == null ? 0 : goTo));
      t.scrollLeft = i * t.clientWidth; setCount();
    });
  }
  /* Gestes de la visionneuse (v60) : balayage horizontal entre les pages (défilement natif accroché), pincement et double
     toucher pour zoomer, glissement d'un doigt pour déplacer une page zoomée, glissement vers le bas pour fermer (le fond
     s'éclaircit pendant le geste), un toucher montre ou cache les commandes. Page zoomée : touch-action none (pas de
     défilement entre pages tant qu'elle est zoomée ; double toucher pour revenir). */
  var ZMAX = 5, ZTAP = 2.5, DISMISS = 110;
  function gestures(v) {
    var track = $(".ios-ph-track", v), P = {}, g = null, tapT = 0, tapX = 0, tapY = 0, chromeTimer = 0;
    function zOf(pg) { return pg._z || (pg._z = { s: 1, x: 0, y: 0 }); }
    function clampZ(pg) {
      var z = zOf(pg), img = pg.firstChild, mx = Math.max(0, (img.clientWidth * z.s - pg.clientWidth) / 2), my = Math.max(0, (img.clientHeight * z.s - pg.clientHeight) / 2);
      z.x = Math.max(-mx, Math.min(mx, z.x)); z.y = Math.max(-my, Math.min(my, z.y));
    }
    function paintZ(pg, anim) {
      var z = zOf(pg), img = pg.firstChild;
      img.classList.toggle("is-anim", !!anim);
      img.style.transform = z.s === 1 && !z.x && !z.y ? "" : "translate3d(" + z.x.toFixed(1) + "px," + z.y.toFixed(1) + "px,0) scale(" + z.s.toFixed(3) + ")";
      pg.classList.toggle("is-zoomed", z.s > 1.01);
    }
    function zoomAt(pg, s, px, py, base) {   // garde le point (px, py) de l'écran sous le doigt
      var r = pg.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, z = zOf(pg);
      var ux = (px - cx - base.x) / base.s, uy = (py - cy - base.y) / base.s;
      z.s = Math.max(1, Math.min(ZMAX, s)); z.x = px - cx - ux * z.s; z.y = py - cy - uy * z.s; clampZ(pg);
    }
    function pageOf(e) { return e.target.closest && e.target.closest(".ios-ph-page"); }
    function drag(dy) {   // fermeture par glissement : la page suit le doigt, le fond s'éclaircit
      var a = Math.max(0, 1 - Math.abs(dy) / (window.innerHeight * 0.6));
      track.style.transform = "translate3d(0," + dy.toFixed(1) + "px,0) scale(" + (1 - Math.min(0.15, Math.abs(dy) / 1500)).toFixed(3) + ")";
      v.style.setProperty("--ios-ph-a", a.toFixed(3)); v.classList.add("is-dragging");
    }
    function settle(close) {
      v.classList.remove("is-dragging"); v.classList.add("is-settling");
      if (close) { track.style.transform = "translate3d(0,100%,0)"; v.style.setProperty("--ios-ph-a", 0); setTimeout(closeView, 180); return; }
      track.style.transform = ""; v.style.removeProperty("--ios-ph-a"); setTimeout(function () { v.classList.remove("is-settling"); }, 220);
    }
    track.addEventListener("pointerdown", function (e) {
      var pg = pageOf(e); if (!pg || (e.pointerType === "mouse" && e.button !== 0)) return;
      P[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(P), z = zOf(pg);
      if (ids.length === 2) {
        var a = P[ids[0]], b = P[ids[1]];
        g = { mode: "pinch", pg: pg, d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, base: { s: z.s, x: z.x, y: z.y } };
      } else if (ids.length === 1) {
        g = { mode: "one", pg: pg, x0: e.clientX, y0: e.clientY, t0: e.timeStamp, base: { s: z.s, x: z.x, y: z.y }, moved: false };
      }
      try { track.setPointerCapture(e.pointerId); } catch (x) {}
    });
    track.addEventListener("pointermove", function (e) {
      if (!P[e.pointerId] || !g) return;
      P[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (g.mode === "pinch") {
        var ids = Object.keys(P); if (ids.length < 2) return;
        var a = P[ids[0]], b = P[ids[1]], d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        zoomAt(g.pg, g.base.s * d / g.d0, g.mx, g.my, g.base);
        var z = zOf(g.pg); z.x += mx - g.mx; z.y += my - g.my; clampZ(g.pg); paintZ(g.pg, false);
        return;
      }
      var dx = e.clientX - g.x0, dy = e.clientY - g.y0, z1 = zOf(g.pg);
      if (Math.abs(dx) + Math.abs(dy) > 10) g.moved = true;
      if (z1.s > 1.01) { z1.x = g.base.x + dx; z1.y = g.base.y + dy; clampZ(g.pg); paintZ(g.pg, false); return; }
      if (g.drag || (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx) * 1.2)) { g.drag = true; drag(dy); e.preventDefault(); }
    });
    function up(e) {
      if (!P[e.pointerId]) return;
      delete P[e.pointerId];
      var pg = g && g.pg, was = g; if (!was) return;
      if (was.mode === "pinch") {
        var z = zOf(pg); if (z.s < 1.05) { z.s = 1; z.x = 0; z.y = 0; paintZ(pg, true); }
        g = null; P = {}; return;
      }
      g = null;
      if (was.drag) { var dy = e.clientY - was.y0, vy = dy / Math.max(1, e.timeStamp - was.t0); settle(e.type === "pointerup" && (Math.abs(dy) > DISMISS || (Math.abs(vy) > 0.6 && Math.abs(dy) > 40))); return; }
      if (e.type !== "pointerup" || was.moved || e.timeStamp - was.t0 > 350) return;
      // Toucher : double = zoom (ou retour), simple = commandes cachées / montrées
      if (tapT && e.timeStamp - tapT < 300 && Math.hypot(e.clientX - tapX, e.clientY - tapY) < 40) {
        tapT = 0; clearTimeout(chromeTimer);
        var z2 = zOf(pg);
        if (z2.s > 1.01) { z2.s = 1; z2.x = 0; z2.y = 0; } else zoomAt(pg, ZTAP, e.clientX, e.clientY, { s: 1, x: 0, y: 0 });
        paintZ(pg, true); hap("tap");
      } else {
        tapT = e.timeStamp; tapX = e.clientX; tapY = e.clientY;
        chromeTimer = setTimeout(function () { if (view === v) v.classList.toggle("is-bare"); tapT = 0; }, 300);
      }
    }
    track.addEventListener("pointerup", up);
    track.addEventListener("pointercancel", up);
  }

  function openView(note) {
    if (view || !counts[note]) return;
    vNote = note;
    view = document.createElement("div"); view.className = "ios-ph-view"; view.setAttribute("role", "dialog"); view.setAttribute("aria-label", "Photos du test");
    var I = window.Icons ? Icons.svg : function () { return ""; };
    view.innerHTML = '<div class="ios-ph-track"></div>' +
      '<div class="ios-ph-bar"><button type="button" class="ios-ph-rb" data-ph="close" aria-label="Fermer">' + I("times") + '</button><span class="ios-ph-count" aria-live="polite"></span>' +
      '<span class="ios-ph-acts"><button type="button" class="ios-ph-rb" data-ph="add" aria-label="Ajouter une page">' + I("add") + '</button><button type="button" class="ios-ph-rb is-danger" data-ph="del" aria-label="Supprimer cette page">' + I("trash") + '</button></span></div>' +
      '<p class="ios-ph-msg" role="alert"></p>';
    theme(true);
    document.body.appendChild(view);
    $(".ios-ph-track", view).addEventListener("scroll", setCount, { passive: true });
    gestures(view);
    view.addEventListener("click", function (e) {
      var b = e.target.closest("[data-ph]"); if (!b) return;
      var m = $(".ios-ph-msg", view); m.textContent = "";
      if (b.dataset.ph === "close") closeView();
      if (b.dataset.ph === "add") {
        var n = view.querySelectorAll(".ios-ph-page").length;
        picker(function (files) {
          addFiles(vNote, files).then(function () { hap("success"); }, function (t) { m.textContent = t; hap("error"); }).then(function () { return drawView(n); });
        }, true);
      }
      if (b.dataset.ph === "del") {
        var i = curIndex(), p = view.querySelectorAll(".ios-ph-page")[i]; if (!p) return;
        IOSSheet.confirm({ title: "Supprimer cette page ?", message: "Elle ne pourra pas être récupérée.", ok: "Supprimer la page" }).then(function (ok) {
          if (ok && view) delPage(+p.dataset.id, vNote).then(function () { hap("heavy"); return drawView(i); });
        });
      }
    });
    document.addEventListener("keydown", onKey);
    drawView(0);
  }
  // Toucher une note qui a des photos (hors boutons « Modifier » / « Supprimer ») ouvre ses photos.
  document.addEventListener("click", function (e) {
    if (view || e.target.closest("button, a, input, select, summary")) return;
    var li = e.target.closest("[data-photos]"); if (li) { hap("tap"); openView(li.dataset.photos); }
  });

  window.Photos = {
    count: function (note) { return counts[note] || 0; },
    // Page de détail (ios-detail.js) : le bouton « Photos » des actions d'une note ouvre la visionneuse.
    open: function (note) { if (!view && counts[note]) { hap("tap"); openView(note); } },
    // Formulaire remis à zéro : les pages en attente sont abandonnées.
    reset: function () { editId = null; if (counts[PENDING]) drop([PENDING]).then(drawPending); else drawPending(); },
    onEdit: function (g) { editId = g && g.id; drawPending(); },
    // La note vient d'être enregistrée : les pages en attente lui sont rattachées.
    commit: function (note) {
      if (!counts[PENDING]) return;
      var n = counts[PENDING]; delete counts[PENDING]; counts[note] = (counts[note] || 0) + n;
      tx("readwrite", function (s) {
        s.index("note").openCursor(IDBKeyRange.only(PENDING)).onsuccess = function (e) { var c = e.target.result; if (c) { var v = c.value; v.note = note; c.update(v); c.continue(); } };
      }).then(changed, function () { counts[note] = Math.max(0, counts[note] - n); IOSSheet.notice({ title: "Photo non enregistrée", message: FULL }); }).then(function () { if (window.NotesApp) NotesApp.redraw(); });
    },
    drop: drop,
    all: all,
    replaceAll: replaceAll,
    // Nombre de pages rattachées à une note (sans celles en attente).
    pages: function () { var n = 0; for (var k in counts) if (k !== PENDING) n += counts[k]; return n; },
    open: openView
  };

  // Au démarrage : pages abandonnées retirées, puis compteurs chargés et liste redessinée.
  loadCounts().then(function () { return counts[PENDING] ? drop([PENDING]) : null; }).then(function () {
    drawPending(); changed(); if (window.NotesApp && Object.keys(counts).length) NotesApp.redraw();
  }, function () { drawPending(); });
})();
