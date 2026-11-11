'use client';

import { useEffect, useRef } from 'react';
import { DAYS, iso, shortDate, today, weekDays } from '@/lib/dates';
import { compareTasks } from '@/lib/tasks/model';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { useVisibleTasks } from '@/components/tasks/Filters';
import { requestAddOnDay } from '@/components/tasks/AddTaskForm';
import DropColumn from '@/components/tasks/DropColumn';
import TaskCard from '@/components/tasks/TaskCard';

/** Board page: Monday–Sunday columns. Drop a card on a column to move it to that day. */
export default function WeekBoard() {
  const { weekStart, loaded, readOnly, patchTask } = useWorkspace();
  const all = useVisibleTasks();
  const td = iso(today());
  const board = useRef<HTMLElement>(null);

  // When the week scrolls sideways (smaller screens), bring today's column into view.
  const weekKey = iso(weekStart);
  useEffect(() => {
    const el = board.current;
    if (!el || el.scrollWidth <= el.clientWidth + 1) return;
    const col = el.querySelector<HTMLElement>('.is-today');
    el.scrollTo({ left: col ? col.offsetLeft - el.offsetLeft - parseFloat(getComputedStyle(el).paddingLeft || '0') : 0 });
  }, [weekKey]);

  return (
    <main className="week" ref={board}>
      {weekDays(weekStart).map((d, i) => {
        const ds = iso(d);
        const tasks = all.filter(t => t.day === ds).sort(compareTasks);
        return (
          <DropColumn key={ds} className={'column' + (ds === td ? ' is-today' : '') + (i >= 5 ? ' is-weekend' : '')} label={DAYS[i]} onDropTask={id => patchTask(id, { day: ds })}>
            <header className="col-head">
              <div>
                <span className="col-name">{DAYS[i]}</span>
                <span className="col-date">{shortDate(d) + (ds === td ? ' · today' : '')}</span>
              </div>
              {!readOnly && (
                <button className="col-add" type="button" aria-label={'Add task on ' + DAYS[i]} title="Add to this day" onClick={() => requestAddOnDay(ds)}>+</button>
              )}
            </header>
            <div className="list">
              {tasks.length ? tasks.map(t => <TaskCard key={t.id} t={t} />) : loaded && <p className="empty">No tasks</p>}
            </div>
          </DropColumn>
        );
      })}
    </main>
  );
}
