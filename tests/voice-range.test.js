/* Pitchcraft — tes Cari Kunci Suaramu (js/voice-range.js): pelacak nada suara, penangkap nada tahan, saran kunci/capo. Jalankan: node tests/voice-range.test.js */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
let fails = 0; const ok = (c, m) => { console.log((c ? 'LULUS  ' : 'GAGAL  ') + m); if (!c) fails++; };
const ctx = vm.createContext({ console, Math, Set, Object, Array, Number, String, JSON, isNaN, parseInt, setTimeout, Float32Array, performance: { now: () => 0 },
    document: { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [] }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, navigator: {}, window: {} });
vm.runInContext(`var isListening = false, isStrum = false; var toggleListening = async () => {}, toggleStrum = async () => {}, showTab = () => {}, stopStrum = () => {}, keepAwake = () => {}, allowSleep = () => {};
    var mname = m => noteStrings[m % 12] + (Math.floor(m / 12) - 1); var esc = s => String(s); var pcToast = () => {};`, ctx);
['config.js', 'chords-db.js', 'key-capo.js', 'voice-range.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), ctx, { filename: f }));
const run = e => vm.runInContext(e, ctx);
ctx.__yin = run('vcYin');
const hz = m => 440 * Math.pow(2, (m - 69) / 12);

// --- pelacak nada suara ---
let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };
function voice(f0, sr, harm, noise) {   // sinyal mirip suara: deret harmonik + derau
    const N = 8192, b = new Float32Array(N);
    for (let i = 0; i < N; i++) { let v = 0; for (let h = 1; h <= harm.length; h++) v += harm[h - 1] * Math.sin(2 * Math.PI * f0 * h * i / sr + h); b[i] = 0.2 * v + (noise || 0) * rnd(); }
    return b;
}
const cents = (a, b) => 1200 * Math.log2(a / b);
const H = [1, .6, .4, .25, .15, .1];
let bad = [];
[[48000, 82.4], [48000, 110], [48000, 146.8], [48000, 196], [48000, 261.6], [48000, 349.2], [48000, 440], [48000, 587.3], [48000, 784], [48000, 988], [44100, 130.8], [44100, 523.3], [44100, 880]].forEach(([sr, f]) => {
    const r = ctx.__yin(voice(f, sr, H, 0.01), sr);
    if (!(r.f > 0) || Math.abs(cents(r.f, f)) > 15) bad.push(`${f}Hz@${sr} -> ${r.f > 0 ? r.f.toFixed(1) : 'tidak terbaca'}`);
});
ok(bad.length === 0, 'nada 82–988 Hz terbaca benar (<15 cent), tanpa salah oktaf' + (bad.length ? ': ' + bad.join(', ') : ''));
const hi = ctx.__yin(voice(1000, 48000, [1, .5, .3], 0.01), 48000); ok(hi.f > 0 && Math.abs(cents(hi.f, 1000)) < 15, 'nada soprano ~1000 Hz (di atas batas detectPitch 700 Hz) terbaca');
const g2 = ctx.__yin(voice(110, 48000, [.7, 1, .6, .3], 0.01), 48000); ok(g2.f > 0 && Math.abs(cents(g2.f, 110)) < 15, 'harmonik ke-2 lebih kuat dari dasar: tetap terbaca pada nada dasar (110 Hz)');
const nz = new Float32Array(8192); for (let i = 0; i < nz.length; i++) nz[i] = 0.1 * rnd() * 2;
ok(!(ctx.__yin(nz, 48000).f > 0) || ctx.__yin(nz, 48000).clar > 0.25, 'derau acak tidak dianggap nada');
ok(!(ctx.__yin(new Float32Array(8192), 48000).f > 0), 'hening tidak dianggap nada');

// --- penangkap nada tahan ---
const reset = () => run('vcLo = vcHi = vcNow = null; vcHist = []; vcRunP = null; vcRunT = 0; vcGap = 0; vcNoise = 0');
const hold = (m, frames, rms) => { for (let i = 0; i < frames; i++) run(`vcFeed(${hz(m)}, ${rms || 0.05}, 0.1, 0.033)`); };
reset(); hold(52, 30);
ok(run('vcLo') === 52 && run('vcHi') === 52, 'nada ditahan >0,4 dtk tercatat (E3)');
hold(67, 30);
ok(run('vcHi') === 67 && run('vcLo') === 52, 'nada tinggi ditahan memperbarui rentang (G4)');
run('vcFeed(' + hz(76) + ', 0.05, 0.1, 0.033)');
ok(run('vcHi') === 67, 'satu frame sekilas diabaikan');
for (let i = 0; i < 40; i++) run(`vcFeed(${hz(55 + i * 0.4)}, 0.05, 0.1, 0.033)`);
ok(run('vcHi') === 67 && run('vcLo') === 52, 'nada meluncur cepat tidak dicatat');
hold(40, 30, 0.003); ok(run('vcLo') === 52, 'terlalu pelan diabaikan');
for (let i = 0; i < 30; i++) run(`vcFeed(${hz(40)}, 0.05, 0.5, 0.033)`);
ok(run('vcLo') === 52, 'nada tidak jernih diabaikan');
run('vcNoise = 0.02'); hold(45, 30, 0.015); ok(run('vcLo') === 52, 'di bawah 2,5x derau ruangan diabaikan');
run('vcNoise = 0'); hold(60, 8); for (let i = 0; i < 2; i++) run(`vcFeed(-1, 0.05, 1, 0.033)`); hold(60, 12);
ok(run('vcRunT') > 0.4, 'jeda napas singkat (66 ms) tidak memutus nada tahan');
reset(); for (let i = 0; i < 40; i++) run(`vcFeed(${hz(60 + 0.45 * Math.sin(i / 2.5))}, 0.05, 0.1, 0.033)`);
ok(run('vcLo') === 60, 'getaran suara (vibrato ±45 cent) tetap tercatat sebagai satu nada');
reset(); for (let i = 0; i < 40; i++) run(`vcFeed(${hz(60.45)}, 0.05, 0.1, 0.033)`);
ok(run('vcLo') !== null, 'nada di perbatasan dua semiton tetap tercatat');
reset(); run('vcLo = 50; vcHi = 62'); run("vcAdj('lo', 12)"); ok(run('vcLo') === 61 && run('vcHi') === 62, 'koreksi manual tidak membuat terendah >= tertinggi');

// --- saran kunci ---
const cs = run('vcSuggest(40, 64, 12, "maj")');
ok(cs.length === 12 && new Set(cs.map(c => c.pc)).size === 12, 'ada 12 kunci diurutkan');
ok(cs.every((c, i) => i === 0 || cs[i - 1].over < c.over || (cs[i - 1].over === c.over && cs[i - 1].dist <= c.dist)), 'urutan menurut over lalu jarak ke tengah');
ok(cs.filter(c => c.over === 0).every(c => c.m - 3 >= 40 && c.m - 3 + 12 <= 64), 'kunci "pas" memuat seluruh jendela melodi di dalam rentang');
ok(run('vcSuggest(50, 57, 12, "maj")')[0].over === 5, 'rentang 7 nada vs melodi 12: 5 nada lewat (minimum)');
ok(run('vcSuggest(40, 64, 9, "maj")').filter(c => c.over === 0).length >= run('vcSuggest(40, 64, 15, "maj")').filter(c => c.over === 0).length, 'melodi lebih sempit memberi lebih banyak kunci pas');
const sp = run('vcShiftPick(vcSuggest(40, 64, 12, "maj"), 0)');
ok(sp.c.over === 0 && sp.shift >= -6 && sp.shift <= 5 && ((sp.c.pc - 0 - sp.shift) % 12 + 12) % 12 === 0, 'kunci asli C: geseran terkecil yang pas, bernilai -6..+5');
ok(run('vcShiftPick(vcSuggest(40, 64, 12, "maj"), 0)').shift === (() => { let b = 99; cs.filter(c => c.over === 0).forEach(c => { const s = ((c.pc + 18) % 12) - 6; if (Math.abs(s) < Math.abs(b)) b = s; }); return b; })(), 'geseran terkecil memang yang terkecil di antara kunci pas');
const c0 = run('vcCapo(0, "maj")'); ok(c0.capo === 0 && c0.shapes.join() === 'C,Dm,Em,F,G,Am,Bdim', 'C mayor: tanpa capo, bentuk benar');
const cb = run('vcCapo(10, "maj")'); ok(cb.capo > 0, 'A# mayor: capo membuat bentuk lebih mudah');
console.log(fails ? `\n${fails} tes gagal` : '\nSemua tes Cari Kunci Suaramu lulus'); process.exit(fails ? 1 : 0);
