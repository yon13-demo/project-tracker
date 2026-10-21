// Browser side of screenshots: resize to WebP and talk to /api/screenshots with the user's session.
import { supabase } from './supabase';
import { fitWithin, MAX_SHOT_PX, type Shot, type ShotsByDate } from './screenshots';

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return session ? { Authorization: `Bearer ${session.access_token}` } : {};
}

async function call<T>(input: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(input, { ...init, headers: { ...(init.headers || {}), ...(await authHeaders()) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
  return body as T;
}

export async function toWebp(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height, MAX_SHOT_PX);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('encode'))), 'image/webp', 0.85));
}

export function fetchShots(dates: string[], userId?: string) {
  const q = new URLSearchParams({ dates: dates.join(',') });
  if (userId) q.set('userId', userId);
  return call<ShotsByDate>(`/api/screenshots?${q}`);
}

export function fetchEntryShots(userId: string, date: string, key: string) {
  return call<Shot[]>(`/api/screenshots?${new URLSearchParams({ userId, date, key })}`);
}

export async function uploadScreenshot(date: string, key: string, file: Blob) {
  const form = new FormData();
  form.append('file', await toWebp(file), 'shot.webp');
  form.append('date', date);
  form.append('key', key);
  return call<Shot>('/api/screenshots', { method: 'POST', body: form });
}

export function deleteScreenshot(path: string) {
  return call<{ error: string | null }>(`/api/screenshots?${new URLSearchParams({ path })}`, { method: 'DELETE' });
}

export function deleteDayScreenshots(date: string) {
  return call<{ error: string | null }>(`/api/screenshots?${new URLSearchParams({ date })}`, { method: 'DELETE' });
}
