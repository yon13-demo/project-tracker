'use client';

import { useEffect, useRef } from 'react';
import { colorSlots, type MonthTop } from '@/lib/hoursStats';

const SLOTS = 7;
const fmt = (n: number) => String(Math.round(n * 10) / 10);
const pct = (n: number) => `${Math.round(n * 100)}%`;

// Colour follows the project across months: the person's 7 busiest projects get a slot, the rest is grey.
export function personColors(data: MonthTop[]) {
  const slots = colorSlots(data, SLOTS);
  return (key: string) => (slots.has(key) ? `var(--series-${slots.get(key)! + 1})` : 'var(--chart-muted)');
}

// One vertical tape per month: the column is the person's hours, cut by project with the
// biggest piece at the bottom, so each column narrows upwards. The total sits on top.
export function PersonColumns({ t, data, selected, label, onSelect }: {
  t: any; data: MonthTop[]; selected: string; label: (month: string) => string; onSelect: (month: string) => void;
}) {
  const color = personColors(data);
  const slots = colorSlots(data, SLOTS);
  const max = Math.max(...data.map(m => m.total), 1);
  const legend = [...slots.keys()].map(k => data.flatMap(m => m.top).find(p => p.key === k)!);
  const hasOverflow = data.some(m => m.top.some(p => !slots.has(p.key)));
  // On narrow screens the strip scrolls; start at the newest month.
  const plot = useRef<HTMLDivElement>(null);
  useEffect(() => { if (plot.current) plot.current.scrollLeft = plot.current.scrollWidth; }, [data]);

  return (
    <figure className="mcols">
      <div className="mcols-plot" ref={plot}>
        {data.map(m => (
          <button key={m.month} type="button" className={`mcols-group${m.month === selected ? ' active' : ''}`}
            aria-pressed={m.month === selected} onClick={() => onSelect(m.month)}>
            <span className="mcols-bars">
              <span className="mcols-col pcols-col">
                <span className="mcols-val">{fmt(m.total)}</span>
                <span className="pcols-stack" style={{ height: `${(m.total / max) * 100}%` }}>
                  {m.top.map(p => (
                    <span key={p.key} className="pcols-seg" style={{ flexGrow: p.hours, background: color(p.key) }}
                      title={`${label(m.month)} · ${p.code ? p.code + ' ' : ''}${p.name}: ${fmt(p.hours)} ${t.hoursUnit} · ${pct(p.share)} ${t.ofThisMonth}`} />
                  ))}
                </span>
              </span>
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
