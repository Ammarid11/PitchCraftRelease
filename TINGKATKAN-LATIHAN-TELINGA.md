Ini penilaian jujur kondisi Latih Telinga sekarang, lalu rencana peningkatannya. Penting: kata “solid” di bawah artinya logikanya sudah diuji otomatis di Node. Belum ada yang diuji di HP atau browser sungguhan, jadi belum ada yang bisa kusebut “sempurna”.

Yang sudah solid
Cakupan jenis: 8 jenis latihan dengan 3–4 tingkat. Soal seimbang dan nada dasar tidak berulang.
Alur ronde: 10 soal, jawaban ganda tidak menambah skor, dan waktu diam dibatasi 60 detik.
Umpan balik: jawaban benar disertai penjelasan, dan ketuk pilihan lain untuk membandingkan bunyi.
Panduan: langkah cara latihan di layar awal, petunjuk tugas dan nama acuan di tiap soal.
Statistik: rekor per jenis dan tingkat, jawaban paling sulit, dan tebakan yang sering tertukar.
Terhubung ke sistem lain: streak, target harian, lencana, dan sinkron akun lewat sesi ber-ID.
Tanpa mikrofon: bisa dilatih di mana saja.
Tes otomatis: ear-training.test.js cukup lengkap.
Yang bisa ditingkatkan
Prioritas 1: cepat dan berdampak (ukuran S–M)
#	Perbaikan	Alasan
1	Uji manual di HP nyata (Android dan iOS): volume, suara terputus, tombol “Dengar lagi” ditekan cepat	Belum pernah diuji di perangkat. Ini risiko terbesar.
2	Statistik ikut cadangan. pc_ear belum masuk acctExport/importProgress dan tidak tersinkron	Rekor dan data “paling sulit” hilang kalau ganti HP atau hapus data browser.
3	Kartu bagikan hasil Latih Telinga. Kartu skor sekarang hanya membaca riwayat latihan mikrofon (pc_hist)	Ronde telinga tidak bisa dibagikan.
4	Pengaturan bunyi: kecepatan putar (pelan/normal) dan jeda antar nada	Pemula butuh bunyi lebih lambat.
5	Ulasan akhir ronde: daftar soal yang salah, dengan tombol dengar ulang jawaban benar lawan tebakanmu	Sekarang hanya skor dan rincian per jawaban.
6	Aksesibilitas: pengumuman hasil untuk pembaca layar dan penanda benar/salah yang tidak hanya warna	Titik progres sekarang hanya berbeda warna.
Prioritas 2: memperdalam latihan (ukuran M)
#	Perbaikan	Alasan
7	Latih yang lemah untuk telinga. Ronde yang memperbanyak jawaban dengan akurasi rendah (datanya sudah ada)	Statistik sudah dihitung tapi belum dipakai.
8	Saran naik/turun tingkat otomatis, mis. dua ronde ≥ 9/10 lalu muncul saran “coba tingkat berikutnya”	Pengguna sering tidak tahu kapan siap naik.
9	Pilihan timbre: gitar, piano sederhana, atau gelombang sinus	Telinga yang hanya dilatih satu timbre bisa kesulitan di instrumen lain. Ini penting terutama untuk nama nada.
10	Interval turun dan bersamaan (harmonik), sudah ada di daftar ide roadmap	Sekarang hanya naik dan berurutan.
11	Jenis akor lebih lengkap: dim, aug, sus2, add9, dan inversi	Sekarang hanya 6 jenis, satu bentuk jari tetap.
12	Panjang ronde bisa dipilih (5/10/20) dan mode santai tanpa penilaian	Ronde tetap 10 soal terasa kaku.
13	Grafik perkembangan akurasi per jenis dari waktu ke waktu	Sekarang hanya rekor dan angka terakhir.
Prioritas 3: fitur baru (ukuran L)
Tangga nada minor, modus, dan lompatan besar untuk Arah melodi dan Nada (derajat).
Urutan akor dengan akor ke-7, irama, dan lebih dari 4 akor.
Dikte ritme: tebak pola ketukan.
Nyanyi balik: app membunyikan nada, kamu menyanyikannya, dan dicek lewat pelacak suara yang sudah ada (vcYin). Ini bentrok dengan aturan “tanpa mikrofon”, jadi perlu keputusanmu.
Tebak kunci lagu dari potongan progresi.
Latih telinga dari lagu sendiri: ambil akor dari tab Lagu sebagai bahan soal.
Yang perlu dijaga
Tes tidak menggantikan HP asli. Kekeliruan nama acuan kemarin lolos semua tes otomatis dan baru ketahuan dari sudut pandang pemain.
Pembersihan dobel: Nama nada tingkat Ahli kini mirip Satu petikan. Putuskan mau digabung atau dibiarkan.
Data lama aman: tiap perubahan struktur pc_ear harus tetap bisa membaca data lama, seperti yang sudah dilakukan untuk jenis akor.
Jangan menyentuh deteksi akor/nada (pitch.js, gate.js, dan seterusnya), seperti prinsip yang sudah ada.
Urutan yang kusarankan
Rilis 1: nomor 1, 2, 3, 5, dan 6. Fokus kekokohan dan data tidak hilang.
Rilis 2: nomor 4, 7, 8, 12, dan 13. Fokus belajar yang terarah.
Rilis 3: nomor 9, 10, dan 11. Fokus kedalaman materi.
Setelahnya: pilih satu dari prioritas 3.

Satu pertanyaan penentu: mau masuk ke nyanyi balik (pakai mikrofon) atau tetap tanpa mikrofon? Jawabanmu mengubah arah rilis 3.

---
Status (21 Okt 2026, cache v29) - Rilis 1
Selesai dan lolos tes otomatis di Node: #2 statistik ikut cadangan dan sinkron, #3 kartu bagikan hasil Latih Telinga, #5 ulasan akhir ronde, #6 aksesibilitas (pengumuman pembaca layar, penanda bukan hanya warna).
Belum: #1 uji di HP nyata. Itu tidak bisa dikerjakan dari sini. Daftar uji: (a) Android dan iOS, putar tiap jenis, cek volume dan tidak ada suara terputus; (b) tekan "Dengar lagi" cepat berkali-kali, cek bunyi tidak menumpuk aneh; (c) ganti HP atau masuk akun di perangkat kedua, cek rekor dan "paling sulit" ikut muncul; (d) bagikan kartu hasil lewat WhatsApp; (e) uji dengan TalkBack/VoiceOver.
Rilis 2 (#4, 7, 8, 12, 13) dan Rilis 3 (#9, 10, 11) belum dikerjakan.
