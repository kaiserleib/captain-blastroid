// Offline service worker for the browser build. The build plugin (tools/pwa/plugin.ts)
// prepends `self.__PRECACHE = { version, files }` with the hashed entry assets.
const { version, files } = self.__PRECACHE;
const PREFIX = 'blastroid-';
const CACHE = PREFIX + version;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(files))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Cache-first: assets are content-hashed and a new deploy ships a new sw.js, which
// the browser re-checks on every navigation. Navigations (any query string, e.g.
// ?seed=) fall back to the cached index.html so the game launches offline.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    event.respondWith(
      caches
        .match('index.html', { ignoreSearch: true, ignoreVary: true })
        .then((hit) =>
          (url.pathname.endsWith('/') || url.pathname.endsWith('/index.html')) && hit
            ? hit
            : fetch(req).catch(() => hit ?? Response.error()),
        ),
    );
    return;
  }
  // ignoreVary: module scripts are CORS requests carrying an Origin header that the
  // precached requests lack, so servers sending `Vary: Origin` would never match.
  event.respondWith(caches.match(req, { ignoreVary: true }).then((hit) => hit ?? fetch(req)));
});
