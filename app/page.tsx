'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Image from 'next/image';
import {
  Globe2, KeyRound, LogOut, Pencil, Plus, Trash2, UserPlus, Users,
  Download, FolderPlus, AlertCircle, ChevronDown, Check,
  ToggleLeft, ToggleRight, Clock, Info, X, Shield, ScrollText,
  Settings, UserCog, AtSign, Mail, Sun, Moon
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showAlert, showStatus, registerNotifiers } from '@/lib/notify';
import {
  CATEGORY_LABEL, draftToEntry, groupLogsByProject, isDraftReady, isManualProject, logProjectCode, logProjectName, newEntryDraft, saveDay,
  type EntryDraft, type Project, type WorkCategory, type WorkLog,
} from '@/lib/worklog';
import { EntryFields } from '@/components/EntryFields';
import { DayTimerPanel } from '@/components/DayTimerPanel';

// ─── Types ───────────────────────────────────────────────────────────────────
type Lang = 'id' | 'en';
type Profile = { id: string; full_name: string; role: 'admin' | 'user'; email?: string; dev_access?: boolean; dev_role?: string | null };
type DayEntry = { project_id: string | null; project_name: string; project_code: string; hours: number; manual: boolean; category: WorkCategory; description: string };
type AdminLog = {
  id: string; action: string; details: any; created_at: string;
  admin?: { full_name: string } | null;
  target?: { full_name: string } | null;
};
type LoginMethod = 'password' | 'microsoft' | 'both';
type AdminSettings = { allow_signup: boolean; login_domain: string; use_domain_login: boolean; login_method: LoginMethod; maintenance_mode: boolean; main_domain: string };
type AppPopup = { id: string; title: string; body: string; custom_label: string | null; custom_url: string | null; close_label: string | null };

const PROTECTED_DOMAINS = ['leonxlab.app', 'leonxlab.digital'];
const DEVELOPER_DOMAINS = ['leonxlab.app', 'leonxlab.digital'];

// ─── i18n ─────────────────────────────────────────────────────────────────────
const text = {
  id: {
    app: 'Weave', login: 'Masuk', email: 'Email', password: 'Kata sandi',
    signIn: 'Masuk', signUp: 'Buat akun', logout: 'Keluar',
    projects: 'Proyek Saya', admin: 'Admin', welcome: 'Selamat datang',
    cancel: 'Batal', save: 'Simpan', overview: 'Ringkasan',
    totalProjects: 'Total proyek', totalUsers: 'Total karyawan', totalHours: 'Total jam kerja',
    createProject: 'Buat proyek', projectName: 'Nama proyek', projectCode: 'Nomor proyek',
    description: 'Deskripsi', assignTo: 'Tugaskan ke', allUsers: 'Semua (default)',
    create: 'Buat', records: 'Rekapan', export: 'Ekspor Excel', company: 'Company Name / Company',
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
    lowHours: 'Karyawan jam kerja < 25 jam (7 hari terakhir)',
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
    loginMethod: 'Metode login', loginPassword: 'Password', loginMicrosoft: 'Microsoft', loginBoth: 'Keduanya',
    all: 'Semua', fromDate: 'Dari tanggal', toDate: 'Sampai tanggal', lightMode: 'Mode terang', darkMode: 'Mode gelap',
    maintenanceMode: 'Mode maintenance', maintenanceMessage: 'Aplikasi sedang dalam maintenance. Silakan coba lagi nanti.',
    mainDomain: 'Domain utama', mainDomainDesc: 'Domain yang akan diumumkan sebagai alamat utama aplikasi setelah tanggal pengumuman.',
    tos: 'Syarat & Ketentuan', privacy: 'Kebijakan Privasi',
    support: 'Dukungan',
    changePassword: 'Ganti Password', currentPassword: 'Password Saat Ini', newPassword: 'Password Baru',
    confirmPassword: 'Konfirmasi Password', passwordMismatch: 'Password baru tidak cocok.',
    passwordTooShort: 'Password minimal 6 karakter.', passwordChanged: 'Password berhasil diubah.',
    switchToEmployee: 'Karyawan', switchToAdmin: 'Admin',
    logWork: 'Catat jam kerja', logWorkSub: 'Proyek & jam per tanggal', myLogs: 'Pencatatan saya',
    jenis: 'Jenis', kerja: 'Kerja', close: 'Tutup', manual: 'Manual', logged: 'Tercatat',
    useManual: 'Gunakan', manualCode: 'Kode proyek (opsional)', noProjectMatch: 'Proyek tidak ditemukan',
    replaceHint: 'Tanggal ini sudah tercatat. Menyimpan akan mengganti pencatatan sebelumnya.', noLogs: 'Belum ada pencatatan',
    kategori: 'Kategori', deskripsi: 'Deskripsi (opsional)', deskripsiHeader: 'Deskripsi',
    descQuotation: 'Nama proyek quotation', descTraining: 'Topik training',
    timerToday: 'Timer hari ini', startDay: 'Mulai hari', startDaySub: 'Catat waktu kerja secara langsung',
    pauseTimer: 'Pause', resumeTimer: 'Lanjut', popOut: 'Pop out', finishDay: 'Selesai & kirim',
    addTimerItem: '+ Tambah', add: 'Tambah', totalToday: 'Total hari ini',
    timerLocalNote: 'Timer tersimpan di PC ini sampai dikirim. Kirim setiap akhir hari.',
    timerOtherWindow: 'Timer sedang berjalan di jendela lain.',
    timerStaleDay: 'Hari {date} belum dikirim. Periksa lalu kirim.',
    noTimerItems: 'Belum ada item. Tambahkan proyek untuk mulai.',
    awayMessage: 'Kamu tidak aktif {min} menit saat {item} berjalan.',
    awayKeep: 'Tetap di {item}', awayMove: 'Pindah ke item lain…', awayDiscard: 'Buang', awayMoveTo: 'Pindahkan',
    reviewTitle: 'Periksa & kirim', tracked: 'Timer', alreadyLogged: 'Sudah tercatat',
    backToTimer: 'Kembali ke timer', send: 'Kirim', daySent: 'Hari terkirim.', reviewTotal: 'Total jam',
    reviewZeroHint: 'Baris 0 jam tidak disimpan.',
    inDevelopment: 'Dalam pengembangan', expand: 'Buka', collapse: 'Ciutkan',
    viewByDay: 'Per hari', viewByProject: 'Per proyek', daysCount: 'hari', totalLabel: 'Total',
    reviewLeaveNotice: 'Tanggal ini tercatat sebagai cuti. Mengirim akan mengganti cuti dengan jam kerja ini.',
  },
  en: {
    app: 'Weave', login: 'Sign in', email: 'Email', password: 'Password',
    signIn: 'Sign in', signUp: 'Create account', logout: 'Sign out',
    projects: 'My Projects', admin: 'Admin', welcome: 'Welcome',
    cancel: 'Cancel', save: 'Save', overview: 'Overview',
    totalProjects: 'Total projects', totalUsers: 'Total employees', totalHours: 'Total work hours',
    createProject: 'Create project', projectName: 'Project name', projectCode: 'Project number',
    description: 'Description', assignTo: 'Assign to', allUsers: 'All (default)',
    create: 'Create', records: 'Records', export: 'Export Excel', company: 'Company Name / Company',
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
    lowHours: 'Employees with < 25 hours (last 7 days)',
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
    loginMethod: 'Login method', loginPassword: 'Password', loginMicrosoft: 'Microsoft', loginBoth: 'Both',
    all: 'All', fromDate: 'From date', toDate: 'To date', lightMode: 'Light mode', darkMode: 'Dark mode',
    maintenanceMode: 'Maintenance mode', maintenanceMessage: 'The application is under maintenance. Please try again later.',
    mainDomain: 'Main domain', mainDomainDesc: 'The domain announced as the application main address after the announcement date.',
    tos: 'Terms of Service', privacy: 'Privacy Policy',
    changePassword: 'Change Password', currentPassword: 'Current Password', newPassword: 'New Password',
    confirmPassword: 'Confirm Password', passwordMismatch: 'New passwords do not match.',
    passwordTooShort: 'Password must be at least 6 characters.', passwordChanged: 'Password changed successfully.',
    switchToEmployee: 'Employee', switchToAdmin: 'Admin',
    support: 'Support',
    logWork: 'Log work hours', logWorkSub: 'Projects & hours per date', myLogs: 'My entries',
    jenis: 'Type', kerja: 'Work', close: 'Close', manual: 'Manual', logged: 'Logged',
    useManual: 'Use', manualCode: 'Project code (optional)', noProjectMatch: 'No matching project',
    replaceHint: 'This date already has entries. Saving will replace them.', noLogs: 'No entries yet',
    kategori: 'Category', deskripsi: 'Description (optional)', deskripsiHeader: 'Description',
    descQuotation: 'Quotation project name', descTraining: 'Training topic',
    timerToday: "Today's timer", startDay: 'Start day', startDaySub: 'Track your work time live',
    pauseTimer: 'Pause', resumeTimer: 'Resume', popOut: 'Pop out', finishDay: 'Finish & send',
    addTimerItem: '+ Add', add: 'Add', totalToday: 'Total today',
    timerLocalNote: 'The timer is stored on this PC until sent. Send it at the end of each day.',
    timerOtherWindow: 'The timer is running in another window.',
    timerStaleDay: '{date} has not been sent yet. Review and send it.',
    noTimerItems: 'No items yet. Add a project to start.',
    awayMessage: 'You were away {min} min while {item} was running.',
    awayKeep: 'Keep on {item}', awayMove: 'Move to another item…', awayDiscard: 'Discard', awayMoveTo: 'Move',
    reviewTitle: 'Review & send', tracked: 'Timer', alreadyLogged: 'Already logged',
    backToTimer: 'Back to timer', send: 'Send', daySent: 'Day sent.', reviewTotal: 'Total hours',
    reviewZeroHint: 'Rows with 0 hours are not saved.',
    inDevelopment: 'In development', expand: 'Expand', collapse: 'Collapse',
    viewByDay: 'By day', viewByProject: 'By project', daysCount: 'days', totalLabel: 'Total',
    reviewLeaveNotice: 'This date is marked as leave. Sending will replace the leave with these work hours.',
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
function getMonthKey(date = new Date()) { return date.toISOString().slice(0, 7); }
function getExportMonths() {
  return [0, 1, 2].map(offset => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - offset);
    return getMonthKey(date);
  });
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
function isDeveloperEmail(email?: string) {
  const normalizedEmail = email?.toLowerCase() || '';
  return DEVELOPER_DOMAINS.some(domain => normalizedEmail.endsWith(`@${domain}`));
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
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const t = text[lang];
  const [profile, setProfile] = useState<Profile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [logsLoaded, setLogsLoaded] = useState(false);
  const [hasV4Schema, setHasV4Schema] = useState(false);
  const [changePassOpen, setChangePassOpen] = useState(false);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [authMode, setAuthMode] = useState<'in' | 'up'>('in');
  const [adminSettings, setAdminSettings] = useState<AdminSettings>({ allow_signup: true, login_domain: 'company.com', use_domain_login: true, login_method: 'both', maintenance_mode: false, main_domain: '' });
  const [adminMode, setAdminMode] = useState<'user' | 'admin'>('user');

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
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [domainNotice, setDomainNotice] = useState<'upcoming' | 'migration' | null>(null);
  const [activePopups, setActivePopups] = useState<AppPopup[]>([]);
  const [dismissedPopups, setDismissedPopups] = useState<string[]>([]);

  useEffect(() => {
    return registerNotifiers(setAlertMessage, setStatusMessage);
  }, []);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem('weave-theme');
    if (savedTheme === 'dark' || savedTheme === 'light') setTheme(savedTheme);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('weave-theme', theme);
  }, [theme]);

  useEffect(() => {
    fetch('/api/popups').then(response => response.ok ? response.json() : []).then(data => setActivePopups(data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!settingsLoaded) return;
    const hostname = window.location.hostname;
    const isAlternateDomain = hostname !== 'weave.web.id' && hostname !== 'localhost' && hostname !== '127.0.0.1';
    if (!isAlternateDomain) return;
    const today = new Date();
    const launchDate = new Date('2026-09-10T00:00:00');
    const shutdownDate = new Date('2026-10-01T00:00:00');
    if (today >= launchDate && today < shutdownDate && adminSettings.main_domain) setDomainNotice('migration');
  }, [settingsLoaded, adminSettings.main_domain]);

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
          login_method: (['password', 'microsoft', 'both'].includes(data.login_method) ? data.login_method : 'both') as LoginMethod,
          maintenance_mode: data.maintenance_mode === 'true',
          main_domain: data.main_domain || '',
        });
      }
    } catch {} finally {
      setSettingsLoaded(true);
    }
  }, []);

  const load = useCallback(async () => {
    if (!configured) return setLoading(false);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setProfile(null); setLoading(false); return; }
    const { data: own } = await supabase.from('profiles').select('id,full_name,role,dev_access,dev_role').eq('id', user.id).single();
    if (!own) return setLoading(false);
    const metadata = user.user_metadata || {};
    const identityData = user.identities?.[0]?.identity_data || {};
    const identityEmail = user.email || metadata.email || metadata.preferred_username || identityData.email || identityData.preferred_username || '';
    const identityName = metadata.full_name || metadata.name || metadata.display_name || metadata.preferred_username
      || identityData.full_name || identityData.name || identityData.display_name || identityData.preferred_username?.split('@')[0]
      || [metadata.given_name, metadata.family_name].filter(Boolean).join(' ')
      || [identityData.given_name, identityData.family_name].filter(Boolean).join(' ')
      || identityEmail.split('@')[0] || '';
    const profileName = own.full_name === 'New user' && identityName ? identityName : own.full_name;
    if (profileName !== own.full_name) {
      await supabase.from('profiles').update({ full_name: profileName }).eq('id', user.id);
    }
    // Attach email for protected domain detection
    const effectiveRole = isDeveloperEmail(identityEmail) ? 'admin' : own.role;
    const devAccess = Boolean((own as any).dev_access) || isDeveloperEmail(identityEmail);
    setProfile({ ...(own as Profile), full_name: profileName, role: effectiveRole, email: identityEmail, dev_access: devAccess });

    const logColumns = 'id,user_id,log_date,project_id,hours,is_leave,profiles(full_name),projects(name,project_code)';
    const loadLogs = async () => {
      // These columns exist only after supabase/schema-v4-worklog-entries.sql has been run.
      const withManual = await supabase.from('work_logs').select(`${logColumns},custom_project_name,custom_project_code,category,description`).order('log_date', { ascending: false });
      setHasV4Schema(!withManual.error);
      if (!withManual.error) return withManual;
      return supabase.from('work_logs').select(logColumns).order('log_date', { ascending: false });
    };
    const [{ data: allProjects }, { data: logs }, { data: allUsers }] = await Promise.all([
      supabase.from('projects').select('id,project_code,name,company,description,is_active,inactive_from').order('created_at', { ascending: false }),
      loadLogs(),
      (effectiveRole === 'admin' || Boolean((own as any).dev_access)) ? supabase.from('profiles').select('id,full_name,role,dev_access,dev_role').order('full_name') : Promise.resolve({ data: [] })
    ]);

    // For admin, enrich users with emails
    let enrichedUsers: Profile[] = (allUsers || []) as Profile[];
    if (effectiveRole === 'admin') {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch('/api/admin/users-list', {
          headers: { Authorization: `Bearer ${session?.access_token}` }
        });
        if (res.ok) {
          const emailMap: Record<string, string> = await res.json();
          enrichedUsers = enrichedUsers.map(u => ({
            ...u,
            full_name: u.id === user.id ? profileName : u.full_name,
            role: u.id === user.id ? effectiveRole : u.role,
            email: emailMap[u.id] || '',
          }));
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
    setLogsLoaded(true);
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

  async function authenticateMicrosoft() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        redirectTo: `${window.location.origin}/`,
        scopes: 'openid profile email User.Read',
      },
    });
    if (error) showAlert(error.message);
  }

  async function createProjectFn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!profile) return;
    showStatus(lang === 'id' ? 'Menyimpan proyek…' : 'Saving project…');
    const f = new FormData(e.currentTarget);
    const { data, error } = await supabase.from('projects').insert({
      name: f.get('name'), project_code: f.get('code'), company: f.get('company'), description: f.get('description'), created_by: profile.id
    }).select().single();
    if (error || !data) return showAlert(error?.message || 'Error');
    const target = String(f.get('user_id') || '');
    await supabase.from('project_assignments').insert({ project_id: data.id, assigned_to: target || null });
    setCreateOpen(false); load();
  }

  async function updateProjectFn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editProject) return;
    showStatus(lang === 'id' ? 'Menyimpan perubahan…' : 'Saving changes…');
    const f = new FormData(e.currentTarget);
    const { error } = await supabase.from('projects').update({
      name: f.get('name'), project_code: f.get('code'), company: f.get('company'), description: f.get('description')
    }).eq('id', editProject.id);
    if (error) showAlert(error.message); else { setEditProject(null); load(); }
  }

  async function toggleProjectActive(project: Project) {
    showStatus(lang === 'id' ? 'Memperbarui status…' : 'Updating status…');
    const newActive = !project.is_active;
    const { error } = await supabase.from('projects').update({
      is_active: newActive,
      inactive_from: newActive ? null : todayStr()
    }).eq('id', project.id);
    if (error) showAlert(error.message); else load();
  }

  async function deleteProjectFn(project: Project) {
    if (!confirm(`${t.delete} ${project.name}?`)) return;
    showStatus(lang === 'id' ? 'Menghapus proyek…' : 'Deleting project…');
    const { error } = await supabase.from('projects').delete().eq('id', project.id);
    if (error) showAlert(error.message); else load();
  }

  async function adminUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    showStatus(lang === 'id' ? 'Menyimpan akun…' : 'Saving account…');
    const f = new FormData(e.currentTarget);
    // UserModal injects __finalEmail for the username+domain shortcut case
    const emailFromModal = (e.currentTarget as any).__finalEmail as string | undefined;
    const emailFromForm = f.get('email') as string | null;
    const email = emailFromModal || emailFromForm || '';

    const fullName = (f.get('full_name') as string || '').trim();
    const password = (f.get('password') as string || '').trim() || undefined;

    if (userOpen === 'new') {
      if (!fullName) { showAlert(lang === 'id' ? 'Nama wajib diisi.' : 'Name is required.'); return; }
      if (!email) { showAlert(lang === 'id' ? 'Email wajib diisi.' : 'Email is required.'); return; }
      if (!password) { showAlert(lang === 'id' ? 'Password wajib diisi.' : 'Password is required.'); return; }
    }

    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch('/api/admin/users', {
      method: userOpen === 'new' ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({
        id: userOpen === 'new' ? undefined : (userOpen as Profile)?.id,
        full_name: fullName, email, password
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
    showStatus(lang === 'id' ? 'Menghapus akun…' : 'Deleting account…');
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
    showStatus(lang === 'id' ? 'Memperbarui role…' : 'Updating role…');
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
    showStatus(lang === 'id' ? 'Menyimpan pengaturan…' : 'Saving settings…');
    const { data: { session } } = await supabase.auth.getSession();
    const body: any = {};
    if (settings.allow_signup !== undefined) body.allow_signup = settings.allow_signup;
    if (settings.login_domain !== undefined) body.login_domain = settings.login_domain;
    if (settings.use_domain_login !== undefined) body.use_domain_login = settings.use_domain_login;
    if (settings.login_method !== undefined) body.login_method = settings.login_method;
    if (settings.maintenance_mode !== undefined) body.maintenance_mode = settings.maintenance_mode;
    if (settings.main_domain !== undefined) body.main_domain = settings.main_domain;
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

  async function exportExcel(period: string, fromDate: string, toDate: string) {
    const { default: ExcelJS } = await import('exceljs');
    const rows = workLogs.filter(wl => {
      if (period !== 'all' && !wl.log_date.startsWith(period)) return false;
      if (fromDate && wl.log_date < fromDate) return false;
      if (toDate && wl.log_date > toDate) return false;
      const key = `${wl.profiles?.full_name} ${logProjectName(wl)} ${logProjectCode(wl)} ${wl.category || ''} ${wl.description || ''}`.toLowerCase();
      return key.includes(query.toLowerCase());
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(t.records);

    sheet.columns = [
      { header: t.user, key: 'user', width: 22 },
      { header: t.kategori, key: 'category', width: 14 },
      { header: t.namaProyek, key: 'project', width: 24 },
      { header: t.nomorProyek, key: 'code', width: 18 },
      { header: t.tanggal, key: 'date', width: 14 },
      { header: t.jamKerja, key: 'hours', width: 12 },
      { header: t.leave, key: 'leave', width: 12 },
      { header: t.deskripsiHeader, key: 'description', width: 32 },
    ];
    sheet.getRow(1).font = { bold: true };

    rows.forEach(r => {
      const row = sheet.addRow({
        user: r.profiles?.full_name || '',
        category: r.is_leave ? '' : CATEGORY_LABEL[r.category || 'project'],
        project: logProjectName(r),
        code: logProjectCode(r),
        date: r.log_date,
        hours: r.is_leave ? '' : (r.hours ?? 0),
        leave: r.is_leave ? t.leave : '',
        description: r.description || '',
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
    a.download = `rekapan-${period === 'all' ? 'semua' : period}${fromDate || toDate ? `-${fromDate || 'awal'}-${toDate || 'akhir'}` : ''}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const visibleProjects = useMemo(() => {
    return projects.filter(p => p.is_active);
  }, [projects]);

  if (!configured) return <main className="shell"><div className="notice">{t.setup}</div></main>;
  if (loading) return <main className="shell"><p className="loading-text">{t.loading}</p></main>;
  if (!profile && !settingsLoaded) return <main className="shell"><p className="loading-text">{t.loading}</p></main>;
  if (!profile) return (
    <>
      <Auth
        lang={lang} setLang={setLang} t={t} mode={authMode} setMode={setAuthMode}
        onSubmit={authenticate} onMicrosoft={authenticateMicrosoft} adminSettings={adminSettings}
        theme={theme} setTheme={setTheme}
      />
      <AlertModal message={alertMessage} onClose={() => setAlertMessage(null)} />
      <StatusToast message={statusMessage} />
      <DomainNotice notice={domainNotice} mainDomain={adminSettings.main_domain} onClose={() => setDomainNotice(null)} />
      <AnnouncementPopup popup={activePopups.find(popup => !dismissedPopups.includes(popup.id))} onClose={popup => setDismissedPopups(current => [...current, popup.id])} />
    </>
  );
  const isAdmin = profile.role === 'admin' || Boolean(profile.dev_access);

  if (!isAdmin && adminSettings.maintenance_mode) {
    return <MaintenanceView t={t} onLogout={() => supabase.auth.signOut()} />;
  }

  return (
    <main className="shell">
      <header className="topbar">
        <Brand />
        <div className="top-actions">
          <button className="lang-btn" onClick={() => setLang(lang === 'id' ? 'en' : 'id')} title={lang === 'id' ? 'Switch to English' : 'Ganti ke Bahasa Indonesia'}>
            <Globe2 size={14} /> {lang.toUpperCase()}
          </button>
          <button className="icon-button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} title={theme === 'light' ? t.darkMode : t.lightMode}>
            {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
          </button>
          {isAdmin && (
            <button className="btn-secondary" onClick={() => setAdminMode(mode => mode === 'user' ? 'admin' : 'user')}>
              <UserCog size={15} /> {adminMode === 'user' ? t.switchToAdmin : t.switchToEmployee}
            </button>
          )}
          <button className="icon-button" onClick={() => setChangePassOpen(true)}>
            <KeyRound size={15} />{t.changePassword}
          </button>
          <button className="icon-button" onClick={() => supabase.auth.signOut()}>
            <LogOut size={15} />{t.logout}
          </button>
          {profile.dev_access && <a className="btn-secondary" href="/dev"><Shield size={15} /> Weave-DevOps</a>}
        </div>
      </header>

      {isAdmin && adminMode === 'admin' ? (
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
        <UserView t={t} lang={lang} profile={profile} projects={visibleProjects} workLogs={workLogs.filter(w => w.user_id === profile.id)} logsLoaded={logsLoaded} hasV4Schema={hasV4Schema} onRefresh={load} />
      )}

      {changePassOpen && <ChangePasswordModal t={t} lang={lang} onClose={() => setChangePassOpen(false)} />}
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
      <StatusToast message={statusMessage} />
      <DomainNotice notice={domainNotice} mainDomain={adminSettings.main_domain} onClose={() => setDomainNotice(null)} />
      <AnnouncementPopup popup={activePopups.find(popup => !dismissedPopups.includes(popup.id))} onClose={popup => setDismissedPopups(current => [...current, popup.id])} />
      <SiteFooter t={t} />
    </main>
  );
}

function AnnouncementPopup({ popup, onClose }: { popup?: AppPopup; onClose: (popup: AppPopup) => void }) {
  if (!popup) return null;
  return (
    <div className="popup-backdrop" role="presentation">
      <section className="announcement-popup" role="dialog" aria-modal="true" aria-labelledby="announcement-title">
        <h2 id="announcement-title">{popup.title}</h2>
        <p className="announcement-body">{popup.body}</p>
        <div className="announcement-actions">
          {popup.custom_label && popup.custom_url && <a className="btn-primary" href={popup.custom_url} target="_blank" rel="noreferrer">{popup.custom_label}</a>}
          <button className="btn-secondary" onClick={() => onClose(popup)}>{popup.close_label || 'OK'}</button>
        </div>
      </section>
    </div>
  );
}

// ─── Footer ─────────────────────────────────────────────────────────────────
function SiteFooter({ t }: { t?: any }) {
  return (
    <footer className="site-footer">
      <div className="footer-copyright">© 2026 Weave</div>
      <div className="footer-support">
        <span className="footer-support-icon"><Mail size={13} /></span>
        <span className="footer-support-label">{t?.support || 'Support'}</span>
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

function MaintenanceView({ t, onLogout }: { t: any; onLogout: () => void }) {
  return (
    <main className="shell auth-shell maintenance-view">
      <section className="auth-card">
        <Settings size={32} />
        <h1>{t.maintenanceMode}</h1>
        <p className="auth-hint">{t.maintenanceMessage}</p>
        <button className="btn-secondary full-width" onClick={onLogout}>
          <LogOut size={15} /> {t.logout}
        </button>
      </section>
    </main>
  );
}

function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <Image src="/logo/weaver-icon.svg" alt="Weave" width={64} height={64} style={{ objectFit: 'contain' }} />
      </span>
      <span className="brand-lockup">
        <span className="brand-name">Weave</span>
        <span className="brand-tagline">work, woven together.</span>
      </span>
    </div>
  );
}

function DomainNotice({ notice, mainDomain, onClose }: { notice: 'upcoming' | 'migration' | null; mainDomain: string; onClose: () => void }) {
  if (!notice) return null;
  const upcoming = notice === 'upcoming';
  const domainUrl = mainDomain ? `https://${mainDomain}/` : '';
  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal domain-notice-modal">
        <div className="domain-notice-body">
          <div className="domain-notice-kicker">WEAVE</div>
          <h2>{upcoming ? 'Informasi domain utama segera hadir' : `Pindah ke ${mainDomain}`}</h2>
          <p>
            {upcoming
              ? 'Anda sedang menggunakan domain alternatif. Informasi domain utama akan diumumkan pada 10 September 2026.'
              : `Domain utama ${mainDomain} sudah aktif. Domain ini akan dinonaktifkan mulai 1 Oktober 2026.`}
          </p>
          {!upcoming && <a className="domain-url" href={domainUrl} target="_blank" rel="noopener noreferrer">
            <span className="domain-url-prefix">https://</span>{mainDomain}/
          </a>}
          <p className="domain-bookmark-hint">
            {upcoming ? 'Silakan tunggu informasi terbaru dari developer.' : 'Simpan alamat di atas sebagai bookmark agar mudah diakses kembali.'}
          </p>
        </div>
        <div className="modal-footer domain-notice-footer">
          <button className="btn-secondary" onClick={onClose}>Nanti saja</button>
          {!upcoming && <a className="btn-primary" href={domainUrl} target="_blank" rel="noopener noreferrer">Pindah sekarang</a>}
        </div>
      </div>
    </div>
  );
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
function Auth({ lang, setLang, t, mode, setMode, onSubmit, onMicrosoft, adminSettings, theme, setTheme }: any) {
  return (
    <main className="shell auth-shell">
      <header className="topbar">
        <Brand />
        <div className="top-actions">
          <button className="lang-btn" onClick={() => setLang(lang === 'id' ? 'en' : 'id')} title={lang === 'id' ? 'Switch to English' : 'Ganti ke Bahasa Indonesia'}>
            <Globe2 size={14} /> {lang.toUpperCase()}
          </button>
          <button className="icon-button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} title={theme === 'light' ? t.darkMode : t.lightMode}>
            {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
          </button>
        </div>
      </header>
      <section className="auth-card">
        <h1>{mode === 'in' ? t.login : t.createAccount}</h1>
        <p className="auth-hint">
          {adminSettings.login_method === 'microsoft'
            ? (lang === 'id' ? 'Masuk dengan akun anda' : 'Sign in with your account')
            : t.authHint}
        </p>
        {adminSettings.login_method !== 'microsoft' && <form onSubmit={onSubmit}>
          {mode === 'up' && <div className="field"><label htmlFor="auth-full-name">{t.name}</label><input id="auth-full-name" required name="full_name" /></div>}
          {mode === 'up' ? (
            <div className="field"><label htmlFor="auth-email">{t.email}</label><input id="auth-email" required name="email" type="email" /></div>
          ) : adminSettings.use_domain_login ? (
            /* Username-only mode: @domain appended automatically */
            <div className="field">
              <label htmlFor="auth-username">{t.username || 'Username'}</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  id="auth-username" required name="username" placeholder={lang === 'id' ? 'nama.anda' : 'your.name'}
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
              <label htmlFor="auth-email">{t.email}</label>
              <input id="auth-email" required name="email" type="email" placeholder="user@company.com" />
            </div>
          )}
          <div className="field"><label htmlFor="auth-password">{t.password}</label><input id="auth-password" required name="password" type="password" minLength={6} /></div>
          <button className="btn-primary full-width" type="submit">{mode === 'in' ? t.signIn : t.signUp}</button>
        </form>}
        {adminSettings.login_method !== 'password' && (
          <button className="btn-secondary full-width" type="button" onClick={onMicrosoft}>
            <span className="microsoft-mark" aria-hidden="true">
              <span /><span /><span /><span />
            </span>
            {lang === 'id' ? 'Masuk dengan Microsoft' : 'Login with Microsoft'}
          </button>
        )}
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
function ChangePasswordModal({ t, lang, onClose }: { t: any; lang: Lang; onClose: () => void }) {
  async function handleChangePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const newPass = (f.get('new_password') as string || '').trim();
    const confirmPass = (f.get('confirm_password') as string || '').trim();
    if (newPass.length < 6) { showAlert(t.passwordTooShort); return; }
    if (newPass !== confirmPass) { showAlert(t.passwordMismatch); return; }
    showStatus(lang === 'id' ? 'Menyimpan password…' : 'Saving password…');
    const { error } = await supabase.auth.updateUser({ password: newPass });
    if (error) showAlert(error.message);
    else { onClose(); showStatus(t.passwordChanged); }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>{t.changePassword}</h2>
          <button className="btn-ghost-icon" onClick={() => onClose()}><X size={18} /></button>
        </div>
        <form onSubmit={handleChangePassword}>
          <div className="field">
            <label>{t.newPassword}</label>
            <input name="new_password" type="password" minLength={6} required placeholder="Min. 6 karakter" />
          </div>
          <div className="field">
            <label>{t.confirmPassword}</label>
            <input name="confirm_password" type="password" minLength={6} required />
          </div>
          <div className="modal-footer">
            <div />
            <div className="modal-footer-right">
              <button type="button" className="btn-secondary" onClick={() => onClose()}>{t.cancel}</button>
              <button type="submit" className="btn-primary"><KeyRound size={15} />{t.changePassword}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function entryLabel(e: DayEntry) {
  if (e.category === 'project') return e.project_name;
  return e.description ? `${CATEGORY_LABEL[e.category]}: ${e.description}` : CATEGORY_LABEL[e.category];
}

function formatCardDate(dateStr: string, lang: Lang): string {
  const d = new Date(dateStr + 'T00:00:00');
  const formatted = d.toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  if (dateStr === todayStr()) return `${lang === 'id' ? 'Hari ini' : 'Today'} · ${formatted}`;
  return formatted;
}

function UserView({ t, lang, profile, projects, workLogs, logsLoaded, hasV4Schema, onRefresh }: {
  t: any; lang: Lang; profile: Profile; projects: Project[]; workLogs: WorkLog[]; logsLoaded: boolean; hasV4Schema: boolean; onRefresh: () => void;
}) {
  const days = getLast45Days();
  const logsByDate = useMemo(() => {
    const map: Record<string, { isLeave: boolean; entries: DayEntry[] }> = {};
    for (const wl of workLogs) {
      if (!map[wl.log_date]) map[wl.log_date] = { isLeave: false, entries: [] };
      if (wl.is_leave) {
        map[wl.log_date].isLeave = true;
      } else if (wl.project_id || wl.custom_project_name || (wl.category && wl.category !== 'project')) {
        map[wl.log_date].entries.push({
          project_id: wl.project_id,
          project_name: logProjectName(wl),
          project_code: logProjectCode(wl),
          hours: wl.hours || 0,
          manual: isManualProject(wl),
          category: wl.category || 'project',
          description: wl.description || ''
        });
      }
    }
    return map;
  }, [workLogs]);
  const loggedDates = useMemo(() => Object.keys(logsByDate).sort((a, b) => b.localeCompare(a)), [logsByDate]);

  const [formOpen, setFormOpen] = useState(false);
  const [listOpen, setListOpen] = useState(true);
  const [listView, setListView] = useState<'day' | 'project'>('day');
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const projectGroups = useMemo(() => groupLogsByProject(workLogs), [workLogs]);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [saving, setSaving] = useState(false);
  const [dateEntries, setDateEntries] = useState<EntryDraft[]>([newEntryDraft()]);
  const [isLeaveMode, setIsLeaveMode] = useState(false);
  const addEntryRef = useRef<HTMLButtonElement>(null);
  const [addedEntryId, setAddedEntryId] = useState<string | null>(null);

  // After "Tambah Proyek", bring the new row into view and put the cursor in its project field.
  useEffect(() => {
    if (!addedEntryId) return;
    addEntryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.querySelector<HTMLInputElement>(`[data-entry-id="${addedEntryId}"] .combobox input`)?.focus({ preventScroll: true });
  }, [addedEntryId]);

  async function handleDeleteDate(date: string) {
    if (!confirm(`${t.delete} ${formatCardDate(date, lang)}?`)) return;
    setSaving(true);
    const { error } = await supabase.from('work_logs').delete().eq('user_id', profile.id).eq('log_date', date);
    setSaving(false);
    if (error) showAlert(error.message); else onRefresh();
  }

  function loadDate(date: string) {
    const existing = logsByDate[date];
    setIsLeaveMode(Boolean(existing?.isLeave));
    const entries = (existing?.entries || []).map(e => ({
      ...newEntryDraft(),
      category: e.category,
      description: e.description,
      project_id: e.project_id || '',
      custom_name: e.manual ? e.project_name : '',
      custom_code: e.manual ? e.project_code : '',
      query: e.category !== 'project' ? '' : e.manual ? e.project_name : `${e.project_name} — ${e.project_code}`,
      hours: String(e.hours)
    }));
    setDateEntries(entries.length ? entries : [newEntryDraft()]);
    setSelectedDate(date);
  }

  function openForm(date: string) {
    loadDate(date);
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function addEntry() {
    const entry = newEntryDraft();
    setDateEntries(prev => [...prev, entry]);
    setAddedEntryId(entry.tempId);
  }

  function updateEntry(tempId: string, patch: Partial<EntryDraft>) {
    setDateEntries(prev => prev.map(e => e.tempId === tempId ? { ...e, ...patch } : e));
  }

  function removeEntry(tempId: string) {
    setDateEntries(prev => prev.filter(e => e.tempId !== tempId));
  }

  const entriesValid = dateEntries.every(e => isDraftReady(e));
  const canSubmit = !saving && Boolean(selectedDate) && (isLeaveMode || entriesValid);

  async function handleMarkLeave() {
    setSaving(true);
    await supabase.from('work_logs').delete().eq('user_id', profile.id).eq('log_date', selectedDate);
    const { error } = await supabase.from('work_logs').insert({ user_id: profile.id, log_date: selectedDate, is_leave: true });
    setSaving(false);
    if (error) showAlert(error.message);
    else { setFormOpen(false); onRefresh(); }
  }

  async function handleSubmit() {
    if (!selectedDate) return;
    if (isLeaveMode) return handleMarkLeave();
    for (const e of dateEntries) {
      if (!isDraftReady(e, { requireHours: false })) { showAlert(lang === 'id' ? 'Pilih proyek terlebih dahulu.' : 'Please select a project.'); return; }
      if (!isDraftReady(e)) { showAlert(lang === 'id' ? 'Masukkan jam kerja yang valid.' : 'Enter valid work hours.'); return; }
    }
    setSaving(true);
    const { error } = await saveDay(supabase, profile.id, selectedDate, dateEntries.map(draftToEntry), hasV4Schema);
    setSaving(false);
    if (error) showAlert(error);
    else { setFormOpen(false); onRefresh(); }
  }

  return (
    <div className="user-view">
      <div className="user-header">
        <h1>{t.welcome}, <span className="user-name">{profile.full_name}</span></h1>
      </div>

      <div className="worklog-layout">
      <div className="worklog-column">
        <DayTimerPanel t={t} lang={lang} userId={profile.id} projects={projects} hasV4Schema={hasV4Schema}
          workLogs={workLogs} logsLoaded={logsLoaded} onSent={onRefresh} />
        {!formOpen ? (
          <button className="worklog-cta" onClick={() => openForm(todayStr())}>
            <span className="worklog-cta-title">{t.logWork}</span>
            <span className="worklog-cta-sub">{t.logWorkSub}</span>
          </button>
        ) : (
          <div className="worklog-form">
            <div className="worklog-form-header">
              <span className="worklog-section-label">{t.logWork}</span>
            </div>

            <div className="field">
              <label>{t.jenis}</label>
              <select value={isLeaveMode ? 'leave' : 'work'} onChange={e => setIsLeaveMode(e.target.value === 'leave')}>
                <option value="work">{t.kerja}</option>
                <option value="leave">{t.leaveDay}</option>
              </select>
            </div>

            <div className="field">
              <label>{t.tanggal}</label>
              <input type="date" value={selectedDate} min={days[days.length - 1]} max={days[0]}
                onChange={e => e.target.value && loadDate(e.target.value)} />
              {logsByDate[selectedDate] && <p className="worklog-hint">{t.replaceHint}</p>}
            </div>

            {!isLeaveMode && (
              <div className="worklog-entries">
                {dateEntries.map(entry => (
                  <div key={entry.tempId} className="entry-row" data-entry-id={entry.tempId}>
                    <EntryFields t={t} entry={entry} projects={projects} hasV4Schema={hasV4Schema}
                      onChange={patch => updateEntry(entry.tempId, patch)} />
                    {dateEntries.length > 1 && (
                      <button className="btn-remove-entry" onClick={() => removeEntry(entry.tempId)} title={t.delete}><X size={14} /></button>
                    )}
                  </div>
                ))}
                <button ref={addEntryRef} className="btn-add-entry" onClick={addEntry}>
                  <Plus size={14} /> {t.addProject}
                </button>
              </div>
            )}

            <div className="worklog-form-actions">
              <button className="btn-secondary" onClick={() => setFormOpen(false)} disabled={saving}>{t.cancel}</button>
              <button className="btn-primary worklog-submit" onClick={handleSubmit} disabled={!canSubmit}>
                {saving ? '…' : t.save}
              </button>
            </div>
          </div>
        )}
      </div>

      <aside className="worklog-side">

        <div className="worklog-list-header">
          <span className="worklog-section-label">{t.myLogs} <span className="worklog-count">{loggedDates.length}</span></span>
          <div className="worklog-list-tools">
            <div className="segmented" role="tablist">
              <button role="tab" aria-selected={listView === 'day'} className={listView === 'day' ? 'active' : ''} onClick={() => setListView('day')}>{t.viewByDay}</button>
              <button role="tab" aria-selected={listView === 'project'} className={listView === 'project' ? 'active' : ''} onClick={() => setListView('project')}>{t.viewByProject}</button>
            </div>
            <button className="btn-ghost-icon" onClick={() => setListOpen(o => !o)} title={listOpen ? t.collapse : t.expand}>
              <ChevronDown size={16} className={listOpen ? 'chevron-up' : ''} />
            </button>
          </div>
        </div>

        {listOpen && listView === 'day' && (
          <div className="worklog-list">
            {!loggedDates.length && <p className="worklog-empty">{t.noLogs}</p>}
            {loggedDates.map(date => {
              const day = logsByDate[date];
              const total = day.entries.reduce((s, e) => s + e.hours, 0);
              const hasManual = day.entries.some(e => e.manual);
              const editable = days.includes(date);
              return (
                <div key={date} className={`worklog-card${date === todayStr() ? ' is-today' : ''}`}>
                  <div className="worklog-card-top">
                    <strong className="worklog-card-title">{formatCardDate(date, lang)}</strong>
                    {day.isLeave
                      ? <span className="badge-leave">{t.leaveDay}</span>
                      : hasManual
                        ? <span className="hours-badge warn">{t.manual}</span>
                        : <span className="hours-badge">{t.logged}</span>}
                  </div>
                  {!day.isLeave && (
                    <ul className="worklog-lines">
                      {day.entries.map((e, i) => (
                        <li key={i}>
                          <span className="worklog-line-label">{entryLabel(e)}{e.category === 'project' && e.project_code && <span className="code-badge">{e.project_code}</span>}</span>
                          <span className="worklog-line-hours">{e.hours} jam</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="worklog-card-meta">
                    {!day.isLeave && <span>{t.totalLabel}: {total} jam</span>}
                    {editable && (
                      <span className="worklog-card-links">
                        <button className="link-button" onClick={() => openForm(date)}>{t.edit}</button>
                        {' · '}
                        <button className="link-button" onClick={() => handleDeleteDate(date)} disabled={saving}>{t.delete}</button>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {listOpen && listView === 'project' && (
          <div className="worklog-list">
            {!projectGroups.length && <p className="worklog-empty">{t.noLogs}</p>}
            {projectGroups.map(g => {
              const open = openGroups.includes(g.key);
              return (
                <div key={g.key} className="project-group">
                  <button className="project-group-head" aria-expanded={open}
                    onClick={() => setOpenGroups(prev => (open ? prev.filter(k => k !== g.key) : [...prev, g.key]))}>
                    <span className="worklog-line-label">{g.label}{g.code && <span className="code-badge">{g.code}</span>}</span>
                    <span className="project-group-total">{g.totalHours} jam · {g.days.length} {t.daysCount}
                      <ChevronDown size={14} className={open ? 'chevron-up' : ''} /></span>
                  </button>
                  {open && (
                    <ul className="worklog-lines project-group-days">
                      {g.days.map(d => (
                        <li key={d.date}>
                          {days.includes(d.date)
                            ? <button className="link-button" onClick={() => openForm(d.date)}>{formatCardDate(d.date, lang)}</button>
                            : <span>{formatCardDate(d.date, lang)}</span>}
                          {d.description && <span className="worklog-line-desc">{d.description}</span>}
                          <span className="worklog-line-hours">{d.hours} jam</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </aside>
      </div>
    </div>
  );
}

function AdminView({
  t, lang, projects, users, workLogs, query, setQuery, sortBy, setSortBy,
  onExport, onCreate, onEdit, onDelete, onToggleActive,
  onAddUser, onEditUser, onDeleteUser, onUpdateRole,
  showCheckHours, setShowCheckHours, checkHoursDetail, setCheckHoursDetail,
  showAdminLogs, setShowAdminLogs, showAdminSettings, setShowAdminSettings,
  adminSettings, onSaveSettings, currentProfile,
}: any) {
  const totalHours = workLogs.filter((w: WorkLog) => !w.is_leave).reduce((s: number, w: WorkLog) => s + (w.hours || 0), 0);
  const exportMonths = getExportMonths();
  const [exportPeriod, setExportPeriod] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const records = useMemo(() => {
    return workLogs
      .filter((w: WorkLog) => !w.is_leave)
      .filter((w: WorkLog) => exportPeriod === 'all' || w.log_date.startsWith(exportPeriod))
      .filter((w: WorkLog) => !fromDate || w.log_date >= fromDate)
      .filter((w: WorkLog) => !toDate || w.log_date <= toDate)
      .filter((w: WorkLog) => {
        const key = `${w.profiles?.full_name} ${logProjectName(w)} ${logProjectCode(w)} ${w.category || ''} ${w.description || ''}`.toLowerCase();
        return key.includes(query.toLowerCase());
      })
      .sort((a: WorkLog, b: WorkLog) => {
        if (sortBy === 'name') return (a.profiles?.full_name || '').localeCompare(b.profiles?.full_name || '');
        return b.log_date.localeCompare(a.log_date);
      });
  }, [workLogs, query, sortBy, exportPeriod, fromDate, toDate]);

  const last7Days = useMemo(() => {
    const arr: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      arr.push(d.toISOString().slice(0, 10));
    }
    return arr;
  }, []);

  const lowHoursUsers = useMemo(() => {
    const normalUsers = users.filter((u: Profile) => !u.dev_access && !isDeveloperEmail(u.email));
    return normalUsers.map((u: Profile) => {
      const userLogs = workLogs.filter((w: WorkLog) => w.user_id === u.id && last7Days.includes(w.log_date));
      const workHours = userLogs.filter((w: WorkLog) => !w.is_leave).reduce((s: number, w: WorkLog) => s + (w.hours || 0), 0);
      const hasCuti = userLogs.some((w: WorkLog) => w.is_leave);
      return { user: u, hours: workHours, hasCuti };
    }).filter((x: any) => x.hours < 25);
  }, [users, workLogs, last7Days]);

  const visibleEmployeeUsers = users.filter((u: Profile) => !(u.email && isProtectedDomain(u.email)) && (!isDeveloperEmail(u.email) || Boolean(u.dev_access)));
  const adminEmployeeUsers = visibleEmployeeUsers.filter((u: Profile) => u.role === 'admin' || u.dev_access);
  const regularEmployeeUsers = visibleEmployeeUsers.filter((u: Profile) => u.role === 'user' && !u.dev_access);

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
          <div className="stat-number">{visibleEmployeeUsers.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t.totalHours}</div>
          <div className="stat-number">{totalHours}</div>
        </div>
      </div>

      {/* Records */}
      <div className="admin-section records-section">
        <div className="section-header">
          <h2>{t.records}</h2>
          <div className="section-actions">
            <button className="btn-secondary" onClick={() => setShowCheckHours(!showCheckHours)}>
              <AlertCircle size={15} />{t.checkHours}
            </button>
            <div className="export-controls">
              <select className="sort-select" value={exportPeriod} onChange={e => setExportPeriod(e.target.value)} aria-label={t.records}>
                <option value="all">{t.all}</option>
                {exportMonths.map(period => (
                  <option key={period} value={period}>
                    {new Date(`${period}-01T00:00:00`).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', { month: 'long', year: 'numeric' })}
                  </option>
                ))}
              </select>
              <input className="date-filter" type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} aria-label={t.fromDate} title={t.fromDate} />
              <span className="date-filter-separator">–</span>
              <input className="date-filter" type="date" value={toDate} onChange={e => setToDate(e.target.value)} aria-label={t.toDate} title={t.toDate} />
              <button className="btn-secondary" onClick={() => onExport(exportPeriod, fromDate, toDate)}>
                <Download size={15} />{t.export}
              </button>
            </div>
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
              <CheckHoursDetail t={t} lang={lang} user={checkHoursDetail} workLogs={workLogs} last7Days={last7Days} onClose={() => setCheckHoursDetail(null)} />
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
                <th>{t.kategori}</th>
                <th>{t.namaProyek}</th>
                <th>{t.nomorProyek}</th>
                <th>{t.deskripsiHeader}</th>
                <th>{t.tanggal}</th>
                <th>{t.jamKerjaHeader}</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r: WorkLog) => (
                <tr key={r.id}>
                  <td>{r.profiles?.full_name}</td>
                  <td>{CATEGORY_LABEL[r.category || 'project']}</td>
                  <td>{logProjectName(r) || <span className="code-placeholder">—</span>}{isManualProject(r) && <span className="hours-badge warn manual-tag">{t.manual}</span>}</td>
                  <td>{logProjectCode(r) ? <span className="code-badge">{logProjectCode(r)}</span> : <span className="code-placeholder">—</span>}</td>
                  <td className="td-desc">{r.description || <span className="code-placeholder">—</span>}</td>
                  <td>{r.log_date}</td>
                  <td><span className="hours-badge">{r.hours} jam</span></td>
                </tr>
              ))}
              {!records.length && <tr><td colSpan={7} className="td-empty">{t.noData}</td></tr>}
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
                <th>{t.company}</th>
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
                  <td>{p.company || '—'}</td>
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
        <div className="employee-role-group">
          <h3>Admin <span>{adminEmployeeUsers.length}</span></h3>
          <EmployeeTable t={t} users={adminEmployeeUsers} currentProfile={currentProfile} onEditUser={onEditUser} onDeleteUser={onDeleteUser} onUpdateRole={onUpdateRole} />
        </div>
        <div className="employee-role-group">
          <h3>User <span>{regularEmployeeUsers.length}</span></h3>
          <EmployeeTable t={t} users={regularEmployeeUsers} currentProfile={currentProfile} onEditUser={onEditUser} onDeleteUser={onDeleteUser} onUpdateRole={onUpdateRole} />
        </div>
      </div>

      {/* Admin tools */}
      <div className="admin-section">
        <div className="section-header">
          <h2 style={{ fontSize: 14, color: 'var(--muted)' }}>{t.adminSettings}</h2>
          <div className="section-actions">
            <button className="btn-secondary" onClick={() => setShowAdminLogs(!showAdminLogs)}>
              <ScrollText size={14} /> {t.adminLogs}
            </button>
          </div>
        </div>

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

function EmployeeTable({ t, users, currentProfile, onEditUser, onDeleteUser, onUpdateRole }: any) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>{t.name}</th><th>Email</th><th>{t.role}</th><th>{t.actions}</th></tr></thead>
        <tbody>
          {users.map((user: Profile) => {
            const isSelf = user.id === currentProfile?.id;
            const isITOps = Boolean(user.dev_access) && !isDeveloperEmail(user.email);
            return (
              <tr key={user.id}>
                <td>{user.full_name}</td>
                <td style={{ color: 'var(--muted)', fontSize: 12 }}>{user.email || '—'}</td>
                <td>
                  {isITOps ? <span className="role-badge admin">Admin (IT-Ops)</span> : isSelf ? <span className={`role-badge ${user.role}`}>{user.role}</span> : (
                    <select className="role-select" value={user.role} onChange={event => onUpdateRole(user, event.target.value)}>
                      <option value="user">user</option><option value="admin">admin</option>
                    </select>
                  )}
                </td>
                <td><div className="action-btns"><button className="btn-action" onClick={() => onEditUser(user)}><Pencil size={13} /> {t.edit}</button>{!isSelf && <button className="btn-action danger" onClick={() => onDeleteUser(user)}><Trash2 size={13} /> {t.delete}</button>}</div></td>
              </tr>
            );
          })}
          {!users.length && <tr><td colSpan={4} className="td-empty">{t.noData}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

// ─── Admin Settings Panel ─────────────────────────────────────────────────────
function AdminSettingsPanel({ t, lang, adminSettings, onSave }: any) {
  const [domain, setDomain] = useState(adminSettings.login_domain);
  const [allowSignup, setAllowSignup] = useState(adminSettings.allow_signup);
  const [useDomainLogin, setUseDomainLogin] = useState(adminSettings.use_domain_login);
  const [loginMethod, setLoginMethod] = useState<LoginMethod>(adminSettings.login_method);
  const [maintenanceMode, setMaintenanceMode] = useState(adminSettings.maintenance_mode);
  const [mainDomain, setMainDomain] = useState(adminSettings.main_domain);

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

        <ToggleRow
          label={t.maintenanceMode}
          desc={lang === 'id'
            ? 'User tidak dapat mengakses halaman input selama maintenance. Admin tetap dapat masuk.'
            : 'Users cannot access the input page during maintenance. Admins can still sign in.'}
          value={maintenanceMode}
          onChange={next => { setMaintenanceMode(next); onSave({ maintenance_mode: next }); }}
        />

        {divider}

        <div>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{t.mainDomain}</div>
          <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 8 }}>{t.mainDomainDesc}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--muted)', alignSelf: 'center', fontSize: 14 }}>https://</span>
            <input
              value={mainDomain}
              onChange={e => setMainDomain(e.target.value)}
              placeholder="weave.web.id"
              style={{ flex: 1, minWidth: 160, maxWidth: 280 }}
            />
            <button className="btn-primary" onClick={() => onSave({ main_domain: mainDomain })}>
              <Check size={14} /> {t.save}
            </button>
          </div>
        </div>

        {divider}

        <div>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{t.loginMethod}</div>
          <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 8 }}>
            {lang === 'id' ? 'Pilih metode yang tersedia di halaman login.' : 'Choose which login methods are available on the login page.'}
          </div>
          <select
            className="field-input"
            value={loginMethod}
            onChange={e => { const value = e.target.value as LoginMethod; setLoginMethod(value); onSave({ login_method: value }); }}
          >
            <option value="password">{t.loginPassword}</option>
            <option value="microsoft">{t.loginMicrosoft}</option>
            <option value="both">{t.loginBoth}</option>
          </select>
        </div>

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

function CheckHoursDetail({ t, lang, user, workLogs, last7Days, onClose }: any) {
  const userLogs = workLogs.filter((w: WorkLog) => w.user_id === user.id && last7Days.includes(w.log_date));
  return (
    <div className="check-detail-panel">
      <div className="check-detail-header">
        <strong>{user.full_name}</strong>
        <button className="btn-ghost-icon" onClick={onClose}><X size={16} /></button>
      </div>
      <table className="check-table">
        <thead><tr><th>{t.tanggal}</th><th>{t.namaProyek}</th><th>{t.jamKerjaHeader}</th></tr></thead>
        <tbody>
          {last7Days.map((date: string) => {
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
          <div className="field"><label>{t.company}</label><input name="company" defaultValue={project?.company || ''} placeholder="Company name" /></div>
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
    // Validate email for new user
    if (!user && !finalEmail) {
      alert(lang === 'id' ? 'Email wajib diisi.' : 'Email is required.');
      return;
    }
    // Inject finalEmail into a hidden input so FormData picks it up
    // We call parent's adminUser but pass a patched event
    const form = e.currentTarget;
    // Temporarily set the hidden email field value if using username shortcut
    const hiddenEmailInput = form.querySelector('input[type="hidden"][name="email"]') as HTMLInputElement | null;
    if (hiddenEmailInput) hiddenEmailInput.value = finalEmail;
    // Patch: inject finalEmail directly as a custom attribute on the form for parent to read
    (form as any).__finalEmail = finalEmail;
    onSubmit(e);
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>{user ? t.edit : t.addUser}</h2>
          <button className="btn-ghost-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
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

function StatusToast({ message }: { message: string | null }) {
  const [visible, setVisible] = useState(message);

  useEffect(() => {
    setVisible(message);
    if (!message) return;
    const timer = window.setTimeout(() => setVisible(null), 4000);
    return () => window.clearTimeout(timer);
  }, [message]);

  if (!visible) return null;
  return <div className="status-toast" role="status">{visible}</div>;
}
