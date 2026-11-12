'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { requestAddOnDay } from '@/components/tasks/AddTaskForm';
import ThemeToggle from './ThemeToggle';
import { IconPlus } from './icons';
import { pageFor } from './pages';

const initials = (s: string) => s.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('') || '?';

/** Watches the scroll area under the header. Once the window has scrolled up far enough
 *  to touch the header (the scroll area's top padding is that gap), `.is-merged` goes on the
 *  column and CSS melts the corners between them and turns on the blur under the edge. */
function useMergeWithWindow() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const wrap = ref.current;
    const col = wrap?.parentElement;
    const scroller = wrap?.nextElementSibling as HTMLElement | null;
    if (!wrap || !col || !scroller) return;
    const update = () => {
      const gap = parseFloat(getComputedStyle(scroller).paddingTop) || 0;
      col.classList.toggle('is-merged', scroller.scrollTop >= gap - 0.5);
    };
    update();
    scroller.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      scroller.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      col.classList.remove('is-merged');
    };
  }, []);
  return ref;
}

/** Page title and hint on the left; status, quick actions and the account on the right.
 *  It sits on its own above the window, stays put while the page scrolls, and joins the
 *  window when the window scrolls up to it. */
export default function AppHeader() {
  const wrapRef = useMergeWithWindow();
  const path = usePathname();
  const page = pageFor(path);
  const { conn, readOnly, mode, account } = useWorkspace();
  const connText = {
    loading: 'Loading',
    live: readOnly ? 'Up to date · view only' : mode === 'local' ? 'Saved in this browser' : 'Up to date · saves automatically',
    bad: 'Connection lost',
  }[conn];
  const canAdd = !readOnly && (page.href === '/board' || page.href === '/list');
  return (
    <div className="top-wrap" ref={wrapRef}>
    <header className="top">
      <div className="page-head">
        <h1>{page.label}</h1>
        <p>{page.hint}</p>
      </div>
      <div className="top-right">
        <div className={'conn' + (conn === 'live' ? ' live' : '') + (conn === 'bad' ? ' bad' : '')} role="status" title={connText}>
          <i /><span>{connText}</span>
        </div>
        {canAdd && (
          <button className="round-btn add-task-btn" type="button" aria-label="Add task" title="Add task" onClick={() => requestAddOnDay('')}><IconPlus /></button>
        )}
        <ThemeToggle />
        {account && <span className="avatar" title={account.email || account.name}>{initials(account.name || account.email)}</span>}
      </div>
    </header>
    </div>
  );
}
