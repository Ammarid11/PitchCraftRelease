/* Pitchcraft — tes Lagu & tempel teks (js/song.js, js/extras.js): transpose, pembaca teks akor, batas, progresi.
 * Jalankan: node tests/song.test.js */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
let fails = 0; const ok = (c, m) => { console.log((c ? 'LULUS  ' : 'GAGAL  ') + m); if (!c) fails++; };
const toasts = [], el = () => ({ addEventListener() {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, value: '', innerHTML: '', textContent: '', focus() {} });
const ctx = vm.createContext({ console, Math, JSON, Date, Set, Map, Object, Array, Number, String, isNaN, parseInt, setTimeout, clearTimeout, setInterval, performance: { now: () => 0 },
    MutationObserver: function () { this.observe = () => {}; },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, navigator: {}, location: { protocol: 'file:' },
    window: { addEventListener() {} }, confirm: () => true, alert() {},
    document: { addEventListener() {}, getElementById: () => el(), querySelectorAll: () => [], querySelector: () => el(), body: { style: {} } } });
vm.runInContext(`var pcToast = m => __t.push(m), saveSettings = () => {}, renderKey = () => {}, renderStreak = () => {}, syncVals = () => {}, keepAwake = () => {}, allowSleep = () => {},
    isListening = false, isStrum = false, currentDetectedChordObj = null, activeVariantIndex = 0, clickSound = () => {}, playChordFingering = () => {},
    saveHist = () => {}, renderHist = () => {}, lsGet = (k, d) => d, lsSet = () => {}, cleanSession = () => null, getSessions = () => [], setSessions = () => {}, newId = () => 'x', dayKey = () => '2026-01-01';`, Object.assign(ctx, { __t: toasts }));
['config.js', 'chords-db.js', 'progression.js', 'song.js', 'extras.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), ctx, { filename: f }));
const run = e => vm.runInContext(e, ctx);
const setSong = secs => run(`song = { name: 'T', meter: '4/4', sections: ${JSON.stringify(secs)} }`);

// ---- transpose (#5)
setSong([{ name: 'Bait', lyrics: '[Am]halo [G]dunia\n[Bridge]\n[Chorus]\n[N.C.]\n[F#m7]x [C/G]y', chords: [{ key: 'Am', v: 0, beats: 0 }, { key: 'G', v: 0, beats: 0 }] }]);
run('songTranspose(2)');
const lyr = run('song.sections[0].lyrics');
ok(lyr.includes('[Bm]halo [A]dunia') && lyr.includes('[G#m7]x [D/A]y'), 'transpose +2: penanda akor ikut bergeser (Am→Bm, G→A, F#m7→G#m7, C/G→D/A)');
ok(lyr.includes('[Bridge]') && lyr.includes('[Chorus]') && lyr.includes('[N.C.]'), 'transpose: [Bridge], [Chorus], [N.C.] tidak dirusak');
ok(run('song.sections[0].chords.map(c => c.key).join()') === 'Bm,A', 'transpose: daftar akor sama dengan penanda di lirik');
setSong([{ name: 'x', lyrics: '[Am]a [Bb]b [C#m]c', chords: [] }]); run('songTranspose(5)'); run('songTranspose(-5)');
ok(run('song.sections[0].lyrics') === '[Am]a [A#]b [C#m]c', 'transpose +5 lalu −5 kembali ke akor awal (Bb ditulis A#)');

// ---- batas bagian/akor (#3)
setSong([{ name: 'a', lyrics: '', chords: [] }]);
for (let i = 0; i < 45; i++) run('songAddSection()');
ok(run('song.sections.length') === 40, 'bagian dibatasi 40 di UI (sama dengan cleanSong), bukan dipotong diam-diam saat dimuat');
ok(toasts.some(t => /Batas 40 bagian/.test(t)), 'pengguna diberi tahu saat batas bagian tercapai');
setSong([{ name: 'a', lyrics: '', chords: [] }]); run('progression = Array.from({ length: 250 }, () => ({ key: "C", v: 0 }))');
run('songFromProg(0)'); ok(run('song.sections[0].chords.length') === 200 && run('cleanSong(song).sections[0].chords.length') === 200, 'dari progresi: maks. 200 akor per bagian, tidak ada yang hilang saat cleanSong');
ok(run('songFull(0)') === true, 'bagian penuh ditolak');
run('progression = []');

// ---- tempel teks (#15)
const parse = t => run(`parseChordSheet(${JSON.stringify(t)})`);
let p = parse('Bridge over troubled water\nAm G\nhalo dunia');
ok(p.length === 1 && p[0].lyrics.includes('Bridge over troubled water'), 'lirik "Bridge over troubled water" bukan judul bagian');
p = parse('Reff:\nC G\nlirik satu\nVerse 2\nAm F\nlirik dua\nOutro x2\nC\n[Bridge]\nG\nx');
ok(p.map(s => s.name).join('|') === 'Reff|Verse 2|Outro x2|Bridge', 'judul bagian tetap dikenali: Reff:, Verse 2, Outro x2, [Bridge] (hasil: ' + p.map(s => s.name).join('|') + ')');
p = parse('[Verse 1 - Cowok]\nC G\nlirik');
ok(p[0].name === 'Verse 1 - Cowok', 'judul berkurung dengan keterangan tetap dikenali');
ok(run("chordKeyOf('C-')") === 'Cm' && run("chordKeyOf('Csus')") === 'Csus4' && run("chordKeyOf('C+')") === 'Caug', 'C- = minor, Csus = sus4, C+ = aug (tidak diam-diam jadi C mayor)');
ok(run("chordKeyOf('Fb')") === 'E' && run("chordKeyOf('E#')") === 'F' && run("chordKeyOf('Cb')") === 'B' && run("chordKeyOf('B#')") === 'C', 'Cb, Fb, E#, B# dikenali');
ok(run("chordKeyOf('Bbmin7')") === 'A#m7' && run("chordKeyOf('M7')") === null, 'normalisasi lama tetap: Bbmin7 → A#m7');

// ---- impor lagu: konfirmasi (#6)
let asked = 0; ctx.confirm = () => { asked++; return false; };
setSong([{ name: 'ada isi', lyrics: '[Am]x', chords: [] }]);
ctx.FileReader = function () { this.readAsText = function () { this.result = JSON.stringify({ sections: [{ name: 'baru', lyrics: 'y', chords: [] }] }); this.onload(); }; };
run("songImport({ files: [{}], value: '' })");
ok(asked === 1 && run('song.sections[0].name') === 'ada isi', 'impor lagu: meminta konfirmasi dan tidak menimpa bila ditolak');
ctx.confirm = () => true; run("songImport({ files: [{}], value: '' })");
ok(run('song.sections[0].name') === 'baru', 'impor lagu: menimpa bila disetujui');

// ---- progresi (#16)
run('progression = []'); ok(run('progPush({ key: "C", v: 0 })') === true, 'progPush menambah akor');
run('progression = Array.from({ length: 200 }, () => ({ key: "C", v: 0 }))'); ok(run('progPush({ key: "G", v: 0 })') === false && run('progression.length') === 200, 'progresi dibatasi 200 akor');
console.log(fails ? `\n${fails} tes gagal` : '\nSemua tes Lagu lulus'); process.exit(fails ? 1 : 0);
