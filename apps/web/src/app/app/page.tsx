import { getCurrentUser } from '../../lib/supabase/server';
import { AlarmsDashboard } from '../../components/AlarmsDashboard';

export default async function AppHome() {
  const user = await getCurrentUser();
  return <AlarmsDashboard userId={user!.id} />;
}
