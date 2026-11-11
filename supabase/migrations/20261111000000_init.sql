-- Personal Schedule: tables, row level security and realtime.
-- Run once in the Supabase SQL Editor (safe to re-run).

create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null default '',
  description text not null default '',
  priority    text not null default '' check (priority in ('', 'urgent', 'high', 'low')),
  subtasks    jsonb not null default '[]'::jsonb,
  project     text not null default 'other',
  status      text not null default 'todo' check (status in ('todo', 'doing', 'done', 'canceled')),
  day         date not null default current_date,
  deadline    date,
  created_at  bigint not null default (extract(epoch from now()) * 1000)::bigint,
  updated_at  timestamptz not null default now()
);
create index if not exists tasks_user_idx on public.tasks (user_id);

create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id    uuid not null references public.tasks (id) on delete cascade,
  text       text not null check (char_length(text) between 1 and 2000),
  at         bigint not null default (extract(epoch from now()) * 1000)::bigint
);
create index if not exists comments_user_idx on public.comments (user_id);
create index if not exists comments_task_idx on public.comments (task_id);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists tasks_touch on public.tasks;
create trigger tasks_touch before update on public.tasks for each row execute function public.touch_updated_at();

-- Every user sees and changes only their own rows.
alter table public.tasks enable row level security;
alter table public.comments enable row level security;

drop policy if exists "own tasks" on public.tasks;
create policy "own tasks" on public.tasks for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "own comments" on public.comments;
create policy "own comments" on public.comments for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Live updates between tabs and devices.
do $$ begin
  alter publication supabase_realtime add table public.tasks;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.comments;
exception when duplicate_object then null; end $$;
