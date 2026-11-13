import Filters from '@/components/tasks/Filters';
import ListStats from '@/components/tasks/ListStats';
import PeriodNav from '@/components/tasks/PeriodNav';
import WeekNotices from '@/components/tasks/WeekNotices';
import StatusBoard from '@/components/views/StatusBoard';

export const metadata = { title: 'List · Personal Schedule' };

export default function ListPage() {
  return (
    <>
      <ListStats />
      <div className="toolbar">
        <PeriodNav unit="week" />
        <Filters scope="week" />
      </div>
      <WeekNotices />
      <StatusBoard />
    </>
  );
}
