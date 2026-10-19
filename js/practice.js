/* Pitchcraft — Latihan pindah akor & kuis (tingkat, durasi, riwayat skor), serta perekaman otomatis dari Mode Strum. */

let dr = null, drTimer = null;
const LEVELS = {
    dasar: ['C', 'Am', 'G', 'Em', 'D', 'A', 'E', 'Dm'],
    barre: ['F', 'Bm', 'F#m', 'A#', 'B', 'Cm', 'C#m', 'Gm', 'Fm', 'G#'],
    seventh: ['A7', 'D7', 'E7', 'G7', 'B7', 'Cmaj7', 'Dmaj7', 'Fmaj7', 'Em7', 'Am7', 'Dsus4', 'Asus2']
};
const MODE_LABEL = { drill: 'Pindah akor', quiz: 'Kuis kunci', level: 'Kuis tingkat' };

function loadHist() { try { const h = JSON.parse(localStorage.getItem('pc_hist') || '[]'); return Array.isArray(h) ? h : []; } catch (e) { return []; } }
function saveHist(h) { try { localStorage.setItem('pc_hist', JSON.stringify(h.slice(-30))); } catch (e) { } }
function clearHist() { if (confirm('Hapus semua riwayat latihan?')) { saveHist([]); renderHist(); } }

function renderHist() {
    const el = document.getElementById('drillHist'); if (!el) return;
    const h = loadHist();
    if (!h.length) { el.textContent = 'Belum ada riwayat latihan.'; return; }
    const lab = e => MODE_LABEL[e.mode] + (e.mode === 'level' ? ' ' + e.level : ''), best = h.reduce((a, b) => b.cpm > a.cpm ? b : a);
    el.innerHTML = `🏆 Rekor: <strong>${best.cpm} akor/menit</strong> (${lab(best)}, ${best.dur} dtk)<br>` +
        h.slice(-5).reverse().map(e => `${new Date(e.t).toLocaleDateString('id-ID')} · ${lab(e)} · ${e.dur} dtk · benar ${e.ok}/${e.ok + e.bad} · ${e.cpm} akor/mnt`).join('<br>');
}

function pcLock(key) {
    const sk = tKey(key, -getCapo());   // akor terdengar -> bentuk jari
    if (document.getElementById('autoRec').checked && (!progression.length || progression[progression.length - 1].key !== sk)) { progression.push({ key: sk, v: 0 }); renderProgression(); }
    if (!dr) return;
    if (key === dr.target) { dr.ok++; drillNext(); } else { dr.bad++; document.getElementById('drillInfo').textContent = `Terbaca ${key}, coba lagi · benar ${dr.ok}, salah ${dr.bad}`; }
}

function drillNext() {
    const pool = dr.pool;
    if (dr.mode === 'drill') dr.i = (dr.i + 1) % pool.length;
    else { let n; do { n = Math.floor(Math.random() * pool.length); } while (pool.length > 1 && n === dr.i); dr.i = n; }
    dr.target = pool[dr.i];
    document.getElementById('drillTarget').textContent = dr.target;
    document.getElementById('drillInfo').textContent = `Genjreng ${dr.target} · benar ${dr.ok}, salah ${dr.bad}`;
}

async function drillStart() {
    const mode = document.getElementById('drillMode').value, level = document.getElementById('drillLevel').value, dur = +document.getElementById('drillDur').value || 60;
    const pool = mode === 'drill' ? progression.map(p => tKey(p.key, getCapo())) : mode === 'level' ? (LEVELS[level] || LEVELS.dasar).slice() : keyChords().map(c => noteStrings[c.r] + c.q);
    if (mode === 'drill' && new Set(pool).size < 2) { alert('Tambahkan minimal 2 akor berbeda ke Progresi dulu.'); return; }
    if (!isStrum) await toggleStrum();
    if (!isStrum) return;
    clearInterval(drTimer);
    dr = { mode, level, dur, pool, i: -1, ok: 0, bad: 0, end: performance.now() + dur * 1000, target: '' };
    drillNext();
    drTimer = setInterval(() => {
        if (!dr) return;
        const left = Math.ceil((dr.end - performance.now()) / 1000);
        if (left <= 0) {
            const cpm = Math.round(dr.ok / dr.dur * 600) / 10, h = loadHist();
            h.push({ t: Date.now(), mode: dr.mode, level: dr.level, dur: dr.dur, ok: dr.ok, bad: dr.bad, cpm }); saveHist(h);
            document.getElementById('drillInfo').textContent = `Selesai! Benar ${dr.ok}, salah ${dr.bad} · ${cpm} akor/menit`;
            document.getElementById('drillTarget').textContent = '🏁'; dr = null; clearInterval(drTimer); renderHist();
        } else document.getElementById('drillInfo').textContent = `${left} dtk · genjreng ${dr.target} · benar ${dr.ok}, salah ${dr.bad}`;
    }, 500);
}

function drillStop() { dr = null; clearInterval(drTimer); document.getElementById('drillTarget').textContent = '—'; document.getElementById('drillInfo').textContent = 'Dihentikan (skor tidak disimpan).'; }
