import { AlarmSchema, type Alarm } from '@wake/domain';

import { getDb } from '../db';
import { logger } from '../logger';

type AlarmRow = {
  id: string;
  name: string;
  hour: number;
  minute: number;
  enabled: number;
  recurrence_json: string;
  snooze_json: string;
  vibration_json: string;
  audio_plan_json: string;
  fade_json: string;
  fallback_sound_id: string;
  created_at: string;
  updated_at: string;
};

function rowToAlarm(row: AlarmRow): Alarm | null {
  const candidate = {
    id: row.id,
    name: row.name,
    hour: row.hour,
    minute: row.minute,
    enabled: row.enabled === 1,
    recurrence: JSON.parse(row.recurrence_json),
    snooze: JSON.parse(row.snooze_json),
    vibration: JSON.parse(row.vibration_json),
    audioPlan: JSON.parse(row.audio_plan_json),
    fadeIn: JSON.parse(row.fade_json),
    fallbackSoundId: row.fallback_sound_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  const parsed = AlarmSchema.safeParse(candidate);
  if (!parsed.success) {
    logger.error('alarm_row_invalid', { id: row.id, issues: parsed.error.issues.length });
    return null;
  }
  return parsed.data;
}

export async function listAlarms(): Promise<Alarm[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<AlarmRow>('SELECT * FROM alarms ORDER BY hour, minute');
  return rows.map(rowToAlarm).filter((a): a is Alarm => a !== null);
}

export async function getAlarm(id: string): Promise<Alarm | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<AlarmRow>('SELECT * FROM alarms WHERE id = ?', id);
  return row ? rowToAlarm(row) : null;
}

export async function upsertAlarm(alarm: Alarm): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO alarms (id, name, hour, minute, enabled, recurrence_json, snooze_json, vibration_json, audio_plan_json, fade_json, fallback_sound_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name, hour = excluded.hour, minute = excluded.minute, enabled = excluded.enabled,
       recurrence_json = excluded.recurrence_json, snooze_json = excluded.snooze_json, vibration_json = excluded.vibration_json,
       audio_plan_json = excluded.audio_plan_json, fade_json = excluded.fade_json, fallback_sound_id = excluded.fallback_sound_id,
       updated_at = excluded.updated_at`,
    alarm.id,
    alarm.name,
    alarm.hour,
    alarm.minute,
    alarm.enabled ? 1 : 0,
    JSON.stringify(alarm.recurrence),
    JSON.stringify(alarm.snooze),
    JSON.stringify(alarm.vibration),
    JSON.stringify(alarm.audioPlan),
    JSON.stringify(alarm.fadeIn),
    alarm.fallbackSoundId,
    alarm.createdAt,
    alarm.updatedAt,
  );
}

export async function deleteAlarm(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM alarms WHERE id = ?', id);
}
