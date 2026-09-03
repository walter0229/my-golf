/* 서비스 워커: 필드에서 인터넷이 안 터져도 앱이 열리도록 파일을 캐시해 둔다.
   앱 파일을 수정했다면 아래 CACHE 이름의 숫자를 올려야 새 버전이 적용된다. */
var CACHE = 'golf-score-v6';
var FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './css/style.css?v=6',
  './js/util.js?v=6',
  './js/courses.js?v=6',
  './js/store.js?v=6',
  './js/strategy.js?v=6',
  './js/stats.js?v=6',
  './js/app.js?v=6',
  './js/view-round.js?v=6',
  './js/view-stats.js?v=6',
  './js/view-settings.js?v=6',
  './js/sheets.js?v=6'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  // 구글 API 요청은 캐시하지 않는다
  if (url.origin !== location.origin) return;
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then(function (hit) {
      if (hit) {
        // 캐시를 먼저 주고, 뒤에서 조용히 갱신
        fetch(e.request).then(function (res) {
          if (res && res.ok) caches.open(CACHE).then(function (c) { c.put(e.request, res.clone()); });
        }).catch(function () {});
        return hit;
      }
      return fetch(e.request).then(function (res) {
        if (res && res.ok) {
          var clone = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, clone); });
        }
        return res;
      }).catch(function () {
        return caches.match('./index.html');
      });
    })
  );
});
