// Service Worker for 体育授業用 遅延再生アプリ
const CACHE_NAME = 'sports-delay-playback-v1';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon.svg'
];

// インストールイベント
self.addEventListener('install', (event) => {
  console.log('Service Worker: インストール開始');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: キャッシュをオープン');
        return cache.addAll(urlsToCache.map(url => {
          return new Request(url, { cache: 'no-cache' });
        }));
      })
      .then(() => {
        console.log('Service Worker: 全てのリソースをキャッシュしました');
        // 即座にアクティブ化
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: キャッシュ失敗', error);
      })
  );
});

// アクティベートイベント
self.addEventListener('activate', (event) => {
  console.log('Service Worker: アクティベート');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // 古いキャッシュを削除
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: 古いキャッシュを削除', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // すべてのクライアントを制御下に置く
      return self.clients.claim();
    })
  );
});

// フェッチイベント
self.addEventListener('fetch', (event) => {
  // 同じオリジンのリクエストのみ処理
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }
  
  // カメラストリームやMediaSource関連のリクエストは除外
  if (event.request.url.includes('blob:') || 
      event.request.url.includes('data:') ||
      event.request.url.includes('mediastream:')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // キャッシュにある場合はそれを返す
        if (response) {
          console.log('Service Worker: キャッシュから返却', event.request.url);
          return response;
        }
        
        // キャッシュにない場合はネットワークから取得
        console.log('Service Worker: ネットワークから取得', event.request.url);
        
        return fetch(event.request).then((response) => {
          // 有効なレスポンスでない場合はそのまま返す
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // レスポンスをクローンしてキャッシュに保存
          const responseToCache = response.clone();
          
          caches.open(CACHE_NAME).then((cache) => {
            // HTMLファイルとマニフェストファイルのみキャッシュを更新
            if (event.request.url.endsWith('.html') || 
                event.request.url.endsWith('.json') ||
                event.request.url.endsWith('/')) {
              cache.put(event.request, responseToCache);
              console.log('Service Worker: 新しいコンテンツをキャッシュ', event.request.url);
            }
          });
          
          return response;
        });
      })
      .catch((error) => {
        console.error('Service Worker: フェッチエラー', error);
        
        // オフライン時のフォールバック
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      })
  );
});

// バックグラウンド同期（オプション）
self.addEventListener('sync', (event) => {
  console.log('Service Worker: バックグラウンド同期', event.tag);
  
  if (event.tag === 'update-cache') {
    event.waitUntil(updateCache());
  }
});

// キャッシュ更新関数
async function updateCache() {
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(urlsToCache);
    console.log('Service Worker: キャッシュを更新しました');
  } catch (error) {
    console.error('Service Worker: キャッシュ更新エラー', error);
  }
}

// プッシュ通知（将来の拡張用）
self.addEventListener('push', (event) => {
  console.log('Service Worker: プッシュ通知受信', event);
  
  const options = {
    body: event.data ? event.data.text() : '新しいお知らせがあります',
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };
  
  event.waitUntil(
    self.registration.showNotification('遅延再生アプリ', options)
  );
});

// 通知クリック処理
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: 通知クリック', event);
  
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow('./')
  );
});

// メッセージ受信（アプリとの通信用）
self.addEventListener('message', (event) => {
  console.log('Service Worker: メッセージ受信', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.delete(CACHE_NAME).then(() => {
        console.log('Service Worker: キャッシュをクリアしました');
      })
    );
  }
});