// Attendance (vendor clocking system): pure helpers shared by the API route and the work log UI.
// Weave reads it through one narrow database function; see lib/attendanceServer.ts.

export type LeaveType = 'cuti' | 'sakit' | 'izin' | 'menikah' | string;

// One person's attendance for one date, as the API returns it.
export type AttendanceDay = {
  matched: boolean;           // false = the Weave email is not an attendance employee
  date: string;
  hours: number | null;       // clock-in → clock-out span, null = no clocking that day
  overtimeHours: number;
  firstIn: string | null;     // ISO timestamps
  lastOut: string | null;
  tz: string;
  leave: LeaveType | null;    // approved leave on that date
};

export type HoursRow = { first_in: string | null; last_out: string | null; regular_hours: number | string | null; overtime_hours: number | string | null; tz: string | null };
export type LeaveRow = { leave_type: string; status: string; worked: boolean | null; is_rest_day: boolean | null };

const num = (v: number | string | null | undefined) => (v == null || v === '' ? 0 : Number(v) || 0);

// A view can return more than one row per person per day (e.g. two locations): merge them.
export function summarizeDay(date: string, hours: HoursRow[], leaves: LeaveRow[]): AttendanceDay {
  const ins = hours.map(r => r.first_in).filter((v): v is string => Boolean(v)).sort();
  const outs = hours.map(r => r.last_out).filter((v): v is string => Boolean(v)).sort();
  const total = hours.reduce((s, r) => s + num(r.regular_hours), 0);
  return {
    matched: true,
    date,
    hours: hours.length && (total > 0 || ins.length) ? round2(total) : null,
    overtimeHours: round2(hours.reduce((s, r) => s + num(r.overtime_hours), 0)),
    firstIn: ins[0] ?? null,
    lastOut: outs[outs.length - 1] ?? null,
    tz: hours.find(r => r.tz)?.tz || 'Asia/Jakarta',
    leave: pickLeave(leaves),
  };
}

export const notMatched = (date: string): AttendanceDay =>
  ({ matched: false, date, hours: null, overtimeHours: 0, firstIn: null, lastOut: null, tz: 'Asia/Jakarta', leave: null });

// The attendance function's reply: { matched, hours: HoursRow[], leaves: LeaveRow[] }.
export function fromAttendanceReply(date: string, reply: unknown): AttendanceDay {
  const r = (reply ?? {}) as { matched?: boolean; hours?: HoursRow[]; leaves?: LeaveRow[] };
  if (!r.matched) return notMatched(date);
  return summarizeDay(date, Array.isArray(r.hours) ? r.hours : [], Array.isArray(r.leaves) ? r.leaves : []);
}

// Clocked in but no clock-out: the day is still open (or the clock-out was forgotten),
// so its hours are not final and must not be compared with what is logged.
export function isClockOpen(day: AttendanceDay): boolean {
  return Boolean(day.firstIn) && !day.lastOut;
}

// Approved leave that was actually taken (not a cuti bersama worked through, not a weekend inside a range).
export function pickLeave(leaves: LeaveRow[]): LeaveType | null {
  const taken = leaves.find(l => l.status === 'approved' && !l.worked && !l.is_rest_day);
  return taken ? taken.leave_type : null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// Attendance hours minus what is logged, rounded to the work log's half-hour step.
// Positive = still to assign, negative = logged more than clocked.
export function hoursGap(attendanceHours: number | null, loggedHours: number): number | null {
  if (attendanceHours == null) return null;
  return Math.round((attendanceHours - loggedHours) * 2) / 2;
}

export function leaveLabel(type: LeaveType): string {
  const labels: Record<string, string> = { cuti: 'Cuti', sakit: 'Sakit', izin: 'Izin', menikah: 'Cuti menikah', cuti_haid: 'Cuti haid' };
  return labels[type] ?? type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ');
}

// "08:59" in the attendance location's time zone.
export function clockTime(iso: string | null, tz: string): string {
  if (!iso) return '–';
  try {
    return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }).format(new Date(iso));
  } catch {
    return new Date(iso).toISOString().slice(11, 16);
  }
}

export const formatHours = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
