# Memasang akun & sinkron (Supabase)

Tanpa langkah ini app tetap jalan penuh (offline, tanpa login). Langkah di bawah mengaktifkan tombol **👤 Akun**.

1. **Buat project** di supabase.com.
2. **Skema:** buka *SQL Editor*, tempel isi `supabase/schema.sql`, jalankan sekali. Jika database sudah dipasang sebelum 20 Okt 2026, jalankan `supabase/2026-10-20-misses.sql` saja (menambah tabel `misses`).
3. **Login** (*Authentication → Providers*):
   - **Email** aktifkan (tautan masuk / magic link).
   - **Google:** buat OAuth client di Google Cloud Console, salin Client ID & Secret ke Supabase, dan tambahkan alamat callback dari Supabase ke "Authorized redirect URIs" di Google.
4. **URL** (*Authentication → URL Configuration*): isi *Site URL* dengan alamat situsmu (HTTPS), dan tambahkan ke *Redirect URLs* alamat halaman app persis seperti yang dibuka pengguna (mis. `https://domainmu.com/` dan `https://domainmu.com/index.html`) serta `http://localhost:PORT/` untuk uji.
5. **Kunci:** *Project Settings → API*, salin **Project URL** dan kunci **anon/publishable** ke `js/supabase-config.js`.
   Jangan pernah memasukkan `service_role` key.
6. Naikkan `VERSI` di `sw.js`, lalu unggah ke hosting HTTPS.
7. Pustaka klien dimuat dari CDN dan dikunci ke versi di `supabase-config.js` (`lib`). Periksa bahwa URL-nya masih valid dan naikkan ke versi stabil terbaru setelah diuji.

## Uji sebelum dibuka ke pengguna
- `node tests/sync.test.js` menguji logika gabung dengan server palsu (tidak menguji Supabase asli).
- **Uji RLS dengan dua akun:** masuk sebagai A, buat progres; masuk sebagai B dan pastikan data A tidak terlihat, dan tidak bisa ditulis/dibaca lewat API.
- Uji dua perangkat nyata: main offline di HP, buka di laptop; edit lagu yang sama di keduanya saat offline.
- Uji "Hapus akun": semua baris di tabel `sessions`, `badges`, `misses`, `songs`, `settings` harus hilang.
- Uji alur login dari PWA yang sudah dipasang (OAuth di PWA bisa berperilaku beda dari di browser).

## Cara kerja singkat
- Sumber utama tetap `localStorage`; server hanya salinan. Sinkron berjalan saat login, app dibuka/kembali terlihat, online kembali, dan beberapa detik setelah ada perubahan.
- **Sesi:** log hanya-bertambah ber-ID unik; total per hari dihitung ulang dari sesi, jadi 60 dtk (HP) + 120 dtk (laptop) = 180 dtk.
- **Lencana:** gabungan, tidak dicabut.
- **Catatan akor salah:** seperti sesi (hanya bertambah, ber-ID); perangkat menyimpan 300 terbaru.
- **Lagu aktif & pengaturan/progresi:** waktu server (`updated_at`, diisi trigger) menentukan versi terbaru. Jika dua perangkat sama-sama mengubah dan isinya beda, versi server dipakai dan versi perangkat ini **disimpan** untuk dipulihkan lewat 👤 Akun.
- Audio mikrofon tidak pernah dikirim.

## Batasan versi ini
- Baru **satu lagu aktif** yang disinkron (app memang masih punya satu lagu aktif).
- Penghapusan lagu dengan tombstone (`deleted_at`) sudah ada di skema, tapi belum dipakai UI (menunggu keputusan banyak lagu).
- Pengaturan perangkat (tuning, kalibrasi A, mode kidal, dll.) ikut tersinkron antar perangkat.
- Hari dihitung dari tanggal lokal saat sesi. Streak dihitung di klien, jadi bisa dimanipulasi pengguna sendiri; jangan dipakai untuk peringkat atau hadiah tanpa perhitungan di server.
- Sesi lama dari `pc_days` diimpor sebagai satu sesi `legacy-TANGGAL` per hari. Jika dua perangkat punya data lama untuk tanggal yang sama, hanya yang masuk server lebih dulu yang tersimpan.
