'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Clock, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { clockTime, formatHours, hoursGap, isClockOpen, leaveLabel, type AttendanceDay, type LeaveType } from '@/lib/attendance';

export type AttendanceState = { status: 'loading' } | { status: 'error' } | { status: 'ok'; day: AttendanceDay };

async function fetchAttendance(date: string): Promise<AttendanceDay> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`/api/attendance?date=${date}`, { headers: session ? { Authorization: `Bearer ${session.access_token}` } : {} });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Attendance for one date, shared by the attendance bar and the allocation bar.
// Re-checked when the tab comes back into view and on demand, since punches can reach the
// attendance system late; a re-check keeps the current answer on screen until the new one arrives.
export function useAttendance(date: string): [AttendanceState, () => void, boolean] {
  const [state, setState] = useState<AttendanceState>({ status: 'loading' });
  const [tick, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const reload = useCallback(() => setTick(n => n + 1), []);
  const shown = useRef('');
  useEffect(() => {
    let cancelled = false;
    if (shown.current !== date) setState({ status: 'loading' }); // new date: clear; same date: refresh in place
    if (!date) { shown.current = ''; setRefreshing(false); return; } // form closed: nothing to fetch
    setRefreshing(shown.current === date);
    fetchAttendance(date)
      .finally(() => { if (!cancelled) setRefreshing(false); })
      .then(day => { if (!cancelled) { shown.current = date; setState({ status: 'ok', day }); } })
      .catch(() => { if (!cancelled) { shown.current = date; setState({ status: 'error' }); } });
    return () => { cancelled = true; };
  }, [date, tick]);
  useEffect(() => {
    if (!date) return;
    const onVisible = () => { if (document.visibilityState === 'visible') reload(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [date, reload]);
  return [state, reload, refreshing];
}

// Attendance hours worth splitting: a matched, fully clocked (in and out) day that is not leave.
export function clockedHours(state: AttendanceState): number | null {
  return state.status === 'ok' && state.day.matched && !state.day.leave && !isClockOpen(state.day) ? state.day.hours : null;
}

// What the attendance system says about the selected date, next to what is logged in Weave.
// Read-only reference: it never changes entries by itself; "Mark as leave" only switches the form.
export function AttendanceBar({ t, state, loggedHours, isLeaveMode, onMarkLeave, onRefresh, refreshing }: {
  t: any; state: AttendanceState; loggedHours: number; isLeaveMode: boolean; onMarkLeave: (type: LeaveType) => void; onRefresh: () => void; refreshing: boolean;
}) {
  const refresh = <button type="button" className={`attendance-refresh${refreshing ? ' spin' : ''}`} onClick={onRefresh} disabled={refreshing} title={t.attRefresh} aria-label={t.attRefresh}><RefreshCw size={13} /></button>;
  if (state.status === 'loading') return <div className="attendance-bar muted"><Clock size={14} /> {t.attLoading}</div>;
  if (state.status === 'error') return <div className="attendance-bar muted"><Clock size={14} /> {t.attUnavailable}{refresh}</div>;
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

  if (day.hours == null) return <div className="attendance-bar muted"><Clock size={14} /> {t.attNoClock}{refresh}</div>;

  // Clocked in, never out: no final hours yet, so nothing to compare against.
  if (isClockOpen(day)) {
    return (
      <div className="attendance-bar muted">
        <Clock size={14} />
        <span><strong>{t.attendance}:</strong> {t.attClockIn} {clockTime(day.firstIn, day.tz)} · {t.attNoClockOut}</span>
        {refresh}
      </div>
    );
  }

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
      {refresh}
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
