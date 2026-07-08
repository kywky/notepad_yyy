const CACHE_NAME = "notepad-plus-web-v1";
const CORE_ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icons/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];

async function resolveBuildAssets() {
  const response = await fetch("/index.html", { cache: "no-store" });
  const html = await response.text();
  const assets = Array.from(
    html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g),
    (match) => match[1]
  );

  return Array.from(new Set([...CORE_ASSETS, ...assets]));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([caches.open(CACHE_NAME), resolveBuildAssets()])
      .then(([cache, assets]) => cache.addAll(assets))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
