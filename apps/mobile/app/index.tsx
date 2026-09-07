import * as Crypto from 'expo-crypto';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Switch, View } from 'react-native';
import {
  FADE_PRESETS,
  WAKE_SOUNDS,
  computeReadiness,
  createAlarm,
  createSinglePlan,
  defaultAlarmDraft,
  describeProviderReadiness,
  describeSource,
  fadeConfigFromPreset,
  playbackFailureMessage,
  wakeSoundName,
  type Alarm,
  type AlarmReadiness,
  type AudioSource,
  type FadePresetId,
  type PermissionSnapshot,
  type ProviderReadiness,
  type ScheduledAlarm,
} from '@wake/domain';

import { WakeAlarm } from '../modules/wake-alarm';
import { Button, Chips, Divider, Note, Row, Screen, Section, StatusPill, Subtitle, Title } from '../src/components/ui';
import { alarmScheduler } from '../src/platform/nativeAlarmScheduler';
import { deleteAlarm, upsertAlarm } from '../src/services/alarms/alarmRepository';
import { alarmAudioEngine } from '../src/services/audio/alarmAudioEngine';
import { flags } from '../src/services/config';
import { recordAlarmEvent } from '../src/services/history';
import { logger } from '../src/services/logger';
import { DEFAULT_LAB_OPTIONS, getLabOptions, getSetting, getTestSource, setLabOptions, setSetting, setTestSource, type LabOptions } from '../src/services/settings';
import { SpotifyAuthError, connectSpotify as connectSpotifyAuth } from '../src/services/spotify/spotifyAuth';
import { isSpotifyConfigured } from '../src/services/spotify/spotifyConfig';
import { spotifyProvider } from '../src/services/spotify/spotifyProvider';
import { useRuntimeStore } from '../src/state/runtimeStore';
import { formatClock } from '../src/utils/async';

const TEST_ALARM_KEY = 'lab_last_test_alarm_id';

/**
 * PHASE 0 — TECHNICAL VALIDATION LAB (spec §83).
 * Not the product UI. Every button exercises one native capability so a tester can fill
 * docs/TECHNICAL_VALIDATION.md on real devices.
 */
export default function LabScreen() {
  const router = useRouter();
  const activeAlarm = useRuntimeStore((s) => s.activeAlarm);
  const setSpotifyReadiness = useRuntimeStore((s) => s.setSpotifyReadiness);
  const spotifyReadiness = useRuntimeStore((s) => s.spotifyReadiness);

  const [perms, setPerms] = useState<PermissionSnapshot | null>(null);
  const [scheduled, setScheduled] = useState<ScheduledAlarm[]>([]);
  const [options, setOptions] = useState<LabOptions>(DEFAULT_LAB_OPTIONS);
  const [testSource, setSource] = useState<AudioSource | null>(null);
  const [lastTestAlarmId, setLastTestAlarmId] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<AlarmReadiness | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [previewSound, setPreviewSound] = useState<string>('classic');
  const [spotifyConnected, setSpotifyConnected] = useState(false);

  const refresh = useCallback(async () => {
    const [p, s, o, src, last] = await Promise.all([alarmScheduler.getPermissions(), alarmScheduler.getScheduled(), getLabOptions(), getTestSource(), getSetting(TEST_ALARM_KEY)]);
    setPerms(p);
    setScheduled(s);
    setOptions(o);
    setSource(src);
    setLastTestAlarmId(last);
    let providerReadiness: ProviderReadiness | null = null;
    if (flags.spotify_enabled) {
      setSpotifyConnected(await spotifyProvider.isConnected());
      providerReadiness = await spotifyProvider.getReadiness();
      setSpotifyReadiness(providerReadiness);
    }
    const alarm = buildTestAlarm(o, src, Crypto.randomUUID(), Date.now() + 60_000);
    setReadiness(
      computeReadiness({
        alarm,
        permissions: p,
        nativeScheduled: s.length > 0 || !alarm.enabled,
        fallbackSoundAvailable: true,
        recordingAvailable: src?.type === 'recording' ? Boolean(src.fileUri) : undefined,
        provider: providerReadiness ? { name: 'Spotify', readiness: providerReadiness } : undefined,
      }),
    );
  }, [setSpotifyReadiness]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  useEffect(() => {
    return () => {
      void alarmAudioEngine.stop();
    };
  }, []);

  const run = async (label: string, fn: () => Promise<string | undefined>) => {
    setBusy(label);
    setResult(null);
    try {
      const r = await fn();
      if (typeof r === 'string') setResult(r);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('lab_action_failed', { label, message });
      setResult(`${label}: ${message}`);
    } finally {
      setBusy(null);
      void refresh();
    }
  };

  const updateOptions = async (patch: Partial<LabOptions>) => {
    const next = { ...options, ...patch };
    setOptions(next);
    await setLabOptions(next);
  };

  // ---- Alarm ---------------------------------------------------------------

  const scheduleTest = (seconds: number) =>
    run(`Schedule in ${seconds}s`, async () => {
      const fireAt = Date.now() + seconds * 1000;
      const id = Crypto.randomUUID();
      const alarm = buildTestAlarm(options, testSource, id, fireAt);
      await upsertAlarm(alarm);
      const res = await alarmScheduler.schedule(alarm, {
        fireAtEpochMs: fireAt,
        soundUri: testSource?.type === 'recording' ? testSource.fileUri : undefined,
        openAppOnFire: options.openAppOnFire,
      });
      if (!res.ok) {
        await deleteAlarm(id);
        return `Not scheduled: ${res.reason}${res.detail ? ` — ${res.detail}` : ''}`;
      }
      await setSetting(TEST_ALARM_KEY, id);
      await recordAlarmEvent({ alarmId: id, scheduledAt: new Date(fireAt).toISOString(), snoozeCount: 0 });
      logger.info('test_alarm_started', { alarmId: id, seconds, source: testSource?.type ?? 'local' });
      return `Scheduled for ${formatClock(new Date(fireAt))}:${String(new Date(fireAt).getSeconds()).padStart(2, '0')} · now lock the phone.`;
    });

  const cancelTest = () =>
    run('Cancel test alarm', async () => {
      if (!lastTestAlarmId) return 'No test alarm to cancel';
      await alarmScheduler.cancel(lastTestAlarmId);
      await deleteAlarm(lastTestAlarmId);
      await setSetting(TEST_ALARM_KEY, null);
      return 'Test alarm cancelled';
    });

  const stopRinging = () =>
    run('Stop', async () => {
      const active = await WakeAlarm.getActiveAlarm();
      if (!active && !lastTestAlarmId) return 'Nothing is ringing';
      await alarmScheduler.stop(active?.id ?? lastTestAlarmId!);
      return 'Stop sent';
    });

  const requestPermission = () =>
    run('Alarm permission', async () => {
      const state = await alarmScheduler.requestPermission();
      return `Alarm permission: ${state}`;
    });

  // ---- Sound -----------------------------------------------------------------

  const playPreview = () => run('Play sound', async () => alarmAudioEngine.preview({ type: 'local', soundId: previewSound }).then(() => `Playing ${wakeSoundName(previewSound)}`));
  const stopPreview = () => run('Stop sound', async () => alarmAudioEngine.stop().then(() => 'Stopped'));
  const testFade = () =>
    run('Progressive volume', async () => {
      await alarmAudioEngine.previewFade(previewSound, { startVolume: 0.1, endVolume: 0.7, durationSeconds: 30, curve: 'linear' });
      return 'Fading 10% → 70% over 30 s (foreground JS fade). Native fade is tested via the test alarm.';
    });

  // ---- Spotify -----------------------------------------------------------------

  const connectSpotify = () =>
    run('Connect Spotify', async () => {
      try {
        const ok = await connectSpotifyAuth();
        await spotifyProvider.getReadiness(true);
        return ok ? 'Spotify connected' : 'Spotify connection cancelled';
      } catch (error) {
        if (error instanceof SpotifyAuthError && error.code === 'not_configured') {
          return 'Spotify Client ID missing. Add EXPO_PUBLIC_SPOTIFY_CLIENT_ID and rebuild (see docs/SETUP.md).';
        }
        throw error;
      }
    });

  const disconnectSpotify = () => run('Disconnect Spotify', async () => spotifyProvider.disconnect().then(() => 'Spotify disconnected'));

  const testSpotify = () =>
    run('Test Spotify playback', async () => {
      const uri = testSource?.type === 'music' ? testSource.uri : null;
      if (!uri) return 'Choose a Spotify playlist first.';
      const res = await spotifyProvider.play(uri);
      if (res.success) {
        logger.info('spotify_playback_success', { via: res.via });
        return `Spotify started (${res.via}). Now test again with Spotify killed / phone locked.`;
      }
      return playbackFailureMessage(res.reason);
    });

  const pauseSpotify = () => run('Pause Spotify', async () => spotifyProvider.pause().then(() => 'Pause sent'));

  // ---- Render ------------------------------------------------------------------

  const fadeOptions: { value: FadePresetId | 'off'; label: string }[] = [
    { value: 'off', label: 'Off' },
    ...Object.values(FADE_PRESETS).map((p) => ({ value: p.id, label: `${p.label} · ${Math.round(p.durationSeconds / 60)} min` })),
  ];

  return (
    <Screen>
      <View>
        <Title>Wake · Phase 0</Title>
        <Subtitle>Technical validation lab. Fill docs/TECHNICAL_VALIDATION.md while you test on a real device.</Subtitle>
      </View>

      {activeAlarm ? (
        <Section title="Ringing now">
          <Row label={`Alarm ${activeAlarm.id.slice(0, 8)}`} value={`since ${formatClock(new Date(activeAlarm.firedAtEpochMs))}`} onPress={() => router.push({ pathname: '/alarm/[id]', params: { id: activeAlarm.id } })} />
          <View style={{ padding: 12 }}>
            <Button title="Stop" variant="danger" onPress={stopRinging} />
          </View>
        </Section>
      ) : null}

      <Section title="Readiness" hint={readiness?.detail}>
        <Row label="Status" right={readiness ? <StatusPill status={readiness.status} label={readiness.headline} /> : null} />
        <Divider />
        <Row label="Alarm permission" value={perms?.alarms ?? '…'} onPress={requestPermission} />
        {Platform.OS === 'android' ? <Row label="Notifications" value={perms?.notifications ?? '…'} onPress={() => WakeAlarm.openNotificationSettings()} /> : null}
        {Platform.OS === 'android' ? <Row label="Full-screen alarm UI" value={perms?.fullScreenIntent ?? '…'} onPress={() => WakeAlarm.openFullScreenIntentSettings()} /> : null}
        <Row label="Native alarms scheduled" value={String(scheduled.length)} />
        <Row label="Fallback sound" value={`${wakeSoundName(options.fallbackSoundId) ?? 'Classic'} ✓`} />
        {flags.spotify_enabled ? <Row label="Spotify" value={spotifyReadiness ? describeProviderReadiness(spotifyReadiness) : '…'} /> : null}
        {readiness?.issues.map((i) => (
          <Note key={i.code} tone={i.severity === 'blocking' ? 'danger' : 'warning'}>
            {'  '}⚠ {i.title} — {i.detail}
          </Note>
        ))}
      </Section>

      <Section
        title="1 · Alarm"
        hint={Platform.OS === 'ios' ? 'iOS: AlarmKit (iOS 26+). Snooze length is fixed when the alarm is scheduled.' : 'Android: AlarmManager.setAlarmClock + foreground service + full-screen activity.'}
      >
        <Row label="Test source" value={testSource ? describeSource(testSource, wakeSoundName) : `Wake sound · ${wakeSoundName(options.fallbackSoundId)}`} onPress={() => void setTestSource(null).then(refresh)} accessibilityLabel="Reset test source to the fallback sound" />
        <Divider />
        <View style={{ padding: 12, gap: 8 }}>
          <Button title="Schedule alarm in 60 seconds" variant="primary" onPress={() => scheduleTest(60)} loading={busy === 'Schedule in 60s'} />
          <Button title="Schedule alarm in 15 seconds" onPress={() => scheduleTest(15)} loading={busy === 'Schedule in 15s'} />
          <Button title="Cancel test alarm" onPress={cancelTest} disabled={!lastTestAlarmId} />
        </View>
      </Section>

      <Section title="Test alarm options">
        <Row label="Snooze" />
        <Chips
          value={String(options.snoozeMinutes)}
          onChange={(v) => void updateOptions({ snoozeMinutes: Number(v) })}
          options={[{ value: '0', label: 'Off' }, { value: '5', label: '5 min' }, { value: '10', label: '10 min' }, { value: '15', label: '15 min' }]}
        />
        <Divider />
        <Row label="Progressive volume" />
        <Chips value={options.fadePreset} onChange={(v) => void updateOptions({ fadePreset: v })} options={fadeOptions} />
        <Divider />
        <Row label="Fallback sound" />
        <Chips value={options.fallbackSoundId} onChange={(v) => void updateOptions({ fallbackSoundId: v })} options={WAKE_SOUNDS.map((s) => ({ value: s.id, label: s.name }))} />
        <Divider />
        <Row label="Vibration" right={<Switch value={options.vibrate} onValueChange={(v) => void updateOptions({ vibrate: v })} accessibilityLabel="Vibration" />} />
        <Divider />
        <Row
          label="Open app when it rings"
          right={<Switch value={options.openAppOnFire} onValueChange={(v) => void updateOptions({ openAppOnFire: v })} accessibilityLabel="Open the app when the alarm rings" />}
        />
      </Section>

      <Section title="2 · Local sound" hint="Plays through the JS audio engine (foreground). The alarm itself uses native playback.">
        <Chips value={previewSound} onChange={setPreviewSound} options={WAKE_SOUNDS.map((s) => ({ value: s.id, label: s.name }))} />
        <View style={{ padding: 12, gap: 8 }}>
          <Button title="Play local sound" onPress={playPreview} />
          <Button title="Test progressive volume (30 s)" onPress={testFade} />
          <Button title="Stop" variant="ghost" onPress={stopPreview} />
        </View>
      </Section>

      {flags.recordings_enabled ? (
        <Section title="3 · My recording">
          <Row label="Record / play / choose a recording" value={testSource?.type === 'recording' ? 'selected' : undefined} onPress={() => router.push('/recordings')} />
        </Section>
      ) : null}

      {flags.spotify_enabled ? (
        <Section title="4 · Spotify" hint={isSpotifyConfigured() ? 'Web API remote control. Requires Premium + the Spotify app.' : 'Client ID not configured — set EXPO_PUBLIC_SPOTIFY_CLIENT_ID.'}>
          <Row label="Status" value={spotifyReadiness ? describeProviderReadiness(spotifyReadiness) : '…'} />
          <Divider />
          <View style={{ padding: 12, gap: 8 }}>
            {spotifyConnected ? (
              <Button title="Disconnect Spotify" onPress={disconnectSpotify} />
            ) : (
              <Button title="Connect Spotify" variant="spotify" onPress={connectSpotify} loading={busy === 'Connect Spotify'} />
            )}
            <Button title={testSource?.type === 'music' ? `Source: ${testSource.title}` : 'Choose playlist / album / track'} onPress={() => router.push('/spotify/picker')} disabled={!spotifyConnected} />
            <Button title="Test Spotify playback now" onPress={testSpotify} loading={busy === 'Test Spotify playback'} disabled={!spotifyConnected || testSource?.type !== 'music'} />
            <Button title="Pause Spotify" variant="ghost" onPress={pauseSpotify} disabled={!spotifyConnected} />
          </View>
        </Section>
      ) : null}

      <Section title="Diagnostics">
        <Row label="Open diagnostics" onPress={() => router.push('/diagnostics')} />
      </Section>

      {result ? (
        <Section title="Last result">
          <Note>{'\n'}  {result}{'\n'}</Note>
        </Section>
      ) : null}

      <Note>Fallback rule: the native alarm always rings with the fallback sound. Spotify or your recording are layered on top, never required.</Note>
      <Button title="Simulate: something went wrong?" variant="ghost" onPress={() => Alert.alert('Reporting', 'Open Diagnostics and screenshot the Native alarm engine + Logs sections.')} />
    </Screen>
  );
}

function buildTestAlarm(options: LabOptions, source: AudioSource | null, id: string, fireAtEpochMs: number): Alarm {
  const at = new Date(fireAtEpochMs);
  const fade = options.fadePreset === 'off' ? { enabled: false, durationSeconds: 0, initialVolume: 1, finalVolume: 1 } : fadeConfigFromPreset(options.fadePreset);
  return createAlarm(
    defaultAlarmDraft({
      name: 'Test alarm',
      hour: at.getHours(),
      minute: at.getMinutes(),
      recurrence: { type: 'once' },
      snooze: { enabled: options.snoozeMinutes > 0, durationMinutes: options.snoozeMinutes || 10 },
      vibration: { enabled: options.vibrate, pattern: 'default' },
      audioPlan: createSinglePlan(source ?? { type: 'local', soundId: options.fallbackSoundId }),
      fadeIn: fade,
      fallbackSoundId: options.fallbackSoundId,
    }),
    id,
  );
}
