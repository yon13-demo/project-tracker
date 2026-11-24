// Project tasks: the progress ladder, rolling progress up the task tree, the task picker's order,
// and which progress proposals a save has to write. Pure helpers; tables are in schema-v7-project-tasks.sql.

export type Discipline = 'process' | 'mechanical' | 'electrical_automation' | 'procurement' | 'manufacturing' | '3d';
// Fixed display order; phase 1 offers the first three for new tasks.
export const DISCIPLINES: Discipline[] = ['process', 'mechanical', 'electrical_automation', 'procurement', 'manufacturing', '3d'];
export const ENGINEERING_DISCIPLINES: Discipline[] = ['process', 'mechanical', 'electrical_automation'];

export type ProjectTask = {
  id: string; project_id: string; parent_id: string | null; discipline: Discipline;
  wbs: string; name: string; doc_type: string | null; weight: number | null; sort_order: number;
  progress: number; archived_at: string | null;
};

export type ProgressProposal = {
  id: string; task_id: string; user_id: string; log_date: string;
  from_progress: number; to_progress: number; note: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'superseded';
  reviewed_at: string | null; review_note: string | null; created_at: string;
};

export const TASK_COLUMNS = 'id,project_id,parent_id,discipline,wbs,name,doc_type,weight,sort_order,progress,archived_at';
export const PROPOSAL_COLUMNS = 'id,task_id,user_id,log_date,from_progress,to_progress,note,status,reviewed_at,review_note,created_at';

export const PROGRESS_STEPS = [0, 0.2, 0.5, 0.8, 1] as const;

export function nearestStep(p: number): number {
  return PROGRESS_STEPS.reduce((best, s) => (Math.abs(s - p) < Math.abs(best - p) - 1e-9 ? s : best), 0 as number);
}

// PostgREST returns numeric columns as numbers or strings depending on size: make them numbers.
export function normalizeTasks(rows: unknown[] | null | undefined): ProjectTask[] {
  return (rows ?? []).map((r: any) => ({ ...r, progress: Number(r.progress) || 0, weight: r.weight == null ? null : Number(r.weight), sort_order: Number(r.sort_order) || 0 }));
}
export function normalizeProposals(rows: unknown[] | null | undefined): ProgressProposal[] {
  return (rows ?? []).map((r: any) => ({ ...r, from_progress: Number(r.from_progress) || 0, to_progress: Number(r.to_progress) || 0 }));
}

const live = (t: ProjectTask) => !t.archived_at;

function childrenOf(tasks: ProjectTask[]) {
  const m = new Map<string | null, ProjectTask[]>();
  for (const t of tasks) if (live(t)) m.set(t.parent_id, [...(m.get(t.parent_id) ?? []), t]);
  return m;
}

const weighted = (items: { value: number; weight: number | null }[]) => {
  const total = items.reduce((s, i) => s + (i.weight ?? 1), 0);
  return total > 0 ? items.reduce((s, i) => s + i.value * (i.weight ?? 1), 0) / total : 0;
};

// Progress of every task: a leaf's own approved progress, a parent's the weighted average of its children.
export function rollupProgress(tasks: ProjectTask[]): Map<string, number> {
  const kids = childrenOf(tasks);
  const out = new Map<string, number>();
  const visit = (t: ProjectTask): number => {
    const known = out.get(t.id);
    if (known !== undefined) return known;
    const ch = kids.get(t.id) ?? [];
    const v = ch.length ? weighted(ch.map(c => ({ value: visit(c), weight: c.weight }))) : t.progress;
    out.set(t.id, v);
    return v;
  };
  tasks.forEach(visit);
  return out;
}

export type DisciplineProgress = { discipline: Discipline; progress: number; deliverables: ProjectTask[] };

// One project's tasks → per-discipline progress (weighted over its deliverables) and the overall
// (disciplines count equally for now; budget-hour weighting comes with Microsoft Project).
export function projectProgress(tasks: ProjectTask[]): { overall: number | null; disciplines: DisciplineProgress[] } {
  const p = rollupProgress(tasks);
  const top = tasks.filter(t => live(t) && !t.parent_id);
  const disciplines = DISCIPLINES.flatMap(d => {
    const deliverables = sortTasks(top.filter(t => t.discipline === d));
    if (!deliverables.length) return [];
    return [{ discipline: d, progress: weighted(deliverables.map(t => ({ value: p.get(t.id) ?? 0, weight: t.weight }))), deliverables }];
  });
  return { overall: disciplines.length ? disciplines.reduce((s, d) => s + d.progress, 0) / disciplines.length : null, disciplines };
}

export function isLeafTask(tasks: ProjectTask[], id: string): boolean {
  return !tasks.some(t => t.parent_id === id && live(t));
}

const collator = new Intl.Collator('en', { numeric: true });
export function sortTasks(list: ProjectTask[]): ProjectTask[] {
  return [...list].sort((a, b) => a.sort_order - b.sort_order || collator.compare(a.wbs, b.wbs) || a.name.localeCompare(b.name));
}

// Tree order: each task followed by its children, siblings by sort_order then natural wbs ("2.2" < "2.10").
export function flattenTree(tasks: ProjectTask[], opts: { includeArchived?: boolean } = {}): { task: ProjectTask; depth: number; ancestors: ProjectTask[] }[] {
  const pool = opts.includeArchived ? tasks : tasks.filter(live);
  const kids = new Map<string | null, ProjectTask[]>();
  for (const t of pool) kids.set(t.parent_id, [...(kids.get(t.parent_id) ?? []), t]);
  const out: { task: ProjectTask; depth: number; ancestors: ProjectTask[] }[] = [];
  const walk = (parent: string | null, depth: number, ancestors: ProjectTask[]) => {
    for (const t of sortTasks(kids.get(parent) ?? [])) {
      out.push({ task: t, depth, ancestors });
      walk(t.id, depth + 1, [...ancestors, t]);
    }
  };
  walk(null, 0, []);
  return out;
}

export type TaskOption = { task: ProjectTask; path: string; recent: boolean };

const label = (t: ProjectTask) => (t.wbs ? `${t.wbs} ${t.name}` : t.name);

// The task picker: leaf tasks of one project, recently used first, then by discipline (the person's own
// first) in tree order. Archived tasks are left out unless `includeId` (the entry's current task) is one.
export function taskOptions(tasks: ProjectTask[], projectId: string, opts: { preferred?: Discipline | null; recentIds: string[]; includeId?: string }): { recent: TaskOption[]; groups: { discipline: Discipline; options: TaskOption[] }[] } {
  const own = tasks.filter(t => t.project_id === projectId);
  const rows = flattenTree(own, { includeArchived: true })
    .filter(r => (!r.task.archived_at || r.task.id === opts.includeId) && !r.ancestors.some(a => a.archived_at))
    .filter(r => !own.some(t => t.parent_id === r.task.id && live(t)));
  const option = (r: (typeof rows)[number], recent: boolean): TaskOption => ({
    task: r.task, recent, path: [...r.ancestors.map(a => a.name), label(r.task)].join(' › '),
  });
  const byId = new Map(rows.map(r => [r.task.id, r]));
  const recent = opts.recentIds.map(id => byId.get(id)).filter((r): r is (typeof rows)[number] => Boolean(r) && !r!.task.archived_at).map(r => option(r, true));
  const order = opts.preferred ? [opts.preferred, ...DISCIPLINES.filter(d => d !== opts.preferred)] : DISCIPLINES;
  const groups = order.map(d => ({ discipline: d, options: rows.filter(r => r.task.discipline === d).map(r => option(r, false)) })).filter(g => g.options.length);
  return { recent, groups };
}

// Attendance department → the discipline listed first in the task picker (sorting only).
export function divisionToDiscipline(division: string | null | undefined): Discipline | null {
  const d = (division || '').trim().toLowerCase();
  return d === 'automation' ? 'electrical_automation' : d === 'process' ? 'process' : d === 'workshop' ? 'manufacturing' : null;
}

export type ProposalEntry = { task_id: string | null; progress: number | null; description: string };
export type ProposalUpsert = { task_id: string; to_progress: number; note: string | null; id: string | null };

// After a day is saved: which of my pending proposals for that day to write or update, and which to withdraw.
// `pending` = my pending rows for that date; `approved` = each task's current approved progress.
export function proposalDiff(entries: ProposalEntry[], pending: ProgressProposal[], approved: Map<string, number>): { upsert: ProposalUpsert[]; remove: string[] } {
  const wanted = new Map<string, { to: number; note: string | null }>();
  for (const e of entries) {
    if (!e.task_id || e.progress == null) continue;
    if (e.progress === (approved.get(e.task_id) ?? 0)) { wanted.delete(e.task_id); continue; }
    wanted.set(e.task_id, { to: e.progress, note: e.description.trim() || null });
  }
  const upsert: ProposalUpsert[] = [];
  for (const [task_id, w] of wanted) {
    const existing = pending.find(p => p.task_id === task_id);
    if (existing && existing.to_progress === w.to) continue;
    upsert.push({ task_id, to_progress: w.to, note: w.note, id: existing?.id ?? null });
  }
  const remove = pending.filter(p => !wanted.has(p.task_id)).map(p => p.id);
  return { upsert, remove };
}
