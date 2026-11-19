'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { colorSlots, composition, monthRange, monthTotals, personMonths, roundPercents, type ProjectHours } from '@/lib/hoursStats';
import type { WorkLog } from '@/lib/worklog';

const WINDOW = 6;
const SLOTS = 7;
const LABEL_MIN = 15; // label a strip piece directly only when it is at least this many percent wide
const fmt = (n: number) => String(Math.round(n * 10) / 10);

export function monthLabel(month: string, lang: 'id' | 'en', long = false) {
  return new Date(`${month}-01T00:00:00`).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', { month: long ? 'long' : 'short', year: 'numeric' });
}

const isProject = (r: ProjectHours) => r.category === 'project';
const itemName = (r: ProjectHours) => (r.code ? `${r.code} ${r.name}` : r.name);

// "Per orang": one person, one month at a time.
// Month strip (the only month picker) -> month total -> composition strip -> ranked list.
export function PersonHours({ t, lang, logs, userId, name, month, onMonth, onOpenProject }: {
  t: any; lang: 'id' | 'en'; logs: WorkLog[]; userId: string; name: string;
  month: string; onMonth: (month: string) => void; onOpenProject: (r: ProjectHours) => void;
}) {
  // Every month from the first with hours to the latest, with no gaps.
  const allMonths = useMemo(() => {
    const totals = monthTotals(logs);
    if (!totals.length) return [];
    const first = totals[0].month, last = totals[totals.length - 1].month;
    const span = (Number(last.slice(0, 4)) - Number(first.slice(0, 4))) * 12 + Number(last.slice(5)) - Number(first.slice(5)) + 1;
    return monthRange(last, Math.max(span, WINDOW));
  }, [logs]);
  const data = useMemo(() => personMonths(logs, userId, allMonths), [logs, userId, allMonths]);
  const slots = useMemo(() => colorSlots(data.map(m => ({ ...m, top: m.top.filter(isProject) })), SLOTS), [data]);
  const color = (key: string) => (slots.has(key) ? `var(--series-${slots.get(key)! + 1})` : 'var(--chart-muted)');

  // Open on the person's latest month with hours.
  const latestWithHours = [...data].reverse().find(m => m.total > 0)?.month;
  useEffect(() => { if (latestWithHours) onMonth(latestWithHours); }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = data.find(m => m.month === month) ?? data[data.length - 1];
  const selIndex = selected ? data.indexOf(selected) : data.length - 1;
  const [end, setEnd] = useState(data.length - 1);
  useEffect(() => { // keep the selected month inside the visible window
    setEnd(e => (selIndex > e ? selIndex : selIndex < e - WINDOW + 1 ? selIndex + WINDOW - 1 : e));
  }, [selIndex]);
  const endIdx = Math.min(Math.max(end, WINDOW - 1), data.length - 1);
  const view = data.slice(Math.max(0, endIdx - WINDOW + 1), endIdx + 1);
  const viewMax = Math.max(...view.map(m => m.total), 1);

  const [flash, setFlash] = useState('');
  const rows = useRef<Record<string, HTMLDivElement | null>>({});
  const jumpTo = (keys: string[]) => {
    const el = rows.current[keys[0]];
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setFlash(keys.join('|'));
    setTimeout(() => setFlash(''), 1400);
  };

  if (!data.some(m => m.total > 0)) return <div className="records-empty">{t.personNoHours.replace('{name}', name)}</div>;

  const items = selected?.top ?? [];
  const total = selected?.total ?? 0;
  const pieces = composition(items);
  const pcts = roundPercents(items.map(i => i.hours));
  const pctOf = new Map(items.map((i, n) => [i.key, pcts[n]]));
  const groups = [
    { label: t.projectsHeading, rows: items.filter(isProject) },
    { label: t.nonProject, rows: items.filter(i => !isProject(i)) },
  ].filter(g => g.rows.length);
  const inRest = new Set(pieces.find(p => p.key === 'rest')?.items.map(i => i.key) ?? []);
  const dot = (r: ProjectHours) => (inRest.has(r.key) || !isProject(r) ? 'var(--chart-muted)' : color(r.key));
  let at = 0;

  return (
    <div className="person-hours">
      <div className="pmonths">
        <button type="button" className="pmonths-nav" aria-label={t.prevMonths} disabled={endIdx - WINDOW + 1 <= 0} onClick={() => setEnd(endIdx - 1)}>‹</button>
        <div className="pmonths-cells" role="tablist">
          {view.map(m => (
            <button key={m.month} type="button" role="tab" aria-selected={m.month === selected?.month}
              className={`pmonth${m.month === selected?.month ? ' active' : ''}${m.total ? '' : ' empty'}`}
              title={`${monthLabel(m.month, lang, true)}: ${fmt(m.total)} ${t.hoursUnit}`} onClick={() => onMonth(m.month)}>
              <span className="pmonth-name">{monthLabel(m.month, lang).replace(/ \d{4}$/, '')}</span>
              <span className="pmonth-bar">{m.total ? <i style={{ height: `${Math.max((m.total / viewMax) * 100, 6)}%` }} /> : <b />}</span>
              <span className="pmonth-val">{m.total ? fmt(m.total) : '—'}</span>
            </button>
          ))}
        </div>
        <button type="button" className="pmonths-nav" aria-label={t.nextMonths} disabled={endIdx >= data.length - 1} onClick={() => setEnd(endIdx + 1)}>›</button>
      </div>

      <div className="psum">
        <div className="psum-month">{selected && monthLabel(selected.month, lang, true)}</div>
        {total > 0 ? (
          <div className="psum-stats"><strong>{fmt(total)}</strong> {t.hoursUnit}<span>·</span>{items.length} {t.activities}</div>
        ) : (
          <div className="records-empty">{t.noHoursThisMonth}</div>
        )}
      </div>

      {total > 0 && (
        <>
          <div className="pstrip-wrap">
            <div className="pstrip">
              {pieces.map(p => {
                const one = p.items.length === 1 ? p.items[0] : null;
                const bg = !one ? 'var(--chart-muted)' : isProject(one) ? color(one.key) : 'var(--chart-muted)';
                const tip = one ? `${itemName(one)} — ${fmt(p.hours)} ${t.hoursUnit} (${p.pct}%)`
                  : `${t.others} — ${fmt(p.hours)} ${t.hoursUnit} (${p.pct}%)\n${p.items.map(i => `${itemName(i)}: ${fmt(i.hours)} ${t.hoursUnit}`).join('\n')}`;
                return <button key={p.key} type="button" className={`pstrip-seg${one ? '' : ' rest'}`} style={{ flexGrow: p.hours, background: bg }}
                  title={tip} aria-label={tip} onClick={() => jumpTo(p.items.map(i => i.key))} />;
              })}
            </div>
            <div className="pstrip-labels">
              {pieces.map(p => {
                const start = at; at += p.pct;
                const one = p.items.length === 1 ? p.items[0] : null;
                if (one && p.pct < LABEL_MIN) return null;
                const nearEnd = start > 70;
                return (
                  <span key={p.key} className={`pstrip-label${one && p.pct < 30 ? ' minor' : ''}`} title={one ? itemName(one) : t.others}
                    style={nearEnd ? { right: `${100 - start - p.pct}%`, textAlign: 'right' } : { left: `${start}%`, maxWidth: one ? `${Math.max(p.pct, LABEL_MIN)}%` : undefined }}>
                    {one ? (one.code ? <><strong>{one.code}</strong><span className="pstrip-name"> {one.name}</span></> : one.name) : t.others} <em>{p.pct}%</em>
                  </span>
                );
              })}
            </div>
          </div>

          <div className="plist">
            {groups.map(g => (
              <div key={g.label} className="plist-group">
                <div className="plist-head">{g.label}</div>
                {g.rows.map(r => (
                  <div key={r.key} ref={el => { rows.current[r.key] = el; }} className={`prow-wrap${flash.split('|').includes(r.key) ? ' flash' : ''}`}>
                    <button type="button" className="prow" title={`${itemName(r)} — ${fmt(r.hours)} ${t.hoursUnit} (${pctOf.get(r.key)}%)`} onClick={() => onOpenProject(r)}>
                      <span className="hbar-label">
                        <span className={`prow-dot${inRest.has(r.key) ? ' rest' : ''}`} style={{ background: dot(r) }} />
                        {r.code && <span className="code-badge">{r.code}</span>}
                        <span className="hbar-name">{r.name}</span>
                        {r.manual && <span className="hours-badge warn manual-tag">{t.manual}</span>}
                      </span>
                      <span className="hbar-track tape"><span className={`hbar-fill${isProject(r) ? '' : ' muted'}`} style={{ width: `${Math.max((r.hours / total) * 100, 0.8)}%` }} /></span>
                      <span className="prow-val"><strong>{fmt(r.hours)}</strong> {t.hoursUnit}<span className="hbar-sub"> · {pctOf.get(r.key)}%</span></span>
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
