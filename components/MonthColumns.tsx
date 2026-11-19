'use client';

import { colorSlots, type MonthTop } from '@/lib/hoursStats';

const SLOTS = 8;
const fmt = (n: number) => String(Math.round(n * 10) / 10);

// Grouped columns: one group per month, the month's top projects side by side.
// A project keeps one colour in every month; each column carries its hours on top, so no y-axis.
export function MonthColumns({ t, data, selected, label, onSelect }: {
  t: any; data: MonthTop[]; selected: string; label: (month: string) => string; onSelect: (month: string) => void;
}) {
  const slots = colorSlots(data, SLOTS);
  const max = Math.max(...data.flatMap(m => m.top.map(p => p.hours)), 1);
  const legend = [...slots.keys()].map(k => data.flatMap(m => m.top).find(p => p.key === k)!);
  const hasOverflow = data.some(m => m.top.some(p => !slots.has(p.key)));
  const color = (key: string) => (slots.has(key) ? `var(--series-${slots.get(key)! + 1})` : 'var(--chart-muted)');

  return (
    <figure className="mcols">
      <div className="mcols-plot">
        {data.map(m => (
          <button key={m.month} type="button" className={`mcols-group${m.month === selected ? ' active' : ''}`}
            aria-pressed={m.month === selected} onClick={() => onSelect(m.month)}>
            <span className="mcols-bars">
              {m.top.map(p => (
                <span key={p.key} className="mcols-col" title={`${label(m.month)} · ${p.code ? p.code + ' ' : ''}${p.name}: ${fmt(p.hours)} ${t.hoursUnit}`}>
                  <span className="mcols-val">{fmt(p.hours)}</span>
                  <span className="mcols-fill" style={{ height: `${(p.hours / max) * 100}%`, background: color(p.key) }} />
                </span>
              ))}
            </span>
            <span className="mcols-month">{label(m.month)}</span>
          </button>
        ))}
      </div>
      <figcaption className="mcols-legend">
        {legend.map(p => (
          <span key={p.key} className="mcols-key" title={p.name}>
            <span className="mcols-swatch" style={{ background: color(p.key) }} />
            {p.code ? <><strong>{p.code}</strong> {p.name}</> : p.name}
          </span>
        ))}
        {hasOverflow && <span className="mcols-key"><span className="mcols-swatch" style={{ background: 'var(--chart-muted)' }} />{t.others}</span>}
      </figcaption>
    </figure>
  );
}
