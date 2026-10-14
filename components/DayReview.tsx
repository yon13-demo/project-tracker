'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { buildReviewRows, formatClock, refreshExistingRows, reviewRowsToEntries, type ReviewRow } from '@/lib/dayTimer';
import { saveDay, type ExistingEntry } from '@/lib/worklog';
import { supabase } from '@/lib/supabase';
import { showAlert, showStatus } from '@/lib/notify';
import type { DayTimer } from './useDayTimer';

export function DayReview({ t, timer, existing, logsLoaded, isLeave, hasV4Schema, onSent }: {
  t: any; timer: DayTimer; existing: ExistingEntry[]; logsLoaded: boolean; isLeave: boolean; hasV4Schema: boolean; onSent: () => void;
}) {
  const state = timer.state!;
  const [rows, setRows] = useState<ReviewRow[]>(() => buildReviewRows(state, Date.now(), existing));
  const [sending, setSending] = useState(false);
  // Logged rows may arrive after the review opened (e.g. reopening the app straight into review).
  const existingKey = existing.map(e => `${e.category}|${e.project_id}|${e.label}|${e.hours}|${e.description}`).join(';');
  useEffect(() => { setRows(prev => refreshExistingRows(prev, existing)); }, [existingKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = rows.reduce((s, r) => s + (r.hours > 0 ? r.hours : 0), 0);

  function update(key: string, patch: Partial<ReviewRow>) {
    setRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)));
  }

  async function send() {
    setSending(true);
    const { error } = await saveDay(supabase, state.userId, state.date, reviewRowsToEntries(rows), hasV4Schema);
    setSending(false);
    if (error) { showAlert(error); return; }
    timer.finishDay();
    showStatus(t.daySent);
    onSent();
  }

  return (
    <div className="timer-panel">
      <div className="timer-header">
        <span className="worklog-section-label">{t.reviewTitle}</span>
        <span className="timer-total">{state.date}</span>
      </div>
      {isLeave && <p className="timer-stale">{t.reviewLeaveNotice}</p>}
      <div className="review-list">
        {rows.map(r => (
          <div key={r.key} className={`review-row${r.hours > 0 ? '' : ' is-zero'}`}>
            <div className="review-row-head">
              <span>{r.label}</span>
              {r.code && <span className="code-badge">{r.code}</span>}
              {r.source === 'existing' && <span className="hours-badge">{t.alreadyLogged}</span>}
            </div>
            {r.trackedMs !== null && <div className="review-row-meta">{t.tracked}: {formatClock(r.trackedMs)}</div>}
            {hasV4Schema && (
              <input className="field-input" value={r.description} placeholder={t.deskripsi}
                onChange={e => update(r.key, { description: e.target.value })} />
            )}
            <div className="hours-input-wrap">
              <input type="number" min="0" max="24" step="0.5" className="field-input hours-input"
                value={r.hours} onChange={e => update(r.key, { hours: Number(e.target.value) || 0 })} />
              <span className="hours-unit">jam</span>
            </div>
            <button className="btn-remove-entry" title={t.delete} onClick={() => setRows(prev => prev.filter(x => x.key !== r.key))}><X size={14} /></button>
          </div>
        ))}
      </div>
      <p className="review-total">{t.reviewTotal}: {total} jam · {t.reviewZeroHint}</p>
      <div className="timer-actions timer-footer">
        <button className="btn-secondary" disabled={sending} onClick={timer.backToTimer}>{t.backToTimer}</button>
        <button className="btn-primary" disabled={sending || !logsLoaded} onClick={() => void send()}>{sending ? '…' : t.send}</button>
      </div>
    </div>
  );
}
