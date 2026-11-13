'use client';

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { holdSync } from '@/lib/syncHold';
import TaskCard from './TaskCard';

/**
 * Moving task cards, with a mouse or a finger.
 * - Mouse: press and move a few pixels.
 * - Touch: press and hold (~0.35 s), then move. A quick swipe still scrolls the page.
 * A lifted copy of the card follows the pointer. While it moves nothing else on the page moves: the
 * card's own spot turns into a still purple placeholder and a thin line marks where it will land.
 * Only on release does anything animate: a gap opens at the new spot, the copy glides into it and
 * the placeholder folds shut (or, when nothing moves, the copy glides back to its placeholder).
 * Drop zones (day or status columns) mark themselves with data-drop and register a handler.
 * Holding the card at the left/right screen edge sends a "drag-edge" event (the board turns
 * that into previous/next day or week).
 *
 * Speed: nothing about the task changes until the drop. While the pointer moves, the ghost is
 * moved straight in the DOM once per frame; React state (and so the board) only updates when the
 * drop spot itself changes (another day, another place in the list, a screen edge).
 */

export const DRAG_EDGE_EVENT = 'taske:drag-edge';
const HOLD_MS = 350;
const TOUCH_SLOP = 10;   // finger movement that means "scroll", not "hold"
const MOUSE_SLOP = 5;    // mouse movement that starts a drag
const EDGE_PX = 44;
const EDGE_FIRST_MS = 550;
const EDGE_REPEAT_MS = 950;
const SCROLL_ZONE = 90;  // auto-scroll the page near the top/bottom
const EDGE_PAD = 24;     // room kept above/below a drop spot scrolled into view
const LAND_MS = 240;     // the drop: gap opening, ghost gliding in, placeholder folding (keep in step with app.css)

/** The page backdrop's drifting colour blobs (CSS transitions on --bN*, see BackdropDrift). While a
 *  card is dragged they hold still: every frame they move, all the glass on screen has to be blurred again. */
const blobMotion = (run: boolean) => {
  for (const a of document.getAnimations()) {
    if (!(a as CSSTransition).transitionProperty?.startsWith('--b')) continue;
    if (run) a.play(); else a.pause();
  }
};

type Handler = (id: string, index: number) => void;
/** Where in a zone the card can really go: turns the spot under the pointer into the index it would land at. */
type Fit = (id: string, index: number) => number;
interface Zone { drop: Handler; fit?: Fit }
export interface DragState {
  id: string;
  x: number; y: number;          // pointer
  offX: number; offY: number;    // grab point inside the card
  w: number; h: number;          // card size
  zone: string | null;           // data-drop key under the pointer
  index: number;                 // insert position in that zone
  edge: -1 | 0 | 1;              // pointer at a screen edge
  edgeSteps: number;             // edge steps taken during this hold
  landing?: boolean;             // released: the ghost is gliding into the gap
  moves?: boolean;               // set on release: the drop changes where the task is
  homeZone: string | null;       // where the card was picked up from
  homeIndex: number;
  inWeek: boolean;               // picked up from the week board, whose cards have their own layout
}

/** The drag state, for components that pick out only what they show (see useDragSelect). */
interface DragStore { get: () => DragState | null; sub: (fn: () => void) => () => void }
interface Ctx {
  store: DragStore;
  begin: (e: RPointerEvent<HTMLElement>, id: string) => void;
  register: (zone: string, z: Zone) => () => void;
}
const DragCtx = createContext<Ctx | null>(null);
/** What each card needs: which task is lifted (changes only at pick-up and drop). */
interface SourceCtx { dragId: string | null; leaving: boolean; begin: Ctx['begin'] }
const DragSourceCtx = createContext<SourceCtx | null>(null);

/** Fields the UI renders from; the pointer position (x, y) is not one of them. */
const SHOWN: (keyof DragState)[] = ['id', 'zone', 'index', 'edge', 'edgeSteps', 'landing', 'moves', 'w', 'h'];

function useTaskDrag() {
  const v = useContext(DragCtx);
  if (!v) throw new Error('useTaskDrag must be used inside TaskDragProvider');
  return v;
}

/**
 * A value picked out of the drag state; the component re-renders only when that value changes. Return a
 * string, number or boolean. The board, each column and the edge hints each pick their own small part,
 * so moving the drop line between two cards re-renders that one column, not the whole board.
 */
export function useDragSelect<T extends string | number | boolean | null>(select: (d: DragState | null) => T): T {
  const { store } = useTaskDrag();
  const pick = useRef(select);
  pick.current = select;
  const [v, setV] = useState(() => select(store.get()));
  // Updates arrive in the same batch as the drag change itself, so everything renders in one pass.
  useLayoutEffect(() => {
    const on = () => setV(pick.current(store.get()));
    on();
    return store.sub(on);
  }, [store]);
  return v;
}

/** For task cards: the lifted task id and the pick-up handler, without re-rendering on every drag step. */
export function useTaskDragSource() {
  const v = useContext(DragSourceCtx);
  if (!v) throw new Error('useTaskDragSource must be used inside TaskDragProvider');
  return v;
}

/** The spot under the pointer, as an index among the other cards of a zone. */
function hitTest(x: number, y: number, id: string): { zone: string | null; index: number } {
  const el = document.elementFromPoint(x, y);
  const zoneEl = el?.closest<HTMLElement>('[data-drop]');
  if (!zoneEl) return { zone: null, index: 0 };
  // Nothing in the lists moves while dragging (the drop line takes no room), so the cards are where they look.
  let index = 0;
  for (const c of zoneEl.querySelectorAll<HTMLElement>('[data-task-id]')) {
    if (c.dataset.taskId === id) continue;
    const r = c.getBoundingClientRect();
    if (y > r.top + r.height / 2) index++;
  }
  return { zone: zoneEl.dataset.drop ?? null, index };
}

export default function TaskDragProvider({ children }: { children: ReactNode }) {
  const { tasks, readOnly } = useWorkspace();
  const [drag, setShown] = useState<DragState | null>(null);
  const [store] = useState(() => {
    let cur: DragState | null = null;
    const subs = new Set<() => void>();
    return {
      get: () => cur,
      sub: (fn: () => void) => { subs.add(fn); return () => { subs.delete(fn); }; },
      set: (d: DragState | null) => { cur = d; subs.forEach(fn => fn()); },
    };
  });
  /** A change the UI shows: the provider (ghost) and whoever picked the changed part re-render. */
  const setDrag = (d: DragState | null) => { setShown(d); store.set(d); };
  // The landing in progress: when it ends, and the page scroll that brings its spot into view.
  const landing = useRef<{ timer: ReturnType<typeof setTimeout>; raf: number; done: () => void; scrollEnd?: () => void; t0?: number } | null>(null);
  const handlers = useRef(new Map<string, Zone>());
  const live = useRef<DragState | null>(null); // latest state for listeners
  const cleanup = useRef<(() => void) | null>(null);
  const ghost = useRef<HTMLDivElement>(null);
  const aimed = useRef(false); // the landing ghost has been sent to its spot

  /** Put the ghost under the pointer, straight in the DOM. */
  const place = () => {
    const s = live.current, g = ghost.current;
    if (s && g) g.style.transform = `translate(${s.x - s.offX}px, ${s.y - s.offY}px)`;
  };

  const register = useCallback((zone: string, z: Zone) => {
    handlers.current.set(zone, z);
    return () => { if (handlers.current.get(zone) === z) handlers.current.delete(zone); };
  }, []);

  /** Where the card would land: the spot under the pointer, moved to where the zone can really put it
   *  (a day keeps its groups in order, a status column sorts by day), so the line never promises more. */
  const hit = (x: number, y: number, id: string) => {
    const h = hitTest(x, y, id);
    const fit = h.zone ? handlers.current.get(h.zone)?.fit : undefined;
    return fit ? { ...h, index: fit(id, h.index) } : h;
  };

  const update = (patch: Partial<DragState>) => {
    const prev = live.current;
    if (!prev) return;
    const next = { ...prev, ...patch };
    live.current = next;
    if (SHOWN.some(k => next[k] !== prev[k])) setDrag(next); // re-render only when the drop spot changes
    else place();
  };

  const begin = useCallback((e: RPointerEvent<HTMLElement>, id: string) => {
    if (readOnly || e.button !== 0 || live.current || cleanup.current) return;
    const t = e.target as HTMLElement;
    if (t.closest('input, textarea, select, [contenteditable], .cmts, .no-drag')) return;
    const card = e.currentTarget;
    const touch = e.pointerType === 'touch' || e.pointerType === 'pen';
    const pointerId = e.pointerId;
    const startX = e.clientX, startY = e.clientY;
    let lastX = startX, lastY = startY;
    let active = false;
    let holdTimer: ReturnType<typeof setTimeout> | undefined;
    let edgeTimer: ReturnType<typeof setTimeout> | undefined;
    let raf = 0;
    let moved = false; // pointer moved since the last frame

    const blockTouch = (ev: TouchEvent) => { if (active) ev.preventDefault(); };
    const blockMenu = (ev: Event) => ev.preventDefault();

    const stopEdge = () => { clearTimeout(edgeTimer); edgeTimer = undefined; };
    const setEdge = (edge: -1 | 0 | 1) => {
      if (!live.current || live.current.edge === edge) return;
      stopEdge();
      update({ edge, edgeSteps: 0 });
      if (!edge) return;
      const step = (wait: number) => {
        edgeTimer = setTimeout(() => {
          window.dispatchEvent(new CustomEvent(DRAG_EDGE_EVENT, { detail: edge }));
          update({ edgeSteps: (live.current?.edgeSteps ?? 0) + 1 });
          // The board moved under the pointer: find the new drop spot.
          requestAnimationFrame(() => { if (live.current) update(hit(lastX, lastY, id)); });
          step(EDGE_REPEAT_MS);
        }, wait);
      };
      step(EDGE_FIRST_MS);
    };

    // Auto-scroll near the top/bottom of the screen while dragging.
    const tick = () => {
      if (!active) return;
      const bottomGuard = window.matchMedia('(max-width: 767px)').matches ? 100 : 0;
      let dy = 0;
      if (lastY < SCROLL_ZONE) dy = -Math.ceil((SCROLL_ZONE - lastY) / 6);
      else if (lastY > innerHeight - SCROLL_ZONE - bottomGuard) dy = Math.ceil((lastY - (innerHeight - SCROLL_ZONE - bottomGuard)) / 6);
      if (dy) (document.querySelector('.page-scroll') ?? window).scrollBy(0, dy);
      // At most one hit test and one ghost move per frame, however many pointer events arrived.
      if (moved || dy) {
        moved = false;
        update({ x: lastX, y: lastY, ...hit(lastX, lastY, id) });
        setEdge(lastX < EDGE_PX ? -1 : lastX > innerWidth - EDGE_PX ? 1 : 0);
      }
      raf = requestAnimationFrame(tick);
    };

    const activate = () => {
      const r = card.getBoundingClientRect();
      active = true;
      try { card.setPointerCapture(pointerId); } catch { /* pointer already gone */ }
      try { navigator.vibrate?.(12); } catch { /* not supported */ }
      const html = document.documentElement;
      html.classList.add('is-dragging-task');
      html.style.setProperty('--drag-h', r.height + 'px'); // the placeholder keeps the card's exact height
      holdSync(true);
      blobMotion(false);
      // Where the card sits now, in the same terms as a drop spot (zone + index among the other cards).
      const homeEl = card.closest<HTMLElement>('[data-drop]');
      let homeIndex = 0;
      for (const c of homeEl?.querySelectorAll<HTMLElement>('[data-task-id]') ?? []) {
        if (c === card) break;
        homeIndex++;
      }
      live.current = {
        id, x: lastX, y: lastY, offX: startX - r.left, offY: startY - r.top, w: r.width, h: r.height,
        edge: 0, edgeSteps: 0, inWeek: !!card.closest('.week'), homeZone: homeEl?.dataset.drop ?? null, homeIndex,
        ...hit(lastX, lastY, id),
      };
      setDrag(live.current);
      raf = requestAnimationFrame(tick);
    };

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      lastX = ev.clientX; lastY = ev.clientY;
      if (!active) {
        const dist = Math.hypot(lastX - startX, lastY - startY);
        if (touch) { if (dist > TOUCH_SLOP) finish(false); return; }
        if (dist < MOUSE_SLOP) return;
        activate();
      }
      moved = true; // handled in the next animation frame (tick)
    };

    const finish = (drop: boolean) => {
      clearTimeout(holdTimer);
      stopEdge();
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('touchmove', blockTouch);
      window.removeEventListener('contextmenu', blockMenu, true);
      document.documentElement.classList.remove('is-dragging-task');
      if (active) blobMotion(true);
      // Catch up on a move the last frame did not handle yet, so the drop goes where the pointer is.
      if (active && moved && live.current) { moved = false; live.current = { ...live.current, x: lastX, y: lastY, ...hit(lastX, lastY, id) }; }
      const state = live.current;
      // Only a drop that changes the task's place counts; dropping it back where it was changes nothing.
      const moves = !!(drop && state?.zone && handlers.current.has(state.zone) && !(state.zone === state.homeZone && state.index === state.homeIndex));
      const done = () => {
        if (landing.current) {
          clearTimeout(landing.current.timer);
          cancelAnimationFrame(landing.current.raf);
          landing.current.scrollEnd?.(); // the timer can beat the scroll's last frame: finish it exactly
          landing.current = null;
        }
        cleanup.current = null;
        live.current = null;
        aimed.current = false;
        document.documentElement.style.removeProperty('--drag-h');
        setDrag(null);
        // The task itself changes only now, once, after the drop animation; then syncing resumes.
        if (moves && state?.zone) handlers.current.get(state.zone)?.drop(state.id, state.index);
        holdSync(false);
      };
      if (!active || !state) { done(); return; }
      // The release can produce a click on whatever is under the pointer; ignore it.
      const swallow = (ev: Event) => { ev.preventDefault(); ev.stopPropagation(); };
      window.addEventListener('click', swallow, true);
      setTimeout(() => window.removeEventListener('click', swallow, true), 350);
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { done(); return; }
      // The drop animation: the ghost glides to the new spot, a gap opens there and the placeholder folds
      // shut. Then the move is made, so the card appears where the gap was and nothing jumps.
      // The flight starts in this very frame, aimed from the drop line already on screen; the gap and the
      // fold (a React render) follow a frame later. The flight is a compositor transition, so the render
      // can't hold it up, and the release never pauses before the card moves.
      const land = { timer: setTimeout(done, LAND_MS), raf: 0, done } as NonNullable<typeof landing.current>;
      landing.current = land;
      cleanup.current = done;
      live.current = { ...state, landing: true, moves, edge: 0 };
      const flight = aimNow(live.current);
      requestAnimationFrame(() => setTimeout(() => {
        if (landing.current !== land || !live.current) return;
        setDrag(live.current);
        // The gap and the fold take LAND_MS from now; the card waits at its spot until both are done.
        clearTimeout(land.timer);
        land.timer = setTimeout(done, Math.max(LAND_MS, flight - (performance.now() - (land.t0 ?? 0))));
      }));
      land.t0 = performance.now();
    };
    const onUp = (ev: PointerEvent) => { if (ev.pointerId === pointerId) finish(true); };
    const onCancel = (ev: PointerEvent) => { if (ev.pointerId === pointerId) finish(false); };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('touchmove', blockTouch, { passive: false });
    if (touch) {
      window.addEventListener('contextmenu', blockMenu, true);
      holdTimer = setTimeout(activate, HOLD_MS);
    }
    cleanup.current = () => finish(false);
  }, [readOnly]);

  useEffect(() => () => { cleanup.current?.(); holdSync(false); }, []);

  /**
   * Where the landing ghost goes, worked out from what is on screen (never by changing the layout for a
   * moment, which could make the page jump): back onto the placeholder when nothing moves; otherwise the
   * spot the drop line marks, which is where the gap opens. The gap's top doesn't depend on its own
   * (growing) height; it only rises if the folding placeholder sits above it in the same list, by the
   * placeholder's height and one gap. Before the render the line marks the spot; after it, the gap.
   */
  const landingSpot = (s: DragState) => {
    const source = document.querySelector<HTMLElement>(`[data-task-id="${CSS.escape(s.id)}"]`);
    let top: number, left: number, width: number, list: HTMLElement | null, mark: HTMLElement | null;
    if (!s.moves) {
      if (!source) return null;
      const b = source.getBoundingClientRect();
      return { top: b.top, bottom: b.bottom, left: b.left, width: b.width };
    }
    const slot = document.querySelector<HTMLElement>('.drop-slot');
    const line = slot ? null : document.querySelector<HTMLElement>('.drop-line');
    mark = slot ?? line;
    list = mark?.parentElement ?? null;
    if (!mark || !list) return null;
    const gap = parseFloat(getComputedStyle(list).rowGap) || 0;
    const lb = list.getBoundingClientRect();
    left = lb.left; width = lb.width;
    if (slot) top = slot.getBoundingClientRect().top;
    else {
      // The line takes no room: the gap will start where the next card is now (or below the last one).
      const next = mark.nextElementSibling as HTMLElement | null, prev = mark.previousElementSibling as HTMLElement | null;
      top = next ? next.getBoundingClientRect().top : prev ? prev.getBoundingClientRect().bottom + gap : lb.top;
    }
    if (source && source.parentElement === list && source.compareDocumentPosition(mark) & Node.DOCUMENT_POSITION_FOLLOWING)
      top -= source.offsetHeight + gap;
    return { top, bottom: top + s.h, left, width };
  };

  /** Sends the ghost on its landing flight (scrolling the spot into view if needed). Returns its length in ms. */
  const aimNow = (s: DragState): number => {
    const g = ghost.current;
    if (!g || aimed.current) return LAND_MS;
    const r = landingSpot(s);
    if (!r) return LAND_MS; // nothing to aim at yet: the layout effect tries again after the render
    aimed.current = true;
    g.classList.add('is-landing');
    {
      // Off screen (or partly): scroll the page so the spot comes into view while the card flies there.
      // The ghost aims at where the spot will be once scrolled; scroll and flight end together.
      const scroller = document.querySelector<HTMLElement>('.page-scroll') ?? document.scrollingElement as HTMLElement | null;
      const top = (scroller && scroller !== document.scrollingElement ? Math.max(0, scroller.getBoundingClientRect().top) : 0) + EDGE_PAD;
      const bottom = innerHeight - (window.matchMedia('(max-width: 767px)').matches ? 100 : 0) - EDGE_PAD;
      let delta = 0;
      if (r.top < top) delta = r.top - top;
      else if (r.bottom > bottom) delta = Math.min(r.bottom - bottom, r.top - top); // never push its top out
      const land = landing.current;
      // Only as far as the page can scroll, so the ghost aims where the spot really ends up.
      if (scroller) delta = Math.min(Math.max(scroller.scrollTop + delta, 0), scroller.scrollHeight - scroller.clientHeight) - scroller.scrollTop;
      if (scroller && delta && land) {
        const from = scroller.scrollTop;
        const ms = LAND_MS + Math.min(Math.abs(delta), 1200) / 4; // farther spots take a little longer
        const t0 = performance.now();
        const step = (now: number) => {
          const p = Math.min(1, (now - t0) / ms);
          scroller.scrollTop = from + delta * (1 - (1 - p) ** 3);
          if (p < 1) land.raf = requestAnimationFrame(step);
        };
        land.raf = requestAnimationFrame(step);
        land.scrollEnd = () => { scroller.scrollTop = from + delta; };
        clearTimeout(land.timer);
        land.timer = setTimeout(land.done, ms);
        g.style.setProperty('--land-ms', ms + 'ms');
      }
      live.current = { ...s, x: r.left + s.offX, y: r.top - delta + s.offY };
      g.style.width = r.width + 'px';
      place();
      return scroller && delta && land ? LAND_MS + Math.min(Math.abs(delta), 1200) / 4 : LAND_MS;
    }
  };

  // After each render (pick-up, landing) the ghost takes the latest position; a landing that could not be
  // aimed before the render (no drop line on screen) is aimed now, at the rendered gap.
  useLayoutEffect(() => {
    const s = live.current;
    if (s?.landing && !aimed.current) {
      aimNow(s);
      if (!aimed.current && ghost.current) ghost.current.style.opacity = '0';
    }
    place();
  }, [drag]);

  const value = useMemo(() => ({ store, begin, register }), [store, begin, register]);
  const dragId = drag?.id ?? null;
  const leaving = !!(drag?.landing && drag.moves);
  const source = useMemo(() => ({ dragId, leaving, begin }), [dragId, leaving, begin]);
  // The ghost shows the task as it was picked up; nothing about it changes on the way.
  const picked = useRef<{ id: string; task: (typeof tasks)[number] | undefined } | null>(null);
  if (!drag) picked.current = null;
  else if (picked.current?.id !== drag.id) picked.current = { id: drag.id, task: tasks.find(t => t.id === drag.id) };
  const task = picked.current?.task;

  return (
    <DragCtx.Provider value={value}>
      <DragSourceCtx.Provider value={source}>
        {children}
        {drag && task && createPortal(
          // `in-week` gives the copy the board's card layout (it lives outside the board), so nothing in it moves.
          <div ref={ghost} inert className={'drag-ghost' + (drag.inWeek ? ' in-week' : '') + (drag.landing ? ' is-landing' : '')} style={{ '--land-ms': LAND_MS + 'ms', width: drag.w } as CSSProperties} aria-hidden="true">
            <TaskCard t={task} ghost />
          </div>,
          document.body,
        )}
      </DragSourceCtx.Provider>
    </DragCtx.Provider>
  );
}

/** For a drop zone: registers its handler and tells where the drop line (and, on release, the gap) goes. */
export function useDropZone(zone: string, onDrop: Handler, enabled = true, fit?: Fit) {
  const { register } = useTaskDrag();
  const latest = useRef({ onDrop, fit });
  latest.current = { onDrop, fit };
  const hasFit = !!fit;
  useEffect(() => (enabled ? register(zone, {
    drop: (id, i) => latest.current.onDrop(id, i),
    fit: hasFit ? (id, i) => latest.current.fit?.(id, i) ?? i : undefined,
  }) : undefined), [zone, enabled, hasFit, register]);
  // Re-renders only when something about this zone changes: what is dragged, the line's place here, the drop.
  const key = useDragSelect(d => !d ? ''
    : [d.id, d.h, d.zone === zone ? d.index : -1, d.landing ? 1 : 0, d.moves ? 1 : 0, d.homeZone === zone ? d.homeIndex : -1].join('|'));
  if (!key) return { dragId: null, over: false, slotAt: -1, home: false, landing: false, moves: false, h: 0 };
  const [dragId, h, at, landing, moves, homeIndex] = key.split('|');
  const slotAt = +at;
  return { dragId, over: slotAt >= 0, slotAt, home: slotAt >= 0 && slotAt === +homeIndex, landing: landing === '1', moves: moves === '1', h: +h };
}
