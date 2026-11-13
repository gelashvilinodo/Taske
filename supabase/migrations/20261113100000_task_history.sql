-- Task history: who created, changed, commented on or deleted a task, and when.
-- Run once in the Supabase SQL Editor (safe to re-run).

create table if not exists public.task_history (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- No foreign key: the history of a deleted task stays.
  task_id     uuid not null,
  -- The task's name at the time, so the entry still reads well after a rename or delete.
  task_title  text not null default '' check (char_length(task_title) <= 500),
  kind        text not null check (kind in ('created', 'updated', 'deleted', 'commented', 'comment_deleted')),
  -- [{ field, from?, to?, sub? }]
  changes     jsonb not null default '[]'::jsonb check (jsonb_typeof(changes) = 'array'),
  by_name     text not null default '' check (char_length(by_name) <= 200),
  at          bigint not null default (extract(epoch from now()) * 1000)::bigint
);
create index if not exists task_history_user_at_idx on public.task_history (user_id, at desc);
create index if not exists task_history_task_idx on public.task_history (task_id, at desc);

alter table public.task_history enable row level security;
-- Entries can be added and read, never edited or removed from the app: it is an archive.
drop policy if exists "own history read" on public.task_history;
create policy "own history read" on public.task_history for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "own history add" on public.task_history;
create policy "own history add" on public.task_history for insert to authenticated
  with check (user_id = (select auth.uid()));

do $$ begin
  alter publication supabase_realtime add table public.task_history;
exception when duplicate_object then null; end $$;
