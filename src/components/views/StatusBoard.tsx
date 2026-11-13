'use client';

import { useEffect, useId, useRef, useState, type TouchEvent } from 'react';
import { inWeek, statusPatch, STATUSES, type StatusId } from '@/lib/tasks/model';
import {
  activeCount, DUE_FILTERS, filterTasks, LIST_DEFAULTS, listComparator, PRIO_FILTERS, SORTS,
  type DueFilter, type ListOptions, type PrioFilter, type SortKey,
} from '@/lib/tasks/listView';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { useVisibleTasks } from '@/components/tasks/Filters';
import DropColumn from '@/components/tasks/DropColumn';
import SubtaskGate, { hasOpenSubs } from '@/components/tasks/SubtaskGate';
import { useDropZone } from '@/components/tasks/TaskDrag';
import Dropdown from '@/components/ui/Dropdown';
import { IconClock, IconClose, IconFilter, IconFlag, IconSearch, IconSort, IconSortDown, IconSortUp } from '@/components/shell/icons';

const SORT_KEY = 'taske:list-sort';
const SWIPE_MIN = 60;

/** A status tab (phone). A card held and dragged onto it moves to that status. */
function StatusTab({ id, name, n, active, onPick, onDropTask }: {
  id: StatusId; name: string; n: number; active: boolean; onPick: () => void; onDropTask: (taskId: string) => void;
}) {
  const { readOnly } = useWorkspace();
  const { over } = useDropZone('tab:' + id, taskId => onDropTask(taskId), !readOnly && !active);
  return (
    <button type="button" role="tab" aria-selected={active} className={'stab' + (over ? ' is-over' : '')} data-drop={readOnly || active ? undefined : 'tab:' + id} onClick={onPick}>
      <span className="stab-name">{name}</span><b>{n}</b>
    </button>
  );
}

/** Search, priority, deadline and sort. Always open on wide screens; on a phone it folds open and shut. */
function ListControls({ o, set, open }: { o: ListOptions; set: (p: Partial<ListOptions>) => void; open: boolean }) {
  const uid = useId();
  const n = activeCount(o);
  return (
    <div className={'lf-wrap' + (open ? ' is-open' : '')}>
      <div className="lf-inner">
        <div className="lf" role="search">
          <label className="lf-search">
            <IconSearch size={16} />
            <input type="search" className="lf-q" placeholder="Search tasks" aria-label="Search tasks" value={o.q}
              onChange={e => set({ q: e.target.value })} onKeyDown={e => { if (e.key === 'Escape') set({ q: '' }); }} />
            {o.q && <button type="button" className="lf-x" aria-label="Clear search" onClick={() => set({ q: '' })}><IconClose size={14} /></button>}
          </label>
          <span id={uid + 'p'} hidden>Priority</span>
          <Dropdown className={'lf-pick' + (o.prio !== 'all' ? ' is-set' : '')} labelledBy={uid + 'p'} value={o.prio}
            options={PRIO_FILTERS.map(f => ({ ...f, leading: <IconFlag size={15} /> }))} onChange={v => set({ prio: v as PrioFilter })} />
          <span id={uid + 'd'} hidden>Deadline</span>
          <Dropdown className={'lf-pick' + (o.due !== 'all' ? ' is-set' : '')} labelledBy={uid + 'd'} value={o.due}
            options={DUE_FILTERS.map(f => ({ ...f, leading: <IconClock size={15} /> }))} onChange={v => set({ due: v as DueFilter })} />
          <div className="lf-sort">
            <span id={uid + 's'} hidden>Sort by</span>
            <Dropdown className="lf-pick" labelledBy={uid + 's'} value={o.sort}
              options={SORTS.map(f => ({ ...f, leading: <IconSort size={15} /> }))} onChange={v => set({ sort: v as SortKey })} />
            <button type="button" className="icon-btn lf-dir" aria-label={o.desc ? 'Descending. Switch to ascending' : 'Ascending. Switch to descending'}
              title={o.desc ? 'Descending' : 'Ascending'} onClick={() => set({ desc: !o.desc })}>
              {o.desc ? <IconSortDown size={16} /> : <IconSortUp size={16} />}
            </button>
          </div>
          {n > 0 && <button type="button" className="ghost lf-clear" onClick={() => set({ q: '', prio: 'all', due: 'all' })}>Clear</button>}
        </div>
      </div>
    </div>
  );
}

/**
 * List page: this week's tasks grouped by status, with search, filters and sort above.
 * Wide screens show the four status columns side by side; a phone shows one at a time under
 * tabs that stay pinned to the top while the page scrolls (swipe sideways to change tab).
 * Drop a card on a column (or a tab) to change its status.
 */
export default function StatusBoard() {
  const { weekStart, loaded, patchTask, tasks: all } = useWorkspace();
  const [gateId, setGateId] = useState<string | null>(null); // task dropped on Done with open subtasks
  const gated = all.find(t => t.id === gateId);
  const [o, setO] = useState<ListOptions>(LIST_DEFAULTS);
  const [tab, setTab] = useState<StatusId>('todo');
  const [dir, setDir] = useState<'next' | 'prev' | ''>('');
  const [open, setOpen] = useState(false);
  const swipe = useRef<{ x: number; y: number } | null>(null);

  // The chosen sort is remembered on this device; search and filters start fresh.
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(SORT_KEY) || 'null');
      if (s && SORTS.some(x => x.value === s.sort)) setO(p => ({ ...p, sort: s.sort, desc: !!s.desc }));
    } catch { /* storage blocked */ }
  }, []);
  const set = (p: Partial<ListOptions>) => setO(prev => {
    const next = { ...prev, ...p };
    if ('sort' in p || 'desc' in p) try { localStorage.setItem(SORT_KEY, JSON.stringify({ sort: next.sort, desc: next.desc })); } catch { /* storage blocked */ }
    return next;
  });

  const week = useVisibleTasks().filter(t => inWeek(t, weekStart));
  const shown = filterTasks(week, o, weekStart);
  const cmp = listComparator(o);
  const byStatus = (id: StatusId) => shown.filter(t => t.status === id).sort(cmp);
  const filtering = activeCount(o) > 0;
  const n = activeCount(o);

  const pick = (id: StatusId) => {
    if (id === tab) return;
    const i = STATUSES.findIndex(s => s.id === id), j = STATUSES.findIndex(s => s.id === tab);
    setDir(i > j ? 'next' : 'prev');
    setTab(id);
  };
  const moveTo = (id: string, status: StatusId) => {
    const t = all.find(x => x.id === id);
    if (!t || t.status === status) return;
    if (status === 'done' && hasOpenSubs(t.subtasks)) { setGateId(id); return; }
    patchTask(id, statusPatch(t, status));
  };

  // Phone: a sideways swipe that starts outside a card switches tab (on a card it is the card's own swipe).
  const onTouchStart = (e: TouchEvent) => {
    const el = e.target as HTMLElement;
    swipe.current = el.closest('.card, .swipe-row, input, button') ? null : { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: TouchEvent) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s || !matchMedia('(max-width: 767px)').matches) return;
    const dx = e.changedTouches[0].clientX - s.x, dy = e.changedTouches[0].clientY - s.y;
    if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const i = STATUSES.findIndex(x => x.id === tab) + (dx < 0 ? 1 : -1);
    if (i >= 0 && i < STATUSES.length) pick(STATUSES[i].id);
  };

  return (
    <>
      <div className="list-head">
        <div className="stabs" role="tablist" aria-label="Status">
          {STATUSES.map(s => (
            <StatusTab key={s.id} id={s.id} name={s.id === 'doing' ? 'Doing' : s.name} n={byStatus(s.id).length} active={tab === s.id}
              onPick={() => pick(s.id)} onDropTask={id => moveTo(id, s.id)} />
          ))}
        </div>
        <button type="button" className={'icon-btn lf-toggle' + (open ? ' is-open' : '') + (n ? ' is-set' : '')} aria-expanded={open}
          aria-label={'Search and filters' + (n ? ', ' + n + ' on' : '')} onClick={() => setOpen(v => !v)}>
          <IconFilter size={18} />{n > 0 && <b>{n}</b>}
        </button>
        <ListControls o={o} set={set} open={open} />
      </div>
      <main className={'status-board' + (dir ? ' slide-' + dir : '')} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {STATUSES.map(s => {
          const tasks = byStatus(s.id);
          return (
            <DropColumn key={s.id} zone={'status:' + s.id} tasks={tasks} showDay swipe tapOpen noDrag label={s.name}
              className={'column' + (tab === s.id ? ' is-tab' : '')}
              // A column is kept in its sort order, so a card lands where it sorts, wherever it was dropped;
              // within its own column it stays put.
              fitIndex={id => {
                const t = all.find(x => x.id === id);
                const others = tasks.filter(x => x.id !== id);
                if (!t) return others.length;
                return others.filter(x => cmp(x, t) < 0).length;
              }}
              onDropTask={id => { if (!tasks.some(t => t.id === id)) moveTo(id, s.id); }}
              header={<header className="col-head"><span className="col-name">{s.name}</span><span className="count">{tasks.length}</span></header>}
              empty={loaded && <p className="empty">{filtering ? 'No matching tasks' : 'Empty'}</p>}
            />
          );
        })}
        {gated && (
          <SubtaskGate subtasks={gated.subtasks} onCancel={() => setGateId(null)}
            onConfirm={subtasks => { setGateId(null); patchTask(gated.id, { status: 'done', subtasks }); }} />
        )}
      </main>
    </>
  );
}

