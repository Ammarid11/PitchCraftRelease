/* Pitchcraft — tes mesin sinkron dengan server palsu (di memori) dan dua "perangkat".
 * Jalankan:  node tests/sync.test.js
 * Yang diuji: logika gabung (sesi, lencana, lagu, konflik, pengaturan). Adapter Supabase asli (dbReal) TIDAK diuji di sini. */
const fs = require('fs'), path = require('path'), vm = require('vm'), nodeCrypto = require('crypto');
const ROOT = path.join(__dirname, '..');
let fails = 0; const ok = (c, m) => { console.log((c ? 'LULUS  ' : 'GAGAL  ') + m); if (!c) fails++; };

// ---- server palsu: perilaku sama dengan skema (waktu server, cek updated_at, sesi append-only, kunci (user_id,id)) ----
function makeServer() {
    let clock = Date.parse('2026-10-20T00:00:00Z');
    const tick = () => new Date(clock += 1000).toISOString();
    const S = { sessions: new Map(), badges: new Set(), misses: new Map(), songs: new Map(), settings: null, calls: [] };
    S.db = {
        async getDoc(kind, id) { S.calls.push('get:' + kind); return kind === 'song' ? (id ? S.songs.get(id) : [...S.songs.values()].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0]) || null : S.settings; },
        async insertDoc(kind, row) {
            S.calls.push('insert:' + kind); const r = Object.assign({}, row, { updated_at: tick() });
            if (kind === 'song') { if (S.songs.has(row.id)) { const e = new Error('dup'); e.code = '23505'; throw e; } S.songs.set(row.id, r); }
            else { if (S.settings) { const e = new Error('dup'); e.code = '23505'; throw e; } S.settings = r; }
            return r.updated_at;
        },
        async updateDoc(kind, id, data, base) {
            S.calls.push('update:' + kind); const r = kind === 'song' ? S.songs.get(id) : S.settings;
            if (!r || r.updated_at !== base) return null; r.data = JSON.parse(JSON.stringify(data)); r.updated_at = tick(); return r.updated_at;
        },
        async sessionsSince(cur) { return [...S.sessions.values()].filter(r => Date.parse(r.created_at) > Date.parse(cur)); },
        async upsertSessions(rows) { S.calls.push('sessions:' + rows.length); const t = tick(); rows.forEach(r => { if (!S.sessions.has(r.id)) S.sessions.set(r.id, Object.assign({}, r, { created_at: t })); }); },
        async missesSince(cur) { return [...S.misses.values()].filter(r => Date.parse(r.created_at) > Date.parse(cur)); },
        async upsertMisses(rows) { S.calls.push('misses:' + rows.length); const t = tick(); rows.forEach(r => { if (!S.misses.has(r.id)) S.misses.set(r.id, Object.assign({}, r, { created_at: t })); }); },
        async badgesAll() { return [...S.badges]; },
        async upsertBadges(rows) { rows.forEach(r => S.badges.add(r.badge_id)); }
    };
    return S;
}

// ---- perangkat: kode asli store.js + sync.js di sandbox sendiri, dengan stub untuk bagian UI app ----
function makeDevice() {
    const store = {}, el = () => ({ addEventListener() {}, classList: { add() {}, remove() {}, toggle() {} }, style: {}, set innerHTML(v) {}, set textContent(v) {} });
    const ctx = vm.createContext({ console, Math, JSON, Date, Set, Map, Object, Array, Number, String, Promise, isNaN, parseInt, setTimeout, clearTimeout,
        localStorage: { getItem: k => k in store ? store[k] : null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
        crypto: { randomUUID: () => nodeCrypto.randomUUID() }, navigator: { onLine: true }, window: { addEventListener() {} },
        document: { addEventListener() {}, getElementById: () => null, createElement: el, querySelectorAll: () => [], head: el(), body: el() }, location: { origin: 'http://x', pathname: '/' }, confirm: () => true, alert() {} });
    vm.runInContext(`
        const PC_KEY = 'pc_settings', toasts = [];
        const BADGES = [['first'], ['st3'], ['goal']];
        const esc = s => String(s), pcToast = m => toasts.push(m);
        const newSection = () => ({ name: 'Bait 1', lyrics: '', chords: [] });
        const cleanSong = d => ({ name: String(d.name || ''), meter: d.meter || '4/4', sections: (d.sections || []).map(s => ({ name: s.name, lyrics: s.lyrics || '', chords: s.chords || [] })) });
        let song = { name: '', meter: '4/4', sections: [newSection()] }, progression = [], appBpm = 80;
        const collectSettings = () => ({ v: 1, progression, song, bpm: appBpm });
        function loadSettings() { const s = JSON.parse(localStorage.getItem(PC_KEY)); if (s) { progression = s.progression || []; appBpm = s.bpm; } }
        function saveSettings() {}
        const noop = () => {}; var renderTuning = noop, renderKey = noop, renderPat = noop, renderProgression = noop, renderSong = noop, refreshChordViews = noop, renderStreak = noop;
    `, ctx);
    ['store.js', 'sync.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), ctx, { filename: f }));
    const dev = { ctx, store, run: c => vm.runInContext(c, ctx) };
    dev.addSession = (dur, day) => dev.run(`(() => { const s = getSessions(); s.push({ id: newId(), mode: 'level', level: 'dasar', dur: ${dur}, ok: 9, bad: 1, cpm: 12, played_at: '${day}T10:00:00.000Z', day: '${day}' }); setSessions(s); })()`);
    dev.days = () => dev.run('daysOf(getSessions())');
    dev.sync = (S, uid = 'u1') => vm.runInContext('syncOnce', ctx)(S.db, uid);
    dev.setSong = t => dev.run(`song = { name: 'T', meter: '4/4', sections: [{ name: 'Bait', lyrics: ${JSON.stringify(t)}, chords: [] }] }`);
    dev.songText = () => dev.run('song.sections[0].lyrics');
    return dev;
}

(async () => {
    // 1. dua perangkat, hari yang sama: 60 dtk + 120 dtk harus jadi 180 (bukan 120)
    let S = makeServer(), A = makeDevice(), B = makeDevice();
    A.addSession(60, '2026-10-20'); B.addSession(120, '2026-10-20');
    await A.sync(S); await B.sync(S); await A.sync(S);
    ok(A.days()['2026-10-20'] === 180 && B.days()['2026-10-20'] === 180, 'total harian dari dua perangkat = 180 dtk di keduanya');
    ok(S.sessions.size === 2, 'server berisi 2 sesi, tanpa duplikat');

    // 2. sinkron berulang tidak mendorong ulang apa pun
    S.calls.length = 0; await A.sync(S); await A.sync(S);
    ok(!S.calls.some(c => c.startsWith('sessions') || c.startsWith('update') || c.startsWith('insert')), 'sinkron ulang tanpa perubahan tidak menulis ke server');

    // 3. lagu dari A muncul di B (B masih lagu kosong)
    A.setSong('[Am]halo'); await A.sync(S); await B.sync(S);
    ok(B.songText() === '[Am]halo', 'lagu A diadopsi perangkat B');

    // 4. hanya B yang mengedit -> A mengikuti, tanpa konflik
    B.setSong('[G]dunia'); await B.sync(S); await A.sync(S);
    ok(A.songText() === '[G]dunia' && !A.store.pc_conflicts, 'edit satu sisi merambat tanpa konflik');

    // 5. keduanya mengedit saat offline -> versi lokal yang kalah disimpan, bukan hilang
    A.setSong('[C]versi A'); B.setSong('[D]versi B');
    await A.sync(S); await B.sync(S);
    const conf = B.store.pc_conflicts ? JSON.parse(B.store.pc_conflicts) : {};
    ok(B.songText() === '[C]versi A', 'konflik: B memakai versi server (A)');
    ok(conf.song && conf.song.data.sections[0].lyrics === '[D]versi B', 'konflik: versi B tersimpan, tidak hilang diam-diam');
    B.run("restoreConflict('song')"); await B.sync(S); await A.sync(S);
    ok(A.songText() === '[D]versi B', 'pemulihan konflik mendorong versi B ke server & A');

    // 6. lencana: gabungan, tidak dicabut
    S = makeServer(); A = makeDevice(); B = makeDevice();
    A.run("lsSet('pc_badges', ['first'])"); B.run("lsSet('pc_badges', ['st3'])");
    await A.sync(S); await B.sync(S); await A.sync(S);
    ok(A.run("lsGet('pc_badges', []).sort().join()") === 'first,st3' && B.run("lsGet('pc_badges', []).sort().join()") === 'first,st3', 'lencana digabung di kedua perangkat');

    // 7. perangkat baru: pengaturan bawaan tidak dianggap konflik; progresi lama ikut
    A.run("progression = [{key:'Am',v:0}]"); await A.sync(S);
    const C = makeDevice(); await C.sync(S);
    ok(C.run('progression.length') === 1 && !C.store.pc_conflicts, 'perangkat baru menerima progresi tanpa konflik palsu');

    // 8. migrasi data lama: pc_days -> sesi ber-ID tetap, tidak ganda
    const D = makeDevice(); D.store.pc_days = JSON.stringify({ '2026-10-01': 300 });
    D.run("localStorage.removeItem('pc_migr2'); localStorage.removeItem('pc_sessions')"); D.run('migrateLegacy(); migrateLegacy()');
    ok(D.run('getSessions().length') === 1 && D.run('getSessions()[0].id') === 'legacy-2026-10-01', 'migrasi pc_days menjadi 1 sesi legacy, aman diulang');

    // 9. data jelek ditolak
    ok(D.run("cleanSession({id:'x',day:'bukan-tanggal',played_at:'2026-01-01'})") === null && D.run("cleanSession({id:'',day:'2026-01-01',played_at:'2026-01-01'})") === null, 'sesi tidak valid ditolak');

    // 10. server menolak pembaruan berbasis versi lama (kondisi balapan) -> ulang, bukan menimpa
    S = makeServer(); A = makeDevice(); B = makeDevice();
    A.setSong('[Am]satu'); await A.sync(S); await B.sync(S);
    A.setSong('[Am]dua'); let hijacked = false; const orig = S.db.updateDoc;
    S.db.updateDoc = async (...a) => { if (!hijacked) { hijacked = true; const r = [...S.songs.values()][0]; r.data = { name: 'T', meter: '4/4', sections: [{ name: 'Bait', lyrics: '[X]dari B', chords: [] }] }; r.updated_at = '2030-01-01T00:00:00.000Z'; } return orig(...a); };
    await A.sync(S);
    ok(A.songText() === '[X]dari B' && A.store.pc_conflicts, 'balapan terdeteksi: versi server dipakai, edit lokal disimpan sebagai konflik');

    // 11. catatan akor salah: A mencatat, B menerima; tidak ganda, tidak dikirim ulang
    S = makeServer(); A = makeDevice(); B = makeDevice();
    A.run("setMisses([{ id: 'm1', t: 1760000000000, want: 'Am', got: 'C' }, { id: 'm2', t: 1760000001000, want: 'Am', got: 'C' }])");
    await A.sync(S); await B.sync(S); await A.sync(S);
    ok(S.misses.size === 2 && B.run('getMisses().length') === 2 && A.run('getMisses().length') === 2, 'catatan akor salah sampai ke server dan perangkat B tanpa ganda');
    S.calls.length = 0; await A.sync(S); await B.sync(S);
    ok(!S.calls.some(c => c.startsWith('misses:')), 'catatan yang sudah di server tidak dikirim ulang');
    A.run("setMisses(Array.from({ length: 350 }, (_, i) => ({ id: 'x' + i, t: 1760000100000 + i, want: 'G', got: 'D' })))"); await A.sync(S);
    ok(A.run('getMisses().length') === 300 && S.misses.size === 352, 'perangkat menyimpan 300 terbaru, server menyimpan semuanya');
    ok(D.run("cleanMiss({ id: 'a', t: 1, want: '', got: 'C' })") === null, 'catatan salah tidak valid ditolak');

    // 12. statistik Latih Telinga: ikut sinkron antar perangkat, digabung (tidak menimpa), dan aman diulang
    S = makeServer(); A = makeDevice(); B = makeDevice();
    A.run("progression = [{key:'Am',v:0}]; lsSet('pc_ear', { kind: 'interval', best: { 'interval.mudah': 8 }, st_interval: { m3: [10, 8] }, conf_interval: { 'm3>M3': 2 } })");
    await A.sync(S);
    ok(S.settings && S.settings.data.ear && S.settings.data.ear.best['interval.mudah'] === 8 && !('kind' in S.settings.data.ear), 'statistik telinga terkirim ke server tanpa pilihan tampilan');
    B.run("lsSet('pc_ear', { kind: 'nada', best: { 'nada.sulit': 6, 'interval.mudah': 9 }, st_interval: { m3: [4, 4], M3: [6, 5] } })");
    await B.sync(S);
    const eb = JSON.parse(B.store.pc_ear);
    ok(eb.kind === 'nada' && eb.best['interval.mudah'] === 9 && eb.best['nada.sulit'] === 6, 'perangkat B: pilihan lokal utuh, rekor terbesar dipakai');
    ok(eb.st_interval.m3.join() === '10,8' && eb.st_interval.M3.join() === '6,5' && eb.conf_interval['m3>M3'] === 2, 'perangkat B: hitungan digabung dengan data dari A');
    const before = S.calls.length; await B.sync(S); await B.sync(S);
    ok(JSON.stringify(JSON.parse(B.store.pc_ear).st_interval) === JSON.stringify(eb.st_interval), 'sinkron berulang tidak menggandakan angka');
    const C2 = makeDevice(); await C2.sync(S);
    ok(C2.store.pc_ear && JSON.parse(C2.store.pc_ear).best['interval.mudah'] === 8, 'perangkat baru menerima statistik telinga dari akun');
    const ex = D.run("JSON.stringify(settingsData())"); ok(!ex.includes('"ear"'), 'tanpa statistik telinga, pengaturan tidak memuat kunci ear (hash tidak berubah)');
    D.run("lsSet('pc_ear', { st: { maj: [3, 2] } })"); ok(JSON.parse(D.run("JSON.stringify(settingsData())")).ear.st.maj.join() === '3,2', 'cadangan manual (ekspor) memuat statistik telinga');
    D.run("importProgress({ settings: { ear: { st: { maj: [9, 9], min: [2, 1] } } } })");
    ok(JSON.parse(D.store.pc_ear).st.maj.join() === '9,9' && JSON.parse(D.store.pc_ear).st.min.join() === '2,1', 'impor cadangan menggabung statistik telinga');

    console.log(fails ? `\n${fails} tes gagal` : '\nSemua tes sinkron lulus'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
