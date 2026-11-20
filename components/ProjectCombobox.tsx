'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { codeMatches } from '@/lib/manualMerge';
import type { EntryDraft, Project, RecentProject } from '@/lib/worklog';

const CHIPS = 4;

type Option = { key: string; name: string; code: string; recent: boolean; byCode?: boolean; selected: boolean; pick: () => void };

// Searchable project picker; when nothing matches, the typed text can be used as a manual project.
// The user's recently logged projects come first in the list and as one-tap chips under the input.
export function ProjectCombobox({ t, entry, projects, recent = [], allowManual, onChange }: {
  t: any; entry: EntryDraft; projects: Project[]; recent?: RecentProject[]; allowManual: boolean;
  onChange: (patch: Partial<EntryDraft>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const q = entry.query.trim().toLowerCase();
  const isSelectedLabel = Boolean(entry.project_id || entry.custom_name);
  const searching = Boolean(q) && !isSelectedLabel;

  function pickProject(p: Project) {
    onChange({ project_id: p.id, custom_name: '', custom_code: '', query: `${p.name} — ${p.project_code}` });
    setOpen(false);
  }
  function pickRecent(r: RecentProject) {
    const p = r.project_id && projects.find(x => x.id === r.project_id);
    if (p) return pickProject(p);
    onChange({ project_id: '', custom_name: r.name, custom_code: r.code, query: r.name });
    setOpen(false);
  }
  function pickManual() {
    onChange({ project_id: '', custom_name: entry.query.trim(), query: entry.query.trim() });
    setOpen(false);
  }

  const recentIds = new Set(recent.map(r => r.project_id).filter(Boolean));
  const fromRecent = (r: RecentProject): Option => ({
    key: r.project_id ? `p:${r.project_id}` : `m:${r.name.toLowerCase()}`, name: r.name, code: r.code, recent: true,
    selected: r.project_id ? r.project_id === entry.project_id : !entry.project_id && r.name === entry.custom_name,
    pick: () => pickRecent(r),
  });
  const fromProject = (p: Project): Option => ({
    key: `p:${p.id}`, name: p.name, code: p.project_code, recent: false, selected: p.id === entry.project_id, pick: () => pickProject(p),
  });
  const hit = (name: string, code: string) => `${name} ${code}`.toLowerCase().includes(q);
  // "2260301_LOreal Canada…" names a registered project by its number even when the rest differs:
  // offer that project first so it is picked instead of a new manual one.
  const byCode = searching ? codeMatches(entry.query, projects) : [];
  const byCodeIds = new Set(byCode.map(p => p.id));
  const options: Option[] = [
    ...byCode.map(p => ({ ...fromProject(p), byCode: true })),
    ...recent.filter(r => !byCodeIds.has(r.project_id) && (!searching || hit(r.name, r.code))).map(fromRecent),
    ...projects.filter(p => !recentIds.has(p.id) && !byCodeIds.has(p.id) && (!searching || hit(p.name, p.project_code))).map(fromProject),
  ];
  const exact = projects.some(p => p.name.toLowerCase() === q || p.project_code.toLowerCase() === q)
    || recent.some(r => r.name.toLowerCase() === q);
  const showManual = allowManual && searching && !exact;
  const optionCount = options.length + (showManual ? 1 : 0);
  const codeCount = byCode.length;
  const recentCount = options.filter(o => o.recent).length;
  const grouped = codeCount > 0 || (recentCount > 0 && recentCount < options.length);
  const groupAt: Record<number, { label: string; match?: boolean }> = {};
  if (grouped) {
    if (codeCount) groupAt[0] = { label: t.matchByCode, match: true };
    if (recentCount) groupAt[codeCount] = { label: t.recentProjects };
    if (options.length > codeCount + recentCount) groupAt[codeCount + recentCount] = { label: t.allProjects };
  }

  function choose(index: number) {
    if (index < options.length) options[index].pick();
    else if (showManual) pickManual();
  }

  const chips = isSelectedLabel || searching ? [] : recent.slice(0, CHIPS);

  return (
    <div className="combobox">
      <input
        className="field-input"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        value={entry.query}
        placeholder={t.pilihProyek}
        onFocus={() => { setActive(0); setOpen(true); }}
        onBlur={() => {
          setOpen(false);
          const match = searching && projects.find(p => p.name.toLowerCase() === q || p.project_code.toLowerCase() === q);
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
          {options.map((o, i) => (
            <li key={o.key} role="presentation" className="combobox-item">
              {groupAt[i] && <div className={`combobox-group${groupAt[i].match ? ' match' : ''}`}>{groupAt[i].label}</div>}
              <div role="option" aria-selected={o.selected}
                className={`combobox-option${i === active ? ' active' : ''}`}
                onMouseDown={e => { e.preventDefault(); o.pick(); }}
                onMouseEnter={() => setActive(i)}>
                <span>{o.name}</span>
                {o.code && <span className="code-badge">{o.code}</span>}
              </div>
            </li>
          ))}
          {showManual && (
            <li role="option" aria-selected={false}
              className={`combobox-option combobox-manual${active === options.length ? ' active' : ''}`}
              onMouseDown={e => { e.preventDefault(); pickManual(); }}
              onMouseEnter={() => setActive(options.length)}>
              <Plus size={13} /> {t.useManual} “{entry.query.trim()}” <span className="hours-badge warn">{t.manual}</span>
            </li>
          )}
          {!optionCount && <li className="combobox-empty">{t.noProjectMatch}</li>}
        </ul>
      )}
      {chips.length > 0 && (
        <div className="recent-chips" aria-label={t.recentProjects}>
          <span className="recent-chips-label">{t.recentShort}</span>
          {chips.map(r => (
            <button key={r.project_id || `m:${r.name}`} type="button" className="recent-chip" title={r.code ? `${r.name} — ${r.code}` : r.name}
              onClick={() => pickRecent(r)}>
              {r.code && <strong>{r.code}</strong>}<span>{r.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
