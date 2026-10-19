/* Pitchcraft — Tuner mikrofon: alur mulai/berhenti dan loop pembaruan nada. */

let audioContext = null;
let analyser = null;
let microphone = null;
let biquadFilter = null;
let isListening = false;
let animationId = null;
let pitchHistory = [];
let lastStablePitch = 0, outlierCount = 0;
let stableNoteCandidate = "";
let stableNoteCount = 0;

async function toggleListening() {
    const btn = document.getElementById('toggleBtn');
    const noteEl = document.getElementById('note');
    const hzEl = document.getElementById('hz');
    const statusBox = document.getElementById('statusBox');
    const statusText = document.getElementById('statusText');

    if (!isListening) {
        if (isStrum) stopStrum();
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('nomic');
            const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
            tunerStream = stream;

            microphone = audioContext.createMediaStreamSource(stream);
            biquadFilter = audioContext.createBiquadFilter();
            biquadFilter.type = "highpass";
            biquadFilter.frequency.setValueAtTime(65, audioContext.currentTime);

            analyser = audioContext.createAnalyser();
            analyser.fftSize = CONFIG.BUFFER_SIZE;

            const lp = audioContext.createBiquadFilter();
            lp.type = 'lowpass'; lp.frequency.setValueAtTime(1500, audioContext.currentTime);   // buang desis & harmonik tinggi
            microphone.connect(biquadFilter);
            biquadFilter.connect(lp);
            lp.connect(analyser);

            isListening = true; keepAwake(); resetGate(); listenT = performance.now(); noiseFloor = 0; rmsSlowT = 0; shownMidi = null; candMidi = null;
            pitchHistory = [];

            btn.textContent = "Berhenti";
            btn.classList.add('active');
            statusBox.classList.add('listening');
            statusText.textContent = "Mendengarkan Nada...";

            updatePitch();
        } catch (err) {
            micError(err);
            console.error(err);
        }
    } else {
        if (tunerStream) { tunerStream.getTracks().forEach(t => t.stop()); tunerStream = null; }
        if (audioContext && audioContext.state !== 'closed') audioContext.close();
        cancelAnimationFrame(animationId);
        isListening = false; allowSleep();

        btn.textContent = "Mulai Mendengarkan";
        btn.classList.remove('active');
        statusBox.classList.remove('listening');
        statusText.textContent = "Mikrofon nonaktif";

        noteEl.textContent = "—";
        noteEl.classList.remove('active-note');
        hzEl.textContent = "0.0 Hz";
    }
}

function updatePitch() {
    const buffer = new Float32Array(CONFIG.BUFFER_SIZE);
    analyser.getFloatTimeDomainData(buffer);
    let rawPitch = gatePitch(detectPitch(buffer, audioContext.sampleRate));
    // lipat balik kesalahan sub-harmonik (E4 terbaca A2 = 1/3, E3 terbaca E2 = 1/2) selama belum ada petikan baru
    if (rawPitch !== -1 && pitchHistory.length >= 3 && armedT <= noteStartT) {
        const ref0 = getMedian(pitchHistory);
        for (let k = 2; k <= 4; k++) if (Math.abs(12 * Math.log2(rawPitch * k / ref0)) < 0.6) { rawPitch *= k; break; }
    }

    const noteEl = document.getElementById('note');
    const hzEl = document.getElementById('hz');
    const S = SENS[sensLevel];

    if (rawPitch !== -1) {
        if (pitchHistory.length >= 3) {
            const ref = getMedian(pitchHistory);
            const jump = Math.abs(12 * Math.log2(rawPitch / ref));
            const harm = jump >= 11 || Math.abs(jump - 7) < 1;   // lompatan oktaf/kwint = kemungkinan besar harmonik, bukan nada baru
            if (jump > 0.8) {      // loncatan > ~80 cent: kemungkinan glitch atau senar baru
                if (lastRms < (harm ? 0.7 : 0.4) * ringRms) { if (isListening) animationId = requestAnimationFrame(updatePitch); return; }   // suara kecil saat senar masih berdering: abaikan
                if (outlierRef && Math.abs(12 * Math.log2(rawPitch / outlierRef)) > 0.8) outlierCount = 0;   // kandidat berubah-ubah: mulai hitung ulang
                outlierRef = rawPitch; outlierCount++;
                if (outlierCount < (harm ? S.out * 2 : S.out)) { if (isListening) animationId = requestAnimationFrame(updatePitch); return; }
                pitchHistory = []; stableNoteCount = 0; shownMidi = null; candMidi = null;   // beberapa frame konsisten -> memang nada baru
            }
        }
        outlierCount = 0; outlierRef = 0;
        lastGoodT = performance.now(); ringRms = Math.max(lastRms, ringRms * 0.97);
        if (!pitchHistory.length) noteStartT = performance.now();
        pitchHistory.push(rawPitch);
        while (pitchHistory.length > S.hist) pitchHistory.shift();

        let medianPitch = getMedian(pitchHistory);
        let note = noteFromPitch(medianPitch);
        const exact = 69 + 12 * Math.log2(medianPitch / 440);
        if (shownMidi !== null && Math.abs(exact - shownMidi) * 100 <= S.hyst) { note = shownMidi; candMidi = null; }   // histeresis: nada tidak pindah hanya karena melewati batas 50 cent
        else if (shownMidi === null) shownMidi = note;
        else {
            if (note === candMidi) candCnt++; else { candMidi = note; candCnt = 1; }
            if (candCnt >= S.out) { shownMidi = note; candMidi = null; } else note = shownMidi;
        }
        let noteName = noteStrings[note % 12];

        const octave = Math.floor(note / 12) - 1;          // nomor MIDI -> oktaf ilmiah (E2 = senar 6 terbuka)
        noteEl.innerHTML = noteName + '<span class="oct">' + octave + '</span>';
        noteEl.classList.add('active-note');
        hzEl.textContent = `${medianPitch.toFixed(1)} Hz`; window.pcHz = medianPitch; window.pcT = performance.now();
        const cents = 1200 * Math.log2(medianPitch / (440 * Math.pow(2, (note - 69) / 12)));
        const cm = document.getElementById('centsMark'), ok = Math.abs(cents) <= 5;
        cm.style.left = (50 + Math.max(-50, Math.min(50, cents))).toFixed(1) + '%';
        cm.style.background = ok ? 'var(--success)' : 'var(--warning)';
        document.getElementById('centsText').textContent = (cents > 0 ? '+' : '') + cents.toFixed(0) + ' cents' + (ok ? ' ✓ pas' : cents > 0 ? ' (terlalu tinggi)' : ' (terlalu rendah)');

        if (noteName === stableNoteCandidate) {
            stableNoteCount++;
        } else {
            stableNoteCandidate = noteName;
            stableNoteCount = 1;
        }

        if (stableNoteCount >= S.list) {
            let lastNoteInList = detectedNotesList[detectedNotesList.length - 1];
            if (noteName !== lastNoteInList) {
                addNoteToList(noteName);
            }
            stableNoteCount = 0;
        }
    } else if (pitchHistory.length && performance.now() - lastGoodT < HOLD_MS) {
        /* jeda singkat: pertahankan nada terakhir di layar */
    } else {
        pitchHistory = []; ringRms = 0; shownMidi = null; candMidi = null; outlierRef = 0;
        stableNoteCount = 0;
        stableNoteCandidate = "";
        noteEl.textContent = "—";
        noteEl.classList.remove('active-note');
        hzEl.textContent = "Petik senar gitar...";
        document.getElementById('centsMark').style.left = '50%';
        document.getElementById('centsMark').style.background = 'var(--text-muted)';
        document.getElementById('centsText').innerHTML = '&nbsp;';
    }

    if (isListening) {
        animationId = requestAnimationFrame(updatePitch);
    }
}
