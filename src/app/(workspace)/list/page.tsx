import WeekToolbar from '@/components/tasks/WeekToolbar';
import StatusBoard from '@/components/views/StatusBoard';

export const metadata = { title: 'List · Personal Schedule' };

export default function ListPage() {
  return (<><WeekToolbar /><StatusBoard /></>);
}
