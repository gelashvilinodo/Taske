'use client';

import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { IconFolder, IconPlus } from '@/components/shell/icons';
import Dropdown from '@/components/ui/Dropdown';
import { ProjectLogo } from './ProjectBadge';
import ProjectDialog from './ProjectDialog';

/**
 * Project field for task forms: our own glass dropdown (logo + name per project)
 * with a "+" button beside it. The "+" opens the New project dialog; the new project is picked straight away.
 */
export default function ProjectSelect({ value, onChange, className = '' }: { value: string; onChange: (id: string) => void; className?: string }) {
  const { projects, projectsReady, readOnly } = useWorkspace();
  const labelId = useId() + 'l';
  const [creating, setCreating] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const none = <span className="pick-none" aria-hidden="true" />;
  const options = [
    { value: '', label: 'No project', leading: none },
    ...projects.map(p => ({ value: p.id, label: p.name, leading: <ProjectLogo project={p} size="md" /> })),
  ];
  const current = projects.some(p => p.id === value) ? value : '';

  return (
    <div className={('field ' + className).trim()}>
      <span id={labelId}><IconFolder size={14} />Project</span>
      <div className="select-add">
        <Dropdown value={current} options={options} onChange={onChange} labelledBy={labelId} />
        {!readOnly && projectsReady && (
          <button className="add-btn" type="button" aria-label="New project" title="New project" onClick={() => setCreating(true)}>
            <IconPlus />
          </button>
        )}
      </div>
      {/* Portal: the dialog has its own form, and forms cannot sit inside another form. */}
      {mounted && createPortal(
        <ProjectDialog project={creating ? null : undefined} onClose={() => setCreating(false)} onCreated={onChange} />,
        document.body,
      )}
    </div>
  );
}
