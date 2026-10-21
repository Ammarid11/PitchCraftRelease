/* Pitchcraft — Fitur tambahan di atas inti app (TIDAK menyentuh deteksi nada/akor):
 * tap tempo + titik metronom, streak/target/lencana latihan, tempel lirik+akor, Mode Main, pasang sebagai app (PWA). */

/* ===== Titik metronom: berkedip tiap klik ===== */
const _clickSound = clickSound;
clickSound = function (accent) {
    _clickSound(accent);
    document.querySelectorAll('.beat-dot').forEach(d => {
        d.classList.remove('hit', 'acc'); d.classList.add(accent ? 'acc' : 'hit');
        clearTimeout(d._t); d._t = setTimeout(() => d.classList.remove('hit', 'acc'), 110);
    });
};

/* ===== Tap tempo ===== */
let tapTimes = [];
function setBpm(n) {
    n = Math.max(40, Math.min(200, Math.round(n)));
    syncVals('bpm', n); saveSettings();
    const pb = document.getElementById('perfBpm'); if (pb) pb.textContent = n;
    return n;
}
function pcTap() {
    const now = performance.now();
    if (tapTimes.length && now - tapTimes[tapTimes.length - 1] > 2000) tapTimes = [];
    tapTimes.push(now); if (tapTimes.length > 7) tapTimes.shift();
    if (tapTimes.length < 2) { pcToast('Ketuk lagi sesuai ketukan lagu…'); return; }
    const iv = []; for (let i = 1; i < tapTimes.length; i++) iv.push(tapTimes[i] - tapTimes[i - 1]);
    pcToast('Tempo: ' + setBpm(60000 / (iv.reduce((a, b) => a + b, 0) / iv.length)) + ' BPM');
}

/* ===== Streak harian, target, lencana (dihitung dari log sesi di store.js) ===== */
const DAY_GOAL = 300;   // detik latihan per hari (5 menit)

const BADGES = [
    ['first', '🌱', 'Sesi pertama', c => c.hist.length >= 1],
    ['cpm10', '⚡', '10 akor/menit', c => c.best >= 10],
    ['cpm20', '🚀', '20 akor/menit', c => c.best >= 20],
    ['dasar', '🎸', 'Akor dasar lulus', c => passed(c.hist, 'dasar')],
    ['barre', '💪', 'Barre lulus', c => passed(c.hist, 'barre')],
    ['seventh', '🎷', '7th & sus lulus', c => passed(c.hist, 'seventh')],
    ['goal', '🎯', 'Target harian', c => c.today >= DAY_GOAL],
    ['st3', '🔥', 'Streak 3 hari', c => c.streak >= 3],
    ['st7', '🏆', 'Streak 7 hari', c => c.streak >= 7],
    ['ear', '👂', 'Telinga tajam', c => c.hist.some(e => e.mode === 'ear' && e.ok >= 8 && e.ok >= 2 * e.bad)],
    ['ear2', '🎼', 'Telinga musikal', c => c.hist.some(e => e.mode === 'ear' && /^(interval|progresi|melodi|nada|namanada|akorkey)-/.test(e.level) && e.ok >= 8 && e.ok >= 2 * e.bad)]
];
const passed = (hist, lvl) => hist.some(e => e.mode === 'level' && e.level === lvl && e.ok >= 8 && e.ok >= 2 * e.bad);

function calcStreak(days) {
    const d = new Date(); let n = 0;
    if (!(days[dayKey(d)] > 0)) d.setDate(d.getDate() - 1);   // hari ini belum latihan: streak masih hidup sampai besok
    while (days[dayKey(d)] > 0) { n++; d.setDate(d.getDate() - 1); }
    return n;
}

let pendingAnnounce = false;
// setiap sesi selesai, practice.js memanggil saveHist: catat sebagai sesi ber-ID (riwayat 30 sesi saja tidak cukup untuk streak & sinkron)
const _saveHist = saveHist;
saveHist = function (h) {
    _saveHist(h);
    try {
        const last = h && h[h.length - 1]; if (!last) return;
        if (lsGet('pc_lastlog', 0) === last.t) return;
        lsSet('pc_lastlog', last.t);
        const c = cleanSession({ id: newId(), mode: last.mode, level: last.level, dur: last.dur, ok: last.ok, bad: last.bad, cpm: last.cpm, played_at: new Date(last.t).toISOString(), day: dayKey(new Date(last.t)) });
        if (!c) return;
        const ss = getSessions(); ss.push(c); setSessions(ss); pendingAnnounce = true;
        if (window.pcSyncSoon) window.pcSyncSoon();
    } catch (e) { }
};

function renderStreak() {
    const el = document.getElementById('streakBox'); if (!el) return;
    const hist = getSessions(), days = daysOf(hist), streak = calcStreak(days), today = days[dayKey(new Date())] || 0;
    const best = hist.reduce((a, e) => Math.max(a, e.cpm || 0), 0), ctx = { hist, days, streak, best, today };
    const have = new Set(lsGet('pc_badges', [])), fresh = [];
    BADGES.forEach(b => { if (!have.has(b[0]) && b[3](ctx)) { have.add(b[0]); fresh.push(b); } });
    if (fresh.length) lsSet('pc_badges', [...have]);
    if (fresh.length && pendingAnnounce) pcToast('🏅 Lencana baru: ' + fresh.map(b => b[2]).join(', '));
    pendingAnnounce = false;
    const pct = Math.min(100, Math.round(today / DAY_GOAL * 100)), mnt = Math.floor(today / 60);
    el.innerHTML = `<div class="streak-top"><span class="streak-n">🔥 ${streak}</span><span>hari beruntun</span></div>
        <div class="goal"><div class="goal-bar"><i style="width:${pct}%"></i></div><small>Hari ini ${mnt} dari ${DAY_GOAL / 60} menit${pct >= 100 ? ' ✓' : ''}</small></div>
        <div class="badges">${BADGES.map(b => `<span class="bdg${have.has(b[0]) ? ' got' : ''}" title="${esc(b[2])}"><b>${have.has(b[0]) ? b[1] : '🔒'}</b>${esc(b[2])}</span>`).join('')}</div>`;
}
const _renderHist = renderHist;
renderHist = function () { _renderHist(); renderStreak(); };

/* ===== Tempel lirik + akor dari situs lain (format akor di baris atas) ===== */
const CH_RE = /^[A-G][#b]?(?:maj|min|dim|aug|sus|add|m|M|\d|\(|\)|b|#|\+|-)*(?:\/[A-G][#b]?)?$/;
const IGN_RE = /^[|\-–—:.]+$|^x\d+$|^\d+x$|^N\.?C\.?$/i;
const HEAD_KW = '(?:intro|verse|bait|chorus|refrain|reff?|bridge|outro|interlude|pre-?chorus|coda|instrumental)';
const HEAD_BR = new RegExp('^\\s*[\\[(]\\s*(' + HEAD_KW + '\\b[^\\]\\n)]{0,18}?)\\s*[\\])]\\s*:?\\s*$', 'i');            // [Verse 1 - Cowok]
const HEAD_PL = new RegExp('^\\s*(' + HEAD_KW + '\\b(?:\\s*\\d{1,2})?(?:\\s*x\\s*\\d{1,2})?)\\s*:?\\s*$', 'i');                    // Reff: / Verse 2 / Outro x2 (lirik "Bridge over troubled" bukan judul)
const HEAD_RE = { exec: ln => HEAD_BR.exec(ln) || HEAD_PL.exec(ln), test: ln => HEAD_BR.test(ln) || HEAD_PL.test(ln) };
const unParen = t => t.replace(/^\(|\)$/g, '');

function isChordLine(ln) {
    if (!ln || !ln.trim()) return false;
    let n = 0;
    for (const t of ln.trim().split(/\s+/)) { if (CH_RE.test(unParen(t))) n++; else if (!IGN_RE.test(t)) return false; }
    return n > 0;
}

// token akor apa pun -> kunci kamus ("Bbmin7" -> "A#m7"); null jika tak dikenal
function chordKeyOf(tok) {
    const m = /^([A-G][#b]?)(.*?)(?:\/([A-G][#b]?))?$/.exec(unParen(tok)); if (!m) return null;
    const root = FLAT_TO_SHARP[m[1]] || m[1], bass = m[3] ? (FLAT_TO_SHARP[m[3]] || m[3]) : '';
    let q = m[2].replace(/^min/, 'm').replace(/^M(?!aj)/, 'maj').replace(/^maj$/, '').replace(/^maj(?=\d)/, 'maj').replace(/^-/, 'm').replace(/^sus$/, 'sus4').replace(/^\+$/, 'aug');
    const tries = [root + q + (bass ? '/' + bass : ''), root + q, root + q.replace(/\(.*\)/, ''), root + (/^m(?!aj)/.test(q) ? 'm' : '')];
    return tries.find(k => chordDatabase[k]) || null;
}

function parseChordSheet(text) {
    const lines = String(text || '').replace(/\r/g, '').replace(/\t/g, '    ').split('\n'), secs = []; let cur = null;
    const start = name => { cur = { name: (name || 'Bagian ' + (secs.length + 1)).slice(0, 60), lyr: [], chords: [] }; secs.push(cur); };
    const addCh = k => { if (k && (!cur.chords.length || cur.chords[cur.chords.length - 1].key !== k)) cur.chords.push({ key: k, v: 0, beats: 0 }); };
    for (let i = 0; i < lines.length; i++) {
        const ln = lines[i], h = HEAD_RE.exec(ln);
        if (h && !isChordLine(ln)) { start(h[1].trim()); continue; }
        if (!cur) start();
        if (isChordLine(ln)) {
            const toks = [], re = /\S+/g; let m;
            while ((m = re.exec(ln))) if (CH_RE.test(unParen(m[0]))) toks.push([unParen(m[0]), m.index]);
            const nx = lines[i + 1], hasLyr = nx !== undefined && nx.trim() && !isChordLine(nx) && !HEAD_RE.test(nx);
            toks.forEach(t => addCh(chordKeyOf(t[0])));
            if (hasLyr) {
                let lyr = nx;
                toks.slice().reverse().forEach(([t, p]) => { if (lyr.length < p) lyr = lyr.padEnd(p); lyr = lyr.slice(0, p) + '[' + t + ']' + lyr.slice(p); });
                cur.lyr.push(lyr.replace(/\s+$/, '')); i++;
            } else cur.lyr.push(toks.map(t => '[' + t[0] + ']').join(' '));
        } else {
            const re = /\[([^\]]+)\]/g; let m;
            while ((m = re.exec(ln))) addCh(chordKeyOf(m[1]));   // format [Am]kata yang sudah jadi ikut dibaca
            cur.lyr.push(ln.replace(/\s+$/, ''));
        }
    }
    return secs.map(s => ({ name: s.name, lyrics: s.lyr.join('\n').replace(/^\n+|\n+$/g, ''), chords: s.chords }))
        .filter(s => s.lyrics || s.chords.length);
}

function songImportTextToggle(open) {
    const b = document.getElementById('impBox'); if (!b) return;
    b.hidden = open === undefined ? !b.hidden : !open;
    if (!b.hidden) document.getElementById('impTa').focus();
}
function songImportTextRun() {
    const secs = parseChordSheet(document.getElementById('impTa').value);
    if (!secs.length) { alert('Tidak ada lirik atau akor yang bisa dibaca. Tempel lirik dengan akor di baris atasnya.'); return; }
    const empty = song.sections.length === 1 && !song.sections[0].lyrics && !song.sections[0].chords.length;
    const want = (empty ? 0 : song.sections.length) + secs.length;
    song = cleanSong({ name: song.name, meter: song.meter, sections: (empty ? [] : song.sections).concat(secs) });
    if (want > song.sections.length) alert('Batas ' + SONG_MAX_SEC + ' bagian: ' + (want - song.sections.length) + ' bagian terakhir dari teks tidak ikut ditambahkan.');
    if (!song.sections.length) song.sections = [newSection()];
    document.getElementById('impTa').value = ''; songImportTextToggle(false);
    renderSong(); pcToast(Math.min(secs.length, SONG_MAX_SEC) + ' bagian ditambahkan dari teks');
}

/* ===== Mode Main: layar penuh, lirik besar, akor aktif tersorot, auto-scroll ===== */
const _stopProgression = stopProgression;
stopProgression = function () { _stopProgression(); document.querySelectorAll('#perfView .badge').forEach(b => b.classList.remove('on')); };

const _playChordFingering = playChordFingering;
playChordFingering = function () {   // opsi "tanpa suara akor": hanya metronom, untuk main bersama lagu
    const p = document.getElementById('perf'), m = document.getElementById('perfMute');
    if (p && m && p.classList.contains('on') && m.checked) return;
    return _playChordFingering.apply(this, arguments);
};

let perfFs = 1.25, perfSec = null;
function perfRender() {
    const capo = getCapo();
    document.getElementById('perfView').innerHTML = (song.name ? `<h3 class="perf-title">${esc(song.name)}</h3>` : '') +
        song.sections.map(s => `<div class="perf-sec"><div class="perf-name">${esc(s.name)}</div>` +
            (s.chords.length ? `<div class="detected-list perf-ch">${s.chords.map(c => `<div class="badge">${esc(c.key)}${capo ? ` <small>→ ${esc(tKey(c.key, capo))}</small>` : ''}</div>`).join('')}</div>` : '') +
            `<div class="lyr">${lyricsHTML(s.lyrics)}</div></div>`).join('');
    document.getElementById('perfBpm').textContent = +document.getElementById('bpm').value || 80;
    document.getElementById('perfView').style.fontSize = perfFs + 'rem';
}
function perfOpen() {
    if (!song.sections.some(s => s.lyrics || s.chords.length)) { alert('Isi bagian lagu dulu (akor atau lirik).'); return; }
    perfRender(); perfSec = null;
    const p = document.getElementById('perf'); p.classList.add('on'); p.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden'; p.scrollTop = 0; keepAwake();
}
function perfClose() {
    stopProgression();
    const p = document.getElementById('perf'); p.classList.remove('on'); p.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = ''; if (!isListening && !isStrum && !(typeof vcActive !== 'undefined' && vcActive)) allowSleep();
}
function perfPlay() {
    const list = [].concat(...song.sections.map(s => s.chords));
    if (!list.length) { alert('Belum ada akor di bagian lagu. Tambahkan akor atau tempel teks beserta akornya.'); return; }
    perfSec = null; playList(list, '#perfView .badge');
}
function perfBpm(d) { setBpm((+document.getElementById('bpm').value || 80) + d); }
function perfFont(d) { perfFs = Math.max(0.9, Math.min(2.4, perfFs + d * 0.1)); document.getElementById('perfView').style.fontSize = perfFs + 'rem'; }

// akor aktif berpindah bagian -> gulir halus ke bagian itu
new MutationObserver(() => {
    const on = document.querySelector('#perfView .badge.on'); if (!on) return;
    const sec = on.closest('.perf-sec');
    if (sec && sec !== perfSec) { perfSec = sec; sec.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
}).observe(document.getElementById('perfView') || document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.getElementById('perf').classList.contains('on')) perfClose(); });

/* ===== Pasang sebagai app + offline ===== */
let installEv = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEv = e; const b = document.getElementById('installBtn'); if (b) b.hidden = false; });
window.addEventListener('appinstalled', () => { installEv = null; const b = document.getElementById('installBtn'); if (b) b.hidden = true; });
function pcInstall() { if (!installEv) return; installEv.prompt(); installEv.userChoice.finally(() => { installEv = null; document.getElementById('installBtn').hidden = true; }); }
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));
    navigator.serviceWorker.addEventListener('message', e => { if (e.data && e.data.type === 'pc-updated') pcToast('Versi baru terpasang. Muat ulang halaman agar memakainya.', 6000); });
}
