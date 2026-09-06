-- Schema V3 Migration
-- Tambahkan setelah schema-v2.sql
-- Jalankan di Supabase SQL Editor

-- ─── Admin Settings ────────────────────────────────────────────────────────────
-- Menyimpan konfigurasi global: toggle buat akun, domain login default
create table if not exists public.admin_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

-- Seed default values
insert into public.admin_settings (key, value) values
  ('allow_signup', 'true'),
  ('login_domain', 'company.com')
on conflict (key) do nothing;

-- ─── Admin Logs ────────────────────────────────────────────────────────────────
create table if not exists public.admin_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,          -- e.g. 'CREATE_USER', 'UPDATE_ROLE', 'DELETE_USER', 'TOGGLE_SIGNUP', 'SET_DOMAIN'
  target_user_id uuid references public.profiles(id) on delete set null,
  details jsonb,                 -- extra info (old_role, new_role, email, dll)
  created_at timestamptz not null default now()
);

-- RLS
alter table public.admin_settings enable row level security;
alter table public.admin_logs enable row level security;

-- admin_settings: semua authenticated bisa baca (untuk cek allow_signup & login_domain di halaman login)
create policy "anyone can read settings" on public.admin_settings for select to authenticated using (true);
create policy "public can read settings" on public.admin_settings for select to anon using (true);
create policy "admins manage settings" on public.admin_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- admin_logs: hanya admin yang bisa baca & insert
create policy "admins read logs" on public.admin_logs for select to authenticated using (public.is_admin());
create policy "admins insert logs" on public.admin_logs for insert to authenticated with check (public.is_admin());
