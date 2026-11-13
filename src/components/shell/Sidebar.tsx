'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { useNotifications } from '@/components/notifications/NotificationsProvider';
import { requestAddOnDay } from '@/components/tasks/addTaskEvents';
import { IconLogout, IconPlus } from './icons';
import { PAGES, PHONE_PAGES, pageFor } from './pages';

const shortLabel = (label: string) => (label === 'Content calendar' ? 'Content' : label === 'Dashboard' ? 'Home' : label);

type Blob = { x: number; y: number; w: number; h: number; dx: number; dy: number; n: number };
/** Finger drag of the blob along the phone bar: where it is, and which item it is over. */
type Drag = { x: number; under: number };
const DRAG_START_PX = 8;
const isPhone = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;

/**
 * Icon rail on the left; a bottom tab bar on phones. A glowing "blob" slides and squishes
 * to the active page. On phones only the first four pages sit in the bar, with the "add task"
 * button in the middle; the rest (Table, Projects, Settings) and Sign out are in the header's
 * burger menu.
 */
export default function Sidebar() {
  const path = usePathname();
  const current = pageFor(path).href;
  const { account, signOut, readOnly } = useWorkspace();
  const { unread } = useNotifications();
  const items = useRef<HTMLDivElement>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  /** No visible bar item for the page (a burger-menu page on phones): the blob fades out. */
  const [blobOff, setBlobOff] = useState(false);
  const router = useRouter();
  const [drag, setDrag] = useState<Drag | null>(null);
  const gesture = useRef<{ id: number; startX: number; active: boolean; under: number } | null>(null);
  const swallowClick = useRef(false);

  // Put the blob under the active page.
  const place = useCallback(() => {
    const box = items.current;
    if (!box) return;
    const target = box.querySelector<HTMLElement>('.rail-item[aria-current="page"]');
    const off = !target || target.offsetParent === null;
    setBlobOff(off);
    if (off) return;
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

  // ----- Phone: drag the blob with a finger; release over an item to open it -----
  const targets = () => [...(items.current?.querySelectorAll<HTMLElement>(':scope > .rail-item') ?? [])].filter(el => el.offsetParent !== null);

  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (!isPhone() || !blob || e.button !== 0) return;
    gesture.current = { id: e.pointerId, startX: e.clientX, active: false, under: -1 };
  };
  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    const box = items.current;
    if (!g || g.id !== e.pointerId || !box || !blob) return;
    if (!g.active) {
      if (Math.abs(e.clientX - g.startX) < DRAG_START_PX) return;
      g.active = true;
      box.setPointerCapture(e.pointerId);
    }
    const list = targets();
    if (!list.length) return;
    const left = box.getBoundingClientRect().left;
    const first = list[0], last = list[list.length - 1];
    const x = Math.min(Math.max(e.clientX - left - blob.w / 2, first.offsetLeft), last.offsetLeft + last.offsetWidth - blob.w);
    const centre = x + blob.w / 2;
    let under = 0;
    list.forEach((el, i) => {
      if (Math.abs(el.offsetLeft + el.offsetWidth / 2 - centre) < Math.abs(list[under].offsetLeft + list[under].offsetWidth / 2 - centre)) under = i;
    });
    if (under !== g.under) { g.under = under; try { navigator.vibrate?.(6); } catch { /* not supported */ } }
    setDrag({ x, under });
  };
  const endDrag = (e: RPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g || g.id !== e.pointerId || !g.active) return;
    // A click right after the drag (some browsers send one) must not also open a link.
    // Not every browser sends it, so the guard expires on its own.
    swallowClick.current = true;
    setTimeout(() => { swallowClick.current = false; }, 350);
    const el = targets()[g.under];
    setDrag(null);
    if (!el) return;
    // Land the blob on the chosen item now, so it does not drift back while the page loads.
    setBlob(prev => prev && {
      ...prev, x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight,
      dx: el.offsetLeft - (drag?.x ?? prev.x), dy: 0, n: prev.n + 1,
    });
    const href = el.getAttribute('href');
    if (href && href !== current) router.push(href);
  };
  const onClickCapture = (e: React.MouseEvent) => {
    if (swallowClick.current) { swallowClick.current = false; e.preventDefault(); e.stopPropagation(); }
  };

  // Squish along the direction of travel, then settle (the inner layer restarts its animation each move).
  const moved = blob && (blob.dx || blob.dy);
  const horizontal = blob ? Math.abs(blob.dx) >= Math.abs(blob.dy) : true;
  const blobStyle = blob ? ({
    width: blob.w, height: blob.h, transform: `translate(${drag ? drag.x : blob.x}px, ${blob.y}px)`,
    '--stretch-x': moved ? (horizontal ? 1.14 : 0.94) : 1,
    '--stretch-y': moved ? (horizontal ? 0.94 : 1.14) : 1,
  } as CSSProperties) : undefined;

  return (
    <nav className="rail" aria-label="Pages">
      <div className={'rail-items' + (drag ? ' is-dragging' : '')} ref={items}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag} onClickCapture={onClickCapture}>
        <span className={'rail-blob' + (blob ? ' is-ready' : '') + (blob && blob.n ? ' is-animated' : '') + (blobOff ? ' is-off' : '') + (drag ? ' is-dragging' : '')} style={blobStyle} aria-hidden="true">
          <span className="rail-blob-core" key={blob?.n ?? 0} />
        </span>
        {PAGES.map(({ href, label, Icon }, i) => (
          <React.Fragment key={href}>
            {/* Phones: "add task" sits in the middle of the bar, between the 2nd and 3rd page */}
            {i === PHONE_PAGES / 2 && !readOnly && (
              <button type="button" className="rail-add" aria-label="Add task" onClick={() => requestAddOnDay('')}><IconPlus size={22} /></button>
            )}
            <Link className={'rail-item' + (i >= PHONE_PAGES ? ' rail-extra' : '') + (href === '/settings' ? ' rail-settings' : '') + (drag && drag.under === i ? ' is-under' : '')} href={href} draggable={false}
              aria-current={current === href ? 'page' : undefined} aria-label={label} data-tip={label}>
              <Icon />
              <span className="rail-label">{shortLabel(label)}</span>
              {href === '/notifications' && unread > 0 && <span className="count-badge" aria-label={`${unread} unread`}>{unread > 9 ? '9+' : unread}</span>}
            </Link>
          </React.Fragment>
        ))}
      </div>

      {account && (
        <div className="rail-foot">
          <button className="rail-item" type="button" onClick={signOut} aria-label="Sign out" data-tip="Sign out"><IconLogout /></button>
        </div>
      )}

    </nav>
  );
}
