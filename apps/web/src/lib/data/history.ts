import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * One row per alarm *occurrence* (client-generated id, planned `scheduledAt`), progressively
 * upserted as the ring evolves (fired → provider outcome → stopped). Keeps the alarm-fire
 * reliability metric computable (spec §75).
 */
export type WebAlarmEvent = {
  id: string;
  alarmId?: string;
  scheduledAt: string;
  firedAt?: string;
  stoppedAt?: string;
  snoozeCount?: number;
  audioSourceUsed?: 'fallback' | 'local' | 'recording' | 'music';
  providerAttempted?: boolean;
  providerSucceeded?: boolean;
  providerFailureReason?: string;
};

export async function recordEvent(supabase: SupabaseClient, userId: string, event: WebAlarmEvent): Promise<void> {
  const row: Record<string, unknown> = {
    id: event.id,
    user_id: userId,
    alarm_id: event.alarmId ?? null,
    scheduled_at: event.scheduledAt,
    platform: 'web',
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 200) : null,
  };
  // Only send fields that are present so an upsert never erases earlier values.
  if (event.firedAt !== undefined) row.fired_at = event.firedAt;
  if (event.stoppedAt !== undefined) row.stopped_at = event.stoppedAt;
  if (event.snoozeCount !== undefined) row.snooze_count = event.snoozeCount;
  if (event.audioSourceUsed !== undefined) row.audio_source_used = event.audioSourceUsed;
  if (event.providerAttempted !== undefined) row.provider_attempted = event.providerAttempted;
  if (event.providerSucceeded !== undefined) row.provider_succeeded = event.providerSucceeded;
  if (event.providerFailureReason !== undefined) row.provider_failure_reason = event.providerFailureReason;

  const { error } = await supabase.from('alarm_history').upsert(row, { onConflict: 'id' });
  if (error) console.warn('history upsert failed', error.message);
}

export async function fetchHistory(supabase: SupabaseClient, userId: string, limit = 20) {
  const { data, error } = await supabase.from('alarm_history').select('*').eq('user_id', userId).order('scheduled_at', { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return data;
}
