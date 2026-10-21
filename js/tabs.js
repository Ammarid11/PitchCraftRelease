/* Pitchcraft — Menu tab, tip singkat tiap tab, dan panel Bantuan (cara pakai). */

const APP_VER = 'v32';   // samakan dengan VERSI di sw.js; tampil di panel Bantuan untuk memastikan versi yang berjalan

// [id tab, ikon, nama, tip satu kalimat, cara pakai]
const GUIDE = [
    ['deteksi', '🎸', 'Deteksi', 'Cari tahu nada atau akor yang kamu mainkan.', 'Petik SATU senar lalu tekan “Mulai Mendengarkan”: muncul nama nada dan seberapa pas. Atau tekan “Mode Strum” dan genjreng semua senar sekali: app menebak akornya dan menunjukkan posisi jari. Tuning standar memberi hasil terbaik.'],
    ['tuning', '🎚', 'Tuner', 'Menyetel gitar senar per senar.', 'Pilih tuning, tekan Mulai, lalu petik satu senar. Teks di bawah meter menunjukkan pasak dikencangkan atau dikendurkan. Ketuk nama senar untuk mendengar nada acuannya. Kartu Cari Kunci Suaramu di bawahnya mengukur nada terendah dan tertinggimu, lalu menyarankan kunci dan capo.'],
    ['kamus', '📚', 'Kamus', 'Semua akor untuk tiap nada dasar.', 'Pilih nada dasar atau ketik nama akor (mis. F#m7). Ketuk gambar untuk memilih akor, 🔊 untuk mendengarnya, ➕ Progresi untuk menambahkannya ke urutan akor.'],
    ['latih', '🏋', 'Latih', 'Latihan pindah akor dan kuis, dicek lewat mikrofon.', 'Pilih mode, tingkat, dan durasi, lalu Mulai. Genjreng akor yang diminta. Streak harian dan lencana tercatat di sini. Kartu Latih Telinga di bawahnya melatih telinga: pilih jenis latihan (akor, interval, urutan akor, arah melodi, derajat nada, nama nada, atau nama akor), app membunyikannya, kamu menebak (tanpa mikrofon).'],
    ['lagu', '🎵', 'Lagu', 'Menulis lagu: bagian, akor, dan lirik.', 'Tulis lirik dengan akor di kurung siku, mis. [Am]kata, atau 📋 tempel teks dari situs akor. ▶ Putar memainkan semua akor; 🔁 Loop mengulanginya terus sampai Stop. 🎤 Mode Main menampilkan lirik besar untuk dipakai saat bermain.'],
    ['progresi', '📋', 'Progresi', 'Susun urutan akor dan putar dengan metronom.', 'Tambah akor, atur BPM dan pola strum, lalu ▶ Putar. Aktifkan 🔁 Loop agar diulang terus sampai Stop. Kartu Pindah Akor menunjukkan jari mana yang tetap dan berpindah saat ganti akor. Akor yang kamu simpan juga ada di tab ini.']
];

function showTab(n) {
    document.querySelectorAll('[data-tab]').forEach(e => e.classList.toggle('on', e.dataset.tab === n));
    document.querySelectorAll('#tabbar button').forEach(b => b.classList.toggle('on', b.dataset.go === n));
    window.scrollTo(0, 0); window.curTab = n; renderTip(n);
    try { localStorage.setItem('pc_tab', n); } catch (e) { }
}

document.querySelectorAll('#tabbar button').forEach(b => b.addEventListener('click', () => showTab(b.dataset.go)));

/* ----- tip di atas tiap tab (bisa ditutup, muncul lagi lewat Bantuan) ----- */
const tipsSeen = () => { try { return JSON.parse(localStorage.getItem('pc_tips') || '{}') || {}; } catch (e) { return {}; } };
function renderTip(n) {
    const el = document.getElementById('tabTip'); if (!el) return;
    const g = GUIDE.find(x => x[0] === n);
    if (!g || tipsSeen()[n]) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = `<div><b>${g[1]} ${g[2]}</b>${g[3]} <a href="#" onclick="helpToggle(true);return false">Cara pakai</a></div><button onclick="tipHide('${n}')">Mengerti</button>`;
}
function tipHide(n) { const s = tipsSeen(); s[n] = 1; try { localStorage.setItem('pc_tips', JSON.stringify(s)); } catch (e) { } renderTip(n); }
function tipsReset() { try { localStorage.removeItem('pc_tips'); } catch (e) { } renderTip(window.curTab); pcToast('Tips tiap menu ditampilkan lagi'); }

/* ----- panel Bantuan ----- */
function helpToggle(open) {
    const m = document.getElementById('help'); if (!m) return;
    const o = open === undefined ? !m.classList.contains('on') : open;
    m.classList.toggle('on', o); if (o) helpRender();
    try { localStorage.setItem('pc_seen', '1'); } catch (e) { }
}
function helpRender() {
    document.getElementById('helpBody').innerHTML = GUIDE.map(g => `<div class="hl-item"><div class="hl-top"><strong>${g[1]} ${g[2]}</strong><button class="btn-variant" onclick="helpGo('${g[0]}')">Buka</button></div><p>${g[3]} ${g[4]}</p></div>`).join('') +
        `<div class="hl-item"><strong>ℹ Tips umum</strong><p>Mikrofon butuh alamat https://. Semua fitur jalan tanpa internet dan tanpa akun; 👤 Akun hanya untuk menyinkronkan progres ke perangkat lain. 🎼 Kunci mengatur kunci lagu dan capo (tekan Terapkan agar berlaku). 🎨 Tampilan mengganti tema gelap/terang dan menyalakan Mode Panggung untuk bermain di luar ruangan.</p></div>
        <div class="picker-row"><button class="btn-variant" onclick="tipsReset();helpToggle(false)">Tampilkan lagi tips tiap menu</button></div>
        <p class="ac-fine" style="margin-top:12px">Versi app: ${APP_VER}</p>`;
}
function helpGo(n) { helpToggle(false); showTab(n); }
document.addEventListener('keydown', e => { if (e.key === 'Escape') helpToggle(false); });
try { if (!localStorage.getItem('pc_seen')) setTimeout(() => helpToggle(true), 700); } catch (e) { }
