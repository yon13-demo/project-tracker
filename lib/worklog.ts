import type { SupabaseClient } from '@supabase/supabase-js';
import { entryKey } from './screenshots';

export type WorkCategory = 'project' | 'quotation' | 'training';
export const WORK_CATEGORIES: WorkCategory[] = ['project', 'quotation', 'training'];
export const CATEGORY_LABEL: Record<WorkCategory, string> = { project: 'Project', quotation: 'Quotation', training: 'Training' };

export type Project = { id: string; project_code: string; name: string; company?: string; description: string; is_active: boolean; inactive_from: string | null };
export type WorkLog = {
  id: string; user_id: string; log_date: string;
  project_id: string | null; hours: number | null; is_leave: boolean;
  custom_project_name?: string | null; custom_project_code?: string | null;
  category?: WorkCategory; description?: string | null;
  profiles?: { full_name: string };
  projects?: { name: string; project_code: string } | null;
};

export function logProjectName(w: WorkLog) { return w.projects?.name || w.custom_project_name || ''; }
export function isManualProject(w: WorkLog) { return (w.category || 'project') === 'project' && !w.project_id; }
export function logProjectCode(w: WorkLog) { return w.projects?.project_code || w.custom_project_code || ''; }

export type EntryDraft = { tempId: string; category: WorkCategory; description: string; project_id: string; custom_name: string; custom_code: string; query: string; hours: string };

export function newEntryDraft(): EntryDraft {
  return { tempId: crypto.randomUUID(), category: 'project', description: '', project_id: '', custom_name: '', custom_code: '', query: '', hours: '' };
}

export type EntryInput = {
  category: WorkCategory; project_id: string | null; custom_name: string; custom_code: string; description: string; hours: number;
};

export function isDraftReady(d: EntryDraft, opts: { requireHours?: boolean } = {}): boolean {
  const hasTarget = d.category !== 'project' || Boolean(d.project_id) || Boolean(d.custom_name.trim());
  if (!hasTarget) return false;
  if (opts.requireHours === false) return true;
  const hours = Number(d.hours);
  return d.hours !== '' && !isNaN(hours) && hours > 0;
}

export function draftToEntry(d: EntryDraft): EntryInput {
  return {
    category: d.category, project_id: d.project_id || null, custom_name: d.custom_name,
    custom_code: d.custom_code, description: d.description, hours: Number(d.hours),
  };
}

export function buildWorkLogInserts(userId: string, date: string, entries: EntryInput[], hasV4Schema: boolean) {
  return entries.map(e => ({
    user_id: userId, log_date: date, hours: e.hours, is_leave: false,
    ...(hasV4Schema ? { category: e.category, description: e.description.trim() || null } : {}),
    ...(e.category !== 'project'
      ? { project_id: null }
      : e.project_id
        ? { project_id: e.project_id }
        : { project_id: null, custom_project_name: e.custom_name.trim(), custom_project_code: e.custom_code.trim() || null }),
  }));
}

// work_logs is unique per (user, date, project): one row per linked project per day.
export function mergeSameProject(entries: EntryInput[]): EntryInput[] {
  const merged: EntryInput[] = [];
  for (const e of entries) {
    const same = e.category === 'project' && e.project_id
      ? merged.find(m => m.category === 'project' && m.project_id === e.project_id)
      : undefined;
    if (!same) { merged.push({ ...e }); continue; }
    same.hours += e.hours;
    same.description = [same.description.trim(), e.description.trim()].filter(Boolean).join('\n');
  }
  return merged;
}

// Columns the app reads for a work log, with the joined user name and project.
export const LOG_COLUMNS = 'id,user_id,log_date,project_id,hours,is_leave,profiles(full_name),projects(name,project_code)';
export const LOG_COLUMNS_V4 = `${LOG_COLUMNS},custom_project_name,custom_project_code,category,description`;

// PostgREST can return a joined row as a one-item array; the UI expects an object.
export function normalizeLogs(rows: unknown[] | null | undefined): WorkLog[] {
  return (rows ?? []).map((r: any) => ({
    ...r,
    profiles: Array.isArray(r.profiles) ? r.profiles[0] : r.profiles,
    projects: Array.isArray(r.projects) ? r.projects[0] : r.projects,
  })) as WorkLog[];
}

export type SaveResult = { error: string | null; rows: WorkLog[] };

// Replaces every work-log row of the user on that date with `rows`, in two calls:
// the delete returns the old rows, and if the insert then fails they are put back, so a failed save never empties the day.
// On success the saved rows come back with their joins, so the caller can update its list without reloading everything.
async function replaceDay(client: SupabaseClient, userId: string, date: string, rows: Record<string, unknown>[], hasV4Schema: boolean): Promise<SaveResult> {
  const removed = await client.from('work_logs').delete().eq('user_id', userId).eq('log_date', date).select('*');
  if (removed.error) return { error: removed.error.message, rows: [] };
  if (!rows.length) return { error: null, rows: [] };
  const inserted = await client.from('work_logs').insert(rows).select(hasV4Schema ? LOG_COLUMNS_V4 : LOG_COLUMNS);
  if (!inserted.error) return { error: null, rows: normalizeLogs(inserted.data) };
  const previous = (removed.data ?? []).map(({ profiles: _p, projects: _j, ...row }: Record<string, unknown>) => row);
  if (previous.length) await client.from('work_logs').insert(previous);
  return { error: inserted.error.message, rows: [] };
}

export function saveDay(client: SupabaseClient, userId: string, date: string, entries: EntryInput[], hasV4Schema: boolean): Promise<SaveResult> {
  return replaceDay(client, userId, date, buildWorkLogInserts(userId, date, mergeSameProject(entries), hasV4Schema), hasV4Schema);
}

// A leave day is one row without hours; `note` (e.g. "Sakit" from attendance) is kept as its description.
export function saveLeaveDay(client: SupabaseClient, userId: string, date: string, hasV4Schema: boolean, note: string): Promise<SaveResult> {
  const row = { user_id: userId, log_date: date, is_leave: true, ...(hasV4Schema && note ? { description: note } : {}) };
  return replaceDay(client, userId, date, [row], hasV4Schema);
}

export function isLeaveDate(logs: WorkLog[], date: string): boolean {
  return logs.some(w => w.log_date === date && w.is_leave);
}

export type ExistingEntry = EntryInput & { label: string; code: string };

export function workLogToExistingEntry(w: WorkLog): ExistingEntry {
  const category = w.category || 'project';
  const description = w.description || '';
  const label = category === 'project'
    ? logProjectName(w)
    : description ? `${CATEGORY_LABEL[category]}: ${description}` : CATEGORY_LABEL[category];
  return {
    category, project_id: w.project_id, custom_name: w.custom_project_name || '', custom_code: w.custom_project_code || '',
    description, hours: w.hours || 0, label, code: logProjectCode(w),
  };
}

export type ProjectDay = { date: string; hours: number; description: string };
export type ProjectGroup = { key: string; shotKey: string; label: string; code: string; category: WorkCategory; totalHours: number; days: ProjectDay[] };

// "Per proyek" view: one group per project / quotation / training, the days spent on it newest first.
export function groupLogsByProject(logs: WorkLog[]): ProjectGroup[] {
  const groups = new Map<string, ProjectGroup>();
  for (const w of logs) {
    if (w.is_leave) continue;
    const e = workLogToExistingEntry(w);
    const key = e.category === 'project'
      ? e.project_id ?? `manual:${e.custom_name.toLowerCase()}`
      : `${e.category}:${e.description.toLowerCase()}`;
    const group = groups.get(key) ?? { key, shotKey: entryKey(e), label: e.label, code: e.code, category: e.category, totalHours: 0, days: [] };
    const day = group.days.find(d => d.date === w.log_date);
    if (day) {
      day.hours += e.hours;
      if (e.description && e.category === 'project') day.description = [day.description, e.description].filter(Boolean).join('\n');
    } else {
      group.days.push({ date: w.log_date, hours: e.hours, description: e.category === 'project' ? e.description : '' });
    }
    group.totalHours += e.hours;
    groups.set(key, group);
  }
  const list = [...groups.values()];
  for (const g of list) g.days.sort((a, b) => b.date.localeCompare(a.date));
  return list.sort((a, b) => b.days[0].date.localeCompare(a.days[0].date));
}

// The last working day before `today` (YYYY-MM-DD): yesterday, or Friday when today is Sat–Mon.
export function previousWorkday(today: string): string {
  const d = new Date(`${today}T00:00:00Z`);
  do d.setUTCDate(d.getUTCDate() - 1); while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
  return d.toISOString().slice(0, 10);
}
