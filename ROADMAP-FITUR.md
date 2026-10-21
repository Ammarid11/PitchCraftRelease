# Pitchcraft — Roadmap Fitur

Daftar fitur untuk membuat app lebih menarik dan membuat orang kembali memakainya, beserta status dan catatan tiap fitur.
Rencana lanjutan untuk lagu dan progresi ada di [`PLAN-LAGU-PROGRESI.md`](PLAN-LAGU-PROGRESI.md).

## Prinsip

- Semua fitur berada di lapisan atas: tampilan, penyimpanan, latihan, lagu. **Tidak ada yang mengubah cara deteksi nada/akor.**
- File inti deteksi (`pitch.js`, `gate.js`, `strum-analysis.js`, `strum-mode.js`, `tuner.js`) tidak disentuh, sehingga `tests/chord-detection.test.js` tetap menjadi pagar pengaman.
- Satu pengecualian ada di #4, yang memakai pelacak nada suara sendiri (`vcYin`) dan tidak mengubah `pitch.js`.
- Offline-first: tanpa akun pun semuanya jalan; data utama ada di `localStorage`.

> **Catatan pengujian:** semua fitur sudah lolos cek sintaks dan tes otomatis di Node. Belum ada yang diuji langsung di browser atau perangkat nyata, jadi tampilan dan perilakunya perlu dicoba dulu.

---

## Ringkasan status

| # | Fitur | Prioritas | Status | Tes otomatis |
|---|-------|-----------|--------|--------------|
| 1 | Mode Main (auto-scroll + sorot akor) | Tinggi | ✅ Selesai | — |
| 2 | Streak harian, target, lencana | Tinggi | ✅ Selesai | `sync.test.js` |
| 3 | Tempel lirik + akor | Tinggi | ✅ Selesai | — |
| 4 | Cari kunci yang cocok untuk suaramu | Tinggi | ✅ Selesai | `voice-range.test.js` |
| 5 | Tap tempo + titik metronom | Menengah | ✅ Selesai | — |
| 6 | Latih yang lemah | Menengah | ✅ Selesai | `sync.test.js`, `rls.test.js` |
| 7 | Animasi jari saat pindah akor | Menengah | ✅ Selesai | `finger-move.test.js` |
| 8 | Kartu bagikan | Menengah | ✅ Selesai | `share.test.js` |
| 9 | PWA (manifest + service worker) | Teknis | ✅ Selesai | — |
| 10 | Mode panggung / tema terang | Teknis | ✅ Selesai | — |
| 11 | Latih Telinga | Menengah | ✅ Selesai | `ear-training.test.js` |

Semua fitur roadmap sudah dikerjakan. Pengembangan berikutnya: lihat [`PLAN-LAGU-PROGRESI.md`](PLAN-LAGU-PROGRESI.md).

---

## Fitur yang sudah selesai

### 1. Mode Main
Tombol **🎤 Mode Main** di tab Lagu membuka layar penuh dengan lirik besar dan akor di atasnya.

- Akor aktif tersorot mengikuti BPM (memakai `playList` yang sudah ada).
- Gulir halus ke bagian lagu yang sedang dimainkan.
- Kontrol BPM −/+, ukuran huruf A−/A+, dan opsi **Tanpa suara akor** (hanya metronom, untuk main bersama lagu).
- Layar tetap menyala selama Mode Main terbuka.

**Batasan:** gulir berpindah per **bagian** lagu, belum per baris lirik.

### 2. Streak, target, dan lencana
Di tab Latih: hitungan hari beruntun, bar target 5 menit per hari, dan 11 lencana.

| Lencana | Syarat |
|---------|--------|
| 🌱 Sesi pertama | Menyelesaikan satu sesi apa pun |
| ⚡ 10 akor/menit | Skor Kuis/Pindah akor ≥ 10 akor/menit |
| 🚀 20 akor/menit | Skor ≥ 20 akor/menit |
| 🎸 Akor dasar lulus | Kuis tingkat Dasar: ≥ 8 benar dan benar ≥ 2× salah |
| 💪 Barre lulus | Sama, tingkat Barre |
| 🎷 7th & sus lulus | Sama, tingkat 7th & sus |
| 🎯 Target harian | 5 menit latihan dalam satu hari |
| 🔥 Streak 3 hari | 3 hari beruntun |
| 🏆 Streak 7 hari | 7 hari beruntun |
| 👂 Telinga tajam | Satu ronde Latih Telinga: ≥ 8 benar dan benar ≥ 2× salah (lihat #11) |
| 🎼 Telinga musikal | Sama, tetapi pada jenis lanjutan (interval, urutan akor, arah melodi, atau nada) |

Data disimpan di `localStorage` (per perangkat dan browser), dan ikut tersinkron bila masuk akun (lihat `README_DB.md`):

| Kunci | Isi |
|-------|-----|
| `pc_sessions` | log sesi ber-ID (dasar streak, total latihan, dan sinkron) |
| `pc_days` | jumlah detik per tanggal versi lama (dimigrasi ke `pc_sessions`) |
| `pc_badges` | lencana yang sudah diraih |
| `pc_lastlog` | penanda sesi terakhir yang sudah dicatat |
| `pc_hist` | riwayat 30 sesi terakhir untuk tampilan |

**Catatan:** "Hapus riwayat" hanya menghapus `pc_hist` dan catatan akor salah, bukan streak dan lencana.

### 3. Tempel lirik + akor
Tombol **📋 Tempel teks** di tab Lagu mengubah format dua baris (akor di atas lirik) menjadi `[Am]kata`.

- Judul seperti `[Verse 1]`, `Reff:`, `Bridge` menjadi bagian baru.
- Nama akor dinormalisasi ke kamus (`Bbmin7` → `A#m7`, `M7` → `maj7`).
- Baris akor tanpa lirik di bawahnya (instrumental) dipertahankan.
- Teks yang sudah berformat `[Am]kata` ikut dibaca.

**Batasan:** akor yang tidak dikenal kamus tetap tampil di lirik, tapi tidak masuk daftar akor yang bisa diputar. Akor kembar berurutan hanya dicatat sekali di daftar akor (lihat B3 di rencana lanjutan).

### 4. Cari kunci yang cocok untuk suaramu
Kartu **Cari Kunci Suaramu** di tab Tuner (pintasan **🎤 Kunci suaramu** di tab Lagu).

- Tekan Mulai lalu bernyanyi atau bersenandung: nada terendah dan tertinggi yang **ditahan stabil ±0,4 detik** tercatat. Nada yang meluncur, bergetar lebar, atau sekilas diabaikan.
- Saran kunci memakai jendela melodi `[tonika−3, tonika−3+lebar]` (lebar dipilih: ±9/12/15 nada). Kunci diurutkan menurut berapa nada jendela yang keluar dari rentangmu, lalu kedekatan ke tengah rentang.
- Tiap saran memuat **capo termudah** (logika yang sama dengan panel 🎼) dan bentuk akornya. **Terapkan kunci** / **Kunci + Capo n** mengisi panel Kunci & Capo lewat tombol Terapkan yang sudah ada.
- **Kunci asli lagu:** pilih kunci asli (atau ikuti panel 🎼) untuk mendapat geseran terkecil yang pas, mis. "geser −3 nada ke kunci A".
- Umpan balik langsung: batang level suara, persentase tahan, dan petunjuk bila suara terlalu pelan / belum jernih / meluncur. Tombol koreksi −12/−1/+1/+12 memperbaiki hasil salah oktaf.
- Rentang tersimpan di perangkat (`pc_voice`, hanya dua nomor nada, tidak ikut sinkron) dan ikut terhapus saat "Keluar dan hapus data di perangkat ini". Audio tidak direkam atau dikirim.

**Deteksi gitar tidak disentuh.** Suara dilacak oleh `vcYin` (YIN khusus suara, 65–1100 Hz, tanpa koreksi sub-oktaf yang dibuat untuk gitar) dengan penyaring sendiri; ambang suara mengikuti derau ruangan. Jalur ini menghentikan diri bila tuner, Mode Strum, atau pindah tab memakai mikrofon.

**Batasan:** rentang baca 65–1100 Hz (kira-kira C2–C6). Salah oktaf pada suara orang masih mungkin; gunakan tombol koreksi atau Ulangi. Aturan "tonika−3" adalah perkiraan, bukan melodi lagu sebenarnya.

### 5. Tap tempo + titik metronom
- Tombol **👆 Tap** di Progresi dan Lagu: BPM dihitung dari beberapa ketukan terakhir, direset jika jeda lebih dari 2 detik.
- Titik kecil berkedip tiap klik metronom, berwarna berbeda di ketukan pertama.

### 6. Latih yang lemah
Mode **Latih yang lemah** di tab Latih memilih akor yang paling sering salah.

- Tiap kesalahan dicatat per kejadian (`logMiss` di `practice.js`): akor diminta, akor terbaca, waktu. Disimpan di `pc_miss` (300 terbaru di perangkat).
- `weakPool()` mengambil sampai 6 akor teratas; butuh minimal 2 akor berbeda, jika kurang app meminta latihan dulu lewat mode lain.
- Riwayat lengkap ikut tersinkron ke tabel `misses` di server (hanya bertambah, dilindungi RLS).
- Daftar "Paling sering salah" tampil di bawah riwayat latihan.

### 7. Animasi jari saat pindah akor
Kartu **Pindah Akor** di tab Progresi membandingkan dua akor (Dari / Ke) dan menganimasikan jarinya.

- **Hijau** = jari tetap di senar dan fret yang sama, **ungu** = berpindah (bergeser mulus), **merah** = diangkat, **biru** = baru diletakkan. Ringkasan teks menyebut senar dan fret tiap perpindahan.
- **▶ Putar animasi** berganti A↔B otomatis; mengetuk gambar berganti manual. **⏭ Dari Progresi** mengambil dua akor berurutan dari Progresi (berputar), **⇄ Tukar** membalik arah, **Bunyikan** memainkan akor tiap pergantian.
- Memakai `analyzeFingers` dan `adaptFingering` yang sudah ada, jadi ikut tuning, mode kidal, dan tema. Animasi digerakkan CSS lewat atribut `data-ph`; mati sendiri bila perangkat memakai "kurangi gerakan".

**Batasan:** pemasangan jari yang berpindah memakai tebakan terdekat (nomor jari sama, lalu jarak terkecil), jadi pada akor barre pasangannya bisa berbeda dari yang diajarkan guru. Bila dipilih dari daftar, dipakai bentuk pertama tiap akor; dari Progresi, bentuk yang dipilih di sana. Barre digambar sebagai batang pudar, bukan ikut bergeser.

### 8. Kartu bagikan
`js/share.js` membuat gambar PNG 1080×1920 (ukuran Story) lewat `<canvas>`, seluruhnya di perangkat. Tidak ada data yang dikirim ke server.

- **🖼 Kartu Gambar** di tab Progresi: urutan akor (maks. 12, bentuk jari + "bunyi" bila pakai capo), kunci/capo, BPM, birama, pola strum.
- **🖼 Bagikan skor terakhir** di tab Latih: akor/menit, benar/salah, akurasi, durasi, streak, jumlah lencana, dan tanda "Rekor pribadi".
- Dialog pratinjau dulu, lalu **Bagikan** (Web Share API dengan berkas gambar) atau **Unduh PNG** sebagai cadangan.
- Alamat situs ikut tercetak di kaki kartu bila app dibuka dari domain sungguhan (bukan localhost).

**Batasan:** huruf Google Fonts tidak ikut di-cache, jadi saat offline kartu memakai font sistem. Emoji bergantung pada font perangkat. Kartu skor memakai riwayat `pc_hist`, sehingga ronde Latih Telinga tidak muncul di sana.

### 9. PWA
`manifest.json`, `sw.js`, dan `icons/` (192, 512, maskable). Bisa dipasang ke layar utama dan jalan offline. Tombol **⬇ Pasang** muncul bila browser mengizinkan.

- Harus lewat HTTPS atau localhost (service worker tidak jalan dari `file://`).
- **Naikkan `VERSI` di `sw.js` (dan `APP_VER` di `js/tabs.js`) setiap kali ada file yang berubah**, supaya cache lama dibuang.
- Pustaka login (`supabase-js`) disimpan di cache terpisah agar akun tetap termuat saat offline.

**Batasan:** font Google tidak ikut di-cache; saat offline dipakai font sistem.

### 10. Mode panggung / tema terang
Tombol **🎨 Tampilan** di bilah atas membuka dialog dengan dua pengaturan, disimpan per perangkat (`pc_theme`, `pc_stage`) dan tidak ikut sinkron akun.

- **Tema:** Gelap (bawaan), Terang, atau Otomatis (mengikuti ponsel). Skrip kecil di `<head>` memasang tema sebelum halaman tampil, jadi tidak berkedip. `privacy.html` ikut tema.
- **Mode Panggung:** kontras tinggi, huruf 112%, nada terdeteksi lebih besar, animasi latar dimatikan, dan layar tetap menyala (Wake Lock) selama mode ini aktif.

**Batasan:** kartu bagikan (canvas) tetap bertema gelap supaya gambar konsisten. Ikon PWA dan `theme_color` di `manifest.json` tetap gelap; warna bilah status mengikuti tema lewat `<meta theme-color>`.

### 11. Latih Telinga
Kartu **Latih Telinga** di tab Latih (di bawah Latihan & Kuis). App membunyikan sesuatu, kamu menebaknya. **Tanpa mikrofon**, jadi bisa dilatih di mana saja, sebaiknya dengan headset.

- **Satu ronde = 10 soal.** Nada dasar acak (tidak pernah sama dengan soal sebelumnya) dan jawaban seimbang: tiap pilihan muncul hampir sama banyak.
- **Lima jenis latihan** (menu *Latihan*), masing-masing dengan tiga tingkat:

  | Jenis | Yang didengar | Yang ditebak | Mudah / Sedang / Sulit |
  |-------|---------------|--------------|------------------------|
  | Jenis akor | satu akor | mayor, minor, dominan 7, … | 2 / 3 / 6 pilihan |
  | Interval | dua nada berurutan (naik) | jaraknya: m2 … P8 | m3, M3, P5, P8 / 7 interval / 12 interval |
  | Urutan akor | empat akor di kunci acak | polanya dengan angka romawi (I–V–vi–IV, I–IV–V–I, vi–IV–I–V, I–vi–IV–V, I–V–vi–iii, i–VI–III–VII, i–VII–VI–V) | 2 / 4 / 7 pola |
  | Arah melodi | lima nada dari tangga nada mayor | naik, turun, naik lalu turun, turun lalu naik, zigzag, tetap | 2 / 4 / 6 kontur |
  | Nada | **Mudah:** dua nada. **Sedang/Sulit:** nada acuan (Do) lalu satu nada | mana yang lebih tinggi / derajatnya (Do, Re, Mi, …) | 2 pilihan / Do-Mi-Sol-Do' / Do–Si |

- **Petik satu-satu** (khusus jenis akor): membunyikan akor senar demi senar. Pilihan ini disembunyikan untuk jenis lain.
- **Umpan balik:** setelah menjawab, app menyebut jawaban yang benar beserta penjelasannya (nada pembentuk, jarak semitone, akor-akor pola, atau nada-nada melodi) dan ciri bunyinya. **Ketuk pilihan mana pun untuk membandingkan bunyinya.**
- **Hasil ronde:** skor, akurasi, rincian per jawaban, dan tanda **Rekor baru** per jenis dan tingkat. Di bawah kartu tampil rekor, jawaban yang paling sulit dibedakan (minimal 5 soal), dan tebakan yang paling sering tertukar.
- **Terhubung ke sistem yang ada:** tiap ronde dicatat sebagai sesi ber-ID bermode `ear` (level `interval-mudah`, `nada-sulit`, dan seterusnya; jenis akor tetap memakai `mudah`/`sedang`/`sulit`), jadi ikut **streak**, target harian, total latihan, dan sinkron akun. Lencana **👂 Telinga tajam** (semua jenis) dan **🎼 Telinga musikal** (jenis lanjutan). Nilai akor/menit sengaja 0 supaya tidak mengisi lencana kecepatan.
- Memakai mesin suara Karplus-Strong yang sudah ada (`pluckNote`), selalu tuning standar tanpa capo.
- **Data:** statistik di `pc_ear` (jenis dan tingkat pilihan, rekor, jumlah benar/salah per jawaban). Data jenis akor memakai kunci lama (`st`, `conf`, `best.<tingkat>`) sehingga data lama tetap terbaca; jenis lain memakai `st_<jenis>`, `conf_<jenis>`, dan `best["<jenis>.<tingkat>"]`. Hanya di perangkat ini, tidak ikut sinkron, dan terhapus saat "Keluar dan hapus data di perangkat ini". Sesinya sendiri ikut sinkron seperti sesi lain.

**Batasan:** nada pada jenis Nada selalu relatif terhadap acuan (belum melatih nada mutlak). Interval hanya naik dan dibunyikan berurutan, belum bersamaan atau turun. Urutan akor memakai akor triad dengan bentuk pertama dari kamus, tanpa variasi irama. Melodi memakai tangga nada mayor; belum ada tangga minor atau lompatan besar. Waktu diam dihitung maksimal 60 detik per soal. Tidak bisa dijalankan bersamaan dengan latihan bermikrofon (Mode Strum akan mendengar suara speaker).

**Tes:** `tests/ear-training.test.js`.

---

## Ide berikutnya

- **Latih Telinga berikutnya:** interval turun dan bersamaan, tangga minor, tebak nada mutlak (tanpa acuan), dan urutan akor dengan akor ke-7.
- **Mode duet/jam:** app mengiringi dengan suara Karplus-Strong yang sudah ada, kamu main melodi.
- **Pustaka lagu komunitas:** butuh server, jadi menyusul setelah backend ada.

## Posisi produk
Banyak app akor sudah ada. Pembeda nyata di sini: **deteksi akor dari genjrengan nyata, offline, dengan latihan yang mengecek permainanmu**. Fitur baru sebaiknya memperkuat itu (mis. streak, "latih yang lemah" berbasis Mode Strum, dan Latih Telinga untuk melatih pendengaran), bukan menyebar menjadi app serba ada.
