// Manual projects (typed names) vs the registered project list: finding them, and folding them in.
import type { Project, WorkLog } from './worklog';

const MIN_CODE = 4; // shorter codes (e.g. "P1") would match ordinary words

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Registered projects whose number appears as a whole word in `text` ("2260301_LOreal…" → 2260301).
export function codeMatches(text: string, projects: Project[]): Project[] {
  const t = text.trim();
  if (!t) return [];
  return projects.filter(p => {
    const code = p.project_code.trim();
    return code.length >= MIN_CODE && new RegExp(`(^|[^0-9a-z])${escape(code)}($|[^0-9a-z])`, 'i').test(t);
  });
}

export type ManualGroup = { name: string; rows: number; hours: number; people: number; last: string; suggestedId: string };

// Every manual project name in use (case and spacing ignored), busiest first, with a suggested registered project.
export function manualProjectGroups(logs: WorkLog[], projects: Project[]): ManualGroup[] {
  const groups = new Map<string, { names: Map<string, number>; rows: number; hours: number; people: Set<string>; last: string }>();
  for (const l of logs) {
    if (l.is_leave || l.project_id || (l.category || 'project') !== 'project') continue;
    const name = (l.custom_project_name || '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const g = groups.get(key) ?? { names: new Map(), rows: 0, hours: 0, people: new Set(), last: '' };
    g.names.set(name, (g.names.get(name) ?? 0) + 1);
    g.rows++; g.hours += l.hours || 0; g.people.add(l.user_id);
    if (l.log_date > g.last) g.last = l.log_date;
    groups.set(key, g);
  }
  return [...groups.values()].map(g => {
    const name = [...g.names].sort((a, b) => b[1] - a[1])[0][0];
    const hit = codeMatches(name, projects);
    return { name, rows: g.rows, hours: Math.round(g.hours * 10) / 10, people: g.people.size, last: g.last, suggestedId: hit.length === 1 ? hit[0].id : '' };
  }).sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name));
}

export type MergeRow = { id: string; user_id: string; log_date: string; project_id: string | null; hours: number | null; description: string | null; custom_project_name: string | null };
export type MergePlan = { relink: string[]; add: { id: string; hours: number; description: string }[]; remove: string[] };

const joinDesc = (a: string | null, b: string | null) => [a, b].map(s => (s || '').trim()).filter(Boolean).filter((s, i, all) => all.indexOf(s) === i).join('\n');

// How to fold manual rows into `projectId` without leaving two entries for one project on one day:
// relink a manual row when the person has nothing for that project that day; otherwise add its hours
// (and description) to the entry already there and remove the manual row.
export function planManualMerge(manual: MergeRow[], linked: MergeRow[], projectId: string): MergePlan {
  const plan: MergePlan = { relink: [], add: [], remove: [] };
  const keep = new Map<string, { id: string; hours: number; description: string; changed: boolean }>();
  for (const l of linked) if (l.project_id === projectId) keep.set(`${l.user_id}|${l.log_date}`, { id: l.id, hours: l.hours || 0, description: (l.description || '').trim(), changed: false });
  for (const m of manual) {
    const day = `${m.user_id}|${m.log_date}`;
    const k = keep.get(day);
    if (!k) {
      plan.relink.push(m.id);
      keep.set(day, { id: m.id, hours: m.hours || 0, description: (m.description || '').trim(), changed: false });
      continue;
    }
    k.hours += m.hours || 0;
    k.description = joinDesc(k.description, m.description);
    k.changed = true;
    plan.remove.push(m.id);
  }
  for (const k of keep.values()) if (k.changed) plan.add.push({ id: k.id, hours: Math.round(k.hours * 100) / 100, description: k.description });
  return plan;
}
