'use client';

import { useRouter } from 'next/navigation';
import { addDays, iso, isoWeek, MONTHS, monthWeeks, planningMonday, rangeLabel } from '@/lib/dates';
import { inWeek, PROJECTS } from '@/lib/tasks/model';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { useVisibleTasks } from '@/components/tasks/Filters';

/** Calendar page (for now): the month as a list of weeks with progress. Click a week to open it on the board. */
export default function MonthOverview() {
  const { month, setWeekStart } = useWorkspace();
  const router = useRouter();
  const all = useVisibleTasks();
  const prefix = iso(month).slice(0, 7);
  const monthTasks = all.filter(t => t.day.startsWith(prefix) && t.status !== 'canceled');
  const nowMon = iso(planningMonday());
  return (
    <main className="month">
      <p className="month-sum" style={{ margin: 0 }}>
        This month: <b>{monthTasks.length}</b>{monthTasks.length === 1 ? ' task, ' : ' tasks, '}
        <b>{monthTasks.filter(t => t.status === 'done').length}</b> done
      </p>
      {monthWeeks(month).map(mon => {
        const tasks = all.filter(t => inWeek(t, mon) && t.status !== 'canceled');
        const done = tasks.filter(t => t.status === 'done').length;
        const pct = tasks.length ? Math.round(done / tasks.length * 100) : 0;
        return (
          <button key={iso(mon)} className={'wk' + (iso(mon) === nowMon ? ' is-now' : '')} type="button"
            onClick={() => { setWeekStart(mon); router.push('/board'); }}>
            <span className="wk-num">Wk {isoWeek(mon)}</span>
            <span className="wk-range">{rangeLabel(mon, addDays(mon, 4), MONTHS)}</span>
            <span className="meta">
              {PROJECTS.map(p => {
                const n = tasks.filter(t => t.project === p.id).length;
                return n ? <span key={p.id} className={'chip p-' + p.id}>{p.name} {n}</span> : null;
              })}
            </span>
            <span className="wk-count">{done}/{tasks.length}</span>
            <span className="meter"><i style={{ width: pct + '%' }} /></span>
          </button>
        );
      })}
    </main>
  );
}
