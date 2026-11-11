'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { IconLogout } from './icons';
import { PAGES, pageFor } from './pages';

/** Icon rail on the left (a tab bar along the bottom on phones). Labels show as tooltips. */
export default function Sidebar() {
  const path = usePathname();
  const current = pageFor(path).href;
  const { account, signOut } = useWorkspace();
  return (
    <nav className="rail" aria-label="Pages">
      <Link className="rail-logo" href="/" aria-label="Taske home"><span aria-hidden="true" /></Link>
      <div className="rail-items">
        {PAGES.map(({ href, label, Icon }) => (
          <Link key={href} className="rail-item" href={href} aria-current={current === href ? 'page' : undefined} aria-label={label} data-tip={label}>
            <Icon />
            <span className="rail-label">{label === 'Content calendar' ? 'Content' : label}</span>
          </Link>
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
