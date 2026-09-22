// Corea de bolsillo · service worker
var VERSION = '202609222018-331cef5d';
var CORE = 'corea-core-' + VERSION;
var FONTS = 'corea-fonts';
var FILES = ['./', 'index.html', 'app.bin', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CORE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CORE && k !== FONTS; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function withTimeout(p, ms) {
  return new Promise(function (resolve, reject) {
    var t = setTimeout(function () { reject(new Error('timeout')); }, ms);
    p.then(function (r) { clearTimeout(t); resolve(r); }, function (err) { clearTimeout(t); reject(err); });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONTS).then(function (c) {
      return c.match(req).then(function (hit) {
        return hit || fetch(req).then(function (res) { c.put(req, res.clone()); return res; });
      });
    }));
    return;
  }
  if (url.origin !== self.location.origin) return;
  // Red primero (para recibir los cambios), y la copia guardada si no hay conexión
  e.respondWith(caches.open(CORE).then(function (c) {
    return withTimeout(fetch(req, { cache: 'no-cache' }), 5000).then(function (res) {
      if (res && res.ok) c.put(req, res.clone());
      return res;
    }).catch(function () {
      return c.match(req, { ignoreSearch: true }).then(function (hit) {
        return hit || c.match('index.html');
      });
    });
  }));
});
