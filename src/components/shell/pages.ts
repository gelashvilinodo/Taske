import { IconBell, IconDashboard, IconBoard, IconCalendar, IconClock, IconFolder, IconHistory, IconList, IconSettings, IconTable } from './icons';

/** Workspace pages, in sidebar order. `hint` is the line under the page title. */
export const PAGES = [
  { href: '/', label: 'Dashboard', hint: 'How your tasks are going, for any period', Icon: IconDashboard },
  { href: '/board', label: 'Board', hint: 'Your week, Monday to Sunday', Icon: IconBoard },
  { href: '/list', label: 'List', hint: 'This week by status', Icon: IconList },
  { href: '/calendar', label: 'Calendar', hint: 'The month at a glance', Icon: IconCalendar },
  { href: '/content-calendar', label: 'Content calendar', hint: 'Posts and publishing by the hour', Icon: IconClock },
  { href: '/table', label: 'Table', hint: 'Every task in one sortable list', Icon: IconTable },
  { href: '/projects', label: 'Projects', hint: 'Your projects, their colours and logos', Icon: IconFolder },
  { href: '/notifications', label: 'Notifications', hint: 'Overdue tasks and alerts on your devices', Icon: IconBell },
  { href: '/history', label: 'History', hint: 'Every change to every task: who, what and when', Icon: IconHistory },
  // Sits at the foot of the rail on desktop (see .rail-settings); in the burger menu on phones
  { href: '/settings', label: 'Settings', hint: 'Appearance and preferences', Icon: IconSettings },
];

// The dashboard lives at '/', so it only matches exactly (every path starts with '/').
export const pageFor = (path: string) =>
  PAGES.find(p => path === p.href || (p.href !== '/' && path.startsWith(p.href + '/'))) ?? PAGES[0];

/** On phones the bottom bar holds this many pages; the rest live in the burger menu. */
export const PHONE_PAGES = 4;
