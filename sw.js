// Corea de bolsillo · service worker
var VERSION = '202609241041-6c00365b';
var CORE = 'corea-core-' + VERSION;
var FONTS = 'corea-fonts';
var DOCS = 'corea-docs';
var DOC_FILES = ["d/008f2b0f3b985dec.bin", "d/7a52fdc2dc78cc85.bin", "d/ca26fa048db4c8db.bin", "d/0fdcd13258959fa0.bin", "d/c07df9cb131a41e0.bin", "d/56761797a70c76a2.bin", "d/50cb983e6c0c8471.bin", "d/93ece93d718fde40.bin", "d/5fb4226af4bf35f9.bin", "d/8eebccf912b1783a.bin", "d/c4496af5fc123dd8.bin", "d/58e346e3413212cc.bin", "d/ebc59bf971d9a29f.bin"];
var FILES = ['./', 'index.html', 'app.bin', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];

// Los documentos se guardan aparte y solo se descargan si cambian
function cacheDocs() {
  return caches.open(DOCS).then(function (c) {
    return Promise.all(DOC_FILES.map(function (f) {
      return c.match(f).then(function (hit) { return hit || c.add(f).catch(function () {}); });
    }));
  });
}
self.addEventListener('install', function (e) {
  e.waitUntil(Promise.all([
    caches.open(CORE).then(function (c) { return c.addAll(FILES); }),
    cacheDocs().catch(function () {})
  ]).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  var keep = DOC_FILES.map(function (f) { return new URL(f, self.registration.scope).href; });
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CORE && k !== FONTS && k !== DOCS; }).map(function (k) { return caches.delete(k); }));
  }).then(function () {
    return caches.open(DOCS).then(function (c) {
      return c.keys().then(function (reqs) {
        return Promise.all(reqs.filter(function (r) { return keep.indexOf(r.url) < 0; }).map(function (r) { return c.delete(r); }));
      });
    });
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
  if (/\/d\/[^/]+\.bin$/.test(url.pathname)) {
    e.respondWith(caches.open(DOCS).then(function (c) {
      return c.match(req, { ignoreSearch: true }).then(function (hit) {
        return hit || fetch(req).then(function (res) { if (res && res.ok) c.put(req, res.clone()); return res; });
      });
    }));
    return;
  }
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
