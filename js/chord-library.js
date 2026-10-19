/* Pitchcraft — Kamus akor lengkap: semua akor per nada dasar (dasar, 7th & ekstensi, sus, slash), cari, filter, variasi bentuk, dengar, buka, tambah ke progresi. */

const LIB_CATS = [['all', 'Semua'], ['dasar', 'Dasar'], ['seventh', '7th & ekstensi'], ['sus', 'Sus'], ['slash', 'Slash']];
const LIB_DASAR = ['', 'm', '5', 'dim', 'aug'], LIB_SUS = ['sus2', 'sus4', '7sus4'];
let libRoot = 'C', libCat = 'all', libQ = '', libVar = {}, libList = [];

function libCatOf(c) {
    if (c.slash) return 'slash';
    const q = c.key.slice(c.root.length);
    return LIB_DASAR.includes(q) ? 'dasar' : LIB_SUS.includes(q) ? 'sus' : 'seventh';
}

function pcToast(msg) {
    const el = document.getElementById('toast'); if (!el) return;
    el.textContent = msg; el.classList.add('on');
    clearTimeout(pcToast.t); pcToast.t = setTimeout(() => el.classList.remove('on'), 1700);
}

function renderLib() {
    const grid = document.getElementById('libGrid'); if (!grid) return;
    document.getElementById('libRoots').innerHTML = noteStrings.map(n =>
        `<button class="chip${!libQ && n === libRoot ? ' on' : ''}" onclick="libSetRoot('${n}')">${n}${FLAT[n] ? `<small>${FLAT[n]}</small>` : ''}</button>`).join('');
    document.getElementById('libCats').innerHTML = LIB_CATS.map(([k, l]) =>
        `<button class="chip${k === libCat ? ' on' : ''}" onclick="libSetCat('${k}')">${l}</button>`).join('');
    const q = libQ.trim().toLowerCase();
    libList = Object.values(chordDatabase).filter(c => (q ? (c.key + ' ' + c.name).toLowerCase().includes(q) : c.root === libRoot) && (libCat === 'all' || libCatOf(c) === libCat)).slice(0, 90);
    document.getElementById('libCount').textContent = libList.length + ' akor' + (q ? ` untuk “${libQ.trim()}”` : ' untuk nada dasar ' + libRoot + (FLAT[libRoot] ? '/' + FLAT[libRoot] : ''));
    grid.innerHTML = libList.length ? libList.map((c, i) => {
        const n = c.variants.length, vi = Math.min(libVar[c.key] || 0, n - 1), v = c.variants[vi];
        return `<div class="lib-card">
            <div class="lib-top"><strong>${esc(c.key)}</strong><small>${c.slash ? 'Slash chord' : esc(c.name.split(' ').slice(1).join(' '))}</small></div>
            <div class="lib-notes">${c.notes.join(' · ')}</div>
            <div class="lib-dia" onclick="libOpen(${i})" title="Pilih akor ini">${generateVerticalDiagramHTML(v.fingering)}</div>
            <div class="lib-var">${n > 1 ? `<button aria-label="Bentuk sebelumnya" onclick="libStep(${i},-1)">‹</button>` : ''}<span title="${esc(v.desc)}">${n > 1 ? (vi + 1) + '/' + n + ' · ' : ''}${esc(v.desc.replace(/ — .*/, ''))}</span>${n > 1 ? `<button aria-label="Bentuk berikutnya" onclick="libStep(${i},1)">›</button>` : ''}</div>
            <div class="lib-act"><button onclick="libPlay(${i})" aria-label="Dengar">🔊</button><button onclick="libAdd(${i})" aria-label="Tambah ke progresi">➕ Progresi</button></div>
        </div>`;
    }).join('') : '<span class="empty-list">Tidak ada akor yang cocok. Coba kata lain, mis. “m7” atau “sus”.</span>';
}

function libInit() { renderLib(); }
function libSetRoot(n) { libRoot = n; libQ = ''; const s = document.getElementById('libSearch'); if (s) s.value = ''; renderLib(); }
function libSetCat(k) { libCat = k; renderLib(); }
function libSearch(v) { libQ = v; renderLib(); }
function libStep(i, d) { const c = libList[i], n = c.variants.length; libVar[c.key] = ((libVar[c.key] || 0) + d + n) % n; renderLib(); }
function libPlay(i) { const c = libList[i]; playChordFingering(c.variants[libVar[c.key] || 0].fingering); }
function libAdd(i) { const c = libList[i]; progression.push({ key: c.key, v: libVar[c.key] || 0 }); renderProgression(); pcToast(c.key + ' ditambahkan ke Progresi'); }
function libOpen(i) {
    const c = libList[i], vi = libVar[c.key] || 0;
    learnable = false; currentCandidates = []; showChordKey(c.key);
    activeVariantIndex = vi; displayChordInfo(c, vi, 'chordResultBox');
    pcToast(c.key + ' dipilih (lihat detailnya di tab Deteksi)');   // tidak pindah tab sendiri
}

// tuning / diagram / kidal berubah -> gambar kamus ikut diperbarui
const _rcvLib = refreshChordViews;
refreshChordViews = function () { _rcvLib(); renderLib(); };
