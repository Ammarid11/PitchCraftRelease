/* Pitchcraft — service worker: simpan semua file agar app jalan offline.
 * Naikkan nomor VERSI (dan APP_VER di js/tabs.js) setiap kali ada file yang berubah supaya cache lama dibuang. */
const VERSI = 'pitchcraft-v30';
const FILES = ['./', 'index.html', 'privacy.html', 'manifest.json', 'css/style.css',
    'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
    'js/boot.js', 'js/config.js', 'js/chords-db.js', 'js/pitch.js', 'js/gate.js', 'js/audio.js', 'js/tuner.js',
    'js/chords-ui.js', 'js/progression.js', 'js/strum-analysis.js', 'js/strum-mode.js', 'js/tabs.js', 'js/tuning.js',
    'js/key-capo.js', 'js/strum-pattern.js', 'js/practice.js', 'js/chord-library.js', 'js/song.js', 'js/store.js', 'js/extras.js', 'js/share.js', 'js/chord-pick.js', 'js/fx.js', 'js/finger-move.js', 'js/voice-range.js', 'js/ear-training.js', 'js/theme.js',
    'js/settings.js', 'js/supabase-config.js', 'js/sync.js', 'js/init.js'];

// pustaka login (versi dikunci, tidak berubah) disimpan di cache terpisah agar akun tetap termuat saat offline; cache ini tidak ikut dibuang saat VERSI naik
const LIBC = 'pitchcraft-lib', LIB_RE = /^https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@\d+\.\d+\.\d+\//;
self.addEventListener('install', e => {
    // satu per satu: file yang hilang (mis. ikon belum diunggah) tidak boleh menggagalkan seluruh pembaruan
    e.waitUntil(caches.open(VERSI).then(c => Promise.all(FILES.map(f => c.add(f).catch(() => console.warn('sw: gagal menyimpan', f))))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
    e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSI && k !== LIBC).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// cache dulu (cepat & offline), lalu perbarui diam-diam di belakang layar
self.addEventListener('fetch', e => {
    const r = e.request;
    if (r.method === 'GET' && LIB_RE.test(r.url)) {
        e.respondWith(caches.open(LIBC).then(c => c.match(r.url).then(hit => hit || fetch(r.url, { mode: 'cors' }).then(res => { if (res.ok) c.put(r.url, res.clone()); return res; }))));
        return;
    }
    if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
    e.respondWith(caches.match(r, { ignoreSearch: true }).then(hit => {
        const net = fetch(r).then(res => {
            if (res && res.ok) { const cp = res.clone(); caches.open(VERSI).then(c => c.put(r, cp)); }
            return res;
        }).catch(() => hit || (r.mode === 'navigate' ? caches.match('index.html') : undefined));
        return hit || net;
    }));
});
