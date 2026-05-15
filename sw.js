// 魚魚副食品工具 - Service Worker
// 版本號更新時會強制重新快取所有資源
const CACHE_NAME = 'yuyu-nutrition-v3';

const ASSETS = [
  '/baby-nutrition/',
  '/baby-nutrition/index.html',
  '/baby-nutrition/manifest.json',
  '/baby-nutrition/icon-192.png',
  '/baby-nutrition/icon-512.png',
];

// ── 安裝：快取所有核心資源 ──────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // 逐一快取，即使部分失敗也不影響整體
      return Promise.allSettled(
        ASSETS.map(url => cache.add(url).catch(() => {}))
      );
    }).then(() => self.skipWaiting())
  );
});

// ── 啟動：清除舊快取 ────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── 攔截請求：離線優先策略 ──────────────────────────────────────────
self.addEventListener('fetch', event => {
  // 只處理 GET 請求
  if (event.request.method !== 'GET') return;

  // Google Fonts：網絡優先，快取備用
  if (event.request.url.includes('fonts.googleapis.com') ||
      event.request.url.includes('fonts.gstatic.com')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 核心資源：快取優先，網絡備用（離線可用）
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // 背景更新快取（不阻塞用戶）
        fetch(event.request).then(response => {
          if (response && response.status === 200) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, response));
          }
        }).catch(() => {});
        return cached;
      }
      // 沒有快取則從網絡取得
      return fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // 完全離線且無快取時，返回主頁
        return caches.match('/baby-nutrition/');
      });
    })
  );
});

// ── 接收主頁面消息（用於強制更新）────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
