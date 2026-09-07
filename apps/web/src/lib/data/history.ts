import type { SupabaseClient } from '@supabase/supabase-js';

export type WebAlarmEvent = {
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
  const { error } = await supabase.from('alarm_history').insert({
    user_id: userId,
    alarm_id: event.alarmId ?? null,
    scheduled_at: event.scheduledAt,
    fired_at: event.firedAt ?? null,
    stopped_at: event.stoppedAt ?? null,
    snooze_count: event.snoozeCount ?? 0,
    audio_source_used: event.audioSourceUsed ?? null,
    provider_attempted: event.providerAttempted ?? null,
    provider_succeeded: event.providerSucceeded ?? null,
    provider_failure_reason: event.providerFailureReason ?? null,
    platform: 'web',
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 200) : null,
  });
  if (error) console.warn('history insert failed', error.message);
}

export async function fetchHistory(supabase: SupabaseClient, userId: string, limit = 20) {
  const { data, error } = await supabase.from('alarm_history').select('*').eq('user_id', userId).order('scheduled_at', { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return data;
}
