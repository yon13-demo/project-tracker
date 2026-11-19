'use client';

import { useMemo } from 'react';
import { projectHoursForMonth, roundPercents, type ProjectHours } from '@/lib/hoursStats';
import type { WorkLog } from '@/lib/worklog';
import { monthLabel } from './TapeTimeline';

const fmt = (n: number) => String(Math.round(n * 10) / 10);
const isProject = (r: ProjectHours) => r.category === 'project';
const itemName = (r: ProjectHours) => (r.code ? `${r.code} ${r.name}` : r.name);

// "Per orang" detail under the timeline: the selected month's activities, Proyek then Non-proyek,
// hours first. Each row carries its colour in the timeline above.
export function PersonHours({ t, lang, logs, userId, month, colorOf, onOpenProject }: {
  t: any; lang: 'id' | 'en'; logs: WorkLog[]; userId: string; month: string;
  colorOf: (key: string, nonProject?: boolean) => string; onOpenProject: (r: ProjectHours) => void;
}) {
  const items = useMemo(() => projectHoursForMonth(logs.filter(l => l.user_id === userId), month).sort((a, b) => b.hours - a.hours), [logs, userId, month]);
  const total = items.reduce((s, i) => s + i.hours, 0);
  const pcts = roundPercents(items.map(i => i.hours));
  const pctOf = new Map(items.map((i, n) => [i.key, pcts[n]]));
  const groups = [
    { label: t.projectsHeading, rows: items.filter(isProject) },
    { label: t.nonProject, rows: items.filter(i => !isProject(i)) },
  ].filter(g => g.rows.length);

  return (
    <div className="person-hours">
      <div className="insights-sub">
        <strong>{monthLabel(month, lang, true)}</strong>
        {total > 0 && <span>{fmt(total)} {t.hoursUnit} · {items.length} {t.activities}</span>}
      </div>
      {!total && <div className="records-empty">{t.noHoursThisMonth}</div>}
      <div className="plist">
        {groups.map(g => (
          <div key={g.label} className="plist-group">
            <div className="plist-head">{g.label}</div>
            {g.rows.map(r => (
              <button key={r.key} type="button" className="prow" title={`${itemName(r)} — ${fmt(r.hours)} ${t.hoursUnit} (${pctOf.get(r.key)}%)`} onClick={() => onOpenProject(r)}>
                <span className="hbar-label">
                  {r.code && <span className="code-badge">{r.code}</span>}
                  <span className="hbar-name">{r.name}</span>
                  {r.manual && <span className="hours-badge warn manual-tag">{t.manual}</span>}
                </span>
                <span className="hbar-track tape"><span className={`hbar-fill${isProject(r) ? '' : ' non'}`} style={{ width: `${Math.max((r.hours / total) * 100, 0.8)}%`, background: colorOf(r.key, !isProject(r)) }} /></span>
                <span className="prow-val"><strong>{fmt(r.hours)}</strong> {t.hoursUnit}<span className="hbar-sub"> · {pctOf.get(r.key)}%</span></span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
