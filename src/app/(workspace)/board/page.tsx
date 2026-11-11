import WeekToolbar from '@/components/tasks/WeekToolbar';
import WeekBoard from '@/components/views/WeekBoard';

export const metadata = { title: 'Board · Personal Schedule' };

export default function BoardPage() {
  return (<><WeekToolbar /><WeekBoard /></>);
}
