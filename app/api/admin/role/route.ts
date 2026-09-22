import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Domains yang tidak boleh diubah rolenya — selalu admin
const PROTECTED_DOMAINS = ['leonxlab.app', 'leonxlab.digital'];
const DEVOPS_DOMAINS = ['leonxlab.app', 'leonxlab.digital'];

function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function writeAudit(db: ReturnType<typeof adminClient>, request: NextRequest, operatorId: string, targetUserId: string, details: any) {
  const isDev = request.headers.get('x-action-source') === 'dev';
  return db.from(isDev ? 'dev_logs' : 'admin_logs').insert(isDev
    ? { operator_id: operatorId, action: 'UPDATE_ROLE', target_user_id: targetUserId, details }
    : { admin_id: operatorId, action: 'UPDATE_ROLE', target_user_id: targetUserId, details });
}

async function verifyAdmin(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const db = adminClient();
  const { data: { user } } = await db.auth.getUser(token);
  if (!user) return null;
  const { data: profile } = await db.from('profiles').select('id,role,dev_access').eq('id', user.id).single();
  const email = user.email?.toLowerCase() || '';
  const isDevOps = DEVOPS_DOMAINS.some(domain => email.endsWith(`@${domain}`));
  return profile && (profile.role === 'admin' || profile.dev_access || isDevOps) ? { user, profile } : null;
}

// PATCH /api/admin/role — update role user
export async function PATCH(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, role } = await request.json();
  if (!id || !['admin', 'user'].includes(role)) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const db = adminClient();

  // Ambil email user target untuk cek domain
  const { data: targetAuth } = await db.auth.admin.getUserById(id);
  const email = targetAuth?.user?.email || '';
  const domain = (email.split('@')[1] || '').toLowerCase();

  if (PROTECTED_DOMAINS.includes(domain)) {
    return NextResponse.json(
      { error: `Role akun dengan domain @${domain} tidak dapat diubah.` },
      { status: 403 }
    );
  }

  // Ambil role lama untuk log
  const { data: oldProfile } = await db.from('profiles').select('role,full_name').eq('id', id).single();
  const oldRole = oldProfile?.role;

  const { error } = await db.from('profiles').update({ role }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Insert admin log
  await writeAudit(db, request, auth.profile.id, id, { old_role: oldRole, new_role: role, target_name: oldProfile?.full_name, email });

  return NextResponse.json({ ok: true });
}
