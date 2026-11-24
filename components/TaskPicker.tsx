'use client';

import { DISCIPLINE_LABEL, taskOptions, type Discipline, type ProjectTask } from '@/lib/tasks';

// Picks a task of a project. A native select: one tap on a phone, type-to-search on desktop,
// grouped by discipline (the person's own first) with recently used tasks on top.
// Used as an "add a task" control: it always shows `emptyLabel` and calls onPick with the chosen id.
export function TaskPicker({ t, tasks, projectId, preferred, recentIds, exclude, emptyLabel, onPick }: {
  t: any; tasks: ProjectTask[]; projectId: string; preferred: Discipline | null; recentIds: string[];
  exclude: string[]; emptyLabel: string; onPick: (taskId: string) => void;
}) {
  const { recent, groups } = taskOptions(tasks, projectId, { preferred, recentIds });
  const skip = new Set(exclude);
  const recentLeft = recent.filter(o => !skip.has(o.task.id));
  const groupsLeft = groups.map(g => ({ ...g, options: g.options.filter(o => !skip.has(o.task.id)) })).filter(g => g.options.length);
  if (!recentLeft.length && !groupsLeft.length) return null;
  return (
    <select className="field-input task-picker" value="" aria-label={emptyLabel} onChange={e => { if (e.target.value) onPick(e.target.value); }}>
      <option value="">{emptyLabel}</option>
      {recentLeft.length > 0 && (
        <optgroup label={t.recentTasks}>
          {recentLeft.map(o => <option key={`r-${o.task.id}`} value={o.task.id}>{o.path}</option>)}
        </optgroup>
      )}
      {groupsLeft.map(g => (
        <optgroup key={g.discipline} label={DISCIPLINE_LABEL[g.discipline]}>
          {g.options.map(o => <option key={o.task.id} value={o.task.id}>{o.path}{o.task.doc_type ? ` · ${o.task.doc_type}` : ''}</option>)}
        </optgroup>
      ))}
    </select>
  );
}
