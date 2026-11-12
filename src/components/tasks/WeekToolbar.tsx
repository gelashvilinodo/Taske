'use client';

import Filters from './Filters';
import PeriodNav from './PeriodNav';
import WeekNotices from './WeekNotices';
import WeekStats from './WeekStats';

/** Everything above a week view: stat cards, period and filter toolbar and notices (the New task window lives in the layout). */
export default function WeekToolbar() {
  return (
    <>
      <WeekStats />
      <div className="toolbar">
        <PeriodNav unit="week" />
        <Filters scope="week" />
      </div>
      <WeekNotices />
    </>
  );
}
