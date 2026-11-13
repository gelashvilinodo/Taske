'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { ADD_ON_DAY } from './addTaskEvents';
import type { AddRequest } from './AddTaskForm';

const AddTaskForm = dynamic(() => import('./AddTaskForm'), { ssr: false });

/**
 * The New task window, mounted once for every page so any "+" (header, column, phone bar) can open it.
 * Its code is only loaded when a "+" is first pressed (or once the page is idle), not with the page.
 */
export default function AddTaskHost() {
  const { readOnly } = useWorkspace();
  const [request, setRequest] = useState<AddRequest | null>(null);
  useEffect(() => {
    const onAdd = (e: Event) => setRequest(r => ({ day: (e as CustomEvent<string>).detail ?? '', n: (r?.n ?? 0) + 1 }));
    window.addEventListener(ADD_ON_DAY, onAdd);
    return () => window.removeEventListener(ADD_ON_DAY, onAdd);
  }, []);
  return readOnly || !request ? null : <AddTaskForm request={request} />;
}
