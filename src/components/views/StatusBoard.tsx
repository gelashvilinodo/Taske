'use client';

import { useState } from 'react';
import { byPosition, inWeek, statusPatch, STATUSES } from '@/lib/tasks/model';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { useVisibleTasks } from '@/components/tasks/Filters';
import DropColumn from '@/components/tasks/DropColumn';
import SubtaskGate, { hasOpenSubs } from '@/components/tasks/SubtaskGate';

/** List page: this week's tasks grouped by status. Drop a card on a column to change its status. */
export default function StatusBoard() {
  const { weekStart, loaded, patchTask, tasks: all } = useWorkspace();
  const [gateId, setGateId] = useState<string | null>(null); // task dropped on Done with open subtasks
  const gated = all.find(t => t.id === gateId);
  const week = useVisibleTasks().filter(t => inWeek(t, weekStart));
  return (
    <main className="status-board">
      {STATUSES.map(s => {
        const tasks = week.filter(t => t.status === s.id).sort((a, b) => a.day.localeCompare(b.day) || byPosition(a, b));
        return (
          <DropColumn key={s.id} zone={'status:' + s.id} tasks={tasks} showDay className="column" label={s.name}
            onDropTask={id => {
              if (tasks.some(t => t.id === id)) return;
              const t = all.find(x => x.id === id);
              if (s.id === 'done' && t && hasOpenSubs(t.subtasks)) { setGateId(id); return; }
              patchTask(id, t ? statusPatch(t, s.id) : { status: s.id });
            }}
            header={<header className="col-head"><span className="col-name">{s.name}</span><span className="count">{tasks.length}</span></header>}
            empty={loaded && <p className="empty">Empty</p>}
          />
        );
      })}
      {gated && (
        <SubtaskGate subtasks={gated.subtasks} onCancel={() => setGateId(null)}
          onConfirm={subtasks => { setGateId(null); patchTask(gated.id, { status: 'done', subtasks }); }} />
      )}
    </main>
  );
}
