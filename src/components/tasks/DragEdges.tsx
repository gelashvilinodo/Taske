'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { usePathname } from 'next/navigation';
import { addDays, MONTHS_S, rangeLabel, weekEnd } from '@/lib/dates';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { useTaskDrag } from './TaskDrag';

const FIRST_MS = 550, REPEAT_MS = 950; // keep in step with TaskDrag's edge timing

/**
 * While a card is dragged on the board, the left and right screen edges show what holding the card
 * there will do: go to the previous/next day (when the week scrolls sideways) or week.
 */
export default function DragEdges() {
  const { drag } = useTaskDrag();
  const { weekStart } = useWorkspace();
  const path = usePathname();
  const active = !!drag && path === '/board';
  const [byDay, setByDay] = useState(false);

  useEffect(() => {
    if (!active) return;
    const el = document.querySelector<HTMLElement>('.week');
    setByDay(!!el && el.scrollWidth > el.clientWidth + 1);
  }, [active]);

  if (!active) return null;
  const zone = (dir: -1 | 1) => {
    const target = addDays(weekStart, 7 * dir);
    const on = drag!.edge === dir;
    return (
      <div className={'drag-edge drag-edge-' + (dir < 0 ? 'left' : 'right') + (on ? ' is-over' : '')} aria-hidden="true">
        <span className="drag-edge-card" key={on ? drag!.edgeSteps : 'idle'}
          style={{ '--edge-step': (drag!.edgeSteps ? REPEAT_MS : FIRST_MS) + 'ms' } as CSSProperties}>
          <span className="drag-edge-arrow">{dir < 0 ? '←' : '→'}</span>
          <span className="drag-edge-label">{byDay ? (dir < 0 ? 'Previous day' : 'Next day') : (dir < 0 ? 'Previous week' : 'Next week')}</span>
          {!byDay && <span className="drag-edge-range">{rangeLabel(target, weekEnd(target), MONTHS_S)}</span>}
          <span className="drag-edge-fill" />
        </span>
      </div>
    );
  };
  return <>{zone(-1)}{zone(1)}</>;
}
