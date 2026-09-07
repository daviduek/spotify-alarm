import { NativeModule, registerWebModule } from 'expo';

import type {
  NativeActiveAlarm,
  NativeAlarmSpec,
  NativeAuthorizationStatus,
  NativeDiagnostics,
  NativeScheduleResult,
  NativeScheduledAlarm,
  WakeAlarmModuleEvents,
} from './WakeAlarm.types';

/**
 * Web is NOT an alarm target (spec §3). This stub only exists so `expo start --web`
 * does not crash while iterating on UI. Everything reports "unsupported".
 */
class WakeAlarmModule extends NativeModule<WakeAlarmModuleEvents> {
  isSupported(): boolean {
    return false;
  }
  canScheduleExactAlarms(): boolean {
    return false;
  }
  canUseFullScreenIntent(): boolean {
    return false;
  }
  async getAuthorizationStatus(): Promise<NativeAuthorizationStatus> {
    return 'unsupported';
  }
  async requestAuthorization(): Promise<NativeAuthorizationStatus> {
    return 'unsupported';
  }
  async scheduleAlarm(spec: NativeAlarmSpec): Promise<NativeScheduleResult> {
    throw new Error(`Alarms are not supported on web (alarm ${spec.id})`);
  }
  async cancelAlarm(): Promise<void> {}
  async stopAlarm(): Promise<void> {}
  async snoozeAlarm(): Promise<void> {}
  async setAlarmVolume(): Promise<void> {}
  async getScheduledAlarms(): Promise<NativeScheduledAlarm[]> {
    return [];
  }
  async getActiveAlarm(): Promise<NativeActiveAlarm | null> {
    return null;
  }
  async getDiagnostics(): Promise<NativeDiagnostics> {
    return { platform: 'web', supported: false };
  }
  openAlarmSettings(): void {}
  openFullScreenIntentSettings(): void {}
  openNotificationSettings(): void {}
}

export default registerWebModule(WakeAlarmModule, 'WakeAlarm');
