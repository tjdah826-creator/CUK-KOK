/* CUK-콕 서비스 워커 (2026.11.17 · 추진안 10번)
 * - 화면(앱 껍데기)은 '새로 받기 우선': 인터넷이 되면 항상 최신 파일을 받고, 안 될 때만 저장본을 보여 줘요.
 *   그래서 수정한 index.html을 올리면 다음 접속에 바로 반영돼요 (옛 화면이 남지 않음).
 * - 공고 데이터(Apps Script)는 건드리지 않아요. 페이지가 이미 이 기기에 7일 동안 저장해 둬요.
 * - 글꼴(Google Fonts)은 한 번 받은 것을 다시 써요.
 * 버전을 올리면 예전 저장본은 지워져요. index.html의 APP_VERSION과 같게 맞춰 주세요.
 */
var VERSION = "2026.11.20-p3.23";
var SHELL_CACHE = "cuk-kok-shell-" + VERSION;
var FONT_CACHE = "cuk-kok-fonts-v1";
var SHELL = [
  "./", "./index.html", "./manifest.webmanifest", "./favicon.svg", "./favicon-32.png",
  "./apple-touch-icon.png", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(SHELL_CACHE).then(function (c) {
      // 파일 하나가 없어도 설치가 멈추지 않게 하나씩 담기
      return Promise.all(SHELL.map(function (u) { return c.add(u).catch(function () {}); }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) {
        return k.indexOf("cuk-kok-shell-") === 0 && k !== SHELL_CACHE;
      }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function networkFirst(req) {
  return fetch(req).then(function (res) {
    if (res && res.ok) {
      var copy = res.clone();
      caches.open(SHELL_CACHE).then(function (c) { c.put(req, copy); });
    }
    return res;
  }).catch(function () {
    return caches.match(req, { ignoreSearch: true }).then(function (hit) {
      return hit || (req.mode === "navigate" ? caches.match("./index.html") : undefined) || Response.error();
    });
  });
}

function fontCacheFirst(req) {
  return caches.open(FONT_CACHE).then(function (c) {
    return c.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        if (res && (res.ok || res.type === "opaque")) c.put(req, res.clone());
        return res;
      });
    });
  });
}

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(fontCacheFirst(req));
    return;
  }
  if (url.origin !== self.location.origin) return;   // 공고 데이터·외부 링크는 그대로 통과
  e.respondWith(networkFirst(req));
});
