// Service worker: lets the game open without internet.
//
// Strategy "network first": when online, always take the fresh file from the
// server and put a copy into the cache; when offline, answer from the cache.
// So updates arrive by themselves, and the last version works offline.

const CACHE = 'filword-v11';
// Every file the game needs. On the very first visit modules load before the
// worker starts, so they must be listed here to work offline (a test checks it).
const CORE = ['./', 'index.html', 'style.css', 'manifest.webmanifest', 'data/words.json.gz',
  'icons/icon-192.png', 'icons/icon-512.png',
  'src/game.js', 'src/board.js', 'src/rng.js', 'src/path.js', 'src/split.js',
  'src/selection.js', 'src/hint.js', 'src/sheet.js', 'src/dict-loader.js', 'src/celebrate.js', 'src/rewards.js', 'src/progress.js', 'src/loader.js', 'data/bonus.json.gz'];

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
