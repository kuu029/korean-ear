// オフライン用 Service Worker。ASSETS は tools/update-sw.mjs で自動生成する（手で書かない）
const VERSION = '4231f15f64';
const CACHE = `korean-ear-${VERSION}`;
const ASSETS = [
  './',
  './css/app.css',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './index.html',
  './js/data/contrasts.js',
  './js/data/dictation.js',
  './js/data/pairs.js',
  './js/grader.js',
  './js/hangul.js',
  './js/main.js',
  './js/scheduler.js',
  './js/screens/dictation.js',
  './js/screens/home.js',
  './js/screens/pair.js',
  './js/screens/result.js',
  './js/store.js',
  './js/tts.js',
  './js/ui.js',
  './manifest.webmanifest',
];

// cache: 'reload' … 古い HTTP キャッシュを使わず、必ずサーバーから取る。
// 1つずつ保存する（addAll だと1つ失敗しただけで新しい版が届かなくなるため）
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(ASSETS.map((u) => fetch(new Request(u, { cache: 'reload' }))
    .then((res) => { if (res.ok) return c.put(u, res); })
    .catch(() => {})))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('korean-ear-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// キャッシュ優先。なければネットから取って保存（同じサイトのファイルだけ）
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match('./index.html'))),
  );
});
