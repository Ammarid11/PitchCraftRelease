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
}

function pcPick(i) {
    const capo = +document.getElementById('capoSel').value, c = keyList[i], k = shapeOf(c, capo);
    learnable = false; currentCandidates = []; showChordKey(k); showTab('deteksi');
    document.getElementById('hz').textContent = capo ? `Capo ${capo}: mainkan bentuk ${k} (bunyi ${noteStrings[c.r]}${c.q})` : '';
}

function pcProg(i) {
    const m = document.getElementById('keyMode').value;
    progression = PROGS[m][i].map(d => ({ key: noteStrings[keyList[d].r] + keyList[d].q, v: 0 }));
    renderProgression(); showTab('progresi');
}
