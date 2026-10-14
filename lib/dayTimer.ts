// Pure day-timer logic. Durations are always derived from timestamps, so closing
// the app, sleeping or crashing never loses time. No React, no browser globals.
import type { WorkCategory } from './worklog';

export type TimerItem = {
  id: string;
  category: WorkCategory;
  project_id: string | null;
  custom_name: string;
  custom_code: string;
  description: string;
  label: string; // display name captured when the item was added
  code: string;  // project code captured when the item was added ('' if none)
};

export type TimerSegment = { itemId: string; start: number; end: number | null };
export type PendingAway = { start: number; end: number; itemId: string };

export type DayTimerState = {
  version: 1;
  userId: string;
  date: string; // local YYYY-MM-DD of "Mulai hari"
  items: TimerItem[];
  segments: TimerSegment[]; // at most one open segment (end === null)
  status: 'running' | 'paused' | 'review';
  lastSeen: number;
  idleSince: number | null;
  pendingAway: PendingAway | null;
};

export const AWAY_THRESHOLD_MS = 10 * 60_000;
export const HEARTBEAT_MS = 30_000;
export const IDLE_DETECTOR_THRESHOLD_MS = 60_000;

export function localDateStr(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function createDay(userId: string, now: number): DayTimerState {
  return {
    version: 1, userId, date: localDateStr(now), items: [], segments: [],
    status: 'paused', lastSeen: now, idleSince: null, pendingAway: null,
  };
}

export function currentItemId(state: DayTimerState): string | null {
  return state.segments.find(s => s.end === null)?.itemId ?? null;
}

function closeOpen(segments: TimerSegment[], at: number): TimerSegment[] {
  return segments.map(s => (s.end === null ? { ...s, end: Math.max(at, s.start) } : s));
}

export function addItem(state: DayTimerState, item: TimerItem): DayTimerState {
  if (state.status === 'review') return state;
  return { ...state, items: [...state.items, item] };
}

export function switchTo(state: DayTimerState, itemId: string, now: number): DayTimerState {
  if (state.pendingAway || state.status === 'review') return state;
  if (!state.items.some(i => i.id === itemId) || currentItemId(state) === itemId) return state;
  return {
    ...state,
    segments: [...closeOpen(state.segments, now), { itemId, start: now, end: null }],
    status: 'running', lastSeen: now, idleSince: null,
  };
}

export function pause(state: DayTimerState, now: number): DayTimerState {
  if (state.status !== 'running' || state.pendingAway) return state;
  return { ...state, segments: closeOpen(state.segments, now), status: 'paused', lastSeen: now, idleSince: null };
}

export function resume(state: DayTimerState, now: number): DayTimerState {
  if (state.status !== 'paused') return state;
  const last = state.segments[state.segments.length - 1];
  if (!last) return state;
  return { ...state, segments: [...state.segments, { itemId: last.itemId, start: now, end: null }], status: 'running', lastSeen: now };
}

export function itemTotals(state: DayTimerState, now: number): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const item of state.items) totals[item.id] = 0;
  for (const s of state.segments) totals[s.itemId] = (totals[s.itemId] ?? 0) + Math.max(0, (s.end ?? now) - s.start);
  return totals;
}

export function dayTotal(state: DayTimerState, now: number): number {
  return Object.values(itemTotals(state, now)).reduce((a, b) => a + b, 0);
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function markIdle(state: DayTimerState, since: number): DayTimerState {
  if (state.status !== 'running' || state.idleSince !== null) return state;
  return { ...state, idleSince: since };
}

// Call when the user is active again and when the app loads.
export function detectAway(state: DayTimerState, now: number): DayTimerState {
  if (state.status !== 'running' || state.pendingAway) return { ...state, idleSince: null, lastSeen: now };
  const open = state.segments.find(s => s.end === null);
  // Heartbeats pause while the user is idle, so an idle mark wins over a stale lastSeen.
  const gapStart = state.idleSince ?? (now - state.lastSeen >= AWAY_THRESHOLD_MS ? state.lastSeen : null);
  if (open && gapStart !== null) {
    const start = Math.max(gapStart, open.start);
    if (now - start >= AWAY_THRESHOLD_MS) {
      return { ...state, pendingAway: { start, end: now, itemId: open.itemId }, idleSince: null, lastSeen: now };
    }
  }
  return { ...state, idleSince: null, lastSeen: now };
}

// Call on every heartbeat. While the user is idle we wait for them to come back before asking.
export function tick(state: DayTimerState, now: number): DayTimerState {
  if (state.idleSince !== null) return state;
  return detectAway(state, now);
}

export function cutRange(segments: TimerSegment[], start: number, end: number): TimerSegment[] {
  const out: TimerSegment[] = [];
  for (const s of segments) {
    const sEnd = s.end ?? Infinity;
    if (sEnd <= start || s.start >= end) { out.push(s); continue; }
    if (s.start < start) out.push({ ...s, end: start });
    if (sEnd > end) out.push({ ...s, start: end });
  }
  return out;
}

export type AwayChoice = { type: 'keep' } | { type: 'discard' } | { type: 'move'; itemId: string };

export function resolveAway(state: DayTimerState, choice: AwayChoice): DayTimerState {
  const away = state.pendingAway;
  if (!away) return state;
  if (choice.type === 'move' && !state.items.some(i => i.id === choice.itemId)) return state;
  let segments = state.segments;
  if (choice.type !== 'keep') segments = cutRange(segments, away.start, away.end);
  if (choice.type === 'move') {
    segments = [...segments, { itemId: choice.itemId, start: away.start, end: away.end }].sort((a, b) => a.start - b.start);
  }
  return { ...state, segments, pendingAway: null };
}
