# Pitchcraft — Ultimate Guitar Chord Master

Deteksi akor dari genjrengan, tuner, kamus akor, latihan, Latih Telinga, dan editor lagu. Jalan offline sebagai PWA.

## Menjalankan

Buka `index.html` di Chrome / Firefox / Samsung Internet. Semua file harus tetap dalam satu folder.
Mikrofon butuh **HTTPS** atau **localhost** (di file lokal sebagian browser memblokirnya). Service worker juga hanya jalan lewat HTTPS atau localhost.

## Dokumen

| File | Isi |
|------|-----|
| `ROADMAP-FITUR.md` | 11 fitur roadmap beserta status, cara kerja, dan batasannya (semua selesai) |
| `PLAN-LAGU-PROGRESI.md` | Rencana peningkatan fitur Lagu dan Progresi (belum ada kode) |
| `README_DB.md` | Memasang akun dan sinkron (Supabase) |
| `privacy.html` | Kebijakan privasi (ditautkan dari dialog Akun) |

## Struktur

```
index.html          kerangka halaman
privacy.html        kebijakan privasi
manifest.json       PWA
sw.js               service worker
css/style.css       semua gaya (tema terang dan Mode Panggung di bagian akhir)
icons/              ikon PWA (harus ikut diunggah)
js/                 kode aplikasi
supabase/           skema SQL dan migrasi
tests/              tes otomatis (Node)
```

### Folder `js/`

Dimuat berurutan; **urutan di bagian bawah `index.html` penting**.

| Kelompok | File |
|----------|------|
| Dasar | `boot.js` penangkap error awal · `config.js` konfigurasi dan utilitas perangkat · `chords-db.js` kamus akor |
| Deteksi (inti, tidak diubah fitur baru) | `pitch.js` pendeteksi pitch · `gate.js` penyaring suara dan kestabilan · `tuner.js` tuner mikrofon · `strum-analysis.js` dan `strum-mode.js` Mode Strum |
| Suara | `audio.js` suara akor (Karplus-Strong) dan metronom |
| Akor dan progresi | `chords-ui.js` analisis dan tampilan akor · `progression.js` progresi · `strum-pattern.js` pola strum · `key-capo.js` kunci dan capo · `chord-library.js` Kamus Akor lengkap · `chord-pick.js` pemilih akor dari Kamus |
| Menu dan tuner | `tabs.js` menu, tip tiap tab, panel Bantuan · `tuning.js` tuner senar |
| Latihan | `practice.js` latihan dan rekam · `ear-training.js` **Latih Telinga** (7 jenis latihan, ulasan soal salah, pengumuman pembaca layar) · `finger-move.js` animasi jari (kartu Pindah Akor) · `voice-range.js` Cari Kunci Suaramu (pelacak nada suara `vcYin`, tanpa mengubah `pitch.js`/`gate.js`) |
| Lagu | `song.js` tab Lagu · `extras.js` tap tempo, streak/lencana, tempel lirik+akor, Mode Main, pasang app |
| Tampilan | `fx.js` efek tekan, penanda tombol aktif, animasi tab · `theme.js` tema gelap/terang/otomatis dan Mode Panggung (`pc_theme`, `pc_stage`, per perangkat) · `share.js` kartu bagikan (canvas: progresi, skor latihan, hasil Latih Telinga) |
| Data dan akun | `store.js` penyimpanan lokal, log sesi, dan pembersih/penggabung statistik telinga · `settings.js` penyimpanan pengaturan · `supabase-config.js` URL/kunci (kosong = fitur akun mati) · `sync.js` akun dan sinkron |
| Mulai | `init.js` inisialisasi (dijalankan terakhir) |

## Merilis perubahan

1. Jalankan `node --check` pada file JS yang berubah dan semua tes di bawah.
2. Naikkan `VERSI` di `sw.js` **dan** `APP_VER` di `js/tabs.js` (harus sama, mis. `pitchcraft-v32` dan `v32`) agar cache lama dibuang.
3. Bila menambah file baru di `js/`, daftarkan juga di `FILES` pada `sw.js` dan di bagian bawah `index.html`.
4. Folder `icons/` harus ikut diunggah.

## Tes

Semua dijalankan dari folder utama dengan Node 18+. Tes memuat kode asli di `js/` pada sandbox, jadi tidak butuh browser.

| Perintah | Yang diuji |
|----------|------------|
| `node tests/chord-detection.test.js` | Mensintesis genjrengan (harmonik, derau, senar tipis lemah) untuk 12 nada dasar, lalu melaporkan akor yang salah baca. Keluar dengan kode 1 bila akurasi di bawah ambang, jadi aman dijalankan sebelum mengunggah perubahan penyetelan. Tambahkan `--harmonik` untuk menguji algoritma harmonik. Power chord (5) dan sus2 sengaja dilaporkan sebagai INFO saja (kalah dari mayor/add9 saat terts samar). |
| `node tests/ear-training.test.js` | Latih Telinga (7 jenis: akor, interval, urutan akor, arah melodi, derajat nada, nama nada, nama akor): soal seimbang, pembangun soal untuk 12 nada dasar, jadwal petikan, alur ronde, ulasan soal salah, pengumuman pembaca layar, pencatatan sesi, rekor, statistik tebakan, dan penggabungan statistik. |
| `node tests/finger-move.test.js` | Rencana perpindahan jari (tetap/berpindah/diangkat/diletakkan) dan gambar SVG-nya. |
| `node tests/voice-range.test.js` | Penangkap nada tahan (rentang rendah/tinggi) dan logika saran kunci + capo. |
| `node tests/share.test.js` | Kartu bagikan dengan canvas palsu (memastikan tidak error dan teks terbentuk, bukan menilai tampilan). |
| `node tests/sync.test.js` | Logika gabung sinkron dengan server palsu (sesi, lencana, lagu, konflik). Tidak menguji Supabase asli. |
| `node tests/song.test.js` | Lagu dan tempel teks: transpose (hanya penanda akor), pembaca teks akor (judul bagian, C-, Csus, Cb/E#), batas bagian/akor, konfirmasi impor, batas progresi. |
| `node tests/sw.test.js` | Service worker dengan lingkungan palsu: cache:"reload", file inti gagal = pemasangan batal, ikon boleh gagal, pemberitahuan versi baru. |
| `node tests/rls.test.js` | RLS pada Supabase **asli**; butuh dua akun uji, lihat komentar di awal file. |

## Data di perangkat

Semua disimpan di `localStorage`. Yang ikut tersinkron bila masuk akun: sesi latihan, lencana, catatan akor salah, lagu aktif, pengaturan, progresi, dan statistik Latih Telinga. Statistik Latih Telinga (`pc_ear`: rekor, benar/salah per jawaban, tebakan tertukar) ikut cadangan dan sinkron sebagai bagian pengaturan; pilihan tampilan dan ringkasan ronde terakhir di `pc_ear` tetap di perangkat. Yang hanya di perangkat: `pc_voice` (rentang suara), `pc_theme` dan `pc_stage`. Rincian lengkap ada di `privacy.html`.
