// The TV dashboard: the shape of weave_dashboard()'s answer (WEAVE_DASHBOARD.md §4) and its display rules (§7).

export type DashCategory = { key: 'project' | 'quotation' | 'training' | 'other'; label: string; hours: number; share_pct: number | null };
export type DashTopProject = { rank: number; code: string; name: string; hours: number; people: number; share_pct: number | null };
export type DashWeek = { week_start: string; iso_week: number; hours: number; partial: boolean };
export type DashDiscipline = { key: string; label: string; progress_pct: number; tasks: number; done: number };
export type DashProjectProgress = {
  code: string; name: string; overall: number | null; tasks_total: number; tasks_done: number;
  disciplines: DashDiscipline[]; pending: number; hours_month: number;
};

export type Dashboard = {
  generated_at: string; timezone: string; date: string;
  periods: { week: { from: string; to: string; iso_week: number } };
  reporting: { date: string; expected: number; reported: number; rate_pct: number | null; target_pct: number; streak_days: number };
  hours: { week: number; last_week: number; week_change_pct: number | null; month: number; last_month: number; month_change_pct: number | null };
  categories_week: DashCategory[];
  top_projects_month: DashTopProject[];
  other_projects_month_hours: number;
  manual_projects_month: { hours: number; entries: number; share_pct: number | null };
  weekly_trend: DashWeek[];
  attendance: {
    comparison: { from: string; to: string; clocked_hours: number; logged_hours: number; coverage_pct: number | null; person_days: number; unreported_days: number };
    today: { date: string; expected: number; clocked_in: number; still_in: number; clocked_out: number; on_leave: number; not_clocked_in: number; synced_at: string | null; minutes_since_sync: number | null; is_stale: boolean };
  };
  project_progress?: DashProjectProgress[]; // schema v9
};

const nf = (digits: number) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: digits });

export function fmtHours(h: number): string {
  return Math.abs(h) >= 100 ? nf(0).format(Math.round(h)) : nf(1).format(h);
}

export function fmtPct(p: number | null | undefined): string {
  if (p == null) return '—';
  return `${Math.abs(p) < 10 && p !== 0 ? nf(1).format(p) : nf(0).format(Math.round(p))}%`;
}

export function fmtDelta(p: number | null): { text: string; dir: 'up' | 'down' | 'flat' | 'none' } {
  if (p == null) return { text: '—', dir: 'none' };
  if (p === 0) return { text: '0%', dir: 'flat' };
  return { text: `${p > 0 ? '▲' : '▼'} ${fmtPct(Math.abs(p))}`, dir: p > 0 ? 'up' : 'down' };
}

export type Status = 'good' | 'warn' | 'bad' | 'none';
// ≥ good → good, ≥ warn → warn, below → bad.
export function rateStatus(v: number | null, good: number, warn: number): Status {
  if (v == null) return 'none';
  return v >= good ? 'good' : v >= warn ? 'warn' : 'bad';
}

export function shortDay(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).replace('.', '');
}

export function clockWib(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' }).replace('.', ':');
}
