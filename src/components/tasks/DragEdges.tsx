'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { usePathname } from 'next/navigation';
import { addDays, MONTHS_S, rangeLabel } from '@/lib/dates';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';

const FIRST_STEP_MS = 550;  // hold this long at an edge before the week changes
const REPEAT_MS = 1000;     // then keep stepping while the card stays there

/**
 * While a card is dragged on the board, the left and right screen edges turn into
 * "previous week" / "next week" zones. Holding the card there flips the board week;
 * then drop it on a day as usual.
 */
export default function DragEdges() {
  const { dragId, setDragId, weekStart, setWeekStart } = useWorkspace();
  const path = usePathname();
  const active = !!dragId && path === '/board';
  const [over, setOver] = useState<-1 | 1 | 0>(0);
  const [steps, setSteps] = useState(0); // weeks flipped during this hold; restarts the fill animation
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const weekRef = useRef(weekStart);
  weekRef.current = weekStart;

  const stop = () => { clearTimeout(timer.current); timer.current = undefined; setOver(0); };

  const start = (dir: -1 | 1) => {
    if (timer.current) return;
    setOver(dir);
    setSteps(0);
    const step = (wait: number) => {
      timer.current = setTimeout(() => {
        setWeekStart(addDays(weekRef.current, 7 * dir));
        setSteps(n => n + 1);
        step(REPEAT_MS);
      }, wait);
    };
    step(FIRST_STEP_MS);
  };

  // The dragged card can disappear when the week changes, so its own dragend may never fire.
  // Mouse events pause during a drag and resume after it, so the first one means the drag is over.
  useEffect(() => {
    if (!dragId) return;
    const end = () => { stop(); setDragId(null); };
    const arm = setTimeout(() => {
      window.addEventListener('mousemove', end, { once: true });
      window.addEventListener('drop', end, { once: true });
    }, 0);
    return () => { clearTimeout(arm); window.removeEventListener('mousemove', end); window.removeEventListener('drop', end); };
  }, [dragId, setDragId]);

  useEffect(() => { if (!active) stop(); }, [active]);
  useEffect(() => () => clearTimeout(timer.current), []);

  if (!active) return null;
  const zone = (dir: -1 | 1) => {
    const target = addDays(weekStart, 7 * dir);
    return (
      <div
        className={'drag-edge drag-edge-' + (dir < 0 ? 'left' : 'right') + (over === dir ? ' is-over' : '')}
        onDragEnter={e => { e.preventDefault(); start(dir); }}
        onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) stop(); }}
        onDrop={e => { e.preventDefault(); stop(); }}
        aria-hidden="true"
      >
        <span className="drag-edge-card" key={over === dir ? steps : 'idle'}
          style={{ '--edge-step': (steps ? REPEAT_MS : FIRST_STEP_MS) + 'ms' } as CSSProperties}>
          <span className="drag-edge-arrow">{dir < 0 ? '←' : '→'}</span>
          <span className="drag-edge-label">{dir < 0 ? 'Previous week' : 'Next week'}</span>
          <span className="drag-edge-range">{rangeLabel(target, addDays(target, 4), MONTHS_S)}</span>
          <span className="drag-edge-fill" />
        </span>
      </div>
    );
  };
  return <>{zone(-1)}{zone(1)}</>;
}
