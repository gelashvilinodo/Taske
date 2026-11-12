'use client';

import { Fragment, type CSSProperties, type ReactNode } from 'react';
import type { Task } from '@/lib/tasks/model';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { useDropZone } from './TaskDrag';
import TaskCard from './TaskCard';

/**
 * A board column that lists task cards and accepts dragged ones. While a card is dragged over it,
 * a gap opens where the card will land; `onDropTask` gets the task id and that position.
 */
export default function DropColumn({ className, label, zone, tasks, showDay = false, header, empty, onDropTask, dataWeek, style }: {
  className: string; label: string; zone: string; tasks: Task[]; showDay?: boolean; dataWeek?: string; style?: CSSProperties;
  header: ReactNode; empty: ReactNode; onDropTask: (id: string, index: number) => void;
}) {
  const { readOnly } = useWorkspace();
  const { drag, over, slotAt, slotHeight } = useDropZone(zone, onDropTask, !readOnly);
  const others = drag ? tasks.filter(t => t.id !== drag.id) : tasks;
  const slot = <div className="drop-slot" style={{ height: slotHeight }} aria-hidden="true" />;
  return (
    <section className={className + (over ? ' is-over' : '')} aria-label={label} style={style} data-drop={readOnly ? undefined : zone} data-week={dataWeek}>
      {header}
      <div className="list">
        {tasks.map(t => {
          const i = others.indexOf(t);
          return (
            <Fragment key={t.id}>
              {over && i === slotAt && slot}
              <TaskCard t={t} showDay={showDay} />
            </Fragment>
          );
        })}
        {over && slotAt >= others.length && slot}
        {!tasks.length && !over && empty}
      </div>
    </section>
  );
}
