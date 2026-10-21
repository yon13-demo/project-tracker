'use client';

import { useRef, useState } from 'react';
import { X } from 'lucide-react';
import { MAX_SHOTS_PER_ENTRY, type Shot } from '@/lib/screenshots';

export function imagesFrom(list: FileList | null | undefined): File[] {
  return Array.from(list ?? []).filter(f => f.type.startsWith('image/'));
}

// Thumbnails with a full-size viewer. With onAdd/onRemove it also takes files (click, drop) and deletes.
export function ScreenshotStrip({ t, shots, onAdd, onRemove, busy = false }: {
  t: any; shots: Shot[]; onAdd?: (files: File[]) => void; onRemove?: (path: string) => void; busy?: boolean;
}) {
  const [viewing, setViewing] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  if (!shots.length && !onAdd) return null;

  return (
    <div className="shot-strip"
      onDragOver={onAdd ? e => e.preventDefault() : undefined}
      onDrop={onAdd ? e => { e.preventDefault(); onAdd(imagesFrom(e.dataTransfer.files)); } : undefined}>
      {shots.map(s => (
        <div key={s.path} className="shot-thumb">
          <button className="shot-open" onClick={() => setViewing(s.url)}><img src={s.url} alt="" loading="lazy" /></button>
          {onRemove && <button className="shot-remove" onClick={() => onRemove(s.path)} title={t.delete}><X size={11} /></button>}
        </div>
      ))}
      {onAdd && shots.length < MAX_SHOTS_PER_ENTRY && (
        <button className="shot-add" disabled={busy} onClick={() => input.current?.click()} title={t.pasteHint}>
          {busy ? '…' : t.addScreenshot}
        </button>
      )}
      {onAdd && (
        <input ref={input} type="file" accept="image/*" multiple hidden
          onChange={e => { onAdd(imagesFrom(e.target.files)); e.target.value = ''; }} />
      )}
      {viewing && (
        <div className="modal-backdrop shot-viewer" onClick={() => setViewing(null)}>
          <img src={viewing} alt="" />
        </div>
      )}
    </div>
  );
}
