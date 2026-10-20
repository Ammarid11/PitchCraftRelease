/* Pitchcraft — Pemilih akor dari Kamus: tombol "📚 Dari Kamus" di tab Progresi dan Lagu.
 * Dialog tetap terbuka supaya bisa menambah beberapa akor berturut-turut. Lapisan tampilan saja; tidak menyentuh deteksi. */

let cpRoot = 'C', cpCat = 'all', cpQ = '', cpTarget = null, cpList = [];

// target: 'prog' (urutan Progresi) atau 'song' + indeks bagian lagu
function cpOpen(kind, idx) {
    cpTarget = kind === 'song' ? { kind: 'song', i: +idx || 0 } : { kind: 'prog' };
    cpQ = ''; const s = document.getElementById('cpSearch'); if (s) s.value = '';
    document.getElementById('cpick').classList.add('on');
    cpRender();
}
function cpClose() { document.getElementById('cpick').classList.remove('on'); }
function cpSetRoot(n) { cpRoot = n; cpQ = ''; const s = document.getElementById('cpSearch'); if (s) s.value = ''; cpRender(); }
function cpSetCat(k) { cpCat = k; cpRender(); }
function cpSearch(v) { cpQ = v; cpRender(); }

function cpTargetText() {
    if (!cpTarget) return '';
    if (cpTarget.kind === 'prog') return 'Progresi (' + progression.length + ' akor)';
    const s = song.sections[cpTarget.i];
    return s ? 'Lagu · ' + s.name + ' (' + s.chords.length + ' akor)' : 'Lagu';
}

function cpRender() {
    const grid = document.getElementById('cpGrid'); if (!grid) return;
    document.getElementById('cpRoots').innerHTML = noteStrings.map(n =>
        `<button class="chip${!cpQ && n === cpRoot ? ' on' : ''}" onclick="cpSetRoot('${n}')">${n}${FLAT[n] ? `<small>${FLAT[n]}</small>` : ''}</button>`).join('');
    document.getElementById('cpCats').innerHTML = LIB_CATS.map(([k, l]) =>
        `<button class="chip${k === cpCat ? ' on' : ''}" onclick="cpSetCat('${k}')">${l}</button>`).join('');
    const q = cpQ.trim().toLowerCase();
    cpList = Object.values(chordDatabase).filter(c => (q ? (c.key + ' ' + c.name).toLowerCase().includes(q) : c.root === cpRoot) && (cpCat === 'all' || libCatOf(c) === cpCat)).slice(0, 90);
    document.getElementById('cpInfo').innerHTML = 'Ditambahkan ke: <strong>' + esc(cpTargetText()) + '</strong>';
    grid.innerHTML = cpList.length ? cpList.map((c, i) =>
        `<div class="cp-cell"><button class="cp-add" onclick="cpAdd(${i})" aria-label="Tambah ${esc(c.key)}">${esc(c.key)}<small>${c.slash ? 'Slash' : esc(c.name.split(' ').slice(1).join(' '))}</small></button><button class="cp-ply" onclick="cpPlay(${i})" aria-label="Dengar ${esc(c.key)}">🔊</button></div>`).join('')
        : '<span class="empty-list">Tidak ada akor yang cocok. Coba kata lain, mis. “m7” atau “sus”.</span>';
}

function cpPlay(i) { const c = cpList[i]; if (c) playChordFingering(c.variants[0].fingering); }

function cpAdd(i) {
    const c = cpList[i]; if (!c || !cpTarget) return;
    if (cpTarget.kind === 'prog') { progression.push({ key: c.key, v: 0 }); renderProgression(); }
    else {
        const s = song.sections[cpTarget.i];
        if (!s) { alert('Bagian lagu tidak ditemukan.'); cpClose(); return; }
        s.chords.push({ key: c.key, v: 0, beats: 0 }); renderSong();
    }
    pcToast(c.key + ' ditambahkan'); document.getElementById('cpInfo').innerHTML = 'Ditambahkan ke: <strong>' + esc(cpTargetText()) + '</strong>';
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') { const m = document.getElementById('cpick'); if (m && m.classList.contains('on')) cpClose(); } });
