import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
const DEVELOPER_DOMAINS = ['leonxlab.app', 'leonxlab.digital'];

function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function verifyAdmin(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const db = adminClient();
  const { data: { user } } = await db.auth.getUser(token);
  if (!user) return null;
  const { data: profile } = await db.from('profiles').select('id,role').eq('id', user.id).single();
  const normalizedEmail = user.email?.toLowerCase() || '';
  const isDeveloper = DEVELOPER_DOMAINS.some(domain => normalizedEmail.endsWith(`@${domain}`));
  return profile?.role === 'admin' || isDeveloper ? { user, profile } : null;
}

// GET /api/admin/settings — public, untuk halaman login baca allow_signup & login_domain
export async function GET() {
  const db = adminClient();
  const { data } = await db.from('admin_settings').select('key,value');
  const settings: Record<string, string> = {};
  for (const row of data || []) settings[row.key] = row.value;
  return NextResponse.json(settings);
}

// PATCH /api/admin/settings — admin only
export async function PATCH(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const normalizedEmail = auth.user.email?.toLowerCase() || '';
  if (!DEVELOPER_DOMAINS.some(domain => normalizedEmail.endsWith(`@${domain}`))) {
    return NextResponse.json({ error: 'Only the developer account can change system settings.' }, { status: 403 });
  }

  const body = await request.json();
  const db = adminClient();
  const updates: { key: string; value: string }[] = [];

  if (typeof body.allow_signup === 'boolean') {
    updates.push({ key: 'allow_signup', value: String(body.allow_signup) });
  }
  if (typeof body.login_domain === 'string' && body.login_domain.trim()) {
    updates.push({ key: 'login_domain', value: body.login_domain.trim() });
  }
  if (typeof body.use_domain_login === 'boolean') {
    updates.push({ key: 'use_domain_login', value: String(body.use_domain_login) });
  }
  if (['password', 'microsoft', 'both'].includes(body.login_method)) {
    updates.push({ key: 'login_method', value: body.login_method });
  }
  if (typeof body.maintenance_mode === 'boolean') {
    updates.push({ key: 'maintenance_mode', value: String(body.maintenance_mode) });
  }
  if (typeof body.main_domain === 'string') {
    const mainDomain = body.main_domain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (mainDomain) updates.push({ key: 'main_domain', value: mainDomain });
  }

  for (const { key, value } of updates) {
    const { error } = await db.from('admin_settings').upsert(
      { key, value, updated_at: new Date().toISOString(), updated_by: auth.profile?.id || null },
      { onConflict: 'key' }
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Log action
  const action = body.allow_signup !== undefined
    ? 'TOGGLE_SIGNUP'
    : body.use_domain_login !== undefined
      ? 'TOGGLE_DOMAIN_LOGIN'
      : body.login_method !== undefined
        ? 'SET_LOGIN_METHOD'
        : body.maintenance_mode !== undefined
          ? 'TOGGLE_MAINTENANCE'
        : 'SET_DOMAIN';
  if (auth.profile?.id) {
    await db.from('admin_logs').insert({
      admin_id: auth.profile.id,
      action,
      details: body,
    });
  }

  return NextResponse.json({ ok: true });
}
