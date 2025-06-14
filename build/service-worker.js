console.log('Service worker registered!');
const CACHE_VERSION = 'v96'; // Increment this version with each deployment
const CACHE_NAME = `my-pwa-cache-${CACHE_VERSION}`;
const urlsToCache = [
  '/', // Cache the root (index.html)
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/logo192.png',
  '/logo512.png',
  '/static/js/main.fb0d904d.js',
  '/static/css/main.a5403ca5.css'
];

self.addEventListener('install', event => {
  console.log('Service worker installing.');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()) // Force waiting service worker to become active
  );
});

self.addEventListener('activate', event => {
  console.log('Service worker activated.');
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!cacheWhitelist.includes(cacheName)) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Claim clients immediately
  );
});

self.addEventListener('fetch', event => {
  // Bypass caching for Firebase Auth endpoints to prevent auth state issues.
  if (event.request.url.includes('/__/auth/')) {
    return event.respondWith(fetch(event.request));
  }
  
  // For navigation requests, use a network-first strategy.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Update the cache with the fresh index.html
          return caches.open(CACHE_NAME).then(cache => {
            cache.put('/index.html', response.clone());
            return response;
          });
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }
  
  // For all other requests, use a cache-first strategy.
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          console.log('Serving from cache:', event.request.url);
          return response;
        }
        console.log('Fetching from network:', event.request.url);
        return fetch(event.request);
      })
  );
});
