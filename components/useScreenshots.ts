'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_SHOTS_PER_ENTRY, type ShotsByDate } from '@/lib/screenshots';
import { deleteDayScreenshots, deleteScreenshot, fetchShots, uploadScreenshot } from '@/lib/screenshotClient';

// The current user's screenshots for the given dates, plus upload/remove.
export function useScreenshots(dates: string[], onError: (message: string) => void, maxMessage: string) {
  const [shots, setShots] = useState<ShotsByDate>({});
  const [busy, setBusy] = useState<string | null>(null);
  const datesKey = dates.join(',');
  const requested = useRef(new Set<string>()); // dates already asked for: a new entry day only fetches that day

  useEffect(() => {
    const missing = datesKey ? datesKey.split(',').filter(d => !requested.current.has(d)) : [];
    if (!missing.length) return;
    missing.forEach(d => requested.current.add(d));
    fetchShots(missing)
      .then(s => setShots(prev => ({ ...prev, ...s })))
      .catch(() => { missing.forEach(d => requested.current.delete(d)); /* storage not reachable: show none, retry later */ });
  }, [datesKey]);

  const upload = useCallback(async (date: string, key: string, files: File[]) => {
    if (!files.length) return;
    const room = MAX_SHOTS_PER_ENTRY - (shots[date]?.[key]?.length ?? 0);
    if (files.length > room) onError(maxMessage);
    setBusy(`${date}/${key}`);
    try {
      for (const file of files.slice(0, Math.max(0, room))) {
        const shot = await uploadScreenshot(date, key, file);
        setShots(prev => ({ ...prev, [date]: { ...prev[date], [key]: [...(prev[date]?.[key] ?? []), shot] } }));
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }, [shots, onError, maxMessage]);

  const remove = useCallback(async (path: string) => {
    const [, date, key] = path.split('/');
    setShots(prev => ({ ...prev, [date]: { ...prev[date], [key]: (prev[date]?.[key] ?? []).filter(s => s.path !== path) } }));
    try { await deleteScreenshot(path); } catch (e) { onError(e instanceof Error ? e.message : String(e)); }
  }, [onError]);

  const removeDay = useCallback(async (date: string) => {
    setShots(prev => { const next = { ...prev }; delete next[date]; return next; });
    try { await deleteDayScreenshots(date); } catch { /* the day is already gone; leftovers are harmless */ }
  }, []);

  return { shots, busy, upload, remove, removeDay };
}
