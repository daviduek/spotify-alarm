import { createSupabaseServerClient, getCurrentUser } from '../../../lib/supabase/server';
import { ClockMode } from '../../../components/ClockMode';

export default async function ClockPage() {
  const user = await getCurrentUser();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('spotify_connections').select('user_id').eq('user_id', user!.id).maybeSingle();
  return <ClockMode userId={user!.id} spotifyConnected={Boolean(data)} />;
}
