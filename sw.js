/* Pitchcraft — service worker: simpan semua file agar app jalan offline.
 * Naikkan nomor VERSI setiap kali ada file yang berubah supaya cache lama dibuang. */
const VERSI = 'pitchcraft-v6';
const FILES = ['./', 'index.html', 'privacy.html', 'manifest.json', 'css/style.css',
    'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
    'js/boot.js', 'js/config.js', 'js/chords-db.js', 'js/pitch.js', 'js/gate.js', 'js/audio.js', 'js/tuner.js',
    'js/chords-ui.js', 'js/progression.js', 'js/strum-analysis.js', 'js/strum-mode.js', 'js/tabs.js', 'js/tuning.js',
    'js/key-capo.js', 'js/strum-pattern.js', 'js/practice.js', 'js/chord-library.js', 'js/song.js', 'js/store.js', 'js/extras.js',
    'js/settings.js', 'js/supabase-config.js', 'js/sync.js', 'js/init.js'];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(VERSI).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
    e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSI).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// cache dulu (cepat & offline), lalu perbarui diam-diam di belakang layar
self.addEventListener('fetch', e => {
    const r = e.request;
    if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
    e.respondWith(caches.match(r, { ignoreSearch: true }).then(hit => {
        const net = fetch(r).then(res => {
            if (res && res.ok) { const cp = res.clone(); caches.open(VERSI).then(c => c.put(r, cp)); }
            return res;
        }).catch(() => hit || (r.mode === 'navigate' ? caches.match('index.html') : undefined));
        return hit || net;
    }));
});
