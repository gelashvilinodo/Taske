'use client';

import type { ReactNode } from 'react';
import { DAYS, DAYS_S, addDays, isDate, iso, parse, shortDate, today, weekday } from '@/lib/dates';
import { prioName, statusName, type HistoryChange, type HistoryEvent } from '@/lib/tasks/model';
import {
  IconAlert, IconCalendar, IconComment, IconDescription, IconEdit, IconFlag, IconFolder, IconPlus, IconSubtasks, IconTrash,
} from '@/components/shell/icons';
import { MenuIcon } from '@/components/tasks/StatusIcon';

/** "17:52" */
export const clock = (ms: number) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
/** "Fri 13 Nov, 17:52", with the year when it is not this year. */
export function historyTime(ms: number) {
  const d = new Date(ms);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }), hour: '2-digit', minute: '2-digit' });
}
/** "Today", "Yesterday" or "Wednesday, 11 Nov" for a YYYY-MM-DD key. */
export function dayLabel(key: string) {
  const t = today();
  if (key === iso(t)) return 'Today';
  if (key === iso(addDays(t, -1))) return 'Yesterday';
  const d = parse(key);
  return `${DAYS[weekday(d)]}, ${shortDate(d)}${d.getFullYear() !== t.getFullYear() ? ' ' + d.getFullYear() : ''}`;
}
export const dayKey = (ms: number) => iso(new Date(ms));

/**
 * One moment in a task's life: what one person did to it in one go. Edits by the same person
 * on the same task within a few minutes are one moment, so a burst of clicks reads as one change.
 */
export interface Moment { id: string; taskId: string; taskTitle: string; at: number; byName: string; events: HistoryEvent[] }
const BURST_MS = 5 * 60 * 1000;
/** Groups a newest-first list of entries into moments (still newest first). */
export function toMoments(events: HistoryEvent[]): Moment[] {
  const out: Moment[] = [];
  for (const e of events) {
    const last = out.at(-1);
    if (last && last.taskId === e.taskId && last.byName === e.byName && last.events.at(-1)!.at - e.at <= BURST_MS
      && dayKey(last.at) === dayKey(e.at)) last.events.push(e);
    else out.push({ id: e.id, taskId: e.taskId, taskTitle: e.taskTitle, at: e.at, byName: e.byName, events: [e] });
  }
  return out;
}

const Status = ({ id }: { id: string }) => <span className={'hx-pill s-' + id}><MenuIcon id={id} />{statusName(id)}</span>;
const Prio = ({ id }: { id: string }) => <span className={'hx-pill p-' + (id || 'none')}><MenuIcon id={id} />{id ? prioName(id) : 'No priority'}</span>;
const day = (s?: string) => (s && isDate(s) ? `${DAYS_S[weekday(parse(s))]}, ${shortDate(parse(s))}` : '');
const Q = ({ children }: { children: ReactNode }) => <q className="hx-q">{children}</q>;
const None = ({ children = 'None' }: { children?: ReactNode }) => <i className="hx-none">{children}</i>;

/** Old value struck through, arrow, new value. */
function FromTo({ from, to, show }: { from?: string; to?: string; show: (v: string) => ReactNode }) {
  return (
    <span className="hx-ft">
      {from !== undefined && <><span className="hx-from">{show(from)}</span><span className="hx-arrow" aria-label="changed to">→</span></>}
      {to !== undefined && <span className="hx-to">{show(to)}</span>}
    </span>
  );
}

type Line = { key: string; icon: ReactNode; tone?: string; label: ReactNode; body?: ReactNode };

/** Every entry of a moment as readable lines: an icon, a short label and the before → after. */
function linesOf(e: HistoryEvent): Line[] {
  const k = e.id;
  if (e.kind === 'created') {
    const by = (f: HistoryChange['field']) => e.changes.find(c => c.field === f)?.to ?? '';
    const subs = e.changes.filter(c => c.field === 'sub_added').length;
    const facts = [
      by('status') && <Status key="s" id={by('status')} />,
      by('priority') && <Prio key="p" id={by('priority')} />,
      by('project') && <span key="pj" className="hx-pill"><IconFolder size={12} />{by('project')}</span>,
      by('day') && <span key="d" className="hx-pill"><IconCalendar size={12} />{day(by('day'))}</span>,
      by('deadline') && <span key="dl" className="hx-pill"><IconAlert size={12} />Due {day(by('deadline'))}</span>,
      subs > 0 && <span key="st" className="hx-pill"><IconSubtasks size={12} />{subs} subtask{subs > 1 ? 's' : ''}</span>,
    ].filter(Boolean);
    return [{ key: k, icon: <IconPlus size={14} />, tone: 'add', label: 'Created the task', body: facts.length ? <span className="hx-facts">{facts}</span> : undefined }];
  }
  if (e.kind === 'deleted') return [{ key: k, icon: <IconTrash size={14} />, tone: 'bad', label: 'Deleted the task' }];
  if (e.kind === 'commented' || e.kind === 'comment_deleted') {
    const c = e.changes[0] ?? { field: 'comment' };
    const gone = e.kind === 'comment_deleted';
    return [{
      key: k, icon: <IconComment size={14} />, tone: gone ? 'bad' : 'ok',
      label: <>{gone ? 'Deleted a comment' : 'Commented'}{c.sub && <> on <Q>{c.sub}</Q></>}</>,
      body: <span className={'hx-bubble' + (gone ? ' is-gone' : '')}>{c.to ?? c.from}</span>,
    }];
  }
  const text = (v: string) => (v ? <Q>{v}</Q> : <None />);
  return e.changes.map((c, i): Line => {
    const key = k + i;
    switch (c.field) {
      case 'title': return { key, icon: <IconEdit size={14} />, label: 'Renamed', body: <FromTo from={c.from} to={c.to} show={text} /> };
      case 'status': return { key, icon: <MenuIcon id={c.to ?? ''} />, label: 'Status', body: <FromTo from={c.from} to={c.to} show={v => <Status id={v} />} /> };
      case 'priority': return { key, icon: <IconFlag size={14} />, label: 'Priority', body: <FromTo from={c.from} to={c.to} show={v => <Prio id={v} />} /> };
      case 'project': return { key, icon: <IconFolder size={14} />, label: 'Project', body: <FromTo from={c.from} to={c.to} show={v => (v ? <b className="hx-val">{v}</b> : <None>No project</None>)} /> };
      case 'day': return { key, icon: <IconCalendar size={14} />, label: 'Moved', body: <FromTo from={c.from} to={c.to} show={v => <b className="hx-val">{day(v) || '—'}</b>} /> };
      case 'deadline': return { key, icon: <IconAlert size={14} />, label: 'Deadline', body: <FromTo from={c.from} to={c.to} show={v => (v ? <b className="hx-val">{day(v)}</b> : <None />)} /> };
      case 'description': return {
        key, icon: <IconDescription size={14} />, label: !c.from ? 'Added a description' : !c.to ? 'Removed the description' : 'Edited the description',
        body: (
          <details className="hx-desc">
            <summary>Show text</summary>
            {c.from ? <div className="hx-desc-box is-old"><small>Before</small>{c.from}</div> : null}
            {c.to ? <div className="hx-desc-box"><small>After</small>{c.to}</div> : null}
          </details>
        ),
      };
      case 'sub_added': return { key, icon: <IconSubtasks size={14} />, tone: 'add', label: 'Added subtask', body: <Q>{c.sub}</Q> };
      case 'sub_removed': return { key, icon: <IconSubtasks size={14} />, tone: 'bad', label: 'Deleted subtask', body: <s><Q>{c.sub}</Q></s> };
      case 'sub_title': return { key, icon: <IconSubtasks size={14} />, label: 'Renamed subtask', body: <FromTo from={c.from} to={c.to} show={text} /> };
      case 'sub_status': return { key, icon: <MenuIcon id={c.to ?? ''} />, label: <>Subtask <Q>{c.sub}</Q></>, body: <FromTo from={c.from} to={c.to} show={v => <Status id={v} />} /> };
      case 'sub_priority': return { key, icon: <IconFlag size={14} />, label: <>Subtask <Q>{c.sub}</Q></>, body: <FromTo from={c.from} to={c.to} show={v => <Prio id={v} />} /> };
      default: return { key, icon: <IconEdit size={14} />, label: 'Changed' };
    }
  });
}

/** One moment: time and who on the left, then each change on its own line. */
export function MomentRow({ m }: { m: Moment }) {
  // Inside one moment, in the order it happened.
  const lines = [...m.events].reverse().flatMap(linesOf);
  return (
    <li className="hx-moment">
      <div className="hx-when">
        <time dateTime={new Date(m.at).toISOString()} title={historyTime(m.at)}>{clock(m.at)}</time>
        <span className="hx-by">{m.byName || 'Someone'}</span>
      </div>
      <ul className="hx-lines">
        {lines.map(l => (
          <li key={l.key} className={'hx-line' + (l.tone ? ' t-' + l.tone : '')}>
            <span className="hx-ic" aria-hidden="true">{l.icon}</span>
            <span className="hx-what">
              <span className="hx-label">{l.label}</span>
              {l.body}
            </span>
          </li>
        ))}
      </ul>
    </li>
  );
}

/** Message for a history that can't be shown; null when it can. */
export function historyNotice(state: string): ReactNode {
  if (state === 'missing') return <div className="notice warn">History is not set up in the database yet. Run the task_history migration in Supabase to start recording it.</div>;
  if (state === 'bad') return <div className="notice warn">Could not load the history. Check your connection and try again.</div>;
  if (state !== 'ready') return <div className="notice">Loading history.</div>;
  return null;
}
