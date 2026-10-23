// ============================================================
// (مشكاة) — Service Worker Resmi
// Offline First Cache & Asset Management
// ============================================================

const CACHE_NAME = 'misykah-v1.2.0';
const STATIC_ASSETS = [
  './',
  './index.html',
  './dashboard.html',
  './murojaah.html',
  './muhadharah.html',
  './books.html',
  './belajar.html',
  './faidah.html',
  './privacy.html',
  './assets/css/style.css',
  './assets/js/app.js',
  './assets/icons/logo.svg',
  './favicon.svg',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Only cache GET requests
  if (event.request.method !== 'GET') return;
  // Ignore chrome-extension or external analytics
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        // Fetch in background to update cache (Stale-While-Revalidate)
        fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }
      return fetch(event.request).then(networkResponse => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
        return networkResponse;
      });
    }).catch(() => {
      // Offline fallback
      const acceptHeader = event.request.headers.get('accept') || '';
      if (acceptHeader.includes('text/html')) {
        return caches.match('./dashboard.html').then(res => res || caches.match('./index.html'));
      }
    })
  );
});
