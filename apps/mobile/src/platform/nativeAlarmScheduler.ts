import { Platform } from 'react-native';
import {
  planIncludesProvider,
  planIncludesRecording,
  type Alarm,
  type AlarmScheduler,
  type PermissionSnapshot,
  type PermissionState,
  type ScheduleResult,
  type ScheduledAlarm,
} from '@wake/domain';

import { WakeAlarm, type NativeAlarmSpec, type NativeAuthorizationStatus } from '../../modules/wake-alarm';
import { soundFileFor } from '../services/audio/localSounds';
import { logger } from '../services/logger';

export type ScheduleOptions = {
  /** Explicit one-time instant (test alarms). */
  fireAtEpochMs?: number;
  /** Android: file URI played natively instead of the bundled sound (recordings). */
  soundUri?: string;
  openAppOnFire?: boolean;
};

export function toNativeSpec(alarm: Alarm, opts: ScheduleOptions = {}): NativeAlarmSpec {
  const needsJs = planIncludesProvider(alarm.audioPlan) || planIncludesRecording(alarm.audioPlan);
  return {
    id: alarm.id,
    label: alarm.name || 'Alarm',
    hour: alarm.hour,
    minute: alarm.minute,
    weekdays: alarm.recurrence.type === 'weekly' ? alarm.recurrence.weekdays : [],
    fireAtEpochMs: opts.fireAtEpochMs,
    soundFile: soundFileFor(alarm.fallbackSoundId),
    soundUri: opts.soundUri,
    vibrate: alarm.vibration.enabled,
    snoozeMinutes: alarm.snooze.enabled ? alarm.snooze.durationMinutes : 0,
    fadeInSeconds: alarm.fadeIn.enabled ? alarm.fadeIn.durationSeconds : 0,
    fadeStartVolume: alarm.fadeIn.enabled ? alarm.fadeIn.initialVolume : 1,
    fadeEndVolume: alarm.fadeIn.enabled ? alarm.fadeIn.finalVolume : 1,
    openAppOnFire: opts.openAppOnFire ?? needsJs,
  };
}

function toPermissionState(status: NativeAuthorizationStatus): PermissionState {
  switch (status) {
    case 'authorized':
      return 'granted';
    case 'denied':
      return 'denied';
    case 'unsupported':
      return 'restricted';
    case 'notDetermined':
    default:
      return 'undetermined';
  }
}

/**
 * The single AlarmScheduler used by the app. Platform differences live in the native
 * module (AlarmKit vs AlarmManager); this adapter only maps domain ↔ native types.
 */
export class NativeAlarmScheduler implements AlarmScheduler {
  async requestPermission(): Promise<PermissionState> {
    const status = await WakeAlarm.requestAuthorization();
    logger.info('alarm_permission_requested', { status });
    return toPermissionState(status);
  }

  async getPermissions(): Promise<PermissionSnapshot> {
    const status = await WakeAlarm.getAuthorizationStatus();
    let notifications: PermissionState = 'not_applicable';
    let fullScreenIntent: PermissionState = 'not_applicable';
    if (Platform.OS === 'android') {
      fullScreenIntent = WakeAlarm.canUseFullScreenIntent() ? 'granted' : 'denied';
      const diag = await WakeAlarm.getDiagnostics();
      notifications = diag.notificationsEnabled === true ? 'granted' : diag.notificationsEnabled === false ? 'denied' : 'undetermined';
    }
    return { alarms: toPermissionState(status), notifications, fullScreenIntent };
  }

  async schedule(alarm: Alarm, opts: ScheduleOptions = {}): Promise<ScheduleResult> {
    if (!WakeAlarm.isSupported()) {
      return { ok: false, reason: 'unsupported_os_version', detail: Platform.OS === 'ios' ? 'AlarmKit requires iOS 26' : 'Unsupported' };
    }
    try {
      const result = await WakeAlarm.scheduleAlarm(toNativeSpec(alarm, opts));
      logger.info('alarm_scheduled', { alarmId: alarm.id, nativeId: result.nativeId, nextFireAtEpochMs: result.nextFireAtEpochMs });
      return {
        ok: true,
        nativeId: result.nativeId,
        scheduledFor: result.nextFireAtEpochMs ? new Date(result.nextFireAtEpochMs).toISOString() : undefined,
      };
    } catch (error) {
      const code = (error as { code?: string }).code ?? '';
      const message = error instanceof Error ? error.message : String(error);
      logger.error('alarm_schedule_failed', { alarmId: alarm.id, code, message });
      if (/PERMISSION|AUTHORIZ/i.test(code) || /authoriz|permit/i.test(message)) {
        return { ok: false, reason: 'permission_denied', detail: message };
      }
      if (/UNAVAILABLE|iOS 26/i.test(code + message)) {
        return { ok: false, reason: 'unsupported_os_version', detail: message };
      }
      return { ok: false, reason: 'native_error', detail: message };
    }
  }

  update(alarm: Alarm, opts: ScheduleOptions = {}): Promise<ScheduleResult> {
    return this.schedule(alarm, opts);
  }

  async cancel(alarmId: string): Promise<void> {
    await WakeAlarm.cancelAlarm(alarmId);
    logger.info('alarm_cancelled', { alarmId });
  }

  async snooze(alarmId: string, minutes: number): Promise<void> {
    try {
      await WakeAlarm.snoozeAlarm(alarmId, minutes);
      logger.info('alarm_snoozed', { alarmId, minutes, via: 'native' });
    } catch (error) {
      // iOS: countdown() only works while alerting. Fall back to a fresh one-time alarm with the same id.
      logger.warn('alarm_snooze_native_failed', { alarmId, message: String(error) });
      throw error;
    }
  }

  async stop(alarmId: string): Promise<void> {
    await WakeAlarm.stopAlarm(alarmId);
    logger.info('alarm_stopped', { alarmId });
  }

  async getScheduled(): Promise<ScheduledAlarm[]> {
    const list = await WakeAlarm.getScheduledAlarms();
    return list.map((a) => ({
      alarmId: a.id,
      nativeId: a.id,
      nextFireAt: a.nextFireAtEpochMs ? new Date(a.nextFireAtEpochMs).toISOString() : undefined,
      state: a.state,
    }));
  }
}

export const alarmScheduler = new NativeAlarmScheduler();
