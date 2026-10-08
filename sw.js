/* 倪海厦课程知识库 —— Service Worker（离线优先，图片按需缓存） */
const VERSION = "nb-v1";
const SHELL = VERSION + "-shell";
const DATA = VERSION + "-data";
const IMG = VERSION + "-img";

const SHELL_FILES = [
  "./",
  "./index.html",
  "./search.html",
  "./evidence.html",
  "./ask.html",
  "./gallery/index.html",
  "./assets/css/app.css",
  "./assets/js/core.js",
  "./assets/js/app.js",
  "./assets/js/search.js",
  "./assets/js/gallery.js",
  "./assets/js/evidence.js",
  "./assets/js/ask.js",
  "./manifest.webmanifest",
  "./assets/icons/icon-192.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(SHELL).then((c) => Promise.allSettled(SHELL_FILES.map((u) => c.add(new Request(u, { cache: "reload" })))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  const p = url.pathname;

  // 1) 站点数据：后台更新（stale-while-revalidate）
  if (p.includes("/assets/data/")) {
    event.respondWith(
      caches.open(DATA).then(async (cache) => {
        const cached = await cache.match(req);
        const net = fetch(req).then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        }).catch(() => cached);
        return cached || net;
      })
    );
    return;
  }

  // 2) 截图与图标：缓存优先
  if (p.includes("/screenshots/") || p.includes("/assets/icons/")) {
    event.respondWith(
      caches.open(IMG).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const res = await fetch(req);
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        } catch (e) {
          return new Response("", { status: 504 });
        }
      })
    );
    return;
  }

  // 3) 页面与静态资源：网络优先，失败回退缓存
  event.respondWith(
    (async () => {
      try {
        const res = await fetch(req);
        if (res && res.ok && (p.endsWith(".html") || p.endsWith("/") || p.endsWith(".css") || p.endsWith(".js") || p.endsWith(".webmanifest"))) {
          const cache = await caches.open(SHELL);
          cache.put(req, res.clone());
        }
        return res;
      } catch (e) {
        const cached = await caches.match(req);
        if (cached) return cached;
        if (req.mode === "navigate") return caches.match("./index.html");
        return new Response("", { status: 504 });
      }
    })()
  );
});
