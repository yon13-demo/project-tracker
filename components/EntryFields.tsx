'use client';

import type { ReactNode } from 'react';
import { Clock } from 'lucide-react';
import { CATEGORY_LABEL, WORK_CATEGORIES, type EntryDraft, type Project, type RecentProject, type WorkCategory } from '@/lib/worklog';
import type { TaskContext } from '@/lib/tasks';
import { ProjectCombobox } from './ProjectCombobox';
import { EntryTasks } from './EntryTasks';
import { imagesFrom } from './ScreenshotStrip';

// Fields for one work entry. The work-log form shows hours; timer items do not.
// Grow a textarea with its content (min 2 lines).
function autoGrow(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight + 2}px`;
}

export function EntryFields({ t, entry, projects, recent, hasV4Schema, showHours = true, onChange: change, onPasteFiles, extra, taskCtx }: {
  t: any; entry: EntryDraft; projects: Project[]; recent?: RecentProject[]; hasV4Schema: boolean; showHours?: boolean;
  onChange: (patch: Partial<EntryDraft>) => void;
  taskCtx?: TaskContext; // project tasks (schema v7 + v8); without it no tasks are offered
  onPasteFiles?: (files: File[]) => void; // e.g. Win+Shift+S then Ctrl+V anywhere in the row
  extra?: ReactNode;
}) {
  // Tasks belong to one project: changing the project or category clears them.
  const onChange = (patch: Partial<EntryDraft>) => {
    const moved = (patch.project_id !== undefined && patch.project_id !== entry.project_id) || (patch.category !== undefined && patch.category !== entry.category);
    change(moved ? { ...patch, tasks: [] } : patch);
  };
  const showTasks = Boolean(taskCtx && entry.category === 'project' && entry.project_id
    && (entry.tasks.length > 0 || taskCtx.tasks.some(x => x.project_id === entry.project_id && !x.archived_at)));
  return (
    <div className="entry-row-fields" onPaste={onPasteFiles ? e => {
      const files = imagesFrom(e.clipboardData.files);
      if (files.length) { e.preventDefault(); onPasteFiles(files); }
    } : undefined}>
      {hasV4Schema && (
        <div className="entry-field">
          <label>{t.kategori}</label>
          <select className="field-input" value={entry.category}
            onChange={e => onChange({ category: e.target.value as WorkCategory, project_id: '', custom_name: '', custom_code: '', query: '' })}>
            {WORK_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </select>
        </div>
      )}
      {entry.category === 'project' && (
        <div className="entry-field">
          <label>{t.namaProyek} / {t.nomorProyek}</label>
          <ProjectCombobox t={t} entry={entry} projects={projects} recent={recent} allowManual={hasV4Schema} onChange={onChange} />
        </div>
      )}
      {showTasks && taskCtx && (
        <div className="entry-field">
          <label>{t.tasksWorked} <span className="label-optional">({t.optional})</span></label>
          <EntryTasks t={t} ctx={taskCtx} projectId={entry.project_id} lineHours={entry.hours} value={entry.tasks}
            onChange={tasks => change({ tasks })} />
        </div>
      )}
      {hasV4Schema && (
        <div className="entry-field">
          <label>{t.deskripsi}{entry.tasks.length ? <span className="label-optional"> ({t.optional})</span> : null}</label>
          <textarea className="field-input entry-description" rows={2} value={entry.description} ref={autoGrow}
            placeholder={entry.category === 'quotation' ? t.descQuotation : entry.category === 'training' ? t.descTraining : entry.category === 'other' ? t.descOther : ''}
            onChange={e => { autoGrow(e.target); onChange({ description: e.target.value }); }} />
        </div>
      )}
      {extra}
      {showHours && (
        <div className="entry-field entry-field-hours">
          <label>{t.inputHours}</label>
          <div className="hours-input-wrap">
            <Clock size={14} className="hours-icon" />
            <input type="number" min="0.5" max="24" step="0.5" className="field-input hours-input"
              value={entry.hours} onChange={e => onChange({ hours: e.target.value })} placeholder="0" />
            <span className="hours-unit">jam</span>
          </div>
        </div>
      )}
    </div>
  );
}
