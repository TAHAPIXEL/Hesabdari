const CACHE_NAME = "daftar-hesabdari-v3";
const FONT_ASSETS = [
  "/fonts/AbarLow-Regular.woff",
  "/fonts/AbarLow-SemiBold.woff",
  "/fonts/AbarLow-Bold.woff",
  "/fonts/AbarLow-ExtraBold.woff",
  "/fonts/AbarLow-Black.woff",
  "/fonts/AbarMid-Regular.woff",
  "/fonts/AbarMid-SemiBold.woff",
  "/fonts/AbarMid-Bold.woff",
  "/fonts/AbarMid-ExtraBold.woff",
  "/fonts/AbarMid-Black.woff",
  "/fonts/AbarHigh-Regular.woff",
  "/fonts/AbarHigh-SemiBold.woff",
  "/fonts/AbarHigh-Bold.woff",
  "/fonts/AbarHigh-ExtraBold.woff",
  "/fonts/AbarHigh-Black.woff",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(["/", ...FONT_ASSETS]))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/fonts/")) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE_NAME).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  if (url.pathname === "/" || url.pathname === "/hsab.html") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("/"))),
    );
  }
});
