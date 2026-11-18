import { describe, expect, it } from 'vitest';
import { filterPeople, filterProjects, isAdminLike, matchesQuery } from './adminLists';

const project = (code: string, name: string, company: string, is_active = true) =>
  ({ id: code, project_code: code, name, company, description: '', is_active, inactive_from: null });

const projects = [
  project('P-001', 'Gedung Kantor', 'PT Alpha'),
  project('P-002', 'Jembatan Baru', 'CV Beta', false),
  project('P-003', 'Pabrik Semen', 'PT Alpha'),
];

const person = (full_name: string, email: string, role: 'admin' | 'user', dev_access = false) =>
  ({ id: full_name, full_name, email, role, dev_access });

const people = [
  person('Andi', 'andi@example.com', 'admin'),
  person('Budi', 'budi@example.com', 'user'),
  person('Citra', 'citra@example.com', 'user', true),
];

describe('matchesQuery', () => {
  it('ignores case and surrounding spaces', () => {
    expect(matchesQuery(['Gedung Kantor'], '  kantor ')).toBe(true);
    expect(matchesQuery(['Gedung Kantor'], 'pabrik')).toBe(false);
  });
  it('matches everything on an empty query and skips missing fields', () => {
    expect(matchesQuery([undefined, null], '')).toBe(true);
    expect(matchesQuery([undefined], 'x')).toBe(false);
  });
});

describe('filterProjects', () => {
  it('filters by status', () => {
    expect(filterProjects(projects, '', 'active').map(p => p.project_code)).toEqual(['P-001', 'P-003']);
    expect(filterProjects(projects, '', 'inactive').map(p => p.project_code)).toEqual(['P-002']);
    expect(filterProjects(projects, '', 'all')).toHaveLength(3);
  });
  it('searches code, name and company', () => {
    expect(filterProjects(projects, 'p-002', 'all').map(p => p.project_code)).toEqual(['P-002']);
    expect(filterProjects(projects, 'semen', 'all').map(p => p.project_code)).toEqual(['P-003']);
    expect(filterProjects(projects, 'alpha', 'all').map(p => p.project_code)).toEqual(['P-001', 'P-003']);
  });
});

describe('people', () => {
  it('treats dev access as admin', () => {
    expect(people.map(isAdminLike)).toEqual([true, false, true]);
  });
  it('filters by role', () => {
    expect(filterPeople(people, '', 'admin').map(p => p.full_name)).toEqual(['Andi', 'Citra']);
    expect(filterPeople(people, '', 'user').map(p => p.full_name)).toEqual(['Budi']);
    expect(filterPeople(people, '', 'all')).toHaveLength(3);
  });
  it('searches name and email', () => {
    expect(filterPeople(people, 'BUDI', 'all').map(p => p.full_name)).toEqual(['Budi']);
    expect(filterPeople(people, 'citra@', 'all').map(p => p.full_name)).toEqual(['Citra']);
  });
});
