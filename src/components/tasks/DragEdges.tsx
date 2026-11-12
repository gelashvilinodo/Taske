'use client';

import type { CSSProperties } from 'react';
import { usePathname } from 'next/navigation';
import { useTaskDrag } from './TaskDrag';

const FIRST_MS = 550, REPEAT_MS = 950; // keep in step with TaskDrag's edge timing

/**
 * While a card is dragged on the board, the left and right screen edges show what holding the card
 * there does: the days slide by one, carrying on into the previous/next week.
 */
export default function DragEdges() {
  const { drag } = useTaskDrag();
  const path = usePathname();
  if (!drag || drag.landing || path !== '/board') return null;
  const zone = (dir: -1 | 1) => {
    const on = drag.edge === dir;
    return (
      <div className={'drag-edge drag-edge-' + (dir < 0 ? 'left' : 'right') + (on ? ' is-over' : '')} aria-hidden="true">
        <span className="drag-edge-card" key={on ? drag.edgeSteps : 'idle'}
          style={{ '--edge-step': (drag.edgeSteps ? REPEAT_MS : FIRST_MS) + 'ms' } as CSSProperties}>
          <span className="drag-edge-arrow">{dir < 0 ? '←' : '→'}</span>
          <span className="drag-edge-label">{dir < 0 ? 'Previous day' : 'Next day'}</span>
          <span className="drag-edge-fill" />
        </span>
      </div>
    );
  };
  return <>{zone(-1)}{zone(1)}</>;
}
