const CACHE_NAME = 'text-to-speech-reader-v1.0.3';
const APP_SHELL = ['./', './index.html', './manifest.json', './favicon.ico', './apple-touch-icon.png', './icon-192.png', './icon-512.png'];
self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(CACHE_NAME).then(function (cache) { return cache.addAll(APP_SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (event) {
  event.waitUntil(caches.keys().then(function (keys) { return Promise.all(keys.filter(function (key) { return key !== CACHE_NAME; }).map(function (key) { return caches.delete(key); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.match(event.request).then(function (cached) {
    if (cached) return cached;
    return fetch(event.request).then(function (response) {
      if (response.ok) { const copy = response.clone(); caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, copy); }); }
      return response;
    }).catch(function () { return caches.match('./index.html'); });
  }));
});
