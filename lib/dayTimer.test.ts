import { describe, expect, it } from 'vitest';
import {
  addItem, AWAY_THRESHOLD_MS, createDay, currentItemId, cutRange, dayTotal, detectAway, formatClock, itemTotals, localDateStr, markIdle,
  pause, resolveAway, resume, switchTo, tick,
  backToTimer, buildReviewRows, canOwn, clearState, closeStaleDay, draftToTimerItem, HEARTBEAT_MS, isStaleDay, loadState,
  readOwner, releaseOwner, reviewRowsToEntries, roundToHalfHour, saveState, startReview, storageKey, writeOwner,
  type DayTimerState, type TimerItem,
} from './dayTimer';
import { newEntryDraft } from './worklog';

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

class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}

describe('roundToHalfHour', () => {
  it('rounds to the nearest half hour at the 15/45 minute boundaries', () => {
    expect(roundToHalfHour(14 * MIN + 59_000)).toBe(0);
    expect(roundToHalfHour(15 * MIN)).toBe(0.5);
    expect(roundToHalfHour(44 * MIN + 59_000)).toBe(0.5);
    expect(roundToHalfHour(45 * MIN)).toBe(1);
    expect(roundToHalfHour(74 * MIN)).toBe(1);
    expect(roundToHalfHour(75 * MIN)).toBe(1.5);
  });
});

describe('review', () => {
  it('startReview closes the running segment; backToTimer returns paused', () => {
    let s = startReview(switchTo(dayWith('a'), 'a', T0), T0 + 30 * MIN);
    expect(s.status).toBe('review');
    expect(currentItemId(s)).toBeNull();
    expect(itemTotals(s, T0 + 90 * MIN).a).toBe(30 * MIN);
    s = backToTimer(s, T0 + 31 * MIN);
    expect(s.status).toBe('paused');
  });

  it('builds rows: existing entries first, then timer items with rounded hours', () => {
    let s = switchTo(dayWith('a', 'b'), 'a', T0);
    s = switchTo(s, 'b', T0 + 80 * MIN);
    s = startReview(s, T0 + 90 * MIN);
    const existing = [{ category: 'training' as const, project_id: null, custom_name: '', custom_code: '', description: 'K3', hours: 2, label: 'Training: K3', code: '' }];
    const rows = buildReviewRows(s, T0 + 90 * MIN, existing);
    expect(rows.map(r => [r.source, r.label, r.trackedMs, r.hours])).toEqual([
      ['existing', 'Training: K3', null, 2],
      ['timer', 'Item a', 80 * MIN, 1.5],
      ['timer', 'Item b', 10 * MIN, 0],
    ]);
  });

  it('reviewRowsToEntries drops zero-hour rows and strips display fields', () => {
    const s = startReview(switchTo(dayWith('a', 'b'), 'a', T0), T0 + 60 * MIN);
    const entries = reviewRowsToEntries(buildReviewRows(s, T0 + 60 * MIN, []));
    expect(entries).toEqual([{ category: 'project', project_id: 'p-a', custom_name: '', custom_code: '', description: '', hours: 1 }]);
  });
});

describe('stale day', () => {
  it('a day from an earlier local date is closed at its last heartbeat and opened in review', () => {
    let s = tick(switchTo(dayWith('a'), 'a', T0), T0 + 8 * 60 * MIN); // last heartbeat 16:00 (gap prompts, then resolve)
    s = resolveAway(s, { type: 'keep' });
    const nextMorning = new Date(2026, 9, 15, 7, 30).getTime();
    expect(isStaleDay(s, nextMorning)).toBe(true);
    s = closeStaleDay(s);
    expect(s.status).toBe('review');
    expect(itemTotals(s, nextMorning).a).toBe(8 * 60 * MIN);
  });
  it('a day without items is not stale (nothing to send)', () => {
    expect(isStaleDay(createDay('u1', T0), new Date(2026, 9, 15, 9, 0).getTime())).toBe(false);
  });
  it('today is not stale', () => {
    expect(isStaleDay(dayWith('a'), T0 + 60 * MIN)).toBe(false);
  });
});

describe('draftToTimerItem', () => {
  const project = { id: 'p1', name: 'Gedung', project_code: 'PRJ-1', description: '', is_active: true, inactive_from: null };
  it('captures the project name and code', () => {
    expect(draftToTimerItem({ ...newEntryDraft(), project_id: 'p1' }, project, 'i1')).toMatchObject({ id: 'i1', label: 'Gedung', code: 'PRJ-1', project_id: 'p1' });
  });
  it('labels manual projects and quotations', () => {
    expect(draftToTimerItem({ ...newEntryDraft(), custom_name: ' Survey ', custom_code: 'S1' }, undefined, 'i2')).toMatchObject({ label: 'Survey', code: 'S1', project_id: null });
    expect(draftToTimerItem({ ...newEntryDraft(), category: 'quotation', description: 'Pabrik' }, undefined, 'i3')).toMatchObject({ label: 'Quotation: Pabrik', code: '' });
  });
});

describe('storage', () => {
  it('round-trips the state per user', () => {
    const storage = new MemoryStorage();
    const s = switchTo(dayWith('a'), 'a', T0);
    expect(saveState(storage, s)).toBe(true);
    expect(loadState(storage, 'u1')).toEqual(s);
    expect(storage.data.has(storageKey('u1'))).toBe(true);
    clearState(storage, 'u1');
    expect(loadState(storage, 'u1')).toBeNull();
  });
  it('loadState rejects corrupt JSON, other versions and other users', () => {
    const storage = new MemoryStorage();
    storage.setItem(storageKey('u1'), '{not json');
    expect(loadState(storage, 'u1')).toBeNull();
    storage.setItem(storageKey('u1'), JSON.stringify({ ...dayWith('a'), version: 2 }));
    expect(loadState(storage, 'u1')).toBeNull();
    storage.setItem(storageKey('u1'), JSON.stringify({ ...dayWith('a'), userId: 'someone-else' }));
    expect(loadState(storage, 'u1')).toBeNull();
    storage.setItem(storageKey('u1'), JSON.stringify({ ...dayWith('a'), segments: 'x' }));
    expect(loadState(storage, 'u1')).toBeNull();
  });
  it('storage errors do not throw', () => {
    const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('full'); }, removeItem() { throw new Error('denied'); } };
    expect(loadState(broken, 'u1')).toBeNull();
    expect(saveState(broken, dayWith('a'))).toBe(false);
    expect(() => clearState(broken, 'u1')).not.toThrow();
  });
});

describe('tab ownership', () => {
  it('a tab owns the timer when nobody else holds a fresh lock', () => {
    expect(canOwn(null, 't1', T0)).toBe(true);
    expect(canOwn({ tabId: 't1', at: T0 }, 't1', T0 + 1)).toBe(true);
    expect(canOwn({ tabId: 't2', at: T0 }, 't1', T0 + HEARTBEAT_MS)).toBe(false);
    expect(canOwn({ tabId: 't2', at: T0 }, 't1', T0 + 2 * HEARTBEAT_MS + 1)).toBe(true);
  });
  it('releaseOwner only removes our own lock', () => {
    const storage = new MemoryStorage();
    writeOwner(storage, { tabId: 't2', at: T0 });
    releaseOwner(storage, 't1');
    expect(readOwner(storage)).toEqual({ tabId: 't2', at: T0 });
    releaseOwner(storage, 't2');
    expect(readOwner(storage)).toBeNull();
  });
});
