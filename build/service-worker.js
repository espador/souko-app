console.log('Service worker registered!');

const CACHE_NAME = 'my-pwa-cache-v2'; // Increment version to force cache update for new deployments!
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json', // Good practice to cache manifest
  '/favicon.ico',    // Good practice to cache favicon
  '/logo192.png',
  '/logo512.png',
  '/static/js/main.6453ad09.js', // Adjust based on your build output
  '/static/css/main.baafca37.css',    // <--- REPLACE THIS PLACEHOLDER! (If your CSS is in main.css, otherwise adjust)
];

self.addEventListener('install', event => {
  console.log('Service worker installing.');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('activate', event => {
  console.log('Service worker activated.');
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName); // Delete caches that are not in the whitelist
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          console.log('Serving from cache:', event.request.url);
          return response;
        }

        // Not in cache - fetch from network
        console.log('Fetching from network:', event.request.url);
        return fetch(event.request);
      })
  );
});