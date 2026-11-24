'use client';

import { useState } from 'react';
import { Check, X } from 'lucide-react';
import type { Project, WorkLog } from '@/lib/worklog';
import type { ProgressProposal, ProjectTask } from '@/lib/tasks';

const pct = (v: number) => `${Math.round(v * 100)}%`;

// Admin: progress steps engineers proposed, waiting for approval. Only approved steps count.
export function ProgressReviewList({ t, lang, proposals, tasks, projects, userName, workLogs, onReview }: {
  t: any; lang: string; proposals: ProgressProposal[]; tasks: ProjectTask[]; projects: Project[];
  userName: (id: string) => string; workLogs: WorkLog[];
  onReview: (ids: string[], approve: boolean, note: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState('');
  const pending = proposals.filter(p => p.status === 'pending');
  if (!pending.length) return null;

  const taskById = new Map(tasks.map(x => [x.id, x]));
  const byProject = new Map<string, ProgressProposal[]>();
  for (const p of pending) {
    const pid = taskById.get(p.task_id)?.project_id ?? '';
    byProject.set(pid, [...(byProject.get(pid) ?? []), p]);
  }
  const path = (task: ProjectTask) => {
    const names: string[] = [];
    for (let x = taskById.get(task.parent_id ?? ''); x; x = taskById.get(x.parent_id ?? '')) names.unshift(x.name);
    return names.join(' › ');
  };
  const hoursOn = (p: ProgressProposal) => workLogs
    .filter(w => w.user_id === p.user_id && w.log_date === p.log_date && w.task_id === p.task_id)
    .reduce((s, w) => s + (w.hours || 0), 0);
  const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', { weekday: 'short', day: 'numeric', month: 'short' });

  async function review(key: string, ids: string[], approve: boolean) {
    let note = '';
    if (!approve) {
      const answer = window.prompt(t.rejectReason);
      if (answer === null) return;
      note = answer;
    }
    setBusy(key);
    try { await onReview(ids, approve, note); } finally { setBusy(''); }
  }

  return (
    <div className="admin-section review-section">
      <div className="section-header">
        <h2>{t.progressReview} <span className="records-count">{pending.length} {t.pendingCount}</span></h2>
      </div>
      <p className="section-note">{t.progressReviewNote}</p>
      {[...byProject].map(([pid, rows]) => {
        const project = projects.find(p => p.id === pid);
        return (
          <div key={pid} className="review-group">
            <div className="review-group-head">
              <span>{project ? <><span className="code-badge">{project.project_code}</span> {project.name}</> : '—'}</span>
              <button className="btn-secondary" disabled={Boolean(busy)} onClick={() => review(`all-${pid}`, rows.map(r => r.id), true)}>
                <Check size={14} /> {t.approveAll} ({rows.length})
              </button>
            </div>
            <div className="table-wrap">
              <table className="list-table review-table">
                <thead><tr><th>{t.task}</th><th>{t.progress}</th><th>{t.name}</th><th className="col-actions" aria-label={t.actions} /></tr></thead>
                <tbody>
                  {rows.sort((a, b) => a.created_at.localeCompare(b.created_at)).map(p => {
                    const task = taskById.get(p.task_id);
                    const down = p.to_progress < p.from_progress;
                    const h = hoursOn(p);
                    return (
                      <tr key={p.id}>
                        <td>
                          <div className="list-main">{task ? `${task.wbs} ${task.name}` : '—'}</div>
                          <div className="list-sub">{task ? path(task) : ''}{p.note ? <> · <em>{p.note}</em></> : null}</div>
                        </td>
                        <td className="review-move">
                          {pct(p.from_progress)} → <strong className={down ? 'down' : ''}>{pct(p.to_progress)}</strong>
                          {down && <span className="status-badge warn">{t.progressDown}</span>}
                        </td>
                        <td>
                          <div className="list-main">{userName(p.user_id)}</div>
                          <div className="list-sub">{fmtDate(p.log_date)}{h ? ` · ${h} ${t.hoursUnit}` : ''}</div>
                        </td>
                        <td className="col-actions">
                          <div className="list-actions">
                            <button className="btn-action approve" disabled={Boolean(busy)} onClick={() => review(p.id, [p.id], true)} title={t.approve}>
                              <Check size={14} /> {t.approve}
                            </button>
                            <button className="btn-action icon danger" disabled={Boolean(busy)} onClick={() => review(p.id, [p.id], false)} title={t.reject} aria-label={t.reject}>
                              <X size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
