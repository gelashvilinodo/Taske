import { addDays, iso, isDate, parse, snapWeekday, today } from '@/lib/dates';

export const PROJECTS = [
  { id: 'skrib', name: 'Skrib' },
  { id: 'sitbox', name: 'Sitbox' },
  { id: 'modx', name: 'MODX' },
  { id: 'excity', name: 'Ex City' },
  { id: 'other', name: 'Other' },
] as const;
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

export type ProjectId = (typeof PROJECTS)[number]['id'];
export type StatusId = (typeof STATUSES)[number]['id'];
export type PriorityId = (typeof PRIORITIES)[number]['id'] | '';

export interface Subtask { id: string; title: string; done: boolean }

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: PriorityId;
  subtasks: Subtask[];
  project: ProjectId;
  status: StatusId;
  /** YYYY-MM-DD, always a weekday */
  day: string;
  /** YYYY-MM-DD or '' */
  deadline: string;
  createdAt: number;
}
export type TaskFields = Omit<Task, 'id'>;
export type TaskPatch = Partial<TaskFields>;

export interface Comment { id: string; taskId: string; text: string; at: number; by: string }

export const projectName = (id: string) => PROJECTS.find(p => p.id === id)?.name ?? 'Other';
export const statusName = (id: string) => STATUSES.find(s => s.id === id)?.name ?? id;
export const prioName = (id: string) => PRIORITIES.find(p => p.id === id)?.name ?? 'No priority';

/** Normalises a stored record into a Task, tolerating old or partial data. */
export function cleanTask(id: string, d: Record<string, unknown>, fallbackDay: string): Task {
  const day = isDate(d.day) ? iso(snapWeekday(parse(d.day))) : fallbackDay;
  const subs = Array.isArray(d.subtasks) ? (d.subtasks as Record<string, unknown>[]) : [];
  return {
    id,
    title: typeof d.title === 'string' ? d.title : '',
    description: typeof d.description === 'string' ? d.description : '',
    priority: PRIORITIES.some(p => p.id === d.priority) ? (d.priority as PriorityId) : '',
    subtasks: subs
      .filter(s => s && typeof s.title === 'string' && s.title)
      .map((s, i) => ({ id: typeof s.id === 'string' ? s.id : 's' + i, title: s.title as string, done: !!s.done })),
    project: PROJECTS.some(p => p.id === d.project) ? (d.project as ProjectId) : 'other',
    status: STATUSES.some(s => s.id === d.status) ? (d.status as StatusId) : 'todo',
    day,
    deadline: isDate(d.deadline) ? d.deadline : '',
    createdAt: typeof d.createdAt === 'number' ? d.createdAt : 0,
  };
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
export const inWeek = (t: Task, mon: Date) => t.day >= iso(mon) && t.day <= iso(addDays(mon, 4));
export const isOverdue = (t: Task) => !!t.deadline && !closed(t) && t.deadline < iso(today());

let subCounter = 0;
export const newSubId = () => 's' + Date.now().toString(36) + ++subCounter;
export const makeSubs = (text: string): Subtask[] =>
  text.split('\n').map(s => s.trim()).filter(Boolean).map(title => ({ id: newSubId(), title: title.slice(0, 300), done: false }));
