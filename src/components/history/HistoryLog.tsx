'use client';

import { useEffect, useMemo, useState } from 'react';
import type { HistoryEvent, HistoryKind } from '@/lib/tasks/model';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { ProjectLogo } from '@/components/projects/ProjectBadge';
import { MenuIcon } from '@/components/tasks/StatusIcon';
import { IconChevronRight, IconHistory } from '@/components/shell/icons';
import { MomentRow, dayKey, dayLabel, historyNotice, toMoments, type Moment } from './HistoryEntry';

const PAGE = 200;
/** What the filter offers. Comments and deleted comments are one choice. */
const KINDS = [
  { id: 'all', name: 'All', kinds: null },
  { id: 'changes', name: 'Changes', kinds: ['updated'] },
  { id: 'comments', name: 'Comments', kinds: ['commented', 'comment_deleted'] },
  { id: 'created', name: 'Created', kinds: ['created'] },
  { id: 'deleted', name: 'Deleted', kinds: ['deleted'] },
] as const satisfies readonly { id: string; name: string; kinds: readonly HistoryKind[] | null }[];
type KindId = (typeof KINDS)[number]['id'];
const matches = (k: KindId, e: HistoryEvent) => {
  const kinds = KINDS.find(x => x.id === k)!.kinds as readonly HistoryKind[] | null;
  return !kinds || kinds.includes(e.kind);
};

/** A day's activity on one task: newest moment first. */
interface TaskDay { taskId: string; title: string; latest: number; moments: Moment[] }
interface Day { key: string; tasks: TaskDay[]; changes: number }

/**
 * The archive. Days, newest first; inside a day, one card per task that changed that day
 * (the most recently touched task on top) with its moments in time order. Clicking a task's
 * name opens its whole history.
 */
export default function HistoryLog() {
  const { history, historyState, loadHistory, openHistory, tasks, projectById } = useWorkspace();
  const [kind, setKind] = useState<KindId>('all');
  const [q, setQ] = useState('');
  const [shown, setShown] = useState(PAGE);
  useEffect(() => { loadHistory(); }, [loadHistory]);
  useEffect(() => { setShown(PAGE); }, [kind, q]);

  const byId = useMemo(() => new Map(tasks.map(t => [t.id, t])), [tasks]);
  // A task's current name is searched too, so a renamed task is found by either name.
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return history.filter(e => matches(kind, e)
      && (!needle || e.taskTitle.toLowerCase().includes(needle) || (byId.get(e.taskId)?.title ?? '').toLowerCase().includes(needle)));
  }, [history, kind, q, byId]);
  const counts = useMemo(() => Object.fromEntries(KINDS.map(k => [k.id, history.filter(e => matches(k.id, e)).length])), [history]);

  const days = useMemo(() => {
    const out: Day[] = [];
    for (const m of toMoments(list.slice(0, shown))) {
      const key = dayKey(m.at);
      let d = out.at(-1);
      if (d?.key !== key) out.push(d = { key, tasks: [], changes: 0 });
      let td = d.tasks.find(x => x.taskId === m.taskId);
      if (!td) d.tasks.push(td = { taskId: m.taskId, title: byId.get(m.taskId)?.title ?? m.taskTitle, latest: m.at, moments: [] });
      td.moments.push(m);
      d.changes += m.events.length;
    }
    return out;
  }, [list, shown, byId]);

  const notice = historyNotice(historyState);
  return (
    <div className="hx-page">
      <div className="hx-toolbar">
        <div className="filters hx-kinds" role="group" aria-label="Show">
          {KINDS.map(k => (
            <button key={k.id} className="filter" type="button" aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>
              {k.name}<b>{counts[k.id]}</b>
            </button>
          ))}
        </div>
        <input className="input hx-search" type="search" placeholder="Search tasks" aria-label="Search by task name"
          value={q} onChange={e => setQ(e.target.value)} />
      </div>

      {notice ?? (list.length === 0 ? (
        <div className="panel notif-empty">
          <IconHistory size={28} />
          <p>{history.length ? 'Nothing matches.' : 'No history yet. From now on every new task, change, comment and delete is recorded here.'}</p>
        </div>
      ) : (
        <>
          {days.map(d => (
            <section key={d.key} className="hx-day" aria-labelledby={'hxd-' + d.key}>
              <h2 id={'hxd-' + d.key} className="hx-day-head">
                <span>{dayLabel(d.key)}</span>
                <small>{d.tasks.length} task{d.tasks.length > 1 ? 's' : ''} · {d.changes} update{d.changes > 1 ? 's' : ''}</small>
              </h2>
              <div className="hx-cards">
                {d.tasks.map(td => {
                  const t = byId.get(td.taskId);
                  const project = t ? projectById(t.project) : undefined;
                  return (
                    <article key={td.taskId} className={'panel hx-card' + (t ? '' : ' is-deleted')}>
                      <button type="button" className="hx-card-head" onClick={() => openHistory(td.taskId)}
                        title="Show this task's whole history">
                        {project ? <ProjectLogo project={project} size="xs" /> : <span className="hx-dot" aria-hidden="true" />}
                        <span className="hx-card-title">{td.title}</span>
                        {t ? <span className={'hx-now s-' + t.status} title="Status now"><MenuIcon id={t.status} /></span>
                          : <span className="hx-gone">Deleted</span>}
                        <IconChevronRight size={16} className="hx-chev" />
                      </button>
                      <ol className="hx-moments">{td.moments.map(m => <MomentRow key={m.id} m={m} />)}</ol>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
          {list.length > shown && (
            <button type="button" className="ghost hx-more-btn" onClick={() => setShown(n => n + PAGE)}>
              Show older ({list.length - shown} left)
            </button>
          )}
        </>
      ))}
    </div>
  );
}
