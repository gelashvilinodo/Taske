/**
 * Cloudflare Worker entry: the Next.js app built by OpenNext, plus a cron trigger.
 * Every 15 minutes (wrangler.jsonc → triggers.crons) it calls /api/cron/overdue, which turns newly
 * overdue tasks into notifications and pushes them to the user's devices.
 * Built by wrangler after `opennextjs-cloudflare build`; not part of the Next.js type check.
 */
import { default as handler } from './.open-next/worker.js';

interface Env { CRON_SECRET?: string; [key: string]: unknown }

export default {
  fetch: handler.fetch,
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    if (!env.CRON_SECRET) { console.warn('overdue job skipped: CRON_SECRET is not set'); return; }
    const req = new Request('https://taske.ge/api/cron/overdue', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.CRON_SECRET}` },
    });
    const res: Response = await handler.fetch(req, env, ctx);
    console.log('overdue job', res.status, await res.text());
  },
} satisfies ExportedHandler<Env>;
