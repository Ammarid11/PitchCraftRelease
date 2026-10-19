/* Pitchcraft — tes deteksi akor Mode Strum dengan sinyal sintetis.
 * Jalankan:  node tests/chord-detection.test.js
 * Memuat kode asli aplikasi (js/*.js) di sandbox, mensintesis genjrengan, lalu memeriksa hasil rankByChroma.
 * Keluar dengan kode 1 jika akurasi di bawah ambang (SKENARIO.min) sehingga bisa dipakai sebagai pagar pengaman. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');

// ---------- muat kode aplikasi ----------
const ctx = vm.createContext({ console, Math, Float32Array, Array, Set, Object, JSON, Number, isNaN, parseInt,
    document: { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [] },
    localStorage: { getItem: () => null, setItem() {} }, navigator: {}, window: {} });
['config.js', 'chords-db.js', 'strum-analysis.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), ctx, { filename: f }));
const get = expr => vm.runInContext(expr, ctx);
const chordDatabase = get('chordDatabase'), openF = get('openStringFrequencies'), rankByChroma = get('rankByChroma'), computeChroma = get('computeChroma');
const setAlgo = a => vm.runInContext(`strumAlgo = '${a}'`, ctx);
const confidenceOf = vm.runInContext('typeof confidenceOf === "function" ? confidenceOf : null', ctx);

// ---------- sintesis sinyal ----------
const SR = 48000, N = 16384;
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
    for (let len = 2; len <= n; len <<= 1) {
        const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
        for (let i = 0; i < n; i += len) {
            let cr = 1, ci = 0;
            for (let k = 0; k < len / 2; k++) {
                const u = i + k, v = i + k + len / 2, tr = re[v] * cr - im[v] * ci, ti = re[v] * ci + im[v] * cr;
                re[v] = re[u] - tr; im[v] = im[u] - ti; re[u] += tr; im[u] += ti;
                [cr, ci] = [cr * wr - ci * wi, cr * wi + ci * wr];
            }
        }
    }
}
// strum: fingering (6 angka, -1 = mati), gain per senar, derau relatif -> spektrum dB seperti AnalyserNode.getFloatFrequencyData
function spectrum(fing, gains, noise, rand) {
    const x = new Float32Array(N);
    fing.forEach((fret, s) => {
        if (fret < 0) return;
        const f0 = openF[s] * Math.pow(2, fret / 12), amp = gains[s] * (0.8 + 0.4 * rand()), ph = rand() * 6.28;
        for (let h = 1; h <= 8; h++) {
            const f = f0 * h * (1 + 0.0002 * h * h); if (f > 4000) break;
            const a = amp / Math.pow(h, 1.15), p = ph + h;
            for (let i = 0; i < N; i++) x[i] += a * Math.sin(2 * Math.PI * f * i / SR + p);
        }
    });
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < N; i++) {
        const w = 0.42 - 0.5 * Math.cos(2 * Math.PI * i / N) + 0.08 * Math.cos(4 * Math.PI * i / N);
        re[i] = (x[i] + noise * (rand() + rand() + rand() - 1.5)) * w;
    }
    fft(re, im);
    const fd = new Float32Array(N / 2);
    for (let k = 0; k < N / 2; k++) {
        let m = Math.hypot(re[k], im[k]) / N; if (k * SR / N < 70) m *= 0.05;   // high-pass 70 Hz seperti di aplikasi
        fd[k] = 20 * Math.log10(Math.max(m, 1e-10));
    }
    return fd;
}
function detect(fd) {
    const { chroma, bass, maxMag } = computeChroma(fd, SR, N);
    const mx = Math.max(...chroma); if (!(mx > 0)) return [];
    const sum = Array.from(chroma, v => 3 * v / mx);                       // 3 frame identik, seperti jendela analisis aplikasi
    const bassPc = (bass.pc !== undefined && bass.m >= 0.3 * maxMag) ? bass.pc : -1;
    return rankByChroma(sum, bassPc);
}

// ---------- skenario ----------
const SKENARIO = [
    { nama: 'normal',          gains: [1, .95, .9, .85, .8, .75], noise: 0.002, min: 0.85, kual: ['', 'm', '7', 'm7', 'maj7', 'sus4'] },
    { nama: 'senar tipis lemah', gains: [1, .95, .9, .85, .3, .25], noise: 0.002, min: 0.65, kual: ['', 'm', '7', 'm7'] },
    { nama: 'ruangan bising',  gains: [1, .95, .9, .85, .8, .75], noise: 0.02,  min: 0.65, kual: ['', 'm', '7', 'm7'] },
    // Batasan yang disengaja (informasi saja, tidak menggagalkan): power chord & sus2 sengaja kalah dari mayor/add9 saat terts samar
    { nama: 'batasan diketahui (5, sus2)', gains: [1, .95, .9, .85, .8, .75], noise: 0.002, min: 0, info: true, kual: ['5', 'sus2'] }
];
const notesOf = key => chordDatabase[key].notes.slice().sort().join(',');
const pad = (s, n) => String(s).padEnd(n);
let gagalTotal = 0; const stat = { benar: [], salah: [] };
const algos = process.argv.includes('--harmonik') ? ['harmonik'] : ['klasik'];
algos.forEach(algo => {
    setAlgo(algo); console.log(`\n=== Algoritma: ${algo} ===`);
    SKENARIO.forEach((sk, si) => {
        const rand = rng(1234 + si); let ok = 0, top3 = 0, n = 0; const salah = [];
        for (const root of get('noteStrings')) for (const q of sk.kual) {
            const key = root + q, ch = chordDatabase[key]; if (!ch) continue;
            const fd = spectrum(ch.variants[0].fingering, sk.gains, sk.noise, rand), ranked = detect(fd);
            if (!ranked.length) { n++; salah.push(`${key} → (kosong)`); continue; }
            n++;
            const benar = notesOf(ranked[0].key) === notesOf(key);        // akor ber-nada sama (Am7 = C6) dianggap benar
            if (ranked.slice(0, 3).some(r => notesOf(r.key) === notesOf(key))) top3++;
            const margin = ranked.length > 1 ? ranked[0].score - ranked[1].score : 1;
            (benar ? stat.benar : stat.salah).push(margin);
            if (benar) ok++; else salah.push(`${key} → ${ranked[0].key}`);
        }
        const acc = ok / n, lulus = acc >= sk.min; if (!lulus) gagalTotal++;
        if (sk.info) { console.log(`INFO   ${pad(sk.nama, 20)} top-1 ${(acc * 100).toFixed(0)}%  top-3 ${(top3 / n * 100).toFixed(0)}%  [${ok}/${n}]`); return; }
        console.log(`${lulus ? 'LULUS' : 'GAGAL'}  ${pad(sk.nama, 20)} top-1 ${(acc * 100).toFixed(0)}%  top-3 ${(top3 / n * 100).toFixed(0)}%  (min ${sk.min * 100}%)  [${ok}/${n}]`);
        if (salah.length) console.log('       salah: ' + salah.join(', '));
    });
});
const avg = a => a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(3) : '-';
const q = (a, p) => a.length ? a.slice().sort((x, y) => x - y)[Math.floor(p * (a.length - 1))].toFixed(3) : '-';
console.log(`\nSelisih skor (margin) hasil teratas vs kedua:\n  benar: rata-rata ${avg(stat.benar)}, persentil 10% ${q(stat.benar, .1)}, 25% ${q(stat.benar, .25)}\n  salah: rata-rata ${avg(stat.salah)}, persentil 75% ${q(stat.salah, .75)}, 90% ${q(stat.salah, .9)}`);
if (confidenceOf) {
    const lvl = {}; [...stat.benar.map(m => ['benar', m]), ...stat.salah.map(m => ['salah', m])].forEach(([t, m]) => { const l = confidenceOf(m); lvl[l] = lvl[l] || { benar: 0, salah: 0 }; lvl[l][t]++; });
    console.log('Tingkat keyakinan:', JSON.stringify(lvl));
}
process.exit(gagalTotal ? 1 : 0);
