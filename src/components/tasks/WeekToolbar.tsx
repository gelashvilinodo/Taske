'use client';

import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import AddTaskForm from './AddTaskForm';
import Filters from './Filters';
import PeriodNav from './PeriodNav';
import WeekNotices from './WeekNotices';
import WeekStats from './WeekStats';

/** Everything above a week view: period controls, entry form, notices, filters and counts. */
export default function WeekToolbar() {
  const { readOnly } = useWorkspace();
  return (
    <>
      <PeriodNav unit="week" />
      {!readOnly && <AddTaskForm />}
      <WeekNotices />
      <div className="bar">
        <Filters scope="week" />
        <WeekStats />
      </div>
    </>
  );
}
