// Corea de bolsillo · service worker
var VERSION = '202609241515-2bc9e0ab';
var CORE = 'corea-core-' + VERSION;
var FONTS = 'corea-fonts';
var DOCS = 'corea-docs';
var DOC_FILES = ["d/8e3f81b8a4c25e0e.bin", "d/1ac19cbe2550188b.bin", "d/ba505f4f12d8ad14.bin", "d/47b5d1967a4b52e1.bin", "d/ac7cfa617170aec8.bin", "d/166cc6ec3d80ba23.bin", "d/2980b6c2839b33bf.bin", "d/c62678a8cee6d136.bin", "d/48d3ae6a9ecb82a0.bin", "d/094adb882403cff3.bin", "d/8a5c8bece0a15490.bin", "d/0209b8ea2b0593ed.bin", "d/a757fc40f6a4188b.bin", "d/d288509586c75ec9.bin"];
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
