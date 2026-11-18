'use client';

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { clockTime, formatHours, hoursGap, leaveLabel, type AttendanceDay, type LeaveType } from '@/lib/attendance';

type State = { status: 'loading' } | { status: 'error' } | { status: 'ok'; day: AttendanceDay };

async function fetchAttendance(date: string): Promise<AttendanceDay> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`/api/attendance?date=${date}`, { headers: session ? { Authorization: `Bearer ${session.access_token}` } : {} });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// What the attendance system says about the selected date, next to what is logged in Weave.
// Read-only reference: it never changes entries by itself; "Mark as leave" only switches the form.
export function AttendanceBar({ t, date, loggedHours, isLeaveMode, onMarkLeave }: {
  t: any; date: string; loggedHours: number; isLeaveMode: boolean; onMarkLeave: (type: LeaveType) => void;
}) {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    fetchAttendance(date)
      .then(day => { if (!cancelled) setState({ status: 'ok', day }); })
      .catch(() => { if (!cancelled) setState({ status: 'error' }); });
    return () => { cancelled = true; };
  }, [date]);

  if (state.status === 'loading') return <div className="attendance-bar muted"><Clock size={14} /> {t.attLoading}</div>;
  if (state.status === 'error') return <div className="attendance-bar muted"><Clock size={14} /> {t.attUnavailable}</div>;
  const { day } = state;
  if (!day.matched) return <div className="attendance-bar muted"><Clock size={14} /> {t.attNotLinked}</div>;

  if (day.leave) {
    return (
      <div className="attendance-bar leave">
        <Clock size={14} />
        <span><strong>{t.attendance}:</strong> {leaveLabel(day.leave)} {t.attOnThisDay}</span>
        {!isLeaveMode && <button type="button" className="btn-secondary attendance-action" onClick={() => onMarkLeave(day.leave!)}>{t.markAsLeave}</button>}
      </div>
    );
  }

  if (day.hours == null) return <div className="attendance-bar muted"><Clock size={14} /> {t.attNoClock}</div>;

  const gap = isLeaveMode ? null : hoursGap(day.hours, loggedHours);
  const tone = gap == null ? '' : gap > 0 ? 'warn' : gap < 0 ? 'over' : 'ok';
  return (
    <div className={`attendance-bar ${tone}`}>
      <Clock size={14} />
      <span>
        <strong>{t.attendance}:</strong> {clockTime(day.firstIn, day.tz)}–{day.lastOut ? clockTime(day.lastOut, day.tz) : '…'}
        {' · '}{formatHours(Math.round(day.hours * 10) / 10)} {t.hoursUnit}
        {day.overtimeHours > 0 && <> (+{formatHours(Math.round(day.overtimeHours * 10) / 10)} {t.attOvertime})</>}
      </span>
      {gap != null && (
        <span className="attendance-gap">
          {t.attLogged} {formatHours(loggedHours)} {t.hoursUnit} · {gap > 0
            ? <>{formatHours(gap)} {t.hoursUnit} {t.attRemaining}</>
            : gap < 0 ? <>{formatHours(-gap)} {t.hoursUnit} {t.attOver}</> : t.attMatch}
        </span>
      )}
    </div>
  );
}
