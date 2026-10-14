import { describe, expect, it } from 'vitest';
import { buildWorkLogInserts, draftToEntry, isDraftReady, newEntryDraft, workLogToExistingEntry, type EntryInput } from './worklog';

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
