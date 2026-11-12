'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { useNotifications } from '@/components/notifications/NotificationsProvider';
import { IconClose, IconLogout } from './icons';
import { PAGES, PHONE_PAGES } from './pages';

/**
 * Phone-only burger menu: a full-screen panel that slides in from the left with the pages
 * that don't fit in the bottom bar (Table, Projects, Settings), one under the other.
 * Sign out is pinned to the bottom of the screen. Rendered into <body> so the header's
 * glass (backdrop-filter) doesn't trap it inside the header box.
 */
export default function MobileMenu({ open, current, onClose }: { open: boolean; current: string; onClose: () => void }) {
  const { account, signOut } = useWorkspace();
  const { unread } = useNotifications();
  const closeBtn = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    closeBtn.current?.focus({ preventScroll: true });
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [open, onClose]);

  if (!mounted) return null;
  const extra = PAGES.slice(PHONE_PAGES);
  return createPortal(
    <div id="mobileMenu" className={'mmenu' + (open ? ' is-open' : '')} role="dialog" aria-modal="true" aria-label="Menu"
      aria-hidden={!open} inert={!open}>
      <div className="mmenu-head">
        <span className="mmenu-title">Menu</span>
        <button ref={closeBtn} type="button" className="round-btn" aria-label="Close menu" onClick={onClose}><IconClose size={18} /></button>
      </div>

      <nav className="mmenu-list" aria-label="More pages">
        {extra.map(({ href, label, hint, Icon }, i) => (
          <Link key={href} href={href} className="mmenu-item" style={{ '--i': i } as CSSProperties}
            aria-current={current === href ? 'page' : undefined} onClick={onClose}>
            <span className="mmenu-icon"><Icon size={20} /></span>
            <span className="mmenu-text"><b>{label}</b><small>{hint}</small></span>
            {href === '/notifications' && unread > 0 && <span className="count-badge is-inline">{unread > 9 ? '9+' : unread}</span>}
          </Link>
        ))}
      </nav>

      {account && (
        <div className="mmenu-foot">
          <button type="button" className="mmenu-item is-danger" onClick={() => { onClose(); signOut(); }}>
            <span className="mmenu-icon"><IconLogout size={20} /></span>
            <span className="mmenu-text"><b>Sign out</b><small>{account.email || account.name}</small></span>
          </button>
        </div>
      )}
    </div>,
    document.body,
  );
}
