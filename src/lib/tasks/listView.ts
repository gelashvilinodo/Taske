import { iso, today, weekEnd } from '@/lib/dates';
import { byPosition, closed, flatSubs, prioRankOf, type Task } from './model';

/** Search, filters and sort of the List page. */
export type PrioFilter = 'all' | 'urgent' | 'high' | 'low' | 'none';
export type DueFilter = 'all' | 'overdue' | 'today' | 'week' | 'any' | 'none';
export type SortKey = 'day' | 'priority' | 'deadline' | 'title' | 'created';
export interface ListOptions { q: string; prio: PrioFilter; due: DueFilter; sort: SortKey; desc: boolean }

export const LIST_DEFAULTS: ListOptions = { q: '', prio: 'all', due: 'all', sort: 'day', desc: false };

export const PRIO_FILTERS: { value: PrioFilter; label: string }[] = [
  { value: 'all', label: 'Any priority' }, { value: 'urgent', label: 'Urgent' }, { value: 'high', label: 'High' },
  { value: 'low', label: 'Low' }, { value: 'none', label: 'No priority' },
];
export const DUE_FILTERS: { value: DueFilter; label: string }[] = [
  { value: 'all', label: 'Any deadline' }, { value: 'overdue', label: 'Overdue' }, { value: 'today', label: 'Due today' },
  { value: 'week', label: 'Due this week' }, { value: 'any', label: 'Has a deadline' }, { value: 'none', label: 'No deadline' },
];
export const SORTS: { value: SortKey; label: string }[] = [
  { value: 'day', label: 'Day' }, { value: 'priority', label: 'Priority' }, { value: 'deadline', label: 'Deadline' },
  { value: 'title', label: 'Title' }, { value: 'created', label: 'Date added' },
];

/** How many of search and the two filters are in use (sort is not a filter). */
export const activeCount = (o: ListOptions) => (o.q.trim() ? 1 : 0) + (o.prio !== 'all' ? 1 : 0) + (o.due !== 'all' ? 1 : 0);

/** Tasks that pass search and filters. `weekStart` is the week on screen ("Due this week"). */
export function filterTasks(tasks: Task[], o: ListOptions, weekStart: Date): Task[] {
  const q = o.q.trim().toLowerCase();
  const td = iso(today());
  const we = iso(weekEnd(weekStart)), ws = iso(weekStart);
  return tasks.filter(t => {
    if (o.prio !== 'all' && (o.prio === 'none' ? t.priority !== '' : t.priority !== o.prio)) return false;
    if (o.due !== 'all') {
      const d = t.deadline;
      if (o.due === 'none' && d) return false;
      if (o.due === 'any' && !d) return false;
      if (o.due === 'today' && d !== td) return false;
      if (o.due === 'week' && !(d && d >= ws && d <= we)) return false;
      if (o.due === 'overdue' && !(d && d < td && !closed(t))) return false;
    }
    if (q) {
      const hay = [t.title, t.description, ...flatSubs(t.subtasks).map(s => s.title)].join('\n').toLowerCase();
      if (!q.split(/\s+/).every(w => hay.includes(w))) return false;
    }
    return true;
  });
}

/** Order inside one status column. Ties fall back to day, then the manual order. */
export function listComparator(o: ListOptions) {
  const base = (a: Task, b: Task) => a.day.localeCompare(b.day) || byPosition(a, b);
  const key = (a: Task, b: Task): number => {
    switch (o.sort) {
      case 'priority': return prioRankOf(a) - prioRankOf(b);
      case 'deadline': return (a.deadline || '9999').localeCompare(b.deadline || '9999');
      case 'title': return a.title.localeCompare(b.title, undefined, { sensitivity: 'base', numeric: true });
      case 'created': return b.createdAt - a.createdAt; // newest first
      default: return 0;
    }
  };
  const dir = o.desc ? -1 : 1;
  return (a: Task, b: Task) => (key(a, b) || base(a, b)) * dir;
}
