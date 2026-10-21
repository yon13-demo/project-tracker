import { describe, expect, it } from 'vitest';
import { canAccessShot, checkUpload, entryKey, fitWithin, MAX_SHOT_BYTES, MAX_SHOTS_PER_ENTRY, parseShotPath, shotFolder, slug } from './screenshots';
import { ensureBucket, listEntryShots, listShots, removeDayShots, uploadShot } from './screenshotsServer';

const USER = '14399db5-4823-4672-a285-d30b080a2eff';
const OTHER = '68369ae9-086f-4132-8cc1-6cb2109c09fe';

describe('entryKey', () => {
  it('keys linked projects by id, manual projects by name, quotation/training by first description line', () => {
    expect(entryKey({ category: 'project', project_id: OTHER, custom_name: '', description: 'x' })).toBe(`p-${OTHER}`);
    expect(entryKey({ category: 'project', project_id: null, custom_name: 'Survey Lokasi!', description: '' })).toBe('m-survey-lokasi');
    expect(entryKey({ category: 'quotation', project_id: null, custom_name: '', description: 'Pabrik Karawang\nfase 2' })).toBe('q-pabrik-karawang');
    expect(entryKey({ category: 'training', project_id: null, custom_name: '', description: '' })).toBe('t-x');
  });
  it('slug keeps only safe characters and never returns empty', () => {
    expect(slug('  Ünïcode & Co.  ')).toBe('unicode-co');
    expect(slug('***')).toBe('x');
    expect(slug('a'.repeat(80))).toHaveLength(40);
  });
});

describe('shot paths and access', () => {
  const path = `${shotFolder(USER, '2026-10-21', 'm-survey')}/1729500000000-ab12.webp`;
  it('parses a valid path', () => {
    expect(parseShotPath(path)).toEqual({ userId: USER, date: '2026-10-21', key: 'm-survey', file: '1729500000000-ab12.webp' });
  });
  it('rejects traversal and malformed paths', () => {
    for (const bad of [`${USER}/../x/y.webp`, `${USER}/2026-10-21/k/a.png`, `${USER}/2026-13-xx/k/a.webp`, `nope/2026-10-21/k/a.webp`, `${USER}/2026-10-21/a.webp`]) {
      expect(parseShotPath(bad)).toBeNull();
    }
  });
  it('owners and admins can see a shot; other users cannot', () => {
    expect(canAccessShot(path, { id: USER, isAdmin: false })).toBe(true);
    expect(canAccessShot(path, { id: OTHER, isAdmin: true })).toBe(true);
    expect(canAccessShot(path, { id: OTHER, isAdmin: false })).toBe(false);
  });
});

describe('checkUpload', () => {
  it('accepts a small webp below the per-entry limit', () => {
    expect(checkUpload({ type: 'image/webp', size: 1000, existing: 0 })).toBeNull();
  });
  it('rejects other types, oversize files and the 6th screenshot', () => {
    expect(checkUpload({ type: 'image/png', size: 1000, existing: 0 })).toBe('type');
    expect(checkUpload({ type: 'image/webp', size: MAX_SHOT_BYTES + 1, existing: 0 })).toBe('size');
    expect(checkUpload({ type: 'image/webp', size: 1000, existing: MAX_SHOTS_PER_ENTRY })).toBe('count');
  });
});

describe('fitWithin', () => {
  it('scales the long side down to the limit and never up', () => {
    expect(fitWithin(3200, 1800, 1600)).toEqual({ width: 1600, height: 900 });
    expect(fitWithin(900, 1800, 1600)).toEqual({ width: 800, height: 1600 });
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });
});

// In-memory stand-in for the Supabase storage client (folders are implied by paths).
function fakeDb(opts: { bucket?: boolean } = {}) {
  const files = new Map<string, Blob>();
  let bucket = opts.bucket ?? true;
  const created: string[] = [];
  const api = {
    list: async (prefix: string) => {
      if (!bucket) return { data: null, error: { message: 'Bucket not found' } };
      const names = new Set<string>();
      for (const p of files.keys()) if (p.startsWith(prefix + '/')) names.add(p.slice(prefix.length + 1).split('/')[0]);
      return { data: [...names].sort().map(name => ({ name })), error: null };
    },
    upload: async (path: string, blob: Blob) => { files.set(path, blob); return { data: { path }, error: null }; },
    remove: async (paths: string[]) => { paths.forEach(p => files.delete(p)); return { data: [], error: null }; },
    createSignedUrls: async (paths: string[]) => ({ data: paths.map(path => ({ path, signedUrl: `https://signed/${path}`, error: null })), error: null }),
  };
  const db = {
    storage: {
      from: () => api,
      getBucket: async () => (bucket ? { data: {}, error: null } : { data: null, error: { message: 'Bucket not found' } }),
      createBucket: async (name: string) => { bucket = true; created.push(name); return { data: { name }, error: null }; },
    },
  };
  return { db: db as any, files, created };
}

const webp = (size = 10) => new Blob([new Uint8Array(size)], { type: 'image/webp' });

describe('screenshot storage', () => {
  it('ensureBucket creates the private bucket once when missing', async () => {
    const { db, created } = fakeDb({ bucket: false });
    await ensureBucket(db);
    await ensureBucket(db);
    expect(created).toEqual(['worklog-screenshots']);
  });

  it('uploads up to 5 shots per entry, then refuses', async () => {
    const { db } = fakeDb();
    for (let i = 0; i < MAX_SHOTS_PER_ENTRY; i++) {
      const r = await uploadShot(db, USER, '2026-10-21', 'm-survey', webp(), `f${i}`);
      expect(r.error).toBeNull();
      expect(r.shot?.url).toContain(`${USER}/2026-10-21/m-survey/f${i}.webp`);
    }
    expect((await uploadShot(db, USER, '2026-10-21', 'm-survey', webp(), 'f9')).error).toBe('count');
  });

  it('lists shots only for the requested dates, grouped by date and entry', async () => {
    const { db } = fakeDb();
    await uploadShot(db, USER, '2026-10-21', 'm-survey', webp(), 'a');
    await uploadShot(db, USER, '2026-10-21', 't-k3', webp(), 'b');
    await uploadShot(db, USER, '2026-10-01', 'm-survey', webp(), 'c');
    const shots = await listShots(db, USER, ['2026-10-21', '2026-10-20']);
    expect(Object.keys(shots)).toEqual(['2026-10-21']);
    expect(Object.keys(shots['2026-10-21']).sort()).toEqual(['m-survey', 't-k3']);
    expect((await listEntryShots(db, USER, '2026-10-21', 't-k3')).map(s => s.path)).toEqual([`${USER}/2026-10-21/t-k3/b.webp`]);
  });

  it('listing before any upload (no bucket) returns nothing instead of failing', async () => {
    const { db } = fakeDb({ bucket: false });
    expect(await listShots(db, USER, ['2026-10-21'])).toEqual({});
  });

  it('removeDayShots deletes every shot of that day and nothing else', async () => {
    const { db, files } = fakeDb();
    await uploadShot(db, USER, '2026-10-21', 'm-survey', webp(), 'a');
    await uploadShot(db, USER, '2026-10-21', 't-k3', webp(), 'b');
    await uploadShot(db, USER, '2026-10-20', 't-k3', webp(), 'c');
    await removeDayShots(db, USER, '2026-10-21');
    expect([...files.keys()]).toEqual([`${USER}/2026-10-20/t-k3/c.webp`]);
  });
});
