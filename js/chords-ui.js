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
    showChordKey(document.getElementById('rootSel').value + document.getElementById('qualSel').value);
}

function clearNotes() {
    detectedNotesList = [];
    renderDetectedList();
    evaluateChordFromList();
}

function initPicker() {
    document.getElementById('rootSel').innerHTML = noteStrings.map(n => `<option value="${n}">${n}${FLAT[n] ? "/" + FLAT[n] : ""}</option>`).join('');
    document.getElementById('qualSel').innerHTML = QUALITIES.map(q => `<option value="${q.k}">${q.n}</option>`).join('');
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
    const pos = fingeringArray.filter(f => f > 0);
    const minFret = pos.length ? Math.min(...pos) : 1, maxFret = pos.length ? Math.max(...pos) : 1;
    const startFret = maxFret <= 5 ? 1 : minFret;
    const stringNames = ['E', 'A', 'D', 'G', 'B', 'e'];
    let h = `<div class="fretboard-box-h"><div class="fretboard-h-grid"><div></div>`;
    for (let i = 0; i < 5; i++) h += `<div class="h-fret-header">${startFret + i}</div>`;
    for (let s = 0; s < 6; s++) {
        const f = fingeringArray[s];
        const mark = f === 0 ? 'o' : (f === -1 ? 'x' : '');
        const col = f === 0 ? 'var(--success)' : (f === -1 ? '#ef4444' : 'var(--text-muted)');
        h += `<div class="h-string-label"><span>${stringNames[s]}</span><span style="color:${col};font-size:0.75rem;margin-left:2px;">${mark}</span></div>`;
        for (let i = 0; i < 5; i++) {
            const cur = startFret + i;
            const cls = (i === 0 && startFret === 1) ? 'h-fret-col-1' : '';
            h += `<div class="h-fret-cell ${cls}">${f === cur ? `<div class="finger-dot-h">${cur}</div>` : ''}</div>`;
        }
    }
    return h + `</div></div>`;
}

function displayChordInfo(chord, variantIdx, elementId) {
    const resultBox = document.getElementById(elementId);
    const variant = chord.variants[variantIdx];
    const fretboardMarkup = generateHorizontalFretboardHTML(variant.fingering);
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
        savedChordsList.push(chordToSave);
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
        container.innerHTML = `<span class="empty-list">Belum ada akor yang disimpan.</span>`;
        return;
    }

    container.innerHTML = savedChordsList.map((savedItem, idx) => {
        let miniFretHTML = generateHorizontalFretboardHTML(savedItem.variant.fingering);
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
    const c = currentDetectedChordObj, q = c.key.slice(c.root.length);
    const nr = noteStrings[(noteStrings.indexOf(c.root) + d + 12) % 12];
    currentCandidates = [];
    showChordKey(nr + q);
}

function copySaved() {
    if (!savedChordsList.length) { alert('Belum ada akor tersimpan.'); return; }
    const txt = savedChordsList.map(c => `${c.name} (${c.variant.desc}): ${c.variant.fingering.map(v => v === -1 ? 'x' : v).join(' ')}`).join('\n');
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => alert('Daftar disalin!'), () => prompt('Salin manual:', txt));
}
