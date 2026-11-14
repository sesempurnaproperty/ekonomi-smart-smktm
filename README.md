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

Modul import pukal akan menyokong batch pertama seramai 61 murid. Username dan password ditentukan serta dibekalkan oleh pentadbir, kemudian sistem mencipta akaun Auth dan profil role `student`.

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
- [ ] Pengurusan akaun guru dan murid melalui dashboard admin
- [ ] Import pukal 61 akaun murid
- [ ] Modul pembelajaran Tingkatan 4 dan Tingkatan 5
- [ ] Nota, video, latihan, kuiz dan analisis pencapaian
- [ ] Penjana soalan menggunakan AI
