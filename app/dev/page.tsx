'use client';

import { useEffect, useState } from 'react';
import { Check, ChevronLeft, ShieldCheck, UserPlus, Users, Settings, RefreshCw, Activity, KeyRound, Trash2, Pencil } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

type DevUser = { id: string; full_name: string; email: string; role: 'admin' | 'user'; dev_access: boolean; dev_role?: string | null };
type DevSettings = { allow_signup: boolean; maintenance_mode: boolean; use_domain_login: boolean; login_method: 'password' | 'microsoft' | 'both'; login_domain: string; main_domain: string };
type DevLog = { id: string; action: string; details: any; created_at: string; operator?: { full_name: string } | null; target?: { full_name: string } | null };
type ManagedPopup = { id: string; title: string; body: string; starts_at: string; ends_at: string; is_active: boolean; custom_label: string | null; custom_url: string | null; close_label: string | null };
type DevUpdate = { id: string; title: string; body: string; created_at: string; created_by?: { full_name: string } | null };
const DEVOPS_DOMAINS = ['leonxlab.app', 'leonxlab.digital'];

function todayUpdateTitle() {
  return `Update ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`;
}

const IT_OPS_UPDATE_TEMPLATE = `- Bulk tambah user dengan default password
- Mengelola role user dan admin
- Mengganti nama dan reset password akun
- Menghapus akun non-Weave-DevOps
- Mengatur signup, maintenance mode, login domain, dan metode login
- Membuat dan mengelola popup aplikasi
- Melihat audit log`;

function isDomainDevOps(email: string) {
  return DEVOPS_DOMAINS.some(domain => email.toLowerCase().endsWith(`@${domain}`));
}

export default function DevPage() {
  const [users, setUsers] = useState<DevUser[]>([]);
  const [settings, setSettings] = useState<DevSettings>({ allow_signup: true, maintenance_mode: false, use_domain_login: true, login_method: 'both', login_domain: '', main_domain: '' });
  const [bulkText, setBulkText] = useState('');
  const [defaultPassword, setDefaultPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logs, setLogs] = useState<DevLog[]>([]);
  const [devSearch, setDevSearch] = useState('');
  const [logSearch, setLogSearch] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');
  const [currentUserEmail, setCurrentUserEmail] = useState('');
  const [popups, setPopups] = useState<ManagedPopup[]>([]);
  const [updates, setUpdates] = useState<DevUpdate[]>([]);
  const [popupForm, setPopupForm] = useState({ title: '', body: '', starts_at: '', ends_at: '', custom_label: '', custom_url: '', close_label: 'OK', show_close: true });
  const [updateForm, setUpdateForm] = useState({ title: todayUpdateTitle(), body: IT_OPS_UPDATE_TEMPLATE });

  async function token() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || '';
  }

  async function load() {
    setLoading(true);
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    setCurrentUserId(currentUser?.id || '');
    setCurrentUserEmail(currentUser?.email || '');
    const accessToken = await token();
    const [usersResponse, settingsResponse] = await Promise.all([
      fetch('/api/dev/users', { headers: { Authorization: `Bearer ${accessToken}` } }),
      fetch('/api/admin/settings'),
    ]);
    if (usersResponse.ok) setUsers(await usersResponse.json());
    else setAuthorized(false);
    if (settingsResponse.ok) {
      const data = await settingsResponse.json();
      setSettings({
        allow_signup: data.allow_signup === 'true',
        maintenance_mode: data.maintenance_mode === 'true',
        use_domain_login: data.use_domain_login !== 'false',
        login_method: (['password', 'microsoft', 'both'].includes(data.login_method) ? data.login_method : 'both') as DevSettings['login_method'],
        login_domain: data.login_domain || '',
        main_domain: data.main_domain || '',
      });
    }
    const logsResponse = await fetch('/api/dev/logs?page=1', { headers: { Authorization: `Bearer ${accessToken}` } });
    if (logsResponse.ok) setLogs((await logsResponse.json()).logs || []);
    const [popupsResponse, updatesResponse] = await Promise.all([
      fetch('/api/dev/popups', { headers: { Authorization: `Bearer ${accessToken}` } }),
      fetch('/api/dev/updates', { headers: { Authorization: `Bearer ${accessToken}` } }),
    ]);
    if (popupsResponse.ok) setPopups(await popupsResponse.json());
    if (updatesResponse.ok) setUpdates(await updatesResponse.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function saveSetting(key: keyof DevSettings, value: string | boolean) {
    setSaving(true);
    const accessToken = await token();
    const response = await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`, 'X-Action-Source': 'dev' },
      body: JSON.stringify({ [key]: value }),
    });
    setSaving(false);
    setMessage(response.ok ? 'Pengaturan disimpan.' : 'Gagal menyimpan pengaturan.');
  }

  async function toggleDevAccess(user: DevUser) {
    if (isDomainDevOps(user.email)) return;
    const accessToken = await token();
    const response = await fetch('/api/dev/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ id: user.id, dev_access: !user.dev_access }),
    });
    if (response.ok) setUsers(current => current.map(item => item.id === user.id ? { ...item, dev_access: !item.dev_access } : item));
  }

  async function updateDevRole(user: DevUser, dev_role: 'Weave-DevOps' | 'IT-Ops') {
    if (!isDomainDevOps(currentUserEmail) || user.id !== currentUserId) return;
    const accessToken = await token();
    const response = await fetch('/api/dev/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ id: user.id, dev_role }),
    });
    if (response.ok) setUsers(current => current.map(item => item.id === user.id ? { ...item, dev_role } : item));
    else setMessage((await response.json()).error || 'Gagal mengubah dev role.');
  }

  async function updateRole(user: DevUser, role: 'admin' | 'user') {
    if (isDomainDevOps(user.email)) return;
    const accessToken = await token();
    const response = await fetch('/api/admin/role', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`, 'X-Action-Source': 'dev' },
      body: JSON.stringify({ id: user.id, role }),
    });
    if (response.ok) setUsers(current => current.map(item => item.id === user.id ? { ...item, role } : item));
    else setMessage((await response.json()).error || 'Gagal mengubah role.');
  }

  async function resetPassword(user: DevUser) {
    const password = window.prompt(`Password baru untuk ${user.email} (minimal 6 karakter):`);
    if (!password) return;
    if (password.length < 6) return setMessage('Password minimal 6 karakter.');
    const accessToken = await token();
    const response = await fetch('/api/admin/users', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`, 'X-Action-Source': 'dev' },
      body: JSON.stringify({ id: user.id, full_name: user.full_name, password }),
    });
    setMessage(response.ok ? 'Password berhasil direset.' : (await response.json()).error || 'Gagal mereset password.');
  }

  async function updateName(user: DevUser) {
    const full_name = window.prompt(`Nama baru untuk ${user.email}:`, user.full_name)?.trim();
    if (!full_name || full_name === user.full_name) return;
    const accessToken = await token();
    const response = await fetch('/api/admin/users', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`, 'X-Action-Source': 'dev' },
      body: JSON.stringify({ id: user.id, full_name }),
    });
    if (response.ok) {
      setUsers(current => current.map(item => item.id === user.id ? { ...item, full_name } : item));
      setMessage('Nama berhasil diperbarui.');
    } else setMessage((await response.json()).error || 'Gagal mengganti nama.');
  }

  async function deleteUser(user: DevUser) {
    if (isDomainDevOps(user.email) || !window.confirm(`Hapus akun ${user.email}?`)) return;
    const accessToken = await token();
    const response = await fetch(`/api/admin/users?id=${user.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}`, 'X-Action-Source': 'dev' } });
    if (response.ok) {
      setUsers(current => current.filter(item => item.id !== user.id));
      setMessage('Akun berhasil dihapus.');
    } else setMessage((await response.json()).error || 'Gagal menghapus akun.');
  }

  async function createBulkUsers() {
    const entries = bulkText.split('\n').map(line => {
      const [email, ...nameParts] = line.split(',');
      return { email: email?.trim(), full_name: nameParts.join(',').trim() };
    }).filter(item => item.email && item.full_name);
    if (!entries.length) return setMessage('Gunakan satu baris per akun: email, nama lengkap.');
    setSaving(true);
    const accessToken = await token();
    const response = await fetch('/api/dev/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ users: entries, defaultPassword }),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) return setMessage(data.error || 'Gagal membuat akun.');
    const failed = (data.results || []).filter((item: any) => !item.ok).length;
    setMessage(`${entries.length - failed} akun dibuat${failed ? `, ${failed} gagal` : ''}.`);
    if (!failed) { setBulkText(''); setDefaultPassword(''); }
    load();
  }

  async function createPopup(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    const response = await fetch('/api/dev/popups', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` }, body: JSON.stringify(popupForm) });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) return setMessage(data.error || 'Gagal membuat popup.');
    setPopupForm({ title: '', body: '', starts_at: '', ends_at: '', custom_label: '', custom_url: '', close_label: 'OK', show_close: true });
    setMessage('Popup berhasil dibuat.');
    load();
  }

  async function togglePopup(popup: ManagedPopup) {
    const response = await fetch('/api/dev/popups', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` }, body: JSON.stringify({ id: popup.id, is_active: !popup.is_active }) });
    if (response.ok) setPopups(current => current.map(item => item.id === popup.id ? { ...item, is_active: !item.is_active } : item));
  }

  async function deletePopup(popup: ManagedPopup) {
    if (!window.confirm(`Hapus popup "${popup.title}"?`)) return;
    const response = await fetch(`/api/dev/popups?id=${popup.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${await token()}` } });
    if (response.ok) setPopups(current => current.filter(item => item.id !== popup.id));
  }

  async function createUpdate(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    const body = updateForm.body.split('\n').map(line => line.trim()).filter(Boolean).map(line => line.startsWith('- ') ? line : `- ${line}`).join('\n');
    const response = await fetch('/api/dev/updates', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` }, body: JSON.stringify({ ...updateForm, body }) });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) return setMessage(data.error || 'Gagal membuat PopUp Update.');
    setUpdateForm({ title: todayUpdateTitle(), body: IT_OPS_UPDATE_TEMPLATE });
    setMessage('PopUp Update berhasil dibuat.');
    load();
  }

  if (loading) return <main className="shell"><p className="loading-text">Memuat Weave-DevOps...</p></main>;
  if (!authorized) return <main className="shell"><div className="notice">Akses Weave-DevOps hanya untuk domain LeonXLab atau akun IT-Ops yang telah ditugaskan.</div><Link className="btn-secondary" href="/">Kembali</Link></main>;

  const filteredUsers = users.filter(user => `${user.full_name} ${user.email} ${user.role} ${user.dev_role || ''}`.toLowerCase().includes(devSearch.toLowerCase()));
  const activeUsers = filteredUsers.filter(user => user.dev_access || isDomainDevOps(user.email));
  const inactiveUsers = filteredUsers.filter(user => !user.dev_access && !isDomainDevOps(user.email));
  const canEditOwnDevRole = isDomainDevOps(currentUserEmail);
  const today = new Date().toISOString().slice(0, 10);
  const showingPopups = popups.filter(popup => popup.is_active && popup.starts_at <= today && popup.ends_at >= today);

  return (
    <main className="shell dev-page">
      <header className="topbar">
        <div className="brand"><div className="brand-lockup"><div className="brand-name">Weave-DevOps</div><div className="brand-tagline">leonxlab platform control</div></div></div>
        <div className="top-actions">
          <button className="icon-button" onClick={load} title="Refresh"><RefreshCw size={15} /></button>
          <Link className="btn-secondary" href="/"><ChevronLeft size={15} /> Kembali</Link>
        </div>
      </header>

      <div className="dev-hero">
        <div className="dev-hero-icon"><ShieldCheck size={24} /></div>
        <div><h1>Weave-DevOps</h1><p>Kontrol akses internal, akun, dan konfigurasi platform.</p></div>
      </div>
      {message && <div className="notice dev-message">{message}</div>}

      <section className="stats-row dev-stats">
        <div className="stat-card"><div className="stat-label">Total akun</div><div className="stat-number">{users.length}</div></div>
        <div className="stat-card"><div className="stat-label">IT-Ops</div><div className="stat-number">{users.filter(user => user.dev_access && !isDomainDevOps(user.email)).length}</div></div>
        <div className="stat-card"><div className="stat-label">Admin</div><div className="stat-number">{users.filter(user => user.role === 'admin').length}</div></div>
      </section>

      <section className="dev-grid">
        <div className="admin-section">
          <div className="section-header"><h2><UserPlus size={16} /> Bulk user</h2></div>
          <p className="dev-help">Satu baris per akun dengan format <strong>email, nama lengkap</strong>.</p>
          <textarea className="bulk-input" value={bulkText} onChange={event => setBulkText(event.target.value)} placeholder={'alex@example.com, Alex Johnson\nbea@example.com, Bea Smith'} rows={7} />
          <div className="field"><label>Default password</label><input type="password" value={defaultPassword} onChange={event => setDefaultPassword(event.target.value)} placeholder="Minimal 6 karakter" /></div>
          <button className="btn-primary" onClick={createBulkUsers} disabled={saving}><UserPlus size={15} /> Buat akun</button>
        </div>

        <div className="admin-section">
          <div className="section-header"><h2><Settings size={16} /> System settings</h2></div>
          <SettingToggle label="Allow signup" value={settings.allow_signup} disabled={saving} onChange={value => { setSettings({ ...settings, allow_signup: value }); saveSetting('allow_signup', value); }} />
          <SettingToggle label="Maintenance mode" value={settings.maintenance_mode} disabled={saving} onChange={value => { setSettings({ ...settings, maintenance_mode: value }); saveSetting('maintenance_mode', value); }} />
          <SettingToggle label="Use default login domain" value={settings.use_domain_login} disabled={saving} onChange={value => { setSettings({ ...settings, use_domain_login: value }); saveSetting('use_domain_login', value); }} />
          <div className="field"><label>Login method</label><select className="field-input" value={settings.login_method} onChange={event => { const value = event.target.value as DevSettings['login_method']; setSettings({ ...settings, login_method: value }); saveSetting('login_method', value); }}><option value="password">Password</option><option value="microsoft">Microsoft</option><option value="both">Both</option></select></div>
          <div className="field"><label>Login domain</label><div className="dev-inline-field"><input value={settings.login_domain} onChange={event => setSettings({ ...settings, login_domain: event.target.value })} /><button className="btn-secondary" onClick={() => saveSetting('login_domain', settings.login_domain)} disabled={saving}><Check size={14} /></button></div></div>
          <div className="field"><label>Main domain</label><div className="dev-inline-field"><input value={settings.main_domain} onChange={event => setSettings({ ...settings, main_domain: event.target.value })} /><button className="btn-secondary" onClick={() => saveSetting('main_domain', settings.main_domain)} disabled={saving}><Check size={14} /></button></div></div>
        </div>
      </section>

      <section className="dev-grid">
        <div className="admin-section">
          <div className="section-header"><h2><Activity size={16} /> Buat Popup</h2></div>
          <form onSubmit={createPopup} className="dev-form">
            <div className="field"><label>Judul</label><input required value={popupForm.title} onChange={event => setPopupForm({ ...popupForm, title: event.target.value })} /></div>
            <div className="field"><label>Isi</label><textarea className="bulk-input" required rows={4} value={popupForm.body} onChange={event => setPopupForm({ ...popupForm, body: event.target.value })} /></div>
            <div className="dev-date-grid"><div className="field"><label>Mulai</label><input type="date" required value={popupForm.starts_at} onChange={event => setPopupForm({ ...popupForm, starts_at: event.target.value })} /></div><div className="field"><label>Sampai</label><input type="date" required value={popupForm.ends_at} onChange={event => setPopupForm({ ...popupForm, ends_at: event.target.value })} /></div></div>
            <div className="dev-date-grid"><div className="field"><label>Label tombol custom</label><input value={popupForm.custom_label} onChange={event => setPopupForm({ ...popupForm, custom_label: event.target.value })} placeholder="Buka halaman" /></div><div className="field"><label>Link custom</label><input type="url" value={popupForm.custom_url} onChange={event => setPopupForm({ ...popupForm, custom_url: event.target.value })} placeholder="https://..." /></div></div>
            <div className="dev-date-grid"><div className="field"><label>Label tombol tutup</label><input value={popupForm.close_label} disabled={!popupForm.show_close} onChange={event => setPopupForm({ ...popupForm, close_label: event.target.value })} /></div><label className="dev-checkbox"><input type="checkbox" checked={popupForm.show_close} onChange={event => setPopupForm({ ...popupForm, show_close: event.target.checked })} /> Tampilkan tombol tutup</label></div>
            <button className="btn-primary" disabled={saving}><Check size={15} /> Simpan Popup</button>
          </form>
        </div>

        <div className="admin-section">
          <div className="section-header"><h2><Activity size={16} /> PopUp Update</h2><span className="dev-count">{updates.length}</span></div>
          {canEditOwnDevRole && <form onSubmit={createUpdate} className="dev-form"><div className="field"><label>Judul update</label><input required value={updateForm.title} onChange={event => setUpdateForm({ ...updateForm, title: event.target.value })} /></div><div className="field"><label>Isi update (satu poin per baris)</label><textarea className="bulk-input" required rows={8} value={updateForm.body} onChange={event => setUpdateForm({ ...updateForm, body: event.target.value })} /></div><button className="btn-primary" disabled={saving}><Check size={15} /> Publikasikan Update</button></form>}
          <div className="dev-update-list">{updates.slice(0, 8).map(update => <article className="dev-update-item" key={update.id}><strong>{update.title}</strong><p>{update.body}</p><small>{new Date(update.created_at).toLocaleString('id-ID')}</small></article>)}{!updates.length && <p className="dev-help">Belum ada update.</p>}</div>
        </div>
      </section>

      <section className="admin-section">
        <div className="section-header"><h2><Activity size={16} /> Popup yang sedang tampil</h2><span className="dev-count">{showingPopups.length}</span></div>
        <div className="table-wrap"><table><thead><tr><th>Judul</th><th>Periode</th><th>Tombol</th><th>Status</th><th>Aksi</th></tr></thead><tbody>
          {showingPopups.map(popup => <tr key={popup.id}><td>{popup.title}</td><td>{popup.starts_at} - {popup.ends_at}</td><td>{popup.custom_label || 'Tanpa custom'}{popup.close_label ? ` + ${popup.close_label}` : ''}</td><td><span className="status-badge active">Tampil</span></td><td><div className="action-btns"><button className="btn-action" onClick={() => togglePopup(popup)}>Nonaktifkan</button><button className="btn-action danger" onClick={() => deletePopup(popup)}><Trash2 size={13} /></button></div></td></tr>)}
          {!showingPopups.length && <tr><td colSpan={5} className="td-empty">Tidak ada popup aktif.</td></tr>}
        </tbody></table></div>
      </section>

      <section className="admin-section">
        <div className="section-header"><h2><Users size={16} /> Dev access</h2><span className="dev-count">{users.length} akun</span></div>
        <div className="dev-toolbar"><input className="search-input" value={devSearch} onChange={event => setDevSearch(event.target.value)} placeholder="Cari nama, email, role..." /></div>
        <DevUserGroup title="Dev role aktif" users={activeUsers} currentUserId={currentUserId} canEditOwnDevRole={canEditOwnDevRole} onDevRoleChange={updateDevRole} onRoleChange={updateRole} onToggleAccess={toggleDevAccess} onUpdateName={updateName} onResetPassword={resetPassword} onDelete={deleteUser} />
        <DevUserGroup title="Dev role tidak aktif" users={inactiveUsers} currentUserId={currentUserId} canEditOwnDevRole={canEditOwnDevRole} onDevRoleChange={updateDevRole} onRoleChange={updateRole} onToggleAccess={toggleDevAccess} onUpdateName={updateName} onResetPassword={resetPassword} onDelete={deleteUser} />
      </section>

      <section className="admin-section">
        <div className="section-header"><h2><Activity size={16} /> Audit log</h2><span className="dev-count">{logs.length} terbaru</span></div>
        <div className="dev-toolbar"><input className="search-input" value={logSearch} onChange={event => setLogSearch(event.target.value)} placeholder="Cari audit log..." /></div>
        <div className="table-wrap"><table><thead><tr><th>Waktu</th><th>Operator</th><th>Aksi</th><th>Target</th></tr></thead><tbody>
          {logs.filter(log => `${log.operator?.full_name || ''} ${log.action} ${log.target?.full_name || ''} ${log.details?.email || ''}`.toLowerCase().includes(logSearch.toLowerCase())).map(log => <tr key={log.id}><td className="dev-log-time">{new Date(log.created_at).toLocaleString('id-ID')}</td><td>{log.operator?.full_name || '—'}</td><td>{log.action}</td><td>{log.target?.full_name || log.details?.email || '—'}</td></tr>)}
          {!logs.length && <tr><td colSpan={4} className="td-empty">Belum ada log.</td></tr>}
        </tbody></table></div>
      </section>
    </main>
  );
}

function SettingToggle({ label, value, disabled, onChange }: { label: string; value: boolean; disabled: boolean; onChange: (value: boolean) => void }) {
  return <div className="dev-setting-row"><span>{label}</span><button className={`btn-action ${value ? 'activate' : 'deactivate'}`} disabled={disabled} onClick={() => onChange(!value)}>{value ? 'ON' : 'OFF'}</button></div>;
}

function DevUserGroup({ title, users, currentUserId, canEditOwnDevRole, onDevRoleChange, onRoleChange, onToggleAccess, onUpdateName, onResetPassword, onDelete }: any) {
  return (
    <div className="dev-user-group">
      <h3>{title} <span>{users.length}</span></h3>
      <div className="table-wrap"><table><thead><tr><th>Nama</th><th>Email</th><th>Role</th><th>Dev role</th><th>Aksi</th></tr></thead><tbody>
        {users.map((user: DevUser) => {
          const domainUser = isDomainDevOps(user.email);
          const isOwnEditableRole = domainUser && user.id === currentUserId && canEditOwnDevRole;
          const displayedRole = user.dev_role || (domainUser ? 'Weave-DevOps' : user.dev_access ? 'IT-Ops' : 'Tidak aktif');
          return <tr key={user.id}>
            <td>{user.full_name}</td>
            <td>{user.email}</td>
            <td><select className="role-select" value={user.role} disabled={domainUser} onChange={event => onRoleChange(user, event.target.value as 'admin' | 'user')}><option value="user">user</option><option value="admin">admin</option></select></td>
            <td>{isOwnEditableRole ? <select className="role-select" value={displayedRole} onChange={event => onDevRoleChange(user, event.target.value as 'Weave-DevOps' | 'IT-Ops')}><option value="Weave-DevOps">Weave-DevOps</option><option value="IT-Ops">IT-Ops</option></select> : <span className={`role-badge ${domainUser || user.dev_access ? 'admin' : ''}`}>{displayedRole}</span>}</td>
            <td><div className="action-btns"><button className="btn-action" onClick={() => onUpdateName(user)} title="Ganti nama"><Pencil size={13} /></button><button className="btn-action" onClick={() => onResetPassword(user)} title="Reset password"><KeyRound size={13} /></button><button className="btn-action danger" disabled={domainUser} onClick={() => onDelete(user)} title="Hapus akun"><Trash2 size={13} /></button>{!domainUser && <button className="btn-action" onClick={() => onToggleAccess(user)}>{user.dev_access ? 'Off' : 'IT-Ops'}</button>}</div></td>
          </tr>;
        })}
        {!users.length && <tr><td colSpan={5} className="td-empty">Tidak ada akun.</td></tr>}
      </tbody></table></div>
    </div>
  );
}
