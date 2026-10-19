/* Pitchcraft — Penyaring suara bukan-gitar: sensitivitas, noise floor, deteksi petikan, kestabilan nada. */

// ===== Penyaring suara bukan-gitar (ucapan, kipas, suara jauh) =====
// Sensitivitas: gate = volume minimum, clar = batas kejernihan periodik (YIN), stab = toleransi goyangan nada (cent)
const SENS = {
    rendah: { gate: 0.010, clar: 0.10, stab: 25, sf: 8, hist: 14, out: 5, list: 12, hyst: 70 },
    normal: { gate: 0.005, clar: 0.15, stab: 40, sf: 6, hist: 10, out: 4, list: 8, hyst: 65 },
    tinggi: { gate: 0.0025, clar: 0.20, stab: 55, sf: 5, hist: 8, out: 3, list: 6, hyst: 60 }
};
let sensLevel = 'normal', lastRms = 0, lastClarity = 1, gateReason = '', stabHist = [], lastGoodT = 0, ringRms = 0, shownMidi = null, candMidi = null, candCnt = 0, outlierRef = 0;
const HOLD_MS = 450;   // tahan tampilan nada selama jeda singkat (suara kecil / senar meredup) agar tidak berkedip

function setSens(v) { if (SENS[v]) { sensLevel = v; resetGate(); try { localStorage.setItem('pc_sens', v); } catch (e) { } } }

let noiseFloor = 0, rmsSlowT = 0, armedT = 0, listenT = 0, noteStartT = 0;

function resetGate() { stabHist = []; gateReason = ''; armedT = 0; }

function gatePitch(f) {
    const S = SENS[sensLevel];
    gateReason = '';
    const now = performance.now(), live = now - lastGoodT < HOLD_MS;
    // ---- pelacak level: dengung ruangan/listrik (50 Hz -> 100 Hz ≈ G2) volumenya datar & tanpa "petikan" ----
    if (now - listenT < 600) { rmsSlowT = lastRms; noiseFloor = lastRms; }   // kalibrasi derau awal
    else {
        if (lastRms > Math.max(S.gate * 1.6, noiseFloor * 2.5, rmsSlowT * 2)) armedT = now;   // lonjakan volume = petikan sungguhan
        rmsSlowT = rmsSlowT * 0.9 + lastRms * 0.1;
        if (!live) {
            if (lastRms < noiseFloor) noiseFloor = noiseFloor * 0.9 + lastRms * 0.1;
            else if (lastRms < noiseFloor * 1.5 + 0.001) noiseFloor = noiseFloor * 0.98 + lastRms * 0.02;
        }
    }
    if (!live && now - armedT > 900) { stabHist = []; return -1; }   // nada baru hanya boleh dimulai setelah ada petikan
    const gate = Math.max(live ? S.gate : S.gate * 1.6, noiseFloor * 3);   // histeresis + selalu di atas derau latar
    if (lastRms < gate) { if (!live) stabHist = []; gateReason = lastRms < 0.0015 ? '' : 'terlalu pelan (' + lastRms.toFixed(3) + ')'; return -1; }
    if (f < 0 || lastClarity > S.clar) { if (!live) stabHist = []; gateReason = 'nada tidak jernih (' + lastClarity.toFixed(2) + ' > ' + S.clar + ')'; return -1; }
    stabHist.push(12 * Math.log2(f / 440));
    if (stabHist.length > S.sf) stabHist.shift();
    if (stabHist.length < S.sf) return -1;
    const spread = (Math.max.apply(null, stabHist) - Math.min.apply(null, stabHist)) * 100;
    if (spread > S.stab) { gateReason = 'nada belum stabil (±' + spread.toFixed(0) + ' cent)'; return -1; }   // suara orang meluncur/bergetar
    return f;
}
