'use client';

import { useRef } from 'react';
import { byDayOrder, dayGroupOf, positionBetween, type Task, type TaskPatch } from '@/lib/tasks/model';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';

/**
 * Dropping a card into a day at a given place in its list (or moving it within the same day).
 * Days are grouped (open before done/canceled, then by priority), so a card can only be reordered among
 * cards in its own group. A spot outside its group means the nearest end of that group; the drop line
 * already shows it there (fitOnDay), so the card lands exactly where the line was.
 * `all` is the tasks on screen (after the project filter).
 */
export function useDayDrop(all: Task[]) {
  const { patchTask, tasks: allTasks } = useWorkspace();
  const droppedOn = useRef<string | null>(null); // day of the last drop, so the board settles on its week
  // Asked on every frame of a drag, so each day's group bounds are worked out once per drag and reused.
  const fitCache = useRef<{ id: string; all: Task[]; days: Map<string, [number, number]> } | null>(null);
  const fitOnDay = (id: string, ds: string, index: number) => {
    let c = fitCache.current;
    if (!c || c.id !== id || c.all !== all) c = fitCache.current = { id, all, days: new Map() };
    let range = c.days.get(ds);
    if (!range) {
      const moving = allTasks.find(t => t.id === id);
      if (!moving) return index;
      const list = all.filter(t => t.day === ds && t.id !== id);
      const r = dayGroupOf(moving);
      const start = list.filter(t => dayGroupOf(t) < r).length;
      range = [start, start + list.filter(t => dayGroupOf(t) === r).length];
      c.days.set(ds, range);
    }
    return Math.min(Math.max(index, range[0]), range[1]);
  };
  const dropOnDay = (id: string, ds: string, index: number) => {
    droppedOn.current = ds;
    const moving = allTasks.find(t => t.id === id);
    if (!moving) return;
    const list = all.filter(t => t.day === ds && t.id !== id).sort(byDayOrder);
    const at = fitOnDay(id, ds, index);
    if (moving.day === ds && list.filter(t => byDayOrder(t, moving) < 0).length === at) return; // dropped where it was
    const r = dayGroupOf(moving);
    const prev = at > 0 && dayGroupOf(list[at - 1]) === r ? list[at - 1] : undefined;
    const next = at < list.length && dayGroupOf(list[at]) === r ? list[at] : undefined;
    // Only the day and the place in it change; the task keeps its id and everything else.
    const patch: TaskPatch = {};
    if (moving.day !== ds) patch.day = ds;
    const position = prev || next ? positionBetween(prev, next) : moving.position;
    if (position !== moving.position) patch.position = position;
    if (Object.keys(patch).length) patchTask(id, patch);
  };
  return { fitOnDay, dropOnDay, droppedOn };
}
