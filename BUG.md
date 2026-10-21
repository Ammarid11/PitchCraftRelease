# Pitchcraft — Laporan Bug (v30)

Tanggal analisis: 21 Okt 2026. Dasar: pembacaan kode semua file yang diunggah, **tanpa dijalankan** di browser atau perangkat.

**Tingkat keyakinan**
- **Pasti**: terbukti dari logika kode.
- **Mungkin**: perlu dicoba di perangkat nyata.
- **Desain**: perilaku disengaja, tetapi merugikan pengguna.

## Ringkasan

| # | Bug | Berat | Keyakinan | File |
|---|-----|-------|-----------|------|
| 1 | Semua titik jari barre berlabel "1" | Tinggi | Pasti | `chords-ui.js` |
| 2 | Nama nada: target bisa di bawah acuan, umpan balik salah | Tinggi | Pasti | `ear-training.js` |
| 3 | Lagu terpotong diam-diam saat dimuat ulang | Tinggi | Pasti | `song.js` |
| 4 | Latihan mikrofon tak mungkin lulus untuk akor lanjutan/slash | Tinggi | Pasti | `practice.js` |
| 5 | Transpose merusak teks non-akor di `[...]` | Tinggi | Pasti | `song.js` |
| 6 | Impor lagu `.json` menimpa tanpa konfirmasi | Tinggi | Pasti | `song.js` |
| 7 | Service worker bisa menyimpan file lama | Sedang | Pasti | `sw.js` |
| 8 | Wake Lock bocor | Sedang | Pasti | `config.js` |
| 9 | `setStage(false)` melepas lock saat ukur suara | Sedang | Pasti | `theme.js` |
| 10 | "Hapus data di perangkat ini" tidak lengkap | Sedang | Pasti | `sync.js` |
| 11 | Cache Karplus-Strong tumbuh tanpa batas | Sedang | Pasti | `audio.js` |
| 12 | AudioContext bocor / tertahan di iOS | Sedang | Mungkin | `tuner.js`, `strum-mode.js` |
| 13 | Gabung statistik telinga bisa kehilangan data | Sedang | Desain | `store.js` |
| 14 | Alur Latih Telinga: ronde terbuang, bunyi menumpuk | Sedang | Pasti | `ear-training.js`, `practice.js` |
| 15 | Pembaca teks tempel salah baca | Sedang | Pasti | `extras.js` |
| 16 | Pola strum tidak cocok dengan birama | Sedang | Pasti | `progression.js` |
| 17 | Kamus: jumlah hasil dipotong 90 | Rendah | Pasti | `chord-library.js`, `chord-pick.js` |

---

## A. Bug fungsional (prioritas tinggi)

### 1. Semua titik jari pada akor barre berlabel "1"
**File:** `chords-ui.js` → `analyzeFingers`

```js
for (let i = a; i <= b; i++) fing[i] = 1;
```

Perulangan memberi jari 1 ke **semua** senar di antara ujung barre, termasuk senar yang ditekan di fret lebih tinggi. Bm `x 2 4 4 3 2` menjadi `[0,1,1,1,1,1]`.

**Dampak:** diagram horizontal dan vertikal menampilkan angka 1 di semua titik pada akor barre. Kartu Pindah Akor ikut salah karena `mvPlan` membandingkan nomor jari untuk menentukan "tetap" atau "berpindah". `finger-move.test.js` lolos karena hanya menguji konsistensi, bukan kebenaran penomoran.

**Perbaikan:**
```js
for (let i = a; i <= b; i++) if (f[i] === m) fing[i] = 1;
```
Tambahkan tes: Bm, F#m (bentuk E), dan F harus punya nomor jari 1–4 yang benar.

### 2. Latih Telinga "Nama nada": target bisa di bawah acuan
**File:** `ear-training.js` → `earBuild('namanada')`, `earFbText`

Target dibuat di oktaf acak (MIDI 48–71), sedangkan acuan di `60 + rp` (MIDI 60–71). Target sering berada **di bawah** acuan, mis. acuan G4 dan target E3.

Umpan balik tetap berbunyi "N semitone di atas acuan", dan panduan menyuruh mengukur "makin jauh, makin tinggi". Untuk sekitar separuh soal, pelajaran yang diberikan salah. Tes hanya memeriksa rentang 48–71, bukan hubungan dengan acuan.

**Perbaikan:** untuk tingkat dengan acuan, buat `m = 60 + rp + ((pi - rp + 12) % 12)` sehingga target selalu 0–11 semitone di atas acuan. Variasi oktaf cukup dipakai di tingkat Ahli. Tambahkan tes `target >= acuan`.

### 3. Lagu terpotong diam-diam saat dimuat ulang
**File:** `song.js` (`cleanSong`) vs `songAddSection`, `cpAdd`, `songFromProg`

UI membolehkan bagian, akor, dan lirik tanpa batas. `cleanSong` memotong ke 40 bagian, 200 akor per bagian, dan 20.000 karakter lirik, dan dijalankan saat `loadSettings`, sinkron, dan impor. Bagian ke-41 atau akor ke-201 hilang setelah refresh tanpa peringatan.

**Perbaikan:** tegakkan batas yang sama di UI dan tampilkan toast "batas tercapai".

### 4. Latihan mikrofon tak mungkin lulus untuk akor lanjutan/slash
**File:** `practice.js` → `drillStart`, mode `drill`

Pool diambil dari Progresi, yang bisa berisi `Cmaj9`, `Dm/F`, atau `m9`. `rankByChroma` melewati semua akor `ext`, jadi target itu tidak akan pernah terbaca. Pengguna terjebak dengan kesalahan terus, dan `logMiss` mencemari statistik "Latih yang lemah". Dengan capo, `tKey` juga bisa menghasilkan nama yang tidak ada di kamus.

**Perbaikan:** saring pool dengan `!chordDatabase[k].ext` dan beri tahu akor mana yang dibuang.

### 5. Transpose merusak teks non-akor di dalam `[...]`
**File:** `song.js` → `songTranspose`

`tKey` mengganti setiap `[A-G][#b]?` di isi kurung siku:
- `[Bridge]` menjadi `[Cridge]`
- `[Chorus]` menjadi `[C#horus]`
- `[Coda]` menjadi `[C#oda]`

Daftar akor dan penanda lirik juga bisa berbeda setelah transpose (B2 di `PLAN-LAGU-PROGRESI.md`).

**Perbaikan:** transpose isi kurung hanya jika lolos `CH_RE`/`chordKeyOf`; selain itu biarkan.

### 6. Impor lagu `.json` menimpa lagu aktif tanpa konfirmasi
**File:** `song.js` → `songImport` → `applySong`

`importProgress` memakai `confirm`, tetapi impor lagu tidak. Ditambah B4 (Kosongkan progresi dan Hapus bagian tanpa urungkan), ini jalur kehilangan data yang mudah terjadi.

**Perbaikan:** `confirm` bila lagu aktif berisi, atau simpan salinan ke `pc_conflicts` sebelum menimpa.

---

## B. Bug sedang

### 7. Service worker bisa menyimpan file lama
**File:** `sw.js` → `install`

`c.add(f)` memakai cache HTTP browser. Jika hosting mengirim `Cache-Control: max-age`, cache `VERSI` baru berisi file lama dan menaikkan `VERSI` tidak membantu.

- Gunakan `c.add(new Request(f, { cache: 'reload' }))`.
- Kegagalan satu file hanya di-`console.warn`, jadi SW tetap "sukses" dengan cache bolong.
- Tidak ada pemberitahuan "versi baru, muat ulang" setelah `skipWaiting` + `claim`, sehingga pengguna bisa lama memakai JS versi lama.

### 8. Wake Lock bocor
**File:** `config.js` → `keepAwake`

Tiap panggilan meminta lock baru dan menimpa variabel `wakeLock` tanpa melepas yang lama. Mode Panggung aktif, lalu Strum, lalu Mode Panggung dimatikan: lock pertama menjadi yatim dan layar tidak padam sampai halaman disembunyikan.

**Perbaikan:** `if (wakeLock) return;` di awal `keepAwake`.

### 9. `setStage(false)` melepas lock saat pengukuran suara berjalan
**File:** `theme.js`

Kondisi hanya mengecek `isListening`, `isStrum`, dan `perf`, bukan `vcActive`. Tambahkan `vcActive`.

### 10. "Hapus data di perangkat ini" tidak lengkap
**File:** `sync.js` → `wipeLocal`

Tidak ikut terhapus: `pc_hist`, `pc_saved`, `pc_ex` (pola yang dipelajari), `pc_tips`. `pc_settings` baru ditimpa lewat `renderSong`. Ini bertentangan dengan teks `privacy.html`.

Terkait: `clearHist` hanya menghapus `pc_miss` lokal; catatan di server dan perangkat lain tetap ada dan akan ditarik kembali saat sinkron.

### 11. Cache buffer Karplus-Strong tumbuh tanpa batas
**File:** `audio.js` → `ksCache`

Tiap panjang delay `L` unik memakai sekitar 0,5 MB (2,6 dtk × 48 kHz × 4 byte). Tiap nada unik dari tuning, capo, kalibrasi A, dan Latih Telinga menambah entri dan tidak pernah dibuang. Di HP kelas bawah bisa mencapai puluhan MB.

**Perbaikan:** batas LRU, mis. 40 entri.

### 12. AudioContext bocor / tertahan di iOS
**File:** `tuner.js`, `strum-mode.js`

- Konteks dibuat sebelum `getUserMedia` dan pada error tidak ditutup (`voice-range.js` sudah benar lewat `vcCleanup`).
- Tanpa `resume()` eksplisit. Di iOS, `toggleStrum` setelah `await toggleListening()` membuat konteks di luar gestur sentuh sehingga bisa `suspended` dan analyser terbaca nol.

### 13. Gabung statistik telinga bisa kehilangan data
**File:** `store.js` → `pcEarMerge`

Hitungan per jawaban diambil dari sisi yang soalnya lebih banyak, bukan dijumlah. Jika HP dan laptop sama-sama berlatih, sebagian data hilang. Hasil gabungan juga baru terkirim pada perubahan statistik berikutnya karena `rec.hash` disetel ke hasil gabungan. Sudah dicatat di `README_DB.md`, tetapi efeknya nyata.

### 14. Alur Latih Telinga
- Mengubah tingkat, acuan, atau "petik satu-satu" saat ronde berjalan **membuang ronde** tanpa konfirmasi (`earOpt` memanggil `ear = null`).
- "Dengar lagi" ditekan cepat menumpuk bunyi.
- `drillStart` tidak mengecek `ear`, sehingga latihan mikrofon bisa menangkap bunyi speaker dari ronde telinga. Pengecekan hanya berlaku satu arah.

### 15. Pembaca teks tempel
**File:** `extras.js`
- `HEAD_RE`: lirik seperti "Bridge over troubled…" (hingga 18 karakter setelah kata kunci) terbaca sebagai judul bagian.
- `chordKeyOf`: `C-` (minor) dan `Csus` diam-diam menjadi `C`.
- `Cb`, `Fb`, `E#`, `B#` tidak ada di `FLAT_TO_SHARP`.

### 16. Pola strum tidak cocok dengan birama
**File:** `progression.js`

Pola Waltz (6 sel) di 4/4 (`barSlots` = 8) memakai `(k % 8) % 6`, sehingga pola bergeser tiap bar. Belum ada peringatan (rencana 1.7 menyebut validasi).

### 17. Kamus akor
- `.slice(0, 90)` memotong hasil dan jumlah ditampilkan sebagai 90. Pencarian "m" menampilkan "90 akor" padahal lebih banyak.
- Pemilih `rootSel` + `qualSel` menawarkan slash chord yang tidak ada untuk akar tertentu, lalu `alert`.

---

## C. Dokumen dan privasi

| Temuan | Detail |
|--------|--------|
| Tanggal masa depan | `privacy.html`: "Terakhir diperbarui: 22 Oktober 2026", padahal hari ini 21 Okt. |
| `pc_voice` | Dokumen menyebut "hanya dua nomor nada", tetapi `vcSave` juga menyimpan `S` (lebar melodi). |
| `TINGKATKAN-LATIHAN-TELINGA.md` | Bagian atas menyebut "8 jenis" (kenyataannya 7) dan daftar #2, 3, 5, 6 yang sudah selesai; status baru hanya di bagian bawah. |
| Orientasi | `manifest.json` mengunci `portrait`, menghambat Mode Main di tablet/lanskap (Fase 4 rencana). |

## D. Basis data

- Tidak ada batas jumlah baris per pengguna untuk `sessions` dan `misses`.
- `settings.data` dibatasi 200.000 byte, tetapi Progresi tidak dibatasi di klien; progresi sangat besar membuat sinkron gagal terus.
- `updateDoc` hanya memperbarui `data`, jadi `schema_version` tidak naik saat `SETTINGS_V` berubah.
- `lsSet` menelan semua error, sehingga kuota penuh membuat data tidak tersimpan tanpa pemberitahuan.

## E. Performa dan aksesibilitas

- `fx.js`: `setInterval(fxSync, 400)` berjalan selamanya dengan empat `querySelectorAll` per putaran.
- `style.css`: `body::before` beranimasi tanpa henti (26 dtk), terus memakai GPU dan baterai; hanya mati di Mode Panggung atau "kurangi gerakan".
- `pitch.js`: tiap frame mengalokasikan `Float32Array` baru dan menghitung YIN penuh (sekitar 1,6 juta operasi), berat di HP lemah.
- Dialog tanpa perangkap fokus dan tanpa kunci scroll latar. Elemen `div onclick` tidak terjangkau keyboard: `.lib-dia`, badge senar tuner, dan tombol × di `.badge span`.
- `boot.js`: banner merah muncul untuk error apa pun dan tidak bisa ditutup.
- `voice-range.js`: `vcMode` hanya disinkronkan saat halaman dimuat; setelah panel 🎼 diubah ke minor, hasil bisa memakai mode yang salah.

## F. Yang diperiksa dan tampak benar

- Urutan pemuatan skrip dan rantai pembungkus fungsi (`showTab`, `saveSettings`, `refreshChordViews`, `renderKey`).
- Bentuk jari dan nada di `chords-db.js` (movable E/A/D, `OPEN`, `SLASH`) cocok dengan nada akornya.
- Logika `syncDoc`/`syncOnce` (kursor, dedupe, kondisi balapan) dan `pcEarClean`/`pcEarMerge`.
- Pembuatan HTML memakai `esc` di jalur yang menerima input pengguna.

## G. Tidak bisa diverifikasi dari sini

- Folder `icons/` (tidak ada di unggahan). Bila kosong, SW tetap "sukses" tanpa ikon PWA.
- Perilaku Supabase asli (RLS, `upsert ... ignoreDuplicates`, filter `updated_at` bertimestamp mikrodetik) dan OAuth di PWA.
- Audio, mikrofon, dan tata letak di perangkat nyata, termasuk koreksi sub-oktaf `detectPitch` (ambang 0,2). Tes otomatis hanya mencakup deteksi akor, bukan tuner satu senar.

---

## Urutan perbaikan yang disarankan

1. **#1** (satu baris, dampak luas) dan **#2**.
2. **#3, #4, #5, #6**: pencegahan kehilangan data.
3. **#7, #8, #10**: SW, wake lock, hapus data.
4. Sisanya sesuai kebutuhan.

Setelah tiap perbaikan: naikkan `VERSI` di `sw.js` dan `APP_VER` di `js/tabs.js`, lalu jalankan semua tes. Tambahkan tes baru untuk #1 dan #2 karena tes yang ada tidak menangkap keduanya.
