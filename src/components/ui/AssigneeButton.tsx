'use client';

import { useEffect, useState } from 'react';
import { IconAssignee } from '@/components/shell/icons';

/**
 * "Assignee" button for tasks, subtasks and projects. For now it is only the button:
 * choosing people to send the task to comes later, so a press just says so for a moment.
 * `compact` draws the small icon-only pill used on subtask rows.
 */
export default function AssigneeButton({ compact = false }: { compact?: boolean }) {
  const [soon, setSoon] = useState(false);
  useEffect(() => {
    if (!soon) return;
    const t = setTimeout(() => setSoon(false), 1600);
    return () => clearTimeout(t);
  }, [soon]);
  return (
    <button type="button" className={'assignee' + (compact ? ' sub-assignee' : '') + (soon ? ' is-soon' : '')}
      title="Assignee (coming soon)" aria-label={soon ? 'Assigning people is coming soon' : 'Assignee'}
      onClick={e => { e.stopPropagation(); setSoon(true); }}>
      <IconAssignee size={compact ? 13 : 14} />
      {soon ? <span>Coming soon</span> : !compact && <span>Assignee</span>}
    </button>
  );
}
