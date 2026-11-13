'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';

const load = {
  preview: () => import('./TaskPreview'),
  editor: () => import('./TaskEditor'),
  history: () => import('@/components/history/TaskHistory'),
  add: () => import('./AddTaskForm'),
};
const TaskPreview = dynamic(load.preview, { ssr: false });
const TaskEditor = dynamic(load.editor, { ssr: false });
const TaskHistory = dynamic(load.history, { ssr: false });

/** True from the first time `on` is true: a window stays mounted after that, so it can close with its animation. */
function useOnce(on: boolean) {
  const [seen, setSeen] = useState(on);
  if (on && !seen) setSeen(true);
  return seen || on;
}

/**
 * The task windows (preview, editor, history). None of them is on screen when a page opens, so their
 * code is not part of the first load: each is mounted the first time it is opened. Once the page is
 * idle their code is fetched in the background, so the first click still opens them straight away.
 */
export default function TaskWindows() {
  const { previewId, editingId, historyId } = useWorkspace();
  const preview = useOnce(!!previewId);
  const editor = useOnce(!!editingId);
  const history = useOnce(!!historyId);

  useEffect(() => {
    const warm = () => { Object.values(load).forEach(f => f().catch(() => undefined)); };
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(warm, { timeout: 5000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(warm, 2500);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      {preview && <TaskPreview />}
      {editor && <TaskEditor />}
      {history && <TaskHistory />}
    </>
  );
}
