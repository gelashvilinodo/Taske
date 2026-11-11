'use client';

import { inWeek, isOverdue } from '@/lib/tasks/model';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { useVisibleTasks } from './Filters';

export default function WeekStats() {
  const { weekStart } = useWorkspace();
  const week = useVisibleTasks().filter(t => inWeek(t, weekStart));
  const count = (s: string) => week.filter(t => t.status === s).length;
  const over = week.filter(isOverdue).length;
  const active = week.length - count('canceled');
  const pct = active ? Math.round(count('done') / active * 100) : 0;
  return (
    <div className="stats">
      <span>To do <b>{count('todo')}</b></span>
      <span>In progress <b>{count('doing')}</b></span>
      <span>Done <b>{count('done')}</b></span>
      {count('canceled') > 0 && <span>Canceled <b>{count('canceled')}</b></span>}
      {over > 0 && <span className="over">Overdue <b>{over}</b></span>}
      <span className="meter" title={pct + '% done'} aria-label={pct + '% done'} role="img"><i style={{ width: pct + '%' }} /></span>
    </div>
  );
}
