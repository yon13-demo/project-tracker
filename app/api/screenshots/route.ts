import { NextRequest, NextResponse } from 'next/server';
import { verifyViewer } from '@/lib/apiAuth';
import { canAccessShot, DATE_RE, KEY_RE, UUID_RE } from '@/lib/screenshots';
import { countShots, ensureBucket, listEntryShots, listShots, removeDayShots, removeShot, uploadShot } from '@/lib/screenshotsServer';

export const runtime = 'nodejs';
const MAX_DATES = 62;
const MAX_PAIRS = 60;

const unauthorized = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
const bad = (error: string) => NextResponse.json({ error }, { status: 400 });

// GET ?dates=d1,d2[&userId=]      → { [date]: { [entryKey]: Shot[] } }
// GET ?date=d&key=k[&userId=]     → Shot[]
// GET ?counts=userId:date,...      → { "userId/date": { [entryKey]: count } }  (recap indicator)
export async function GET(request: NextRequest) {
  const viewer = await verifyViewer(request);
  if (!viewer) return unauthorized();
  const params = request.nextUrl.searchParams;

  const counts = params.get('counts');
  if (counts !== null) {
    const pairs = [...new Set(counts.split(',').filter(Boolean))].map(p => { const [userId, date] = p.split(':'); return { userId, date }; });
    if (pairs.length > MAX_PAIRS || !pairs.every(p => UUID_RE.test(p.userId || '') && DATE_RE.test(p.date || ''))) return bad('counts');
    if (!viewer.isAdmin && pairs.some(p => p.userId !== viewer.id)) return unauthorized();
    return NextResponse.json(await countShots(viewer.db, pairs));
  }
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
