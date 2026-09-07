import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import type { AlarmEvent } from '@wake/domain';

import { getDb } from './db';
import { logger } from './logger';

/** Spec §41 — local reliability log. */
export async function recordAlarmEvent(event: Omit<AlarmEvent, 'id' | 'platform' | 'appVersion'> & { id?: string }): Promise<string> {
  const db = await getDb();
  const id = event.id ?? Crypto.randomUUID();
  await db.runAsync(
    `INSERT INTO alarm_history (id, alarm_id, scheduled_at, fired_at, stopped_at, snooze_count, audio_source_used,
       provider_attempted, provider_succeeded, provider_failure_reason, platform, app_version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       fired_at = COALESCE(excluded.fired_at, alarm_history.fired_at),
       stopped_at = COALESCE(excluded.stopped_at, alarm_history.stopped_at),
       snooze_count = excluded.snooze_count,
       audio_source_used = COALESCE(excluded.audio_source_used, alarm_history.audio_source_used),
       provider_attempted = COALESCE(excluded.provider_attempted, alarm_history.provider_attempted),
       provider_succeeded = COALESCE(excluded.provider_succeeded, alarm_history.provider_succeeded),
       provider_failure_reason = COALESCE(excluded.provider_failure_reason, alarm_history.provider_failure_reason)`,
    id,
    event.alarmId,
    event.scheduledAt,
    event.firedAt ?? null,
    event.stoppedAt ?? null,
    event.snoozeCount,
    event.audioSourceUsed ?? null,
    event.providerAttempted === undefined ? null : event.providerAttempted ? 1 : 0,
    event.providerSucceeded === undefined ? null : event.providerSucceeded ? 1 : 0,
    event.providerFailureReason ?? null,
    Platform.OS === 'ios' ? 'ios' : 'android',
    Application.nativeApplicationVersion ?? null,
  );
  logger.info('alarm_history_written', { id, alarmId: event.alarmId });
  return id;
}

type HistoryRow = {
  id: string;
  alarm_id: string;
  scheduled_at: string;
  fired_at: string | null;
  stopped_at: string | null;
  snooze_count: number;
  audio_source_used: string | null;
  provider_attempted: number | null;
  provider_succeeded: number | null;
  provider_failure_reason: string | null;
  platform: string;
  app_version: string | null;
};

export async function listAlarmHistory(limit = 20): Promise<AlarmEvent[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<HistoryRow>('SELECT * FROM alarm_history ORDER BY scheduled_at DESC LIMIT ?', limit);
  return rows.map((r) => ({
    id: r.id,
    alarmId: r.alarm_id,
    scheduledAt: r.scheduled_at,
    firedAt: r.fired_at ?? undefined,
    stoppedAt: r.stopped_at ?? undefined,
    snoozeCount: r.snooze_count,
    audioSourceUsed: (r.audio_source_used ?? undefined) as AlarmEvent['audioSourceUsed'],
    providerAttempted: r.provider_attempted === null ? undefined : r.provider_attempted === 1,
    providerSucceeded: r.provider_succeeded === null ? undefined : r.provider_succeeded === 1,
    providerFailureReason: r.provider_failure_reason ?? undefined,
    platform: r.platform === 'ios' ? 'ios' : 'android',
    appVersion: r.app_version ?? undefined,
  }));
}
