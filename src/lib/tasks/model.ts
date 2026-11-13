import { iso, isDate, today, weekEnd } from '@/lib/dates';

/** A project the user creates: a name, a colour and an optional logo. */
export interface Project {
  id: string;
  name: string;
  /** #rrggbb */
  color: string;
  /** Small image as a data: URL (resized in the browser), or '' */
  logo: string;
  createdAt: number;
}
export type ProjectFields = Omit<Project, 'id'>;
export type ProjectPatch = Partial<ProjectFields>;

/** Quick colour choices in the project editor; any other colour can be picked too. */
export const PROJECT_COLORS = [
  '#8a4dfa', '#c04de0', '#e0479e', '#ef4f5f', '#f0803c', '#e8b030',
  '#4fbf6a', '#1fb5a0', '#2fa6e0', '#4a6cf0', '#8a8594', '#3b3850',
];
export const PROJECT_NAME_MAX = 60;
const HEX = /^#[0-9a-f]{6}$/i;

export function cleanProject(id: string, d: Record<string, unknown>): Project {
  return {
    id,
    name: typeof d.name === 'string' ? d.name.slice(0, PROJECT_NAME_MAX) : '',
    color: typeof d.color === 'string' && HEX.test(d.color) ? d.color.toLowerCase() : PROJECT_COLORS[0],
    logo: typeof d.logo === 'string' && d.logo.startsWith('data:image/') ? d.logo : '',
    createdAt: typeof d.createdAt === 'number' ? d.createdAt : 0,
  };
}
export const STATUSES = [
  { id: 'todo', name: 'To do' },
  { id: 'doing', name: 'In progress' },
  { id: 'done', name: 'Done' },
  { id: 'canceled', name: 'Canceled' },
] as const;
export const PRIORITIES = [
  { id: 'urgent', name: 'Urgent' },
  { id: 'high', name: 'High' },
  { id: 'low', name: 'Low' },
] as const;

export type StatusId = (typeof STATUSES)[number]['id'];
export type PriorityId = (typeof PRIORITIES)[number]['id'] | '';

/**
 * A subtask has the same four statuses and priorities as a task. Older data stored only `done: boolean`.
 * Subtasks nest without limit: each one can hold its own subtasks.
 */
export interface Subtask { id: string; title: string; status: StatusId; priority: PriorityId; subtasks: Subtask[] }

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: PriorityId;
  subtasks: Subtask[];
  /** Project id, or '' for no project */
  project: string;
  status: StatusId;
  /** YYYY-MM-DD, any day of the week */
  day: string;
  /** YYYY-MM-DD or '' */
  deadline: string;
  createdAt: number;
  /** Manual order within the day (lower first). Tasks never reordered use their creation time. */
  position: number;
}
/** Fields for a new task; position is optional and defaults to the creation time. */
export type TaskFields = Omit<Task, 'id' | 'position'> & { position?: number };
export type TaskPatch = Partial<TaskFields>;

/** A comment on a task, or on one of its subtasks (`subId`, at any depth; '' = the task itself). */
export interface Comment { id: string; taskId: string; subId: string; text: string; at: number; by: string }

export const statusName = (id: string) => STATUSES.find(s => s.id === id)?.name ?? id;
export const prioName = (id: string) => PRIORITIES.find(p => p.id === id)?.name ?? 'No priority';

/** Normalises a stored record into a Task, tolerating old or partial data. */
export function cleanTask(id: string, d: Record<string, unknown>, fallbackDay: string): Task {
  const day = isDate(d.day) ? d.day : fallbackDay;
  return {
    id,
    title: typeof d.title === 'string' ? d.title : '',
    description: typeof d.description === 'string' ? d.description : '',
    priority: PRIORITIES.some(p => p.id === d.priority) ? (d.priority as PriorityId) : '',
    subtasks: cleanSubs(d.subtasks, 's'),
    project: typeof d.project === 'string' ? d.project : '',
    status: STATUSES.some(s => s.id === d.status) ? (d.status as StatusId) : 'todo',
    day,
    deadline: isDate(d.deadline) ? d.deadline : '',
    createdAt: typeof d.createdAt === 'number' ? d.createdAt : 0,
    position: typeof d.position === 'number' && isFinite(d.position) ? d.position
      : typeof d.createdAt === 'number' ? d.createdAt : 0,
  };
}

/** Normalises stored subtasks (and their subtasks, at any depth). */
function cleanSubs(raw: unknown, prefix: string, depth = 0): Subtask[] {
  if (!Array.isArray(raw) || depth > 64) return [];
  return (raw as Record<string, unknown>[])
    .filter(s => s && typeof s.title === 'string' && s.title)
    .map((s, i) => {
      const id = typeof s.id === 'string' ? s.id : prefix + i;
      return {
        id,
        title: s.title as string,
        status: STATUSES.some(x => x.id === s.status) ? (s.status as StatusId) : s.done ? 'done' : 'todo',
        priority: PRIORITIES.some(p => p.id === s.priority) ? (s.priority as PriorityId) : '',
        subtasks: cleanSubs(s.subtasks, id + '.', depth + 1),
      };
    });
}

/** Order inside one day: the user's manual order. */
export const byPosition = (a: Task, b: Task) => a.position - b.position || a.createdAt - b.createdAt;
/** Rank of a priority: urgent 0, high 1, low 2, none 3. */
export const prioRankOf = (t: Task) => prioRank[t.priority] ?? 3;
/** Group of a card inside a day: open tasks by priority (0–3), then done and canceled ones by priority (4–7). */
export const dayGroupOf = (t: Task) => (closed(t) ? 4 : 0) + prioRankOf(t);
/**
 * Order inside a day column: open tasks first (urgent, high, low, no priority), then done and canceled ones
 * at the bottom in the same priority order. Within one group the user's manual order holds, so a new task
 * lands below the others with its flag.
 */
export const byDayOrder = (a: Task, b: Task) => dayGroupOf(a) - dayGroupOf(b) || byPosition(a, b);

/** Position for a task dropped between `before` and `after` (either may be missing). */
export function positionBetween(before: Task | undefined, after: Task | undefined): number {
  if (before && after) return (before.position + after.position) / 2;
  if (before) return before.position + 1024;
  if (after) return after.position - 1024;
  return Date.now();
}

const rank: Record<StatusId, number> = { doing: 0, todo: 1, done: 2, canceled: 3 };
/** Done or canceled: the subtask is finished and is drawn struck through. */
export const subClosed = (s: Subtask) => s.status === 'done' || s.status === 'canceled';
/**
 * Subtasks grouped by status colour (in progress, to do, done, canceled) and, inside each group,
 * by priority so what to do first is on top (urgent, high, low, none). Otherwise the stored order stays.
 */
export const sortSubs = (subs: Subtask[]) => subs.map((s, i) => [s, i] as const)
  .sort((a, b) => rank[a[0].status] - rank[b[0].status] || prioRank[a[0].priority] - prioRank[b[0].priority] || a[1] - b[1])
  .map(([s]) => s);
/** Progress for the meter: canceled subtasks don't count towards the total. */
export function subProgress(subs: Subtask[]) {
  const live = subs.filter(s => s.status !== 'canceled');
  return { done: live.filter(s => s.status === 'done').length, total: live.length };
}
/** Ticking the round checkbox: open → done, finished → back to to do. */
export const toggledSub = (s: Subtask): Subtask => ({ ...s, status: subClosed(s) ? 'todo' : 'done' });
/**
 * Patch for a task whose subtasks changed. If the task is Done or Canceled and one of its subtasks
 * is moved to To do or In progress, the task itself goes back to In progress.
 * Canceling (or finishing) a subtask leaves the task's status alone.
 */
export function subtasksPatch(t: Task, subtasks: Subtask[]): { subtasks: Subtask[]; status?: StatusId } {
  if (!closed(t)) return { subtasks };
  const before = new Map(flatSubs(t.subtasks).map(s => [s.id, s]));
  const reopened = flatSubs(subtasks).some(s => {
    const old = before.get(s.id);
    return !!old && old.status !== s.status && !subClosed(s);
  });
  return reopened ? { subtasks, status: 'doing' } : { subtasks };
}
/** Subtasks still open (To do, In progress) become Canceled; finished ones stay Done. */
export const cancelOpenSubs = (subs: Subtask[]): Subtask[] =>
  subs.map(s => ({ ...s, status: subClosed(s) ? s.status : 'canceled' as StatusId, subtasks: cancelOpenSubs(s.subtasks) }));

/** Every subtask at every depth, parents before their children. */
export const flatSubs = (subs: Subtask[]): Subtask[] => subs.flatMap(s => [s, ...flatSubs(s.subtasks)]);
/** The subtask with this id and the subtasks above it, outermost first; null when it is gone. */
export function subChain(subs: Subtask[], id: string): Subtask[] | null {
  for (const s of subs) {
    if (s.id === id) return [s];
    const below = subChain(s.subtasks, id);
    if (below) return [s, ...below];
  }
  return null;
}
/** Replaces the subtask with this id (at any depth) by `fn(subtask)`. */
export const mapSub = (subs: Subtask[], id: string, fn: (s: Subtask) => Subtask): Subtask[] =>
  subs.map(s => (s.id === id ? fn(s) : s.subtasks.length ? { ...s, subtasks: mapSub(s.subtasks, id, fn) } : s));
/** Removes the subtask with this id, and everything under it. */
export const removeSub = (subs: Subtask[], id: string): Subtask[] =>
  subs.filter(s => s.id !== id).map(s => (s.subtasks.length ? { ...s, subtasks: removeSub(s.subtasks, id) } : s));
/** Adds new subtasks under the subtask with this id ('' = at the top level). */
export const addSubsUnder = (subs: Subtask[], id: string, added: Subtask[]): Subtask[] =>
  id ? mapSub(subs, id, s => ({ ...s, subtasks: s.subtasks.concat(added) })) : subs.concat(added);
/**
 * Moves one subtask to a new status. Opening it again (To do, In progress) reopens the finished
 * subtasks above it, so a parent is never Done while something under it is still open.
 * Canceling it cancels what is still open under it, like canceling a task does.
 */
export function setSubStatus(subs: Subtask[], id: string, status: StatusId): Subtask[] {
  const chain = subChain(subs, id);
  if (!chain) return subs;
  let next = mapSub(subs, id, s => ({ ...s, status, subtasks: status === 'canceled' ? cancelOpenSubs(s.subtasks) : s.subtasks }));
  if (status === 'todo' || status === 'doing') {
    for (const above of chain.slice(0, -1)) {
      if (subClosed(above)) next = mapSub(next, above.id, s => ({ ...s, status: 'doing' }));
    }
  }
  return next;
}
/** Patch for moving a task to a new status. Canceling a task cancels its open subtasks too. */
export const statusPatch = (t: Task, status: StatusId): { status: StatusId; subtasks?: Subtask[] } =>
  status === 'canceled' && t.subtasks.some(s => !subClosed(s)) ? { status, subtasks: cancelOpenSubs(t.subtasks) } : { status };
const prioRank: Record<string, number> = { urgent: 0, high: 1, low: 2, '': 3 };
export const closed = (t: Task) => t.status === 'done' || t.status === 'canceled';
export function compareTasks(a: Task, b: Task) {
  return rank[a.status] - rank[b.status]
    || prioRank[a.priority] - prioRank[b.priority]
    || (a.deadline || '9999').localeCompare(b.deadline || '9999')
    || a.createdAt - b.createdAt;
}
export const inWeek = (t: Task, mon: Date) => t.day >= iso(mon) && t.day <= iso(weekEnd(mon));
export const isOverdue = (t: Task) => !!t.deadline && !closed(t) && t.deadline < iso(today());

let subCounter = 0;
export const newSubId = () => 's' + Date.now().toString(36) + ++subCounter;
export const makeSubs = (text: string): Subtask[] =>
  text.split('\n').map(s => s.trim()).filter(Boolean).map(title => ({ id: newSubId(), title: title.slice(0, 300), status: 'todo' as StatusId, priority: '' as PriorityId, subtasks: [] }));

// ----- History: who changed what and when -----

/** One field that changed. For subtask changes `sub` is the subtask's name. Values are already readable text. */
export interface HistoryChange {
  field: 'title' | 'description' | 'priority' | 'status' | 'project' | 'day' | 'deadline'
    | 'sub_added' | 'sub_removed' | 'sub_title' | 'sub_status' | 'sub_priority' | 'comment';
  from?: string;
  to?: string;
  sub?: string;
}
export type HistoryKind = 'created' | 'updated' | 'deleted' | 'commented' | 'comment_deleted';
/** One entry in a task's history. The task's name is kept, so the history stays readable after the task is deleted. */
export interface HistoryEvent {
  id: string;
  taskId: string;
  taskTitle: string;
  kind: HistoryKind;
  changes: HistoryChange[];
  at: number;
  /** User id ('' in local mode) and the name shown for them at the time */
  by: string;
  byName: string;
}
export const HISTORY_KINDS: { id: HistoryKind; name: string }[] = [
  { id: 'created', name: 'Created' },
  { id: 'updated', name: 'Changed' },
  { id: 'commented', name: 'Commented' },
  { id: 'comment_deleted', name: 'Comment deleted' },
  { id: 'deleted', name: 'Deleted' },
];

const HISTORY_TEXT_MAX = 2000;
const clip = (s: string) => s.slice(0, HISTORY_TEXT_MAX);

/** Every subtask with the id of the subtask it sits under ('' at the top). */
function subIndex(subs: Subtask[], parent = '', out = new Map<string, { s: Subtask; parent: string }>()) {
  subs.forEach(s => { out.set(s.id, { s, parent }); subIndex(s.subtasks, s.id, out); });
  return out;
}

/**
 * What a patch changes on a task, as history lines. Fields that stay the same and the card's
 * position are left out. `projectName` turns a project id into the name shown at the time.
 */
export function diffTask(before: Task, patch: TaskPatch, projectName: (id: string) => string): HistoryChange[] {
  const out: HistoryChange[] = [];
  const plain = (field: 'title' | 'description' | 'day' | 'deadline') => {
    const to = patch[field];
    if (to !== undefined && to !== before[field]) out.push({ field, from: clip(before[field]), to: clip(to) });
  };
  plain('title');
  if (patch.status !== undefined && patch.status !== before.status) out.push({ field: 'status', from: before.status, to: patch.status });
  if (patch.priority !== undefined && patch.priority !== before.priority) out.push({ field: 'priority', from: before.priority, to: patch.priority });
  if (patch.project !== undefined && patch.project !== before.project)
    out.push({ field: 'project', from: projectName(before.project), to: projectName(patch.project) });
  plain('day');
  plain('deadline');
  plain('description');
  if (patch.subtasks) {
    const was = subIndex(before.subtasks);
    const now = subIndex(patch.subtasks);
    // A removed or added branch is one line: its children are not listed again.
    was.forEach(({ s, parent }, id) => { if (!now.has(id) && !(parent && !now.has(parent))) out.push({ field: 'sub_removed', sub: s.title }); });
    now.forEach(({ s, parent }, id) => {
      const old = was.get(id)?.s;
      if (!old) { if (!(parent && !was.has(parent))) out.push({ field: 'sub_added', sub: s.title }); return; }
      if (old.title !== s.title) out.push({ field: 'sub_title', sub: s.title, from: old.title, to: s.title });
      if (old.status !== s.status) out.push({ field: 'sub_status', sub: s.title, from: old.status, to: s.status });
      if (old.priority !== s.priority) out.push({ field: 'sub_priority', sub: s.title, from: old.priority, to: s.priority });
    });
  }
  return out;
}
/** The subtask's name for a comment's subId ('' when the comment is on the task itself). */
export const subTitleOf = (t: Task | undefined, subId: string) => (t && subId ? subChain(t.subtasks, subId)?.at(-1)?.title ?? '' : '');
