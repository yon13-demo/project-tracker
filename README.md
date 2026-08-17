# Project Tracker

Aplikasi ringan Next.js untuk Vercel dengan dua peran: **admin** dan **user**, serta bahasa Indonesia dan English.

## Yang tersedia

- Admin membuat proyek dan menugaskannya ke satu user atau seluruh user (default).
- User hanya melihat proyek yang ditugaskan kepadanya, lalu menandai selesai dengan tanggal maksimal 30 hari ke belakang.
- Admin melihat rekapan dan mengunduh `.xlsx` dengan header: `Nama`, `Nama proyek`, `Project ID`, `Tanggal selesai`.
- Admin dapat mengurutkan rekapan berdasarkan nama atau Project ID, melihat jam pencatatan, serta mengelola proyek dan user.
- Supabase Auth untuk akun dan Supabase Postgres untuk data.
- Vercel Cron harian menjalankan query aman agar proyek Supabase Free tetap aktif.

## Menjalankan dan deploy

1. Buat project baru di [Supabase](https://supabase.com), kemudian jalankan isi `supabase/schema.sql` pada SQL Editor.
2. Di Supabase Authentication, aktifkan Email provider. Untuk uji cepat, nonaktifkan **Confirm email**; untuk produksi tambahkan URL Vercel Anda di Redirect URLs.
3. Salin `.env.example` menjadi `.env.local`, lalu isi URL dan keys Supabase. `SUPABASE_SERVICE_ROLE_KEY` hanya digunakan di server untuk cron—jangan pernah diberi awalan `NEXT_PUBLIC_`.
4. Daftarkan akun pertama dari aplikasi. Buka tabel `profiles` di Supabase, salin UUID akun tersebut, lalu jalankan baris `update` yang tersedia di bagian bawah `supabase/schema.sql` untuk menjadikannya admin.
5. Push ke GitHub lalu import repository di Vercel. Tambahkan empat environment variables yang sama di Vercel. Vercel akan otomatis membaca `vercel.json` dan memanggil `/api/keep-alive` pukul 03:00 UTC setiap hari.

## Mengapa bukan SQLite?

SQLite tidak tepat untuk data aplikasi di Vercel: filesystem fungsi serverless bersifat sementara, sehingga data dapat hilang saat fungsi dijalankan kembali. Supabase Postgres gratis adalah pilihan yang lebih aman untuk aplikasi ini. Pada Free Plan, Supabase dapat menjeda project yang tidak cukup aktif selama 7 hari; cron harian di aplikasi ini menjalankan query database agar tetap aktif. Untuk data bisnis yang harus selalu tersedia, gunakan paket berbayar dan tetap siapkan backup berkala.
