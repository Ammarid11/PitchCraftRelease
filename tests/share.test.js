/* Pitchcraft — tes asap kartu bagikan dengan canvas palsu (tidak menilai tampilan, hanya memastikan tidak error & teks terbentuk).
 * Jalankan:  node tests/share.test.js */
const fs = require('fs'), path = require('path'), vm = require('vm');
let fails = 0; const ok = (c, m) => { console.log((c ? 'LULUS  ' : 'GAGAL  ') + m); if (!c) fails++; };
const drawn = [];
const c2d = new Proxy({}, { get: (t, k) => k === 'measureText' ? s => ({ width: String(s).length * 22 }) : k === 'fillText' ? s => drawn.push(String(s)) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : (() => {}), set: () => true });
const els = { bpm: { value: '90' }, kpSum: { textContent: 'Kunci C · Capo 2' } };
const ctx = vm.createContext({ console, Math, Date, Promise, Array, String, Number, setTimeout,
    document: { createElement: () => ({ width: 0, height: 0, getContext: () => c2d }), getElementById: id => els[id] || null, addEventListener() {} },
    location: { protocol: 'https:', hostname: 'contoh.id', host: 'contoh.id' },
    progression: [], song: { meter: '4/4' }, strumPatSel: 'Pop (↓ ↓↑ ↑↓↑)', getCapo: () => 2, tKey: (k, d) => k + '+' + d,
    MODE_LABEL: { level: 'Kuis tingkat' }, BADGES: new Array(9), daysOf: () => ({}), calcStreak: () => 4, getSessions: () => [], lsGet: (k, d) => ['first', 'st3'],
    loadHist: () => [], pcToast() {}, URL: {}, File: function () {} });
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'share.js'), 'utf8'), ctx);
const run = e => vm.runInContext(e, ctx);

ok(run('scProgression()').err && run('scScore()').err, 'tanpa data: pesan kesalahan, bukan crash');
run("progression = Array.from({length: 14}, (_, i) => ({ key: i % 2 ? 'Am' : 'F#m7', v: 0 }))");
drawn.length = 0; const p = run('scProgression()');
ok(p.cv && p.name === 'pitchcraft-progresi.png', 'kartu progresi terbentuk');
ok(drawn.includes('+2 akor lagi'), 'progresi >12 akor: sisa dilaporkan');
ok(drawn.some(t => t === 'bunyi F#m7+2'), 'capo: bunyi ditampilkan');
ok(/^\| F#m7 \| Am/.test(p.text) && p.text.includes('BPM 90'), 'teks bagikan benar');
run("loadHist = () => [{ t: 1760000000000, mode: 'level', level: 'dasar', dur: 60, ok: 20, bad: 2, cpm: 10 }, { t: 1760100000000, mode: 'level', level: 'dasar', dur: 60, ok: 24, bad: 2, cpm: 12 }]");
drawn.length = 0; const s = run('scScore()');
ok(s.cv && s.text.includes('12 akor/menit') && s.text.includes('24 dari 26'), 'kartu skor terbentuk, teks benar');
ok(drawn.includes('92%') && drawn.includes('2/9') && drawn.some(t => t.includes('Rekor')), 'akurasi, lencana, dan rekor tampil');
console.log(fails ? `\n${fails} tes gagal` : '\nSemua tes kartu bagikan lulus'); process.exit(fails ? 1 : 0);
