// Server-only: reads the vendor attendance database. Read-only — Weave never writes there.
// The key is a service-role key for the vendor project, so it must never reach the browser,
// and every query selects only the few columns Weave needs.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { summarizeDay, type AttendanceDay, type HoursRow, type LeaveRow } from './attendance';

let client: SupabaseClient | null = null;

export function attendanceConfigured() {
  return Boolean(process.env.ATTENDANCE_SUPABASE_URL && process.env.ATTENDANCE_SUPABASE_KEY);
}

function attendanceClient() {
  client ??= createClient(process.env.ATTENDANCE_SUPABASE_URL!, process.env.ATTENDANCE_SUPABASE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

// Email → badge number. Looks at the main email, the work email and the alias table.
// ilike makes the match case-insensitive; the exact comparison afterwards stops '_' acting as a wildcard.
export async function findBadge(email: string): Promise<string | null> {
  const db = attendanceClient();
  const target = email.trim().toLowerCase();
  if (!target) return null;
  const same = (v: string | null) => (v || '').trim().toLowerCase() === target;

  const [byEmail, byWork, byAlias] = await Promise.all([
    db.from('employees').select('badge_number,email,active').ilike('email', target),
    db.from('employees').select('badge_number,work_email,active').ilike('work_email', target),
    db.from('employee_emails').select('badge_number,email').ilike('email', target),
  ]);
  for (const r of [byEmail, byWork, byAlias]) if (r.error) throw new Error(r.error.message);

  const employees = [
    ...(byEmail.data ?? []).filter(r => same(r.email)),
    ...(byWork.data ?? []).filter(r => same(r.work_email)),
  ].sort((a, b) => Number(b.active) - Number(a.active)); // active employee first
  return employees[0]?.badge_number ?? (byAlias.data ?? []).find(r => same(r.email))?.badge_number ?? null;
}

export async function getAttendanceDay(email: string, date: string): Promise<AttendanceDay> {
  const badge = await findBadge(email);
  if (!badge) return { matched: false, date, hours: null, overtimeHours: 0, firstIn: null, lastOut: null, tz: 'Asia/Jakarta', leave: null };

  const db = attendanceClient();
  const [hours, leaves] = await Promise.all([
    db.from('daily_hours').select('first_in,last_out,regular_hours,overtime_hours,tz').eq('badge_number', badge).eq('work_date', date),
    db.from('leave_days').select('leave_type,status,worked,is_rest_day').eq('badge_number', badge).eq('day', date),
  ]);
  if (hours.error) throw new Error(hours.error.message);
  if (leaves.error) throw new Error(leaves.error.message);
  return summarizeDay(date, (hours.data ?? []) as HoursRow[], (leaves.data ?? []) as LeaveRow[]);
}
