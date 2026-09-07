import { NativeModule, requireNativeModule } from 'expo';

import type {
  NativeActiveAlarm,
  NativeAlarmSpec,
  NativeAuthorizationStatus,
  NativeDiagnostics,
  NativeScheduleResult,
  NativeScheduledAlarm,
  WakeAlarmModuleEvents,
} from './WakeAlarm.types';

declare class WakeAlarmModule extends NativeModule<WakeAlarmModuleEvents> {
  /** iOS: true on iOS 26+ (AlarmKit). Android: always true. */
  isSupported(): boolean;
  /** Android 12–13: AlarmManager.canScheduleExactAlarms(). Elsewhere true. */
  canScheduleExactAlarms(): boolean;
  /** Android 14+: NotificationManager.canUseFullScreenIntent(). Elsewhere true. */
  canUseFullScreenIntent(): boolean;
  getAuthorizationStatus(): Promise<NativeAuthorizationStatus>;
  requestAuthorization(): Promise<NativeAuthorizationStatus>;
  scheduleAlarm(spec: NativeAlarmSpec): Promise<NativeScheduleResult>;
  cancelAlarm(id: string): Promise<void>;
  stopAlarm(id: string): Promise<void>;
  snoozeAlarm(id: string, minutes: number): Promise<void>;
  /** Android: adjusts the fallback player volume (crossfade). iOS: no-op. */
  setAlarmVolume(id: string, volume: number): Promise<void>;
  getScheduledAlarms(): Promise<NativeScheduledAlarm[]>;
  getActiveAlarm(): Promise<NativeActiveAlarm | null>;
  getDiagnostics(): Promise<NativeDiagnostics>;
  openAlarmSettings(): void;
  openFullScreenIntentSettings(): void;
  openNotificationSettings(): void;
}

export default requireNativeModule<WakeAlarmModule>('WakeAlarm');
