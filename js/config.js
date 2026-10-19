/* Pitchcraft — Konfigurasi, daftar nada, dan utilitas perangkat (izin mikrofon, layar tetap menyala). */

const CONFIG = {
    HISTORY_LENGTH: 10,
    MIN_VOLUME: 0.012,
    BUFFER_SIZE: 8192,
    MIN_FREQ: 75,
    MAX_FREQ: 700
};
const noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const openStringFrequencies = [82.41, 110.00, 146.83, 196.00, 246.94, 329.63];

function micError(err) {
    const n = err && err.name;
    if (n === 'NotAllowedError' || n === 'SecurityError') alert('Izin mikrofon ditolak. Di Chrome Android: ketuk ikon gembok di address bar → Izin → Mikrofon → Izinkan, lalu muat ulang.');
    else if (n === 'NotFoundError') alert('Mikrofon tidak ditemukan di perangkat ini.');
    else if (!window.isSecureContext || (err && err.message === 'nomic')) alert('Mikrofon hanya bisa dipakai lewat HTTPS (atau localhost). Buka halaman ini lewat alamat https://.');
    else alert('Gagal mengakses mikrofon.');
}

// Jaga layar tetap menyala saat mikrofon aktif (Android mematikan layar & menghentikan mic)
let wakeLock = null, tunerStream = null;

async function keepAwake() {
    try { if ('wakeLock' in navigator) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch (e) { }
}

function allowSleep() { try { if (wakeLock) wakeLock.release(); } catch (e) { } wakeLock = null; }

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && (isListening || isStrum) && !wakeLock) keepAwake();
});

// Utilitas bersama: capo aktif & transpose nama akor (dipakai progresi, lagu, audio, latihan)
function getCapo() { const e = document.getElementById('capoSel'); return e ? (+e.value || 0) : 0; }
const FLAT_TO_SHARP = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#' };
function tNote(n, d) { n = FLAT_TO_SHARP[n] || n; const i = noteStrings.indexOf(n); return i < 0 ? n : noteStrings[(i + d + 12) % 12]; }
function tKey(k, d) { return String(k).replace(/[A-G][#b]?/g, n => tNote(n, d)); }

// Kalibrasi nada acuan A (Hz); dipakai tuner, deteksi nada, dan suara
let refA = 440;
