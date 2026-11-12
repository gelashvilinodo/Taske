import { NextResponse, type NextRequest } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { payloadFor, pushToDevices, type NotificationRow } from '@/lib/push/server';
import { vapidFromEnv } from '@/lib/push/webpush';

/**
 * The overdue job. Cloudflare calls it every 15 minutes (cron trigger in wrangler.jsonc, see
 * worker.ts). It adds a notification for each newly overdue task and pushes it to that user's devices.
 * Protected by CRON_SECRET (`npx wrangler secret put CRON_SECRET`).
 */
const MAX_SEPARATE = 2;

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET ?? '';
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const db = getAdminSupabase();
  if (!db) return NextResponse.json({ error: 'SUPABASE_SECRET_KEY is not set' }, { status: 503 });

  const { data, error } = await db.rpc('queue_overdue_notifications');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = (data ?? []) as NotificationRow[];

  const keys = vapidFromEnv();
  let sent = 0, failed = 0;
  if (keys && rows.length) {
    const users = [...new Set(rows.map(r => r.user_id))];
    const { data: subs } = await db.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth').in('user_id', users);
    for (const user of users) {
      const mine = (subs ?? []).filter(s => s.user_id === user);
      if (!mine.length) continue;
      const own = rows.filter(r => r.user_id === user);
      // Several at once (say, the first run after turning this on): one summary push instead of a burst.
      const payloads = own.length <= MAX_SEPARATE ? own.map(payloadFor) : [{
        id: own[0].id, kind: 'overdue' as const, url: '/notifications',
        title: `${own.length} tasks are overdue`,
        body: own.slice(0, 3).map(r => r.title.replace(/^Overdue: /, '')).join(', ') + (own.length > 3 ? ` and ${own.length - 3} more` : ''),
      }];
      for (const payload of payloads) {
        const results = await pushToDevices(db, mine, payload, keys);
        results.forEach(r => (r.ok ? sent++ : failed++));
      }
    }
  }
  return NextResponse.json({ created: rows.length, sent, failed, push: Boolean(keys) });
}
