// Server-only: asks the vendor attendance database about one person on one date.
// Weave holds only the attendance project's anon key plus an access code, which together unlock a single
// read-only function (supabase/attendance/weave-attendance-access.sql) — never the service role key.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { fromAttendanceReply, type AttendanceDay } from './attendance';

let client: SupabaseClient | null = null;

export function attendanceConfigured() {
  return Boolean(process.env.ATTENDANCE_SUPABASE_URL && process.env.ATTENDANCE_SUPABASE_ANON_KEY && process.env.ATTENDANCE_ACCESS_CODE);
}

function attendanceClient() {
  client ??= createClient(process.env.ATTENDANCE_SUPABASE_URL!, process.env.ATTENDANCE_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    // Next.js caches server fetches (supabase-js RPCs are POSTs) in its data cache, which on Vercel
    // outlives requests and deploys: a late clock-out then never showed up. Always ask fresh.
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
  });
  return client;
}

export async function getAttendanceDay(email: string, date: string): Promise<AttendanceDay> {
  const { data, error } = await attendanceClient().rpc('weave_attendance_day', {
    p_email: email, p_date: date, p_code: process.env.ATTENDANCE_ACCESS_CODE!,
  });
  if (error) throw new Error(error.message);
  return fromAttendanceReply(date, data);
}
