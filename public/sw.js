/* FX-991CN X — 离线可用 service worker（cache-first，仅缓存同源 GET） */
const CACHE = "fx991cnx-v1";
const SHELL = "/FX-991-CNX/";

self.addEventListener("install", (e) => {
    e.waitUntil(
        caches.open(CACHE).then((cache) => cache.addAll([SHELL]).catch(() => {}))
    );
    self.skipWaiting();
});

self.addEventListener("activate", (e) => {
    e.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
            )
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (e) => {
    const req = e.request;
    if (req.method !== "GET" || !req.url.startsWith(self.location.origin)) {
        return;
    }
    e.respondWith(
        caches.open(CACHE).then(async (cache) => {
            try {
                const res = await fetch(req);
                if (res && res.ok) {
                    const isStatic =
                        req.url.includes("/_next/static/") ||
                        req.mode === "navigate";
                    if (isStatic) {
                        cache.put(req, res.clone());
                    }
                }
                return res;
            } catch (err) {
                const cached = await cache.match(req);
                if (cached) {
                    return cached;
                }
                if (req.mode === "navigate") {
                    const shell = await cache.match(SHELL);
                    if (shell) {
                        return shell;
                    }
                }
                throw err;
            }
        })
    );
});
