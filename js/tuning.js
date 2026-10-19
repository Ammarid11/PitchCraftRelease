/* Pitchcraft — Tuner senar per senar dengan pilihan tuning. */

/* --- Tuner senar --- */
const TUNINGS = { "Standar (EADGBE)": [40, 45, 50, 55, 59, 64], "Drop D (DADGBE)": [38, 45, 50, 55, 59, 64], "DADGAD": [38, 45, 50, 55, 57, 62], "Setengah nada turun (Eb)": [39, 44, 49, 54, 58, 63], "Open G (DGDGBD)": [38, 43, 50, 55, 59, 62], "Open D (DADF#AD)": [38, 45, 50, 54, 57, 62] };
const mf = m => 440 * Math.pow(2, (m - 69) / 12), mname = m => noteStrings[m % 12] + (Math.floor(m / 12) - 1);

function renderTuning() {
    const t = TUNINGS[document.getElementById('tunSel').value];
    document.getElementById('tunStrings').innerHTML = t.map((m, i) => `<div class="badge" id="ts${i}">${6 - i}: ${mname(m)}</div>`).join('');
}

setInterval(() => {
    if (window.curTab !== 'tuning') return;
    const tb = document.getElementById('tunBtn');
    tb.textContent = isListening ? 'Berhenti' : 'Mulai Mendengarkan'; tb.classList.toggle('active', isListening);
    const t = TUNINGS[document.getElementById('tunSel').value], el = document.getElementById('tunNote'), msg = document.getElementById('tunMsg'), mk = document.getElementById('tunMark');
    const live = isListening && window.pcT && performance.now() - window.pcT < 600;
    document.querySelectorAll('#tunStrings .badge').forEach(b => b.classList.remove('on'));
    if (!live) { if (!isListening) { el.textContent = '—'; msg.textContent = 'Tekan mulai lalu petik senar.'; } return; }
    let bi = 0, bc = 1e9;
    t.forEach((m, i) => { const c = 1200 * Math.log2(window.pcHz / mf(m)); if (Math.abs(c) < Math.abs(bc)) { bc = c; bi = i; } });
    document.getElementById('ts' + bi).classList.add('on');
    el.textContent = mname(t[bi]); el.classList.add('active-note');
    const ok = Math.abs(bc) <= 5;
    msg.textContent = `Senar ${6 - bi} · ` + (ok ? 'Pas ✓' : bc < 0 ? 'Kencangkan pasak ↑ (' + bc.toFixed(0) + ' cent)' : 'Kendurkan pasak ↓ (+' + bc.toFixed(0) + ' cent)');
    mk.style.left = (50 + Math.max(-50, Math.min(50, bc))) + '%'; mk.style.background = ok ? 'var(--success)' : 'var(--warning)';
}, 120);
