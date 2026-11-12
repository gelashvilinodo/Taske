import { NextResponse, type NextRequest } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { payloadFor, pushToDevices, type NotificationRow } from '@/lib/push/server';
import { vapidFromEnv } from '@/lib/push/webpush';

/**
 * Sends a test notification to one of the signed-in user's devices (the one that just turned
 * notifications on). It also appears on the Notifications page. The browser then waits for the
 * service worker to report that it arrived.
 */
export async function POST(req: NextRequest) {
  const keys = vapidFromEnv();
  if (!keys) return NextResponse.json({ error: 'not_set_up' }, { status: 503 });
  const body = (await req.json().catch(() => null)) as { endpoint?: unknown } | null;
  const endpoint = typeof body?.endpoint === 'string' ? body.endpoint : '';

  const sb = await getServerSupabase();
  const { data: claims } = await sb.auth.getClaims();
  if (!claims?.claims) return NextResponse.json({ error: 'signed_out' }, { status: 401 });

  // Row level security limits this to the user's own devices.
  const { data: sub } = await sb.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('endpoint', endpoint).maybeSingle();
  if (!sub) return NextResponse.json({ error: 'unknown_device' }, { status: 404 });

  const { data: row, error } = await sb.from('notifications')
    .insert({ kind: 'test', title: 'Notifications are on', body: 'This device will now tell you when a task is overdue.' })
    .select('id, user_id, kind, task_id, title, body').single();
  if (error || !row) return NextResponse.json({ error: 'save_failed', message: error?.message }, { status: 500 });

  // A test that can't arrive within two minutes is not worth delivering later.
  const [result] = await pushToDevices(sb, [sub], payloadFor(row as NotificationRow), keys, { ttl: 120 });
  if (!result.ok) {
    return NextResponse.json({ error: result.gone ? 'device_gone' : 'push_failed', status: result.status, message: result.error, id: row.id }, { status: 502 });
  }
  return NextResponse.json({ ok: true, id: row.id });
}
