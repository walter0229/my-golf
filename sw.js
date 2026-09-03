/* 서비스 워커: 필드에서 인터넷이 안 터져도 앱이 열리도록 파일을 캐시해 둔다.
   앱 파일을 수정했다면 아래 CACHE 이름의 숫자를 올려야 새 버전이 적용된다. */
var CACHE = 'golf-score-v9';
var FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './css/style.css?v=9',
  './js/util.js?v=9',
  './js/courses-north.js?v=9',
  './js/courses.js?v=9',
  './js/store.js?v=9',
  './js/strategy.js?v=9',
  './js/stats.js?v=9',
  './js/app.js?v=9',
  './js/view-round.js?v=9',
  './js/view-stats.js?v=9',
  './js/view-settings.js?v=9',
  './js/sheets.js?v=9'
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

  /* index.html 은 항상 네트워크를 먼저 본다.
     여기에 각 파일의 ?v= 번호가 들어 있어서, 이 파일이 캐시에 묶이면
     앱을 새로 배포해도 계속 옛 버전 파일만 불러오게 된다.
     (오프라인이면 캐시본으로 넘어간다) */
  var isIndex = e.request.mode === 'navigate' ||
    url.pathname === '/' || /\/(index\.html)?$/.test(url.pathname) && !url.pathname.match(/\.[a-z]+$/i);
  if (isIndex || url.pathname.endsWith('/index.html')) {
    e.respondWith(
      fetch(e.request).then(function (res) {
        if (res && res.ok) {
          var clone = res.clone();
          caches.open(CACHE).then(function (c) { c.put('./index.html', clone); });
        }
        return res;
      }).catch(function () {
        return caches.match('./index.html').then(function (hit) { return hit || caches.match('./'); });
      })
    );
    return;
  }

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
