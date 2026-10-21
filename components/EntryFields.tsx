'use client';

import type { ReactNode } from 'react';
import { Clock } from 'lucide-react';
import { CATEGORY_LABEL, WORK_CATEGORIES, type EntryDraft, type Project, type WorkCategory } from '@/lib/worklog';
import { ProjectCombobox } from './ProjectCombobox';
import { imagesFrom } from './ScreenshotStrip';

// Fields for one work entry. The work-log form shows hours; timer items do not.
// Grow a textarea with its content (min 2 lines).
function autoGrow(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight + 2}px`;
}

export function EntryFields({ t, entry, projects, hasV4Schema, showHours = true, onChange, onPasteFiles, extra }: {
  t: any; entry: EntryDraft; projects: Project[]; hasV4Schema: boolean; showHours?: boolean;
  onChange: (patch: Partial<EntryDraft>) => void;
  onPasteFiles?: (files: File[]) => void; // e.g. Win+Shift+S then Ctrl+V anywhere in the row
  extra?: ReactNode;
}) {
  return (
    <div className="entry-row-fields" onPaste={onPasteFiles ? e => {
      const files = imagesFrom(e.clipboardData.files);
      if (files.length) { e.preventDefault(); onPasteFiles(files); }
    } : undefined}>
      {hasV4Schema && (
        <div className="entry-field">
          <label>{t.kategori}</label>
          <select className="field-input" value={entry.category}
            onChange={e => onChange({ category: e.target.value as WorkCategory, project_id: '', custom_name: '', custom_code: '', query: '' })}>
            {WORK_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </select>
        </div>
      )}
      {entry.category === 'project' && (
        <div className="entry-field">
          <label>{t.namaProyek} / {t.nomorProyek}</label>
          <ProjectCombobox t={t} entry={entry} projects={projects} allowManual={hasV4Schema} onChange={onChange} />
        </div>
      )}
      {entry.category === 'project' && !entry.project_id && entry.custom_name && (
        <div className="entry-field">
          <label>{t.manualCode}</label>
          <input className="field-input" value={entry.custom_code} onChange={e => onChange({ custom_code: e.target.value })} />
        </div>
      )}
      {hasV4Schema && (
        <div className="entry-field">
          <label>{t.deskripsi}</label>
          <textarea className="field-input entry-description" rows={2} value={entry.description} ref={autoGrow}
            placeholder={entry.category === 'quotation' ? t.descQuotation : entry.category === 'training' ? t.descTraining : ''}
            onChange={e => { autoGrow(e.target); onChange({ description: e.target.value }); }} />
        </div>
      )}
      {extra}
      {showHours && (
        <div className="entry-field entry-field-hours">
          <label>{t.inputHours}</label>
          <div className="hours-input-wrap">
            <Clock size={14} className="hours-icon" />
            <input type="number" min="0.5" max="24" step="0.5" className="field-input hours-input"
              value={entry.hours} onChange={e => onChange({ hours: e.target.value })} placeholder="0" />
            <span className="hours-unit">jam</span>
          </div>
        </div>
      )}
    </div>
  );
}
