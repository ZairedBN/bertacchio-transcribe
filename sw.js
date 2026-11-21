/* Looper — service worker: rende l'app installabile e utilizzabile offline.
   Strategia "prima la rete": si usa sempre la versione più recente, e la copia salvata solo senza connessione.
   Aumenta VERSION quando pubblichi una nuova versione. */
const VERSION = 'looper-v2-7';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest',
  'js/util.js', 'js/storage.js', 'js/bpm.js', 'js/audio-fx.js', 'js/waveform.js', 'js/trainer.js', 'js/app.js', 'js/tips.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (/\/(api|media)\//.test(url.pathname)) return;   // server Windows: mai dalla cache
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('index.html')))
  );
});
