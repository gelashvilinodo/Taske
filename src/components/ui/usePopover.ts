'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Open/close state and placement for our own dropdowns (Dropdown, DatePicker).
 * The popover opens below its button, or above when there is more room there,
 * and lines up with the button's right edge when it would run off the right side.
 * "Room" is the viewport, or the scrolling box the field sits in (a dialog, or a [data-pop-room] area inside one),
 * since a scrolling box clips what overflows it.
 */
export function usePopover(size: { height: number; width: number }) {
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const [end, setEnd] = useState(false);
  const [maxHeight, setMaxHeight] = useState<number>();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  const show = () => {
    const r = button.current?.getBoundingClientRect();
    if (r) {
      const dlg = button.current?.closest('dialog');
      // A scrolling dialog clips its popovers; one with overflow: visible lets them spill past its edge.
      const room = button.current?.closest<HTMLElement>('[data-pop-room]') ?? (dlg && getComputedStyle(dlg).overflowY !== 'visible' ? dlg : null);
      const box = room?.getBoundingClientRect();
      const top = Math.max(0, box?.top ?? 0), bottom = Math.min(innerHeight, box?.bottom ?? innerHeight);
      // Sideways, keep inside the dialog either way so the popover lines up with its fields.
      const right = Math.min(innerWidth, dlg?.getBoundingClientRect().right ?? innerWidth) - 8;
      const below = bottom - r.bottom - 12, above = r.top - top - 12;
      const goUp = below < size.height && above > below;
      setUp(goUp);
      setMaxHeight(Math.max(160, Math.min(size.height, goUp ? above : below)));
      setEnd(r.left + size.width > right && r.right - size.width >= 0);
    }
    setOpen(true);
  };
  const hide = (focusButton = true) => { setOpen(false); if (focusButton) button.current?.focus(); };

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', away, true);
    return () => document.removeEventListener('pointerdown', away, true);
  }, [open]);

  return { open, setOpen, up, end, maxHeight, root, button, show, hide };
}
