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
