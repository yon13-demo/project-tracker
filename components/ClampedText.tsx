'use client';

import { useLayoutEffect, useRef, useState } from 'react';

// Multi-line text cut to 2 lines, with "show more" only when it is actually longer.
export function ClampedText({ t, text }: { t: any; text: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el && !open) setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [text, open]);

  if (!text.trim()) return null;
  return (
    <div className="clamped">
      <div ref={ref} className={`clamped-text${open ? ' open' : ''}`}>{text}</div>
      {(overflows || open) && (
        <button className="link-button" onClick={() => setOpen(o => !o)}>{open ? t.showLess : t.showMore}</button>
      )}
    </div>
  );
}
