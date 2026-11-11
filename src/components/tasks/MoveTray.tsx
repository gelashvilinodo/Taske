'use client';

import { useEffect, useRef, useState } from 'react';
import { addDays, DAYS_S, iso, MONTHS_S, parse, rangeLabel, shortDate, weekday } from '@/lib/dates';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';

function Arrow({ dir, onStep }: { dir: 1 | -1; onStep: (dir: 1 | -1) => void }) {
  const [over, setOver] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);
  const stop = () => { clearInterval(timer.current); timer.current = undefined; setOver(false); };
  useEffect(() => stop, []);
  return (
    <div className={'tray-arrow' + (over ? ' is-over' : '')}
      onDragEnter={e => {
        e.preventDefault();
        setOver(true);
        if (!timer.current) timer.current = setInterval(() => onStep(dir), 600);
      }}
      onDragOver={e => e.preventDefault()}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) stop(); }}
      onDrop={e => { e.preventDefault(); stop(); }}
    >{dir < 0 ? '←' : '→'}</div>
  );
}

/** While a card is dragged, a bottom tray lets you drop it on a day in another week. */
export default function MoveTray() {
  const { dragId, setDragId, weekStart, patchTask, toast } = useWorkspace();
  const [week, setWeek] = useState(() => addDays(weekStart, 7));
  const [overDay, setOverDay] = useState<string | null>(null);

  useEffect(() => { if (dragId) setWeek(addDays(weekStart, 7)); }, [dragId, weekStart]);

  if (!dragId) return null;
  return (
    <div id="tray">
      <div className="tray-in">
        <div className="tray-nav">
          <Arrow dir={-1} onStep={d => setWeek(w => addDays(w, 7 * d))} />
          <span className="tray-week">{rangeLabel(week, addDays(week, 4), MONTHS_S)}</span>
          <Arrow dir={1} onStep={d => setWeek(w => addDays(w, 7 * d))} />
        </div>
        <div className="tray-days">
          {[0, 1, 2, 3, 4].map(i => {
            const ds = iso(addDays(week, i));
            return (
              <div key={i} className={'tray-day' + (overDay === ds ? ' is-over' : '')}
                onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOverDay(ds); }}
                onDragLeave={() => setOverDay(null)}
                onDrop={e => {
                  e.preventDefault();
                  setOverDay(null);
                  const id = dragId;
                  setDragId(null);
                  patchTask(id, { day: ds });
                  const d = parse(ds);
                  toast('Moved to ' + DAYS_S[weekday(d)] + ', ' + shortDate(d));
                }}
              >{DAYS_S[i]} {addDays(week, i).getDate()}</div>
            );
          })}
        </div>
        <p className="tray-hint">Drop on a day to move the task there. Hold over an arrow to change the week.</p>
      </div>
    </div>
  );
}
