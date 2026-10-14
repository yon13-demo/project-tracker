'use client';

import { useDayTimer } from './useDayTimer';
import { TimerBody } from './TimerBody';
import type { Project, WorkLog } from '@/lib/worklog';

export function DayTimerPanel({ t, lang, userId, projects, hasV4Schema, workLogs, onSent }: {
  t: any; lang: 'id' | 'en'; userId: string; projects: Project[]; hasV4Schema: boolean; workLogs: WorkLog[]; onSent: () => void;
}) {
  const timer = useDayTimer(userId);
  const { state } = timer;

  if (!timer.isOwner) {
    return <div className="timer-panel"><p className="timer-note">{t.timerOtherWindow}</p></div>;
  }

  if (!state) {
    return (
      <button className="worklog-cta timer-cta" onClick={timer.startDay}>
        <span className="worklog-cta-title">{t.startDay}</span>
        <span className="worklog-cta-sub">{t.startDaySub}</span>
      </button>
    );
  }

  return (
    <div className="timer-panel">
      <div className="timer-header">
        <span className="worklog-section-label">{t.timerToday}</span>
        <span className="timer-total">{state.date}</span>
      </div>
      {timer.staleNotice && <p className="timer-stale">{t.timerStaleDay.replace('{date}', timer.staleNotice)}</p>}
      <TimerBody t={t} timer={timer} projects={projects} hasV4Schema={hasV4Schema} />
      <div className="timer-actions timer-footer">
        <button className="btn-primary" disabled={Boolean(state.pendingAway)} onClick={timer.startReview}>{t.finishDay}</button>
      </div>
      <p className="timer-note">{t.timerLocalNote}</p>
    </div>
  );
}
