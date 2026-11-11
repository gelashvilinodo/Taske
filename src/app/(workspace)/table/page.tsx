import Filters from '@/components/tasks/Filters';
import TaskTable from '@/components/views/TaskTable';

export const metadata = { title: 'Table · Personal Schedule' };

export default function TablePage() {
  return (
    <>
      <div className="bar"><Filters scope="all" /></div>
      <TaskTable />
    </>
  );
}
