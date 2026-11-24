// Screenshot rules shared by the browser and the /api/screenshots route.
// Files live in a private bucket at <userId>/<date>/<entryKey>/<fileId>.webp — no database table needed.
import type { WorkCategory } from './worklog';

export const SCREENSHOT_BUCKET = 'worklog-screenshots';
export const MAX_SHOTS_PER_ENTRY = 5;
export const MAX_SHOT_BYTES = 2 * 1024 * 1024; // after the browser has resized it to WebP
export const MAX_SHOT_PX = 1600;

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
export const KEY_RE = /^[a-z0-9-]{1,60}$/;
const FILE_RE = /^[a-z0-9-]{1,60}\.webp$/;

export function slug(text: string): string {
  const s = text.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');
  return s || 'x';
}

export type KeySource = { category: WorkCategory; project_id: string | null; custom_name: string; description: string; task_id?: string | null };

// Which entry of a day a screenshot belongs to.
export function entryKey(e: KeySource): string {
  if (e.category === 'project') {
    if (!e.project_id) return `m-${slug(e.custom_name)}`;
    // Entries with a task get their own folder; without a task the key stays as it always was.
    return e.task_id ? `p-${slug(e.project_id)}-${slug(e.task_id).slice(0, 8)}` : `p-${slug(e.project_id)}`;
  }
  const prefix = e.category === 'quotation' ? 'q' : e.category === 'other' ? 'o' : 't';
  return `${prefix}-${slug(e.description.split('\n')[0])}`;
}

export function shotFolder(userId: string, date: string, key: string) { return `${userId}/${date}/${key}`; }

export function parseShotPath(path: string): { userId: string; date: string; key: string; file: string } | null {
  const parts = path.split('/');
  if (parts.length !== 4) return null;
  const [userId, date, key, file] = parts;
  if (!UUID_RE.test(userId) || !DATE_RE.test(date) || !KEY_RE.test(key) || !FILE_RE.test(file)) return null;
  return { userId, date, key, file };
}

export function canAccessShot(path: string, viewer: { id: string; isAdmin: boolean }): boolean {
  const p = parseShotPath(path);
  return Boolean(p) && (viewer.isAdmin || p!.userId === viewer.id);
}

export function checkUpload(f: { type: string; size: number; existing: number }): 'type' | 'size' | 'count' | null {
  if (f.type !== 'image/webp') return 'type';
  if (f.size > MAX_SHOT_BYTES) return 'size';
  if (f.existing >= MAX_SHOTS_PER_ENTRY) return 'count';
  return null;
}

export function fitWithin(width: number, height: number, max: number) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export type Shot = { path: string; url: string };
export type ShotsByDate = Record<string, Record<string, Shot[]>>;
