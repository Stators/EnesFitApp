// Enes FitApp — uygulama kabuğu önbelleği. Sürümü her yayında artır (enesfit-v1 -> v2 -> ...).
const CACHE = 'enesfit-v2';

// Kurulumda dosyaları önceden çekmeyi (cache.addAll) DENEMİYORUZ: bazı ortamlarda
// (test edilen headless Chrome dahil) bu istekler hiç tamamlanmayıp "installing"
// durumunda asılı kalabiliyor ve service worker hiç aktif olmuyor. Onun yerine kurulum
// anında çalışır (skipWaiting hemen etkinleşir); kabuk dosyaları aşağıdaki fetch
// işleyicisiyle ilk ziyarette / ilk yeniden yüklemede kendiliğinden önbelleğe alınır.
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(Promise.all([
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
    self.clients.claim()
  ]));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // Sayfanın kendisi: ağ öncelikli. İnternet varsa hep en güncel sürüm gelir;
  // yoksa (çevrimdışı) önbellekteki son bilinen sürüm gösterilir.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => { caches.open(CACHE).then((c) => c.put('index.html', res.clone())); return res; })
        .catch(() => caches.match('index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // Aynı kaynaktan statik dosyalar: önbellekten hızlı yanıt, arka planda güncelle.
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        if (res && res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
        return res;
      }).catch(() => cached))
    );
  }
});
