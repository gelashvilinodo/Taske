'use client';

import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import AddTaskForm from './AddTaskForm';

/** The New task window, mounted once for every page so any "+" (header, column, phone bar) can open it. */
export default function AddTaskHost() {
  const { readOnly } = useWorkspace();
  return readOnly ? null : <AddTaskForm />;
}
