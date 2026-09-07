import { fetchHistory } from '../../../lib/data/history';
import { isSpotifyConfigured, isSupabaseConfigured } from '../../../lib/env';
import { createSupabaseServerClient, getCurrentUser } from '../../../lib/supabase/server';

export default async function DiagnosticsPage() {
  const user = await getCurrentUser();
  const supabase = await createSupabaseServerClient();
  const [{ count: alarmCount }, { data: connection }, history] = await Promise.all([
    supabase.from('alarms').select('id', { count: 'exact', head: true }).eq('user_id', user!.id),
    supabase.from('spotify_connection_status').select('*').eq('user_id', user!.id).maybeSingle(),
    fetchHistory(supabase, user!.id, 15).catch(() => []),
  ]);

  const info = {
    userId: user!.id,
    email: user!.email,
    supabaseConfigured: isSupabaseConfigured(),
    spotifyConfigured: isSpotifyConfigured(),
    spotifyConnected: Boolean(connection),
    spotifyProduct: connection?.product ?? null,
    alarms: alarmCount ?? 0,
    generatedAt: new Date().toISOString(),
  };

  return (
    <main>
      <h1 style={{ fontSize: 22 }}>Diagnostics</h1>
      <p className="sub">Internal. Share a screenshot when reporting a problem.</p>

      <div className="section">
        <h2>Environment</h2>
        <pre className="mono-block">{JSON.stringify(info, null, 2)}</pre>
      </div>

      <div className="section">
        <h2>Alarm history</h2>
        {(!history || history.length === 0) ? (
          <div className="list-row"><span className="value">Nothing yet.</span></div>
        ) : (
          <pre className="mono-block">{(history as Record<string, unknown>[]).map((h) => `${String(h.scheduled_at).slice(11, 19)}  alarm=${String(h.alarm_id ?? '—').slice(0, 8)}  ${h.fired_at ? 'fired' : 'sched'}${h.stopped_at ? ' stopped' : ''}${h.provider_attempted ? ` spotify=${h.provider_succeeded ? 'ok' : h.provider_failure_reason}` : ''}`).join('\n')}</pre>
        )}
      </div>

      <div className="section">
        <h2>Browser support</h2>
        <BrowserSupport />
      </div>
    </main>
  );
}

function BrowserSupport() {
  return (
    <div className="mono-block" suppressHydrationWarning>
      Checks run in your browser: Notifications, Wake Lock, MediaRecorder, AudioContext.
      <br />
      Open the browser console if a feature is missing; Wake degrades gracefully.
    </div>
  );
}
