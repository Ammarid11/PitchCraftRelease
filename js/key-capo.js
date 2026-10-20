/* Pitchcraft — Kunci lagu, akor diatonis, saran capo, dan progresi populer. */

/* --- Kunci & capo --- */
const MAJ = [[0, ''], [2, 'm'], [4, 'm'], [5, ''], [7, ''], [9, 'm'], [11, 'dim']], MIN = [[0, 'm'], [2, 'dim'], [3, ''], [5, 'm'], [7, 'm'], [8, ''], [10, '']];
const ROM = { maj: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'], min: ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'] };
const PROGS = { maj: [[0, 4, 5, 3], [0, 3, 4, 0], [5, 3, 0, 4], [1, 4, 0], [0, 5, 3, 4]], min: [[0, 5, 2, 6], [0, 3, 4, 0], [0, 6, 5, 4], [0, 3, 6, 2]] };
const EASY = ['C', 'Am', 'G', 'Em', 'D', 'A', 'E', 'Dm'];
let keyList = [];

function keyChords() {
    const r = +document.getElementById('keyRoot').value, m = document.getElementById('keyMode').value;
    return (m === 'maj' ? MAJ : MIN).map(([o, q]) => ({ r: (r + o) % 12, q }));
}

const shapeOf = (c, capo) => noteStrings[(c.r - capo + 12) % 12] + c.q;

function renderKey() {
    const capo = +document.getElementById('capoSel').value, m = document.getElementById('keyMode').value;
    keyList = keyChords();
    document.getElementById('keyChords').innerHTML = keyList.map((c, i) => `<button class="btn-variant" onclick="pcPick(${i})"><small>${ROM[m][i]}</small>${noteStrings[c.r]}${c.q}${capo ? `<small>bentuk ${shapeOf(c, capo)}</small>` : ''}</button>`).join('');
    document.getElementById('keyProgs').innerHTML = PROGS[m].map((p, i) => `<button class="btn-variant" onclick="pcProg(${i})">${p.map(d => ROM[m][d]).join('–')}</button>`).join('');
    let best = 0, bs = -1;
    for (let k = 0; k <= 7; k++) { const sc = keyList.filter(c => EASY.includes(shapeOf(c, k))).length; if (sc > bs) { bs = sc; best = k; } }
    document.getElementById('capoBest').innerHTML = `Capo paling mudah: <strong>${best}</strong> (${bs} dari 7 akor berbentuk mudah: ${keyList.map(c => shapeOf(c, best)).join(', ')})`;
    kpSync(); kpSummary(); refreshChordViews();
}

function pcPick(i) {
    const capo = +document.getElementById('capoSel').value, c = keyList[i], k = shapeOf(c, capo);
    learnable = false; currentCandidates = []; showChordKey(k);   // hanya memilih akor; tidak pindah tab
    document.getElementById('hz').textContent = capo ? `Capo ${capo}: mainkan bentuk ${k} (bunyi ${noteStrings[c.r]}${c.q})` : '';
    pcToast(capo ? `Capo ${capo}: bentuk ${k} dipilih` : `${k} dipilih`);
}

function pcProg(i) {
    const m = document.getElementById('keyMode').value;
    const capo = +document.getElementById('capoSel').value;   // progresi = bentuk jari; dengan capo, bunyinya = bentuk + capo
    progression = PROGS[m][i].map(d => ({ key: shapeOf(keyList[d], capo), v: 0 }));
    renderProgression();   // tidak pindah tab
    pcToast('Progresi dimuat: ' + progression.map(p => p.key).join(' – '));
}

/* --- Panel melayang Kunci & Capo: di layar lebar menempel di samping (bisa dilipat), di HP jadi lembar dari bawah --- */
const kpWide = () => window.matchMedia('(min-width:1280px)').matches;

function kpSummary() {
    const m = document.getElementById('keyMode').value, capo = getCapo();
    const t = 'Kunci ' + noteStrings[+document.getElementById('keyRoot').value] + (m === 'min' ? 'm' : '') + ' · ' + (capo ? 'Capo ' + capo : 'tanpa capo');
    document.getElementById('keyPill').textContent = '🎼 ' + t.replace(' · tanpa capo', '');
    document.getElementById('kpSum').textContent = t;
}

function kpBtn() {
    const p = document.getElementById('keyPanel'), b = document.getElementById('kpBtn'), w = kpWide(), min = p.classList.contains('min');
    b.textContent = w ? (min ? '＋' : '–') : '×';
    b.setAttribute('aria-label', w ? (min ? 'Buka panel' : 'Lipat panel') : 'Tutup');
}

function kpToggle(open) {
    const p = document.getElementById('keyPanel');
    if (kpWide()) {
        const min = open === undefined ? !p.classList.contains('min') : !open;
        p.classList.toggle('min', min);
        try { localStorage.setItem('pc_kp', min ? 'min' : ''); } catch (e) { }
    } else {
        const o = open === undefined ? !p.classList.contains('open') : open;
        p.classList.toggle('open', o);
        document.getElementById('kpBack').classList.toggle('open', o);
    }
    kpBtn();
}

/* Kunci/mode/capo diedit sebagai draf (kpRoot/kpMode/kpCapo); baru berlaku setelah Terapkan (keyRoot/keyMode/capoSel tersembunyi = nilai yang dipakai aplikasi) */
const KP_MAP = [['kpRoot', 'keyRoot'], ['kpMode', 'keyMode'], ['kpCapo', 'capoSel']];
const $k = id => document.getElementById(id);

function kpDirty() {
    const d = KP_MAP.some(([a, b]) => $k(a).value !== $k(b).value);
    $k('keyPanel').classList.toggle('dirty', d);
    $k('kpApply').disabled = !d; $k('kpCancel').disabled = !d;
    $k('keyChords').classList.toggle('stale', d);
    return d;
}
function kpSync() { KP_MAP.forEach(([a, b]) => { $k(a).value = $k(b).value; }); kpDirty(); }
function kpApply() {
    KP_MAP.forEach(([a, b]) => { $k(b).value = $k(a).value; });
    renderKey(); saveSettings();
    pcToast('Diterapkan: ' + $k('kpSum').textContent);
}
function kpCancel() { kpSync(); }

function kpClose() { if (!kpWide()) kpToggle(false); }   // di HP, tutup lembar setelah memilih akor/progresi

function kpInit() {
    const p = document.getElementById('keyPanel');
    $k('kpRoot').innerHTML = $k('keyRoot').innerHTML; $k('kpCapo').innerHTML = $k('capoSel').innerHTML;
    try { if (localStorage.getItem('pc_kp') === 'min') p.classList.add('min'); } catch (e) { }
    kpBtn(); kpSync(); kpSummary();
    window.addEventListener('resize', kpBtn);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') kpClose(); });
    let y0 = null;   // geser ke bawah pada pegangan/judul = tutup
    p.addEventListener('touchstart', e => { y0 = e.target.closest('.kp-grab,.kp-head') ? e.touches[0].clientY : null; }, { passive: true });
    p.addEventListener('touchend', e => { if (y0 !== null && e.changedTouches[0].clientY - y0 > 60) kpClose(); y0 = null; }, { passive: true });
}
