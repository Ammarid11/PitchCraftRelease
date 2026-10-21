/* Pitchcraft — Penyimpanan lokal bersama: localStorage aman, log sesi latihan ber-ID (dasar streak & sinkron), hash/kanonisasi data. */

const lsGet = (k, def) => { try { const v = JSON.parse(localStorage.getItem(k)); return v === null || v === undefined ? def : v; } catch (e) { return def; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };
const dayKey = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });

/* Log sesi: hanya bertambah. Tiap sesi punya ID unik dan tanggal lokal (day) saat sesi terjadi,
 * jadi total per hari = jumlah sesi (tidak bisa kurang saat digabung dari dua perangkat) dan streak tak terpengaruh ganti zona waktu.
 * Penanda s:1 = sudah ada di server. */
const getSessions = () => { const a = lsGet('pc_sessions', []); return Array.isArray(a) ? a : []; };
const setSessions = a => lsSet('pc_sessions', a);
const daysOf = ss => { const d = {}; ss.forEach(s => { d[s.day] = (d[s.day] || 0) + (+s.dur || 0); }); return d; };

// Validasi satu sesi (dari file impor atau dari server); null jika tidak layak
function cleanSession(s) {
    if (!s || typeof s.id !== 'string' || !s.id || s.id.length > 80) return null;
    const day = String(s.day || ''); if (!/^\d{4}-\d\d-\d\d$/.test(day)) return null;
    const t = new Date(s.played_at); if (isNaN(t)) return null;
    const n = (v, max) => Math.min(max, Math.max(0, +v || 0));
    return { id: s.id, mode: String(s.mode || '').slice(0, 20), level: String(s.level || '').slice(0, 20), dur: n(s.dur, 7200) | 0, ok: n(s.ok, 10000) | 0, bad: n(s.bad, 10000) | 0, cpm: Math.round(n(s.cpm, 1000) * 10) / 10, played_at: t.toISOString(), day };
}

// Catatan akor salah (dasar "Latih yang lemah"): hanya bertambah, ber-ID, maks. 300 di perangkat. s:1 = sudah ada di server.
const getMisses = () => {
    const a = lsGet('pc_miss', []); if (!Array.isArray(a)) return [];
    let ch = false; a.forEach(e => { if (e && !e.id) { e.id = newId(); ch = true; } });   // catatan versi lama belum punya ID
    if (ch) lsSet('pc_miss', a);
    return a.filter(e => e && e.id);
};
const setMisses = a => lsSet('pc_miss', a);
function cleanMiss(s) {   // dari perangkat (t = ms) atau dari server (happened_at)
    if (!s || typeof s.id !== 'string' || !s.id || s.id.length > 80) return null;
    const t = s.t !== undefined ? +s.t : Date.parse(s.happened_at); if (!isFinite(t) || t <= 0) return null;
    const want = String(s.want || '').slice(0, 20), got = String(s.got || '').slice(0, 20); if (!want || !got) return null;
    return { id: s.id, t, want, got };
}

// Migrasi sekali: jumlah-per-hari versi lama (pc_days) -> satu sesi sintetis per tanggal dengan ID tetap "legacy-TANGGAL"
function migrateLegacy() {
    if (lsGet('pc_migr2', 0)) return;
    const ss = getSessions(), have = new Set(ss.map(s => s.id)), days = lsGet('pc_days', {});
    Object.keys(days).forEach(k => {
        const id = 'legacy-' + k;
        if (/^\d{4}-\d\d-\d\d$/.test(k) && days[k] > 0 && !have.has(id))
            ss.push({ id, mode: 'legacy', level: '', dur: Math.min(7200, +days[k] | 0), ok: 0, bad: 0, cpm: 0, played_at: new Date(k + 'T12:00:00').toISOString(), day: k });
    });
    setSessions(ss); lsSet('pc_migr2', 1);
}
migrateLegacy();

// Bentuk kanonis (kunci diurutkan): jsonb di server tidak menjaga urutan kunci, jadi perbandingan harus tak peduli urutan
function canon(o) {
    if (Array.isArray(o)) return '[' + o.map(canon).join(',') + ']';
    if (o && typeof o === 'object') return '{' + Object.keys(o).filter(k => o[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + canon(o[k])).join(',') + '}';
    return JSON.stringify(o === undefined ? null : o);
}
function hashStr(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return h + ':' + s.length; }

// minta browser agar tidak menghapus data otomatis saat memori penuh
try { if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { }); } catch (e) { }

/* Statistik Latih Telinga ('pc_ear') yang ikut cadangan dan sinkron: hanya angka hasil (rekor, benar/salah per jawaban, tebakan tertukar).
 * Pilihan tampilan (jenis, tingkat, acuan, petik) dan ringkasan ronde terakhir tetap per perangkat. Gabungan bersifat idempoten:
 * rekor = terbesar, hitungan per jawaban = yang totalnya lebih banyak (bukan dijumlah, supaya tidak ganda saat disinkron berulang). */
const PC_EAR_STAT = /^(st|conf)(_[a-z]+)?$/;
function pcEarClean(d) {
    const out = {}; if (!d || typeof d !== 'object' || Array.isArray(d)) return out;
    const int = (v, max) => Math.min(max, Math.max(0, Math.floor(+v) || 0)), ok = k => typeof k === 'string' && k.length > 0 && k.length <= 40;
    if (d.best && typeof d.best === 'object' && !Array.isArray(d.best)) {
        const b = {}; Object.keys(d.best).slice(0, 60).forEach(k => { if (ok(k) && +d.best[k] > 0) b[k] = int(d.best[k], 100); });
        if (Object.keys(b).length) out.best = b;
    }
    Object.keys(d).forEach(k => {
        const m = PC_EAR_STAT.exec(k), v = d[k]; if (!m || !v || typeof v !== 'object' || Array.isArray(v)) return;
        const o = {};
        Object.keys(v).slice(0, 120).forEach(id => {
            if (!ok(id) && !(m[1] === 'conf' && typeof id === 'string' && id.length <= 90)) return;
            if (m[1] === 'st') { const a = v[id]; if (!Array.isArray(a)) return; const n = int(a[0], 1e6), g = Math.min(n, int(a[1], 1e6)); if (n > 0) o[id] = [n, g]; }
            else { const n = int(v[id], 1e6); if (n > 0) o[id] = n; }
        });
        if (Object.keys(o).length) out[k] = o;
    });
    return out;
}
function pcEarMerge(local, remote) {
    const a = pcEarClean(local), b = pcEarClean(remote), out = Object.assign({}, local && typeof local === 'object' && !Array.isArray(local) ? local : {});
    const keys = new Set(Object.keys(a).concat(Object.keys(b)));
    keys.forEach(k => {
        const x = a[k] || {}, y = b[k] || {}, o = {};
        new Set(Object.keys(x).concat(Object.keys(y))).forEach(id => {
            const p = x[id], q = y[id];
            if (k === 'best' || k.startsWith('conf')) o[id] = Math.max(p || 0, q || 0);
            else o[id] = !p ? q : !q ? p : (q[0] > p[0] || (q[0] === p[0] && q[1] > p[1])) ? q : p;
        });
        out[k] = o;
    });
    return out;
}
