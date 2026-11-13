import type { SupabaseClient } from '@supabase/supabase-js';
import type { Comment, HistoryEvent, TaskFields, TaskPatch } from '@/lib/tasks/model';
import type { RawProject, RawTask, StoreError, TaskStore } from './types';

// App field name → database column.
const TASK_COLUMNS: Record<keyof TaskFields, string> = {
  title: 'title', description: 'description', priority: 'priority', subtasks: 'subtasks',
  project: 'project', status: 'status', day: 'day', deadline: 'deadline', createdAt: 'created_at', position: 'position',
};

function toRow(fields: TaskPatch) {
  const row: Record<string, unknown> = {};
  (Object.keys(fields) as (keyof TaskFields)[]).forEach(k => {
    row[TASK_COLUMNS[k]] = k === 'deadline' && !fields[k] ? null
      // `done` is kept beside `status` so older versions of the app still read subtasks correctly.
      : k === 'subtasks' && fields.subtasks ? fields.subtasks.map(s => ({ ...s, done: s.status === 'done' }))
      : fields[k];
  });
  return row;
}

function fromRow(r: Record<string, unknown>): RawTask {
  const out: RawTask = { id: String(r.id) };
  (Object.keys(TASK_COLUMNS) as (keyof TaskFields)[]).forEach(k => { out[k] = r[TASK_COLUMNS[k]]; });
  out.deadline = r.deadline || '';
  out.createdAt = Number(r.created_at) || 0;
  out.position = typeof r.position === 'number' ? r.position : undefined;
  return out;
}

/** Newest history entries loaded at once. */
const HISTORY_LIMIT = 5000;

function check({ error }: { error: { message: string; code?: string } | null }) {
  if (!error) return;
  const offline = (typeof navigator !== 'undefined' && !navigator.onLine) || /fetch|network/i.test(error.message);
  const err: StoreError = {
    code: offline ? 'unavailable'
      : error.code === '42501' ? 'forbidden'
      : error.code === 'PGRST205' || error.code === '42P01' ? 'missing_table'
      : error.code === 'PGRST204' || error.code === '42703' ? 'missing_column'
      : 'unknown',
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
      return (res.data ?? []).map(r => ({ id: r.id, taskId: r.task_id, subId: typeof r.sub_id === 'string' ? r.sub_id : '', text: r.text, at: Number(r.at) || 0, by: r.user_id }));
    },
    async loadProjects() {
      const res = await sb.from('projects').select('*');
      check(res);
      return (res.data ?? []).map(r => ({
        id: String(r.id), name: r.name, color: r.color, logo: r.logo ?? '', createdAt: Number(r.created_at) || 0,
      }) as RawProject);
    },
    watch(onChange) {
      const channel = sb.channel('schedule-' + Math.random().toString(36).slice(2))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => onChange('tasks'))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => onChange('comments'))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => onChange('projects'))
        .subscribe();
      const online = () => { onChange('tasks'); onChange('comments'); onChange('projects'); };
      window.addEventListener('online', online);
      return () => { window.removeEventListener('online', online); sb.removeChannel(channel); };
    },
    insertTask: async (id, fields) => check(await sb.from('tasks').insert({ id, ...toRow(fields) })),
    updateTask: async (id, patch) => check(await sb.from('tasks').update(toRow(patch)).eq('id', id)),
    deleteTask: async id => check(await sb.from('tasks').delete().eq('id', id)),
    // sub_id is only sent for subtask comments, so task comments still save before the column exists.
    insertComment: async (c: Comment) => check(await sb.from('comments').insert({ id: c.id, task_id: c.taskId, text: c.text, at: c.at, ...(c.subId ? { sub_id: c.subId } : {}) })),
    deleteComment: async id => check(await sb.from('comments').delete().eq('id', id)),
    insertProject: async (id, f) => check(await sb.from('projects').insert({ id, name: f.name, color: f.color, logo: f.logo || null, created_at: f.createdAt })),
    updateProject: async (id, p) => {
      const row: Record<string, unknown> = {};
      if (p.name !== undefined) row.name = p.name;
      if (p.color !== undefined) row.color = p.color;
      if (p.logo !== undefined) row.logo = p.logo || null;
      check(await sb.from('projects').update(row).eq('id', id));
    },
    deleteProject: async id => {
      check(await sb.from('tasks').update({ project: '' }).eq('project', id));
      check(await sb.from('projects').delete().eq('id', id));
    },
    async loadHistory(taskId) {
      let q = sb.from('task_history').select('id, task_id, task_title, kind, changes, at, user_id, by_name');
      if (taskId) q = q.eq('task_id', taskId);
      const res = await q.order('at', { ascending: false }).limit(HISTORY_LIMIT);
      check(res);
      return (res.data ?? []).map(r => ({
        id: String(r.id), taskId: String(r.task_id), taskTitle: r.task_title ?? '', kind: r.kind,
        changes: Array.isArray(r.changes) ? r.changes : [], at: Number(r.at) || 0, by: r.user_id ?? '', byName: r.by_name ?? '',
      }) as HistoryEvent);
    },
    insertHistory: async (e: HistoryEvent) => check(await sb.from('task_history').insert({
      id: e.id, task_id: e.taskId, task_title: e.taskTitle, kind: e.kind, changes: e.changes, at: e.at, by_name: e.byName,
    })),
    watchHistory(onChange) {
      const channel = sb.channel('history-' + Math.random().toString(36).slice(2))
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'task_history' }, () => onChange())
        .subscribe();
      return () => { sb.removeChannel(channel); };
    },
  };
}
