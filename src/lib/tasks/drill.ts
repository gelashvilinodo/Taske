import { addDays, DAYS, iso, isDate, MONTHS_S, parse, rangeLabel } from '@/lib/dates';
import { flatSubs, PRIORITIES, statusName, STATUSES, type PriorityId, type StatusId, type Task } from './model';
import { timingOf, type Timing } from './stats';

/**
 * A filter the dashboard hands to the Table page through the URL, so a number or a chart part
 * opens the exact tasks behind it. Every part is optional; the project goes through the shared
 * project filter (`project` in the URL).
 */
export interface Drill {
  /** Planned day range, both ends included (YYYY-MM-DD) */
  from?: string;
  to?: string;
  status?: StatusId[];
  timing?: Timing[];
  /** Priorities; 'none' = no priority */
  prio?: (PriorityId | 'none')[];
  /** Weekday the task was finished on (0 = Monday) */
  wd?: number;
  /** Day the task was finished on */
  fday?: string;
  /** Only tasks that have subtasks */
  subs?: boolean;
  /** Open tasks with a deadline in the next N days */
  due?: number;
}

export const TIMING_NAMES: Record<Timing, string> = {
  on_time: 'Done on time', late: 'Done late', overdue: 'Overdue', open: 'Not due yet', canceled: 'Canceled',
};
const TIMINGS = Object.keys(TIMING_NAMES) as Timing[];
const PRIO_IDS = [...PRIORITIES.map(p => p.id), 'none'] as const;

/**
 * Link to the Table page with this filter. `project` (a project id, 'all' or '__other') sets the
 * project pills too; leave it out to keep whichever project is picked there.
 */
export function drillHref(d: Drill, project?: string): string {
  const q = new URLSearchParams();
  if (d.from) q.set('from', d.from);
  if (d.to) q.set('to', d.to);
  if (d.status?.length) q.set('status', d.status.join(','));
  if (d.timing?.length) q.set('timing', d.timing.join(','));
  if (d.prio?.length) q.set('prio', d.prio.join(','));
  if (d.wd !== undefined) q.set('wd', String(d.wd));
  if (d.fday) q.set('fday', d.fday);
  if (d.subs) q.set('subs', '1');
  if (d.due) q.set('due', String(d.due));
  if (project) q.set('project', project);
  const s = q.toString().replace(/%2C/g, ',');
  return '/table' + (s ? '?' + s : '');
}

const list = <T extends string>(v: string | null, ok: readonly T[]) =>
  v ? v.split(',').filter((x): x is T => (ok as readonly string[]).includes(x)) : undefined;

/** Reads a filter back from the URL; unknown or broken values are dropped. */
export function readDrill(q: URLSearchParams): Drill {
  const d: Drill = {};
  const from = q.get('from'), to = q.get('to'), fday = q.get('fday');
  if (isDate(from)) d.from = from;
  if (isDate(to)) d.to = to;
  const status = list(q.get('status'), STATUSES.map(s => s.id));
  if (status?.length) d.status = status;
  const timing = list(q.get('timing'), TIMINGS);
  if (timing?.length) d.timing = timing;
  const prio = list(q.get('prio'), PRIO_IDS);
  if (prio?.length) d.prio = prio as Drill['prio'];
  const wd = Number(q.get('wd'));
  if (q.get('wd') !== null && Number.isInteger(wd) && wd >= 0 && wd <= 6) d.wd = wd;
  if (isDate(fday)) d.fday = fday;
  if (q.get('subs') === '1') d.subs = true;
  const due = Number(q.get('due'));
  if (Number.isInteger(due) && due > 0 && due <= 366) d.due = due;
  return d;
}

export const isEmptyDrill = (d: Drill) => Object.keys(d).length === 0;
/** Timing, weekday and finish day need finish times from the history log. */
export const drillNeedsHistory = (d: Drill) => !!(d.timing || d.wd !== undefined || d.fday);

/** The day a done task was finished: its history time when known, else its planned day. */
const finishDay = (t: Task, finished: Map<string, number>) => {
  const at = finished.get(t.id);
  return at !== undefined ? new Date(at) : parse(t.day);
};

export function matchesDrill(t: Task, d: Drill, finished: Map<string, number>, todayIso: string): boolean {
  if (d.from && t.day < d.from) return false;
  if (d.to && t.day > d.to) return false;
  if (d.status && !d.status.includes(t.status)) return false;
  if (d.timing && !d.timing.includes(timingOf(t, finished, todayIso))) return false;
  if (d.prio && !d.prio.includes(t.priority || 'none')) return false;
  if (d.subs && !flatSubs(t.subtasks).some(s => s.status !== 'canceled')) return false;
  if (d.wd !== undefined || d.fday) {
    if (t.status !== 'done') return false;
    const f = finishDay(t, finished);
    if (d.wd !== undefined && (f.getDay() + 6) % 7 !== d.wd) return false;
    if (d.fday && iso(f) !== d.fday) return false;
  }
  if (d.due) {
    if (t.status !== 'todo' && t.status !== 'doing') return false;
    if (!t.deadline || t.deadline < todayIso || t.deadline > iso(addDays(parse(todayIso), d.due))) return false;
  }
  return true;
}

export type DrillKey = 'range' | 'status' | 'timing' | 'prio' | 'wd' | 'fday' | 'subs' | 'due';

/** The filter as readable chips; `key` says which part a chip's × removes. */
export function drillChips(d: Drill): { key: DrillKey; label: string }[] {
  const out: { key: DrillKey; label: string }[] = [];
  if (d.from || d.to) {
    const f = d.from ? parse(d.from) : null, t = d.to ? parse(d.to) : null;
    const year = (t ?? f)!.getFullYear();
    out.push({
      key: 'range',
      label: f && t ? (d.from === d.to ? f.getDate() + ' ' + MONTHS_S[f.getMonth()] + ' ' + year : rangeLabel(f, t, MONTHS_S) + ' ' + year)
        : f ? 'From ' + f.getDate() + ' ' + MONTHS_S[f.getMonth()] + ' ' + year
        : 'Until ' + t!.getDate() + ' ' + MONTHS_S[t!.getMonth()] + ' ' + year,
    });
  }
  if (d.status) out.push({ key: 'status', label: d.status.map(statusName).join(' · ') });
  if (d.timing) out.push({ key: 'timing', label: d.timing.map(x => TIMING_NAMES[x]).join(' · ') });
  if (d.prio) out.push({ key: 'prio', label: d.prio.map(p => (p === 'none' ? 'No priority' : PRIORITIES.find(x => x.id === p)!.name)).join(' · ') });
  if (d.wd !== undefined) out.push({ key: 'wd', label: 'Finished on ' + DAYS[d.wd] });
  if (d.fday) { const f = parse(d.fday); out.push({ key: 'fday', label: 'Finished ' + f.getDate() + ' ' + MONTHS_S[f.getMonth()] }); }
  if (d.subs) out.push({ key: 'subs', label: 'With subtasks' });
  if (d.due) out.push({ key: 'due', label: 'Deadline in the next ' + d.due + ' days' });
  return out;
}

/** The filter without one part. */
export function dropDrill(d: Drill, key: DrillKey): Drill {
  const n = { ...d };
  if (key === 'range') { delete n.from; delete n.to; } else delete n[key];
  return n;
}
