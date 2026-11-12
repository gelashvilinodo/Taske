import { NextResponse, type NextRequest } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

type Body = { subscription?: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }; timeZone?: unknown };
const str = (v: unknown, max: number) => (typeof v === 'string' && v.length > 0 && v.length <= max ? v : null);

/** Saves this device's push subscription for the signed-in user. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Body | null;
  const endpoint = str(body?.subscription?.endpoint, 2000);
  const p256dh = str(body?.subscription?.keys?.p256dh, 200);
  const auth = str(body?.subscription?.keys?.auth, 100);
  if (!endpoint || !endpoint.startsWith('https://') || !p256dh || !auth) {
    return NextResponse.json({ error: 'bad_subscription' }, { status: 400 });
  }
  const sb = await getServerSupabase();
  const { data } = await sb.auth.getClaims();
  if (!data?.claims) return NextResponse.json({ error: 'signed_out' }, { status: 401 });

  const { error } = await sb.rpc('save_push_subscription', {
    p_endpoint: endpoint, p_p256dh: p256dh, p_auth: auth,
    p_time_zone: str(body?.timeZone, 64) ?? '', p_user_agent: req.headers.get('user-agent') ?? '',
  });
  if (error) {
    const missing = error.code === 'PGRST202' || error.code === '42883' || error.code === 'PGRST205';
    return NextResponse.json({ error: missing ? 'not_set_up' : 'save_failed', message: error.message }, { status: missing ? 503 : 500 });
  }
  return NextResponse.json({ ok: true });
}
