import { describe, expect, it } from 'vitest';
import { peopleInMonth, splitByPerson, colorSlots, topProjectsByMonth, monthTotals, personHoursForProject, projectHoursForMonth, projectKeyOf, projectOptions, personOptions, personMonths } from './hoursStats';
import type { WorkLog } from './worklog';

let n = 0;
const log = (patch: Partial<WorkLog>): WorkLog => ({
  id: String(n++), user_id: 'u1', log_date: '2026-10-05', project_id: 'p1', hours: 2, is_leave: false,
  category: 'project', profiles: { full_name: 'Andi' }, projects: { name: 'Gedung', project_code: 'P-1' }, ...patch,
} as WorkLog);

const logs: WorkLog[] = [
  log({ hours: 4 }),
  log({ hours: 3, user_id: 'u2', profiles: { full_name: 'Budi' } }),
  log({ hours: 2, log_date: '2026-10-06' }),
  log({ hours: 5, project_id: 'p2', projects: { name: 'Jembatan', project_code: 'P-2' } }),
  log({ hours: 1, project_id: null, projects: null, custom_project_name: 'Survey Lokasi', custom_project_code: 'X-9' }),
  log({ hours: 2, project_id: null, projects: null, category: 'quotation' }),
  log({ hours: 8, is_leave: true, project_id: null, projects: null }),
  log({ hours: 6, log_date: '2026-11-02' }),
  log({ hours: 7, log_date: '2026-11-03', user_id: 'u2', profiles: { full_name: 'Budi' } }),
];

describe('projectKeyOf', () => {
  it('keys listed projects by id, manual ones by name, others by category', () => {
    expect(projectKeyOf(logs[0])).toBe('p:p1');
    expect(projectKeyOf(logs[4])).toBe('m:survey lokasi');
    expect(projectKeyOf(logs[5])).toBe('c:quotation');
  });
});

describe('monthTotals', () => {
  it('sums work hours per month, oldest first, without leave', () => {
    expect(monthTotals(logs)).toEqual([{ month: '2026-10', hours: 17 }, { month: '2026-11', hours: 13 }]);
  });
});

describe('projectHoursForMonth', () => {
  const rows = projectHoursForMonth(logs, '2026-10');
  it('ranks projects by hours with their share of the month', () => {
    expect(rows.map(r => [r.key, r.hours])).toEqual([['p:p1', 9], ['p:p2', 5], ['m:survey lokasi', 1], ['c:quotation', 2]]);
    expect(rows[0]).toMatchObject({ code: 'P-1', name: 'Gedung', manual: false, category: 'project' });
    expect(rows[0].share).toBeCloseTo(9 / 17);
  });
  it('labels manual and non-project rows', () => {
    expect(rows[2]).toMatchObject({ code: 'X-9', name: 'Survey Lokasi', manual: true });
    expect(rows[3]).toMatchObject({ category: 'quotation', name: 'Quotation' });
  });
  it('is empty for a month without hours', () => {
    expect(projectHoursForMonth(logs, '2026-09')).toEqual([]);
  });
});

describe('personHoursForProject', () => {
  it('adds hours and distinct days per person for one month', () => {
    expect(personHoursForProject(logs, 'p:p1', '2026-10')).toEqual([
      { userId: 'u1', name: 'Andi', hours: 6, days: 2 },
      { userId: 'u2', name: 'Budi', hours: 3, days: 1 },
    ]);
  });
  it('covers all time when no month is given', () => {
    expect(personHoursForProject(logs, 'p:p1', null)).toEqual([
      { userId: 'u1', name: 'Andi', hours: 12, days: 3 },
      { userId: 'u2', name: 'Budi', hours: 10, days: 2 },
    ]);
  });
});

describe('projectOptions', () => {
  it('lists every project that has hours, by name', () => {
    expect(projectOptions(logs).map(o => o.key)).toEqual(['p:p1', 'p:p2', 'c:quotation', 'm:survey lokasi']);
  });
});

describe('topProjectsByMonth', () => {
  it('keeps the top projects of each month, oldest month first, without Quotation/Training', () => {
    const r = topProjectsByMonth(logs, 2);
    expect(r.map(m => m.month)).toEqual(['2026-10', '2026-11']);
    expect(r[0].top.map(p => [p.key, p.hours])).toEqual([['p:p1', 9], ['p:p2', 5]]);
    expect(r[1].top.map(p => [p.key, p.hours])).toEqual([['p:p1', 13]]);
  });
  it('shows only the latest months when asked', () => {
    expect(topProjectsByMonth(logs, 3, 1).map(m => m.month)).toEqual(['2026-11']);
  });
});

describe('colorSlots', () => {
  it('gives each project one slot, the busiest project first, the rest none', () => {
    const r = topProjectsByMonth(logs, 2);
    expect(colorSlots(r, 1)).toEqual(new Map([['p:p1', 0]]));
    expect(colorSlots(r, 8)).toEqual(new Map([['p:p1', 0], ['p:p2', 1]]));
  });
});

describe('people in a month', () => {
  it('ranks people by their hours in the month', () => {
    expect(peopleInMonth(logs, '2026-10').map(p => [p.userId, p.hours])).toEqual([['u1', 14], ['u2', 3]]);
  });
  it('splits one or more projects by person, busiest first', () => {
    expect(splitByPerson(logs, '2026-10', ['p:p1'])).toEqual([
      { userId: 'u1', name: 'Andi', hours: 6 },
      { userId: 'u2', name: 'Budi', hours: 3 },
    ]);
    expect(splitByPerson(logs, '2026-10', ['p:p2', 'c:quotation'])).toEqual([{ userId: 'u1', name: 'Andi', hours: 7 }]);
  });
});

describe('personOptions', () => {
  it('lists everyone with work hours, by name, with their total', () => {
    expect(personOptions(logs)).toEqual([
      { userId: 'u1', name: 'Andi', hours: 20 },
      { userId: 'u2', name: 'Budi', hours: 10 },
    ]);
  });
});

describe('personMonths', () => {
  it('gives one entry per recent month, with the person projects busiest first', () => {
    const m = personMonths(logs, 'u1', 6);
    expect(m.map(x => [x.month, x.total])).toEqual([['2026-10', 14], ['2026-11', 6]]);
    expect(m[0].top.map(p => [p.key, p.hours])).toEqual([['p:p1', 6], ['p:p2', 5], ['c:quotation', 2], ['m:survey lokasi', 1]]);
    expect(m[0].top[0].share).toBeCloseTo(6 / 14);
  });
  it('keeps months the person did not work, so columns line up', () => {
    expect(personMonths(logs, 'u2', 6)).toEqual([
      { month: '2026-10', total: 3, top: [expect.objectContaining({ key: 'p:p1', hours: 3, share: 1 })] },
      { month: '2026-11', total: 7, top: [expect.objectContaining({ key: 'p:p1', hours: 7, share: 1 })] },
    ]);
    expect(personMonths(logs, 'nobody', 6).every(m => m.total === 0 && m.top.length === 0)).toBe(true);
  });
  it('only covers the latest months', () => {
    expect(personMonths(logs, 'u1', 1).map(m => m.month)).toEqual(['2026-11']);
  });
});
