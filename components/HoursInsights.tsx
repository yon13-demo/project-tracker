'use client';

import { useMemo, useState } from 'react';
import { MonthColumns } from './MonthColumns';
import { peopleInMonth, splitByPerson, topProjectsByMonth, monthTotals, personHoursForProject, projectHoursForMonth, projectOptions, type ProjectHours } from '@/lib/hoursStats';
import type { WorkLog } from '@/lib/worklog';

const TOP = 12;
const PEOPLE_COLOURS = 7;
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
type Segment = { key: string; ratio: number; color: string; title: string };

function Bar({ label, sub, value, ratio, muted, tape, segments, title, onClick }: {
  label: React.ReactNode; sub?: string; value: string; ratio: number; muted?: boolean; tape?: boolean; segments?: Segment[]; title: string; onClick?: () => void;
}) {
  const fill = segments?.length
    ? segments.map(g => <span key={g.key} className="hbar-seg" style={{ width: `${g.ratio * 100}%`, background: g.color }} title={g.title} />)
    : <span className={`hbar-fill${muted ? ' muted' : ''}`} style={{ width: `${Math.max(ratio * 100, 0.8)}%` }} />;
  const body = (
    <>
      <span className="hbar-label">{label}</span>
      <span className={`hbar-track${tape ? ' tape' : ''}${segments?.length ? ' stacked' : ''}`}>{fill}</span>
      <span className="hbar-value">{value}{sub && <span className="hbar-sub"> · {sub}</span>}</span>
    </>
  );
  return onClick
    ? <button type="button" className={`hbar clickable${tape ? ' is-tape' : ''}`} title={title} onClick={onClick}>{body}</button>
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
  const tops = useMemo(() => topProjectsByMonth(logs, 3), [logs]);

  // Stacked tape: each row's fill is cut by person. The month's 7 busiest people keep one colour
  // in every row; everyone else is merged into one grey piece per row.
  const monthPeople = useMemo(() => peopleInMonth(logs, month), [logs, month]);
  // The busiest row fills the track; every row keeps its proportion to it (labels carry the % of the month).
  const scale = Math.max(...rows.map(r => r.hours), rest.reduce((s, r) => s + r.hours, 0), 1);
  const personSlot = new Map(monthPeople.slice(0, PEOPLE_COLOURS).map((p, i) => [p.userId, i]));
  const segmentsFor = (keys: string[]): Segment[] => {
    const split = splitByPerson(logs, month, keys);
    const rowHours = split.reduce((s, p) => s + p.hours, 0) || 1;
    const share = (h: number) => `${fmt(h)} ${t.hoursUnit} · ${pct(h / rowHours)} ${t.ofThisRow} · ${pct(h / (monthTotal || 1))} ${t.ofThisMonth}`;
    // Widest piece first, so each bar narrows left to right; the grey rest stays last.
    const named = split.filter(p => personSlot.has(p.userId));
    const rest = split.filter(p => !personSlot.has(p.userId));
    const restHours = rest.reduce((s, p) => s + p.hours, 0);
    const out = named.map(p => ({ key: p.userId, ratio: p.hours / scale, color: `var(--series-${personSlot.get(p.userId)! + 1})`, title: `${p.name}: ${share(p.hours)}` }));
    if (rest.length) out.push({ key: 'rest', ratio: restHours / scale, color: 'var(--chart-muted)', title: `${t.others} (${rest.length} ${t.peopleCount}): ${share(restHours)}
${rest.map(p => `${p.name} ${fmt(p.hours)} ${t.hoursUnit}`).join(', ')}` });
    return out;
  };

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
      <div className="month-tabs">
        <Segmented value={month} onChange={m => { setMonth(m); setShowAll(false); }}
          options={months.map(m => ({ value: m.month, label: monthLabel(m.month, lang) }))} />
      </div>
      </div>

      {tab === 'month' ? (
        <section>
          <div className="insights-sub">
            <strong>{t.top3PerMonth}</strong>
          </div>
          <MonthColumns t={t} data={tops} selected={month} label={m => monthLabel(m, lang)} onSelect={m => { setMonth(m); setShowAll(false); }} />
          <div className="insights-sub insights-gap">
            <strong>{monthLabel(month, lang, true)}</strong>
            <span>{fmt(monthTotal)} {t.hoursUnit}</span>
          </div>
          {!rows.length && <div className="records-empty">{t.noData}</div>}
          {rows.length > 0 && (
            <div className="mcols-legend people-legend">
              {monthPeople.slice(0, PEOPLE_COLOURS).map((p, i) => (
                <span key={p.userId} className="mcols-key"><span className="mcols-swatch" style={{ background: `var(--series-${i + 1})` }} />{p.name}</span>
              ))}
              {monthPeople.length > PEOPLE_COLOURS && (
                <span className="mcols-key"><span className="mcols-swatch" style={{ background: 'var(--chart-muted)' }} />{t.others} ({monthPeople.length - PEOPLE_COLOURS} {t.peopleCount})</span>
              )}
            </div>
          )}
          <div className="hbars">
            {shownProjects.map(r => (
              <Bar key={r.key} tape segments={segmentsFor([r.key])} label={projectLabel(r)} value={pct(r.share)} sub={`${fmt(r.hours)} ${t.hoursUnit}`} ratio={r.hours / scale}
                title={`${r.code ? r.code + ' · ' : ''}${r.name}: ${pct(r.share)} (${fmt(r.hours)} ${t.hoursUnit})`} onClick={() => openProject(r)} />
            ))}
            {rest.length > 0 && (
              <Bar muted tape segments={segmentsFor(rest.map(r => r.key))} label={<span className="hbar-name">{t.others} ({rest.length})</span>} value={pct(monthTotal ? restHours / monthTotal : 0)}
                sub={`${fmt(restHours)} ${t.hoursUnit}`} ratio={restHours / scale} title={t.showAllProjects} onClick={() => setShowAll(true)} />
            )}
            {others.map(r => (
              <Bar key={r.key} muted tape segments={segmentsFor([r.key])} label={<span className="hbar-name">{r.name}</span>} value={pct(r.share)} sub={`${fmt(r.hours)} ${t.hoursUnit}`}
                ratio={r.hours / scale} title={`${r.name}: ${pct(r.share)} (${fmt(r.hours)} ${t.hoursUnit})`} onClick={() => openProject(r)} />
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
            <span>{fmt(peopleTotal)} {t.hoursUnit}</span>
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
