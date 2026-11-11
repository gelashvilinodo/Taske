-- Manual order of tasks within a day (drag a card up or down, or to another day).
-- Run once in the Supabase SQL Editor (safe to re-run).

alter table public.tasks add column if not exists position double precision;
-- Existing tasks keep their current order: by when they were created.
update public.tasks set position = created_at where position is null;
create index if not exists tasks_day_position_idx on public.tasks (user_id, day, position);
