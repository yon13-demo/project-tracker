'use client';

import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { monthTotals } from '@/lib/hoursStats';
import type { WorkLog } from '@/lib/worklog';
import { HoursInsights } from './HoursInsights';

const fmt = (n: number) => String(Math.round(n * 10) / 10);
const monthLabel = (month: string, lang: 'id' | 'en') =>
  new Date(`${month}-01T00:00:00`).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', { month: 'short', year: '2-digit' });

// Admin headline: total work hours with a monthly preview; projects and people as secondary figures.
// "Lihat rincian" expands the full charts in place.
export function HoursHero({ t, lang, logs, totalHours, projectCount, peopleCount }: {
  t: any; lang: 'id' | 'en'; logs: WorkLog[]; totalHours: number; projectCount: number; peopleCount: number;
}) {
  const [open, setOpen] = useState(false);
  const months = useMemo(() => monthTotals(logs).slice(-6), [logs]);
  const latest = months[months.length - 1];
  const max = Math.max(...months.map(m => m.hours), 1);

  return (
    <section className="hours-hero">
      <div className="hero-top">
        <div className="hero-main">
          <div className="hero-label">{t.totalHours}</div>
          <div className="hero-number">{fmt(totalHours)}<span>{t.hoursUnit}</span></div>
          {latest && <div className="hero-sub">{monthLabel(latest.month, lang)}: <b>{fmt(latest.hours)} {t.hoursUnit}</b></div>}
          <div className="hero-minor">
            <div><b>{projectCount}</b>{t.projectsCount}</div>
            <div><b>{peopleCount}</b>{t.peopleCount}</div>
          </div>
        </div>
        {months.length > 0 && (
          <div className="hero-preview" aria-label={t.hoursPerMonth}>
            {months.map(m => (
              <div key={m.month} className={`hero-col${m === latest ? ' latest' : ''}`} title={`${monthLabel(m.month, lang)}: ${fmt(m.hours)} ${t.hoursUnit}`}>
                <span className="hero-col-val">{fmt(m.hours)}</span>
                <span className="hero-col-bar" style={{ height: `${Math.max((m.hours / max) * 100, 2)}%` }} />
                <span className="hero-col-month">{monthLabel(m.month, lang)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <button type="button" className={`hero-expand${open ? ' open' : ''}`} onClick={() => setOpen(v => !v)} aria-expanded={open}>
        {open ? t.hideDetails : t.showDetails}<ChevronDown size={15} aria-hidden />
      </button>
      {open && <div className="hero-details"><HoursInsights t={t} lang={lang} logs={logs} /></div>}
    </section>
  );
}
