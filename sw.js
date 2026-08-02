/* Service worker телесуфлёра: страница открывается без интернета.
 *
 * Стратегия — сеть вперёд, кэш как запасной аэродром, с таймаутом в 2.5 с.
 * Так выбрано намеренно: приложение весит десятки килобайт, а открывают его
 * обычно перед записью, когда сеть есть. Тогда каждый онлайн-заход обновляет
 * кэш сам, и не бывает ни рассинхрона (свежий HTML + старый JS из кэша), ни
 * плашек «доступно обновление». Кэш стреляет ровно там, где нужен: интернета
 * нет или он такой, что ждать дольше 2.5 с бессмысленно.
 *
 * Следствие для деплоя: менять VERSION при обычной правке файлов НЕ нужно —
 * кэш обновляется сам. Версия нужна, только если поменялся список ASSETS
 * (тогда новый sw.js перекачает набор целиком) или понадобилось выбросить
 * старый кэш у всех.
 */

var VERSION = 'v1';
var CACHE = 'teleprompter-' + VERSION;
var NETWORK_TIMEOUT = 2500;

var ASSETS = [
  './index.html',
  './style.css',
  './app.js',
  './text-tools.js'
];

// Ключ кэша — путь без query: иначе ?v=2 и ?fresh=1 плодили бы копии
// одного и того же файла, а офлайн-заход по «голому» адресу их не нашёл бы.
function cacheKey(url) {
  var u = new URL(url);
  var path = u.pathname.slice(-1) === '/' ? u.pathname + 'index.html' : u.pathname;
  return u.origin + path;
}

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (cache) { return cache.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (names) {
        return Promise.all(names.map(function (name) {
          return name.indexOf('teleprompter-') === 0 && name !== CACHE ? caches.delete(name) : null;
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var request = e.request;
  if (request.method !== 'GET') return;

  var url;
  try { url = new URL(request.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return; // чужие адреса не наше дело

  e.respondWith(networkFirst(request, cacheKey(request.url)));
});

function networkFirst(request, key) {
  return new Promise(function (resolve) {
    var done = false;

    function finish(response) {
      if (done || !response) return;
      done = true;
      resolve(response);
    }

    // медленная сеть не должна держать пользователя: через 2.5 с отдаём кэш,
    // а ответ сети, когда придёт, всё равно освежит кэш к следующему разу
    var timer = setTimeout(function () {
      caches.match(key).then(finish);
    }, NETWORK_TIMEOUT);

    fetch(request).then(function (response) {
      clearTimeout(timer);
      if (response && response.ok && response.type === 'basic') {
        var copy = response.clone();
        caches.open(CACHE).then(function (cache) { cache.put(key, copy); });
      }
      finish(response);
    }).catch(function () {
      clearTimeout(timer);
      caches.match(key).then(function (hit) {
        // офлайн и файла нет в кэше: для перехода по адресу отдаём приложение,
        // для остального — честную ошибку
        if (hit) { finish(hit); return; }
        if (request.mode === 'navigate') {
          caches.match(cacheKey(self.location.origin + '/index.html')).then(function (index) {
            finish(index || Response.error());
          });
          return;
        }
        finish(Response.error());
      });
    });
  });
}
