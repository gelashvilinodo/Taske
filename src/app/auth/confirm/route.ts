import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

const TYPES: EmailOtpType[] = ['email', 'magiclink', 'signup', 'invite', 'recovery', 'email_change'];

/**
 * Link in the sign-in email: /auth/confirm?token_hash=…&type=email.
 * Verified on the server, so it works on any device, not only in the browser that asked for the email.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next');
  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/board';

  if (tokenHash && type && TYPES.includes(type)) {
    const supabase = await getServerSupabase();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${target}`);
    const msg = /expired|invalid/i.test(error.message) ? 'This sign-in link has expired or was already used. Ask for a new one.' : error.message;
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(msg)}`);
  }
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('This sign-in link is incomplete. Ask for a new one.')}`);
}
