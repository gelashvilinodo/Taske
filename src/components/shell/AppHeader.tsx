'use client';

import { usePathname } from 'next/navigation';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { requestAddOnDay } from '@/components/tasks/AddTaskForm';
import ThemeToggle from './ThemeToggle';
import { IconPlus } from './icons';
import { pageFor } from './pages';

const initials = (s: string) => s.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('') || '?';

/** Page title and hint on the left; status, quick actions and the account on the right. */
export default function AppHeader() {
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
          <button className="round-btn" type="button" aria-label="Add task" title="Add task" onClick={() => requestAddOnDay('')}><IconPlus /></button>
        )}
        <ThemeToggle />
        {account && <span className="avatar" title={account.email || account.name}>{initials(account.name || account.email)}</span>}
      </div>
    </header>
  );
}
