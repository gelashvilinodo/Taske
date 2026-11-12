import type { SupabaseClient } from '@supabase/supabase-js';
import { sendPush, type PushResult, type PushTarget, type VapidKeys } from './webpush';

/** What the service worker (public/sw.js) receives. */
export interface PushPayload { id: string; kind: 'overdue' | 'test'; title: string; body: string; url: string; taskId?: string | null }

export interface NotificationRow { id: string; user_id: string; kind: 'overdue' | 'test'; task_id: string | null; title: string; body: string }

export const payloadFor = (n: NotificationRow): PushPayload => ({
  id: n.id, kind: n.kind, title: n.title, body: n.body, taskId: n.task_id,
  url: n.task_id ? `/notifications?task=${n.task_id}` : '/notifications',
});

/**
 * Pushes to every device in `targets` and removes devices the push service says are gone
 * (unsubscribed, browser data cleared, app removed). `db` must be allowed to delete those rows.
 */
export async function pushToDevices(db: SupabaseClient, targets: (PushTarget & { id: string })[], payload: PushPayload, keys: VapidKeys, opts: { ttl?: number } = {}) {
  const results = await Promise.all(targets.map(async t => ({ t, r: await sendPush(t, payload, keys, { ttl: opts.ttl, topic: payload.id.replace(/-/g, '') }) })));
  const gone = results.filter(x => x.r.gone).map(x => x.t.id);
  if (gone.length) await db.from('push_subscriptions').delete().in('id', gone);
  return results.map(x => ({ id: x.t.id, ...x.r })) as (PushResult & { id: string })[];
}
