-- Jalankan seluruh berkas ini sekali di Supabase SQL Editor.
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
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

-- Jika assigned_to bernilai NULL, project tersedia untuk seluruh user.
create table public.project_assignments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  assigned_to uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(project_id, assigned_to)
);

create table public.project_completions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  completed_on date not null check (completed_on between current_date - 30 and current_date),
  created_at timestamptz not null default now(),
  unique(project_id, user_id)
);

-- Trigger ini membuat profil setiap kali akun Auth baru dibuat.
-- SECURITY DEFINER penting agar trigger Auth dapat menulis ke tabel yang memakai RLS.
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
alter table public.project_completions enable row level security;

create function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create policy "authenticated users read profiles" on public.profiles for select to authenticated using (true);
create policy "users update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));
create policy "admins manage profiles" on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage projects" on public.projects for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "users read projects" on public.projects for select to authenticated using (true);
create policy "admins manage assignments" on public.project_assignments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "users read relevant assignments" on public.project_assignments for select to authenticated using (assigned_to is null or assigned_to = auth.uid() or public.is_admin());
create policy "users read own completions" on public.project_completions for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "users create own completions" on public.project_completions for insert to authenticated with check (user_id = auth.uid());
create policy "users update own completions" on public.project_completions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create function public.keep_alive() returns void language plpgsql security definer set search_path = public as $$ begin perform count(*) from public.projects; end; $$;
revoke all on function public.keep_alive() from public;
grant execute on function public.keep_alive() to service_role;

-- Setelah pengguna pertama terdaftar, jadikan admin dari SQL Editor:
-- update public.profiles set role = 'admin' where id = 'UUID_PENGGUNA';
