'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { addDays, DAYS, DAYS_S, iso, mondayOf, MONTHS_S, rangeLabel, shortDate, today, weekDays, weekEnd, weekday } from '@/lib/dates';
import { byDayOrder, dayGroupOf, positionBetween } from '@/lib/tasks/model';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { useVisibleTasks } from '@/components/tasks/Filters';
import { requestAddOnDay } from '@/components/tasks/AddTaskForm';
import DropColumn from '@/components/tasks/DropColumn';
import { DRAG_EDGE_EVENT, useTaskDrag } from '@/components/tasks/TaskDrag';
import { IconPlus } from '@/components/shell/icons';

/**
 * Board page: Monday–Sunday columns. Drop a card on a column to move it to that day.
 * While a card is dragged, holding it at a screen edge slides the days one at a time. Past Sunday
 * (or Monday) the neighbouring week joins the strip, with a divider between the weeks, so the days
 * keep sliding instead of the whole week being swapped. On drop the strip folds back to one week.
 */
export default function WeekBoard() {
  const { weekStart, setWeekStart, loaded, readOnly, patchTask, tasks: allTasks } = useWorkspace();
  const { drag } = useTaskDrag();
  const all = useVisibleTasks();
  const td = iso(today());
  const board = useRef<HTMLElement>(null);

  // Extra weeks shown before/after the current one (only while dragging between weeks).
  const [extra, setExtra] = useState({ before: 0, after: 0 });
  const stripStart = addDays(weekStart, -7 * extra.before);
  const days = Array.from({ length: 7 * (extra.before + 1 + extra.after) }, (_, i) => addDays(stripStart, i));
  const daysRef = useRef(days);
  daysRef.current = days;
  const extraRef = useRef(extra);
  extraRef.current = extra;
  const strip = extra.before + extra.after > 0;

  const [shown, setShown] = useState(0); // first day in view when the days scroll sideways
  const shownRef = useRef(0);
  shownRef.current = shown;
  const weekStartRef = useRef(weekStart);
  weekStartRef.current = weekStart;

  /** The day panels (the board also holds header cells and the shared task scroller). */
  const cols = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>(':scope > .column')];
  const padL = (el: HTMLElement) => parseFloat(getComputedStyle(el).paddingLeft || '0');
  const leftOf = (el: HTMLElement, col: HTMLElement) => col.offsetLeft - el.offsetLeft - padL(el);
  const goTo = useCallback((i: number, smooth = true) => {
    const el = board.current;
    const col = el ? cols(el)[i] : undefined;
    if (el && col) el.scrollTo({ left: leftOf(el, col), behavior: smooth ? 'smooth' : 'auto' });
  }, []);
  /** How many whole days fit in view at once. */
  const fits = (el: HTMLElement) => {
    const col = cols(el)[0];
    if (!col) return 1;
    const cs = getComputedStyle(el);
    const gap = parseFloat(cs.columnGap || '0') || 0;
    const inner = el.clientWidth - padL(el) - parseFloat(cs.paddingRight || '0');
    return Math.max(1, Math.floor((inner + gap) / (col.offsetWidth + gap) + 0.02));
  };

  // A week change we made ourselves while sliding: keep the strip and the scroll where they are.
  const ownWeek = useRef<string | null>(null);

  // The days of the previous render, so a week change knows which day was in view.
  const lastDays = useRef<Date[] | null>(null);
  // A slide to another week started by the week switcher (not by a drag) is under way.
  const navSlide = useRef(0);
  const navSliding = useRef(false);

  // On a new week, open on today, or on Monday for other weeks. Coming from a nearby week the days
  // slide there: the old and new weeks join one strip, it scrolls across, then folds back to one week.
  const weekKey = iso(weekStart);
  useLayoutEffect(() => {
    if (ownWeek.current === weekKey) { ownWeek.current = null; return; }
    ownWeek.current = null;
    const token = ++navSlide.current;
    navSliding.current = false;
    const el = board.current;
    if (el) el.style.scrollSnapType = '';
    let i = Math.max(0, weekDays(weekStart).findIndex(d => iso(d) === td));
    // Several days fit at once (laptops): stay on Monday while today is already in view, so the weekdays lead.
    if (el && i < fits(el)) i = 0;
    const target = iso(addDays(weekStart, i));

    const seen = lastDays.current?.[shownRef.current];
    const weeks = seen ? Math.round((weekStart.getTime() - mondayOf(seen).getTime()) / (7 * 864e5)) : 0;
    const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (el && seen && weeks && Math.abs(weeks) <= 3 && !drag && !still) {
      navSliding.current = true;
      // Snapping off while sliding: otherwise the browser re-snaps to the new week's Monday the
      // moment the strip forms, and the slide is skipped.
      el.style.scrollSnapType = 'none';
      const next = weeks > 0 ? { before: weeks, after: 0 } : { before: 0, after: -weeks };
      anchor.current = { day: iso(seen) };
      extraRef.current = next;
      setExtra(next);
      requestAnimationFrame(() => {
        if (navSlide.current !== token) return;
        const list = daysRef.current;
        if (anchor.current) { anchor.current = null; goTo(list.findIndex(d => iso(d) === iso(seen)), false); }
        goTo(list.findIndex(d => iso(d) === target));
        let t = 0;
        const fold = () => {
          clearTimeout(t);
          el.removeEventListener('scrollend', fold);
          if (navSlide.current !== token) return;
          navSliding.current = false;
          el.style.scrollSnapType = '';
          anchor.current = { day: target };
          extraRef.current = { before: 0, after: 0 };
          setExtra({ before: 0, after: 0 });
        };
        el.addEventListener('scrollend', fold);
        t = window.setTimeout(fold, 1100); // browsers without `scrollend`
      });
      return;
    }

    setExtra(x => (x.before || x.after ? { before: 0, after: 0 } : x));
    if (!el || el.scrollWidth <= el.clientWidth + 1) { setShown(0); return; }
    goTo(i, false);
    setShown(i);
  }, [weekKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => { lastDays.current = daysRef.current; });

  // The strip grew or shrank at its start: keep the same day in view, then slide on if asked to.
  const anchor = useRef<{ day: string; then?: string } | null>(null);
  const stripKey = iso(stripStart) + '/' + days.length;
  useLayoutEffect(() => {
    const a = anchor.current;
    if (!a) return;
    const at = daysRef.current.findIndex(d => iso(d) === a.day);
    // Not in the strip yet (a week change renders once before its strip forms): wait for it.
    if (at < 0) return;
    anchor.current = null;
    goTo(at, false);
    setShown(at);
    if (a.then) {
      const to = daysRef.current.findIndex(d => iso(d) === a.then);
      if (to >= 0) requestAnimationFrame(() => goTo(to));
    }
  }, [stripKey, goTo]);

  // Drop a card into a day at a given place in its list (or move it within the same day).
  const droppedOn = useRef<string | null>(null); // day of the last drop, so the board settles on its week
  const dropOnDay = (id: string, ds: string, index: number) => {
    droppedOn.current = ds;
    const moving = allTasks.find(t => t.id === id);
    if (!moving) return;
    const list = all.filter(t => t.day === ds && t.id !== id).sort(byDayOrder);
    if (moving.day === ds) {
      const before = all.filter(t => t.day === ds).sort(byDayOrder);
      if (before.indexOf(moving) === index) return; // dropped where it was
    }
    // Days are grouped (open before done/canceled, then by priority), so a card can only be reordered among
    // cards in its own group. A drop outside its group lands at the nearest end of that group.
    const r = dayGroupOf(moving);
    const start = list.filter(t => dayGroupOf(t) < r).length;
    const end = start + list.filter(t => dayGroupOf(t) === r).length;
    const at = Math.min(Math.max(index, start), end);
    const prev = at > start ? list[at - 1] : undefined;
    const next = at < end ? list[at] : undefined;
    patchTask(id, { day: ds, position: prev || next ? positionBetween(prev, next) : moving.position });
  };

  // Holding a dragged card at a screen edge slides the days one at a time. At the end of the strip
  // the next (or previous) week joins it first.
  useEffect(() => {
    const onEdge = (e: Event) => {
      const dir = (e as CustomEvent<number>).detail as -1 | 1;
      const el = board.current;
      if (!el) return;
      const list = daysRef.current;
      const cur = shownRef.current;
      const to = cur + dir;
      const needAfter = dir > 0 && to + fits(el) > list.length;
      const needBefore = dir < 0 && to < 0;
      if (!needAfter && !needBefore) { goTo(to); return; }
      if (extraRef.current.before + extraRef.current.after >= 6) return; // keep the strip a sane length
      const target = addDays(list[cur], dir);
      anchor.current = { day: iso(list[cur]), then: iso(target) };
      const x = extraRef.current;
      const next = needAfter ? { ...x, after: x.after + 1 } : { ...x, before: x.before + 1 };
      extraRef.current = next;
      setExtra(next);
    };
    window.addEventListener(DRAG_EDGE_EVENT, onEdge);
    return () => window.removeEventListener(DRAG_EDGE_EVENT, onEdge);
  }, [goTo]);

  // While sliding across weeks, the week whose day sits mid-view becomes the current week
  // (the header and the stats follow along).
  const followWeek = (first: number) => {
    const el = board.current;
    if (!el || !extraRef.current.before && !extraRef.current.after) return;
    const list = daysRef.current;
    const mid = list[Math.min(list.length - 1, first + Math.floor((fits(el) - 1) / 2))];
    const monday = mondayOf(mid);
    const diff = Math.round((monday.getTime() - weekStartRef.current.getTime()) / (7 * 864e5));
    if (!diff) return;
    // Update the refs right away: several scroll events can arrive before the next render.
    const next = { before: extraRef.current.before + diff, after: extraRef.current.after - diff };
    if (next.after < 0 || next.before < 0) return;
    extraRef.current = next;
    weekStartRef.current = monday;
    ownWeek.current = iso(monday);
    setExtra(next);
    setWeekStart(monday);
  };

  // After the drop, fold the strip back to one week: the week the card landed in (or, when the drag
  // was cancelled, the current one), keeping the same days in view.
  const dragging = !!drag;
  useEffect(() => {
    if (dragging) return;
    const dropped = droppedOn.current;
    droppedOn.current = null;
    if (!strip || navSliding.current) return; // a week-switcher slide folds the strip itself
    const el = board.current;
    if (!el) return;
    const list = daysRef.current;
    const dropDay = dropped ? list.find(d => iso(d) === dropped) : undefined;
    const monday = dropDay ? mondayOf(dropDay) : weekStartRef.current;
    const first = list.findIndex(d => iso(d) === iso(monday));
    const span = fits(el);
    const cur = shownRef.current;
    const fit = Math.min(Math.max(cur, first), first + Math.max(0, 7 - span));
    const fold = () => {
      anchor.current = { day: iso(daysRef.current[fit] ?? monday) };
      setExtra({ before: 0, after: 0 });
      if (iso(monday) !== iso(weekStartRef.current)) { ownWeek.current = iso(monday); setWeekStart(monday); }
    };
    if (fit === cur) { fold(); return; }
    goTo(fit);
    const t = setTimeout(fold, 420);
    return () => clearTimeout(t);
  }, [dragging, strip, goTo, setWeekStart]);

  const onScroll = () => {
    const el = board.current;
    if (!el) return;
    let best = 0, dist = Infinity;
    cols(el).forEach((c, i) => {
      const d = Math.abs(leftOf(el, c as HTMLElement) - el.scrollLeft);
      if (d < dist) { dist = d; best = i; }
    });
    if (best !== shown) setShown(best);
    if (dragging) followWeek(best);
  };

  const shownDay = days[shown] ? iso(days[shown]) : '';

  return (
    <>
    <nav className="week-dots" aria-label="Days">
      {weekDays(weekStart).map((d, i) => {
        const ds = iso(d);
        const n = all.filter(t => t.day === ds).length;
        const at = days.findIndex(x => iso(x) === ds);
        const on = ds === shownDay;
        return (
          <button key={ds} type="button" onClick={() => goTo(at)} aria-current={on ? 'true' : undefined}
            aria-label={DAYS[i] + ', ' + shortDate(d) + (n ? ', ' + n + (n === 1 ? ' task' : ' tasks') : '')}
            className={'week-dot' + (on ? ' is-active' : '') + (ds === td ? ' is-today' : '') + (n ? ' has-tasks' : '')}>
            <span className="week-dot-label">{DAYS_S[i]} {d.getDate()}</span>
          </button>
        );
      })}
    </nav>
    <main className={'week' + (strip ? ' is-strip' : '')} ref={board} onScroll={onScroll}>
      {/* Each day is a panel spanning the board's height, with its name on top. The tasks of all
          days sit in one row laid over the panels below the names; the whole board scrolls
          with the page. */}
      {days.map((d, i) => {
        const ds = iso(d);
        const wd = weekday(d);
        const breakHere = wd === 0 && i > 0;
        return (
          <div key={'p' + ds} style={{ gridColumn: i + 1, gridRow: '1 / 3' }} aria-hidden="true"
            data-drop={readOnly ? undefined : 'day:' + ds}
            data-week={breakHere ? rangeLabel(d, weekEnd(d), MONTHS_S) : undefined}
            className={'column' + (ds === td ? ' is-today' : '') + (wd >= 5 ? ' is-weekend' : '') + (breakHere ? ' week-break' : '') + (drag?.zone === 'day:' + ds ? ' is-over' : '')} />
        );
      })}
      {days.map((d, i) => {
        const ds = iso(d);
        const wd = weekday(d);
        return (
          <div key={'h' + ds} className="day-head" style={{ gridColumn: i + 1, gridRow: 1 }} data-drop={readOnly ? undefined : 'day:' + ds}>
            <header className="col-head">
              <div>
                <span className="col-name">{DAYS[wd]}</span>
                <span className="col-date">{shortDate(d) + (ds === td ? ' · today' : '')}</span>
              </div>
              {!readOnly && (
                <button className="col-add" type="button" aria-label={'Add task on ' + DAYS[wd]} title="Add to this day" onClick={() => requestAddOnDay(ds)}><IconPlus size={16} /></button>
              )}
            </header>
          </div>
        );
      })}
      <div className="week-scroll" style={{ gridColumn: '1 / span ' + days.length, gridRow: 2 }}>
        {days.map((d, i) => {
          const ds = iso(d);
          const wd = weekday(d);
          const tasks = all.filter(t => t.day === ds).sort(byDayOrder);
          return (
            <DropColumn key={ds} zone={'day:' + ds} tasks={tasks} style={{ gridColumn: i + 1 }}
              className="day-tasks" label={DAYS[wd] + ', ' + shortDate(d)}
              onDropTask={(id, index) => dropOnDay(id, ds, index)}
              header={null}
              empty={loaded && <p className="empty">No tasks</p>}
            />
          );
        })}
      </div>
    </main>
    </>
  );
}
