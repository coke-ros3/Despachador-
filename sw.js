// Versión 6: se retiró "Conductores" del portal (todo pasa por la app de voluntarios) y se limpiaron títulos
const CACHE_NAME = 'bomberos-cad-v6';
const urlsToCache = [
  './',
  './index.html',
  './central.html',
  './central2.html',
  './gyras.html',
  './usuarios.html',
  './loc.html',
  './style.css',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

// Este bloque nuevo borra por completo el CSS antiguo y roto
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
