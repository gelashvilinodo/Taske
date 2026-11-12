'use client';

import { PRIORITIES, prioName, sortSubs, STATUSES, statusName, subClosed, toggledSub, type PriorityId, type StatusId, type Subtask } from '@/lib/tasks/model';
import { IconFlag } from '@/components/shell/icons';
import MenuButton from './MenuButton';
import { SubMark } from './StatusIcon';

/**
 * Round checkbox for a subtask. Its colour and mark follow the status:
 * to do = empty ring, in progress = half-filled purple, done = green tick, canceled = grey cross.
 * Clicking it ticks the subtask (or un-ticks a finished one back to To do).
 */
export function SubCheck({ status, onToggle, disabled = false }: { status: StatusId; onToggle?: () => void; disabled?: boolean }) {
  const closedNow = status === 'done' || status === 'canceled';
  return (
    <button type="button" role="checkbox" aria-checked={status === 'done'} disabled={disabled || !onToggle}
      className={'sub-check s-' + status}
      aria-label={closedNow ? statusName(status) + '. Click to reopen' : statusName(status) + '. Click to mark done'}
      title={statusName(status)}
      onClick={onToggle}>
      <SubMark status={status} />
    </button>
  );
}

/** Small status pill that opens the four statuses for one subtask. */
export function SubStatusMenu({ status, onPick }: { status: StatusId; onPick: (id: StatusId) => void }) {
  return (
    <MenuButton className={'status sub-status s-' + status} title="Change subtask status"
      ariaLabel={'Subtask status: ' + statusName(status) + '. Click to change'}
      items={STATUSES} current={status} onPick={id => onPick(id as StatusId)}>
      {statusName(status)}
    </MenuButton>
  );
}

const PRIO_ITEMS = [...PRIORITIES, { id: '', name: 'No priority' }] as const;

/** Small flag pill that picks a subtask's priority. With no priority it is a faint flag only. */
export function SubPrioMenu({ priority, onPick }: { priority: PriorityId; onPick: (id: PriorityId) => void }) {
  return (
    <MenuButton className={'prio sub-prio ' + (priority ? 'pr-' + priority : 'none')} title="Change subtask priority"
      ariaLabel={'Subtask priority: ' + (priority ? prioName(priority) : 'none') + '. Click to change'}
      items={PRIO_ITEMS} current={priority} onPick={id => onPick(id as PriorityId)}>
      <IconFlag size={12} />{priority && <span>{prioName(priority)}</span>}
    </MenuButton>
  );
}

/** Read-only priority flag (on cards, and where the subtask can't be changed). */
export const SubPrioFlag = ({ priority, label = false }: { priority: PriorityId; label?: boolean }) => (priority
  ? <span className={'prio sub-prio pr-' + priority} title={prioName(priority) + ' priority'} aria-label={prioName(priority) + ' priority'}>
      <IconFlag size={12} />{label && <span>{prioName(priority)}</span>}
    </span>
  : null);

/**
 * Subtasks grouped by status colour (in progress, to do, done, canceled), then by priority inside each group.
 * `onChange` gets the whole list back in its stored order with one subtask changed.
 * `menus` adds priority and status pills to each row (used in the roomy preview window);
 * without it a row shows just a small priority flag.
 */
export default function SubtaskList({ subs, onChange, menus = false, pick = false, className = 'sub-list' }: {
  subs: Subtask[];
  onChange?: (subs: Subtask[]) => void;
  menus?: boolean;
  /** Compact card rows where the whole row is a button that opens the subtask's status menu. */
  pick?: boolean;
  className?: string;
}) {
  const put = (next: Subtask) => onChange?.(subs.map(x => (x.id === next.id ? next : x)));
  if (pick && onChange) return (
    <ul className={className}>
      {sortSubs(subs).map(s => (
        <li key={s.id} className={'sub-item s-' + s.status + (subClosed(s) ? ' is-done' : '')}>
          <MenuButton className="sub-pick" title="Change subtask status"
            ariaLabel={s.title + '. Status: ' + statusName(s.status) + '. Click to change'}
            items={STATUSES} current={s.status} onPick={id => put({ ...s, status: id as StatusId })}>
            <span className={'sub-check s-' + s.status} aria-hidden="true"><SubMark status={s.status} /></span>
            <span className="sub-title">{s.title}</span>
            <SubPrioFlag priority={s.priority} />
          </MenuButton>
        </li>
      ))}
    </ul>
  );
  return (
    <ul className={className}>
      {sortSubs(subs).map(s => (
        <li key={s.id} className={'sub-item s-' + s.status + (subClosed(s) ? ' is-done' : '')}>
          <SubCheck status={s.status} onToggle={onChange ? () => put(toggledSub(s)) : undefined} />
          <span className="sub-title">{s.title}</span>
          {menus && onChange && <>
            <SubPrioMenu priority={s.priority} onPick={priority => put({ ...s, priority })} />
            <SubStatusMenu status={s.status} onPick={status => put({ ...s, status })} />
          </>}
          {menus && !onChange && <>
            <SubPrioFlag priority={s.priority} label />
            <span className={'status sub-status s-' + s.status}>{statusName(s.status)}</span>
          </>}
          {!menus && <SubPrioFlag priority={s.priority} />}
        </li>
      ))}
    </ul>
  );
}
