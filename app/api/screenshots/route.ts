import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { canAccessShot, DATE_RE, KEY_RE } from '@/lib/screenshots';
import { ensureBucket, listEntryShots, listShots, removeDayShots, removeShot, uploadShot } from '@/lib/screenshotsServer';

export const runtime = 'nodejs';
const DEVELOPER_DOMAINS = ['leonxlab.app', 'leonxlab.digital'];
const MAX_DATES = 62;

function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Who is calling: their user id and whether they may see everyone's screenshots.
async function verifyViewer(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const db = adminClient();
  const { data: { user } } = await db.auth.getUser(token);
  if (!user) return null;
  const { data: profile } = await db.from('profiles').select('role,dev_access').eq('id', user.id).single();
  const email = user.email?.toLowerCase() || '';
  const isAdmin = profile?.role === 'admin' || Boolean(profile?.dev_access) || DEVELOPER_DOMAINS.some(d => email.endsWith(`@${d}`));
  return { db, id: user.id, isAdmin };
}

const unauthorized = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
const bad = (error: string) => NextResponse.json({ error }, { status: 400 });

// GET ?dates=d1,d2[&userId=]      → { [date]: { [entryKey]: Shot[] } }
// GET ?date=d&key=k[&userId=]     → Shot[]
export async function GET(request: NextRequest) {
  const viewer = await verifyViewer(request);
  if (!viewer) return unauthorized();
  const params = request.nextUrl.searchParams;
  const userId = params.get('userId') || viewer.id;
  if (userId !== viewer.id && !viewer.isAdmin) return unauthorized();

  const date = params.get('date');
  const key = params.get('key');
  if (date || key) {
    if (!date || !key || !DATE_RE.test(date) || !KEY_RE.test(key)) return bad('date/key');
    return NextResponse.json(await listEntryShots(viewer.db, userId, date, key));
  }
  const dates = (params.get('dates') || '').split(',').filter(Boolean);
  if (dates.length > MAX_DATES || !dates.every(d => DATE_RE.test(d))) return bad('dates');
  return NextResponse.json(await listShots(viewer.db, userId, dates));
}

// POST multipart { file (image/webp), date, key } — always into the caller's own folder.
export async function POST(request: NextRequest) {
  const viewer = await verifyViewer(request);
  if (!viewer) return unauthorized();
  const form = await request.formData();
  const file = form.get('file');
  const date = String(form.get('date') || '');
  const key = String(form.get('key') || '');
  if (!(file instanceof Blob) || !DATE_RE.test(date) || !KEY_RE.test(key)) return bad('file/date/key');
  await ensureBucket(viewer.db);
  const fileId = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const { shot, error } = await uploadShot(viewer.db, viewer.id, date, key, file, fileId);
  if (error) return bad(error);
  return NextResponse.json(shot);
}

// DELETE ?path=<shot path>  or  ?date=<date> (all of the caller's screenshots that day)
export async function DELETE(request: NextRequest) {
  const viewer = await verifyViewer(request);
  if (!viewer) return unauthorized();
  const params = request.nextUrl.searchParams;
  const path = params.get('path');
  const date = params.get('date');
  if (path) {
    if (!canAccessShot(path, { id: viewer.id, isAdmin: false })) return unauthorized();
    return NextResponse.json(await removeShot(viewer.db, path));
  }
  if (!date || !DATE_RE.test(date)) return bad('path/date');
  return NextResponse.json(await removeDayShots(viewer.db, viewer.id, date));
}
