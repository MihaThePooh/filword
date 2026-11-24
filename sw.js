// Service worker: lets the game open without internet.
//
// A complete version is cached before activation. Cold launches use that
// version immediately; only the service-worker update needs the network.
// Dictionaries (data/) - "cache first": they are big and change only with a
// new CACHE version, which downloads them again on install. So the game starts
// without re-downloading megabytes, online or not.

const CACHE = 'filword-v71';
// Every file the game needs. On the very first visit modules load before the
// worker starts, so they must be listed here to work offline (a test checks it).
const CORE = ['src/champions.js', 'src/leaderboard.js', 'data/skins/champions/bronze.webp', 'data/skins/champions/bronze-large.webp', 'data/skins/champions/silver.webp', 'data/skins/champions/silver-large.webp', 'data/skins/champions/gold.webp', 'data/skins/champions/gold-large.webp', 'src/swipe-sheet.js', 'src/header-contrast.js', 'src/offline.js', 'data/words.json', 'data/kids.json', 'data/bonus.json', 'data/bonus-defs.json', './', 'index.html', 'style.css', 'manifest.webmanifest', 'data/words.json.gz',
  'icons/icon-192.png', 'icons/icon-512.png',
  'src/game.js', 'src/board.js', 'src/rng.js', 'src/path.js', 'src/split.js',
  'src/selection.js', 'src/hint.js', 'src/sheet.js', 'src/dict-loader.js', 'src/celebrate.js', 'src/rewards.js', 'src/progress.js', 'src/loader.js', 'src/install.js', 'src/cloud.js', 'src/mode.js', 'src/shop.js', 'src/skins.js', 'src/cat-roster.js', 'src/cat-collection.js', 'src/stats.js', 'src/achievements.js', 'src/sheets.js',
  'src/backstack.js', 'src/timer.js', 'src/coinfx.js', 'src/awardpop.js', 'src/theme-boot.js', 'data/kids.json.gz', 'data/bonus.json.gz',
  // Bonus definitions too: after the first install everything works offline.
  'data/bonus-defs.json.gz', 'data/skins/collection-v1/c21.webp', 'data/skins/collection-v1/c22.webp', 'data/skins/collection-v1/c23.webp', 'data/skins/collection-v1/c24.webp', 'data/skins/collection-v1/c25.webp', 'data/skins/collection-v1/c26.webp', 'data/skins/collection-v1/c27.webp', 'data/skins/collection-v1/c28.webp', 'data/skins/collection-v1/c29.webp', 'data/skins/collection-v1/c30.webp', 'data/skins/collection-v1/c31.webp', 'data/skins/collection-v1/c32.webp', 'data/skins/collection-v1/c33.webp', 'data/skins/collection-v1/c34.webp', 'data/skins/collection-v1/c35.webp', 'data/skins/collection-v1/c36.webp', 'data/skins/collection-v1/c37.webp', 'data/skins/collection-v1/c38.webp', 'data/skins/collection-v1/c39.webp', 'data/skins/collection-v1/c40.webp', 'data/skins/collection-v1/c41.webp', 'data/skins/collection-v1/c42.webp', 'data/skins/collection-v1/c43.webp', 'data/skins/collection-v1/c44.webp', 'data/skins/collection-v1/c45.webp', 'data/skins/collection-v1/c46.webp', 'data/skins/collection-v1/c47.webp', 'data/skins/collection-v1/c01.webp', 'data/skins/collection-v1/c02.webp', 'data/skins/collection-v1/c03.webp', 'data/skins/collection-v1/c04.webp', 'data/skins/collection-v1/c05.webp', 'data/skins/collection-v1/c06.webp', 'data/skins/collection-v1/c07.webp', 'data/skins/collection-v1/c08.webp', 'data/skins/collection-v1/c09.webp', 'data/skins/collection-v1/c10.webp', 'data/skins/collection-v1/c11.webp', 'data/skins/collection-v1/c12.webp', 'data/skins/collection-v1/c12-large.webp', 'data/skins/collection-v1/c13.webp', 'data/skins/collection-v1/c14.webp', 'data/skins/collection-v1/c15.webp', 'data/skins/collection-v1/c16.webp', 'data/skins/collection-v1/c17.webp', 'data/skins/collection-v1/c18.webp', 'data/skins/collection-v1/c19.webp', 'data/skins/collection-v1/c20.webp', 'data/skins/collection-v1/v01.webp', 'data/skins/collection-v1/v03.webp', 'data/skins/collection-v1/v04.webp', 'data/skins/collection-v1/v09.webp', 'data/skins/collection-v1/v10.webp', 'data/skins/collection-v1/v11.webp', 'data/skins/collection-v1/v12.webp', 'data/skins/collection-v1/v14.webp', 'data/skins/collection-v1/v16.webp', 'data/skins/collection-v1/v17.webp', 'data/skins/collection-v1/v19.webp', 'data/skins/collection-v1/v22.webp', 'data/skins/collection-v1/v24.webp', 'data/skins/collection-v1/v26.webp', 'data/skins/collection-v1/v27.webp', 'data/skins/collection-v1/v32.webp', 'data/skins/collection-v1/v40.webp'];

const BACKGROUNDS = ['data/bg/coral-arabesque.webp', 'data/bg/blue-lace.webp', 'data/bg/blue-arabesque.webp', 'data/bg/light-flowers.webp', 'data/bg/gold-ornament.webp', 'data/bg/golden-arabesque.webp', 'data/bg/ornament-final.webp', 'data/bg/beige-ornament.webp', 'data/bg/brown-ornament.webp', 'data/bg/brown-brocade.webp', 'data/bg/dark-green-ornament.webp', 'data/bg/engraved-ornament.webp', 'data/bg/red-ornament.webp', 'data/bg/taupe-ornament.webp', 'data/bg/red-folk-mandala.webp', 'data/bg/light-textile.webp', 'data/bg/soft-texture.webp', 'data/bg/carpet-ornament.webp', 'data/bg/red-chintz.webp', 'data/bg/golden-painting.webp', 'data/bg/floral-gzhel.webp', 'data/bg/khokhloma.webp', 'data/bg/red-scrolls.webp', 'data/bg/night-flowers.webp', 'data/bg/folk-painting.webp', 'data/bg/black-painting.webp', 'data/bg/scarlet-branch.webp', 'data/bg/blue-floral.webp', 'data/bg/burgundy-damask.webp', 'data/bg/roses.webp', 'data/bg/rug.webp', 'data/bg/chintz.webp', 'data/bg/floral-stripes.webp', 'data/bg/brown-damask.webp', 'data/bg/olive-damask.webp', 'data/bg/green-ornament.webp', 'data/bg/gold-damask.webp', 'data/bg/mint-damask.webp', 'data/bg/blue-damask.webp', 'data/bg/olive-stripes.webp', 'data/bg/pistachio-stripes.webp', 'data/bg/teal-stripes.webp', 'data/bg/red-carpet.webp', 'data/bg/medallion-rug.webp', 'data/bg/gzhel.webp', 'data/bg/red-embroidery.webp', 'data/bg/star-embroidery.webp', 'data/bg/ribbon-embroidery.webp', 'data/bg/linen-embroidery.webp', 'data/bg/black-embroidery.webp'];

const FILES = [...new Set([...CORE, ...BACKGROUNDS])];
const READY = new URL('__offline_ready__', self.registration.scope).href;
let completed = 0;

async function announce(status) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  for (const client of clients) client.postMessage({ type: 'offline-status', ...status });
}
async function fetchFile(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, { cache: 'reload', redirect: 'error', signal: controller.signal });
    if (!response.ok) throw new Error('Incomplete offline download: ' + url);
    return response;
  } finally { clearTimeout(timer); }
}
async function prepare() {
  const cache = await caches.open(CACHE);
  let next = 0;
  const download = async () => {
    while (next < FILES.length) {
      const file = FILES[next++];
      if (!await cache.match(file)) {
        let response;
        try { response = await fetchFile(file); }
        catch { response = await fetchFile(file); }
        await cache.put(file, response);
      }
      completed++;
      await announce({ phase: 'loading', completed, total: FILES.length });
    }
  };
  const downloads = await Promise.allSettled(Array.from({ length: 4 }, download));
  const failed = downloads.find(result => result.status === 'rejected');
  if (failed) throw failed.reason;
  // Written last: a partial or failed download can never claim readiness.
  await cache.put(READY, new Response(JSON.stringify({ phase: 'ready', completed, total: FILES.length, cache: CACHE })));
  await self.skipWaiting();
}
self.addEventListener('install', event => {
  event.waitUntil(prepare().catch(async error => {
    await announce({ phase: 'error', completed, total: FILES.length });
    throw error;
  }));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    await self.clients.claim();
    const cache = await caches.open(CACHE);
    const ready = await cache.match(READY);
    if (!ready) throw new Error('Offline package missing');
    await announce(await ready.json());
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => /^filword-v\d+$/.test(key) && key !== CACHE).map(key => caches.delete(key)));
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type !== 'offline-status') return;
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const ready = await cache.match(READY);
    const status = ready ? await ready.json() : { phase: 'loading', completed, total: FILES.length };
    event.ports[0]?.postMessage(status);
  })());
});
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // All installed start URLs, modes and query parameters share the same shell.
    const hit = req.mode === 'navigate'
      ? await cache.match(new URL('index.html', self.registration.scope).href)
      : await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try { return await fetch(req, { redirect: 'error' }); }
    catch { return Response.error(); }
  })());
});
