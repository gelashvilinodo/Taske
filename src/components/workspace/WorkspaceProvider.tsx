'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { iso, planningMonday, monthStart, addDays } from '@/lib/dates';
import { cleanProject, cleanTask, type Comment, type Project, type ProjectFields, type ProjectPatch, type Task, type TaskFields, type TaskPatch } from '@/lib/tasks/model';
import { createLocalStore } from '@/lib/store/local';
import { createSupabaseStore } from '@/lib/store/supabase';
import type { StoreError, Table, TaskStore } from '@/lib/store/types';
import { supabaseEnabled } from '@/lib/supabase/config';
import { getBrowserSupabase } from '@/lib/supabase/client';

type Conn = 'loading' | 'live' | 'bad';
export type Account = { id: string; email: string; name: string } | null;

interface Workspace {
  mode: 'supabase' | 'local';
  account: Account;
  tasks: Task[];
  /** The user's projects, oldest first */
  projects: Project[];
  /** Project by id; undefined for '' or a project that was deleted */
  projectById: (id: string) => Project | undefined;
  comments: Record<string, Comment[]>;
  names: Record<string, string>;
  loaded: boolean;
  conn: Conn;
  readOnly: boolean;
  // Shared view state, kept while moving between pages.
  weekStart: Date;
  setWeekStart: (d: Date) => void;
  month: Date;
  setMonth: (d: Date) => void;
  filter: string;
  setFilter: (f: string) => void;
  // Actions
  addTasks: (list: TaskFields[]) => Promise<void>;
  patchTask: (id: string, patch: TaskPatch) => void;
  removeTask: (id: string) => void;
  addComment: (taskId: string, text: string) => void;
  removeComment: (taskId: string, id: string) => void;
  addProject: (fields: Omit<ProjectFields, 'createdAt'>) => string;
  updateProject: (id: string, patch: ProjectPatch) => void;
  removeProject: (id: string) => void;
  signOut: () => Promise<void>;
  // UI helpers
  toast: (msg: string) => void;
  toastMsg: string;
  editingId: string | null;
  openEditor: (id: string | null) => void;
  dragId: string | null;
  setDragId: (id: string | null) => void;
}

const Ctx = createContext<Workspace | null>(null);

export function useWorkspace() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return v;
}

export default function WorkspaceProvider({ children }: { children: ReactNode }) {
  const store = useMemo<TaskStore>(
    () => (supabaseEnabled ? createSupabaseStore(getBrowserSupabase()) : createLocalStore()),
    [],
  );
  const [account, setAccount] = useState<Account>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [loaded, setLoaded] = useState(false);
  const [conn, setConn] = useState<Conn>('loading');
  const [readOnly, setReadOnly] = useState(false);
  const [weekStart, setWeekStart] = useState<Date>(() => planningMonday());
  const [month, setMonth] = useState<Date>(() => monthStart(planningMonday()));
  const [filter, setFilter] = useState('all');
  const [toastMsg, setToastMsg] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(''), 3600);
  }, []);

  // ----- Loading and live sync -----
  const pending = useRef(0);
  const reloadTimer = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const loadTasks = useCallback(async () => {
    const fallback = iso(planningMonday());
    const raw = await store.loadTasks();
    setTasks(raw.map(r => cleanTask(r.id, r, fallback)).filter(t => t.title));
  }, [store]);

  const loadComments = useCallback(async () => {
    const list = await store.loadComments();
    const map: Record<string, Comment[]> = {};
    list.forEach(c => { (map[c.taskId] ||= []).push(c); });
    Object.values(map).forEach(a => a.sort((x, y) => x.at - y.at));
    setComments(map);
  }, [store]);

  const loadProjects = useCallback(async () => {
    const raw = await store.loadProjects();
    setProjects(raw.map(r => cleanProject(r.id, r)).filter(p => p.name).sort((a, b) => a.createdAt - b.createdAt));
  }, [store]);

  const scheduleReload = useCallback((table: Table) => {
    clearTimeout(reloadTimer.current[table]);
    reloadTimer.current[table] = setTimeout(function again() {
      // Don't overwrite optimistic changes with data fetched before our own writes finished.
      if (pending.current > 0) { reloadTimer.current[table] = setTimeout(again, 300); return; }
      const load = table === 'tasks' ? loadTasks : table === 'comments' ? loadComments : loadProjects;
      // A missing projects table (migration not run yet) must not mark the whole app offline.
      load().then(() => setConn('live')).catch(() => { if (table !== 'projects') setConn('bad'); });
    }, 150);
  }, [loadTasks, loadComments, loadProjects]);

  useEffect(() => {
    let alive = true;
    // Projects may not exist yet in an older database; tasks still load without them.
    loadProjects().catch(() => undefined);
    Promise.all([loadTasks(), loadComments()])
      .then(() => { if (alive) { setLoaded(true); setConn('live'); } })
      .catch(() => { if (alive) { setLoaded(true); setConn('bad'); } });
    const stop = store.watch(scheduleReload);
    const onVisible = () => { if (!document.hidden) { scheduleReload('tasks'); scheduleReload('comments'); scheduleReload('projects'); } };
    document.addEventListener('visibilitychange', onVisible);
    return () => { alive = false; stop(); document.removeEventListener('visibilitychange', onVisible); };
  }, [store, loadTasks, loadComments, loadProjects, scheduleReload]);

  useEffect(() => {
    if (!supabaseEnabled) return;
    const sb = getBrowserSupabase();
    sb.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (!u) return;
      const meta = u.user_metadata || {};
      setAccount({ id: u.id, email: u.email ?? '', name: meta.full_name || meta.name || u.email || 'You' });
    });
  }, []);

  // ----- Writes: optimistic, serialised per record, one retry when offline -----
  const queues = useRef<Record<string, Promise<unknown>>>({});
  const run = useCallback((id: string, table: Table, fn: () => Promise<void>) => {
    pending.current++;
    const attempt = () => fn().catch((e: StoreError) => {
      if (e?.code === 'unavailable') return new Promise(r => setTimeout(r, 400 + Math.random() * 600)).then(fn);
      throw e;
    });
    const p = (queues.current[id] || Promise.resolve())
      .then(attempt)
      .catch((e: StoreError) => {
        if (e?.code === 'forbidden') { setReadOnly(true); toast('You can view this page but not change it.'); }
        else if (e?.code === 'quota_exceeded') toast('Storage is full. Delete old tasks and try again.');
        else toast('Could not save. Check your connection and try again.');
      })
      .finally(() => { pending.current--; scheduleReload(table); });
    queues.current[id] = p;
    return p.then(() => undefined);
  }, [scheduleReload, toast]);

  const addTasks = useCallback(async (list: TaskFields[]) => {
    const created = list.map(f => ({ ...f, id: crypto.randomUUID() }));
    setTasks(ts => ts.concat(created));
    await Promise.all(created.map(({ id, ...fields }) => run(id, 'tasks', () => store.insertTask(id, fields))));
  }, [run, store]);

  const patchTask = useCallback((id: string, patch: TaskPatch) => {
    setTasks(ts => ts.map(t => (t.id === id ? { ...t, ...patch } : t)));
    run(id, 'tasks', () => store.updateTask(id, patch));
  }, [run, store]);

  const removeTask = useCallback((id: string) => {
    setTasks(ts => ts.filter(t => t.id !== id));
    setComments(cs => { const next = { ...cs }; delete next[id]; return next; });
    run(id, 'tasks', () => store.deleteTask(id));
  }, [run, store]);

  const addComment = useCallback((taskId: string, text: string) => {
    const c: Comment = { id: crypto.randomUUID(), taskId, text: text.slice(0, 2000), at: Date.now(), by: account?.id ?? '' };
    setComments(cs => ({ ...cs, [taskId]: (cs[taskId] || []).concat(c) }));
    run(c.id, 'comments', () => store.insertComment(c));
  }, [account, run, store]);

  const removeComment = useCallback((taskId: string, id: string) => {
    setComments(cs => ({ ...cs, [taskId]: (cs[taskId] || []).filter(c => c.id !== id) }));
    run(id, 'comments', () => store.deleteComment(id));
  }, [run, store]);

  const addProject = useCallback((fields: Omit<ProjectFields, 'createdAt'>) => {
    const id = crypto.randomUUID();
    const p: Project = { ...fields, id, createdAt: Date.now() };
    setProjects(ps => ps.concat(p));
    const { id: _id, ...rest } = p;
    run(id, 'projects', () => store.insertProject(id, rest));
    return id;
  }, [run, store]);

  const updateProject = useCallback((id: string, patch: ProjectPatch) => {
    setProjects(ps => ps.map(p => (p.id === id ? { ...p, ...patch } : p)));
    run(id, 'projects', () => store.updateProject(id, patch));
  }, [run, store]);

  const removeProject = useCallback((id: string) => {
    setProjects(ps => ps.filter(p => p.id !== id));
    setTasks(ts => ts.map(t => (t.project === id ? { ...t, project: '' } : t)));
    setFilter(f => (f === id ? 'all' : f));
    run(id, 'projects', () => store.deleteProject(id)).then(() => scheduleReload('tasks'));
  }, [run, store, scheduleReload]);

  const projectMap = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);
  const projectById = useCallback((id: string) => (id ? projectMap.get(id) : undefined), [projectMap]);

  const signOut = useCallback(async () => {
    if (!supabaseEnabled) return;
    await getBrowserSupabase().auth.signOut();
    window.location.assign('/login');
  }, []);

  const names = useMemo(() => (account ? { [account.id]: account.name } : {}), [account]);

  const value: Workspace = {
    mode: store.kind, account, tasks, projects, projectById, comments, names, loaded, conn, readOnly,
    weekStart, setWeekStart, month, setMonth, filter, setFilter,
    addTasks, patchTask, removeTask, addComment, removeComment, addProject, updateProject, removeProject, signOut,
    toast, toastMsg, editingId, openEditor: setEditingId, dragId, setDragId,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Month that contains the Thursday of the given week (ISO convention). */
export const monthOfWeek = (mon: Date) => monthStart(addDays(mon, 3));
