import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function verifyAdmin(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const db = adminClient();
  const { data: { user } } = await db.auth.getUser(token);
  if (!user) return null;
  const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).single();
  return profile?.role === 'admin' ? user : null;
}

// GET /api/admin/users-list — returns { [userId]: email } map
export async function GET(request: NextRequest) {
  if (!await verifyAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = adminClient();
  const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
  const emailMap: Record<string, string> = {};
  for (const u of data?.users || []) {
    emailMap[u.id] = u.email || '';
  }
  return NextResponse.json(emailMap);
}
