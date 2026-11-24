'use client';

import { PROGRESS_STEPS } from '@/lib/tasks';

const pct = (v: number) => `${Math.round(v * 100)}%`;

// The 0 · 20 · 50 · 80 · 100% row. `approved` is the task's approved progress (filled);
// `value` is the step this entry proposes (outlined, "menunggu"), or null for no change.
// Tapping the chosen step again, or the approved one, clears the proposal.
export function ProgressSteps({ t, approved, value, onChange, disabled = false, label }: {
  t: any; approved: number; value: number | null; onChange: (next: number | null) => void; disabled?: boolean; label?: string;
}) {
  const proposing = value != null && value !== approved;
  const pick = (s: number) => onChange(s === approved || s === value ? null : s);
  const move = (dir: 1 | -1) => {
    const current = proposing ? value! : approved;
    const i = PROGRESS_STEPS.indexOf(current as (typeof PROGRESS_STEPS)[number]);
    const next = PROGRESS_STEPS[Math.min(PROGRESS_STEPS.length - 1, Math.max(0, i + dir))];
    onChange(next === approved ? null : next);
  };
  return (
    <div className="progress-steps-wrap">
      <div className="progress-steps" role="radiogroup" aria-label={label ?? t.progress}
        onKeyDown={e => {
          if (disabled) return;
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); move(1); }
          else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); move(-1); }
        }}>
        {PROGRESS_STEPS.map((s, i) => {
          const isApproved = s === approved;
          const isChosen = proposing && s === value;
          const checked = isChosen || (!proposing && isApproved);
          return (
            <button key={s} type="button" role="radio" aria-checked={checked} disabled={disabled}
              tabIndex={checked ? 0 : -1}
              className={`progress-step${s <= approved ? ' done' : ''}${isApproved ? ' approved' : ''}${isChosen ? ' chosen' : ''}${isChosen && s < approved ? ' down' : ''}`}
              onClick={() => pick(s)}>
              <span className="progress-step-pct">{pct(s)}</span>
              <span className="progress-step-label">{t[`step${i}`]}</span>
            </button>
          );
        })}
      </div>
      <p className="progress-steps-note" aria-live="polite">
        {proposing
          ? <>{t.progressApproved} {pct(approved)} → <strong>{pct(value!)}</strong>{value! < approved ? ` (${t.progressDown})` : ''} · <span className="pending-tag">{t.pendingReview}</span></>
          : <>{t.progressApproved} {pct(approved)}</>}
      </p>
    </div>
  );
}
