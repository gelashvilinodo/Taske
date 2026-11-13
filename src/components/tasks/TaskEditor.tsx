'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { isDate } from '@/lib/dates';
import { cancelOpenSubs, makeSubs, PRIORITIES, sortSubs, STATUSES, subClosed, toggledSub, type PriorityId, type StatusId, type Subtask } from '@/lib/tasks/model';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import ProjectSelect from '@/components/projects/ProjectSelect';
import DatePicker from '@/components/ui/DatePicker';
import SubtaskGate, { hasOpenSubs } from './SubtaskGate';
import { SubCheck, SubPrioMenu, SubStatusMenu } from './SubtaskList';
import { IconAlert, IconCalendar, IconClock, IconClose, IconDescription, IconDoing, IconDone, IconEdit, IconFlag, IconPlus, IconSave, IconSubtasks, IconTodo, IconTrash } from '@/components/shell/icons';

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
  const [gate, setGate] = useState<Subtask[] | null>(null); // open subtasks to finish before saving as Done

  useEffect(() => {
    const t = tasks.find(x => x.id === editingId);
    if (!editingId || !t) { if (dialog.current?.open) dialog.current.close(); return; }
    if (dialog.current?.open) return;
    setDraft({
      // Rows start in the same order as everywhere else (status, then priority) and stay put while you edit.
      title: t.title, description: t.description, subtasks: sortSubs(t.subtasks).map(s => ({ ...s })), newSub: '',
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

  const finalSubs = (d: Draft) => d.subtasks.concat(makeSubs(d.newSub))
    // Nested subtasks ride along unchanged; they are edited in the task's window.
    .map(s => ({ id: s.id, title: s.title.trim().slice(0, 300), status: s.status, priority: s.priority, subtasks: s.subtasks ?? [] }))
    .filter(s => s.title);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const subs = finalSubs(draft);
    // Done needs every subtask ticked: ask first instead of saving.
    if (draft.status === 'done' && hasOpenSubs(subs)) { setGate(subs); return; }
    save(draft, subs);
  };

  const save = (draft: Draft, subtasks: Subtask[]) => {
    if (!editingId) return;
    const title = draft.title.trim();
    if (!title || !isDate(draft.day)) return;
    patchTask(editingId, {
      title: title.slice(0, 500),
      description: draft.description.trim().slice(0, 5000),
      priority: draft.priority,
      // Canceling the task cancels its open subtasks too.
      subtasks: draft.status === 'canceled' ? cancelOpenSubs(subtasks) : subtasks,
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

  const openSubs = draft ? draft.subtasks.filter(s => s.title.trim() && !subClosed(s)).length + makeSubs(draft.newSub).length : 0;

  return (
    <>
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
                <div className={'sub-row s-' + s.status + (subClosed(s) ? ' is-done' : '')} key={s.id}>
                  <SubCheck status={s.status} onToggle={() => set({ subtasks: draft.subtasks.map((x, j) => (j === i ? toggledSub(x) : x)) })} />
                  <input className="input" type="text" aria-label="Subtask" value={s.title}
                    onChange={e => set({ subtasks: draft.subtasks.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); newSubInput.current?.focus(); } }} />
                  <SubPrioMenu priority={s.priority} onPick={priority => set({ subtasks: draft.subtasks.map((x, j) => (j === i ? { ...x, priority } : x)) })} />
                  <SubStatusMenu status={s.status} onPick={status => set({ subtasks: draft.subtasks.map((x, j) => (j === i ? { ...x, status } : x)) })} />
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
            {draft.status === 'done' && openSubs > 0 && (
              <p className="gate-hint"><IconAlert size={14} />{openSubs === 1 ? '1 subtask is' : openSubs + ' subtasks are'} not done yet. You'll be asked to finish {openSubs === 1 ? 'it' : 'them'} when you save.</p>
            )}
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
    {gate && draft && (
      <SubtaskGate subtasks={gate} onCancel={() => setGate(null)}
        onConfirm={subs => { setGate(null); save(draft, subs); }} />
    )}
    </>
  );
}
