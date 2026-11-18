// Server-only: who is calling an API route, from the Supabase session token in the Authorization header.
import { createClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';

const DEVELOPER_DOMAINS = ['leonxlab.app', 'leonxlab.digital'];

export function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// The caller's id and email, and whether they may act on other users' data.
export async function verifyViewer(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const db = adminClient();
  const { data: { user } } = await db.auth.getUser(token);
  if (!user) return null;
  const { data: profile } = await db.from('profiles').select('role,dev_access').eq('id', user.id).single();
  const email = user.email?.toLowerCase() || '';
  const isAdmin = profile?.role === 'admin' || Boolean(profile?.dev_access) || DEVELOPER_DOMAINS.some(d => email.endsWith(`@${d}`));
  return { db, id: user.id, email, isAdmin };
}
