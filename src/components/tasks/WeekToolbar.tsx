'use client';

import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import AddTaskForm from './AddTaskForm';
import Filters from './Filters';
import PeriodNav from './PeriodNav';
import WeekNotices from './WeekNotices';
import WeekStats from './WeekStats';

/** Everything above a week view: stat cards, period and filter toolbar, entry form and notices. */
export default function WeekToolbar() {
  const { readOnly } = useWorkspace();
  return (
    <>
      <WeekStats />
      <div className="toolbar">
        <PeriodNav unit="week" />
        <Filters scope="week" />
      </div>
      {!readOnly && <AddTaskForm />}
      <WeekNotices />
    </>
  );
}
