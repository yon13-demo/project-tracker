import type { SupabaseClient } from '@supabase/supabase-js';

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

// Replaces every work-log row of the user on that date with `entries` (same as the form always did).
export async function saveDay(client: SupabaseClient, userId: string, date: string, entries: EntryInput[], hasV4Schema: boolean): Promise<{ error: string | null }> {
  const removed = await client.from('work_logs').delete().eq('user_id', userId).eq('log_date', date);
  if (removed.error) return { error: removed.error.message };
  if (!entries.length) return { error: null };
  const { error } = await client.from('work_logs').insert(buildWorkLogInserts(userId, date, entries, hasV4Schema));
  return { error: error?.message ?? null };
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
