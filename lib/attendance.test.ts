import { describe, expect, it } from 'vitest';
import { clockTime, fromAttendanceReply, hoursGap, isClockOpen, leaveLabel, pickLeave, summarizeDay, type LeaveRow } from './attendance';

const leave = (patch: Partial<LeaveRow>): LeaveRow => ({ leave_type: 'cuti', status: 'approved', worked: false, is_rest_day: false, ...patch });

describe('summarizeDay', () => {
  it('takes span hours, overtime and clock times from one row', () => {
    const d = summarizeDay('2026-11-17', [{ first_in: '2026-11-17T01:36:12+00:00', last_out: '2026-11-17T11:21:45+00:00', regular_hours: '9.76', overtime_hours: 0, tz: 'Asia/Jakarta' }], []);
    expect(d).toMatchObject({ matched: true, hours: 9.76, overtimeHours: 0, firstIn: '2026-11-17T01:36:12+00:00', lastOut: '2026-11-17T11:21:45+00:00', leave: null });
  });
  it('merges several rows: earliest in, latest out, summed hours', () => {
    const d = summarizeDay('2026-11-17', [
      { first_in: '2026-11-17T05:00:00Z', last_out: '2026-11-17T09:00:00Z', regular_hours: 4, overtime_hours: 1, tz: null },
      { first_in: '2026-11-17T01:00:00Z', last_out: '2026-11-17T04:00:00Z', regular_hours: 3, overtime_hours: null, tz: 'Asia/Jakarta' },
    ], []);
    expect(d).toMatchObject({ hours: 7, overtimeHours: 1, firstIn: '2026-11-17T01:00:00Z', lastOut: '2026-11-17T09:00:00Z', tz: 'Asia/Jakarta' });
  });
  it('reports no hours when nobody clocked', () => {
    expect(summarizeDay('2026-11-17', [], []).hours).toBeNull();
    expect(summarizeDay('2026-11-17', [{ first_in: null, last_out: null, regular_hours: 0, overtime_hours: 0, tz: null }], []).hours).toBeNull();
  });
  it('keeps the hours of a day that is clocked in but not yet out', () => {
    expect(summarizeDay('2026-11-17', [{ first_in: '2026-11-17T01:00:00Z', last_out: null, regular_hours: 0, overtime_hours: 0, tz: null }], []).hours).toBe(0);
  });
});

describe('pickLeave', () => {
  it('returns the approved leave type', () => {
    expect(pickLeave([leave({ leave_type: 'sakit' })])).toBe('sakit');
  });
  it('ignores unapproved, worked-through and rest days', () => {
    expect(pickLeave([leave({ status: 'pending' }), leave({ worked: true }), leave({ is_rest_day: true })])).toBeNull();
  });
  it('is null without leave', () => {
    expect(pickLeave([])).toBeNull();
  });
});

describe('hoursGap', () => {
  it('rounds the remainder to half hours', () => {
    expect(hoursGap(9.76, 6)).toBe(4);
    expect(hoursGap(9.2, 6)).toBe(3);
    expect(hoursGap(8, 8)).toBe(0);
    expect(hoursGap(7, 8)).toBe(-1);
  });
  it('is null without attendance hours', () => {
    expect(hoursGap(null, 3)).toBeNull();
  });
});

describe('labels', () => {
  it('names leave types', () => {
    expect(leaveLabel('cuti')).toBe('Cuti');
    expect(leaveLabel('menikah')).toBe('Cuti menikah');
    expect(leaveLabel('dinas_luar')).toBe('Dinas luar');
  });
  it('formats clock time in the location time zone', () => {
    expect(clockTime('2026-11-17T01:36:12+00:00', 'Asia/Jakarta')).toBe('08:36');
    expect(clockTime(null, 'Asia/Jakarta')).toBe('–');
  });
});

describe('fromAttendanceReply', () => {
  it('summarizes a matched reply', () => {
    const d = fromAttendanceReply('2026-11-17', {
      matched: true,
      hours: [{ first_in: '2026-11-17T01:00:00+00:00', last_out: '2026-11-17T10:00:00+00:00', regular_hours: 9, overtime_hours: 0, tz: 'Asia/Jakarta' }],
      leaves: [],
    });
    expect(d).toMatchObject({ matched: true, hours: 9, leave: null });
  });
  it('treats an unmatched or empty reply as not linked', () => {
    expect(fromAttendanceReply('2026-11-17', { matched: false }).matched).toBe(false);
    expect(fromAttendanceReply('2026-11-17', null).matched).toBe(false);
  });
  it('tolerates missing lists', () => {
    expect(fromAttendanceReply('2026-11-17', { matched: true })).toMatchObject({ matched: true, hours: null, leave: null });
  });
});

describe('isClockOpen', () => {
  const day = (firstIn: string | null, lastOut: string | null) => summarizeDay('2026-11-19', firstIn || lastOut ? [{ first_in: firstIn, last_out: lastOut, regular_hours: 0, overtime_hours: 0, tz: null }] : [], []);
  it('is true when clocked in but never out', () => {
    expect(isClockOpen(day('2026-11-19T01:43:00Z', null))).toBe(true);
  });
  it('is false for a complete day or no clocking', () => {
    expect(isClockOpen(day('2026-11-19T01:43:00Z', '2026-11-19T10:00:00Z'))).toBe(false);
    expect(isClockOpen(day(null, null))).toBe(false);
  });
});
