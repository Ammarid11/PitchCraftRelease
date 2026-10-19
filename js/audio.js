/* Pitchcraft — Pemutar suara: suara akor (sintesis sederhana) dan klik metronom. */

function playCurrentChordAudio() {
    if (!currentDetectedChordObj) return;
    let variant = currentDetectedChordObj.variants[activeVariantIndex];
    playChordFingering(variant.fingering);
}

function playChordFingering(fingeringArray, dir = 1, vol = 1) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    window._pc = window._pc || new AudioCtx(); let ctx = window._pc;
    if (ctx.state === 'suspended') ctx.resume();

    let now = ctx.currentTime;
    fingeringArray.forEach((fret, stringIndex) => {
        if (fret === -1) return;
        let baseFreq = openStringFrequencies[stringIndex];
        let freq = baseFreq * Math.pow(2, fret / 12);
        let delay = (dir > 0 ? stringIndex : 5 - stringIndex) * 0.035;

        let osc = ctx.createOscillator();
        let gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + delay);

        gain.gain.setValueAtTime(0, now + delay);
        gain.gain.linearRampToValueAtTime(0.25 * vol, now + delay + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 1.2);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + delay);
        osc.stop(now + delay + 1.3);
    });
}

function audioCtx() { window._pc = window._pc || new (window.AudioContext || window.webkitAudioContext)(); if (window._pc.state === 'suspended') window._pc.resume(); return window._pc; }

function clickSound(accent) {
    const ctx = audioCtx(), t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = accent ? 1500 : 1000; o.type = 'square';
    g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.06);
}
