'use client';

import { useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { currentItemId, dayTotal, draftToTimerItem, formatClock, itemTotals } from '@/lib/dayTimer';
import { isDraftReady, newEntryDraft, type EntryDraft, type Project } from '@/lib/worklog';
import { EntryFields } from './EntryFields';
import { AwayPrompt } from './AwayPrompt';
import type { DayTimer } from './useDayTimer';

export function TimerBody({ t, timer, projects, hasV4Schema, compact = false }: {
  t: any; timer: DayTimer; projects: Project[]; hasV4Schema: boolean; compact?: boolean;
}) {
  const [draft, setDraft] = useState<EntryDraft | null>(null);
  const { state, now } = timer;
  if (!state) return null;

  const totals = itemTotals(state, now);
  const activeId = currentItemId(state);
  const active = state.items.find(i => i.id === activeId);
  const blocked = Boolean(state.pendingAway);

  function submitDraft() {
    if (!draft || !isDraftReady(draft, { requireHours: false })) return;
    const item = draftToTimerItem(draft, projects.find(p => p.id === draft.project_id), crypto.randomUUID());
    // The first item of the day starts automatically; later items wait for a click.
    timer.addItem(item, state!.segments.length === 0);
    setDraft(null);
  }

  return (
    <div className={compact ? 'timer-body timer-mini' : 'timer-body'}>
      <AwayPrompt t={t} timer={timer} />
      <div className="timer-clock">{formatClock(activeId ? totals[activeId] : dayTotal(state, now))}</div>
      <div className="timer-current">
        {active && <>{active.label}{active.code && <span className="code-badge">{active.code}</span>}</>}
      </div>
      <div className="timer-total">{t.totalToday}: {formatClock(dayTotal(state, now))}</div>

      <div className="timer-list">
        {!state.items.length && <p className="worklog-empty">{t.noTimerItems}</p>}
        {state.items.map(i => (
          <button key={i.id} className={`timer-item${i.id === activeId ? ' active' : ''}`} disabled={blocked}
            onClick={() => timer.switchTo(i.id)}>
            <span className="timer-item-label"><span>{i.label}</span>{i.code && <span className="code-badge">{i.code}</span>}</span>
            <span className="timer-item-time">{formatClock(totals[i.id] ?? 0)}</span>
          </button>
        ))}
      </div>

      {draft ? (
        <div className="timer-add">
          <EntryFields t={t} entry={draft} projects={projects} hasV4Schema={hasV4Schema} showHours={false}
            onChange={patch => setDraft(d => (d ? { ...d, ...patch } : d))} />
          <div className="timer-add-actions">
            <button className="btn-secondary" onClick={() => setDraft(null)}>{t.cancel}</button>
            <button className="btn-primary" disabled={!isDraftReady(draft, { requireHours: false })} onClick={submitDraft}>{t.add}</button>
          </div>
        </div>
      ) : (
        <button className="btn-add-entry" onClick={() => setDraft(newEntryDraft())}>{t.addTimerItem}</button>
      )}

      <div className="timer-actions">
        {state.status === 'running'
          ? <button className="btn-secondary" disabled={blocked} onClick={timer.pause}><Pause size={14} />{t.pauseTimer}</button>
          : <button className="btn-secondary" disabled={!state.segments.length} onClick={timer.resume}><Play size={14} />{t.resumeTimer}</button>}
      </div>
    </div>
  );
}
