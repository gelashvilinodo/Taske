import { NextResponse, type NextRequest } from 'next/server';
import { supabaseEnabled } from '@/lib/supabase/config';
import { updateSession } from '@/lib/supabase/session';

export async function proxy(request: NextRequest) {
  if (!supabaseEnabled) {
    // Local mode has no accounts, so the login page has nothing to do.
    if (request.nextUrl.pathname === '/login') return NextResponse.redirect(new URL('/board', request.url));
    return NextResponse.next();
  }
  return updateSession(request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)'],
};
