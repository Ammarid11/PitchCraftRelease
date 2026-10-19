# Pitchcraft — Rencana Pengembangan

Dokumen ini merangkum fitur yang belum ada dan urutan pengerjaannya. Status awal: versi 16 (menu tab, tuner senar, kunci & capo, latihan, pola strum, rekam otomatis, bagikan), sudah dipisah menjadi folder `pitchcraft/`.

## Ringkasan prioritas

| # | Fitur | Dampak | Usaha | Fase |
|---|-------|--------|-------|------|
| 1 | ✅ Hosting HTTPS (GitHub Pages) — **selesai** | Tinggi | Kecil | 1 |
| 2 | ✅ Tes otomatis & indikator keyakinan deteksi akor — **selesai** | Tinggi | Sedang | 1 |
| 3 | ✅ Penyimpanan pengaturan & konsep "Lagu" — **selesai** | Tinggi | Sedang | 2 |
| 4 | ✅ Tuning & capo konsisten, suara gitar lebih nyata — **selesai** | Sedang | Sedang | 2 |
| 5 | ✅ Kamus akor lebih lengkap, nomor jari, diagram vertikal — **selesai** | Sedang | Sedang | 3 |
| 6 | ✅ Pelengkap tuner (nada acuan, kalibrasi A=440) — **selesai** | Rendah | Kecil | 3 |
| 7 | ✅ Riwayat skor & tingkat kesulitan latihan — **selesai** | Rendah | Kecil | 3 |

Catatan: membaca akor lewat satu mikrofon HP tidak pernah 100% akurat (senar teredam, ruangan bising). Karena itu fitur 2 lebih penting daripada terus menyetel angka secara manual.

---

## Fase 1 — Fondasi

### 1. ✅ Hosting HTTPS — selesai
**Status:** sudah di-host di GitHub Pages dan dipakai dari HP, jadi mikrofon berfungsi. Bagian ini dianggap selesai.

**Opsional nanti (tidak wajib):** manifest + service worker agar bisa dipasang ke layar utama dan jalan offline.

**Masalah awal:** mikrofon di browser butuh HTTPS; dari file lokal banyak browser Android memblokirnya.

**Pekerjaan (hanya jika PWA diinginkan):**
- ~~Hosting statis gratis (mis. GitHub Pages) agar alamat berupa `https://`.~~ ✅
- Tambah `manifest.webmanifest` (nama, ikon, warna tema, `display: standalone`).
- Tambah `service-worker.js` yang menyimpan semua file `index.html`, `css/`, `js/` agar jalan tanpa internet.
- Tambah ikon aplikasi (192 dan 512 px).
- Font Google dibuat opsional atau di-host lokal agar tetap rapi saat offline.

**Selesai jika:** mikrofon berfungsi lewat HTTPS ✅. (PWA opsional: bisa dipasang ke layar utama dan terbuka saat mode pesawat.)

### 2. ✅ Tes otomatis & indikator keyakinan — selesai
**Status:** `tests/chord-detection.test.js` (sinyal sintetis, 3 skenario + batasan diketahui) dan lencana keyakinan (tinggi/sedang/ragu) di hasil Mode Strum. Kalibrasi lewat tombol terpisah tidak dibuat; tombol "Benar, ingat pola ini" yang sudah ada berfungsi sama.

**Masalah:** setiap perbaikan satu akor (D, D5, Dsus4, Dm) berisiko merusak akor lain.

**Pekerjaan:**
- Folder `tests/` berisi pembangkit sinyal sintetis untuk akor umum (mayor, minor, 7, sus, power chord) dengan harmonik dan derau.
- Skrip yang menjalankan `rankByChroma` terhadap semua sinyal dan melaporkan akor yang salah baca.
- Jalankan tes setiap kali nilai penyetelan berubah.
- Indikator keyakinan di UI: selisih skor antara hasil teratas dan kedua. Jika kecil, tampilkan "ragu, cek Kemungkinan lain".
- Kalibrasi singkat (opsional): genjreng satu akor yang diketahui untuk menyetel sensitivitas ke perangkat.

**Selesai jika:** semua akor di daftar tes terbaca benar pada sinyal sintetis, dan UI menandai hasil yang ragu.

---

## Fase 2 — Pengalaman pakai

### 3. ✅ Penyimpanan pengaturan & konsep "Lagu" — selesai
**Status:** pengaturan (progresi, BPM, metronom, hitung mundur, pola strum, birama, tuning, capo, kunci, Mode Kidal, lagu) tersimpan di `localStorage` (`pc_settings`). Tab **Lagu**: bagian, akor berdurasi (ketuk), birama 4/4 · 3/4 · 6/8, hitungan mundur, transpose satu tekan, lirik format `[Am]kata` dengan akor di atasnya, ekspor/impor `.json`. Progresi biasa tetap satu bar per akor.
**Pekerjaan:**
- Simpan di `localStorage`: progresi, BPM, pola strum, tuning, capo, kunci, Mode Kidal.
- Model data `Lagu`: nama, kunci, BPM, birama (4/4, 3/4, 6/8), daftar bagian (bait, reff, dst.), tiap akor punya durasi (jumlah ketuk).
- Hitungan mundur sebelum putar.
- Transpose seluruh lagu sekali tekan.
- Tampilan akor di atas lirik (teks bebas per bagian).
- Ekspor/impor lagu sebagai file `.json`.

**Selesai jika:** menutup dan membuka lagi aplikasi mengembalikan semua pengaturan, dan satu lagu lengkap bisa disimpan lalu diputar.

### 4. ✅ Tuning & capo konsisten, suara lebih nyata — selesai
**Status:** tuning terpilih memengaruhi suara, fretboard, dan nama senar. Standar, Drop D, dan Eb didukung penuh; tuning lain disesuaikan otomatis disertai peringatan. Progresi menyimpan bentuk jari, bunyinya = bentuk + capo (ditampilkan sebagai "→"). Suara memakai sintesis Karplus-Strong. Mode Strum tetap mengandalkan tuning standar (diberi peringatan).
**Pekerjaan:**
- Tuning dipilih memengaruhi nada senar terbuka di `playChordFingering` dan nama senar di fretboard.
- Bentuk akor untuk tuning non-standar (minimal Drop D dan setengah nada turun) atau peringatan jelas bila belum didukung.
- Progresi memperhitungkan capo (nada yang berbunyi naik sesuai posisi capo).
- Ganti gelombang segitiga dengan sintesis senar Karplus-Strong agar bunyi mirip gitar.

**Selesai jika:** suara akor sesuai tuning dan capo yang dipilih.

---

## Fase 3 — Pelengkap

### 5. ✅ Kamus akor lebih lengkap — selesai
**Status:** ditambah m9, maj9, add11, 11, 13, m(maj7) (bentuk movable) dan 20 slash chord (bentuk open, mis. D/F♯, C/G; tidak semua akar tersedia). Nomor jari 1–4 dengan deteksi barre tampil di fretboard, dan tombol "Diagram Vertikal" mengganti ke diagram gaya buku akor (SVG). Akor kamus lanjutan sengaja **tidak ikut** deteksi Mode Strum agar akurasi tes tidak turun.
- Tambah: slash chord (D/F♯, C/G), m9, maj9, add11, 11, 13, m(maj7).
- Tampilkan nomor jari (1–4) pada fretboard.
- Diagram vertikal gaya buku akor sebagai pilihan tampilan.

### 6. ✅ Pelengkap tuner — selesai
**Status:** ketuk senar untuk nada acuan (atau "Bunyikan semua"), kalibrasi A=432–446 Hz (memengaruhi tuner, deteksi nada, dan suara), getaran halus saat senar pas (bila perangkat mendukung).
- Nada acuan per senar (bunyikan E, A, D, G, B, e).
- Pengaturan kalibrasi A=440 yang bisa diubah (mis. 432–446).
- Getaran halus saat senar sudah pas.

### 7. ✅ Latihan yang terasa berkembang — selesai
**Status:** riwayat sesi (30 terakhir) dengan rekor akor/menit, tingkat Dasar / Barre / 7th & sus, durasi 30/60/120 detik. Sesi yang dihentikan manual tidak disimpan.
- Riwayat skor per sesi dan rekor pindah akor per menit.
- Tingkat kesulitan (akor dasar, barre, 7th dan sus).
- Pilihan durasi sesi (30/60/120 detik).

---

## Risiko dan catatan

- **Akurasi deteksi:** bergantung pada mikrofon, ruangan, dan teknik genjreng. Tidak ada angka ajaib; tes otomatis dan indikator keyakinan adalah cara paling aman untuk menjaganya.
- **Tuning non-standar:** deteksi akor di mode strum mengandalkan tuning standar. Mendukung tuning lain berarti menyesuaikan juga pembacaan chroma, bukan hanya tampilan.
- **Kompatibilitas:** `wakeLock`, `navigator.share`, dan service worker tidak ada di semua browser. Setiap fitur perlu cadangan yang tidak merusak aplikasi.
- **Urutan penting:** kerjakan fase 1 sebelum fase 2 (semua fase kini selesai; sisa opsional: PWA/offline); menambah fitur di atas deteksi yang tidak teruji akan membuat bug lebih sulit dilacak.

## Definisi selesai (setiap fitur)

1. Berjalan di Chrome Android tanpa error di konsol.
2. Tidak mengubah perilaku deteksi yang sudah benar (jalankan tes dari fitur 2).
3. Pengaturan yang relevan tersimpan dan terbaca kembali.
4. Teks antarmuka berbahasa Indonesia dan rapi di layar sempit (360 px).
