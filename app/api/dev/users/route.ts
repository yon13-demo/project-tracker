import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
const DEVOPS_DOMAINS = ['leonxlab.app', 'leonxlab.digital'];

function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function verifyDevOps(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const db = adminClient();
  const { data: { user } } = await db.auth.getUser(token);
  if (!user) return null;
  const { data: profile } = await db.from('profiles').select('id,role,dev_access').eq('id', user.id).single();
  const email = user.email?.toLowerCase() || '';
  const isDomainDevOps = DEVOPS_DOMAINS.some(domain => email.endsWith(`@${domain}`));
  return profile && (isDomainDevOps || profile.dev_access) ? { user, profile, isDomainDevOps } : null;
}

export async function GET(request: NextRequest) {
  const auth = await verifyDevOps(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = adminClient();
  const [{ data: profiles }, { data: authUsers }] = await Promise.all([
    db.from('profiles').select('id,full_name,role,dev_access,dev_role').order('full_name'),
    db.auth.admin.listUsers({ perPage: 1000 }),
  ]);
  const emailMap = Object.fromEntries((authUsers?.users || []).map(user => [user.id, user.email || '']));
  return NextResponse.json((profiles || []).map(profile => ({
    ...profile,
    email: emailMap[profile.id] || '',
    dev_role: profile.dev_role || (emailMap[profile.id]?.toLowerCase().match(/@(leonxlab\.app|leonxlab\.digital)$/) ? 'Weave-DevOps' : profile.dev_access ? 'IT-Ops' : 'Tidak aktif'),
  })));
}

export async function PATCH(request: NextRequest) {
  const auth = await verifyDevOps(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, dev_access, dev_role } = await request.json();
  if (!id || (typeof dev_access !== 'boolean' && !['Weave-DevOps', 'IT-Ops', null].includes(dev_role))) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  const db = adminClient();
  const { data: targetAuth } = await db.auth.admin.getUserById(id);
  const targetEmail = targetAuth?.user?.email?.toLowerCase() || '';
  const targetIsDomainDevOps = DEVOPS_DOMAINS.some(domain => targetEmail.endsWith(`@${domain}`));
  if (targetIsDomainDevOps && !auth.isDomainDevOps) {
    return NextResponse.json({ error: 'Weave-DevOps access cannot be revoked or changed.' }, { status: 403 });
  }
  if (dev_role !== undefined && !auth.isDomainDevOps) {
    return NextResponse.json({ error: 'IT-Ops cannot change the displayed dev role.' }, { status: 403 });
  }
  if (dev_role !== undefined && targetIsDomainDevOps && id !== auth.user.id) {
    return NextResponse.json({ error: 'Only the account owner can change its displayed dev role.' }, { status: 403 });
  }
  const updates: { dev_access?: boolean; dev_role?: string | null } = {};
  if (typeof dev_access === 'boolean') updates.dev_access = dev_access;
  if (dev_role !== undefined) updates.dev_role = dev_role;
  const { error } = await db.from('profiles').update(updates).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await db.from('dev_logs').insert({
    operator_id: auth.profile.id,
    action: 'UPDATE_DEV_ACCESS',
    target_user_id: id,
    details: { dev_access },
  });
  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  const auth = await verifyDevOps(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { users, defaultPassword } = await request.json();
  if (!Array.isArray(users) || !defaultPassword || defaultPassword.length < 6) {
    return NextResponse.json({ error: 'Users and a default password of at least 6 characters are required.' }, { status: 400 });
  }

  const db = adminClient();
  const results: { email: string; full_name: string; ok: boolean; error?: string }[] = [];
  for (const item of users) {
    const email = String(item.email || '').trim().toLowerCase();
    const full_name = String(item.full_name || '').trim();
    if (!email || !email.includes('@') || !full_name) {
      results.push({ email, full_name, ok: false, error: 'Email and name are required.' });
      continue;
    }
    const { data, error } = await db.auth.admin.createUser({ email, password: defaultPassword, email_confirm: true, user_metadata: { full_name } });
    if (error) {
      results.push({ email, full_name, ok: false, error: error.message });
      continue;
    }
    results.push({ email, full_name, ok: true });
    await db.from('dev_logs').insert({
      operator_id: auth.profile.id,
      action: 'BULK_CREATE_USER',
      target_user_id: data.user?.id || null,
      details: { email, full_name },
    });
  }
  return NextResponse.json({ results });
}
