// Tagoloan Water District Meter Reader - Service Worker
const CACHE_NAME = 'twd-reader-v2';

// Essential offline fallback assets
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/apple-touch-icon.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Precache critical assets gracefully (don't fail install if an asset fails)
      return Promise.allSettled(
        PRECACHE_ASSETS.map((url) => cache.add(url).catch((err) => {
          console.warn('[TWD-SW] Precache skip:', url, err);
        }))
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // 1. Skip non-GET requests (POST, PUT, DELETE should pass directly to network)
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // 2. Skip WebSocket upgrades, chrome-extension, and non-http(s) schemes
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }
  if (url.pathname.startsWith('/ws') || url.pathname.startsWith('/socket')) {
    return;
  }

  // 3. For API endpoints (/api/*): Network-first with silent fallback (do not throw TypeError)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        // Return a clean offline 503 response instead of an uncaught rejected promise
        return new Response(
          JSON.stringify({
            error: 'Offline',
            message: 'Network request unavailable in offline mode. Local cached database active.',
            offline: true
          }),
          {
            status: 503,
            statusText: 'Service Unavailable (Offline)',
            headers: { 'Content-Type': 'application/json' }
          }
        );
      })
    );
    return;
  }

  // 4. For app navigation (HTML page load): Network-first falling back to cached index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const fallback = await caches.match('/index.html') || await caches.match('/');
          if (fallback) return fallback;
          return new Response('<h1>Tagoloan Water District Meter Reader</h1><p>Offline mode. Please check connection.</p>', {
            status: 503,
            headers: { 'Content-Type': 'text/html' }
          });
        })
    );
    return;
  }

  // 5. For static assets (JS, CSS, images, fonts): Stale-while-revalidate or Network-first
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          // If network failed and we had a cached response, it will be returned below.
          // If neither is available, return empty fallback or 404 instead of throwing an unhandled rejection.
          return cachedResponse || new Response(null, { status: 408, statusText: 'Request Timed Out' });
        });

      return cachedResponse || fetchPromise;
    })
  );
});
