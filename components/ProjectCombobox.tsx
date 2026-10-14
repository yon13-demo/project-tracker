'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { EntryDraft, Project } from '@/lib/worklog';

// Searchable project picker; when nothing matches, the typed text can be used as a manual project.
export function ProjectCombobox({ t, entry, projects, allowManual, onChange }: {
  t: any; entry: EntryDraft; projects: Project[]; allowManual: boolean;
  onChange: (patch: Partial<EntryDraft>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const q = entry.query.trim().toLowerCase();
  const isSelectedLabel = Boolean(entry.project_id || entry.custom_name);
  const matches = isSelectedLabel || !q
    ? projects
    : projects.filter(p => `${p.name} ${p.project_code}`.toLowerCase().includes(q));
  const exact = projects.some(p => p.name.toLowerCase() === q || p.project_code.toLowerCase() === q);
  const showManual = allowManual && Boolean(q) && !exact && !isSelectedLabel;
  const optionCount = matches.length + (showManual ? 1 : 0);

  function pickProject(p: Project) {
    onChange({ project_id: p.id, custom_name: '', custom_code: '', query: `${p.name} — ${p.project_code}` });
    setOpen(false);
  }
  function pickManual() {
    onChange({ project_id: '', custom_name: entry.query.trim(), query: entry.query.trim() });
    setOpen(false);
  }
  function choose(index: number) {
    if (index < matches.length) pickProject(matches[index]);
    else if (showManual) pickManual();
  }

  return (
    <div className="combobox">
      <input
        className="field-input"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        value={entry.query}
        placeholder={t.pilihProyek}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false);
          const match = !isSelectedLabel && q && projects.find(p => p.name.toLowerCase() === q || p.project_code.toLowerCase() === q);
          if (match) pickProject(match);
        }}
        onChange={e => {
          onChange({ query: e.target.value, project_id: '', custom_name: '', custom_code: '' });
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive(a => Math.min(a + 1, optionCount - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
          else if (e.key === 'Enter' && open && optionCount) { e.preventDefault(); choose(active); }
          else if (e.key === 'Escape') setOpen(false);
        }}
      />
      {open && (
        <ul className="combobox-list" role="listbox">
          {matches.map((p, i) => (
            <li key={p.id} role="option" aria-selected={p.id === entry.project_id}
              className={`combobox-option${i === active ? ' active' : ''}`}
              onMouseDown={e => { e.preventDefault(); pickProject(p); }}
              onMouseEnter={() => setActive(i)}>
              <span>{p.name}</span><span className="code-badge">{p.project_code}</span>
            </li>
          ))}
          {showManual && (
            <li role="option" aria-selected={false}
              className={`combobox-option combobox-manual${active === matches.length ? ' active' : ''}`}
              onMouseDown={e => { e.preventDefault(); pickManual(); }}
              onMouseEnter={() => setActive(matches.length)}>
              <Plus size={13} /> {t.useManual} “{entry.query.trim()}” <span className="hours-badge warn">{t.manual}</span>
            </li>
          )}
          {!optionCount && <li className="combobox-empty">{t.noProjectMatch}</li>}
        </ul>
      )}
    </div>
  );
}
