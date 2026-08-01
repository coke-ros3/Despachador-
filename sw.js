// Aumentamos a la versión 3 para obligar al navegador a actualizar el diseño
const CACHE_NAME = 'bomberos-cad-v3';
const urlsToCache = [
  './',
  './index.html',
  './central.html',
  './central2.html',
  './maquinista.html',
  './gyras.html',
  './voluntarios.html',
  './loc.html',
  './style.css',
  './manifest.json',
  './manifest_voluntarios.json'
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
