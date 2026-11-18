import { NextRequest, NextResponse } from 'next/server';
import { verifyViewer } from '@/lib/apiAuth';
import { attendanceConfigured, getAttendanceDay } from '@/lib/attendanceServer';
import { DATE_RE } from '@/lib/screenshots';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET ?date=YYYY-MM-DD[&userId=]  → AttendanceDay (the caller's own, or any user's for admins)
export async function GET(request: NextRequest) {
  const viewer = await verifyViewer(request);
  if (!viewer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!attendanceConfigured()) return NextResponse.json({ error: 'Attendance not configured' }, { status: 503 });

  const params = request.nextUrl.searchParams;
  const date = params.get('date') || '';
  if (!DATE_RE.test(date)) return NextResponse.json({ error: 'date' }, { status: 400 });

  let email = viewer.email;
  const userId = params.get('userId');
  if (userId && userId !== viewer.id) {
    if (!viewer.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data } = await viewer.db.auth.admin.getUserById(userId);
    email = data.user?.email?.toLowerCase() || '';
  }

  try {
    return NextResponse.json(await getAttendanceDay(email, date), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('attendance', e);
    return NextResponse.json({ error: 'Attendance unavailable' }, { status: 502 });
  }
}
