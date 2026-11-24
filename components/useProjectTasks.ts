'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { showAlert, showStatus } from '@/lib/notify';
import {
  PROPOSAL_COLUMNS, TASK_COLUMNS, divisionToDiscipline, normalizeProposals, normalizeTasks, proposalDiff,
  type Discipline, type ProgressProposal, type ProjectTask, type ProposalEntry,
} from '@/lib/tasks';
import type { TaskDraft } from './ProjectTasksPanel';

export type TasksApi = ReturnType<typeof useProjectTasks>;

// Project tasks and progress proposals (schema v7). `enabled` stays false until the migration is run,
// so the app keeps working without it.
export function useProjectTasks(userId: string | null, isAdmin: boolean, t: any) {
  const [enabled, setEnabled] = useState(false);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [proposals, setProposals] = useState<ProgressProposal[]>([]);
  const [preferred, setPreferred] = useState<Discipline | null>(null);

  const loadProposals = useCallback(async () => {
    if (!userId) return;
    const since = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
    const [mine, open] = await Promise.all([
      supabase.from('task_progress_updates').select(PROPOSAL_COLUMNS).eq('user_id', userId).gte('log_date', since),
      isAdmin ? supabase.from('task_progress_updates').select(PROPOSAL_COLUMNS).eq('status', 'pending') : Promise.resolve({ data: [], error: null }),
    ]);
    const byId = new Map<string, ProgressProposal>();
    for (const p of normalizeProposals([...(mine.data ?? []), ...(open.data ?? [])])) byId.set(p.id, p);
    setProposals([...byId.values()]);
  }, [userId, isAdmin]);

  const reload = useCallback(async () => {
    if (!userId) return;
    const [res, prof] = await Promise.all([
      supabase.from('project_tasks').select(TASK_COLUMNS),
      supabase.from('profiles').select('division').eq('id', userId).maybeSingle(),
    ]);
    setEnabled(!res.error);
    if (res.error) return;
    setTasks(normalizeTasks(res.data));
    setPreferred(divisionToDiscipline((prof.data as { division?: string } | null)?.division));
    await loadProposals();
  }, [userId, loadProposals]);

  useEffect(() => { void reload(); }, [reload]);

  // After a day is saved: write, update or withdraw my pending proposals for that day.
  async function saveDayProposals(date: string, entries: ProposalEntry[]): Promise<string | null> {
    if (!enabled || !userId) return null;
    const pending = proposals.filter(p => p.user_id === userId && p.log_date === date && p.status === 'pending');
    const approved = new Map(tasks.map(x => [x.id, x.progress]));
    const { upsert, remove } = proposalDiff(entries, pending, approved);
    if (!upsert.length && !remove.length) return null;
    if (remove.length) {
      const { error } = await supabase.from('task_progress_updates').delete().in('id', remove);
      if (error) return error.message;
    }
    for (const u of upsert) {
      const { error } = u.id
        ? await supabase.from('task_progress_updates').update({ to_progress: u.to_progress, note: u.note }).eq('id', u.id)
        : await supabase.from('task_progress_updates').insert({ task_id: u.task_id, user_id: userId, log_date: date, to_progress: u.to_progress, note: u.note });
      if (error) return error.message;
    }
    await loadProposals();
    return null;
  }

  // ─── Admin ───
  async function saveTask(draft: TaskDraft): Promise<boolean> {
    const { id, ...fields } = draft;
    const { error } = id
      ? await supabase.from('project_tasks').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id)
      : await supabase.from('project_tasks').insert(fields);
    if (error) { showAlert(error.message); return false; }
    await reload();
    return true;
  }
  async function reorder(rows: { id: string; sort_order: number }[]) {
    for (const r of rows) {
      const { error } = await supabase.from('project_tasks').update({ sort_order: r.sort_order }).eq('id', r.id);
      if (error) { showAlert(error.message); break; }
    }
    await reload();
  }
  async function deleteTask(task: ProjectTask) {
    const { error } = await supabase.from('project_tasks').delete().eq('id', task.id);
    if (error) showAlert(error.message);
    await reload();
  }
  async function setProgress(task: ProjectTask, progress: number) {
    const { error } = await supabase.rpc('set_task_progress', { p_task: task.id, p_progress: progress });
    if (error) showAlert(error.message);
    await reload();
  }
  async function review(ids: string[], approve: boolean, note: string) {
    const { data, error } = await supabase.rpc('review_task_progress', { p_ids: ids, p_approve: approve, p_note: note || null });
    if (error) { showAlert(error.message); return; }
    showStatus((approve ? t.reviewApproved : t.reviewRejected).replace('{n}', String(data ?? ids.length)));
    await reload();
  }

  return { enabled, tasks, proposals, preferred, reload, saveDayProposals, saveTask, reorder, deleteTask, setProgress, review };
}
