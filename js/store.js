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
