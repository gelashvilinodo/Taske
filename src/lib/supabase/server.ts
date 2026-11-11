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
