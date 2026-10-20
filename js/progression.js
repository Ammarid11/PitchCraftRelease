/* Pitchcraft — Progresi akor: susun, putar dengan metronom, pola strum, birama, hitung mundur, bagikan. */

let progression = [], progTimers = [];
// beats = jumlah ketuk per bar, sub = slot pola strum per ketuk (6/8 dihitung 2 ketuk bertitik)
const METERS = { '4/4': { beats: 4, sub: 2 }, '3/4': { beats: 3, sub: 2 }, '6/8': { beats: 2, sub: 3 } };
const curMeter = () => METERS[song.meter] || METERS['4/4'];

function addToProgression() {
    if (!currentDetectedChordObj) { alert('Pilih atau deteksi akor dulu.'); return; }
    progression.push({ key: currentDetectedChordObj.key, v: activeVariantIndex }); pcToast('Ditambahkan ke Progresi: ' + currentDetectedChordObj.key);
    renderProgression();
}

// Isi progresi = bentuk jari yang dimainkan; dengan capo, bunyinya naik sebesar capo (ditampilkan sebagai "→")
function renderProgression() {
    const el = document.getElementById('progList'), capo = getCapo();
    el.innerHTML = progression.length
        ? progression.map((p, i) => `<div class="badge">${p.key}${capo ? ` <small>→ ${tKey(p.key, capo)}</small>` : ''} <span onclick="progression.splice(${i},1);renderProgression()">&times;</span></div>`).join('')
        : '<span class="empty-list">Belum ada progresi. Tekan “➕ Tambah Akor Saat Ini”, atau pilih progresi populer di panel 🎼 Kunci.</span>';
    saveSettings();
}

function stopProgression() {
    progTimers.forEach(clearTimeout); progTimers = [];
    document.querySelectorAll('#progList .badge, #songView .badge').forEach(b => b.classList.remove('on'));
}

// Pemutar umum: list = [{key, v, beats?}], scope = selector lencana yang disorot
function playList(list, scope) {
    stopProgression();
    if (!list.length) return;
    const bpm = Math.max(40, Math.min(200, +document.getElementById('bpm').value || 80)), beat = 60000 / bpm;
    const M = curMeter(), metro = document.getElementById('metroChk').checked, count = document.querySelector('[data-sync="cnt"]').checked;
    const pat = STRUM_PATS[strumPatSel] || STRUM_PATS['Sekali per birama'], barSlots = M.beats * M.sub;
    const at = (t, fn) => progTimers.push(setTimeout(fn, t * beat));
    let t = 0;
    if (count) { for (let b = 0; b < M.beats; b++) at(b, () => clickSound(b === 0)); t = M.beats; }
    list.forEach((p, ci) => {
        const len = p.beats || M.beats, ch = chordDatabase[p.key];
        at(t, () => document.querySelectorAll(scope).forEach((b, i) => b.classList.toggle('on', i === ci)));
        if (ch) {
            const fing = (ch.variants[p.v] || ch.variants[0]).fingering;
            for (let k = 0; k < len * M.sub; k++) {
                const sy = pat[(k % barSlots) % pat.length];
                if (sy !== '.') at(t + k / M.sub, () => playChordFingering(fing, sy === 'D' ? 1 : -1, sy === 'D' ? 1 : 0.6));
            }
        }
        if (metro) for (let b = 0; b < len; b++) at(t + b, () => clickSound(b % M.beats === 0));
        t += len;
    });
    at(t, stopProgression);
}

function playProgression() { playList(progression, '#progList .badge'); }

function shareProg() {
    if (!progression.length) { alert('Belum ada progresi.'); return; }
    const txt = '| ' + progression.map(p => p.key).join(' | ') + ' |\nBPM ' + document.getElementById('bpm').value + ' · Pitchcraft';
    if (navigator.share) navigator.share({ text: txt }).catch(() => { });
    else (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => alert('Progresi disalin!'), () => prompt('Salin manual:', txt));
}
