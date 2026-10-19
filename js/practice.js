/* Pitchcraft — Latihan pindah akor & kuis, serta perekaman otomatis dari Mode Strum. */

/* --- Rekam otomatis, bagikan, latihan --- */
let dr = null, drTimer = null;

function pcLock(key) {
    if (document.getElementById('autoRec').checked && (!progression.length || progression[progression.length - 1].key !== key)) { progression.push({ key, v: 0 }); renderProgression(); }
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
    const mode = document.getElementById('drillMode').value;
    const pool = mode === 'drill' ? progression.map(p => p.key) : keyChords().map(c => noteStrings[c.r] + c.q);
    if (mode === 'drill' && new Set(pool).size < 2) { alert('Tambahkan minimal 2 akor berbeda ke Progresi dulu.'); return; }
    if (!isStrum) await toggleStrum();
    if (!isStrum) return;
    clearInterval(drTimer);
    dr = { mode, pool, i: -1, ok: 0, bad: 0, end: performance.now() + 60000, target: '' };
    drillNext();
    drTimer = setInterval(() => {
        if (!dr) return;
        const left = Math.ceil((dr.end - performance.now()) / 1000);
        if (left <= 0) { document.getElementById('drillInfo').textContent = `Selesai! Benar ${dr.ok}, salah ${dr.bad}`; document.getElementById('drillTarget').textContent = '🏁'; dr = null; clearInterval(drTimer); }
        else document.getElementById('drillInfo').textContent = `${left} dtk · genjreng ${dr.target} · benar ${dr.ok}, salah ${dr.bad}`;
    }, 500);
}

function drillStop() { dr = null; clearInterval(drTimer); document.getElementById('drillTarget').textContent = '—'; document.getElementById('drillInfo').textContent = 'Dihentikan.'; }
