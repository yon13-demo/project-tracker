'use client';

// TV dashboard (WEAVE_DASHBOARD.md): one 1920×1080 screen, no login. Reads weave_dashboard() with the
// publishable key and only displays — every figure is computed in the database. Also fine on a laptop;
// on a phone the panels stack. ?theme=light for a light screen (default dark), ?date=YYYY-MM-DD for a past day.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  clockWib, fmtDelta, fmtHours, fmtPct, rateStatus, shortDay,
  type Dashboard, type DashProjectProgress, type Status,
} from '@/lib/dashboard';

const POLL_MS = 5 * 60 * 1000;
const RETRY_MS = 60 * 1000;
const CAT_COLOR: Record<string, string> = { project: 'var(--series-1)', quotation: 'var(--series-2)', training: 'var(--series-3)', other: 'var(--series-4)' };
const STATUS_ICON: Record<Status, string> = { good: '✓', warn: '!', bad: '✕', none: '' };
const SHORT_DISCIPLINE: Record<string, string> = { electrical_automation: 'Elec & Automation', manufacturing: 'Manufacture' };

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offlineSince, setOfflineSince] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(async () => {
    const params = new URLSearchParams(window.location.search);
    const date = params.get('date');
    const { data: res, error: err } = await supabase.rpc('weave_dashboard', date ? { p_date: date } : {});
    if (err) {
      setError(err.message);
      setOfflineSince(s => s ?? new Date().toISOString());
      return false;
    }
    setData(res as Dashboard);
    setError(null);
    setOfflineSince(null);
    return true;
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    document.documentElement.dataset.theme = params.get('theme') === 'light' ? 'light' : 'dark';
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => { const ok = await load(); timer = setTimeout(tick, ok ? POLL_MS : RETRY_MS); };
    void tick();
    const clock = setInterval(() => setNow(new Date()), 30_000);
    return () => { clearTimeout(timer); clearInterval(clock); };
  }, [load]);

  if (!data) {
    return (
      <main className="dash dash-loading">
        <p>{error ? `Dashboard belum bisa dimuat: ${error}` : 'Memuat dashboard…'}</p>
      </main>
    );
  }

  const empty = data.hours.month === 0 && data.top_projects_month.length === 0;
  const today = data.attendance.today;
  return (
    <main className="dash">
      <header className="dash-header">
        <div className="dash-title">
          <strong>Weave</strong>
          <span>Minggu {data.periods.week.iso_week} · {new Date(`${data.date}T00:00:00Z`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}</span>
        </div>
        <div className="dash-meta">
          {offlineSince && <span className="dash-badge bad">✕ Offline sejak {clockWib(offlineSince)}</span>}
          {today.is_stale && <span className="dash-badge warn">! Absensi belum diperbarui{today.synced_at ? ` sejak ${clockWib(today.synced_at)}` : ''}</span>}
          <span>Diperbarui {clockWib(data.generated_at)}</span>
          <span className="dash-clock">{clockWib(now.toISOString())}</span>
        </div>
      </header>

      {empty ? (
        <section className="dash-empty">
          <h2>Belum ada jam kerja tercatat bulan ini</h2>
          <p>Data muncul setelah tim mengisi Weave.</p>
        </section>
      ) : (
        <div className="dash-grid">
          <ReportingTile r={data.reporting} />
          <HoursTile label="Jam minggu ini" note="sampai hari ini" hours={data.hours.week} change={data.hours.week_change_pct} prev="vs minggu lalu" />
          <HoursTile label="Jam bulan ini" note={`${shortDay(`${data.date.slice(0, 8)}01`)} – ${shortDay(data.date)}`} hours={data.hours.month} change={data.hours.month_change_pct} prev="vs bulan lalu" />
          <AttendanceTile a={data.attendance.today} />

          <ProjectProgressPanel projects={data.project_progress} />
          <TopProjectsPanel d={data} />

          <WeeklyPanel weeks={data.weekly_trend} />
          <CategoryPanel cats={data.categories_week} total={data.hours.week} />
          <CoveragePanel c={data.attendance.comparison} />
        </div>
      )}
    </main>
  );
}

function Panel({ title, sub, className = '', children }: { title: string; sub?: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={`dash-panel ${className}`}>
      <h2>{title}{sub && <span>{sub}</span>}</h2>
      {children}
    </section>
  );
}

function ReportingTile({ r }: { r: Dashboard['reporting'] }) {
  const status = r.expected ? rateStatus(r.rate_pct, 90, 70) : 'none';
  const ratio = r.expected ? r.reported / r.expected : 0;
  const C = 2 * Math.PI * 42;
  return (
    <Panel title="Lapor kemarin" sub={shortDay(r.date)} className="dash-kpi dash-k1">
      <div className="dash-ring-row">
        <svg viewBox="0 0 100 100" className={`dash-ring ${status}`} role="img" aria-label={`${r.reported} dari ${r.expected} orang melapor`}>
          <circle cx="50" cy="50" r="42" className="track" />
          <circle cx="50" cy="50" r="42" className="value" strokeDasharray={`${C * ratio} ${C}`} transform="rotate(-90 50 50)" />
          <text x="50" y="55" textAnchor="middle">{fmtPct(r.rate_pct)}</text>
        </svg>
        <div>
          <div className="dash-big">{r.expected ? <>{r.reported}<small> / {r.expected}</small></> : '—'}</div>
          <div className={`dash-status ${status}`}>{status !== 'none' && <b aria-hidden>{STATUS_ICON[status]}</b>} target {r.target_pct}%</div>
          <div className="dash-note">Streak ≥90%: <b>{r.streak_days}</b> hari kerja</div>
        </div>
      </div>
    </Panel>
  );
}

function HoursTile({ label, note, hours, change, prev }: { label: string; note: string; hours: number; change: number | null; prev: string }) {
  const d = fmtDelta(change);
  return (
    <Panel title={label} sub={note} className="dash-kpi">
      <div className="dash-big">{fmtHours(hours)}<small> jam</small></div>
      <div className={`dash-delta ${d.dir}`}>{d.text} <span>{prev}</span></div>
    </Panel>
  );
}

function AttendanceTile({ a }: { a: Dashboard['attendance']['today'] }) {
  const lateWarn = a.not_clocked_in > 0 && new Date().getUTCHours() + 7 >= 9;
  return (
    <Panel title="Absensi hari ini" sub={a.synced_at ? `per ${clockWib(a.synced_at)}` : 'belum tersedia'} className={`dash-kpi${a.is_stale ? ' is-stale' : ''}`}>
      {a.synced_at ? (
        <div className="dash-att">
          <div><b>{a.clocked_in}</b><span>Masuk</span></div>
          <div><b>{a.still_in}</b><span>Di kantor</span></div>
          <div><b>{a.on_leave}</b><span>Cuti</span></div>
          <div className={lateWarn ? 'warn' : ''}><b>{a.not_clocked_in}</b><span>{lateWarn ? '! ' : ''}Belum absen</span></div>
        </div>
      ) : <p className="dash-note">Data absensi belum tersedia</p>}
    </Panel>
  );
}

function ProjectProgressPanel({ projects }: { projects?: DashProjectProgress[] }) {
  return (
    <Panel title="Progres proyek" sub="dari tugas yang disetujui" className="dash-progress">
      {!projects ? <p className="dash-note">Jalankan schema-v9 untuk menampilkan progres proyek.</p>
        : !projects.length ? <p className="dash-note">Belum ada proyek dengan daftar tugas.</p>
        : (
          <ul className="dash-projects">
            {projects.map(p => (
              <li key={p.code}>
                <div className="dash-project-head">
                  <span className="dash-code">{p.code}</span>
                  <span className="dash-project-name">{p.name}</span>
                  <span className="dash-project-pct">{fmtPct(p.overall)}</span>
                </div>
                <div className="dash-meter" role="img" aria-label={`Progres ${fmtPct(p.overall)}`}><i style={{ width: `${p.overall ?? 0}%` }} /></div>
                <div className="dash-disciplines">
                  {p.disciplines.map(d => (
                    <div key={d.key} className="dash-discipline" title={`${d.label}: ${d.done} dari ${d.tasks} tugas selesai`}>
                      <span className="dash-discipline-label">{SHORT_DISCIPLINE[d.key] ?? d.label}</span>
                      <span className="dash-mini"><i style={{ width: `${d.progress_pct}%` }} /></span>
                      <span className="dash-discipline-pct">{fmtPct(d.progress_pct)}</span>
                    </div>
                  ))}
                </div>
                <div className="dash-project-foot">
                  <span>{p.tasks_done} / {p.tasks_total} tugas selesai</span>
                  <span>{fmtHours(p.hours_month)} jam bulan ini</span>
                  {p.pending > 0 && <span className="dash-badge warn">! {p.pending} progres menunggu persetujuan</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
    </Panel>
  );
}

function TopProjectsPanel({ d }: { d: Dashboard }) {
  const rows = d.top_projects_month;
  const max = Math.max(...rows.map(r => r.hours), d.other_projects_month_hours, 1);
  const manual = d.manual_projects_month;
  return (
    <Panel title="Top proyek bulan ini" sub="jam" className="dash-top">
      {!rows.length ? <p className="dash-note">Belum ada jam proyek bulan ini</p> : (
        <ul className="dash-bars">
          {rows.map(r => (
            <li key={r.code} title={`${r.code} ${r.name}: ${fmtHours(r.hours)} jam · ${r.people} orang · ${fmtPct(r.share_pct)} dari semua jam`}>
              <span className="dash-bar-label"><b>{r.code}</b> {r.name}</span>
              <span className="dash-bar"><i style={{ width: `${(r.hours / max) * 100}%` }} /></span>
              <span className="dash-bar-value">{fmtHours(r.hours)}<small> · {r.people} org</small></span>
            </li>
          ))}
          {d.other_projects_month_hours > 0 && (
            <li className="muted">
              <span className="dash-bar-label">Proyek lain</span>
              <span className="dash-bar"><i style={{ width: `${(d.other_projects_month_hours / max) * 100}%` }} /></span>
              <span className="dash-bar-value">{fmtHours(d.other_projects_month_hours)}</span>
            </li>
          )}
        </ul>
      )}
      {manual.entries > 0 && (
        <p className={`dash-chip${(manual.share_pct ?? 0) > 5 ? ' warn' : ''}`}>
          {(manual.share_pct ?? 0) > 5 ? '! ' : ''}Entri manual: {manual.entries} entri · {fmtPct(manual.share_pct)} jam proyek
        </p>
      )}
    </Panel>
  );
}

function WeeklyPanel({ weeks }: { weeks: Dashboard['weekly_trend'] }) {
  const max = Math.max(...weeks.map(w => w.hours), 1);
  return (
    <Panel title="Jam per minggu" sub="8 minggu terakhir" className="dash-weeks">
      <div className="dash-cols" role="img" aria-label={weeks.map(w => `minggu ${w.iso_week}: ${fmtHours(w.hours)} jam`).join(', ')}>
        {weeks.map(w => (
          <div key={w.week_start} className={`dash-col${w.partial ? ' partial' : ''}`} title={`Minggu ${w.iso_week} (mulai ${shortDay(w.week_start)}): ${fmtHours(w.hours)} jam${w.partial ? ', berjalan' : ''}`}>
            <span className="dash-col-val">{fmtHours(w.hours)}</span>
            <span className="dash-col-bar" style={{ height: `${Math.max((w.hours / max) * 100, 1.5)}%` }} />
            <span className="dash-col-label">M{w.iso_week}{w.partial ? '*' : ''}</span>
          </div>
        ))}
      </div>
      <p className="dash-note">* minggu berjalan, belum lengkap</p>
    </Panel>
  );
}

function CategoryPanel({ cats, total }: { cats: Dashboard['categories_week']; total: number }) {
  const shown = cats.filter(c => (c.share_pct ?? 0) >= 1);
  return (
    <Panel title="Kategori minggu ini" className="dash-cats">
      {total === 0 ? <p className="dash-note">Belum ada jam minggu ini</p> : (
        <>
          <div className="dash-stack" role="img" aria-label={cats.map(c => `${c.label} ${fmtPct(c.share_pct)}`).join(', ')}>
            {shown.map(c => <i key={c.key} style={{ width: `${c.share_pct}%`, background: CAT_COLOR[c.key] }} title={`${c.label}: ${fmtHours(c.hours)} jam (${fmtPct(c.share_pct)})`} />)}
          </div>
          <ul className="dash-legend">
            {cats.map(c => (
              <li key={c.key}><span className="dash-swatch" style={{ background: CAT_COLOR[c.key] }} />{c.label}<b>{fmtHours(c.hours)} j</b><span>{fmtPct(c.share_pct)}</span></li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

function CoveragePanel({ c }: { c: Dashboard['attendance']['comparison'] }) {
  const status = rateStatus(c.coverage_pct, 90, 75);
  const max = Math.max(c.clocked_hours, c.logged_hours, 1);
  return (
    <Panel title="Tercatat vs absensi" sub={`${shortDay(c.from)} – ${shortDay(c.to)}`} className="dash-coverage">
      {c.clocked_hours === 0 ? <p className="dash-note">Belum ada data absensi</p> : (
        <>
          <div className={`dash-big dash-status ${status}`}><b aria-hidden>{STATUS_ICON[status]}</b> {fmtPct(c.coverage_pct)}</div>
          <div className="dash-pair">
            <span>Absensi</span><span className="dash-bar"><i className="muted" style={{ width: `${(c.clocked_hours / max) * 100}%` }} /></span><b>{fmtHours(c.clocked_hours)} j</b>
            <span>Tercatat</span><span className="dash-bar"><i style={{ width: `${(c.logged_hours / max) * 100}%` }} /></span><b>{fmtHours(c.logged_hours)} j</b>
          </div>
          <p className="dash-note">{c.person_days} hari-orang{c.unreported_days ? ` · ${c.unreported_days} belum lapor` : ''}</p>
        </>
      )}
    </Panel>
  );
}
