import { describe, expect, it } from 'vitest';
import { codeMatches, manualProjectGroups, planManualMerge, type MergeRow } from './manualMerge';

const proj = (id: string, project_code: string, name = `Proj ${id}`, is_active = true) => ({ id, project_code, name, description: '', is_active, inactive_from: null });
const projects = [proj('a', '2260301', 'LOreal USA_Florence 2x20T(CaPEX)'), proj('b', '2260504', 'Paragon_Mixing Skid 10T'), proj('c', 'P1')];

describe('codeMatches', () => {
  it('finds a registered project whose number is in the typed text', () => {
    expect(codeMatches('2260301_LOreal Canada Montreal 2x20T', projects).map(p => p.id)).toEqual(['a']);
    expect(codeMatches('kerja 2260504 paragon', projects).map(p => p.id)).toEqual(['b']);
  });
  it('needs the whole number, not part of a longer one', () => {
    expect(codeMatches('22603011 something', projects)).toEqual([]);
    expect(codeMatches('122603 01', projects)).toEqual([]);
  });
  it('ignores very short codes that would match by accident', () => {
    expect(codeMatches('P1 survey', projects)).toEqual([]);
  });
});

describe('manualProjectGroups', () => {
  const log = (patch: Record<string, unknown>) => ({ id: String(Math.random()), user_id: 'u1', log_date: '2026-11-16', project_id: null, hours: 2, is_leave: false, ...patch }) as any;
  it('groups manual entries by name, counts them and suggests a project by number', () => {
    const groups = manualProjectGroups([
      log({ custom_project_name: '2260301_LOreal Canada Montreal 2x20T', hours: 7 }),
      log({ custom_project_name: '2260301_loreal canada montreal 2x20T ', user_id: 'u2', log_date: '2026-11-18', hours: 1 }),
      log({ custom_project_name: 'Information Technology', hours: 3 }),
      log({ project_id: 'a', hours: 5 }),
      log({ category: 'quotation', description: 'x' }),
    ], projects);
    expect(groups).toEqual([
      { name: '2260301_LOreal Canada Montreal 2x20T', rows: 2, hours: 8, people: 2, last: '2026-11-18', suggestedId: 'a' },
      { name: 'Information Technology', rows: 1, hours: 3, people: 1, last: '2026-11-16', suggestedId: '' },
    ]);
  });
});

describe('planManualMerge', () => {
  const row = (patch: Partial<MergeRow>): MergeRow => ({ id: 'm1', user_id: 'u1', log_date: '2026-11-16', project_id: null, hours: 7, description: '', custom_project_name: 'X', ...patch });
  it('relinks a manual entry when the person has no entry for the project that day', () => {
    expect(planManualMerge([row({})], [], 'a')).toEqual({ relink: ['m1'], add: [], remove: [] });
  });
  it('adds the hours to an existing entry for the same project and day instead of duplicating it', () => {
    const plan = planManualMerge(
      [row({ description: 'commissioning' })],
      [row({ id: 'l1', project_id: 'a', hours: 2, description: 'design' })],
      'a');
    expect(plan).toEqual({ relink: [], add: [{ id: 'l1', hours: 9, description: 'design\ncommissioning' }], remove: ['m1'] });
  });
  it('merges two manual entries of one day into a single entry', () => {
    const plan = planManualMerge([row({ id: 'm1', hours: 1 }), row({ id: 'm2', hours: 2, description: 'b' })], [], 'a');
    expect(plan).toEqual({ relink: ['m1'], add: [{ id: 'm1', hours: 3, description: 'b' }], remove: ['m2'] });
  });
});
