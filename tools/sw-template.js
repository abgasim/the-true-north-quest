/* The True North Quest service worker. GENERATED from tools/sw-template.js by
 * tools/apply-boot.mjs (npm run boot) - do not edit sw.js by hand.
 * Strategy (specs/SPEC-OFFLINE.md §7):
 *   install  : precache the hub, every registered module, local libs and icons
 *   HTML     : network-first (3 s timeout) so updates show when online; cache when offline
 *   assets   : cache-first (they are versioned by CACHE below)
 *   fonts    : stale-while-revalidate in a runtime cache (Google Fonts only)
 */
const CACHE = 'tnq-__VERSION__';
const RUNTIME = 'tnq-runtime-v1';
const PRECACHE = __PRECACHE__;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== RUNTIME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function timeout(ms) { return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)); }

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await Promise.race([fetch(request), timeout(3000)]);
    if (fresh && fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch (e) {
    const hit = await cache.match(request, { ignoreSearch: true });
    return hit || (await cache.match('./index.html')) || Response.error();
  }
}

async function cacheFirst(request) {
  const hit = await caches.match(request, { ignoreSearch: true });
  if (hit) return hit;
  const fresh = await fetch(request);
  if (fresh && fresh.ok) (await caches.open(CACHE)).put(request, fresh.clone());
  return fresh;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME);
  const hit = await cache.match(request);
  const update = fetch(request).then((r) => { if (r && (r.ok || r.type === 'opaque')) cache.put(request, r.clone()); return r; }).catch(() => hit);
  return hit || update;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    const isPage = req.mode === 'navigate' || req.destination === 'iframe' || req.destination === 'document' || url.pathname.endsWith('.html') || url.pathname.endsWith('/');
    event.respondWith(isPage ? networkFirst(req) : cacheFirst(req));
  } else if (/^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    event.respondWith(staleWhileRevalidate(req));
  }
  // Everything else (CDN fallbacks) goes straight to the network, unchanged.
});
