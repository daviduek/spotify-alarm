import { notFound } from 'next/navigation';

import { AlarmEditor } from '../../../../components/AlarmEditor';
import { fetchAlarm } from '../../../../lib/data/alarms';
import { createSupabaseServerClient, getCurrentUser } from '../../../../lib/supabase/server';

export default async function EditAlarmPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const supabase = await createSupabaseServerClient();
  const alarm = await fetchAlarm(supabase, user!.id, id);
  if (!alarm) notFound();
  const { data } = await supabase.from('spotify_connections').select('user_id').eq('user_id', user!.id).maybeSingle();
  return <AlarmEditor userId={user!.id} existing={alarm} spotifyConnected={Boolean(data)} />;
}
