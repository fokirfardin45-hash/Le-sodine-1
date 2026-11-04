const CACHE_NAME = "le-sodine-cloud-v2";
const APP_SHELL = ["./", "./index.html", "./cloud-app.html", "./order-datetime.js", "./manifest.json", "./service-worker.js", "./assets/le-sodine-logo.svg", "./icons/icon-192.svg", "./icons/icon-512.svg"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("le-sodine-") && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(fetch(request, { cache: "no-store" }).then(async response => {
      if (!response.ok) return response;
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text/html")) return response;
      let html = await response.text();
      if (!html.includes("order-datetime.js")) {
        html = html.replace(/<\/body>/i, '<script src="./order-datetime.js?v=2"></script></body>');
      }
      const headers = new Headers(response.headers);
      ["content-length", "content-encoding", "etag", "content-md5"].forEach(name => headers.delete(name));
      const updated = new Response(html, { status: response.status, statusText: response.statusText, headers });
      caches.open(CACHE_NAME).then(cache => cache.put(request, updated.clone()));
      return updated;
    }).catch(() => caches.match(request).then(cached => cached || caches.match("./cloud-app.html"))));
    return;
  }

  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
    if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
    return response;
  })));
});
