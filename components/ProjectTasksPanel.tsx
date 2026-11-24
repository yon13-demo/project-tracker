'use client';

import { useMemo, useState } from 'react';
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { Project } from '@/lib/worklog';
import {
  DISCIPLINE_LABEL, ENGINEERING_DISCIPLINES, PROGRESS_STEPS, flattenTree, projectProgress, rollupProgress, sortTasks,
  type Discipline, type ProjectTask,
} from '@/lib/tasks';

const pct = (v: number | null | undefined) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const MAX_DEPTH = 3; // deliverable (0) → task → sub-task → sub-sub-task (3), like "7.5.1"

export type TaskDraft = Partial<ProjectTask> & { project_id: string; discipline: Discipline; name: string };

type Editing = { id: string | null; parent: ProjectTask | null; discipline: Discipline; wbs: string; name: string; doc_type: string; weight: string };

// Admin: one project's task list — add, edit, reorder, archive, and set approved progress directly.
export function ProjectTasksPanel({ t, project, tasks, pendingByTask, loggedTaskIds, onSave, onReorder, onDelete, onSetProgress, onClose }: {
  t: any; project: Project; tasks: ProjectTask[]; pendingByTask: Map<string, number>; loggedTaskIds: Set<string>;
  onSave: (task: TaskDraft) => Promise<boolean>;
  onReorder: (rows: { id: string; sort_order: number }[]) => Promise<void>;
  onDelete: (task: ProjectTask) => Promise<void>;
  onSetProgress: (task: ProjectTask, progress: number) => Promise<void>;
  onClose: () => void;
}) {
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [busy, setBusy] = useState(false);
  const own = useMemo(() => tasks.filter(x => x.project_id === project.id), [tasks, project.id]);
  const rolled = useMemo(() => rollupProgress(own), [own]);
  const summary = useMemo(() => projectProgress(own), [own]);
  const disciplines = [...ENGINEERING_DISCIPLINES, ...summary.disciplines.map(d => d.discipline).filter(d => !ENGINEERING_DISCIPLINES.includes(d))];
  const rows = flattenTree(own, { includeArchived: showArchived });
  const hasChildren = (id: string) => own.some(x => x.parent_id === id && !x.archived_at);
  const archivedCount = own.filter(x => x.archived_at).length;

  const run = async (fn: () => Promise<unknown>) => { setBusy(true); try { await fn(); } finally { setBusy(false); } };

  function startAdd(discipline: Discipline, parent: ProjectTask | null) {
    const siblings = own.filter(x => x.parent_id === (parent?.id ?? null) && x.discipline === discipline && !x.archived_at);
    const wbs = parent ? `${parent.wbs}.${siblings.length + 1}` : String(own.filter(x => !x.parent_id && x.discipline === discipline).length + 1);
    setEditing({ id: null, parent, discipline, wbs, name: '', doc_type: '', weight: '' });
  }
  function startEdit(task: ProjectTask) {
    setEditing({ id: task.id, parent: own.find(x => x.id === task.parent_id) ?? null, discipline: task.discipline, wbs: task.wbs, name: task.name, doc_type: task.doc_type ?? '', weight: task.weight == null ? '' : String(task.weight) });
  }
  async function save() {
    if (!editing || !editing.name.trim()) return;
    const weight = editing.weight.trim() ? Number(editing.weight) : null;
    if (weight !== null && !(weight > 0)) return;
    const siblings = own.filter(x => x.parent_id === (editing.parent?.id ?? null) && x.discipline === editing.discipline);
    const draft: TaskDraft = {
      ...(editing.id ? { id: editing.id } : { parent_id: editing.parent?.id ?? null, sort_order: siblings.length ? Math.max(...siblings.map(s => s.sort_order)) + 1 : 0 }),
      project_id: project.id, discipline: editing.discipline, wbs: editing.wbs.trim(), name: editing.name.trim(),
      doc_type: editing.doc_type.trim() || null, weight,
    };
    await run(async () => { if (await onSave(draft)) setEditing(null); });
  }
  function move(task: ProjectTask, dir: -1 | 1) {
    const siblings = sortTasks(own.filter(x => x.parent_id === task.parent_id && x.discipline === task.discipline));
    const i = siblings.findIndex(s => s.id === task.id);
    const j = i + dir;
    if (j < 0 || j >= siblings.length) return;
    [siblings[i], siblings[j]] = [siblings[j], siblings[i]];
    void run(() => onReorder(siblings.map((s, n) => ({ id: s.id, sort_order: n }))));
  }

  const form = editing && (
    <div className="task-form" role="group" aria-label={editing.id ? t.editTask : t.addTask}>
      <div className="task-form-head">{editing.id ? t.editTask : editing.parent ? `${t.addTask} · ${editing.parent.wbs} ${editing.parent.name}` : `${t.addDeliverable} · ${DISCIPLINE_LABEL[editing.discipline]}`}</div>
      <div className="task-form-fields">
        <label className="task-form-wbs">{t.wbs}<input className="field-input" value={editing.wbs} onChange={e => setEditing({ ...editing, wbs: e.target.value })} /></label>
        <label className="task-form-name">{t.taskName}<input className="field-input" autoFocus value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })}
          onKeyDown={e => { if (e.key === 'Enter') void save(); if (e.key === 'Escape') setEditing(null); }} /></label>
        <label className="task-form-doc">{t.docType}<input className="field-input" list="task-doc-types" value={editing.doc_type} placeholder="DWG, PDF, Excel…" onChange={e => setEditing({ ...editing, doc_type: e.target.value })} /></label>
        <label className="task-form-weight">{t.weight}<input className="field-input" type="number" min="0.01" step="0.5" value={editing.weight} placeholder={t.weightEqual} onChange={e => setEditing({ ...editing, weight: e.target.value })} /></label>
      </div>
      <datalist id="task-doc-types">{['DWG', 'PDF', 'Excel', 'Word', 'PPT'].map(d => <option key={d} value={d} />)}</datalist>
      <div className="task-form-actions">
        <button className="btn-secondary" onClick={() => setEditing(null)} disabled={busy}>{t.cancel}</button>
        <button className="btn-primary" onClick={() => void save()} disabled={busy || !editing.name.trim()}>{t.save}</button>
      </div>
    </div>
  );

  return (
    <div className="admin-section tasks-panel">
      <div className="section-header">
        <h2><span className="code-badge">{project.project_code}</span> {project.name} <span className="records-count">{t.tasksTitle} · {pct(summary.overall)}</span></h2>
        <div className="section-actions">
          {archivedCount > 0 && (
            <label className="toggle-inline"><input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} /> {t.showArchived} ({archivedCount})</label>
          )}
          <button className="btn-action icon" onClick={onClose} title={t.close} aria-label={t.close}><X size={16} /></button>
        </div>
      </div>
      <p className="section-note">{t.tasksNote}</p>

      {disciplines.map(d => {
        const dRows = rows.filter(r => r.task.discipline === d);
        const dProgress = summary.disciplines.find(x => x.discipline === d)?.progress;
        return (
          <div key={d} className="task-discipline">
            <div className="task-discipline-head">
              <h3>{DISCIPLINE_LABEL[d]} <span className="records-count">{dRows.length ? pct(dProgress) : t.noTasksYet}</span></h3>
              <button className="btn-secondary" disabled={busy} onClick={() => startAdd(d, null)}><Plus size={14} /> {t.addDeliverable}</button>
            </div>
            {editing && !editing.id && !editing.parent && editing.discipline === d && form}
            {dRows.length > 0 && (
              <ul className="task-tree">
                {dRows.map(({ task, depth }) => {
                  const leaf = !hasChildren(task.id);
                  const pending = pendingByTask.get(task.id) ?? 0;
                  return (
                    <li key={task.id} className={`task-row depth-${depth}${task.archived_at ? ' is-archived' : ''}`} style={{ '--depth': depth } as React.CSSProperties}>
                      {editing?.id === task.id ? form : (
                        <div className="task-row-line">
                          <span className="task-wbs">{task.wbs}</span>
                          <span className="task-name">{task.name}
                            {task.doc_type && <span className="task-doc">{task.doc_type}</span>}
                            {task.weight != null && <span className="task-weight" title={t.weight}>×{task.weight}</span>}
                            {pending > 0 && <span className="pending-tag">{pending} {t.pendingCount}</span>}
                          </span>
                          <span className="task-progress">
                            {leaf && !task.archived_at ? (
                              <select className="task-progress-select" value={task.progress} disabled={busy} aria-label={`${t.progress} ${task.wbs}`}
                                onChange={e => void run(() => onSetProgress(task, Number(e.target.value)))}>
                                {PROGRESS_STEPS.map((s, i) => <option key={s} value={s}>{pct(s)} {t[`step${i}`]}</option>)}
                              </select>
                            ) : (
                              <span className="task-bar" aria-label={pct(rolled.get(task.id))}><span style={{ width: pct(rolled.get(task.id)) }} /><em>{pct(rolled.get(task.id))}</em></span>
                            )}
                          </span>
                          <span className="task-actions">
                            <button className="btn-action icon" disabled={busy} onClick={() => startEdit(task)} title={t.edit} aria-label={t.edit}><Pencil size={13} /></button>
                            {depth < MAX_DEPTH && !task.archived_at && (
                              <button className="btn-action icon" disabled={busy} onClick={() => startAdd(task.discipline, task)} title={t.addTask} aria-label={t.addTask}><Plus size={13} /></button>
                            )}
                            <button className="btn-action icon" disabled={busy} onClick={() => move(task, -1)} title={t.moveUp} aria-label={t.moveUp}><ArrowUp size={13} /></button>
                            <button className="btn-action icon" disabled={busy} onClick={() => move(task, 1)} title={t.moveDown} aria-label={t.moveDown}><ArrowDown size={13} /></button>
                            <button className="btn-action icon" disabled={busy} title={task.archived_at ? t.restore : t.archive} aria-label={task.archived_at ? t.restore : t.archive}
                              onClick={() => void run(() => onSave({ id: task.id, project_id: task.project_id, discipline: task.discipline, name: task.name, archived_at: task.archived_at ? null : new Date().toISOString() }))}>
                              {task.archived_at ? <ArchiveRestore size={13} /> : <Archive size={13} />}
                            </button>
                            {!loggedTaskIds.has(task.id) && !hasChildren(task.id) && (
                              <button className="btn-action icon danger" disabled={busy} title={t.delete} aria-label={t.delete}
                                onClick={() => { if (confirm(t.deleteTaskConfirm.replace('{name}', `${task.wbs} ${task.name}`))) void run(() => onDelete(task)); }}>
                                <Trash2 size={13} />
                              </button>
                            )}
                          </span>
                        </div>
                      )}
                      {editing && !editing.id && editing.parent?.id === task.id && form}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
