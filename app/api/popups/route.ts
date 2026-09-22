import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET() {
  const { data, error } = await db()
    .from('app_popups')
    .select('id,title,body,starts_at,ends_at,custom_label,custom_url,close_label')
    .eq('is_active', true)
    .lte('starts_at', new Date().toISOString().slice(0, 10))
    .gte('ends_at', new Date().toISOString().slice(0, 10))
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data || []);
}
