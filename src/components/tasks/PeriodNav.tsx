'use client';

import { addDays, isoWeek, MONTHS, monthStart, planningMonday, rangeLabel, weekEnd } from '@/lib/dates';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { IconNext, IconPrev, IconToday } from '@/components/shell/icons';

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
  return (
    <div className="nav">
      <div className="nav-left">
        <button className="icon-btn" type="button" aria-label={isMonth ? 'Previous month' : 'Previous week'} onClick={() => shift(-1)}><IconPrev /></button>
        <div className="period">
          <span className="eyebrow">{isMonth ? month.getFullYear() : 'Week ' + isoWeek(weekStart) + ' · ' + addDays(weekStart, 3).getFullYear()}</span>
          <h2>{isMonth ? MONTHS[month.getMonth()] : rangeLabel(weekStart, weekEnd(weekStart), MONTHS)}</h2>
        </div>
        <button className="icon-btn" type="button" aria-label={isMonth ? 'Next month' : 'Next week'} onClick={() => shift(1)}><IconNext /></button>
        <button className="ghost" type="button" onClick={now}><IconToday size={16} />{isMonth ? 'This month' : 'This week'}</button>
      </div>
    </div>
  );
}
