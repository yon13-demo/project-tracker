# Weave

Aplikasi ringan Next.js untuk Vercel dengan dua peran: **admin** dan **user**, serta bahasa Indonesia dan English.

## Yang tersedia

- Admin membuat proyek dan menugaskannya ke satu user atau seluruh user (default).
- User hanya melihat proyek yang ditugaskan kepadanya, lalu menandai selesai dengan tanggal maksimal 30 hari ke belakang.
- Admin melihat rekapan dan mengunduh `.xlsx` dengan header: `Nama`, `Nama proyek`, `Project ID`, `Tanggal selesai`.
- Admin membuka halaman input harian terlebih dahulu, dapat berpindah ke dashboard lewat tombol `Admin`, memeriksa jam kerja 7 hari, dan mengekspor salah satu dari 3 bulan terakhir.
- User dapat menghapus pencatatan kerja per tanggal.
- Login dapat dikonfigurasi sebagai password, Microsoft, atau keduanya.
- Admin dapat mengurutkan rekapan berdasarkan nama atau Project ID, melihat jam pencatatan, serta mengelola proyek dan user.
- Supabase Auth untuk akun dan Supabase Postgres untuk data.
- Timer harian: mulai hari, pindah antar proyek/quotation/training, pause, deteksi tidak aktif, jendela mini yang selalu di atas (Edge), lalu periksa dan kirim di akhir hari. Data timer tersimpan di PC sampai dikirim. Aplikasi dapat di-install sebagai app (PWA) dari Edge.
- Vercel Cron harian menjalankan query aman agar proyek Supabase Free tetap aktif.

## Menjalankan dan deploy

1. Buat project baru di [Supabase](https://supabase.com), kemudian jalankan isi `supabase/schema.sql` pada SQL Editor. Untuk project yang sudah memakai schema v2, jalankan `supabase/schema-v3-migration.sql`. Untuk mengaktifkan kategori Project/Quotation/Training, deskripsi, dan input proyek manual, jalankan juga `supabase/schema-v4-worklog-entries.sql`.
2. Di Supabase Authentication, aktifkan Email provider. Untuk Microsoft, buat App Registration di Microsoft Entra ID, aktifkan provider Azure di Supabase Authentication, lalu masukkan Client ID, Client Secret, dan Tenant ID. Tambahkan URL aplikasi ke Redirect URLs.
3. Salin `.env.example` menjadi `.env.local`, lalu isi URL dan keys Supabase. `SUPABASE_SERVICE_ROLE_KEY` hanya digunakan di server untuk cron—jangan pernah diberi awalan `NEXT_PUBLIC_`.
4. Daftarkan akun pertama dari aplikasi. Buka tabel `profiles` di Supabase, salin UUID akun tersebut, lalu jalankan baris `update` yang tersedia di bagian bawah `supabase/schema.sql` untuk menjadikannya admin.
5. Push ke GitHub lalu import repository di Vercel. Tambahkan empat environment variables yang sama di Vercel. Vercel akan otomatis membaca `vercel.json` dan memanggil `/api/keep-alive` pukul 03:00 UTC setiap hari.

### Absensi (opsional)

Form pencatatan kerja menampilkan jam absen (clock-in → clock-out) dan cuti dari database absensi vendor untuk tanggal yang dipilih, lalu membandingkannya dengan jam yang sudah dicatat. Data absensi hanya dibaca lewat satu fungsi database yang sempit: satu karyawan (dicocokkan lewat email login Weave), satu tanggal. Weave **tidak** memakai service role key absensi.

1. Di SQL Editor Supabase **absensi**, jalankan `supabase/attendance/weave-attendance-access.sql`, lalu `select weave_private.rotate_code();` untuk mendapatkan kode akses.
2. Di `.env.local` dan Vercel (Production dan Preview), isi `ATTENDANCE_SUPABASE_URL`, `ATTENDANCE_SUPABASE_ANON_KEY` (anon/publishable key project absensi), dan `ATTENDANCE_ACCESS_CODE`. Semuanya server-only, tanpa awalan `NEXT_PUBLIC_`.

Tanpa variabel ini form tetap berjalan dan hanya menampilkan "Absensi tidak tersedia". Jika kode bocor, jalankan `rotate_code()` lagi; kode lama langsung tidak berlaku.
Untuk memutus akses Weave sepenuhnya, jalankan di Supabase absensi: `drop function public.weave_attendance_day(text, date, text);`

Di panel Admin, `Pengaturan Admin` menyediakan pilihan metode login `Password`, `Microsoft`, atau `Keduanya`. Nama akun Microsoft diambil dari metadata `name`/`full_name` dan email berasal dari akun OAuth.

## Mengapa bukan SQLite?

SQLite tidak tepat untuk data aplikasi di Vercel: filesystem fungsi serverless bersifat sementara, sehingga data dapat hilang saat fungsi dijalankan kembali. Supabase Postgres gratis adalah pilihan yang lebih aman untuk aplikasi ini. Pada Free Plan, Supabase dapat menjeda project yang tidak cukup aktif selama 7 hari; cron harian di aplikasi ini menjalankan query database agar tetap aktif. Untuk data bisnis yang harus selalu tersedia, gunakan paket berbayar dan tetap siapkan backup berkala.
