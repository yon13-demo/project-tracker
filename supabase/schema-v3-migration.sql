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
  ('login_domain', 'company.com'),
  ('use_domain_login', 'true'),
  ('login_method', 'both')
on conflict (key) do nothing;

-- Keep the display name from Microsoft/Azure OAuth metadata when a profile is created.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      split_part(new.email, '@', 1),
      'New user'
    )
  );
  return new;
exception when others then
  raise log 'Could not create profile for user %: %', new.id, sqlerrm;
  raise;
end;
$$;

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
drop policy if exists "anyone can read settings" on public.admin_settings;
create policy "anyone can read settings" on public.admin_settings for select to authenticated using (true);
drop policy if exists "public can read settings" on public.admin_settings;
create policy "public can read settings" on public.admin_settings for select to anon using (true);
drop policy if exists "admins manage settings" on public.admin_settings;
create policy "admins manage settings" on public.admin_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- admin_logs: hanya admin yang bisa baca & insert
drop policy if exists "admins read logs" on public.admin_logs;
create policy "admins read logs" on public.admin_logs for select to authenticated using (public.is_admin());
drop policy if exists "admins insert logs" on public.admin_logs;
create policy "admins insert logs" on public.admin_logs for insert to authenticated with check (public.is_admin());
