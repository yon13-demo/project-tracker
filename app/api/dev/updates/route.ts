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
  const isDomainDevOps = DEVOPS_DOMAINS.some(domain => email.endsWith(`@${domain}`));
  return profile && (isDomainDevOps || profile.dev_access) ? { user, profile, isDomainDevOps } : null;
}

export async function GET(request: NextRequest) {
  const auth = await verify(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data, error } = await db().from('dev_updates').select('id,title,body,created_at,created_by:profiles!dev_updates_created_by_fkey(full_name)').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const auth = await verify(request);
  if (!auth || !auth.isDomainDevOps) return NextResponse.json({ error: 'Only Weave-DevOps can create PopUp Updates.' }, { status: 403 });
  const { title, body } = await request.json();
  if (!String(title || '').trim() || !String(body || '').trim()) return NextResponse.json({ error: 'Title and content are required.' }, { status: 400 });
  const { data, error } = await db().from('dev_updates').insert({ title: String(title).trim(), body: String(body).trim(), created_by: auth.profile.id }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await db().from('dev_logs').insert({ operator_id: auth.profile.id, action: 'CREATE_DEV_UPDATE', details: { update_id: data.id, title: String(title).trim() } });
  return NextResponse.json(data);
}
