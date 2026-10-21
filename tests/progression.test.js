/* Pitchcraft — tes pemutar progresi/lagu dengan Loop (js/progression.js). Jalankan: node tests/progression.test.js */
const fs = require('fs'), path = require('path'), vm = require('vm');
let fails = 0; const ok = (c, m) => { console.log((c ? 'LULUS  ' : 'GAGAL  ') + m); if (!c) fails++; };
let timers = [], now = 0, clicks = 0, plays = [], toasts = [];
const ctl = { bpm: { value: '120' }, metroChk: { checked: true }, cnt: { checked: true }, loop: { checked: false } };
const ctx = vm.createContext({ console, Math, JSON, Set, Object, Array, Number, String, isNaN, parseInt,
    setTimeout: (fn, ms) => { const t = { fn, at: now + ms, on: true }; timers.push(t); return t; }, clearTimeout: t => { if (t) t.on = false; },
    document: { addEventListener() {}, getElementById: id => ctl[id] || { innerHTML: '', classList: { toggle() {} } }, querySelector: s => s.includes('"cnt"') ? ctl.cnt : s.includes('"loop"') ? ctl.loop : null, querySelectorAll: () => [] } });
vm.runInContext(`var song = { meter: '4/4' }, strumPatSel = 'Sekali per birama', STRUM_PATS = { 'Sekali per birama': ['D','.','.','.','.','.','.','.'] }, getCapo = () => 0, tKey = k => k, saveSettings = () => {},
    pcToast = m => __toasts.push(m), clickSound = () => { __clicks.n++; }, playChordFingering = k => __plays.push(k.join()), currentDetectedChordObj = null, activeVariantIndex = 0;`, Object.assign(ctx, { __toasts: toasts, __clicks: { n: 0 }, __plays: plays }));
['config.js', 'chords-db.js', 'progression.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx));
const run = e => vm.runInContext(e, ctx);
// jalankan jam palsu sampai waktu T (ms)
const advance = T => { for (;;) { const nx = timers.filter(t => t.on).sort((a, b) => a.at - b.at)[0]; if (!nx || nx.at > T) break; nx.on = false; now = nx.at; nx.fn(); } now = T; };
const reset = () => { timers.forEach(t => t.on = false); timers = []; now = 0; plays.length = 0; ctx.__clicks.n = 0; };
const list = [{ key: 'C', v: 0 }, { key: 'G', v: 0 }];
const bar = 4 * 500, countIn = 4 * 500;   // 120 BPM: 500 ms per ketuk

reset(); ctl.loop.checked = false; run(`playList(${JSON.stringify(list)}, '#x .badge')`);
advance(countIn + 2 * bar + 100);
ok(plays.length === 2 && run('progTimers.length') === 0, 'tanpa loop: dua akor dimainkan sekali, lalu berhenti sendiri');

reset(); ctl.loop.checked = true; run(`playList(${JSON.stringify(list)}, '#x .badge')`);
advance(countIn + 2 * bar + 100);
ok(plays.length >= 3 && run('progTimers.length') > 0, 'loop aktif: putaran kedua dimulai otomatis setelah akor terakhir');
const c1 = ctx.__clicks.n; advance(countIn + 6 * bar);
ok(plays.length >= 6, 'loop aktif: terus berulang (≥ 3 putaran dalam ' + (countIn / 1000 + 6 * bar / 1000) + ' dtk, akor yang dimainkan: ' + plays.length + ')');
// hitung mundur hanya sekali: jumlah klik per putaran (metronom 8 ketuk) tidak mencakup 4 ketuk hitung mundur lagi
reset(); ctl.loop.checked = true; run(`playList(${JSON.stringify(list)}, '#x .badge')`); advance(countIn + 2 * bar - 1); const first = ctx.__clicks.n;
advance(countIn + 4 * bar - 1); const second = ctx.__clicks.n - first;
ok(first === 4 + 8 && second === 8, `hitung mundur hanya di putaran pertama (klik putaran 1 = ${first}, putaran 2 = ${second})`);
// mematikan loop di tengah: berhenti di akhir putaran
ctl.loop.checked = false; advance(countIn + 4 * bar + 100);
ok(run('progTimers.length') === 0 && plays.length === 4, 'loop dimatikan saat memutar: putaran berjalan selesai lalu berhenti');
// Stop menghentikan loop seketika dan tidak menyala lagi
reset(); ctl.loop.checked = true; run(`playList(${JSON.stringify(list)}, '#x .badge')`); advance(countIn + 2 * bar + 700); run('stopProgression()'); const n = plays.length; advance(60000);
ok(plays.length === n && run('progTimers.length') === 0, 'Stop menghentikan loop dan tidak ada timer tersisa');
// akor tunggal tetap berulang
reset(); ctl.loop.checked = true; run(`playList([{ key: 'Am', v: 0 }], '#x .badge')`); advance(countIn + 5 * bar); ok(plays.length >= 4, 'satu akor pun berulang saat loop aktif'); run('stopProgression()');
console.log(fails ? `\n${fails} tes gagal` : '\nSemua tes pemutar lulus'); process.exit(fails ? 1 : 0);
