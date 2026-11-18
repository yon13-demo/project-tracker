'use client';

import { useEffect, useMemo, useState } from 'react';
import { entryKey } from '@/lib/screenshots';
import { fetchShotCounts, type ShotCounts } from '@/lib/screenshotClient';
import { CATEGORY_LABEL, isManualProject, logProjectCode, logProjectName, type WorkLog } from '@/lib/worklog';
import { AdminShotsButton } from './AdminShotsButton';
import { ClampedText } from './ClampedText';

const PAGE_SIZE = 50;

type Group = { key: string; label: string; rows: WorkLog[]; total: number; count: number };

const shotKeyOf = (r: WorkLog) => entryKey({ category: r.category || 'project', project_id: r.project_id, custom_name: r.custom_project_name || '', description: r.description || '' });
const fmtHours = (n: number) => String(Math.round(n * 10) / 10);

function dateLabel(date: string, lang: 'id' | 'en') {
  return new Date(`${date}T00:00:00`).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
}

// Admin recap: rows grouped by day (or by person when sorted by name), 50 at a time,
// with a screenshot count only on entries that have screenshots.
export function RecordsTable({ t, lang, records, sortBy }: { t: any; lang: 'id' | 'en'; records: WorkLog[]; sortBy: 'date' | 'name' }) {
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [shotCounts, setShotCounts] = useState<ShotCounts>({});
  useEffect(() => setLimit(PAGE_SIZE), [records]);

  const groupOf = (r: WorkLog) => (sortBy === 'name' ? r.profiles?.full_name || '—' : r.log_date);

  // Totals per group over all filtered records, not only the rows shown.
  const totals = useMemo(() => {
    const m = new Map<string, { total: number; count: number }>();
    for (const r of records) {
      const g = m.get(groupOf(r)) ?? { total: 0, count: 0 };
      g.total += r.hours || 0; g.count += 1;
      m.set(groupOf(r), g);
    }
    return m;
  }, [records, sortBy]); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = records.slice(0, limit);
  const groups = useMemo(() => {
    const out: Group[] = [];
    for (const r of visible) {
      const key = groupOf(r);
      let g = out[out.length - 1];
      if (!g || g.key !== key) {
        g = { key, label: sortBy === 'name' ? key : dateLabel(key, lang), rows: [], ...(totals.get(key) ?? { total: 0, count: 0 }) };
        out.push(g);
      }
      g.rows.push(r);
    }
    return out;
  }, [visible, totals, sortBy, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  // Screenshot counts for the (user, date) days on screen that were not asked for yet.
  const pairsKey = [...new Set(visible.map(r => `${r.user_id}/${r.log_date}`))].filter(p => !(p in shotCounts)).join(',');
  useEffect(() => {
    if (!pairsKey) return;
    const days = pairsKey.split(',');
    const chunks: string[][] = [];
    for (let i = 0; i < days.length; i += 60) chunks.push(days.slice(i, i + 60));
    let cancelled = false;
    Promise.all(chunks.map(c => fetchShotCounts(c.map(d => { const [userId, date] = d.split('/'); return { userId, date }; }))))
      .then(results => {
        if (cancelled) return;
        const merged: ShotCounts = Object.fromEntries(days.map(d => [d, {}]));
        results.forEach(r => Object.assign(merged, r));
        setShotCounts(prev => ({ ...prev, ...merged }));
      })
      .catch(() => { /* indicator only: leave it empty */ });
    return () => { cancelled = true; };
  }, [pairsKey]);

  if (!records.length) return <div className="records-empty">{t.noData}</div>;

  return (
    <div className="records">
      {groups.map(g => (
        <section key={g.key} className="records-group">
          <header className="records-group-head">
            <span className="records-group-title">{g.label}</span>
            <span className="records-group-meta">{g.count} {t.entriesCount} · {fmtHours(g.total)} {t.hoursUnit}</span>
          </header>
          <div className="table-wrap records-table-wrap">
            <table className="records-table">
              <thead>
                <tr>
                  <th className="col-name">{sortBy === 'name' ? t.tanggal : t.user}</th>
                  <th className="col-project">{t.projectCol}</th>
                  <th className="col-desc">{t.deskripsiHeader}</th>
                  <th className="col-hours">{t.jamKerjaHeader}</th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map(r => {
                  const category = r.category || 'project';
                  const code = logProjectCode(r);
                  const shots = shotCounts[`${r.user_id}/${r.log_date}`]?.[shotKeyOf(r)] ?? 0;
                  return (
                    <tr key={r.id}>
                      <td className="col-name">{sortBy === 'name' ? dateLabel(r.log_date, lang) : r.profiles?.full_name}</td>
                      <td className="col-project">
                        <div className="rec-project">
                          {category === 'project'
                            ? <>{logProjectName(r) || '—'}{isManualProject(r) && <span className="hours-badge warn manual-tag">{t.manual}</span>}</>
                            : <span className={`cat-tag cat-${category}`}>{CATEGORY_LABEL[category]}</span>}
                        </div>
                        {code && <span className="code-badge">{code}</span>}
                      </td>
                      <td className="col-desc">
                        {r.description?.trim() ? <ClampedText t={t} text={r.description} /> : <span className="rec-no-desc">{t.noDescription}</span>}
                      </td>
                      <td className="col-hours">
                        <span className="rec-hours">
                          <span className="hours-badge">{fmtHours(r.hours || 0)} {t.hoursUnit}</span>
                          {shots > 0 && <AdminShotsButton t={t} log={r} count={shots} />}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      {records.length > limit && (
        <button className="btn-secondary records-more" onClick={() => setLimit(l => l + PAGE_SIZE)}>
          {t.showMoreRows} ({limit} {t.ofTotal} {records.length})
        </button>
      )}
    </div>
  );
}
