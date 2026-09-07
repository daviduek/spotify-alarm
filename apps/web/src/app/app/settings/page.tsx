import Link from 'next/link';

import { isSpotifyConfigured } from '../../../lib/env';
import { createSupabaseServerClient, getCurrentUser } from '../../../lib/supabase/server';

const SPOTIFY_MESSAGES: Record<string, { tone: 'ok' | 'warn' | 'error'; text: string }> = {
  connected: { tone: 'ok', text: 'Spotify connected.' },
  disconnected: { tone: 'ok', text: 'Spotify disconnected.' },
  denied: { tone: 'warn', text: 'Spotify authorization was cancelled.' },
  not_configured: { tone: 'warn', text: 'Spotify is not configured on the server yet (SPOTIFY_CLIENT_ID + SUPABASE_SERVICE_ROLE_KEY).' },
  state_mismatch: { tone: 'error', text: 'Spotify sign-in could not be verified. Try again.' },
  exchange_failed: { tone: 'error', text: 'Spotify sign-in failed. Try again.' },
  save_failed: { tone: 'error', text: 'Could not save the Spotify connection.' },
};

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ spotify?: string }> }) {
  const { spotify } = await searchParams;
  const user = await getCurrentUser();
  const supabase = await createSupabaseServerClient();
  const { data: connection } = await supabase.from('spotify_connection_status').select('*').eq('user_id', user!.id).maybeSingle();
  const notice = spotify ? SPOTIFY_MESSAGES[spotify] : undefined;
  const connected = Boolean(connection);

  return (
    <main>
      <h1 style={{ fontSize: 22 }}>Settings</h1>
      {notice ? <p className={`alert ${notice.tone === 'ok' ? 'ok' : notice.tone === 'warn' ? 'warn' : 'error'}`} style={{ marginTop: 12 }}>{notice.text}</p> : null}

      <div className="section">
        <h2>Account</h2>
        <div className="list-row"><span className="label">Email</span><span className="value">{user!.email}</span></div>
        <div className="list-row">
          <span className="label">Sign out</span>
          <form action="/auth/signout" method="post"><button className="btn btn-ghost" type="submit">Sign out</button></form>
        </div>
      </div>

      <div className="section">
        <h2>Spotify</h2>
        {!isSpotifyConfigured() ? (
          <div className="list-row"><span className="value">Spotify isn&apos;t configured on the server yet. See docs/SETUP-WEB.md.</span></div>
        ) : connected ? (
          <>
            <div className="list-row">
              <span className="label">Connected</span>
              <span className="value">{connection?.display_name ?? connection?.spotify_user_id} {connection?.product ? `· ${connection.product}` : ''}</span>
            </div>
            {connection?.product && connection.product !== 'premium' ? (
              <p className="alert warn" style={{ margin: '8px 18px' }}>Playback needs Spotify Premium. Your fallback sound will still ring.</p>
            ) : null}
            <div className="list-row">
              <span className="label">Disconnect</span>
              <form action="/api/spotify/disconnect" method="post"><button className="btn btn-danger" type="submit">Disconnect Spotify</button></form>
            </div>
          </>
        ) : (
          <div className="list-row">
            <div><span className="label">Not connected</span><div className="value">Wake up to your playlists.</div></div>
            {/* One button — the whole OAuth flow is server-side */}
            <a className="btn btn-spotify" href="/api/spotify/connect">Connect Spotify</a>
          </div>
        )}
      </div>

      <div className="section">
        <h2>More</h2>
        <div className="list-row"><Link href="/app/diagnostics" className="label">Diagnostics</Link></div>
        <div className="list-row"><Link href="/privacy" className="label">Privacy</Link></div>
        <div className="list-row"><Link href="/terms" className="label">Terms</Link></div>
      </div>

      <p className="sub" style={{ marginTop: 16, fontSize: 13, textAlign: 'center' }}>
        Wake never sees your Spotify password. Sign-in happens on Spotify&apos;s own page and tokens stay on the server.
      </p>
    </main>
  );
}
