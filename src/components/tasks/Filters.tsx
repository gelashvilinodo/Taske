'use client';

import { iso } from '@/lib/dates';
import { inWeek, PROJECTS, type Task } from '@/lib/tasks/model';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';

/** Project filter pills. Counts cover the week, the month, or all tasks depending on the page. */
export default function Filters({ scope }: { scope: 'week' | 'month' | 'all' }) {
  const { tasks, weekStart, month, filter, setFilter } = useWorkspace();
  const inScope: Task[] = scope === 'week'
    ? tasks.filter(t => inWeek(t, weekStart))
    : scope === 'month' ? tasks.filter(t => t.day.startsWith(iso(month).slice(0, 7))) : tasks;
  const items = [{ id: 'all', name: 'All', n: inScope.length }].concat(
    PROJECTS.map(p => ({ id: p.id, name: p.name, n: inScope.filter(t => t.project === p.id).length })),
  );
  return (
    <div className="filters">
      {items.map(i => (
        <button key={i.id} className="filter" type="button" aria-pressed={filter === i.id} onClick={() => setFilter(i.id)}>
          {i.name}<b>{i.n}</b>
        </button>
      ))}
    </div>
  );
}

export function useVisibleTasks() {
  const { tasks, filter } = useWorkspace();
  return filter === 'all' ? tasks : tasks.filter(t => t.project === filter);
}
