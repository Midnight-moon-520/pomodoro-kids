/**
 * sw.js — Service Worker
 * 提供离线缓存和 PWA 支持
 */

const CACHE_NAME = 'pomodoro-v2';
const ASSETS_TO_CACHE = [
    '/',
    'index.html',
    'css/main.css',
    'js/audio.js',
    'js/storage.js',
    'js/app.js',
    'manifest.json',
    'icons/icon-72.png',
    'icons/icon-96.png',
    'icons/icon-128.png',
    'icons/icon-144.png',
    'icons/icon-152.png',
    'icons/icon-192.png',
    'icons/icon-384.png',
    'icons/icon-512.png',
];

// 安装：缓存所有静态资源
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Caching assets');
            return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
                // 某些资源可能不存在（如图标），继续安装
                console.warn('[SW] Cache addAll partial failure:', err);
            });
        })
    );
    // 立即激活，不等待旧 SW
    self.skipWaiting();
});

// 激活：清理旧缓存
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            );
        })
    );
    // 立即接管所有页面
    self.clients.claim();
});

// 请求拦截：Cache First 策略
self.addEventListener('fetch', (event) => {
    // 跳过非 GET 请求
    if (event.request.method !== 'GET') return;

    // 跳过 chrome-extension 等非 http(s) 请求
    if (!event.request.url.startsWith('http')) return;

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            // 缓存命中：直接返回
            if (cachedResponse) {
                // 后台更新缓存
                fetch(event.request).then((response) => {
                    if (response && response.status === 200) {
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, response);
                        });
                    }
                }).catch(() => {});
                return cachedResponse;
            }

            // 缓存未命中：网络请求
            return fetch(event.request).then((response) => {
                // 不缓存非成功响应
                if (!response || response.status !== 200) {
                    return response;
                }

                // 缓存成功的响应（克隆后缓存，因为 response body 只能读一次）
                const responseToCache = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });

                return response;
            }).catch(() => {
                // 网络失败：返回离线页面（仅对导航请求）
                if (event.request.mode === 'navigate') {
                    return caches.match('index.html');
                }
                // 其他资源返回空响应
                return new Response('', { status: 408, statusText: 'Offline' });
            });
        })
    );
});
