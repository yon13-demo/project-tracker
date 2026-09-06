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
  const { data: profile } = await db.from('profiles').select('id,role').eq('id', user.id).single();
  return profile?.role === 'admin' ? { user, profile } : null;
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

  for (const { key, value } of updates) {
    const { error } = await db.from('admin_settings').upsert(
      { key, value, updated_at: new Date().toISOString(), updated_by: auth.profile.id },
      { onConflict: 'key' }
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Log action
  const action = body.allow_signup !== undefined
    ? 'TOGGLE_SIGNUP'
    : body.use_domain_login !== undefined
      ? 'TOGGLE_DOMAIN_LOGIN'
      : 'SET_DOMAIN';
  await db.from('admin_logs').insert({
    admin_id: auth.profile.id,
    action,
    details: body,
  });

  return NextResponse.json({ ok: true });
}
