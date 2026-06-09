const CACHE = "obstetricia-v1";
const SHELL = ["/", "/manifest.webmanifest", "/og.svg", "/robots.txt", "/apple-touch-icon.svg"];
// Patterns for static assets that can be cached indefinitely
const STATIC_RE = /\.(js|css|woff2?|svg|png|ico|webmanifest)(\?|$)/;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only intercept same-origin GET requests; skip API and auth routes
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth")
  )
    return;

  if (STATIC_RE.test(url.pathname)) {
    // Cache-first for static assets — serve instantly, refresh in background
    event.respondWith(
      caches.match(request).then((cached) => {
        const revalidate = fetch(request).then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put(request, res.clone()));
          return res;
        });
        return cached ?? revalidate;
      }),
    );
  } else if (request.mode === "navigate") {
    // Network-first for page navigations; fall back to shell on offline
    event.respondWith(
      fetch(request).catch(() => caches.match("/").then((r) => r ?? Response.error())),
    );
  }
});

// Push notification handling (existing)
self.addEventListener("push", (event) => {
  if (!event.data) return;
  const { title, body, icon, url } = event.data.json();
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: icon || "/apple-touch-icon.svg",
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/minha-conta";
  event.waitUntil(clients.openWindow(url));
});
