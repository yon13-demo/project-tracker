import { describe, expect, it } from 'vitest';
import { buildTape, collapseEmpty, elapsedWorkDays, niceScale, timelineMonths, workDays } from './tapeTimeline';
import type { WorkLog } from './worklog';

let n = 0;
const log = (patch: Partial<WorkLog>): WorkLog => ({
  id: String(n++), user_id: 'u1', log_date: '2026-10-05', project_id: 'p1', hours: 2, is_leave: false,
  category: 'project', profiles: { full_name: 'Andi' }, projects: { name: 'Gedung', project_code: 'P-1' }, ...patch,
} as WorkLog);

describe('workDays', () => {
  it('counts Monday to Friday in the month', () => {
    expect(workDays('2026-11')).toBe(21);
    expect(workDays('2026-10')).toBe(22);
  });
});

describe('elapsedWorkDays', () => {
  it('counts working days before today (hours are reported the morning after)', () => {
    // 19 Nov 2026 is a Thursday: 2-6, 9-13, 16-18 -> 13 days
    expect(elapsedWorkDays('2026-11', '2026-11-19')).toBe(13);
    expect(elapsedWorkDays('2026-11', '2026-11-02')).toBe(0);
  });
  it('is the whole month for past months and zero for future ones', () => {
    expect(elapsedWorkDays('2026-10', '2026-11-19')).toBe(22);
    expect(elapsedWorkDays('2026-12', '2026-11-19')).toBe(0);
  });
});

describe('timelineMonths', () => {
  it('runs without gaps from the first month with hours to the current month', () => {
    const logs = [log({ log_date: '2026-07-03' }), log({ log_date: '2026-10-01' })];
    expect(timelineMonths(logs, '2026-11-19')).toEqual(['2026-07', '2026-08', '2026-09', '2026-10', '2026-11']);
  });
  it('is empty without hours', () => {
    expect(timelineMonths([], '2026-11-19')).toEqual([]);
  });
});

describe('niceScale', () => {
  it('rounds the max up to a round number with a few ticks', () => {
    expect(niceScale(275.5)).toEqual({ max: 300, ticks: [0, 100, 200, 300] });
    expect(niceScale(1809.5)).toEqual({ max: 2000, ticks: [0, 500, 1000, 1500, 2000] });
    expect(niceScale(0)).toEqual({ max: 10, ticks: [0, 2.5, 5, 7.5, 10] });
    expect(niceScale(781.5)).toEqual({ max: 1000, ticks: [0, 250, 500, 750, 1000] });
  });
});

describe('buildTape', () => {
  const byProject = (l: WorkLog) => (l.category === 'project'
    ? { key: l.project_id!, label: l.projects!.name }
    : { key: 'cat', label: 'Training', non: true });
  const logs = [
    ...['a', 'b', 'c', 'd', 'e', 'f'].map((p, i) => log({ project_id: p, projects: { name: p.toUpperCase(), project_code: '' }, hours: 10 - i })),
    log({ project_id: 'a', projects: { name: 'A', project_code: '' }, hours: 4, log_date: '2026-11-03' }),
    log({ project_id: null, projects: null, category: 'training', hours: 3, log_date: '2026-11-04' }),
    log({ hours: 8, is_leave: true, project_id: null, projects: null, log_date: '2026-11-05' }),
  ];
  const months = ['2026-09', '2026-10', '2026-11'];
  const tape = buildTape(logs, months, byProject, '2026-11-19');

  it('picks the top 5 over all months for colours, the rest is Lainnya, non-project last', () => {
    expect(tape.series.map(s => [s.key, s.slot])).toEqual([['a', 0], ['b', 1], ['c', 2], ['d', 3], ['e', 4], ['__other', null], ['__non', null]]);
  });
  it('keeps the same segment order in every row', () => {
    expect(tape.rows[1].segments).toEqual([
      { key: 'a', hours: 10 }, { key: 'b', hours: 9 }, { key: 'c', hours: 8 }, { key: 'd', hours: 7 }, { key: 'e', hours: 6 }, { key: '__other', hours: 5, items: [{ key: 'f', label: 'F', hours: 5 }] },
    ]);
    expect(tape.rows[2].segments).toEqual([{ key: 'a', hours: 4 }, { key: '__non', hours: 3, items: [{ key: 'cat', label: 'Training', hours: 3 }] }]);
  });
  it('marks the running month with a projection, and compares it with the last month that has hours', () => {
    const nov = tape.rows[2];
    expect(nov).toMatchObject({ month: '2026-11', total: 7, running: true });
    expect(nov.projection).toBeCloseTo((7 / 13) * 21);
    expect(nov.delta).toBeCloseTo(((7 / 13) * 21 - 45) / 45);
    expect(tape.rows[1]).toMatchObject({ total: 45, running: false, projection: null, delta: null });
  });
  it('has no delta for the running month before any working day has passed', () => {
    const early = buildTape(logs, months, byProject, '2026-11-02');
    expect(early.rows[2].projection).toBeNull();
    expect(early.rows[2].delta).toBeNull();
  });
  it('has no Lainnya when there are 5 series or fewer', () => {
    const few = buildTape(logs.slice(0, 2), months, byProject, '2026-11-19');
    expect(few.series.map(s => s.key)).toEqual(['a', 'b']);
  });
});

describe('collapseEmpty', () => {
  it('folds runs of empty past months into one entry', () => {
    const row = (month: string, total: number, running = false) => ({ month, total, running, projection: null, delta: null, segments: [] });
    const out = collapseEmpty([row('2026-06', 0), row('2026-07', 0), row('2026-08', 5), row('2026-09', 0), row('2026-10', 0), row('2026-11', 0, true)]);
    expect(out.map(e => (e.kind === 'gap' ? `gap ${e.from}..${e.to}` : e.row.month))).toEqual(['gap 2026-06..2026-07', '2026-08', 'gap 2026-09..2026-10', '2026-11']);
  });
});
