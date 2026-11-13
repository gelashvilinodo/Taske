'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { iso, planningMonday, monthStart, addDays } from '@/lib/dates';
import { cleanProject, cleanTask, diffTask, subTitleOf, type Comment, type HistoryEvent, type HistoryKind, type HistoryChange, type Project, type ProjectFields, type ProjectPatch, type Task, type TaskFields, type TaskPatch } from '@/lib/tasks/model';
import { createLocalStore } from '@/lib/store/local';
import { createSupabaseStore } from '@/lib/store/supabase';
import type { StoreError, Table, TaskStore } from '@/lib/store/types';
import { supabaseEnabled } from '@/lib/supabase/config';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { syncHeld } from '@/lib/syncHold';
import { rememberSession, signOutCurrent } from '@/lib/accounts';

/** A loaded task equal to the one already shown. */
const sameTask = (a: Task, b: Task) => (Object.keys(b) as (keyof Task)[]).every(k =>
  k === 'subtasks' ? JSON.stringify(a.subtasks) === JSON.stringify(b.subtasks) : a[k] === b[k]);

type Conn = 'loading' | 'live' | 'bad';
type HistoryState = 'idle' | 'loading' | 'ready' | 'missing' | 'bad';

/** Adds freshly loaded history entries to the ones on screen: newest first, each entry once. */
const mergeHistory = (have: HistoryEvent[], add: HistoryEvent[]) => {
  const byId = new Map(have.map(e => [e.id, e]));
  add.forEach(e => byId.set(e.id, e));
  return [...byId.values()].sort((a, b) => b.at - a.at);
};
/** `photo` is the profile picture from Google sign-in; empty for email and Apple accounts. */
export type Account = { id: string; email: string; name: string; photo: string } | null;

export interface ToastAction { label: string; run: () => void }

interface Workspace {
  mode: 'supabase' | 'local';
  account: Account;
  tasks: Task[];
  /** The user's projects, oldest first */
  projects: Project[];
  /** False when the database has no projects table yet, so projects cannot be saved */
  projectsReady: boolean;
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
  /** `subId` = the subtask the comment is about ('' or left out = the task). */
  addComment: (taskId: string, text: string, subId?: string) => void;
  removeComment: (taskId: string, id: string) => void;
  addProject: (fields: Omit<ProjectFields, 'createdAt'>) => string;
  updateProject: (id: string, patch: ProjectPatch) => void;
  removeProject: (id: string) => void;
  signOut: () => Promise<void>;
  // UI helpers
  /** A short message at the bottom; `action` adds a button to it (such as Undo). */
  toast: (msg: string, action?: ToastAction) => void;
  toastMsg: string;
  toastAction: ToastAction | null;
  editingId: string | null;
  openEditor: (id: string | null) => void;
  /** Task shown in the read-and-tick preview window (opened by clicking a task) */
  previewId: string | null;
  openPreview: (id: string | null) => void;
  /** Task history, newest first. Loaded on first use: all of it (`loadHistory`) or one task's (`loadTaskHistory`). */
  history: HistoryEvent[];
  /** The whole log. idle until something asks for it; missing = the history table is not in the database yet */
  historyState: HistoryState;
  loadHistory: () => void;
  /** Loads just one task's history (for its history window), unless the whole log is already loaded. */
  loadTaskHistory: (taskId: string) => void;
  /** Loading state of one task's history: the whole log's once that was asked for. */
  taskHistoryState: (taskId: string) => HistoryState;
  /** Task whose history window is open */
  historyId: string | null;
  openHistory: (id: string | null) => void;
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
  const [projectsReady, setProjectsReady] = useState(true);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [loaded, setLoaded] = useState(false);
  const [conn, setConn] = useState<Conn>('loading');
  const [readOnly, setReadOnly] = useState(false);
  const [weekStart, setWeekStart] = useState<Date>(() => planningMonday());
  const [month, setMonth] = useState<Date>(() => monthStart(planningMonday()));
  const [filter, setFilter] = useState('all');
  const [toastMsg, setToastMsg] = useState('');
  const [toastAction, setToastAction] = useState<ToastAction | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [historyState, setHistoryState] = useState<HistoryState>('idle');
  const [taskHx, setTaskHx] = useState<Record<string, HistoryState>>({});
  const [historyId, setHistoryId] = useState<string | null>(null);
  // Latest tasks and projects, read when recording what a change did (before the screen re-renders).
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const projectsRef = useRef(projects);
  projectsRef.current = projects;

  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const toast = useCallback((msg: string, action?: ToastAction) => {
    setToastMsg(msg);
    setToastAction(action ?? null);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => { setToastMsg(''); setToastAction(null); }, action ? 5000 : 3600);
  }, []);

  // ----- Loading and live sync -----
  const pending = useRef(0);
  const reloadTimer = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const loadTasks = useCallback(async () => {
    const fallback = iso(planningMonday());
    const raw = await store.loadTasks();
    const fresh = raw.map(r => cleanTask(r.id, r, fallback)).filter(t => t.title);
    // Keep the objects of tasks that did not change, so their cards (memoised) don't re-render; and when
    // nothing changed at all (usually: the reload after our own save), keep the list and render nothing.
    setTasks(prev => {
      const old = new Map(prev.map(t => [t.id, t]));
      let same = fresh.length === prev.length;
      const next = fresh.map((t, i) => {
        const o = old.get(t.id);
        const keep = o && sameTask(o, t) ? o : t;
        if (keep !== prev[i]) same = false;
        return keep;
      });
      return same ? prev : next;
    });
  }, [store]);

  const loadComments = useCallback(async () => {
    const list = await store.loadComments();
    const map: Record<string, Comment[]> = {};
    list.forEach(c => { (map[c.taskId] ||= []).push({ ...c, subId: typeof c.subId === 'string' ? c.subId : '' }); });
    Object.values(map).forEach(a => a.sort((x, y) => x.at - y.at));
    setComments(map);
  }, [store]);

  const loadProjects = useCallback(async () => {
    let raw;
    try { raw = await store.loadProjects(); }
    catch (e) {
      // Without the table nothing was saved: drop optimistic projects so the screen tells the truth.
      if ((e as StoreError)?.code === 'missing_table') { setProjectsReady(false); setProjects([]); }
      throw e;
    }
    setProjectsReady(true);
    setProjects(raw.map(r => cleanProject(r.id, r)).filter(p => p.name).sort((a, b) => a.createdAt - b.createdAt));
  }, [store]);

  const scheduleReload = useCallback((table: Table) => {
    clearTimeout(reloadTimer.current[table]);
    reloadTimer.current[table] = setTimeout(function again() {
      // Don't overwrite optimistic changes with data fetched before our own writes finished.
      // Nor change anything while a card is being dragged (see syncHold).
      if (pending.current > 0 || syncHeld()) { reloadTimer.current[table] = setTimeout(again, 300); return; }
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
    // Name, photo and id for the screen only, so the saved session is enough (no extra request; the database checks access itself).
    sb.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      if (!u) return;
      const meta = u.user_metadata || {};
      setAccount({ id: u.id, email: u.email ?? '', name: meta.full_name || meta.name || u.email || 'You', photo: meta.avatar_url || meta.picture || '' });
      rememberSession(data.session!);
    });
    // Keep this account's newest tokens for the account switcher (refresh tokens rotate).
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN' || event === 'USER_UPDATED')) rememberSession(session);
    });
    return () => sub.subscription.unsubscribe();
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
        else if (e?.code === 'missing_table') toast('Projects are not set up in the database yet, so this was not saved.');
        else if (e?.code === 'missing_column') toast('The database is missing a recent update, so this was not saved.');
        else toast('Could not save. Check your connection and try again.');
      })
      .finally(() => { pending.current--; scheduleReload(table); });
    queues.current[id] = p;
    return p.then(() => undefined);
  }, [scheduleReload, toast]);

  // ----- History -----
  const historyWanted = useRef(false);
  const fetchHistory = useCallback(() => store.loadHistory()
    .then(list => { setHistory(list); setHistoryState('ready'); })
    .catch((e: StoreError) => setHistoryState(e?.code === 'missing_table' ? 'missing' : 'bad')), [store]);
  const loadHistory = useCallback(() => {
    if (historyWanted.current) return;
    historyWanted.current = true;
    setHistoryState('loading');
    fetchHistory();
  }, [fetchHistory]);
  useEffect(() => {
    if (historyState !== 'ready') return;
    let timer: ReturnType<typeof setTimeout>;
    const stop = store.watchHistory(() => { clearTimeout(timer); timer = setTimeout(fetchHistory, 400); });
    return () => { clearTimeout(timer); stop(); };
  }, [historyState === 'ready', store, fetchHistory]); // eslint-disable-line react-hooks/exhaustive-deps

  // One task's history, for its history window: a small query instead of the whole log.
  const fetchTaskHistory = useCallback((taskId: string) => store.loadHistory(taskId)
    .then(list => { setHistory(h => mergeHistory(h, list)); setTaskHx(s => ({ ...s, [taskId]: 'ready' })); })
    .catch((e: StoreError) => setTaskHx(s => ({ ...s, [taskId]: e?.code === 'missing_table' ? 'missing' : 'bad' }))), [store]);
  const loadTaskHistory = useCallback((taskId: string) => {
    if (historyWanted.current) return;
    setTaskHx(s => (s[taskId] === 'ready' ? s : { ...s, [taskId]: 'loading' }));
    fetchTaskHistory(taskId);
  }, [fetchTaskHistory]);
  const taskHistoryState = useCallback((taskId: string): HistoryState =>
    (historyState !== 'idle' ? historyState : taskHx[taskId] ?? 'loading'), [historyState, taskHx]);
  // While a task's history window is open (and the whole log is not live), keep that task's list current.
  useEffect(() => {
    if (!historyId || historyState !== 'idle' || taskHx[historyId] !== 'ready') return;
    let timer: ReturnType<typeof setTimeout>;
    const stop = store.watchHistory(() => { clearTimeout(timer); timer = setTimeout(() => fetchTaskHistory(historyId), 400); });
    return () => { clearTimeout(timer); stop(); };
  }, [historyId, historyState, taskHx[historyId ?? ''] === 'ready', store, fetchTaskHistory]); // eslint-disable-line react-hooks/exhaustive-deps

  const accountRef = useRef(account);
  accountRef.current = account;
  /** Adds a history entry. Failing to save one never bothers the user: the change itself is what matters. */
  const record = useCallback((taskId: string, taskTitle: string, kind: HistoryKind, changes: HistoryChange[] = []) => {
    const who = accountRef.current;
    const e: HistoryEvent = {
      id: crypto.randomUUID(), taskId, taskTitle: taskTitle.slice(0, 500), kind, changes, at: Date.now(),
      by: who?.id ?? '', byName: (who?.name || (store.kind === 'local' ? 'You' : '')).slice(0, 200),
    };
    setHistory(h => [e, ...h]);
    const save = () => store.insertHistory(e);
    save().catch((err: StoreError) => {
      if (err?.code === 'missing_table') { setHistoryState('missing'); return; }
      if (err?.code === 'unavailable') setTimeout(() => save().catch(() => undefined), 1500);
    });
  }, [store]);
  const projectName = useCallback((id: string) => (id ? projectsRef.current.find(p => p.id === id)?.name ?? 'Deleted project' : ''), []);

  const addTasks = useCallback(async (list: TaskFields[]) => {
    const created = list.map(f => ({ ...f, id: crypto.randomUUID() }));
    // New tasks go to the end of their day; position is only stored once a task is reordered.
    setTasks(ts => ts.concat(created.map(c => ({ ...c, position: c.position ?? c.createdAt }))));
    created.forEach(c => record(c.id, c.title, 'created', [
      ...(c.status !== 'todo' ? [{ field: 'status' as const, to: c.status }] : []),
      ...(c.priority ? [{ field: 'priority' as const, to: c.priority }] : []),
      ...(c.project ? [{ field: 'project' as const, to: projectName(c.project) }] : []),
      { field: 'day' as const, to: c.day },
      ...(c.deadline ? [{ field: 'deadline' as const, to: c.deadline }] : []),
      ...c.subtasks.map(s => ({ field: 'sub_added' as const, sub: s.title })),
    ]));
    await Promise.all(created.map(({ id, ...fields }) => run(id, 'tasks', () => store.insertTask(id, fields))));
  }, [run, store, record, projectName]);

  const patchTask = useCallback((id: string, patch: TaskPatch) => {
    const before = tasksRef.current.find(t => t.id === id);
    if (before) {
      const changes = diffTask(before, patch, projectName);
      if (changes.length) record(id, patch.title ?? before.title, 'updated', changes);
      tasksRef.current = tasksRef.current.map(t => (t.id === id ? { ...t, ...patch } : t));
    }
    setTasks(ts => ts.map(t => (t.id === id ? { ...t, ...patch } : t)));
    run(id, 'tasks', () => store.updateTask(id, patch));
  }, [run, store, record, projectName]);

  const removeTask = useCallback((id: string) => {
    const gone = tasksRef.current.find(t => t.id === id);
    if (gone) record(id, gone.title, 'deleted');
    tasksRef.current = tasksRef.current.filter(t => t.id !== id);
    setTasks(ts => ts.filter(t => t.id !== id));
    setComments(cs => { const next = { ...cs }; delete next[id]; return next; });
    run(id, 'tasks', () => store.deleteTask(id));
  }, [run, store, record]);

  const addComment = useCallback((taskId: string, text: string, subId = '') => {
    const c: Comment = { id: crypto.randomUUID(), taskId, subId, text: text.slice(0, 2000), at: Date.now(), by: account?.id ?? '' };
    setComments(cs => ({ ...cs, [taskId]: (cs[taskId] || []).concat(c) }));
    const t = tasksRef.current.find(x => x.id === taskId);
    const sub = subTitleOf(t, subId);
    record(taskId, t?.title ?? '', 'commented', [{ field: 'comment', to: c.text, ...(sub ? { sub } : {}) }]);
    run(c.id, 'comments', () => store.insertComment(c));
  }, [account, run, store, record]);

  const commentsRef = useRef(comments);
  commentsRef.current = comments;
  const removeComment = useCallback((taskId: string, id: string) => {
    const c = (commentsRef.current[taskId] || []).find(x => x.id === id);
    const t = tasksRef.current.find(x => x.id === taskId);
    if (c && t) {
      const sub = subTitleOf(t, c.subId);
      record(taskId, t.title, 'comment_deleted', [{ field: 'comment', from: c.text, ...(sub ? { sub } : {}) }]);
    }
    setComments(cs => ({ ...cs, [taskId]: (cs[taskId] || []).filter(c => c.id !== id) }));
    run(id, 'comments', () => store.deleteComment(id));
  }, [run, store, record]);

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
    await signOutCurrent();
  }, []);

  const names = useMemo(() => (account ? { [account.id]: account.name } : {}), [account]);

  const value: Workspace = {
    mode: store.kind, account, tasks, projects, projectsReady, projectById, comments, names, loaded, conn, readOnly,
    weekStart, setWeekStart, month, setMonth, filter, setFilter,
    addTasks, patchTask, removeTask, addComment, removeComment, addProject, updateProject, removeProject, signOut,
    toast, toastMsg, toastAction, editingId, openEditor: setEditingId, previewId, openPreview: setPreviewId,
    history, historyState, loadHistory, loadTaskHistory, taskHistoryState, historyId, openHistory: setHistoryId,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Month that contains the Thursday of the given week (ISO convention). */
export const monthOfWeek = (mon: Date) => monthStart(addDays(mon, 3));
