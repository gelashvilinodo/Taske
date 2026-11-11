'use client';

import { byPosition, inWeek, STATUSES } from '@/lib/tasks/model';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { useVisibleTasks } from '@/components/tasks/Filters';
import DropColumn from '@/components/tasks/DropColumn';

/** List page: this week's tasks grouped by status. Drop a card on a column to change its status. */
export default function StatusBoard() {
  const { weekStart, loaded, patchTask } = useWorkspace();
  const week = useVisibleTasks().filter(t => inWeek(t, weekStart));
  return (
    <main className="status-board">
      {STATUSES.map(s => {
        const tasks = week.filter(t => t.status === s.id).sort((a, b) => a.day.localeCompare(b.day) || byPosition(a, b));
        return (
          <DropColumn key={s.id} zone={'status:' + s.id} tasks={tasks} showDay className="column" label={s.name}
            onDropTask={id => { if (tasks.every(t => t.id !== id)) patchTask(id, { status: s.id }); }}
            header={<header className="col-head"><span className="col-name">{s.name}</span><span className="count">{tasks.length}</span></header>}
            empty={loaded && <p className="empty">Empty</p>}
          />
        );
      })}
    </main>
  );
}
