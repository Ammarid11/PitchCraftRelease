/* Pitchcraft — Penyimpanan pengaturan (localStorage 'pc_settings') dan sinkron kontrol kembar antar tab. */

const PC_KEY = 'pc_settings';
let pcLoading = false;
// Versi format pengaturan. Saat format berubah: naikkan SETTINGS_V dan tambah fungsi di SETTINGS_MIGRATIONS[versi_lama] yang mengembalikan objek versi baru.
const SETTINGS_V = 1, SETTINGS_MIGRATIONS = {};
function migrateSettings(s) { let v = +s.v || 1; while (SETTINGS_MIGRATIONS[v]) { s = SETTINGS_MIGRATIONS[v](s) || s; s.v = ++v; } return s; }
const byId = id => document.getElementById(id);

// Kontrol yang muncul di dua tab (BPM, metronom, hitung mundur, birama) ditandai data-sync dan dijaga sama
function syncVals(k, v) {
    document.querySelectorAll('[data-sync="' + k + '"]').forEach(x => { if (x.type === 'checkbox') x.checked = !!v; else x.value = v; });
}

function collectSettings() {
    return {
        v: SETTINGS_V, progression, song,
        bpm: +byId('bpm').value || 80, metro: byId('metroChk').checked, count: document.querySelector('[data-sync="cnt"]').checked,
        pat: strumPatSel, tuning: byId('tunSel').value, keyRoot: byId('keyRoot').value, keyMode: byId('keyMode').value, capo: byId('capoSel').value,
        lefty: document.body.classList.contains('lefty'), autoRec: byId('autoRec').checked,
        refA, vib: byId('vibChk').checked, diag: diagramMode, dmode: byId('drillMode').value, lvl: byId('drillLevel').value, dur: byId('drillDur').value
    };
}

function saveSettings() {
    if (pcLoading) return;
    try { localStorage.setItem(PC_KEY, JSON.stringify(collectSettings())); } catch (e) { }
}

function setSel(id, v) { const e = byId(id); if (e && v !== undefined && Array.from(e.options).some(o => o.value === String(v))) e.value = v; }

function loadSettings() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(PC_KEY) || 'null'); } catch (e) { }
    if (!s || typeof s !== 'object') return;
    s = migrateSettings(s);
    pcLoading = true;
    try {
        if (Array.isArray(s.progression)) progression = s.progression.filter(p => p && chordDatabase[p.key]).map(p => ({ key: p.key, v: Math.min(Math.max(0, p.v | 0), chordDatabase[p.key].variants.length - 1) }));
        if (s.song && Array.isArray(s.song.sections)) { song = cleanSong(s.song); if (!song.sections.length) song.sections = [newSection()]; }
        if (+s.bpm) syncVals('bpm', Math.min(200, Math.max(40, +s.bpm)));
        if (typeof s.metro === 'boolean') syncVals('metro', s.metro);
        if (typeof s.count === 'boolean') syncVals('cnt', s.count);
        if (STRUM_PATS[s.pat]) { strumPatSel = s.pat; byId('patSel').value = s.pat; }
        setSel('tunSel', s.tuning); setSel('keyRoot', s.keyRoot); setSel('keyMode', s.keyMode); setSel('capoSel', s.capo);
        document.body.classList.toggle('lefty', !!s.lefty);
        if (typeof s.autoRec === 'boolean') byId('autoRec').checked = s.autoRec;
        if (+s.refA >= 432 && +s.refA <= 446) { refA = +s.refA; setSel('refSel', s.refA); }
        if (typeof s.vib === 'boolean') byId('vibChk').checked = s.vib;
        if (s.diag === 'v') diagramMode = 'v';
        setSel('drillMode', s.dmode); setSel('drillLevel', s.lvl); setSel('drillDur', s.dur);
    } finally { pcLoading = false; }
}

function toggleLefty() { document.body.classList.toggle('lefty'); saveSettings(); }

document.addEventListener('change', e => {
    const k = e.target && e.target.dataset && e.target.dataset.sync;
    if (k) document.querySelectorAll('[data-sync="' + k + '"]').forEach(x => {
        if (x === e.target) return;
        if (x.type === 'checkbox') x.checked = e.target.checked; else x.value = e.target.value;
    });
    saveSettings();
});
