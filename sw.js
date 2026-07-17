const CACHE_NAME = 'bomberos-cad-v1';
const urlsToCache = [
  './',
  './index.html',
  './central.html',
  './carro.html',
  './maquinista.html',
  './gyras.html',
  './style.css',
  './app.js',
  './carro.js',
  './gyras.js',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event
