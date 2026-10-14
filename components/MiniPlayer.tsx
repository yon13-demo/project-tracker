'use client';

import { ChevronDown, Pause, Play } from 'lucide-react';
import { currentItemId, dayTotal, formatClock, itemTotals } from '@/lib/dayTimer';
import { AwayPrompt } from './AwayPrompt';
import type { DayTimer } from './useDayTimer';

// Collapsed mini window: one play/pause button, what is running, and the clock — like a radio player.
export function MiniPlayer({ t, timer, onExpand }: { t: any; timer: DayTimer; onExpand: () => void }) {
  const { state, now } = timer;
  if (!state) return null;
  const activeId = currentItemId(state);
  const running = state.status === 'running';
  const lastId = activeId ?? state.segments[state.segments.length - 1]?.itemId;
  const item = state.items.find(i => i.id === lastId);
  const clock = lastId ? itemTotals(state, now)[lastId] ?? 0 : dayTotal(state, now);
  const blocked = Boolean(state.pendingAway);

  return (
    <div className="mini-player-wrap">
      <AwayPrompt t={t} timer={timer} />
      <div className="mini-player">
        <button className={`mini-play${running ? ' is-running' : ''}`} disabled={blocked || (!running && !state.segments.length)}
          onClick={running ? timer.pause : timer.resume} title={running ? t.pauseTimer : t.resumeTimer}>
          {running ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <div className="mini-info">
          <div className="mini-title">{item?.label ?? t.noTimerItems}</div>
          <div className="mini-clock">{formatClock(clock)} <span>· {t.totalToday}: {formatClock(dayTotal(state, now))}</span></div>
        </div>
        <button className="btn-ghost-icon mini-expand" onClick={onExpand} title={t.expand}><ChevronDown size={18} /></button>
      </div>
    </div>
  );
}
