'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Image from 'next/image';
import {
  Globe2, LogOut, Pencil, Plus, Trash2, UserPlus, Users,
  Download, FolderPlus, AlertCircle, ChevronDown, Check,
  ToggleLeft, ToggleRight, Clock, Info, X
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';

// ─── Types ───────────────────────────────────────────────────────────────────
type Lang = 'id' | 'en';
type Profile = { id: string; full_name: string; role: 'admin' | 'user' };
type Project = { id: string; project_code: string; name: string; description: string; is_active: boolean; inactive_from: string | null };
type WorkLog = {
  id: string; user_id: string; log_date: string;
  project_id: string | null; hours: number | null; is_leave: boolean;
  profiles?: { full_name: string };
  projects?: { name: string; project_code: string } | null;
};
type DayEntry = { project_id: string; project_name: string; project_code: string; hours: number };
type DayData = { date: string; isLeave: boolean; entries: DayEntry[] };

// ─── i18n ─────────────────────────────────────────────────────────────────────
const text = {
  id: {
    app: 'Weaver', login: 'Masuk', email: 'Email', password: 'Kata sandi',
    signIn: 'Masuk', signUp: 'Buat akun', logout: 'Keluar',
    projects: 'Proyek Saya', admin: 'Admin', welcome: 'Selamat datang',
    cancel: 'Batal', save: 'Simpan', overview: 'Ringkasan',
    totalProjects: 'Total proyek', totalUsers: 'Total karyawan', totalHours: 'Total jam kerja',
    createProject: 'Buat proyek', projectName: 'Nama proyek', projectCode: 'Nomor proyek',
    description: 'Deskripsi', assignTo: 'Tugaskan ke', allUsers: 'Semua (default)',
    create: 'Buat', records: 'Rekapan', export: 'Ekspor Excel',
    search: 'Cari nama atau proyek…', user: 'Nama', date: 'Tanggal',
    hours: 'Jam Kerja', sortBy: 'Urutkan', byName: 'Nama', byDate: 'Tanggal',
    projectList: 'Daftar Proyek', userList: 'Daftar Karyawan', edit: 'Edit',
    delete: 'Hapus', addUser: 'Tambah karyawan', actions: 'Aksi',
    createAccount: 'Buat akun baru', name: 'Nama lengkap',
    authHint: 'Gunakan email dan kata sandi untuk melanjutkan.',
    loading: 'Memuat…', setup: 'Tambahkan variabel Supabase terlebih dahulu.',
    active: 'Aktif', inactive: 'Nonaktif', activate: 'Aktifkan', deactivate: 'Nonaktifkan',
    leave: 'Cuti', addProject: 'Tambah Proyek', inputHours: 'Jam kerja',
    submit: 'Submit', checkHours: 'Periksa Jam Kerja',
    lowHours: 'Karyawan jam kerja < 20 jam (5 hari terakhir)',
    moreDetail: 'Detail', closeDetail: 'Tutup',
    noData: 'Tidak ada data', leaveDay: 'Cuti',
    pilihProyek: 'Pilih proyek…', namaPrjPlaceholder: 'Nama proyek',
    kodePrjPlaceholder: 'Kode proyek (contoh: PRJ-001)',
    tanggal: 'Tanggal', namaProyek: 'Nama Proyek', nomorProyek: 'Nomor Proyek',
    jamKerja: 'Jam Kerja', jamKerjaHeader: 'Jam Kerja',
  },
  en: {
    app: 'Weaver', login: 'Sign in', email: 'Email', password: 'Password',
    signIn: 'Sign in', signUp: 'Create account', logout: 'Sign out',
    projects: 'My Projects', admin: 'Admin', welcome: 'Welcome',
    cancel: 'Cancel', save: 'Save', overview: 'Overview',
    totalProjects: 'Total projects', totalUsers: 'Total employees', totalHours: 'Total work hours',
    createProject: 'Create project', projectName: 'Project name', projectCode: 'Project number',
    description: 'Description', assignTo: 'Assign to', allUsers: 'All (default)',
    create: 'Create', records: 'Records', export: 'Export Excel',
    search: 'Search name or project…', user: 'Name', date: 'Date',
    hours: 'Work Hours', sortBy: 'Sort by', byName: 'Name', byDate: 'Date',
    projectList: 'Project List', userList: 'Employees', edit: 'Edit',
    delete: 'Delete', addUser: 'Add employee', actions: 'Actions',
    createAccount: 'Create a new account', name: 'Full name',
    authHint: 'Use your email and password to continue.',
    loading: 'Loading…', setup: 'Add your Supabase environment variables first.',
    active: 'Active', inactive: 'Inactive', activate: 'Activate', deactivate: 'Deactivate',
    leave: 'Leave', addProject: 'Add Project', inputHours: 'Work hours',
    submit: 'Submit', checkHours: 'Check Work Hours',
    lowHours: 'Employees with < 20 hours (last 5 days)',
    moreDetail: 'Detail', closeDetail: 'Close',
    noData: 'No data', leaveDay: 'Leave',
    pilihProyek: 'Select project…', namaPrjPlaceholder: 'Project name',
    kodePrjPlaceholder: 'Project code (e.g. PRJ-001)',
    tanggal: 'Date', namaProyek: 'Project Name', nomorProyek: 'Project Number',
    jamKerja: 'Work Hours', jamKerjaHeader: 'Work Hours',
  }
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function todayStr() { return new Date().toISOString().slice(0, 10); }
function getLast45Days(): string[] {
  const days: string[] = [];
  for (let i = 0; i <= 45; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}
function formatDateDisplay(dateStr: string, lang: Lang): string {
  const d = new Date(dateStr + 'T00:00:00');
  const today = todayStr();
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  const formatted = d.toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', opts);
  if (dateStr === today) return lang === 'id' ? `Hari ini\n${formatted}` : `Today\n${formatted}`;
  return formatted;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Home() {
  const [lang, setLang] = useState<Lang>('id');
  const t = text[lang];
  const [profile, setProfile] = useState<Profile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'in' | 'up'>('in');

  // Admin modals
  const [createOpen, setCreateOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [userOpen, setUserOpen] = useState<Profile | null | 'new'>(null);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'date'>('date');
  const [showCheckHours, setShowCheckHours] = useState(false);
  const [checkHoursDetail, setCheckHoursDetail] = useState<Profile | null>(null);

  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  const load = useCallback(async () => {
    if (!configured) return setLoading(false);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setProfile(null); setLoading(false); return; }
    const { data: own } = await supabase.from('profiles').select('id,full_name,role').eq('id', user.id).single();
    if (!own) return setLoading(false);
    setProfile(own as Profile);

    const [{ data: allProjects }, { data: logs }, { data: allUsers }] = await Promise.all([
      supabase.from('projects').select('id,project_code,name,description,is_active,inactive_from').order('created_at', { ascending: false }),
      supabase.from('work_logs').select('id,user_id,log_date,project_id,hours,is_leave,profiles(full_name),projects(name,project_code)').order('log_date', { ascending: false }),
      own.role === 'admin' ? supabase.from('profiles').select('id,full_name,role').order('full_name') : Promise.resolve({ data: [] })
    ]);

    const normalized = (logs || []).map((r: any) => ({
      ...r,
      profiles: Array.isArray(r.profiles) ? r.profiles[0] : r.profiles,
      projects: Array.isArray(r.projects) ? r.projects[0] : r.projects,
    }));

    setProjects((allProjects || []) as Project[]);
    setWorkLogs(normalized as WorkLog[]);
    setUsers((allUsers || []) as Profile[]);
    setLoading(false);
  }, [configured]);

  useEffect(() => {
    load();
    const { data } = supabase.auth.onAuthStateChange(() => load());
    return () => data.subscription.unsubscribe();
  }, [load]);

  async function authenticate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get('email')), password = String(f.get('password')), full_name = String(f.get('full_name') || '');
    const result = authMode === 'in'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { data: { full_name } } });
    if (result.error) alert(result.error.message);
    else if (authMode === 'up') alert(lang === 'id' ? 'Akun dibuat.' : 'Account created.');
  }

  async function createProjectFn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!profile) return;
    const f = new FormData(e.currentTarget);
    const { data, error } = await supabase.from('projects').insert({
      name: f.get('name'), project_code: f.get('code'), description: f.get('description'), created_by: profile.id
    }).select().single();
    if (error || !data) return alert(error?.message);
    const target = String(f.get('user_id') || '');
    await supabase.from('project_assignments').insert({ project_id: data.id, assigned_to: target || null });
    setCreateOpen(false); load();
  }

  async function updateProjectFn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editProject) return;
    const f = new FormData(e.currentTarget);
    const { error } = await supabase.from('projects').update({
      name: f.get('name'), project_code: f.get('code'), description: f.get('description')
    }).eq('id', editProject.id);
    if (error) alert(error.message); else { setEditProject(null); load(); }
  }

  async function toggleProjectActive(project: Project) {
    const newActive = !project.is_active;
    const { error } = await supabase.from('projects').update({
      is_active: newActive,
      inactive_from: newActive ? null : todayStr()
    }).eq('id', project.id);
    if (error) alert(error.message); else load();
  }

  async function deleteProjectFn(project: Project) {
    if (!confirm(`${t.delete} ${project.name}?`)) return;
    const { error } = await supabase.from('projects').delete().eq('id', project.id);
    if (error) alert(error.message); else load();
  }

  async function adminUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch('/api/admin/users', {
      method: userOpen === 'new' ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({
        id: userOpen === 'new' ? undefined : (userOpen as Profile)?.id,
        full_name: f.get('full_name'), email: f.get('email'), password: f.get('password') || undefined
      })
    });
    const body = await response.json();
    if (!response.ok) alert(body.error || 'Error'); else { setUserOpen(null); load(); }
  }

  async function deleteUser(user: Profile) {
    if (!confirm(`${t.delete} ${user.full_name}?`)) return;
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`/api/admin/users?id=${user.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session?.access_token}` } });
    const body = await response.json();
    if (!response.ok) alert(body.error || 'Error'); else load();
  }

  function exportExcel() {
    // Flat rows for Excel (no merge - one row per work log)
    const rows = workLogs
      .filter(wl => !wl.is_leave)
      .filter(wl => {
        const key = `${wl.profiles?.full_name} ${wl.projects?.name} ${wl.projects?.project_code}`.toLowerCase();
        return key.includes(query.toLowerCase());
      })
      .map(r => ({
        [t.user]: r.profiles?.full_name || '',
        [t.namaProyek]: r.projects?.name || '',
        [t.nomorProyek]: r.projects?.project_code || '',
        [t.tanggal]: r.log_date,
        [t.jamKerja]: r.hours ?? 0,
      }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, t.records);
    XLSX.writeFile(book, `rekapan-${todayStr()}.xlsx`);
  }

  // Compute visible projects for user (active only, or inactive_from > today's perspective)
  const visibleProjects = useMemo(() => {
    return projects.filter(p => {
      if (p.is_active) return true;
      // If inactive, check if inactive_from is in the future (shouldn't happen) or today
      return false;
    });
  }, [projects]);

  if (!configured) return <main className="shell"><div className="notice">{t.setup}</div></main>;
  if (loading) return <main className="shell"><p className="loading-text">{t.loading}</p></main>;
  if (!profile) return <Auth lang={lang} setLang={setLang} t={t} mode={authMode} setMode={setAuthMode} onSubmit={authenticate} />;
  const isAdmin = profile.role === 'admin';

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <Image src="/logo/weaver.svg" alt="Weaver" width={28} height={28} style={{ objectFit: 'contain' }} />
          </span>
          {t.app}
        </div>
        <div className="top-actions">
          <button className="lang-btn" onClick={() => setLang(lang === 'id' ? 'en' : 'id')}>
            <Globe2 size={14} /> {lang === 'id' ? 'EN' : 'ID'}
          </button>
          <button className="icon-button" onClick={() => supabase.auth.signOut()}>
            <LogOut size={15} />{t.logout}
          </button>
        </div>
      </header>

      {isAdmin ? (
        <AdminView
          t={t} lang={lang} projects={projects} users={users} workLogs={workLogs}
          query={query} setQuery={setQuery} sortBy={sortBy} setSortBy={setSortBy}
          onExport={exportExcel} onCreate={() => setCreateOpen(true)}
          onEdit={setEditProject} onDelete={deleteProjectFn} onToggleActive={toggleProjectActive}
          onAddUser={() => setUserOpen('new')} onEditUser={setUserOpen} onDeleteUser={deleteUser}
          showCheckHours={showCheckHours} setShowCheckHours={setShowCheckHours}
          checkHoursDetail={checkHoursDetail} setCheckHoursDetail={setCheckHoursDetail}
        />
      ) : (
        <UserView t={t} lang={lang} profile={profile} projects={visibleProjects} workLogs={workLogs.filter(w => w.user_id === profile.id)} onRefresh={load} />
      )}

      {createOpen && <ProjectModal t={t} users={users} onClose={() => setCreateOpen(false)} onSubmit={createProjectFn} />}
      {editProject && <ProjectModal t={t} users={users} project={editProject} onClose={() => setEditProject(null)} onSubmit={updateProjectFn} />}
      {userOpen && <UserModal t={t} user={userOpen === 'new' ? undefined : userOpen as Profile} onClose={() => setUserOpen(null)} onSubmit={adminUser} />}
    </main>
  );
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
function Auth({ lang, setLang, t, mode, setMode, onSubmit }: any) {
  return (
    <main className="shell auth-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <Image src="/logo/weaver.svg" alt="Weaver" width={28} height={28} style={{ objectFit: 'contain' }} />
          </span>
          {t.app}
        </div>
        <button className="lang-btn" onClick={() => setLang(lang === 'id' ? 'en' : 'id')}>
          <Globe2 size={14} /> {lang === 'id' ? 'EN' : 'ID'}
        </button>
      </header>
      <section className="auth-card">
        <h1>{mode === 'in' ? t.login : t.createAccount}</h1>
        <p className="auth-hint">{t.authHint}</p>
        <form onSubmit={onSubmit}>
          {mode === 'up' && <div className="field"><label>{t.name}</label><input required name="full_name" /></div>}
          <div className="field"><label>{t.email}</label><input required name="email" type="email" /></div>
          <div className="field"><label>{t.password}</label><input required name="password" type="password" minLength={6} /></div>
          <button className="btn-primary full-width" type="submit">{mode === 'in' ? t.signIn : t.signUp}</button>
        </form>
        <p className="auth-toggle">
          <button className="btn-ghost" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
            {mode === 'in' ? t.signUp : t.signIn}
          </button>
        </p>
      </section>
    </main>
  );
}

// ─── User View ────────────────────────────────────────────────────────────────
function UserView({ t, lang, profile, projects, workLogs, onRefresh }: {
  t: any; lang: Lang; profile: Profile; projects: Project[]; workLogs: WorkLog[]; onRefresh: () => void;
}) {
  const days = getLast45Days();
  // Build day map from existing work logs
  const logsByDate = useMemo(() => {
    const map: Record<string, { isLeave: boolean; entries: DayEntry[] }> = {};
    for (const wl of workLogs) {
      if (!map[wl.log_date]) map[wl.log_date] = { isLeave: false, entries: [] };
      if (wl.is_leave) {
        map[wl.log_date].isLeave = true;
      } else if (wl.project_id) {
        map[wl.log_date].entries.push({
          project_id: wl.project_id,
          project_name: wl.projects?.name || '',
          project_code: wl.projects?.project_code || '',
          hours: wl.hours || 0
        });
      }
    }
    return map;
  }, [workLogs]);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dateEntries, setDateEntries] = useState<Array<{ tempId: string; project_id: string; hours: string }>>([]);
  const [isLeaveMode, setIsLeaveMode] = useState(false);

  function openDate(date: string) {
    const existing = logsByDate[date];
    if (existing?.isLeave) {
      setIsLeaveMode(true);
      setDateEntries([]);
    } else {
      setIsLeaveMode(false);
      const entries = (existing?.entries || []).map(e => ({
        tempId: crypto.randomUUID(),
        project_id: e.project_id,
        hours: String(e.hours)
      }));
      setDateEntries(entries.length ? entries : [{ tempId: crypto.randomUUID(), project_id: '', hours: '' }]);
    }
    setSelectedDate(date);
  }

  function addEntry() {
    setDateEntries(prev => [...prev, { tempId: crypto.randomUUID(), project_id: '', hours: '' }]);
  }

  function updateEntry(tempId: string, field: 'project_id' | 'hours', value: string) {
    setDateEntries(prev => prev.map(e => e.tempId === tempId ? { ...e, [field]: value } : e));
    // Auto-fill project code when project is selected (handled by selecting project object)
  }

  function removeEntry(tempId: string) {
    setDateEntries(prev => prev.filter(e => e.tempId !== tempId));
  }

  async function handleMarkLeave() {
    if (!selectedDate) return;
    setSaving(true);
    // Remove any existing non-leave logs for that date
    await supabase.from('work_logs').delete().eq('user_id', profile.id).eq('log_date', selectedDate);
    // Insert leave
    const { error } = await supabase.from('work_logs').insert({ user_id: profile.id, log_date: selectedDate, is_leave: true });
    setSaving(false);
    if (error) alert(error.message);
    else { setSelectedDate(null); onRefresh(); }
  }

  async function handleSubmit() {
    if (!selectedDate) return;
    if (isLeaveMode) return handleMarkLeave();
    // Validate
    for (const e of dateEntries) {
      if (!e.project_id) { alert(lang === 'id' ? 'Pilih proyek terlebih dahulu.' : 'Please select a project.'); return; }
      if (!e.hours || isNaN(Number(e.hours)) || Number(e.hours) <= 0) {
        alert(lang === 'id' ? 'Masukkan jam kerja yang valid.' : 'Enter valid work hours.'); return;
      }
    }
    setSaving(true);
    // Delete existing logs for date, re-insert
    await supabase.from('work_logs').delete().eq('user_id', profile.id).eq('log_date', selectedDate);
    const inserts = dateEntries.map(e => ({
      user_id: profile.id, log_date: selectedDate,
      project_id: e.project_id, hours: Number(e.hours), is_leave: false
    }));
    const { error } = await supabase.from('work_logs').insert(inserts);
    setSaving(false);
    if (error) alert(error.message);
    else { setSelectedDate(null); onRefresh(); }
  }

  return (
    <div className="user-view">
      <div className="user-header">
        <h1>{t.welcome}, <span className="user-name">{profile.full_name}</span></h1>
      </div>

      <div className="days-table-wrap">
        <table className="days-table">
          <thead>
            <tr>
              <th>{t.tanggal}</th>
              <th>{t.namaProyek}</th>
              <th>{t.nomorProyek}</th>
              <th>{t.jamKerjaHeader}</th>
              <th>{t.actions}</th>
            </tr>
          </thead>
          <tbody>
            {days.map(date => {
              const dayData = logsByDate[date];
              const isToday = date === todayStr();
              if (dayData?.isLeave) {
                return (
                  <tr key={date} className={isToday ? 'row-today' : ''}>
                    <td className="date-cell">
                      {isToday && <span className="today-dot" />}
                      <span className="date-label">{formatDateDisplay(date, lang).replace('\n', ' ')}</span>
                    </td>
                    <td colSpan={3}><span className="badge-leave">{t.leaveDay}</span></td>
                    <td>
                      <button className="btn-action" onClick={() => openDate(date)}>
                        <Pencil size={14} />
                      </button>
                    </td>
                  </tr>
                );
              }
              if (dayData?.entries?.length) {
                return dayData.entries.map((entry, idx) => (
                  <tr key={`${date}-${idx}`} className={isToday ? 'row-today' : ''}>
                    {idx === 0 && (
                      <td className="date-cell" rowSpan={dayData.entries.length}>
                        {isToday && <span className="today-dot" />}
                        <span className="date-label">{formatDateDisplay(date, lang).replace('\n', ' ')}</span>
                      </td>
                    )}
                    <td>{entry.project_name}</td>
                    <td><span className="code-badge">{entry.project_code}</span></td>
                    <td><span className="hours-badge">{entry.hours} jam</span></td>
                    {idx === 0 && (
                      <td rowSpan={dayData.entries.length}>
                        <button className="btn-action" onClick={() => openDate(date)}>
                          <Pencil size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ));
              }
              // Empty row
              return (
                <tr key={date} className={isToday ? 'row-today' : ''}>
                  <td className="date-cell">
                    {isToday && <span className="today-dot" />}
                    <span className="date-label">{formatDateDisplay(date, lang).replace('\n', ' ')}</span>
                  </td>
                  <td colSpan={3} className="empty-row-hint">—</td>
                  <td>
                    <button className="btn-add-circle" onClick={() => openDate(date)}>
                      <Plus size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Entry Modal */}
      {selectedDate && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setSelectedDate(null)}>
          <div className="modal entry-modal">
            <div className="modal-header">
              <h2>{formatDateDisplay(selectedDate, lang).replace('\n', ' ')}</h2>
              <button className="btn-ghost-icon" onClick={() => setSelectedDate(null)}><X size={18} /></button>
            </div>

            {isLeaveMode ? (
              <div className="leave-confirm">
                <span className="badge-leave lg">{t.leaveDay}</span>
                <p>{lang === 'id' ? 'Tanggal ini ditandai sebagai cuti.' : 'This date is marked as leave.'}</p>
                <button className="btn-ghost" onClick={() => setIsLeaveMode(false)}>
                  {lang === 'id' ? 'Ubah ke input proyek' : 'Switch to project input'}
                </button>
              </div>
            ) : (
              <div className="entry-list">
                {dateEntries.map((entry, idx) => (
                  <ProjectEntryRow
                    key={entry.tempId}
                    entry={entry}
                    projects={projects}
                    lang={lang}
                    t={t}
                    onChange={(field, val) => updateEntry(entry.tempId, field, val)}
                    onRemove={dateEntries.length > 1 ? () => removeEntry(entry.tempId) : undefined}
                    index={idx}
                  />
                ))}
                <button className="btn-add-entry" onClick={addEntry}>
                  <Plus size={14} /> {t.addProject}
                </button>
              </div>
            )}

            <div className="modal-footer">
              {!isLeaveMode && (
                <button className="btn-leave" onClick={() => { setIsLeaveMode(true); setDateEntries([]); }}>
                  {t.leaveDay}
                </button>
              )}
              <div className="modal-footer-right">
                <button className="btn-secondary" onClick={() => setSelectedDate(null)}>{t.cancel}</button>
                <button className="btn-primary" onClick={handleSubmit} disabled={saving}>
                  {saving ? '…' : t.submit}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectEntryRow({ entry, projects, lang, t, onChange, onRemove, index }: {
  entry: { tempId: string; project_id: string; hours: string };
  projects: Project[]; lang: Lang; t: any;
  onChange: (field: 'project_id' | 'hours', val: string) => void;
  onRemove?: () => void;
  index: number;
}) {
  const selectedProject = projects.find(p => p.id === entry.project_id);
  return (
    <div className="entry-row">
      <div className="entry-row-fields">
        <div className="entry-field">
          <label>{t.namaProyek} / {t.nomorProyek}</label>
          <div className="project-select-row">
            <select
              className="field-input project-name-select"
              value={entry.project_id}
              onChange={e => onChange('project_id', e.target.value)}
            >
              <option value="">{t.pilihProyek}</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name} — {p.project_code}</option>
              ))}
            </select>
            <div className="project-code-display">
              {selectedProject ? <span className="code-badge">{selectedProject.project_code}</span> : <span className="code-placeholder">—</span>}
            </div>
          </div>
        </div>
        <div className="entry-field entry-field-hours">
          <label>{t.inputHours}</label>
          <div className="hours-input-wrap">
            <Clock size={14} className="hours-icon" />
            <input
              type="number" min="0.5" max="24" step="0.5"
              className="field-input hours-input"
              value={entry.hours}
              onChange={e => onChange('hours', e.target.value)}
              placeholder="0"
            />
            <span className="hours-unit">jam</span>
          </div>
        </div>
      </div>
      {onRemove && (
        <button className="btn-remove-entry" onClick={onRemove} title="Hapus">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

// ─── Admin View ────────────────────────────────────────────────────────────────
function AdminView({
  t, lang, projects, users, workLogs, query, setQuery, sortBy, setSortBy,
  onExport, onCreate, onEdit, onDelete, onToggleActive,
  onAddUser, onEditUser, onDeleteUser,
  showCheckHours, setShowCheckHours, checkHoursDetail, setCheckHoursDetail
}: any) {
  const totalHours = workLogs.filter((w: WorkLog) => !w.is_leave).reduce((s: number, w: WorkLog) => s + (w.hours || 0), 0);

  // Records for table (flat, with search/sort)
  const records = useMemo(() => {
    return workLogs
      .filter((w: WorkLog) => !w.is_leave)
      .filter((w: WorkLog) => {
        const key = `${w.profiles?.full_name} ${w.projects?.name} ${w.projects?.project_code}`.toLowerCase();
        return key.includes(query.toLowerCase());
      })
      .sort((a: WorkLog, b: WorkLog) => {
        if (sortBy === 'name') return (a.profiles?.full_name || '').localeCompare(b.profiles?.full_name || '');
        return b.log_date.localeCompare(a.log_date);
      });
  }, [workLogs, query, sortBy]);

  // Check hours: last 5 days, users < 20 hours
  const last5Days = useMemo(() => {
    const arr: string[] = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      arr.push(d.toISOString().slice(0, 10));
    }
    return arr;
  }, []);

  const lowHoursUsers = useMemo(() => {
    const normalUsers = users.filter((u: Profile) => u.role === 'user');
    return normalUsers.map((u: Profile) => {
      const userLogs = workLogs.filter((w: WorkLog) => w.user_id === u.id && last5Days.includes(w.log_date));
      const workHours = userLogs.filter((w: WorkLog) => !w.is_leave).reduce((s: number, w: WorkLog) => s + (w.hours || 0), 0);
      const hasCuti = userLogs.some((w: WorkLog) => w.is_leave);
      return { user: u, hours: workHours, hasCuti };
    }).filter((x: any) => x.hours < 20);
  }, [users, workLogs, last5Days]);

  return (
    <div className="admin-view">
      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-label">{t.totalProjects}</div>
          <div className="stat-number">{projects.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t.totalUsers}</div>
          <div className="stat-number">{users.filter((u: Profile) => u.role === 'user').length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t.totalHours}</div>
          <div className="stat-number">{totalHours}</div>
        </div>
      </div>

      {/* Records */}
      <div className="admin-section">
        <div className="section-header">
          <h2>{t.records}</h2>
          <div className="section-actions">
            <button className="btn-secondary" onClick={() => setShowCheckHours(!showCheckHours)}>
              <AlertCircle size={15} />{t.checkHours}
            </button>
            <button className="btn-secondary" onClick={onExport}>
              <Download size={15} />{t.export}
            </button>
          </div>
        </div>

        {showCheckHours && (
          <div className="check-hours-panel">
            <div className="check-hours-header">
              <span><AlertCircle size={14} /> {t.lowHours}</span>
            </div>
            {lowHoursUsers.length === 0 ? (
              <p className="no-low-hours">{lang === 'id' ? 'Semua karyawan sudah memenuhi jam kerja.' : 'All employees meet the hour requirement.'}</p>
            ) : (
              <table className="check-table">
                <thead><tr><th>{t.name}</th><th>{t.jamKerjaHeader}</th><th>{t.actions}</th></tr></thead>
                <tbody>
                  {lowHoursUsers.map(({ user, hours, hasCuti }: any) => (
                    <tr key={user.id}>
                      <td>{user.full_name}</td>
                      <td>
                        <span className="hours-badge warn">{hours} jam{hasCuti ? ' + cuti' : ''}</span>
                      </td>
                      <td>
                        <button className="btn-action" onClick={() => setCheckHoursDetail(user)}>
                          <Info size={14} /> {t.moreDetail}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {checkHoursDetail && (
              <CheckHoursDetail t={t} lang={lang} user={checkHoursDetail} workLogs={workLogs} last5Days={last5Days} onClose={() => setCheckHoursDetail(null)} />
            )}
          </div>
        )}

        <div className="toolbar">
          <input className="search-input" value={query} onChange={e => setQuery(e.target.value)} placeholder={t.search} />
          <select className="sort-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="date">{t.sortBy}: {t.byDate}</option>
            <option value="name">{t.sortBy}: {t.byName}</option>
          </select>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t.user}</th>
                <th>{t.namaProyek}</th>
                <th>{t.nomorProyek}</th>
                <th>{t.tanggal}</th>
                <th>{t.jamKerjaHeader}</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r: WorkLog) => (
                <tr key={r.id}>
                  <td>{r.profiles?.full_name}</td>
                  <td>{r.projects?.name}</td>
                  <td><span className="code-badge">{r.projects?.project_code}</span></td>
                  <td>{r.log_date}</td>
                  <td><span className="hours-badge">{r.hours} jam</span></td>
                </tr>
              ))}
              {!records.length && <tr><td colSpan={5} className="td-empty">{t.noData}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Project List */}
      <div className="admin-section">
        <div className="section-header">
          <h2>{t.projectList}</h2>
          <button className="btn-primary" onClick={onCreate}><Plus size={15} />{t.createProject}</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t.projectCode}</th>
                <th>{t.projectName}</th>
                <th>{t.description}</th>
                <th>Status</th>
                <th>{t.actions}</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p: Project) => (
                <tr key={p.id}>
                  <td><span className="code-badge">{p.project_code}</span></td>
                  <td>{p.name}</td>
                  <td className="td-desc">{p.description}</td>
                  <td>
                    <span className={`status-badge ${p.is_active ? 'active' : 'inactive'}`}>
                      {p.is_active ? t.active : t.inactive}
                    </span>
                  </td>
                  <td>
                    <div className="action-btns">
                      <button className="btn-action" onClick={() => onEdit(p)} title={t.edit}><Pencil size={13} /></button>
                      <button
                        className={`btn-action ${p.is_active ? 'deactivate' : 'activate'}`}
                        onClick={() => onToggleActive(p)}
                        title={p.is_active ? t.deactivate : t.activate}
                      >
                        {p.is_active ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
                      </button>
                      <button className="btn-action danger" onClick={() => onDelete(p)} title={t.delete}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* User List */}
      <div className="admin-section">
        <div className="section-header">
          <h2>{t.userList}</h2>
          <button className="btn-primary" onClick={onAddUser}><UserPlus size={15} />{t.addUser}</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>{t.name}</th><th>{t.actions}</th></tr></thead>
            <tbody>
              {users.filter((u: Profile) => u.role === 'user').map((u: Profile) => (
                <tr key={u.id}>
                  <td>{u.full_name}</td>
                  <td>
                    <div className="action-btns">
                      <button className="btn-action" onClick={() => onEditUser(u)}><Pencil size={13} /> {t.edit}</button>
                      <button className="btn-action danger" onClick={() => onDeleteUser(u)}><Trash2 size={13} /> {t.delete}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CheckHoursDetail({ t, lang, user, workLogs, last5Days, onClose }: any) {
  const userLogs = workLogs.filter((w: WorkLog) => w.user_id === user.id && last5Days.includes(w.log_date));
  return (
    <div className="check-detail-panel">
      <div className="check-detail-header">
        <strong>{user.full_name}</strong>
        <button className="btn-ghost-icon" onClick={onClose}><X size={16} /></button>
      </div>
      <table className="check-table">
        <thead><tr><th>{t.tanggal}</th><th>{t.namaProyek}</th><th>{t.jamKerjaHeader}</th></tr></thead>
        <tbody>
          {last5Days.map((date: string) => {
            const dayLogs = userLogs.filter((w: WorkLog) => w.log_date === date);
            if (!dayLogs.length) return (
              <tr key={date}><td>{date}</td><td>—</td><td>—</td></tr>
            );
            return dayLogs.map((wl: WorkLog, i: number) => (
              <tr key={wl.id}>
                {i === 0 && <td rowSpan={dayLogs.length}>{date}</td>}
                <td>{wl.is_leave ? <span className="badge-leave sm">{t.leaveDay}</span> : (wl.projects?.name || '—')}</td>
                <td>{wl.is_leave ? '—' : `${wl.hours} jam`}</td>
              </tr>
            ));
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Modals ───────────────────────────────────────────────────────────────────
function ProjectModal({ t, users, project, onClose, onSubmit }: any) {
  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>{project ? t.edit : t.createProject}</h2>
          <button className="btn-ghost-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="field"><label>{t.projectName}</label><input name="name" required defaultValue={project?.name} /></div>
          <div className="field"><label>{t.projectCode}</label><input name="code" required placeholder="PRJ-001" defaultValue={project?.project_code} /></div>
          <div className="field"><label>{t.description}</label><input name="description" defaultValue={project?.description} /></div>
          {!project && (
            <div className="field">
              <label>{t.assignTo}</label>
              <select name="user_id">
                <option value="">{t.allUsers}</option>
                {users.filter((u: Profile) => u.role === 'user').map((u: Profile) => (
                  <option value={u.id} key={u.id}>{u.full_name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="modal-footer">
            <div />
            <div className="modal-footer-right">
              <button type="button" className="btn-secondary" onClick={onClose}>{t.cancel}</button>
              <button className="btn-primary" type="submit"><Check size={15} />{project ? t.save : t.create}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function UserModal({ t, user, onClose, onSubmit }: any) {
  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>{user ? t.edit : t.addUser}</h2>
          <button className="btn-ghost-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="field"><label>{t.name}</label><input name="full_name" required defaultValue={user?.full_name} /></div>
          {!user && <div className="field"><label>{t.email}</label><input name="email" type="email" required /></div>}
          <div className="field">
            <label>{t.password}{user ? ` (${t.cancel === 'Cancel' ? 'optional' : 'opsional'})` : ''}</label>
            <input name="password" type="password" minLength={6} required={!user} />
          </div>
          <div className="modal-footer">
            <div />
            <div className="modal-footer-right">
              <button type="button" className="btn-secondary" onClick={onClose}>{t.cancel}</button>
              <button className="btn-primary" type="submit"><Users size={15} />{t.save}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
