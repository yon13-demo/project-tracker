import { describe, expect, it } from 'vitest';
import { jakartaToday, mapLimit, syncDates, toAttendanceRow } from './attendanceSync';
import type { AttendanceDay } from './attendance';

describe('jakartaToday', () => {
  it('uses the WIB date, not UTC', () => {
    expect(jakartaToday(new Date('2026-11-22T18:30:00Z'))).toBe('2026-11-23'); // 01:30 WIB
    expect(jakartaToday(new Date('2026-11-23T16:59:00Z'))).toBe('2026-11-23'); // 23:59 WIB
  });
});

describe('syncDates', () => {
  it('lists today and the days before it, newest first', () => {
    expect(syncDates('2026-11-23', 3)).toEqual(['2026-11-23', '2026-11-22', '2026-11-21']);
  });
  it('keeps the count between 1 and 14', () => {
    expect(syncDates('2026-11-23', 0)).toEqual(['2026-11-23']);
    expect(syncDates('2026-11-23', 99)).toHaveLength(14);
  });
});

describe('toAttendanceRow', () => {
  const day = (patch: Partial<AttendanceDay>): AttendanceDay => ({
    matched: true, date: '2026-11-20', hours: 8.5, overtimeHours: 1, firstIn: '2026-11-20T01:00:00Z',
    lastOut: '2026-11-20T10:30:00Z', tz: 'Asia/Jakarta', leave: null, ...patch,
  });
  it('turns an attendance day into a row for the attendance_days table', () => {
    expect(toAttendanceRow('u1', day({}), '2026-11-20T11:00:00Z')).toEqual({
      user_id: 'u1', work_date: '2026-11-20', hours: 8.5, overtime_hours: 1,
      first_in: '2026-11-20T01:00:00Z', last_out: '2026-11-20T10:30:00Z', leave_type: null, synced_at: '2026-11-20T11:00:00Z',
    });
  });
  it('skips people who are not in the attendance system', () => {
    expect(toAttendanceRow('u1', day({ matched: false }), 'now')).toBeNull();
  });
  it('keeps a day with leave but no clocking', () => {
    expect(toAttendanceRow('u1', day({ hours: null, firstIn: null, lastOut: null, leave: 'cuti' }), 'now'))
      .toMatchObject({ hours: null, first_in: null, leave_type: 'cuti' });
  });
  it('skips a day with neither clocking nor leave', () => {
    expect(toAttendanceRow('u1', day({ hours: null, firstIn: null, lastOut: null }), 'now')).toBeNull();
  });
});

describe('mapLimit', () => {
  it('runs every item, at most `limit` at a time, and keeps the order', async () => {
    let running = 0, peak = 0;
    const out = await mapLimit([1, 2, 3, 4, 5], 2, async n => {
      running++; peak = Math.max(peak, running);
      await new Promise(r => setTimeout(r, 5));
      running--;
      return n * 10;
    });
    expect(out).toEqual([10, 20, 30, 40, 50]);
    expect(peak).toBe(2);
  });
});

describe('divisionUpdates', () => {
  it('fills in a division only where none is set, so a division changed by hand is kept', async () => {
    const { divisionUpdates } = await import('./attendanceSync');
    expect(divisionUpdates(
      new Map([['u1', 'Automation'], ['u2', 'Process'], ['u3', null], ['u4', 'Workshop']]),
      new Map([['u1', 'Process'], ['u2', null], ['u3', 'Process']])))
      .toEqual([{ id: 'u2', division: 'Process' }, { id: 'u4', division: 'Workshop' }]);
  });
});
