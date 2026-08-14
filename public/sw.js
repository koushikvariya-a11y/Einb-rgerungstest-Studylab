// Progressive Web App Service Worker for Einbürgerungstest Study Lab
// Precache application shell, icons, and Vite bundled assets.
// On-demand runtime caching for question images.
// Strictly excludes Firebase Auth, Firestore, OAuth, Analytics, and API requests.

const CACHE_VERSION = 'v1.2.0';
const SHELL_CACHE = `studylab-shell-${CACHE_VERSION}`;
const IMAGES_CACHE = `studylab-images-${CACHE_VERSION}`;

// Precache list: core shell and icons
const STATIC_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-maskable-512x512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon-48x48.png',
  '/icons/icon.svg',
];

// Placeholder injected at build time by Vite build plugin:
let viteAssets = [];
try {
  const injected = __VITE_PRECACHE_ASSETS__;
  if (Array.isArray(injected)) {
    viteAssets = injected;
  }
} catch {
  viteAssets = [];
}

const PRECACHE_SHELL = Array.from(new Set([...STATIC_SHELL, ...viteAssets]));

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

  // Exclude requests with authorization headers
  if (request && request.headers && request.headers.has('authorization')) {
    return true;
  }

  return false;
}

// 1. Install Event: Precache app shell, Vite assets, and immediately skip waiting
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      const shellCache = await caches.open(SHELL_CACHE);
      await shellCache.addAll(PRECACHE_SHELL).catch((err) => {
        console.warn('SW shell precache warning:', err);
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

// 2. Activate Event: Claim clients and purge all stale caches (including studylab-*-v1.1.0)
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
          const cached =
            (await caches.match('/index.html')) || (await caches.match('/'));
          if (cached) return cached;
          throw error;
        }
      })()
    );
    return;
  }

  // Question Images: On-demand Runtime Cache with Network-First/Stale-While-Revalidate replacement
  if (url.pathname.includes('/question-images/')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(IMAGES_CACHE);
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
            return networkResponse;
          }
        } catch (fetchErr) {
          // Fall back to cache when offline
        }
        const cached = await cache.match(request);
        if (cached) return cached;
        return new Response('', { status: 404 });
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
