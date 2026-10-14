import { describe, expect, it } from 'vitest';
import {
  addItem, createDay, currentItemId, dayTotal, formatClock, itemTotals, localDateStr, pause, resume, switchTo,
  type DayTimerState, type TimerItem,
} from './dayTimer';

const MIN = 60_000;
const T0 = new Date(2026, 9, 14, 8, 0).getTime(); // 08:00 local (Asia/Jakarta in tests)

export const item = (id: string, patch: Partial<TimerItem> = {}): TimerItem => ({
  id, category: 'project', project_id: `p-${id}`, custom_name: '', custom_code: '', description: '', label: `Item ${id}`, code: '', ...patch,
});

export function dayWith(...ids: string[]): DayTimerState {
  return ids.reduce((s, id) => addItem(s, item(id)), createDay('u1', T0));
}

describe('localDateStr', () => {
  it('uses local time, not UTC (00:30 WIB is still the local day)', () => {
    expect(localDateStr(new Date(2026, 9, 15, 0, 30).getTime())).toBe('2026-10-15');
    expect(localDateStr(Date.UTC(2026, 9, 14, 17, 30))).toBe('2026-10-15'); // 00:30 WIB
  });
});

describe('createDay', () => {
  it('starts paused with no items on the local date', () => {
    const s = createDay('u1', T0);
    expect(s).toMatchObject({ version: 1, userId: 'u1', date: '2026-10-14', items: [], segments: [], status: 'paused', lastSeen: T0, idleSince: null, pendingAway: null });
  });
});

describe('switchTo / pause / resume', () => {
  it('runs one item at a time and accumulates per item', () => {
    let s = dayWith('a', 'b');
    s = switchTo(s, 'a', T0);
    s = switchTo(s, 'b', T0 + 30 * MIN);
    s = switchTo(s, 'a', T0 + 45 * MIN);
    expect(currentItemId(s)).toBe('a');
    expect(s.status).toBe('running');
    expect(itemTotals(s, T0 + 60 * MIN)).toEqual({ a: 45 * MIN, b: 15 * MIN });
    expect(dayTotal(s, T0 + 60 * MIN)).toBe(60 * MIN);
  });
  it('switching to the running item or an unknown item changes nothing', () => {
    const s = switchTo(dayWith('a'), 'a', T0);
    expect(switchTo(s, 'a', T0 + MIN)).toBe(s);
    expect(switchTo(s, 'nope', T0 + MIN)).toBe(s);
  });
  it('pause stops the clock and resume continues the last item', () => {
    let s = switchTo(dayWith('a', 'b'), 'b', T0);
    s = pause(s, T0 + 20 * MIN);
    expect(s.status).toBe('paused');
    expect(currentItemId(s)).toBeNull();
    s = resume(s, T0 + 50 * MIN);
    expect(currentItemId(s)).toBe('b');
    expect(itemTotals(s, T0 + 60 * MIN).b).toBe(30 * MIN);
  });
  it('resume does nothing before anything was started', () => {
    const s = dayWith('a');
    expect(resume(s, T0)).toBe(s);
  });
  it('addItem does not start the item', () => {
    const s = addItem(createDay('u1', T0), item('a'));
    expect(currentItemId(s)).toBeNull();
    expect(itemTotals(s, T0 + MIN)).toEqual({ a: 0 });
  });
});

describe('formatClock', () => {
  it('formats h:mm:ss', () => {
    expect(formatClock(0)).toBe('0:00:00');
    expect(formatClock(3_725_000)).toBe('1:02:05');
    expect(formatClock(-5)).toBe('0:00:00');
  });
});
