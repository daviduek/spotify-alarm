import { AlarmSchema, type Alarm, type AlarmDraft } from '@wake/domain';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Maps a Supabase `alarms` row to the domain Alarm (validated with zod). */
type AlarmRow = {
  id: string;
  name: string;
  hour: number;
  minute: number;
  enabled: boolean;
  recurrence: unknown;
  snooze: unknown;
  vibration: unknown;
  audio_plan: unknown;
  fade_in: unknown;
  fallback_sound_id: string;
  created_at: string;
  updated_at: string;
};

export function rowToAlarm(row: AlarmRow): Alarm | null {
  const parsed = AlarmSchema.safeParse({
    id: row.id,
    name: row.name,
    hour: row.hour,
    minute: row.minute,
    enabled: row.enabled,
    recurrence: row.recurrence,
    snooze: row.snooze,
    vibration: row.vibration,
    audioPlan: row.audio_plan,
    fadeIn: row.fade_in,
    fallbackSoundId: row.fallback_sound_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
  if (!parsed.success) console.warn('alarm row failed validation', row.id, parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  return parsed.success ? parsed.data : null;
}

function draftToRow(draft: AlarmDraft) {
  return {
    name: draft.name,
    hour: draft.hour,
    minute: draft.minute,
    enabled: draft.enabled,
    recurrence: draft.recurrence,
    snooze: draft.snooze,
    vibration: draft.vibration,
    audio_plan: draft.audioPlan,
    fade_in: draft.fadeIn,
    fallback_sound_id: draft.fallbackSoundId,
  };
}

export async function fetchAlarms(supabase: SupabaseClient, userId: string): Promise<Alarm[]> {
  const { data, error } = await supabase.from('alarms').select('*').eq('user_id', userId).order('hour').order('minute');
  if (error) throw new Error(error.message);
  return (data as AlarmRow[]).map(rowToAlarm).filter((a): a is Alarm => a !== null);
}

export async function fetchAlarm(supabase: SupabaseClient, userId: string, id: string): Promise<Alarm | null> {
  const { data, error } = await supabase.from('alarms').select('*').eq('user_id', userId).eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToAlarm(data as AlarmRow) : null;
}

export async function insertAlarm(supabase: SupabaseClient, userId: string, draft: AlarmDraft): Promise<Alarm> {
  const { data, error } = await supabase.from('alarms').insert({ ...draftToRow(draft), user_id: userId }).select('*').single();
  if (error) throw new Error(error.message);
  const alarm = rowToAlarm(data as AlarmRow);
  if (!alarm) throw new Error('Alarm failed validation after insert');
  return alarm;
}

export async function updateAlarm(supabase: SupabaseClient, userId: string, id: string, draft: AlarmDraft): Promise<Alarm> {
  const { data, error } = await supabase.from('alarms').update(draftToRow(draft)).eq('user_id', userId).eq('id', id).select('*').single();
  if (error) throw new Error(error.message);
  const alarm = rowToAlarm(data as AlarmRow);
  if (!alarm) throw new Error('Alarm failed validation after update');
  return alarm;
}

export async function setAlarmEnabled(supabase: SupabaseClient, userId: string, id: string, enabled: boolean): Promise<void> {
  const { error } = await supabase.from('alarms').update({ enabled }).eq('user_id', userId).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteAlarmRow(supabase: SupabaseClient, userId: string, id: string): Promise<void> {
  const { error } = await supabase.from('alarms').delete().eq('user_id', userId).eq('id', id);
  if (error) throw new Error(error.message);
}
