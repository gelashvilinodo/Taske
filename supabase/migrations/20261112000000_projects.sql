-- Projects the user creates (name, colour, logo) instead of the fixed Skrib / Sitbox / MODX / Ex City / Other list.
-- Run once in the Supabase SQL Editor after 20261111000000_init.sql (safe to re-run).

create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  color       text not null default '#8a4dfa' check (color ~ '^#[0-9a-fA-F]{6}$'),
  -- Small logo resized in the browser, stored as a data: URL (about 5–40 KB).
  logo        text check (logo is null or (logo like 'data:image/%' and char_length(logo) <= 200000)),
  created_at  bigint not null default (extract(epoch from now()) * 1000)::bigint
);
create index if not exists projects_user_idx on public.projects (user_id);

alter table public.projects enable row level security;
drop policy if exists "own projects" on public.projects;
create policy "own projects" on public.projects for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

do $$ begin
  alter publication supabase_realtime add table public.projects;
exception when duplicate_object then null; end $$;

-- Tasks now point at a project id, or '' for no project.
alter table public.tasks alter column project set default '';
-- Remove the old fixed projects from existing tasks; the tasks themselves stay.
update public.tasks set project = '' where project in ('skrib', 'sitbox', 'modx', 'excity', 'other');
