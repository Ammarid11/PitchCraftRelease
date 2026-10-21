/* Pitchcraft — Pemutar suara: senar Karplus-Strong + filter bodi gitar (ikut tuning, capo, kalibrasi A) dan klik metronom. */

function playCurrentChordAudio() {
    if (!currentDetectedChordObj) return;
    playChordFingering(currentDetectedChordObj.variants[activeVariantIndex].fingering);
}

function audioCtx() { window._pc = window._pc || new (window.AudioContext || window.webkitAudioContext)(); if (window._pc.state === 'suspended') window._pc.resume(); return window._pc; }

// Bodi gitar tiruan: penguat resonansi bodi (~100 & ~210 Hz, plus "badan" di 1,2 kHz), redam desis tinggi, lalu kompresor agar tidak pecah.
// Resonansi 210 Hz & 1,2 kHz membuat senar bass tetap terdengar di speaker HP yang lemah di bawah 150 Hz.
function guitarOut(ctx) {
    if (ctx._go) return ctx._go;
    const mk = (type, f, q, gain) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; if (gain !== undefined) n.gain.value = gain; return n; };
    const a = mk('peaking', 100, 1.1, 4), b = mk('peaking', 210, 1.3, 5), c = mk('peaking', 1200, 0.8, 2.5), lp = mk('lowpass', 4800, 0.7);
    const comp = ctx.createDynamicsCompressor();
    a.connect(b); b.connect(c); c.connect(lp); lp.connect(comp); comp.connect(ctx.destination);
    return (ctx._go = a);
}

// Karplus-Strong: derau pendek diputar di delay-line dengan filter rata-rata -> bunyi senar petik.
// Panjang delay dibulatkan, jadi nada dikoreksi lewat playbackRate agar tepat.
const ksCache = new Map(), KS_MAX = 64;   // LRU: tiap buffer ~0,5 MB; tanpa batas, tiap nada unik (tuning, capo, kalibrasi) menambah memori selamanya
function ksBuffer(ctx, L) {
    const key = ctx.sampleRate + ':' + L;
    if (ksCache.has(key)) { const b = ksCache.get(key); ksCache.delete(key); ksCache.set(key, b); return b; }
    const N = Math.floor(ctx.sampleRate * 2.6), buf = ctx.createBuffer(1, N, ctx.sampleRate), d = buf.getChannelData(0), line = new Float32Array(L);
    let prev = 0;
    for (let i = 0; i < L; i++) { prev = 0.55 * (Math.random() * 2 - 1) + 0.45 * prev; line[i] = prev; }   // derau dilembutkan = petikan jari
    const pp = Math.max(1, Math.floor(L * 0.14));                                                          // posisi petikan: mematikan harmonik tertentu, timbre lebih alami
    for (let i = L - 1; i >= pp; i--) line[i] -= 0.9 * line[i - pp];
    let p = 0, lp = 0;
    for (let n = 0; n < N; n++) {
        const q = (p + 1) % L, v = 0.5 * (line[p] + line[q]) * 0.9988;
        lp += 0.9 * (v - lp);                                   // redam harmonik tinggi sedikit lebih cepat (senar nyata)
        d[n] = line[p]; line[p] = lp; p = q;
    }
    ksCache.set(key, buf); if (ksCache.size > KS_MAX) ksCache.delete(ksCache.keys().next().value);
    return buf;
}

function pluckNote(ctx, freq, t0, vol, dur, dest) {   // dest (opsional) = simpul tujuan, mis. bus yang bisa dipudarkan
    const L = Math.max(2, Math.round(ctx.sampleRate / freq - 0.5));
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = ksBuffer(ctx, L);
    src.playbackRate.value = freq / (ctx.sampleRate / (L + 0.5));
    g.gain.setValueAtTime(0.22 * vol, t0);
    g.gain.linearRampToValueAtTime(0, t0 + dur);
    src.connect(g); g.connect(dest || guitarOut(ctx));
    src.start(t0); src.stop(t0 + dur + 0.05);
}

// fingeringArray = bentuk jari standar dari kamus; disesuaikan ke tuning aktif, nada naik sebesar capo
function playChordFingering(fingeringArray, dir = 1, vol = 1) {
    const ctx = audioCtx(), ti = tuningInfo(), capo = getCapo(), now = ctx.currentTime;
    adaptFingering(fingeringArray).forEach((fret, s) => {
        if (fret < 0) return;
        pluckNote(ctx, mf(ti.t[s] + capo + fret), now + (dir > 0 ? s : 5 - s) * 0.035, vol, 1.9);
    });
}

function clickSound(accent) {
    const ctx = audioCtx(), t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = accent ? 1500 : 1000; o.type = 'square';
    g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.06);
}
