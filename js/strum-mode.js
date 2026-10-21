/* Pitchcraft — Mode Strum: loop mikrofon, deteksi onset, penguncian akor. */

let isStrum = false, strumCtx = null, strumAnalyser = null, strumStream = null, strumRaf = null, strumTd = null, strumFd = null;

// idle -> analyzing (setelah onset genjrengan) -> locked (hasil dikunci sampai genjrengan berikutnya)
let lastStrumKey = '', lastStrumTime = 0;
let strumState = 'idle', tOnset = 0, tLock = 0, rmsSlow = 0, chromaN = 0;
let chromaSum = new Float32Array(12), bassVotes = new Float32Array(12);

async function toggleStrum() {
    if (isStrum) { stopStrum(); return; }
    if (isListening) await toggleListening();
    try {
        strumCtx = new (window.AudioContext || window.webkitAudioContext)();
        strumStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
        if (strumCtx.state === 'suspended') await strumCtx.resume();
        const src = strumCtx.createMediaStreamSource(strumStream);
        const hp = strumCtx.createBiquadFilter();
        hp.type = 'highpass'; hp.frequency.value = 70;
        strumAnalyser = strumCtx.createAnalyser();
        strumAnalyser.fftSize = 16384; strumAnalyser.smoothingTimeConstant = 0;
        src.connect(hp); hp.connect(strumAnalyser);
        strumTd = new Float32Array(strumAnalyser.fftSize);
        strumFd = new Float32Array(strumAnalyser.frequencyBinCount);
        strumState = 'idle'; rmsSlow = 0; lastStrumKey = '';
        isStrum = true; keepAwake();
        const b = document.getElementById('strumBtn');
        b.textContent = '■ Berhenti Mode Strum'; b.classList.add('active');
        document.getElementById('statusBox').classList.add('listening');
        document.getElementById('statusText').textContent = 'Mode strum: genjreng satu kali, hasil terkunci sampai genjrengan berikutnya';
        document.getElementById('hz').textContent = 'Genjreng gitar...';
        document.getElementById('chromaBars').style.display = 'flex'; renderChromaBars(new Array(12).fill(0));
        strumLoop();
    } catch (err) {
        if (strumStream) { strumStream.getTracks().forEach(t => t.stop()); strumStream = null; }
        if (strumCtx && strumCtx.state !== 'closed') strumCtx.close();
        micError(err); console.error(err);
    }
}

function stopStrum() {
    isStrum = false; allowSleep();
    cancelAnimationFrame(strumRaf);
    if (strumStream) strumStream.getTracks().forEach(t => t.stop());
    if (strumCtx && strumCtx.state !== 'closed') strumCtx.close();
    const b = document.getElementById('strumBtn');
    b.textContent = '🎸 Mode Strum (Genjrengan)'; b.classList.remove('active');
    document.getElementById('statusBox').classList.remove('listening');
    document.getElementById('statusText').textContent = 'Mikrofon nonaktif';
    const n = document.getElementById('note');
    n.textContent = '—'; n.classList.remove('active-note');
    document.getElementById('hz').textContent = '0.0 Hz';
    document.getElementById('chromaBars').style.display = 'none';
}

function renderChromaBars(v) {
    const mx = Math.max(...v) || 1;
    document.getElementById('chromaBars').innerHTML = noteStrings.map((n, i) =>
        `<div class="cb"><i style="height:${Math.round(v[i] / mx * 100)}%"></i><span>${n}</span></div>`).join('');
}

function pickAlt(k) {
    if (learnable && lastObs) {
        saveExemplar(k, lastObs);
        document.getElementById('hz').textContent = 'Dipelajari: ' + k + ' ✓';
        document.getElementById('note').textContent = k;
    }
    showChordKey(k);
}

function learnCurrent() { if (currentDetectedChordObj && lastObs) { saveExemplar(currentDetectedChordObj.key, lastObs); document.getElementById('hz').textContent = 'Dipelajari: ' + currentDetectedChordObj.key + ' ✓'; } }

function strumLoop() {
    if (!isStrum) return;
    const an = strumAnalyser, noteEl = document.getElementById('note'), hzEl = document.getElementById('hz');
    const now = performance.now(), L = strumTd.length;
    an.getFloatTimeDomainData(strumTd);
    let rms = 0;
    for (let i = L - 2048; i < L; i++) rms += strumTd[i] * strumTd[i];
    rms = Math.sqrt(rms / 2048);
    const onset = rms > 0.02 && rms > 1.8 * rmsSlow;   // lonjakan volume = genjrengan baru
    rmsSlow = 0.93 * rmsSlow + 0.07 * rms;

    if (rms < 0.012) {                                  // hening
        if (strumState === 'analyzing') { strumState = 'idle'; noteEl.textContent = '—'; noteEl.classList.remove('active-note'); hzEl.textContent = 'Genjreng gitar...'; }
        else if (strumState === 'locked') { strumState = 'idle'; hzEl.textContent = 'Genjreng lagi untuk akor berikutnya'; }
    } else if (strumState === 'idle' || (strumState === 'locked' && now - tLock > 500)) {
        if (onset) {
            strumState = 'analyzing'; tOnset = now; chromaN = 0;
            chromaSum.fill(0); bassVotes.fill(0);
            noteEl.textContent = '…'; noteEl.classList.remove('active-note'); hzEl.textContent = 'Menganalisis...';
        }
    } else if (strumState === 'analyzing') {
        const dt = now - tOnset;
        if (dt >= 350) {                                // tunggu jendela FFT bersih dari akor sebelumnya
            an.getFloatFrequencyData(strumFd);
            const { chroma, bass, maxMag } = computeChroma(strumFd, strumCtx.sampleRate, an.fftSize);
            const mx = Math.max(...chroma);
            if (mx > 0) {
                for (let i = 0; i < 12; i++) chromaSum[i] += chroma[i] / mx;
                chromaN++;
                renderChromaBars(chromaSum);
                if (bass.pc !== undefined && bass.m >= 0.3 * maxMag) bassVotes[bass.pc]++;
            }
            if (dt >= 650 && chromaN >= 3) {
                let bp = -1, bv = 0;
                bassVotes.forEach((v, i) => { if (v > bv) { bv = v; bp = i; } });
                const bassPc = (bp >= 0 && bv >= chromaN * 0.5) ? bp : -1;
                lastObs = Array.from(chromaSum);
                const ranked = rankByChroma(chromaSum, bassPc);
                strumState = 'locked'; tLock = now;
                if (ranked.length) {
                    let best = ranked[0];
                    // genjrengan akor yang sama jangan berganti hanya karena selisih skor tipis
                    if (lastStrumKey && now - lastStrumTime < 6000) {
                        const prev = ranked.find(r => r.key === lastStrumKey);
                        if (prev && prev.score >= best.score - 0.025) best = prev;
                    }
                    lastStrumKey = best.key; lastStrumTime = now;
                    const pick = pickStrumNotes(chromaSum, bassPc >= 0 ? { pc: bassPc, m: 1 } : { m: 0 }, 1);
                    detectedNotesList = pick ? pick.names : [];
                    renderDetectedList();
                    currentCandidates = ranked.slice(0, 6).map(r => r.key);
                    learnable = true;
                    lastConf = confidenceOf(marginOf(ranked, best.key));
                    showChordKey(best.key); try { pcLock(best.key); } catch (e) { }
                    noteEl.textContent = best.key;
                    noteEl.classList.add('active-note');
                    hzEl.textContent = 'Akor terkunci: ' + chordDatabase[best.key].notes.join(' - ') + (lastConf === 'ragu' ? ' · ragu' : '');
                }
            }
        }
    }
    strumRaf = requestAnimationFrame(strumLoop);
}
