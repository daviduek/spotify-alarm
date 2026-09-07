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
import { clearLogRecords, getLogRecords } from '../src/services/logger';
import { isSpotifyConnected } from '../src/services/spotify/spotifyAuth';
import { SPOTIFY_REDIRECT_URI, isSpotifyConfigured } from '../src/services/spotify/spotifyConfig';
import { spotifyProvider } from '../src/services/spotify/spotifyProvider';
import { useRuntimeStore } from '../src/state/runtimeStore';

/** Spec §42 — everything a tester needs to explain "why didn't it ring?". */
export default function DiagnosticsScreen() {
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
    const readiness = flags.spotify_enabled ? await spotifyProvider.getReadiness(true) : 'disabled by flag';
    setSpotify({ configured: isSpotifyConfigured(), connected, readiness });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <Screen>
      <View>
        <Title>Diagnostics</Title>
        <Subtitle>Internal · share a screenshot when reporting an alarm problem.</Subtitle>
      </View>

      <Section title="Device & build">
        <Row label="Device" value={`${Device.manufacturer ?? ''} ${Device.modelName ?? Device.deviceName ?? '?'}`.trim()} />
        <Row label="OS" value={`${Device.osName ?? Platform.OS} ${Device.osVersion ?? ''}`} />
        <Row label="App version" value={`${Application.nativeApplicationVersion ?? '?'} (${Application.nativeBuildVersion ?? '?'})`} />
        <Row label="JS config version" value={Constants.expoConfig?.version ?? '?'} />
        <Row label="Variant" value={appVariant} />
        <Row label="Flags" value={Object.entries(flags).filter(([, v]) => v).map(([k]) => k.replace('_enabled', '')).join(', ')} />
      </Section>

      <Section title="Permissions">
        <Row label="Alarm scheduling" value={perms?.alarms ?? '…'} />
        <Row label="Notifications" value={perms?.notifications ?? '…'} />
        <Row label="Full-screen intent" value={perms?.fullScreenIntent ?? '…'} />
        <Row label="Native module supported" value={String(WakeAlarm.isSupported())} />
        <View style={{ padding: 12, gap: 8 }}>
          <Button title="Open alarm settings" onPress={() => WakeAlarm.openAlarmSettings()} />
          {Platform.OS === 'android' ? <Button title="Open notification settings" onPress={() => WakeAlarm.openNotificationSettings()} /> : null}
          {Platform.OS === 'android' ? <Button title="Open full-screen intent settings" onPress={() => WakeAlarm.openFullScreenIntentSettings()} /> : null}
        </View>
      </Section>

      <Section title="Native alarm engine">
        <Mono>{native ? JSON.stringify(native, null, 2) : 'Loading…'}</Mono>
      </Section>

      <Section title={`Scheduled (${scheduled.length})`}>
        {scheduled.length === 0 ? <Note>{'\n'}  No native alarms scheduled.{'\n'}</Note> : null}
        {scheduled.map((s) => (
          <Row key={s.alarmId} label={s.alarmId.slice(0, 8)} value={`${s.state} · ${s.nextFireAt ? new Date(s.nextFireAt).toLocaleString() : '—'}`} />
        ))}
      </Section>

      <Section title="Spotify">
        <Row label="Configured (Client ID)" value={String(spotify.configured)} />
        <Row label="Connected" value={String(spotify.connected)} />
        <Row label="Readiness" value={spotify.readiness} />
        <Mono>redirect: {SPOTIFY_REDIRECT_URI}</Mono>
      </Section>

      <Section title="Alarm history (SQLite)">
        {history.length === 0 ? <Note>{'\n'}  Nothing yet.{'\n'}</Note> : null}
        {history.map((h) => (
          <Row
            key={h.id}
            label={`${h.alarmId.slice(0, 8)} · ${new Date(h.scheduledAt).toLocaleTimeString()}`}
            value={`${h.firedAt ? 'fired' : 'scheduled'}${h.stoppedAt ? ' · stopped' : ''}${h.providerAttempted ? ` · spotify ${h.providerSucceeded ? 'ok' : h.providerFailureReason ?? 'fail'}` : ''}`}
          />
        ))}
      </Section>

      <Section title="Runtime events">
        <Mono>{events.length ? events.map((e) => `${e.at.slice(11, 19)}  ${e.text}`).join('\n') : 'No events this session.'}</Mono>
      </Section>

      <Section title={`Logs (${logs.length})`}>
        <Mono>{logs.slice(-40).map((l) => `${l.at.slice(11, 23)} ${l.level.toUpperCase().padEnd(5)} ${l.event} ${l.data ? JSON.stringify(l.data) : ''}`).join('\n') || 'Empty'}</Mono>
      </Section>

      <View style={{ gap: 8 }}>
        <Button title="Refresh" variant="primary" onPress={refresh} />
        <Button title="Clear logs" variant="ghost" onPress={() => { clearLogRecords(); setLogs([]); }} />
      </View>
    </Screen>
  );
}
