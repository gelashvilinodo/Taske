import { Suspense } from 'react';
import Filters from '@/components/tasks/Filters';
import TaskTable from '@/components/views/TaskTable';

export const metadata = { title: 'Table · Personal Schedule' };

export default function TablePage() {
  return (
    <>
      <div className="toolbar"><Filters scope="all" /></div>
      {/* The table reads its dashboard filter from the URL */}
      <Suspense><TaskTable /></Suspense>
    </>
  );
}
