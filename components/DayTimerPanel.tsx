'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronUp, ExternalLink } from 'lucide-react';
import { useDayTimer } from './useDayTimer';
import { usePipWindow } from './usePipWindow';
import { TimerBody } from './TimerBody';
import { MiniPlayer } from './MiniPlayer';
import { DayReview } from './DayReview';
import { isLeaveDate, workLogToExistingEntry, type Project, type WorkLog } from '@/lib/worklog';

export function DayTimerPanel({ t, lang, userId, projects, hasV4Schema, workLogs, logsLoaded, onSent }: {
  t: any; lang: 'id' | 'en'; userId: string; projects: Project[]; hasV4Schema: boolean; workLogs: WorkLog[]; logsLoaded: boolean; onSent: () => void;
}) {
  const timer = useDayTimer(userId);
  const pip = usePipWindow();
  const [miniExpanded, setMiniExpanded] = useState(false);
  const { state } = timer;
  const devBadge = <span className="dev-badge">{t.inDevelopment}</span>;

  function setMini(expanded: boolean) {
    setMiniExpanded(expanded);
    if (expanded) pip.resize(340, 460); else pip.resize(340, 130);
  }

  if (!timer.isOwner) {
    return <div className="timer-panel"><p className="timer-note">{t.timerOtherWindow}</p></div>;
  }

  if (!state) {
    return (
      <button className="worklog-cta timer-cta" onClick={timer.startDay}>
        <span className="worklog-cta-title">{t.startDay} {devBadge}</span>
        <span className="worklog-cta-sub">{t.startDaySub}</span>
      </button>
    );
  }

  if (state.status === 'review') {
    const existing = workLogs.filter(w => w.log_date === state.date && !w.is_leave).map(workLogToExistingEntry);
    return (
      <>
        {timer.staleNotice && <p className="timer-stale">{t.timerStaleDay.replace('{date}', timer.staleNotice)}</p>}
        <DayReview t={t} timer={timer} existing={existing} logsLoaded={logsLoaded} isLeave={isLeaveDate(workLogs, state.date)}
          hasV4Schema={hasV4Schema} onSent={onSent} />
      </>
    );
  }

  return (
    <div className="timer-panel">
      <div className="timer-header">
        <span className="worklog-section-label">{t.timerToday} {devBadge}</span>
        <span className="timer-total">{state.date}</span>
      </div>
      {timer.staleNotice && <p className="timer-stale">{t.timerStaleDay.replace('{date}', timer.staleNotice)}</p>}
      <TimerBody t={t} timer={timer} projects={projects} hasV4Schema={hasV4Schema} />
      <div className="timer-actions timer-footer">
        {pip.supported && !pip.pipWindow && (
          <button className="btn-secondary" onClick={() => { setMiniExpanded(false); void pip.open(); }}><ExternalLink size={14} />{t.popOut}</button>
        )}
        <button className="btn-primary" disabled={Boolean(state.pendingAway)}
          onClick={() => { pip.close(); timer.startReview(); }}>{t.finishDay}</button>
      </div>
      {pip.pipWindow && createPortal(
        miniExpanded ? (
          <div className="timer-panel">
            <button className="btn-ghost-icon mini-collapse" onClick={() => setMini(false)} title={t.collapse}><ChevronUp size={18} /></button>
            <TimerBody t={t} timer={timer} projects={projects} hasV4Schema={hasV4Schema} compact />
          </div>
        ) : (
          <MiniPlayer t={t} timer={timer} onExpand={() => setMini(true)} />
        ),
        pip.pipWindow.document.body,
      )}
      <p className="timer-note">{t.timerLocalNote}</p>
    </div>
  );
}
