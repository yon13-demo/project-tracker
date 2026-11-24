-- Migration v7: project tasks and progress.
-- Run once in the Weave Supabase project's SQL Editor (NOT the attendance project). Safe to run again.
--
--   project_tasks          each project's task tree (discipline → deliverable → task …), kept by admins
--   task_progress_updates  progress an engineer proposes (0 / 20 / 50 / 80 / 100%) and the admin's review
--   work_logs.task_id      which task the hours were for (optional)
--   profiles.division      the person's department from the attendance system (filled by the sync)
--   review_task_progress() / set_task_progress()  admin-only, write the admin log

-- ─── Tables ─────────────────────────────────────────────────────────────────────
create table if not exists public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  parent_id uuid references public.project_tasks(id) on delete cascade,
  discipline text not null check (discipline in ('process', 'mechanical', 'electrical_automation', 'procurement', 'manufacturing', '3d')),
  wbs text not null default '',
  name text not null check (length(trim(name)) > 0),
  doc_type text,
  weight numeric(6,2) check (weight is null or weight > 0),
  sort_order int not null default 0,
  planned_start date,
  planned_end date,
  budget_hours numeric(7,1) check (budget_hours is null or budget_hours >= 0),
  progress numeric(3,2) not null default 0 check (progress in (0, 0.2, 0.5, 0.8, 1)),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_id is null or parent_id <> id)
);
create index if not exists project_tasks_project on public.project_tasks (project_id);
create index if not exists project_tasks_parent on public.project_tasks (parent_id);

create table if not exists public.task_progress_updates (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.project_tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  log_date date not null,
  from_progress numeric(3,2) not null default 0,
  to_progress numeric(3,2) not null check (to_progress in (0, 0.2, 0.5, 0.8, 1)),
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'superseded')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now()
);
-- One open proposal per task, person and work day; saving the day again updates it.
create unique index if not exists task_progress_one_pending on public.task_progress_updates (task_id, user_id, log_date) where status = 'pending';
create index if not exists task_progress_task on public.task_progress_updates (task_id, created_at desc);

alter table public.work_logs add column if not exists task_id uuid references public.project_tasks(id) on delete set null;
alter table public.profiles add column if not exists division text;

-- ─── One entry per person, day and project — or per task when a task is given ───
do $$
declare c text;
begin
  for c in
    select con.conname from pg_constraint con
    where con.conrelid = 'public.work_logs'::regclass and con.contype = 'u'
      and (select array_agg(a.attname::text order by a.attname) from unnest(con.conkey) k join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k)
          = array['log_date', 'project_id', 'user_id']
  loop
    execute format('alter table public.work_logs drop constraint %I', c);
  end loop;
end $$;
create unique index if not exists work_logs_one_per_project on public.work_logs (user_id, log_date, project_id) where task_id is null and project_id is not null;
create unique index if not exists work_logs_one_per_task on public.work_logs (user_id, log_date, task_id) where task_id is not null;

-- A task on an entry must belong to that entry's project.
create or replace function public.work_logs_check_task() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.task_id is not null and not exists (
    select 1 from public.project_tasks t
    where t.id = new.task_id and t.project_id = new.project_id and coalesce(new.category, 'project') = 'project'
  ) then
    raise exception 'task does not belong to this project' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists work_logs_check_task on public.work_logs;
create trigger work_logs_check_task before insert or update of task_id, project_id, category on public.work_logs
  for each row execute function public.work_logs_check_task();

-- A proposal always starts from the task's current approved progress, and only engineers' own pending rows change here.
create or replace function public.task_progress_fill_from() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'pending' then
    select t.progress into new.from_progress from public.project_tasks t where t.id = new.task_id;
  end if;
  return new;
end;
$$;
drop trigger if exists task_progress_fill_from on public.task_progress_updates;
create trigger task_progress_fill_from before insert or update on public.task_progress_updates
  for each row execute function public.task_progress_fill_from();

-- ─── Access ─────────────────────────────────────────────────────────────────────
alter table public.project_tasks enable row level security;
alter table public.task_progress_updates enable row level security;
revoke all on public.project_tasks, public.task_progress_updates from anon;
grant select, insert, update, delete on public.project_tasks, public.task_progress_updates to authenticated;

drop policy if exists "users read tasks" on public.project_tasks;
drop policy if exists "admins manage tasks" on public.project_tasks;
create policy "users read tasks" on public.project_tasks for select to authenticated using (true);
create policy "admins manage tasks" on public.project_tasks for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "users read progress updates" on public.task_progress_updates;
drop policy if exists "users propose progress" on public.task_progress_updates;
drop policy if exists "users change own pending progress" on public.task_progress_updates;
drop policy if exists "users withdraw own pending progress" on public.task_progress_updates;
drop policy if exists "admins manage progress updates" on public.task_progress_updates;
create policy "users read progress updates" on public.task_progress_updates for select to authenticated using (true);
create policy "users propose progress" on public.task_progress_updates for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending' and reviewed_by is null and reviewed_at is null);
create policy "users change own pending progress" on public.task_progress_updates for update to authenticated
  using (user_id = auth.uid() and status = 'pending')
  with check (user_id = auth.uid() and status = 'pending' and reviewed_by is null and reviewed_at is null);
create policy "users withdraw own pending progress" on public.task_progress_updates for delete to authenticated
  using (user_id = auth.uid() and status = 'pending');
create policy "admins manage progress updates" on public.task_progress_updates for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ─── Admin actions ──────────────────────────────────────────────────────────────
-- Approve or reject pending proposals. Approving sets the task's progress; other open proposals on that
-- task (made against the old value) become 'superseded'. Returns how many were handled.
create or replace function public.review_task_progress(p_ids uuid[], p_approve boolean, p_note text default null) returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  n int := 0;
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  for r in select * from public.task_progress_updates u where u.id = any(p_ids) and u.status = 'pending' order by u.created_at loop
    if p_approve then
      update public.project_tasks set progress = r.to_progress, updated_at = now() where id = r.task_id;
      update public.task_progress_updates set status = 'superseded', reviewed_by = auth.uid(), reviewed_at = now()
        where task_id = r.task_id and status = 'pending' and id <> r.id and not (id = any(p_ids));
    end if;
    update public.task_progress_updates
      set status = case when p_approve then 'approved' else 'rejected' end,
          reviewed_by = auth.uid(), reviewed_at = now(), review_note = nullif(trim(coalesce(p_note, '')), '')
      where id = r.id;
    n := n + 1;
  end loop;
  if n > 0 then
    insert into public.admin_logs (admin_id, action, details)
    values (auth.uid(), case when p_approve then 'APPROVE_TASK_PROGRESS' else 'REJECT_TASK_PROGRESS' end,
            jsonb_build_object('count', n, 'ids', to_jsonb(p_ids), 'note', nullif(trim(coalesce(p_note, '')), '')));
  end if;
  return n;
end;
$$;

-- Set a task's progress directly (admin). Stored as an approved update so the history stays complete.
create or replace function public.set_task_progress(p_task uuid, p_progress numeric) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_from numeric;
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  select t.progress into v_from from public.project_tasks t where t.id = p_task;
  if not found then raise exception 'task not found' using errcode = 'P0002'; end if;
  update public.project_tasks set progress = p_progress, updated_at = now() where id = p_task;
  insert into public.task_progress_updates (task_id, user_id, log_date, from_progress, to_progress, status, reviewed_by, reviewed_at, note)
  values (p_task, auth.uid(), (now() at time zone 'Asia/Jakarta')::date, v_from, p_progress, 'approved', auth.uid(), now(), 'Diatur admin');
  update public.task_progress_updates set status = 'superseded', reviewed_by = auth.uid(), reviewed_at = now()
    where task_id = p_task and status = 'pending';
  insert into public.admin_logs (admin_id, action, details)
  values (auth.uid(), 'SET_TASK_PROGRESS', jsonb_build_object('task_id', p_task, 'from', v_from, 'to', p_progress));
end;
$$;

revoke execute on function public.review_task_progress(uuid[], boolean, text) from public, anon;
revoke execute on function public.set_task_progress(uuid, numeric) from public, anon;
revoke execute on function public.work_logs_check_task() from public, anon;
revoke execute on function public.task_progress_fill_from() from public, anon;
grant execute on function public.review_task_progress(uuid[], boolean, text) to authenticated;
grant execute on function public.set_task_progress(uuid, numeric) to authenticated;

notify pgrst, 'reload schema';
