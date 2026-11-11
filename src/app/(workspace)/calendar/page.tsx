import Filters from '@/components/tasks/Filters';
import PeriodNav from '@/components/tasks/PeriodNav';
import MonthOverview from '@/components/views/MonthOverview';

export const metadata = { title: 'Calendar · Personal Schedule' };

// Stage 5 replaces this month overview with a full calendar synced with Google and Apple.
export default function CalendarPage() {
  return (
    <>
      <PeriodNav unit="month" />
      <div className="bar"><Filters scope="month" /></div>
      <MonthOverview />
    </>
  );
}
