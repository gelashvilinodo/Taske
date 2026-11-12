'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { useNotifications } from '@/components/notifications/NotificationsProvider';
import { requestAddOnDay } from '@/components/tasks/AddTaskForm';
import { IconMenu, IconPlus } from './icons';
import { pageFor } from './pages';
import MobileMenu from './MobileMenu';

const initials = (s: string) => s.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('') || '?';

/** Page title on the left; quick actions and the account on the right.
 *  Its own bar above the window; the page itself never scrolls, so it always stays put.
 *  On phones it floats as a separate card, with a burger menu on the left; adding a task
 *  moves to the middle of the bottom bar. */
export default function AppHeader() {
  const path = usePathname();
  const page = pageFor(path);
  const { readOnly, account } = useWorkspace();
  const { unread } = useNotifications();
  const canAdd = !readOnly && (page.href === '/board' || page.href === '/list');
  const [menu, setMenu] = useState(false);
  const closeMenu = useCallback(() => setMenu(false), []);
  useEffect(() => setMenu(false), [page.href]);
  return (
    <header className="top">
      <div className="page-head">
        <button className="round-btn burger" type="button" aria-label="Open menu" aria-expanded={menu} aria-controls="mobileMenu"
          onClick={() => setMenu(true)}><IconMenu />{unread > 0 && <span className="dot-badge" aria-label={`${unread} unread notifications`} />}</button>
        <h1>{page.label}</h1>
      </div>
      <div className="top-right">
        {canAdd && (
          <button className="round-btn add-task-btn" type="button" aria-label="Add task" title="Add task" onClick={() => requestAddOnDay('')}><IconPlus /></button>
        )}
        {account && <span className="avatar" title={account.email || account.name}>{initials(account.name || account.email)}</span>}
      </div>
      <MobileMenu open={menu} current={page.href} onClose={closeMenu} />
    </header>
  );
}
