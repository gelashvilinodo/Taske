import type { Comment, HistoryEvent } from '@/lib/tasks/model';
import type { RawProject, RawTask, TaskStore } from './types';

// Same keys and record shape as the original single-page app, so existing browser data still loads.
const KEY = 'ps.db.';
type Bag = Record<string, Record<string, unknown>>;

const read = (name: string): Bag => {
  try { return JSON.parse(localStorage.getItem(KEY + name) || '{}') || {}; } catch { return {}; }
};
const write = (name: string, fn: (all: Bag) => void) => {
  const all = read(name);
  fn(all);
  try { localStorage.setItem(KEY + name, JSON.stringify(all)); } catch { return Promise.reject({ code: 'quota_exceeded' }); }
  return Promise.resolve();
};

export function createLocalStore(): TaskStore {
  return {
    kind: 'local',
    async loadTasks() {
      const all = read('tasks');
      return Object.keys(all).map(id => ({ ...all[id], id }) as RawTask);
    },
    async loadComments() {
      const all = read('comments');
      return Object.keys(all).map(id => {
        const v = all[id];
        return { id, taskId: String(v.taskId ?? ''), subId: String(v.subId ?? ''), text: String(v.text ?? ''), at: Number(v.at) || 0, by: String(v.by ?? '') };
      }).filter(c => c.taskId && c.text);
    },
    async loadProjects() {
      const all = read('projects');
      return Object.keys(all).map(id => ({ ...all[id], id }) as RawProject);
    },
    watch(onChange) {
      const fn = (e: StorageEvent) => {
        if (e.key === KEY + 'tasks') onChange('tasks');
        if (e.key === KEY + 'comments') onChange('comments');
        if (e.key === KEY + 'projects') onChange('projects');
      };
      window.addEventListener('storage', fn);
      return () => window.removeEventListener('storage', fn);
    },
    insertTask: (id, fields) => write('tasks', all => { all[id] = { ...fields }; }),
    updateTask: (id, patch) => write('tasks', all => { all[id] = { ...all[id], ...patch }; }),
    deleteTask: id => Promise.all([
      write('tasks', all => { delete all[id]; }),
      write('comments', all => { for (const k in all) if (all[k].taskId === id) delete all[k]; }),
    ]).then(() => undefined),
    insertComment: (c: Comment) => write('comments', all => { all[c.id] = { taskId: c.taskId, subId: c.subId, text: c.text, at: c.at, by: c.by }; }),
    deleteComment: id => write('comments', all => { delete all[id]; }),
    insertProject: (id, fields) => write('projects', all => { all[id] = { ...fields }; }),
    updateProject: (id, patch) => write('projects', all => { all[id] = { ...all[id], ...patch }; }),
    deleteProject: id => Promise.all([
      write('projects', all => { delete all[id]; }),
      write('tasks', all => { for (const k in all) if (all[k].project === id) all[k] = { ...all[k], project: '' }; }),
    ]).then(() => undefined),
    async loadHistory(taskId) {
      const all = read('history');
      return Object.keys(all).map(id => ({ ...all[id], id }) as unknown as HistoryEvent)
        .filter(e => e.taskId && Array.isArray(e.changes) && (!taskId || e.taskId === taskId)).sort((a, b) => b.at - a.at);
    },
    insertHistory: (e: HistoryEvent) => write('history', all => { const { id, ...rest } = e; all[id] = rest; }),
    watchHistory(onChange) {
      const fn = (e: StorageEvent) => { if (e.key === KEY + 'history') onChange(); };
      window.addEventListener('storage', fn);
      return () => window.removeEventListener('storage', fn);
    },
  };
}
