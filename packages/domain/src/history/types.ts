/** Spec §41 — lightweight local reliability log. Never contains audio or tokens. */
export type AlarmEvent = {
  id: string;
  alarmId: string;
  scheduledAt: string;
  firedAt?: string;
  stoppedAt?: string;
  snoozeCount: number;
  audioSourceUsed?: 'fallback' | 'local' | 'recording' | 'music';
  providerAttempted?: boolean;
  providerSucceeded?: boolean;
  providerFailureReason?: string;
  platform: 'ios' | 'android' | 'web';
  appVersion?: string;
};

export type ReliabilityCounters = {
  nativeAlarmFired: number;
  fallbackAudioStarted: number;
  providerAttempts: number;
  providerSuccesses: number;
  providerFailures: Record<string, number>;
};

/** Spec §75 — never combine the two metrics. */
export function alarmFireReliability(c: ReliabilityCounters, scheduledCount: number): number | null {
  if (scheduledCount <= 0) return null;
  return c.nativeAlarmFired / scheduledCount;
}

export function providerSuccessRate(c: ReliabilityCounters): number | null {
  if (c.providerAttempts <= 0) return null;
  return c.providerSuccesses / c.providerAttempts;
}
