import { AlarmEditor } from '../../../../components/AlarmEditor';
import { createSupabaseServerClient, getCurrentUser } from '../../../../lib/supabase/server';

export default async function NewAlarmPage() {
  const user = await getCurrentUser();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('spotify_connections').select('user_id').eq('user_id', user!.id).maybeSingle();
  return <AlarmEditor userId={user!.id} spotifyConnected={Boolean(data)} />;
}
