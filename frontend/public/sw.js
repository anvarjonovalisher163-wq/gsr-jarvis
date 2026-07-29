/* GSR Jarvis service worker: offline shell cache + Web Push.
 *
 * Caching strategy matters here. An earlier version used cache-first for
 * every same-origin GET, which meant application code was pinned to
 * whatever version happened to be cached first — new builds never reached
 * the user until the cache was cleared by hand. Now only content-hashed
 * build output (/assets/) is treated as immutable; everything else goes to
 * the network first and falls back to cache only when offline.
 *
 * Bump CACHE on any change here so activate() drops the old entries.
 */
const CACHE = "gsr-jarvis-v2";
const APP_SHELL = ["/", "/manifest.json", "/icon.svg", "/icon-maskable.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  try {
    const res = await fetch(request);
    if (res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(request, copy));
    }
    return res;
  } catch (e) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw e;
  }
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Live data only — never serve a cached API response.
  if (event.request.method !== "GET" || url.pathname.startsWith("/api")) return;
  if (url.origin !== self.location.origin) return;

  // Navigations: network first so a new deploy is picked up immediately,
  // cached shell only when offline.
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match("/")));
    return;
  }

  // Hashed build output never changes under the same name — safe to serve
  // from cache without asking the network.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(event.request, copy));
            }
            return res;
          })
      )
    );
    return;
  }

  event.respondWith(networkFirst(event.request));
});

self.addEventListener("push", (event) => {
  let data = { title: "GSR Jarvis", body: "Yangi xabar" };
  try {
    data = event.data.json();
  } catch (e) {
    /* keep defaults */
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon.svg",
      badge: "/icon.svg",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      if (list.length) return list[0].focus();
      return clients.openWindow("/");
    })
  );
});
