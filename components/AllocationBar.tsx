'use client';

import { useRef, useState } from 'react';
import { fillRemaining, remaining, resizeTo, trackHours } from '@/lib/allocation';
import { clockTime, formatHours } from '@/lib/attendance';
import { CATEGORY_LABEL, type EntryDraft, type Project } from '@/lib/worklog';

export const entryColor = (i: number) => `var(--series-${(i % 8) + 1})`;

const hoursOf = (e: EntryDraft) => (Number(e.hours) > 0 ? Number(e.hours) : 0);

function entryLabel(e: EntryDraft, projects: Project[], fallback: string) {
  if (e.category !== 'project') return CATEGORY_LABEL[e.category];
  const p = projects.find(x => x.id === e.project_id);
  return p ? p.project_code || p.name : e.custom_name.trim() || fallback;
}

// The attendance day as one bar; each work entry is a block whose right edge can be dragged
// (0.5 h steps). Blocks sit side by side; what is left stays unallocated (e.g. a break).
// The "+" handle after the last block drags out a new entry.
export function AllocationBar({ t, entries, projects, attendance, firstIn, lastOut, tz, onSetHours, onAddEntry }: {
  t: any; entries: EntryDraft[]; projects: Project[];
  attendance: number | null; firstIn?: string | null; lastOut?: string | null; tz?: string | null;
  onSetHours: (hours: Record<string, string>) => void;  // tempId -> hours
  onAddEntry: (hours: number) => string;               // returns the new entry's tempId
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const hours = entries.map(hoursOf);
  const logged = hours.reduce((s, h) => s + h, 0);
  const [dragTrack, setDragTrack] = useState<number | null>(null); // keep the scale still while dragging
  const track = dragTrack ?? trackHours(attendance, logged);
  const left = remaining(hours, track);
  const latest = useRef({ entries, hours });
  latest.current = { entries, hours };
  const [fillTarget, setFillTarget] = useState('');

  const pct = (h: number) => `${(h / track) * 100}%`;
  const edgeAt = (clientX: number) => {
    const r = trackRef.current!.getBoundingClientRect();
    return ((clientX - r.left) / r.width) * track;
  };
  const apply = (next: number[]) => {
    const { entries: list, hours: hs } = latest.current;
    const patch: Record<string, string> = {};
    list.forEach((e, i) => { if (next[i] !== undefined && next[i] !== hs[i]) patch[e.tempId] = String(next[i]); });
    if (Object.keys(patch).length) onSetHours(patch);
  };

  function startDrag(ev: React.PointerEvent, index: number) {
    ev.preventDefault();
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
    const fixed = track;
    setDragTrack(fixed);
    const move = (e: PointerEvent) => {
      const { hours: hs } = latest.current;
      apply(resizeTo(hs, index, edgeAt(e.clientX), fixed));
    };
    const up = () => { setDragTrack(null); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  // "+" handle: fill the first entry without hours, or add a new one, then keep dragging its edge.
  function startAdd(ev: React.PointerEvent) {
    if (left < 0.5) return;
    const empty = entries.findIndex(e => hoursOf(e) === 0);
    if (empty >= 0) {
      apply(hours.map((h, i) => (i === empty ? 0.5 : h)));
      startDrag(ev, empty);
    } else {
      onAddEntry(0.5);
      startDrag(ev, entries.length);
    }
  }

  function onKey(ev: React.KeyboardEvent, index: number) {
    const step = ev.key === 'ArrowRight' || ev.key === 'ArrowUp' ? 0.5 : ev.key === 'ArrowLeft' || ev.key === 'ArrowDown' ? -0.5 : 0;
    if (!step) return;
    ev.preventDefault();
    const start = hours.slice(0, index).reduce((s, h) => s + h, 0);
    apply(resizeTo(hours, index, start + hours[index] + step, track));
  }

  const target = fillTarget && entries.some(e => e.tempId === fillTarget) ? fillTarget : entries[entries.length - 1]?.tempId;
  const ticks = Array.from({ length: Math.floor(track) - 1 }, (_, i) => i + 1);
  let start = 0;

  return (
    <div className="alloc">
      <div className="alloc-head">
        <span>{attendance != null ? t.allocTitle : t.allocTitleNoAtt}</span>
        <span className="alloc-sum">{formatHours(logged)} / {formatHours(track)} {t.hoursUnit}</span>
      </div>

      <div className="alloc-track" ref={trackRef}>
        {ticks.map(h => <span key={h} className="alloc-tick" style={{ left: pct(h) }} />)}
        {entries.map((e, i) => {
          const h = hours[i];
          const from = start; start += h;
          if (!h) return null;
          const label = entryLabel(e, projects, t.allocPick);
          return (
            <div key={e.tempId} className={`alloc-block${from === 0 ? " first" : ""}${from + h >= track ? " last" : ""}`} style={{ left: pct(from), width: pct(h), background: entryColor(i) }}
              title={`${label}: ${formatHours(h)} ${t.hoursUnit}`}>
              <span className="alloc-block-text">{(h / track) * 100 > 9 && <><b>{label}</b> {formatHours(h)}</>}</span>
              <span className="alloc-handle" role="slider" tabIndex={0} aria-label={`${label} (${t.hoursUnit})`}
                aria-valuemin={0.5} aria-valuemax={track} aria-valuenow={h}
                onPointerDown={ev => startDrag(ev, i)} onKeyDown={ev => onKey(ev, i)} />
            </div>
          );
        })}
        {left > 0 && (
          <div className="alloc-free" style={{ left: pct(logged), width: pct(left) }}>
            {(left / track) * 100 > 34 && <span>{formatHours(left)} {t.hoursUnit} {t.allocFree}</span>}
          </div>
        )}
        {left >= 0.5 && (
          <button type="button" className="alloc-add" style={{ left: `calc(${pct(logged)} + 10px)` }} onPointerDown={startAdd}
            title={t.allocDragToAdd} aria-label={t.allocDragToAdd}>+</button>
        )}
      </div>

      <div className="alloc-axis">
        <span>{firstIn ? clockTime(firstIn, tz || 'Asia/Jakarta') : '0'}</span>
        <span>{lastOut && attendance != null && track === trackHours(attendance, 0) ? clockTime(lastOut, tz || 'Asia/Jakarta') : `${formatHours(track)} ${t.hoursUnit}`}</span>
      </div>

      {left >= 0.5 && entries.length > 0 && (
        <div className="alloc-fill">
          <span>{formatHours(left)} {t.hoursUnit} {t.allocFree}{attendance != null && <span className="alloc-note"> · {t.allocBreakNote}</span>}</span>
          <span className="alloc-fill-ctl">
            <select value={target} onChange={e => setFillTarget(e.target.value)} aria-label={t.allocFillInto}>
              {entries.map((e, i) => <option key={e.tempId} value={e.tempId}>{i + 1}. {entryLabel(e, projects, t.allocPick)}</option>)}
            </select>
            <button type="button" className="btn-secondary" onClick={() => {
              const idx = entries.findIndex(e => e.tempId === target);
              if (idx >= 0) apply(fillRemaining(hours, idx, track));
            }}>{t.allocFill} {formatHours(left)} {t.hoursUnit}</button>
          </span>
        </div>
      )}
    </div>
  );
}
