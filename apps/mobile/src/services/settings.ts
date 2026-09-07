import { AudioSourceSchema, type AudioSource, type FadePresetId } from '@wake/domain';

import { getDb } from './db';

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string | null): Promise<void> {
  const db = await getDb();
  if (value === null) {
    await db.runAsync('DELETE FROM settings WHERE key = ?', key);
  } else {
    await db.runAsync('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value);
  }
}

// ---- typed helpers used by the Phase 0 lab ---------------------------------

export type LabOptions = {
  snoozeMinutes: number;
  vibrate: boolean;
  fadePreset: FadePresetId | 'off';
  fallbackSoundId: string;
  openAppOnFire: boolean;
};

export const DEFAULT_LAB_OPTIONS: LabOptions = {
  snoozeMinutes: 10,
  vibrate: true,
  fadePreset: 'off',
  fallbackSoundId: 'classic',
  openAppOnFire: true,
};

export async function getLabOptions(): Promise<LabOptions> {
  const raw = await getSetting('lab_options');
  if (!raw) return DEFAULT_LAB_OPTIONS;
  try {
    return { ...DEFAULT_LAB_OPTIONS, ...(JSON.parse(raw) as Partial<LabOptions>) };
  } catch {
    return DEFAULT_LAB_OPTIONS;
  }
}

export async function setLabOptions(opts: LabOptions): Promise<void> {
  await setSetting('lab_options', JSON.stringify(opts));
}

/** The audio source the "test alarm" will use (local sound, recording or Spotify item). */
export async function getTestSource(): Promise<AudioSource | null> {
  const raw = await getSetting('test_source');
  if (!raw) return null;
  const parsed = AudioSourceSchema.safeParse(JSON.parse(raw));
  return parsed.success ? parsed.data : null;
}

export async function setTestSource(source: AudioSource | null): Promise<void> {
  await setSetting('test_source', source ? JSON.stringify(source) : null);
}
