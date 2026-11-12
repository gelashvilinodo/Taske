'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { addDays, isoWeek, MONTHS, MONTHS_S, monthStart, planningMonday, rangeLabel, weekEnd } from '@/lib/dates';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { IconNext, IconPrev, IconToday } from '@/components/shell/icons';

type Label = { eyebrow: string; full: string; short: string };
type Shown = { at: number; label: Label };

function PeriodLabel({ label, className, onDone }: { label: Label; className?: string; onDone?: () => void }) {
  return (
    <div className={'period-slide' + (className ? ' ' + className : '')} onAnimationEnd={onDone} aria-hidden={onDone ? true : undefined}>
      <span className="eyebrow">{label.eyebrow}</span>
      <h2>
        <span className="period-full">{label.full}</span>
        <span className="period-short">{label.short}</span>
      </h2>
    </div>
  );
}

/** Previous / next / back-to-now controls with the period title. */
export default function PeriodNav({ unit }: { unit: 'week' | 'month' }) {
  const { weekStart, setWeekStart, month, setMonth } = useWorkspace();
  const isMonth = unit === 'month';
  const shift = (dir: number) => {
    if (isMonth) setMonth(new Date(month.getFullYear(), month.getMonth() + dir, 1));
    else setWeekStart(addDays(weekStart, 7 * dir));
  };
  const now = () => {
    const mon = planningMonday();
    setWeekStart(mon);
    setMonth(monthStart(addDays(mon, 3)));
  };

  const at = (isMonth ? month : weekStart).getTime();
  const label: Label = isMonth
    ? { eyebrow: String(month.getFullYear()), full: MONTHS[month.getMonth()], short: MONTHS_S[month.getMonth()] }
    : {
        eyebrow: 'Week ' + isoWeek(weekStart) + ' · ' + addDays(weekStart, 3).getFullYear(),
        full: rangeLabel(weekStart, weekEnd(weekStart), MONTHS),
        short: rangeLabel(weekStart, weekEnd(weekStart), MONTHS_S),
      };

  // When the period changes, the old title slides out while the new one slides in from the
  // side it came from: forward pushes left, back pushes right.
  const shown = useRef<Shown>({ at, label });
  const [leaving, setLeaving] = useState<(Shown & { dir: 1 | -1 }) | null>(null);
  useLayoutEffect(() => {
    const prev = shown.current;
    if (prev.at === at) return;
    setLeaving({ ...prev, dir: at > prev.at ? 1 : -1 });
    shown.current = { at, label };
  }, [at]); // eslint-disable-line react-hooks/exhaustive-deps

  const dir = leaving ? (leaving.dir === 1 ? 'next' : 'prev') : '';
  return (
    <div className="nav">
      <div className="nav-left">
        <button className="icon-btn" type="button" aria-label={isMonth ? 'Previous month' : 'Previous week'} onClick={() => shift(-1)}><IconPrev /></button>
        <div className="period" aria-live="polite">
          {leaving && (
            <PeriodLabel key={'out-' + leaving.at} label={leaving.label} className={'is-out is-' + dir} onDone={() => setLeaving(null)} />
          )}
          <PeriodLabel key={at} label={label} className={leaving ? 'is-in is-' + dir : undefined} />
        </div>
        <button className="icon-btn" type="button" aria-label={isMonth ? 'Next month' : 'Next week'} onClick={() => shift(1)}><IconNext /></button>
        <button className="ghost" type="button" onClick={now}><IconToday size={16} />{isMonth ? 'This month' : 'This week'}</button>
      </div>
    </div>
  );
}
