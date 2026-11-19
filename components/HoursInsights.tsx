'use client';

import { useMemo, useState } from 'react';
import { monthTotals, personHoursForProject, projectHoursForMonth, projectOptions, type ProjectHours } from '@/lib/hoursStats';
import type { WorkLog } from '@/lib/worklog';

const TOP = 12;
const fmt = (n: number) => String(Math.round(n * 10) / 10);
const pct = (n: number) => `${Math.round(n * 100)}%`;

function monthLabel(month: string, lang: 'id' | 'en', long = false) {
  return new Date(`${month}-01T00:00:00`).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', { month: long ? 'long' : 'short', year: 'numeric' });
}

function Segmented<V extends string>({ value, options, onChange }: { value: V; options: { value: V; label: string }[]; onChange: (v: V) => void }) {
  return (
    <div className="segmented" role="tablist">
      {options.map(o => (
        <button key={o.value} type="button" role="tab" aria-selected={value === o.value} className={value === o.value ? 'active' : ''} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

// One labelled horizontal bar; the value is printed beside it, so no axis is needed.
function Bar({ label, sub, value, ratio, muted, title, onClick }: {
  label: React.ReactNode; sub?: string; value: string; ratio: number; muted?: boolean; title: string; onClick?: () => void;
}) {
  const body = (
    <>
      <span className="hbar-label">{label}</span>
      <span className="hbar-track"><span className={`hbar-fill${muted ? ' muted' : ''}`} style={{ width: `${Math.max(ratio * 100, 0.8)}%` }} /></span>
      <span className="hbar-value">{value}{sub && <span className="hbar-sub"> · {sub}</span>}</span>
    </>
  );
  return onClick
    ? <button type="button" className="hbar clickable" title={title} onClick={onClick}>{body}</button>
    : <div className="hbar" title={title}>{body}</div>;
}

// Admin panel under "Total jam kerja": hours per project for a month, and who worked on a project.
export function HoursInsights({ t, lang, logs }: { t: any; lang: 'id' | 'en'; logs: WorkLog[] }) {
  const months = useMemo(() => monthTotals(logs), [logs]);
  const [tab, setTab] = useState<'month' | 'project'>('month');
  const [month, setMonth] = useState(() => months[months.length - 1]?.month ?? new Date().toISOString().slice(0, 7));
  const [showAll, setShowAll] = useState(false);
  const options = useMemo(() => projectOptions(logs), [logs]);
  const [projectKey, setProjectKey] = useState('');
  const [scope, setScope] = useState<'month' | 'all'>('month');

  const rows = useMemo(() => projectHoursForMonth(logs, month), [logs, month]);
  const monthTotal = rows.reduce((s, r) => s + r.hours, 0);
  const projects = rows.filter(r => r.category === 'project');
  const others = rows.filter(r => r.category !== 'project');
  const shownProjects = showAll ? projects : projects.slice(0, TOP);
  const rest = showAll ? [] : projects.slice(TOP);
  const restHours = rest.reduce((s, r) => s + r.hours, 0);
  const maxRow = Math.max(...rows.map(r => r.hours), restHours, 1);
  const maxMonth = Math.max(...months.map(m => m.hours), 1);

  const selectedKey = projectKey || projects[0]?.key || options[0]?.key || '';
  const people = useMemo(() => personHoursForProject(logs, selectedKey, scope === 'month' ? month : null), [logs, selectedKey, scope, month]);
  const peopleTotal = people.reduce((s, p) => s + p.hours, 0);
  const maxPerson = Math.max(...people.map(p => p.hours), 1);

  const openProject = (r: ProjectHours) => { setProjectKey(r.key); setScope('month'); setTab('project'); };
  const projectLabel = (r: { code: string; name: string; manual?: boolean }) => (
    <>{r.code && <span className="code-badge">{r.code}</span>}<span className="hbar-name">{r.name}</span>{r.manual && <span className="hours-badge warn manual-tag">{t.manual}</span>}</>
  );

  if (!months.length) return <div className="insights"><div className="records-empty">{t.noData}</div></div>;

  return (
    <div className="insights">
      <div className="insights-head">
        <Segmented value={tab} onChange={setTab} options={[{ value: 'month', label: t.perMonth }, { value: 'project', label: t.perProject }]} />
      </div>

      <div className="month-strip" role="tablist" aria-label={t.perMonth}>
        {months.map(m => (
          <button key={m.month} type="button" role="tab" aria-selected={m.month === month}
            className={`month-pill${m.month === month ? ' active' : ''}`} onClick={() => { setMonth(m.month); setShowAll(false); }}
            title={`${monthLabel(m.month, lang, true)}: ${fmt(m.hours)} ${t.hoursUnit}`}>
            <span className="month-spark"><span style={{ height: `${Math.max((m.hours / maxMonth) * 100, 6)}%` }} /></span>
            <span className="month-name">{monthLabel(m.month, lang)}</span>
            <span className="month-hours">{fmt(m.hours)} {t.hoursUnit}</span>
          </button>
        ))}
      </div>

      {tab === 'month' ? (
        <section>
          <div className="insights-sub">
            <strong>{monthLabel(month, lang, true)}</strong>
            <span>{fmt(monthTotal)} {t.hoursUnit} · {projects.length} {t.projectsCount}</span>
          </div>
          {!rows.length && <div className="records-empty">{t.noData}</div>}
          <div className="hbars">
            {shownProjects.map(r => (
              <Bar key={r.key} label={projectLabel(r)} value={`${fmt(r.hours)} ${t.hoursUnit}`} sub={pct(r.share)} ratio={r.hours / maxRow}
                title={`${r.code ? r.code + ' · ' : ''}${r.name}: ${fmt(r.hours)} ${t.hoursUnit} (${pct(r.share)}) — ${t.seePeople}`} onClick={() => openProject(r)} />
            ))}
            {rest.length > 0 && (
              <Bar muted label={<span className="hbar-name">{t.others} ({rest.length})</span>} value={`${fmt(restHours)} ${t.hoursUnit}`}
                sub={pct(monthTotal ? restHours / monthTotal : 0)} ratio={restHours / maxRow} title={t.showAllProjects} onClick={() => setShowAll(true)} />
            )}
            {others.map(r => (
              <Bar key={r.key} muted label={<span className="hbar-name">{r.name}</span>} value={`${fmt(r.hours)} ${t.hoursUnit}`} sub={pct(r.share)}
                ratio={r.hours / maxRow} title={`${r.name}: ${fmt(r.hours)} ${t.hoursUnit} — ${t.seePeople}`} onClick={() => openProject(r)} />
            ))}
          </div>
        </section>
      ) : (
        <section>
          <div className="insights-controls">
            <select className="sort-select" value={selectedKey} onChange={e => setProjectKey(e.target.value)} aria-label={t.pickProject}>
              {options.map(o => <option key={o.key} value={o.key}>{o.code ? `${o.code} — ${o.name}` : o.name}</option>)}
            </select>
            <Segmented value={scope} onChange={setScope} options={[{ value: 'month', label: monthLabel(month, lang) }, { value: 'all', label: t.allTime }]} />
          </div>
          <div className="insights-sub">
            <strong>{options.find(o => o.key === selectedKey)?.name}</strong>
            <span>{fmt(peopleTotal)} {t.hoursUnit} · {people.length} {t.peopleCount}</span>
          </div>
          {!people.length && <div className="records-empty">{t.noHoursThisMonth}</div>}
          <div className="hbars">
            {people.map(p => (
              <Bar key={p.userId} label={<span className="hbar-name">{p.name}</span>} value={`${fmt(p.hours)} ${t.hoursUnit}`} sub={`${p.days} ${t.daysUnit}`}
                ratio={p.hours / maxPerson} title={`${p.name}: ${fmt(p.hours)} ${t.hoursUnit}, ${p.days} ${t.daysUnit}`} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
