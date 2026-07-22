/* ============================================================
   BudgetWise Service Worker
   Strategy:
     • App shell (HTML/CSS/JS)  → Cache-first, update in background
     • CDN assets (Chart.js etc) → Cache-first (long-lived)
     • API calls (/api/*)        → Network-first, fallback to cache
     • Google Fonts              → Cache-first
   ============================================================ */

const CACHE_NAME    = 'budgetwise-v5';
const API_CACHE     = 'budgetwise-api-v5';

// Only cache URLs that Flask actually serves — missing any one causes SW install to fail
const APP_SHELL = [
  '/',
  '/manifest.json',
  '/assets/css/style.css',
  '/assets/js/core/data.js',
  '/assets/js/core/auth.js',
  '/assets/js/core/app.js',
  '/assets/js/modules/transactions.js',
  '/assets/js/modules/budgets.js',
  '/assets/js/modules/charts.js',
  '/assets/js/modules/analytics.js',
  '/assets/js/modules/insights.js',
  '/assets/js/modules/goals.js',
  '/assets/js/modules/reports.js',
  '/assets/js/modules/csv-import.js',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
];

// CDN resources to cache on first use
const CDN_ORIGINS = [
  'https://cdn.jsdelivr.net',
  'https://cdnjs.cloudflare.com',
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
];

/* ── Install — pre-cache the app shell ──────────────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Pre-caching app shell');
      return cache.addAll(APP_SHELL);
    }).then(() => self.skipWaiting())
  );
});

/* ── Activate — clean up old caches ─────────────────────────────────────── */
self.addEventListener('activate', event => {
  const KEEP = [CACHE_NAME, API_CACHE];
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => !KEEP.includes(k)).map(k => {
        console.log('[SW] Deleting old cache:', k);
        return caches.delete(k);
      }))
    ).then(() => self.clients.claim())
  );
});

/* ── Fetch — routing logic ───────────────────────────────────────────────── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. API calls:
  //    • POST/PUT/DELETE → always go to network (never cache writes)
  //    • GET             → network-first with cache fallback
  if (url.pathname.startsWith('/api/')) {
    if (request.method !== 'GET') {
      // Let non-GET requests pass through untouched — no caching, no offline fallback
      return;
    }
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // 2. CDN resources → Cache-first
  if (CDN_ORIGINS.some(o => request.url.startsWith(o))) {
    event.respondWith(cacheFirst(request, CACHE_NAME));
    return;
  }

  // 3. App shell + static assets → Cache-first, update in background
  if (request.method === 'GET') {
    event.respondWith(staleWhileRevalidate(request, CACHE_NAME));
  }
});

/* ── Strategies ─────────────────────────────────────────────────────────── */

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline — resource not available.', { status: 503 });
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok && request.method === 'GET') {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response(
      JSON.stringify({ error: 'You are offline. Please reconnect to sync data.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);

  return cached || fetchPromise || new Response('Offline', { status: 503 });
}

/* ── Background sync message ─────────────────────────────────────────────── */
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
