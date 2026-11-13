'use client';

import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { DAYS_S, parse, shortDate, weekday } from '@/lib/dates';
import {
  addSubsUnder, closed, flatSubs, makeSubs, mapSub, PRIORITIES, prioName, removeSub, setSubStatus, STATUSES, statusName, statusPatch,
  subChain, subClosed, subProgress, subtasksPatch, type PriorityId, type StatusId, type Subtask, type Task,
} from '@/lib/tasks/model';
import { ProjectChip } from '@/components/projects/ProjectBadge';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import AssigneeButton from '@/components/ui/AssigneeButton';
import {
  IconCalendar, IconChevronRight, IconClose, IconComment, IconDescription, IconEdit, IconFlag, IconHistory, IconPlus, IconPrev, IconSubtasks, IconTrash,
} from '@/components/shell/icons';
import MenuButton from './MenuButton';
import SubtaskGate, { hasOpenSubs } from './SubtaskGate';
import { SubTree } from './SubtaskList';
import { Comments, DeadlineChip } from './TaskCard';

const PRIO_ITEMS = [...PRIORITIES, { id: '', name: 'No priority' }] as const;
/** The gate's target when it is the task itself rather than one of its subtasks. */
const TASK = '';

/**
 * Read-and-act window for one task, opened by clicking a task. Shows everything about it,
 * and lets you work through its subtasks, change statuses and comment without opening the editor.
 * Clicking a subtask opens that subtask in the same window, with a path back up to the task.
 * Subtasks nest without limit; each level is indented under its parent.
 */
export default function TaskPreview() {
  const { tasks, previewId, openPreview, openHistory, openEditor, patchTask, removeTask, removeComment, toast, readOnly, projectById, comments } = useWorkspace();
  const dialog = useRef<HTMLDialogElement>(null);
  const [gate, setGate] = useState<string | null>(null); // TASK, or a subtask id, waiting for its subtasks to be finished
  const [newSub, setNewSub] = useState('');
  const [armed, setArmed] = useState(false); // first Delete press asks to confirm
  const [subId, setSubId] = useState<string | null>(null); // subtask shown in the window, or null for the task
  const t = tasks.find(x => x.id === previewId);
  const chain = t && subId ? subChain(t.subtasks, subId) : null;
  const sub = chain ? chain[chain.length - 1] : null;

  useEffect(() => {
    if (!previewId || !t) { if (dialog.current?.open) dialog.current.close(); return; }
    if (dialog.current?.open) return;
    setNewSub('');
    setGate(null);
    setArmed(false);
    setSubId(null);
    dialog.current?.showModal();
    // Only (re)open when a different task is chosen, not on every data refresh.
  }, [previewId, !!t]);

  // A subtask that disappears (deleted here or elsewhere) sends the window back to the task.
  useEffect(() => { if (subId && t && !sub) setSubId(null); }, [subId, t, sub]);

  // Escape inside a subtask goes one level up instead of closing the window. Handled on the key press
  // (Chrome lets a page block the window's own close only once in a row), and on the document, since
  // focus can be on the page body after the view changes.
  const parentId = chain ? (chain.length > 1 ? chain[chain.length - 2].id : null) : undefined;
  useEffect(() => {
    if (parentId === undefined) return;
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || !dialog.current?.open || document.querySelector('dialog.gate[open], dialog#history[open]')) return;
      e.preventDefault();
      go(parentId);
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [parentId]);

  /** Shows another subtask (or the task, with null). */
  const go = (id: string | null) => {
    setSubId(id);
    setNewSub('');
    setArmed(false);
    // Keep focus inside the window (the button that was pressed is gone after the switch).
    requestAnimationFrame(() => {
      const box = dialog.current?.querySelector<HTMLElement>('.dlg');
      box?.scrollTo({ top: 0 });
      box?.focus({ preventScroll: true });
    });
  };

  const close = () => dialog.current?.close();
  const writable = !readOnly;

  const edit = () => {
    if (!t) return;
    const id = t.id;
    close();
    openEditor(id);
  };

  const putSubs = (subtasks: Subtask[]) => { if (t) patchTask(t.id, subtasksPatch(t, subtasks)); };

  /** Status change for a subtask anywhere in the tree. Done waits until its own subtasks are finished. */
  const subStatus = (id: string, status: StatusId) => {
    if (!t) return;
    const node = subChain(t.subtasks, id)?.at(-1);
    if (status === 'done' && node && hasOpenSubs(node.subtasks)) { setGate(id); return; }
    putSubs(setSubStatus(t.subtasks, id, status));
  };

  const del = () => {
    if (!t) return;
    if (!armed) { setArmed(true); return; }
    if (sub && chain) {
      // Comments on this subtask and on everything under it go with it.
      const gone = new Set(flatSubs([sub]).map(s => s.id));
      (comments[t.id] || []).filter(c => gone.has(c.subId)).forEach(c => removeComment(t.id, c.id));
      putSubs(removeSub(t.subtasks, sub.id));
      go(chain.length > 1 ? chain[chain.length - 2].id : null);
      return;
    }
    const id = t.id;
    close();
    removeTask(id);
    toast('Task deleted');
  };

  const addSub = () => {
    if (!t) return;
    const subs = makeSubs(newSub);
    if (!subs.length) return;
    putSubs(addSubsUnder(t.subtasks, sub?.id ?? '', subs));
    setNewSub('');
  };

  const d = t ? parse(t.day) : null;
  // What the window is showing: the task, or one subtask. Both look alike.
  const kids = sub ? sub.subtasks : t?.subtasks ?? [];
  const sp = subProgress(kids);
  const taskComments = t ? comments[t.id] || [] : [];
  // Comments on what the window shows: the task's own, or this subtask's.
  const nComments = taskComments.filter(c => c.subId === (sub?.id ?? '')).length;
  const subComments = (id: string) => taskComments.filter(c => c.subId === id).length;
  const gateSubs = t && gate !== null ? (gate === TASK ? t.subtasks : subChain(t.subtasks, gate)?.at(-1)?.subtasks) : null;

  return (
    <>
      <dialog id="preview" ref={dialog} aria-labelledby="previewTitle"
        onClose={e => { if (e.target === e.currentTarget) openPreview(null); }}
        // Escape inside a subtask goes one level up instead of closing the window
        // A click on the dimmed area around the window closes it
        onClick={e => { if (e.target === e.currentTarget) close(); }}>
        {t && d && (
          <div className="dlg pv" key={sub?.id ?? 'task'} tabIndex={-1}>
            {sub && chain ? (
              <>
                <div className="pv-head">
                  <nav className="pv-path" aria-label="Where this subtask is">
                    <button type="button" className="pv-crumb" title={t.title} onClick={() => go(null)}>
                      <IconSubtasks size={13} /><span>{t.title}</span>
                    </button>
                    {chain.slice(0, -1).map(a => (
                      <Fragment key={a.id}>
                        <IconChevronRight size={12} className="pv-sep" />
                        <button type="button" className="pv-crumb" title={a.title} onClick={() => go(a.id)}><span>{a.title}</span></button>
                      </Fragment>
                    ))}
                  </nav>
                  <button className="dlg-x" type="button" aria-label="Close" title="Close" onClick={close}><IconClose size={18} /></button>
                </div>
                <div className="pv-pills">
                  {writable ? <>
                    <MenuButton className={'status s-' + sub.status} title="Change status" ariaLabel={'Status: ' + statusName(sub.status) + '. Click to change'}
                      items={STATUSES} current={sub.status} onPick={id => subStatus(sub.id, id as StatusId)}>
                      {statusName(sub.status)}
                    </MenuButton>
                    <MenuButton className={'prio ' + (sub.priority ? 'pr-' + sub.priority : 'none')} title="Change priority"
                      ariaLabel={'Priority: ' + (sub.priority ? prioName(sub.priority) : 'none') + '. Click to change'}
                      items={PRIO_ITEMS} current={sub.priority}
                      onPick={id => putSubs(mapSub(t.subtasks, sub.id, s => ({ ...s, priority: id as PriorityId })))}>
                      <IconFlag size={14} />{sub.priority ? prioName(sub.priority) : 'Priority'}
                    </MenuButton>
                    <AssigneeButton />
                  </> : <>
                    <span className={'status s-' + sub.status}>{statusName(sub.status)}</span>
                    {sub.priority && <span className={'prio pr-' + sub.priority}><IconFlag size={14} />{prioName(sub.priority)}</span>}
                  </>}
                </div>
                <EditableTitle value={sub.title} max={300} closed={subClosed(sub)} writable={writable}
                  onSave={title => putSubs(mapSub(t.subtasks, sub.id, s => ({ ...s, title })))} />
              </>
            ) : (
              <>
                <div className="pv-head">
                  {writable ? (
                    <MenuButton className={'status s-' + t.status} title="Change status" ariaLabel={'Status: ' + statusName(t.status) + '. Click to change'}
                      items={STATUSES} current={t.status}
                      onPick={id => {
                        if (id === 'done' && hasOpenSubs(t.subtasks)) { setGate(TASK); return; }
                        patchTask(t.id, statusPatch(t, id as Task['status']));
                      }}>
                      {statusName(t.status)}
                    </MenuButton>
                  ) : <span className={'status s-' + t.status}>{statusName(t.status)}</span>}
                  {writable ? (
                    <MenuButton className={'prio ' + (t.priority ? 'pr-' + t.priority : 'none')} title="Change priority"
                      ariaLabel={'Priority: ' + (t.priority ? prioName(t.priority) : 'none') + '. Click to change'}
                      items={PRIO_ITEMS} current={t.priority}
                      onPick={id => patchTask(t.id, { priority: id as Task['priority'] })}>
                      <IconFlag size={14} />{t.priority ? prioName(t.priority) : 'Priority'}
                    </MenuButton>
                  ) : t.priority ? <span className={'prio pr-' + t.priority}><IconFlag size={14} />{prioName(t.priority)}</span> : null}
                  {writable && <AssigneeButton />}
                  <span className="pv-spacer" />
                  <button className="ghost pv-hist" type="button" title="Everything that happened to this task" onClick={() => openHistory(t.id)}>
                    <IconHistory size={16} />History
                  </button>
                  <button className="dlg-x" type="button" aria-label="Close" title="Close" onClick={close}><IconClose size={18} /></button>
                </div>

                <EditableTitle value={t.title} max={500} closed={closed(t)} writable={writable}
                  onSave={title => patchTask(t.id, { title })} />

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
              </>
            )}

            {(kids.length > 0 || writable) && (
              <section className="pv-sec">
                <h4>
                  <IconSubtasks size={14} />Subtasks
                  {sp.total > 0 && <b className="pv-count">{sp.done}/{sp.total}</b>}
                  {sp.total > 0 && <span className="meter"><i style={{ width: Math.round(sp.done / sp.total * 100) + '%' }} /></span>}
                </h4>
                {kids.length > 0 && (
                  <div className="pv-subs">
                    <SubTree subs={kids} onStatus={writable ? subStatus : undefined} onOpen={go} comments={subComments}
                      onPriority={writable ? (id, priority) => putSubs(mapSub(t.subtasks, id, s => ({ ...s, priority }))) : undefined} />
                  </div>
                )}
                {writable && (
                  <div className="sub-new">
                    <input className="input" type="text" placeholder="Add a subtask and press Enter" aria-label="New subtask"
                      value={newSub} onChange={e => setNewSub(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); addSub(); } }} />
                    <button className="ghost" type="button" onClick={addSub} disabled={!newSub.trim()}><IconPlus size={16} />Add</button>
                  </div>
                )}
              </section>
            )}

            {(writable || nComments > 0) && (
              <section className="pv-sec">
                <h4><IconComment size={14} />Comments{nComments > 0 && <b className="pv-count">{nComments}</b>}</h4>
                <Comments t={t} subId={sub?.id ?? ''} writable={writable} focusSignal={0} />
              </section>
            )}

            {(writable || chain) && (
              <div className="dlg-foot pv-foot">
                {writable ? (
                  <button className={'danger' + (armed ? ' armed' : '')} type="button" onClick={del}
                    onBlur={() => setArmed(false)}>
                    <IconTrash size={16} />{armed ? (sub?.subtasks.length ? 'Delete with its subtasks' : 'Confirm delete') : 'Delete'}
                  </button>
                ) : <span />}
                {chain ? (
                  <button className="ghost" type="button" onClick={() => go(chain.length > 1 ? chain[chain.length - 2].id : null)}>
                    <IconPrev size={16} />Back
                  </button>
                ) : <button className="primary" type="button" onClick={edit}><IconEdit size={16} />Edit task</button>}
              </div>
            )}
          </div>
        )}
      </dialog>
      {gate !== null && t && gateSubs && (
        <SubtaskGate subtasks={gateSubs} onCancel={() => setGate(null)}
          onConfirm={subtasks => {
            setGate(null);
            if (gate === TASK) patchTask(t.id, { status: 'done', subtasks });
            else putSubs(mapSub(t.subtasks, gate, s => ({ ...s, status: 'done', subtasks })));
          }} />
      )}
    </>
  );
}

/**
 * The window's title. Clicking it turns it into a text box to rename the task or subtask:
 * Enter or clicking away saves, Escape puts the old name back.
 */
function EditableTitle({ value, max, closed: isClosed, writable, onSave }: {
  value: string; max: number; closed: boolean; writable: boolean; onSave: (title: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const editing = draft !== null;

  const fit = () => { const el = box.current; if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } };
  useLayoutEffect(() => {
    if (!editing || !box.current) return;
    fit();
    box.current.focus();
    box.current.select();
  }, [editing]);

  const save = () => {
    if (draft === null) return;
    const title = draft.trim().slice(0, max);
    setDraft(null);
    if (title && title !== value) onSave(title);
  };

  if (editing) return (
    <textarea ref={box} id="previewTitle" className="input pv-title-input" rows={1} aria-label="Name" maxLength={max}
      value={draft} onChange={e => { setDraft(e.target.value); fit(); }} onBlur={save}
      onKeyDown={e => {
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); save(); }
        // preventDefault keeps Escape from also closing the window
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setDraft(null); }
      }} />
  );
  return (
    <h3 id="previewTitle" className={'pv-title' + (isClosed ? ' is-closed' : '')}>
      {writable ? (
        <button type="button" className="pv-title-btn" title="Click to rename" onClick={() => setDraft(value)}>
          {value}<IconEdit size={16} className="pv-title-ic" />
        </button>
      ) : value}
    </h3>
  );
}
