import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { useCallback, useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import type { AlarmEvent, PermissionSnapshot, ScheduledAlarm } from '@wake/domain';

import { WakeAlarm, type NativeDiagnostics } from '../modules/wake-alarm';
import { Button, Mono, Note, Row, Screen, Section, Subtitle, Title } from '../src/components/ui';
import { alarmScheduler } from '../src/platform/nativeAlarmScheduler';
import { appVariant, flags } from '../src/services/config';
import { listAlarmHistory } from '../src/services/history';
import { getLocale, type Locale } from '../src/services/i18n';
import { clearLogRecords, getLogRecords } from '../src/services/logger';
import { isSpotifyConnected } from '../src/services/spotify/spotifyAuth';
import { SPOTIFY_REDIRECT_URI, isSpotifyConfigured } from '../src/services/spotify/spotifyConfig';
import { spotifyProvider } from '../src/services/spotify/spotifyProvider';
import { useRuntimeStore } from '../src/state/runtimeStore';

const STR: Record<Locale, {
  title: string; subtitle: string; deviceBuild: string; device: string; os: string; appVersion: string; jsConfig: string; variant: string; flagsLabel: string;
  permissions: string; alarmScheduling: string; notifications: string; fullScreenIntent: string; nativeSupported: string;
  openAlarmSettings: string; openNotifSettings: string; openFsiSettings: string;
  nativeEngine: string; loading: string; scheduled: string; noNativeAlarms: string;
  configured: string; connected: string; readiness: string; disabledByFlag: string;
  historyTitle: string; nothingYet: string; fired: string; scheduledState: string; stopped: string;
  runtimeEvents: string; noEvents: string; logs: string; empty: string; refresh: string; clearLogs: string;
}> = {
  en: {
    title: 'Diagnostics',
    subtitle: 'Internal · share a screenshot when reporting an alarm problem.',
    deviceBuild: 'Device & build', device: 'Device', os: 'OS', appVersion: 'App version', jsConfig: 'JS config version', variant: 'Variant', flagsLabel: 'Flags',
    permissions: 'Permissions', alarmScheduling: 'Alarm scheduling', notifications: 'Notifications', fullScreenIntent: 'Full-screen intent', nativeSupported: 'Native module supported',
    openAlarmSettings: 'Open alarm settings', openNotifSettings: 'Open notification settings', openFsiSettings: 'Open full-screen intent settings',
    nativeEngine: 'Native alarm engine', loading: 'Loading…', scheduled: 'Scheduled', noNativeAlarms: 'No native alarms scheduled.',
    configured: 'Configured (Client ID)', connected: 'Connected', readiness: 'Readiness', disabledByFlag: 'disabled by flag',
    historyTitle: 'Alarm history (SQLite)', nothingYet: 'Nothing yet.', fired: 'fired', scheduledState: 'scheduled', stopped: 'stopped',
    runtimeEvents: 'Runtime events', noEvents: 'No events this session.', logs: 'Logs', empty: 'Empty', refresh: 'Refresh', clearLogs: 'Clear logs',
  },
  es: {
    title: 'Diagnóstico',
    subtitle: 'Interno · comparte una captura al reportar un problema con la alarma.',
    deviceBuild: 'Dispositivo y build', device: 'Dispositivo', os: 'SO', appVersion: 'Versión de la app', jsConfig: 'Versión de config JS', variant: 'Variante', flagsLabel: 'Flags',
    permissions: 'Permisos', alarmScheduling: 'Programación de alarmas', notifications: 'Notificaciones', fullScreenIntent: 'Intent de pantalla completa', nativeSupported: 'Módulo nativo soportado',
    openAlarmSettings: 'Abrir ajustes de alarma', openNotifSettings: 'Abrir ajustes de notificaciones', openFsiSettings: 'Abrir ajustes de pantalla completa',
    nativeEngine: 'Motor de alarma nativo', loading: 'Cargando…', scheduled: 'Programadas', noNativeAlarms: 'No hay alarmas nativas programadas.',
    configured: 'Configurado (Client ID)', connected: 'Conectado', readiness: 'Preparación', disabledByFlag: 'desactivado por flag',
    historyTitle: 'Historial de alarmas (SQLite)', nothingYet: 'Nada todavía.', fired: 'sonó', scheduledState: 'programada', stopped: 'detenida',
    runtimeEvents: 'Eventos de runtime', noEvents: 'Sin eventos en esta sesión.', logs: 'Logs', empty: 'Vacío', refresh: 'Actualizar', clearLogs: 'Limpiar logs',
  },
};

/** Spec §42 — everything a tester needs to explain "why didn't it ring?". */
export default function DiagnosticsScreen() {
  const str = STR[getLocale()];
  const [perms, setPerms] = useState<PermissionSnapshot | null>(null);
  const [native, setNative] = useState<NativeDiagnostics | null>(null);
  const [scheduled, setScheduled] = useState<ScheduledAlarm[]>([]);
  const [history, setHistory] = useState<AlarmEvent[]>([]);
  const [spotify, setSpotify] = useState<{ configured: boolean; connected: boolean; readiness: string }>({ configured: false, connected: false, readiness: '…' });
  const [logs, setLogs] = useState(getLogRecords());
  const events = useRuntimeStore((s) => s.events);

  const refresh = useCallback(async () => {
    const [p, n, s, h] = await Promise.all([alarmScheduler.getPermissions(), WakeAlarm.getDiagnostics(), alarmScheduler.getScheduled(), listAlarmHistory(10)]);
    setPerms(p);
    setNative(n);
    setScheduled(s);
    setHistory(h);
    setLogs(getLogRecords());
    const connected = await isSpotifyConnected();
    const readiness = flags.spotify_enabled ? await spotifyProvider.getReadiness(true) : str.disabledByFlag;
    setSpotify({ configured: isSpotifyConfigured(), connected, readiness });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <Screen>
      <View>
        <Title>{str.title}</Title>
        <Subtitle>{str.subtitle}</Subtitle>
      </View>

      <Section title={str.deviceBuild}>
        <Row label={str.device} value={`${Device.manufacturer ?? ''} ${Device.modelName ?? Device.deviceName ?? '?'}`.trim()} />
        <Row label={str.os} value={`${Device.osName ?? Platform.OS} ${Device.osVersion ?? ''}`} />
        <Row label={str.appVersion} value={`${Application.nativeApplicationVersion ?? '?'} (${Application.nativeBuildVersion ?? '?'})`} />
        <Row label={str.jsConfig} value={Constants.expoConfig?.version ?? '?'} />
        <Row label={str.variant} value={appVariant} />
        <Row label={str.flagsLabel} value={Object.entries(flags).filter(([, v]) => v).map(([k]) => k.replace('_enabled', '')).join(', ')} />
      </Section>

      <Section title={str.permissions}>
        <Row label={str.alarmScheduling} value={perms?.alarms ?? '…'} />
        <Row label={str.notifications} value={perms?.notifications ?? '…'} />
        <Row label={str.fullScreenIntent} value={perms?.fullScreenIntent ?? '…'} />
        <Row label={str.nativeSupported} value={String(WakeAlarm.isSupported())} />
        <View style={{ padding: 12, gap: 8 }}>
          <Button title={str.openAlarmSettings} onPress={() => WakeAlarm.openAlarmSettings()} />
          {Platform.OS === 'android' ? <Button title={str.openNotifSettings} onPress={() => WakeAlarm.openNotificationSettings()} /> : null}
          {Platform.OS === 'android' ? <Button title={str.openFsiSettings} onPress={() => WakeAlarm.openFullScreenIntentSettings()} /> : null}
        </View>
      </Section>

      <Section title={str.nativeEngine}>
        <Mono>{native ? JSON.stringify(native, null, 2) : str.loading}</Mono>
      </Section>

      <Section title={`${str.scheduled} (${scheduled.length})`}>
        {scheduled.length === 0 ? <Note>{'\n'}  {str.noNativeAlarms}{'\n'}</Note> : null}
        {scheduled.map((s) => (
          <Row key={s.alarmId} label={s.alarmId.slice(0, 8)} value={`${s.state} · ${s.nextFireAt ? new Date(s.nextFireAt).toLocaleString() : '—'}`} />
        ))}
      </Section>

      <Section title="Spotify">
        <Row label={str.configured} value={String(spotify.configured)} />
        <Row label={str.connected} value={String(spotify.connected)} />
        <Row label={str.readiness} value={spotify.readiness} />
        <Mono>redirect: {SPOTIFY_REDIRECT_URI}</Mono>
      </Section>

      <Section title={str.historyTitle}>
        {history.length === 0 ? <Note>{'\n'}  {str.nothingYet}{'\n'}</Note> : null}
        {history.map((h) => (
          <Row
            key={h.id}
            label={`${h.alarmId.slice(0, 8)} · ${new Date(h.scheduledAt).toLocaleTimeString()}`}
            value={`${h.firedAt ? str.fired : str.scheduledState}${h.stoppedAt ? ` · ${str.stopped}` : ''}${h.providerAttempted ? ` · spotify ${h.providerSucceeded ? 'ok' : h.providerFailureReason ?? 'fail'}` : ''}`}
          />
        ))}
      </Section>

      <Section title={str.runtimeEvents}>
        <Mono>{events.length ? events.map((e) => `${e.at.slice(11, 19)}  ${e.text}`).join('\n') : str.noEvents}</Mono>
      </Section>

      <Section title={`${str.logs} (${logs.length})`}>
        <Mono>{logs.slice(-40).map((l) => `${l.at.slice(11, 23)} ${l.level.toUpperCase().padEnd(5)} ${l.event} ${l.data ? JSON.stringify(l.data) : ''}`).join('\n') || str.empty}</Mono>
      </Section>

      <View style={{ gap: 8 }}>
        <Button title={str.refresh} variant="primary" onPress={refresh} />
        <Button title={str.clearLogs} variant="ghost" onPress={() => { clearLogRecords(); setLogs([]); }} />
      </View>
    </Screen>
  );
}
