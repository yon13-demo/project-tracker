import type { Project } from './worklog';

export type ProjectStatusFilter = 'active' | 'inactive' | 'all';
export type RoleFilter = 'all' | 'admin' | 'user';
type Person = { full_name: string; email?: string; role: 'admin' | 'user'; dev_access?: boolean };

export function matchesQuery(fields: (string | null | undefined)[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some(f => (f || '').toLowerCase().includes(q));
}

export function filterProjects<P extends Project>(projects: P[], query: string, status: ProjectStatusFilter): P[] {
  return projects.filter(p =>
    (status === 'all' || p.is_active === (status === 'active')) &&
    matchesQuery([p.project_code, p.name, p.company], query));
}

// IT-Ops accounts (dev access) count as admins, as everywhere else in Weave.
export const isAdminLike = (u: Person) => u.role === 'admin' || Boolean(u.dev_access);

export function filterPeople<U extends Person>(users: U[], query: string, role: RoleFilter): U[] {
  return users.filter(u =>
    (role === 'all' || isAdminLike(u) === (role === 'admin')) &&
    matchesQuery([u.full_name, u.email], query));
}
