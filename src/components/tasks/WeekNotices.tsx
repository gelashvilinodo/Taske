'use client';

import { addDays, iso, planningMonday, today } from '@/lib/dates';
import { closed, inWeek } from '@/lib/tasks/model';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';

/** Status line (loading, empty week, connection) and the "carry unfinished tasks" prompt. */
export default function WeekNotices() {
  const { tasks, loaded, conn, readOnly, weekStart, patchTask } = useWorkspace();

  let msg = '';
  if (conn === 'bad') msg = 'Connection lost. Reload the page to see the latest changes.';
  else if (!loaded) msg = 'Loading tasks.';
  else if (!tasks.some(t => inWeek(t, weekStart))) {
    msg = readOnly ? 'No tasks this week yet.' : 'No tasks this week yet. Add the first one above, or paste a list with one task per line.';
  }

  const monIso = iso(weekStart);
  const showCarry = !readOnly && monIso === iso(planningMonday());
  const left = showCarry ? tasks.filter(t => !closed(t) && t.day < monIso) : [];
  const td = iso(today());
  const target = td >= monIso && td <= iso(addDays(weekStart, 4)) ? td : monIso;

  return (
    <>
      {msg && <div className="notice">{msg}</div>}
      {left.length > 0 && (
        <div className="notice warn">
          <span>{left.length + (left.length === 1 ? ' unfinished task' : ' unfinished tasks')} left from earlier weeks.</span>
          <button className="ghost" type="button" onClick={() => left.forEach(t => patchTask(t.id, { day: target }))}>Move to this week</button>
        </div>
      )}
    </>
  );
}
