'use client';

import { X } from 'lucide-react';
import type { EntryTaskDraft } from '@/lib/worklog';
import type { ProjectTask, TaskContext } from '@/lib/tasks';
import { ProgressSteps } from './ProgressSteps';
import { TaskPicker } from './TaskPicker';

const fmt = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');

// The tasks worked on in one project line: each with optional hours and a proposed progress step.
// None of it is required; hours given per task must fit in the line's hours.
export function EntryTasks({ t, ctx, projectId, lineHours, value, onChange }: {
  t: any; ctx: TaskContext; projectId: string; lineHours: string; value: EntryTaskDraft[];
  onChange: (tasks: EntryTaskDraft[]) => void;
}) {
  const byId = new Map(ctx.tasks.map(x => [x.id, x]));
  const parentPath = (task: ProjectTask) => {
    const names: string[] = [];
    for (let p = byId.get(task.parent_id ?? ''); p; p = byId.get(p.parent_id ?? '')) names.unshift(p.name);
    return names.join(' › ');
  };
  const set = (i: number, patch: Partial<EntryTaskDraft>) => onChange(value.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const split = value.filter(x => x.hours.trim() !== '').map(x => Number(x.hours));
  const splitTotal = split.reduce((a, b) => a + (isNaN(b) ? 0 : b), 0);
  const line = Number(lineHours) || 0;
  const over = splitTotal > line + 1e-9;

  return (
    <div className="entry-tasks">
      {value.map((item, i) => {
        const task = byId.get(item.task_id);
        if (!task) return null;
        return (
          <div key={item.task_id} className="entry-task">
            <div className="entry-task-head">
              <div className="entry-task-name">
                <span className="entry-task-title">{task.wbs} {task.name}{task.archived_at ? ` (${t.archived})` : ''}</span>
                <span className="entry-task-path">{parentPath(task)}</span>
              </div>
              <label className="entry-task-hours">
                <input type="number" min="0" step="0.5" inputMode="decimal" className="field-input" value={item.hours} placeholder="–"
                  aria-label={`${t.taskHours}: ${task.wbs} ${task.name}`} onChange={e => set(i, { hours: e.target.value })} />
                <span>{t.hoursUnit}</span>
              </label>
              <button type="button" className="btn-action icon" onClick={() => onChange(value.filter((_, j) => j !== i))}
                title={t.removeTask} aria-label={`${t.removeTask}: ${task.wbs} ${task.name}`}><X size={14} /></button>
            </div>
            <ProgressSteps t={t} approved={task.progress} value={item.progress}
              label={`${t.progress}: ${task.wbs} ${task.name}`} onChange={progress => set(i, { progress })} />
          </div>
        );
      })}
      <TaskPicker t={t} tasks={ctx.tasks} projectId={projectId} preferred={ctx.preferred} recentIds={ctx.recentIds}
        exclude={value.map(x => x.task_id)} emptyLabel={value.length ? t.addAnotherTask : t.addTaskToEntry}
        onPick={id => onChange([...value, { task_id: id, hours: '', progress: null }])} />
      {split.length > 0 && (
        <p className={`entry-tasks-sum${over ? ' over' : ''}`} aria-live="polite">
          {over
            ? t.taskHoursOver.replace('{sum}', fmt(splitTotal)).replace('{total}', fmt(line))
            : t.taskHoursSum.replace('{sum}', fmt(splitTotal)).replace('{total}', fmt(line)).replace('{rest}', fmt(Math.max(0, line - splitTotal)))}
        </p>
      )}
    </div>
  );
}
