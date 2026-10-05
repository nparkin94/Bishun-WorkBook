/* Bǐshùn Workbook service worker.
   Precaches the whole app so it opens offline after the first visit. Each deploy stamps __BUILD__ with the commit,
   which gives the cache a new name; the old cache is deleted once the new worker takes over.
   A waiting worker only takes over when the page asks (the "new version is ready" prompt), so an update never
   swaps files under someone who is halfway through writing a character. */
const BUILD = '__BUILD__';
const CACHE = 'bishun-' + (BUILD.startsWith('__') ? 'dev' : BUILD);

const PRECACHE = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'data.js',
  'manifest.webmanifest',
  'ARPHICPL.TXT',
  'fonts/noto-serif-tc-500.woff2',
  'fonts/noto-serif-tc-700.woff2',
  'fonts/noto-serif-tc-900.woff2',
  'fonts/schibsted-grotesk-latin.woff2',
  'fonts/schibsted-grotesk-latin-ext.woff2',
  'fonts/pinyin-400.woff2',
  'fonts/pinyin-700.woff2',
  'fonts/OFL-NotoCJK.txt',
  'fonts/OFL-SchibstedGrotesk.txt',
  'icons/favicon.svg',
  'icons/favicon-32.png',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' }))))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('bishun-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    // the app is a single page: any navigation inside the scope gets index.html, from cache first
    event.respondWith(
      caches.match('index.html', { cacheName: CACHE }).then((hit) => hit || fetch(req))
    );
    return;
  }

  event.respondWith(
    caches.match(req, { cacheName: CACHE }).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      });
    })
  );
});
