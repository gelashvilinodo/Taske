'use client';

import { useState } from 'react';
import { closed, type Project } from '@/lib/tasks/model';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { IconPlus } from '@/components/shell/icons';
import { ProjectLogo, projectStyle } from './ProjectBadge';
import ProjectDialog from './ProjectDialog';

/** Projects page: a tile per project plus a tile to add one. Click a tile to edit it. */
export default function ProjectsManager() {
  const { projects, tasks, loaded, readOnly } = useWorkspace();
  // null = creating, Project = editing, undefined = dialog closed
  const [editing, setEditing] = useState<Project | null | undefined>(undefined);

  return (
    <>
      <section className="pj-grid" aria-label="Projects">
        {projects.map(p => {
          const mine = tasks.filter(t => t.project === p.id);
          const open = mine.filter(t => !closed(t)).length;
          const pct = mine.length ? Math.round((mine.length - open) / mine.length * 100) : 0;
          return (
            <button key={p.id} type="button" className="pj-tile" style={projectStyle(p)} disabled={readOnly} onClick={() => setEditing(p)}>
              <ProjectLogo project={p} size="lg" />
              <span className="pj-name">{p.name}</span>
              <span className="pj-count">{mine.length ? `${open} open · ${mine.length} total` : 'No tasks yet'}</span>
              <span className="meter pj-meter" aria-label={pct + '% done'} role="img"><i style={{ width: pct + '%' }} /></span>
            </button>
          );
        })}
        {!readOnly && (
          <button type="button" className="pj-tile pj-new" onClick={() => setEditing(null)}>
            <span className="pj-new-icon"><IconPlus width={22} height={22} /></span>
            <span className="pj-name">New project</span>
            <span className="pj-count">Name, colour and logo</span>
          </button>
        )}
      </section>
      {loaded && !projects.length && (
        <p className="notice">You have no projects yet. Create one, then pick it when you add a task.</p>
      )}
      <ProjectDialog project={editing} onClose={() => setEditing(undefined)} />
    </>
  );
}
