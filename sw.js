// sw.js · the site's service worker: repeat visits load the site's versioned files from the visitor's own device
// (owner, Nov 2026: "any way to optimize load time on all devices, without compromising quality").
//
// Why: GitHub Pages sends every file with max-age=600 (10 minutes) and its validators (ETag, Last-Modified) change with
// every deploy, so a visitor who comes back after a deploy downloads everything again: about 7 MB on a phone, 12 MB on
// desktop. Files whose URL carries ?v= never change under that URL (every edit bumps it), so this worker keeps them and
// answers from its cache with no network at all. It serves the same bytes, so nothing on screen changes.
//
// What it handles (everything else goes to the network exactly as if there were no worker):
//   - same-origin GETs with ?v= in the URL (scripts, styles, json, images, fonts, photo textures, skies), and
//   - exact-version CDN files (three@0.170.0, lenis@1.1.14 on jsdelivr; leaflet@1.9.4 on unpkg), which never change.
// What it never handles, so a new build always reaches the visitor as before:
//   - pages (navigations, *.html): always the network's copy, never this cache;
//   - version.txt (fetched with cache: 'no-store', no ?v=): index.html's reload-on-new-build check works as before;
//   - unversioned files (audio, map tiles), hard reloads, range requests (audio, video), dev stamps (&t=);
//   - anything that is not a complete 200 answer (errors, partial and opaque responses are passed on, never stored).
//
// Updates: a new build names new ?v= URLs, which miss here and are fetched and kept; superseded copies age out (MAX,
// AGE). sw.js itself is checked against the server on every visit (registered with updateViaCache: 'none') and a new
// one takes over at once (skipWaiting, clients.claim).
// Levers: rename CACHE to drop every kept file at once (for a file changed without a ?v= bump). Kill switch: set
// OFF = true and deploy: each visitor's worker deletes its cache and unregisters on their next visit. A visitor (or
// tester) can also open the site with ?nosw to unregister it (index.html).
'use strict';
const OFF = false;
const CACHE = 'pb-v1';
const MAX = 400;            // entries kept, oldest stored first out (one visit is about 120 on a phone, 200 on desktop)
const AGE = 14 * 864e5;     // a same-origin copy older than this (by its Date header) is fetched again, once
const CDN = /^https:\/\/(cdn\.jsdelivr\.net\/npm|unpkg\.com)\/(@[^/]+\/)?[^/@]+@\d+\.\d+\.\d+\//;   // exact versions only

self.addEventListener('install', e => {
  self.skipWaiting();
  // Chrome 123+: pages go straight to the network without even waking the worker
  if (!OFF && e.addRoutes) e.waitUntil(Promise.resolve().then(() => e.addRoutes([{ condition: { requestMode: 'navigate' }, source: 'network' }])).catch(() => {}));
});

self.addEventListener('activate', e => e.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(k => OFF || k !== CACHE).map(k => caches.delete(k)));
  if (OFF) { await self.registration.unregister(); return; }
  await self.clients.claim();
})()));

const wanted = req => {
  if (OFF || req.method !== 'GET' || req.mode === 'navigate' || req.headers.has('range')) return false;
  if (req.cache === 'no-store' || req.cache === 'reload' || req.cache === 'no-cache') return false;   // version.txt, hard reloads
  const u = new URL(req.url);
  if (u.origin === self.location.origin) {
    if (/\.html?$/.test(u.pathname) || u.pathname === '/sw.js' || u.pathname.startsWith('/walkthrough/tools/')) return false;
    const q = u.search.slice(1);
    return /(?:^|&)v=[^&]+/.test(q) && !/(?:^|&)t=/.test(q);   // versioned only, never a dev time stamp
  }
  return CDN.test(req.url);
};
const good = res => res && res.status === 200 && (res.type === 'basic' || res.type === 'cors');   // never opaque, partial or failed

let puts = 0;
async function keep(cache, req, res) {
  await cache.put(req, res);
  if (puts++ % 40) return;   // trimmed on the first store of each worker start and every 40th after, not on every store
  const keys = await cache.keys();   // in the order stored
  for (let i = 0; i < keys.length - MAX; i++) await cache.delete(keys[i]);
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (!wanted(req)) return;   // not handled: fetched as if there were no worker
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreVary: true });
    if (hit) {
      const same = new URL(req.url).origin === self.location.origin;
      const at = Date.parse(hit.headers.get('date') || '');
      if (!same || !(Date.now() - at > AGE)) return hit;   // (a CDN copy hides its Date header: those never change)
    }
    let res;
    try { res = await fetch(req); } catch (err) { if (hit) return hit; throw err; }   // offline: the older copy beats none
    if (good(res)) e.waitUntil(keep(cache, req, res.clone()).catch(() => {}));
    return res;
  })().catch(() => fetch(req)));
});
