import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from './config';

/**
 * Server-only Supabase client with the secret (service role) key: bypasses row level security.
 * Used by the overdue job, which works across all users. Never import this into browser code.
 * The key is a Worker secret: `npx wrangler secret put SUPABASE_SECRET_KEY`.
 */
export function getAdminSupabase(): SupabaseClient | null {
  const key = process.env.SUPABASE_SECRET_KEY ?? '';
  if (!SUPABASE_URL || !key) return null;
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
