# EKONOMI SMART SMKTM

Platform pembelajaran digital bagi mata pelajaran Ekonomi Tingkatan 4 dan Tingkatan 5, SMK Taman Medan.

## Teknologi

- Next.js 16 dan React 19
- TypeScript
- Supabase Auth, PostgreSQL, Row Level Security dan Edge Functions
- Supabase Storage (private bucket untuk PDF bahan pembelajaran)
- Vercel untuk hosting dan deployment automatik daripada GitHub

## Portal pengguna

Satu halaman login digunakan oleh semua pengguna: `/login`.

Pengguna mengisi username dan password. Sistem menyemak role daripada `public.user_profiles` dan mengalihkan pengguna ke ruang yang betul:

- `admin` → `/admin/dashboard`
- `teacher` → `/guru/dashboard`
- `student` → `/murid/dashboard`

Role tidak dipilih pada halaman login dan pengguna tidak boleh menukar role sendiri. Setiap dashboard menyemak semula profil di server sebelum memaparkan kandungan.

## Status akaun murid dan senarai operasi

- Semua senarai kelas, roster murid, direktori markah dan import/kemas kini markah hanya memproses profil dengan `is_active = true`.
- Akaun murid yang dinyahaktifkan tidak boleh log masuk, tidak dipaparkan dalam kelas atau rekod markah operasi, tidak boleh menerima kemas kini markah dan tidak boleh dipindahkan kelas.
- Rekod akaun dan markah lama tidak dipadam. Ia kekal untuk audit/pemulihan pentadbir melalui Pengurusan Pengguna; mengaktifkan semula akaun akan memasukkannya semula ke paparan operasi.
- Senarai Pengurusan Pengguna ialah senarai pentadbiran dan sengaja memaparkan akaun aktif serta tidak aktif supaya status boleh diuruskan.

## Rekod markah

- Markah individu menerima nombor, `TH` (tidak hadir) dan `X`.
- `TH` dipaparkan sebagai gred `T`; `X` dipaparkan sebagai gred `x`.
- Gred angka automatik: 0–39 G; 40–44 E; 45–49 D; 50–54 C; 55–59 C+; 60–64 B; 65–69 B+; 70–79 A-; 80–89 A; 90 ke atas A+.
- Markah angka disimpan dalam lajur `score`; status khas disimpan dalam `mark_status`. Satu keputusan tidak boleh mempunyai kedua-dua nilai serentak.
- Katalog pentaksiran menyimpan `PPT2026` dan `PAT2026` serta had markah maksimum yang boleh dilaras oleh pentadbir.

## Pengurusan kelas dan pengguna

- `public.academic_classes` ialah katalog kelas Tingkatan 4 dan Tingkatan 5.
- Setiap profil murid dipautkan kepada kelas melalui `academic_class_id`.
- Nama kelas boleh dikemaskini; fungsi database mengekalkan kemas kini nama pada semua profil murid dalam satu transaksi.
- Murid boleh dipindahkan ke kelas aktif lain oleh pentadbir.
- Kelas hanya boleh dipadam apabila tiada murid lagi dipautkan.
- Senarai kelas boleh dicetak atau dieksport sebagai CSV tanpa sebarang password.
- Pentadbir boleh mendaftarkan akaun individu dan mengimport murid secara pukal melalui Excel/CSV. Password hanya diserahkan kepada Supabase Auth dan tidak dipaparkan dalam laporan import.

## Perpustakaan bahan pembelajaran

- Guru dan pentadbir boleh mendaftarkan bab Ekonomi mengikut Tingkatan 4 atau Tingkatan 5.
- Setiap bab boleh memuatkan nota teks, fail PDF, pautan video atau pautan luar.
- Guru boleh mengedit bahan, menyimpan sebagai draf atau menerbitkannya kepada murid.
- Murid aktif Tingkatan 4 dan Tingkatan 5 boleh membaca semua bahan yang diterbitkan untuk kedua-dua tingkatan.
- Fail PDF menggunakan private bucket `learning-materials`, had 20 MB dan pautan tandatangan sementara; URL fail tidak didedahkan secara awam.
- Semua polisi akses dikawal menggunakan Row Level Security pada jadual dan objek Storage.

## Pembangunan setempat

```bash
npm install
npm run dev
```

Buka http://localhost:3000.

## Status pembangunan

- [x] Halaman utama responsif dan identiti visual
- [x] Sambungan GitHub–Vercel dengan deployment automatik
- [x] Supabase browser/server client dan session refresh
- [x] Jadual pusat user_profiles dengan role admin, teacher dan student
- [x] Login tunggal berasaskan username + password
- [x] Dashboard berasingan dengan semakan role di server
- [x] Pengurusan akaun individu guru/murid melalui dashboard admin
- [x] Import pukal murid Excel/CSV dengan pratonton dan laporan baris
- [x] Pengurusan bab, nota teks, PDF, video dan pautan mengikut tingkatan
- [x] Paparan perpustakaan bahan yang dihadkan mengikut tingkatan murid
- [x] Dashboard analitik dan prestasi individu murid
- [ ] Latihan, kuiz dan analisis item soalan
- [ ] Penjana soalan menggunakan AI


## Sistem latihan dan kuiz

- Guru dan pentadbir boleh mencipta kuiz untuk Tingkatan 4, Tingkatan 5 atau kedua-duanya.
- Soalan objektif menyokong empat pilihan jawapan dan disemak secara automatik oleh Edge Function.
- Soalan struktur menerima jawapan bertulis dan disimpan untuk semakan serta pemarkahan manual guru.
- Had percubaan boleh ditetapkan antara satu hingga lima kali.
- Kuiz hanya boleh dijawab selepas diterbitkan dan tertakluk kepada sasaran tingkatan.
- Kunci jawapan dan panduan pemarkahan disimpan berasingan dalam jadual terlindung; ia tidak diberikan kepada pelayar murid.
- Setiap percubaan dan respons disimpan. Status membezakan sedang menjawab, menunggu semakan dan selesai dinilai.
- Markah akhir dikemas kini selepas semua jawapan struktur selesai diberi markah.

Portal:
- Admin → `/admin/kuiz`
- Guru → `/guru/kuiz`
- Murid → `/murid/kuiz`


## Penugasan guru penilai mengikut kelas

- Pentadbir menetapkan seorang guru penilai utama bagi setiap kelas melalui **Direktori Kelas → Penugasan Guru Penilai**.
- Satu guru boleh ditugaskan kepada beberapa kelas; satu kelas mempunyai seorang guru penilai utama pada satu-satu masa.
- Cikgu Ikmal ditugaskan kepada 4 Damai dan 5 Damai.
- Cikgu Wana ditugaskan kepada 4 Cekal dan 5 Cekal.
- Guru hanya menerima senarai percubaan kuiz daripada kelas yang dipautkan kepada akaun mereka.
- Semasa menyimpan markah struktur, Edge Function menyemak semula penugasan kelas pada server. ID jawapan yang bukan daripada kelas yang ditugaskan akan ditolak.
- Jadual penugasan menggunakan RLS dan hanya diuruskan melalui Edge Function pentadbir yang mengesahkan sesi serta peranan pentadbir.


## Pengurusan pemadaman dan reset kuiz

- Guru dan pentadbir boleh memadam kuiz terpilih melalui portal pengurusan kuiz.
- Pentadbir boleh memadam mana-mana kuiz; tindakan ini membuang kuiz, soalan, pilihan, kunci jawapan, semua percubaan, jawapan murid dan rekod markah berkaitannya.
- Guru hanya boleh memadam kuiz yang dicipta oleh akaun sendiri. Jika kuiz tersebut mempunyai percubaan daripada kelas di luar penugasan guru, pemadaman ditolak dan perlu dilakukan oleh pentadbir.
- Fungsi **Reset percubaan** menarik balik penerbitan kuiz dan membuang percubaan serta markah. Untuk guru, reset hanya melibatkan kelas yang ditugaskan kepada akaun mereka; pentadbir boleh reset semua kelas.
- Kuiz yang telah direset perlu diterbitkan semula sebelum murid boleh menjawab.
- Soalan individu boleh dipadam apabila kuiz berada dalam status draf dan tiada lagi percubaan murid. Jika masih ada percubaan, reset dahulu. Jika percubaan daripada kelas lain masih wujud, pentadbir perlu membuat reset penuh.
- Pemadaman memerlukan pengesahan melalui dialog dan tidak boleh dipulihkan selepas selesai.


## Pemarkahan struktur dengan tanda pada jawapan

Guru boleh memilih teks pada jawapan struktur murid dan menambah salah satu tanda berikut:
- `✓` — perkataan atau frasa yang mengandungi isi/markah.
- `✗` — jawapan salah.
- `TR` — jawapan tidak relevan.
- `U` — ulangan jawapan.

Tanda disimpan sebagai anotasi pada respons asal, termasuk kedudukan aksara dan teks yang dipilih. Sistem menolak tanda yang tidak sepadan dengan teks asal atau bertindih dengan tanda lain. Guru boleh membuang tanda dalam draf sebelum menyimpan.
Murid boleh membuka sejarah setiap percubaan di ruang Latihan dan Kuiz untuk melihat jawapan struktur, simbol guru, markah dan ulasan. Kunci jawapan dan panduan pemarkahan tidak dipaparkan kepada murid.
Semua tindakan simpan tanda diperiksa di Edge Function; guru hanya boleh menanda jawapan murid daripada kelas yang ditugaskan kepada akaunnya.


## Soalan kuiz berasaskan imej

- Setiap soalan boleh menggunakan teks, imej sahaja atau gabungan imej dan arahan teks.
- Guru boleh memuat naik JPG, PNG atau WebP sehingga 5 MB bagi satu gambar soalan.
- Soalan objektif masih menggunakan pilihan A-D dan kunci jawapan automatik; soalan struktur masih menggunakan panduan pemarkahan manual.
- Gambar disimpan dalam bucket Supabase Storage private `quiz-question-images`, dengan laluan disusun mengikut ID kuiz.
- Pautan imej dijana oleh Edge Function sebagai signed URL untuk tempoh terhad. Fungsi ini mengesahkan guru pemilik/penugasan kelas, kelayakan tingkatan murid atau rekod percubaan terdahulu sebelum memulangkan pautan.
- Gambar dipaparkan dalam pembina kuiz, ruang menjawab murid, sejarah skrip murid dan semakan guru.
- Apabila soalan atau keseluruhan kuiz dipadam, Edge Function turut memadam fail imej berkaitannya melalui Storage API.


## Silibus rasmi dan prestasi mengikut bab EKONOMI SMART SMKTM

Katalog silibus mengandungi enam bab dan enam belas subbab:
1. Pengenalan kepada Ekonomi — 1.1 Konsep kekurangan, pilihan dan kos lepas; 1.2 Sistem ekonomi dan penyelesaian masalah asas ekonomi.
2. Pasaran — 2.1 Keseimbangan Pasaran; 2.2 Keanjalan harga.
3. Pendapatan Individu — 3.1 Wang dan Bank; 3.2 Pendapatan Individu; 3.3 Penggunaan pendapatan individu.
4. Pengeluaran — 4.1 Konsep pengeluaran, kos dan hasil; 4.2 Produktiviti dan Eksternaliti.
5. Ekonomi dan Kerajaan — 5.1 Peranan Kerajaan; 5.2 Penunjuk Ekonomi; 5.3 Alat Dasar Ekonomi.
6. Malaysia dan Ekonomi Global — 6.1 Globalisasi; 6.2 Perdagangan Antarabangsa; 6.3 Imbangan Pembayaran; 6.4 Kadar Pertukaran Asing.

- Setiap kuiz baharu mesti dipautkan kepada satu bab silibus.
- Setiap soalan baharu mesti dipautkan kepada satu subbab di bawah bab kuiz tersebut. Trigger pangkalan data menolak padanan bab/subbab yang tidak konsisten.
- Setiap respons objektif dan struktur mewarisi subbab soalan untuk analisis prestasi.
- Dashboard murid mengumpulkan markah mengikut subbab daripada percubaan terbaik yang telah selesai dinilai bagi setiap kuiz. Percubaan menunggu semakan tidak dimasukkan dalam kutipan akhir; percubaan berulang tidak menggandakan jumlah.
- Subbab tanpa aktiviti yang selesai dinilai dipaparkan sebagai **Belum diuji**, bukannya markah sifar.
- Katalog silibus ini berdiri berasingan daripada katalog bab bahan pembelajaran lama supaya pautan nota sedia ada tidak berubah.
- Pemetaan khusus bab kepada Tingkatan 4 atau Tingkatan 5 belum ditetapkan dalam katalog ini; senarai enam bab digunakan seperti yang diberikan sehingga pembahagian tingkatan ditentukan.
