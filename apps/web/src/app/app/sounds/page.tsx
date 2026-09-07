import { getCurrentUser } from '../../../lib/supabase/server';
import { RecordingsPanel } from '../../../components/RecordingsPanel';

export default async function SoundsPage() {
  const user = await getCurrentUser();
  return <RecordingsPanel userId={user!.id} />;
}
