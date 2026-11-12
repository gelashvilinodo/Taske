'use client';

import { useEffect, useRef, useState } from 'react';
import { DAYS_S, parse, shortDate, weekday } from '@/lib/dates';
import { closed, makeSubs, PRIORITIES, prioName, STATUSES, statusName, statusPatch, subProgress, subtasksPatch, type Task } from '@/lib/tasks/model';
import { ProjectChip } from '@/components/projects/ProjectBadge';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { IconCalendar, IconClose, IconComment, IconDescription, IconEdit, IconFlag, IconPlus, IconSubtasks, IconTrash } from '@/components/shell/icons';
import MenuButton from './MenuButton';
import SubtaskGate, { hasOpenSubs } from './SubtaskGate';
import SubtaskList from './SubtaskList';
import { Comments, DeadlineChip } from './TaskCard';

/**
 * Read-and-act window for one task, opened by clicking a task. Shows everything about it,
 * and lets you work through its subtasks, change statuses and comment without opening the editor.
 */
export default function TaskPreview() {
  const { tasks, previewId, openPreview, openEditor, patchTask, removeTask, toast, readOnly, projectById, comments } = useWorkspace();
  const dialog = useRef<HTMLDialogElement>(null);
  const [gate, setGate] = useState(false);
  const [newSub, setNewSub] = useState('');
  const [armed, setArmed] = useState(false); // first Delete press asks to confirm
  const t = tasks.find(x => x.id === previewId);

  useEffect(() => {
    if (!previewId || !t) { if (dialog.current?.open) dialog.current.close(); return; }
    if (dialog.current?.open) return;
    setNewSub('');
    setGate(false);
    setArmed(false);
    dialog.current?.showModal();
    // Only (re)open when a different task is chosen, not on every data refresh.
  }, [previewId, !!t]);

  const close = () => dialog.current?.close();
  const writable = !readOnly;

  const edit = () => {
    if (!t) return;
    const id = t.id;
    close();
    openEditor(id);
  };

  const del = () => {
    if (!t) return;
    if (!armed) { setArmed(true); return; }
    const id = t.id;
    close();
    removeTask(id);
    toast('Task deleted');
  };

  const addSub = () => {
    if (!t) return;
    const subs = makeSubs(newSub);
    if (!subs.length) return;
    patchTask(t.id, { subtasks: t.subtasks.concat(subs) });
    setNewSub('');
  };

  const sp = t ? subProgress(t.subtasks) : { done: 0, total: 0 };
  const nComments = t ? (comments[t.id] || []).length : 0;
  const d = t ? parse(t.day) : null;

  return (
    <>
      <dialog id="preview" ref={dialog} aria-labelledby="previewTitle"
        onClose={e => { if (e.target === e.currentTarget) openPreview(null); }}
        // A click on the dimmed area around the window closes it
        onClick={e => { if (e.target === e.currentTarget) close(); }}>
        {t && d && (
          <div className="dlg pv">
            <div className="pv-head">
              {writable ? (
                <MenuButton className={'status s-' + t.status} title="Change status" ariaLabel={'Status: ' + statusName(t.status) + '. Click to change'}
                  items={STATUSES} current={t.status}
                  onPick={id => {
                    if (id === 'done' && hasOpenSubs(t.subtasks)) { setGate(true); return; }
                    patchTask(t.id, statusPatch(t, id as Task['status']));
                  }}>
                  {statusName(t.status)}
                </MenuButton>
              ) : <span className={'status s-' + t.status}>{statusName(t.status)}</span>}
              {writable ? (
                <MenuButton className={'prio ' + (t.priority ? 'pr-' + t.priority : 'none')} title="Change priority"
                  ariaLabel={'Priority: ' + (t.priority ? prioName(t.priority) : 'none') + '. Click to change'}
                  items={[...PRIORITIES, { id: '', name: 'No priority' }]} current={t.priority}
                  onPick={id => patchTask(t.id, { priority: id as Task['priority'] })}>
                  <IconFlag size={14} />{t.priority ? prioName(t.priority) : 'Priority'}
                </MenuButton>
              ) : t.priority ? <span className={'prio pr-' + t.priority}><IconFlag size={14} />{prioName(t.priority)}</span> : null}
              <span className="pv-spacer" />
              <button className="dlg-x" type="button" aria-label="Close" title="Close" onClick={close}><IconClose size={18} /></button>
            </div>

            <h3 id="previewTitle" className={'pv-title' + (closed(t) ? ' is-closed' : '')}>{t.title}</h3>

            <div className="meta">
              <ProjectChip project={projectById(t.project)} />
              <span className="chip chip-ic"><IconCalendar size={13} />{DAYS_S[weekday(d)]}, {shortDate(d)}</span>
              <DeadlineChip t={t} />
            </div>

            {t.description && (
              <section className="pv-sec">
                <h4><IconDescription size={14} />Description</h4>
                <p className="pv-desc">{t.description}</p>
              </section>
            )}

            {(t.subtasks.length > 0 || writable) && (
              <section className="pv-sec">
                <h4>
                  <IconSubtasks size={14} />Subtasks
                  {sp.total > 0 && <b className="pv-count">{sp.done}/{sp.total}</b>}
                  {sp.total > 0 && <span className="meter"><i style={{ width: Math.round(sp.done / sp.total * 100) + '%' }} /></span>}
                </h4>
                {t.subtasks.length > 0 && (
                  <SubtaskList className="sub-list pv-subs" subs={t.subtasks} menus
                    onChange={writable ? subtasks => patchTask(t.id, subtasksPatch(t, subtasks)) : undefined} />
                )}
                {writable && (
                  <div className="sub-new">
                    <input className="input" type="text" placeholder="Add a subtask and press Enter" aria-label="New subtask"
                      value={newSub} onChange={e => setNewSub(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); addSub(); } }} />
                    <button className="ghost" type="button" onClick={addSub}><IconPlus size={16} />Add</button>
                  </div>
                )}
              </section>
            )}

            {(writable || nComments > 0) && (
              <section className="pv-sec">
                <h4><IconComment size={14} />Comments{nComments > 0 && <b className="pv-count">{nComments}</b>}</h4>
                <Comments t={t} writable={writable} focusSignal={0} />
              </section>
            )}

            {writable && (
              <div className="dlg-foot pv-foot">
                <button className={'danger' + (armed ? ' armed' : '')} type="button" onClick={del}
                  onBlur={() => setArmed(false)}>
                  <IconTrash size={16} />{armed ? 'Confirm delete' : 'Delete'}
                </button>
                <button className="primary" type="button" onClick={edit}><IconEdit size={16} />Edit task</button>
              </div>
            )}
          </div>
        )}
      </dialog>
      {gate && t && (
        <SubtaskGate subtasks={t.subtasks} onCancel={() => setGate(false)}
          onConfirm={subtasks => { setGate(false); patchTask(t.id, { status: 'done', subtasks }); }} />
      )}
    </>
  );
}
