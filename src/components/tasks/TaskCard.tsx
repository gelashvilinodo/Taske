'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { addDays, commentTime, DAYS_S, iso, parse, shortDate, today, weekday } from '@/lib/dates';
import { closed, PRIORITIES, prioName, STATUSES, statusName, statusPatch, subProgress, subtasksPatch, type Task } from '@/lib/tasks/model';
import { ProjectChip, projectStyle } from '@/components/projects/ProjectBadge';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { IconCalendar, IconClock, IconComment, IconDone, IconFlag, IconNext, IconSend, IconSubtasks, IconTodo } from '@/components/shell/icons';
import MenuButton from './MenuButton';
import { useTaskDragSource } from './TaskDrag';
import SubtaskGate, { hasOpenSubs } from './SubtaskGate';
import SubtaskList from './SubtaskList';
import { useCardSwipe } from './useCardSwipe';

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

/** Comments on a task, or (with `subId`) on one of its subtasks. */
export function Comments({ t, writable, focusSignal, subId = '' }: { t: Task; writable: boolean; focusSignal: number; subId?: string }) {
  const { comments, names, account, mode, addComment, removeComment } = useWorkspace();
  const [draft, setDraft] = useState('');
  const [armed, setArmed] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (focusSignal) box.current?.focus({ preventScroll: true }); }, [focusSignal]);
  const list = (comments[t.id] || []).filter(c => c.subId === subId);
  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    addComment(t.id, text, subId);
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
          <button className="icon-btn cmt-send" type="button" aria-label="Send comment" title="Send" onClick={send} disabled={!draft.trim()}><IconSend size={16} /></button>
        </div>
      )}
    </div>
  );
}

export { DeadlineChip };

const phone = () => typeof matchMedia === 'function' && matchMedia('(max-width: 767px)').matches;

/** One task on the board. `showDay` adds the day chip (used where cards are not grouped by day).
 *  `swipe` (List page, phone): swipe right marks it done (or back to To do), swipe left moves it to the next day. */
function TaskCard({ t, showDay = false, ghost = false, swipe = false, tapOpen = false, noDrag = false }: { t: Task; showDay?: boolean; ghost?: boolean; swipe?: boolean; tapOpen?: boolean; noDrag?: boolean }) {
  const { readOnly, patchTask, openPreview, comments, projectById, toast } = useWorkspace();
  const { dragId, leaving, begin } = useTaskDragSource();
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
  const n = (comments[t.id] || []).filter(c => !c.subId).length; // the card's comments are the task's own
  const d = parse(t.day);

  // Once closed, keep the panel mounted for its slide-shut animation (240ms), then drop it.
  useEffect(() => {
    if (commentsOpen || !commentsShown) return;
    const t = setTimeout(() => setCommentsShown(false), 260);
    return () => clearTimeout(t);
  }, [commentsOpen, commentsShown]);
  const openComments = () => { setCommentsOpen(true); setCommentsShown(true); setFocusSignal(x => x + 1); };

  const isDone = t.status === 'done';
  const tomorrow = addDays(d, 1);
  const sw = useCardSwipe(swipe && writable,
    () => {
      if (!isDone && hasOpenSubs(t.subtasks)) { setGate(true); return; }
      const before = { status: t.status, subtasks: t.subtasks };
      patchTask(t.id, isDone ? { status: 'todo' } : statusPatch(t, 'done'));
      toast(isDone ? 'Moved back to To do' : 'Marked done', { label: 'Undo', run: () => patchTask(t.id, before) });
    },
    () => {
      const before = t.day;
      patchTask(t.id, { day: iso(tomorrow) });
      toast('Moved to ' + DAYS_S[weekday(tomorrow)] + ', ' + shortDate(tomorrow), { label: 'Undo', run: () => patchTask(t.id, { day: before }) });
    });

  const card = (
    <article
      className={'card' + (t.status === 'done' ? ' is-done' : '') + (t.status === 'canceled' ? ' is-canceled' : '') + (lifted ? ' is-drag-source' + (leaving ? ' is-leaving' : '') : '') + (ghost ? ' is-ghost' : '') + (tapOpen && noDrag ? ' is-tap' : '')}
      style={closed(t) ? undefined : projectStyle(project, '--pj')}
      data-task-id={ghost ? undefined : t.id}
      // `noDrag` (List page, phone): no press-and-hold dragging there. Elsewhere a hold still lifts the
      // card, and the release after a drag never counts as a tap.
      onPointerDown={writable ? e => { if (!(noDrag && phone())) begin(e, t.id); } : undefined}
      // `tapOpen` (phone): a tap anywhere on the card that isn't a button, menu or field opens the task.
      onClick={tapOpen && !ghost ? e => {
        if (!phone() || (e.target as HTMLElement).closest('button, a, input, textarea, select, [contenteditable], [role="menu"], .cmts, .cmts-wrap')) return;
        openPreview(t.id);
      } : undefined}
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
        {/* Phone: the priority and comment buttons are left to the task window; a small flag and count stay */}
        {t.priority && <span className={'card-flag pr-' + t.priority} title={prioName(t.priority)} aria-label={'Priority: ' + prioName(t.priority)}><IconFlag size={13} /></span>}
        {n > 0 && <span className="card-ncmt" aria-label={n + (n === 1 ? ' comment' : ' comments')}><IconComment size={13} />{n}</span>}
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
  if (!swipe || ghost) return card;
  return (
    <div className={'swipe-row' + (sw.dir ? (sw.dir > 0 ? ' to-right' : ' to-left') : '') + (sw.armed ? ' is-armed' : '')} ref={sw.row}>
      {card}
      <div className="swipe-act swipe-done" aria-hidden="true">{isDone ? <><IconTodo size={18} />To do</> : <><IconDone size={18} />Done</>}</div>
      <div className="swipe-act swipe-later" aria-hidden="true">{DAYS_S[weekday(tomorrow)]}<IconNext size={18} /></div>
    </div>
  );
}

// Memoised: while a card is dragged, the columns re-render to move the gap, but the cards in them don't need to.
export default memo(TaskCard);
