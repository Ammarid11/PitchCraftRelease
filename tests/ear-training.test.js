/* Pitchcraft — tes Latih Telinga (js/ear-training.js): soal seimbang, jadwal petikan, alur ronde, pencatatan sesi dan statistik.
 * Jalankan: node tests/ear-training.test.js */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
let fails = 0; const ok = (c, m) => { console.log((c ? 'LULUS  ' : 'GAGAL  ') + m); if (!c) fails++; };

const store = {}, els = {}, plucks = []; let clock = 0, synced = 0;
const el = id => els[id] = els[id] || { innerHTML: '', value: '', checked: false };
const ctx = vm.createContext({ console, Math, JSON, Date, Set, Map, Object, Array, Number, String, isNaN, parseInt, setTimeout, clearTimeout,
    localStorage: { getItem: k => k in store ? store[k] : null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    navigator: {}, performance: { now: () => clock }, window: { pcSyncSoon: () => { synced++; } },
    document: { addEventListener() {}, getElementById: el, querySelectorAll: () => [] } });
vm.runInContext(`var audioCtx = () => ({ currentTime: 0 }), pluckNote = (c, f, t, v, d) => __plucks.push({ f, t }), pcToast = () => {}, esc = s => String(s), dr = null;
    var STD_MIDI = [40, 45, 50, 55, 59, 64], mf = m => refA * Math.pow(2, (m - 69) / 12); let pendingAnnounce = false; var renderStreak = () => {};`, Object.assign(ctx, { __plucks: plucks }));
['config.js', 'chords-db.js', 'store.js', 'ear-training.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), ctx, { filename: f }));
const run = e => vm.runInContext(e, ctx);

// 1. semua akor soal ada di kamus untuk 12 nada dasar dan punya cukup senar berbunyi
let bad = [];
run('Object.keys(EAR_Q)').forEach(id => run('noteStrings').forEach(r => {
    const c = run('chordDatabase')[r + run(`EAR_Q.${id}.sfx`)];
    if (!c || !c.variants.length || c.variants[0].fingering.filter(f => f >= 0).length < 3) bad.push(r + id);
}));
ok(bad.length === 0, 'semua jenis akor soal tersedia untuk 12 nada dasar' + (bad.length ? ': ' + bad.join(',') : ''));

// 2. deck seimbang
['mudah', 'sedang', 'sulit'].forEach(lv => {
    let okd = true;
    for (let t = 0; t < 200; t++) {
        const d = run(`earDeck('${lv}', 10)`), qs = run(`EAR_LEVELS.${lv}`), cnt = qs.map(q => d.filter(x => x === q).length);
        if (d.length !== 10 || d.some(x => !qs.includes(x)) || Math.max(...cnt) - Math.min(...cnt) > 1) okd = false;
    }
    ok(okd, `deck tingkat ${lv}: 10 soal, hanya jenis tingkat itu, selisih jumlah antar jenis maks. 1`);
});
ok(run("earDeck('tidak-ada', 6).every(q => q === 'maj' || q === 'min')"), 'tingkat tak dikenal jatuh ke mudah');

// 3. nada dasar tidak berulang
ok(run("(() => { let p = null; for (let i = 0; i < 600; i++) { const r = earRoot(p); if (r === p) return false; p = r; } return true; })()"), 'nada dasar tidak sama dengan soal sebelumnya (600 undian)');

// 4. jadwal petikan
const strum = run('earPlan([-1, 3, 2, 0, 1, 0], false)'), arp = run('earPlan([-1, 3, 2, 0, 1, 0], true)');
ok(strum.length === 5 && strum.every(p => p.s !== 0), 'senar mati (x) tidak dibunyikan');
ok(strum.every((p, i) => i === 0 || p.at > strum[i - 1].at) && Math.abs(strum[1].at - strum[0].at - 0.035) < 1e-9, 'strum: senar berurutan, jarak 35 ms');
ok(arp.every((p, i) => Math.abs(p.at - i * 0.28) < 1e-9), 'satu-satu: jarak 280 ms, tanpa celah di senar mati');

// 5. suara: C mayor = x 3 2 0 1 0 -> nada terendah C3
plucks.length = 0; run("earPlay('C', 'maj', false)");
const lo = Math.min(...plucks.map(p => p.f)), c3 = 440 * Math.pow(2, (48 - 69) / 12);
ok(plucks.length === 5 && Math.abs(lo - c3) < 0.01, 'C mayor: 5 senar, nada terendah C3');
plucks.length = 0; run("earPlay('A#', 'min7', true)"); ok(plucks.length >= 4, 'A#m7 berbunyi');
plucks.length = 0; run("earPlay('C', 'tidak-ada', false)"); ok(plucks.length === 0, 'jenis tak dikenal tidak membunyikan apa pun');

// 6. alur ronde penuh: 8 benar, 2 salah
run("earStart()");
ok(run('ear.i') === 0 && els.earStage.innerHTML.includes('Soal 1 dari 10') && plucks.length > 0, 'ronde dimulai: soal 1 tampil dan bunyi diputar otomatis');
const wrongFor = q => run(`EAR_LEVELS[ear.level].find(x => x !== '${q}')`);
for (let i = 0; i < 10; i++) {
    const q = run('ear.q'); clock += 4000;
    run(`earAnswer('${i === 3 || i === 7 ? wrongFor(q) : q}')`);
    if (i === 3) {
        ok(run('ear.bad') === 1 && els.earStage.innerHTML.includes('Bukan itu'), 'jawaban salah: umpan balik menyebut jawaban benar');
        const n = plucks.length, okBefore = run('ear.ok'); run(`earAnswer('${q}')`);
        ok(plucks.length > n && run('ear.ok') === okBefore && run('ear.bad') === 1, 'ketuk pilihan setelah menjawab hanya membunyikan, tidak mengubah skor');
    }
    run('earNext()');
}
ok(run('ear.done') && run('ear.ok') === 8 && run('ear.bad') === 2, 'ronde selesai: 8 benar, 2 salah');
ok(els.earStage.innerHTML.includes('8/10') && els.earStage.innerHTML.includes('Rekor baru'), 'hasil dan rekor baru tampil');

// 7. sesi dicatat
const ss = run('getSessions()'), last = ss[ss.length - 1];
ok(last && last.mode === 'ear' && last.ok === 8 && last.bad === 2 && last.cpm === 0 && last.dur >= 30 && last.dur <= 60, 'sesi mode "ear" tercatat (dur ' + (last && last.dur) + ' dtk, cpm 0)');
ok(synced > 0, 'sinkron dijadwalkan setelah sesi');
ok(run('earData().best.mudah') === 8, 'rekor tingkat tersimpan');
const stt = run('earData().st'); ok(Object.values(stt).reduce((a, v) => a + v[0], 0) === 10, 'statistik: 10 jawaban tercatat');

// 8. waktu diam dibatasi 60 dtk per soal
run("earStart()"); clock += 3600000; run("earAnswer(ear.q)"); ok(run('ear.active') === 60, 'waktu diam 1 jam dihitung hanya 60 dtk');
// jawaban dua kali pada soal yang sama tidak menggandakan skor
run("earAnswer(ear.q)"); ok(run('ear.ok') === 1, 'jawaban ganda tidak menambah skor');

// 9. ganti tingkat saat ronde berjalan = ronde diulang
els.earLevel.value = 'sulit'; run('earOpt()');
ok(run('ear') === null && run('earData().lvl') === 'sulit', 'ganti tingkat: ronde direset, pilihan tersimpan');
els.earArp.checked = true; run('earOpt()'); run('earStart()');
ok(run('ear.level') === 'sulit' && run('ear.arp') === true && run('EAR_LEVELS.sulit').includes(run('ear.q')), 'ronde memakai tingkat dan mode petik pilihan');

// 10. statistik lemah dan tertukar
ok(run("earWeak({ maj: [10, 9], min7: [8, 3], sus4: [4, 0] })").id === 'min7', 'jenis tersulit: min7 (sus4 belum cukup 5 soal)');
ok(run("earWeak({})") === null, 'tanpa data: tidak ada yang tersulit');
const tc = run("earTopConf({ 'min7>min': 3, 'maj>min': 1 })"); ok(tc && tc.want === 'min7' && tc.got === 'min' && tc.n === 3, 'tebakan tertukar terbanyak ditemukan');
ok(run("earTopConf({ 'maj>min': 1 })") === null, 'tertukar hanya sekali: belum ditampilkan');

// 10b. jenis lanjutan: interval, urutan akor, arah melodi, nada
const KINDS = ['interval', 'progresi', 'melodi', 'nada'];
// deck seimbang untuk semua jenis dan tingkat
KINDS.forEach(k => ['mudah', 'sedang', 'sulit'].forEach(lv => {
    const qs = run(`earLevels('${k}').${lv}`); let okd = qs.length >= 2;
    for (let t = 0; t < 100; t++) { const d = run(`earDeckOf(earLevels('${k}').${lv}, 10)`), cnt = qs.map(q => d.filter(x => x === q).length); if (d.length !== 10 || d.some(x => !qs.includes(x)) || Math.max(...cnt) - Math.min(...cnt) > 1) okd = false; }
    ok(okd, `deck ${k}/${lv}: seimbang dan hanya berisi jawaban tingkat itu`);
    ok(qs.every(id => run(`earName('${k}', '${id}')`) && run(`EAR_X.${k}.hint['${id}']`)), `${k}/${lv}: tiap jawaban punya nama dan penjelasan`);
}));
// interval: jarak tepat untuk semua nada dasar
let badI = [];
run('noteStrings').forEach(r => run('Object.keys(EAR_INT)').forEach(id => { const p = run(`earBuild('interval', 'sulit', '${id}', '${r}')`); if (p.hi - p.lo !== run(`EAR_INT.${id}`) || p.seq[1].m !== p.hi || p.hi > 72 || p.lo < 48) badI.push(r + id); }));
ok(badI.length === 0, 'interval: jarak semitone tepat dan nada dalam jangkauan untuk 12 nada dasar x 12 interval');
// urutan akor: semua akor ada di kamus untuk 12 nada dasar, bunyi lengkap
let badP = [];
run('noteStrings').forEach(r => run('Object.keys(EAR_PROG)').forEach(id => run(`earBuild('progresi', 'sulit', '${id}', '${r}')`).keys.forEach(k => { if (!run('chordDatabase')[k]) badP.push(r + id + k); })));
ok(badP.length === 0, 'urutan akor: semua akor pola tersedia di kamus untuk 12 nada dasar' + (badP.length ? ': ' + badP.slice(0, 5).join(',') : ''));
ok(run("earBuild('progresi', 'mudah', 'pop', 'C').keys.join()") === 'C,G,Am,F' && run("earBuild('progresi', 'mudah', 'klasik', 'G').keys.join()") === 'G,C,D,G' && run("earBuild('progresi', 'sulit', 'minor', 'A').keys.join()") === 'Am,F,C,G', 'urutan akor: I–V–vi–IV di C, I–IV–V–I di G, i–VI–III–VII di Am benar');
plucks.length = 0; run("earPlayP('progresi', earBuild('progresi', 'mudah', 'pop', 'C'))"); ok(plucks.length >= 4 * 4 && Math.max(...plucks.map(p => p.t)) >= 3 * 1.15, 'urutan akor: 4 akor berbunyi berjeda 1,15 dtk');
ok(new Set(run('Object.keys(EAR_PROG).map(k => EAR_PROG[k].c.map(x => x.join(":")).join("|"))')).size === 7, 'urutan akor: ketujuh pola berbeda');
// arah melodi: kontur sesuai, 5 nada, dalam jangkauan, untuk semua tingkat
let badM = 0, tot = 0;
['mudah', 'sedang', 'sulit'].forEach(lv => run('Object.keys(EAR_SIGNS)').forEach(id => { for (let t = 0; t < 200; t++) {
    const m = run(`earBuild('melodi', '${lv}', '${id}', noteStrings[${t % 12}])`).midis, sg = run(`EAR_SIGNS.${id}`); tot++;
    if (m.length !== 5 || m.some((x, i) => i && Math.sign(x - m[i - 1]) !== sg[i - 1]) || Math.min(...m) < 45 || Math.max(...m) > 80) badM++;
} }));
ok(badM === 0, `melodi: ${tot} soal acak, kontur benar, 5 nada, jangkauan 45–80`);
ok(run("earBuild('melodi', 'sulit', 'zigzag', 'C', () => 0.4).midis.length") === 5 && run("earBuild('melodi', 'mudah', 'naik', 'C', () => 0.4).seq[4].at") > 2, 'melodi: rnd tetap menghasilkan melodi sah dan bernada berurutan');
// nada: mudah = mana lebih tinggi; sedang/sulit = derajat dari acuan
let badN = 0;
for (let t = 0; t < 300; t++) {
    ['p1', 'p2'].forEach(q => { const p = run(`earBuild('nada', 'mudah', '${q}', noteStrings[${t % 12}])`), gap = Math.abs(p.a - p.b); if ((q === 'p1') !== (p.a > p.b) || gap < 3 || gap > 9) badN++; });
    run('Object.keys(EAR_DEG)').forEach(q => { const p = run(`earBuild('nada', 'sulit', '${q}', noteStrings[${t % 12}])`); if (p.seq[1].m - p.seq[0].m !== run(`EAR_DEG.${q}`) || p.seq[0].m !== p.t) badN++; });
}
ok(badN === 0, 'nada: arah dan jarak (mudah) serta derajat dari acuan (sedang/sulit) benar');

// ronde penuh untuk tiap jenis: sesi, rekor, statistik, umpan balik, perbandingan bunyi
KINDS.forEach(k => {
    els.earKind.value = k; els.earLevel.value = 'mudah'; els.earArp.checked = false; run('earOpt()');
    ok(run('earOpts().kind') === k && run('earData().kind') === k && run('earData().kl.' + k) === 'mudah' && run('ear') === null, `${k}: pilihan jenis dan tingkat tersimpan, ronde direset`);
    plucks.length = 0; run('earStart()');
    ok(run('ear.kind') === `${k}` && run('ear.p') !== null && plucks.length > 0 && els.earStage.innerHTML.includes('Soal 1 dari 10'), `${k}: ronde dimulai, soal diputar otomatis`);
    const nSess = run('getSessions().length');
    for (let i = 0; i < 10; i++) {
        const q = run('ear.q'); clock += 3000;
        const wrong = run(`earLevels(ear.kind)[ear.level].find(x => x !== '${q}')`);
        run(`earAnswer('${i === 2 || i === 6 ? wrong : q}')`);
        if (i === 2) {
            ok(els.earStage.innerHTML.includes('Bukan itu') && run('ear.bad') === 1 && /semitone|pada kunci|arahnya|Tadi|Acuan/.test(els.earStage.innerHTML), `${k}: jawaban salah menampilkan penjelasan`);
            const n = plucks.length, oks = run('ear.ok'); run(`earAnswer('${q}')`); run(`earAnswer('${wrong}')`);
            ok(plucks.length > n && run('ear.ok') === oks && run('ear.bad') === 1, `${k}: ketuk pilihan sesudah menjawab hanya membunyikan`);
        }
        run('earNext()');
    }
    const ss2 = run('getSessions()'), ls = ss2[ss2.length - 1];
    ok(run('ear.done') && run('ear.ok') === 8 && ss2.length === nSess + 1 && ls.mode === 'ear' && ls.level === k + '-mudah' && ls.ok === 8 && ls.bad === 2, `${k}: ronde selesai 8/10, sesi 'ear' tercatat dengan level ${k}-mudah`);
    ok(run(`earData().best['${k}.mudah']`) === 8 && run(`Object.values(earData().st_${k}).reduce((a, v) => a + v[0], 0)`) === 10, `${k}: rekor dan statistik tersimpan terpisah dari jenis akor`);
    ok(run('earData().best.mudah') === 8 && !('st_akor' in run('earData()')), `${k}: data jenis akor lama tidak tercampur`);
});
els.earKind.value = 'nada'; els.earLevel.value = 'sulit'; run('earOpt()'); run('earStart()');
ok(run('ear.level') === 'sulit' && run('ear.p.t') > 0 && els.earStage.innerHTML.includes('Do'), 'nada sulit: opsi derajat Do–Si tampil dan acuan tersedia');
for (let i = 0; i < 10; i++) { clock += 2000; run('earAnswer(ear.q)'); run('earNext()'); }
ok(run('getSessions()').slice(-1)[0].level === 'nada-sulit', 'nada sulit: level sesi nada-sulit');
els.earKind.value = 'melodi'; els.earLevel.value = 'sedang'; run('earOpt()'); run('earStart()');
ok(els.earStage.innerHTML.includes('Naik lalu turun') && els.earArpLbl.hidden === true, 'melodi sedang: opsi kontur tampil, opsi petik satu-satu disembunyikan');
els.earKind.value = 'akor'; els.earLevel.value = 'mudah'; run('earOpt()');
ok(els.earArpLbl.hidden === false && run('earOpts().kind') === 'akor', 'kembali ke akor: opsi petik satu-satu muncul lagi');
// tingkat tersimpan per jenis saat berpindah jenis
els.earKind.value = 'interval'; run('earKindChange()'); ok(els.earLevel.value === 'mudah' && els.earLevel.innerHTML.includes('12 interval'), 'ganti jenis: daftar tingkat diisi ulang untuk jenis itu');
els.earKind.value = 'akor'; run('earKindChange()');
// statistik lemah/tertukar untuk jenis lanjutan memakai namanya
ok(run("earWeak({ M3: [10, 9], m3: [8, 2] }, EAR_X.interval.names).id") === 'm3' && run("earWeak({ min7: [8, 2] }, EAR_X.interval.names)") === null, 'statistik: jenis lanjutan memakai nama jenisnya sendiri');
ok(run("earTopConf({ 'M3>m3': 3 }, EAR_X.interval.names).want") === 'M3' && run("earTopConf({ 'maj>min': 3 }, EAR_X.interval.names)") === null, 'tertukar: id jenis lain diabaikan');

// 11. data rusak tidak membuat crash
store.pc_ear = '[1,2]'; ok(run('typeof earData()') === 'object' && !Array.isArray(run('earData()')), 'data pc_ear rusak diabaikan');

// 12. lencana dan penghapusan data terpasang
const ex = fs.readFileSync(path.join(ROOT, 'js', 'extras.js'), 'utf8'), sy = fs.readFileSync(path.join(ROOT, 'js', 'sync.js'), 'utf8');
ok(/\['ear', '👂'/.test(ex), 'lencana "Telinga tajam" terdaftar di extras.js');
ok(/\['ear2', '🎼'/.test(ex), 'lencana "Telinga musikal" terdaftar di extras.js');
ok(sy.includes("'pc_ear'"), 'pc_ear ikut terhapus saat keluar & hapus data perangkat');
console.log(fails ? `\n${fails} tes gagal` : '\nSemua tes Latih Telinga lulus'); process.exit(fails ? 1 : 0);
