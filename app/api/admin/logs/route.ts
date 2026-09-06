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

// GET /api/admin/logs — paginated admin logs
export async function GET(request: NextRequest) {
  if (!await verifyAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = 50;
  const from = (page - 1) * limit;

  const db = adminClient();
  const { data, error, count } = await db
    .from('admin_logs')
    .select(`
      id, action, details, created_at,
      admin:profiles!admin_logs_admin_id_fkey(full_name),
      target:profiles!admin_logs_target_user_id_fkey(full_name)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ logs: data, total: count, page });
}
