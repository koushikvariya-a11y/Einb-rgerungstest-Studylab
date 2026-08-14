// Progressive Web App Service Worker for Einbürgerungstest Study Lab
// Caches application shell, fonts, bundled questions, and question visual assets for offline study.
// Strictly excludes Firebase Auth, Firestore, OAuth, Analytics, and API requests.

const CACHE_VERSION = 'v1.0.2';
const SHELL_CACHE = `studylab-shell-${CACHE_VERSION}`;
const IMAGES_CACHE = `studylab-images-${CACHE_VERSION}`;

// Precache list: core shell and all 43 BAMF question visual diagrams
const PRECACHE_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-maskable-512x512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon-48x48.png',
  '/icons/icon.svg'
];

const PRECACHE_IMAGES = [
  '/question-images/general-21.png',
  '/question-images/general-55.png',
  '/question-images/general-70.png',
  '/question-images/general-130.png',
  '/question-images/general-176.png',
  '/question-images/general-181.png',
  '/question-images/general-187.png',
  '/question-images/general-209.png',
  '/question-images/general-216.png',
  '/question-images/general-226.png',
  '/question-images/general-235.png',
  '/question-images/baden-wurttemberg-1.png',
  '/question-images/baden-wurttemberg-8.png',
  '/question-images/bayern-1.png',
  '/question-images/bayern-8.png',
  '/question-images/berlin-1.png',
  '/question-images/berlin-8.png',
  '/question-images/brandenburg-1.png',
  '/question-images/brandenburg-8.png',
  '/question-images/bremen-1.png',
  '/question-images/bremen-8.png',
  '/question-images/hamburg-1.png',
  '/question-images/hamburg-8.png',
  '/question-images/hessen-1.png',
  '/question-images/hessen-8.png',
  '/question-images/mecklenburg-vorpommern-1.png',
  '/question-images/mecklenburg-vorpommern-8.png',
  '/question-images/niedersachsen-1.png',
  '/question-images/niedersachsen-8.png',
  '/question-images/nordrhein-westfalen-1.png',
  '/question-images/nordrhein-westfalen-8.png',
  '/question-images/rheinland-pfalz-1.png',
  '/question-images/rheinland-pfalz-8.png',
  '/question-images/saarland-1.png',
  '/question-images/saarland-8.png',
  '/question-images/sachsen-1.png',
  '/question-images/sachsen-8.png',
  '/question-images/sachsen-anhalt-1.png',
  '/question-images/sachsen-anhalt-8.png',
  '/question-images/schleswig-holstein-1.png',
  '/question-images/schleswig-holstein-8.png',
  '/question-images/thuringen-1.png',
  '/question-images/thuringen-8.png'
];

// Domains and paths to NEVER cache (Firebase Auth, Firestore, OAuth, Analytics, API endpoints)
function isExcluded(request, url) {
  const host = url.hostname;
  const path = url.pathname;

  if (
    host.includes('googleapis.com') ||
    host.includes('google.com') ||
    host.includes('firebase') ||
    host.includes('firestore') ||
    host.includes('identitytoolkit') ||
    host.includes('securetoken') ||
    host.includes('accounts.google.com') ||
    host.includes('apis.google.com') ||
    host.includes('sentry.io') ||
    host.includes('vercel-insights.com') ||
    host.includes('vercel-analytics.com') ||
    host.includes('va.vercel-scripts.com') ||
    path.startsWith('/api/') ||
    path.startsWith('/_vercel/') ||
    url.protocol.startsWith('chrome-extension')
  ) {
    return true;
  }

  // Also exclude any request with authorization headers
  if (request && request.headers && request.headers.has('authorization')) {
    return true;
  }

  return false;
}

// 1. Install Event: Precache app shell and question assets
// NOTE: We do NOT call self.skipWaiting() here to avoid abruptly replacing running application code
// during active user quiz or exam sessions.
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const shellCache = await caches.open(SHELL_CACHE);
      await shellCache.addAll(PRECACHE_SHELL).catch((err) => {
        console.warn('SW shell precache warning:', err);
      });

      const imagesCache = await caches.open(IMAGES_CACHE);
      await imagesCache.addAll(PRECACHE_IMAGES).catch((err) => {
        console.warn('SW images precache warning:', err);
      });
    })()
  );
});

// Explicit message listener to safely skip waiting on user/lifecycle demand
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// 2. Activate Event: Claim clients and purge stale caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheKeys = await caches.keys();
      await Promise.all(
        cacheKeys.map((key) => {
          if (
            key.startsWith('studylab-') &&
            key !== SHELL_CACHE &&
            key !== IMAGES_CACHE
          ) {
            console.log('Purging outdated cache:', key);
            return caches.delete(key);
          }
          return Promise.resolve();
        })
      );
      return self.clients.claim();
    })()
  );
});

// 3. Fetch Event Routing
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only intercept standard GET requests
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Check bypass rules
  if (isExcluded(request, url)) {
    return;
  }

  // Navigation requests: Network-first with cached shell fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(SHELL_CACHE);
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (error) {
          // Offline fallback: serve cached index.html or root
          const cached = (await caches.match('/index.html')) || (await caches.match('/'));
          if (cached) return cached;
          throw error;
        }
      })()
    );
    return;
  }

  // Question Images: Cache-first with network fallback
  if (url.pathname.includes('/question-images/')) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;

        try {
          const response = await fetch(request);
          if (response && response.status === 200) {
            const cache = await caches.open(IMAGES_CACHE);
            cache.put(request, response.clone());
          }
          return response;
        } catch (err) {
          return cached || new Response('', { status: 404 });
        }
      })()
    );
    return;
  }

  // Static Assets & Scripts: Stale-While-Revalidate
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);

      const fetchPromise = fetch(request)
        .then(async (networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(SHELL_CACHE);
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })()
  );
});
