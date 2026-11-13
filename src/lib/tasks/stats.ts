import { addDays, DAYS_S, iso, MONTHS, MONTHS_S, mondayOf, parse, rangeLabel, shortDate } from '@/lib/dates';
import { flatSubs, PRIORITIES, type HistoryEvent, type PriorityId, type StatusId, type Task } from './model';

// ----- Periods -----

export type PeriodUnit = 'week' | 'month' | 'quarter' | 'year' | 'custom';
export const PERIOD_UNITS: { id: PeriodUnit; name: string }[] = [
  { id: 'week', name: 'Week' },
  { id: 'month', name: 'Month' },
  { id: 'quarter', name: 'Quarter' },
  { id: 'year', name: 'Year' },
  { id: 'custom', name: 'Custom' },
];

/** A closed range of days, both ends included. */
export interface Range { from: Date; to: Date }

const DAY_MS = 864e5;
export const daysIn = (r: Range) => Math.round((r.to.getTime() - r.from.getTime()) / DAY_MS) + 1;

/** The period of this unit that holds `d`. */
export function periodOf(unit: Exclude<PeriodUnit, 'custom'>, d: Date): Range {
  const y = d.getFullYear(), m = d.getMonth();
  switch (unit) {
    case 'week': { const from = mondayOf(d); return { from, to: addDays(from, 6) }; }
    case 'month': return { from: new Date(y, m, 1), to: new Date(y, m + 1, 0) };
    case 'quarter': { const q = Math.floor(m / 3) * 3; return { from: new Date(y, q, 1), to: new Date(y, q + 3, 0) }; }
    case 'year': return { from: new Date(y, 0, 1), to: new Date(y, 11, 31) };
  }
}

/** The period `dir` steps before (-1) or after (+1) this one. A custom range moves by its own length. */
export function shiftPeriod(unit: PeriodUnit, r: Range, dir: number): Range {
  const f = r.from;
  switch (unit) {
    case 'week': return periodOf('week', addDays(f, 7 * dir));
    case 'month': return periodOf('month', new Date(f.getFullYear(), f.getMonth() + dir, 1));
    case 'quarter': return periodOf('quarter', new Date(f.getFullYear(), f.getMonth() + 3 * dir, 1));
    case 'year': return periodOf('year', new Date(f.getFullYear() + dir, 0, 1));
    case 'custom': { const n = daysIn(r) * dir; return { from: addDays(r.from, n), to: addDays(r.to, n) }; }
  }
}

/** Title for the period: a small line above and the period itself, in a long and a short form. */
export function periodLabel(unit: PeriodUnit, r: Range) {
  const y = r.from.getFullYear();
  switch (unit) {
    case 'week': return { eyebrow: 'Week · ' + addDays(r.from, 3).getFullYear(), full: rangeLabel(r.from, r.to, MONTHS), short: rangeLabel(r.from, r.to, MONTHS_S) };
    case 'month': return { eyebrow: String(y), full: MONTHS[r.from.getMonth()], short: MONTHS_S[r.from.getMonth()] };
    case 'quarter': {
      const q = Math.floor(r.from.getMonth() / 3);
      return { eyebrow: 'Q' + (q + 1) + ' · ' + y, full: MONTHS[q * 3] + ' – ' + MONTHS[q * 3 + 2], short: MONTHS_S[q * 3] + ' – ' + MONTHS_S[q * 3 + 2] };
    }
    case 'year': return { eyebrow: 'Year', full: String(y), short: String(y) };
    case 'custom': {
      const sameYear = r.from.getFullYear() === r.to.getFullYear();
      return {
        eyebrow: daysIn(r) + (daysIn(r) === 1 ? ' day' : ' days') + (sameYear ? ' · ' + y : ''),
        full: rangeLabel(r.from, r.to, MONTHS) + (sameYear ? '' : ' ' + r.to.getFullYear()),
        short: rangeLabel(r.from, r.to, MONTHS_S),
      };
    }
  }
}

/** What "previous period" means in the comparisons on the cards. */
export const previousName = (unit: PeriodUnit) =>
  unit === 'custom' ? 'before' : 'last ' + unit;

// ----- Buckets for the column chart -----

export interface Bucket { key: string; from: string; to: string; label: string; tip: string; minor: boolean }

/** Days for up to a month and a half, weeks for up to about five months, months beyond that. */
export function bucketsFor(r: Range): Bucket[] {
  const n = daysIn(r);
  const out: Bucket[] = [];
  if (n <= 45) {
    for (let i = 0; i < n; i++) {
      const d = addDays(r.from, i);
      const wd = (d.getDay() + 6) % 7;
      out.push({
        key: iso(d), from: iso(d), to: iso(d),
        label: n <= 7 ? DAYS_S[wd] : String(d.getDate()),
        tip: DAYS_S[wd] + ', ' + shortDate(d),
        // On long ranges only every few labels show, so they never collide.
        minor: n > 14 && !(d.getDate() === 1 || d.getDate() % 5 === 0),
      });
    }
  } else if (n <= 160) {
    let i = 0;
    for (let m = mondayOf(r.from); m <= r.to; m = addDays(m, 7), i++) {
      const s = m < r.from ? r.from : m;
      const e = addDays(m, 6) > r.to ? r.to : addDays(m, 6);
      out.push({ key: iso(m), from: iso(s), to: iso(e), label: shortDate(s), tip: rangeLabel(s, e, MONTHS_S), minor: i % 2 === 1 });
    }
  } else {
    for (let d = new Date(r.from.getFullYear(), r.from.getMonth(), 1); d <= r.to; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
      const s = d < r.from ? r.from : d;
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const e = end > r.to ? r.to : end;
      out.push({ key: iso(d), from: iso(s), to: iso(e), label: MONTHS_S[d.getMonth()], tip: MONTHS[d.getMonth()] + ' ' + d.getFullYear(), minor: false });
    }
  }
  return out;
}

// ----- Numbers -----

/** When each task was last moved to Done, from the history log (newest entries come first). */
export function finishTimes(history: HistoryEvent[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of history) {
    if (out.has(e.taskId)) continue;
    if (e.changes.some(c => c.field === 'status' && c.to === 'done')) out.set(e.taskId, e.at);
  }
  return out;
}

/** The day a task is due: its deadline, or the day it is planned for. */
export const dueOf = (t: Task) => t.deadline || t.day;

export type Timing = 'on_time' | 'late' | 'overdue' | 'open' | 'canceled';
/**
 * How a task stands against its due day. Done tasks are late when they were finished after it
 * (only known when the history log has their finish time); open tasks are overdue once it has passed.
 */
export function timingOf(t: Task, finished: Map<string, number>, todayIso: string): Timing {
  if (t.status === 'canceled') return 'canceled';
  if (t.status === 'done') {
    const at = finished.get(t.id);
    return at !== undefined && iso(new Date(at)) > dueOf(t) ? 'late' : 'on_time';
  }
  return dueOf(t) < todayIso ? 'overdue' : 'open';
}

export interface Stats {
  total: number;
  active: number;
  status: Record<StatusId, number>;
  /** Done ÷ (everything but canceled), 0–100 */
  rate: number;
  onTime: number;
  late: number;
  overdue: number;
  /** Finished on time ÷ (done + overdue), 0–100; null when nothing was due yet */
  onTimeRate: number | null;
  subtasks: { done: number; total: number };
  buckets: { bucket: Bucket; planned: number; done: number; late: number }[];
  projects: { id: string; total: number; done: number; late: number }[];
  priorities: { id: PriorityId; name: string; total: number; done: number }[];
  /** Tasks finished on each weekday, Monday first (by finish time when known, else the planned day) */
  weekdays: number[];
  /** Day with the most tasks finished, or null */
  bestDay: { day: string; done: number } | null;
}

const PRIOS: { id: PriorityId; name: string }[] = [...PRIORITIES, { id: '', name: 'None' }];

/** Every number on the dashboard for the tasks planned inside `r`. */
export function computeStats(all: Task[], r: Range, finished: Map<string, number>, todayIso: string): Stats {
  const from = iso(r.from), to = iso(r.to);
  const tasks = all.filter(t => t.day >= from && t.day <= to);
  const status: Record<StatusId, number> = { todo: 0, doing: 0, done: 0, canceled: 0 };
  let onTime = 0, late = 0, overdue = 0;
  const timing = new Map<string, Timing>();
  for (const t of tasks) {
    status[t.status]++;
    const tm = timingOf(t, finished, todayIso);
    timing.set(t.id, tm);
    if (tm === 'on_time') onTime++;
    else if (tm === 'late') late++;
    else if (tm === 'overdue') overdue++;
  }
  const active = tasks.length - status.canceled;
  const dueSoFar = status.done + overdue;

  const subs = flatSubs(tasks.flatMap(t => t.subtasks)).filter(s => s.status !== 'canceled');

  const buckets = bucketsFor(r).map(bucket => {
    const inB = tasks.filter(t => t.day >= bucket.from && t.day <= bucket.to && t.status !== 'canceled');
    return {
      bucket,
      planned: inB.length,
      done: inB.filter(t => t.status === 'done').length,
      late: inB.filter(t => { const tm = timing.get(t.id); return tm === 'late' || tm === 'overdue'; }).length,
    };
  });

  const byProject = new Map<string, { id: string; total: number; done: number; late: number }>();
  for (const t of tasks) {
    if (t.status === 'canceled') continue;
    const p = byProject.get(t.project) ?? { id: t.project, total: 0, done: 0, late: 0 };
    p.total++;
    if (t.status === 'done') p.done++;
    const tm = timing.get(t.id);
    if (tm === 'late' || tm === 'overdue') p.late++;
    byProject.set(t.project, p);
  }

  const weekdays = [0, 0, 0, 0, 0, 0, 0];
  const perDay = new Map<string, number>();
  for (const t of tasks) {
    if (t.status !== 'done') continue;
    const at = finished.get(t.id);
    const d = at !== undefined ? new Date(at) : parse(t.day);
    weekdays[(d.getDay() + 6) % 7]++;
    const k = iso(d);
    perDay.set(k, (perDay.get(k) ?? 0) + 1);
  }
  let bestDay: Stats['bestDay'] = null;
  perDay.forEach((n, day) => { if (!bestDay || n > bestDay.done) bestDay = { day, done: n }; });

  return {
    total: tasks.length,
    active,
    status,
    rate: active ? Math.round(status.done / active * 100) : 0,
    onTime, late, overdue,
    onTimeRate: dueSoFar ? Math.round(onTime / dueSoFar * 100) : null,
    subtasks: { done: subs.filter(s => s.status === 'done').length, total: subs.length },
    buckets,
    projects: [...byProject.values()].sort((a, b) => b.total - a.total || b.done - a.done),
    priorities: PRIOS.map(p => {
      const list = tasks.filter(t => t.priority === p.id && t.status !== 'canceled');
      return { id: p.id, name: p.name, total: list.length, done: list.filter(t => t.status === 'done').length };
    }),
    weekdays,
    bestDay,
  };
}

/** Open tasks whose due day has passed, oldest first (all periods: this is about now). */
export const overdueNow = (all: Task[], todayIso: string) =>
  all.filter(t => (t.status === 'todo' || t.status === 'doing') && dueOf(t) < todayIso)
    .sort((a, b) => dueOf(a).localeCompare(dueOf(b)));

/** Open tasks with a deadline in the next `days` days, soonest first. */
export const upcomingDeadlines = (all: Task[], todayIso: string, days = 7) => {
  const last = iso(addDays(parse(todayIso), days));
  return all.filter(t => (t.status === 'todo' || t.status === 'doing') && t.deadline && t.deadline >= todayIso && t.deadline <= last)
    .sort((a, b) => a.deadline.localeCompare(b.deadline));
};
