import { createBrowserClient } from '@supabase/ssr';
// Placeholder values let Vercel build before environment variables are added.
// The UI blocks database calls until both real variables are configured.
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'
);
