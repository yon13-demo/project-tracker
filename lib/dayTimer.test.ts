import { describe, expect, it } from 'vitest';
import {
  addItem, AWAY_THRESHOLD_MS, createDay, currentItemId, cutRange, dayTotal, detectAway, formatClock, itemTotals, localDateStr, markIdle,
  pause, resolveAway, resume, switchTo, tick,
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

describe('away detection', () => {
  const running = () => switchTo(dayWith('a', 'b'), 'a', T0);

  it('sleep gap: a heartbeat after a long gap creates a prompt from the last heartbeat', () => {
    const s = tick(running(), T0 + 40 * MIN);
    expect(s.pendingAway).toEqual({ start: T0, end: T0 + 40 * MIN, itemId: 'a' });
  });

  it('short gaps just count', () => {
    const s = tick(running(), T0 + 9 * MIN);
    expect(s.pendingAway).toBeNull();
    expect(s.lastSeen).toBe(T0 + 9 * MIN);
  });

  it('idle then sleep: one prompt from the moment the user went idle', () => {
    let s = tick(running(), T0 + 5 * MIN);          // heartbeat at 08:05
    s = markIdle(s, T0 + 6 * MIN);                  // idle/locked at 08:06
    s = tick(s, T0 + 8 * 60 * MIN);                 // PC slept, wakes at 16:00 while still idle
    expect(s.pendingAway).toBeNull();               // wait until the user is back
    s = detectAway(s, T0 + 8 * 60 * MIN + MIN);     // user active at 16:01
    expect(s.pendingAway).toEqual({ start: T0 + 6 * MIN, end: T0 + 8 * 60 * MIN + MIN, itemId: 'a' });
    expect(s.idleSince).toBeNull();
  });

  it('idle shorter than the threshold does not prompt', () => {
    let s = markIdle(running(), T0 + MIN);
    s = detectAway(s, T0 + MIN + AWAY_THRESHOLD_MS - 1);
    expect(s.pendingAway).toBeNull();
    expect(s.idleSince).toBeNull();
  });

  it('paused days never prompt', () => {
    const s = tick(pause(running(), T0 + MIN), T0 + 5 * 60 * MIN);
    expect(s.pendingAway).toBeNull();
  });

  it('the gap never starts before the running segment', () => {
    let s = switchTo(running(), 'b', T0 + 30 * MIN);
    s = { ...s, idleSince: T0 }; // stale idle mark from before the switch
    s = detectAway(s, T0 + 60 * MIN);
    expect(s.pendingAway?.start).toBe(T0 + 30 * MIN);
  });

  it('switching and pausing are blocked while a prompt is open', () => {
    const s = tick(running(), T0 + 40 * MIN);
    expect(switchTo(s, 'b', T0 + 41 * MIN)).toBe(s);
    expect(pause(s, T0 + 41 * MIN)).toBe(s);
  });
});

describe('cutRange', () => {
  it('splits an open segment around the cut and keeps it open', () => {
    expect(cutRange([{ itemId: 'a', start: 0, end: null }], 10, 20)).toEqual([
      { itemId: 'a', start: 0, end: 10 },
      { itemId: 'a', start: 20, end: null },
    ]);
  });
  it('removes segments fully inside the cut and trims overlaps', () => {
    expect(cutRange([
      { itemId: 'a', start: 0, end: 12 },
      { itemId: 'b', start: 12, end: 15 },
      { itemId: 'a', start: 15, end: 30 },
    ], 10, 20)).toEqual([
      { itemId: 'a', start: 0, end: 10 },
      { itemId: 'a', start: 20, end: 30 },
    ]);
  });
});

describe('resolveAway', () => {
  const prompted = () => tick(switchTo(dayWith('a', 'b'), 'a', T0), T0 + 40 * MIN); // away 08:00–08:40
  const at = T0 + 60 * MIN;

  it('keep: the away time stays on the item', () => {
    const s = resolveAway(prompted(), { type: 'keep' });
    expect(s.pendingAway).toBeNull();
    expect(itemTotals(s, at)).toEqual({ a: 60 * MIN, b: 0 });
  });
  it('discard: the away time is removed and the item keeps running', () => {
    const s = resolveAway(prompted(), { type: 'discard' });
    expect(currentItemId(s)).toBe('a');
    expect(itemTotals(s, at)).toEqual({ a: 20 * MIN, b: 0 });
  });
  it('move: the away time goes to the chosen item', () => {
    const s = resolveAway(prompted(), { type: 'move', itemId: 'b' });
    expect(currentItemId(s)).toBe('a');
    expect(itemTotals(s, at)).toEqual({ a: 20 * MIN, b: 40 * MIN });
  });
  it('move to an unknown item changes nothing', () => {
    const s = prompted();
    expect(resolveAway(s, { type: 'move', itemId: 'nope' })).toBe(s);
  });
});
