// Service worker: lets the game open without internet.
//
// Code - "network first": when online, take the fresh file from the server and
// put a copy into the cache; offline, answer from the cache. So updates arrive
// by themselves, and the last version works offline.
// Dictionaries (data/) - "cache first": they are big and change only with a
// new CACHE version, which downloads them again on install. So the game starts
// without re-downloading megabytes, online or not.

const CACHE = 'filword-v56';
// Every file the game needs. On the very first visit modules load before the
// worker starts, so they must be listed here to work offline (a test checks it).
const CORE = ['./', 'index.html', 'style.css', 'manifest.webmanifest', 'data/words.json.gz',
  'icons/icon-192.png', 'icons/icon-512.png',
  'src/game.js', 'src/board.js', 'src/rng.js', 'src/path.js', 'src/split.js',
  'src/selection.js', 'src/hint.js', 'src/sheet.js', 'src/dict-loader.js', 'src/celebrate.js', 'src/rewards.js', 'src/progress.js', 'src/loader.js', 'src/install.js', 'src/cloud.js', 'src/mode.js', 'src/shop.js', 'src/skins.js', 'src/cat-roster.js', 'src/cat-collection.js', 'src/stats.js', 'src/achievements.js', 'src/sheets.js',
  'src/backstack.js', 'src/timer.js', 'src/coinfx.js', 'src/awardpop.js', 'src/theme-boot.js', 'data/kids.json.gz', 'data/bonus.json.gz',
  // Bonus definitions too: after the first install everything works offline.
  'data/bonus-defs.json.gz', 'data/skins/collection-v1/c21.webp', 'data/skins/collection-v1/c22.webp', 'data/skins/collection-v1/c23.webp', 'data/skins/collection-v1/c24.webp', 'data/skins/collection-v1/c25.webp', 'data/skins/collection-v1/c26.webp', 'data/skins/collection-v1/c27.webp', 'data/skins/collection-v1/c28.webp', 'data/skins/collection-v1/c29.webp', 'data/skins/collection-v1/c30.webp', 'data/skins/collection-v1/c31.webp', 'data/skins/collection-v1/c32.webp', 'data/skins/collection-v1/c33.webp', 'data/skins/collection-v1/c34.webp', 'data/skins/collection-v1/c35.webp', 'data/skins/collection-v1/c36.webp', 'data/skins/collection-v1/c37.webp', 'data/skins/collection-v1/c38.webp', 'data/skins/collection-v1/c39.webp', 'data/skins/collection-v1/c40.webp', 'data/skins/collection-v1/c41.webp', 'data/skins/collection-v1/c42.webp', 'data/skins/collection-v1/c43.webp', 'data/skins/collection-v1/c44.webp', 'data/skins/collection-v1/c45.webp', 'data/skins/collection-v1/c46.webp', 'data/skins/collection-v1/c47.webp', 'data/skins/collection-v1/c01.webp', 'data/skins/collection-v1/c02.webp', 'data/skins/collection-v1/c03.webp', 'data/skins/collection-v1/c04.webp', 'data/skins/collection-v1/c05.webp', 'data/skins/collection-v1/c06.webp', 'data/skins/collection-v1/c07.webp', 'data/skins/collection-v1/c08.webp', 'data/skins/collection-v1/c09.webp', 'data/skins/collection-v1/c10.webp', 'data/skins/collection-v1/c11.webp', 'data/skins/collection-v1/c12.webp', 'data/skins/collection-v1/c13.webp', 'data/skins/collection-v1/c14.webp', 'data/skins/collection-v1/c15.webp', 'data/skins/collection-v1/c16.webp', 'data/skins/collection-v1/c17.webp', 'data/skins/collection-v1/c18.webp', 'data/skins/collection-v1/c19.webp', 'data/skins/collection-v1/c20.webp', 'data/skins/collection-v1/v01.webp', 'data/skins/collection-v1/v03.webp', 'data/skins/collection-v1/v04.webp', 'data/skins/collection-v1/v09.webp', 'data/skins/collection-v1/v10.webp', 'data/skins/collection-v1/v11.webp', 'data/skins/collection-v1/v12.webp', 'data/skins/collection-v1/v14.webp', 'data/skins/collection-v1/v16.webp', 'data/skins/collection-v1/v17.webp', 'data/skins/collection-v1/v19.webp', 'data/skins/collection-v1/v22.webp', 'data/skins/collection-v1/v24.webp', 'data/skins/collection-v1/v26.webp', 'data/skins/collection-v1/v27.webp', 'data/skins/collection-v1/v32.webp', 'data/skins/collection-v1/v40.webp'];

self.addEventListener('install', (event) => {
  // Pre-cache the essentials so offline works right after the first visit.
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // The save is never answered from the cache: a stale copy would look like
  // the server's and could win over newer progress.
  if (new URL(req.url).pathname.startsWith('/api/')) return;
  if (new URL(req.url).pathname.includes('/data/')) {
    event.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit ?? fetchAndKeep(req)));
    return;
  }
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      // ignoreSearch: publish adds ?v=<stamp> to file names; offline any stamp will do.
      .catch(() => caches.match(req, { ignoreSearch: true })
        .then((hit) => hit ?? Response.error())),
  );
});

function fetchAndKeep(req) {
  return fetch(req).then((res) => {
    if (res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then((cache) => cache.put(req, copy));
    }
    return res;
  });
}
