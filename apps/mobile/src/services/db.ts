import * as SQLite from 'expo-sqlite';

import { logger } from './logger';

/**
 * Local-first SQLite (spec §31/§32). JSON columns hold the nested domain objects so the
 * AudioPlan can grow (sequences) without table migrations.
 */
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) dbPromise = open();
  return dbPromise;
}

async function open(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync('wake.db');
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await migrate(db);
  return db;
}

const MIGRATIONS: string[] = [
  `
  CREATE TABLE IF NOT EXISTS alarms (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    hour INTEGER NOT NULL,
    minute INTEGER NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    recurrence_json TEXT NOT NULL,
    snooze_json TEXT NOT NULL,
    vibration_json TEXT NOT NULL,
    audio_plan_json TEXT NOT NULL,
    fade_json TEXT NOT NULL,
    fallback_sound_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS recordings (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    file_uri TEXT NOT NULL,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS music_sources (
    id TEXT PRIMARY KEY NOT NULL,
    provider TEXT NOT NULL,
    provider_uri TEXT NOT NULL,
    title TEXT NOT NULL,
    subtitle TEXT,
    artwork_url TEXT,
    metadata_json TEXT,
    last_used_at TEXT
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS alarm_history (
    id TEXT PRIMARY KEY NOT NULL,
    alarm_id TEXT NOT NULL,
    scheduled_at TEXT NOT NULL,
    fired_at TEXT,
    stopped_at TEXT,
    snooze_count INTEGER NOT NULL DEFAULT 0,
    audio_source_used TEXT,
    provider_attempted INTEGER,
    provider_succeeded INTEGER,
    provider_failure_reason TEXT,
    platform TEXT NOT NULL,
    app_version TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_history_alarm ON alarm_history(alarm_id);
  `,
];

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  for (let v = current; v < MIGRATIONS.length; v++) {
    const sql = MIGRATIONS[v];
    if (!sql) continue;
    await db.withTransactionAsync(async () => {
      await db.execAsync(sql);
      await db.execAsync(`PRAGMA user_version = ${v + 1}`);
    });
    logger.info('db_migrated', { to: v + 1 });
  }
}
