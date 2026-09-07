/**
 * Native alarm contract shared by the iOS (AlarmKit) and Android (AlarmManager)
 * implementations. Keep this file platform-neutral: the JS AlarmScheduler
 * adapters in apps/mobile/src/platform translate the domain `Alarm` into a
 * `NativeAlarmSpec` and back.
 */
export type NativeAlarmSpec = {
  /** Must be a UUID string — AlarmKit identifies alarms by UUID. */
  id: string;
  label: string;
  /** Local wall-clock hour 0..23. */
  hour: number;
  /** Local wall-clock minute 0..59. */
  minute: number;
  /** 0 = Sunday … 6 = Saturday. Empty array = one-time alarm at the next hour:minute. */
  weekdays: number[];
  /** Explicit one-time instant (test alarms, snooze). Overrides hour/minute/weekdays when set. */
  fireAtEpochMs?: number;
  /** Bundled sound base name, e.g. `wake_classic` (see packages/domain WAKE_SOUNDS). */
  soundFile: string;
  /** Android only: absolute file URI (e.g. a recording) played INSTEAD of soundFile; falls back to soundFile on error. */
  soundUri?: string;
  vibrate: boolean;
  /** 0 disables snooze. iOS: fixed at schedule time (AlarmKit countdown). */
  snoozeMinutes: number;
  /** Android-native fade of the fallback sound. 0 = none. iOS: system plays the sound; no fade. */
  fadeInSeconds: number;
  /** 0..1 */
  fadeStartVolume: number;
  /** 0..1 */
  fadeEndVolume: number;
  /** Android: also open the React Native app (deep link wake://alarm/<id>) so JS can attempt Spotify. */
  openAppOnFire: boolean;
};

export type NativeAuthorizationStatus = 'authorized' | 'denied' | 'notDetermined' | 'unsupported';

export type NativeAlarmState = 'scheduled' | 'countdown' | 'alerting' | 'paused' | 'unknown';

export type NativeScheduledAlarm = {
  id: string;
  nextFireAtEpochMs?: number;
  state: NativeAlarmState;
};

export type NativeScheduleResult = {
  nativeId: string;
  nextFireAtEpochMs?: number;
};

export type NativeActiveAlarm = {
  id: string;
  firedAtEpochMs: number;
  snoozeCount: number;
};

export type AlarmFiredEvent = { id: string; firedAtEpochMs: number; snoozeCount: number };
export type AlarmStoppedEvent = { id: string; reason: 'user' | 'timeout' | 'replaced' | 'system' | 'unknown' };
export type AlarmSnoozedEvent = { id: string; untilEpochMs: number };
export type AlarmStateChangedEvent = { id: string; state: NativeAlarmState };

export type WakeAlarmModuleEvents = {
  onAlarmFired: (event: AlarmFiredEvent) => void;
  onAlarmStopped: (event: AlarmStoppedEvent) => void;
  onAlarmSnoozed: (event: AlarmSnoozedEvent) => void;
  onAlarmStateChanged: (event: AlarmStateChangedEvent) => void;
};

/** Free-form, platform-specific; rendered verbatim on the Diagnostics screen. */
export type NativeDiagnostics = Record<string, string | number | boolean | null>;
