// Service worker: lets the app open offline and be installed on phone / PC.
// Strategy: network first (so you always get the newest version when online), cache as offline fallback.
// Stroke-order library + data from jsDelivr: cache first (versioned files never change), kept across app updates.
const CACHE = "xue-v7";
const CDN_CACHE = "xue-cdn";
const SHELL = [
  "./", "index.html", "manifest.webmanifest", "css/app.css", "css/pinyin.css", "css/listener.css", "css/features.css",
  "js/app.js", "js/icons.js", "js/sync.js", "js/firebase-config.js", "js/store.js", "js/speech.js", "js/pinyin.js", "js/lookup.js", "js/data/syllables.js",
  "js/pages/index.js", "js/pages/home.js", "js/pages/pronunciation.js", "js/pages/pinyin.js", "js/pages/listener.js", "js/zhpinyin.js", "js/translate.js",
  "js/data/phonetics.js", "js/data/rare-syllables.js", "js/pages/settings.js",
  "js/pages/flashcards.js", "js/pages/quiz.js", "js/pages/writing.js", "js/pages/notebook.js",
  "data/notebook-words.json", "data/pinyin-dict.json", "data/hanzi-pinyin.json", "data/notebook-pages.json",
  "icons/icon-192.png", "icons/icon-512.png", "icons/favicon-64.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== CDN_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.hostname === "cdn.jsdelivr.net" && /\/npm\/hanzi-writer(-data)?@/.test(url.pathname)) {
    e.respondWith(caches.open(CDN_CACHE).then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) c.put(req, res.clone());
      return res;
    }))));
    return;
  }
  if (url.origin !== location.origin) return;
  const big = url.pathname.endsWith(".pdf");          // don't fill the offline cache with the 14 MB PDF
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && !big) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match("index.html")))
  );
});
