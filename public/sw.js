// VyaparPro service worker.
// Strategy:
//   - Static app shell (HTML/JS/CSS): stale-while-revalidate. App opens
//     instantly on second load and updates in the background.
//   - API requests (/api/): NEVER cached. Accounting data must always be
//     fresh; a stale invoice list could create real-money mistakes.
//   - Images & fonts: cache-first.
//
// Bump CACHE_VERSION on every release to force a refresh of the shell.

const CACHE_VERSION = 'v1';
const SHELL_CACHE = `vyaparpro-shell-${CACHE_VERSION}`;
const ASSET_CACHE = `vyaparpro-assets-${CACHE_VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(['/', '/index.html', '/manifest.webmanifest']))
      .catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => ![SHELL_CACHE, ASSET_CACHE].includes(k))
          .map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never cache API: financial data must be fresh.
  if (url.pathname.startsWith('/api/')) return;

  // Cross-origin (e.g. Google Fonts): cache-first with no-cors fallback.
  if (url.origin !== self.location.origin) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request)
            .then((res) => {
              const copy = res.clone();
              caches.open(ASSET_CACHE).then((c) => c.put(request, copy));
              return res;
            })
            .catch(() => hit),
      ),
    );
    return;
  }

  // Navigation requests → return index.html offline (SPA shell).
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html')),
    );
    return;
  }

  // Static assets → stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((hit) => {
      const fetchPromise = fetch(request)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(ASSET_CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || fetchPromise;
    }),
  );
});
