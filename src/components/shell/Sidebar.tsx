'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { IconChevronUp, IconLogout } from './icons';
import { PAGES, pageFor } from './pages';

/** On phones the bar holds this many pages; the rest open from the "more" arrow. */
const PHONE_PAGES = 4;
const shortLabel = (label: string) => (label === 'Content calendar' ? 'Content' : label);

type Blob = { x: number; y: number; w: number; h: number; dx: number; dy: number; n: number };

/**
 * Icon rail on the left; a bottom tab bar on phones. A glowing "blob" slides and squishes
 * to the active page. On phones only the first four pages sit in the bar; the arrow opens
 * a small sheet with the rest (Table, Projects) and Sign out.
 */
export default function Sidebar() {
  const path = usePathname();
  const current = pageFor(path).href;
  const { account, signOut } = useWorkspace();
  const items = useRef<HTMLDivElement>(null);
  const moreBtn = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [open, setOpen] = useState(false);
  const extraActive = PAGES.findIndex(p => p.href === current) >= PHONE_PAGES;

  // Put the blob under the active page (or under the arrow when the page lives in the sheet).
  const place = useCallback(() => {
    const box = items.current;
    if (!box) return;
    let target = box.querySelector<HTMLElement>('.rail-item[aria-current="page"]');
    if (!target || target.offsetParent === null) target = moreBtn.current;
    if (!target || target.offsetParent === null) return;
    setBlob(prev => {
      const next = { x: target!.offsetLeft, y: target!.offsetTop, w: target!.offsetWidth, h: target!.offsetHeight };
      if (prev && prev.x === next.x && prev.y === next.y && prev.w === next.w && prev.h === next.h) return prev;
      return { ...next, dx: prev ? next.x - prev.x : 0, dy: prev ? next.y - prev.y : 0, n: (prev?.n ?? 0) + (prev ? 1 : 0) };
    });
  }, []);

  useLayoutEffect(place, [current, place]);
  useEffect(() => {
    const ro = new ResizeObserver(place);
    if (items.current) ro.observe(items.current);
    return () => ro.disconnect();
  }, [place]);

  // The sheet closes on navigation, Escape, or a tap anywhere else.
  useEffect(() => setOpen(false), [current]);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!sheet.current?.contains(t) && !moreBtn.current?.contains(t)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); moreBtn.current?.focus(); } };
    document.addEventListener('pointerdown', away, true);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away, true); document.removeEventListener('keydown', esc); };
  }, [open]);

  // Squish along the direction of travel, then settle (the inner layer restarts its animation each move).
  const moved = blob && (blob.dx || blob.dy);
  const horizontal = blob ? Math.abs(blob.dx) >= Math.abs(blob.dy) : true;
  const blobStyle = blob ? ({
    width: blob.w, height: blob.h, transform: `translate(${blob.x}px, ${blob.y}px)`,
    '--stretch-x': moved ? (horizontal ? 1.14 : 0.94) : 1,
    '--stretch-y': moved ? (horizontal ? 0.94 : 1.14) : 1,
  } as CSSProperties) : undefined;

  return (
    <nav className="rail" aria-label="Pages">
      <Link className="rail-logo" href="/" aria-label="Taske home"><span aria-hidden="true" /></Link>
      <div className="rail-items" ref={items}>
        <span className={'rail-blob' + (blob ? ' is-ready' : '') + (blob && blob.n ? ' is-animated' : '')} style={blobStyle} aria-hidden="true">
          <span className="rail-blob-core" key={blob?.n ?? 0} />
        </span>
        {PAGES.map(({ href, label, Icon }, i) => (
          <Link key={href} className={'rail-item' + (i >= PHONE_PAGES ? ' rail-extra' : '')} href={href}
            aria-current={current === href ? 'page' : undefined} aria-label={label} data-tip={label}>
            <Icon />
            <span className="rail-label">{shortLabel(label)}</span>
          </Link>
        ))}
        <button ref={moreBtn} type="button" className={'rail-item rail-more' + (extraActive ? ' is-current' : '') + (open ? ' is-open' : '')}
          aria-expanded={open} aria-controls="railSheet" aria-label="More pages" onClick={() => setOpen(o => !o)}>
          <IconChevronUp />
          <span className="rail-label">More</span>
        </button>
      </div>

      {account && (
        <div className="rail-foot">
          <button className="rail-item" type="button" onClick={signOut} aria-label="Sign out" data-tip="Sign out"><IconLogout /></button>
        </div>
      )}

      {/* Phone-only sheet above the bar */}
      <div id="railSheet" ref={sheet} className={'rail-sheet' + (open ? ' is-open' : '')} aria-hidden={!open} inert={!open}>
        {PAGES.slice(PHONE_PAGES).map(({ href, label, Icon }, i) => (
          <Link key={href} href={href} className="rail-sheet-item" style={{ '--i': i } as CSSProperties}
            aria-current={current === href ? 'page' : undefined}>
            <span className="rail-sheet-icon"><Icon /></span>{label}
          </Link>
        ))}
        {account && (
          <button type="button" className="rail-sheet-item is-danger" style={{ '--i': PAGES.length - PHONE_PAGES } as CSSProperties} onClick={signOut}>
            <span className="rail-sheet-icon"><IconLogout /></span>Sign out
          </button>
        )}
      </div>
    </nav>
  );
}
