import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';

import { getDb } from '../db';
import { logger } from '../logger';

export type Recording = {
  id: string;
  name: string;
  /** file:// URI inside the app's document directory — survives updates, excluded from nothing. */
  fileUri: string;
  durationMs: number;
  createdAt: string;
  updatedAt: string;
};

type Row = { id: string; name: string; file_uri: string; duration_ms: number; created_at: string; updated_at: string };

const rowToRecording = (r: Row): Recording => ({
  id: r.id,
  name: r.name,
  fileUri: r.file_uri,
  durationMs: r.duration_ms,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

function recordingsDir(): Directory {
  const dir = new Directory(Paths.document, 'recordings');
  if (!dir.exists) dir.create();
  return dir;
}

export async function listRecordings(): Promise<Recording[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Row>('SELECT * FROM recordings ORDER BY created_at DESC');
  return rows.map(rowToRecording);
}

export async function getRecording(id: string): Promise<Recording | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Row>('SELECT * FROM recordings WHERE id = ?', id);
  return row ? rowToRecording(row) : null;
}

/** Moves the recorder's temp file into the recordings directory and registers it. */
export async function saveRecording(input: { sourceUri: string; name: string; durationMs: number }): Promise<Recording> {
  const id = Crypto.randomUUID();
  const source = new File(input.sourceUri);
  const extension = source.extension || '.m4a';
  const target = new File(recordingsDir(), `${id}${extension.startsWith('.') ? extension : `.${extension}`}`);
  source.move(target);
  const now = new Date().toISOString();
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO recordings (id, name, file_uri, duration_ms, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    id,
    input.name,
    target.uri,
    Math.round(input.durationMs),
    now,
    now,
  );
  logger.info('recording_saved_to_disk', { id, bytes: target.size ?? 0 });
  return { id, name: input.name, fileUri: target.uri, durationMs: input.durationMs, createdAt: now, updatedAt: now };
}

export async function renameRecording(id: string, name: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE recordings SET name = ?, updated_at = ? WHERE id = ?', name, new Date().toISOString(), id);
}

export async function deleteRecording(id: string): Promise<void> {
  const rec = await getRecording(id);
  if (rec) {
    try {
      const file = new File(rec.fileUri);
      if (file.exists) file.delete();
    } catch (error) {
      logger.warn('recording_file_delete_failed', { id, message: String(error) });
    }
  }
  const db = await getDb();
  await db.runAsync('DELETE FROM recordings WHERE id = ?', id);
}

/** Readiness helper (spec §26): the DB row may outlive the file. */
export function recordingFileExists(fileUri: string): boolean {
  try {
    return new File(fileUri).exists;
  } catch {
    return false;
  }
}
