'use client';

import { useEffect, useRef, useState } from 'react';

const DECIDE = 12;      // finger travel before we know if it is a sideways swipe or a scroll
const ARM_MIN = 80;     // a swipe this far (or 32% of the card) does its action on release
const ARM_SHARE = .32;
const OUT_MS = 180;     // card sliding off before the action
const BACK_MS = 220;    // card springing back when let go early

/**
 * Sideways finger swipe on a task card (phone only). The card follows the finger; past the
 * threshold the action behind it lights up, and letting go there runs `onRight` / `onLeft`.
 * A vertical move scrolls the page as usual; a press-and-hold still lifts the card for dragging
 * (TaskDrag gives up as soon as the finger moves, so the two never fight).
 */
export function useCardSwipe(enabled: boolean, onRight: () => void, onLeft: () => void) {
  const row = useRef<HTMLDivElement>(null);
  const [dir, setDir] = useState<0 | 1 | -1>(0);   // which action is showing
  const [armed, setArmed] = useState(false);
  const acts = useRef({ onRight, onLeft });
  acts.current = { onRight, onLeft };

  useEffect(() => {
    const el = row.current;
    if (!enabled || !el) return;
    const card = () => el.firstElementChild as HTMLElement | null;

    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'touch' || !matchMedia('(max-width: 767px)').matches) return;
      if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable], .cmts, .no-drag')) return;
      const id = e.pointerId, x0 = e.clientX, y0 = e.clientY;
      const w = el.offsetWidth;
      const arm = Math.max(ARM_MIN, w * ARM_SHARE);
      let axis: '' | 'x' | 'y' = '';
      let dx = 0, wasArmed = false;

      const move = (ev: PointerEvent) => {
        if (ev.pointerId !== id) return;
        dx = ev.clientX - x0;
        const dy = ev.clientY - y0;
        if (!axis) {
          if (Math.abs(dx) < DECIDE && Math.abs(dy) < DECIDE) return;
          axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y';
          if (axis === 'y') { end(); return; }
          el.classList.add('is-swiping');
        }
        // Past the threshold the card keeps following, but more slowly.
        const over = Math.abs(dx) - arm;
        const shown = over > 0 ? Math.sign(dx) * (arm + over * .35) : dx;
        const c = card();
        if (c) { c.style.transition = 'none'; c.style.transform = `translateX(${shown}px)`; }
        setDir(dx > 0 ? 1 : -1);
        const isArmed = Math.abs(dx) >= arm;
        if (isArmed !== wasArmed) {
          wasArmed = isArmed;
          setArmed(isArmed);
          if (isArmed) try { navigator.vibrate?.(10); } catch { /* not supported */ }
        }
      };

      const up = (ev: PointerEvent) => {
        if (ev.pointerId !== id) return;
        end();
        if (axis !== 'x') return;
        // The release would also click whatever is under the finger; ignore that click.
        const swallow = (c: Event) => { c.preventDefault(); c.stopPropagation(); };
        addEventListener('click', swallow, true);
        setTimeout(() => removeEventListener('click', swallow, true), 350);
        const c = card();
        const reset = () => {
          el.classList.remove('is-swiping');
          setDir(0); setArmed(false);
          if (c) { c.style.transition = ''; c.style.transform = ''; }
        };
        if (!c) { reset(); return; }
        if (wasArmed) {
          const sign = dx > 0 ? 1 : -1;
          c.style.transition = `transform ${OUT_MS}ms cubic-bezier(.3,.7,.4,1)`;
          c.style.transform = `translateX(${sign * (w + 24)}px)`;
          setTimeout(() => {
            (sign > 0 ? acts.current.onRight : acts.current.onLeft)();
            // Comes back in place (it may move to another column, or stay when a window asks first).
            c.style.transition = 'none'; c.style.transform = '';
            el.classList.remove('is-swiping');
            setDir(0); setArmed(false);
            requestAnimationFrame(() => { c.style.transition = ''; });
          }, OUT_MS);
        } else {
          c.style.transition = `transform ${BACK_MS}ms cubic-bezier(.3,1.3,.5,1)`;
          c.style.transform = 'translateX(0)';
          setTimeout(reset, BACK_MS);
        }
      };

      const end = () => {
        removeEventListener('pointermove', move);
        removeEventListener('pointerup', up);
        removeEventListener('pointercancel', cancel);
      };
      const cancel = (ev: PointerEvent) => {
        if (ev.pointerId !== id) return;
        end();
        const c = card();
        if (c) { c.style.transition = ''; c.style.transform = ''; }
        el.classList.remove('is-swiping');
        setDir(0); setArmed(false);
      };
      addEventListener('pointermove', move);
      addEventListener('pointerup', up);
      addEventListener('pointercancel', cancel);
    };
    el.addEventListener('pointerdown', down);
    return () => el.removeEventListener('pointerdown', down);
  }, [enabled]);

  return { row, dir, armed };
}
