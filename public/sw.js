/**
 * entix.io · Service Worker
 *
 * Strategy: network-first for HTML · cache-first for hashed assets.
 * Each build gets a new CACHE_VERSION (injected by Vite via `__BUILD_HASH__`).
 * On version mismatch: nuke all old caches + skipWaiting + reload clients.
 *
 * This kills the "iPhone Safari shows old build" bug class permanently.
 */

const CACHE_VERSION = '__BUILD_HASH__'; // replaced at build time
const HTML_CACHE = `entix-html-${CACHE_VERSION}`;
const ASSET_CACHE = `entix-assets-${CACHE_VERSION}`;

// On install: pre-cache the shell · skipWaiting so new SW takes over immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(HTML_CACHE).then((cache) =>
      cache.addAll(['/', '/index.html']).catch(() => {})
    ).then(() => self.skipWaiting())
  );
});

// On activate: delete every cache that doesn't match current version
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== HTML_CACHE && k !== ASSET_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Listen for explicit "skipWaiting" message (used by app to force reload)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// Fetch strategy
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 1. HTML / navigations · network-first (always fresh) with cache fallback
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(HTML_CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('/')))
    );
    return;
  }

  // 2. Hashed assets (index-XXX.js · etc) · cache-first (immutable)
  if (/\/(assets|static)\/.+\.[a-f0-9]{6,}\./i.test(url.pathname) ||
      /-[a-zA-Z0-9_-]{6,}\.(js|css|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(ASSET_CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
      )
    );
    return;
  }

  // 3. Everything else · network · with stale-while-revalidate fallback
  event.respondWith(
    fetch(req).catch(() => caches.match(req).then((r) => r || new Response('', { status: 504 })))
  );
});
