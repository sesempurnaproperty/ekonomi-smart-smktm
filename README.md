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
- Murid hanya boleh membaca bahan yang diterbitkan dan sepadan dengan tingkatan akaun mereka.
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
