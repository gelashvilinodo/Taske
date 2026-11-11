'use client';

import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import ThemeToggle from './ThemeToggle';

export default function AppHeader() {
  const { conn, readOnly, mode, account, signOut } = useWorkspace();
  const connText = {
    loading: 'Loading',
    live: readOnly ? 'Up to date · view only' : mode === 'local' ? 'Saved in this browser' : 'Up to date · saves automatically',
    bad: 'Connection lost',
  }[conn];
  return (
    <header className="top">
      <h1 className="brand">Personal Schedule</h1>
      <div className="top-right">
        <div className={'conn' + (conn === 'live' ? ' live' : '') + (conn === 'bad' ? ' bad' : '')} role="status">
          <i /><span>{connText}</span>
        </div>
        {account && (
          <div className="account">
            <span title={account.email}>{account.email || account.name}</span>
            <button className="ghost" type="button" onClick={signOut}>Sign out</button>
          </div>
        )}
        <ThemeToggle />
      </div>
    </header>
  );
}
