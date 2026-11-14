# EKONOMI SMART SMKTM

Platform pembelajaran digital bagi mata pelajaran Ekonomi Tingkatan 4 dan Tingkatan 5, SMK Taman Medan.

## Teknologi

- Next.js 16.4.6
- React 19
- TypeScript
- Supabase — pangkalan data dan pengesahan pengguna (integrasi akan dibangunkan)
- Vercel — hosting dan deployment

## Pembangunan setempat

```bash
npm install
npm run dev
```

Buka http://localhost:3000.

## Fasa pembangunan

- [x] Halaman utama responsif dan identiti visual
- [x] Sambungan repository kepada Vercel
- [ ] Pengesahan akaun guru dan murid
- [ ] Struktur pangkalan data dan Row Level Security
- [ ] Modul pembelajaran Ekonomi Tingkatan 4 dan 5
- [ ] Nota, video, latihan dan kuiz
- [ ] Penjana soalan menggunakan AI
- [ ] Analisis pencapaian murid

## Keselamatan

Repository ini bersifat Public. Jangan commit fail `.env`, kata laluan, Supabase service-role key atau sebarang maklumat sulit. Gunakan pemboleh ubah persekitaran Vercel untuk konfigurasi rahsia.
