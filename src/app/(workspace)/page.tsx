import Dashboard from '@/components/dashboard/Dashboard';

export const metadata = { title: 'Dashboard · Personal Schedule' };

/** Home: the dashboard. Signed-out visitors are sent to /login by the workspace layout. */
export default function DashboardPage() {
  return <Dashboard />;
}
