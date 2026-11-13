'use client';

import { useEffect, useRef, useState } from 'react';
import { closed, type Project } from '@/lib/tasks/model';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { IconClose, IconEdit, IconPlus } from '@/components/shell/icons';
import { ProjectLogo, projectStyle } from './ProjectBadge';

/** Someone in a project. Only the creator for now; inviting others comes later. */
type Member = { id: string; name: string; email: string };

/**
 * Read-only window for one project, opened by clicking its tile: logo, name, progress and
 * the people in it (the creator first, then everyone added). The + next to "People" will add
 * people once sharing exists; for now a press just says it is coming. Edit opens the editor.
 */
export default function ProjectPreview({ project, onClose, onEdit }: { project: Project | undefined; onClose: () => void; onEdit: (p: Project) => void }) {
  const { tasks, account, readOnly } = useWorkspace();
  const dialog = useRef<HTMLDialogElement>(null);
  const [soon, setSoon] = useState(false);

  useEffect(() => {
    if (!project) { if (dialog.current?.open) dialog.current.close(); return; }
    setSoon(false);
    if (!dialog.current?.open) dialog.current?.showModal();
  }, [project]);

  useEffect(() => {
    if (!soon) return;
    const t = setTimeout(() => setSoon(false), 1600);
    return () => clearTimeout(t);
  }, [soon]);

  const mine = project ? tasks.filter(t => t.project === project.id) : [];
  const open = mine.filter(t => !closed(t)).length;
  const pct = mine.length ? Math.round((mine.length - open) / mine.length * 100) : 0;
  // Projects belong to whoever made them, so the signed-in person is the creator.
  const owner: Member = { id: account?.id ?? 'me', name: account?.name || 'You', email: account?.email ?? '' };
  const members: Member[] = [];

  const close = () => dialog.current?.close();

  return (
    <dialog ref={dialog} id="project-preview" style={project ? projectStyle(project) : undefined}
      onClose={e => { e.stopPropagation(); onClose(); }} aria-labelledby="projectPvTitle">
      {project && (
        <div className="dlg">
          <div className="pv-head">
            <span className="pv-spacer" />
            {!readOnly && (
              <button className="ghost pv-edit" type="button" onClick={() => { close(); onEdit(project); }}><IconEdit size={15} />Edit</button>
            )}
            <button className="dlg-x" type="button" aria-label="Close" title="Close" onClick={close}><IconClose size={18} /></button>
          </div>

          <div className="ppv-hero">
            <ProjectLogo project={project} size="lg" />
            <div className="ppv-hero-text">
              <h3 id="projectPvTitle" className="ppv-title">{project.name}</h3>
              <span className="pj-count">{mine.length ? `${open} open · ${mine.length} total · ${pct}% done` : 'No tasks yet'}</span>
              {mine.length > 0 && <span className="meter pj-meter ppv-meter" aria-hidden="true"><i style={{ width: pct + '%' }} /></span>}
            </div>
          </div>

          <section className="pv-sec" aria-labelledby="projectPvPeople">
            <h4 id="projectPvPeople">
              People <span className="pv-count">{1 + members.length}</span>
              <span className="pv-spacer" />
              {!readOnly && (
                <button type="button" className={'ppv-add' + (soon ? ' is-soon' : '')} onClick={() => setSoon(true)}
                  title="Add people (coming soon)" aria-label={soon ? 'Adding people is coming soon' : 'Add people'}>
                  <IconPlus size={14} />{soon && <span>Coming soon</span>}
                </button>
              )}
            </h4>
            <ul className="ppv-people">
              <PersonRow person={owner} role="Owner" />
              {members.map(m => <PersonRow key={m.id} person={m} />)}
            </ul>
            {!members.length && <p className="ppv-empty">Only you for now. People you add will show up here.</p>}
          </section>
        </div>
      )}
    </dialog>
  );
}

function PersonRow({ person, role }: { person: Member; role?: string }) {
  const initials = person.name.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('') || '?';
  return (
    <li className="ppv-person">
      <span className="ppv-avatar" aria-hidden="true">{initials}</span>
      <span className="ppv-who">
        <span className="ppv-name">{person.name}</span>
        {person.email && person.email !== person.name && <span className="ppv-email">{person.email}</span>}
      </span>
      {role && <span className="ppv-role">{role}</span>}
    </li>
  );
}
