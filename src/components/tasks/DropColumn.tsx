'use client';

import { Fragment, type CSSProperties, type ReactNode } from 'react';
import type { Task } from '@/lib/tasks/model';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { useDropZone } from './TaskDrag';
import TaskCard from './TaskCard';

/**
 * A board column that lists task cards and accepts dragged ones. While a card is dragged over it, a
 * thin still line marks where the card will land (no room is made, so nothing moves). On release a
 * gap opens there for the card to drop into; `onDropTask` gets the task id and that position.
 */
export default function DropColumn({ className, label, zone, tasks, showDay = false, header, empty, onDropTask, fitIndex, dataWeek, style, swipe = false, tapOpen = false, noDrag = false }: {
  className: string; label: string; zone: string; tasks: Task[]; showDay?: boolean; dataWeek?: string; style?: CSSProperties;
  header: ReactNode; empty: ReactNode; onDropTask: (id: string, index: number) => void;
  /** Where a dragged card can really land, given the spot under the pointer (the line shows that place). */
  fitIndex?: (id: string, index: number) => number;
  /** Phone swipe actions on the cards (List page) */
  swipe?: boolean;
  /** Phone: a tap on a card's free space opens it */
  tapOpen?: boolean;
  /** Phone: no press-and-hold dragging of the cards (List page) */
  noDrag?: boolean;
}) {
  const { readOnly } = useWorkspace();
  const { dragId, over, slotAt, home, landing, moves, h } = useDropZone(zone, onDropTask, !readOnly, fitIndex);
  const others = dragId ? tasks.filter(t => t.id !== dragId) : tasks;
  // Pointing at the card's own spot (home): its placeholder already says so, no line.
  const slot = !over ? null
    : landing ? (moves ? <div className="drop-slot" style={{ height: h }} aria-hidden="true" /> : null)
    : home ? null : <div className="drop-line" aria-hidden="true" />;
  return (
    <section className={className + (over ? ' is-over' : '')} aria-label={label} style={style} data-drop={readOnly ? undefined : zone} data-week={dataWeek}>
      {header}
      <div className="list">
        {tasks.map(t => {
          const i = others.indexOf(t);
          return (
            <Fragment key={t.id}>
              {over && i === slotAt && slot}
              <TaskCard t={t} showDay={showDay} swipe={swipe} tapOpen={tapOpen} noDrag={noDrag} />
            </Fragment>
          );
        })}
        {over && slotAt >= others.length && slot}
        {!tasks.length && !slot && empty}
      </div>
    </section>
  );
}
