export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

/** Without Supabase settings the app runs in local mode: no sign-in, tasks stay in the browser. */
export const supabaseEnabled = Boolean(SUPABASE_URL && SUPABASE_KEY);
