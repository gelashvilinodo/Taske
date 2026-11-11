'use client';

import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { PROJECT_COLORS, PROJECT_NAME_MAX, type Project } from '@/lib/tasks/model';
import { prepareLogo } from '@/lib/tasks/logo';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { ProjectLogo } from './ProjectBadge';

type Draft = { name: string; color: string; logo: string };

/** Create or edit a project: name, colour and logo. `project` null = new, undefined = closed. */
export default function ProjectDialog({ project, onClose, onCreated }: { project: Project | null | undefined; onClose: () => void; onCreated?: (id: string) => void }) {
  const { addProject, updateProject, removeProject, tasks, toast } = useWorkspace();
  const dialog = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Draft>({ name: '', color: PROJECT_COLORS[0], logo: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(false);
  const isNew = project === null;
  const used = project ? tasks.filter(t => t.project === project.id).length : 0;

  useEffect(() => {
    if (project === undefined) { if (dialog.current?.open) dialog.current.close(); return; }
    setDraft(project ? { name: project.name, color: project.color, logo: project.logo } : { name: '', color: PROJECT_COLORS[0], logo: '' });
    setError(''); setArmed(false);
    if (!dialog.current?.open) dialog.current?.showModal();
  }, [project]);

  const set = (p: Partial<Draft>) => setDraft(d => ({ ...d, ...p }));

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true); setError('');
    try { set({ logo: await prepareLogo(file) }); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not use this image.'); }
    finally { setBusy(false); if (fileInput.current) fileInput.current.value = ''; }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    // React events bubble through portals; keep this submit away from a task form behind it.
    e.stopPropagation();
    const name = draft.name.trim().slice(0, PROJECT_NAME_MAX);
    if (!name) { setError('Give the project a name.'); return; }
    if (isNew) {
      const id = addProject({ name, color: draft.color, logo: draft.logo });
      onCreated?.(id);
      toast('Project ' + name + ' created');
    }
    else if (project) updateProject(project.id, { name, color: draft.color, logo: draft.logo });
    dialog.current?.close();
  };

  const remove = () => {
    if (!project) return;
    if (!armed) { setArmed(true); return; }
    removeProject(project.id);
    toast('Project ' + project.name + ' deleted');
    dialog.current?.close();
  };

  const custom = !PROJECT_COLORS.includes(draft.color);

  return (
    <dialog ref={dialog} onClose={e => { e.stopPropagation(); onClose(); }} aria-labelledby="projectDlgTitle">
      <form className="dlg" onSubmit={submit} autoComplete="off">
        <div className="pj-dlg-head">
          <ProjectLogo project={{ name: draft.name || '?', color: draft.color, logo: draft.logo }} size="lg" />
          <h3 id="projectDlgTitle">{isNew ? 'New project' : 'Edit project'}</h3>
        </div>

        <label className="field"><span>Name</span>
          <input className="input" value={draft.name} maxLength={PROJECT_NAME_MAX} placeholder="e.g. Skrib" autoFocus
            onChange={e => set({ name: e.target.value })} />
        </label>

        <div className="field">
          <span className="fieldset-label">Colour</span>
          <div className="swatches" role="radiogroup" aria-label="Colour">
            {PROJECT_COLORS.map(c => (
              <button key={c} type="button" className="swatch" role="radio" aria-checked={draft.color === c} aria-label={c}
                style={{ '--c': c } as CSSProperties} onClick={() => set({ color: c })} />
            ))}
            <label className={'swatch swatch-custom' + (custom ? ' is-on' : '')} style={{ '--c': draft.color } as CSSProperties} title="Any colour">
              <input type="color" value={draft.color} onChange={e => set({ color: e.target.value.toLowerCase() })} aria-label="Pick any colour" />
              <span aria-hidden="true">+</span>
            </label>
          </div>
        </div>

        <div className="field">
          <span className="fieldset-label">Logo</span>
          <div className="logo-row">
            <button className="ghost" type="button" disabled={busy} onClick={() => fileInput.current?.click()}>
              {busy ? 'Preparing…' : draft.logo ? 'Replace logo' : 'Upload logo'}
            </button>
            {draft.logo && <button className="ghost" type="button" onClick={() => set({ logo: '' })}>Remove</button>}
            <span className="logo-hint">PNG, JPG, SVG or WebP, up to 5 MB. Shrunk to {128}px.</span>
            <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif" hidden
              onChange={e => pickFile(e.target.files?.[0])} />
          </div>
        </div>

        {error && <p className="form-error" role="alert">{error}</p>}

        <div className="dlg-foot">
          {!isNew ? (
            <button className={'danger' + (armed ? ' armed' : '')} type="button" onClick={remove}>
              {armed ? (used ? `Delete, ${used} task${used === 1 ? '' : 's'} keep no project` : 'Confirm delete') : 'Delete'}
            </button>
          ) : <span />}
          <div>
            <button className="ghost" type="button" onClick={() => dialog.current?.close()}>Cancel</button>
            <button className="primary" type="submit" disabled={busy}>{isNew ? 'Create project' : 'Save'}</button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
