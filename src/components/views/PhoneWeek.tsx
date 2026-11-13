'use client';

import { useEffect, useLayoutEffect, useRef, useState, type TouchEvent } from 'react';
import { addDays, DAYS, DAYS_S, iso, parse, shortDate, today, weekDays } from '@/lib/dates';
import { byDayOrder } from '@/lib/tasks/model';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { useVisibleTasks } from '@/components/tasks/Filters';
import { requestAddOnDay } from '@/components/tasks/addTaskEvents';
import DropColumn from '@/components/tasks/DropColumn';
import { DRAG_EDGE_EVENT, useDropZone } from '@/components/tasks/TaskDrag';
import { IconPlus } from '@/components/shell/icons';
import { useDayDrop } from './useDayDrop';

const SWIPE_MIN = 60;

/** A day button in the pinned row. A card held and dragged onto it moves to that day. */
function DayTab({ d, n, active, isToday, onPick, onDropTask }: {
  d: Date; n: number; active: boolean; isToday: boolean; onPick: () => void; onDropTask: (id: string) => void;
}) {
  const { readOnly } = useWorkspace();
  const ds = iso(d);
  const { over } = useDropZone('dtab:' + ds, id => onDropTask(id), !readOnly && !active);
  return (
    <button type="button" role="tab" aria-selected={active} data-drop={readOnly || active ? undefined : 'dtab:' + ds}
      aria-label={DAYS[(d.getDay() + 6) % 7] + ', ' + shortDate(d) + (isToday ? ', today' : '') + (n ? ', ' + n + (n === 1 ? ' task' : ' tasks') : '')}
      className={'dtab' + (isToday ? ' is-today' : '') + (over ? ' is-over' : '')} onClick={onPick}>
      <span className="dtab-name">{DAYS_S[(d.getDay() + 6) % 7]}</span>
      <span className="dtab-date">{d.getDate()}</span>
      <span className="dtab-n">{n || ''}</span>
    </button>
  );
}

/**
 * Board on a phone: one day at a time under a row of day buttons that stays pinned to the top while
 * the page scrolls. Tap a day, or swipe sideways outside the cards, to change day; the new day slides
 * in from the side it came from. Cards swipe (right: done, left: next day), a tap on a card's free
 * space opens it, and a press-and-hold lifts it to drop on a day button. The week itself changes with the week switcher above.
 */
export default function PhoneWeek() {
  const { weekStart, setWeekStart, loaded, readOnly } = useWorkspace();
  const all = useVisibleTasks();
  const { fitOnDay, dropOnDay } = useDayDrop(all);
  const td = iso(today());
  const days = weekDays(weekStart);
  const root = useRef<HTMLDivElement>(null); // the day panel; hidden (0 wide) on wide screens

  const [sel, setSel] = useState(() => (days.some(d => iso(d) === td) ? td : iso(weekStart)));
  const [dir, setDir] = useState<'next' | 'prev' | ''>('');
  const nextDay = useRef<string | null>(null); // the day to open when we changed the week ourselves
  const selRef = useRef(sel);
  selRef.current = sel;

  const pick = (ds: string) => {
    if (ds === selRef.current) return;
    setDir(ds > selRef.current ? 'next' : 'prev');
    setSel(ds);
  };

  // A new week opens on today (or Monday), unless we moved there to reach a given day.
  const weekKey = iso(weekStart);
  useLayoutEffect(() => {
    const list = weekDays(weekStart).map(iso);
    if (list.includes(selRef.current)) return;
    const want = nextDay.current && list.includes(nextDay.current) ? nextDay.current : list.includes(td) ? td : list[0];
    nextDay.current = null;
    setDir(want > selRef.current ? 'next' : 'prev');
    setSel(want);
  }, [weekKey]); // eslint-disable-line react-hooks/exhaustive-deps

  /** One day back or forward, into the neighbouring week when needed. */
  const step = (by: -1 | 1) => {
    const to = iso(addDays(parse(selRef.current), by));
    if (days.some(d => iso(d) === to)) { pick(to); return; }
    nextDay.current = to;
    setWeekStart(addDays(weekStart, 7 * by));
  };
  const stepRef = useRef(step);
  stepRef.current = step;

  // Holding a dragged card at a screen edge steps to the previous/next day.
  useEffect(() => {
    const onEdge = (e: Event) => {
      if (!root.current?.offsetWidth) return; // wide screens: the week strip handles it
      stepRef.current((e as CustomEvent<number>).detail as -1 | 1);
    };
    window.addEventListener(DRAG_EDGE_EVENT, onEdge);
    return () => window.removeEventListener(DRAG_EDGE_EVENT, onEdge);
  }, []);

  // A sideways swipe that starts outside a card changes day (on a card it is the card's own swipe).
  const start = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: TouchEvent) => {
    const el = e.target as HTMLElement;
    start.current = el.closest('.card, .swipe-row, input, button') ? null : { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: TouchEvent) => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const dx = e.changedTouches[0].clientX - s.x, dy = e.changedTouches[0].clientY - s.y;
    if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    step(dx < 0 ? 1 : -1);
  };

  const selDate = days.find(d => iso(d) === sel) ?? weekStart;
  const wd = (selDate.getDay() + 6) % 7;
  const tasks = all.filter(t => t.day === sel).sort(byDayOrder);
  const selIndex = Math.max(0, days.findIndex(d => iso(d) === sel));

  // The thumb slides (and squishes a little) to the picked day, as in the tab bar. `moves` restarts the squish.
  const [moves, setMoves] = useState(0);
  const lastPick = useRef({ week: weekKey, i: selIndex });
  useLayoutEffect(() => {
    const last = lastPick.current;
    if (last.week === weekKey && last.i !== selIndex) setMoves(m => m + 1);
    lastPick.current = { week: weekKey, i: selIndex };
  }, [weekKey, selIndex]);

  // A new week: the old row of days slides out while the new one slides in from the side it came from.
  const shownWeek = useRef({ key: weekKey, start: weekStart, i: selIndex });
  const [leaving, setLeaving] = useState<{ key: string; start: Date; i: number; dir: 'next' | 'prev' } | null>(null);
  useLayoutEffect(() => {
    const prev = shownWeek.current;
    if (prev.key !== weekKey) setLeaving({ ...prev, dir: weekKey > prev.key ? 'next' : 'prev' });
    shownWeek.current = { key: weekKey, start: weekStart, i: selIndex };
  }, [weekKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => { shownWeek.current.i = selIndex; }, [selIndex]);

  const thumb = (i: number, animated: boolean) => (
    <span className={'dtab-thumb' + (animated ? ' is-animated' : '')} aria-hidden="true"
      style={{ transform: 'translateX(calc(' + i + ' * (100% + 2px)))' }}>
      <span className="seg-thumb-core" key={moves} />
    </span>
  );

  return (
    <>
      <div className="dtabs" role="tablist" aria-label="Days">
        {leaving && (
          <div key={'out' + leaving.key} className={'dtabs-row is-out is-' + leaving.dir} aria-hidden="true" onAnimationEnd={() => setLeaving(null)}>
            {thumb(leaving.i, false)}
            {weekDays(leaving.start).map((d, i) => {
              const ds = iso(d);
              const n = all.filter(t => t.day === ds).length;
              return (
                <span key={ds} className={'dtab' + (ds === td ? ' is-today' : '') + (i === leaving.i ? ' is-on' : '')}>
                  <span className="dtab-name">{DAYS_S[i]}</span><span className="dtab-date">{d.getDate()}</span><span className="dtab-n">{n || ''}</span>
                </span>
              );
            })}
          </div>
        )}
        <div key={weekKey} className={'dtabs-row' + (leaving ? ' is-in is-' + leaving.dir : '')}>
          {thumb(selIndex, moves > 0)}
          {days.map(d => {
            const ds = iso(d);
            return (
              <DayTab key={ds} d={d} n={all.filter(t => t.day === ds).length} active={ds === sel} isToday={ds === td}
                onPick={() => pick(ds)} onDropTask={id => dropOnDay(id, ds, Infinity)} />
            );
          })}
        </div>
      </div>
      <div ref={root} className={'pday-wrap' + (dir ? ' slide-' + dir : '')} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <DropColumn key={sel} zone={'pday:' + sel} tasks={tasks} swipe tapOpen label={DAYS[wd] + ', ' + shortDate(selDate)}
          className={'pday' + (sel === td ? ' is-today' : '')}
          onDropTask={(id, index) => dropOnDay(id, sel, index)}
          fitIndex={(id, index) => fitOnDay(id, sel, index)}
          header={readOnly ? null : (
            <div className="pday-add">
              <button className="col-add" type="button" aria-label={'Add task on ' + DAYS[wd] + ', ' + shortDate(selDate)} title="Add to this day" onClick={() => requestAddOnDay(sel)}><IconPlus size={18} /></button>
            </div>
          )}
          empty={loaded && <p className="empty">No tasks</p>}
        />
      </div>
    </>
  );
}
