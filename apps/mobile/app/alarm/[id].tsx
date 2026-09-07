import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  describeSource,
  planIncludesProvider,
  planIncludesRecording,
  playbackFailureMessage,
  primarySource,
  wakeSoundName,
  type Alarm,
} from '@wake/domain';

import { WakeAlarm } from '../../modules/wake-alarm';
import { historyIdFor } from '../../src/hooks/useNativeAlarmEvents';
import { alarmScheduler } from '../../src/platform/nativeAlarmScheduler';
import { getAlarm } from '../../src/services/alarms/alarmRepository';
import { alarmAudioEngine } from '../../src/services/audio/alarmAudioEngine';
import { flags } from '../../src/services/config';
import { recordAlarmEvent } from '../../src/services/history';
import { logger } from '../../src/services/logger';
import { spotifyProvider } from '../../src/services/spotify/spotifyProvider';
import { useRuntimeStore } from '../../src/state/runtimeStore';
import { formatClock, withTimeout } from '../../src/utils/async';
import { colors, radius, spacing, type } from '../../src/theme';

const SPOTIFY_TIMEOUT_MS = 25_000;

/**
 * JS alarm screen (spec §24, §35, §36). Reached via wake://alarm/<id> or the native event.
 * The native layer is ALREADY ringing the fallback sound when this mounts; this screen only
 * upgrades the experience (Spotify / recording) and offers STOP (hold) and SNOOZE.
 */
export default function AlarmScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const activeAlarm = useRuntimeStore((s) => s.activeAlarm);
  const setActiveAlarm = useRuntimeStore((s) => s.setActiveAlarm);

  const [alarm, setAlarm] = useState<Alarm | null>(null);
  const [now, setNow] = useState(new Date());
  const [status, setStatus] = useState('Fallback sound playing');
  const [holding, setHolding] = useState(false);
  const [done, setDone] = useState(false);
  const spotifyStarted = useRef(false);
  const sequenceStarted = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!id) return;
    void getAlarm(id).then(setAlarm);
  }, [id]);

  // Leave when the native side reports the alarm stopped/snoozed (e.g. from the Android activity).
  useEffect(() => {
    const subs = [
      WakeAlarm.addListener('onAlarmStopped', (e) => {
        if (e.id === id) leave();
      }),
      WakeAlarm.addListener('onAlarmSnoozed', (e) => {
        if (e.id === id) leave();
      }),
    ];
    return () => subs.forEach((s) => s.remove());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const leave = useCallback(() => {
    setDone(true);
    void alarmAudioEngine.stop();
    setActiveAlarm(null);
    router.replace('/');
  }, [router, setActiveAlarm]);

  const firedAt = activeAlarm?.id === id ? activeAlarm.firedAtEpochMs : Date.now();

  const writeHistory = useCallback(
    (patch: { stoppedAt?: string; providerAttempted?: boolean; providerSucceeded?: boolean; providerFailureReason?: string; audioSourceUsed?: 'fallback' | 'recording' | 'music' }) => {
      if (!id) return;
      void recordAlarmEvent({
        id: historyIdFor(id, firedAt),
        alarmId: id,
        scheduledAt: new Date(firedAt).toISOString(),
        firedAt: new Date(firedAt).toISOString(),
        snoozeCount: activeAlarm?.snoozeCount ?? 0,
        ...patch,
      });
    },
    [id, firedAt, activeAlarm?.snoozeCount],
  );

  /** Fallback → enhancement hand-off. Failure paths keep the native fallback ringing. */
  const runFireSequence = useCallback(
    async (a: Alarm) => {
      const source = primarySource(a.audioPlan);
      if (!source) return;

      if (source.type === 'music' && planIncludesProvider(a.audioPlan, 'spotify') && flags.spotify_enabled) {
        setStatus('Fallback sound playing · starting Spotify…');
        let result;
        try {
          result = await withTimeout(spotifyProvider.play(source.uri), SPOTIFY_TIMEOUT_MS, 'Spotify');
        } catch (error) {
          result = { success: false as const, reason: 'unknown' as const, detail: String(error) };
        }
        if (result.success) {
          spotifyStarted.current = true;
          setStatus(`Spotify · ${source.title}`);
          writeHistory({ providerAttempted: true, providerSucceeded: true, audioSourceUsed: 'music' });
          await handOffFromFallback(a.id);
        } else {
          setStatus(playbackFailureMessage(result.reason));
          writeHistory({ providerAttempted: true, providerSucceeded: false, providerFailureReason: result.reason, audioSourceUsed: 'fallback' });
        }
        return;
      }

      if (source.type === 'recording' && planIncludesRecording(a.audioPlan) && flags.recordings_enabled) {
        if (Platform.OS === 'android') {
          // AlarmService already plays the recording file natively (soundUri).
          setStatus(`Your recording · ${source.title ?? 'My recording'}`);
          writeHistory({ audioSourceUsed: 'recording' });
          return;
        }
        if (!source.fileUri) return;
        try {
          await alarmAudioEngine.crossfadeToRecording(source.fileUri);
          setStatus(`Your recording · ${source.title ?? 'My recording'}`);
          writeHistory({ audioSourceUsed: 'recording' });
          await handOffFromFallback(a.id);
        } catch (error) {
          logger.warn('recording_playback_failed', { message: String(error) });
          setStatus('Your recording could not play. Your fallback alarm is playing instead.');
        }
      }
    },
    [writeHistory],
  );

  useEffect(() => {
    if (!alarm || sequenceStarted.current) return;
    sequenceStarted.current = true;
    void runFireSequence(alarm);
  }, [alarm, runFireSequence]);

  const stop = async () => {
    if (!id || done) return;
    logger.info('alarm_stop_pressed', { alarmId: id });
    try {
      await alarmScheduler.stop(id);
    } catch (error) {
      logger.warn('alarm_stop_native_failed', { message: String(error) });
    }
    if (spotifyStarted.current) void spotifyProvider.pause();
    writeHistory({ stoppedAt: new Date().toISOString() });
    leave();
  };

  const snooze = async () => {
    if (!id || !alarm || done) return;
    const minutes = alarm.snooze.enabled ? alarm.snooze.durationMinutes : 0;
    if (minutes <= 0) return stop();
    logger.info('alarm_snooze_pressed', { alarmId: id, minutes });
    if (spotifyStarted.current) void spotifyProvider.pause();
    try {
      await alarmScheduler.snooze(id, minutes);
    } catch {
      // iOS after the alert was dismissed: re-arm a one-time alarm with the same id.
      await alarmScheduler.cancel(id).catch(() => undefined);
      await alarmScheduler.schedule(alarm, { fireAtEpochMs: Date.now() + minutes * 60_000 });
    }
    leave();
  };

  const source = alarm ? primarySource(alarm.audioPlan) : undefined;
  const snoozeMinutes = alarm?.snooze.enabled ? alarm.snooze.durationMinutes : 0;

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.top}>
        <Text style={styles.time} accessibilityLabel={`Current time ${formatClock(now)}`}>
          {formatClock(now)}
        </Text>
        <Text style={styles.name}>{alarm?.name ?? 'Alarm'}</Text>
        <Text style={styles.source}>{source ? describeSource(source, wakeSoundName) : ''}</Text>
        <Text style={styles.status}>{status}</Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          onPressIn={() => setHolding(true)}
          onPressOut={() => setHolding(false)}
          onLongPress={stop}
          delayLongPress={1000}
          accessibilityRole="button"
          accessibilityLabel="Stop alarm. Press and hold for one second."
          accessibilityHint="Stops the alarm"
          style={({ pressed }) => [styles.stop, pressed && styles.stopPressed]}
        >
          <Text style={styles.stopText}>{holding ? 'KEEP HOLDING…' : 'HOLD TO STOP'}</Text>
        </Pressable>
        <Pressable
          onPress={snooze}
          disabled={snoozeMinutes <= 0}
          accessibilityRole="button"
          accessibilityLabel={snoozeMinutes > 0 ? `Snooze for ${snoozeMinutes} minutes` : 'Snooze disabled'}
          style={({ pressed }) => [styles.snooze, snoozeMinutes <= 0 && styles.disabled, pressed && styles.stopPressed]}
        >
          <Text style={styles.snoozeText}>{snoozeMinutes > 0 ? `SNOOZE ${snoozeMinutes} MIN` : 'SNOOZE OFF'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

/** Android: fade the native fallback out; iOS: dismiss the system alert since another player took over. */
async function handOffFromFallback(alarmId: string): Promise<void> {
  if (Platform.OS === 'android') {
    for (let step = 10; step >= 0; step--) {
      await WakeAlarm.setAlarmVolume(alarmId, step / 10);
      await new Promise((r) => setTimeout(r, 100));
    }
    return;
  }
  try {
    await WakeAlarm.stopAlarm(alarmId);
  } catch (error) {
    logger.warn('ios_alert_dismiss_failed', { message: String(error) });
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000', justifyContent: 'space-between', paddingHorizontal: spacing.lg },
  top: { alignItems: 'center', paddingTop: spacing.xxl * 1.5, gap: spacing.sm },
  time: { ...type.display, color: colors.text },
  name: { ...type.headline, color: colors.text },
  source: { ...type.body, color: colors.textDim },
  status: { ...type.caption, color: colors.textMuted, textAlign: 'center', marginTop: spacing.md, paddingHorizontal: spacing.lg },
  actions: { gap: spacing.md, paddingBottom: spacing.xl },
  stop: { minHeight: 76, borderRadius: radius.pill, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  stopPressed: { opacity: 0.75 },
  stopText: { ...type.headline, color: colors.bg, letterSpacing: 2 },
  snooze: { minHeight: 60, borderRadius: radius.pill, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  snoozeText: { ...type.body, fontWeight: '600', color: colors.text, letterSpacing: 2 },
  disabled: { opacity: 0.4 },
});
