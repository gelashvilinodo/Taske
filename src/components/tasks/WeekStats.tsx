'use client';

import { inWeek, isOverdue } from '@/lib/tasks/model';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { IconAlert, IconDoing, IconDone, IconTodo } from '@/components/shell/icons';
import { useVisibleTasks } from './Filters';

/** Four glass stat cards for the week on screen: to do, in progress, done, overdue. */
export default function WeekStats() {
  const { weekStart } = useWorkspace();
  const week = useVisibleTasks().filter(t => inWeek(t, weekStart));
  const count = (s: string) => week.filter(t => t.status === s).length;
  const over = week.filter(isOverdue).length;
  const active = week.length - count('canceled');
  const pct = active ? Math.round(count('done') / active * 100) : 0;
  const cards = [
    { key: 'todo', label: 'To do', value: count('todo'), Icon: IconTodo },
    { key: 'doing', label: 'In progress', value: count('doing'), Icon: IconDoing },
    { key: 'done', label: pct + '% of the week done', value: count('done'), Icon: IconDone, meter: pct },
    { key: 'over', label: 'Overdue', value: over, Icon: IconAlert },
  ];
  return (
    <section className="stats" aria-label="This week">
      {cards.map(c => (
        <div key={c.key} className={'stat stat-' + c.key + (c.key === 'over' && c.value > 0 ? ' is-alert' : '')}>
          <span className="stat-icon"><c.Icon /></span>
          <b className="stat-value">{c.value}</b>
          <span className="stat-label">{c.key === 'done' ? <>Done<span className="stat-extra"> · {c.label}</span></> : c.label}</span>
          {c.meter !== undefined && <span className="meter" role="img" aria-label={c.meter + '% done'}><i style={{ width: c.meter + '%' }} /></span>}
        </div>
      ))}
    </section>
  );
}
