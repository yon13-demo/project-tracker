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
  const { data, error } = await db().from('app_popups').select('*').order('starts_at', { ascending: false }).order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const auth = await verify(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  const title = String(body.title || '').trim();
  const content = String(body.body || '').trim();
  const starts_at = String(body.starts_at || '');
  const ends_at = String(body.ends_at || '');
  const custom_label = String(body.custom_label || '').trim() || null;
  const custom_url = String(body.custom_url || '').trim() || null;
  const close_label = body.show_close === false ? null : (String(body.close_label || 'OK').trim() || 'OK');
  if (!title || !content || !starts_at || !ends_at || ends_at < starts_at) return NextResponse.json({ error: 'Title, content, and a valid date range are required.' }, { status: 400 });
  if ((custom_label && !custom_url) || (!custom_label && custom_url)) return NextResponse.json({ error: 'Custom button requires both label and link.' }, { status: 400 });
  if (custom_url) {
    try { new URL(custom_url); } catch { return NextResponse.json({ error: 'Custom link must be a valid URL.' }, { status: 400 }); }
  }
  const { data, error } = await db().from('app_popups').insert({ title, body: content, starts_at, ends_at, custom_label, custom_url, close_label, created_by: auth.profile.id }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest) {
  const auth = await verify(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, is_active } = await request.json();
  if (!id || typeof is_active !== 'boolean') return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  const { error } = await db().from('app_popups').update({ is_active, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const auth = await verify(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Popup ID is required.' }, { status: 400 });
  const { error } = await db().from('app_popups').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
