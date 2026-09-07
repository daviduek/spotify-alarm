import type { Alarm } from '../alarm/types';

export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'restricted' | 'not_applicable';

export type PermissionSnapshot = {
  /** iOS: AlarmKit authorization. Android: exact-alarm capability. */
  alarms: PermissionState;
  /** Android 13+: POST_NOTIFICATIONS. iOS: not required for AlarmKit alerts. */
  notifications: PermissionState;
  /** Android 14+: full-screen intent capability. */
  fullScreenIntent: PermissionState;
  /** Android: whether the app is exempt from battery optimisations (informational). */
  batteryUnrestricted?: PermissionState;
};

export type ScheduleResult =
  | { ok: true; nativeId: string; scheduledFor?: string }
  | { ok: false; reason: ScheduleFailureReason; detail?: string };

export type ScheduleFailureReason =
  | 'permission_denied'
  | 'unsupported_os_version'
  | 'invalid_time'
  | 'native_error';

export type ScheduledAlarm = {
  alarmId: string;
  nativeId: string;
  /** ISO instant of the next fire, when the native layer exposes it. */
  nextFireAt?: string;
  state: 'scheduled' | 'countdown' | 'alerting' | 'paused' | 'unknown';
};

/**
 * Spec §33. Implemented per platform (IOSAlarmScheduler → AlarmKit,
 * AndroidAlarmScheduler → AlarmManager.setAlarmClock). Screens depend on this
 * interface only.
 */
export interface AlarmScheduler {
  requestPermission(): Promise<PermissionState>;
  getPermissions(): Promise<PermissionSnapshot>;
  schedule(alarm: Alarm): Promise<ScheduleResult>;
  update(alarm: Alarm): Promise<ScheduleResult>;
  cancel(alarmId: string): Promise<void>;
  snooze(alarmId: string, minutes: number): Promise<void>;
  stop(alarmId: string): Promise<void>;
  getScheduled(): Promise<ScheduledAlarm[]>;
}

export type AudioEngineState = 'idle' | 'prepared' | 'playing_fallback' | 'playing_plan' | 'stopped';

export type FadeRuntimeConfig = {
  startVolume: number;
  endVolume: number;
  durationSeconds: number;
  curve: 'linear' | 'ease_in' | 'logarithmic';
};

/** Spec §34. */
export interface AlarmAudioEngine {
  prepare(alarm: Alarm): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  setVolume(value: number): Promise<void>;
  fade(config: FadeRuntimeConfig): Promise<void>;
  getState(): AudioEngineState;
}
