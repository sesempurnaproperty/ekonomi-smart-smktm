# EKONOMI SMART SMKTM

Platform pembelajaran digital bagi mata pelajaran Ekonomi Tingkatan 4 dan Tingkatan 5, SMK Taman Medan.

## Teknologi

- Next.js 16 dan React 19
- TypeScript
- Supabase Auth, PostgreSQL, Row Level Security dan Edge Functions
- Vercel untuk hosting dan deployment automatik daripada GitHub

## Modul semasa

- Halaman utama responsif.
- Login guru menggunakan username dan password.
- Username guru dipadankan di Edge Function dengan akaun dalaman Supabase Auth.
- Kata laluan disahkan oleh Supabase Auth; kata laluan tidak disimpan dalam jadual aplikasi.
- Dashboard guru dilindungi semakan sesi dan rekod akaun guru aktif.

## Persediaan akaun guru pertama

1. Cipta pengguna Auth melalui Supabase Dashboard > Authentication > Users.
2. Sahkan pengguna tersebut (email confirmed) di Dashboard.
3. Catat UUID pengguna Auth.
4. Tambah rekod ke `public.teacher_accounts` menggunakan UUID, username lowercase dan display name.
5. Pastikan `is_active = true`.

Format username: 3–32 aksara, huruf kecil, nombor, titik, garis bawah atau sempang. Contoh format sahaja: `guru.ikmal`.

Jangan masukkan password ke jadual `teacher_accounts`. Tetapkan atau reset password melalui Supabase Auth sahaja.

## Pembangunan setempat

```bash
npm install
npm run dev
```

Buka http://localhost:3000.

## Fasa seterusnya

- [x] Halaman utama responsif dan identiti visual
- [x] Sambungan GitHub–Vercel dengan deployment automatik
- [x] Supabase browser/server client dan session refresh
- [x] Struktur akaun guru dengan RLS
- [x] Edge Function login guru menggunakan username
- [x] Halaman login guru dan dashboard terlindung
- [ ] Akaun guru pertama diaktifkan
- [ ] Pengurusan akaun murid secara import pukal (batch pertama: 61 murid)
- [ ] Modul pembelajaran Tingkatan 4 dan Tingkatan 5
- [ ] Nota, video, latihan dan kuiz
- [ ] Penjana soalan menggunakan AI
- [ ] Analisis pencapaian murid

## Keselamatan

Repository ini bersifat Public. Jangan commit fail `.env`, kata laluan, Supabase secret/service-role key atau maklumat sulit. Gunakan pemboleh ubah persekitaran Vercel untuk konfigurasi rahsia. Akses data murid mesti dilindungi dengan Row Level Security.
