'use client';

import { DISCIPLINE_LABEL, taskOptions, type Discipline, type ProjectTask } from '@/lib/tasks';

// Task of a project entry. A native select: one tap on a phone, searchable by typing on desktop,
// grouped by discipline (the person's own first) with recently used tasks on top.
export function TaskPicker({ t, tasks, projectId, value, preferred, recentIds, onChange }: {
  t: any; tasks: ProjectTask[]; projectId: string; value: string; preferred: Discipline | null; recentIds: string[];
  onChange: (taskId: string) => void;
}) {
  const { recent, groups } = taskOptions(tasks, projectId, { preferred, recentIds, includeId: value || undefined });
  return (
    <select className="field-input task-picker" value={value} onChange={e => onChange(e.target.value)} aria-label={t.task}>
      <option value="">{t.noTask}</option>
      {recent.length > 0 && (
        <optgroup label={t.recentTasks}>
          {recent.map(o => <option key={`r-${o.task.id}`} value={o.task.id}>{o.path}</option>)}
        </optgroup>
      )}
      {groups.map(g => (
        <optgroup key={g.discipline} label={DISCIPLINE_LABEL[g.discipline]}>
          {g.options.map(o => (
            <option key={o.task.id} value={o.task.id}>
              {o.path}{o.task.doc_type ? ` · ${o.task.doc_type}` : ''}{o.task.archived_at ? ` (${t.archived})` : ''}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
