import { IconBell, IconBoard, IconCalendar, IconClock, IconFolder, IconList, IconSettings, IconTable } from './icons';

/** Workspace pages, in sidebar order. `hint` is the line under the page title. */
export const PAGES = [
  { href: '/board', label: 'Board', hint: 'Your week, Monday to Sunday', Icon: IconBoard },
  { href: '/list', label: 'List', hint: 'This week by status', Icon: IconList },
  { href: '/calendar', label: 'Calendar', hint: 'The month at a glance', Icon: IconCalendar },
  { href: '/content-calendar', label: 'Content calendar', hint: 'Posts and publishing by the hour', Icon: IconClock },
  { href: '/table', label: 'Table', hint: 'Every task in one sortable list', Icon: IconTable },
  { href: '/projects', label: 'Projects', hint: 'Your projects, their colours and logos', Icon: IconFolder },
  { href: '/notifications', label: 'Notifications', hint: 'Overdue tasks and alerts on your devices', Icon: IconBell },
  // Sits at the foot of the rail on desktop (see .rail-settings); in the burger menu on phones
  { href: '/settings', label: 'Settings', hint: 'Appearance and preferences', Icon: IconSettings },
];

export const pageFor = (path: string) => PAGES.find(p => path === p.href || path.startsWith(p.href + '/')) ?? PAGES[0];

/** On phones the bottom bar holds this many pages; the rest live in the burger menu. */
export const PHONE_PAGES = 4;
