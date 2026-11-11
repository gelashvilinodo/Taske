'use client';

import { useRouter } from 'next/navigation';
import { iso, isoWeek, MONTHS, monthWeeks, planningMonday, rangeLabel, weekEnd } from '@/lib/dates';
import { inWeek } from '@/lib/tasks/model';
import { ProjectChip } from '@/components/projects/ProjectBadge';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { useVisibleTasks } from '@/components/tasks/Filters';

/** Calendar page (for now): the month as a list of weeks with progress. Click a week to open it on the board. */
export default function MonthOverview() {
  const { month, setWeekStart, projects } = useWorkspace();
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
            <span className="wk-range">{rangeLabel(mon, weekEnd(mon), MONTHS)}</span>
            <span className="meta">
              {projects.map(p => {
                const n = tasks.filter(t => t.project === p.id).length;
                return n ? <ProjectChip key={p.id} project={p} suffix={n} /> : null;
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
