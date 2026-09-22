import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
const DEVOPS_DOMAINS = ['leonxlab.app', 'leonxlab.digital'];
function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!); }

async function verify(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const client = db();
  const { data: { user } } = await client.auth.getUser(token);
  if (!user) return null;
  const { data: profile } = await client.from('profiles').select('id,dev_access').eq('id', user.id).single();
  const email = user.email?.toLowerCase() || '';
  const isDevOps = DEVOPS_DOMAINS.some(domain => email.endsWith(`@${domain}`));
  return profile && (profile.dev_access || isDevOps) ? { user, profile } : null;
}

export async function GET(request: NextRequest) {
  if (!await verify(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const page = Math.max(1, Number(new URL(request.url).searchParams.get('page') || '1'));
  const limit = 50;
  const from = (page - 1) * limit;
  const { data, error, count } = await db().from('dev_logs').select('id,action,details,created_at,operator:profiles!dev_logs_operator_id_fkey(full_name),target:profiles!dev_logs_target_user_id_fkey(full_name)', { count: 'exact' }).order('created_at', { ascending: false }).range(from, from + limit - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ logs: data || [], total: count || 0, page });
}
