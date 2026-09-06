import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const PROTECTED_DOMAINS = ['leonxlab.app', 'leonxlab.digital'];

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

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { email, password, full_name } = await request.json();
  if (!email || !password || !full_name)
    return NextResponse.json({ error: 'Name, email, and password are required.' }, { status: 400 });

  const db = adminClient();
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name } });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Log
  await db.from('admin_logs').insert({
    admin_id: auth.profile.id,
    action: 'CREATE_USER',
    target_user_id: data.user?.id || null,
    details: { email, full_name },
  });

  return NextResponse.json({ ok: true });
}

export async function PATCH(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, full_name, password } = await request.json();
  if (!id) return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });

  const db = adminClient();
  const { data: oldProfile } = await db.from('profiles').select('full_name').eq('id', id).single();

  const { error: profileError } = await db.from('profiles').update({ full_name }).eq('id', id);
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 });

  if (password && password.length >= 6) {
    const { error: pwError } = await db.auth.admin.updateUserById(id, { password });
    if (pwError) return NextResponse.json({ error: pwError.message }, { status: 400 });
  }

  // Log
  await db.from('admin_logs').insert({
    admin_id: auth.profile.id,
    action: 'UPDATE_USER',
    target_user_id: id,
    details: { old_name: oldProfile?.full_name, new_name: full_name, password_changed: !!(password && password.length >= 6) },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const auth = await verifyAdmin(request);
  const id = new URL(request.url).searchParams.get('id');
  if (!auth || !id || id === auth.user.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = adminClient();

  // Cek domain proteksi
  const { data: targetAuth } = await db.auth.admin.getUserById(id);
  const email = targetAuth?.user?.email || '';
  const domain = email.split('@')[1] || '';
  if (PROTECTED_DOMAINS.includes(domain)) {
    return NextResponse.json({ error: `Akun dengan domain @${domain} tidak dapat dihapus.` }, { status: 403 });
  }

  const { data: targetProfile } = await db.from('profiles').select('full_name').eq('id', id).single();

  const { error } = await db.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Log
  await db.from('admin_logs').insert({
    admin_id: auth.profile.id,
    action: 'DELETE_USER',
    target_user_id: null,
    details: { deleted_id: id, email, full_name: targetProfile?.full_name },
  });

  return NextResponse.json({ ok: true });
}
