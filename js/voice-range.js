/* Pitchcraft — Cari kunci yang cocok untuk suaramu (roadmap #4).
 * Pengguna bernyanyi; app mencatat nada terendah dan tertinggi yang ditahan, lalu menyarankan kunci + capo.
 * Jalur ini TERPISAH dari deteksi gitar: pitch.js dan gate.js tidak disentuh. Pelacak nada suara (vcYin) milik sendiri,
 * karena detectPitch dibuat untuk gitar (batas 700 Hz dan koreksi sub-oktaf yang bisa salah pada suara).
 * Yang disimpan hanya dua nomor nada (pc_voice), di perangkat ini; audio tidak direkam dan tidak dikirim ke mana pun. */

const VC = { HOLD: 0.4, FRAME_MS: 33, WIN: 5, OUT: 0.8, STEP: 0.7, DRIFT: 1.0, GAP: 0.12, CLAR: 0.25, BELOW: 3, FMIN: 65, FMAX: 1100 };
let vcActive = false, vcCtx = null, vcStream = null, vcAn = null, vcRaf = null, vcBuf = null;
let vcHist = [], vcLast = 0, vcNoise = 0, vcRing = [], vcNow = null, vcLo = null, vcHi = null, vcSong = 12, vcMode = 'maj', vcCands = [], vcShiftC = null;
let vcRunP = null, vcRunS = 0, vcRunT = 0, vcGap = 0, vcWhy = '', vcLvl = 0, vcOrig = null;
const vcEl = id => document.getElementById(id);

try { const s = JSON.parse(localStorage.getItem('pc_voice') || 'null'); if (s && +s.lo > 0 && +s.hi > +s.lo) { vcLo = s.lo | 0; vcHi = s.hi | 0; } if (s && [9, 12, 15].includes(+s.S)) vcSong = +s.S; } catch (e) { }
const vcSave = () => { try { localStorage.setItem('pc_voice', JSON.stringify({ lo: vcLo, hi: vcHi, S: vcSong })); } catch (e) { } };

/* ---------- pelacak nada suara (YIN, 65–1100 Hz, tanpa koreksi sub-oktaf) ---------- */
function vcYin(buf, sr) {
    const minTau = Math.max(2, Math.floor(sr / VC.FMAX)), maxTau = Math.floor(sr / VC.FMIN) + 1;
    const W = Math.floor(sr * 0.04), off = buf.length - W - maxTau - 1;
    if (off < 0) return { f: -1, clar: 1, rms: 0 };
    let e = 0; for (let i = off + maxTau; i < buf.length; i++) e += buf[i] * buf[i];
    const rms = Math.sqrt(e / (W + 1));
    if (rms < 0.002) return { f: -1, clar: 1, rms };
    const y = new Float32Array(maxTau + 1);
    for (let tau = 1; tau <= maxTau; tau++) { let s = 0; for (let i = 0; i < W; i++) { const d = buf[off + i] - buf[off + i + tau]; s += d * d; } y[tau] = s; }
    let run = 0; y[0] = 1;
    for (let tau = 1; tau <= maxTau; tau++) { run += y[tau]; y[tau] = run ? y[tau] * tau / run : 1; }
    let t = -1;
    for (let tau = minTau; tau < maxTau; tau++) if (y[tau] < 0.15) { while (tau + 1 < maxTau && y[tau + 1] < y[tau]) tau++; t = tau; break; }
    if (t < 0) {
        let mv = Infinity, mi = -1; for (let tau = minTau; tau < maxTau; tau++) if (y[tau] < mv) { mv = y[tau]; mi = tau; }
        if (mv < 0.35) t = mi; else return { f: -1, clar: mv, rms };
    }
    let b = t;
    if (t > 1 && t < maxTau) { const a = y[t - 1], c = y[t + 1], m = y[t], den = a - 2 * m + c; if (den !== 0) b = t + 0.5 * (a - c) / den; }
    return { f: sr / b, clar: y[t], rms };
}

/* ---------- inti: satu frame -> nada yang ditahan ---------- */
const vcThr = () => Math.max(0.006, Math.min(vcNoise, 0.008) * 2.5);
function vcFeed(f, rms, clar, dt) {
    vcLvl = rms;
    const thr = vcThr();
    if (!(f > 0) || rms < thr || clar > VC.CLAR) {
        vcWhy = rms < thr ? 'pelan' : 'keruh'; vcGap += dt;
        if (vcGap > VC.GAP) { vcHist = []; vcRunP = null; vcRunT = 0; vcNow = null; }   // jeda napas singkat tidak memutus nada
        return vcShow();
    }
    vcGap = 0;
    vcHist.push(69 + 12 * Math.log2(f / refA)); if (vcHist.length > VC.WIN) vcHist.shift();
    if (vcHist.length < VC.WIN) return vcShow();
    const s = vcHist.slice().sort((a, b) => a - b), med = s[VC.WIN >> 1];
    if (s.filter(v => Math.abs(v - med) <= VC.OUT).length < VC.WIN - 1) { vcWhy = 'goyang'; vcRunP = null; vcRunT = 0; vcNow = null; return vcShow(); }
    if (vcRunP !== null && Math.abs(med - vcRunP) <= VC.STEP && Math.abs(med - vcRunS) <= VC.DRIFT) { vcRunP += 0.3 * (med - vcRunP); vcRunT += dt; }
    else { vcRunP = med; vcRunS = med; vcRunT = dt; }   // nada baru (atau meluncur terlalu jauh): hitung tahan dari awal
    vcNow = Math.round(vcRunP); vcWhy = '';
    let ch = false;
    if (vcRunT >= VC.HOLD) {
        if (vcLo === null || vcNow < vcLo) { vcLo = vcNow; ch = true; }
        if (vcHi === null || vcNow > vcHi) { vcHi = vcNow; ch = true; }
    }
    vcShow(ch);
}

/* ---------- saran kunci ---------- */
function vcCapo(pc, mode) {
    const deg = (mode === 'min' ? MIN : MAJ).map(([o, q]) => ({ r: (pc + o) % 12, q }));
    let best = 0, bs = -1;
    for (let k = 0; k <= 7; k++) { const sc = deg.filter(c => EASY.includes(shapeOf(c, k))).length; if (sc > bs) { bs = sc; best = k; } }
    return { capo: best, shapes: deg.map(c => shapeOf(c, best)), easy: bs };
}

// jendela melodi: [tonika-3, tonika-3+S]. over = jumlah nada jendela yang keluar dari rentang [lo, hi]; dist = jarak pusat jendela ke pusat rentang
function vcSuggest(lo, hi, S, mode) {
    const out = [];
    for (let pc = 0; pc < 12; pc++) {
        let best = null;
        for (let m = lo - 12; m <= hi + 12; m++) {
            if (((m % 12) + 12) % 12 !== pc) continue;
            const a = m - VC.BELOW, b = a + S, over = Math.max(0, lo - a) + Math.max(0, b - hi), dist = Math.abs((a + b) / 2 - (lo + hi) / 2);
            if (!best || over < best.over || (over === best.over && dist < best.dist)) best = { m, over, dist };
        }
        out.push(Object.assign({ pc }, best, vcCapo(pc, mode)));
    }
    return out.sort((x, y) => x.over - y.over || x.dist - y.dist);
}

// kunci asli lagu diketahui -> pilih kunci yang pas dengan geseran terkecil (-6..+5 nada)
function vcShiftPick(list, orig) {
    const min = Math.min.apply(null, list.map(c => c.over)), pool = list.filter(c => c.over === min);
    let best = null;
    pool.forEach(c => { const shift = ((c.pc - orig + 18) % 12) - 6; if (!best || Math.abs(shift) < Math.abs(best.shift)) best = { c, shift }; });
    return best;
}

/* ---------- tampilan ---------- */
function vcShow(changed) {
    const set = (id, t) => { const e = vcEl(id); if (e) e.textContent = t; };
    const nt = vcEl('vcNote'); if (nt) { nt.textContent = vcNow === null ? '—' : mname(vcNow); nt.classList.toggle('active-note', vcNow !== null); }
    set('vcLo', vcLo === null ? '—' : mname(vcLo)); set('vcHi', vcHi === null ? '—' : mname(vcHi));
    set('vcSpan', vcLo !== null && vcHi !== null ? (vcHi - vcLo) + ' nada' : '—');
    const lv = vcEl('vcLvl'); if (lv) lv.style.width = (vcActive ? Math.min(100, Math.round(vcLvl / 0.08 * 100)) : 0) + '%';
    let msg;
    if (!vcActive) msg = vcLo === null ? 'Tekan Mulai, lalu bernyanyi atau bersenandung.' : 'Pengukuran berhenti. Mulai lagi untuk menambah, atau Ulangi untuk mengukur dari awal.';
    else if (vcNow !== null) msg = 'Menahan ' + mname(vcNow) + '… ' + Math.min(100, Math.round(vcRunT / VC.HOLD * 100)) + '%';
    else msg = { pelan: 'Suara terlalu pelan: dekatkan ponsel atau bernyanyi lebih keras.', keruh: 'Nada belum jernih: bersenandung “mmm” atau “aaa” dengan nada tetap.', goyang: 'Tahan nada lebih stabil, jangan meluncur.' }[vcWhy] || 'Nyanyikan nada terendah yang nyaman, tahan ±1 detik, lalu nada tertinggi yang nyaman.';
    set('vcMsg', msg);
    if (changed) { vcSave(); vcRenderResult(); }
}

function vcRenderResult() {
    const box = vcEl('vcResult'); if (!box) return;
    if (vcLo === null || vcHi === null || vcHi - vcLo < 5) { box.innerHTML = '<p class="vc-fit">Belum cukup data. Nyanyikan nada rendah dan tinggi yang nyaman (selisih minimal 5 nada), masing-masing ditahan sekitar 1 detik.</p>'; vcCands = []; vcShiftC = null; return; }
    const span = vcHi - vcLo, all = vcSuggest(vcLo, vcHi, vcSong, vcMode), fit = all.filter(c => c.over === 0);
    vcCands = (fit.length ? fit : all).slice(0, fit.length ? 4 : 3);
    const nn = pc => noteStrings[pc] + (FLAT[noteStrings[pc]] ? '/' + FLAT[noteStrings[pc]] : '');
    const nm = c => nn(c.pc) + (vcMode === 'min' ? ' minor' : ' mayor');
    const orig = vcOrig !== null ? vcOrig : (+((vcEl('keyRoot') || {}).value) || 0), sp = vcShiftPick(all, orig);
    vcShiftC = sp ? sp.c : null;
    let h = `<p class="vc-fit">${span >= vcSong ? `Rentangmu (<strong>${span} nada</strong>) cukup untuk lagu dengan melodi ±${vcSong} nada, jadi beberapa kunci pas. Yang paling di tengah rentangmu ada di atas.`
        : `Rentangmu (<strong>${span} nada</strong>) lebih sempit dari melodi ±${vcSong} nada, jadi sebagian nada akan lewat. Kunci di bawah yang paling sedikit melewatinya.`}</p>`;
    if (sp) {
        const d = sp.shift, c = sp.c;
        h += `<div class="vc-cand shift"><div class="chord-detail-row" style="margin:0 0 6px">Lagu berkunci asli <strong>${esc(nn(orig))}</strong>: ${d === 0 ? 'sudah pas, tidak perlu digeser.' : `geser <strong>${d > 0 ? '+' : '−'}${Math.abs(d)} nada</strong> (${d > 0 ? 'naik' : 'turun'}) ke kunci <strong>${esc(nm(c))}</strong>${c.over ? ` <small>(masih lewat ±${c.over} nada)</small>` : ''}.`} ${c.capo ? 'Capo ' + c.capo + ', ' : 'Tanpa capo, '}bentuk ${esc(c.shapes.join(', '))}.</div>` +
            `<div class="picker-row"><button class="btn-variant" onclick="vcApply(-1,0)">Terapkan kunci ${esc(nn(c.pc))}</button>${c.capo ? `<button class="btn-variant" onclick="vcApply(-1,1)">+ Capo ${c.capo}</button>` : ''}</div>` +
            `<div class="chord-detail-row" style="margin:6px 0 0;font-size:.75rem">Untuk menggeser akor lagu yang sudah ditulis, pakai ♭ Turun / ♯ Naik di tab Lagu.</div></div>`;
    }
    h += '<div class="field-label" style="margin:14px 0 0">Semua kunci yang cocok</div>';
    h += vcCands.map((c, i) => `<div class="vc-cand${i === 0 ? ' best' : ''}"><div class="vc-cand-top"><strong>Kunci ${esc(nm(c))}</strong>` +
        `<span class="vc-tag">${c.over === 0 ? (i === 0 ? 'paling pas' : 'pas') : 'lewat ±' + c.over + ' nada'}</span></div>` +
        `<div class="chord-detail-row" style="margin:6px 0">${c.capo ? 'Capo ' + c.capo + ' · ' : 'Tanpa capo · '}bentuk ${esc(c.shapes.join(', '))} <small>(${c.easy} dari 7 akor berbentuk mudah)</small></div>` +
        `<div class="picker-row"><button class="btn-variant" onclick="vcApply(${i},0)">Terapkan kunci</button>${c.capo ? `<button class="btn-variant" onclick="vcApply(${i},1)">Kunci + Capo ${c.capo}</button>` : ''}</div></div>`).join('');
    h += '<p class="vc-fit">Ini perkiraan: melodi tiap lagu berbeda. Bila nada tertinggi lagu terasa terlalu tinggi, turunkan kunci 1–2 nada.</p>';
    box.innerHTML = h;
}

function vcApply(i, withCapo) {
    const c = i < 0 ? vcShiftC : vcCands[i]; if (!c) return;
    vcEl('kpRoot').value = String(c.pc); vcEl('kpMode').value = vcMode; vcEl('kpCapo').value = String(withCapo ? c.capo : 0);
    kpApply();
}
function vcOpt() {
    vcSong = +vcEl('vcSong').value || 12; vcMode = vcEl('vcMode').value === 'min' ? 'min' : 'maj';
    const k = vcEl('vcKey'); vcOrig = k && k.value !== '' ? (+k.value | 0) : null;
    vcSave(); vcRenderResult();
}
// koreksi manual: mis. hasil salah oktaf -> geser 12 nada
function vcAdj(which, d) {
    if (vcLo === null || vcHi === null) return;
    if (which === 'lo') vcLo = Math.min(vcHi - 1, vcLo + d); else vcHi = Math.max(vcLo + 1, vcHi + d);
    vcSave(); vcShow(true);
}
function vcReset() { vcLo = vcHi = vcNow = null; vcHist = []; vcRunP = null; vcRunT = 0; vcGap = 0; vcRing = []; try { localStorage.removeItem('pc_voice'); } catch (e) { } vcShow(); vcRenderResult(); pcToast('Pengukuran suara dihapus'); }
function vcSongSync() {
    const s = vcEl('vcSong'); if (s) s.value = String(vcSong); const m = vcEl('vcMode'); if (m) m.value = vcMode;
    const k = vcEl('vcKey'); if (k) { k.innerHTML = '<option value="">Ikuti panel 🎼</option>' + noteStrings.map((n, i) => `<option value="${i}">${n}${FLAT[n] ? '/' + FLAT[n] : ''}</option>`).join(''); k.value = vcOrig === null ? '' : String(vcOrig); }
}
function vcGo() { showTab('tuning'); setTimeout(() => { const c = vcEl('voiceCard'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60); }

/* ---------- mikrofon ---------- */
function vcBtn() { const b = vcEl('vcBtn'); if (!b) return; b.textContent = vcActive ? '■ Berhenti Mengukur' : '🎤 Mulai Ukur Suara'; b.classList.toggle('active', vcActive); }

async function vcStart() {
    if (vcActive) { vcStop(); return; }
    if (isListening) await toggleListening();
    if (isStrum) stopStrum();
    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('nomic');
        vcCtx = new (window.AudioContext || window.webkitAudioContext)();
        vcStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
        if (vcCtx.state === 'suspended') await vcCtx.resume();   // iOS/Safari memulai dalam keadaan tertahan
        const src = vcCtx.createMediaStreamSource(vcStream), hp = vcCtx.createBiquadFilter(), lp = vcCtx.createBiquadFilter();
        hp.type = 'highpass'; hp.frequency.value = 60; lp.type = 'lowpass'; lp.frequency.value = 3000;
        vcAn = vcCtx.createAnalyser(); vcAn.fftSize = CONFIG.BUFFER_SIZE;
        src.connect(hp); hp.connect(lp); lp.connect(vcAn);
        vcBuf = new Float32Array(vcAn.fftSize);
        vcActive = true; keepAwake(); vcHist = []; vcRing = []; vcNow = null; vcNoise = 0; vcRunP = null; vcRunT = 0; vcGap = 0; vcWhy = ''; vcLast = performance.now();
        vcBtn(); vcShow(); vcLoop();
    } catch (err) { micError(err); console.error(err); vcCleanup(); }
}

function vcLoop() {
    if (!vcActive) return;
    const now = performance.now();
    if (now - vcLast >= VC.FRAME_MS) {
        const dt = Math.min((now - vcLast) / 1000, 0.1); vcLast = now;
        vcAn.getFloatTimeDomainData(vcBuf);
        const r = vcYin(vcBuf, vcCtx.sampleRate);
        // derau ruangan = persentil ke-10 level suara ±5 dtk terakhir (jeda napas ikut terhitung, jadi tidak ikut naik saat bernyanyi)
        vcRing.push(r.rms); if (vcRing.length > 150) vcRing.shift();
        if (vcRing.length >= 30) vcNoise = vcRing.slice().sort((a, b) => a - b)[Math.floor(vcRing.length * 0.1)];
        vcFeed(r.f, r.rms, r.clar, dt);
    }
    vcRaf = requestAnimationFrame(vcLoop);
}

function vcCleanup() {
    cancelAnimationFrame(vcRaf);
    if (vcStream) vcStream.getTracks().forEach(t => t.stop());
    if (vcCtx && vcCtx.state !== 'closed') vcCtx.close();
    vcStream = vcCtx = vcAn = null;
}
function vcStop() { const was = vcActive; vcActive = false; vcCleanup(); allowSleep(); vcNow = null; vcLvl = 0; vcBtn(); vcShow(was); }

// hanya satu pemakai mikrofon sekaligus: tuner / Mode Strum / pindah tab menghentikan pengukuran
const _tlVc = toggleListening; toggleListening = async function () { if (vcActive) vcStop(); return _tlVc.apply(this, arguments); };
const _tsVc = toggleStrum; toggleStrum = async function () { if (vcActive) vcStop(); return _tsVc.apply(this, arguments); };
const _stVc = showTab; showTab = function (n) { if (n !== 'tuning' && vcActive) vcStop(); _stVc(n); };
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && vcActive) vcStop(); });
(function () { const k = vcEl('keyMode'); if (k && k.value === 'min') vcMode = 'min'; })();
vcSongSync(); vcBtn(); vcShow(); vcRenderResult();
