import { redirect } from 'next/navigation';
import WorkspaceProvider from '@/components/workspace/WorkspaceProvider';
import NotificationsProvider from '@/components/notifications/NotificationsProvider';
import AppHeader from '@/components/shell/AppHeader';
import Sidebar from '@/components/shell/Sidebar';
import Toast from '@/components/shell/Toast';
import TaskEditor from '@/components/tasks/TaskEditor';
import TaskPreview from '@/components/tasks/TaskPreview';
import AddTaskHost from '@/components/tasks/AddTaskHost';
import DragEdges from '@/components/tasks/DragEdges';
import TaskDragProvider from '@/components/tasks/TaskDrag';
import { supabaseEnabled } from '@/lib/supabase/config';
import { isSignedIn } from '@/lib/supabase/server';

/** Everything behind sign-in: shared header, page tabs and the task data for all pages. */
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  if (supabaseEnabled && !(await isSignedIn())) redirect('/login');
  return (
    <WorkspaceProvider>
      <NotificationsProvider>
      <TaskDragProvider>
      <div className="shell">
        <Sidebar />
        <div className="main-col">
          <AppHeader />
          <div className="window">
            <div className="window-blur" aria-hidden="true"><i /><i /><i /></div>
            <div className="page-scroll">
              <div className="app">{children}</div>
            </div>
          </div>
        </div>
      </div>
      <TaskPreview />
      <TaskEditor />
      <AddTaskHost />
      <DragEdges />
      <Toast />
      </TaskDragProvider>
      </NotificationsProvider>
    </WorkspaceProvider>
  );
}
