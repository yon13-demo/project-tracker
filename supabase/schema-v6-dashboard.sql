-- Migration v6: TV dashboard.
-- Run once in the Weave Supabase project's SQL Editor (NOT the attendance project). Safe to run again.
--
-- What it does:
--   1. attendance_days — a private copy of each user's attendance per day, filled by /api/attendance-sync.
--      Nobody can read it through the API (no anon/authenticated access, no RLS policies); only the
--      database itself (weave_dashboard) and the server's service key use it. Rows older than 60 days are deleted.
--   2. weave_dashboard(p_date) — everything the TV screen shows, as one JSON object, aggregates only.
--      It is the ONE thing the publishable (anon) key can call.
--   3. Locks the anon key out of every table and every other function.
--   4. Schedules the attendance sync with pg_cron + pg_net (every 10 min, 07:00–19:50 WIB, Mon–Sat,
--      plus a nightly 10-day refresh for late punches).
--
-- After running this file, store the cron secret ONCE (the value of CRON_SECRET in Vercel → Settings →
-- Environment Variables). Paste it in the SQL Editor only, never in a file:
--     select vault.create_secret('<CRON_SECRET value>', 'weave_cron_secret');
-- To change it later:
--     select vault.update_secret((select id from vault.secrets where name = 'weave_cron_secret'), '<new value>');

-- ─── 1. attendance_days ─────────────────────────────────────────────────────────
create table if not exists public.attendance_days (
  user_id uuid not null references public.profiles(id) on delete cascade,
  work_date date not null,
  hours numeric(5,2),               -- clocked hours (regular), null = no clocking
  overtime_hours numeric(5,2) not null default 0,
  first_in timestamptz,
  last_out timestamptz,             -- null while still clocked in
  leave_type text,                  -- approved leave that day, if any
  synced_at timestamptz not null default now(),
  primary key (user_id, work_date)
);
alter table public.attendance_days enable row level security;
revoke all on public.attendance_days from public, anon, authenticated;

-- ─── 2. weave_dashboard ─────────────────────────────────────────────────────────
create or replace function public.weave_dashboard(p_date date default null) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
  d date := coalesce(p_date, v_today);
  wk_start date;  lw_start date;  lw_end date;
  m_start date;   pm_start date;  pm_end date;
  ref date;                      -- the workday before d ("yesterday", Friday on a Monday)
  cmp_from date;  cmp_to date;   -- attendance comparison period
  v_expected int;
  v_reported int;
  v_streak int := 0;
  x date;
  v_week numeric;  v_last_week numeric;
  v_month numeric; v_last_month numeric;
  v_synced timestamptz;
  j_categories jsonb; j_top jsonb; j_trend jsonb; j_manual jsonb; j_att_cmp jsonb; j_att_today jsonb;
  v_top_hours numeric; v_project_hours numeric;
begin
  if d < date '2020-01-01' or d > v_today + 1 then
    raise exception 'p_date must be between 2020-01-01 and tomorrow' using errcode = '22023';
  end if;

  wk_start := d - (extract(isodow from d)::int - 1);
  lw_start := wk_start - 7;
  lw_end   := d - 7;
  m_start  := date_trunc('month', d)::date;
  pm_start := (m_start - interval '1 month')::date;
  pm_end   := least(pm_start + (d - m_start), m_start - 1);
  ref := d - 1;
  while extract(isodow from ref) > 5 loop ref := ref - 1; end loop;

  -- People expected to report: every account with the "user" role (admins log too, but are not counted).
  select count(*) into v_expected from public.profiles p where p.role = 'user';

  select count(distinct w.user_id) into v_reported
  from public.work_logs w join public.profiles p on p.id = w.user_id and p.role = 'user'
  where w.log_date = ref;

  -- Streak: workdays in a row, ending at ref, where at least 90% of users reported.
  x := ref;
  while v_expected > 0 and v_streak < 120 loop
    exit when (select count(distinct w.user_id) from public.work_logs w
               join public.profiles p on p.id = w.user_id and p.role = 'user'
               where w.log_date = x) < ceil(v_expected * 0.9);
    v_streak := v_streak + 1;
    x := x - 1;
    while extract(isodow from x) > 5 loop x := x - 1; end loop;
  end loop;

  -- Hours (leave never counts). This week = Monday..d, compared with last week Monday..same weekday.
  select coalesce(sum(w.hours) filter (where w.log_date between wk_start and d), 0),
         coalesce(sum(w.hours) filter (where w.log_date between lw_start and lw_end), 0),
         coalesce(sum(w.hours) filter (where w.log_date between m_start and d), 0),
         coalesce(sum(w.hours) filter (where w.log_date between pm_start and pm_end), 0)
    into v_week, v_last_week, v_month, v_last_month
  from public.work_logs w
  where not w.is_leave and w.hours > 0 and w.log_date between least(lw_start, pm_start) and d;

  -- Hours by category this week, always all four in a fixed order.
  select jsonb_agg(jsonb_build_object(
           'key', c.key, 'label', c.label,
           'hours', round(coalesce(h.hours, 0), 1),
           'share_pct', case when v_week > 0 then round(coalesce(h.hours, 0) / v_week * 100, 1) else null end)
         order by c.ord)
    into j_categories
  from (values (1, 'project', 'Proyek'), (2, 'quotation', 'Quotation'), (3, 'training', 'Training'), (4, 'other', 'Lainnya'))
       as c(ord, key, label)
  left join (select coalesce(w.category, 'project') as category, sum(w.hours) as hours
             from public.work_logs w
             where not w.is_leave and w.hours > 0 and w.log_date between wk_start and d
             group by 1) h on h.category = c.key;

  -- Top 8 registered projects this month.
  select coalesce(jsonb_agg(jsonb_build_object(
           'rank', t.rank, 'code', t.project_code, 'name', t.name, 'hours', round(t.hours, 1),
           'people', t.people,
           'share_pct', case when v_month > 0 then round(t.hours / v_month * 100, 1) else null end)
         order by t.rank), '[]'::jsonb),
         coalesce(sum(t.hours), 0)
    into j_top, v_top_hours
  from (select pr.project_code, pr.name, sum(w.hours) as hours, count(distinct w.user_id) as people,
               row_number() over (order by sum(w.hours) desc, pr.project_code) as rank
        from public.work_logs w join public.projects pr on pr.id = w.project_id
        where not w.is_leave and w.hours > 0 and w.log_date between m_start and d
        group by pr.id, pr.project_code, pr.name
        order by hours desc, pr.project_code
        limit 8) t;

  -- Project hours this month: registered + typed ("manual") names.
  select coalesce(sum(w.hours), 0),
         jsonb_build_object(
           'hours', round(coalesce(sum(w.hours) filter (where w.project_id is null), 0), 1),
           'entries', count(*) filter (where w.project_id is null),
           'share_pct', case when coalesce(sum(w.hours), 0) > 0
                        then round(coalesce(sum(w.hours) filter (where w.project_id is null), 0) / sum(w.hours) * 100, 1) end)
    into v_project_hours, j_manual
  from public.work_logs w
  where not w.is_leave and w.hours > 0 and coalesce(w.category, 'project') = 'project'
    and w.log_date between m_start and d;

  -- Weekly hours, the last 8 weeks (the current one is still running).
  select jsonb_agg(jsonb_build_object(
           'week_start', ws::date, 'iso_week', extract(week from ws)::int,
           'hours', round(coalesce((select sum(w.hours) from public.work_logs w
                                    where not w.is_leave and w.hours > 0
                                      and w.log_date between ws::date and least(ws::date + 6, d)), 0), 1),
           'partial', ws::date = wk_start)
         order by ws)
    into j_trend
  from generate_series(wk_start - 49, wk_start, interval '7 days') ws;

  -- Attendance vs logged hours: this week up to yesterday (on a Monday: all of last week).
  -- Only finished attendance days count (clocked in AND out), so an open day never skews it.
  if d > wk_start then cmp_from := wk_start; cmp_to := d - 1;
  else cmp_from := lw_start; cmp_to := wk_start - 1; end if;

  select jsonb_build_object(
           'from', cmp_from, 'to', cmp_to,
           'clocked_hours', round(coalesce(sum(a.hours), 0), 1),
           'logged_hours', round(coalesce(sum(l.hours), 0), 1),
           'coverage_pct', case when coalesce(sum(a.hours), 0) > 0
                           then round(coalesce(sum(l.hours), 0) / sum(a.hours) * 100, 1) end,
           'person_days', count(*),
           'unreported_days', count(*) filter (where l.hours is null))
    into j_att_cmp
  from public.attendance_days a
  join public.profiles p on p.id = a.user_id and p.role = 'user'
  left join (select w.user_id, w.log_date, sum(w.hours) as hours
             from public.work_logs w
             where not w.is_leave and w.hours > 0 and w.log_date between cmp_from and cmp_to
             group by 1, 2) l on l.user_id = a.user_id and l.log_date = a.work_date
  where a.work_date between cmp_from and cmp_to
    and a.first_in is not null and a.last_out is not null and a.hours > 0;

  -- Today at the clock (as of the last sync).
  select nullif(s.value, '')::timestamptz into v_synced
  from public.admin_settings s where s.key = 'attendance_synced_at';

  select jsonb_build_object(
           'date', d,
           'expected', v_expected,
           'clocked_in', count(*) filter (where a.first_in is not null),
           'still_in', count(*) filter (where a.first_in is not null and a.last_out is null),
           'clocked_out', count(*) filter (where a.first_in is not null and a.last_out is not null),
           'on_leave', count(*) filter (where a.first_in is null and a.leave_type is not null),
           'not_clocked_in', greatest(v_expected - count(*) filter (where a.first_in is not null)
                                                 - count(*) filter (where a.first_in is null and a.leave_type is not null), 0),
           'synced_at', v_synced,
           'minutes_since_sync', case when v_synced is not null then floor(extract(epoch from now() - v_synced) / 60)::int end,
           'is_stale', v_synced is null or now() - v_synced > interval '30 minutes')
    into j_att_today
  from public.attendance_days a
  join public.profiles p on p.id = a.user_id and p.role = 'user'
  where a.work_date = d;

  return jsonb_build_object(
    'generated_at', now(),
    'timezone', 'Asia/Jakarta',
    'date', d,
    'periods', jsonb_build_object(
      'week', jsonb_build_object('from', wk_start, 'to', d, 'iso_week', extract(week from d)::int),
      'last_week', jsonb_build_object('from', lw_start, 'to', lw_end),
      'month', jsonb_build_object('from', m_start, 'to', d),
      'last_month', jsonb_build_object('from', pm_start, 'to', pm_end)),
    'reporting', jsonb_build_object(
      'date', ref,
      'expected', v_expected,
      'reported', v_reported,
      'rate_pct', case when v_expected > 0 then round(v_reported::numeric / v_expected * 100, 1) end,
      'target_pct', 90,
      'streak_days', v_streak),
    'hours', jsonb_build_object(
      'week', round(v_week, 1),
      'last_week', round(v_last_week, 1),
      'week_change_pct', case when v_last_week > 0 then round((v_week - v_last_week) / v_last_week * 100, 1) end,
      'month', round(v_month, 1),
      'last_month', round(v_last_month, 1),
      'month_change_pct', case when v_last_month > 0 then round((v_month - v_last_month) / v_last_month * 100, 1) end),
    'categories_week', j_categories,
    'top_projects_month', j_top,
    'other_projects_month_hours', round(greatest(v_project_hours - v_top_hours, 0), 1),
    'manual_projects_month', j_manual,
    'weekly_trend', j_trend,
    'attendance', jsonb_build_object('comparison', j_att_cmp, 'today', j_att_today)
  );
end;
$$;

-- ─── 3. The anon (publishable) key: this function and nothing else ──────────────
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon;
-- Functions are executable by PUBLIC by default, which includes anon: take that away, then give back
-- only what each role needs (signed-in users need is_admin() for the row-level policies).
revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, service_role;
revoke execute on function public.keep_alive() from public;
grant execute on function public.keep_alive() to service_role;
revoke execute on function public.weave_dashboard(date) from public;
grant execute on function public.weave_dashboard(date) to anon, authenticated, service_role;

-- Old read policies for anon. The app reads popups and settings through its server (service key),
-- so nothing needs them; signed-in users keep reading popups.
drop policy if exists "public can read settings" on public.admin_settings;
drop policy if exists "anyone can read active popups" on public.app_popups;
drop policy if exists "signed-in users read active popups" on public.app_popups;
create policy "signed-in users read active popups" on public.app_popups for select to authenticated
  using (current_date between starts_at and ends_at);

-- ─── 4. Attendance sync schedule ────────────────────────────────────────────────
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create or replace function public.weave_run_attendance_sync(p_days int) returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare v_secret text;
begin
  select ds.decrypted_secret into v_secret from vault.decrypted_secrets ds where ds.name = 'weave_cron_secret';
  if v_secret is null then raise exception 'Vault secret weave_cron_secret is missing'; end if;
  return net.http_get(
    url := 'https://weave.web.id/api/attendance-sync?days=' || p_days,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 60000);
end;
$$;
revoke execute on function public.weave_run_attendance_sync(int) from public, anon, authenticated;

select cron.unschedule(jobname) from cron.job where jobname in ('weave-attendance-sync', 'weave-attendance-nightly');
-- Every 10 minutes 07:00–19:50 WIB (00–12 UTC), Monday–Saturday: today and the 3 days before
-- (so on Monday, Friday's late punches are picked up too).
select cron.schedule('weave-attendance-sync', '*/10 0-12 * * 1-6', 'select public.weave_run_attendance_sync(4)');
-- Every night at 21:00 WIB: the last 10 days.
select cron.schedule('weave-attendance-nightly', '0 14 * * *', 'select public.weave_run_attendance_sync(10)');

notify pgrst, 'reload schema';
