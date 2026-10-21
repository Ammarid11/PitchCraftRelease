/* Pitchcraft — Latih Telinga (roadmap #11): app memainkan bunyi, kamu menebaknya. Satu ronde = 10 soal.
 * Tujuh jenis latihan: jenis akor, interval, urutan akor (angka romawi), arah melodi, nada (lebih tinggi/rendah, derajat Do–Si), nama nada (C, C#, …), dan nama akor (C, Dm, …).
 * Memakai mesin suara Karplus-Strong yang sudah ada (pluckNote). TIDAK memakai mikrofon dan tidak menyentuh deteksi nada/akor.
 * Bunyi selalu tuning standar tanpa capo. Tingkat: mudah, sedang, sulit (jenis nama nada dan nama akor punya tingkat ke-4, ahli, tanpa nada/akor acuan).
 * Hasil ronde dicatat sebagai sesi ber-ID (mode 'ear'; level = tingkat untuk akor, "jenis-tingkat" untuk yang lain) sehingga ikut streak, total latihan, lencana, dan sinkron akun.
 * Statistik disimpan di 'pc_ear'. Angka hasilnya (rekor, benar/salah per jawaban, tebakan tertukar) ikut cadangan dan sinkron akun lewat store.js/sync.js;
 * pilihan tampilan dan ringkasan ronde terakhir tetap per perangkat. */

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
const EAR_KINDS = [['akor', 'Jenis akor'], ['interval', 'Interval'], ['progresi', 'Urutan akor'], ['melodi', 'Arah melodi'], ['nada', 'Nada (derajat)'], ['namanada', 'Nama nada'], ['akorkey', 'Nama akor']];
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
    },
    // tebak NAMA nada (C, C#, D, …): tingkat Mudah–Sulit diawali nada acuan C, tingkat Ahli tanpa acuan sama sekali
    namanada: {
        intro: 'App memainkan nada acuan lalu satu nada lain; kamu menebak nama nada kedua dengan mengukur jaraknya dari acuan. Acuan bisa mengikuti kunci di panel 🎼, berganti-ganti, atau selalu C (pilihan Acuan). Tingkat Ahli tanpa acuan sama sekali dan melatih telinga mutlak.',
        levels: { mudah: ['C', 'E', 'G', 'A'], sedang: ['C', 'D', 'E', 'F', 'G', 'A', 'B'], sulit: noteStrings.slice(), ahli: noteStrings.slice() },
        labels: { mudah: 'Mudah · 4 nada', sedang: 'Sedang · 7 nada', sulit: 'Sulit · 12 nada', ahli: 'Ahli · 12 nada tanpa acuan' },
        names: noteStrings.reduce((o, k) => { o[k] = k + (FLAT[k] ? '/' + FLAT[k] : ''); return o; }, {}),
        hint: noteStrings.reduce((o, k) => { o[k] = k.length > 1 ? 'nada hitam di piano' : 'nada putih di piano'; return o; }, {})
    },

    // tebak NAMA akor (C, Dm, G, …): tingkat Mudah–Sulit diawali akor acuan C mayor, tingkat Ahli tanpa acuan
    akorkey: {
        intro: 'App memainkan sebuah akor; kamu menebak namanya. Mudah sampai Sulit diawali akor acuan C mayor, jadi dengarkan hubungannya dengan C. Tingkat Ahli tanpa acuan sama sekali.',
        levels: { mudah: ['C', 'F', 'G', 'Am'], sedang: ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim'], sulit: ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim', 'D', 'E', 'A', 'A#', 'Fm'], ahli: ['C', 'D', 'E', 'F', 'G', 'A', 'Am', 'Dm', 'Em', 'Bm'] },
        labels: { mudah: 'Mudah · acuan C, 4 akor', sedang: 'Sedang · acuan C, 7 akor', sulit: 'Sulit · acuan C, 12 akor', ahli: 'Ahli · 10 akor tanpa acuan' },
        names: ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim', 'D', 'E', 'A', 'A#', 'Fm', 'Bm'].reduce((o, k) => { o[k] = k.replace(/^[A-G]#/, m => m + '/' + FLAT[m]); return o; }, {}),
        hint: { C: 'dalam kunci C: akor I, sama dengan acuan, terasa pulang', Dm: 'dalam kunci C: akor ii (minor), lembut dan mengalir ke G', Em: 'dalam kunci C: akor iii (minor), sendu dan tenang',
            F: 'dalam kunci C: akor IV, terbuka dan hangat', G: 'dalam kunci C: akor V, cerah dan menarik pulang ke C', Am: 'dalam kunci C: akor vi (minor), sendu, kerabat minor dari C',
            Bdim: 'dalam kunci C: akor vii° (diminished), tegang dan ingin pindah ke C', D: 'dalam kunci C: akor II mayor, di luar tangga nada C, cerah tapi terasa “asing”',
            E: 'dalam kunci C: akor III mayor, di luar tangga nada C, terdengar dramatis', A: 'dalam kunci C: akor VI mayor, di luar tangga nada C, kuat menuju Dm',
            'A#': 'dalam kunci C: akor ♭VII (Bb), terdengar rock dan terbuka', Fm: 'dalam kunci C: akor iv minor, pinjaman dari C minor, sendu dan dramatis',
            Bm: 'dalam kunci C: Bm di luar tangga nada C, minor dengan bentuk barre' }
    }
};


/* ---------- panduan cara latihan tiap jenis (tampil di layar awal dan di atas tiap soal) ---------- */
const EAR_GUIDE = {
    akor: { task: 'Dengarkan akornya, lalu pilih jenisnya (mayor, minor, dst.).',
        steps: ['Tekan Mulai: app langsung membunyikan satu akor. Tekan “🔊 Dengar lagi” sebanyak yang kamu mau.', 'Rasakan “warna” bunyinya: cerah (mayor), sendu (minor), menggantung (dominan 7, sus4), lembut dan melayang (maj7).', 'Pilih jenis akor yang menurutmu cocok. Nada dasarnya berganti acak, jadi yang ditebak adalah jenisnya, bukan namanya.'],
        tip: 'Mulai dari tingkat Mudah (mayor lawan minor). “Petik satu-satu” membunyikan senar bergantian supaya tiap nada lebih jelas.' },
    interval: { task: 'Dengarkan dua nada berurutan, lalu pilih jaraknya.',
        steps: ['App membunyikan dua nada berurutan; nada kedua selalu lebih tinggi dari yang pertama.', 'Rasakan jarak antara keduanya, bukan nama nadanya. Coba senandungkan nada pertama lalu kedua.', 'Pilih intervalnya. Pegangan: m3 terasa sendu, M3 cerah, P4 terbuka, P5 lapang dan kokoh, P8 terdengar menyatu.'],
        tip: 'Mulai dari Mudah (m3, M3, P5, P8). Setelah menjawab, ketuk interval lain untuk membandingkan rasanya.' },
    progresi: { task: 'Dengarkan empat akor berurutan, lalu pilih polanya (angka romawi).',
        steps: ['App membunyikan empat akor berurutan dalam kunci acak.', 'Abaikan nama akornya. Dengarkan arah geraknya: mana akor yang terasa seperti “rumah” (I), mana yang sendu (vi), mana yang menarik pulang (V).', 'Pilih polanya. Angka romawi besar = akor mayor, huruf kecil = minor (mis. vi). Contoh I–V–vi–IV: rumah, cerah, sendu, hangat.'],
        tip: 'Hafalkan dulu dua pola Mudah (I–V–vi–IV dan I–IV–V–I), baru tambah pola lain.' },
    melodi: { task: 'Dengarkan lima nada berurutan, lalu pilih arah geraknya.',
        steps: ['Lima nada dibunyikan satu per satu.', 'Ikuti dengan tanganmu: naik, turun, atau berbalik arah di tengah?', 'Pilih bentuknya. Naik lalu turun = seperti bukit; turun lalu naik = seperti lembah; zigzag = bergantian terus; tetap = semua nada sama tinggi.'],
        tip: 'Yang dinilai hanya arah geraknya, bukan nama nadanya.' },
    nada: { task: 'Dengarkan nadanya, lalu pilih jawabannya.',
        steps: ['Mudah: dua nada dibunyikan; pilih mana yang lebih tinggi (yang pertama atau kedua).', 'Sedang dan Sulit: nada pertama selalu nada acuan Do. Dengarkan nada kedua, lalu pilih derajatnya (Do, Re, Mi, Fa, Sol, La, Si, Do tinggi).', 'Trik: dari Do, senandungkan tangga nada Do–Re–Mi… sampai bertemu nada kedua.'],
        tip: 'Mi terasa cerah dan stabil, Sol kokoh, Si sangat tegang dan ingin naik ke Do tinggi.' },
    namanada: { task: 'Dengarkan nada acuan, lalu nada berikutnya, dan pilih nama nada kedua.',
        steps: ['Mudah sampai Sulit: nada acuan dibunyikan lebih dulu, lalu satu nada target. Nama acuan selalu tertulis di layar. Menurut pilihan Acuan, ia mengikuti kunci di panel 🎼 (bawaan untuk Mudah dan Sedang), berganti tiap soal (bawaan untuk Sulit), atau selalu C.', 'Ukur jarak nada target dari acuan: makin jauh jaraknya, makin tinggi nadanya. Hitung dengan semitone (setiap tuts piano, termasuk yang hitam, = 1).', 'Pilih nama nada target. Tingkat Ahli tanpa acuan: satu nada saja, kamu menebak langsung dari ingatan nada.'],
        tip: 'Contoh: acuan D dan nada target terdengar 3 semitone di atasnya, jadi jawabannya F. Capo tidak mengubah nama nada: yang dipakai selalu nama nada yang terdengar. Bila Acuan mengikuti kunci, pilihan jawaban Mudah dan Sedang hanya nada di dalam kunci itu.' },
    akorkey: { task: 'Dengarkan akor acuan, lalu akor berikutnya, dan pilih nama akor kedua.',
        steps: ['Mudah sampai Sulit: akor acuan C mayor dibunyikan lebih dulu, lalu satu akor target.', 'Dengarkan hubungan akor target dengan C: lebih cerah, sendu, atau menggantung? Dalam kunci C: F hangat, G cerah dan menarik pulang, Am sendu, Dm lembut, Em tenang.', 'Pilih nama akornya. Tingkat Ahli tanpa acuan: satu akor saja.'],
        tip: 'Hafalkan dulu rasa F, G, dan Am terhadap C, karena itu akor yang paling sering muncul.' }
};
const EAR_ROUND_STEP = 'Satu ronde = 10 soal. Setelah menjawab, kamu melihat jawaban benar beserta penjelasannya. Ketuk pilihan mana pun untuk membandingkan bunyinya, lalu tekan Berikutnya. Skor, rekor, dan streak tercatat otomatis.';
function earTask(kind, level) {
    if (kind === 'nada') return level === 'mudah' ? 'Dengarkan dua nada, lalu pilih mana yang lebih tinggi.' : 'Nada pertama adalah acuan Do. Dengarkan nada kedua, lalu pilih derajatnya.';
    if (level === 'ahli' && kind === 'namanada') return 'Dengarkan satu nada (tanpa acuan), lalu pilih namanya.';
    if (level === 'ahli' && kind === 'akorkey') return 'Dengarkan satu akor (tanpa acuan), lalu pilih namanya.';
    return (EAR_GUIDE[kind] || EAR_GUIDE.akor).task;
}
function earGuideHTML(kind) {
    const g = EAR_GUIDE[kind] || EAR_GUIDE.akor;
    return '<ol class="ear-steps">' + g.steps.concat([EAR_ROUND_STEP]).map(t => '<li>' + esc(t) + '</li>').join('') + '</ol>' + (g.tip ? '<p class="ear-tip">💡 ' + esc(g.tip) + '</p>' : '');
}
// baris petunjuk di atas tiap soal: apa yang harus dilakukan, dan nama acuan bila ada
function earRefInfoHTML(kind) {
    if (kind !== 'namanada') return '';
    const o = earOpts(), rm = earRefMode(kind, o.lvl, o.ref);
    const t = rm === 'kunci' ? 'Acuan ikut kunci <strong>' + esc(earKeyName(earKeyInfo())) + '</strong> (ubah di panel 🎼 Kunci, lalu Terapkan).' : rm === 'acak' ? 'Acuan berganti-ganti tiap soal.' : rm === 'c' ? 'Acuan selalu <strong>C</strong>.' : 'Tingkat ini tanpa acuan.';
    return '<div class="chord-detail-row" style="margin-top:8px">' + t + '</div>';
}
function earTaskHTML() {
    const rn = pc => noteStrings[pc] + (FLAT[noteStrings[pc]] ? '/' + FLAT[noteStrings[pc]] : '');
    let ref = '';
    if (ear.kind === 'namanada' && ear.p && ear.p.ref) ref = 'Nada acuan (bunyi pertama): <strong>' + esc(rn(ear.p.refPc)) + '</strong>' + (ear.rm === 'kunci' ? ' · tonika kunci ' + esc(earKeyName(ear.key)) : '');
    else if (ear.kind === 'akorkey' && ear.p && ear.p.ref) ref = 'Akor acuan (bunyi pertama): <strong>C mayor</strong>';
    else if (ear.kind === 'nada' && ear.level !== 'mudah') ref = 'Bunyi pertama = nada acuan <strong>Do</strong>';
    return `<div class="ear-task">🎧 ${esc(earTask(ear.kind, ear.level))}${ref ? '<br><span class="ear-ref">' + ref + '</span>' : ''}</div>
        <details class="ear-how"><summary>Cara latihan</summary>${earGuideHTML(ear.kind)}</details>`;
}

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
function earBuild(kind, level, q, root, rnd, refPcFix) {
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
    if (kind === 'namanada') {   // acuan bervariasi: nada acuan dipilih acak (bukan selalu C) dan tidak sama dengan nada target
        const pi = noteStrings.indexOf(q), ref = level !== 'ahli';
        if (!ref) { const m0 = 48 + Math.max(0, pi) + (rnd() < 0.5 ? 0 : 12); return { m: m0, ref, seq: [{ m: m0, at: 0 }] }; }
        const pool = level === 'sulit' ? noteStrings.map((_, i) => i) : EAR_SC, fixed = refPcFix !== undefined && refPcFix !== null;
        let rp = fixed ? refPcFix : pool[Math.floor(rnd() * pool.length)];
        if (!fixed && rp === pi) rp = pool[(pool.indexOf(rp) + 1) % pool.length];
        // target SELALU di atas acuan (0-11 semitone; bila nadanya sama dengan acuan, boleh unison atau satu oktaf di atas),
        // supaya "makin jauh dari acuan, makin tinggi" benar untuk semua soal
        const d = (((pi - rp) % 12) + 12) % 12, m = 60 + rp + d + (d === 0 && rnd() < 0.5 ? 12 : 0);
        return { m, ref, refPc: rp, seq: [{ m: 60 + rp, at: 0 }, { m, at: 1.1 }] };
    }
    if (kind === 'akorkey') { const ref = level !== 'ahli'; return { ref, gap: 1.6, keys: ref ? ['C', q] : [q] }; }
    return null;
}


/* ---------- acuan Nama nada: ikut kunci (panel 🎼), bervariasi, atau C tetap ---------- */
const EAR_SC_MIN = [0, 2, 3, 5, 7, 8, 10], EAR_REFS = ['auto', 'kunci', 'acak', 'c'];
function earKeyInfo() {   // kunci yang sudah diterapkan di panel 🎼 (capo tidak berpengaruh: nama nada yang terdengar)
    const r = document.getElementById('keyRoot'), m = document.getElementById('keyMode');
    return { pc: (((+(r && r.value) || 0) % 12) + 12) % 12, mode: m && m.value === 'min' ? 'min' : 'maj' };
}
const earKeyName = k => noteStrings[k.pc] + (FLAT[noteStrings[k.pc]] ? '/' + FLAT[noteStrings[k.pc]] : '') + (k.mode === 'min' ? ' minor' : ' mayor');
// pilihan "auto": Mudah dan Sedang ikut kunci, Sulit bervariasi; Ahli tanpa acuan (null)
function earRefMode(kind, level, pref) {
    if (kind !== 'namanada' || level === 'ahli') return null;
    if (pref === 'kunci' || pref === 'acak' || pref === 'c') return pref;
    return level === 'sulit' ? 'acak' : 'kunci';
}
// daftar jawaban Nama nada: bila ikut kunci, Mudah = tonika, terts, kuint, sekt; Sedang = 7 nada kunci; Sulit = 12 nada
function earNoteSet(level, rm, key) {
    if (level === 'ahli' || rm !== 'kunci' || level === 'sulit') return EAR_X.namanada.levels[level].slice();
    const min = key.mode === 'min', offs = level === 'mudah' ? (min ? [0, 3, 7, 8] : [0, 4, 7, 9]) : (min ? EAR_SC_MIN : EAR_SC);
    return offs.map(o => noteStrings[(key.pc + o) % 12]);
}
const earQs = () => ear.qs || earLevels(ear.kind)[ear.level];
const earRefFix = () => ear.rm === 'kunci' ? ear.key.pc : ear.rm === 'c' ? 0 : undefined;

/* ---------- data lokal ---------- */
const earData = () => { const d = lsGet(EAR_KEY, {}); return d && typeof d === 'object' && !Array.isArray(d) ? d : {}; };
const earSaveData = d => { lsSet(EAR_KEY, d); if (window.pcSyncSoon) window.pcSyncSoon(); };
function earRefreshStats() { const se = document.getElementById('earStats'); if (se) se.innerHTML = earStatsHTML(); }
// pengumuman untuk pembaca layar (elemen #earLive berada di luar #earStage supaya tidak ikut digambar ulang)
function earSay(t) { const e = document.getElementById('earLive'); if (e) e.textContent = t; }
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
    const rf = document.getElementById('earRef'), ref = rf && EAR_REFS.includes(rf.value) ? rf.value : (EAR_REFS.includes(d.ref) ? d.ref : 'auto');
    return { kind, lvl: l && lv[l.value] ? l.value : (lv[saved] ? saved : 'mudah'), arp: a ? !!a.checked : !!d.arp, ref };
}
function earRestoreControls() {   // batal mengganti pengaturan: kembalikan pilihan ke yang dipakai ronde berjalan
    const ks = document.getElementById('earKind'), l = document.getElementById('earLevel'), a = document.getElementById('earArp'), rf = document.getElementById('earRef'), d = earData();
    d.kind = ear.kind; earSaveData(d);
    if (ks) ks.value = ear.kind; earFillLevels(ear.kind); if (l) l.value = ear.level; if (a) a.checked = !!ear.arp; if (rf) rf.value = ear.pref || 'auto';
    earRender();
}
function earOpt() {
    if (ear && !ear.done && (ear.i > 0 || ear.answered) && typeof confirm === 'function' && !confirm('Ronde sedang berjalan. Mengganti pengaturan akan membatalkan ronde ini. Lanjutkan?')) { earRestoreControls(); return; }
    const o = earOpts(), d = earData(); d.kind = o.kind; d.arp = o.arp; d.ref = o.ref;
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
// tiap pemutaran memakai bus sendiri; bunyi sebelumnya dipudarkan (80 ms) supaya "Dengar lagi" yang ditekan cepat tidak menumpuk
let earBus = null;
function earNewBus(ctx) {
    if (!ctx || !ctx.createGain || typeof guitarOut !== 'function') return undefined;
    try {
        if (earBus) { const g = earBus.gain, t = ctx.currentTime; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + 0.08); }
        const b = ctx.createGain(); b.connect(guitarOut(ctx)); earBus = b; return b;
    } catch (e) { return undefined; }
}
function earPlay(root, id, arp) {
    const q = EAR_Q[id], c = q && chordDatabase[root + q.sfx]; if (!c) return;
    try {
        const ctx = audioCtx(), t0 = ctx.currentTime + 0.05, bus = earNewBus(ctx);
        earPlan(c.variants[0].fingering, arp).forEach(p => pluckNote(ctx, mf(STD_MIDI[p.s] + p.fret), t0 + p.at, 1, arp ? 2.4 : 2.1, bus));
    } catch (e) { console.error(e); }
}
// jenis lanjutan: urutan akor dipetik serempak 1,15 dtk per akor; lainnya nada tunggal berurutan
function earPlayP(kind, p) {
    if (!p) return;
    try {
        const ctx = audioCtx(), t0 = ctx.currentTime + 0.05, bus = earNewBus(ctx);
        if (p.keys) {   // urutan akor (progresi, nama akor): dipetik serempak, berjeda p.gap detik
            const gap = p.gap || 1.15;
            p.keys.forEach((k, i) => { const c = chordDatabase[k]; if (c) earPlan(c.variants[0].fingering, false).forEach(x => pluckNote(ctx, mf(STD_MIDI[x.s] + x.fret), t0 + i * gap + x.at, 1, 2.1, bus)); });
            return;
        }
        (p.seq || []).forEach(n => pluckNote(ctx, mf(n.m), t0 + n.at, 1, kind === 'melodi' ? 1.2 : 1.8, bus));
    } catch (e) { console.error(e); }
}
function earReplay() { if (ear && !ear.done) { if (ear.kind === 'akor') earPlay(ear.root, ear.q, ear.arp); else earPlayP(ear.kind, ear.p); } }
// bunyi jawaban id untuk soal it (isi ear.log): jawaban benar memutar soal yang sama, jawaban lain dibangun dengan acuan yang sama
function earSoundOf(it, id) {
    if (!ear || !it) return;
    if (ear.kind === 'akor') { earPlay(it.root, id, ear.arp); return; }
    earPlayP(ear.kind, id === it.q ? it.p : earBuild(ear.kind, ear.level, id, it.root, () => 0.4, it.p ? it.p.refPc : undefined));
}
// setelah menjawab: ketuk pilihan untuk membandingkan bunyinya
function earPlayOption(id) { earSoundOf(ear.log[ear.i], id); }
// ulasan akhir ronde: dengar lagi tebakanmu atau jawaban yang benar untuk soal ke-i
function earReviewPlay(i, which) { const it = ear && ear.log[i]; if (it) earSoundOf(it, which === 'right' ? it.q : it.picked); }

/* ---------- alur ronde ---------- */
function earStart() {
    if (typeof dr !== 'undefined' && dr) { pcToast('Hentikan latihan mikrofon dulu'); return; }
    if (typeof isStrum !== 'undefined' && isStrum) { stopStrum(); pcToast('Mode Strum dihentikan: mikrofon akan menangkap bunyi dari speaker'); }
    const o = earOpts();
    const rm = earRefMode(o.kind, o.lvl, o.ref), key = earKeyInfo(), qs = o.kind === 'namanada' ? earNoteSet(o.lvl, rm, key) : earLevels(o.kind)[o.lvl];
    ear = { kind: o.kind, level: o.lvl, arp: o.arp, pref: o.ref, rm, key, qs, deck: earDeckOf(qs, EAR_LEN), i: -1, ok: 0, bad: 0, res: [], log: [], active: 0, prev: null, done: false };
    earNext();
}
function earNext() {
    if (!ear) return;
    ear.i++;
    if (ear.i >= EAR_LEN) { earFinish(); return; }
    ear.q = ear.deck[ear.i]; ear.root = earRoot(ear.prev); ear.prev = ear.root;
    ear.p = ear.kind === 'akor' ? null : earBuild(ear.kind, ear.level, ear.q, ear.root, undefined, ear.kind === 'namanada' ? earRefFix() : undefined);
    ear.answered = false; ear.picked = null; ear.tq = performance.now();
    earSay('Soal ' + (ear.i + 1) + ' dari ' + EAR_LEN + '. Dengarkan bunyinya lalu pilih jawaban.');
    earRender(); earReplay();
}
function earAnswer(id) {
    if (!ear || ear.done || ear.i < 0 || !earQs().includes(id)) return;
    if (ear.answered) { earPlayOption(id); return; }
    ear.answered = true; ear.picked = id;
    ear.active += Math.min(60, Math.max(0, (performance.now() - ear.tq) / 1000));   // waktu diam tidak dihitung lebih dari 60 dtk per soal
    const right = id === ear.q; if (right) ear.ok++; else ear.bad++;
    ear.res[ear.i] = right; ear.log[ear.i] = { q: ear.q, picked: id, root: ear.root, p: ear.p, right };   // bahan ulasan akhir ronde
    earRecord(ear.q, id, ear.kind);
    earRender();
    const fb = document.getElementById('earFb');   // pengumuman: hasil + penjelasan (teks polos dari kotak umpan balik)
    earSay((right ? 'Benar. ' : 'Salah. Kamu memilih ' + earName(ear.kind, id) + '. ') + ((fb && fb.textContent) || 'Jawaban yang benar ' + earName(ear.kind, ear.q) + '.'));
}
function earFinish() {
    const d = earData(), bk = earKeys(ear.kind).best(ear.level); d.best = d.best && typeof d.best === 'object' ? d.best : {};
    ear.newBest = ear.ok > 0 && ear.ok > (d.best[bk] || 0);
    if (ear.newBest) d.best[bk] = ear.ok;
    d.last = { kind: ear.kind, level: ear.level, ok: ear.ok, bad: ear.bad, dur: Math.max(1, Math.round(ear.active)), t: Date.now(), best: !!ear.newBest };   // untuk kartu bagikan (per perangkat)
    earSaveData(d); earLogSession();
    ear.done = true;
    earSay('Ronde selesai. ' + ear.ok + ' dari ' + EAR_LEN + ' benar, akurasi ' + Math.round(ear.ok / EAR_LEN * 100) + ' persen.' + (ear.newBest ? ' Rekor baru untuk tingkat ini.' : '') + (ear.bad ? ' Ulasan soal yang salah ada di bawah.' : ''));
    earRender();
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
    if (k === 'namanada' && p.ref) {
        const d = (noteStrings.indexOf(q) - p.refPc + 12) % 12, dd = p.m - (60 + p.refPc), rn = noteStrings[p.refPc] + (FLAT[noteStrings[p.refPc]] ? '/' + FLAT[noteStrings[p.refPc]] : '');
        let kd = '';
        if (ear.rm === 'kunci') { const i = (ear.key.mode === 'min' ? EAR_SC_MIN : EAR_SC).indexOf(d); kd = i >= 0 ? `derajat ke-${i + 1} kunci ${esc(earKeyName(ear.key))}; ` : 'di luar tangga nada kunci; '; }
        return `Acuan <strong>${rn}</strong>, nada tadi ${earN(p.m)}: <strong>${N}</strong>, ${dd === 12 ? 'tepat satu oktaf di atas acuan' : dd ? dd + ' semitone di atas acuan' : 'sama dengan acuan'} (${kd}${H}).`;
    }
    if (k === 'namanada') return `Tadi ${earN(p.m)}: <strong>${N}</strong>, ${H}.`;
    if (k === 'akorkey') return `Tadi <strong>${N}</strong> (nada: ${chordDatabase[q].notes.join(' - ')}): ${H}.`;
    if (ear.level === 'mudah') return `Tadi ${earN(p.a)} lalu ${earN(p.b)}: <strong>${N}</strong>, ${H}.`;
    return `Acuan Do = ${earN(p.t)}; nada tadi <strong>${N}</strong> = ${earN(p.m)}: ${H}.`;
}

function earRender() {
    const st = document.getElementById('earStage'); if (!st) return;
    const kind = ear ? ear.kind : earOpts().kind, X = kind === 'akor' ? null : EAR_X[kind];
    const lb = document.getElementById('earArpLbl'); if (lb) lb.hidden = kind !== 'akor';   // "petik satu-satu" hanya untuk akor
    const rl = document.getElementById('earRefLbl'); if (rl) rl.hidden = !(kind === 'namanada' && earOpts().lvl !== 'ahli');   // pilihan Acuan hanya untuk Nama nada
    let h = '';
    if (!ear) {
        h = `<p class="vc-fit" style="margin-top:0">${X ? esc(X.intro) : 'App memainkan sebuah akor, kamu memilih jenisnya.'} Pakai headset bila bisa. Tidak perlu mikrofon.</p>
            ${earRefInfoHTML(kind)}<div class="ear-how open"><strong>Cara latihan</strong>${earGuideHTML(kind)}</div>
            <button class="btn-primary" onclick="earStart()">▶ Mulai ronde (${EAR_LEN} soal)</button>`;
    } else if (ear.done) {
        const acc = Math.round(ear.ok / EAR_LEN * 100), qs = earQs();
        const rows = qs.map(id => { const n = ear.deck.filter(x => x === id).length, k = ear.deck.filter((x, i) => x === id && ear.res[i]).length; return esc(earName(ear.kind, id)) + ': ' + k + '/' + n; }).join('<br>');
        const msg = acc >= 90 ? 'Telingamu tajam! Coba tingkat berikutnya.' : acc >= 70 ? 'Bagus. Sedikit lagi.' : 'Terus berlatih. Ketuk pilihan setelah menjawab untuk membandingkan bunyinya.';
        const wrong = ear.log.map((it, i) => ({ it, i })).filter(x => x.it && !x.it.right);
        const review = wrong.length
            ? `<div class="ear-review"><div class="field-label">Ulasan: soal yang salah (${wrong.length})</div>` + wrong.map(({ it, i }) =>
                `<div class="ear-rv"><div>Soal ${i + 1}: kamu memilih <strong>${esc(earName(ear.kind, it.picked))}</strong>, jawaban yang benar <strong>${esc(earName(ear.kind, it.q))}</strong>.</div>` +
                `<div class="picker-row"><button class="btn-variant" onclick="earReviewPlay(${i},'pick')">🔊 Tebakanmu</button><button class="btn-variant" onclick="earReviewPlay(${i},'right')">🔊 Jawaban benar</button></div></div>`).join('') + '</div>'
            : '<div class="chord-detail-row">Semua jawaban benar, tidak ada yang perlu diulas. 🎉</div>';
        h = `<div class="ear-score"><b>${ear.ok}/${EAR_LEN}</b><span>benar · ${acc}%</span></div>
            ${ear.newBest ? '<div class="ear-fb ok">🏆 Rekor baru untuk tingkat ini</div>' : ''}
            <div class="chord-detail-row" style="margin-top:10px">${rows}</div>
            <div class="chord-detail-row">${msg}</div>
            ${review}
            <button class="btn-primary" onclick="earStart()">↻ Main lagi</button>
            <div class="picker-row" style="margin-top:8px"><button class="btn-variant" onclick="scOpen('ear')" title="Gambar hasil ronde untuk WhatsApp / Story">🖼 Bagikan hasil ronde</button></div>`;
    } else {
        const qs = earQs(), right = ear.answered && ear.picked === ear.q;
        const dots = Array.from({ length: EAR_LEN }, (_, i) => `<i class="${ear.res[i] === true ? 'ok' : ear.res[i] === false ? 'bad' : i === ear.i ? 'cur' : ''}"></i>`).join('');
        h = `<div class="ear-top"><strong>Soal ${ear.i + 1} dari ${EAR_LEN}</strong><span>benar ${ear.ok} · salah ${ear.bad}</span></div>
            <div class="ear-dots" aria-hidden="true">${dots}</div>
            ${earTaskHTML()}<button class="btn-audio ear-play" onclick="earReplay()">🔊 Dengar lagi</button>
            <div class="ear-opts" role="group" aria-label="Pilih jawaban">${qs.map(id => {
                const cls = ear.answered ? (id === ear.q ? ' right' : id === ear.picked ? ' wrong' : '') : '';
                const mark = cls === ' right' ? '✓ ' : cls === ' wrong' ? '✗ ' : '';   // penanda bukan hanya warna
                const lab = cls === ' right' ? ' aria-label="' + esc(earName(ear.kind, id)) + ', jawaban benar"' : cls === ' wrong' ? ' aria-label="' + esc(earName(ear.kind, id)) + ', jawabanmu, salah"' : '';
                return `<button class="ear-opt${cls}"${lab} onclick="earAnswer('${id}')">${mark}${esc(earName(ear.kind, id))}</button>`;
            }).join('')}</div>`;
        if (ear.answered) {
            let fb;
            if (ear.kind === 'akor') {
                const c = chordDatabase[ear.root + EAR_Q[ear.q].sfx];
                fb = `Akor tadi <strong>${esc(c.key)}</strong> (${esc(EAR_Q[ear.q].n)}): ${esc(EAR_Q[ear.q].hint)}.<br><small>Nada: ${c.notes.join(' - ')}. Ketuk pilihan di atas untuk membandingkan bunyinya.</small>`;
            } else fb = `${earFbText()}<br><small>Ketuk pilihan di atas untuk membandingkan bunyinya.</small>`;
            h += `<div id="earFb" class="ear-fb ${right ? 'ok' : 'bad'}">${right ? '✓ Benar!' : '✗ Bukan itu, kamu memilih ' + esc(earName(ear.kind, ear.picked)) + '.'} ${fb}</div>
                <button class="btn-primary" onclick="earNext()">${ear.i + 1 >= EAR_LEN ? 'Lihat hasil' : 'Berikutnya ▶'}</button>`;
        }
    }
    st.innerHTML = h;
    earRefreshStats();
}

function earInit() {
    const l = document.getElementById('earLevel'), a = document.getElementById('earArp'), ks = document.getElementById('earKind'); if (!l) return;
    const d = earData(), kind = earIsKind(d.kind) ? d.kind : 'akor';
    if (ks) { ks.innerHTML = EAR_KINDS.map(k => `<option value="${k[0]}">${k[1]}</option>`).join(''); ks.value = kind; }
    earFillLevels(kind);
    if (a) a.checked = !!d.arp;
    const rf = document.getElementById('earRef'); if (rf) rf.value = EAR_REFS.includes(d.ref) ? d.ref : 'auto';
    earRender();
}
earInit();

// kunci diterapkan di panel 🎼 -> layar awal ikut diperbarui (tidak mengganggu ronde yang berjalan)
if (typeof renderKey === 'function') { const _rkEar = renderKey; renderKey = function () { _rkEar.apply(this, arguments); if (!ear) earRender(); }; }
