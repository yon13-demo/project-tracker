import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CATEGORY_LABEL, recentProjects, WORK_CATEGORIES, buildWorkLogInserts, draftToEntry, isDraftReady, groupLogsByProject, isLeaveDate, previousWorkday, mergeSameProject, newEntryDraft, normalizeLogs, saveDay, saveLeaveDay, workLogToExistingEntry, type EntryInput } from './worklog';

const entry = (patch: Partial<EntryInput>): EntryInput => ({
  category: 'project', project_id: null, custom_name: '', custom_code: '', description: '', hours: 1, ...patch,
});

describe('isDraftReady', () => {
  it('needs a project or manual name for project rows', () => {
    expect(isDraftReady({ ...newEntryDraft(), hours: '2' })).toBe(false);
    expect(isDraftReady({ ...newEntryDraft(), project_id: 'p1', hours: '2' })).toBe(true);
    expect(isDraftReady({ ...newEntryDraft(), custom_name: 'Survey', hours: '2' })).toBe(true);
    expect(isDraftReady({ ...newEntryDraft(), custom_name: '   ', hours: '2' })).toBe(false);
  });
  it('does not need a project for quotation and training', () => {
    expect(isDraftReady({ ...newEntryDraft(), category: 'quotation', hours: '1' })).toBe(true);
    expect(isDraftReady({ ...newEntryDraft(), category: 'training', hours: '1' })).toBe(true);
  });
  it('needs a description for Lainnya, since it says what the work was', () => {
    expect(isDraftReady({ ...newEntryDraft(), category: 'other', hours: '1' })).toBe(false);
    expect(isDraftReady({ ...newEntryDraft(), category: 'other', description: '  ', hours: '1' })).toBe(false);
    expect(isDraftReady({ ...newEntryDraft(), category: 'other', description: 'Belajar Revit', hours: '1' })).toBe(true);
  });
  it('offers Lainnya last, labelled in Bahasa', () => {
    expect(WORK_CATEGORIES[WORK_CATEGORIES.length - 1]).toBe('other');
    expect(CATEGORY_LABEL.other).toBe('Lainnya');
  });
  it('rejects missing, zero, negative and non-numeric hours', () => {
    for (const hours of ['', '0', '-1', 'abc']) {
      expect(isDraftReady({ ...newEntryDraft(), project_id: 'p1', hours })).toBe(false);
    }
  });
  it('can skip the hours check (timer items have no hours yet)', () => {
    expect(isDraftReady({ ...newEntryDraft(), project_id: 'p1' }, { requireHours: false })).toBe(true);
  });
});

describe('draftToEntry', () => {
  it('converts hours to a number and empty project id to null', () => {
    expect(draftToEntry({ ...newEntryDraft(), custom_name: 'X', hours: '1.5' })).toEqual(
      { ...entry({ custom_name: 'X', hours: 1.5 }), task_id: null },
    );
  });
});

describe('buildWorkLogInserts', () => {
  it('links an existing project', () => {
    expect(buildWorkLogInserts('u', '2026-10-14', [entry({ project_id: 'p1', hours: 4 })], true)).toEqual([
      { user_id: 'u', log_date: '2026-10-14', hours: 4, is_leave: false, category: 'project', description: null, project_id: 'p1' },
    ]);
  });
  it('stores a trimmed manual project and nulls an empty code', () => {
    const [row] = buildWorkLogInserts('u', 'd', [entry({ custom_name: '  Survey  ', custom_code: ' ' })], true);
    expect(row).toMatchObject({ project_id: null, custom_project_name: 'Survey', custom_project_code: null });
  });
  it('drops project fields for quotation and keeps the description', () => {
    const [row] = buildWorkLogInserts('u', 'd', [entry({ category: 'quotation', project_id: 'p1', custom_name: 'x', description: ' Pabrik ' })], true);
    expect(row).toEqual({ user_id: 'u', log_date: 'd', hours: 1, is_leave: false, category: 'quotation', description: 'Pabrik', project_id: null });
  });
  it('omits v4 columns before the migration', () => {
    const [row] = buildWorkLogInserts('u', 'd', [entry({ project_id: 'p1', description: 'note' })], false);
    expect(row).not.toHaveProperty('category');
    expect(row).not.toHaveProperty('description');
  });
});

describe('workLogToExistingEntry', () => {
  it('labels quotation rows with their description', () => {
    const e = workLogToExistingEntry({
      id: '1', user_id: 'u', log_date: 'd', project_id: null, hours: 2, is_leave: false, category: 'quotation', description: 'Pabrik',
    });
    expect(e).toEqual({ category: 'quotation', project_id: null, custom_name: '', custom_code: '', description: 'Pabrik', hours: 2, label: 'Quotation: Pabrik', code: '', task_id: null });
  });
  it('labels project rows with the project name and code', () => {
    const e = workLogToExistingEntry({
      id: '1', user_id: 'u', log_date: 'd', project_id: 'p1', hours: 4, is_leave: false, projects: { name: 'Gedung', project_code: 'PRJ-1' },
    });
    expect(e).toMatchObject({ category: 'project', project_id: 'p1', label: 'Gedung', code: 'PRJ-1', hours: 4 });
  });
});

function fakeClient(opts: { existing?: { id: string }[]; insertError?: string } = {}) {
  const calls: string[] = [];
  const inserted: unknown[][] = [];
  const client = {
    from: () => ({
      delete: () => ({ eq: () => ({ eq: () => ({ select: async () => { calls.push('delete'); return { data: opts.existing ?? [], error: null }; } }) }) }),
      insert: (rows: unknown[]) => {
        inserted.push(rows);
        const first = inserted.length === 1;
        calls.push(first ? `insert:${rows.length}` : `restore:${rows.length}`);
        const failed = first && Boolean(opts.insertError);
        const result = { data: failed ? null : rows.map((r, i) => ({ id: `n${i}`, ...(r as object) })), error: failed ? { message: opts.insertError } : null };
        return Object.assign(Promise.resolve(result), { select: async () => result });
      },
    }),
  };
  return { client: client as unknown as SupabaseClient, calls, inserted };
}

describe('saveDay (I8: never lose the day on a failed insert)', () => {
  it('deletes (keeping the old rows) and inserts in two calls, returning the saved rows', async () => {
    const { client, calls } = fakeClient({ existing: [{ id: 'a' }, { id: 'b' }] });
    const res = await saveDay(client, 'u', 'd', [entry({ project_id: 'p1' })], true);
    expect(res.error).toBeNull();
    expect(res.rows).toHaveLength(1);
    expect(calls).toEqual(['delete', 'insert:1']);
  });
  it('puts the old rows back when the insert fails', async () => {
    const { client, calls } = fakeClient({ existing: [{ id: 'a' }], insertError: 'RLS' });
    expect(await saveDay(client, 'u', 'd', [entry({ project_id: 'p1' })], true)).toEqual({ error: 'RLS', rows: [] });
    expect(calls).toEqual(['delete', 'insert:1', 'restore:1']);
  });
  it('an empty list just clears the day', async () => {
    const { client, calls } = fakeClient({ existing: [{ id: 'a' }] });
    expect(await saveDay(client, 'u', 'd', [], true)).toEqual({ error: null, rows: [] });
    expect(calls).toEqual(['delete']);
  });
});

describe('saveLeaveDay', () => {
  it('replaces the day with one leave row, with the note as description', async () => {
    const { client, calls, inserted } = fakeClient({ existing: [{ id: 'a' }] });
    expect((await saveLeaveDay(client, 'u', 'd', true, 'Sakit')).error).toBeNull();
    expect(calls).toEqual(['delete', 'insert:1']);
    expect(inserted[0]).toEqual([{ user_id: 'u', log_date: 'd', is_leave: true, description: 'Sakit' }]);
  });
  it('leaves out the description before the v4 schema', async () => {
    const { client, inserted } = fakeClient();
    await saveLeaveDay(client, 'u', 'd', false, 'Sakit');
    expect(inserted[0]).toEqual([{ user_id: 'u', log_date: 'd', is_leave: true }]);
  });
  it('restores the old rows when the insert fails', async () => {
    const { client, calls } = fakeClient({ existing: [{ id: 'a' }], insertError: 'RLS' });
    expect((await saveLeaveDay(client, 'u', 'd', true, '')).error).toBe('RLS');
    expect(calls).toEqual(['delete', 'insert:1', 'restore:1']);
  });
});

describe('normalizeLogs', () => {
  it('unwraps joined rows returned as arrays', () => {
    const [row] = normalizeLogs([{ id: '1', profiles: [{ full_name: 'A' }], projects: [{ name: 'P', project_code: 'C' }] }]);
    expect(row.profiles).toEqual({ full_name: 'A' });
    expect(row.projects).toEqual({ name: 'P', project_code: 'C' });
  });
  it('treats missing data as empty', () => {
    expect(normalizeLogs(null)).toEqual([]);
  });
});

describe('mergeSameProject (unique user/date/project constraint)', () => {
  it('sums hours and joins descriptions for the same linked project', () => {
    expect(mergeSameProject([
      entry({ project_id: 'p1', hours: 2, description: 'gambar' }),
      entry({ category: 'training', hours: 1 }),
      entry({ project_id: 'p1', hours: 1.5, description: 'rapat' }),
    ])).toEqual([
      entry({ project_id: 'p1', hours: 3.5, description: 'gambar\nrapat' }),
      entry({ category: 'training', hours: 1 }),
    ]);
  });
});

describe('isLeaveDate (I7)', () => {
  it('finds a leave row for the date', () => {
    const base = { id: '1', user_id: 'u', project_id: null, hours: null };
    expect(isLeaveDate([{ ...base, log_date: 'd1', is_leave: true }], 'd1')).toBe(true);
    expect(isLeaveDate([{ ...base, log_date: 'd1', is_leave: true }], 'd2')).toBe(false);
    expect(isLeaveDate([{ ...base, log_date: 'd1', is_leave: false }], 'd1')).toBe(false);
  });
});

describe('groupLogsByProject (Per proyek view)', () => {
  const log = (patch: Record<string, unknown>) => ({ id: String(Math.random()), user_id: 'u', log_date: '2026-10-14', project_id: null, hours: 1, is_leave: false, ...patch }) as any;
  const gedung = { project_id: 'p1', projects: { name: 'Gedung', project_code: 'PRJ-1' } };

  it('groups by project, newest work first, with days newest first and totals', () => {
    const groups = groupLogsByProject([
      log({ ...gedung, log_date: '2026-10-10', hours: 4 }),
      log({ category: 'quotation', description: 'Pabrik', log_date: '2026-10-12', hours: 2 }),
      log({ ...gedung, log_date: '2026-10-13', hours: 3, description: 'review' }),
      log({ is_leave: true, log_date: '2026-10-11', hours: null }),
    ]);
    expect(groups.map(g => [g.label, g.code, g.totalHours, g.days.map(d => [d.date, d.hours])])).toEqual([
      ['Gedung', 'PRJ-1', 7, [['2026-10-13', 3], ['2026-10-10', 4]]],
      ['Quotation: Pabrik', '', 2, [['2026-10-12', 2]]],
    ]);
    expect(groups[0].days[0].description).toBe('review');
  });

  it('keeps manual projects and different trainings apart', () => {
    const groups = groupLogsByProject([
      log({ custom_project_name: 'Survey', hours: 1 }),
      log({ category: 'training', description: 'K3', hours: 1 }),
      log({ category: 'training', description: 'Excel', hours: 2 }),
    ]);
    expect(groups.map(g => g.label).sort()).toEqual(['Survey', 'Training: Excel', 'Training: K3']);
  });
});

describe('multi-line descriptions in the per-project view', () => {
  it('joins two descriptions of the same project-day on separate lines', () => {
    const log = (patch: Record<string, unknown>) => ({ id: String(Math.random()), user_id: 'u', log_date: '2026-10-14', project_id: 'p1', hours: 1, is_leave: false, projects: { name: 'G', project_code: 'P' }, ...patch }) as any;
    const [g] = groupLogsByProject([log({ description: 'pagi' }), log({ description: 'sore' })]);
    expect(g.days[0].description).toBe('pagi\nsore');
  });
});

describe('per-project groups carry the screenshot key of their entry', () => {
  it('uses the same key as the work-log form', () => {
    const log = (patch: Record<string, unknown>) => ({ id: String(Math.random()), user_id: 'u', log_date: '2026-10-14', project_id: null, hours: 1, is_leave: false, ...patch }) as any;
    const groups = groupLogsByProject([log({ custom_project_name: 'Survey Lokasi' }), log({ category: 'quotation', description: 'Pabrik' })]);
    expect(groups.map(g => g.shotKey).sort()).toEqual(['m-survey-lokasi', 'q-pabrik']);
  });
});

describe('previousWorkday', () => {
  it('is yesterday on Tuesday to Friday', () => {
    expect(previousWorkday('2026-11-20')).toBe('2026-11-19');
    expect(previousWorkday('2026-11-17')).toBe('2026-11-16');
  });
  it('skips the weekend back to Friday', () => {
    expect(previousWorkday('2026-11-23')).toBe('2026-11-20'); // Monday
    expect(previousWorkday('2026-11-22')).toBe('2026-11-20'); // Sunday
    expect(previousWorkday('2026-11-21')).toBe('2026-11-20'); // Saturday
  });
  it('crosses month and year boundaries', () => {
    expect(previousWorkday('2026-12-01')).toBe('2026-11-30');
    expect(previousWorkday('2027-01-01')).toBe('2026-12-31');
  });
});

describe('recentProjects', () => {
  const proj = (id: string, active = true) => ({ id, project_code: `C-${id}`, name: `Proj ${id}`, description: '', is_active: active, inactive_from: null });
  const projects = [proj('p1'), proj('p2'), proj('p3'), proj('old', false)];
  const log = (log_date: string, patch: Record<string, unknown>) => ({ id: String(Math.random()), user_id: 'u', log_date, project_id: null, hours: 1, is_leave: false, ...patch }) as any;

  it('lists projects by the latest day they were logged, each once', () => {
    const logs = [
      log('2026-11-10', { project_id: 'p1' }),
      log('2026-11-18', { project_id: 'p2' }),
      log('2026-11-12', { project_id: 'p3' }),
      log('2026-11-19', { project_id: 'p1' }),
    ];
    expect(recentProjects(logs, projects).map(r => r.project_id)).toEqual(['p1', 'p2', 'p3']);
  });
  it('includes manual projects, merged by name, and uses the registered name and code', () => {
    const logs = [
      log('2026-11-19', { custom_project_name: 'Survey Lokasi', custom_project_code: 'SV-1' }),
      log('2026-11-15', { custom_project_name: 'survey lokasi ' }),
      log('2026-11-18', { project_id: 'p2' }),
    ];
    expect(recentProjects(logs, projects)).toEqual([
      { project_id: '', name: 'Survey Lokasi', code: 'SV-1' },
      { project_id: 'p2', name: 'Proj p2', code: 'C-p2' },
    ]);
  });
  it('skips leave days, other categories and projects no longer on the list', () => {
    const logs = [
      log('2026-11-19', { is_leave: true }),
      log('2026-11-19', { category: 'quotation', description: 'x' }),
      log('2026-11-18', { project_id: 'old' }),
      log('2026-11-17', { project_id: 'gone' }),
      log('2026-11-16', { project_id: 'p3' }),
    ];
    expect(recentProjects(logs, projects.filter(p => p.is_active)).map(r => r.project_id)).toEqual(['p3']);
  });
  it('stops at the limit', () => {
    const logs = ['p1', 'p2', 'p3'].map((id, i) => log(`2026-11-1${i}`, { project_id: id }));
    expect(recentProjects(logs, projects, 2).map(r => r.project_id)).toEqual(['p3', 'p2']);
  });
});

describe('project tasks on entries', () => {
  const entry = (patch: Partial<EntryInput>): EntryInput => ({ category: 'project', project_id: 'p1', custom_name: '', custom_code: '', description: '', hours: 1, ...patch });
  it('keeps two tasks of one project apart but merges the same task', () => {
    const merged = mergeSameProject([
      entry({ task_id: 't1', hours: 3, description: 'a' }), entry({ task_id: 't2', hours: 4 }),
      entry({ task_id: 't1', hours: 1, description: 'b' }), entry({ hours: 2 }), entry({ task_id: null, hours: 1 }),
    ]);
    expect(merged.map(e => [e.task_id ?? null, e.hours, e.description])).toEqual([['t1', 4, 'a\nb'], ['t2', 4, ''], [null, 3, '']]);
  });
  it('sends task_id only when the database has the column, and only for registered projects', () => {
    const rows = [entry({ task_id: 't1' }), entry({ project_id: null, custom_name: 'X', task_id: 't9' }), entry({ category: 'training', project_id: null, task_id: 't9', description: 'x' })];
    expect(buildWorkLogInserts('u', '2026-11-20', rows, true, true).map(r => (r as any).task_id)).toEqual(['t1', undefined, undefined]);
    expect(buildWorkLogInserts('u', '2026-11-20', rows, true).every(r => !('task_id' in r))).toBe(true);
  });
  it('carries the task and proposed progress from a draft', () => {
    const d = { ...newEntryDraft(), project_id: 'p1', query: 'x', task_id: 't1', progress: 0.5, hours: '2' };
    expect(draftToEntry(d)).toMatchObject({ project_id: 'p1', task_id: 't1', hours: 2 });
    expect(newEntryDraft()).toMatchObject({ task_id: '', progress: null });
  });
});
