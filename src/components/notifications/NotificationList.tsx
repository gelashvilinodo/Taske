'use client';

import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { useNotifications, type AppNotification } from './NotificationsProvider';
import { IconAlert, IconBell, IconClose, IconDone } from '@/components/shell/icons';

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
function ago(ms: number) {
  const s = Math.round((ms - Date.now()) / 1000);
  const abs = Math.abs(s);
  if (abs < 60) return 'just now';
  if (abs < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  if (abs < 7 * 86400) return rtf.format(Math.round(s / 86400), 'day');
  return new Date(ms).toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

/** The notifications themselves, newest first. Clicking one opens its task. */
export default function NotificationList() {
  const { available, loaded, ready, items, unread, showList, markRead, markAllRead, remove } = useNotifications();
  const { tasks, loaded: tasksLoaded, openPreview } = useWorkspace();
  const params = useSearchParams();
  const router = useRouter();
  const opened = useRef<string | null>(null);

  // Arrived from a tapped push (/notifications?task=…): open that task once the tasks are in.
  useEffect(() => { showList(); }, [showList]);
  const fromPush = params.get('task');
  useEffect(() => {
    if (!fromPush || !tasksLoaded || !loaded || opened.current === fromPush) return;
    opened.current = fromPush;
    if (tasks.some(t => t.id === fromPush)) openPreview(fromPush);
    items.filter(n => n.taskId === fromPush && !n.read).forEach(n => markRead(n.id));
    router.replace('/notifications', { scroll: false });
  }, [fromPush, tasksLoaded, loaded, tasks, items, openPreview, markRead, router]);

  if (!available) return <div className="notice">Sign in to get notifications about overdue tasks on your devices.</div>;
  if (!ready) return <div className="notice warn">Notifications are not set up in the database yet.</div>;
  if (!loaded) return <div className="notice">Loading notifications.</div>;

  const open = (n: AppNotification) => {
    if (!n.read) markRead(n.id);
    if (n.taskId && tasks.some(t => t.id === n.taskId)) openPreview(n.taskId);
  };

  return (
    <section className="panel notif-panel" aria-labelledby="notif-head">
      <div className="notif-head">
        <h2 id="notif-head">{unread ? `${unread} unread` : 'All caught up'}</h2>
        {unread > 0 && <button type="button" className="ghost" onClick={markAllRead}><IconDone size={16} />Mark all as read</button>}
      </div>
      {items.length === 0 ? (
        <div className="notif-empty">
          <IconBell size={28} />
          <p>No notifications yet. When a task’s deadline passes, it shows up here.</p>
        </div>
      ) : (
        <ul className="notif-list">
          {items.map(n => {
            const gone = n.taskId !== null && !tasks.some(t => t.id === n.taskId);
            return (
              <li key={n.id} className={'notif' + (n.read ? '' : ' is-unread') + ' is-' + n.kind}>
                <button type="button" className="notif-main" onClick={() => open(n)} disabled={n.read && (gone || !n.taskId)}>
                  <span className="notif-icon" aria-hidden="true">{n.kind === 'overdue' ? <IconAlert size={18} /> : <IconBell size={18} />}</span>
                  <span className="notif-text">
                    <b>{n.title}</b>
                    <span>{n.body}{gone && n.kind === 'overdue' ? ' The task was deleted.' : ''}</span>
                  </span>
                  <time dateTime={new Date(n.createdAt).toISOString()} title={new Date(n.createdAt).toLocaleString()}>{ago(n.createdAt)}</time>
                  {!n.read && <span className="notif-dot" aria-label="Unread" />}
                </button>
                <button type="button" className="dlg-x notif-del" aria-label="Remove notification" onClick={() => remove(n.id)}><IconClose size={16} /></button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
