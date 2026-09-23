/* ==========================================================================
   WMD Dashboard v.04 - Service Worker (sw.js)
   Menyediakan kemampuan PWA offline-first, caching aset, dan performa tinggi.
   ========================================================================== */

const CACHE_NAME = 'wmd-dashboard-v4-cache-v1';
const DYNAMIC_CACHE = 'wmd-dashboard-dynamic-v1';

// Daftar aset utama (App Shell) & CDN library yang di-cache saat instalasi
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  // Library CDN bawaan yang digunakan oleh WMD Dashboard
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',
  'https://code.jquery.com/jquery-3.6.0.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js',
  'https://cdn.datatables.net/1.13.6/css/jquery.dataTables.min.css',
  'https://cdn.datatables.net/1.13.6/js/jquery.dataTables.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js'
];

// 1. EVENT INSTALLATION: Simpan aset utama ke Cache Storage
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching App Shell & CDN Libraries...');
      return cache.addAll(APP_SHELL).catch((error) => {
        console.warn('[Service Worker] Beberapa aset gagal di-pre-cache:', error);
      });
    }).then(() => self.skipWaiting())
  );
});

// 2. EVENT ACTIVATION: Pembersihan Cache versi lama
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating Service Worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME && cache !== DYNAMIC_CACHE) {
            console.log('[Service Worker] Menghapus Cache Lama:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. EVENT FETCH: Strategi Stale-While-Revalidate (Utamakan Cache, Update via Jaringan)
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Abaikan request non-GET dan koneksi Realtime Firebase / WebSocket
  if (request.method !== 'GET' || url.pathname.includes('/.ws') || url.hostname.includes('firebaseio.com')) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // Ambil pembaruan dari jaringan secara latar belakang
      const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return networkResponse;
      }).catch((err) => {
        console.log('[Service Worker] Koneksi offline, menggunakan data dari Cache.', err);
      });

      // Kembalikan versi cache jika ada, atau tunggu hasil dari jaringan
      return cachedResponse || fetchPromise;
    })
  );
});

// 4. EVENT SYNC: Latar belakang sinkronisasi data saat online kembali (opsional)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-firebase-data') {
    console.log('[Service Worker] Menyinkronkan data offline ke Firebase...');
  }
});
