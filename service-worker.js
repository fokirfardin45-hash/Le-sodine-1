const CACHE_NAME = "le-sodine-it-v3";
const APP_SHELL = ["./", "./index.html", "./index_Version2.html", "./manifest.json", "./service-worker.js", "./assets/le-sodine-logo.svg", "./icons/icon-192.svg", "./icons/icon-512.svg"];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("le-sodine-") && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(caches.match(req).then(cached => cached || fetch(req).then(response => {
    if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(req, response.clone()));
    return response;
  }).catch(() => caches.match("./index_Version2.html"))));
});
