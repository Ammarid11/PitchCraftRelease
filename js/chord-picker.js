/* Pitchcraft — Pemilih akor dari Kamus untuk Progresi dan Lagu (dialog: cari, saring, ganti bentuk, dengar, tambah beberapa akor sekaligus). */

let pkTarget = null, pkRoot = 'C', pkCat = 'all', pkQ = '', pkVar = {}, pkList = [];

function pkOpen(type, i) {
    if (type === 'song' && !song.sections[i]) return;
    pkTarget = { type, i: i | 0 };
    const m = document.getElementById('pick'); if (!m) return;
    m.classList.add('on'); pkRender();
}
function pkClose() { const m = document.getElementById('pick'); if (m) m.classList.remove('on'); pkTarget = null; }

function pkCurrent() {
    if (!pkTarget) return [];
    if (pkTarget.type === 'prog') return progression.map(p => p.key);
    const s = song.sections[pkTarget.i]; return s ? s.chords.map(c => c.key) : [];
}

function pkRenderCur() {
    if (!pkTarget) return;
    const isProg = pkTarget.type === 'prog', s = isProg ? null : song.sections[pkTarget.i], cur = pkCurrent();
    document.getElementById('pkTitle').textContent = isProg ? 'Tambah ke Progresi' : 'Tambah ke bagian “' + (s ? s.name : '') + '”';
    document.getElementById('pkCur').innerHTML = 'Isi sekarang: ' + (cur.length ? '<strong>' + cur.map(esc).join(' · ') + '</strong>' : '<em>kosong</em>');
}

function pkRender() {
    const grid = document.getElementById('pkGrid'); if (!grid || !pkTarget) return;
    pkRenderCur();
    document.getElementById('pkRoots').innerHTML = noteStrings.map(n =>
        `<button class="chip${!pkQ && n === pkRoot ? ' on' : ''}" onclick="pkSetRoot('${n}')">${n}${FLAT[n] ? `<small>${FLAT[n]}</small>` : ''}</button>`).join('');
    document.getElementById('pkCats').innerHTML = LIB_CATS.map(([k, l]) =>
        `<button class="chip${k === pkCat ? ' on' : ''}" onclick="pkSetCat('${k}')">${l}</button>`).join('');
    const q = pkQ.trim().toLowerCase();
    pkList = Object.values(chordDatabase).filter(c => (q ? (c.key + ' ' + c.name).toLowerCase().includes(q) : c.root === pkRoot) && (pkCat === 'all' || libCatOf(c) === pkCat)).slice(0, 90);
    document.getElementById('pkCount').textContent = pkList.length + ' akor' + (q ? ` untuk “${pkQ.trim()}”` : ' untuk nada dasar ' + pkRoot + (FLAT[pkRoot] ? '/' + FLAT[pkRoot] : ''));
    grid.innerHTML = pkList.length ? pkList.map((c, i) => {
        const n = c.variants.length, vi = Math.min(pkVar[c.key] || 0, n - 1), v = c.variants[vi];
        return `<div class="lib-card">
            <div class="lib-top"><strong>${esc(c.key)}</strong><small>${c.slash ? 'Slash chord' : esc(c.name.split(' ').slice(1).join(' '))}</small></div>
            <div class="lib-dia">${generateVerticalDiagramHTML(v.fingering)}</div>
            <div class="lib-var">${n > 1 ? `<button aria-label="Bentuk sebelumnya" onclick="pkStep(${i},-1)">‹</button>` : ''}<span title="${esc(v.desc)}">${n > 1 ? (vi + 1) + '/' + n + ' · ' : ''}${esc(v.desc.replace(/ — .*/, ''))}</span>${n > 1 ? `<button aria-label="Bentuk berikutnya" onclick="pkStep(${i},1)">›</button>` : ''}</div>
            <div class="lib-act"><button onclick="pkPlay(${i})" aria-label="Dengar">🔊</button><button onclick="pkAdd(${i})">➕ Tambah</button></div>
        </div>`;
    }).join('') : '<span class="empty-list">Tidak ada akor yang cocok. Coba kata lain, mis. “m7” atau “sus”.</span>';
}

function pkSetRoot(n) { pkRoot = n; pkQ = ''; const s = document.getElementById('pkSearch'); if (s) s.value = ''; pkRender(); }
function pkSetCat(k) { pkCat = k; pkRender(); }
function pkSearch(v) { pkQ = v; pkRender(); }
function pkStep(i, d) { const c = pkList[i], n = c.variants.length; pkVar[c.key] = ((pkVar[c.key] || 0) + d + n) % n; pkRender(); }
function pkPlay(i) { const c = pkList[i]; playChordFingering(c.variants[pkVar[c.key] || 0].fingering); }
function pkAdd(i) {
    const c = pkList[i]; if (!c || !pkTarget) return;
    const v = Math.min(pkVar[c.key] || 0, c.variants.length - 1);
    if (pkTarget.type === 'prog') { progression.push({ key: c.key, v }); renderProgression(); pcToast(c.key + ' ditambahkan ke Progresi'); }
    else {
        const s = song.sections[pkTarget.i]; if (!s) { pkClose(); return; }
        s.chords.push({ key: c.key, v, beats: 0 }); renderSong(); pcToast(c.key + ' ditambahkan ke ' + s.name);
    }
    pkRenderCur();
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') pkClose(); });
