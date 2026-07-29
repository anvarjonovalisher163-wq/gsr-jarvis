/* GSR Jarvis service worker: offline shell cache + Web Push. */
const CACHE = "gsr-jarvis-v1";
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

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // API requests are never cached — live data only.
  if (event.request.method !== "GET" || url.pathname.startsWith("/api")) return;

  // Navigations: network first, fall back to the cached shell (offline).
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match("/")));
    return;
  }

  // Static assets: cache first, then network (and populate the cache).
  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((res) => {
          if (res.ok && url.origin === self.location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(event.request, copy));
          }
          return res;
        })
    )
  );
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
