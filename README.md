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
  - `strum-analysis.js` / `strum-mode.js` Mode Strum · `tabs.js` menu · `tuning.js` tuner senar
  - `key-capo.js` kunci & capo · `strum-pattern.js` pola strum · `practice.js` latihan & rekam · `init.js` inisialisasi

## Tes deteksi akor
`node tests/chord-detection.test.js` — mensintesis genjrengan (harmonik, derau, senar tipis lemah) untuk 12 nada dasar,
menjalankan kode asli di `js/`, lalu melaporkan akor yang salah baca. Keluar dengan kode 1 jika akurasi di bawah ambang,
jadi aman dijalankan sebelum mengunggah perubahan penyetelan. Tambahkan `--harmonik` untuk menguji algoritma harmonik.
Power chord (5) dan sus2 sengaja dilaporkan sebagai INFO saja (kalah dari mayor/add9 saat terts samar).
