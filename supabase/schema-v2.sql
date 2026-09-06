-- Schema V2 - Project Tracker dengan fitur jam kerja, cuti, aktif/nonaktif
-- Jalankan di Supabase SQL Editor

create extension if not exists "pgcrypto";

create type public.app_role as enum ('admin', 'user');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role public.app_role not null default 'user',
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  project_code text not null unique,
  name text not null,
  description text not null default '',
  is_active boolean not null default true,
  inactive_from date,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.project_assignments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  assigned_to uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(project_id, assigned_to)
);

-- Tabel baru: work_logs menggantikan project_completions
-- Mendukung banyak proyek per tanggal, jam kerja, dan cuti
create table public.work_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  log_date date not null,
  project_id uuid references public.projects(id) on delete cascade,
  hours numeric(4,1),
  is_leave boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_entry check (
    (is_leave = true and project_id is null) or
    (is_leave = false and project_id is not null and hours is not null)
  ),
  unique(user_id, log_date, project_id)
);

drop trigger if exists on_auth_user_created on auth.users;
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1), 'New user')
  );
  return new;
exception when others then
  raise log 'Could not create profile for user %: %', new.id, sqlerrm;
  raise;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_assignments enable row level security;
alter table public.work_logs enable row level security;

create function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- RLS Policies
create policy "authenticated users read profiles" on public.profiles for select to authenticated using (true);
create policy "users update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "admins manage profiles" on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage projects" on public.projects for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "users read projects" on public.projects for select to authenticated using (true);
create policy "admins manage assignments" on public.project_assignments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "users read relevant assignments" on public.project_assignments for select to authenticated using (assigned_to is null or assigned_to = auth.uid() or public.is_admin());
create policy "users read own work logs" on public.work_logs for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "users create own work logs" on public.work_logs for insert to authenticated with check (user_id = auth.uid());
create policy "users update own work logs" on public.work_logs for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users delete own work logs" on public.work_logs for delete to authenticated using (user_id = auth.uid());

create function public.keep_alive() returns void language plpgsql security definer set search_path = public as $$ begin perform count(*) from public.projects; end; $$;
revoke all on function public.keep_alive() from public;
grant execute on function public.keep_alive() to service_role;
