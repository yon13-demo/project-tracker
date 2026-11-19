'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { NON, OTHER, buildTape, collapseEmpty, niceScale, timelineMonths, type SeriesOf, type TapeRow, type TapeSegment, type TapeSeries } from '@/lib/tapeTimeline';
import type { WorkLog } from '@/lib/worklog';

const WINDOW = 6;
const INSIDE_LABEL_PX = 40;
const fmt = (n: number) => String(Math.round(n * 10) / 10);
const pctTxt = (n: number) => `${Math.round(n * 100)}%`;

export const todayLocal = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD

export function monthLabel(month: string, lang: 'id' | 'en', long = false) {
  return new Date(`${month}-01T00:00:00`).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', { month: long ? 'long' : 'short', year: 'numeric' });
}

// Colours: the chart's top 5 get a hue that never moves between rows; Lainnya and Non-proyek are greys.
export const seriesColor = (slot: number | null, key: string) =>
  slot != null ? `var(--series-${slot + 1})` : key === NON ? 'var(--chart-non)' : 'var(--chart-other)';

export type Tape = ReturnType<typeof useTape>;

// The timeline's data for the latest `count` months; "Lebih lama" grows the window.
export function useTape(logs: WorkLog[], seriesOf: SeriesOf, today: string) {
  const all = useMemo(() => timelineMonths(logs, today), [logs, today]);
  const [count, setCount] = useState(WINDOW);
  const months = all.slice(-count);
  const tape = useMemo(() => buildTape(logs, months, seriesOf, today), [logs, months.join(), seriesOf, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const slotOf = new Map(tape.series.map(s => [s.key, s.slot]));
  // Colour of one item (project or person) in this chart: its own hue, or the grey of the group it falls into.
  const colorOf = (key: string, nonProject = false) =>
    slotOf.get(key) != null ? seriesColor(slotOf.get(key)!, key) : seriesColor(null, nonProject ? NON : OTHER);
  return { ...tape, months, canOlder: all.length > count, older: () => setCount(c => c + WINDOW), colorOf, today };
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export function TapeTimeline({ t, lang, tape, selected, onSelect, nonLabel }: {
  t: any; lang: 'id' | 'en'; tape: Tape; selected: string; onSelect: (month: string) => void; nonLabel?: string;
}) {
  const [mode, setMode] = useState<'hours' | 'pct'>('hours');
  const [hl, setHl] = useState<string | null>(null);
  const [axisRef, trackW] = useWidth<HTMLDivElement>();
  const { rows, series } = tape;
  const entries = collapseEmpty(rows);
  const scale = niceScale(Math.max(...rows.map(r => Math.max(r.total, r.projection ?? 0)), 0));
  const labelOf = (s: { key: string; label: string; code?: string }) =>
    s.key === OTHER ? t.others : s.key === NON ? (nonLabel ?? t.nonProject) : s.code ? `${s.code} ${s.label}` : s.label;
  const seriesByKey = new Map(series.map(s => [s.key, s]));
  const prevWithHours = (i: number) => { for (let j = i - 1; j >= 0; j--) if (rows[j].total > 0) return rows[j]; return null; };
  const yesterday = (() => { const d = new Date(`${tape.today}T00:00:00`); d.setDate(d.getDate() - 1); return d; })();
  const shortDate = (d: Date) => d.toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', { day: 'numeric', month: 'short' });

  const segTitle = (row: TapeRow, g: TapeSegment, i: number) => {
    const s = seriesByKey.get(g.key)!;
    const prev = prevWithHours(i)?.segments.find(x => x.key === g.key)?.hours;
    const change = prev ? ` · ${g.hours >= prev ? '▲' : '▼'} ${pctTxt(Math.abs(g.hours - prev) / prev)} ${t.vsPrevMonth}` : '';
    const inside = g.items ? '\n' + g.items.map(x => `${x.code ? x.code + ' ' : ''}${x.label}: ${fmt(x.hours)} ${t.hoursUnit}`).join('\n') : '';
    return `${labelOf(s)} — ${fmt(g.hours)} ${t.hoursUnit} · ${pctTxt(g.hours / row.total)} ${t.ofThisMonth}${row.running ? '' : change}${inside}`;
  };

  return (
    <figure className="tape">
      <div className="tape-tools">
        {tape.canOlder ? <button type="button" className="tape-older" onClick={tape.older}>↑ {t.olderMonths}</button> : <span />}
        <div className="segmented" role="tablist">
          {(['hours', 'pct'] as const).map(m => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} className={mode === m ? 'active' : ''} onClick={() => setMode(m)}>{m === 'hours' ? t.hoursUnitTitle : '%'}</button>
          ))}
        </div>
      </div>

      <div className="tape-grid">
        <span />
        <div className="tape-axis" ref={axisRef}>
          {mode === 'hours'
            ? scale.ticks.map((v, i) => (
              <span key={v} className="tape-tick" style={{ left: `${(v / scale.max) * 100}%` }}>{fmt(v)}{i === scale.ticks.length - 1 ? ` ${t.hoursUnit}` : ''}</span>))
            : [0, 50, 100].map(v => <span key={v} className="tape-tick" style={{ left: `${v}%` }}>{v}%</span>)}
        </div>
        <span />

        {entries.map(e => {
          if (e.kind === 'gap') {
            const a = monthLabel(e.from, lang).replace(/ \d{4}$/, ''), b = monthLabel(e.to, lang);
            return <div key={e.from} className="tape-gap">{e.from === e.to ? b : `${a}–${b}`} · {t.noHoursShort}</div>;
          }
          const row = e.row;
          const i = rows.indexOf(row);
          const denom = mode === 'hours' ? scale.max : row.total || 1;
          const active = row.month === selected;
          return (
            <button key={row.month} type="button" className={`tape-row${active ? ' active' : ''}${row.running ? ' running' : ''}`}
              aria-pressed={active} onClick={() => onSelect(row.month)}>
              <span className="tape-month">{active && <i aria-hidden>▸</i>}{monthLabel(row.month, lang)}</span>
              <span className="tape-track">
                {grid(mode, scale)}
                <span className="tape-bar">
                  {row.segments.map(g => {
                    const s = seriesByKey.get(g.key)!;
                    const w = (g.hours / denom) * 100;
                    return (
                      <span key={g.key} className={`tape-seg${g.key === NON ? ' non' : ''}${hl && hl !== g.key ? ' faded' : ''}`}
                        style={{ width: `${w}%`, background: seriesColor(s.slot, g.key) }} title={segTitle(row, g, i)}>
                        {(w / 100) * trackW >= INSIDE_LABEL_PX && <em>{fmt(g.hours)}</em>}
                      </span>
                    );
                  })}
                  {mode === 'hours' && row.projection != null && row.projection > row.total && (
                    <span className="tape-proj" style={{ width: `${((row.projection - row.total) / denom) * 100}%` }}
                      title={`${t.projection} ≈${Math.round(row.projection)} ${t.hoursUnit}`} />
                  )}
                </span>
              </span>
              <span className="tape-right">
                <b>{fmt(row.total)} {t.hoursUnit}</b>
                {row.running
                  ? <small>{t.running} · {t.until} {shortDate(yesterday)}{row.projection != null && mode === 'hours' ? <> · ≈{Math.round(row.projection)}</> : null}</small>
                  : null}
                {mode === 'hours' && row.delta != null && (
                  <small className="tape-delta">{row.running ? '≈ ' : ''}{row.delta >= 0 ? '▲' : '▼'} {pctTxt(Math.abs(row.delta))}</small>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <figcaption className="tape-legend">
        {series.map(s => (
          <button key={s.key} type="button" className={`tape-key${hl === s.key ? ' on' : ''}${hl && hl !== s.key ? ' off' : ''}`}
            aria-pressed={hl === s.key} onClick={() => setHl(h => (h === s.key ? null : s.key))}>
            <span className={`tape-swatch${s.key === NON ? ' non' : ''}`} style={{ background: seriesColor(s.slot, s.key) }} />
            {s.code ? <><strong>{s.code}</strong> {s.label}</> : labelOf(s)}
          </button>
        ))}
      </figcaption>
    </figure>
  );
}

const grid = (mode: 'hours' | 'pct', scale: { max: number; ticks: number[] }) => (
  <span className="tape-gridlines" aria-hidden>
    {(mode === 'hours' ? scale.ticks.map(v => v / scale.max) : [0, 0.5, 1]).map(f => <i key={f} style={{ left: `${f * 100}%` }} />)}
  </span>
);
