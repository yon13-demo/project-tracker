'use client';

import { useState } from 'react';
import { Pencil, Plus, ToggleLeft, ToggleRight, Trash2, UserPlus } from 'lucide-react';
import { filterPeople, filterProjects, isAdminLike, type ProjectStatusFilter, type RoleFilter } from '@/lib/adminLists';
import type { Project } from '@/lib/worklog';

type Person = { id: string; full_name: string; role: 'admin' | 'user'; email?: string; dev_access?: boolean };

function Segmented<V extends string>({ value, options, onChange }: { value: V; options: { value: V; label: string }[]; onChange: (v: V) => void }) {
  return (
    <div className="segmented" role="tablist">
      {options.map(o => (
        <button key={o.value} type="button" role="tab" aria-selected={value === o.value} className={value === o.value ? 'active' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ProjectList({ t, projects, onCreate, onEdit, onToggleActive, onDelete }: {
  t: any; projects: Project[];
  onCreate: () => void; onEdit: (p: Project) => void; onToggleActive: (p: Project) => void; onDelete: (p: Project) => void;
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<ProjectStatusFilter>('active');
  const activeCount = projects.filter(p => p.is_active).length;
  const shown = filterProjects(projects, query, status);

  return (
    <div className="admin-section">
      <div className="section-header">
        <h2>{t.projectList} <span className="records-count">{projects.length} {t.projectsCount} · {activeCount} {t.active.toLowerCase()}</span></h2>
        <button className="btn-primary" onClick={onCreate}><Plus size={15} />{t.createProject}</button>
      </div>
      <div className="list-filters">
        <input className="search-input" value={query} onChange={e => setQuery(e.target.value)} placeholder={t.searchProject} />
        <Segmented value={status} onChange={setStatus} options={[
          { value: 'active', label: `${t.active} ${activeCount}` },
          { value: 'inactive', label: `${t.inactive} ${projects.length - activeCount}` },
          { value: 'all', label: `${t.all} ${projects.length}` },
        ]} />
      </div>
      <div className="table-wrap">
        <table className="list-table">
          <thead><tr><th className="col-code">{t.projectCode}</th><th>{t.projectCol}</th><th className="col-actions" aria-label={t.actions} /></tr></thead>
          <tbody>
            {shown.map(p => (
              <tr key={p.id} className={p.is_active ? '' : 'is-inactive'}>
                <td className="col-code"><span className="code-badge">{p.project_code}</span></td>
                <td>
                  <div className="list-main">{p.name}{!p.is_active && <span className="status-badge inactive">{t.inactive}</span>}</div>
                  {(p.company || p.description) && <div className="list-sub">{[p.company, p.description].filter(Boolean).join(' · ')}</div>}
                </td>
                <td className="col-actions">
                  <div className="list-actions">
                    <button className="btn-action icon" onClick={() => onEdit(p)} title={t.edit} aria-label={t.edit}><Pencil size={14} /></button>
                    <button className={`btn-action icon ${p.is_active ? 'deactivate' : 'activate'}`} onClick={() => onToggleActive(p)}
                      title={p.is_active ? t.deactivate : t.activate} aria-label={p.is_active ? t.deactivate : t.activate}>
                      {p.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                    </button>
                    <button className="btn-action icon danger" onClick={() => onDelete(p)} title={t.delete} aria-label={t.delete}><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {!shown.length && <tr><td colSpan={3} className="td-empty">{t.noData}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function EmployeeList({ t, users, currentId, isLocked, onAddUser, onEditUser, onDeleteUser, onUpdateRole }: {
  t: any; users: Person[]; currentId?: string; isLocked: (u: Person) => boolean;
  onAddUser: () => void; onEditUser: (u: Person) => void; onDeleteUser: (u: Person) => void; onUpdateRole: (u: Person, role: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<RoleFilter>('all');
  const adminCount = users.filter(isAdminLike).length;
  const shown = filterPeople(users, query, role)
    .sort((a, b) => Number(isAdminLike(b)) - Number(isAdminLike(a)) || (a.full_name || '').localeCompare(b.full_name || ''));

  return (
    <div className="admin-section">
      <div className="section-header">
        <h2>{t.userList} <span className="records-count">{users.length} {t.peopleCount}</span></h2>
        <button className="btn-primary" onClick={onAddUser}><UserPlus size={15} />{t.addUser}</button>
      </div>
      <div className="list-filters">
        <input className="search-input" value={query} onChange={e => setQuery(e.target.value)} placeholder={t.searchPerson} />
        <Segmented value={role} onChange={setRole} options={[
          { value: 'all', label: `${t.all} ${users.length}` },
          { value: 'admin', label: `Admin ${adminCount}` },
          { value: 'user', label: `User ${users.length - adminCount}` },
        ]} />
      </div>
      <div className="table-wrap">
        <table className="list-table">
          <thead><tr><th>{t.name}</th><th className="col-role">{t.role}</th><th className="col-actions" aria-label={t.actions} /></tr></thead>
          <tbody>
            {shown.map(user => {
              const isSelf = user.id === currentId;
              const locked = isLocked(user);
              return (
                <tr key={user.id}>
                  <td>
                    <div className="list-main">{user.full_name}{isSelf && <span className="list-you">({t.you})</span>}</div>
                    <div className="list-sub">{user.email || '—'}</div>
                  </td>
                  <td className="col-role">
                    {locked ? <span className="role-badge admin">Admin (IT-Ops)</span>
                      : isSelf ? <span className={`role-badge ${user.role}`}>{user.role}</span>
                      : (
                        <select className="role-select" value={user.role} onChange={e => onUpdateRole(user, e.target.value)} aria-label={t.role}>
                          <option value="user">user</option><option value="admin">admin</option>
                        </select>
                      )}
                  </td>
                  <td className="col-actions">
                    <div className="list-actions">
                      <button className="btn-action icon" onClick={() => onEditUser(user)} title={t.edit} aria-label={t.edit}><Pencil size={14} /></button>
                      {!isSelf && <button className="btn-action icon danger" onClick={() => onDeleteUser(user)} title={t.delete} aria-label={t.delete}><Trash2 size={14} /></button>}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!shown.length && <tr><td colSpan={3} className="td-empty">{t.noData}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
