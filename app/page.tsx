'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Image from 'next/image';
import {
  Globe2, LogOut, Pencil, Plus, Trash2, UserPlus, Users,
  Download, FolderPlus, AlertCircle, ChevronDown, Check,
  ToggleLeft, ToggleRight, Clock, Info, X, Shield, ScrollText,
  Settings, UserCog, AtSign, Mail
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { supabase } from '@/lib/supabase';

// ─── Types ───────────────────────────────────────────────────────────────────
type Lang = 'id' | 'en';
type Profile = { id: string; full_name: string; role: 'admin' | 'user'; email?: string };
type Project = { id: string; project_code: string; name: string; description: string; is_active: boolean; inactive_from: string | null };
type WorkLog = {
  id: string; user_id: string; log_date: string;
  project_id: string | null; hours: number | null; is_leave: boolean;
  profiles?: { full_name: string };
  projects?: { name: string; project_code: string } | null;
};
type DayEntry = { project_id: string; project_name: string; project_code: string; hours: number };
type AdminLog = {
  id: string; action: string; details: any; created_at: string;
  admin?: { full_name: string } | null;
  target?: { full_name: string } | null;
};
type AdminSettings = { allow_signup: boolean; login_domain: string; use_domain_login: boolean };

const PROTECTED_DOMAINS = ['leonxlab.app', 'leonxlab.digital'];

// ─── Global alert popup ─────────────────────────────────────────────────────
// Lets any function (even inside child components) trigger the popup without
// prop-drilling, the same way window.alert() could be called from anywhere.
let alertSetter: ((message: string) => void) | null = null;
function showAlert(message: string) {
  if (alertSetter) alertSetter(message);
  else if (typeof window !== 'undefined') window.alert(message);
}

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
    authHint: 'Masukkan username untuk melanjutkan.',
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
    adminLogs: 'Log Admin', role: 'Role', username: 'Username',
    allowSignup: 'Izinkan buat akun', loginDomain: 'Domain login default',
    adminSettings: 'Pengaturan Admin', changeRole: 'Ubah Role',
    protectedDomain: 'Domain ini terlindungi', settingsSaved: 'Pengaturan disimpan.',
    useDomainLogin: 'Gunakan domain login default',
    useDomainLoginDesc: 'Jika aktif, user cukup ketik username dan @domain otomatis ditambahkan. Jika nonaktif, user harus ketik email lengkap.',
    tos: 'Syarat & Ketentuan', privacy: 'Kebijakan Privasi',
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
    authHint: 'Enter your username to continue.',
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
    adminLogs: 'Admin Logs', role: 'Role', username: 'Username',
    allowSignup: 'Allow account creation', loginDomain: 'Default login domain',
    adminSettings: 'Admin Settings', changeRole: 'Change Role',
    protectedDomain: 'Domain is protected', settingsSaved: 'Settings saved.',
    useDomainLogin: 'Use default login domain',
    useDomainLoginDesc: 'When on, users only type their username and @domain is appended. When off, users must enter their full email.',
    tos: 'Terms of Service', privacy: 'Privacy Policy',
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
function isProtectedDomain(email: string) {
  const domain = email?.split('@')[1] || '';
  return PROTECTED_DOMAINS.includes(domain);
}
function formatLogAction(action: string, details: any, lang: Lang): string {
  const map: Record<string, string> = {
    CREATE_USER: lang === 'id' ? 'Buat akun' : 'Create user',
    UPDATE_USER: lang === 'id' ? 'Edit akun' : 'Edit user',
    DELETE_USER: lang === 'id' ? 'Hapus akun' : 'Delete user',
    UPDATE_ROLE: lang === 'id' ? 'Ubah role' : 'Change role',
    TOGGLE_SIGNUP: lang === 'id' ? 'Toggle buat akun' : 'Toggle signup',
    SET_DOMAIN: lang === 'id' ? 'Set domain login' : 'Set login domain',
  };
  let base = map[action] || action;
  if (action === 'UPDATE_ROLE' && details) {
    base += `: ${details.target_name} (${details.old_role} → ${details.new_role})`;
  } else if (action === 'CREATE_USER' && details) {
    base += `: ${details.full_name} <${details.email}>`;
  } else if (action === 'DELETE_USER' && details) {
    base += `: ${details.full_name || details.email}`;
  } else if (action === 'TOGGLE_SIGNUP' && details) {
    base += `: ${details.allow_signup ? 'ON' : 'OFF'}`;
  } else if (action === 'SET_DOMAIN' && details) {
    base += `: ${details.login_domain}`;
  }
  return base;
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
  const [adminSettings, setAdminSettings] = useState<AdminSettings>({ allow_signup: true, login_domain: 'company.com', use_domain_login: true });

  // Admin modals
  const [createOpen, setCreateOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [userOpen, setUserOpen] = useState<Profile | null | 'new'>(null);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'date'>('date');
  const [showCheckHours, setShowCheckHours] = useState(false);
  const [checkHoursDetail, setCheckHoursDetail] = useState<Profile | null>(null);
  const [showAdminLogs, setShowAdminLogs] = useState(false);
  const [showAdminSettings, setShowAdminSettings] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  useEffect(() => {
    alertSetter = setAlertMessage;
    return () => { alertSetter = null; };
  }, []);

  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  // Load admin settings (public endpoint)
  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/settings');
      if (res.ok) {
        const data = await res.json();
        setAdminSettings({
          allow_signup: data.allow_signup === 'true',
          login_domain: data.login_domain || 'company.com',
          use_domain_login: data.use_domain_login !== 'false', // default true
        });
      }
    } catch {}
  }, []);

  const load = useCallback(async () => {
    if (!configured) return setLoading(false);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setProfile(null); setLoading(false); return; }
    const { data: own } = await supabase.from('profiles').select('id,full_name,role').eq('id', user.id).single();
    if (!own) return setLoading(false);
    // Attach email for protected domain detection
    setProfile({ ...(own as Profile), email: user.email });

    const [{ data: allProjects }, { data: logs }, { data: allUsers }] = await Promise.all([
      supabase.from('projects').select('id,project_code,name,description,is_active,inactive_from').order('created_at', { ascending: false }),
      supabase.from('work_logs').select('id,user_id,log_date,project_id,hours,is_leave,profiles(full_name),projects(name,project_code)').order('log_date', { ascending: false }),
      own.role === 'admin' ? supabase.from('profiles').select('id,full_name,role').order('full_name') : Promise.resolve({ data: [] })
    ]);

    // For admin, enrich users with emails
    let enrichedUsers: Profile[] = (allUsers || []) as Profile[];
    if (own.role === 'admin') {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch('/api/admin/users-list', {
          headers: { Authorization: `Bearer ${session?.access_token}` }
        });
        if (res.ok) {
          const emailMap: Record<string, string> = await res.json();
          enrichedUsers = enrichedUsers.map(u => ({ ...u, email: emailMap[u.id] || '' }));
        }
      } catch {}
    }

    const normalized = (logs || []).map((r: any) => ({
      ...r,
      profiles: Array.isArray(r.profiles) ? r.profiles[0] : r.profiles,
      projects: Array.isArray(r.projects) ? r.projects[0] : r.projects,
    }));

    setProjects((allProjects || []) as Project[]);
    setWorkLogs(normalized as WorkLog[]);
    setUsers(enrichedUsers);
    setLoading(false);
  }, [configured]);

  useEffect(() => {
    loadSettings();
    load();
    const { data } = supabase.auth.onAuthStateChange(() => load());
    return () => data.subscription.unsubscribe();
  }, [load, loadSettings]);

  async function authenticate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const username = String(f.get('username') || '').trim();
    const password = String(f.get('password'));
    const full_name = String(f.get('full_name') || '');
    const emailRaw = String(f.get('email') || '');
    const email = authMode === 'in'
      ? (adminSettings.use_domain_login
          ? `${username}@${adminSettings.login_domain}`
          : emailRaw)
      : emailRaw;

    const result = authMode === 'in'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { data: { full_name } } });
    if (result.error) showAlert(result.error.message);
    else if (authMode === 'up') showAlert(lang === 'id' ? 'Akun dibuat.' : 'Account created.');
  }

  async function createProjectFn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!profile) return;
    const f = new FormData(e.currentTarget);
    const { data, error } = await supabase.from('projects').insert({
      name: f.get('name'), project_code: f.get('code'), description: f.get('description'), created_by: profile.id
    }).select().single();
    if (error || !data) return showAlert(error?.message || 'Error');
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
    if (error) showAlert(error.message); else { setEditProject(null); load(); }
  }

  async function toggleProjectActive(project: Project) {
    const newActive = !project.is_active;
    const { error } = await supabase.from('projects').update({
      is_active: newActive,
      inactive_from: newActive ? null : todayStr()
    }).eq('id', project.id);
    if (error) showAlert(error.message); else load();
  }

  async function deleteProjectFn(project: Project) {
    if (!confirm(`${t.delete} ${project.name}?`)) return;
    const { error } = await supabase.from('projects').delete().eq('id', project.id);
    if (error) showAlert(error.message); else load();
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
    if (!response.ok) showAlert(body.error || 'Error'); else { setUserOpen(null); load(); }
  }

  async function deleteUser(user: Profile) {
    if (user.email && isProtectedDomain(user.email)) {
      showAlert(lang === 'id' ? `Akun dengan domain @${user.email.split('@')[1]} tidak dapat dihapus.` : `Accounts with @${user.email.split('@')[1]} domain cannot be deleted.`);
      return;
    }
    if (!confirm(`${t.delete} ${user.full_name}?`)) return;
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`/api/admin/users?id=${user.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session?.access_token}` } });
    const body = await response.json();
    if (!response.ok) showAlert(body.error || 'Error'); else load();
  }

  async function updateUserRole(user: Profile, newRole: 'admin' | 'user') {
    if (user.email && isProtectedDomain(user.email)) {
      showAlert(lang === 'id' ? `Role akun @${user.email.split('@')[1]} tidak dapat diubah.` : `Role of @${user.email.split('@')[1]} accounts cannot be changed.`);
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/admin/role', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ id: user.id, role: newRole }),
    });
    const body = await res.json();
    if (!res.ok) showAlert(body.error || 'Error'); else load();
  }

  async function saveSettings(settings: Partial<AdminSettings>) {
    const { data: { session } } = await supabase.auth.getSession();
    const body: any = {};
    if (settings.allow_signup !== undefined) body.allow_signup = settings.allow_signup;
    if (settings.login_domain !== undefined) body.login_domain = settings.login_domain;
    if (settings.use_domain_login !== undefined) body.use_domain_login = settings.use_domain_login;
    const res = await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setAdminSettings(prev => ({ ...prev, ...settings }));
      showAlert(t.settingsSaved);
    } else {
      const b = await res.json();
      showAlert(b.error || 'Error');
    }
  }

  async function exportExcel() {
    const rows = workLogs.filter(wl => {
      const key = `${wl.profiles?.full_name} ${wl.projects?.name} ${wl.projects?.project_code}`.toLowerCase();
      return key.includes(query.toLowerCase());
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(t.records);

    sheet.columns = [
      { header: t.user, key: 'user', width: 22 },
      { header: t.namaProyek, key: 'project', width: 24 },
      { header: t.nomorProyek, key: 'code', width: 18 },
      { header: t.tanggal, key: 'date', width: 14 },
      { header: t.jamKerja, key: 'hours', width: 12 },
      { header: t.leave, key: 'leave', width: 12 },
    ];
    sheet.getRow(1).font = { bold: true };

    rows.forEach(r => {
      const row = sheet.addRow({
        user: r.profiles?.full_name || '',
        project: r.projects?.name || '',
        code: r.projects?.project_code || '',
        date: r.log_date,
        hours: r.is_leave ? '' : (r.hours ?? 0),
        leave: r.is_leave ? t.leave : '',
      });
      if (r.is_leave) {
        row.getCell('leave').font = { color: { argb: 'FFFF0000' } };
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rekapan-${todayStr()}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const visibleProjects = useMemo(() => {
    return projects.filter(p => p.is_active);
  }, [projects]);

  if (!configured) return <main className="shell"><div className="notice">{t.setup}</div></main>;
  if (loading) return <main className="shell"><p className="loading-text">{t.loading}</p></main>;
  if (!profile) return (
    <>
      <Auth
        lang={lang} setLang={setLang} t={t} mode={authMode} setMode={setAuthMode}
        onSubmit={authenticate} adminSettings={adminSettings}
      />
      <AlertModal message={alertMessage} onClose={() => setAlertMessage(null)} />
    </>
  );
  const isAdmin = profile.role === 'admin';

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <Image src="/logo/weaver.svg" alt="Weaver" width={56} height={56} style={{ objectFit: 'contain' }} />
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
          onUpdateRole={updateUserRole}
          showCheckHours={showCheckHours} setShowCheckHours={setShowCheckHours}
          checkHoursDetail={checkHoursDetail} setCheckHoursDetail={setCheckHoursDetail}
          showAdminLogs={showAdminLogs} setShowAdminLogs={setShowAdminLogs}
          showAdminSettings={showAdminSettings} setShowAdminSettings={setShowAdminSettings}
          adminSettings={adminSettings} onSaveSettings={saveSettings}
          currentProfile={profile}
        />
      ) : (
        <UserView t={t} lang={lang} profile={profile} projects={visibleProjects} workLogs={workLogs.filter(w => w.user_id === profile.id)} onRefresh={load} />
      )}

      {createOpen && <ProjectModal t={t} users={users} onClose={() => setCreateOpen(false)} onSubmit={createProjectFn} />}
      {editProject && <ProjectModal t={t} users={users} project={editProject} onClose={() => setEditProject(null)} onSubmit={updateProjectFn} />}
      {userOpen && (
        <UserModal
          t={t} lang={lang} user={userOpen === 'new' ? undefined : userOpen as Profile}
          onClose={() => setUserOpen(null)} onSubmit={adminUser}
          loginDomain={adminSettings.login_domain}
        />
      )}
      <AlertModal message={alertMessage} onClose={() => setAlertMessage(null)} />
      <SiteFooter t={t} />
    </main>
  );
}

// ─── Footer ─────────────────────────────────────────────────────────────────
function SiteFooter({ t }: { t?: any }) {
  return (
    <footer className="site-footer">
      <div className="footer-copyright">© 2026 Weaver — Leonx Lab</div>
      <div className="footer-support">
        <span className="footer-support-icon"><Mail size={13} /></span>
        <span className="footer-support-label">Support</span>
        <a href="mailto:support@leonxlab.digital">support@leonxlab.digital</a>
        <span className="footer-dot" aria-hidden="true">•</span>
        <a href="mailto:mailto@leonxlab.app">mailto@leonxlab.app</a>
      </div>
      <div className="footer-legal">
        <a href="/tos" target="_blank" rel="noopener noreferrer">
          <ScrollText size={11} /> {t?.tos || 'Syarat & Ketentuan'}
        </a>
        <span className="footer-dot" aria-hidden="true">•</span>
        <a href="/privacy" target="_blank" rel="noopener noreferrer">
          <Shield size={11} /> {t?.privacy || 'Kebijakan Privasi'}
        </a>
      </div>
    </footer>
  );
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
function Auth({ lang, setLang, t, mode, setMode, onSubmit, adminSettings }: any) {
  return (
    <main className="shell auth-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <Image src="/logo/weaver.svg" alt="Weaver" width={56} height={56} style={{ objectFit: 'contain' }} />
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
          {mode === 'up' ? (
            <div className="field"><label>{t.email}</label><input required name="email" type="email" /></div>
          ) : adminSettings.use_domain_login ? (
            /* Username-only mode: @domain appended automatically */
            <div className="field">
              <label>{t.username || 'Username'}</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  required name="username" placeholder={lang === 'id' ? 'nama.anda' : 'your.name'}
                  style={{ flex: 1 }}
                />
                <span style={{ color: 'var(--muted)', fontSize: 13, whiteSpace: 'nowrap' }}>
                  @{adminSettings.login_domain}
                </span>
              </div>
            </div>
          ) : (
            /* Open mode: full email required */
            <div className="field">
              <label>{t.email}</label>
              <input required name="email" type="email" placeholder="user@company.com" />
            </div>
          )}
          <div className="field"><label>{t.password}</label><input required name="password" type="password" minLength={6} /></div>
          <button className="btn-primary full-width" type="submit">{mode === 'in' ? t.signIn : t.signUp}</button>
        </form>
        {/* Toggle signup hanya muncul kalau allow_signup aktif */}
        {adminSettings.allow_signup && (
          <p className="auth-toggle">
            <button className="btn-ghost" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
              {mode === 'in' ? t.signUp : t.signIn}
            </button>
          </p>
        )}
      </section>
      <SiteFooter t={t} />
    </main>
  );
}

// ─── User View ────────────────────────────────────────────────────────────────
function UserView({ t, lang, profile, projects, workLogs, onRefresh }: {
  t: any; lang: Lang; profile: Profile; projects: Project[]; workLogs: WorkLog[]; onRefresh: () => void;
}) {
  const days = getLast45Days();
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
  }

  function removeEntry(tempId: string) {
    setDateEntries(prev => prev.filter(e => e.tempId !== tempId));
  }

  async function handleMarkLeave() {
    if (!selectedDate) return;
    setSaving(true);
    await supabase.from('work_logs').delete().eq('user_id', profile.id).eq('log_date', selectedDate);
    const { error } = await supabase.from('work_logs').insert({ user_id: profile.id, log_date: selectedDate, is_leave: true });
    setSaving(false);
    if (error) showAlert(error.message);
    else { setSelectedDate(null); onRefresh(); }
  }

  async function handleSubmit() {
    if (!selectedDate) return;
    if (isLeaveMode) return handleMarkLeave();
    for (const e of dateEntries) {
      if (!e.project_id) { showAlert(lang === 'id' ? 'Pilih proyek terlebih dahulu.' : 'Please select a project.'); return; }
      if (!e.hours || isNaN(Number(e.hours)) || Number(e.hours) <= 0) {
        showAlert(lang === 'id' ? 'Masukkan jam kerja yang valid.' : 'Enter valid work hours.'); return;
      }
    }
    setSaving(true);
    await supabase.from('work_logs').delete().eq('user_id', profile.id).eq('log_date', selectedDate);
    const inserts = dateEntries.map(e => ({
      user_id: profile.id, log_date: selectedDate,
      project_id: e.project_id, hours: Number(e.hours), is_leave: false
    }));
    const { error } = await supabase.from('work_logs').insert(inserts);
    setSaving(false);
    if (error) showAlert(error.message);
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
                    <td className="empty-row-hint">—</td>
                    <td className="empty-row-hint">—</td>
                    <td><span className="badge-leave">{t.leaveDay}</span></td>
                    <td><button className="btn-action" onClick={() => openDate(date)}><Pencil size={14} /></button></td>
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
                        <button className="btn-action" onClick={() => openDate(date)}><Pencil size={14} /></button>
                      </td>
                    )}
                  </tr>
                ));
              }
              return (
                <tr key={date} className={isToday ? 'row-today' : ''}>
                  <td className="date-cell">
                    {isToday && <span className="today-dot" />}
                    <span className="date-label">{formatDateDisplay(date, lang).replace('\n', ' ')}</span>
                  </td>
                  <td colSpan={3} className="empty-row-hint">—</td>
                  <td>
                    <button className="btn-add-circle" onClick={() => openDate(date)}><Plus size={16} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

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
                    key={entry.tempId} entry={entry} projects={projects} lang={lang} t={t}
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
        <button className="btn-remove-entry" onClick={onRemove} title="Hapus"><X size={14} /></button>
      )}
    </div>
  );
}

// ─── Admin View ────────────────────────────────────────────────────────────────
function AdminView({
  t, lang, projects, users, workLogs, query, setQuery, sortBy, setSortBy,
  onExport, onCreate, onEdit, onDelete, onToggleActive,
  onAddUser, onEditUser, onDeleteUser, onUpdateRole,
  showCheckHours, setShowCheckHours, checkHoursDetail, setCheckHoursDetail,
  showAdminLogs, setShowAdminLogs, showAdminSettings, setShowAdminSettings,
  adminSettings, onSaveSettings, currentProfile,
}: any) {
  const totalHours = workLogs.filter((w: WorkLog) => !w.is_leave).reduce((s: number, w: WorkLog) => s + (w.hours || 0), 0);

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
                      <td><span className="hours-badge warn">{hours} jam{hasCuti ? ' + cuti' : ''}</span></td>
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

      {/* User List — all users with role editing */}
      <div className="admin-section">
        <div className="section-header">
          <h2>{t.userList}</h2>
          <button className="btn-primary" onClick={onAddUser}><UserPlus size={15} />{t.addUser}</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t.name}</th>
                <th>Email</th>
                <th>{t.role}</th>
                <th>{t.actions}</th>
              </tr>
            </thead>
            <tbody>
              {users.filter((u: Profile) => !(u.email && isProtectedDomain(u.email))).map((u: Profile) => {
                const isSelf = u.id === currentProfile?.id;
                return (
                  <tr key={u.id}>
                    <td>{u.full_name}</td>
                    <td style={{ color: 'var(--muted)', fontSize: 12 }}>
                      {u.email || '—'}
                    </td>
                    <td>
                      {isSelf ? (
                        <span className={`role-badge ${u.role}`}>{u.role}</span>
                      ) : (
                        <select
                          className="role-select"
                          value={u.role}
                          onChange={e => onUpdateRole(u, e.target.value)}
                        >
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                        </select>
                      )}
                    </td>
                    <td>
                      <div className="action-btns">
                        <button className="btn-action" onClick={() => onEditUser(u)}><Pencil size={13} /> {t.edit}</button>
                        {!isSelf && (
                          <button className="btn-action danger" onClick={() => onDeleteUser(u)}><Trash2 size={13} /> {t.delete}</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Admin tools */}
      <div className="admin-section">
        <div className="section-header">
          <h2 style={{ fontSize: 14, color: 'var(--muted)' }}>{t.adminSettings}</h2>
          <div className="section-actions">
            <button className="btn-secondary" onClick={() => setShowAdminSettings(!showAdminSettings)}>
              <Settings size={14} /> {t.adminSettings}
            </button>
            <button className="btn-secondary" onClick={() => setShowAdminLogs(!showAdminLogs)}>
              <ScrollText size={14} /> {t.adminLogs}
            </button>
          </div>
        </div>

        {showAdminSettings && (
          <AdminSettingsPanel t={t} lang={lang} adminSettings={adminSettings} onSave={onSaveSettings} />
        )}
        {showAdminLogs && (
          <AdminLogsPanel t={t} lang={lang} />
        )}
        {!showAdminSettings && !showAdminLogs && (
          <p style={{ color: 'var(--muted)', fontSize: 12, margin: 0 }}>
            {lang === 'id'
              ? 'Klik tombol di atas untuk melihat pengaturan atau log admin.'
              : 'Click a button above to view admin settings or logs.'}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Admin Settings Panel ─────────────────────────────────────────────────────
function AdminSettingsPanel({ t, lang, adminSettings, onSave }: any) {
  const [domain, setDomain] = useState(adminSettings.login_domain);
  const [allowSignup, setAllowSignup] = useState(adminSettings.allow_signup);
  const [useDomainLogin, setUseDomainLogin] = useState(adminSettings.use_domain_login);

  const divider = <div style={{ borderTop: '1px solid var(--line)', margin: '4px 0' }} />;

  function ToggleRow({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>
          <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 2 }}>{desc}</div>
        </div>
        <button
          className={`btn-action ${value ? 'activate' : 'deactivate'}`}
          onClick={() => onChange(!value)}
          style={{ minWidth: 80, fontWeight: 600, flexShrink: 0 }}
        >
          {value ? <><ToggleRight size={16} /> ON</> : <><ToggleLeft size={16} /> OFF</>}
        </button>
      </div>
    );
  }

  return (
    <div className="check-hours-panel" style={{ marginTop: 16, marginBottom: 8 }}>
      <div className="check-hours-header">
        <span><Settings size={14} /> {t.adminSettings}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '12px 0' }}>

        {/* Toggle signup */}
        <ToggleRow
          label={t.allowSignup}
          desc={lang === 'id'
            ? 'Jika dimatikan, tombol "Buat akun" tidak muncul di halaman login.'
            : 'When off, the "Create account" button is hidden on the login page.'}
          value={allowSignup}
          onChange={next => { setAllowSignup(next); onSave({ allow_signup: next }); }}
        />

        {divider}

        {/* Toggle domain login */}
        <ToggleRow
          label={t.useDomainLogin}
          desc={t.useDomainLoginDesc}
          value={useDomainLogin}
          onChange={next => { setUseDomainLogin(next); onSave({ use_domain_login: next }); }}
        />

        {divider}

        {/* Domain value (only relevant when domain login is on) */}
        <div style={{ opacity: useDomainLogin ? 1 : 0.45, pointerEvents: useDomainLogin ? 'auto' : 'none' }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{t.loginDomain}</div>
          <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 8 }}>
            {lang === 'id'
              ? 'Domain yang digunakan saat login dengan username. Hanya berlaku jika "Gunakan domain login default" aktif.'
              : 'Domain appended to username on login. Only applies when "Use default login domain" is on.'}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--muted)', alignSelf: 'center', fontSize: 14 }}>@</span>
            <input
              value={domain}
              onChange={e => setDomain(e.target.value)}
              placeholder="company.com"
              style={{ flex: 1, minWidth: 160, maxWidth: 240 }}
            />
            <button className="btn-primary" onClick={() => onSave({ login_domain: domain })}>
              <Check size={14} /> {t.save}
            </button>
          </div>
          {useDomainLogin && (
            <div style={{ marginTop: 6, color: 'var(--muted)', fontSize: 12 }}>
              {lang === 'id' ? 'Contoh login' : 'Login example'}: <code>john</code> → <code>john@{domain || 'company.com'}</code>
            </div>
          )}
          {!useDomainLogin && (
            <div style={{ marginTop: 6, color: 'var(--warn)', fontSize: 12 }}>
              {lang === 'id'
                ? '⚠ Domain tidak digunakan — user harus ketik email lengkap saat login.'
                : '⚠ Domain not used — users must type their full email to log in.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Admin Logs Panel ─────────────────────────────────────────────────────────
function AdminLogsPanel({ t, lang }: any) {
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/admin/logs?page=${page}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setTotal(data.total || 0);
      }
      setLoading(false);
    })();
  }, [page]);

  return (
    <div className="check-hours-panel" style={{ marginTop: 16, marginBottom: 8 }}>
      <div className="check-hours-header">
        <span><ScrollText size={14} /> {t.adminLogs} ({total})</span>
      </div>
      {loading ? (
        <p style={{ padding: '12px 0', color: 'var(--muted)', fontSize: 13 }}>{t.loading}</p>
      ) : logs.length === 0 ? (
        <p style={{ padding: '12px 0', color: 'var(--muted)', fontSize: 13 }}>{t.noData}</p>
      ) : (
        <table className="check-table" style={{ marginTop: 8 }}>
          <thead>
            <tr>
              <th>{lang === 'id' ? 'Waktu' : 'Time'}</th>
              <th>Admin</th>
              <th>{lang === 'id' ? 'Aksi' : 'Action'}</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id}>
                <td style={{ whiteSpace: 'nowrap', fontSize: 12, color: 'var(--muted)' }}>
                  {new Date(log.created_at).toLocaleString(lang === 'id' ? 'id-ID' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })}
                </td>
                <td style={{ fontSize: 13 }}>
                  {(log.admin as any)?.full_name || '—'}
                </td>
                <td style={{ fontSize: 13 }}>
                  {formatLogAction(log.action, log.details, lang)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {total > 50 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
          <button className="btn-secondary" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>←</button>
          <span style={{ alignSelf: 'center', fontSize: 13 }}>Page {page}</span>
          <button className="btn-secondary" onClick={() => setPage(p => p + 1)} disabled={page * 50 >= total}>→</button>
        </div>
      )}
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

function UserModal({ t, lang, user, onClose, onSubmit, loginDomain }: any) {
  const protected_ = user?.email ? isProtectedDomain(user.email) : false;
  const [username, setUsername] = useState('');
  const [fullEmail, setFullEmail] = useState('');
  // fullEmail overrides username@domain if set
  const finalEmail = fullEmail.trim() ? fullEmail.trim() : (username.trim() ? `${username.trim()}@${loginDomain}` : '');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    // inject final email
    const syntheticData = new FormData();
    syntheticData.append('full_name', String(f.get('full_name') || ''));
    if (!user) syntheticData.append('email', finalEmail);
    syntheticData.append('password', String(f.get('password') || ''));
    // Build a synthetic event with our form data
    const fakeEvent = { preventDefault: () => {}, currentTarget: { elements: {}, ...Object.fromEntries(syntheticData) } };
    // Pass directly to parent onSubmit by calling with form data override
    onSubmit(e, finalEmail);
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>{user ? t.edit : t.addUser}</h2>
          <button className="btn-ghost-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="field"><label>{t.name}</label><input name="full_name" required defaultValue={user?.full_name} /></div>
          {!user && (
            <div className="field">
              <label>Email</label>
              {/* Username + domain shortcut */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <input
                  placeholder={lang === 'id' ? 'nama.pengguna' : 'username'}
                  style={{ flex: 1 }}
                  value={username}
                  onChange={e => { setUsername(e.target.value); setFullEmail(''); }}
                  disabled={!!fullEmail}
                />
                <span style={{ color: 'var(--muted)', fontSize: 13, whiteSpace: 'nowrap' }}>@{loginDomain}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
                {lang === 'id' ? '— atau email lengkap —' : '— or full email —'}
              </div>
              <input
                name="email"
                type="email"
                placeholder={`user@other-domain.com`}
                value={fullEmail}
                onChange={e => { setFullEmail(e.target.value); setUsername(''); }}
                // Make required only if username not set
                required={!username.trim()}
              />
              {finalEmail && (
                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--brand)' }}>
                  ✓ {finalEmail}
                </div>
              )}
              {/* Hidden fallback: if fullEmail is empty but username is set, we need to inject via name="email" */}
              {username.trim() && !fullEmail && (
                <input type="hidden" name="email" value={`${username.trim()}@${loginDomain}`} />
              )}
            </div>
          )}
          <div className="field">
            <label>{t.password}{user ? ` (${lang === 'en' ? 'optional' : 'opsional'})` : ''}</label>
            <input name="password" type="password" minLength={6} required={!user} />
          </div>
          {protected_ && (
            <div style={{
              background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
              borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#f59e0b',
              display: 'flex', alignItems: 'center', gap: 6
            }}>
              <Shield size={13} /> {t.protectedDomain} — role tidak dapat diubah
            </div>
          )}
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

// ─── Alert Popup (replaces window.alert) ───────────────────────────────────
function AlertModal({ message, onClose }: { message: string | null; onClose: () => void }) {
  if (!message) return null;
  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal alert-modal">
        <div className="alert-modal-body">
          <span className="alert-modal-icon"><AlertCircle size={24} /></span>
          <p>{message}</p>
        </div>
        <div className="modal-footer alert-modal-footer">
          <button className="btn-primary" onClick={onClose} autoFocus>OK</button>
        </div>
      </div>
    </div>
  );
}
