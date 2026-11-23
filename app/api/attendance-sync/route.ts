import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { attendanceConfigured, getAttendanceDay } from '@/lib/attendanceServer';
import { jakartaToday, mapLimit, syncDates, toAttendanceRow, type AttendanceRow } from '@/lib/attendanceSync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const KEEP_DAYS = 60; // attendance_days older than this is deleted

// GET /api/attendance-sync?days=2 — called by the scheduled job in Weave's Supabase (pg_cron),
// with "Authorization: Bearer <CRON_SECRET>". Copies each user's attendance for today and the
// days before it into attendance_days, which only the database itself (weave_dashboard) reads.
export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!attendanceConfigured()) return NextResponse.json({ error: 'Attendance not configured' }, { status: 503 });

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
  });

  const { data: profiles, error: e1 } = await db.from('profiles').select('id').eq('role', 'user');
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
  const ids = new Set((profiles ?? []).map(p => p.id as string));

  const emails = new Map<string, string>();
  for (let page = 1; page < 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    for (const u of data.users) if (ids.has(u.id) && u.email) emails.set(u.id, u.email);
    if (data.users.length < 1000) break;
  }

  const today = jakartaToday();
  const dates = syncDates(today, Number(request.nextUrl.searchParams.get('days') ?? 2));
  const jobs = [...emails].flatMap(([id, email]) => dates.map(date => ({ id, email, date })));
  const syncedAt = new Date().toISOString();
  let failed = 0;
  const rows = (await mapLimit(jobs, 8, async j => {
    try { return toAttendanceRow(j.id, await getAttendanceDay(j.email, j.date), syncedAt); }
    catch { failed++; return null; }
  })).filter((r): r is AttendanceRow => Boolean(r));

  if (rows.length) {
    const { error } = await db.from('attendance_days').upsert(rows, { onConflict: 'user_id,work_date' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  // The dashboard shows "last synced"; only move it when the attendance system actually answered.
  if (failed < jobs.length) {
    await db.from('admin_settings').upsert({ key: 'attendance_synced_at', value: syncedAt, updated_at: syncedAt }, { onConflict: 'key' });
  }
  const cutoff = new Date(Date.parse(`${today}T00:00:00Z`) - KEEP_DAYS * 86_400_000).toISOString().slice(0, 10);
  await db.from('attendance_days').delete().lt('work_date', cutoff);

  return NextResponse.json({ ok: failed === 0, people: emails.size, dates: dates.length, rows: rows.length, failed, synced_at: syncedAt });
}
