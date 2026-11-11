import { redirect } from 'next/navigation';
import WorkspaceProvider from '@/components/workspace/WorkspaceProvider';
import AppHeader from '@/components/shell/AppHeader';
import PageTabs from '@/components/shell/PageTabs';
import Toast from '@/components/shell/Toast';
import TaskEditor from '@/components/tasks/TaskEditor';
import MoveTray from '@/components/tasks/MoveTray';
import { supabaseEnabled } from '@/lib/supabase/config';
import { isSignedIn } from '@/lib/supabase/server';

/** Everything behind sign-in: shared header, page tabs and the task data for all pages. */
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  if (supabaseEnabled && !(await isSignedIn())) redirect('/login');
  return (
    <WorkspaceProvider>
      <div className="app">
        <AppHeader />
        <PageTabs />
        {children}
      </div>
      <TaskEditor />
      <MoveTray />
      <Toast />
    </WorkspaceProvider>
  );
}
