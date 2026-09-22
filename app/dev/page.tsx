'use client';

import { useEffect, useState } from 'react';
import { Check, ChevronLeft, ShieldCheck, UserPlus, Users, Settings, RefreshCw, Activity, KeyRound, Trash2, Pencil } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

type DevUser = { id: string; full_name: string; email: string; role: 'admin' | 'user'; dev_access: boolean };
type DevSettings = { allow_signup: boolean; maintenance_mode: boolean; use_domain_login: boolean; login_method: 'password' | 'microsoft' | 'both'; login_domain: string; main_domain: string };
type DevLog = { id: string; action: string; details: any; created_at: string; admin?: { full_name: string } | null; target?: { full_name: string } | null };
const DEVOPS_DOMAINS = ['leonxlab.app', 'leonxlab.digital'];

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

  async function token() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || '';
  }

  async function load() {
    setLoading(true);
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
    const logsResponse = await fetch('/api/admin/logs?page=1', { headers: { Authorization: `Bearer ${accessToken}` } });
    if (logsResponse.ok) setLogs((await logsResponse.json()).logs || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function saveSetting(key: keyof DevSettings, value: string | boolean) {
    setSaving(true);
    const accessToken = await token();
    const response = await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
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

  async function updateRole(user: DevUser, role: 'admin' | 'user') {
    if (isDomainDevOps(user.email)) return;
    const accessToken = await token();
    const response = await fetch('/api/admin/role', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
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
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ id: user.id, full_name: user.full_name, password }),
    });
    setMessage(response.ok ? 'Password berhasil direset.' : (await response.json()).error || 'Gagal mereset password.');
  }

  async function updateName(user: DevUser) {
    const full_name = window.prompt(`Nama baru untuk ${user.email}:`, user.full_name)?.trim();
    if (!full_name || full_name === user.full_name) return;
    const accessToken = await token();
    const response = await fetch('/api/admin/users', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
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
    const response = await fetch(`/api/admin/users?id=${user.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
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

  if (loading) return <main className="shell"><p className="loading-text">Memuat Weave-DevOps...</p></main>;
  if (!authorized) return <main className="shell"><div className="notice">Akses Weave-DevOps hanya untuk domain LeonXLab atau akun IT-Ops yang telah ditugaskan.</div><Link className="btn-secondary" href="/">Kembali</Link></main>;

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

      <section className="admin-section">
        <div className="section-header"><h2><Users size={16} /> Dev access</h2><span className="dev-count">{users.length} akun</span></div>
        <p className="dev-help">IT-Ops memiliki akses yang sama. Akun domain LeonXLab selalu menjadi Weave-DevOps dan tidak dapat dicabut.</p>
        <div className="table-wrap"><table><thead><tr><th>Nama</th><th>Email</th><th>Role</th><th>Dev role</th><th>Aksi</th></tr></thead><tbody>
          {users.map(user => { const domainUser = isDomainDevOps(user.email); return <tr key={user.id}><td>{user.full_name}</td><td>{user.email}</td><td><select className="role-select" value={user.role} disabled={domainUser} onChange={event => updateRole(user, event.target.value as 'admin' | 'user')}><option value="user">user</option><option value="admin">admin</option></select></td><td><button className={`btn-action ${user.dev_access || domainUser ? 'activate' : ''}`} disabled={domainUser} onClick={() => toggleDevAccess(user)}>{domainUser ? 'Weave-DevOps' : user.dev_access ? 'IT-Ops' : 'Tidak aktif'}</button></td><td><div className="action-btns"><button className="btn-action" onClick={() => updateName(user)} title="Ganti nama"><Pencil size={13} /></button><button className="btn-action" onClick={() => resetPassword(user)} title="Reset password"><KeyRound size={13} /></button><button className="btn-action danger" disabled={domainUser} onClick={() => deleteUser(user)} title="Hapus akun"><Trash2 size={13} /></button></div></td></tr>; })}
        </tbody></table></div>
      </section>

      <section className="admin-section">
        <div className="section-header"><h2><Activity size={16} /> Audit log</h2><span className="dev-count">50 terbaru</span></div>
        <div className="table-wrap"><table><thead><tr><th>Waktu</th><th>Operator</th><th>Aksi</th><th>Target</th></tr></thead><tbody>
          {logs.map(log => <tr key={log.id}><td className="dev-log-time">{new Date(log.created_at).toLocaleString('id-ID')}</td><td>{log.admin?.full_name || '—'}</td><td>{log.action}</td><td>{log.target?.full_name || log.details?.email || '—'}</td></tr>)}
          {!logs.length && <tr><td colSpan={4} className="td-empty">Belum ada log.</td></tr>}
        </tbody></table></div>
      </section>
    </main>
  );
}

function SettingToggle({ label, value, disabled, onChange }: { label: string; value: boolean; disabled: boolean; onChange: (value: boolean) => void }) {
  return <div className="dev-setting-row"><span>{label}</span><button className={`btn-action ${value ? 'activate' : 'deactivate'}`} disabled={disabled} onClick={() => onChange(!value)}>{value ? 'ON' : 'OFF'}</button></div>;
}
