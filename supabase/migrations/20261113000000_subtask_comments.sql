-- Comments on subtasks. A comment still belongs to a task; sub_id says which subtask
-- (at any depth) it is about, or '' when it is about the task itself.
-- Run once in the Supabase SQL Editor (safe to re-run).

alter table public.comments add column if not exists sub_id text not null default '';
create index if not exists comments_task_sub_idx on public.comments (task_id, sub_id);
