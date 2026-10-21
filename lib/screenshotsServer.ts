// Server-side storage operations for screenshots (service-role client only).
import type { SupabaseClient } from '@supabase/supabase-js';
import { checkUpload, MAX_SHOT_BYTES, parseShotPath, SCREENSHOT_BUCKET, shotFolder, type Shot, type ShotsByDate } from './screenshots';

const SIGNED_URL_SECONDS = 3600;

export async function ensureBucket(db: SupabaseClient) {
  const { error } = await db.storage.getBucket(SCREENSHOT_BUCKET);
  if (!error) return;
  const created = await db.storage.createBucket(SCREENSHOT_BUCKET, {
    public: false, fileSizeLimit: MAX_SHOT_BYTES, allowedMimeTypes: ['image/webp'],
  });
  if (created.error && !/already exists/i.test(created.error.message)) throw new Error(created.error.message);
}

async function names(db: SupabaseClient, prefix: string): Promise<string[]> {
  const { data, error } = await db.storage.from(SCREENSHOT_BUCKET).list(prefix, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
  if (error || !data) return [];
  return data.map(o => o.name).filter(n => n && n !== '.emptyFolderPlaceholder');
}

async function sign(db: SupabaseClient, paths: string[]): Promise<Shot[]> {
  if (!paths.length) return [];
  const { data } = await db.storage.from(SCREENSHOT_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
  return (data ?? []).flatMap(s => (s.path && s.signedUrl ? [{ path: s.path, url: s.signedUrl }] : []));
}

export async function listEntryShots(db: SupabaseClient, userId: string, date: string, key: string): Promise<Shot[]> {
  const folder = shotFolder(userId, date, key);
  return sign(db, (await names(db, folder)).map(f => `${folder}/${f}`));
}

// Only dates that have a folder are opened, so days without screenshots cost nothing.
export async function listShots(db: SupabaseClient, userId: string, dates: string[]): Promise<ShotsByDate> {
  const present = new Set(await names(db, userId));
  const paths: string[] = [];
  for (const date of dates.filter(d => present.has(d))) {
    for (const key of await names(db, `${userId}/${date}`)) {
      for (const file of await names(db, shotFolder(userId, date, key))) paths.push(`${shotFolder(userId, date, key)}/${file}`);
    }
  }
  const out: ShotsByDate = {};
  for (const shot of await sign(db, paths)) {
    const p = parseShotPath(shot.path);
    if (!p) continue;
    ((out[p.date] ??= {})[p.key] ??= []).push(shot);
  }
  return out;
}

export async function uploadShot(db: SupabaseClient, userId: string, date: string, key: string, file: Blob, fileId: string): Promise<{ shot: Shot | null; error: string | null }> {
  const folder = shotFolder(userId, date, key);
  const problem = checkUpload({ type: file.type, size: file.size, existing: (await names(db, folder)).length });
  if (problem) return { shot: null, error: problem };
  const path = `${folder}/${fileId}.webp`;
  const { error } = await db.storage.from(SCREENSHOT_BUCKET).upload(path, file, { contentType: 'image/webp', upsert: false });
  if (error) return { shot: null, error: error.message };
  const [shot] = await sign(db, [path]);
  return { shot: shot ?? null, error: null };
}

export async function removeShot(db: SupabaseClient, path: string) {
  const { error } = await db.storage.from(SCREENSHOT_BUCKET).remove([path]);
  return { error: error?.message ?? null };
}

export async function removeDayShots(db: SupabaseClient, userId: string, date: string) {
  const paths: string[] = [];
  for (const key of await names(db, `${userId}/${date}`)) {
    for (const file of await names(db, shotFolder(userId, date, key))) paths.push(`${shotFolder(userId, date, key)}/${file}`);
  }
  if (!paths.length) return { error: null };
  const { error } = await db.storage.from(SCREENSHOT_BUCKET).remove(paths);
  return { error: error?.message ?? null };
}
