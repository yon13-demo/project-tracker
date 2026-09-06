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

export async function POST(request: NextRequest) {
  if (!await verifyAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { email, password, full_name } = await request.json();
  if (!email || !password || !full_name) return NextResponse.json({ error: 'Name, email, and password are required.' }, { status: 400 });
  const { error } = await adminClient().auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name } });
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ ok: true });
}

export async function PATCH(request: NextRequest) {
  if (!await verifyAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, full_name, password } = await request.json();
  if (!id) return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
  const db = adminClient();
  // Update profile name
  const { error: profileError } = await db.from('profiles').update({ full_name }).eq('id', id);
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 });
  // Optionally update password
  if (password && password.length >= 6) {
    const { error: pwError } = await db.auth.admin.updateUserById(id, { password });
    if (pwError) return NextResponse.json({ error: pwError.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const current = await verifyAdmin(request);
  const id = new URL(request.url).searchParams.get('id');
  if (!current || !id || id === current.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { error } = await adminClient().auth.admin.deleteUser(id);
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ ok: true });
}
