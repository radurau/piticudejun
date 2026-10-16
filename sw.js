// Service worker: stale-while-revalidate for app files and data, cached Google Fonts.
// iTunes search results and preview audio are never cached here (the page caches lookups itself).
const VERSION = 'pd-2026-10-16';
const APP_CACHE = `app-${VERSION}`;
const FONT_CACHE = 'fonts-v1';
const CORE = [
  './', 'index.html', 'css/app.css', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png',
  'js/app.js', 'js/data.js', 'js/ui.js', 'js/router.js', 'js/preview.js',
  'js/views/home.js', 'js/views/songs.js', 'js/views/artists.js', 'js/views/artist.js', 'js/views/song.js',
  'js/views/episodes.js', 'js/views/episode.js', 'js/views/year.js', 'js/views/search.js', 'js/views/dm.js',
  'js/views/wrapped.js', 'js/views/setlist.js',
  'css/setlist.css',
  'js/views/setlist/store.js', 'js/views/setlist/insights.js', 'js/views/setlist/drag.js',
  'js/views/setlist/onair.js', 'js/views/setlist/duration.js', 'js/views/setlist/icons.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(APP_CACHE).then((c) => Promise.allSettled(CORE.map((u) => c.add(u)))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== APP_CACHE && k !== FONT_CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

const NEVER = /(^|\.)itunes\.apple\.com$|(^|\.)mzstatic\.com$|(^|\.)apple\.com$/;

async function swr(req, cacheName, { key = req, prune = false } = {}) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(key);
  const net = fetch(req).then(async (res) => {
    if (res.ok || res.type === 'opaque') {
      if (prune) { // keep one version of each data file (?v= changes on every export)
        const path = new URL(req.url).pathname;
        for (const k of await cache.keys()) if (new URL(k.url).pathname === path && k.url !== req.url) await cache.delete(k);
      }
      await cache.put(key, res.clone());
    }
    return res;
  }).catch(() => hit || Response.error());
  return hit || net;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (NEVER.test(url.hostname) || req.destination === 'audio' || req.headers.has('range')) return;
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') { e.respondWith(swr(req, FONT_CACHE)); return; }
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') { e.respondWith(swr(req, APP_CACHE, { key: new Request(new URL('index.html', self.registration.scope)) })); return; }
  e.respondWith(swr(req, APP_CACHE, { prune: url.pathname.endsWith('.json') }));
});
