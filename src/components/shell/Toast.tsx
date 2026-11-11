'use client';

import { useWorkspace } from '@/components/workspace/WorkspaceProvider';

export default function Toast() {
  const { toastMsg } = useWorkspace();
  return <div id="toast" role="status" aria-live="polite" hidden={!toastMsg}>{toastMsg}</div>;
}
