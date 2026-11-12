/* Hors-ligne : la page vient du réseau si possible, sinon du cache ; le reste du cache d'abord. */
var V = "notes2m01-v48";
var ASSETS = ["./", "index.html", "fx.css", "ios.css", "fx.js", "ios-nav.js", "ios-motion.js", "ios-tabbar.js", "ios-title.js", "ios-settings.js", "ios-detail.js", "ios-anim.js", "icons.js", "NOTICE-Lucide.txt", "grid.js", "ta.js", "photos.js", "scan.js", "scanic.js", "NOTICE-Scanic.txt", "cert.js", "year.js", "notify.js", "sync.js", "onboard.js", "guide.js", "hello.js", "motion.js", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png"];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(V).then(function (c) { return c.addAll(ASSETS.map(function (u) { return new Request(u, { cache: "reload" }); })); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== V && k.indexOf("notes2m01-") === 0; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  if (req.mode === "navigate") {
    e.respondWith(fetch(req, { cache: "no-cache" }).then(function (res) {
      var copy = res.clone(); caches.open(V).then(function (c) { c.put("index.html", copy); }); return res;
    }).catch(function () { return caches.match("index.html"); }));
    return;
  }
  // Réseau d'abord pour tous les fichiers : toujours la dernière version quand il y a du réseau,
  // le cache seulement hors connexion (évite de mélanger des fichiers de versions différentes).
  e.respondWith(fetch(req, { cache: "no-cache" }).then(function (res) {
    if (res.ok) { var copy = res.clone(); caches.open(V).then(function (c) { c.put(req, copy); }); }
    return res;
  }).catch(function () { return caches.match(req, { ignoreSearch: true }); }));
});

/* ---------- Notifications (notify.js) ----------
   Le serveur relaie { d: message chiffré avec la clé du code }. La clé est dans IndexedDB (« notes2m01-push »), posée par
   l'app quand les notifications sont activées. Si le déchiffrement échoue, la notification dit seulement « Nouvelle note ». */
function pushKey() {
  return new Promise(function (ok, ko) {
    var rq = indexedDB.open("notes2m01-push", 1);
    rq.onupgradeneeded = function () { rq.result.createObjectStore("kv"); };
    rq.onerror = function () { ko(rq.error); };
    rq.onsuccess = function () {
      var d = rq.result, g = d.transaction("kv", "readonly").objectStore("kv").get("key");
      g.onsuccess = function () { d.close(); if (g.result) ok(g.result); else ko(new Error("no key")); };
      g.onerror = function () { d.close(); ko(g.error); };
    };
  });
}
function pushOpen(b64) {
  var bin = atob(b64), all = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) all[i] = bin.charCodeAt(i);
  return pushKey().then(function (key) { return crypto.subtle.decrypt({ name: "AES-GCM", iv: all.slice(0, 12) }, key, all.slice(12)); })
    .then(function (pt) { return JSON.parse(new TextDecoder().decode(pt)); });
}
self.addEventListener("push", function (e) {
  var plain = { title: "Notes", body: "Nouvelle note" };
  var p = Promise.resolve().then(function () { return pushOpen(e.data.json().d); }).then(function (m) {
    return { title: String(m.title || "Notes").slice(0, 80), body: String(m.body || "Nouvelle note").slice(0, 200), tag: m.t === "verdict" ? "verdict" : undefined };
  }, function () { return plain; }).then(function (n) {
    return self.registration.showNotification(n.title, { body: n.body, icon: "icon-192.png", badge: "icon-192.png", tag: n.tag });
  });
  e.waitUntil(p);
});
self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) if ("focus" in list[i]) return list[i].focus();
    return self.clients.openWindow("./");
  }));
});
