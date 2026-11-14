# EKONOMI SMART SMKTM

Platform pembelajaran digital bagi mata pelajaran Ekonomi Tingkatan 4 dan Tingkatan 5, SMK Taman Medan.

## Teknologi

- Next.js 16 dan React 19
- TypeScript
- Supabase Auth, PostgreSQL, Row Level Security dan Edge Functions
- Vercel untuk hosting dan deployment automatik daripada GitHub

## Portal pengguna

Satu halaman login digunakan oleh semua pengguna: `/login`.

Pengguna mengisi username dan password. Sistem menyemak role daripada `public.user_profiles` dan mengalihkan pengguna ke ruang yang betul:

- `admin` → `/admin/dashboard`
- `teacher` → `/guru/dashboard`
- `student` → `/murid/dashboard`

Role tidak dipilih pada halaman login dan pengguna tidak boleh menukar role sendiri. Setiap dashboard menyemak semula profil di server sebelum memaparkan kandungan.

## Rekod markah

- Markah individu menerima nombor, `TH` (tidak hadir) dan `X`.
- `TH` dipaparkan sebagai gred `T`; `X` dipaparkan sebagai gred `x`.
- Gred angka automatik: 0–39 G; 40–44 E; 45–49 D; 50–54 C; 55–59 C+; 60–64 B; 65–69 B+; 70–79 A-; 80–89 A; 90 ke atas A+.
- Markah angka disimpan dalam lajur `score`; status khas disimpan dalam `mark_status`. Satu keputusan tidak boleh mempunyai kedua-dua nilai serentak.

- Katalog pentaksiran menyimpan `PPT2026` dan `PAT2026` serta had markah maksimum yang boleh dilaras oleh pentadbir.
- `student_assessment_marks` menyimpan satu rekod bagi setiap murid dan pentaksiran.
- Rekod markah dipautkan kepada `user_profiles.user_id`, jadi ia kekal bersama murid walaupun murid berpindah kelas.
- Pentadbir boleh mengemas kini markah secara individu atau import fail Excel/CSV mengikut kelas.
- Markah mestilah antara sifar dan had maksimum yang ditetapkan.
- Lajur kosong dalam import pukal mengekalkan markah sedia ada. Medan kosong dalam kemas kini individu mengosongkan rekod peperiksaan itu.
- Fail import markah tidak mengandungi password.

## Pengurusan kelas

- `public.academic_classes` ialah katalog kelas Tingkatan 4 dan Tingkatan 5.
- Setiap profil murid dipautkan kepada kelas melalui `academic_class_id`.
- Nama kelas boleh dikemaskini; fungsi database mengekalkan kemas kini nama pada semua profil murid dalam satu transaksi.
- Murid boleh dipindahkan ke kelas aktif lain oleh pentadbir.
- Kelas hanya boleh dipadam apabila tiada murid lagi dipautkan.
- Senarai kelas boleh dicetak atau dieksport sebagai CSV tanpa sebarang password.

## Profil dan keselamatan

- `public.user_profiles` ialah jadual pusat profil dan role.
- `public.teacher_accounts` dikekalkan sebagai jadual legacy; ia tidak dipadam dalam migrasi ini.
- Kata laluan disimpan dan disahkan oleh Supabase Auth sahaja.
- RLS membenarkan pengguna membaca profil sendiri sahaja.
- Penetapan role dan pengurusan akaun perlu dibuat oleh fungsi pentadbiran di server.
- Jangan commit `.env`, Supabase secret key, service-role key atau kata laluan ke GitHub.

## Import murid

Modul import pukal menyokong fail `.xlsx`, `.xls` dan `.csv` sehingga 100 rekod setiap batch (template awal menyediakan 61 baris).

Lajur wajib:
- `Nama Penuh`
- `Username`
- `Password`
- `Tingkatan` (4 atau 5)
- `Kelas`

Pentadbir menetapkan semua username dan password. Password minimum 8 aksara, dihantar terus kepada Supabase Auth ketika pendaftaran dan tidak disimpan dalam `user_profiles`. Sistem menyemak format medan, username berulang, dan username yang sudah wujud. Laporan import menunjukkan keputusan bagi setiap baris tanpa memaparkan password.

Template boleh dimuat turun dari Dashboard Pentadbir > Pengurusan Pengguna.

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
- [ ] Modul pembelajaran Tingkatan 4 dan Tingkatan 5
- [ ] Nota, video, latihan, kuiz dan analisis pencapaian
- [ ] Penjana soalan menggunakan AI
