/* Pitchcraft — Latih Telinga (roadmap #11): app memainkan bunyi, kamu menebaknya. Satu ronde = 10 soal.
 * Lima jenis latihan: akor (jenis akor), interval, urutan akor (angka romawi), arah melodi, dan nada (lebih tinggi/rendah, derajat Do–Si).
 * Memakai mesin suara Karplus-Strong yang sudah ada (pluckNote). TIDAK memakai mikrofon dan tidak menyentuh deteksi nada/akor.
 * Bunyi selalu tuning standar tanpa capo. Semua jenis memakai tiga tingkat yang sama: mudah, sedang, sulit.
 * Hasil ronde dicatat sebagai sesi ber-ID (mode 'ear'; level = tingkat untuk akor, "jenis-tingkat" untuk yang lain) sehingga ikut streak, total latihan, lencana, dan sinkron akun.
 * Statistik disimpan di perangkat ini saja ('pc_ear'), tidak ikut sinkron. */

const EAR_Q = {
    maj:  { sfx: '',     n: 'Mayor',     hint: 'terdengar cerah dan mantap' },
    min:  { sfx: 'm',    n: 'Minor',     hint: 'terdengar sendu dan murung' },
    dom7: { sfx: '7',    n: 'Dominan 7', hint: 'terdengar bluesy, menggantung, seperti ingin kembali ke akor “rumah”' },
    maj7: { sfx: 'maj7', n: 'Major 7',   hint: 'terdengar lembut dan melayang, seperti mimpi' },
    min7: { sfx: 'm7',   n: 'Minor 7',   hint: 'terdengar sendu tapi hangat dan santai' },
    sus4: { sfx: 'sus4', n: 'Sus4',      hint: 'terdengar terbuka dan menggantung, tidak mayor dan tidak minor' }
};
const EAR_LEVELS = { mudah: ['maj', 'min'], sedang: ['maj', 'min', 'dom7'], sulit: ['maj', 'min', 'dom7', 'maj7', 'min7', 'sus4'] };
const EAR_LABEL = { mudah: 'Mudah · mayor / minor', sedang: 'Sedang · + dominan 7', sulit: 'Sulit · + maj7, m7, sus4' };
const EAR_LEN = 10, EAR_KEY = 'pc_ear';
const EAR_KINDS = [['akor', 'Jenis akor'], ['interval', 'Interval'], ['progresi', 'Urutan akor'], ['melodi', 'Arah melodi'], ['nada', 'Nada']];
let ear = null;   // ronde berjalan; null = belum mulai

/* ---------- bank soal jenis lanjutan ---------- */
const EAR_INT = { m2: 1, M2: 2, m3: 3, M3: 4, P4: 5, TT: 6, P5: 7, m6: 8, M6: 9, m7: 10, M7: 11, P8: 12 };   // semitone
const EAR_DEG = { d1: 0, d2: 2, d3: 4, d4: 5, d5: 7, d6: 9, d7: 11, d8: 12 };                                   // derajat tangga nada mayor (semitone dari Do)
const EAR_SC = [0, 2, 4, 5, 7, 9, 11];                                                                           // tangga nada mayor
const EAR_OFF = i => EAR_SC[i % 7] + 12 * Math.floor(i / 7);                                                     // indeks derajat -> semitone (i >= 0)
const EAR_SIGNS = { naik: [1, 1, 1, 1], turun: [-1, -1, -1, -1], naikturun: [1, 1, -1, -1], turunnaik: [-1, -1, 1, 1], zigzag: [1, -1, 1, -1], tetap: [0, 0, 0, 0] };
// c = [selisih semitone dari tonika, 'm' bila minor]
const EAR_PROG = {
    pop:     { n: 'I–V–vi–IV',    c: [[0, ''], [7, ''], [9, 'm'], [5, '']],  hint: 'progresi pop paling umum, cerah dan mengalir' },
    klasik:  { n: 'I–IV–V–I',     c: [[0, ''], [5, ''], [7, ''], [0, '']],  hint: 'pola dasar lagu rakyat dan blues; akor V menarik kuat untuk pulang ke I' },
    vi:      { n: 'vi–IV–I–V',    c: [[9, 'm'], [5, ''], [0, ''], [7, '']], hint: 'versi yang lebih sendu karena dimulai dari akor minor' },
    lima0:   { n: 'I–vi–IV–V',    c: [[0, ''], [9, 'm'], [5, ''], [7, '']], hint: 'gaya tahun 50-an, manis dan nostalgia' },
    canon:   { n: 'I–V–vi–iii',   c: [[0, ''], [7, ''], [9, 'm'], [4, 'm']], hint: 'awal pola kanon: turun bertahap dan megah' },
    minor:   { n: 'i–VI–III–VII', c: [[0, 'm'], [8, ''], [3, ''], [10, '']], hint: 'minor yang epik dan dramatis' },
    andalus: { n: 'i–VII–VI–V',   c: [[0, 'm'], [10, ''], [8, ''], [7, '']], hint: 'turun satu per satu, berkesan flamenco' }
};
const EAR_X = {
    interval: {
        intro: 'App memainkan dua nada berurutan (naik); kamu menebak jaraknya. Hafalkan “rasa” tiap interval, mis. m3 terdengar sendu dan M3 cerah.',
        levels: { mudah: ['m3', 'M3', 'P5', 'P8'], sedang: ['M2', 'm3', 'M3', 'P4', 'P5', 'M6', 'P8'], sulit: ['m2', 'M2', 'm3', 'M3', 'P4', 'TT', 'P5', 'm6', 'M6', 'm7', 'M7', 'P8'] },
        labels: { mudah: 'Mudah · m3, M3, P5, P8', sedang: 'Sedang · 7 interval', sulit: 'Sulit · 12 interval (semua)' },
        names: { m2: 'Kecil 2 (m2)', M2: 'Mayor 2 (M2)', m3: 'Kecil 3 (m3)', M3: 'Mayor 3 (M3)', P4: 'Kuart (P4)', TT: 'Tritone (TT)', P5: 'Kuint (P5)', m6: 'Kecil 6 (m6)', M6: 'Mayor 6 (M6)', m7: 'Kecil 7 (m7)', M7: 'Mayor 7 (M7)', P8: 'Oktaf (P8)' },
        hint: { m2: 'sempit dan tegang, dua nada bersebelahan', M2: 'selangkah penuh, terasa melangkah naik pelan', m3: 'sendu, ciri khas akor minor', M3: 'cerah, ciri khas akor mayor',
            P4: 'terbuka dan stabil, seperti naik dari Do ke Fa', TT: 'sangat tegang dan gelisah, tepat di tengah oktaf', P5: 'kokoh dan lapang, dasar power chord', m6: 'sendu tapi lapang',
            M6: 'hangat dan manis', m7: 'menggantung, ciri khas akor dominan 7', M7: 'melayang dan tegang, seperti ingin naik ke oktaf', P8: 'dua nada yang sama namanya, terdengar menyatu' }
    },
    progresi: {
        intro: 'App memainkan empat akor dalam kunci acak; kamu menebak polanya dengan angka romawi (mis. I–V–vi–IV). Dengarkan arah gerak akornya, bukan nama akornya.',
        levels: { mudah: ['pop', 'klasik'], sedang: ['pop', 'klasik', 'vi', 'lima0'], sulit: ['pop', 'klasik', 'vi', 'lima0', 'canon', 'minor', 'andalus'] },
        labels: { mudah: 'Mudah · 2 pola', sedang: 'Sedang · 4 pola', sulit: 'Sulit · 7 pola' },
        names: Object.keys(EAR_PROG).reduce((o, k) => { o[k] = EAR_PROG[k].n; return o; }, {}),
        hint: Object.keys(EAR_PROG).reduce((o, k) => { o[k] = EAR_PROG[k].hint; return o; }, {})
    },
    melodi: {
        intro: 'App memainkan lima nada berurutan; kamu menebak arah geraknya: naik, turun, atau berliku.',
        levels: { mudah: ['naik', 'turun'], sedang: ['naik', 'turun', 'naikturun', 'turunnaik'], sulit: ['naik', 'turun', 'naikturun', 'turunnaik', 'zigzag', 'tetap'] },
        labels: { mudah: 'Mudah · naik / turun', sedang: 'Sedang · + naik-turun, turun-naik', sulit: 'Sulit · + zigzag, tetap' },
        names: { naik: 'Naik', turun: 'Turun', naikturun: 'Naik lalu turun', turunnaik: 'Turun lalu naik', zigzag: 'Zigzag (bergantian)', tetap: 'Tetap (nada sama)' },
        hint: { naik: 'nada-nada bergerak makin tinggi', turun: 'nada-nada bergerak makin rendah', naikturun: 'naik ke puncak lalu turun lagi, seperti bukit', turunnaik: 'turun ke dasar lalu naik lagi, seperti lembah',
            zigzag: 'berganti naik dan turun terus', tetap: 'semua nada sama tinggi' }
    },
    nada: {
        intro: 'Mudah: dua nada, tebak mana yang lebih tinggi. Sedang dan Sulit: app memainkan nada acuan (Do) lalu satu nada lain; tebak derajatnya (Do, Re, Mi, …).',
        levels: { mudah: ['p1', 'p2'], sedang: ['d1', 'd3', 'd5', 'd8'], sulit: ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8'] },
        labels: { mudah: 'Mudah · mana yang lebih tinggi', sedang: "Sedang · Do, Mi, Sol, Do'", sulit: 'Sulit · semua derajat (Do–Si)' },
        names: { p1: 'Pertama lebih tinggi', p2: 'Kedua lebih tinggi', d1: 'Do (1)', d2: 'Re (2)', d3: 'Mi (3)', d4: 'Fa (4)', d5: 'Sol (5)', d6: 'La (6)', d7: 'Si (7)', d8: "Do' (8)" },
        hint: { p1: 'nada kedua turun dari yang pertama', p2: 'nada kedua naik dari yang pertama',
            d1: 'sama dengan nada acuan: terasa pulang dan tenang', d2: 'sedikit di atas acuan, menggantung dan ingin naik ke Mi', d3: 'cerah dan stabil, nada tengah akor mayor',
            d4: 'menggantung, cenderung turun ke Mi', d5: 'kokoh dan terbuka, kuint dari acuan', d6: 'manis dan hangat', d7: 'sangat tegang, ingin naik ke Do tinggi',
            d8: 'Do yang sama satu oktaf di atas: menyatu dengan acuan' }
    }
};

/* ---------- logika murni (diuji di tests/ear-training.test.js) ---------- */
const earIsKind = v => EAR_KINDS.some(k => k[0] === v);
const earLevels = kind => kind === 'akor' || !EAR_X[kind] ? EAR_LEVELS : EAR_X[kind].levels;
const earLabels = kind => kind === 'akor' || !EAR_X[kind] ? EAR_LABEL : EAR_X[kind].labels;
const earName = (kind, id) => kind === 'akor' ? (EAR_Q[id] || {}).n : (EAR_X[kind] ? EAR_X[kind].names[id] : undefined);
const earNames = kind => kind === 'akor' ? Object.keys(EAR_Q).reduce((o, k) => { o[k] = EAR_Q[k].n; return o; }, {}) : EAR_X[kind].names;
const earN = m => noteStrings[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
// kunci penyimpanan per jenis; 'akor' memakai kunci lama supaya data lama tetap terbaca
const earKeys = kind => kind === 'akor' || !kind ? { best: l => l, st: 'st', conf: 'conf' } : { best: l => kind + '.' + l, st: 'st_' + kind, conf: 'conf_' + kind };

function earShuffle(a, rnd) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

// n soal seimbang dari daftar jawaban qs: tiap jawaban muncul hampir sama banyak, urutannya diacak
function earDeckOf(qs, n, rnd) {
    rnd = rnd || Math.random;
    const off = Math.floor(rnd() * qs.length), d = [];
    for (let i = 0; i < n; i++) d.push(qs[(i + off) % qs.length]);
    return earShuffle(d, rnd);
}
function earDeck(level, n, rnd) { return earDeckOf(EAR_LEVELS[level] || EAR_LEVELS.mudah, n, rnd); }
// nada dasar acak, tidak sama dengan soal sebelumnya (supaya telinga menilai jenisnya, bukan hafal nadanya)
function earRoot(prev, rnd) {
    rnd = rnd || Math.random; let r;
    do { r = noteStrings[Math.floor(rnd() * 12)]; } while (r === prev);
    return r;
}
// jadwal petikan: dipetik serempak ala strum (35 ms antar senar) atau satu-satu naik (280 ms)
function earPlan(fing, arp) {
    const out = []; let k = 0;
    fing.forEach((fret, s) => { if (fret < 0) return; out.push({ s, fret, at: arp ? k * 0.28 : s * 0.035 }); k++; });
    return out;
}
// kata nama jenis yang dipakai earWeak/earTopConf: nm = peta id -> nama (bila kosong dipakai jenis akor)
function earWeak(st, nm) {   // jawaban dengan akurasi terendah (minimal 5 soal)
    const known = id => nm ? !!nm[id] : !!EAR_Q[id];
    let w = null;
    Object.keys(st || {}).forEach(id => {
        const a = st[id]; if (!known(id) || !a || a[0] < 5) return;
        const pct = Math.round(a[1] / a[0] * 100); if (!w || pct < w.pct) w = { id, pct, n: a[0] };
    });
    return w;
}
function earTopConf(conf, nm) {   // tebakan keliru yang paling sering (minimal 2 kali)
    const known = id => nm ? !!nm[id] : !!EAR_Q[id];
    let b = null;
    Object.keys(conf || {}).forEach(k => {
        const p = k.split('>'), want = p[0], got = p[1]; if (!known(want) || !known(got) || conf[k] < 2) return;
        if (!b || conf[k] > b.n) b = { want, got, n: conf[k] };
    });
    return b;
}

// lima nada dari tangga nada mayor dengan kontur sesuai q; langkah 1–3 derajat, seluruh nada di dalam ±1,7 oktaf
function earMelody(q, level, ri, rnd) {
    const sg = EAR_SIGNS[q], mags = level === 'mudah' ? [2, 3] : level === 'sedang' ? [1, 2, 3] : [1, 2];
    let idx, lo, hi, tries = 0;
    const walk = pick => { idx = [0]; sg.forEach(s => idx.push(idx[idx.length - 1] + s * pick())); lo = Math.min.apply(null, idx); hi = Math.max.apply(null, idx); };
    do { walk(() => mags[Math.floor(rnd() * mags.length)]); tries++; } while (hi - lo > 11 && tries < 20);
    if (hi - lo > 11) walk(() => 2);
    const start = -lo + Math.floor(rnd() * (11 - (hi - lo) + 1));
    return idx.map(i => 45 + ri + EAR_OFF(i + start));
}

// susun satu soal jenis lanjutan: hasilnya {seq:[{m (nomor MIDI), at (detik)}]} atau {keys:[akor]} untuk urutan akor
function earBuild(kind, level, q, root, rnd) {
    rnd = rnd || Math.random;
    const ri = Math.max(0, noteStrings.indexOf(root));
    if (kind === 'interval') { const lo = 48 + ri, hi = lo + EAR_INT[q]; return { lo, hi, seq: [{ m: lo, at: 0 }, { m: hi, at: 0.9 }] }; }
    if (kind === 'progresi') return { keys: EAR_PROG[q].c.map(c => noteStrings[(ri + c[0]) % 12] + c[1]) };
    if (kind === 'melodi') { const m = earMelody(q, level, ri, rnd); return { midis: m, seq: m.map((x, i) => ({ m: x, at: i * 0.55 })) }; }
    if (kind === 'nada') {
        if (level === 'mudah') {
            const lo = 48 + ri, hi = lo + 3 + Math.floor(rnd() * 7), a = q === 'p1' ? hi : lo, b = q === 'p1' ? lo : hi;
            return { a, b, seq: [{ m: a, at: 0 }, { m: b, at: 0.9 }] };
        }
        const t = 52 + ri, m = t + EAR_DEG[q];
        return { t, m, seq: [{ m: t, at: 0 }, { m, at: 1.1 }] };
    }
    return null;
}

/* ---------- data lokal ---------- */
const earData = () => { const d = lsGet(EAR_KEY, {}); return d && typeof d === 'object' && !Array.isArray(d) ? d : {}; };
const earSaveData = d => lsSet(EAR_KEY, d);
function earRecord(want, got, kind) {
    const K = earKeys(kind), d = earData(); d[K.st] = d[K.st] && typeof d[K.st] === 'object' ? d[K.st] : {};
    const s = d[K.st][want] = d[K.st][want] || [0, 0]; s[0]++; if (want === got) s[1]++;
    if (want !== got) { d[K.conf] = d[K.conf] && typeof d[K.conf] === 'object' ? d[K.conf] : {}; const k = want + '>' + got; d[K.conf][k] = (d[K.conf][k] || 0) + 1; }
    earSaveData(d);
}
function earOpts() {
    const d = earData(), ks = document.getElementById('earKind'), l = document.getElementById('earLevel'), a = document.getElementById('earArp');
    const kind = ks && earIsKind(ks.value) ? ks.value : (earIsKind(d.kind) ? d.kind : 'akor'), lv = earLevels(kind);
    const saved = kind === 'akor' ? d.lvl : (d.kl || {})[kind];
    return { kind, lvl: l && lv[l.value] ? l.value : (lv[saved] ? saved : 'mudah'), arp: a ? !!a.checked : !!d.arp };
}
function earOpt() {
    const o = earOpts(), d = earData(); d.kind = o.kind; d.arp = o.arp;
    if (o.kind === 'akor') d.lvl = o.lvl; else { d.kl = d.kl && typeof d.kl === 'object' ? d.kl : {}; d.kl[o.kind] = o.lvl; }
    earSaveData(d); ear = null; earRender();
}
function earFillLevels(kind) {
    const l = document.getElementById('earLevel'); if (!l) return;
    const lv = earLevels(kind), lb = earLabels(kind), d = earData(), saved = kind === 'akor' ? d.lvl : (d.kl || {})[kind];
    l.innerHTML = Object.keys(lv).map(k => `<option value="${k}">${lb[k]}</option>`).join('');
    if (lv[saved]) l.value = saved;
}
function earKindChange() {
    const ks = document.getElementById('earKind'), d = earData();
    if (ks && earIsKind(ks.value)) d.kind = ks.value;
    earSaveData(d); earFillLevels(earIsKind(d.kind) ? d.kind : 'akor'); earOpt();
}

/* ---------- suara ---------- */
function earPlay(root, id, arp) {
    const q = EAR_Q[id], c = q && chordDatabase[root + q.sfx]; if (!c) return;
    try {
        const ctx = audioCtx(), t0 = ctx.currentTime + 0.05;
        earPlan(c.variants[0].fingering, arp).forEach(p => pluckNote(ctx, mf(STD_MIDI[p.s] + p.fret), t0 + p.at, 1, arp ? 2.4 : 2.1));
    } catch (e) { console.error(e); }
}
// jenis lanjutan: urutan akor dipetik serempak 1,15 dtk per akor; lainnya nada tunggal berurutan
function earPlayP(kind, p) {
    if (!p) return;
    try {
        const ctx = audioCtx(), t0 = ctx.currentTime + 0.05;
        if (kind === 'progresi') {
            p.keys.forEach((k, i) => { const c = chordDatabase[k]; if (c) earPlan(c.variants[0].fingering, false).forEach(x => pluckNote(ctx, mf(STD_MIDI[x.s] + x.fret), t0 + i * 1.15 + x.at, 1, 2.1)); });
            return;
        }
        (p.seq || []).forEach(n => pluckNote(ctx, mf(n.m), t0 + n.at, 1, kind === 'melodi' ? 1.2 : 1.8));
    } catch (e) { console.error(e); }
}
function earReplay() { if (ear && !ear.done) { if (ear.kind === 'akor') earPlay(ear.root, ear.q, ear.arp); else earPlayP(ear.kind, ear.p); } }
// setelah menjawab: ketuk pilihan untuk membandingkan bunyinya (jawaban benar memutar soal yang sama)
function earPlayOption(id) {
    if (ear.kind === 'akor') { earPlay(ear.root, id, ear.arp); return; }
    earPlayP(ear.kind, id === ear.q ? ear.p : earBuild(ear.kind, ear.level, id, ear.root, () => 0.4));
}

/* ---------- alur ronde ---------- */
function earStart() {
    if (typeof dr !== 'undefined' && dr) { pcToast('Hentikan latihan mikrofon dulu'); return; }
    const o = earOpts();
    ear = { kind: o.kind, level: o.lvl, arp: o.arp, deck: earDeckOf(earLevels(o.kind)[o.lvl], EAR_LEN), i: -1, ok: 0, bad: 0, res: [], active: 0, prev: null, done: false };
    earNext();
}
function earNext() {
    if (!ear) return;
    ear.i++;
    if (ear.i >= EAR_LEN) { earFinish(); return; }
    ear.q = ear.deck[ear.i]; ear.root = earRoot(ear.prev); ear.prev = ear.root;
    ear.p = ear.kind === 'akor' ? null : earBuild(ear.kind, ear.level, ear.q, ear.root);
    ear.answered = false; ear.picked = null; ear.tq = performance.now();
    earRender(); earReplay();
}
function earAnswer(id) {
    if (!ear || ear.done || ear.i < 0 || !earLevels(ear.kind)[ear.level].includes(id)) return;
    if (ear.answered) { earPlayOption(id); return; }
    ear.answered = true; ear.picked = id;
    ear.active += Math.min(60, Math.max(0, (performance.now() - ear.tq) / 1000));   // waktu diam tidak dihitung lebih dari 60 dtk per soal
    const right = id === ear.q; if (right) ear.ok++; else ear.bad++;
    ear.res[ear.i] = right; earRecord(ear.q, id, ear.kind); earRender();
}
function earFinish() {
    const d = earData(), bk = earKeys(ear.kind).best(ear.level); d.best = d.best && typeof d.best === 'object' ? d.best : {};
    ear.newBest = ear.ok > 0 && ear.ok > (d.best[bk] || 0);
    if (ear.newBest) d.best[bk] = ear.ok;
    earSaveData(d); earLogSession();
    ear.done = true; earRender();
}
// catat sebagai sesi latihan (streak, total waktu, lencana, sinkron). cpm = 0 supaya tidak mengisi lencana akor/menit.
function earLogSession() {
    try {
        const lvl = ear.kind === 'akor' ? ear.level : ear.kind + '-' + ear.level, now = new Date();
        const c = cleanSession({ id: newId(), mode: 'ear', level: lvl, dur: Math.max(1, Math.round(ear.active)), ok: ear.ok, bad: ear.bad, cpm: 0, played_at: now.toISOString(), day: dayKey(now) });
        if (!c) return;
        const ss = getSessions(); ss.push(c); setSessions(ss);
        if (typeof pendingAnnounce !== 'undefined') pendingAnnounce = true;
        if (typeof renderStreak === 'function') renderStreak();
        if (window.pcSyncSoon) window.pcSyncSoon();
    } catch (e) { console.error(e); }
}

/* ---------- tampilan ---------- */
function earStatsHTML() {
    const d = earData(), o = earOpts(), k = o.kind, K = earKeys(k), nm = k === 'akor' ? null : earNames(k), p = [];
    const best = (d.best || {})[K.best(o.lvl)]; if (best) p.push('🏆 Rekor tingkat ' + o.lvl + ': <strong>' + best + '/' + EAR_LEN + '</strong>');
    const w = earWeak(d[K.st], nm); if (w) p.push('Paling sulit dibedakan: <strong>' + esc(earName(k, w.id)) + '</strong> (benar ' + w.pct + '% dari ' + w.n + ' soal)');
    const c = earTopConf(d[K.conf], nm); if (c) p.push('Sering tertukar: <strong>' + esc(earName(k, c.want)) + '</strong> kamu kira <strong>' + esc(earName(k, c.got)) + '</strong> (' + c.n + '×)');
    return p.join('<br>');
}

// penjelasan jawaban untuk jenis lanjutan
function earFbText() {
    const k = ear.kind, q = ear.q, N = esc(earName(k, q)), H = esc(EAR_X[k].hint[q] || ''), p = ear.p;
    if (k === 'interval') return `Tadi ${earN(p.lo)} → ${earN(p.hi)}: <strong>${N}</strong> (${p.hi - p.lo} semitone), ${H}.`;
    if (k === 'progresi') return `Tadi <strong>${N}</strong> pada kunci ${esc(ear.root)}: ${p.keys.map(esc).join(' – ')}. ${H}.`;
    if (k === 'melodi') return `Tadi arahnya <strong>${N}</strong> (${p.midis.map(earN).join(' → ')}): ${H}.`;
    if (ear.level === 'mudah') return `Tadi ${earN(p.a)} lalu ${earN(p.b)}: <strong>${N}</strong>, ${H}.`;
    return `Acuan Do = ${earN(p.t)}; nada tadi <strong>${N}</strong> = ${earN(p.m)}: ${H}.`;
}

function earRender() {
    const st = document.getElementById('earStage'); if (!st) return;
    const kind = ear ? ear.kind : earOpts().kind, X = kind === 'akor' ? null : EAR_X[kind];
    const lb = document.getElementById('earArpLbl'); if (lb) lb.hidden = kind !== 'akor';   // "petik satu-satu" hanya untuk akor
    let h = '';
    if (!ear) {
        h = `<p class="vc-fit" style="margin-top:0">${X ? esc(X.intro) + ` Satu ronde ${EAR_LEN} soal.` : `Satu ronde ${EAR_LEN} soal. App memainkan sebuah akor, kamu memilih jenisnya.`} Pakai headset bila bisa. Tidak perlu mikrofon.</p>
            <button class="btn-primary" onclick="earStart()">▶ Mulai ronde (${EAR_LEN} soal)</button>`;
    } else if (ear.done) {
        const acc = Math.round(ear.ok / EAR_LEN * 100), qs = earLevels(ear.kind)[ear.level];
        const rows = qs.map(id => { const n = ear.deck.filter(x => x === id).length, k = ear.deck.filter((x, i) => x === id && ear.res[i]).length; return esc(earName(ear.kind, id)) + ': ' + k + '/' + n; }).join('<br>');
        const msg = acc >= 90 ? 'Telingamu tajam! Coba tingkat berikutnya.' : acc >= 70 ? 'Bagus. Sedikit lagi.' : 'Terus berlatih. Ketuk pilihan setelah menjawab untuk membandingkan bunyinya.';
        h = `<div class="ear-score"><b>${ear.ok}/${EAR_LEN}</b><span>benar · ${acc}%</span></div>
            ${ear.newBest ? '<div class="ear-fb ok" role="status">🏆 Rekor baru untuk tingkat ini</div>' : ''}
            <div class="chord-detail-row" style="margin-top:10px">${rows}</div>
            <div class="chord-detail-row">${msg}</div>
            <button class="btn-primary" onclick="earStart()">↻ Main lagi</button>`;
    } else {
        const qs = earLevels(ear.kind)[ear.level], right = ear.answered && ear.picked === ear.q;
        const dots = Array.from({ length: EAR_LEN }, (_, i) => `<i class="${ear.res[i] === true ? 'ok' : ear.res[i] === false ? 'bad' : i === ear.i ? 'cur' : ''}"></i>`).join('');
        h = `<div class="ear-top"><strong>Soal ${ear.i + 1} dari ${EAR_LEN}</strong><span>benar ${ear.ok} · salah ${ear.bad}</span></div>
            <div class="ear-dots" aria-hidden="true">${dots}</div>
            <button class="btn-audio ear-play" onclick="earReplay()">🔊 Dengar lagi</button>
            <div class="ear-opts" role="group" aria-label="Pilih jawaban">${qs.map(id => {
                const cls = ear.answered ? (id === ear.q ? ' right' : id === ear.picked ? ' wrong' : '') : '';
                return `<button class="ear-opt${cls}" onclick="earAnswer('${id}')">${esc(earName(ear.kind, id))}</button>`;
            }).join('')}</div>`;
        if (ear.answered) {
            let fb;
            if (ear.kind === 'akor') {
                const c = chordDatabase[ear.root + EAR_Q[ear.q].sfx];
                fb = `Akor tadi <strong>${esc(c.key)}</strong> (${esc(EAR_Q[ear.q].n)}): ${esc(EAR_Q[ear.q].hint)}.<br><small>Nada: ${c.notes.join(' - ')}. Ketuk pilihan di atas untuk membandingkan bunyinya.</small>`;
            } else fb = `${earFbText()}<br><small>Ketuk pilihan di atas untuk membandingkan bunyinya.</small>`;
            h += `<div class="ear-fb ${right ? 'ok' : 'bad'}" role="status">${right ? '✓ Benar!' : '✗ Bukan itu, kamu memilih ' + esc(earName(ear.kind, ear.picked)) + '.'} ${fb}</div>
                <button class="btn-primary" onclick="earNext()">${ear.i + 1 >= EAR_LEN ? 'Lihat hasil' : 'Berikutnya ▶'}</button>`;
        }
    }
    st.innerHTML = h;
    const se = document.getElementById('earStats'); if (se) se.innerHTML = earStatsHTML();
}

function earInit() {
    const l = document.getElementById('earLevel'), a = document.getElementById('earArp'), ks = document.getElementById('earKind'); if (!l) return;
    const d = earData(), kind = earIsKind(d.kind) ? d.kind : 'akor';
    if (ks) { ks.innerHTML = EAR_KINDS.map(k => `<option value="${k[0]}">${k[1]}</option>`).join(''); ks.value = kind; }
    earFillLevels(kind);
    if (a) a.checked = !!d.arp;
    earRender();
}
earInit();
