'use client';

import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { monthTotals } from '@/lib/hoursStats';
import { elapsedWorkDays, timelineMonths, workDays } from '@/lib/tapeTimeline';
import type { WorkLog } from '@/lib/worklog';
import { HoursInsights } from './HoursInsights';
import { todayLocal } from './TapeTimeline';

const fmt = (n: number) => String(Math.round(n * 10) / 10);
const short = (month: string, lang: 'id' | 'en') =>
  new Date(`${month}-01T00:00:00`).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', { month: 'short', year: '2-digit' });
const long = (month: string, lang: 'id' | 'en') =>
  new Date(`${month}-01T00:00:00`).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', { month: 'long', year: 'numeric' });

// Admin headline: total work hours with the last 6 months (no gaps; the running month shows its
// projection as a dashed top). Clicking a month opens the details on that month; the details and
// this chart share one selected month.
export function HoursHero({ t, lang, logs, totalHours, projectCount, peopleCount }: {
  t: any; lang: 'id' | 'en'; logs: WorkLog[]; totalHours: number; projectCount: number; peopleCount: number;
}) {
  const today = todayLocal();
  const current = today.slice(0, 7);
  const totals = useMemo(() => new Map(monthTotals(logs).map(m => [m.month, m.hours])), [logs]);
  const months = useMemo(() => timelineMonths(logs, today).slice(-6).map(month => {
    const hours = totals.get(month) ?? 0;
    const elapsed = month === current ? elapsedWorkDays(month, today) : 0;
    return { month, hours, projection: month === current && elapsed > 0 ? (hours / elapsed) * workDays(month) : null };
  }), [logs, totals, today, current]);
  const latestWithHours = [...months].reverse().find(m => m.hours > 0);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => latestWithHours?.month ?? current);
  const max = Math.max(...months.map(m => Math.max(m.hours, m.projection ?? 0)), 1);
  const headline = months.find(m => m.month === current && m.hours > 0) ?? latestWithHours;

  const pick = (m: string) => { setMonth(m); setOpen(true); };

  return (
    <section className="hours-hero">
      <div className="hero-top">
        <div className="hero-main">
          <div className="hero-label">{t.totalHours}</div>
          <div className="hero-number">{fmt(totalHours)}<span>{t.hoursUnit}</span></div>
          {headline && (
            <div className="hero-sub">
              {long(headline.month, lang)}{headline.month === current ? ` (${t.running})` : ''}: <b>{fmt(headline.hours)} {t.hoursUnit}</b>
              {headline.projection != null && <> · {t.projection} ≈{Math.round(headline.projection)}</>}
            </div>
          )}
          <div className="hero-minor">
            <div><b>{projectCount}</b>{t.projectsCount}</div>
            <div><b>{peopleCount}</b>{t.peopleCount}</div>
          </div>
        </div>
        {months.length > 0 && (
          <div className="hero-preview" aria-label={t.hoursPerMonth}>
            {months.map(m => {
              const running = m.month === current;
              const extra = m.projection != null && m.projection > m.hours ? m.projection - m.hours : 0;
              return (
                <button key={m.month} type="button" className={`hero-col${m.month === month ? ' active' : ''}${running ? ' running' : ''}${m.hours ? '' : ' empty'}`}
                  aria-pressed={m.month === month} onClick={() => pick(m.month)}
                  title={`${long(m.month, lang)}: ${fmt(m.hours)} ${t.hoursUnit}${m.projection != null ? ` · ${t.projection} ≈${Math.round(m.projection)}` : ''}`}>
                  <span className="hero-col-val">{m.hours ? fmt(m.hours) : '—'}</span>
                  <span className="hero-col-stack">
                    {extra > 0 && <span className="hero-col-proj" style={{ height: `${(extra / max) * 100}%` }} />}
                    {m.hours ? <span className="hero-col-bar" style={{ height: `${Math.max((m.hours / max) * 100, 2)}%` }} /> : <span className="hero-col-dot" />}
                  </span>
                  <span className="hero-col-month">{short(m.month, lang)}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <button type="button" className={`hero-expand${open ? ' open' : ''}`} onClick={() => setOpen(v => !v)} aria-expanded={open}>
        {open ? t.hideDetails : t.showDetails}<ChevronDown size={15} aria-hidden />
      </button>
      {open && <div className="hero-details"><HoursInsights t={t} lang={lang} logs={logs} month={month} onMonth={setMonth} /></div>}
    </section>
  );
}
