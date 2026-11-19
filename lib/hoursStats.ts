import { CATEGORY_LABEL, isManualProject, logProjectCode, logProjectName, type WorkCategory, type WorkLog } from './worklog';

// Hours insights for the admin "Total jam kerja" panel. Leave days never count.

export type MonthTotal = { month: string; hours: number };
export type ProjectHours = { key: string; code: string; name: string; category: WorkCategory; manual: boolean; hours: number; share: number };
export type PersonHours = { userId: string; name: string; hours: number; days: number };
export type ProjectOption = { key: string; code: string; name: string };

const work = (logs: WorkLog[]) => logs.filter(l => !l.is_leave && (l.hours || 0) > 0);

// Listed projects by id, manual ones by name, Quotation/Training as one row each.
export function projectKeyOf(l: WorkLog) {
  const category = l.category || 'project';
  if (category !== 'project') return `c:${category}`;
  if (l.project_id) return `p:${l.project_id}`;
  return `m:${logProjectName(l).trim().toLowerCase()}`;
}

function describe(l: WorkLog) {
  const category = l.category || 'project';
  return category === 'project'
    ? { code: logProjectCode(l), name: logProjectName(l) || '—', category, manual: isManualProject(l) }
    : { code: '', name: CATEGORY_LABEL[category], category, manual: false };
}

export function monthTotals(logs: WorkLog[]): MonthTotal[] {
  const m = new Map<string, number>();
  for (const l of work(logs)) m.set(l.log_date.slice(0, 7), (m.get(l.log_date.slice(0, 7)) ?? 0) + (l.hours || 0));
  return [...m].sort(([a], [b]) => a.localeCompare(b)).map(([month, hours]) => ({ month, hours }));
}

// Projects ranked by hours; Quotation and Training always last.
export function projectHoursForMonth(logs: WorkLog[], month: string): ProjectHours[] {
  const m = new Map<string, ProjectHours>();
  let total = 0;
  for (const l of work(logs)) {
    if (!l.log_date.startsWith(month)) continue;
    const key = projectKeyOf(l);
    const row = m.get(key) ?? { key, ...describe(l), hours: 0, share: 0 };
    row.hours += l.hours || 0; total += l.hours || 0;
    m.set(key, row);
  }
  const rows = [...m.values()].map(r => ({ ...r, share: total ? r.hours / total : 0 }));
  const isProject = (r: ProjectHours) => r.category === 'project';
  return rows.sort((a, b) => Number(isProject(b)) - Number(isProject(a)) || b.hours - a.hours);
}

// People on one project: hours and distinct days, in one month or all time (month = null).
export function personHoursForProject(logs: WorkLog[], key: string, month: string | null): PersonHours[] {
  const m = new Map<string, { name: string; hours: number; days: Set<string> }>();
  for (const l of work(logs)) {
    if (projectKeyOf(l) !== key || (month && !l.log_date.startsWith(month))) continue;
    const p = m.get(l.user_id) ?? { name: l.profiles?.full_name || '—', hours: 0, days: new Set<string>() };
    p.hours += l.hours || 0; p.days.add(l.log_date);
    m.set(l.user_id, p);
  }
  return [...m].map(([userId, p]) => ({ userId, name: p.name, hours: p.hours, days: p.days.size }))
    .sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name));
}

export function projectOptions(logs: WorkLog[]): ProjectOption[] {
  const m = new Map<string, ProjectOption>();
  for (const l of work(logs)) {
    const key = projectKeyOf(l);
    if (!m.has(key)) { const d = describe(l); m.set(key, { key, code: d.code, name: d.name }); }
  }
  return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export type PersonShare = { userId: string; name: string; hours: number };

function sumByPerson(logs: WorkLog[], keep: (l: WorkLog) => boolean): PersonShare[] {
  const m = new Map<string, PersonShare>();
  for (const l of work(logs)) {
    if (!keep(l)) continue;
    const p = m.get(l.user_id) ?? { userId: l.user_id, name: l.profiles?.full_name || '—', hours: 0 };
    p.hours += l.hours || 0;
    m.set(l.user_id, p);
  }
  return [...m.values()].sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name));
}

export type PersonOption = { userId: string; name: string; hours: number };

// Everyone with work hours, by name (for the person picker).
export const personOptions = (logs: WorkLog[]): PersonOption[] =>
  sumByPerson(logs, () => true).sort((a, b) => a.name.localeCompare(b.name));

// `n` consecutive months ending at `last` ("YYYY-MM"), oldest first. Months without hours still count.
export function monthRange(last: string, n: number): string[] {
  const [y, m] = last.split('-').map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (n - 1 - i), 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}

// Whole percents that add up to exactly 100 (largest remainder).
export function roundPercents(values: number[]): number[] {
  const total = values.reduce((s, v) => s + v, 0);
  if (!total) return values.map(() => 0);
  const raw = values.map(v => (v / total) * 100);
  const out = raw.map(Math.floor);
  let left = 100 - out.reduce((s, v) => s + v, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) { if (left-- <= 0) break; out[i]++; }
  return out;
}

// Timeline series: by project (Quotation/Training are non-project), or by person.
export const projectSeries = (l: WorkLog) => {
  const d = describe(l);
  return { key: projectKeyOf(l), label: d.name, ...(d.code ? { code: d.code } : {}), non: d.category !== 'project' };
};
export const personSeries = (l: WorkLog) => ({ key: l.user_id, label: l.profiles?.full_name || '—' });
