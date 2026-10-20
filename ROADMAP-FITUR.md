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
| 6 | Latihan berbasis kelemahan | Menengah | ⏳ Belum |
| 7 | Animasi jari saat pindah akor | Menengah | ⏳ Belum |
| 8 | Kartu bagikan (share card) | Menengah | ⏳ Belum |
| 9 | PWA (manifest + service worker) | Teknis | ✅ Selesai |
| 10 | Mode panggung / latar terang | Teknis | ⏳ Belum |

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

Catatan: "Hapus riwayat" hanya menghapus `pc_hist`, bukan streak dan lencana. Penyimpanan ini per perangkat dan per browser. Rencana sinkron ada di `AUTH-SERVER-SUPABASE.md`.

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

---

## Yang belum dikerjakan

### 4. Cari kunci yang cocok untuk suaramu
Pengguna bernyanyi, app menangkap nada terendah dan tertinggi, lalu menyarankan kunci + capo.
- Memakai `detectPitch` dari `pitch.js` tanpa mengubahnya.
- `gate.js` sengaja menolak suara orang (nada meluncur/bergetar). Untuk nyanyian perlu **jalur terpisah dengan ambang lebih longgar**, jangan melonggarkan gate yang sekarang agar deteksi gitar tetap aman.
- Bisa dilewati dulu jika ingin deteksi tetap 100% tak tersentuh.

### 6. Latihan berbasis kelemahan
Catat akor yang sering salah (`dr.bad`), lalu mode "Latih yang lemah" memprioritaskan akor itu.
- Perlu mencatat akor per kesalahan di `pcLock` (sekarang hanya jumlah salah per sesi).
- Sebaiknya dikerjakan setelah struktur log sesi dirapikan (lihat tahap 0 di `AUTH-SERVER-SUPABASE.md`), supaya data kelemahan ikut tersinkron nanti.

### 7. Animasi jari saat pindah akor
Tampilkan transisi akor A ke B: jari yang tetap (*common finger*) dan jari yang berpindah. Berguna untuk pemula yang macet di perpindahan. Data jari sudah ada di `analyzeFingers`.

### 8. Kartu bagikan
Hasilkan gambar progresi atau skor latihan lewat `<canvas>` untuk dikirim ke WhatsApp/Instagram Story. Cara paling murah agar orang lain tahu app ini ada. Gunakan Web Share API bila tersedia, dan unduhan gambar sebagai cadangan.

### 10. Mode panggung / latar terang
Saat ini hanya tema gelap. Tambahkan kontras tinggi, font besar, dan opsi latar terang untuk main di luar ruangan atau panggung. Warna sudah memakai variabel CSS di `:root`, jadi cukup menambah satu set variabel lain.

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
5. Share card (#8)
6. Latih yang lemah (#6), setelah log sesi dirapikan
7. Mode terang (#10), lalu animasi jari (#7)
8. Cari kunci suara (#4), jika siap membuat jalur gate terpisah

## Posisi produk
Banyak app akor sudah ada. Pembeda nyata di sini: **deteksi akor dari genjrengan nyata, offline, dengan latihan yang mengecek permainanmu**. Fitur baru sebaiknya memperkuat itu (misalnya streak dan "latih yang lemah" berbasis Mode Strum), bukan menyebar menjadi app serba ada.
