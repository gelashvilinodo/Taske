'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { addDays, DAYS, DAYS_S, iso, shortDate, today, weekDays } from '@/lib/dates';
import { byPosition, positionBetween } from '@/lib/tasks/model';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { useVisibleTasks } from '@/components/tasks/Filters';
import { requestAddOnDay } from '@/components/tasks/AddTaskForm';
import DropColumn from '@/components/tasks/DropColumn';
import { DRAG_EDGE_EVENT } from '@/components/tasks/TaskDrag';

/** Board page: Monday–Sunday columns. Drop a card on a column to move it to that day. */
export default function WeekBoard() {
  const { weekStart, setWeekStart, loaded, readOnly, patchTask, tasks: allTasks } = useWorkspace();
  const all = useVisibleTasks();
  const td = iso(today());
  const board = useRef<HTMLElement>(null);

  const days = weekDays(weekStart);
  const [shown, setShown] = useState(0); // day in view when the week scrolls sideways (phones: one day at a time)
  const shownRef = useRef(0);
  shownRef.current = shown;
  const weekStartRef = useRef(weekStart);
  weekStartRef.current = weekStart;

  const leftOf = (el: HTMLElement, col: HTMLElement) => col.offsetLeft - el.offsetLeft - parseFloat(getComputedStyle(el).paddingLeft || '0');
  const goTo = useCallback((i: number, smooth = true) => {
    const el = board.current;
    const col = el?.children[i] as HTMLElement | undefined;
    if (el && col) el.scrollTo({ left: leftOf(el, col), behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  // When the week scrolls sideways (below very wide screens), open on today, or on Monday for other weeks.
  const weekKey = iso(weekStart);
  useEffect(() => {
    const el = board.current;
    if (!el || el.scrollWidth <= el.clientWidth + 1) { setShown(0); return; }
    const landing = edgeLanding.current;
    edgeLanding.current = null;
    let i = landing === 'start' ? 0 : landing === 'end' ? days.length - 1 : Math.max(0, days.findIndex(d => iso(d) === td));
    // Several days fit at once (laptops): stay on Monday while today is already in view, so the weekdays lead.
    const col = el.children[i] as HTMLElement | undefined;
    if (!landing && col && leftOf(el, col) + col.offsetWidth <= el.clientWidth) i = 0;
    goTo(i, false);
    setShown(i);
  }, [weekKey]);

  // Drop a card into a day at a given place in its list (or move it within the same day).
  const dropOnDay = (id: string, ds: string, index: number) => {
    const moving = allTasks.find(t => t.id === id);
    if (!moving) return;
    const list = all.filter(t => t.day === ds && t.id !== id).sort(byPosition);
    if (moving.day === ds) {
      const before = all.filter(t => t.day === ds).sort(byPosition);
      if (before.indexOf(moving) === index) return; // dropped where it was
    }
    patchTask(id, { day: ds, position: positionBetween(list[index - 1], list[index]) });
  };

  // Holding a dragged card at a screen edge: next/previous day while the week scrolls sideways,
  // otherwise (or past Sunday/Monday) the next/previous week.
  const edgeLanding = useRef<'start' | 'end' | null>(null);
  useEffect(() => {
    const onEdge = (e: Event) => {
      const dir = (e as CustomEvent<number>).detail;
      const el = board.current;
      const scrolls = !!el && el.scrollWidth > el.clientWidth + 1;
      if (scrolls) {
        const next = shownRef.current + dir;
        if (next >= 0 && next < days.length) { goTo(next); return; }
      }
      edgeLanding.current = scrolls ? (dir > 0 ? 'start' : 'end') : null;
      setWeekStart(addDays(weekStartRef.current, 7 * dir));
    };
    window.addEventListener(DRAG_EDGE_EVENT, onEdge);
    return () => window.removeEventListener(DRAG_EDGE_EVENT, onEdge);
  }, [goTo, days.length, setWeekStart]);

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
        const tasks = all.filter(t => t.day === ds).sort(byPosition);
        return (
          <DropColumn key={ds} zone={'day:' + ds} tasks={tasks}
            className={'column' + (ds === td ? ' is-today' : '') + (i >= 5 ? ' is-weekend' : '')} label={DAYS[i]}
            onDropTask={(id, index) => dropOnDay(id, ds, index)}
            header={
              <header className="col-head">
                <div>
                  <span className="col-name">{DAYS[i]}</span>
                  <span className="col-date">{shortDate(d) + (ds === td ? ' · today' : '')}</span>
                </div>
                {!readOnly && (
                  <button className="col-add" type="button" aria-label={'Add task on ' + DAYS[i]} title="Add to this day" onClick={() => requestAddOnDay(ds)}>+</button>
                )}
              </header>
            }
            empty={loaded && <p className="empty">No tasks</p>}
          />
        );
      })}
    </main>
    </>
  );
}
