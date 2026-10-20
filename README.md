# Pitchcraft — Ultimate Guitar Chord Master

Buka `index.html` di Chrome / Firefox / Samsung Internet. Semua file harus tetap dalam satu folder.
Mikrofon butuh HTTPS atau localhost (di file lokal sebagian browser memblokirnya).

## Struktur
- `index.html` — kerangka halaman
- `css/style.css` — semua gaya
- `js/` — dimuat berurutan (urutan di bagian bawah `index.html` penting):
  - `boot.js` penangkap error awal · `config.js` konfigurasi & utilitas perangkat · `chords-db.js` kamus akor
  - `pitch.js` pendeteksi pitch · `gate.js` penyaring suara & kestabilan · `audio.js` suara akor & metronom
  - `tuner.js` tuner mikrofon · `chords-ui.js` analisis & tampilan akor · `progression.js` progresi
  - `strum-analysis.js` / `strum-mode.js` Mode Strum · `tabs.js` menu, tip tiap tab, panel Bantuan · `tuning.js` tuner senar
  - `key-capo.js` kunci & capo (panel melayang di samping / lembar bawah di HP) · `chord-library.js` Kamus Akor lengkap · `strum-pattern.js` pola strum · `practice.js` latihan & rekam · `song.js` lagu (tab Lagu) · `extras.js` tap tempo, streak/lencana, tempel lirik+akor, Mode Main, pasang app · `fx.js` efek tekan, penanda tombol aktif, animasi tab (gayanya di bagian akhir `style.css`) · `finger-move.js` animasi jari saat pindah akor (kartu Pindah Akor di tab Progresi) · `theme.js` tema gelap/terang/otomatis + Mode Panggung (pilihan di `pc_theme` / `pc_stage`, per perangkat, tidak ikut sinkron; gayanya juga di akhir `style.css`) · `chord-pick.js` pemilih akor dari Kamus (tab Progresi & Lagu) · `share.js` kartu bagikan (gambar progresi/skor via canvas) · `settings.js` penyimpanan pengaturan · `init.js` inisialisasi
- `store.js` penyimpanan lokal & log sesi · `sync.js` akun + sinkron Supabase · `supabase-config.js` URL/kunci (kosong = fitur akun mati) · `supabase/` skema SQL + panduan pasang
- `privacy.html` kebijakan privasi (ditautkan dari dialog Akun)
- `manifest.json`, `sw.js`, `icons/` — PWA (bisa dipasang & offline). Naikkan `VERSI` di `sw.js` (dan `APP_VER` di `js/tabs.js`) setiap kali file berubah. Folder `icons/` harus ikut diunggah.

## Tes deteksi akor
`node tests/chord-detection.test.js` — mensintesis genjrengan (harmonik, derau, senar tipis lemah) untuk 12 nada dasar,
menjalankan kode asli di `js/`, lalu melaporkan akor yang salah baca. Keluar dengan kode 1 jika akurasi di bawah ambang,
jadi aman dijalankan sebelum mengunggah perubahan penyetelan. Tambahkan `--harmonik` untuk menguji algoritma harmonik.
Power chord (5) dan sus2 sengaja dilaporkan sebagai INFO saja (kalah dari mayor/add9 saat terts samar).

## Tes animasi jari
`node tests/finger-move.test.js` — menguji rencana perpindahan jari (tetap/berpindah/diangkat/diletakkan) dan gambar SVG-nya.

## Tes RLS (Supabase asli)
`node tests/rls.test.js` — butuh dua akun uji; lihat komentar di awal file.

## Tes sinkron
`node tests/sync.test.js` — menguji logika gabung dengan server palsu (sesi, lencana, lagu, konflik). Tidak menguji Supabase asli.
