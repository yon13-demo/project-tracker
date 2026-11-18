-- ⚠️ Jalankan di project Supabase ABSENSI (vendor), BUKAN di Supabase Weave.
-- Run in the ATTENDANCE Supabase project's SQL Editor, NOT in Weave's.
--
-- Gives Weave one narrow, read-only door into attendance:
--   public.weave_attendance_day(email, date, code) → clock times, hours and leave for ONE person on ONE date.
-- Weave calls it with the attendance project's anon/publishable key plus an access code.
-- The anon key alone cannot call it, and the code only unlocks this function — no tables, no salaries, no writes.
-- Safe to run again; existing data is not touched.
--
-- After running this file:
--   1. Run:  select weave_private.rotate_code();
--      It returns the access code ONCE. Give it to whoever sets Weave's Vercel variables (ATTENDANCE_ACCESS_CODE).
--      Running it again creates a new code and the old one stops working immediately (use it if the code leaks).
--   2. To switch Weave off completely:  drop function public.weave_attendance_day(text, date, text);

create schema if not exists weave_private;
revoke all on schema weave_private from public, anon, authenticated;

-- Only the SHA-256 hash of the access code is stored.
create table if not exists weave_private.access (
  id int primary key default 1 check (id = 1),
  code_hash text not null,
  rotated_at timestamptz not null default now()
);
alter table weave_private.access enable row level security;
revoke all on weave_private.access from public, anon, authenticated;

create or replace function weave_private.rotate_code() returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  insert into weave_private.access (id, code_hash)
  values (1, encode(sha256(convert_to(v_code, 'UTF8')), 'hex'))
  on conflict (id) do update set code_hash = excluded.code_hash, rotated_at = now();
  return v_code;
end;
$$;
revoke all on function weave_private.rotate_code() from public, anon, authenticated;

-- One person (by email), one date. Returns { matched, hours: [...], leaves: [...] }.
create or replace function public.weave_attendance_day(p_email text, p_date date, p_code text) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_badge text;
begin
  if p_code is null or not exists (
    select 1 from weave_private.access a
    where a.code_hash = encode(sha256(convert_to(p_code, 'UTF8')), 'hex')
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_email = '' or p_date is null then
    return jsonb_build_object('matched', false);
  end if;

  -- Main or work email (active employee first), then the alias table.
  select e.badge_number into v_badge
  from public.employees e
  where lower(trim(e.email)) = v_email or lower(trim(e.work_email)) = v_email
  order by e.active desc nulls last
  limit 1;

  if v_badge is null then
    select ee.badge_number into v_badge
    from public.employee_emails ee
    where lower(trim(ee.email)) = v_email
    limit 1;
  end if;

  if v_badge is null then
    return jsonb_build_object('matched', false);
  end if;

  return jsonb_build_object(
    'matched', true,
    'hours', coalesce((
      select jsonb_agg(jsonb_build_object(
        'first_in', h.first_in, 'last_out', h.last_out,
        'regular_hours', h.regular_hours, 'overtime_hours', h.overtime_hours, 'tz', h.tz))
      from public.daily_hours h
      where h.badge_number = v_badge and h.work_date = p_date), '[]'::jsonb),
    'leaves', coalesce((
      select jsonb_agg(jsonb_build_object(
        'leave_type', l.leave_type, 'status', l.status, 'worked', l.worked, 'is_rest_day', l.is_rest_day))
      from public.leave_days l
      where l.badge_number = v_badge and l.day = p_date), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.weave_attendance_day(text, date, text) from public, anon, authenticated;
grant execute on function public.weave_attendance_day(text, date, text) to anon;

notify pgrst, 'reload schema';
