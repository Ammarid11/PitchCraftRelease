/* Pitchcraft — Progresi akor: susun, putar dengan metronom dan pola strum, bagikan. */

let progression = [], progTimers = [];

function addToProgression() {
    if (!currentDetectedChordObj) { alert('Pilih atau deteksi akor dulu.'); return; }
    progression.push({ key: currentDetectedChordObj.key, v: activeVariantIndex });
    renderProgression();
}

function renderProgression() {
    const el = document.getElementById('progList');
    if (!progression.length) { el.innerHTML = '<span class="empty-list">Belum ada progresi.</span>'; return; }
    el.innerHTML = progression.map((p, i) => `<div class="badge">${p.key} <span onclick="progression.splice(${i},1);renderProgression()">&times;</span></div>`).join('');
}

function stopProgression() {
    progTimers.forEach(clearTimeout); progTimers = [];
    document.querySelectorAll('#progList .badge').forEach(b => b.style.background = '');
}

function playProgression() {
    stopProgression();
    if (!progression.length) return;
    const bpm = Math.max(40, Math.min(200, +document.getElementById('bpm').value || 80)), beat = 60000 / bpm;
    const metro = document.getElementById('metroChk').checked;
    progression.forEach((p, ci) => {
        progTimers.push(setTimeout(() => {
            document.querySelectorAll('#progList .badge').forEach((b, i) => b.style.background = i === ci ? 'rgba(16,185,129,.4)' : '');
        }, ci * 4 * beat));
        const fing = chordDatabase[p.key].variants[p.v].fingering;
        (STRUM_PATS[strumPatSel] || STRUM_PATS['Sekali per birama']).forEach((sy, k) => {
            if (sy !== '.') progTimers.push(setTimeout(() => playChordFingering(fing, sy === 'D' ? 1 : -1, sy === 'D' ? 1 : 0.6), (ci * 4 + k / 2) * beat));
        });
        if (metro) for (let b = 0; b < 4; b++) progTimers.push(setTimeout(() => clickSound(b === 0), (ci * 4 + b) * beat));
    });
    progTimers.push(setTimeout(stopProgression, progression.length * 4 * beat));
}

function shareProg() {
    if (!progression.length) { alert('Belum ada progresi.'); return; }
    const txt = '| ' + progression.map(p => p.key).join(' | ') + ' |\nBPM ' + document.getElementById('bpm').value + ' · Pitchcraft';
    if (navigator.share) navigator.share({ text: txt }).catch(() => { });
    else (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => alert('Progresi disalin!'), () => prompt('Salin manual:', txt));
}
