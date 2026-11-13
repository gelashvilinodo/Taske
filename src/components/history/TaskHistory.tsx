'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { IconClose, IconHistory } from '@/components/shell/icons';
import { MomentRow, dayKey, dayLabel, historyNotice, toMoments, type Moment } from './HistoryEntry';

/**
 * Window with everything that happened to one task, newest first. Opens from the task preview
 * and from the History page; it opens on top of the preview, so closing it goes back there.
 * Works for deleted tasks too: their name comes from the history itself.
 */
export default function TaskHistory() {
  const { historyId, openHistory, history, taskHistoryState, loadTaskHistory, tasks, previewId, openPreview } = useWorkspace();
  const dialog = useRef<HTMLDialogElement>(null);
  const task = tasks.find(t => t.id === historyId);
  const events = useMemo(() => history.filter(e => e.taskId === historyId), [history, historyId]);
  // Days, newest first, each with its moments.
  const days = useMemo(() => {
    const out: { key: string; moments: Moment[] }[] = [];
    for (const m of toMoments(events)) {
      const key = dayKey(m.at);
      if (out.at(-1)?.key !== key) out.push({ key, moments: [] });
      out.at(-1)!.moments.push(m);
    }
    return out;
  }, [events]);
  const title = task?.title ?? events[0]?.taskTitle ?? 'Task';

  useEffect(() => {
    if (!historyId) { if (dialog.current?.open) dialog.current.close(); return; }
    loadTaskHistory(historyId);
    if (!dialog.current?.open) dialog.current?.showModal();
  }, [historyId, loadTaskHistory]);

  const close = () => dialog.current?.close();
  const notice = historyNotice(historyId ? taskHistoryState(historyId) : 'idle');

  return (
    <dialog id="history" ref={dialog} aria-labelledby="historyTitle"
      onClose={e => { if (e.target === e.currentTarget) openHistory(null); }}
      onClick={e => { if (e.target === e.currentTarget) close(); }}>
      {historyId && (
        <div className="dlg hx-dlg">
          <div className="hx-dlg-head">
            <span className="hx-dlg-icon" aria-hidden="true"><IconHistory size={18} /></span>
            <div className="hx-dlg-text">
              <small>Task history{!task && ' · deleted'}</small>
              <h3 id="historyTitle">{title}</h3>
            </div>
            <button className="dlg-x" type="button" aria-label="Close" title="Close" onClick={close}><IconClose size={18} /></button>
          </div>
          {notice ?? (events.length === 0
            ? <p className="hx-empty">Nothing recorded for this task yet. Changes made from now on show up here.</p>
            : <div className="hx-dlg-days">{days.map(d => (
              <section key={d.key} className="hx-dlg-day">
                <h4 className="hx-day-head"><span>{dayLabel(d.key)}</span></h4>
                <ol className="hx-moments">{d.moments.map(m => <MomentRow key={m.id} m={m} />)}</ol>
              </section>
            ))}</div>)}
          {task && previewId !== task.id && (
            <div className="dlg-foot">
              <span />
              <button className="ghost" type="button" onClick={() => { const id = task.id; close(); openPreview(id); }}>Open task</button>
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}
