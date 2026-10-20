# Pitchcraft — Login, Server, dan Sinkron (Supabase)

Dokumen rencana **dan status**. Tahap 0 sampai 4 sudah ada di kode; yang belum: banyak lagu, tombstone di UI, kebijakan privasi/cadangan, dan pengujian manual di perangkat nyata. Lihat bagian 7 dan 9.

> Soal harga, batas gratis, dan fitur Supabase: periksa dokumentasi dan halaman harga resminya sebelum memutuskan. Hal itu bisa berubah. Soal kewajiban hukum (privasi, UU PDP), tanyakan ke orang yang paham hukum.

Legenda status: ✅ selesai di kode · ⚠️ sebagian · ⬜ belum · 🧪 belum teruji di dunia nyata

File terkait: `js/store.js` (log sesi), `js/sync.js` (akun + mesin sinkron), `js/supabase-config.js` (URL/kunci), `supabase/schema.sql` (skema), `README_DB.md` (panduan pasang), `tests/sync.test.js` (tes logika gabung).

---

## 1. Tujuan dan batas

**Tujuan**
- Progres tersimpan aman dan bisa dibuka di HP, laptop, atau perangkat baru.
- App tetap berjalan penuh tanpa sinyal dan tanpa login.
- Login bersifat **opsional**: pengguna yang tidak login tetap memakai `localStorage`.

**Yang dikirim ke server**
- Sesi latihan, lencana, lagu aktif, pengaturan + progresi.

**Yang tidak pernah dikirim**
- Audio mikrofon. Deteksi nada dan akor berjalan sepenuhnya di perangkat. Teks ini sudah tampil di dialog Akun.

---

## 2. Pilihan login

| Opsi | Status | Catatan |
|------|--------|---------|
| Google (OAuth) | ✅ kode ada (`acctGoogle`) 🧪 | Butuh OAuth client di Google Cloud dan Redirect URL di Supabase; belum bisa dipastikan dari file |
| Email magic link | ✅ kode ada (`acctEmail`) 🧪 | Ada batas kirim email, bisa masuk spam |
| Login anonim lalu ditautkan | ⬜ | Opsional, tahap lanjut. Cek dokumentasi Supabase Auth versi terbaru |

**Keputusan:** Google + email magic link. Login anonim ditunda.

> Kode pemulihan acak tanpa akun butuh logika server tambahan dan datanya hilang jika kode hilang. Tidak dianjurkan sebagai jalur utama.

---

## 3. Arsitektur: offline-first ✅

```
[ UI ] → [ localStorage ]  ←→  [ sync engine ]  ←→  [ Supabase ]
              sumber utama                              salinan
```

- Semua tulis ke `localStorage` dulu; app tidak menunggu jaringan.
- Engine (`syncOnce`, `syncDoc`) dipisah dari adapter Supabase (`dbReal`), jadi bisa dites dengan server palsu.
- Pemicu sinkron: login, app dibuka/kembali terlihat (jeda minimal 60 dtk), event `online`, dan 4 detik setelah ada perubahan (`pcSyncSoon`).
- Server gagal dijangkau: status ditampilkan di dialog Akun, tanpa error mengganggu; dicoba lagi pada pemicu berikutnya.

---

## 4. Celah desain dan statusnya

| # | Masalah | Perbaikan | Status |
|---|---------|-----------|--------|
| 1 | Hitungan hari kurang (60 + 120 = 120) | Log sesi ber-ID; total harian dihitung dari gabungan sesi | ✅ dites (180 dtk) |
| 2 | Data terhapus hidup lagi | Tombstone `deleted_at` | ⚠️ kolom ada di skema, belum dipakai UI |
| 3 | Dua perangkat edit item sama saat offline | Salinan konflik, pengguna memilih | ⚠️ versi yang kalah disimpan di `pc_conflicts` dan bisa dipulihkan lewat Akun; belum ada gabung per bagian lagu |
| 4 | Jam perangkat bisa salah | `updated_at` dari trigger server; update bersyarat versi (`eq('updated_at', base)`) | ✅ dites (balapan terdeteksi) 🧪 uji jam diubah belum |
| 5 | Zona waktu | `day` disimpan di tiap sesi, streak dihitung dari kolom itu | ✅ 🧪 uji pindah zona belum |
| 6 | Ganti akun di perangkat yang sama | Dialog gabung atau hapus data lokal (`onAuth`) | ✅ 🧪 |
| 7 | Versi skema dan batas data | `schema_version` di tabel settings; server menyimpan semua sesi, batas hanya tampilan lokal | ⚠️ data lokal baru `v:1`, belum ada jalur migrasi versi berikutnya |

---

## 5. Model data

Skema yang berlaku ada di **`supabase/schema.sql`** (jangan salin dari dokumen ini). Beda dengan draf awal:

- Kunci utama `(user_id, id)` dengan `id` bertipe `text` (ID dibuat di klien, tidak boleh bertabrakan antar pengguna).
- `user_id` punya `default auth.uid()`.
- Ada `check` untuk panjang teks, rentang angka, dan ukuran `jsonb`.
- `sessions` dan `badges`: RLS hanya `select` + `insert` (append-only dari klien).
- `songs` dan `settings`: RLS `for all` untuk pemilik.
- Trigger `set_updated_at` (dengan `search_path` dikosongkan) mengisi waktu server.
- Fungsi `delete_my_account()` (`security definer`, hanya untuk `authenticated`) menghapus akun dan semua baris lewat `on delete cascade`.

✅ RLS lulus uji dua akun lewat `tests/rls.test.js` (20 Okt 2026): pengguna lain dan pengguna tanpa login tidak bisa membaca atau mengubah data, sesi/lencana append-only, batas nilai bekerja.

---

## 6. Aturan penggabungan

| Data | Aturan | Status |
|------|--------|--------|
| Sesi | Union berdasarkan `id`; kursor `created_at` server dengan tumpang tindih 2 menit; dikirim per 200 baris | ✅ |
| Hari latihan / streak | Dihitung ulang dari sesi (`daysOf`), tidak disimpan terpisah | ✅ |
| Lencana | Union, tidak dicabut; hanya ID yang dikenal app | ✅ |
| Lagu aktif | `updated_at` server menentukan. Jika dua sisi berubah dan isi berbeda: pakai versi server, simpan versi lokal sebagai konflik | ✅ (satu lagu) |
| Pengaturan + progresi | Sama seperti lagu. Pengaturan bawaan perangkat baru tidak dianggap konflik | ✅ |
| Banyak lagu, gabung per bagian | — | ⬜ |

---

## 7. Tahapan pengerjaan

### Tahap 0 — Penyimpanan lokal ✅ (sebagian kecil ⬜)
- ✅ `pc_days` diganti log sesi ber-ID + kolom `day`.
- ✅ Migrasi data lama ke sesi `legacy-YYYY-MM-DD` (aman diulang, dites). Catatan: jika dua perangkat punya data lama untuk tanggal yang sama, hanya yang masuk server lebih dulu yang tersimpan.
- ✅ Ekspor/impor progres `.json` dan `navigator.storage.persist()`.
- ⬜ Banyak lagu tersimpan (`id`, `updatedAt`, penanda hapus). Saat ini satu lagu aktif.
- ⬜ Catat akor yang salah per kejadian (untuk fitur "Latih yang lemah"). Sekarang hanya hitungan `bad` per sesi.
- ⚠️ `schema_version` lokal baru `v:1` tanpa migrasi.

### Tahap 1 — Siapkan Supabase ✅ di kode, 🧪 di dashboard
- ✅ `schema.sql` lengkap, `supabase-config.js` berisi URL + anon key (tanpa `service_role`).
- ✅ RLS terbukti dengan dua akun.
- 🧪 Provider login dan Redirect URL: tidak bisa dipastikan dari file.

### Tahap 2 — UI login ✅
- Tombol 👤 Akun, masuk Google/email, status sinkron, keluar, keluar + hapus data perangkat, hapus akun + data server, ekspor/impor.
- Dirombak (v5): tombol Google bergaya resmi (tema gelap) dengan status memproses; email dengan validasi, status "cek emailmu", dan hitung mundur kirim ulang; pesan error yang jelas (batas kirim, provider belum aktif, offline, galat dari URL balikan login); kartu profil + indikator sinkron; ringkasan data (streak, total latihan, sesi, lencana, lagu, progresi, sesi di server); hapus akun harus mengetik HAPUS.
- Tautkan akun (bind): daftar metode masuk, tombol "Tautkan akun Google" untuk pengguna email (`linkIdentity`) dan "Lepas" (`unlinkIdentity`, minimal dua metode). 🧪 Butuh **manual linking diaktifkan** di pengaturan Authentication Supabase (fitur beta, mati secara bawaan) dan versi `supabase-js` yang memiliki `linkIdentity`; bila belum, app menampilkan pesannya. Identitas dengan email yang sama tertaut otomatis oleh Supabase.
- Perbaikan: tombol Akun/Pasang sebelumnya ikut tersembunyi di layar ≥1280px (kelas `.keypill`); sekarang hanya pil Kunci yang disembunyikan.

### Tahap 3 — Mesin sinkron ✅
- `supabase-js` dikunci di versi 2.39.0 (jsDelivr), dimuat saat dibutuhkan.
- Push dan pull sesuai bagian 6, dengan jeda antar-picu.
- ⚠️ Library **tidak** ikut cache `sw.js` (beda origin). Saat offline di sesi baru, Akun menampilkan "Layanan akun belum termuat". Opsi: host sendiri filenya dan tambahkan ke `FILES`.

### Tahap 4 — Konflik dan kasus tepi ⚠️
- ✅ Konflik lagu/pengaturan disimpan dan bisa dipulihkan.
- ✅ Ganti akun di perangkat yang sama.
- ⚠️ Salinan konflik hanya di `localStorage` perangkat itu (bukan baris "Judul (konflik)" di server), jadi hilang jika data lokal dihapus.
- ⬜ Pengguna anonim yang menautkan email/Google.

### Tahap 5 — Privasi dan peluncuran ⬜
- ⬜ Halaman kebijakan privasi singkat (data apa, di mana, cara menghapus).
- ⬜ Cadangan database terjadwal dan pemantauan kuota.
- ⬜ Uji lapangan (bagian 9).

---

## 8. Keamanan

- ✅ Di klien hanya ada URL project dan anon key. Aman **hanya jika RLS aktif**; pastikan dengan uji dua akun.
- **Jangan pernah** menaruh `service_role` key di kode klien, repo publik, atau file apa pun yang dikirim ke pengguna.
- ✅ Data impor dan data server divalidasi (`cleanSession`, `cleanSong`: batas panjang, jumlah, tipe).
- ✅ Tampilan akun memakai `esc()` untuk teks dari server.
- 🧪 Login OAuth pada PWA yang dipasang bisa berperilaku beda dari browser biasa; uji di perangkat nyata.
- Streak dihitung di klien, jadi bisa dimanipulasi pengguna sendiri. Jangan dipakai untuk peringkat atau hadiah tanpa perhitungan di server.

---

## 9. Checklist uji

Dicakup `tests/sync.test.js` (server palsu, bukan Supabase asli):
- [x] Dua sesi di hari yang sama dari dua perangkat menjumlah dengan benar.
- [x] Sinkron ulang tanpa perubahan tidak menulis ke server.
- [x] Edit satu sisi merambat; edit dua sisi menyimpan konflik, tidak hilang diam-diam.
- [x] Pemulihan konflik mendorong versi lokal ke server.
- [x] Lencana digabung, perangkat baru tidak memicu konflik palsu.
- [x] Migrasi `pc_days` aman diulang; data sesi rusak ditolak.
- [x] Pembaruan berbasis versi lama ditolak server (kondisi balapan).

Belum terbukti, harus manual:
- [ ] Main offline di HP, buka di laptop, semua sesi muncul setelah online.
- [ ] Jam HP dimajukan/dimundurkan tidak mengacaukan urutan "terbaru".
- [ ] Pindah zona waktu tidak memutus atau memalsukan streak.
- [ ] Ganti akun di perangkat yang sama tidak mencampur data.
- [x] Pengguna A tidak bisa membaca/menulis data pengguna B, dan pengguna tanpa login tidak bisa membaca apa pun (`tests/rls.test.js`, lulus, uji langsung ke API).
- [ ] Hapus akun menghapus semua baris di `sessions`, `badges`, `songs`, `settings`.
- [ ] Impor `.json` rusak atau besar ditolak dengan pesan jelas.
- [ ] Alur login dari PWA yang sudah dipasang.
- [ ] Hapus lagu di satu perangkat tidak muncul lagi di perangkat lain (menunggu tombstone + banyak lagu).

---

## 10. Keputusan

**Sudah diputuskan**
1. Login: Google + email magic link; anonim ditunda.
2. Streak: dihitung di klien (hitung di server hanya jika nanti ada peringkat).
3. Lagu: masih satu lagu aktif.

**Masih terbuka**
1. Pindah ke banyak lagu? (Membuka tombstone, daftar lagu, dan gabung per bagian.)
2. Berapa lama data disimpan, dan kebijakan akun yang lama tidak aktif?
3. Siapa yang menanggung biaya server jika pengguna bertambah?
4. Host sendiri `supabase-js` agar masuk cache offline?

## Langkah berikutnya (urutan usulan)
1. ✅ RLS sudah lulus. Sisanya di bagian 9: uji dua perangkat nyata, mode pesawat, jam/zona waktu, hapus akun, dan login dari PWA.
2. Tulis kebijakan privasi singkat dan atur cadangan database.
3. Putuskan banyak lagu; jika ya, kerjakan bersama tombstone dan salinan konflik di server.
4. Catat akor salah per kejadian untuk "Latih yang lemah".
