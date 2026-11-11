import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { SUPABASE_KEY, SUPABASE_URL } from './config';

/** Supabase client for Server Components and Route Handlers, using the request cookies. */
export async function getServerSupabase() {
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: list => {
        try { list.forEach(({ name, value, options }) => store.set(name, value, options)); }
        catch { /* Server Components cannot set cookies; the browser client refreshes the session instead. */ }
      },
    },
  });
}

/** True when the request carries a valid Supabase session. */
export async function isSignedIn() {
  const supabase = await getServerSupabase();
  const { data } = await supabase.auth.getClaims();
  return Boolean(data?.claims);
}

/**
 * Which one-tap providers are switched on in Supabase (Authentication → Sign In / Providers).
 * Read from the public settings endpoint so a provider's button appears as soon as it is enabled.
 */
export async function enabledProviders(): Promise<('apple' | 'google')[]> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_KEY }, cache: 'no-store' });
    if (!res.ok) return ['google'];
    const external = ((await res.json()) as { external?: Record<string, boolean> }).external ?? {};
    return (['apple', 'google'] as const).filter(p => external[p]);
  } catch {
    return ['google'];
  }
}
