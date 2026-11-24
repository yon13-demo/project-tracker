-- Migration v9: project progress on the dashboard.
-- Run once in the Weave Supabase SQL Editor, AFTER v6 (dashboard), v7 and v8 (tasks). Safe to run again.
--
--   project_progress(project)   one project's progress from its task tree (approved steps only)
--   weave_dashboard(p_date)     unchanged fields + "project_progress": projects that have a task list
--
-- The anon (publishable) key still gets exactly one function, weave_dashboard; everything else stays closed.
-- Aggregates only: project numbers/names and percentages, no people.

-- ─── Progress of one project ────────────────────────────────────────────────────
-- Same maths as the app (lib/tasks.ts): a parent is the weighted average of its non-archived children
-- (no weight = 1), a discipline the weighted average of its deliverables, the project the plain average of
-- its disciplines. Written as each leaf's share of its discipline: share(child) = share(parent) × w / Σw(siblings).
create or replace function public.project_progress(p_project uuid) returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with recursive live as (
    select t.id, t.parent_id, t.discipline, coalesce(t.weight, 1) as w, t.progress
    from public.project_tasks t
    where t.project_id = p_project and t.archived_at is null
  ),
  tree as (
    select l.id, l.discipline, l.w / sum(l.w) over (partition by l.discipline) as share
    from live l where l.parent_id is null
    union all
    select c.id, c.discipline, p.share * c.w / (select sum(s.w) from live s where s.parent_id = c.parent_id)
    from live c join tree p on c.parent_id = p.id
  ),
  leaves as (
    select tr.discipline, tr.share, l.progress
    from tree tr join live l on l.id = tr.id
    where not exists (select 1 from live k where k.parent_id = tr.id)
  ),
  disc as (
    select d.ord, d.key, d.label, sum(lv.share * lv.progress) as progress, count(*) as tasks, count(*) filter (where lv.progress >= 1) as done
    from leaves lv
    join (values (1, 'process', 'Process'), (2, 'mechanical', 'Mechanical'), (3, 'electrical_automation', 'Electrical & Automation'),
                 (4, 'procurement', 'Procurement'), (5, 'manufacturing', 'Manufacturing'), (6, '3d', '3D')) d(ord, key, label)
      on d.key = lv.discipline
    group by d.ord, d.key, d.label
  )
  select jsonb_build_object(
    'overall', (select round(avg(progress) * 100, 1) from disc),
    'tasks_total', coalesce((select sum(tasks) from disc), 0),
    'tasks_done', coalesce((select sum(done) from disc), 0),
    'disciplines', coalesce((select jsonb_agg(jsonb_build_object('key', key, 'label', label, 'progress_pct', round(progress * 100, 1), 'tasks', tasks, 'done', done) order by ord) from disc), '[]'::jsonb),
    'pending', (select count(*) from public.task_progress_updates u join live l on l.id = u.task_id where u.status = 'pending')
  );
$$;
revoke execute on function public.project_progress(uuid) from public, anon;
grant execute on function public.project_progress(uuid) to authenticated, service_role;

-- ─── weave_dashboard = the v6 function + project_progress ───────────────────────
-- The v6 body is kept as weave_dashboard_base (renamed once) and wrapped, so nothing in it changes.
do $$
begin
  if to_regprocedure('public.weave_dashboard_base(date)') is null then
    alter function public.weave_dashboard(date) rename to weave_dashboard_base;
  end if;
end $$;
revoke execute on function public.weave_dashboard_base(date) from public, anon, authenticated;

create or replace function public.weave_dashboard(p_date date default null) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_base jsonb := public.weave_dashboard_base(p_date);
  d date := (v_base->>'date')::date;
  m_start date := date_trunc('month', d)::date;
  v_projects jsonb;
begin
  -- Projects with a task list (at most 6), busiest this month first.
  select coalesce(jsonb_agg(x.row order by x.hours desc, x.code), '[]'::jsonb) into v_projects
  from (
    select p.project_code as code,
           coalesce((select sum(w.hours) from public.work_logs w
                     where w.project_id = p.id and not w.is_leave and w.hours > 0 and w.log_date between m_start and d), 0) as hours,
           jsonb_build_object('code', p.project_code, 'name', p.name) || public.project_progress(p.id)
             || jsonb_build_object('hours_month', round(coalesce((select sum(w.hours) from public.work_logs w
                     where w.project_id = p.id and not w.is_leave and w.hours > 0 and w.log_date between m_start and d), 0), 1)) as row
    from public.projects p
    where p.is_active and exists (select 1 from public.project_tasks t where t.project_id = p.id and t.archived_at is null)
    order by 2 desc, 1
    limit 6
  ) x;
  return v_base || jsonb_build_object('project_progress', v_projects);
end;
$$;
revoke execute on function public.weave_dashboard(date) from public;
grant execute on function public.weave_dashboard(date) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
