const CACHE_NAME = 'bomberos-cad-v2';
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

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
