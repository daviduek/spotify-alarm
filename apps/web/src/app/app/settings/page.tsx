import Link from 'next/link';

import { isSpotifyConfigured } from '../../../lib/env';
import type { Locale } from '../../../lib/i18n';
import { getLocale } from '../../../lib/i18n/server';
import { createSupabaseServerClient, getCurrentUser } from '../../../lib/supabase/server';

const SPOTIFY_MESSAGES: Record<Locale, Record<string, { tone: 'ok' | 'warn' | 'error'; text: string }>> = {
  en: {
    connected: { tone: 'ok', text: 'Spotify connected.' },
    disconnected: { tone: 'ok', text: 'Spotify disconnected.' },
    denied: { tone: 'warn', text: 'Spotify authorization was cancelled.' },
    not_configured: { tone: 'warn', text: 'Spotify is not configured on the server yet (SPOTIFY_CLIENT_ID + SUPABASE_SERVICE_ROLE_KEY).' },
    state_mismatch: { tone: 'error', text: 'Spotify sign-in could not be verified. Try again.' },
    exchange_failed: { tone: 'error', text: 'Spotify sign-in failed. Try again.' },
    save_failed: { tone: 'error', text: 'Could not save the Spotify connection.' },
  },
  es: {
    connected: { tone: 'ok', text: 'Spotify conectado.' },
    disconnected: { tone: 'ok', text: 'Spotify desconectado.' },
    denied: { tone: 'warn', text: 'La autorización de Spotify fue cancelada.' },
    not_configured: { tone: 'warn', text: 'Spotify todavía no está configurado en el servidor (SPOTIFY_CLIENT_ID + SUPABASE_SERVICE_ROLE_KEY).' },
    state_mismatch: { tone: 'error', text: 'No se pudo verificar el inicio de sesión de Spotify. Intenta de nuevo.' },
    exchange_failed: { tone: 'error', text: 'El inicio de sesión de Spotify falló. Intenta de nuevo.' },
    save_failed: { tone: 'error', text: 'No se pudo guardar la conexión con Spotify.' },
  },
};

const STR: Record<Locale, {
  settings: string;
  account: string;
  email: string;
  signOut: string;
  notConfigured: string;
  connected: string;
  premiumWarn: string;
  disconnect: string;
  disconnectSpotify: string;
  notConnected: string;
  wakeUpToPlaylists: string;
  connectSpotify: string;
  more: string;
  diagnostics: string;
  privacy: string;
  terms: string;
  footer: string;
}> = {
  en: {
    settings: 'Settings',
    account: 'Account',
    email: 'Email',
    signOut: 'Sign out',
    notConfigured: "Spotify isn't configured on the server yet. See docs/SETUP-WEB.md.",
    connected: 'Connected',
    premiumWarn: 'Playback needs Spotify Premium. Your fallback sound will still ring.',
    disconnect: 'Disconnect',
    disconnectSpotify: 'Disconnect Spotify',
    notConnected: 'Not connected',
    wakeUpToPlaylists: 'Wake up to your playlists.',
    connectSpotify: 'Connect Spotify',
    more: 'More',
    diagnostics: 'Diagnostics',
    privacy: 'Privacy',
    terms: 'Terms',
    footer: "Wake never sees your Spotify password. Sign-in happens on Spotify's own page and tokens stay on the server.",
  },
  es: {
    settings: 'Ajustes',
    account: 'Cuenta',
    email: 'Correo',
    signOut: 'Cerrar sesión',
    notConfigured: 'Spotify todavía no está configurado en el servidor. Consulta docs/SETUP-WEB.md.',
    connected: 'Conectado',
    premiumWarn: 'La reproducción necesita Spotify Premium. Tu sonido de respaldo igual sonará.',
    disconnect: 'Desconectar',
    disconnectSpotify: 'Desconectar Spotify',
    notConnected: 'No conectado',
    wakeUpToPlaylists: 'Despierta con tus playlists.',
    connectSpotify: 'Conectar Spotify',
    more: 'Más',
    diagnostics: 'Diagnóstico',
    privacy: 'Privacidad',
    terms: 'Términos',
    footer: 'Wake nunca ve tu contraseña de Spotify. El inicio de sesión ocurre en la propia página de Spotify y los tokens se quedan en el servidor.',
  },
};

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ spotify?: string }> }) {
  const { spotify } = await searchParams;
  const locale = await getLocale();
  const t = STR[locale];
  const user = await getCurrentUser();
  const supabase = await createSupabaseServerClient();
  const { data: connection } = await supabase.from('spotify_connection_status').select('*').eq('user_id', user!.id).maybeSingle();
  const notice = spotify ? SPOTIFY_MESSAGES[locale][spotify] : undefined;
  const connected = Boolean(connection);

  return (
    <main>
      <h1 style={{ fontSize: 22 }}>{t.settings}</h1>
      {notice ? <p className={`alert ${notice.tone === 'ok' ? 'ok' : notice.tone === 'warn' ? 'warn' : 'error'}`} style={{ marginTop: 12 }}>{notice.text}</p> : null}

      <div className="section">
        <h2>{t.account}</h2>
        <div className="list-row"><span className="label">{t.email}</span><span className="value">{user!.email}</span></div>
        <div className="list-row">
          <span className="label">{t.signOut}</span>
          <form action="/auth/signout" method="post"><button className="btn btn-ghost" type="submit">{t.signOut}</button></form>
        </div>
      </div>

      <div className="section">
        <h2>Spotify</h2>
        {!isSpotifyConfigured() ? (
          <div className="list-row"><span className="value">{t.notConfigured}</span></div>
        ) : connected ? (
          <>
            <div className="list-row">
              <span className="label">{t.connected}</span>
              <span className="value">{connection?.display_name ?? connection?.spotify_user_id} {connection?.product ? `· ${connection.product}` : ''}</span>
            </div>
            {connection?.product && connection.product !== 'premium' ? (
              <p className="alert warn" style={{ margin: '8px 18px' }}>{t.premiumWarn}</p>
            ) : null}
            <div className="list-row">
              <span className="label">{t.disconnect}</span>
              <form action="/api/spotify/disconnect" method="post"><button className="btn btn-danger" type="submit">{t.disconnectSpotify}</button></form>
            </div>
          </>
        ) : (
          <div className="list-row">
            <div><span className="label">{t.notConnected}</span><div className="value">{t.wakeUpToPlaylists}</div></div>
            {/* One button — the whole OAuth flow is server-side */}
            <a className="btn btn-spotify" href="/api/spotify/connect">{t.connectSpotify}</a>
          </div>
        )}
      </div>

      <div className="section">
        <h2>{t.more}</h2>
        <div className="list-row"><Link href="/app/diagnostics" className="label">{t.diagnostics}</Link></div>
        <div className="list-row"><Link href="/privacy" className="label">{t.privacy}</Link></div>
        <div className="list-row"><Link href="/terms" className="label">{t.terms}</Link></div>
      </div>

      <p className="sub" style={{ marginTop: 16, fontSize: 13, textAlign: 'center' }}>
        {t.footer}
      </p>
    </main>
  );
}
