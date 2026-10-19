/* Pitchcraft — Pendeteksi pitch (YIN) untuk mode petik satu senar. */

function noteFromPitch(frequency) {
    const noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
    return Math.round(noteNum) + 69;
}

function getMedian(arr) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function detectPitch(buffer, sampleRate) {
    // YIN: jendela terbatas (hanya periode yang relevan untuk gitar) -> ~12x lebih ringan dari versi lama
    const W = 2560;
    const maxTau = Math.min(Math.floor(sampleRate / CONFIG.MIN_FREQ) + 2, buffer.length - W - 2);
    const minTau = Math.max(2, Math.floor(sampleRate / CONFIG.MAX_FREQ));
    const off = buffer.length - W - maxTau - 1;      // pakai sampel terbaru
    if (off < 0) return -1;

    let rms = 0;
    for (let i = off; i < buffer.length; i++) rms += buffer[i] * buffer[i];
    rms = Math.sqrt(rms / (buffer.length - off));
    lastRms = rms; lastClarity = 1;
    if (rms < 0.0015) return -1;

    const y = new Float32Array(maxTau + 1);
    for (let tau = 1; tau <= maxTau; tau++) {
        let sum = 0;
        for (let i = 0; i < W; i++) {
            const d = buffer[off + i] - buffer[off + i + tau];
            sum += d * d;
        }
        y[tau] = sum;
    }
    y[0] = 1;
    let run = 0;
    for (let tau = 1; tau <= maxTau; tau++) {
        run += y[tau];
        y[tau] = y[tau] * tau / (run || 1);
    }

    const THR = 0.15;
    let tauFound = -1;
    for (let tau = minTau; tau < maxTau; tau++) {
        if (y[tau] < THR) {
            while (tau + 1 < maxTau && y[tau + 1] < y[tau]) tau++;
            tauFound = tau;
            break;
        }
    }
    if (tauFound === -1) {
        let minVal = Infinity, minTauIdx = -1;
        for (let tau = minTau; tau < maxTau; tau++) if (y[tau] < minVal) { minVal = y[tau]; minTauIdx = tau; }
        if (minVal < 0.25) tauFound = minTauIdx; else return -1;
    }

    // koreksi sub-oktaf: bila periode yang ditemukan kelipatan (2x-4x) dari periode sebenarnya, ambil periode terpendek yang juga periodik
    for (let k = 4; k >= 2; k--) {
        const t0 = Math.round(tauFound / k);
        if (t0 < minTau) continue;
        let bi = t0, bv = y[t0];
        for (let d = -2; d <= 2; d++) { const tt = t0 + d; if (tt >= minTau && tt < maxTau && y[tt] < bv) { bv = y[tt]; bi = tt; } }
        if (bv < Math.max(0.2, y[tauFound] * 2 + 0.03)) { tauFound = bi; break; }   // E4 sering terbaca A2 (periode 3x): ambil periode terpendek yang masih periodik
    }
    lastClarity = y[tauFound];   // makin kecil = makin periodik (senar gitar sangat periodik; suara & noise tidak)

    // koreksi oktaf: jika setengah periode juga nyaris sama bagusnya, itu nada dasarnya yang sebenarnya (frekuensi lebih tinggi)
    // (dibiarkan: YIN mengambil lembah pertama sehingga jarang salah oktaf)

    // interpolasi parabola -> presisi sub-sampel (penting untuk senar tinggi)
    let better = tauFound;
    if (tauFound > 1 && tauFound < maxTau) {
        const a = y[tauFound - 1], b = y[tauFound], c = y[tauFound + 1], den = a - 2 * b + c;
        if (den !== 0) better = tauFound + 0.5 * (a - c) / den;
    }
    const frequency = sampleRate / better;
    if (frequency < CONFIG.MIN_FREQ || frequency > CONFIG.MAX_FREQ) return -1;
    return frequency;
}
