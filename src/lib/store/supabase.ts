import type { SupabaseClient } from '@supabase/supabase-js';
import type { Comment, TaskFields, TaskPatch } from '@/lib/tasks/model';
import type { RawTask, StoreError, TaskStore } from './types';

// App field name → database column.
const TASK_COLUMNS: Record<keyof TaskFields, string> = {
  title: 'title', description: 'description', priority: 'priority', subtasks: 'subtasks',
  project: 'project', status: 'status', day: 'day', deadline: 'deadline', createdAt: 'created_at',
};

function toRow(fields: TaskPatch) {
  const row: Record<string, unknown> = {};
  (Object.keys(fields) as (keyof TaskFields)[]).forEach(k => {
    row[TASK_COLUMNS[k]] = k === 'deadline' && !fields[k] ? null : fields[k];
  });
  return row;
}

function fromRow(r: Record<string, unknown>): RawTask {
  const out: RawTask = { id: String(r.id) };
  (Object.keys(TASK_COLUMNS) as (keyof TaskFields)[]).forEach(k => { out[k] = r[TASK_COLUMNS[k]]; });
  out.deadline = r.deadline || '';
  out.createdAt = Number(r.created_at) || 0;
  return out;
}

function check({ error }: { error: { message: string; code?: string } | null }) {
  if (!error) return;
  const offline = (typeof navigator !== 'undefined' && !navigator.onLine) || /fetch|network/i.test(error.message);
  const err: StoreError = {
    code: offline ? 'unavailable' : error.code === '42501' ? 'forbidden' : 'unknown',
    message: error.message,
  };
  throw err;
}

export function createSupabaseStore(sb: SupabaseClient): TaskStore {
  return {
    kind: 'supabase',
    async loadTasks() {
      const res = await sb.from('tasks').select('*');
      check(res);
      return (res.data ?? []).map(fromRow);
    },
    async loadComments() {
      const res = await sb.from('comments').select('*');
      check(res);
      return (res.data ?? []).map(r => ({ id: r.id, taskId: r.task_id, text: r.text, at: Number(r.at) || 0, by: r.user_id }));
    },
    watch(onChange) {
      const channel = sb.channel('schedule-' + Math.random().toString(36).slice(2))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => onChange('tasks'))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => onChange('comments'))
        .subscribe();
      const online = () => { onChange('tasks'); onChange('comments'); };
      window.addEventListener('online', online);
      return () => { window.removeEventListener('online', online); sb.removeChannel(channel); };
    },
    insertTask: async (id, fields) => check(await sb.from('tasks').insert({ id, ...toRow(fields) })),
    updateTask: async (id, patch) => check(await sb.from('tasks').update(toRow(patch)).eq('id', id)),
    deleteTask: async id => check(await sb.from('tasks').delete().eq('id', id)),
    insertComment: async (c: Comment) => check(await sb.from('comments').insert({ id: c.id, task_id: c.taskId, text: c.text, at: c.at })),
    deleteComment: async id => check(await sb.from('comments').delete().eq('id', id)),
  };
}
