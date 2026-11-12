import { Suspense } from 'react';
import PushPrompt from '@/components/notifications/PushPrompt';
import NotificationList from '@/components/notifications/NotificationList';

export const metadata = { title: 'Notifications · Personal Schedule' };

export default function NotificationsPage() {
  return (
    <div className="notif-page">
      <PushPrompt />
      <Suspense fallback={<div className="notice">Loading notifications.</div>}>
        <NotificationList />
      </Suspense>
    </div>
  );
}
