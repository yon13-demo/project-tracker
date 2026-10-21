'use client';

import { useState } from 'react';
import { Camera, X } from 'lucide-react';
import { entryKey, type Shot } from '@/lib/screenshots';
import { fetchEntryShots } from '@/lib/screenshotClient';
import type { WorkLog } from '@/lib/worklog';
import { ScreenshotStrip } from './ScreenshotStrip';

// Admin recap: load one entry's screenshots on demand (no bulk listing of every user).
export function AdminShotsButton({ t, log }: { t: any; log: WorkLog }) {
  const [shots, setShots] = useState<Shot[] | null>(null);
  const [loading, setLoading] = useState(false);
  const key = entryKey({ category: log.category || 'project', project_id: log.project_id, custom_name: log.custom_project_name || '', description: log.description || '' });

  async function open() {
    setLoading(true);
    try { setShots(await fetchEntryShots(log.user_id, log.log_date, key)); } catch { setShots([]); }
    setLoading(false);
  }

  return (
    <>
      <button className="btn-action" onClick={() => void open()} disabled={loading} title={t.screenshotsTitle}><Camera size={13} /></button>
      {shots && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShots(null)}>
          <div className="modal shot-modal">
            <div className="modal-header">
              <h2>{t.screenshotsTitle} · {log.profiles?.full_name} · {log.log_date}</h2>
              <button className="btn-ghost-icon" onClick={() => setShots(null)}><X size={18} /></button>
            </div>
            <div className="shot-modal-body">
              {shots.length ? <ScreenshotStrip t={t} shots={shots} /> : <p>{t.noScreenshots}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
