/* Notes : photos des tests. Chaque photo est une page rattachée à une note (ou à un ETA) par son identifiant.
   Stockage : IndexedDB, base à part (« notes2m01-photos »). Les photos restent sur l'appareil : elles ne passent ni par la
   synchronisation ni par la sauvegarde JSON. Elles sont réduites avant l'enregistrement (côté long 1600 px, JPEG).
   Formulaire : « Photographier le test » ajoute des pages (enregistrées tout de suite sous la clé « pending », pour qu'une
   erreur d'espace plein apparaisse dans le formulaire), rattachées à la note quand elle est enregistrée (Photos.commit).
   Liste : une note avec photos porte data-photos ; la toucher ouvre la visionneuse plein écran (défilement horizontal).
   Aucune lecture automatique : la note est toujours tapée à la main. */
(function () {
  "use strict";
  function $(s, r) { return (r || document).querySelector(s); }
  function hap(k) { if (window.FX) FX.haptic(k); }
  var DB = "notes2m01-photos", STORE = "pages", PENDING = "pending", MAX_SIDE = 1600, QUALITY = 0.72;
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
      counts[note] = (counts[note] || 0) + 1; return id;
    });
  }
  function delPage(id, note) {
    return tx("readwrite", function (s) { s.delete(id); }).then(function () { counts[note] = Math.max(0, (counts[note] || 1) - 1); });
  }
  function drop(notes) {
    notes = (notes || []).filter(function (n) { return counts[n]; });
    if (!notes.length) return Promise.resolve();
    notes.forEach(function (n) { delete counts[n]; });
    return tx("readwrite", function (s) {
      notes.forEach(function (n) {
        s.index("note").openKeyCursor(IDBKeyRange.only(n)).onsuccess = function (e) { var c = e.target.result; if (c) { s.delete(c.primaryKey); c.continue(); } };
      });
    }).catch(function () {});
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
  function picker(cb) {
    var i = document.createElement("input"); i.type = "file"; i.accept = "image/*"; i.multiple = true; i.className = "ios-ph-file";
    i.addEventListener("change", function () { var f = i.files; if (f && f.length) cb(f); i.remove(); });
    document.body.appendChild(i); i.click();
  }

  // Ouvre le scanner pour la note `note` ; `fallback(message)` est appelé si la caméra ne peut pas servir.
  function scanOr(note, done, fallback) {
    if (!window.Scan || !Scan.available()) { fallback(""); return; }
    Scan.open({
      onPage: function (blob) { return add(note, blob).then(null, function () { throw FULL; }); },
      onClose: function () { done(); },
      onUnavailable: function (m) { fallback(m); }
    });
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
      $("#ph-add", box).textContent = l.length || had ? "Scanner une autre page" : "Photographier le test";
      $("#ph-info", box).textContent = (had ? had + " photo" + (had > 1 ? "s" : "") + " déjà jointe" + (had > 1 ? "s" : "") + " à cette note. " : "") +
        "Les photos restent sur cet appareil : elles ne sont ni synchronisées ni dans la sauvegarde.";
    }, function () {});
  }
  if (form && msg) {
    box = document.createElement("div"); box.className = "ios-ph-box";
    box.innerHTML = '<div class="ios-ph-list" id="ph-list"></div><div class="ios-ph-btns"><button type="button" class="btn-ghost" id="ph-add">Photographier le test</button>' +
      '<button type="button" class="link" id="ph-lib">Choisir une photo</button></div><p class="muted small ios-ph-info" id="ph-info"></p>';
    msg.before(box);
    box.addEventListener("click", function (e) {
      var x = e.target.closest("[data-ph-x]");
      if (x) { delPage(+x.dataset.phX, PENDING).then(drawPending, drawPending); hap("tap"); return; }
      function pick() {
        picker(function (files) {
          msg.style.color = ""; msg.textContent = "";
          addFiles(PENDING, files).then(function () { hap("success"); }, function (m) { msg.textContent = m; hap("error"); }).then(drawPending);
        });
      }
      if (e.target.closest("#ph-lib")) { pick(); return; }
      // « Photographier le test » : le scanner de l'app (caméra en direct, prise automatique) ; sinon le choix de photo.
      if (e.target.closest("#ph-add")) scanOr(PENDING, drawPending, function (m) { if (m) { msg.style.color = ""; msg.textContent = m; } pick(); });
    });
  }

  /* ---------- Visionneuse plein écran ---------- */
  var view = null, vNote = null, vUrls = [];
  function closeView() {
    if (!view) return;
    view.remove(); view = null; vNote = null; vUrls.forEach(function (u) { URL.revokeObjectURL(u); }); vUrls = [];
    document.removeEventListener("keydown", onKey);
    if (window.NotesApp) NotesApp.redraw();
  }
  function onKey(e) { if (e.key === "Escape") closeView(); }
  function curIndex() { var t = $(".ios-ph-track", view); return t && t.clientWidth ? Math.round(t.scrollLeft / t.clientWidth) : 0; }
  function setCount() { var n = view.querySelectorAll(".ios-ph-page").length; $(".ios-ph-count", view).textContent = n ? (curIndex() + 1) + " / " + n : ""; }
  function drawView(goTo) {
    return pagesOf(vNote).then(function (l) {
      if (!view) return;
      if (!l.length) { closeView(); return; }
      vUrls.forEach(function (u) { URL.revokeObjectURL(u); }); vUrls = [];
      var t = $(".ios-ph-track", view);
      t.innerHTML = l.map(function (p, k) { var u = URL.createObjectURL(p.blob); vUrls.push(u); return '<div class="ios-ph-page" data-id="' + p.id + '"><img src="' + u + '" alt="Page ' + (k + 1) + ' sur ' + l.length + '"></div>'; }).join("");
      var i = Math.min(l.length - 1, Math.max(0, goTo == null ? 0 : goTo));
      t.scrollLeft = i * t.clientWidth; setCount();
    });
  }
  function openView(note) {
    if (view || !counts[note]) return;
    vNote = note;
    view = document.createElement("div"); view.className = "ios-ph-view"; view.setAttribute("role", "dialog"); view.setAttribute("aria-label", "Photos du test");
    view.innerHTML = '<div class="ios-ph-bar"><button type="button" class="link" data-ph="close">Fermer</button><span class="ios-ph-count" aria-live="polite"></span>' +
      '<span class="ios-ph-acts"><button type="button" class="link" data-ph="add">Ajouter</button><button type="button" class="link danger" data-ph="del">Supprimer</button></span></div>' +
      '<div class="ios-ph-track"></div><p class="ios-ph-msg" role="alert"></p>';
    document.body.appendChild(view);
    $(".ios-ph-track", view).addEventListener("scroll", setCount, { passive: true });
    view.addEventListener("click", function (e) {
      var b = e.target.closest("[data-ph]"); if (!b) return;
      var m = $(".ios-ph-msg", view); m.textContent = "";
      if (b.dataset.ph === "close") closeView();
      if (b.dataset.ph === "add") {
        var n = view.querySelectorAll(".ios-ph-page").length;
        scanOr(vNote, function () { if (view) drawView(n); }, function (t0) {
          if (t0 && view) m.textContent = t0;
          picker(function (files) {
            addFiles(vNote, files).then(function () { hap("success"); }, function (t) { m.textContent = t; hap("error"); }).then(function () { return drawView(n); });
          });
        });
      }
      if (b.dataset.ph === "del") {
        var i = curIndex(), p = view.querySelectorAll(".ios-ph-page")[i]; if (!p) return;
        hap("warn");
        if (!window.confirm("Supprimer cette page ? Elle ne pourra pas être récupérée.")) return;
        delPage(+p.dataset.id, vNote).then(function () { hap("heavy"); return drawView(i); });
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
    // Formulaire remis à zéro : les pages en attente sont abandonnées.
    reset: function () { editId = null; if (counts[PENDING]) drop([PENDING]).then(drawPending); else drawPending(); },
    onEdit: function (g) { editId = g && g.id; drawPending(); },
    // La note vient d'être enregistrée : les pages en attente lui sont rattachées.
    commit: function (note) {
      if (!counts[PENDING]) return;
      var n = counts[PENDING]; delete counts[PENDING]; counts[note] = (counts[note] || 0) + n;
      tx("readwrite", function (s) {
        s.index("note").openCursor(IDBKeyRange.only(PENDING)).onsuccess = function (e) { var c = e.target.result; if (c) { var v = c.value; v.note = note; c.update(v); c.continue(); } };
      }).then(null, function () { counts[note] = Math.max(0, counts[note] - n); window.alert(FULL); }).then(function () { if (window.NotesApp) NotesApp.redraw(); });
    },
    drop: drop,
    open: openView
  };

  // Au démarrage : pages abandonnées retirées, puis compteurs chargés et liste redessinée.
  loadCounts().then(function () { return counts[PENDING] ? drop([PENDING]) : null; }).then(function () {
    drawPending(); if (window.NotesApp && Object.keys(counts).length) NotesApp.redraw();
  }, function () { drawPending(); });
})();
