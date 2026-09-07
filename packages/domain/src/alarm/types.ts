import type { AudioPlan, FadeCurve } from '../audio/types';

/** 0 = Sunday … 6 = Saturday, matching `Date#getDay()`. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const ALL_WEEKDAYS: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6];
export const WORKDAYS: readonly Weekday[] = [1, 2, 3, 4, 5];
export const WEEKEND: readonly Weekday[] = [0, 6];

export type Recurrence =
  | { type: 'once' }
  | { type: 'weekly'; weekdays: Weekday[] };

export type SnoozeConfig = {
  enabled: boolean;
  durationMinutes: number;
  maxSnoozes?: number;
};

export type VibrationPattern = 'default' | 'gentle' | 'strong';

export type VibrationConfig = {
  enabled: boolean;
  pattern?: VibrationPattern;
};

/**
 * Progressive wake-up. Volumes are player volumes in the 0..1 range
 * (see docs/ARCHITECTURE.md → "Volume model": systemVolume vs playerVolume
 * vs effectiveAlarmVolume).
 */
export type FadeConfig = {
  enabled: boolean;
  durationSeconds: number;
  initialVolume: number;
  finalVolume: number;
  curve?: FadeCurve;
};

export type Alarm = {
  id: string;
  name: string;
  /** Local wall-clock hour 0..23. Alarms are stored as wall-clock intent, never as UTC instants. */
  hour: number;
  /** Local wall-clock minute 0..59. */
  minute: number;
  enabled: boolean;
  recurrence: Recurrence;
  snooze: SnoozeConfig;
  vibration: VibrationConfig;
  audioPlan: AudioPlan;
  fadeIn: FadeConfig;
  /** Bundled sound that MUST be able to play even if every other source fails. */
  fallbackSoundId: string;
  createdAt: string;
  updatedAt: string;
};

export type AlarmDraft = Omit<Alarm, 'id' | 'createdAt' | 'updatedAt'>;

export const DEFAULT_SNOOZE: SnoozeConfig = { enabled: true, durationMinutes: 10 };
export const SNOOZE_OPTIONS_MINUTES: readonly number[] = [5, 10, 15, 20];
export const DEFAULT_VIBRATION: VibrationConfig = { enabled: true, pattern: 'default' };
