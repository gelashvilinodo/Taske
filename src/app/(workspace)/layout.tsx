import { redirect } from 'next/navigation';
import WorkspaceProvider from '@/components/workspace/WorkspaceProvider';
import AppHeader from '@/components/shell/AppHeader';
import Sidebar from '@/components/shell/Sidebar';
import Toast from '@/components/shell/Toast';
import TaskEditor from '@/components/tasks/TaskEditor';
import DragEdges from '@/components/tasks/DragEdges';
import TaskDragProvider from '@/components/tasks/TaskDrag';
import { supabaseEnabled } from '@/lib/supabase/config';
import { isSignedIn } from '@/lib/supabase/server';

/** Everything behind sign-in: shared header, page tabs and the task data for all pages. */
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  if (supabaseEnabled && !(await isSignedIn())) redirect('/login');
  return (
    <WorkspaceProvider>
      <TaskDragProvider>
      <div className="shell">
        <Sidebar />
        <div className="window">
          <AppHeader />
          <div className="app">{children}</div>
        </div>
      </div>
      <TaskEditor />
      <DragEdges />
      <Toast />
      </TaskDragProvider>
    </WorkspaceProvider>
  );
}
