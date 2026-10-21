/* Pitchcraft — Tema (gelap / terang / otomatis) dan Mode Panggung (roadmap #10).
 * Lapisan tampilan saja: tidak menyentuh deteksi nada/akor. Pilihan disimpan per perangkat di 'pc_theme' dan 'pc_stage'
 * (sengaja TIDAK ikut sinkron akun: layar HP di luar ruangan bisa berbeda dari laptop di rumah).
 * Atribut data-theme dipasang lebih awal oleh skrip kecil di <head> index.html agar tidak berkedip. */

const THEME_KEY = 'pc_theme', STAGE_KEY = 'pc_stage';
const THEME_OPTS = [['gelap', '🌙 Gelap'], ['terang', '☀️ Terang'], ['auto', '🌓 Otomatis']];
let pcTheme = 'gelap', pcStage = false;
try {
    const t = localStorage.getItem(THEME_KEY); if (THEME_OPTS.some(o => o[0] === t)) pcTheme = t;
    pcStage = localStorage.getItem(STAGE_KEY) === '1';
} catch (e) { }
const themeMQ = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
const themeIsLight = () => pcTheme === 'terang' || (pcTheme === 'auto' && !!themeMQ && themeMQ.matches);

function themeApply() {
    const light = themeIsLight(), root = document.documentElement;
    root.setAttribute('data-theme', light ? 'light' : 'dark');
    root.classList.toggle('stage', pcStage);
    document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', light ? '#f4f5fa' : '#090a0f'));
    const cs = document.querySelector('meta[name="color-scheme"]'); if (cs) cs.setAttribute('content', light ? 'light' : 'dark');
    lookRender();
}

function setTheme(t) {
    if (!THEME_OPTS.some(o => o[0] === t)) return;
    pcTheme = t; try { localStorage.setItem(THEME_KEY, t); } catch (e) { }
    themeApply();
}

// Mode Panggung: kontras tinggi, huruf lebih besar, tanpa animasi latar, layar tetap menyala
const _allowSleepBase = allowSleep;
allowSleep = function () { if (pcStage) return; _allowSleepBase(); };   // selama Mode Panggung aktif, layar tidak boleh padam
function setStage(on) {
    pcStage = !!on; try { localStorage.setItem(STAGE_KEY, pcStage ? '1' : '0'); } catch (e) { }
    themeApply();
    if (pcStage) keepAwake();
    else {
        const perf = document.getElementById('perf');
        if (!isListening && !isStrum && !(typeof vcActive !== 'undefined' && vcActive) && !(perf && perf.classList.contains('on'))) _allowSleepBase();
    }
    pcToast(pcStage ? 'Mode Panggung aktif' : 'Mode Panggung mati');
}

function lookRender() {
    const el = document.getElementById('lookThemes'); if (!el) return;
    el.innerHTML = THEME_OPTS.map(([k, l]) => `<button class="chip${k === pcTheme ? ' on' : ''}" aria-pressed="${k === pcTheme}" onclick="setTheme('${k}')">${l}</button>`).join('');
    const c = document.getElementById('stageChk'); if (c) c.checked = pcStage;
}
function lookToggle(open) {
    const m = document.getElementById('look'); if (!m) return;
    const o = open === undefined ? !m.classList.contains('on') : open;
    m.classList.toggle('on', o); if (o) lookRender();
}

if (themeMQ) { const f = () => { if (pcTheme === 'auto') themeApply(); }; themeMQ.addEventListener ? themeMQ.addEventListener('change', f) : themeMQ.addListener(f); }
document.addEventListener('keydown', e => { if (e.key === 'Escape') lookToggle(false); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && pcStage && !wakeLock) keepAwake(); });
themeApply(); if (pcStage) keepAwake();
