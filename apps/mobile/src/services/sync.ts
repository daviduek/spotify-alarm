import { AlarmSchema, nextOccurrence, primarySource, type Alarm } from '@wake/domain';
import { Directory, File, Paths } from 'expo-file-system';

import { alarmScheduler } from '../platform/nativeAlarmScheduler';
import { deleteAlarm as deleteAlarmLocal, listAlarms, upsertAlarm } from './alarms/alarmRepository';
import { getDb } from './db';
import { logger } from './logger';
import { listRecordings } from './recordings/recordingsRepository';
import { getSetting, setSetting } from './settings';
import { getSupabase, getUserId } from './supabase';

/**
 * Optional cloud sync (see SYNC.md). Local SQLite stays the source of truth for ringing;
 * the cloud is a mirror for people who also use the web app. Everything here is
 * fire-and-forget: a failed sync only logs — it never blocks or breaks an alarm.
 *
 * Merge rule: last-write-wins by `updatedAt` (alarms). Recordings are content-addressed
 * by id and immutable audio, so they are only added/removed, never merged.
 */

const LAST_SYNC_KEY = 'sync_last_synced_at';

export type SyncResult = { ok: true } | { ok: false; error: 'not_signed_in' | string };

// ---- Cloud row mapping (mirrors apps/web/src/lib/data/alarms.ts) -----------

type CloudAlarmRow = {
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

function cloudRowToAlarm(row: CloudAlarmRow): Alarm | null {
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
  if (!parsed.success) {
    logger.warn('sync_cloud_alarm_invalid', { id: row.id, issues: parsed.error.issues.length });
    return null;
  }
  return parsed.data;
}

function alarmToCloudRow(alarm: Alarm, userId: string) {
  return {
    id: alarm.id,
    user_id: userId,
    name: alarm.name,
    hour: alarm.hour,
    minute: alarm.minute,
    enabled: alarm.enabled,
    recurrence: alarm.recurrence,
    snooze: alarm.snooze,
    vibration: alarm.vibration,
    audio_plan: alarm.audioPlan,
    fade_in: alarm.fadeIn,
    fallback_sound_id: alarm.fallbackSoundId,
    created_at: alarm.createdAt,
    updated_at: alarm.updatedAt,
  };
}

// ---- Alarms ----------------------------------------------------------------

async function syncAlarms(userId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  const { data, error } = await supabase.from('alarms').select('*').eq('user_id', userId);
  if (error) throw new Error(`pull alarms: ${error.message}`);
  const remote = (data as CloudAlarmRow[]).map(cloudRowToAlarm).filter((a): a is Alarm => a !== null);
  const remoteById = new Map(remote.map((a) => [a.id, a]));

  const local = await listAlarms();
  const localById = new Map(local.map((a) => [a.id, a]));

  // Pull: remote rows that are new or newer than local (LWW by updatedAt).
  const merged: Alarm[] = [];
  for (const alarm of remote) {
    const mine = localById.get(alarm.id);
    if (!mine || alarm.updatedAt > mine.updatedAt) {
      await upsertAlarm(alarm);
      merged.push(alarm);
    }
  }

  // Push: local rows missing remotely or newer than the cloud copy.
  const toPush = local.filter((a) => {
    const theirs = remoteById.get(a.id);
    return !theirs || a.updatedAt > theirs.updatedAt;
  });
  if (toPush.length > 0) {
    const { error: pushError } = await supabase.from('alarms').upsert(toPush.map((a) => alarmToCloudRow(a, userId)), { onConflict: 'id' });
    if (pushError) throw new Error(`push alarms: ${pushError.message}`);
  }

  // Remote changes may move fire times — re-arm native alarms through the same scheduler
  // path the lab uses on save (cancel + schedule; 'once' needs an explicit instant).
  for (const alarm of merged) {
    try {
      await alarmScheduler.cancel(alarm.id).catch(() => undefined);
      if (!alarm.enabled) continue;
      const at = nextOccurrence(alarm);
      if (!at) continue;
      const source = primarySource(alarm.audioPlan);
      await alarmScheduler.schedule(alarm, {
        fireAtEpochMs: alarm.recurrence.type === 'once' ? at.getTime() : undefined,
        soundUri: source?.type === 'recording' ? source.fileUri : undefined,
      });
    } catch (error) {
      logger.warn('sync_reschedule_failed', { alarmId: alarm.id, message: String(error) });
    }
  }

  logger.info('sync_alarms_done', { pulled: merged.length, pushed: toPush.length });
}

/** Local delete keeps the cloud in step while signed in (no tombstones — see SYNC.md). */
export async function deleteAlarmEverywhere(id: string): Promise<void> {
  await deleteAlarmLocal(id);
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const userId = await getUserId();
    if (!userId) return;
    const { error } = await supabase.from('alarms').delete().eq('user_id', userId).eq('id', id);
    if (error) logger.warn('sync_cloud_delete_failed', { id, message: error.message });
  } catch (error) {
    logger.warn('sync_cloud_delete_failed', { id, message: String(error) });
  }
}

// ---- Recordings ------------------------------------------------------------

export type CloudRecording = {
  id: string;
  name: string;
  storagePath: string;
  mimeType: string;
  durationMs: number;
  createdAt: string;
  /** file:// URI of the downloaded copy, when cached for offline playback. */
  localUri: string | null;
};

type CloudRecordingRow = { id: string; name: string; storage_path: string; mime_type: string; duration_ms: number; created_at: string };
type CacheRow = CloudRecordingRow & { local_uri: string | null };

const toCloudRecording = (r: CacheRow): CloudRecording => ({
  id: r.id,
  name: r.name,
  storagePath: r.storage_path,
  mimeType: r.mime_type,
  durationMs: r.duration_ms,
  createdAt: r.created_at,
  localUri: r.local_uri,
});

/** The locally cached list of the user's cloud recordings (rows only, audio on demand). */
export async function listCloudRecordings(): Promise<CloudRecording[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<CacheRow>('SELECT * FROM cloud_recordings ORDER BY created_at DESC');
  return rows.map(toCloudRecording);
}

function mimeForExtension(ext: string): string {
  switch (ext.toLowerCase()) {
    case 'mp3': return 'audio/mpeg';
    case 'wav': return 'audio/wav';
    case 'ogg': return 'audio/ogg';
    case 'webm': return 'audio/webm';
    case 'caf': return 'audio/x-caf';
    case 'm4a':
    case 'mp4':
    default: return 'audio/mp4';
  }
}

async function syncRecordings(userId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const db = await getDb();

  const { data, error } = await supabase.from('recordings').select('*').eq('user_id', userId);
  if (error) throw new Error(`pull recordings: ${error.message}`);
  const remote = data as CloudRecordingRow[];
  const remoteIds = new Set(remote.map((r) => r.id));

  // Refresh the cache (keep local_uri — the downloaded copy is still valid).
  for (const r of remote) {
    await db.runAsync(
      `INSERT INTO cloud_recordings (id, name, storage_path, mime_type, duration_ms, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, storage_path = excluded.storage_path,
         mime_type = excluded.mime_type, duration_ms = excluded.duration_ms, created_at = excluded.created_at`,
      r.id, r.name, r.storage_path, r.mime_type, r.duration_ms, r.created_at,
    );
  }
  // Drop cache rows (and their downloaded files) that no longer exist in the cloud.
  const cached = await db.getAllAsync<CacheRow>('SELECT * FROM cloud_recordings');
  for (const row of cached) {
    if (remoteIds.has(row.id)) continue;
    if (row.local_uri) {
      try {
        const f = new File(row.local_uri);
        if (f.exists) f.delete();
      } catch { /* best effort */ }
    }
    await db.runAsync('DELETE FROM cloud_recordings WHERE id = ?', row.id);
  }

  // Upload device recordings the cloud doesn't have yet (web path convention: userId/id.ext).
  const locals = await listRecordings();
  let uploaded = 0;
  for (const rec of locals) {
    if (remoteIds.has(rec.id)) continue;
    try {
      const file = new File(rec.fileUri);
      if (!file.exists) continue;
      const ext = (file.extension || '.m4a').replace(/^\./, '') || 'm4a';
      const mime = mimeForExtension(ext);
      const path = `${userId}/${rec.id}.${ext}`;
      const bytes = await file.arrayBuffer();
      const { error: uploadError } = await supabase.storage.from('recordings').upload(path, bytes, { contentType: mime, upsert: false });
      if (uploadError && !/exists|duplicate/i.test(uploadError.message)) throw new Error(uploadError.message);
      const { error: insertError } = await supabase
        .from('recordings')
        .insert({ id: rec.id, user_id: userId, name: rec.name, storage_path: path, mime_type: mime, duration_ms: Math.round(rec.durationMs), created_at: rec.createdAt });
      if (insertError) {
        await supabase.storage.from('recordings').remove([path]).catch(() => undefined);
        throw new Error(insertError.message);
      }
      uploaded += 1;
    } catch (error) {
      logger.warn('sync_recording_upload_failed', { id: rec.id, message: String(error) });
    }
  }

  logger.info('sync_recordings_done', { remote: remote.length, uploaded });
}

/**
 * Downloads a cloud recording for offline playback (signed URL — the bucket is private).
 * Returns the local file:// URI, or null when unavailable (offline, signed out, gone).
 */
export async function downloadRecording(id: string): Promise<string | null> {
  try {
    const supabase = getSupabase();
    if (!supabase) return null;
    const db = await getDb();
    const row = await db.getFirstAsync<CacheRow>('SELECT * FROM cloud_recordings WHERE id = ?', id);
    if (!row) return null;
    if (row.local_uri) {
      try {
        if (new File(row.local_uri).exists) return row.local_uri;
      } catch { /* fall through to re-download */ }
    }
    const { data, error } = await supabase.storage.from('recordings').createSignedUrl(row.storage_path, 3600);
    if (error || !data) {
      logger.warn('sync_signed_url_failed', { id, message: error?.message ?? 'no data' });
      return null;
    }
    const dir = new Directory(Paths.document, 'cloud-recordings');
    if (!dir.exists) dir.create();
    const ext = row.storage_path.split('.').pop() ?? 'm4a';
    const target = new File(dir, `${id}.${ext}`);
    if (target.exists) target.delete();
    const file = await File.downloadFileAsync(data.signedUrl, target);
    await db.runAsync('UPDATE cloud_recordings SET local_uri = ? WHERE id = ?', file.uri, id);
    logger.info('sync_recording_downloaded', { id });
    return file.uri;
  } catch (error) {
    logger.warn('sync_recording_download_failed', { id, message: String(error) });
    return null;
  }
}

// ---- Orchestration ---------------------------------------------------------

let inFlight: Promise<SyncResult> | null = null;

/** Full pull+push cycle. Coalesces concurrent calls into the one already running. */
export function syncNow(): Promise<SyncResult> {
  if (inFlight) return inFlight;
  inFlight = (async (): Promise<SyncResult> => {
    try {
      const userId = await getUserId();
      if (!userId) return { ok: false, error: 'not_signed_in' };
      await syncAlarms(userId);
      await syncRecordings(userId);
      await setSetting(LAST_SYNC_KEY, new Date().toISOString());
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('sync_failed', { message });
      return { ok: false, error: message };
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Fire-and-forget sync (app foreground, after alarm mutations). Never throws. */
export function requestSync(reason: string): void {
  void getUserId().then((userId) => {
    if (!userId) return; // signed out — nothing to do, stay silent
    logger.info('sync_requested', { reason });
    void syncNow();
  }).catch(() => undefined);
}

export async function getLastSyncedAt(): Promise<Date | null> {
  const raw = await getSetting(LAST_SYNC_KEY);
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}
