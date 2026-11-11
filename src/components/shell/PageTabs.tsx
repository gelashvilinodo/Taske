'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export const PAGES = [
  { href: '/board', label: 'Board' },
  { href: '/list', label: 'List' },
  { href: '/calendar', label: 'Calendar' },
  { href: '/content-calendar', label: 'Content calendar' },
  { href: '/table', label: 'Table' },
];

export default function PageTabs() {
  const path = usePathname();
  return (
    <nav className="tabs" aria-label="Pages">
      {PAGES.map(p => (
        <Link key={p.href} href={p.href} aria-current={path === p.href ? 'page' : undefined}>{p.label}</Link>
      ))}
    </nav>
  );
}
