'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { iso } from '@/lib/dates';
import { inWeek, type Task } from '@/lib/tasks/model';
import { ProjectLogo } from '@/components/projects/ProjectBadge';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';

/** Filter id for tasks that have no project. */
const OTHER = '__other';

type Thumb = { x: number; y: number; w: number; h: number; n: number };

/**
 * Project filter pills. Counts cover the week, the month, or all tasks depending on the page.
 * A glowing thumb slides (and squishes a little) to the picked project, as in the theme switch.
 * With many projects the row scrolls sideways, and the edges that hide pills fade out.
 */
export default function Filters({ scope }: { scope: 'week' | 'month' | 'all' }) {
  const { tasks, projects, weekStart, month, filter, setFilter } = useWorkspace();
  const inScope: Task[] = scope === 'week'
    ? tasks.filter(t => inWeek(t, weekStart))
    : scope === 'month' ? tasks.filter(t => t.day.startsWith(iso(month).slice(0, 7))) : tasks;
  const known = new Set(projects.map(p => p.id));
  const loose = (t: Task) => !t.project || !known.has(t.project);
  // "Other" only shows while some task has no project; it drops back to All once none are left.
  const hasLoose = tasks.some(loose);
  const items = [
    { id: 'all', name: 'All', n: inScope.length, project: undefined as (typeof projects)[number] | undefined },
    ...projects.map(p => ({ id: p.id, name: p.name, n: inScope.filter(t => t.project === p.id).length, project: p })),
    ...(hasLoose ? [{ id: OTHER, name: 'Other', n: inScope.filter(loose).length, project: undefined }] : []),
  ];

  useEffect(() => {
    if (filter === OTHER && !hasLoose) setFilter('all');
  }, [filter, hasLoose, setFilter]);

  const row = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<Thumb | null>(null);
  const [fade, setFade] = useState({ start: false, end: false });

  const edges = () => {
    const el = row.current;
    if (!el) return;
    const start = el.scrollLeft > 1;
    const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setFade(f => (f.start === start && f.end === end ? f : { start, end }));
  };

  // Measure the picked pill; n counts moves so the squish restarts each time. Names and counts
  // change the pills' widths, so it re-measures whenever the row resizes too.
  const names = items.map(i => i.id + i.n).join();
  useLayoutEffect(() => {
    const el = row.current;
    if (!el) return;
    const place = () => {
      const b = el.querySelector<HTMLElement>('.filter[aria-pressed="true"]');
      edges();
      if (!b) { setThumb(null); return; }
      setThumb(prev => {
        const next = { x: b.offsetLeft, y: b.offsetTop, w: b.offsetWidth, h: b.offsetHeight };
        if (prev && prev.x === next.x && prev.y === next.y && prev.w === next.w && prev.h === next.h) return prev;
        return { ...next, n: prev ? prev.n + 1 : 0 };
      });
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(el);
    el.querySelectorAll('.filter').forEach(b => ro.observe(b));
    return () => ro.disconnect();
  }, [filter, names]);

  // Keep the picked pill in view when the row scrolls.
  useEffect(() => {
    const el = row.current;
    const b = el?.querySelector<HTMLElement>('.filter[aria-pressed="true"]');
    if (!el || !b || el.scrollWidth <= el.clientWidth) return;
    const pad = 24;
    const left = b.offsetLeft - pad;
    const right = b.offsetLeft + b.offsetWidth + pad - el.clientWidth;
    if (left < el.scrollLeft) el.scrollTo({ left, behavior: 'smooth' });
    else if (right > el.scrollLeft) el.scrollTo({ left: right, behavior: 'smooth' });
  }, [filter]);

  // A mouse wheel scrolls the row sideways while it overflows.
  useEffect(() => {
    const el = row.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const max = el.scrollWidth - el.clientWidth;
      if ((e.deltaY < 0 && el.scrollLeft <= 0) || (e.deltaY > 0 && el.scrollLeft >= max - 1)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const cls = 'filters' + (thumb ? ' has-thumb' : '') + (fade.start ? ' fade-start' : '') + (fade.end ? ' fade-end' : '');
  return (
    <div className={cls} ref={row} onScroll={edges}>
      {thumb && (
        <span className={'seg-thumb' + (thumb.n ? ' is-animated' : '')} aria-hidden="true"
          style={{ top: thumb.y, height: thumb.h, width: thumb.w, transform: `translateX(${thumb.x}px)` }}>
          <span className="seg-thumb-core" key={thumb.n} />
        </span>
      )}
      {items.map(i => (
        <button key={i.id} className="filter" type="button" aria-pressed={filter === i.id} onClick={() => setFilter(i.id)}>
          {i.project && <ProjectLogo project={i.project} size="xs" />}{i.name}<b>{i.n}</b>
        </button>
      ))}
    </div>
  );
}

export function useVisibleTasks() {
  const { tasks, projects, filter } = useWorkspace();
  if (filter === 'all') return tasks;
  if (filter === OTHER) {
    const known = new Set(projects.map(p => p.id));
    return tasks.filter(t => !t.project || !known.has(t.project));
  }
  return tasks.filter(t => t.project === filter);
}
