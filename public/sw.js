const CACHE_VERSION = "v1";
const APP_SHELL_CACHE = `vr-camera-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `vr-camera-runtime-${CACHE_VERSION}`;
const CACHE_PREFIX = "vr-camera-";
const ASSET_URL_PATTERN =
  /<(?:script|link)\b[^>]+(?:src|href)=["']([^"']+)["']/gi;

const appScope = self.registration.scope;
const appShellUrl = new URL("./", appScope).href;
const appShellFiles = [
  appShellUrl,
  new URL("./manifest.webmanifest", appScope).href,
  new URL("./icon.svg", appScope).href,
  new URL("./apple-touch-icon.png", appScope).href
];

const cacheResponse = async (cacheName, request, response) => {
  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
};

const extractLocalAssets = (htmlText) => {
  const urls = new Set();
  let match = null;
  while ((match = ASSET_URL_PATTERN.exec(htmlText)) !== null) {
    const rawUrl = (match[1] || "").trim();
    if (!rawUrl || rawUrl.startsWith("data:")) {
      continue;
    }
    const absoluteUrl = new URL(rawUrl, appShellUrl);
    if (absoluteUrl.origin !== self.location.origin) {
      continue;
    }
    urls.add(absoluteUrl.href);
  }
  return Array.from(urls);
};

const collectAppShellAssets = async () => {
  try {
    const response = await fetch(appShellUrl, { cache: "no-cache" });
    if (!response.ok) {
      return [];
    }
    const htmlText = await response.text();
    return extractLocalAssets(htmlText);
  } catch {
    return [];
  }
};

const precacheUrls = async (cacheName, urls) => {
  const cache = await caches.open(cacheName);
  await Promise.all(
    urls.map(async (url) => {
      try {
        const response = await fetch(url, { cache: "no-cache" });
        if (response.ok) {
          await cache.put(url, response);
        }
      } catch {
        // Ignore failed resources and keep available cache entries.
      }
    })
  );
};

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const dynamicAssets = await collectAppShellAssets();
    const urlsToCache = Array.from(new Set([...appShellFiles, ...dynamicAssets]));
    await precacheUrls(APP_SHELL_CACHE, urlsToCache);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(
          (key) =>
            key.startsWith(CACHE_PREFIX) &&
            key !== APP_SHELL_CACHE &&
            key !== RUNTIME_CACHE
        )
        .map((key) => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const networkResponse = await fetch(request);
        void cacheResponse(RUNTIME_CACHE, request, networkResponse);
        return networkResponse;
      } catch {
        const cachedPage = await caches.match(request);
        if (cachedPage) {
          return cachedPage;
        }
        const cachedShell = await caches.match(appShellUrl);
        if (cachedShell) {
          return cachedShell;
        }
        return new Response("Offline", {
          status: 503,
          statusText: "Offline"
        });
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }

    try {
      const networkResponse = await fetch(request);
      if (networkResponse.ok && networkResponse.type !== "opaque") {
        void cacheResponse(RUNTIME_CACHE, request, networkResponse);
      }
      return networkResponse;
    } catch {
      return new Response("Offline", {
        status: 503,
        statusText: "Offline"
      });
    }
  })());
});
