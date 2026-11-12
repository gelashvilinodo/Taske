'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { addDays, commentTime, DAYS_S, iso, parse, shortDate, today, weekday } from '@/lib/dates';
import { closed, PRIORITIES, prioName, STATUSES, statusName, statusPatch, subProgress, subtasksPatch, type Task } from '@/lib/tasks/model';
import { ProjectChip, projectStyle } from '@/components/projects/ProjectBadge';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { IconCalendar, IconClock, IconComment, IconFlag, IconSend, IconSubtasks } from '@/components/shell/icons';
import MenuButton from './MenuButton';
import { useTaskDragSource } from './TaskDrag';
import SubtaskGate, { hasOpenSubs } from './SubtaskGate';
import SubtaskList from './SubtaskList';

function DeadlineChip({ t }: { t: Task }) {
  if (!t.deadline) return null;
  const td = iso(today());
  const label = shortDate(parse(t.deadline));
  const chip = (cls: string, text: string) => <span className={'chip chip-ic' + cls}><IconClock size={13} />{text}</span>;
  if (closed(t)) return chip('', 'Due ' + label);
  if (t.deadline < td) return chip(' is-over', 'Overdue, ' + label);
  if (t.deadline === td) return chip(' is-soon', 'Due today');
  if (t.deadline === iso(addDays(today(), 1))) return chip(' is-soon', 'Due tomorrow');
  return chip('', 'Due ' + label);
}

function Description({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  const long = text.length > 90 || text.split('\n').length > 3;
  return (
    <>
      <p className={'card-desc' + (long && !open ? ' clamp' : '')}>{text}</p>
      {long && <button className="more" type="button" aria-expanded={open} onClick={() => setOpen(o => !o)}>{open ? 'Less' : 'More'}</button>}
    </>
  );
}

function Subtasks({ t, writable, controls }: { t: Task; writable: boolean; controls: boolean }) {
  const { patchTask } = useWorkspace();
  if (!t.subtasks.length) return null;
  const { done, total } = subProgress(t.subtasks);
  // The whole list always shows on the card; clicking a subtask opens its status menu.
  return (
    <>
      <div className="sub-head">
        <IconSubtasks size={14} /><span>Subtasks</span><b>{done}/{total}</b>
        <span className="meter"><i style={{ width: (total ? Math.round(done / total * 100) : 100) + '%' }} /></span>
      </div>
      <SubtaskList subs={t.subtasks} pick onChange={controls ? subtasks => { if (writable) patchTask(t.id, subtasksPatch(t, subtasks)); } : undefined} />
    </>
  );
}

export function Comments({ t, writable, focusSignal }: { t: Task; writable: boolean; focusSignal: number }) {
  const { comments, names, account, mode, addComment, removeComment } = useWorkspace();
  const [draft, setDraft] = useState('');
  const [armed, setArmed] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (focusSignal) box.current?.focus({ preventScroll: true }); }, [focusSignal]);
  const list = comments[t.id] || [];
  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    addComment(t.id, text);
  };
  const canDelete = (by: string) => mode === 'local' || by === account?.id;
  return (
    <div className="cmts">
      {list.map(c => (
        <div className="cmt" key={c.id}>
          <div className="cmt-head">
            {c.by && names[c.by] && <b>{names[c.by]}</b>}
            <span className="cmt-time">{commentTime(c.at)}</span>
            {writable && canDelete(c.by) && (
              <button className={'cmt-del' + (armed === c.id ? ' armed' : '')} type="button"
                onClick={() => { if (armed !== c.id) { setArmed(c.id); return; } setArmed(null); removeComment(t.id, c.id); }}>
                {armed === c.id ? 'Confirm delete' : 'Delete'}
              </button>
            )}
          </div>
          <p>{c.text}</p>
        </div>
      ))}
      {writable && (
        <div className="cmt-new">
          <textarea ref={box} className="input" rows={1} placeholder="Write a comment" aria-label="Write a comment" value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} />
          <button className="icon-btn cmt-send" type="button" aria-label="Send comment" title="Send" onClick={send}><IconSend size={16} /></button>
        </div>
      )}
    </div>
  );
}

export { DeadlineChip };

/** One task on the board. `showDay` adds the day chip (used where cards are not grouped by day). */
function TaskCard({ t, showDay = false, ghost = false }: { t: Task; showDay?: boolean; ghost?: boolean }) {
  const { readOnly, patchTask, openPreview, comments, projectById } = useWorkspace();
  const { dragId, begin } = useTaskDragSource();
  const writable = !readOnly && !ghost;
  // The dragged copy (ghost) is drawn with exactly the same buttons as the card it was lifted from, so
  // nothing in it moves; it just can't be used (the ghost is inert and ignores the pointer).
  const controls = !readOnly;
  const lifted = !ghost && dragId === t.id;
  const project = projectById(t.project);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentsShown, setCommentsShown] = useState(false); // stays true while the panel animates shut
  const [focusSignal, setFocusSignal] = useState(0);
  const [gate, setGate] = useState(false); // asking to finish subtasks before moving to Done
  const n = (comments[t.id] || []).length;
  const d = parse(t.day);

  // Once closed, keep the panel mounted for its slide-shut animation (240ms), then drop it.
  useEffect(() => {
    if (commentsOpen || !commentsShown) return;
    const t = setTimeout(() => setCommentsShown(false), 260);
    return () => clearTimeout(t);
  }, [commentsOpen, commentsShown]);
  const openComments = () => { setCommentsOpen(true); setCommentsShown(true); setFocusSignal(x => x + 1); };

  return (
    <article
      className={'card' + (t.status === 'done' ? ' is-done' : '') + (t.status === 'canceled' ? ' is-canceled' : '') + (lifted ? ' is-drag-source' : '') + (ghost ? ' is-ghost' : '')}
      style={closed(t) ? undefined : projectStyle(project, '--pj')}
      data-task-id={ghost ? undefined : t.id}
      onPointerDown={writable ? e => begin(e, t.id) : undefined}
    >
      {ghost
        ? <span className="card-title">{t.title}</span>
        : <button className="card-title" type="button" onClick={() => openPreview(t.id)}>{t.title}</button>}
      <Description text={t.description} />
      <Subtasks t={t} writable={writable} controls={controls} />
      <div className="meta">
        <ProjectChip project={project} />
        {showDay && <span className="chip chip-ic"><IconCalendar size={13} />{DAYS_S[weekday(d)]}, {shortDate(d)}</span>}
        <DeadlineChip t={t} />
      </div>
      <div className="card-foot">
        {controls ? (
          <MenuButton className={'status s-' + t.status} title="Change status" ariaLabel={'Status: ' + statusName(t.status) + '. Click to change'}
            items={STATUSES} current={t.status}
            onPick={id => {
              if (!writable) return;
              if (id === 'done' && hasOpenSubs(t.subtasks)) { setGate(true); return; }
              patchTask(t.id, statusPatch(t, id as Task['status']));
            }}>
            {statusName(t.status)}
          </MenuButton>
        ) : <span className={'status s-' + t.status}>{statusName(t.status)}</span>}
        {controls ? (
          <MenuButton className={'prio ' + (t.priority ? 'pr-' + t.priority : 'none')} title="Change priority"
            ariaLabel={'Priority: ' + (t.priority ? prioName(t.priority) : 'none') + '. Click to change'}
            items={[...PRIORITIES, { id: '', name: 'No priority' }]} current={t.priority}
            onPick={id => { if (writable) patchTask(t.id, { priority: id as Task['priority'] }); }}>
            <IconFlag size={14} />{t.priority ? prioName(t.priority) : 'Priority'}
          </MenuButton>
        ) : t.priority ? <span className={'prio pr-' + t.priority}><IconFlag size={14} />{prioName(t.priority)}</span> : null}
        {(controls || n > 0) && (
          <button className={'cmt-btn' + (n ? ' has' : '')} type="button" aria-expanded={commentsOpen}
            onClick={ghost ? undefined : () => (commentsOpen ? setCommentsOpen(false) : openComments())}>
            <IconComment size={14} />{n ? 'Comments ' + n : 'Comment'}
          </button>
        )}
      </div>
      {gate && (
        <SubtaskGate subtasks={t.subtasks} onCancel={() => setGate(false)}
          onConfirm={subtasks => { setGate(false); patchTask(t.id, { status: 'done', subtasks }); }} />
      )}
      {commentsShown && (
        // Slides open (and shut) by animating its height; unmounts once it has closed.
        <div className={'cmts-wrap' + (commentsOpen ? '' : ' is-closing')}>
          <div className="cmts-inner"><Comments t={t} writable={writable} focusSignal={focusSignal} /></div>
        </div>
      )}
    </article>
  );
}

// Memoised: while a card is dragged, the columns re-render to move the gap, but the cards in them don't need to.
export default memo(TaskCard);
