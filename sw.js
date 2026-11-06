/* Hors-ligne : la page vient du réseau si possible, sinon du cache ; le reste du cache d'abord. */
var V = "notes2m01-v13";
var ASSETS = ["./", "index.html", "fx.css", "fx.js", "grid.js", "onboard.js", "motion.js", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png"];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(V).then(function (c) { return c.addAll(ASSETS.map(function (u) { return new Request(u, { cache: "reload" }); })); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== V; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then(function (res) {
      var copy = res.clone(); caches.open(V).then(function (c) { c.put("index.html", copy); }); return res;
    }).catch(function () { return caches.match("index.html"); }));
    return;
  }
  e.respondWith(caches.match(req).then(function (hit) {
    var net = fetch(req).then(function (res) { var copy = res.clone(); caches.open(V).then(function (c) { c.put(req, copy); }); return res; }).catch(function () { return hit; });
    return hit || net;
  }));
});
