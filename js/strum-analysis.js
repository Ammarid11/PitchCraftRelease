/* Pitchcraft — Analisis genjrengan: chroma (klasik & harmonik), pencocokan template akor, pembelajaran pola. */

let strumAlgo = 'klasik', exemplars = {}, lastObs = null, learnable = false;

function computeChroma(fd, sr, n) { return (strumAlgo === 'klasik' ? computeChromaClassic : computeChromaH)(fd, sr, n); }

function computeChromaClassic(fd, sampleRate, fftSize) {
    const binHz = sampleRate / fftSize, chroma = new Float32Array(12);
    const kLo = Math.max(1, Math.floor(70 / binHz)), kHi = Math.min(fd.length - 2, Math.ceil(2000 / binHz));
    let maxDb = -Infinity;
    for (let k = kLo; k <= kHi; k++) if (fd[k] > maxDb) maxDb = fd[k];
    const floor = maxDb - 30, bass = { m: 0 };
    for (let k = kLo; k <= kHi; k++) {
        const b = fd[k];
        if (b < floor || b < fd[k - 1] || b < fd[k + 1]) continue;
        const a = fd[k - 1], c = fd[k + 1], den = a - 2 * b + c;
        const f = (k + (den ? 0.5 * (a - c) / den : 0)) * binHz;
        const mag = Math.pow(10, b / 20);
        const pc = ((Math.round(69 + 12 * Math.log2(f / 440)) % 12) + 12) % 12;
        chroma[pc] += mag;
        if (f < 200 && mag > bass.m) { bass.m = mag; bass.pc = pc; }
    }
    return { chroma, bass, maxMag: Math.pow(10, maxDb / 20) };
}

// Chroma berbasis salience harmonik: tiap kandidat nada dasar dinilai dari harmoniknya (1-6),
// lalu harmoniknya "dibuang" (cancellation) sebelum mencari nada berikutnya. Tuning gitar dikoreksi otomatis.
const HARM_W = [1, .7, .45, .3, .2, .12];

function computeChromaH(fd, sampleRate, fftSize) {
    const binHz = sampleRate / fftSize, K = fd.length;
    let mx = -Infinity;
    for (let k = 1; k < K; k++) if (fd[k] > mx) mx = fd[k];
    const pk = new Float32Array(K);
    for (let k = 1; k < K - 1; k++) {
        const d = fd[k] - mx;
        if (d > -35 && fd[k] >= fd[k - 1] && fd[k] >= fd[k + 1]) pk[k] = Math.pow(10, d / 20);
    }
    // koreksi tuning: rata-rata melingkar selisih tiap puncak terhadap semitone terdekat
    let sx = 0, sy = 0;
    for (let k = Math.floor(80 / binHz); k < Math.min(K - 2, 1000 / binHz); k++) {
        if (!pk[k] || fd[k] < mx - 30) continue;
        const a = fd[k - 1], b = fd[k], c = fd[k + 1], den = a - 2 * b + c;
        const f = (k + (den ? 0.5 * (a - c) / den : 0)) * binHz;
        const m = 69 + 12 * Math.log2(f / 440), d = m - Math.round(m);
        sx += pk[k] * Math.cos(2 * Math.PI * d); sy += pk[k] * Math.sin(2 * Math.PI * d);
    }
    const off = Math.atan2(sy, sx) / (2 * Math.PI);
    const band = f => [Math.max(1, Math.floor(f * 0.9825 / binHz)), Math.min(K - 2, Math.ceil(f * 1.0175 / binHz))];
    const chroma = new Float32Array(12), chosen = [];
    let first = 0;
    for (let it = 0; it < 6; it++) {
        let best = -1, bs = 0;
        for (let m = 40; m <= 79; m++) {
            const f0 = 440 * Math.pow(2, (m - 69 + off) / 12);
            let sal = 0;
            for (let h = 1; h <= 6; h++) {
                const [lo, hi] = band(f0 * h);
                if (lo > K - 2) break;
                let mm = 0;
                for (let k = lo; k <= hi; k++) if (pk[k] > mm) mm = pk[k];
                sal += HARM_W[h - 1] * mm;
            }
            if (sal > bs) { bs = sal; best = m; }
        }
        if (best < 0 || (it > 0 && bs < 0.25 * first)) break;
        if (!it) first = bs;
        chroma[best % 12] += bs; chosen.push(best);
        const f0 = 440 * Math.pow(2, (best - 69 + off) / 12);
        for (let h = 1; h <= 8; h++) {
            const [lo, hi] = band(f0 * h);
            for (let k = lo; k <= Math.min(hi, K - 2); k++) pk[k] *= 0.15;
        }
    }
    const lows = chosen.filter(m => m <= 55);
    return { chroma, bass: lows.length ? { pc: Math.min(...lows) % 12, m: 1 } : { m: 0 }, maxMag: 1 };
}

function pickStrumNotes(ema, bass, maxMag) {
    const mx = Math.max(...ema);
    if (!(mx > 0)) return null;
    let names = [...ema].map((v, pc) => ({ pc, v: v / mx })).filter(o => o.v >= 0.4)
        .sort((a, b) => b.v - a.v).slice(0, 5).map(o => noteStrings[o.pc]);
    const bn = (bass.pc !== undefined && bass.m >= 0.3 * maxMag) ? noteStrings[bass.pc] : '';
    if (bn && names.includes(bn)) names = [bn, ...names.filter(n => n !== bn)];
    return { names, sig: [...names].sort().join(',') + '|' + bn };
}

// Cocokkan chroma ke template akor (cosine similarity) + prior kualitas akor + bonus nada bass
// akor yang nada-nadanya identik dengan akor lain (Am7 = C6) diberi prior agar yang lebih umum menang saat bass tak terdengar
const QUAL_PRIOR = { "6": 0.03, "m6": 0.03, "dim7": 0.02, "sus2": 0.01, "aug": 0.01 };

function cosine(a, b) { let d = 0, na = 0, nb = 0; for (let i = 0; i < 12; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; } return d / (Math.sqrt(na * nb) || 1); }

function saveExemplar(key, obs) {
    const mx = Math.max(...obs), v = obs.map(x => x / mx);
    (exemplars[key] = exemplars[key] || []).push(v);
    if (exemplars[key].length > 6) exemplars[key].shift();
    try { localStorage.setItem('pc_ex', JSON.stringify(exemplars)); } catch (e) { }
}

function rankByChroma(chroma, bassPc) {
    const mx = Math.max(...chroma);
    if (!(mx > 0)) return [];
    const obs = Array.from(chroma, v => v / mx), no = Math.hypot(...obs), res = [];
    for (const key in chordDatabase) {
        const c = chordDatabase[key], t = new Array(12).fill(0);
        const rr = noteStrings.indexOf(c.root), has = d => c.notes.includes(noteStrings[(rr + d) % 12]);
        const minor3 = has(3) && !has(4), major3 = has(4) && !has(3);
        c.notes.forEach(n => {
            const pc = noteStrings.indexOf(n), w = n === c.root ? 1.2 : 1;
            t[pc] += w;
            if (strumAlgo === 'klasik') { t[(pc + 7) % 12] += 0.3 * w; if (!(minor3 && n === c.root)) t[(pc + 4) % 12] += 0.15 * w; }
        });
        const nt = Math.hypot(...t);
        let score = obs.reduce((a, v, i) => a + v * t[i], 0) / (no * nt);
        score -= 0.012 * Math.max(0, c.notes.length - 3);
        if (bassPc >= 0 && noteStrings[bassPc] === c.root) score += strumAlgo === 'klasik' ? 0.04 : 0.08;
        score -= QUAL_PRIOR[key.slice(c.root.length)] || 0;
        // akor yang lebih lengkap menang jika energi terbaca lebih banyak dijelaskan olehnya (Cm7 vs D#5)
        const sumObs = obs.reduce((a, v) => a + v, 0) || 1;
        score += 0.1 * c.notes.reduce((a, n) => a + obs[noteStrings.indexOf(n)], 0) / sumObs;
        if (key.slice(c.root.length) === '5') {   // power chord: hanya valid jika terts benar-benar tidak terdengar
            const r = noteStrings.indexOf(c.root);
            score -= 0.18 + 0.8 * Math.max(obs[(r + 3) % 12], obs[(r + 4) % 12]);   // power chord jarang dimainkan lewat genjrengan penuh; terts sering lemah di mic (cuma 1 senar)
        }
        // penalti nada "asing": nada yang terdengar jelas tapi tidak ada di akor ini
        // (mencegah Cm7 terbaca D# / D#5 hanya karena C lebih lemah dari A#)
        // nada yang jatuh di harmonik ke-3 (+7) dan ke-5 (+4) dari nada akor dimaafkan: itu bocoran harmonik, bukan nada asing
        // (tanpa ini akor 4 nada seperti A#m7 ikut terhukum oleh D#/C/D/A hasil harmonik G#, F, A#)
        const inChord = new Set(c.notes.map(n => noteStrings.indexOf(n)));
        const excused = new Set(inChord);
        inChord.forEach(pc => { excused.add((pc + 7) % 12); excused.add((pc + 4) % 12); });
        let stray = 0;
        obs.forEach((v, i) => { if (!excused.has(i) && v > stray) stray = v; });
        score -= 0.6 * Math.max(0, stray - 0.1);
        // mayor vs minor: terts yang terdengar lebih kuat menentukan; terts lawan tidak boleh "dimaafkan" sebagai harmonik
        const o3 = obs[(rr + 3) % 12], o4 = obs[(rr + 4) % 12];
        if (minor3) score -= 0.7 * Math.max(0, o4 - o3);
        if (major3) score -= 0.7 * Math.max(0, o3 - o4);
        // bonus bukti terts: akor lengkap (ada terts) menang atas versi tanpa terts (D5) saat terts terdengar walau lemah
        if (minor3) score += 0.12 * Math.min(1, o3 / 0.3);
        if (major3) score += 0.12 * Math.min(1, o4 / 0.3);
        const qq = key.slice(c.root.length);
        if (qq === 'sus4' || qq === 'sus2' || qq === '7sus4') {   // sus = tanpa terts; kalau terts terdengar, bukan sus (D mayor vs Dsus4)
            const r0 = noteStrings.indexOf(c.root);
            const third = Math.max(obs[(r0 + 3) % 12], obs[(r0 + 4) % 12]);
            const sv = obs[(r0 + (qq === 'sus2' ? 2 : 5)) % 12];   // nada "gantung" (2 atau 4) harus benar-benar terdengar
            score -= 0.07;                                          // sus jauh lebih jarang daripada mayor/minor: kalah saat bukti tipis
            score -= 0.9 * Math.max(0, third - 0.15);               // terts terdengar -> bukan sus
            score -= 0.4 * Math.max(0, 0.5 - sv);                   // nada gantung lemah -> sus tidak meyakinkan
            if (third >= 0.6 * sv) score -= 0.15;                   // terts hampir sekuat nada gantung -> ambigu, pilih mayor/minor
        }
        if (exemplars[key]) {   // akor ini pernah dikonfirmasi pengguna: bonus jika pola chroma mirip
            const cs = Math.max(...exemplars[key].map(v => cosine(obs, v)));
            score += 0.5 * Math.max(0, cs - 0.7) / 0.3;
        }
        res.push({ key, score });
    }
    return res.sort((a, b) => b.score - a.score);
}

/* ---- Keyakinan hasil: selisih skor akor terpilih dengan pesaing terdekat (ambang dikalibrasi dari tests/) ---- */
const CONF_HIGH = 0.06, CONF_MID = 0.03;
let lastConf = null;

function marginOf(ranked, key) {
    const me = ranked.find(r => r.key === key), other = ranked.find(r => r.key !== key);
    return me && other ? me.score - other.score : 1;
}

function confidenceOf(margin) {
    return margin >= CONF_HIGH ? 'yakin' : margin >= CONF_MID ? 'cukup' : 'ragu';
}

function confBadgeHTML(level) {
    const text = { yakin: 'Keyakinan: tinggi', cukup: 'Keyakinan: sedang', ragu: 'Ragu — cek “Kemungkinan lain”' }[level];
    return `<div class="conf conf-${level}">${text}</div>`;
}
