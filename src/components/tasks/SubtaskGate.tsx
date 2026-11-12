'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { subClosed, toggledSub, type Subtask } from '@/lib/tasks/model';
import { SubCheck } from './SubtaskList';
import { IconAlert, IconDone } from '@/components/shell/icons';

/** True when a task with these subtasks can't move to Done yet (canceled subtasks don't hold it back). */
export const hasOpenSubs = (subs: Subtask[]) => subs.some(s => !subClosed(s));

/**
 * Shown when someone moves a task to Done while some of its subtasks are still open.
 * The task only moves once every subtask is done or canceled: one by one here, or all at once.
 * "Mark all done" only ticks them; "Move to Done" (enabled once nothing is open) moves the task.
 * `onConfirm` gets the subtasks as ticked in the dialog.
 */
export default function SubtaskGate({ subtasks, onConfirm, onCancel }: {
  subtasks: Subtask[];
  onConfirm: (subtasks: Subtask[]) => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const confirmed = useRef(false);
  const [subs, setSubs] = useState(() => subtasks.map(s => ({ ...s })));
  const open = subs.filter(s => !subClosed(s)).length;

  useEffect(() => { dialog.current?.showModal(); }, []);

  /** Ticks every open subtask; the task itself stays put until "Move to Done" is pressed. */
  const markAll = () => setSubs(list => list.map(s => (subClosed(s) ? s : { ...s, status: 'done' as const })));

  const finish = () => {
    confirmed.current = true;
    onConfirm(subs);
  };

  return createPortal(
    <dialog ref={dialog} className="gate" aria-labelledby="gateTitle"
      onClose={() => { if (!confirmed.current) onCancel(); }}
      // Keep presses inside the dialog from reaching the card behind it (which would start a drag).
      onPointerDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}>
      <div className="dlg">
        <h3 id="gateTitle" className="dlg-title gate-title"><IconAlert size={20} />Finish the subtasks first</h3>
        <p className="gate-text">
          {open === 0
            ? 'All subtasks are ticked. You can move this task to Done.'
            : (open === 1 ? '1 subtask is' : open + ' subtasks are') + ' not done yet. Tick them one by one, or mark them all done, to move this task to Done.'}
        </p>
        <ul className="gate-list">
          {subs.map((s, i) => (
            <li key={s.id} className={'sub-item s-' + s.status + (subClosed(s) ? ' is-done' : '')}
              onClick={e => { if (!(e.target as Element).closest('button')) setSubs(list => list.map((x, j) => (j === i ? toggledSub(x) : x))); }}>
              <SubCheck status={s.status} onToggle={() => setSubs(list => list.map((x, j) => (j === i ? toggledSub(x) : x)))} />
              <span className="sub-title">{s.title}</span>
            </li>
          ))}
        </ul>
        <div className="dlg-foot">
          <button className="ghost" type="button" onClick={() => dialog.current?.close()}>Cancel</button>
          <div>
            {open > 0 && <button className="ghost" type="button" onClick={markAll}>Mark all done</button>}
            <button className="primary" type="button" disabled={open > 0} onClick={finish}>
              <IconDone size={16} />Move to Done
            </button>
          </div>
        </div>
      </div>
    </dialog>,
    document.body,
  );
}
