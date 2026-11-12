# Taske — Personal Schedule

Week planner for tasks across projects. Next.js (App Router) + TypeScript + Supabase, hosted on Cloudflare Workers.

Live: https://taske.nodogelashvili99.workers.dev

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

Without Supabase settings the app runs in **local mode**: no sign-in, tasks are kept in this browser.
To use the database and sign-in, copy `.env.example` to `.env.local` and fill in the Supabase URL and publishable key.

## Folders

```
src/
  app/
    (workspace)/          pages behind sign-in, sharing one header and task data
      board/              week board (Mon–Fri columns)
      list/               this week grouped by status
      calendar/           month overview (Google / Apple sync comes later)
      content-calendar/   hour-by-hour content plan (placeholder)
      table/              all tasks, sortable
      notifications/      overdue-task notifications and the "turn on notifications" prompt
    api/push/             push: public key, save a device, send a test
    api/cron/overdue/     the 15-minute overdue job (called by worker.ts)
    login/                Apple, Google and email-code sign-in
    auth/callback/        OAuth return route
  components/
    auth/                 login form
    shell/                header, page tabs, theme switch, toast
    tasks/                task card, editor, add form, filters, drag tray
    views/                the main view of each page
    workspace/            WorkspaceProvider: tasks, comments, sync, shared view state
  lib/
    dates.ts              date helpers
    tasks/model.ts        task types, projects, statuses, sorting
    store/                persistence: Supabase or browser (local mode)
    supabase/             Supabase clients and session refresh
  styles/                 design tokens and shared styles
supabase/migrations/      database schema, run in the Supabase SQL editor
docs/PLAN.md              roadmap
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript check |
| `npm run preview` | Build for Cloudflare and run it locally in the Workers runtime |
| `npm run deploy` | Build for Cloudflare and deploy to Workers |

## Deploy (Cloudflare Workers)

The app is built with [OpenNext for Cloudflare](https://opennext.js.org/cloudflare) and deployed with Wrangler (`wrangler.jsonc`, `open-next.config.ts`).

```bash
npx wrangler login   # once per machine
npm run deploy
```

`NEXT_PUBLIC_SUPABASE_*` values are baked in at build time, so deploy from a machine that has `.env.local` filled in, and redeploy after changing them.

## Notifications (push)

Overdue tasks become notifications on the Notifications page and a push on every device where they were turned on
(laptop browsers, Android, and iPhone once Taske is added to the Home Screen). With Taske open, the app plays its own
sound instead of a system banner (`public/sw.js`).

- Database: run `supabase/migrations/20261112200000_notifications.sql` in the Supabase SQL Editor.
- `worker.ts` wraps the OpenNext worker and runs `/api/cron/overdue` every 15 minutes (`triggers.crons` in `wrangler.jsonc`).
  A task counts as overdue the day after its deadline, from 09:00 in the device's time zone.
- Keys: `VAPID_PUBLIC_KEY` is in `wrangler.jsonc`. Secrets (`npx wrangler secret put NAME`): `VAPID_PRIVATE_KEY`,
  `SUPABASE_SECRET_KEY` (Supabase → Project Settings → API Keys), `CRON_SECRET` (any long random string).
  New key pair: `node scripts/vapid-keys.mjs`.
