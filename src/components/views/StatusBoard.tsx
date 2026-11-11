'use client';

import { compareTasks, inWeek, STATUSES } from '@/lib/tasks/model';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { useVisibleTasks } from '@/components/tasks/Filters';
import DropColumn from '@/components/tasks/DropColumn';
import TaskCard from '@/components/tasks/TaskCard';

/** List page: this week's tasks grouped by status. Drop a card on a column to change its status. */
export default function StatusBoard() {
  const { weekStart, loaded, patchTask } = useWorkspace();
  const week = useVisibleTasks().filter(t => inWeek(t, weekStart));
  return (
    <main className="status-board">
      {STATUSES.map(s => {
        const tasks = week.filter(t => t.status === s.id).sort((a, b) => a.day.localeCompare(b.day) || compareTasks(a, b));
        return (
          <DropColumn key={s.id} className="column" label={s.name} onDropTask={id => patchTask(id, { status: s.id })}>
            <header className="col-head"><span className="col-name">{s.name}</span><span className="count">{tasks.length}</span></header>
            <div className="list">
              {tasks.length ? tasks.map(t => <TaskCard key={t.id} t={t} showDay />) : loaded && <p className="empty">Empty</p>}
            </div>
          </DropColumn>
        );
      })}
    </main>
  );
}
