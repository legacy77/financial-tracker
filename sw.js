// ============================================================
// sw.js — Service Worker for PWA Offline Caching
// KelolaRacun Phase 3
// ============================================================

const CACHE_NAME = 'kelolaracun-v19';
const ASSETS = [
  './index.html',
  './styles/modern-theme.css',
  './styles/components.css',
  './styles/print.css',
  './vendor/chart.umd.js',
  './scripts/app.js',
  './scripts/ui.js',
  './scripts/db.js',
  './scripts/screens/homeController.js',
  './scripts/screens/guildHallController.js',
  './scripts/screens/inventoryController.js',
  './scripts/screens/scrollReadingController.js',
  './scripts/screens/loginController.js',
  './scripts/screens/registerController.js',
  './scripts/core/helpers.js',
  './scripts/core/eventBus.js',
  './scripts/core/gamification.js',
  './scripts/core/autoTag.js',
  './scripts/core/seabankParser.js',
  './scripts/core/backupService.js',
  './scripts/core/healthScore.js',
  './scripts/core/authService.js',
  './scripts/core/crypto.js',
  './scripts/core/syncService.js',
  './scripts/services/guildService.js',
  './scripts/services/memberService.js',
  './scripts/services/pouchService.js',
  './scripts/services/transactionService.js',
  './scripts/services/billService.js',
  './scripts/services/categoryService.js',
  './scripts/services/importService.js',
  './scripts/services/budgetService.js',
  './scripts/core/payBill.js',
  './screens/00-register.html',
  './screens/01-guild-entrance.html',
  './screens/02-guild-hall.html',
  './screens/03-inventory.html',
  './screens/04-scroll-reading.html',
  './manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch((err) => {
        console.warn('SW cache addAll partial fail:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('/api/')) {
    return;
  }
  // Network first for API/navigation, cache first for static assets
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) {
        // Return cached but fetch update in background
        fetch(e.request).then((res) => {
          if (res.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, res));
          }
        }).catch(() => {});
        return cached;
      }
      return fetch(e.request).catch(() => {
        if (e.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});