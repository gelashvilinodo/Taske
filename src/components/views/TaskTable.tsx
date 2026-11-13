'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DAYS_S, iso, parse, shortDate, today, weekday } from '@/lib/dates';
import { drillChips, drillHref, drillNeedsHistory, dropDrill, isEmptyDrill, matchesDrill, readDrill } from '@/lib/tasks/drill';
import { finishTimes } from '@/lib/tasks/stats';
import { closed, compareTasks, prioName, statusName, subProgress, type Project, type Task } from '@/lib/tasks/model';
import { ProjectChip } from '@/components/projects/ProjectBadge';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { useVisibleTasks } from '@/components/tasks/Filters';
import { IconClose, IconFilter, IconSortDown, IconSortUp } from '@/components/shell/icons';

type Col = 'title' | 'project' | 'status' | 'priority' | 'day' | 'deadline';
const COLS: { id: Col; label: string }[] = [
  { id: 'title', label: 'Task' }, { id: 'project', label: 'Project' }, { id: 'status', label: 'Status' },
  { id: 'priority', label: 'Priority' }, { id: 'day', label: 'Day' }, { id: 'deadline', label: 'Deadline' },
];
const prioOrder: Record<string, number> = { urgent: 0, high: 1, low: 2, '': 3 };
const statusOrder: Record<string, number> = { doing: 0, todo: 1, done: 2, canceled: 3 };

function sortValue(t: Task, c: Col, project: (id: string) => Project | undefined): string | number {
  if (c === 'priority') return prioOrder[t.priority];
  if (c === 'status') return statusOrder[t.status];
  if (c === 'deadline') return t.deadline || '9999';
  if (c === 'project') return project(t.project)?.name.toLowerCase() ?? '\uffff';
  return t[c].toLowerCase();
}
const dayLabel = (s: string) => { const d = parse(s); return DAYS_S[weekday(d)] + ', ' + shortDate(d) + ' ' + d.getFullYear(); };

/**
 * Table page: every task in one sortable list. The dashboard opens it with a filter in the URL
 * (period, status, late, priority…), shown as chips above the table; each chip can be removed.
 */
export default function TaskTable() {
  const { loaded, openPreview, projectById, setFilter, history, loadHistory } = useWorkspace();
  const params = useSearchParams();
  const router = useRouter();
  const drill = useMemo(() => readDrill(new URLSearchParams(params.toString())), [params]);
  const chips = drillChips(drill);
  const needsHistory = drillNeedsHistory(drill);
  const finished = useMemo(() => finishTimes(history), [history]);
  const todayIso = iso(today());

  // The project comes in the URL from the dashboard and goes to the shared project pills.
  const project = params.get('project');
  useEffect(() => { if (project) setFilter(project); }, [project, setFilter]);
  useEffect(() => { if (needsHistory) loadHistory(); }, [needsHistory, loadHistory]);

  // Inside <Suspense> the table hydrates a moment after the rest of the page, when the tasks may
  // already be loaded; its first pass matches the server's (no tasks yet), then it fills in.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const all = useVisibleTasks();
  const visible = mounted ? all : [];
  const ready = loaded && mounted;
  const tasks = isEmptyDrill(drill) ? visible : visible.filter(t => matchesDrill(t, drill, finished, todayIso));
  const [sort, setSort] = useState<{ col: Col; dir: 1 | -1 }>({ col: 'day', dir: -1 });
  const rows = [...tasks].sort((a, b) => {
    const x = sortValue(a, sort.col, projectById), y = sortValue(b, sort.col, projectById);
    return (x < y ? -1 : x > y ? 1 : 0) * sort.dir || compareTasks(a, b);
  });
  const toggle = (col: Col) => setSort(s => ({ col, dir: s.col === col ? (s.dir === 1 ? -1 : 1) : 1 }));

  const bar = chips.length > 0 && (
    <div className="drill" role="region" aria-label="Filters from the dashboard">
      <span className="drill-icon"><IconFilter size={16} /></span>
      {ready && <span className="drill-count"><b>{rows.length}</b> {rows.length === 1 ? 'task' : 'tasks'}</span>}
      <ul className="drill-chips">
        {chips.map(c => (
          <li key={c.key}>
            <span>{c.label}</span>
            <button type="button" aria-label={'Remove filter: ' + c.label} onClick={() => router.replace(drillHref(dropDrill(drill, c.key)), { scroll: false })}><IconClose size={12} /></button>
          </li>
        ))}
      </ul>
      <button type="button" className="ghost drill-clear" onClick={() => router.replace('/table', { scroll: false })}>Clear</button>
    </div>
  );

  if (ready && !rows.length) return (<>{bar}<div className="notice">{chips.length ? 'No tasks match these filters.' : 'No tasks yet. Add them on the Board page.'}</div></>);
  return (
    <>
    {bar}
    <div className="table-wrap">
      <table className="tasks-table">
        <thead>
          <tr>
            {COLS.map(c => (
              <th key={c.id} aria-sort={sort.col === c.id ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
                <button type="button" onClick={() => toggle(c.id)}>{c.label}{sort.col === c.id ? (sort.dir === 1 ? <IconSortUp size={13} /> : <IconSortDown size={13} />) : null}</button>
              </th>
            ))}
            <th>Subtasks</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(t => {
            const sp = subProgress(t.subtasks);
            return (
              <tr key={t.id} className={closed(t) ? 'is-closed' : undefined}>
                <td className="t-title">
                  <button className="card-title" type="button" onClick={() => openPreview(t.id)}>{t.title}</button>
                </td>
                <td><ProjectChip project={projectById(t.project)} /></td>
                <td><span className={'status s-' + t.status}>{statusName(t.status)}</span></td>
                {/* data-label and is-empty are for phones, where each row becomes a card */}
                <td className={t.priority ? undefined : 'is-empty'}>{t.priority ? <span className={'prio pr-' + t.priority}>{prioName(t.priority)}</span> : <span className="chip">—</span>}</td>
                <td className="num" data-label="Day">{dayLabel(t.day)}</td>
                <td className={'num' + (t.deadline ? '' : ' is-empty')} data-label="Due">{t.deadline ? dayLabel(t.deadline) : '—'}</td>
                <td className={'num' + (sp.total ? '' : ' is-empty')} data-label="Subtasks">{sp.total ? sp.done + '/' + sp.total : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    </>
  );
}
