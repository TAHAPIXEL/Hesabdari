const CACHE_NAME = "hesabdari-novin-v9";

const CORE_ASSETS = [
  "/",
  "/hsab.html",
  "/manifest.webmanifest",
  "/favicon.ico",
];

const ICON_ASSETS = [
  "/icons/logo.svg",
  "/icons/apple-touch-icon.png",
  "/icons/favicon-32.png",
  "/icons/favicon-64.png",
  "/icons/icon-72.png",
  "/icons/icon-96.png",
  "/icons/icon-144.png",
  "/icons/icon-192.png",
  "/icons/icon-256.png",
  "/icons/icon-384.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-192.png",
  "/icons/icon-maskable-512.png",
];

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

const PRECACHE_ASSETS = [...CORE_ASSETS, ...ICON_ASSETS, ...FONT_ASSETS];

async function cacheAssetWithRetry(cache, url) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const existing = await cache.match(url, { ignoreSearch: false });
      if (existing && url !== "/" && url !== "/hsab.html") return true;
      const res = await fetch(url, {
        cache: url === "/" || url === "/hsab.html" ? "no-cache" : "default",
      });
      if (res && res.ok) {
        await cache.put(url, res.clone());
        return true;
      }
    } catch {
      // retry once
    }
  }
  const fallback = await cache.match(url, { ignoreSearch: false });
  return Boolean(fallback);
}

async function ensureAllPrecached() {
  const cache = await caches.open(CACHE_NAME);
  const results = await Promise.all(
    PRECACHE_ASSETS.map((u) => cacheAssetWithRetry(cache, u)),
  );
  const cached = results.filter(Boolean).length;
  return {
    ready: cached === PRECACHE_ASSETS.length,
    cached,
    total: PRECACHE_ASSETS.length,
  };
}

async function broadcastStatus(payload) {
  const clients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  for (const client of clients) {
    client.postMessage(payload);
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    ensureAllPrecached()
      .then((status) =>
        broadcastStatus({ type: "OFFLINE_STATUS", ...status }),
      )
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
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim())
      .then(() => ensureAllPrecached())
      .then((status) =>
        broadcastStatus({ type: "OFFLINE_STATUS", ...status }),
      )
      .catch(() => {}),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "WARM_CACHE") {
    event.waitUntil(
      ensureAllPrecached().then((status) => {
        if (event.source && event.source.postMessage) {
          event.source.postMessage({ type: "OFFLINE_STATUS", ...status });
        }
        return broadcastStatus({ type: "OFFLINE_STATUS", ...status });
      }),
    );
  } else if (data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function fetchWithTimeout(req, ms) {
  return new Promise((resolve, reject) => {
    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = setTimeout(() => {
      if (ctrl) ctrl.abort();
      reject(new Error("timeout"));
    }, ms);
    fetch(req, ctrl ? { signal: ctrl.signal } : undefined)
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // فونت‌ها، آیکون‌ها، مانیفست و فاوآیکون: Cache-First فوق‌سریع با به‌روزرسانی پس‌زمینه برای مانیفست
  if (
    url.pathname.startsWith("/fonts/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/favicon.ico" ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(url.pathname);
        if (cached) {
          if (url.pathname === "/manifest.webmanifest") {
            fetch(req)
              .then((res) => {
                if (res && res.ok) cache.put(url.pathname, res.clone());
              })
              .catch(() => {});
          }
          return cached;
        }
        try {
          const res = await fetch(req);
          if (res && res.ok) {
            cache.put(url.pathname, res.clone());
          }
          return res;
        } catch {
          return new Response("", { status: 504 });
        }
      }),
    );
    return;
  }

  // صفحه اصلی و میانبرهای وب‌اپ اندروید (/?source=pwa, /?action=scan, ...): اجرای آنی در آفلاین یا کندی اینترنت
  if (
    req.mode === "navigate" ||
    url.pathname === "/" ||
    url.pathname === "/hsab.html"
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        try {
          const res = await fetchWithTimeout(req, 2200);
          if (res && res.ok) {
            cache.put("/", res.clone());
            return res;
          }
        } catch {
          // آفلاین یا اینترنت ضعیف: بارگذاری آنی از کش آفلاین
        }
        const cachedRoot =
          (await cache.match("/")) ||
          (await cache.match("/hsab.html")) ||
          (await cache.match(req, { ignoreSearch: true }));
        if (cachedRoot) return cachedRoot;
        return fetch(req);
      }),
    );
  }
});

/* همگام‌سازی پس‌زمینه اندروید به‌محض اتصال به اینترنت (Background Sync API) */
function readIdbState() {
  return new Promise((resolve) => {
    try {
      const openReq = indexedDB.open("novin_ashpazkhaneh_db", 1);
      openReq.onupgradeneeded = () => {
        const db = openReq.result;
        if (!db.objectStoreNames.contains("kv")) {
          db.createObjectStore("kv");
        }
      };
      openReq.onerror = () => resolve(null);
      openReq.onsuccess = () => {
        try {
          const db = openReq.result;
          const tx = db.transaction("kv", "readonly");
          const getReq = tx.objectStore("kv").get("state");
          getReq.onsuccess = () => {
            db.close();
            resolve(getReq.result || null);
          };
          getReq.onerror = () => {
            db.close();
            resolve(null);
          };
        } catch {
          resolve(null);
        }
      };
    } catch {
      resolve(null);
    }
  });
}

function writeIdbState(stateObj) {
  return new Promise((resolve) => {
    try {
      const openReq = indexedDB.open("novin_ashpazkhaneh_db", 1);
      openReq.onupgradeneeded = () => {
        const db = openReq.result;
        if (!db.objectStoreNames.contains("kv")) {
          db.createObjectStore("kv");
        }
      };
      openReq.onerror = () => resolve(false);
      openReq.onsuccess = () => {
        try {
          const db = openReq.result;
          const tx = db.transaction("kv", "readwrite");
          tx.objectStore("kv").put(stateObj, "state");
          tx.oncomplete = () => {
            db.close();
            resolve(true);
          };
          tx.onerror = () => {
            db.close();
            resolve(false);
          };
        } catch {
          resolve(false);
        }
      };
    } catch {
      resolve(false);
    }
  });
}

async function backgroundCloudSync() {
  const clients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  if (clients.length > 0) {
    for (const c of clients) {
      c.postMessage({ type: "TRIGGER_CLOUD_SYNC" });
    }
    return;
  }
  // اگر اپ بسته است، خود Service Worker تغییرات آفلاین ذخیره‌شده در IndexedDB را به سرور می‌فرستد
  const st = await readIdbState();
  if (!st || !st._dirty || (st.settings && st.settings.sync === false)) return;
  const payload = {
    rev: Math.max(Number(st.rev || 0), Number(st._serverRev || 0)),
    seq: st.seq,
    settings: st.settings,
    products: st.products || [],
    contacts: st.contacts || [],
    invoices: st.invoices || [],
    expenses: st.expenses || [],
    receipts: st.receipts || [],
    deleted: st._deleted || [],
    replaceAll: Boolean(st._replaceAll),
    clearAll: Boolean(st._clearAll),
  };
  const res = await fetch("/api/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const j = await res.json().catch(() => ({}));
  if (res.ok && j && j.ok) {
    st._serverRev = Number(j.rev || st._serverRev || 0);
    st.rev = Math.max(Number(st.rev || 0), st._serverRev);
    if (j.seq) st.seq = j.seq;
    st._dirty = false;
    st._deleted = [];
    st._replaceAll = false;
    st._clearAll = false;
    st.savedAt = new Date().toISOString();
    await writeIdbState(st);
  } else {
    throw new Error("sync retry needed");
  }
}

self.addEventListener("sync", (event) => {
  if (event.tag === "novin-cloud-sync") {
    event.waitUntil(backgroundCloudSync());
  }
});
