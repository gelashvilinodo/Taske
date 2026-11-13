'use client';

import { inWeek, isOverdue } from '@/lib/tasks/model';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { IconAlert, IconDone } from '@/components/shell/icons';
import { useVisibleTasks } from './Filters';

/** List page: one thin line for the week, how much is done and what is overdue (the columns already count the rest). */
export default function ListStats() {
  const { weekStart } = useWorkspace();
  const week = useVisibleTasks().filter(t => inWeek(t, weekStart));
  const done = week.filter(t => t.status === 'done').length;
  const active = week.filter(t => t.status !== 'canceled').length;
  const pct = active ? Math.round(done / active * 100) : 0;
  const over = week.filter(isOverdue).length;
  return (
    <section className="lstats" aria-label="This week">
      <span className="lstats-done"><IconDone size={16} /><b>{pct}%</b><span className="lstats-sub">done · {done} of {active}</span></span>
      <span className="meter" role="img" aria-label={pct + '% done'}><i style={{ width: pct + '%' }} /></span>
      <span className={'lstats-over' + (over ? ' is-alert' : '')}><IconAlert size={16} /><b>{over}</b><span className="lstats-sub">overdue</span></span>
    </section>
  );
}
