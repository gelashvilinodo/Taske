-- One task's history (the History button in a task's window) is loaded on its own; this keeps that lookup fast.
create index if not exists task_history_task_at_idx on public.task_history (task_id, at desc);
