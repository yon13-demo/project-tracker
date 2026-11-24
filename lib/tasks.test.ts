import { describe, expect, it } from 'vitest';
import {
  divisionToDiscipline, isLeafTask, nearestStep, projectProgress, proposalDiff, rollupProgress, taskOptions,
  type ProgressProposal, type ProjectTask,
} from './tasks';

const task = (id: string, patch: Partial<ProjectTask> = {}): ProjectTask => ({
  id, project_id: 'P', parent_id: null, discipline: 'electrical_automation', wbs: id, name: `Task ${id}`,
  doc_type: null, weight: null, sort_order: 0, progress: 0, archived_at: null, ...patch,
});

describe('nearestStep', () => {
  it('snaps any percentage to the nearest step of the ladder', () => {
    expect([0, 0.09, 0.11, 0.3, 0.36, 0.64, 0.66, 0.9, 0.95, 1].map(nearestStep)).toEqual([0, 0, 0.2, 0.2, 0.5, 0.5, 0.8, 0.8, 1, 1]);
  });
});

describe('rollupProgress', () => {
  it('averages children, using weights when set', () => {
    const tasks = [
      task('1'), // P&ID: 4 × 23.5% + 5%
      task('1.1', { parent_id: '1', weight: 23.5, progress: 1 }),
      task('1.2', { parent_id: '1', weight: 23.5, progress: 1 }),
      task('1.3', { parent_id: '1', weight: 23.5, progress: 0 }),
      task('1.4', { parent_id: '1', weight: 23.5, progress: 0 }),
      task('1.5', { parent_id: '1', weight: 5, progress: 1 }),
      task('2'),
      task('2.1', { parent_id: '2', progress: 0.5 }),
      task('2.2', { parent_id: '2', progress: 0.8 }),
    ];
    const p = rollupProgress(tasks);
    expect(p.get('1')).toBeCloseTo(52 / 99); // weights sum to 99 in the Excel; normalised, and not ROUNDUP'ed to 100%
    expect(p.get('2')).toBeCloseTo(0.65);
    expect(p.get('1.1')).toBe(1);
  });
  it('rolls up through three levels', () => {
    const p = rollupProgress([task('7'), task('7.5', { parent_id: '7' }), task('7.5.1', { parent_id: '7.5', progress: 1 }), task('7.5.2', { parent_id: '7.5', progress: 0 }), task('7.6', { parent_id: '7', progress: 1 })]);
    expect(p.get('7.5')).toBeCloseTo(0.5);
    expect(p.get('7')).toBeCloseTo(0.75);
  });
  it('ignores archived tasks; a parent whose children are all archived uses its own progress', () => {
    const p = rollupProgress([task('3', { progress: 0.2 }), task('3.1', { parent_id: '3', progress: 1, archived_at: '2026-11-01' }), task('4'), task('4.1', { parent_id: '4', progress: 1 }), task('4.2', { parent_id: '4', progress: 0, archived_at: 'x' })]);
    expect(p.get('3')).toBe(0.2);
    expect(p.get('4')).toBe(1);
    expect(Number.isNaN(p.get('3'))).toBe(false);
  });
});

describe('projectProgress', () => {
  it('averages deliverables per discipline, then disciplines equally', () => {
    const r = projectProgress([
      task('p1', { discipline: 'process', progress: 1 }),
      task('p2', { discipline: 'process', progress: 0 }),
      task('e1', { progress: 0.8, weight: 3 }),
      task('e2', { progress: 0, weight: 1 }),
      task('old', { discipline: 'mechanical', progress: 1, archived_at: 'x' }),
    ]);
    expect(r.disciplines.map(d => [d.discipline, d.progress])).toEqual([['process', 0.5], ['electrical_automation', 0.6000000000000001]]);
    expect(r.overall).toBeCloseTo(0.55);
  });
  it('is null when there are no tasks', () => {
    expect(projectProgress([])).toEqual({ overall: null, disciplines: [] });
  });
});

describe('isLeafTask', () => {
  it('is true for tasks without (non-archived) children', () => {
    const tasks = [task('1'), task('1.1', { parent_id: '1' }), task('2'), task('2.1', { parent_id: '2', archived_at: 'x' })];
    expect(['1', '1.1', '2'].map(id => isLeafTask(tasks, id))).toEqual([false, true, true]);
  });
});

describe('taskOptions', () => {
  const tasks = [
    task('m1', { discipline: 'mechanical', wbs: '1', name: 'Vessel Design' }),
    task('m1.1', { discipline: 'mechanical', parent_id: 'm1', wbs: '1.1', name: 'Sizing' }),
    task('e2', { wbs: '2', name: 'Wiring Diagram', sort_order: 2 }),
    task('e2.10', { parent_id: 'e2', wbs: '2.10', name: 'Review' }),
    task('e2.2', { parent_id: 'e2', wbs: '2.2', name: 'PLC' }),
    task('e1', { wbs: '1', name: 'Panel', sort_order: 1 }),
    task('e1.1', { parent_id: 'e1', wbs: '1.1', name: 'Placement', archived_at: 'x' }),
    task('e1.2', { parent_id: 'e1', wbs: '1.2', name: 'Final layout' }),
    task('other', { project_id: 'Q', wbs: '1', name: 'Elsewhere' }),
  ];
  it('lists leaf tasks of the project, own discipline first, in tree order with natural wbs order', () => {
    const r = taskOptions(tasks, 'P', { preferred: 'electrical_automation', recentIds: [] });
    expect(r.groups.map(g => g.discipline)).toEqual(['electrical_automation', 'mechanical']);
    expect(r.groups[0].options.map(o => o.task.id)).toEqual(['e1.2', 'e2.2', 'e2.10']);
    expect(r.groups[0].options[1].path).toBe('Wiring Diagram › 2.2 PLC');
  });
  it('keeps the discipline order fixed without a preference', () => {
    expect(taskOptions(tasks, 'P', { recentIds: [] }).groups.map(g => g.discipline)).toEqual(['mechanical', 'electrical_automation']);
  });
  it('puts recently used tasks first, and hides archived tasks unless already chosen', () => {
    const r = taskOptions(tasks, 'P', { recentIds: ['e2.10', 'e1.1', 'missing'] });
    expect(r.recent.map(o => o.task.id)).toEqual(['e2.10']);
    const kept = taskOptions(tasks, 'P', { recentIds: [], includeId: 'e1.1' });
    expect(kept.groups.flatMap(g => g.options.map(o => o.task.id))).toContain('e1.1');
  });
});

describe('divisionToDiscipline', () => {
  it('maps attendance departments to a preferred discipline', () => {
    expect(['Automation', ' process ', 'Workshop', 'Finance', null, ''].map(divisionToDiscipline))
      .toEqual(['electrical_automation', 'process', 'manufacturing', null, null, null]);
  });
});

describe('proposalDiff', () => {
  const pending = (id: string, task_id: string, to: number): ProgressProposal => ({
    id, task_id, user_id: 'u1', log_date: '2026-11-20', from_progress: 0, to_progress: to, note: null, status: 'pending',
    reviewed_at: null, review_note: null, created_at: '2026-11-20T03:00:00Z',
  });
  const approved = new Map([['t1', 0.2], ['t2', 0.5], ['t3', 0]]);
  it('proposes a changed step and updates an existing pending row instead of adding one', () => {
    const d = proposalDiff(
      [{ task_id: 't1', progress: 0.5, description: 'IO list' }, { task_id: 't2', progress: 0.8, description: '' }],
      [pending('x', 't2', 0.5)], approved);
    expect(d).toEqual({
      upsert: [{ task_id: 't1', to_progress: 0.5, note: 'IO list', id: null }, { task_id: 't2', to_progress: 0.8, note: null, id: 'x' }],
      remove: [],
    });
  });
  it('withdraws pending rows whose step was cleared, set back to the approved value, or whose entry is gone', () => {
    const d = proposalDiff(
      [{ task_id: 't1', progress: null, description: '' }, { task_id: 't2', progress: 0.5, description: '' }],
      [pending('a', 't1', 0.5), pending('b', 't2', 0.8), pending('c', 't3', 0.2)], approved);
    expect(d).toEqual({ upsert: [], remove: ['a', 'b', 'c'] });
  });
  it('leaves an unchanged pending row alone', () => {
    expect(proposalDiff([{ task_id: 't1', progress: 0.5, description: '' }], [pending('a', 't1', 0.5)], approved))
      .toEqual({ upsert: [], remove: [] });
  });
  it('ignores entries without a task', () => {
    expect(proposalDiff([{ task_id: null, progress: 0.5, description: '' }], [], approved)).toEqual({ upsert: [], remove: [] });
  });
});
