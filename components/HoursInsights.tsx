'use client';

import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { matchesQuery } from '@/lib/adminLists';
import { personHoursForProject, personSeries, projectHoursForMonth, projectOptions, projectSeries, personOptions, type ProjectHours } from '@/lib/hoursStats';
import type { WorkLog } from '@/lib/worklog';
import { PersonHours } from './PersonHours';
import { TapeTimeline, monthLabel, todayLocal, useTape } from './TapeTimeline';

const TOP = 12;
const PEOPLE_IN_ROW = 5;
const fmt = (n: number) => String(Math.round(n * 10) / 10);
const pct = (n: number) => `${Math.round(n * 100)}%`;
const isProject = (r: ProjectHours) => r.category === 'project';

function Segmented<V extends string>({ value, options, onChange }: { value: V; options: { value: V; label: string }[]; onChange: (v: V) => void }) {
  return (
    <div className="segmented" role="tablist">
      {options.map(o => (
        <button key={o.value} type="button" role="tab" aria-selected={value === o.value} className={value === o.value ? 'active' : ''} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

// One labelled horizontal bar in one colour; the value is printed beside it, so no axis is needed.
function Bar({ label, sub, value, ratio, color, title, onClick, expanded }: {
  label: React.ReactNode; sub?: string; value: string; ratio: number; color: string; title: string; onClick?: () => void; expanded?: boolean;
}) {
  const body = (
    <>
      <span className="hbar-label">{label}</span>
      <span className="hbar-track tape"><span className="hbar-fill" style={{ width: `${Math.max(ratio * 100, 0.8)}%`, background: color }} /></span>
      <span className="hbar-value">{value}{sub && <span className="hbar-sub"> · {sub}</span>}
        {expanded != null && <ChevronDown size={14} className={`hbar-chev${expanded ? ' open' : ''}`} aria-hidden />}</span>
    </>
  );
  return onClick
    ? <button type="button" className="hbar clickable is-tape" title={title} onClick={onClick} aria-expanded={expanded}>{body}</button>
    : <div className="hbar" title={title}>{body}</div>;
}

// Admin details under "Total jam kerja". Every tab is a tape timeline (one tape per month on a shared
// scale) with the selected month's list under it. The month is chosen here or on the hero chart.
export function HoursInsights({ t, lang, logs, month, onMonth }: {
  t: any; lang: 'id' | 'en'; logs: WorkLog[]; month: string; onMonth: (month: string) => void;
}) {
  const today = todayLocal();
  const [tab, setTab] = useState<'month' | 'project' | 'person'>('month');
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const options = useMemo(() => projectOptions(logs), [logs]);
  const [projectKey, setProjectKey] = useState('');
  const [scope, setScope] = useState<'month' | 'all'>('month');
  const people_ = useMemo(() => personOptions(logs), [logs]);
  const [personId, setPersonId] = useState('');
  const [personQuery, setPersonQuery] = useState('');
  const pickMonth = (m: string) => { onMonth(m); setShowAll(false); setOpen(null); };

  // Per bulan
  const monthTape = useTape(logs, projectSeries, today);
  const rows = useMemo(() => projectHoursForMonth(logs, month), [logs, month]);
  const monthTotal = rows.reduce((s, r) => s + r.hours, 0);
  const projects = rows.filter(isProject);
  const nonProject = rows.filter(r => !isProject(r));
  const shown = showAll ? projects : projects.slice(0, TOP);
  const rest = showAll ? [] : projects.slice(TOP);
  const restHours = rest.reduce((s, r) => s + r.hours, 0);
  const scale = Math.max(...rows.map(r => r.hours), restHours, 1);

  // Per proyek
  const selectedKey = projectKey || projects[0]?.key || options[0]?.key || '';
  const projectLogs = useMemo(() => logs.filter(l => projectSeries(l).key === selectedKey), [logs, selectedKey]);
  const projectTape = useTape(projectLogs, personSeries, today);
  const people = useMemo(() => personHoursForProject(logs, selectedKey, scope === 'month' ? month : null), [logs, selectedKey, scope, month]);
  const peopleTotal = people.reduce((s, p) => s + p.hours, 0);
  const maxPerson = Math.max(...people.map(p => p.hours), 1);

  // Per orang
  const selectedPerson = people_.find(p => p.userId === personId) ?? [...people_].sort((a, b) => b.hours - a.hours)[0];
  const personLogs = useMemo(() => logs.filter(l => l.user_id === selectedPerson?.userId), [logs, selectedPerson?.userId]);
  const personTape = useTape(personLogs, projectSeries, today);
  const matches = personQuery.trim() ? people_.filter(p => matchesQuery([p.name], personQuery)).slice(0, 8) : [];

  const openPerson = (userId: string) => { setPersonId(userId); setPersonQuery(''); setTab('person'); };
  const openProject = (r: { key: string }) => { setProjectKey(r.key); setScope('month'); setTab('project'); };
  const projectLabel = (r: ProjectHours) => (
    <>{r.code && <span className="code-badge">{r.code}</span>}<span className="hbar-name">{r.name}</span>{r.manual && <span className="hours-badge warn manual-tag">{t.manual}</span>}</>
  );
  const monthHead = (total: number) => (
    <div className="insights-sub insights-gap"><strong>{monthLabel(month, lang, true)}</strong><span>{fmt(total)} {t.hoursUnit}</span></div>
  );

  // A project row in Per bulan; it opens to its top people.
  const projectRow = (r: ProjectHours) => {
    const isOpen = open === r.key;
    const top = isOpen ? personHoursForProject(logs, r.key, month) : [];
    return (
      <div key={r.key} className={`hrow${isOpen ? ' open' : ''}`}>
        <Bar label={projectLabel(r)} value={`${fmt(r.hours)} ${t.hoursUnit}`} sub={pct(r.share)} ratio={r.hours / scale}
          color={monthTape.colorOf(r.key, !isProject(r))} expanded={isOpen}
          title={`${r.code ? r.code + ' · ' : ''}${r.name}: ${fmt(r.hours)} ${t.hoursUnit} (${pct(r.share)})`} onClick={() => setOpen(isOpen ? null : r.key)} />
        {isOpen && (
          <div className="hrow-people">
            {top.slice(0, PEOPLE_IN_ROW).map(p => (
              <button key={p.userId} type="button" onClick={() => openPerson(p.userId)}>
                <span>{p.name}</span><span className="hbar-sub">{fmt(p.hours)} {t.hoursUnit} · {p.days} {t.daysUnit}</span>
              </button>
            ))}
            {top.length > PEOPLE_IN_ROW && <span className="hrow-more">+{top.length - PEOPLE_IN_ROW} {t.peopleCount}</span>}
            <button type="button" className="hrow-link" onClick={() => openProject(r)}>{t.openInProject} →</button>
          </div>
        )}
      </div>
    );
  };

  if (!monthTape.months.length) return <div className="insights"><div className="records-empty">{t.noData}</div></div>;

  return (
    <div className="insights">
      <div className="insights-head">
        <Segmented value={tab} onChange={setTab} options={[{ value: 'month', label: t.perMonth }, { value: 'project', label: t.perProject }, { value: 'person', label: t.perPerson }]} />
      </div>

      {tab === 'month' ? (
        <section>
          <TapeTimeline t={t} lang={lang} tape={monthTape} selected={month} onSelect={pickMonth} />
          {monthHead(monthTotal)}
          {!rows.length && <div className="records-empty">{t.noHoursThisMonth}</div>}
          <div className="hbars">
            {shown.map(projectRow)}
            {rest.length > 0 && (
              <Bar label={<span className="hbar-name">{t.others} ({rest.length})</span>} value={`${fmt(restHours)} ${t.hoursUnit}`} sub={pct(monthTotal ? restHours / monthTotal : 0)}
                ratio={restHours / scale} color="var(--chart-other)" title={t.showAllProjects} onClick={() => setShowAll(true)} />
            )}
            {nonProject.length > 0 && <div className="plist-head hbars-head">{t.nonProject}</div>}
            {nonProject.map(projectRow)}
          </div>
        </section>
      ) : tab === 'project' ? (
        <section>
          <div className="insights-controls">
            <select className="sort-select" value={selectedKey} onChange={e => setProjectKey(e.target.value)} aria-label={t.pickProject}>
              {options.map(o => <option key={o.key} value={o.key}>{o.code ? `${o.code} — ${o.name}` : o.name}</option>)}
            </select>
          </div>
          <TapeTimeline t={t} lang={lang} tape={projectTape} selected={month} onSelect={pickMonth} />
          <div className="insights-sub insights-gap">
            <strong>{options.find(o => o.key === selectedKey)?.name}</strong>
            <Segmented value={scope} onChange={setScope} options={[{ value: 'month', label: monthLabel(month, lang) }, { value: 'all', label: t.allTime }]} />
          </div>
          {!people.length && <div className="records-empty">{t.noHoursThisMonth}</div>}
          <div className="hbars">
            {people.map(p => (
              <Bar key={p.userId} label={<span className="hbar-name">{p.name}</span>} value={`${fmt(p.hours)} ${t.hoursUnit}`} sub={`${p.days} ${t.daysUnit}`}
                ratio={p.hours / maxPerson} color={projectTape.colorOf(p.userId)} title={`${p.name}: ${fmt(p.hours)} ${t.hoursUnit}, ${p.days} ${t.daysUnit} · ${fmt(peopleTotal)} ${t.hoursUnit}`}
                onClick={() => openPerson(p.userId)} />
            ))}
          </div>
        </section>
      ) : (
        <section>
          <div className="insights-controls person-pick">
            <input className="search-input" type="search" value={personQuery} onChange={e => setPersonQuery(e.target.value)}
              placeholder={t.searchPersonName} aria-label={t.searchPersonName} />
            {matches.length > 0 && (
              <div className="person-matches" role="listbox">
                {matches.map(p => (
                  <button key={p.userId} type="button" role="option" aria-selected={p.userId === selectedPerson?.userId} onClick={() => openPerson(p.userId)}>
                    <span>{p.name}</span><span className="hbar-sub">{fmt(p.hours)} {t.hoursUnit}</span>
                  </button>
                ))}
              </div>
            )}
            {personQuery.trim() && !matches.length && <div className="records-empty">{t.noData}</div>}
          </div>
          {selectedPerson && (
            <>
              <div className="insights-sub"><strong>{selectedPerson.name}</strong></div>
              <TapeTimeline t={t} lang={lang} tape={personTape} selected={month} onSelect={pickMonth} />
              <PersonHours t={t} lang={lang} logs={logs} userId={selectedPerson.userId} month={month} colorOf={personTape.colorOf} onOpenProject={openProject} />
            </>
          )}
        </section>
      )}
    </div>
  );
}
