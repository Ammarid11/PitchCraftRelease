# Pitchcraft — Roadmap Fitur

Daftar 10 fitur untuk membuat app lebih menarik dan membuat orang kembali memakainya, beserta status pengerjaannya.

**Prinsip:** semua fitur di sini berada di lapisan atas (tampilan, penyimpanan, latihan, lagu). Tidak ada yang mengubah cara deteksi nada/akor. File inti deteksi (`pitch.js`, `gate.js`, `strum-analysis.js`, `strum-mode.js`, `tuner.js`) tidak disentuh, dan `tests/chord-detection.test.js` tetap valid sebagai pagar pengaman.

Satu pengecualian ada di #4, yang hanya memanggil fungsi pitch yang sudah ada (lihat catatan di sana).

---

## Ringkasan status

| # | Fitur | Prioritas | Status |
|---|-------|-----------|--------|
| 1 | Mode Main (auto-scroll + highlight akor) | Tinggi | ✅ Selesai |
| 2 | Streak harian + target + lencana | Tinggi | ✅ Selesai |
| 3 | Impor lagu dari teks (tempel lirik+akor) | Tinggi | ✅ Selesai |
| 4 | Cari kunci yang cocok untuk suaramu | Tinggi | ⏳ Belum |
| 5 | Metronom visual + tap tempo | Menengah | ✅ Selesai |
| 6 | Latihan berbasis kelemahan | Menengah | ✅ Selesai |
| 7 | Animasi jari saat pindah akor | Menengah | ✅ Selesai |
| 8 | Kartu bagikan (share card) | Menengah | ✅ Selesai |
| 9 | PWA (manifest + service worker) | Teknis | ✅ Selesai |
| 10 | Mode panggung / latar terang | Teknis | ✅ Selesai |

Semua yang berstatus selesai sudah lolos cek sintaks dan tes deteksi. Belum diuji langsung di browser atau perangkat nyata, jadi tampilan dan perilakunya perlu dicoba dulu.

---

## Yang sudah selesai

### 1. Mode Main
Tombol **🎤 Mode Main** di tab Lagu membuka layar penuh dengan lirik besar dan akor di atasnya.
- Akor aktif tersorot mengikuti BPM (memakai `playList` yang sudah ada).
- Auto-scroll halus ke bagian lagu yang sedang dimainkan.
- Kontrol BPM −/+, ukuran huruf A−/A+, dan opsi **Tanpa suara akor** (hanya metronom, untuk main bersama lagu).
- Layar tetap menyala selama Mode Main terbuka.
- Batasan: gulir berpindah per **bagian** lagu, belum per baris lirik.

### 2. Streak, target, lencana
Di tab Latih: hitungan hari beruntun, bar target 5 menit per hari, dan 9 lencana.

Lencana: Sesi pertama, 10 akor/menit, 20 akor/menit, Akor dasar lulus, Barre lulus, 7th & sus lulus, Target harian, Streak 3 hari, Streak 7 hari.

Data disimpan di `localStorage`:

| Kunci | Isi |
|-------|-----|
| `pc_days` | detik latihan per tanggal (maks. 400 hari) |
| `pc_badges` | lencana yang sudah diraih |
| `pc_lastlog` | penanda sesi terakhir yang sudah dicatat |
| `pc_hist` | riwayat 30 sesi terakhir |

Catatan: "Hapus riwayat" hanya menghapus `pc_hist`, bukan streak dan lencana. Penyimpanan ini per perangkat dan per browser. Sinkron antar perangkat: lihat `README_DB.md`.

### 3. Tempel lirik + akor
Tombol **📋 Tempel teks** di tab Lagu mengubah format dua baris (akor di atas lirik) menjadi `[Am]kata`.
- Judul seperti `[Verse 1]`, `Reff:`, `Bridge` menjadi bagian baru.
- Nama akor dinormalisasi ke kamus (`Bbmin7` → `A#m7`, `M7` → `maj7`).
- Baris akor tanpa lirik di bawahnya (instrumental) dipertahankan.
- Teks yang sudah berformat `[Am]kata` ikut dibaca.
- Akor yang tidak dikenal kamus tetap tampil di lirik, tapi tidak masuk daftar akor yang bisa diputar.

### 5. Tap tempo + titik metronom
- Tombol **👆 Tap** di Progresi, Lagu (BPM dihitung dari beberapa ketukan terakhir, direset jika jeda lebih dari 2 detik).
- Titik kecil berkedip tiap klik metronom, berwarna berbeda di ketukan pertama.

### 9. PWA
`manifest.json`, `sw.js`, dan `icons/` (192, 512, maskable). Bisa dipasang ke layar utama dan jalan offline. Tombol **⬇ Pasang** muncul bila browser mengizinkan.
- Harus lewat HTTPS atau localhost (service worker tidak jalan dari `file://`).
- **Naikkan `VERSI` di `sw.js` setiap kali ada file yang berubah**, supaya cache lama dibuang.
- Font Google tidak ikut di-cache; saat offline dipakai font sistem.

### 6. Latih yang lemah
Mode **Latih yang lemah** di tab Latih memilih akor yang paling sering salah.
- Tiap kesalahan dicatat per kejadian (`logMiss` di `practice.js`): akor diminta, akor terbaca, waktu. Disimpan di `pc_miss` (300 terbaru di perangkat).
- `weakPool()` mengambil sampai 6 akor teratas; butuh minimal 2 akor berbeda, jika kurang app meminta latihan dulu lewat mode lain.
- Riwayat lengkap ikut tersinkron ke tabel `misses` di server (append-only, RLS) dan tercakup di `tests/sync.test.js` dan `tests/rls.test.js`.
- Daftar "Paling sering salah" tampil di bawah riwayat latihan.

### 8. Kartu bagikan
`js/share.js` membuat gambar PNG 1080×1920 (ukuran Story) lewat `<canvas>`, seluruhnya di perangkat. Tidak ada data yang dikirim ke server.
- **🖼 Kartu Gambar** di tab Progresi: urutan akor (maks. 12, bentuk jari + "bunyi" bila pakai capo), kunci/capo, BPM, birama, pola strum.
- **🖼 Bagikan skor terakhir** di tab Latih: akor/menit, benar/salah, akurasi, durasi, streak, jumlah lencana, dan tanda "Rekor pribadi".
- Dialog pratinjau dulu, lalu **Bagikan** (Web Share API dengan berkas gambar) atau **Unduh PNG** sebagai cadangan bila browser tidak mendukung berbagi berkas.
- Alamat situs ikut tercetak di kaki kartu bila app dibuka dari domain sungguhan (bukan localhost).
- Batasan: huruf Google Fonts tidak ikut di-cache, jadi saat offline kartu memakai font sistem. Emoji bergantung pada font perangkat.


### 10. Mode panggung / latar terang
Tombol **🎨 Tampilan** di bilah atas membuka dialog dengan dua pengaturan, disimpan per perangkat (`pc_theme`, `pc_stage`) dan tidak ikut sinkron akun.
- **Tema:** Gelap (bawaan), Terang, atau Otomatis (mengikuti ponsel). Terang menimpa variabel warna di `:root` dan warna yang tertulis langsung di `style.css`. Skrip kecil di `<head>` memasang tema sebelum halaman tampil, jadi tidak berkedip. `privacy.html` ikut tema.
- **Mode Panggung:** kontras tinggi (teks putih/hitam murni, garis lebih tegas), huruf 112%, nada terdeteksi lebih besar, animasi latar dimatikan, dan layar tetap menyala (Wake Lock) selama mode ini aktif.
- Kartu bagikan (canvas) tetap bertema gelap supaya gambar yang dibagikan konsisten.
- Batasan: ikon PWA dan `theme_color` di `manifest.json` tetap gelap (manifest tidak bisa berubah per tema); warna bilah status mengikuti tema lewat `<meta theme-color>`.


### 7. Animasi jari saat pindah akor
Kartu **Pindah Akor** di tab Progresi membandingkan dua akor (Dari / Ke) dan menganimasikan jarinya.
- **Hijau** = jari tetap di senar dan fret yang sama, **ungu** = berpindah (bergeser mulus ke posisi baru), **merah** = diangkat, **biru** = baru diletakkan. Ringkasan teks menyebut senar dan fret tiap perpindahan.
- Tombol **▶ Putar animasi** berganti A↔B otomatis; mengetuk gambar berganti manual. **⏭ Dari Progresi** mengambil dua akor berurutan dari Progresi (berputar), **⇄ Tukar** membalik arah, **Bunyikan** memainkan akor tiap pergantian.
- Memakai `analyzeFingers` dan `adaptFingering` yang sudah ada, jadi ikut tuning, mode kidal, dan tema. Animasi digerakkan CSS lewat atribut `data-ph`; mati sendiri bila perangkat memakai "kurangi gerakan" (gambar berganti tanpa geser).
- Pemasangan jari yang berpindah memakai tebakan terdekat (nomor jari sama, lalu jarak terkecil), jadi pada akor barre pasangannya bisa berbeda dari yang diajarkan guru.
- Batasan: memakai bentuk pertama tiap akor bila dipilih dari daftar; dari Progresi, bentuk yang dipilih di sana yang dipakai. Barre digambar sebagai batang pudar, bukan ikut bergeser.
- Tes: `tests/finger-move.test.js`.

---

## Yang belum dikerjakan

### 4. Cari kunci yang cocok untuk suaramu
Pengguna bernyanyi, app menangkap nada terendah dan tertinggi, lalu menyarankan kunci + capo.
- Memakai `detectPitch` dari `pitch.js` tanpa mengubahnya.
- `gate.js` sengaja menolak suara orang (nada meluncur/bergetar). Untuk nyanyian perlu **jalur terpisah dengan ambang lebih longgar**, jangan melonggarkan gate yang sekarang agar deteksi gitar tetap aman.
- Bisa dilewati dulu jika ingin deteksi tetap 100% tak tersentuh.


---

## Ide yang lebih ambisius
- **Mode duet/jam:** app mengiringi dengan suara Karplus-Strong yang sudah ada, kamu main melodi.
- **Pelatihan telinga:** app memainkan akor, kamu menebak mayor/minor/7. Mesin suara dan kuis sudah ada.
- **Pustaka lagu komunitas:** butuh server, jadi menyusul setelah backend ada.

## Urutan kerja yang disarankan
1. ~~PWA (#9)~~ selesai
2. ~~Mode Main (#1)~~ selesai
3. ~~Tempel teks (#3)~~ selesai
4. ~~Streak + lencana (#2)~~ selesai
5. ~~Share card (#8)~~ selesai
6. ~~Latih yang lemah (#6)~~ selesai
7. ~~Mode terang (#10)~~ dan ~~animasi jari (#7)~~ selesai
8. Cari kunci suara (#4), jika siap membuat jalur gate terpisah  ← berikutnya

## Posisi produk
Banyak app akor sudah ada. Pembeda nyata di sini: **deteksi akor dari genjrengan nyata, offline, dengan latihan yang mengecek permainanmu**. Fitur baru sebaiknya memperkuat itu (misalnya streak dan "latih yang lemah" berbasis Mode Strum), bukan menyebar menjadi app serba ada.
