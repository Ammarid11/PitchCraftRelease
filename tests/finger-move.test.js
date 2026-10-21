/* Pitchcraft — tes rencana perpindahan jari dan SVG animasi (js/finger-move.js). Jalankan: node tests/finger-move.test.js */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
let fails = 0; const ok = (c, m) => { console.log((c ? 'LULUS  ' : 'GAGAL  ') + m); if (!c) fails++; };
const ctx = vm.createContext({ console, Math, Set, Object, Array, Number, String, JSON, isNaN, parseInt, setTimeout, setInterval, clearInterval,
    document: { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [], querySelector: () => null, body: { classList: { contains: () => false } } },
    localStorage: { getItem: () => null, setItem() {} }, navigator: {}, window: {} });
vm.runInContext(`var adaptFingering = f => f.slice(); var tuningInfo = () => ({ t: [40, 45, 50, 55, 59, 64] }); var refreshChordViews = () => {}; var progression = []; const esc = s => String(s);`, ctx);
['config.js', 'chords-db.js', 'chords-ui.js', 'finger-move.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), ctx, { filename: f }));
const run = e => vm.runInContext(e, ctx);
const plan = (a, b) => run(`mvPlan(mvDots('${a}',0), mvDots('${b}',0))`);
const n = p => [p.stay.length, p.move.length, p.out.length, p.inn.length].join(',');

ok(n(plan('Am', 'C')) === '2,1,0,0', 'Am -> C: jari 1 dan 2 tetap, jari 3 berpindah (hasil: ' + n(plan('Am', 'C')) + ')');
ok(n(plan('E', 'C')) === '0,3,0,0', 'E -> C: tidak ada jari tetap; posisi D fret 2 sama tetapi jarinya berganti (hasil: ' + n(plan('E', 'C')) + ')');
ok(run("mvPlan(mvDots('E',0), mvDots('C',0)).move.every(m => m.a.n === m.b.n)"), 'E -> C: tiap jari berpindah dipasangkan dengan nomor jari yang sama');
ok(run("mvPlan(mvDots('E',0), mvDots('C',0)).stay.every(d => d.an === d.bn)") && run("['G','Am','F','Bm','A7','D','Em'].every(a => ['C','G','Am','E','D'].every(b => mvPlan(mvDots(a,0), mvDots(b,0)).stay.every(d => d.an === d.bn)))"), 'jari "tetap" selalu bernomor jari sama di kedua akor');
ok(n(plan('C', 'C')) === '3,0,0,0', 'akor sama: semua jari tetap');
const p = plan('G', 'C'); ok(p.stay.length + p.move.length + p.out.length === run("mvDots('G',0).f.filter(v=>v>0).length"), 'G -> C: jari asal habis terbagi');

// kekekalan: tiap jari A = tetap + berpindah + diangkat; tiap jari B = tetap + berpindah + diletakkan, untuk semua pasangan akor umum
const ks = ['C', 'G', 'Am', 'Em', 'D', 'F', 'Bm', 'A7', 'E', 'Dm', 'F#m', 'Cmaj7', 'B7', 'A#'];
let bad = 0;
ks.forEach(a => ks.forEach(b => {
    const cnt = k => run(`mvDots('${k}',0).f.filter(v=>v>0).length`), P = plan(a, b);
    if (P.stay.length + P.move.length + P.out.length !== cnt(a) || P.stay.length + P.move.length + P.inn.length !== cnt(b)) bad++;
}));
ok(bad === 0, 'kekekalan jari benar untuk ' + ks.length * ks.length + ' pasangan akor');

const svg = run("(()=>{ const A=mvDots('Am',0), B=mvDots('C',0); return mvSvg(A,B,mvPlan(A,B)); })()");
ok(svg.startsWith('<svg') && (svg.match(/class="mv-move"/g) || []).length === 1, 'SVG memuat 1 jari berpindah');
ok(/--ax:[\d.]+px/.test(svg) && /--by:[\d.]+px/.test(svg), 'posisi awal/akhir tertulis sebagai variabel CSS');
ok(run("mvInfoHTML(mvDots('C',0), mvDots('C',0), mvPlan(mvDots('C',0), mvDots('C',0)))").includes('sama'), 'akor sama diberi pesan khusus');
// mode kidal tidak merusak
ok(run("(()=>{ document.body.classList.contains = () => true; const A=mvDots('F',0), B=mvDots('Bm',0); return mvSvg(A,B,mvPlan(A,B)).length > 200; })()"), 'barre + mode kidal menghasilkan SVG');
console.log(fails ? `\n${fails} tes gagal` : '\nSemua tes animasi jari lulus'); process.exit(fails ? 1 : 0);
