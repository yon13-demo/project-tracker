// Copies each Weave user's attendance days into Weave's own attendance_days table, so the
// weave_dashboard() database function can total them. Pure helpers; the route is app/api/attendance-sync.
import type { AttendanceDay } from './attendance';

export const MAX_SYNC_DAYS = 14;

export type AttendanceRow = {
  user_id: string; work_date: string; hours: number | null; overtime_hours: number;
  first_in: string | null; last_out: string | null; leave_type: string | null; synced_at: string;
};

// Today's date in WIB (the server runs in UTC).
export function jakartaToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

// `today` and the days before it, newest first.
export function syncDates(today: string, days: number): string[] {
  const n = Math.min(MAX_SYNC_DAYS, Math.max(1, Math.floor(days) || 1));
  const base = new Date(`${today}T00:00:00Z`);
  return Array.from({ length: n }, (_, i) => new Date(base.getTime() - i * 86_400_000).toISOString().slice(0, 10));
}

// null = nothing worth storing (not an attendance employee, or no clocking and no leave that day).
export function toAttendanceRow(userId: string, day: AttendanceDay, syncedAt: string): AttendanceRow | null {
  if (!day.matched || (!day.firstIn && !day.lastOut && day.hours == null && !day.leave)) return null;
  return {
    user_id: userId, work_date: day.date, hours: day.hours, overtime_hours: day.overtimeHours,
    first_in: day.firstIn, last_out: day.lastOut, leave_type: day.leave, synced_at: syncedAt,
  };
}

// Like Promise.all over `items`, but with at most `limit` calls in flight.
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i]); } };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

// Departments to write to profiles.division: only where none is set yet, so an admin's own change sticks.
export function divisionUpdates(found: Map<string, string | null>, current: Map<string, string | null>): { id: string; division: string }[] {
  return [...found].filter(([id, d]) => d && !current.get(id)).map(([id, d]) => ({ id, division: d! }));
}
