/* Pitchcraft — Lagu: bagian, akor berdurasi (ketuk), lirik ber-akor (format [Am]kata), transpose, ekspor/impor .json. */

const newSection = name => ({ name: name || 'Bait 1', lyrics: '', chords: [] });
let song = { name: '', meter: '4/4', sections: [newSection()] };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function cleanSong(d) {
    const secs = Array.isArray(d && d.sections) ? d.sections : [];
    return {
        name: String(d.name || '').slice(0, 80),
        meter: METERS[d.meter] ? d.meter : '4/4',
        sections: secs.slice(0, 40).map(s => ({
            name: String((s && s.name) || 'Bagian').slice(0, 60),
            lyrics: String((s && s.lyrics) || '').slice(0, 20000),
            chords: (Array.isArray(s && s.chords) ? s.chords : []).slice(0, 200).filter(c => c && chordDatabase[c.key]).map(c => ({
                key: c.key,
                v: Math.min(Math.max(0, c.v | 0), chordDatabase[c.key].variants.length - 1),
                beats: Math.min(16, Math.max(0, c.beats | 0))
            }))
        }))
    };
}

function setMeter(v) { song.meter = METERS[v] ? v : '4/4'; }

const beatOpts = sel => [0, 1, 2, 3, 4, 6, 8].map(n => `<option value="${n}"${n === sel ? ' selected' : ''}>${n ? n + ' ketuk' : '1 bar'}</option>`).join('');

// "[Am]kata [G]kata" -> akor di atas lirik
function lyricsHTML(txt) {
    return String(txt || '').split('\n').map(line => {
        if (!line.trim()) return '<div class="lyr-line">&nbsp;</div>';
        const parts = line.split(/\[([^\]]*)\]/);
        let h = parts[0] ? `<span class="seg"><b>&nbsp;</b><i>${esc(parts[0])}</i></span>` : '';
        for (let i = 1; i < parts.length; i += 2) h += `<span class="seg"><b>${esc(parts[i])}</b><i>${esc(parts[i + 1] || '') || '&nbsp;'}</i></span>`;
        return `<div class="lyr-line">${h}</div>`;
    }).join('');
}

function renderSong() {
    const el = document.getElementById('songView'); if (!el) return;
    const capo = getCapo(), nm = document.getElementById('songName');
    document.querySelectorAll('[data-sync="meter"]').forEach(s => { s.value = song.meter; });
    if (nm && nm !== document.activeElement) nm.value = song.name;
    el.innerHTML = song.sections.map((s, i) => `
        <div class="song-sec">
            <div class="picker-row"><input type="text" class="song-in" value="${esc(s.name)}" maxlength="60" aria-label="Nama bagian" onchange="songSet(${i},'name',this.value)">
                <button class="btn-delete-saved" onclick="songDelSection(${i})">Hapus</button></div>
            <div class="detected-list" style="margin-top:8px">${s.chords.length ? s.chords.map((c, j) => `<div class="badge">${c.key}${capo ? ` <small>→ ${tKey(c.key, capo)}</small>` : ''} <select class="beat-sel" aria-label="Durasi" onchange="songBeats(${i},${j},this.value)">${beatOpts(c.beats || 0)}</select> <span onclick="songDelChord(${i},${j})">&times;</span></div>`).join('') : '<span class="empty-list">Belum ada akor. Tekan “📚 Dari Kamus” untuk memilih akor, atau “⤵ Dari Progresi”.</span>'}</div>
            <div class="picker-row" style="margin-top:8px"><button class="btn-variant" onclick="cpOpen('song',${i})">📚 Dari Kamus</button><button class="btn-variant" onclick="songAddChord(${i})">➕ Akor saat ini</button><button class="btn-variant" onclick="songFromProg(${i})">⤵ Dari Progresi</button></div>
            <textarea class="song-ta" rows="4" aria-label="Lirik" placeholder="Lirik dengan akor, mis. [Am]Selamat [G]pagi dunia" onchange="songSet(${i},'lyrics',this.value)">${esc(s.lyrics)}</textarea>
            <div class="lyr">${lyricsHTML(s.lyrics)}</div>
        </div>`).join('');
    saveSettings();
}

function songSet(i, k, v) { song.sections[i][k] = k === 'name' ? v.slice(0, 60) : v; renderSong(); }
function songAddSection() { song.sections.push(newSection('Bagian ' + (song.sections.length + 1))); renderSong(); }
function songDelSection(i) { song.sections.splice(i, 1); if (!song.sections.length) song.sections.push(newSection()); renderSong(); }
function songAddChord(i) {
    if (!currentDetectedChordObj) { alert('Pilih atau deteksi akor dulu.'); return; }
    song.sections[i].chords.push({ key: currentDetectedChordObj.key, v: activeVariantIndex, beats: 0 }); renderSong();
}
function songFromProg(i) {
    if (!progression.length) { alert('Progresi masih kosong.'); return; }
    progression.forEach(p => song.sections[i].chords.push({ key: p.key, v: p.v, beats: 0 })); renderSong();
}
function songBeats(i, j, v) { song.sections[i].chords[j].beats = +v || 0; saveSettings(); }
function songDelChord(i, j) { song.sections[i].chords.splice(j, 1); renderSong(); }

function songPlay() {
    const list = [].concat(...song.sections.map(s => s.chords));
    if (!list.length) { alert('Tambahkan akor ke bagian lagu dulu.'); return; }
    playList(list, '#songView .badge');
}

// Transpose seluruh lagu: akor di daftar, penanda [..] di lirik, dan kunci di tab Kunci
function songTranspose(d) {
    song.sections.forEach(s => {
        s.chords.forEach(c => { let nk = tKey(c.key, d); if (!chordDatabase[nk]) nk = nk.split('/')[0]; if (chordDatabase[nk]) { c.key = nk; c.v = 0; } });
        s.lyrics = s.lyrics.replace(/\[([^\]]*)\]/g, (m, x) => '[' + tKey(x, d) + ']');
    });
    const kr = document.getElementById('keyRoot'); kr.value = (+kr.value + d + 12) % 12;
    renderKey();   // memanggil refreshChordViews -> renderSong
}

function songExport() {
    const data = { format: 'pitchcraft-song', v: 1, name: song.name, key: { root: +document.getElementById('keyRoot').value, mode: document.getElementById('keyMode').value },
        bpm: +document.getElementById('bpm').value || 80, meter: song.meter, sections: song.sections };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = (song.name || 'lagu').replace(/[^\w\-]+/g, '_') + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

function applySong(d) {
    song = cleanSong(d); if (!song.sections.length) song.sections = [newSection()];
    if (+d.bpm) syncVals('bpm', Math.min(200, Math.max(40, +d.bpm)));
    const k = d.key;
    if (k && +k.root >= 0 && +k.root < 12) { document.getElementById('keyRoot').value = String(k.root | 0); if (k.mode === 'maj' || k.mode === 'min') document.getElementById('keyMode').value = k.mode; }
    document.getElementById('songName').value = song.name;
    renderKey();
}

function songImport(inp) {
    const f = inp.files && inp.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { try { const d = JSON.parse(r.result); if (!d || !Array.isArray(d.sections)) throw new Error('bad'); applySong(d); } catch (e) { alert('File lagu tidak valid.'); } inp.value = ''; };
    r.onerror = () => alert('Gagal membaca file.');
    r.readAsText(f);
}
