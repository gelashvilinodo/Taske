'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { isDate } from '@/lib/dates';
import { makeSubs, PRIORITIES, STATUSES, type PriorityId, type StatusId, type Subtask } from '@/lib/tasks/model';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import ProjectSelect from '@/components/projects/ProjectSelect';
import DatePicker from '@/components/ui/DatePicker';
import { IconCalendar, IconClock, IconClose, IconDescription, IconDoing, IconDone, IconEdit, IconFlag, IconPlus, IconSave, IconSubtasks, IconTodo, IconTrash } from '@/components/shell/icons';

/** Small status glyph inside the status radio buttons; canceled keeps text only. */
const StatusIcon = ({ id }: { id: string }) => (id === 'todo' ? <IconTodo size={14} /> : id === 'doing' ? <IconDoing size={14} /> : id === 'done' ? <IconDone size={14} /> : <IconClose size={14} />);

interface Draft {
  title: string; description: string; subtasks: Subtask[]; newSub: string;
  status: StatusId; priority: PriorityId; project: string; day: string; deadline: string;
}

/** Edit dialog for one task. Opens when the workspace's editingId is set. */
export default function TaskEditor() {
  const { tasks, projects, editingId, openEditor, patchTask, removeTask, toast } = useWorkspace();
  const dialog = useRef<HTMLDialogElement>(null);
  const newSubInput = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    const t = tasks.find(x => x.id === editingId);
    if (!editingId || !t) { if (dialog.current?.open) dialog.current.close(); return; }
    if (dialog.current?.open) return;
    setDraft({
      title: t.title, description: t.description, subtasks: t.subtasks.map(s => ({ ...s })), newSub: '',
      status: t.status, priority: t.priority, project: t.project, day: t.day, deadline: t.deadline,
    });
    setArmed(false);
    dialog.current?.showModal();
    // Only (re)open when a different task is chosen, not on every data refresh.
  }, [editingId]);

  const set = (patch: Partial<Draft>) => setDraft(d => (d ? { ...d, ...patch } : d));
  const close = () => dialog.current?.close();

  const addSub = () => {
    if (!draft) return;
    set({ subtasks: draft.subtasks.concat(makeSubs(draft.newSub)), newSub: '' });
    newSubInput.current?.focus();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!draft || !editingId) return;
    const title = draft.title.trim();
    if (!title || !isDate(draft.day)) return;
    patchTask(editingId, {
      title: title.slice(0, 500),
      description: draft.description.trim().slice(0, 5000),
      priority: draft.priority,
      subtasks: draft.subtasks.concat(makeSubs(draft.newSub))
        .map(s => ({ id: s.id, title: s.title.trim().slice(0, 300), done: !!s.done }))
        .filter(s => s.title),
      project: projects.some(p => p.id === draft.project) ? draft.project : '',
      status: draft.status,
      day: draft.day,
      deadline: draft.deadline || '',
    });
    close();
  };

  const del = () => {
    if (!armed) { setArmed(true); return; }
    const id = editingId;
    close();
    if (id) { removeTask(id); toast('Task deleted'); }
  };

  return (
    <dialog id="editor" ref={dialog} onClose={e => { if (e.target === e.currentTarget) openEditor(null); }}>
      {draft && (
        <form className="dlg" autoComplete="off" onSubmit={submit}>
          <h3 className="dlg-title"><IconEdit size={20} />Edit task</h3>
          <label className="field"><span><IconSubtasks size={14} />Task</span>
            <textarea className="input" rows={2} required value={draft.title} onChange={e => set({ title: e.target.value })} />
          </label>
          <label className="field"><span><IconDescription size={14} />Description</span>
            <textarea id="editDesc" className="input" rows={3} placeholder="Details, links, who to check with"
              value={draft.description} onChange={e => set({ description: e.target.value })} />
          </label>
          <div className="field">
            <span className="fieldset-label"><IconSubtasks size={14} />Subtasks</span>
            <div className="sub-edit">
              {draft.subtasks.map((s, i) => (
                <div className="sub-row" key={s.id}>
                  <input type="checkbox" aria-label="Done" checked={s.done}
                    onChange={e => set({ subtasks: draft.subtasks.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)) })} />
                  <input className="input" type="text" aria-label="Subtask" value={s.title}
                    onChange={e => set({ subtasks: draft.subtasks.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); newSubInput.current?.focus(); } }} />
                  <button className="sub-del" type="button" aria-label="Remove subtask"
                    onClick={() => set({ subtasks: draft.subtasks.filter((_, j) => j !== i) })}><IconClose size={16} /></button>
                </div>
              ))}
            </div>
            <div className="sub-new">
              <input ref={newSubInput} className="input" type="text" placeholder="Add a subtask and press Enter" aria-label="New subtask"
                value={draft.newSub} onChange={e => set({ newSub: e.target.value })}
                onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); addSub(); } }} />
              <button className="ghost" type="button" onClick={addSub}><IconPlus size={16} />Add</button>
            </div>
          </div>
          <div className="field">
            <span className="fieldset-label"><IconDone size={14} />Status</span>
            <div className="radios">
              {STATUSES.map(s => (
                <label key={s.id}><input type="radio" name="editStatus" value={s.id} checked={draft.status === s.id} onChange={() => set({ status: s.id })} /><StatusIcon id={s.id} />{s.name}</label>
              ))}
            </div>
          </div>
          <div className="field">
            <span className="fieldset-label"><IconFlag size={14} />Priority</span>
            <div className="radios">
              {[{ id: '' as const, name: 'None' }, ...PRIORITIES].map(p => (
                <label key={p.id}><input type="radio" name="editPriority" value={p.id} checked={draft.priority === p.id} onChange={() => set({ priority: p.id })} />{p.name}</label>
              ))}
            </div>
          </div>
          <ProjectSelect value={draft.project} onChange={id => set({ project: id })} />
          <div className="two">
            <div className="field"><span id="editDayLbl"><IconCalendar size={14} />Day</span>
              <DatePicker value={draft.day} onChange={v => set({ day: v })} labelledBy="editDayLbl" clearable={false} />
            </div>
            <div className="field"><span id="editDeadlineLbl"><IconClock size={14} />Deadline</span>
              <DatePicker value={draft.deadline} onChange={v => set({ deadline: v })} labelledBy="editDeadlineLbl" placeholder="No deadline" />
            </div>
          </div>
          <div className="dlg-foot">
            <button className={'danger' + (armed ? ' armed' : '')} type="button" onClick={del}><IconTrash size={16} />{armed ? 'Confirm delete' : 'Delete'}</button>
            <div>
              <button className="ghost" type="button" onClick={close}>Cancel</button>
              <button className="primary" type="submit"><IconSave size={16} />Save</button>
            </div>
          </div>
        </form>
      )}
    </dialog>
  );
}
