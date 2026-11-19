import { monthRange, monthTotals } from './hoursStats';
import type { WorkLog } from './worklog';

// Tape timeline: one tape per month on a shared hours scale. Tape length = the month's hours,
// segments = what the hours went to. Leave days never count.

const TOP = 5;
export const OTHER = '__other';
export const NON = '__non';

const pad = (n: number) => String(n).padStart(2, '0');
const daysIn = (month: string) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).getUTCDate();
const isWeekday = (month: string, day: number) => {
  const d = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)) - 1, day)).getUTCDay();
  return d !== 0 && d !== 6;
};

// Monday to Friday. Weave has no holiday calendar, so projections built on this are approximate (≈).
export function workDays(month: string): number {
  let n = 0;
  for (let d = 1; d <= daysIn(month); d++) if (isWeekday(month, d)) n++;
  return n;
}

// Working days of `month` before `today` (YYYY-MM-DD): hours are reported the morning after.
export function elapsedWorkDays(month: string, today: string): number {
  const current = today.slice(0, 7);
  if (month < current) return workDays(month);
  if (month > current) return 0;
  let n = 0;
  for (let d = 1; d < Number(today.slice(8, 10)); d++) if (isWeekday(month, d)) n++;
  return n;
}

// Every month from the first with hours to the current one, without gaps.
export function timelineMonths(logs: WorkLog[], today: string): string[] {
  const totals = monthTotals(logs);
  if (!totals.length) return [];
  const first = totals[0].month;
  const last = [totals[totals.length - 1].month, today.slice(0, 7)].sort().pop()!;
  const span = (Number(last.slice(0, 4)) - Number(first.slice(0, 4))) * 12 + Number(last.slice(5)) - Number(first.slice(5)) + 1;
  return monthRange(last, span);
}

// Axis max rounded up to 1/2/3/5 × 10^k, with 3-5 evenly spaced ticks.
export function niceScale(value: number): { max: number; ticks: number[] } {
  const v = Math.max(value, 10);
  const pow = 10 ** Math.floor(Math.log10(v));
  const lead = [1, 2, 3, 5, 10].find(s => s * pow >= v - 1e-9)!;
  const max = lead * pow;
  const parts = { 1: 4, 2: 4, 3: 3, 5: 5, 10: 4 }[lead]!;
  const step = max / parts;
  return { max, ticks: Array.from({ length: parts + 1 }, (_, i) => Math.round(i * step * 100) / 100) };
}

export type SeriesOf = (l: WorkLog) => { key: string; label: string; code?: string; non?: boolean };
export type TapeSeries = { key: string; label: string; code?: string; slot: number | null };
export type TapeItem = { key: string; label: string; code?: string; hours: number };
export type TapeSegment = { key: string; hours: number; items?: TapeItem[] };
export type TapeRow = {
  month: string; total: number; running: boolean;
  projection: number | null; // running month only: hours ÷ elapsed working days × working days
  delta: number | null; // vs the previous month with hours (projection for the running month)
  segments: TapeSegment[];
};

export function buildTape(logs: WorkLog[], months: string[], seriesOf: SeriesOf, today: string, top = TOP) {
  const inRange = new Set(months);
  const info = new Map<string, { label: string; code?: string; non: boolean; total: number }>();
  const cells = new Map<string, Map<string, number>>(months.map(m => [m, new Map()]));
  for (const l of logs) {
    const month = l.log_date.slice(0, 7);
    const h = l.hours || 0;
    if (l.is_leave || h <= 0 || !inRange.has(month)) continue;
    const s = seriesOf(l);
    const i = info.get(s.key) ?? { label: s.label, code: s.code, non: !!s.non, total: 0 };
    i.total += h;
    info.set(s.key, i);
    const c = cells.get(month)!;
    c.set(s.key, (c.get(s.key) ?? 0) + h);
  }
  const ranked = [...info].filter(([, i]) => !i.non).sort((a, b) => b[1].total - a[1].total);
  const named = ranked.slice(0, top).map(([k]) => k);
  const namedSet = new Set(named);
  const hasOther = ranked.length > top;
  const hasNon = [...info.values()].some(i => i.non);
  const series: TapeSeries[] = [
    ...named.map((key, slot) => ({ key, label: info.get(key)!.label, code: info.get(key)!.code, slot })),
    ...(hasOther ? [{ key: OTHER, label: '', slot: null }] : []),
    ...(hasNon ? [{ key: NON, label: '', slot: null }] : []),
  ];

  const current = today.slice(0, 7);
  let prev: number | null = null;
  const rows: TapeRow[] = months.map(month => {
    const c = cells.get(month)!;
    const items = (pick: (k: string) => boolean): TapeItem[] => [...c].filter(([k]) => pick(k))
      .map(([key, hours]) => ({ key, label: info.get(key)!.label, ...(info.get(key)!.code ? { code: info.get(key)!.code } : {}), hours }))
      .sort((a, b) => b.hours - a.hours);
    const segments: TapeSegment[] = named.filter(k => c.has(k)).map(key => ({ key, hours: c.get(key)! }));
    const other = items(k => !namedSet.has(k) && !info.get(k)!.non);
    const non = items(k => info.get(k)!.non);
    const sum = (xs: TapeItem[]) => xs.reduce((s, x) => s + x.hours, 0);
    if (other.length) segments.push({ key: OTHER, hours: sum(other), items: other });
    if (non.length) segments.push({ key: NON, hours: sum(non), items: non });
    const total = segments.reduce((s, g) => s + g.hours, 0);
    const running = month === current;
    const elapsed = running ? elapsedWorkDays(month, today) : 0;
    const projection = running && elapsed > 0 ? (total / elapsed) * workDays(month) : null;
    const value = running ? projection : total;
    const delta = value != null && prev ? (value - prev) / prev : null;
    if (!running && total > 0) prev = total;
    return { month, total, running, projection, delta, segments };
  });
  return { series, rows };
}

export type TapeEntry = { kind: 'row'; row: TapeRow } | { kind: 'gap'; from: string; to: string };

// Runs of empty past months fold into one short "no hours" entry. The running month always shows.
export function collapseEmpty(rows: TapeRow[]): TapeEntry[] {
  const out: TapeEntry[] = [];
  for (const row of rows) {
    const last = out[out.length - 1];
    if (row.total === 0 && !row.running) {
      if (last?.kind === 'gap') last.to = row.month;
      else out.push({ kind: 'gap', from: row.month, to: row.month });
    } else out.push({ kind: 'row', row });
  }
  return out;
}
