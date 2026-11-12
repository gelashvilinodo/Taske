'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MenuIcon } from './StatusIcon';

interface Item { id: string; name: string }

/** A small pill button that opens a pick-one menu (status, priority). */
export default function MenuButton({ className, title, ariaLabel, items, current, onPick, children }: {
  className: string; title: string; ariaLabel: string; items: readonly Item[]; current: string;
  onPick: (id: string) => void; children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !btn.current || !menu.current) { setPos(null); return; }
    // In the top layer, so it shows above (and is not clipped by) an open window.
    try { menu.current.showPopover?.(); } catch { /* already showing */ }
    const r = btn.current.getBoundingClientRect();
    const mw = menu.current.offsetWidth, mh = menu.current.offsetHeight;
    setPos({
      left: Math.max(8, Math.min(r.left, innerWidth - mw - 8)),
      top: r.bottom + mh + 8 > innerHeight ? Math.max(8, r.top - mh - 4) : r.bottom + 4,
    });
    const first = menu.current.querySelector<HTMLElement>('[aria-checked="true"]') || menu.current.firstElementChild as HTMLElement | null;
    first?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const down = (e: PointerEvent) => {
      const t = e.target as Node;
      if (menu.current?.contains(t) || btn.current?.contains(t)) return;
      close();
    };
    const key = (e: KeyboardEvent) => {
      // preventDefault keeps Escape from also closing the window the menu sits in
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); btn.current?.focus(); return; }
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && menu.current) {
        e.preventDefault();
        const list = [...menu.current.children] as HTMLElement[];
        const i = list.indexOf(document.activeElement as HTMLElement);
        list[(i + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length].focus();
      }
    };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('keydown', key, true);
    addEventListener('resize', close);
    addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('keydown', key, true);
      removeEventListener('resize', close);
      removeEventListener('scroll', close, true);
    };
  }, [open]);

  return (
    <>
      <button ref={btn} className={className} type="button" aria-haspopup="menu" aria-expanded={open} title={title} aria-label={ariaLabel} onClick={() => setOpen(o => !o)}>
        {children}
      </button>
      {open && createPortal(
        <div id="menu" role="menu" popover="manual" ref={menu} style={pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden', left: 0, top: 0 }}>
          {items.map(it => (
            <button key={it.id} type="button" role="menuitemradio" aria-checked={it.id === current}
              onClick={() => { setOpen(false); if (it.id !== current) onPick(it.id); }}>
              <MenuIcon id={it.id} /><span className="menu-name">{it.name}</span>{it.id === current && <span aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>,
        // Inside an open modal window everything outside it is inert, so the menu lives in that window.
        btn.current?.closest('dialog') ?? document.body,
      )}
    </>
  );
}
