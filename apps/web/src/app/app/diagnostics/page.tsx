import { fetchHistory } from '../../../lib/data/history';
import { isSpotifyConfigured, isSupabaseConfigured } from '../../../lib/env';
import type { Locale } from '../../../lib/i18n';
import { getLocale } from '../../../lib/i18n/server';
import { createSupabaseServerClient, getCurrentUser } from '../../../lib/supabase/server';

const STR: Record<Locale, {
  title: string;
  intro: string;
  environment: string;
  alarmHistory: string;
  nothingYet: string;
  browserSupport: string;
  checksLine: string;
  consoleLine: string;
}> = {
  en: {
    title: 'Diagnostics',
    intro: 'Internal. Share a screenshot when reporting a problem.',
    environment: 'Environment',
    alarmHistory: 'Alarm history',
    nothingYet: 'Nothing yet.',
    browserSupport: 'Browser support',
    checksLine: 'Checks run in your browser: Notifications, Wake Lock, MediaRecorder, AudioContext.',
    consoleLine: 'Open the browser console if a feature is missing; Wake degrades gracefully.',
  },
  es: {
    title: 'Diagnóstico',
    intro: 'Interno. Comparte una captura de pantalla al reportar un problema.',
    environment: 'Entorno',
    alarmHistory: 'Historial de alarmas',
    nothingYet: 'Todavía nada.',
    browserSupport: 'Compatibilidad del navegador',
    checksLine: 'Las verificaciones corren en tu navegador: Notifications, Wake Lock, MediaRecorder, AudioContext.',
    consoleLine: 'Abre la consola del navegador si falta alguna función; Wake se degrada con gracia.',
  },
};

export default async function DiagnosticsPage() {
  const locale = await getLocale();
  const t = STR[locale];
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
      <h1 style={{ fontSize: 22 }}>{t.title}</h1>
      <p className="sub">{t.intro}</p>

      <div className="section">
        <h2>{t.environment}</h2>
        <pre className="mono-block">{JSON.stringify(info, null, 2)}</pre>
      </div>

      <div className="section">
        <h2>{t.alarmHistory}</h2>
        {(!history || history.length === 0) ? (
          <div className="list-row"><span className="value">{t.nothingYet}</span></div>
        ) : (
          <pre className="mono-block">{(history as Record<string, unknown>[]).map((h) => `${String(h.scheduled_at).slice(11, 19)}  alarm=${String(h.alarm_id ?? '—').slice(0, 8)}  ${h.fired_at ? 'fired' : 'sched'}${h.stopped_at ? ' stopped' : ''}${h.provider_attempted ? ` spotify=${h.provider_succeeded ? 'ok' : h.provider_failure_reason}` : ''}`).join('\n')}</pre>
        )}
      </div>

      <div className="section">
        <h2>{t.browserSupport}</h2>
        <BrowserSupport checksLine={t.checksLine} consoleLine={t.consoleLine} />
      </div>
    </main>
  );
}

function BrowserSupport({ checksLine, consoleLine }: { checksLine: string; consoleLine: string }) {
  return (
    <div className="mono-block" suppressHydrationWarning>
      {checksLine}
      <br />
      {consoleLine}
    </div>
  );
}
