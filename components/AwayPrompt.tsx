'use client';

import { useState } from 'react';
import type { DayTimer } from './useDayTimer';

export function AwayPrompt({ t, timer }: { t: any; timer: DayTimer }) {
  const [moving, setMoving] = useState(false);
  const [target, setTarget] = useState('');
  const away = timer.state?.pendingAway;
  if (!timer.state || !away) return null;
  const item = timer.state.items.find(i => i.id === away.itemId);
  const label = item?.label ?? '';
  const minutes = Math.round((away.end - away.start) / 60_000);
  const others = timer.state.items.filter(i => i.id !== away.itemId);

  return (
    <div className="timer-away" role="alertdialog">
      <p>{t.awayMessage.replace('{min}', String(minutes)).replace('{item}', label)}</p>
      {moving ? (
        <div className="timer-away-actions">
          <select className="field-input" value={target} onChange={e => setTarget(e.target.value)}>
            <option value="">—</option>
            {others.map(i => <option key={i.id} value={i.id}>{i.label}</option>)}
          </select>
          <button className="btn-primary" disabled={!target} onClick={() => timer.resolveAway({ type: 'move', itemId: target })}>{t.awayMoveTo}</button>
          <button className="btn-secondary" onClick={() => setMoving(false)}>{t.cancel}</button>
        </div>
      ) : (
        <div className="timer-away-actions">
          <button className="btn-primary" onClick={() => timer.resolveAway({ type: 'keep' })}>{t.awayKeep.replace('{item}', label)}</button>
          {others.length > 0 && <button className="btn-secondary" onClick={() => setMoving(true)}>{t.awayMove}</button>}
          <button className="btn-secondary" onClick={() => timer.resolveAway({ type: 'discard' })}>{t.awayDiscard}</button>
        </div>
      )}
    </div>
  );
}
