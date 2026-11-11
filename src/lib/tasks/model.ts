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

export interface Subtask { id: string; title: string; done: boolean }

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

export interface Comment { id: string; taskId: string; text: string; at: number; by: string }

export const statusName = (id: string) => STATUSES.find(s => s.id === id)?.name ?? id;
export const prioName = (id: string) => PRIORITIES.find(p => p.id === id)?.name ?? 'No priority';

/** Normalises a stored record into a Task, tolerating old or partial data. */
export function cleanTask(id: string, d: Record<string, unknown>, fallbackDay: string): Task {
  const day = isDate(d.day) ? d.day : fallbackDay;
  const subs = Array.isArray(d.subtasks) ? (d.subtasks as Record<string, unknown>[]) : [];
  return {
    id,
    title: typeof d.title === 'string' ? d.title : '',
    description: typeof d.description === 'string' ? d.description : '',
    priority: PRIORITIES.some(p => p.id === d.priority) ? (d.priority as PriorityId) : '',
    subtasks: subs
      .filter(s => s && typeof s.title === 'string' && s.title)
      .map((s, i) => ({ id: typeof s.id === 'string' ? s.id : 's' + i, title: s.title as string, done: !!s.done })),
    project: typeof d.project === 'string' ? d.project : '',
    status: STATUSES.some(s => s.id === d.status) ? (d.status as StatusId) : 'todo',
    day,
    deadline: isDate(d.deadline) ? d.deadline : '',
    createdAt: typeof d.createdAt === 'number' ? d.createdAt : 0,
    position: typeof d.position === 'number' && isFinite(d.position) ? d.position
      : typeof d.createdAt === 'number' ? d.createdAt : 0,
  };
}

/** Order inside one day: the user's manual order. */
export const byPosition = (a: Task, b: Task) => a.position - b.position || a.createdAt - b.createdAt;

/** Position for a task dropped between `before` and `after` (either may be missing). */
export function positionBetween(before: Task | undefined, after: Task | undefined): number {
  if (before && after) return (before.position + after.position) / 2;
  if (before) return before.position + 1024;
  if (after) return after.position - 1024;
  return Date.now();
}

const rank: Record<StatusId, number> = { doing: 0, todo: 1, done: 2, canceled: 3 };
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
  text.split('\n').map(s => s.trim()).filter(Boolean).map(title => ({ id: newSubId(), title: title.slice(0, 300), done: false }));
