'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DAYS, DAYS_S, iso, shortDate, today, weekDays } from '@/lib/dates';
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

  const days = weekDays(weekStart);
  const [shown, setShown] = useState(0); // day in view when the week scrolls sideways (phones: one day at a time)

  const leftOf = (el: HTMLElement, col: HTMLElement) => col.offsetLeft - el.offsetLeft - parseFloat(getComputedStyle(el).paddingLeft || '0');
  const goTo = useCallback((i: number, smooth = true) => {
    const el = board.current;
    const col = el?.children[i] as HTMLElement | undefined;
    if (el && col) el.scrollTo({ left: leftOf(el, col), behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  // When the week scrolls sideways (smaller screens), open on today, or on Monday for other weeks.
  const weekKey = iso(weekStart);
  useEffect(() => {
    const el = board.current;
    if (!el || el.scrollWidth <= el.clientWidth + 1) { setShown(0); return; }
    const i = days.findIndex(d => iso(d) === td);
    goTo(Math.max(0, i), false);
    setShown(Math.max(0, i));
  }, [weekKey]);

  const onScroll = () => {
    const el = board.current;
    if (!el) return;
    let best = 0, dist = Infinity;
    [...el.children].forEach((c, i) => {
      const d = Math.abs(leftOf(el, c as HTMLElement) - el.scrollLeft);
      if (d < dist) { dist = d; best = i; }
    });
    if (best !== shown) setShown(best);
  };

  return (
    <>
    <nav className="week-dots" aria-label="Days">
      {days.map((d, i) => {
        const ds = iso(d);
        const n = all.filter(t => t.day === ds).length;
        return (
          <button key={ds} type="button" onClick={() => goTo(i)} aria-current={i === shown ? 'true' : undefined}
            aria-label={DAYS[i] + ', ' + shortDate(d) + (n ? ', ' + n + (n === 1 ? ' task' : ' tasks') : '')}
            className={'week-dot' + (i === shown ? ' is-active' : '') + (ds === td ? ' is-today' : '') + (n ? ' has-tasks' : '')}>
            <span className="week-dot-label">{DAYS_S[i]} {d.getDate()}</span>
          </button>
        );
      })}
    </nav>
    <main className="week" ref={board} onScroll={onScroll}>
      {days.map((d, i) => {
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
    </>
  );
}
