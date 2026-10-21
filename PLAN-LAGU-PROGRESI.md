# Pitchcraft — Rencana Peningkatan Fitur Lagu & Progresi

Status: **rencana, belum ada kode**. Dibuat dari pembacaan kode versi v17 (`song.js`, `progression.js`, `extras.js`, `settings.js`, `sync.js`, `audio.js`, `strum-pattern.js`, `chord-pick.js`, skema Supabase).

**Prinsip yang tetap berlaku** (sama seperti roadmap):
- Tidak menyentuh deteksi nada/akor (`pitch.js`, `gate.js`, `strum-analysis.js`, `strum-mode.js`, `tuner.js`). `chord-detection.test.js` tetap pagar pengaman.
- Offline-first: `localStorage` sumber utama, server hanya salinan. Semua fitur baru harus jalan tanpa akun.
- Setiap rilis: `node --check`, tes baru untuk logika baru, naikkan `VERSI` di `sw.js` dan `APP_VER` di `tabs.js`, perbarui `README.md` dan `ROADMAP-FITUR.md`, dan jangan merusak data pengguna yang sudah ada.

---

## 1. Temuan: kondisi sekarang

### 1a. Masalah yang terbukti dari kode (harus diperbaiki dulu)

| # | Temuan | Lokasi | Dampak |
|---|--------|--------|--------|
| B1 | `loadSettings` memetakan progresi hanya ke `{key, v}`, jadi field `beats` hilang saat dimuat. | `settings.js` | Durasi akor per ketuk di progresi tidak mungkin tersimpan; harus diperbaiki sebelum fitur durasi dibuat. |
| B2 | Transpose lagu mengubah penanda `[..]` di lirik dengan `tKey` tanpa cek kamus, tetapi daftar akor memakai cadangan (`C#/G#` jadi `C#`). | `song.js` `songTranspose` | Akor di lirik dan di daftar akor bisa berbeda setelah transpose. Variasi bentuk (`v`) juga selalu direset ke 0. |
| B3 | Impor teks menghapus akor kembar berurutan di daftar akor, tapi penanda di lirik tetap semuanya. | `extras.js` `parseChordSheet` (`addCh`) | Daftar akor tidak sejajar 1:1 dengan lirik, sehingga Mode Main tidak bisa menyorot akor per baris. |
| B4 | **Kosongkan** progresi langsung menghapus tanpa konfirmasi atau urungkan. Hapus bagian lagu juga begitu. | `index.html`, `song.js` | Data hilang karena salah ketuk. |
| B5 | Pemutar menjadwalkan semua ketukan dengan `setTimeout` sekaligus. | `progression.js` `playList` | Tempo bisa meleset di HP yang sibuk; tidak bisa jeda, tidak bisa ulang otomatis, mengubah BPM saat memutar tidak berlaku. |
| B6 | Hanya **satu lagu aktif**. Skema server sudah mendukung banyak lagu (kunci `(user_id, id)` dan `deleted_at`), tapi UI dan sinkron belum memakainya. | `song.js`, `sync.js`, `README_DB.md` | Pembatas terbesar: tidak bisa punya pustaka lagu. |

### 1b. Kekurangan fitur

**Progresi**
- Hanya bisa tambah dan hapus satu per satu. Tidak ada ubah urutan, duplikat, ganti akor, atau pilih bentuk jari.
- Setiap akor selalu 1 bar; durasi per akor belum ada (padahal pemutar sudah mendukung `beats`).
- Hanya satu progresi, tanpa nama dan tanpa simpan beberapa.
- Tidak ada transpose progresi, dan tidak ada tampilan angka romawi (I–V–vi–IV) terhadap kunci.
- Pola strum hanya bisa dipilih dari daftar tetap, bukan dirancang sendiri. Pola berlaku global (juga untuk lagu), tidak per lagu atau bagian.
- Bagikan hanya teks `| Am | G |` dan kartu gambar; belum ada cara membaca kembali teks itu.

**Lagu**
- Bagian hanya bisa ditambah dan dihapus. Tidak bisa diubah urutannya, diduplikat, atau diulang (reff yang sama harus ditulis ulang tiap kali).
- Mengetik `[Am]` dengan tangan; belum ada tombol sisip akor di posisi kursor.
- Daftar akor (untuk diputar) dan akor di lirik adalah dua sumber data terpisah dan bisa tidak cocok (lihat B2, B3).
- Kunci, capo, BPM, dan pola strum bersifat global, bukan milik lagu. Hanya birama yang disimpan di lagu.
- Mode Main menggulir per **bagian**, belum per baris; akor di lirik tidak ikut tersorot.
- Ekspor hanya `.json`. Belum ada ChordPro, teks biasa, atau cetak.
- Tidak ada ringkasan "akor yang dipakai lagu ini", dan lagu belum terhubung ke Latihan (pembeda utama produk).
- Semua nama akor tampil dengan kres (A# bukan Bb), meski lagunya berkunci bemol.

---

## 2. Model data baru

### Lagu v2 (menggantikan bentuk sekarang; v1 otomatis dinaikkan saat dibaca)
```json
{
  "id": "uuid", "v": 2, "name": "", "artist": "", "notes": "",
  "meter": "4/4", "bpm": 80, "key": { "root": 0, "mode": "maj" }, "capo": 0, "pat": "Pop (↓ ↓↑ ↑↓↑)",
  "sections": [
    { "id": "s1", "name": "Bait 1", "lyrics": "[Am]kata [G]kata", "chords": [{ "key": "Am", "v": 0, "beats": 0 }] },
    { "id": "s2", "name": "Reff", "lyrics": "", "chords": [] }
  ],
  "order": ["s1", "s2", "s1", "s2"],
  "updatedAt": 0
}
```
- `sections` = definisi unik; `order` = susunan main (reff ditulis sekali, dimainkan berkali-kali). Bila `order` kosong, dianggap urutan `sections`.
- Kunci, capo, BPM, dan pola dipasang ke kontrol global saat lagu dibuka, dan disimpan kembali ke lagu saat berubah.
- `cleanSong` menerima v1 dan v2 (migrasi satu arah), dengan batas yang sama (maks. 40 bagian, 200 akor per bagian, 20.000 karakter lirik).

### Progresi v2
- Item: `{ key, v, beats }` (beats 0 = 1 bar). `SETTINGS_V` naik ke 2 dengan `SETTINGS_MIGRATIONS[1]`.
- **Progresi bernama** (pustaka kecil): `{ id, name, items[], bpm?, meter?, pat? }`.

### Penyimpanan dan sinkron
- Pustaka lagu di `pc_songs` (peta `id → lagu`) dan `pc_song_active` (id lagu aktif). Variabel global `song` tetap menunjuk lagu aktif supaya perubahan kode tidak menyebar ke mana-mana.
- Sebelum migrasi pertama, salin data lama ke `pc_backup_v17` (dan tampilkan tombol "Pulihkan dari cadangan" di dialog Akun).
- Server: tabel `songs` sudah cukup (banyak baris per pengguna, `deleted_at` untuk hapus). Tidak perlu tabel baru bila progresi bernama disimpan sebagai lagu berjenis `kind: "progression"` (lihat pertanyaan di bagian 7).

---

## 3. Fase kerja

Ukuran: **S** kecil, **M** sedang, **L** besar.

### Fase 0 — Fondasi dan perbaikan bug (ukuran M)
Perlu selesai dulu karena fase lain bergantung padanya.

| Tugas | Rincian | Selesai bila |
|-------|---------|--------------|
| 0.1 Perbaiki B1 | `loadSettings` mempertahankan `beats`; `SETTINGS_V = 2` + migrasi | Progresi dengan beats utuh setelah muat ulang dan sinkron |
| 0.2 Toast **Urungkan** | `pcUndoToast(pesan, fungsiUrung)` dipakai untuk: kosongkan progresi, hapus akor, hapus bagian, hapus lagu | Tiap penghapusan bisa diurungkan 6 detik |
| 0.3 Perbaiki B2 | Transpose memakai satu fungsi `transposeKey(key, d)` untuk daftar akor dan lirik; mempertahankan `v` bila jumlah variasi sama; akor yang tak ada di kamus ditandai, bukan diam-diam diganti | Tes: lirik dan daftar akor selalu sama setelah transpose ±12 |
| 0.4 Perbaiki B3 | Impor teks membuat satu entri akor per penanda (tanpa penghapusan kembar) | Tes: jumlah penanda `[..]` = jumlah akor bagian |
| 0.5 Fungsi penyelaras | `alignSection(s)` mengembalikan `{aligned, markers[]}`; dipakai untuk peringatan dan Mode Main | Lencana "akor lirik ≠ daftar akor" tampil saat tidak sejajar |
| 0.6 Tes dasar | `tests/song.test.js` (clean, transpose, parse, align) | Lulus di `node` tanpa browser |

### Fase 1 — Progresi lebih kuat (ukuran L) → **Rilis A**

| Tugas | Rincian |
|-------|---------|
| 1.1 Mesin putar baru | Penjadwal Web Audio dengan jendela intip (≈25 ms tick, intip 0,2 dtk) memakai `audioCtx().currentTime`. Fungsi murni `buildTimeline(list, meter, pat, bpm)` menghasilkan daftar kejadian (ketuk ke-n: akor, klik, goresan) sehingga bisa diuji di Node. `playChordFingering` diberi parameter waktu mulai. |
| 1.2 Kontrol putar | **Jeda/lanjut**, **Ulangi** (loop), ubah BPM saat memutar (kejadian yang tersisa dihitung ulang dari posisi ketuk sekarang), hitung mundur tetap. Sorotan akor mengikuti jam audio lewat `requestAnimationFrame`, bukan timer terpisah. |
| 1.3 Editor akor progresi | Ketuk akor membuka lembar kecil: ganti akor (pemilih Kamus yang sudah ada), pilih bentuk jari, durasi (1 bar, 2, 3, 4 ketuk, dst.), duplikat, hapus. Ubah urutan dengan tombol ◀ ▶ (dan seret bila memungkinkan). |
| 1.4 Angka romawi | Opsi tampilan di bawah tiap akor (I, ii, V7…) terhadap kunci di panel 🎼; akor di luar kunci diberi tanda ♭/non-diatonis. |
| 1.5 Transpose progresi | ♭ −1 / ♯ +1 dan "Ubah ke kunci…"; memakai `transposeKey` dari Fase 0. |
| 1.6 Pustaka progresi | Simpan, beri nama, buka, hapus progresi. Pasang progresi populer (yang sudah ada di panel kunci) sebagai bawaan. |
| 1.7 Editor pola strum | 8 sel yang diketuk bergantian ↓ / ↑ / · / (opsional) aksen; simpan pola buatan sendiri; validasi panjang pola terhadap birama (Waltz 6 sel, 6/8 dan seterusnya). |
| 1.8 Tempel/impor progresi | Baca teks `\| Am \| G \|` (format hasil Bagikan) dan baris akor biasa (`Am G F C`). |

**Kriteria selesai Fase 1:** tempo stabil (selisih antar ketukan di pengujian timeline = 0 terhadap rumus); jeda dan lanjut tidak menggandakan bunyi; loop tidak menumpuk timer saat tab dibuka-tutup; semua perubahan progresi bisa diurungkan; tes `timeline.test.js` lulus.

### Fase 2 — Pustaka lagu (ukuran L) → **Rilis B**

| Tugas | Rincian |
|-------|---------|
| 2.1 Penyimpanan banyak lagu | `pc_songs` + migrasi otomatis dari lagu tunggal lama (dengan cadangan, lihat bagian 2). |
| 2.2 UI Pustaka | Kartu "Pustaka Lagu" di atas tab Lagu: cari, urut (terakhir diubah / judul), **Baru**, **Duplikat**, **Hapus** (dengan urungkan), penanda lagu aktif; tiap baris menampilkan judul, kunci, jumlah bagian. |
| 2.3 Metadata per lagu | Artis, catatan, kunci, capo, BPM, birama, pola strum disimpan di lagu dan dipasang ke kontrol saat dibuka. |
| 2.4 Sinkron banyak lagu | Perluas `sync.js`: tarik daftar lagu berdasarkan `updated_at`, simpan `base`/`hash` per lagu, konflik per lagu (versi lokal yang kalah disimpan di `pc_conflicts` per id), hapus lewat `deleted_at` (tombstone), batas jumlah lagu (mis. 200). Progresi bernama ikut jalur yang sama. |
| 2.5 Cadangan | `acctExport` v2 memuat semua lagu dan progresi; impor tetap menerima v1. |
| 2.6 Tes | Perluas `sync.test.js` (banyak lagu, hapus, konflik per lagu) dan `rls.test.js` (lagu B tak terlihat A, tombstone). |
| 2.7 Dokumen | Perbarui `README_DB.md`, `privacy.html` ("lagu" jamak, tanggal), dan tes manual dua perangkat. |

**Kriteria selesai Fase 2:** pengguna lama membuka v-baru dan lagunya tetap ada satu-satunya di pustaka; tidak ada lagu yang hilang bila hapus lalu urungkan; dua perangkat yang mengedit lagu berbeda tidak saling timpa; hapus akun membersihkan semua baris.

> **Syarat dari kamu:** bila skema server berubah (mis. kolom `kind`), SQL migrasi harus dijalankan sekali di Supabase SQL Editor sebelum rilis dibuka. Saya sertakan file `supabase/2026-xx-xx-*.sql` dan langkahnya, seperti migrasi `misses` sebelumnya.

### Fase 3 — Editor lagu (ukuran L) → **Rilis C**

| Tugas | Rincian |
|-------|---------|
| 3.1 Susunan lagu | Daftar `order`: tambah bagian ke susunan (mis. Bait 1, Reff, Bait 2, Reff, Bridge, Reff), ubah urutan, hapus dari susunan tanpa menghapus bagiannya. Bagian dapat diulang ×N. Pemutar, Mode Main, dan ekspor mengikuti `order`. |
| 3.2 Kelola bagian | Duplikat, pindah atas/bawah, lipat/buka, nama cepat (Intro, Bait, Pra-reff, Reff, Bridge, Outro). |
| 3.3 Sisip akor di kursor | Bilah akor kunci (akor diatonis dari panel 🎼) di atas kolom lirik: sekali ketuk menyisipkan `[Am]` di posisi kursor; tombol "📚 Kamus" memakai pemilih yang ada. Daftar akor bagian diperbarui otomatis bila sejajar. |
| 3.4 Dua mode edit | **Teks** (`[Am]kata`) dan **Akor di atas lirik** (monospace, seperti situs akor); konversi dua arah dengan `parseChordSheet` dan kebalikannya. |
| 3.5 Validasi | Akor tak dikenal kamus ditandai merah di pratinjau (dengan keterangan); peringatan bila tidak sejajar; tombol "Rapikan nama akor" (Bbmin7 → A#m7). |
| 3.6 Transpose lebih baik | Pilih "Ubah ke kunci…", dengan kunci tujuan yang ditulis lagu, bukan hanya ±1; capo yang disarankan ("capo termudah" untuk akor lagu) dan tombol terapkan. |
| 3.7 Akor yang dipakai | Strip diagram akor unik lagu (urut paling sering), ketuk untuk dengar, dan tombol **🏋 Latih akor lagu ini** yang memulai latihan dengan kumpulan akor lagu (memakai mode Latih yang sudah ada). |

**Kriteria selesai Fase 3:** satu reff yang diubah tampil di semua pengulangannya; transpose tidak pernah membuat lirik dan daftar akor berbeda; tombol Latih memulai sesi dengan akor lagu itu.

### Fase 4 — Pemutar dan Mode Main (ukuran M–L) → **Rilis D**

| Tugas | Rincian |
|-------|---------|
| 4.1 Sorotan per baris | Dengan penyelarasan (Fase 0), tiap penanda `[..]` dipetakan ke ketuk; Mode Main menyorot akor di lirik dan menggulir halus **per baris**, bukan per bagian (menutup batasan #1 di roadmap). |
| 4.2 Kontrol bermain | Mulai dari bagian ini, ulangi bagian (loop A–B), jeda/lanjut, ketuk bagian untuk lompat, spasi/panah di keyboard. |
| 4.3 Pelatih tempo | Opsional: naikkan BPM +5 setiap N putaran sampai target. |
| 4.4 Tampilan | Pratinjau "akor berikutnya", diagram akor aktif (bisa dimatikan), tata letak dua kolom di lanskap/tablet, ukuran huruf diingat per perangkat, kompatibel tema terang dan Mode Panggung. |
| 4.5 Mode gulir saja | Gulir otomatis menurut tempo tanpa suara akor (untuk bermain bersama lagu asli). |

### Fase 5 — Ekspor, impor, bagikan (ukuran M)

| Tugas | Rincian |
|-------|---------|
| 5.1 ChordPro | Impor dan ekspor `.cho`/`.pro` (`{title:}`, `{key:}`, `{capo:}`, `{tempo:}`, `{start_of_chorus}`, `[Am]`). |
| 5.2 Teks | Ekspor teks biasa (akor di atas lirik) dan tombol **Salin**. |
| 5.3 Cetak | `@media print` yang bersih (terang, tanpa tombol) dan tombol **Cetak / simpan PDF** lewat dialog cetak browser. |
| 5.4 Kartu lagu | Kartu gambar (canvas) berisi judul, kunci, capo, BPM, dan deretan akor; **tanpa** lirik penuh (menghindari menyebar lirik berhak cipta). |
| 5.5 Impor banyak berkas | Pilih beberapa `.json`/`.cho` sekaligus; lewati duplikat berdasarkan isi. |

### Fase 6 — Penyempurnaan (ukuran M)
- Undo/redo di editor (riwayat singkat per sesi edit).
- Render bertahap: ubah satu bagian tidak membangun ulang seluruh daftar bagian; fokus kolom ketik tidak hilang.
- Tampilan **bemol** opsional (Bb, Eb, Ab) mengikuti kunci lagu, hanya di lapisan tampil/ekspor; penyimpanan tetap kres.
- Aksesibilitas: label, urutan fokus, kontras di kedua tema, ukuran sentuh 44 px.
- Empty state dan tip baru di Bantuan untuk fitur-fitur di atas.
- Bahasa teks seragam ("Urungkan", "Pustaka", dll.).

---

## 4. Urutan rilis

| Rilis | Isi | Versi cache (perkiraan) |
|-------|-----|-------------------------|
| Fase 0 (digabung ke A) | Bug dan fondasi | v18 |
| **A** | Progresi: mesin putar, editor, romawi, transpose, pustaka, pola strum | v18–v19 |
| **B** | Pustaka lagu + sinkron banyak lagu (butuh SQL Supabase bila skema berubah) | v20 |
| **C** | Editor lagu: susunan, sisip akor, validasi, latih akor lagu | v21 |
| **D** | Mode Main per baris, ekspor/impor ChordPro, cetak | v22 |
| Fase 6 | Penyempurnaan, dikerjakan menyebar di tiap rilis | — |

Tiap rilis dikirim sebagai zip lengkap seperti sebelumnya, dengan daftar perubahan dan batasan yang jujur.

---

## 5. Tes dan QA

**Otomatis (Node, tanpa browser):**
- `tests/song.test.js`: `cleanSong` v1→v2, transpose, `parseChordSheet`, `alignSection`, ChordPro.
- `tests/timeline.test.js`: `buildTimeline` (urutan, durasi, birama 3/4 dan 6/8, loop, perubahan BPM di tengah).
- Perluas `sync.test.js`, `rls.test.js`, `share.test.js`, `finger-move.test.js` sesuai fase.
- `chord-detection.test.js` tetap dijalankan sebelum tiap rilis untuk memastikan deteksi tidak berubah.

**Manual (perlu HP nyata, karena saya tidak bisa membuka browser):**
1. Pengguna lama: buka versi baru, lagu dan progresi lama masih ada.
2. Putar progresi 5 menit: tempo tidak melambat; jeda/lanjut bersih; layar mati-nyala tidak membuat bunyi dobel.
3. Dua perangkat: edit lagu berbeda saat offline, lalu sinkron.
4. Transpose lagu lalu bandingkan lirik dan daftar akor.
5. Mode Main di HP potret, HP lanskap, tablet; tema gelap, terang, Mode Panggung.
6. Cetak/PDF dari browser HP dan laptop.

---

## 6. Risiko

| Risiko | Pencegahan |
|--------|------------|
| Migrasi data merusak lagu lama | Cadangan otomatis sebelum migrasi, migrasi bisa diulang aman, tes dengan data v1 nyata. |
| Sinkron banyak lagu menimbulkan konflik atau duplikat | Kunci `(user_id, id)` tetap; konflik per lagu disimpan, tidak ditimpa; tombstone lewat `deleted_at`; tes dua perangkat. |
| Penjadwal audio berbeda antar browser (terutama iOS Safari) | Pakai jam `AudioContext` saja, lanjutkan konteks lewat sentuhan pengguna; uji manual di iOS dan Android. |
| Perubahan besar pada variabel global `song` | Pertahankan `song` sebagai penunjuk lagu aktif; ubah bertahap di balik fungsi `songGet/songSet`. |
| Ukuran `localStorage` | Batas jumlah lagu dan ukuran per lagu (sudah ada 1 MB di server); peringatan saat mendekati penuh. |
| Lirik berhak cipta | Kartu bagikan dan fitur apa pun yang keluar dari perangkat tidak memuat lirik penuh; lirik hanya tersimpan di perangkat dan akun pengguna sendiri. |
| Cakupan melebar | Kerjakan per rilis; fitur yang tidak muat digeser, bukan dipadatkan. |

**Di luar cakupan:** pustaka lagu komunitas/tautan bagikan publik (butuh backend), rekaman audio dan lagu pengiring, dan perubahan apa pun pada deteksi nada.

---

## 7. Keputusan yang saya butuhkan

1. **Progresi bernama:** (A, disarankan) disimpan sebagai "lagu" ringan berjenis progresi di pustaka yang sama, hemat kerja sinkron; atau (B) pustaka progresi terpisah.
2. **Rilis pertama:** mulai dari **A (Progresi)** dulu, atau langsung **B (Pustaka lagu)** karena itu pembatas terbesar?
3. **Skema server:** kamu bersedia menjalankan satu SQL migrasi baru di Supabase saat Rilis B?
4. **Bemol:** tampilan Bb/Eb/Ab di Fase 6 perlu, atau cukup tetap kres?
5. **Mode Main per baris (Fase 4):** untuk lagu yang daftar akornya tidak sejajar dengan lirik, pilih: peringatan + sorotan per bagian (seperti sekarang), atau dorong pengguna menekan "Sejajarkan dari lirik" otomatis?
