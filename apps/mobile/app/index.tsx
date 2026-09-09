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
import { upsertAlarm } from '../src/services/alarms/alarmRepository';
import { alarmAudioEngine } from '../src/services/audio/alarmAudioEngine';
import { flags } from '../src/services/config';
import { recordAlarmEvent } from '../src/services/history';
import { getLocale, type Locale } from '../src/services/i18n';
import { logger } from '../src/services/logger';
import { DEFAULT_LAB_OPTIONS, getLabOptions, getSetting, getTestSource, setLabOptions, setSetting, setTestSource, type LabOptions } from '../src/services/settings';
import { SpotifyAuthError, connectSpotify as connectSpotifyAuth } from '../src/services/spotify/spotifyAuth';
import { isSpotifyConfigured } from '../src/services/spotify/spotifyConfig';
import { spotifyProvider } from '../src/services/spotify/spotifyProvider';
import { deleteAlarmEverywhere, requestSync } from '../src/services/sync';
import { useRuntimeStore } from '../src/state/runtimeStore';
import { formatClock } from '../src/utils/async';

const TEST_ALARM_KEY = 'lab_last_test_alarm_id';

const STR: Record<Locale, {
  title: string; subtitle: string;
  ringingNow: string; alarm: string; since: string; stop: string;
  readiness: string; status: string; alarmPermission: string; notifications: string; fullScreenUi: string; nativeScheduled: string; fallbackSound: string;
  sectionAlarm: string; hintIos: string; hintAndroid: string;
  testSourceLabel: string; wakeSound: string; resetSourceA11y: string;
  schedule60: string; schedule15: string; cancelTest: string;
  testOptions: string; snooze: string; off: string; progressiveVolume: string; vibration: string; openOnFire: string; openOnFireA11y: string;
  sectionSound: string; soundHint: string; playLocal: string; testFade: string;
  sectionRecording: string; recordingRow: string; selected: string;
  sectionSpotify: string; spotifyHintOk: string; spotifyHintNoId: string;
  connectSpotify: string; disconnectSpotify: string; sourcePrefix: string; choosePlaylist: string; testSpotifyNow: string; pauseSpotify: string;
  diagnostics: string; openDiagnostics: string; account: string; openAccount: string; lastResult: string; fallbackNote: string;
  simulate: string; reportTitle: string; reportBody: string;
  scheduledFor: string; lockPhone: string; notScheduled: string; noTestAlarm: string; testCancelled: string; nothingRinging: string; stopSent: string;
  playing: string; stopped: string; fadeMsg: string;
  spotifyConnectedMsg: string; spotifyCancelledMsg: string; spotifyDisconnectedMsg: string; spotifyNoClientId: string; choosePlaylistFirst: string; spotifyStartedA: string; spotifyStartedB: string; pauseSent: string;
  testAlarmName: string;
}> = {
  en: {
    title: 'Wake · Phase 0',
    subtitle: 'Technical validation lab. Fill docs/TECHNICAL_VALIDATION.md while you test on a real device.',
    ringingNow: 'Ringing now', alarm: 'Alarm', since: 'since', stop: 'Stop',
    readiness: 'Readiness', status: 'Status', alarmPermission: 'Alarm permission', notifications: 'Notifications',
    fullScreenUi: 'Full-screen alarm UI', nativeScheduled: 'Native alarms scheduled', fallbackSound: 'Fallback sound',
    sectionAlarm: '1 · Alarm',
    hintIos: 'iOS: AlarmKit (iOS 26+). Snooze length is fixed when the alarm is scheduled.',
    hintAndroid: 'Android: AlarmManager.setAlarmClock + foreground service + full-screen activity.',
    testSourceLabel: 'Test source', wakeSound: 'Wake sound', resetSourceA11y: 'Reset test source to the fallback sound',
    schedule60: 'Schedule alarm in 60 seconds', schedule15: 'Schedule alarm in 15 seconds', cancelTest: 'Cancel test alarm',
    testOptions: 'Test alarm options', snooze: 'Snooze', off: 'Off', progressiveVolume: 'Progressive volume', vibration: 'Vibration',
    openOnFire: 'Open app when it rings', openOnFireA11y: 'Open the app when the alarm rings',
    sectionSound: '2 · Local sound', soundHint: 'Plays through the JS audio engine (foreground). The alarm itself uses native playback.',
    playLocal: 'Play local sound', testFade: 'Test progressive volume (30 s)',
    sectionRecording: '3 · My recording', recordingRow: 'Record / play / choose a recording', selected: 'selected',
    sectionSpotify: '4 · Spotify',
    spotifyHintOk: 'Web API remote control. Requires Premium + the Spotify app.',
    spotifyHintNoId: 'Client ID not configured — set EXPO_PUBLIC_SPOTIFY_CLIENT_ID.',
    connectSpotify: 'Connect Spotify', disconnectSpotify: 'Disconnect Spotify', sourcePrefix: 'Source:',
    choosePlaylist: 'Choose playlist / album / track', testSpotifyNow: 'Test Spotify playback now', pauseSpotify: 'Pause Spotify',
    diagnostics: 'Diagnostics', openDiagnostics: 'Open diagnostics', account: 'Account', openAccount: 'Sign in & sync',
    lastResult: 'Last result',
    fallbackNote: 'Fallback rule: the native alarm always rings with the fallback sound. Spotify or your recording are layered on top, never required.',
    simulate: 'Simulate: something went wrong?', reportTitle: 'Reporting',
    reportBody: 'Open Diagnostics and screenshot the Native alarm engine + Logs sections.',
    scheduledFor: 'Scheduled for', lockPhone: '· now lock the phone.', notScheduled: 'Not scheduled',
    noTestAlarm: 'No test alarm to cancel', testCancelled: 'Test alarm cancelled', nothingRinging: 'Nothing is ringing', stopSent: 'Stop sent',
    playing: 'Playing', stopped: 'Stopped',
    fadeMsg: 'Fading 10% → 70% over 30 s (foreground JS fade). Native fade is tested via the test alarm.',
    spotifyConnectedMsg: 'Spotify connected', spotifyCancelledMsg: 'Spotify connection cancelled', spotifyDisconnectedMsg: 'Spotify disconnected',
    spotifyNoClientId: 'Spotify Client ID missing. Add EXPO_PUBLIC_SPOTIFY_CLIENT_ID and rebuild (see docs/SETUP.md).',
    choosePlaylistFirst: 'Choose a Spotify playlist first.',
    spotifyStartedA: 'Spotify started', spotifyStartedB: 'Now test again with Spotify killed / phone locked.', pauseSent: 'Pause sent',
    testAlarmName: 'Test alarm',
  },
  es: {
    title: 'Wake · Fase 0',
    subtitle: 'Laboratorio de validación técnica. Completa docs/TECHNICAL_VALIDATION.md mientras pruebas en un dispositivo real.',
    ringingNow: 'Sonando ahora', alarm: 'Alarma', since: 'desde', stop: 'Detener',
    readiness: 'Preparación', status: 'Estado', alarmPermission: 'Permiso de alarma', notifications: 'Notificaciones',
    fullScreenUi: 'UI de alarma en pantalla completa', nativeScheduled: 'Alarmas nativas programadas', fallbackSound: 'Sonido de respaldo',
    sectionAlarm: '1 · Alarma',
    hintIos: 'iOS: AlarmKit (iOS 26+). La duración del snooze queda fija al programar la alarma.',
    hintAndroid: 'Android: AlarmManager.setAlarmClock + servicio en primer plano + actividad en pantalla completa.',
    testSourceLabel: 'Fuente de prueba', wakeSound: 'Sonido de alarma', resetSourceA11y: 'Restablecer la fuente de prueba al sonido de respaldo',
    schedule60: 'Programar alarma en 60 segundos', schedule15: 'Programar alarma en 15 segundos', cancelTest: 'Cancelar alarma de prueba',
    testOptions: 'Opciones de la alarma de prueba', snooze: 'Snooze', off: 'Apagado', progressiveVolume: 'Volumen progresivo', vibration: 'Vibración',
    openOnFire: 'Abrir la app cuando suene', openOnFireA11y: 'Abrir la app cuando suene la alarma',
    sectionSound: '2 · Sonido local', soundHint: 'Suena por el motor de audio JS (primer plano). La alarma real usa reproducción nativa.',
    playLocal: 'Reproducir sonido local', testFade: 'Probar volumen progresivo (30 s)',
    sectionRecording: '3 · Mi grabación', recordingRow: 'Grabar / reproducir / elegir una grabación', selected: 'seleccionada',
    sectionSpotify: '4 · Spotify',
    spotifyHintOk: 'Control remoto por Web API. Requiere Premium + la app de Spotify.',
    spotifyHintNoId: 'Client ID sin configurar — define EXPO_PUBLIC_SPOTIFY_CLIENT_ID.',
    connectSpotify: 'Conectar Spotify', disconnectSpotify: 'Desconectar Spotify', sourcePrefix: 'Fuente:',
    choosePlaylist: 'Elegir playlist / álbum / canción', testSpotifyNow: 'Probar reproducción de Spotify ahora', pauseSpotify: 'Pausar Spotify',
    diagnostics: 'Diagnóstico', openDiagnostics: 'Abrir diagnóstico', account: 'Cuenta', openAccount: 'Iniciar sesión y sincronizar',
    lastResult: 'Último resultado',
    fallbackNote: 'Regla de respaldo: la alarma nativa siempre suena con el sonido de respaldo. Spotify o tu grabación se suman encima, nunca son requisito.',
    simulate: 'Simular: ¿algo salió mal?', reportTitle: 'Reporte',
    reportBody: 'Abre Diagnóstico y captura las secciones Motor de alarma nativo + Logs.',
    scheduledFor: 'Programada para', lockPhone: '· ahora bloquea el teléfono.', notScheduled: 'No se programó',
    noTestAlarm: 'No hay alarma de prueba para cancelar', testCancelled: 'Alarma de prueba cancelada', nothingRinging: 'No hay nada sonando', stopSent: 'Detención enviada',
    playing: 'Reproduciendo', stopped: 'Detenido',
    fadeMsg: 'Subiendo 10% → 70% en 30 s (fade JS en primer plano). El fade nativo se prueba con la alarma de prueba.',
    spotifyConnectedMsg: 'Spotify conectado', spotifyCancelledMsg: 'Conexión con Spotify cancelada', spotifyDisconnectedMsg: 'Spotify desconectado',
    spotifyNoClientId: 'Falta el Client ID de Spotify. Agrega EXPO_PUBLIC_SPOTIFY_CLIENT_ID y recompila (ver docs/SETUP.md).',
    choosePlaylistFirst: 'Primero elige una playlist de Spotify.',
    spotifyStartedA: 'Spotify inició', spotifyStartedB: 'Prueba de nuevo con Spotify cerrado / teléfono bloqueado.', pauseSent: 'Pausa enviada',
    testAlarmName: 'Alarma de prueba',
  },
};

/**
 * PHASE 0 — TECHNICAL VALIDATION LAB (spec §83).
 * Not the product UI. Every button exercises one native capability so a tester can fill
 * docs/TECHNICAL_VALIDATION.md on real devices.
 */
export default function LabScreen() {
  const router = useRouter();
  const locale = getLocale();
  const str = STR[locale];
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
    const alarm = buildTestAlarm(o, src, Crypto.randomUUID(), Date.now() + 60_000, str.testAlarmName);
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
      const alarm = buildTestAlarm(options, testSource, id, fireAt, str.testAlarmName);
      await upsertAlarm(alarm);
      const res = await alarmScheduler.schedule(alarm, {
        fireAtEpochMs: fireAt,
        soundUri: testSource?.type === 'recording' ? testSource.fileUri : undefined,
        openAppOnFire: options.openAppOnFire,
      });
      if (!res.ok) {
        await deleteAlarmEverywhere(id);
        return `${str.notScheduled}: ${res.reason}${res.detail ? ` — ${res.detail}` : ''}`;
      }
      await setSetting(TEST_ALARM_KEY, id);
      await recordAlarmEvent({ alarmId: id, scheduledAt: new Date(fireAt).toISOString(), snoozeCount: 0 });
      logger.info('test_alarm_started', { alarmId: id, seconds, source: testSource?.type ?? 'local' });
      requestSync('lab_alarm_scheduled');
      return `${str.scheduledFor} ${formatClock(new Date(fireAt))}:${String(new Date(fireAt).getSeconds()).padStart(2, '0')} ${str.lockPhone}`;
    });

  const cancelTest = () =>
    run('Cancel test alarm', async () => {
      if (!lastTestAlarmId) return str.noTestAlarm;
      await alarmScheduler.cancel(lastTestAlarmId);
      await deleteAlarmEverywhere(lastTestAlarmId);
      await setSetting(TEST_ALARM_KEY, null);
      return str.testCancelled;
    });

  const stopRinging = () =>
    run('Stop', async () => {
      const active = await WakeAlarm.getActiveAlarm();
      if (!active && !lastTestAlarmId) return str.nothingRinging;
      await alarmScheduler.stop(active?.id ?? lastTestAlarmId!);
      return str.stopSent;
    });

  const requestPermission = () =>
    run('Alarm permission', async () => {
      const state = await alarmScheduler.requestPermission();
      return `${str.alarmPermission}: ${state}`;
    });

  // ---- Sound -----------------------------------------------------------------

  const playPreview = () => run('Play sound', async () => alarmAudioEngine.preview({ type: 'local', soundId: previewSound }).then(() => `${str.playing} ${wakeSoundName(previewSound, locale)}`));
  const stopPreview = () => run('Stop sound', async () => alarmAudioEngine.stop().then(() => str.stopped));
  const testFade = () =>
    run('Progressive volume', async () => {
      await alarmAudioEngine.previewFade(previewSound, { startVolume: 0.1, endVolume: 0.7, durationSeconds: 30, curve: 'linear' });
      return str.fadeMsg;
    });

  // ---- Spotify -----------------------------------------------------------------

  const connectSpotify = () =>
    run('Connect Spotify', async () => {
      try {
        const ok = await connectSpotifyAuth();
        await spotifyProvider.getReadiness(true);
        return ok ? str.spotifyConnectedMsg : str.spotifyCancelledMsg;
      } catch (error) {
        if (error instanceof SpotifyAuthError && error.code === 'not_configured') {
          return str.spotifyNoClientId;
        }
        throw error;
      }
    });

  const disconnectSpotify = () => run('Disconnect Spotify', async () => spotifyProvider.disconnect().then(() => str.spotifyDisconnectedMsg));

  const testSpotify = () =>
    run('Test Spotify playback', async () => {
      const uri = testSource?.type === 'music' ? testSource.uri : null;
      if (!uri) return str.choosePlaylistFirst;
      const res = await spotifyProvider.play(uri);
      if (res.success) {
        logger.info('spotify_playback_success', { via: res.via });
        return `${str.spotifyStartedA} (${res.via}). ${str.spotifyStartedB}`;
      }
      return playbackFailureMessage(res.reason);
    });

  const pauseSpotify = () => run('Pause Spotify', async () => spotifyProvider.pause().then(() => str.pauseSent));

  // ---- Render ------------------------------------------------------------------

  const fadeOptions: { value: FadePresetId | 'off'; label: string }[] = [
    { value: 'off', label: str.off },
    ...Object.values(FADE_PRESETS).map((p) => ({ value: p.id, label: `${p.label} · ${Math.round(p.durationSeconds / 60)} min` })),
  ];

  return (
    <Screen>
      <View>
        <Title>{str.title}</Title>
        <Subtitle>{str.subtitle}</Subtitle>
      </View>

      {activeAlarm ? (
        <Section title={str.ringingNow}>
          <Row label={`${str.alarm} ${activeAlarm.id.slice(0, 8)}`} value={`${str.since} ${formatClock(new Date(activeAlarm.firedAtEpochMs))}`} onPress={() => router.push({ pathname: '/alarm/[id]', params: { id: activeAlarm.id } })} />
          <View style={{ padding: 12 }}>
            <Button title={str.stop} variant="danger" onPress={stopRinging} />
          </View>
        </Section>
      ) : null}

      <Section title={str.readiness} hint={readiness?.detail}>
        <Row label={str.status} right={readiness ? <StatusPill status={readiness.status} label={readiness.headline} /> : null} />
        <Divider />
        <Row label={str.alarmPermission} value={perms?.alarms ?? '…'} onPress={requestPermission} />
        {Platform.OS === 'android' ? <Row label={str.notifications} value={perms?.notifications ?? '…'} onPress={() => WakeAlarm.openNotificationSettings()} /> : null}
        {Platform.OS === 'android' ? <Row label={str.fullScreenUi} value={perms?.fullScreenIntent ?? '…'} onPress={() => WakeAlarm.openFullScreenIntentSettings()} /> : null}
        <Row label={str.nativeScheduled} value={String(scheduled.length)} />
        <Row label={str.fallbackSound} value={`${wakeSoundName(options.fallbackSoundId, locale) ?? 'Classic'} ✓`} />
        {flags.spotify_enabled ? <Row label="Spotify" value={spotifyReadiness ? describeProviderReadiness(spotifyReadiness) : '…'} /> : null}
        {readiness?.issues.map((i) => (
          <Note key={i.code} tone={i.severity === 'blocking' ? 'danger' : 'warning'}>
            {'  '}⚠ {i.title} — {i.detail}
          </Note>
        ))}
      </Section>

      <Section
        title={str.sectionAlarm}
        hint={Platform.OS === 'ios' ? str.hintIos : str.hintAndroid}
      >
        <Row label={str.testSourceLabel} value={testSource ? describeSource(testSource, (id) => wakeSoundName(id, locale), locale) : `${str.wakeSound} · ${wakeSoundName(options.fallbackSoundId, locale)}`} onPress={() => void setTestSource(null).then(refresh)} accessibilityLabel={str.resetSourceA11y} />
        <Divider />
        <View style={{ padding: 12, gap: 8 }}>
          <Button title={str.schedule60} variant="primary" onPress={() => scheduleTest(60)} loading={busy === 'Schedule in 60s'} />
          <Button title={str.schedule15} onPress={() => scheduleTest(15)} loading={busy === 'Schedule in 15s'} />
          <Button title={str.cancelTest} onPress={cancelTest} disabled={!lastTestAlarmId} />
        </View>
      </Section>

      <Section title={str.testOptions}>
        <Row label={str.snooze} />
        <Chips
          value={String(options.snoozeMinutes)}
          onChange={(v) => void updateOptions({ snoozeMinutes: Number(v) })}
          options={[{ value: '0', label: str.off }, { value: '5', label: '5 min' }, { value: '10', label: '10 min' }, { value: '15', label: '15 min' }]}
        />
        <Divider />
        <Row label={str.progressiveVolume} />
        <Chips value={options.fadePreset} onChange={(v) => void updateOptions({ fadePreset: v })} options={fadeOptions} />
        <Divider />
        <Row label={str.fallbackSound} />
        <Chips value={options.fallbackSoundId} onChange={(v) => void updateOptions({ fallbackSoundId: v })} options={WAKE_SOUNDS.map((s) => ({ value: s.id, label: wakeSoundName(s.id, locale) ?? s.name }))} />
        <Divider />
        <Row label={str.vibration} right={<Switch value={options.vibrate} onValueChange={(v) => void updateOptions({ vibrate: v })} accessibilityLabel={str.vibration} />} />
        <Divider />
        <Row
          label={str.openOnFire}
          right={<Switch value={options.openAppOnFire} onValueChange={(v) => void updateOptions({ openAppOnFire: v })} accessibilityLabel={str.openOnFireA11y} />}
        />
      </Section>

      <Section title={str.sectionSound} hint={str.soundHint}>
        <Chips value={previewSound} onChange={setPreviewSound} options={WAKE_SOUNDS.map((s) => ({ value: s.id, label: wakeSoundName(s.id, locale) ?? s.name }))} />
        <View style={{ padding: 12, gap: 8 }}>
          <Button title={str.playLocal} onPress={playPreview} />
          <Button title={str.testFade} onPress={testFade} />
          <Button title={str.stop} variant="ghost" onPress={stopPreview} />
        </View>
      </Section>

      {flags.recordings_enabled ? (
        <Section title={str.sectionRecording}>
          <Row label={str.recordingRow} value={testSource?.type === 'recording' ? str.selected : undefined} onPress={() => router.push('/recordings')} />
        </Section>
      ) : null}

      {flags.spotify_enabled ? (
        <Section title={str.sectionSpotify} hint={isSpotifyConfigured() ? str.spotifyHintOk : str.spotifyHintNoId}>
          <Row label={str.status} value={spotifyReadiness ? describeProviderReadiness(spotifyReadiness) : '…'} />
          <Divider />
          <View style={{ padding: 12, gap: 8 }}>
            {spotifyConnected ? (
              <Button title={str.disconnectSpotify} onPress={disconnectSpotify} />
            ) : (
              <Button title={str.connectSpotify} variant="spotify" onPress={connectSpotify} loading={busy === 'Connect Spotify'} />
            )}
            <Button title={testSource?.type === 'music' ? `${str.sourcePrefix} ${testSource.title}` : str.choosePlaylist} onPress={() => router.push('/spotify/picker')} disabled={!spotifyConnected} />
            <Button title={str.testSpotifyNow} onPress={testSpotify} loading={busy === 'Test Spotify playback'} disabled={!spotifyConnected || testSource?.type !== 'music'} />
            <Button title={str.pauseSpotify} variant="ghost" onPress={pauseSpotify} disabled={!spotifyConnected} />
          </View>
        </Section>
      ) : null}

      <Section title={str.account}>
        <Row label={str.openAccount} onPress={() => router.push('/account')} />
      </Section>

      <Section title={str.diagnostics}>
        <Row label={str.openDiagnostics} onPress={() => router.push('/diagnostics')} />
      </Section>

      {result ? (
        <Section title={str.lastResult}>
          <Note>{'\n'}  {result}{'\n'}</Note>
        </Section>
      ) : null}

      <Note>{str.fallbackNote}</Note>
      <Button title={str.simulate} variant="ghost" onPress={() => Alert.alert(str.reportTitle, str.reportBody)} />
    </Screen>
  );
}

function buildTestAlarm(options: LabOptions, source: AudioSource | null, id: string, fireAtEpochMs: number, name = 'Test alarm'): Alarm {
  const at = new Date(fireAtEpochMs);
  const fade = options.fadePreset === 'off' ? { enabled: false, durationSeconds: 0, initialVolume: 1, finalVolume: 1 } : fadeConfigFromPreset(options.fadePreset);
  return createAlarm(
    defaultAlarmDraft({
      name,
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
