/* Pitchcraft — tes service worker (sw.js) dengan lingkungan palsu: pemasangan, kegagalan file inti vs ikon, pemberitahuan pembaruan.
 * Jalankan: node tests/sw.test.js */
const fs = require('fs'), path = require('path'), vm = require('vm');
let fails = 0; const ok = (c, m) => { console.log((c ? 'LULUS  ' : 'GAGAL  ') + m); if (!c) fails++; };
function makeEnv(opt) {
    const handlers = {}, store = {}, posted = [], reqs = [];
    for (const k of opt.old || []) store[k] = {};
    const cache = name => ({ add: async r => { reqs.push(r); const url = r.url || r; if ((opt.fail || []).some(f => String(url).endsWith(f))) throw new Error('404'); store[name] = store[name] || {}; store[name][url] = 1; }, put() {}, match: async () => undefined });
    const self = { addEventListener: (t, f) => { handlers[t] = f; }, skipWaiting: () => { self.skipped = true; }, clients: { claim: async () => {}, matchAll: async () => [{ postMessage: m => posted.push(m) }] }, location: { origin: 'http://x' } };
    const ctx = vm.createContext({ self, location: { origin: 'http://x' }, console: { warn() {}, log() {} }, Promise, URL, Request: function (u, o) { this.url = u; this.cache = o && o.cache; this.method = 'GET'; },
        caches: { open: async n => cache(n), keys: async () => Object.keys(store), delete: async k => { delete store[k]; return true; }, match: async () => undefined }, fetch: async () => ({ ok: true, clone() { return this; } }) });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8'), ctx);
    const fire = async type => { let p; handlers[type]({ waitUntil: x => { p = x; }, request: null }); try { await p; return true; } catch (e) { return false; } };
    return { fire, self, posted, store, reqs };
}
(async () => {
    let e = makeEnv({}); ok(await e.fire('install') && e.self.skipped, 'pemasangan normal berhasil dan langsung aktif');
    ok(e.reqs.length > 30 && e.reqs.every(r => r.cache === 'reload'), 'semua file diambil dengan cache:"reload" (tidak dari cache HTTP lama)');
    e = makeEnv({ fail: ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png'] }); ok(await e.fire('install') && e.self.skipped, 'ikon yang belum diunggah tidak menggagalkan pemasangan');
    e = makeEnv({ fail: ['js/ear-training.js'] }); ok(!(await e.fire('install')) && !e.self.skipped, 'file inti gagal diambil: pemasangan dibatalkan (SW lama tetap dipakai)');
    e = makeEnv({}); await e.fire('activate'); ok(e.posted.length === 0, 'pemasangan pertama: tidak ada pemberitahuan "versi baru"');
    e = makeEnv({ old: ['pitchcraft-v29', 'pitchcraft-lib'] }); await e.fire('activate');
    ok(e.posted.length === 1 && e.posted[0].type === 'pc-updated' && !('pitchcraft-v29' in e.store) && ('pitchcraft-lib' in e.store), 'pembaruan: cache lama dibuang, cache pustaka login dipertahankan, klien diberi tahu');
    console.log(fails ? `\n${fails} tes gagal` : '\nSemua tes service worker lulus'); process.exit(fails ? 1 : 0);
})();
