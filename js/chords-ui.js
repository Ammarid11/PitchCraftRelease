/* Pitchcraft — Daftar nada, pencocokan akor dari nada, tampilan fretboard, variasi bentuk, transpose, dan akor tersimpan. */

let detectedNotesList = [];
let savedChordsList = [];
let currentDetectedChordObj = null;
let activeVariantIndex = 0;

function addNoteToList(note) {
    if (detectedNotesList.length >= 6) {
        detectedNotesList.shift();
    }
    detectedNotesList.push(note);
    renderDetectedList();
    evaluateChordFromList();
}

function removeNote(index) {
    detectedNotesList.splice(index, 1);
    renderDetectedList();
    evaluateChordFromList();
}

function renderDetectedList() {
    const listEl = document.getElementById('detectedList');
    if (detectedNotesList.length === 0) {
        listEl.innerHTML = `<span class="empty-list">Belum ada nada yang masuk. Petik senar gitar...</span>`;
        return;
    }

    listEl.innerHTML = detectedNotesList.map((n, i) => `
                <div class="badge">
                    ${i + 1}. ${n} <span onclick="removeNote(${i})">&times;</span>
                </div>
            `).join('');
}

let currentCandidates = [];

function rankChords() {
    const first = detectedNotesList[0];
    const set = [...new Set(detectedNotesList)];
    const res = [];
    for (const key in chordDatabase) {
        const c = chordDatabase[key];
        if (c.ext) continue;   // kamus lanjutan tidak ikut pencocokan otomatis
        const match = c.notes.filter(n => set.includes(n)).length;
        const extra = set.length - match, missing = c.notes.length - match;
        if (match < 2 || extra > 2) continue;
        const score = match * 3 - extra * 3 - missing + (c.root === first ? 4 : 0) + (!extra && !missing ? 4 : 0);
        res.push({ key, score });
    }
    return res.sort((a, b) => b.score - a.score);
}

function showChordKey(key) {
    currentDetectedChordObj = chordDatabase[key];
    activeVariantIndex = 0;
    document.getElementById('saveChordBtn').style.display = 'block';
    document.getElementById('playAudioBtn').style.display = 'block';
    displayChordInfo(currentDetectedChordObj, 0, 'chordResultBox');
}

function pickManual() {
    learnable = false;
    currentCandidates = [];
    const key = document.getElementById('rootSel').value + document.getElementById('qualSel').value;
    if (!chordDatabase[key]) { alert('Bentuk ' + key + ' belum ada di kamus.'); return; }
    showChordKey(key);
}

function clearNotes() {
    detectedNotesList = [];
    renderDetectedList();
    evaluateChordFromList();
}

function initPicker() {
    document.getElementById('rootSel').innerHTML = noteStrings.map(n => `<option value="${n}">${n}${FLAT[n] ? "/" + FLAT[n] : ""}</option>`).join('');
    const opt = q => `<option value="${q.k}">${q.n}</option>`;
    document.getElementById('qualSel').innerHTML = QUALITIES.filter(q => !q.ext).map(opt).join('') +
        `<optgroup label="Kamus lanjutan">${QUALITIES.filter(q => q.ext).map(opt).join('')}</optgroup>` +
        `<optgroup label="Slash chord (tidak semua akar ada)">${SLASH_SUFFIXES.map(s => `<option value="${s}">${s}</option>`).join('')}</optgroup>`;
    try { exemplars = JSON.parse(localStorage.getItem('pc_ex') || '{}'); } catch (e) { exemplars = {}; }
    try { savedChordsList = JSON.parse(localStorage.getItem('pc_saved') || '[]'); } catch (e) { savedChordsList = []; }
    renderSavedChords();
}

function evaluateChordFromList() {
    learnable = false;
    const resultBox = document.getElementById('chordResultBox');
    const saveBtn = document.getElementById('saveChordBtn');
    const audioBtn = document.getElementById('playAudioBtn');

    if (detectedNotesList.length === 0) {
        currentDetectedChordObj = null; currentCandidates = [];
        saveBtn.style.display = 'none'; audioBtn.style.display = 'none';
        resultBox.innerHTML = `
            <div class="chord-title-result">—</div>
            <div class="chord-detail-row">Nada Pembentuk: <strong>-</strong></div>
            <div class="chord-detail-row">Posisi Jari: <strong>-</strong></div>
            <div style="color: var(--text-muted); font-size: 0.85rem; font-style: italic;">List nada kosong.</div>`;
        return;
    }
    const ranked = rankChords();
    if (ranked.length) {
        currentCandidates = ranked.slice(0, 6).map(r => r.key);
        showChordKey(ranked[0].key);
    } else {
        currentDetectedChordObj = null; currentCandidates = [];
        saveBtn.style.display = 'none'; audioBtn.style.display = 'none';
        resultBox.innerHTML = `
            <div class="chord-title-result">Kombinasi Urutan Kustom</div>
            <div class="chord-detail-row">Urutan Nada: <strong>${detectedNotesList.join(' → ')}</strong></div>
            <div class="chord-detail-row" style="color: var(--warning);">Belum cocok dengan kamus master akor.</div>`;
    }
}

function switchVariant(direction) {
    if (!currentDetectedChordObj) return;
    let totalVariants = currentDetectedChordObj.variants.length;
    activeVariantIndex = (activeVariantIndex + direction + totalVariants) % totalVariants;
    displayChordInfo(currentDetectedChordObj, activeVariantIndex, 'chordResultBox');
}

function generateHorizontalFretboardHTML(fingeringArray) {
    fingeringArray = adaptFingering(fingeringArray);
    const pos = fingeringArray.filter(f => f > 0);
    const minFret = pos.length ? Math.min(...pos) : 1, maxFret = pos.length ? Math.max(...pos) : 1;
    const startFret = maxFret <= 5 ? 1 : minFret;
    const fn = analyzeFingers(fingeringArray).fing;
    const stringNames = tuningInfo().t.map((m, i) => i === 5 ? noteStrings[m % 12].toLowerCase() : noteStrings[m % 12]);
    let h = `<div class="fretboard-box-h"><div class="fretboard-h-grid"><div></div>`;
    for (let i = 0; i < 5; i++) h += `<div class="h-fret-header">${startFret + i}</div>`;
    for (let s = 5; s >= 0; s--) {   // senar 1 (e kecil) di atas, seperti tab
        const f = fingeringArray[s];
        const mark = f === 0 ? 'o' : (f === -1 ? 'x' : '');
        const col = f === 0 ? 'var(--success)' : (f === -1 ? '#ef4444' : 'var(--text-muted)');
        h += `<div class="h-string-label"><span>${stringNames[s]}</span><span style="color:${col};font-size:0.75rem;margin-left:2px;">${mark}</span></div>`;
        for (let i = 0; i < 5; i++) {
            const cur = startFret + i;
            const cls = (i === 0 && startFret === 1) ? 'h-fret-col-1' : '';
            h += `<div class="h-fret-cell ${cls}">${f === cur ? `<div class="finger-dot-h">${fn[s] || cur}</div>` : ''}</div>`;
        }
    }
    return h + `</div></div>`;
}

function displayChordInfo(chord, variantIdx, elementId) {
    const resultBox = document.getElementById(elementId);
    const variant = chord.variants[variantIdx];
    const fretboardMarkup = fretboardHTML(variant.fingering);
    if (elementId !== 'chordResultBox') return fretboardMarkup;

    let variantButtonsHTML = '';
    if (chord.variants.length > 1) {
        variantButtonsHTML = `
            <div style="margin-top: 10px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                <button class="btn-variant" onclick="switchVariant(-1)">◀ Bentuk Lain</button>
                <span style="font-size: 0.8rem; color: var(--text-muted);">Variasi ${variantIdx + 1} dari ${chord.variants.length}</span>
                <button class="btn-variant" onclick="switchVariant(1)">Bentuk Lain ▶</button>
            </div>`;
    }
    const alts = currentCandidates.filter(k => k !== chord.key);
    const altHTML = alts.length ? `
        <div class="alt-row">Kemungkinan lain:
            ${alts.map(k => `<button class="btn-variant" onclick="pickAlt('${k}')">${k}</button>`).join('')}
        </div>` : '';

    resultBox.innerHTML = `
        <div class="chord-title-result">${chord.name}</div>
        ${learnable && lastConf ? confBadgeHTML(lastConf) : ''}
        <div class="chord-detail-row">Nada Pembentuk: <strong>${chord.notes.join(' - ')}</strong></div>
        <div class="chord-detail-row">Posisi Jari: <strong>${variant.desc}</strong></div>
        ${tuneNoteHTML()}
        <div style="text-align: center;">${fretboardMarkup}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 6px;">Keterangan: <span style="color:var(--success);">o</span> = Open string, <span style="color:#ef4444;">x</span> = Senar mati</div>
        ${learnable ? `<div class="alt-row"><button class="btn-variant" onclick="learnCurrent()">✓ Benar, ingat pola ini</button><span>Salah? Pilih akor yang benar di "Kemungkinan lain" agar dipelajari.</span></div>` : ''}
        <div class="alt-row">Transpose:
            <button class="btn-variant" onclick="transposeChord(-1)">♭ −1</button>
            <button class="btn-variant" onclick="transposeChord(1)">♯ +1</button></div>
        ${variantButtonsHTML}${altHTML}`;
}

function saveCurrentChord() {
    if (!currentDetectedChordObj) return;

    let chordToSave = {
        name: currentDetectedChordObj.name,
        notes: currentDetectedChordObj.notes,
        variant: currentDetectedChordObj.variants[activeVariantIndex]
    };

    let exists = savedChordsList.some(item => item.name === chordToSave.name && item.variant.desc === chordToSave.variant.desc);
    if (!exists) {
        savedChordsList.push(chordToSave); pcToast('Disimpan: ' + chordToSave.name + ' (lihat di tab Progresi)');
        renderSavedChords();
    } else {
        alert("Variasi akor ini sudah ada di dalam daftar tersimpan!");
    }
}

function removeSavedChord(index) {
    savedChordsList.splice(index, 1);
    renderSavedChords();
}

function renderSavedChords() {
    try { localStorage.setItem('pc_saved', JSON.stringify(savedChordsList)); } catch (e) { }
    const container = document.getElementById('savedChordsContainer');
    if (savedChordsList.length === 0) {
        container.innerHTML = `<span class="empty-list">Belum ada akor tersimpan. Tampilkan sebuah akor di tab Deteksi lalu tekan “💾 Simpan Variasi Ini”.</span>`;
        return;
    }

    container.innerHTML = savedChordsList.map((savedItem, idx) => {
        let miniFretHTML = fretboardHTML(savedItem.variant.fingering);
        return `
                    <div class="saved-item-card">
                        <div class="saved-item-left">
                            <span class="saved-item-title">${savedItem.name}</span>
                            <div style="font-size: 0.75rem; color: var(--text-muted);">Nada: ${savedItem.notes.join(' - ')}</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted);">Posisi: ${savedItem.variant.desc}</div>
                            <div style="margin-top: 6px; text-align: left;">${miniFretHTML}</div>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            <button class="btn-variant" style="padding: 4px 8px; font-size: 0.75rem;" onclick='playChordFingering(${JSON.stringify(savedItem.variant.fingering)})'>🔊 Dengar</button>
                            <button class="btn-delete-saved" onclick="removeSavedChord(${idx})">Hapus</button>
                        </div>
                    </div>
                `;
    }).join('');
}

function transposeChord(d) {
    if (!currentDetectedChordObj) return;
    const nk = tKey(currentDetectedChordObj.key, d);
    if (!chordDatabase[nk]) { alert('Bentuk ' + nk + ' belum ada di kamus.'); return; }
    currentCandidates = [];
    showChordKey(nk);
}

function copySaved() {
    if (!savedChordsList.length) { alert('Belum ada akor tersimpan.'); return; }
    const txt = savedChordsList.map(c => `${c.name} (${c.variant.desc}): ${adaptFingering(c.variant.fingering).map(v => v === -1 ? 'x' : v).join(' ')}`).join('\n');
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => alert('Daftar disalin!'), () => prompt('Salin manual:', txt));
}

/* --- Nomor jari (1-4), deteksi barre, dan diagram vertikal --- */
let diagramMode = 'h';
const fretboardHTML = f => diagramMode === 'v' ? generateVerticalDiagramHTML(f) : generateHorizontalFretboardHTML(f);
function toggleDiagram() { diagramMode = diagramMode === 'v' ? 'h' : 'v'; refreshChordViews(); saveSettings(); }

// Barre dipakai jika akor butuh lebih dari 4 jari (atau barre kecil F): jari 1 menutup semua senar di fret terendah.
// Sisanya diberi nomor 2-4 (atau 1-4 tanpa barre) menurut urutan fret lalu senar.
function analyzeFingers(f) {
    const pos = f.filter(v => v > 0), fing = f.map(() => 0);
    if (!pos.length) return { fing, barre: null };
    const m = Math.min(...pos), at = f.map((v, i) => v === m ? i : -1).filter(i => i >= 0);
    let barre = null, next = 1;
    if (at.length >= 2 && (pos.length > 4 || (m === 1 && at.includes(5)))) {   // >4 jari, atau barre kecil fret 1 di senar atas (F)
        const a = at[0], b = at[at.length - 1]; let clear = true;
        for (let i = a; i <= b; i++) if (f[i] < m) clear = false;   // senar mati/terbuka di antaranya = bukan barre
        if (clear) { barre = { fret: m, from: a, to: b }; for (let i = a; i <= b; i++) fing[i] = 1; next = 2; }
    }
    f.map((v, i) => ({ v, i })).filter(o => o.v > 0 && !fing[o.i]).sort((x, y) => x.v - y.v || x.i - y.i)
        .forEach(o => { fing[o.i] = Math.min(4, next++); });
    return { fing, barre };
}

function generateVerticalDiagramHTML(f0) {
    const f = adaptFingering(f0), { fing, barre } = analyzeFingers(f), pos = f.filter(v => v > 0);
    const minF = pos.length ? Math.min(...pos) : 1, maxF = pos.length ? Math.max(...pos) : 1, start = maxF <= 5 ? 1 : minF;
    const x0 = 30, dx = 20, y0 = 34, dy = 24, lefty = document.body.classList.contains('lefty');
    const sx = s => x0 + (lefty ? 5 - s : s) * dx;
    const names = tuningInfo().t.map((m, i) => i === 5 ? noteStrings[m % 12].toLowerCase() : noteStrings[m % 12]);
    let g = '';
    for (let i = 0; i <= 5; i++) g += `<line x1="${x0}" y1="${y0 + i * dy}" x2="${x0 + 5 * dx}" y2="${y0 + i * dy}" stroke="#475069" stroke-width="${i === 0 && start === 1 ? 5 : 1.5}"/>`;
    for (let s = 0; s < 6; s++) {
        g += `<line x1="${sx(s)}" y1="${y0}" x2="${sx(s)}" y2="${y0 + 5 * dy}" stroke="#475069" stroke-width="1.5"/><text x="${sx(s)}" y="${y0 + 5 * dy + 14}" font-size="9" fill="#8391a7" text-anchor="middle">${names[s]}</text>`;
        if (f[s] === -1) g += `<text x="${sx(s)}" y="${y0 - 9}" font-size="13" fill="#ef4444" text-anchor="middle">×</text>`;
        else if (f[s] === 0) g += `<circle cx="${sx(s)}" cy="${y0 - 13}" r="4" fill="none" stroke="#10b981" stroke-width="1.5"/>`;
    }
    if (start > 1) g += `<text x="${x0 - 8}" y="${y0 + dy / 2 + 4}" font-size="11" fill="#8391a7" text-anchor="end">${start}</text>`;
    if (barre && barre.fret - start >= 0 && barre.fret - start < 5) {
        const xa = Math.min(sx(barre.from), sx(barre.to)), xb = Math.max(sx(barre.from), sx(barre.to));
        g += `<rect x="${xa - 7}" y="${y0 + (barre.fret - start) * dy + 4}" width="${xb - xa + 14}" height="${dy - 8}" rx="8" fill="#8b5cf6"/>`;
    }
    f.forEach((v, s) => {
        const r = v - start; if (v <= 0 || r < 0 || r > 4) return;
        g += `<circle cx="${sx(s)}" cy="${y0 + r * dy + dy / 2}" r="8" fill="#8b5cf6"/><text x="${sx(s)}" y="${y0 + r * dy + dy / 2 + 3.5}" font-size="10" font-weight="700" fill="#fff" text-anchor="middle">${fing[s] || v}</text>`;
    });
    return `<div class="fretboard-box-h"><svg viewBox="0 0 160 ${y0 + 5 * dy + 22}" width="160" role="img" aria-label="Diagram akor">${g}</svg></div>`;
}
