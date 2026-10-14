'use client';

import { Clock } from 'lucide-react';
import { CATEGORY_LABEL, WORK_CATEGORIES, type EntryDraft, type Project, type WorkCategory } from '@/lib/worklog';
import { ProjectCombobox } from './ProjectCombobox';

// Fields for one work entry. The work-log form shows hours; timer items do not.
export function EntryFields({ t, entry, projects, hasV4Schema, showHours = true, onChange }: {
  t: any; entry: EntryDraft; projects: Project[]; hasV4Schema: boolean; showHours?: boolean;
  onChange: (patch: Partial<EntryDraft>) => void;
}) {
  return (
    <div className="entry-row-fields">
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
          <input className="field-input" value={entry.description}
            placeholder={entry.category === 'quotation' ? t.descQuotation : entry.category === 'training' ? t.descTraining : ''}
            onChange={e => onChange({ description: e.target.value })} />
        </div>
      )}
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
