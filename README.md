# Taske — Personal Schedule

Week planner for tasks across projects. Next.js (App Router) + TypeScript + Supabase.

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
  proxy.ts                session refresh and sign-in redirect
supabase/migrations/      database schema, run in the Supabase SQL editor
docs/PLAN.md              roadmap
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript check |
