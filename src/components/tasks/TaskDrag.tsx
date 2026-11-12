'use client';

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import TaskCard from './TaskCard';

/**
 * Moving task cards, with a mouse or a finger.
 * - Mouse: press and move a few pixels.
 * - Touch: press and hold (~0.35 s), then move. A quick swipe still scrolls the page.
 * A lifted copy of the card follows the pointer; the list opens a gap where it will land.
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
const LAND_MS = 240;     // the ghost gliding into its new spot on release

/** The page backdrop's drifting colour blobs (CSS transitions on --bN*, see BackdropDrift). While a
 *  card is dragged they hold still: every frame they move, all the glass on screen has to be blurred again. */
const blobMotion = (run: boolean) => {
  for (const a of document.getAnimations()) {
    if (!(a as CSSTransition).transitionProperty?.startsWith('--b')) continue;
    if (run) a.play(); else a.pause();
  }
};

type Handler = (id: string, index: number) => void;
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
  inWeek: boolean;               // picked up from the week board, whose cards have their own layout
}

interface Ctx {
  drag: DragState | null;
  begin: (e: RPointerEvent<HTMLElement>, id: string) => void;
  register: (zone: string, handler: Handler) => () => void;
}
const DragCtx = createContext<Ctx | null>(null);
/** What each card needs: which task is lifted (changes only at pick-up and drop). */
interface SourceCtx { dragId: string | null; begin: Ctx['begin'] }
const DragSourceCtx = createContext<SourceCtx | null>(null);

/** Fields the UI renders from; the pointer position (x, y) is not one of them. */
const SHOWN: (keyof DragState)[] = ['id', 'zone', 'index', 'edge', 'edgeSteps', 'landing', 'w', 'h'];

export function useTaskDrag() {
  const v = useContext(DragCtx);
  if (!v) throw new Error('useTaskDrag must be used inside TaskDragProvider');
  return v;
}

/** For task cards: the lifted task id and the pick-up handler, without re-rendering on every drag step. */
export function useTaskDragSource() {
  const v = useContext(DragSourceCtx);
  if (!v) throw new Error('useTaskDragSource must be used inside TaskDragProvider');
  return v;
}

/** Where the dragged card would land, as an index among the other cards of a zone. */
function hitTest(x: number, y: number, id: string): { zone: string | null; index: number } {
  const el = document.elementFromPoint(x, y);
  const zoneEl = el?.closest<HTMLElement>('[data-drop]');
  if (!zoneEl) return { zone: null, index: 0 };
  const cards = [...zoneEl.querySelectorAll<HTMLElement>('[data-task-id]')].filter(c => c.dataset.taskId !== id);
  // Measure the cards where they would be without the open gap: cards below the gap are pushed
  // down by it, and counting them there makes the gap trail behind when dragging downwards.
  const slot = zoneEl.querySelector<HTMLElement>('.drop-slot');
  let push = 0;
  if (slot) {
    const list = slot.parentElement;
    push = slot.getBoundingClientRect().height + (list ? parseFloat(getComputedStyle(list).rowGap) || 0 : 0);
  }
  let index = 0;
  for (const c of cards) {
    const r = c.getBoundingClientRect();
    const below = slot && slot.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING;
    if (y > r.top - (below ? push : 0) + r.height / 2) index++;
  }
  return { zone: zoneEl.dataset.drop ?? null, index };
}

export default function TaskDragProvider({ children }: { children: ReactNode }) {
  const { tasks, readOnly } = useWorkspace();
  const [drag, setDrag] = useState<DragState | null>(null);
  const handlers = useRef(new Map<string, Handler>());
  const live = useRef<DragState | null>(null); // latest state for listeners
  const cleanup = useRef<(() => void) | null>(null);
  const ghost = useRef<HTMLDivElement>(null);

  /** Put the ghost under the pointer, straight in the DOM. */
  const place = () => {
    const s = live.current, g = ghost.current;
    if (s && g) g.style.transform = `translate(${s.x - s.offX}px, ${s.y - s.offY}px)`;
  };

  const register = useCallback((zone: string, handler: Handler) => {
    handlers.current.set(zone, handler);
    return () => { if (handlers.current.get(zone) === handler) handlers.current.delete(zone); };
  }, []);

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
          requestAnimationFrame(() => { if (live.current) update(hitTest(lastX, lastY, id)); });
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
        update({ x: lastX, y: lastY, ...hitTest(lastX, lastY, id) });
        setEdge(lastX < EDGE_PX ? -1 : lastX > innerWidth - EDGE_PX ? 1 : 0);
      }
      raf = requestAnimationFrame(tick);
    };

    const activate = () => {
      const r = card.getBoundingClientRect();
      active = true;
      try { card.setPointerCapture(pointerId); } catch { /* pointer already gone */ }
      try { navigator.vibrate?.(12); } catch { /* not supported */ }
      document.documentElement.classList.add('is-dragging-task');
      blobMotion(false);
      live.current = {
        id, x: lastX, y: lastY, offX: startX - r.left, offY: startY - r.top, w: r.width, h: r.height,
        edge: 0, edgeSteps: 0, inWeek: !!card.closest('.week'), ...hitTest(lastX, lastY, id),
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
      if (active && moved && live.current) { moved = false; live.current = { ...live.current, x: lastX, y: lastY, ...hitTest(lastX, lastY, id) }; }
      const state = live.current;
      const done = () => {
        cleanup.current = null;
        live.current = null;
        setDrag(null);
        if (drop && state?.zone) handlers.current.get(state.zone)?.(state.id, state.index);
      };
      if (!active || !state) { done(); return; }
      // The release can produce a click on whatever is under the pointer; ignore it.
      const swallow = (ev: Event) => { ev.preventDefault(); ev.stopPropagation(); };
      window.addEventListener('click', swallow, true);
      setTimeout(() => window.removeEventListener('click', swallow, true), 350);
      // Glide the ghost into the gap it opened, then make the move. The gap and the hidden
      // source card stay until then, so nothing jumps.
      const slot = drop && state.zone && handlers.current.has(state.zone) ? document.querySelector<HTMLElement>('.drop-slot') : null;
      const r = slot?.getBoundingClientRect();
      const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!r || still || r.bottom < 0 || r.top > innerHeight) { done(); return; }
      update({ landing: true, edge: 0, x: r.left + state.offX, y: r.top + state.offY, w: r.width });
      cleanup.current = () => { clearTimeout(landTimer); done(); };
      const landTimer = setTimeout(done, LAND_MS);
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

  useEffect(() => () => cleanup.current?.(), []);
  // After each render (pick-up, landing) the ghost takes the latest position.
  useLayoutEffect(place, [drag]);

  const value = useMemo(() => ({ drag, begin, register }), [drag, begin, register]);
  const dragId = drag?.id ?? null;
  const source = useMemo(() => ({ dragId, begin }), [dragId, begin]);
  const task = drag ? tasks.find(t => t.id === drag.id) : undefined;

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

/** For a drop zone: registers its handler and tells where the gap should open. */
export function useDropZone(zone: string, onDrop: Handler, enabled = true) {
  const { drag, register } = useTaskDrag();
  const handler = useRef(onDrop);
  handler.current = onDrop;
  useEffect(() => (enabled ? register(zone, (id, i) => handler.current(id, i)) : undefined), [zone, enabled, register]);
  const over = !!drag && drag.zone === zone;
  return { drag, over, slotAt: over ? drag!.index : -1, slotHeight: drag?.h ?? 0 };
}
