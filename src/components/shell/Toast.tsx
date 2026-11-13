'use client';

import { useWorkspace } from '@/components/workspace/WorkspaceProvider';

export default function Toast() {
  const { toastMsg, toastAction, toast } = useWorkspace();
  return (
    <div id="toast" role="status" aria-live="polite" hidden={!toastMsg}>
      <span>{toastMsg}</span>
      {toastAction && (
        <button type="button" className="toast-btn" onClick={() => { toastAction.run(); toast(''); }}>{toastAction.label}</button>
      )}
    </div>
  );
}
