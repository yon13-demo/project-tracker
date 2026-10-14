import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildWorkLogInserts, draftToEntry, isDraftReady, isLeaveDate, mergeSameProject, newEntryDraft, saveDay, workLogToExistingEntry, type EntryInput } from './worklog';

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
      entry({ custom_name: 'X', hours: 1.5 }),
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
    expect(e).toEqual({ category: 'quotation', project_id: null, custom_name: '', custom_code: '', description: 'Pabrik', hours: 2, label: 'Quotation: Pabrik', code: '' });
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
  let inserts = 0;
  const client = {
    from: () => ({
      select: () => ({ eq: () => ({ eq: async () => { calls.push('select'); return { data: opts.existing ?? [], error: null }; } }) }),
      delete: () => ({ eq: () => ({ eq: async () => { calls.push('delete'); return { error: null }; } }) }),
      insert: async (rows: unknown[]) => {
        inserts += 1;
        calls.push(inserts === 1 ? `insert:${rows.length}` : `restore:${rows.length}`);
        return { error: inserts === 1 && opts.insertError ? { message: opts.insertError } : null };
      },
    }),
  };
  return { client: client as unknown as SupabaseClient, calls };
}

describe('saveDay (I8: never lose the day on a failed insert)', () => {
  it('snapshots, deletes and inserts', async () => {
    const { client, calls } = fakeClient({ existing: [{ id: 'a' }, { id: 'b' }] });
    expect(await saveDay(client, 'u', 'd', [entry({ project_id: 'p1' })], true)).toEqual({ error: null });
    expect(calls).toEqual(['select', 'delete', 'insert:1']);
  });
  it('puts the old rows back when the insert fails', async () => {
    const { client, calls } = fakeClient({ existing: [{ id: 'a' }], insertError: 'RLS' });
    expect(await saveDay(client, 'u', 'd', [entry({ project_id: 'p1' })], true)).toEqual({ error: 'RLS' });
    expect(calls).toEqual(['select', 'delete', 'insert:1', 'restore:1']);
  });
  it('an empty list just clears the day', async () => {
    const { client, calls } = fakeClient({ existing: [{ id: 'a' }] });
    await saveDay(client, 'u', 'd', [], true);
    expect(calls).toEqual(['select', 'delete']);
  });
});

describe('mergeSameProject (unique user/date/project constraint)', () => {
  it('sums hours and joins descriptions for the same linked project', () => {
    expect(mergeSameProject([
      entry({ project_id: 'p1', hours: 2, description: 'gambar' }),
      entry({ category: 'training', hours: 1 }),
      entry({ project_id: 'p1', hours: 1.5, description: 'rapat' }),
    ])).toEqual([
      entry({ project_id: 'p1', hours: 3.5, description: 'gambar; rapat' }),
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
