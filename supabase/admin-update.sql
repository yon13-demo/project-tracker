-- Jalankan di SQL Editor hanya untuk project Supabase yang sudah memakai schema versi sebelumnya.
-- Menambahkan izin admin untuk mengelola profil melalui dashboard.
drop policy if exists "admins manage profiles" on public.profiles;
create policy "admins manage profiles" on public.profiles
for all to authenticated
using (public.is_admin())
with check (public.is_admin());
