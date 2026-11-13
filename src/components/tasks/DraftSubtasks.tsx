'use client';

import { useState, type ClipboardEvent } from 'react';
import {
  addSubsUnder, makeSubs, mapSub, newSubId, removeSub, setSubStatus, subChain, subClosed, toggledSub, type PriorityId, type StatusId, type Subtask,
} from '@/lib/tasks/model';
import AssigneeButton from '@/components/ui/AssigneeButton';
import { IconClose, IconGrip, IconPlus } from '@/components/shell/icons';
import SubtaskGate, { hasOpenSubs } from './SubtaskGate';
import { SubCheck, SubPrioMenu } from './SubtaskList';

/** Moves one subtask among its siblings (under `parentId`, '' = the top level). */
function reorder(subs: Subtask[], parentId: string, from: number, to: number): Subtask[] {
  const move = (list: Subtask[]) => {
    const next = list.slice();
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  };
  return parentId ? mapSub(subs, parentId, s => ({ ...s, subtasks: move(s.subtasks) })) : move(subs);
}

/** Copies a draft tree with fresh ids and trimmed titles, dropping empty rows (and what sits under them). */
export const finalDraftSubs = (subs: Subtask[]): Subtask[] => subs
  .filter(s => s.title.trim())
  .map(s => ({ ...s, id: newSubId(), title: s.title.trim().slice(0, 300), subtasks: finalDraftSubs(s.subtasks) }));

/** Pasting several lines adds one subtask per line. */
export const pastedLines = (e: ClipboardEvent<HTMLInputElement>, current: string, add: (text: string) => void) => {
  const text = e.clipboardData.getData('text');
  if (!text.includes('\n')) return;
  e.preventDefault();
  add(current + text);
};

/**
 * Subtasks in the New task window, before the task exists. Same rows as the task preview:
 * round checkbox (status), title, assignee, priority flag. Here the title is typed straight into the row,
 * "+" adds a subtask under a subtask (to any depth), and rows can be dragged among their siblings.
 */
export default function DraftSubtasks({ subs, onChange }: { subs: Subtask[]; onChange: (subs: Subtask[]) => void }) {
  const [under, setUnder] = useState<string | null>(null); // subtask whose "add under" input is open
  const [kidText, setKidText] = useState('');
  const [drag, setDrag] = useState<{ parent: string; index: number } | null>(null);
  const [gate, setGate] = useState<string | null>(null); // subtask waiting for its own subtasks before Done

  const status = (id: string, next: StatusId) => {
    const node = subChain(subs, id)?.at(-1);
    if (next === 'done' && node && hasOpenSubs(node.subtasks)) { setGate(id); return; }
    onChange(setSubStatus(subs, id, next));
  };

  const openUnder = (id: string) => {
    setUnder(id);
    setKidText('');
    requestAnimationFrame(() => document.getElementById('kid-' + id)?.focus());
  };
  const addKids = (text: string) => {
    if (!under) return;
    const added = makeSubs(text);
    if (added.length) onChange(addSubsUnder(subs, under, added));
    setKidText('');
  };

  const tree = (list: Subtask[], parent: string) => (
    <ul className={parent ? 'add-tree add-tree-kids' : 'add-tree'}>
      {list.map((s, i) => (
        <li key={s.id} className="add-node">
          <div className={'add-sub s-' + s.status + (subClosed(s) ? ' is-done' : '') + (drag?.parent === parent && drag.index === i ? ' is-dragging' : '')}
            onDragOver={e => {
              if (!drag || drag.parent !== parent) return;
              e.preventDefault();
              e.stopPropagation();
              if (drag.index !== i) { onChange(reorder(subs, parent, drag.index, i)); setDrag({ parent, index: i }); }
            }}
            onDrop={e => e.preventDefault()}>
            <span className="add-sub-grip" draggable aria-hidden="true" title="Drag to reorder"
              onDragStart={e => { e.stopPropagation(); setDrag({ parent, index: i }); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', s.title); }}
              onDragEnd={() => setDrag(null)}><IconGrip size={14} /></span>
            <SubCheck status={s.status} onToggle={() => status(s.id, toggledSub(s).status)} />
            <input className="add-sub-title" type="text" aria-label="Subtask" value={s.title} maxLength={300}
              onChange={e => onChange(mapSub(subs, s.id, x => ({ ...x, title: e.target.value })))}
              onBlur={() => { if (!s.title.trim() && !s.subtasks.length) onChange(removeSub(subs, s.id)); }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }} />
            <button className="add-sub-btn add-sub-kid" type="button" title="Add a subtask under this"
              aria-label={'Add a subtask under ' + (s.title || 'this subtask')} onClick={() => openUnder(s.id)}><IconPlus size={14} /></button>
            <AssigneeButton compact />
            <SubPrioMenu priority={s.priority} flagOnly
              onPick={(priority: PriorityId) => onChange(mapSub(subs, s.id, x => ({ ...x, priority })))} />
            <button className="add-sub-btn add-sub-del" type="button" title={s.subtasks.length ? 'Remove with its subtasks' : 'Remove'}
              aria-label={'Remove ' + (s.title || 'subtask')} onClick={() => onChange(removeSub(subs, s.id))}><IconClose size={14} /></button>
          </div>
          {(s.subtasks.length > 0 || under === s.id) && (
            <div className="add-kids">
              {s.subtasks.length > 0 && tree(s.subtasks, s.id)}
              {under === s.id && (
                <input id={'kid-' + s.id} className="input add-kid-input" type="text" maxLength={300}
                  placeholder={'Add a subtask under “' + (s.title.trim() || 'this') + '”'} aria-label="New subtask under this one"
                  value={kidText} onChange={e => setKidText(e.target.value)} onPaste={e => pastedLines(e, kidText, addKids)}
                  onBlur={() => { if (kidText.trim()) addKids(kidText); setUnder(null); }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); addKids(kidText); }
                    // Escape closes this small input only, not the whole window.
                    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setKidText(''); setUnder(null); }
                  }} />
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  );

  const gateSubs = gate ? subChain(subs, gate)?.at(-1)?.subtasks : null;
  return (
    <>
      {subs.length > 0 && <div className="add-subs">{tree(subs, '')}</div>}
      {gate && gateSubs && (
        <SubtaskGate subtasks={gateSubs} onCancel={() => setGate(null)}
          onConfirm={done => { onChange(mapSub(subs, gate, s => ({ ...s, status: 'done', subtasks: done }))); setGate(null); }} />
      )}
    </>
  );
}
