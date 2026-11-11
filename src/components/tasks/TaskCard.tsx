'use client';

import { useEffect, useRef, useState } from 'react';
import { addDays, commentTime, DAYS_S, iso, parse, shortDate, today, weekday } from '@/lib/dates';
import { closed, PRIORITIES, prioName, projectName, STATUSES, statusName, type Task } from '@/lib/tasks/model';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import MenuButton from './MenuButton';

function DeadlineChip({ t }: { t: Task }) {
  if (!t.deadline) return null;
  const td = iso(today());
  const label = shortDate(parse(t.deadline));
  if (closed(t)) return <span className="chip">Due {label}</span>;
  if (t.deadline < td) return <span className="chip is-over">Overdue, {label}</span>;
  if (t.deadline === td) return <span className="chip is-soon">Due today</span>;
  if (t.deadline === iso(addDays(today(), 1))) return <span className="chip is-soon">Due tomorrow</span>;
  return <span className="chip">Due {label}</span>;
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

function Subtasks({ t, writable }: { t: Task; writable: boolean }) {
  const { patchTask } = useWorkspace();
  const [open, setOpen] = useState(false);
  const n = t.subtasks.length;
  if (!n) return null;
  const done = t.subtasks.filter(s => s.done).length;
  return (
    <>
      <button className="sub-toggle" type="button" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <span>{(open ? '▾ ' : '▸ ') + 'Subtasks'}</span><b>{done}/{n}</b>
        <span className="meter"><i style={{ width: Math.round(done / n * 100) + '%' }} /></span>
      </button>
      {open && (
        <ul className="sub-list">
          {t.subtasks.map(s => (
            <li key={s.id} className={'sub-item' + (s.done ? ' is-done' : '')}>
              <label>
                <input type="checkbox" checked={s.done} disabled={!writable}
                  onChange={() => patchTask(t.id, { subtasks: t.subtasks.map(x => (x.id === s.id ? { ...x, done: !x.done } : x)) })} />
                <span>{s.title}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Comments({ t, writable, focusSignal }: { t: Task; writable: boolean; focusSignal: number }) {
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
          <button className="ghost" type="button" onClick={send}>Send</button>
        </div>
      )}
    </div>
  );
}

/** One task on the board. `showDay` adds the day chip (used where cards are not grouped by day). */
export default function TaskCard({ t, showDay = false }: { t: Task; showDay?: boolean }) {
  const { readOnly, patchTask, openEditor, setDragId, comments } = useWorkspace();
  const writable = !readOnly;
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [focusSignal, setFocusSignal] = useState(0);
  const [dragging, setDragging] = useState(false);
  const n = (comments[t.id] || []).length;
  const d = parse(t.day);

  const openComments = () => { setCommentsOpen(true); setFocusSignal(x => x + 1); };

  return (
    <article
      className={'card pj-' + t.project + (t.status === 'done' ? ' is-done' : '') + (t.status === 'canceled' ? ' is-canceled' : '') + (dragging ? ' dragging' : '')}
      draggable={writable || undefined}
      onDragStart={e => {
        e.dataTransfer.setData('text/plain', t.id);
        e.dataTransfer.effectAllowed = 'move';
        setDragging(true);
        // Changing the page during dragstart can cancel the drag, so show the tray a tick later.
        setTimeout(() => setDragId(t.id), 0);
      }}
      onDragEnd={() => { setDragging(false); setDragId(null); }}
    >
      {writable
        ? <button className="card-title" type="button" onClick={() => openEditor(t.id)}>{t.title}</button>
        : <span className="card-title">{t.title}</span>}
      <Description text={t.description} />
      <Subtasks t={t} writable={writable} />
      <div className="meta">
        <span className={'chip p-' + t.project}>{projectName(t.project)}</span>
        {showDay && <span className="chip">{DAYS_S[weekday(d)]}, {shortDate(d)}</span>}
        <DeadlineChip t={t} />
      </div>
      <div className="card-foot">
        {writable ? (
          <MenuButton className={'status s-' + t.status} title="Change status" ariaLabel={'Status: ' + statusName(t.status) + '. Click to change'}
            items={STATUSES} current={t.status}
            onPick={id => { if (id === 'done') openComments(); patchTask(t.id, { status: id as Task['status'] }); }}>
            {statusName(t.status)}
          </MenuButton>
        ) : <span className={'status s-' + t.status}>{statusName(t.status)}</span>}
        {writable ? (
          <MenuButton className={'prio ' + (t.priority ? 'pr-' + t.priority : 'none')} title="Change priority"
            ariaLabel={'Priority: ' + (t.priority ? prioName(t.priority) : 'none') + '. Click to change'}
            items={[...PRIORITIES, { id: '', name: 'No priority' }]} current={t.priority}
            onPick={id => patchTask(t.id, { priority: id as Task['priority'] })}>
            {t.priority ? prioName(t.priority) : 'Priority'}
          </MenuButton>
        ) : t.priority ? <span className={'prio pr-' + t.priority}>{prioName(t.priority)}</span> : null}
        {(writable || n > 0) && (
          <button className={'cmt-btn' + (n ? ' has' : '')} type="button" aria-expanded={commentsOpen}
            onClick={() => (commentsOpen ? setCommentsOpen(false) : openComments())}>
            {n ? 'Comments ' + n : 'Comment'}
          </button>
        )}
      </div>
      {commentsOpen && <Comments t={t} writable={writable} focusSignal={focusSignal} />}
    </article>
  );
}
