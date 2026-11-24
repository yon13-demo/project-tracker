-- Migration v8: several tasks on one project entry.
-- Run once in the Weave Supabase SQL Editor, AFTER schema-v7-project-tasks.sql. Safe to run again.
--
-- One line per project per day again. The tasks worked on are a list on that line:
--   work_logs.tasks = [{"task_id": "<uuid>", "hours": 2.5}, {"task_id": "<uuid>", "hours": null}, …]
-- Hours per task are optional; when given they may not add up to more than the line's hours.
-- Entries saved with v7's single task_id are folded into this list (same person, day and project → one line).

alter table public.work_logs add column if not exists tasks jsonb not null default '[]'::jsonb;
alter table public.work_logs drop constraint if exists work_logs_tasks_is_array;
alter table public.work_logs add constraint work_logs_tasks_is_array check (jsonb_typeof(tasks) = 'array');

-- ─── Fold v7 rows (one row per task) into one row per project and day ───────────
drop trigger if exists work_logs_check_task on public.work_logs;
do $$
declare g record; keeper uuid;
begin
  for g in
    select user_id, log_date, project_id
    from public.work_logs
    where project_id is not null
    group by 1, 2, 3
    having count(*) > 1 or bool_or(task_id is not null)
  loop
    select w.id into keeper from public.work_logs w
    where w.user_id = g.user_id and w.log_date = g.log_date and w.project_id = g.project_id
    order by (w.task_id is null) desc, w.created_at, w.id limit 1;

    update public.work_logs k set
      hours = s.hours,
      description = s.description,
      tasks = s.tasks,
      task_id = null
    from (
      select sum(w.hours) as hours,
             nullif(string_agg(distinct nullif(trim(w.description), ''), E'\n'), '') as description,
             coalesce(jsonb_agg(jsonb_build_object('task_id', w.task_id, 'hours', w.hours)) filter (where w.task_id is not null), '[]'::jsonb)
               || coalesce((select jsonb_agg(e) from public.work_logs w2, jsonb_array_elements(w2.tasks) e
                            where w2.user_id = g.user_id and w2.log_date = g.log_date and w2.project_id = g.project_id and w2.task_id is null), '[]'::jsonb) as tasks
      from public.work_logs w
      where w.user_id = g.user_id and w.log_date = g.log_date and w.project_id = g.project_id
    ) s
    where k.id = keeper;

    delete from public.work_logs w
    where w.user_id = g.user_id and w.log_date = g.log_date and w.project_id = g.project_id and w.id <> keeper;
  end loop;
end $$;

drop index if exists public.work_logs_one_per_task;
drop index if exists public.work_logs_one_per_project;
create unique index if not exists work_logs_one_per_project_day on public.work_logs (user_id, log_date, project_id) where project_id is not null;

-- ─── Check the task list on every save ──────────────────────────────────────────
-- (A browser still running the v7 app may send task_id: it is moved into the list.)
create or replace function public.work_logs_check_tasks() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  n int; distinct_ids int; matching int; task_hours numeric;
begin
  if new.task_id is not null then
    new.tasks := coalesce(new.tasks, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('task_id', new.task_id, 'hours', null));
    new.task_id := null;
  end if;
  n := jsonb_array_length(new.tasks);
  if n = 0 then return new; end if;
  if coalesce(new.category, 'project') <> 'project' or new.project_id is null then
    raise exception 'tasks are only allowed on a registered project' using errcode = '23514';
  end if;
  if exists (select 1 from jsonb_array_elements(new.tasks) e
             where jsonb_typeof(e) <> 'object'
                or coalesce(e->>'task_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                or (e ? 'hours' and jsonb_typeof(e->'hours') not in ('number', 'null'))
                or (jsonb_typeof(e->'hours') = 'number' and (e->>'hours')::numeric < 0)) then
    raise exception 'tasks must be [{task_id, hours}] with hours empty or 0 or more' using errcode = '23514';
  end if;
  select count(distinct e->>'task_id'), coalesce(sum((e->>'hours')::numeric) filter (where jsonb_typeof(e->'hours') = 'number'), 0)
    into distinct_ids, task_hours from jsonb_array_elements(new.tasks) e;
  if distinct_ids <> n then raise exception 'a task is listed twice' using errcode = '23514'; end if;
  select count(*) into matching from public.project_tasks t
    where t.project_id = new.project_id and t.id in (select (e->>'task_id')::uuid from jsonb_array_elements(new.tasks) e);
  if matching <> n then raise exception 'task does not belong to this project' using errcode = '23514'; end if;
  if task_hours > coalesce(new.hours, 0) + 0.001 then
    raise exception 'task hours (%) are more than the entry''s hours (%)', task_hours, new.hours using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists work_logs_check_tasks on public.work_logs;
create trigger work_logs_check_tasks before insert or update on public.work_logs
  for each row execute function public.work_logs_check_tasks();
revoke execute on function public.work_logs_check_tasks() from public, anon;

-- A task with hours logged on it cannot be deleted (archive it instead). Deleting the whole project still works.
create or replace function public.project_tasks_guard_delete() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.projects p where p.id = old.project_id)
     and exists (select 1 from public.work_logs w where w.project_id = old.project_id
                 and w.tasks @> jsonb_build_array(jsonb_build_object('task_id', old.id::text))) then
    raise exception 'task "%" has logged hours; archive it instead', old.name using errcode = '23503';
  end if;
  return old;
end;
$$;
drop trigger if exists project_tasks_guard_delete on public.project_tasks;
create trigger project_tasks_guard_delete before delete on public.project_tasks
  for each row execute function public.project_tasks_guard_delete();
revoke execute on function public.project_tasks_guard_delete() from public, anon;

notify pgrst, 'reload schema';
