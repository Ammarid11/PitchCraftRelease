/* Pitchcraft — Tuner senar per senar dengan pilihan tuning. */

/* --- Tuner senar --- */
const TUNINGS = { "Standar (EADGBE)": [40, 45, 50, 55, 59, 64], "Drop D (DADGBE)": [38, 45, 50, 55, 59, 64], "DADGAD": [38, 45, 50, 55, 57, 62], "Setengah nada turun (Eb)": [39, 44, 49, 54, 58, 63], "Open G (DGDGBD)": [38, 43, 50, 55, 59, 62], "Open D (DADF#AD)": [38, 45, 50, 54, 57, 62] };
const mf = m => refA * Math.pow(2, (m - 69) / 12), mname = m => noteStrings[m % 12] + (Math.floor(m / 12) - 1);

var renderTuning = function () {
    const t = TUNINGS[document.getElementById('tunSel').value];
    document.getElementById('tunStrings').innerHTML = t.map((m, i) => `<div class="badge" id="ts${i}" style="cursor:pointer" onclick="playRef(${i})">${6 - i}: ${mname(m)}</div>`).join('');
};

setInterval(() => {
    if (window.curTab !== 'tuning') return;
    const tb = document.getElementById('tunBtn');
    tb.textContent = isListening ? 'Berhenti' : 'Mulai Mendengarkan'; tb.classList.toggle('active', isListening);
    const t = TUNINGS[document.getElementById('tunSel').value], el = document.getElementById('tunNote'), msg = document.getElementById('tunMsg'), mk = document.getElementById('tunMark');
    const live = isListening && window.pcT && performance.now() - window.pcT < 600;
    document.querySelectorAll('#tunStrings .badge').forEach(b => b.classList.remove('on'));
    if (!live) { tunOk = false; if (!isListening) { el.textContent = '—'; msg.textContent = 'Tekan mulai lalu petik senar.'; } return; }
    let bi = 0, bc = 1e9;
    t.forEach((m, i) => { const c = 1200 * Math.log2(window.pcHz / mf(m)); if (Math.abs(c) < Math.abs(bc)) { bc = c; bi = i; } });
    document.getElementById('ts' + bi).classList.add('on');
    el.textContent = mname(t[bi]); el.classList.add('active-note');
    const ok = Math.abs(bc) <= 5, nowT = performance.now();
    if (ok && !tunOk && nowT - lastVib > 1500 && document.getElementById('vibChk').checked) { try { if (navigator.vibrate) navigator.vibrate(40); } catch (e) { } lastVib = nowT; }
    tunOk = ok;
    msg.textContent = `Senar ${6 - bi} · ` + (ok ? 'Pas ✓' : bc < 0 ? 'Kencangkan pasak ↑ (' + bc.toFixed(0) + ' cent)' : 'Kendurkan pasak ↓ (+' + bc.toFixed(0) + ' cent)');
    mk.style.left = (50 + Math.max(-50, Math.min(50, bc))) + '%'; mk.style.background = ok ? 'var(--success)' : 'var(--warning)';
}, 120);

/* --- Tuning memengaruhi suara & fretboard --- */
const STD_MIDI = [40, 45, 50, 55, 59, 64];
const TUN_OK = ["Standar (EADGBE)", "Drop D (DADGBE)", "Setengah nada turun (Eb)"];   // didukung penuh

function tuningInfo() {
    const el = document.getElementById('tunSel');
    const name = el && TUNINGS[el.value] ? el.value : "Standar (EADGBE)", t = TUNINGS[name];
    const diffs = t.map((m, i) => m - STD_MIDI[i]), cnt = {};
    diffs.forEach(d => { cnt[d] = (cnt[d] || 0) + 1; });
    let mode = 0, best = -1;   // selisih terbanyak = geseran seluruh senar (Eb = -1); seri -> yang terdekat ke 0
    Object.keys(cnt).map(Number).forEach(d => { if (cnt[d] > best || (cnt[d] === best && Math.abs(d) < Math.abs(mode))) { best = cnt[d]; mode = d; } });
    return { name, t, diffs, mode, ok: TUN_OK.includes(name) };
}

// Bentuk kamus (tuning standar) -> fret di tuning aktif agar nada akornya tetap sama.
// Geseran seluruh senar (Eb) tidak mengubah bentuk; senar yang menyimpang (Drop D: senar 6) digeser fret-nya.
function adaptFingering(f) {
    const ti = tuningInfo();
    return f.map((v, s) => { if (v < 0) return -1; const nf = v - (ti.diffs[s] - ti.mode); return nf < 0 ? -1 : nf; });
}

function tuneNoteHTML() {
    const ti = tuningInfo(), c = getCapo(), p = [];
    if (ti.name !== TUN_OK[0]) p.push('Tuning ' + ti.name + (ti.mode ? ` · bunyi ${Math.abs(ti.mode)} semiton ${ti.mode < 0 ? 'lebih rendah' : 'lebih tinggi'}` : '') + (ti.ok ? '' : ' · ⚠ belum didukung penuh: jari disesuaikan agar nada akor tetap sama'));
    if (c) p.push(`Capo ${c} · bunyi naik ${c} semiton`);
    return p.length ? `<div class="chord-detail-row" style="font-size:.78rem">${p.join('<br>')}</div>` : '';
}

function refreshChordViews() {
    try {
        if (currentDetectedChordObj) displayChordInfo(currentDetectedChordObj, activeVariantIndex, 'chordResultBox');
        renderSavedChords(); renderProgression(); renderSong();
    } catch (e) { console.error(e); }
}

function onTuningChange() { renderTuning(); refreshChordViews(); }

const _renderTuning = renderTuning;
renderTuning = function () {
    _renderTuning();
    const w = document.getElementById('tunWarn'), ti = tuningInfo();
    if (w) w.textContent = ti.name === TUN_OK[0] ? '' : (ti.ok ? 'Bentuk akor di kamus disesuaikan ke tuning ini. ' : '⚠ Tuning ini belum didukung penuh: jari disesuaikan agar nada akor tetap sama, jadi bentuknya mungkin tidak praktis. ') + 'Mode Strum mengandalkan tuning standar, jadi hasil deteksi akor bisa meleset.';
};

/* --- Pelengkap tuner: nada acuan & getaran saat pas --- */
let tunOk = false, lastVib = 0;

function playRef(i) { const ctx = audioCtx(); pluckNote(ctx, mf(tuningInfo().t[i]), ctx.currentTime, 1.5, 2.4); }   // nada acuan = petikan senar
function playRefAll() { for (let i = 0; i < 6; i++) setTimeout(() => playRef(i), i * 900); }
function setRefA(v) { refA = +v || 440; }
