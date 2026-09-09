/**
 * Offline-first alarm CRUD for the web app.
 *
 * Same surface as `alarms.ts`, but:
 *  - Reads try the network first, write-through to IndexedDB, and fall back to
 *    the local cache when the server is unreachable. `fetchAlarms` returns a
 *    `{ alarms, fromCache }` flag so callers can show an offline notice.
 *  - Writes apply to IndexedDB immediately (optimistic), are queued in an
 *    'outbox' store, and a flush drains the queue against Supabase when the
 *    connection returns (window 'online' event + 60s interval).
 *
 * Cache records are namespaced per user (`${userId}:${alarmId}`) so a shared
 * browser never mixes accounts. We intentionally do NOT clear the cache on
 * sign-out: RLS protects the server, and a stale local cache only means the
 * previous user's alarms could ring on this device until the next sync —
 * acceptable for an alarm clock, where ringing beats silence.
 */

import { AlarmSchema, createAlarm, type Alarm, type AlarmDraft } from '@wake/domain';
import type { SupabaseClient } from '@supabase/supabase-js';

import * as net from './alarms';
import { idbAdd, idbDelete, idbGet, idbGetAll, idbGetAllKeys, idbSet, prefixRange } from './idb';

export type AlarmsResult = { alarms: Alarm[]; fromCache: boolean };
export type AlarmResult = { alarm: Alarm | null; fromCache: boolean };

type OutboxEntry =
  | { op: 'insert'; userId: string; id: string; payload: AlarmDraft; at: number }
  | { op: 'update'; userId: string; id: string; payload: AlarmDraft; at: number }
  | { op: 'enable'; userId: string; id: string; payload: { enabled: boolean }; at: number }
  | { op: 'delete'; userId: string; id: string; at: number };

const cacheKey = (userId: string, alarmId: string) => `${userId}:${alarmId}`;

function parseCached(value: unknown): Alarm | null {
  const parsed = AlarmSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

async function readCachedAlarms(userId: string): Promise<Alarm[]> {
  const rows = (await idbGetAll<unknown>('alarms', prefixRange(`${userId}:`))) ?? [];
  return rows
    .map(parseCached)
    .filter((a): a is Alarm => a !== null)
    .sort((a, b) => a.hour - b.hour || a.minute - b.minute);
}

async function writeThroughAlarms(userId: string, alarms: Alarm[]): Promise<void> {
  // Replace this user's cache with the fresh server copy (drops deleted rows).
  await idbDelete('alarms', prefixRange(`${userId}:`));
  for (const alarm of alarms) await idbSet('alarms', cacheKey(userId, alarm.id), alarm);
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function fetchAlarms(supabase: SupabaseClient, userId: string): Promise<AlarmsResult> {
  // Push pending offline writes first so the server copy reflects them.
  await flushOutbox(supabase);
  try {
    const alarms = await net.fetchAlarms(supabase, userId);
    await writeThroughAlarms(userId, alarms);
    return { alarms, fromCache: false };
  } catch {
    return { alarms: await readCachedAlarms(userId), fromCache: true };
  }
}

export async function fetchAlarm(supabase: SupabaseClient, userId: string, id: string): Promise<AlarmResult> {
  try {
    const alarm = await net.fetchAlarm(supabase, userId, id);
    if (alarm) await idbSet('alarms', cacheKey(userId, id), alarm);
    return { alarm, fromCache: false };
  } catch {
    const cached = await idbGet<unknown>('alarms', cacheKey(userId, id));
    return { alarm: cached ? parseCached(cached) : null, fromCache: true };
  }
}

// ---------------------------------------------------------------------------
// Writes: optimistic local apply + outbox + immediate flush attempt
// ---------------------------------------------------------------------------

export async function insertAlarm(supabase: SupabaseClient, userId: string, draft: AlarmDraft): Promise<Alarm> {
  // Client-generated id so the alarm exists (and can ring) offline; the same
  // id is sent to Supabase when the outbox flushes.
  const alarm = createAlarm(draft, crypto.randomUUID());
  await idbSet('alarms', cacheKey(userId, alarm.id), alarm);
  await idbAdd('outbox', { op: 'insert', userId, id: alarm.id, payload: draft, at: Date.now() } satisfies OutboxEntry);
  void flushOutbox(supabase);
  return alarm;
}

export async function updateAlarm(supabase: SupabaseClient, userId: string, id: string, draft: AlarmDraft): Promise<Alarm> {
  const existing = parseCached(await idbGet<unknown>('alarms', cacheKey(userId, id)));
  const now = new Date().toISOString();
  const alarm: Alarm = { ...draft, id, createdAt: existing?.createdAt ?? now, updatedAt: now };
  await idbSet('alarms', cacheKey(userId, id), alarm);
  await idbAdd('outbox', { op: 'update', userId, id, payload: draft, at: Date.now() } satisfies OutboxEntry);
  void flushOutbox(supabase);
  return alarm;
}

export async function setAlarmEnabled(supabase: SupabaseClient, userId: string, id: string, enabled: boolean): Promise<void> {
  const existing = parseCached(await idbGet<unknown>('alarms', cacheKey(userId, id)));
  if (existing) await idbSet('alarms', cacheKey(userId, id), { ...existing, enabled, updatedAt: new Date().toISOString() });
  await idbAdd('outbox', { op: 'enable', userId, id, payload: { enabled }, at: Date.now() } satisfies OutboxEntry);
  void flushOutbox(supabase);
}

export async function deleteAlarmRow(supabase: SupabaseClient, userId: string, id: string): Promise<void> {
  await idbDelete('alarms', cacheKey(userId, id));
  await idbAdd('outbox', { op: 'delete', userId, id, at: Date.now() } satisfies OutboxEntry);
  void flushOutbox(supabase);
}

// ---------------------------------------------------------------------------
// Outbox flush
// ---------------------------------------------------------------------------

/** Heuristic: network/transport failures are retryable; anything else (validation, constraint) is not. */
function isRetryable(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /fetch|network|load failed|timed? ?out|abort/i.test(message);
}

let flushing = false;

/**
 * Drains the outbox in insertion order against Supabase. Stops (keeping the
 * remaining entries) on a network failure; drops the entry and logs on a
 * non-retryable error so one bad write can't wedge the queue.
 */
export async function flushOutbox(supabase: SupabaseClient): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    const keys = (await idbGetAllKeys('outbox')) ?? [];
    const entries = ((await idbGetAll<OutboxEntry>('outbox')) ?? []) as OutboxEntry[];
    for (let i = 0; i < entries.length && i < keys.length; i++) {
      const entry = entries[i];
      try {
        await executeEntry(supabase, entry);
      } catch (error) {
        if (isRetryable(error)) return; // still offline — keep this entry and the rest
        console.error('wake outbox: dropping entry after non-retryable error', entry.op, entry.id, error);
      }
      await idbDelete('outbox', keys[i]);
    }
  } finally {
    flushing = false;
  }
}

async function executeEntry(supabase: SupabaseClient, entry: OutboxEntry): Promise<void> {
  switch (entry.op) {
    case 'insert': {
      const alarm = await net.insertAlarm(supabase, entry.userId, entry.payload, entry.id);
      await idbSet('alarms', cacheKey(entry.userId, alarm.id), alarm);
      break;
    }
    case 'update': {
      const alarm = await net.updateAlarm(supabase, entry.userId, entry.id, entry.payload);
      await idbSet('alarms', cacheKey(entry.userId, alarm.id), alarm);
      break;
    }
    case 'enable':
      await net.setAlarmEnabled(supabase, entry.userId, entry.id, entry.payload.enabled);
      break;
    case 'delete':
      await net.deleteAlarmRow(supabase, entry.userId, entry.id);
      break;
  }
}

// ---------------------------------------------------------------------------
// Auto-flush loop
// ---------------------------------------------------------------------------

let loopStarted = false;

/** Starts the outbox auto-flush (window 'online' + 60s interval). Idempotent; call from any component. */
export function ensureFlushLoop(supabase: SupabaseClient): void {
  if (loopStarted || typeof window === 'undefined') return;
  loopStarted = true;
  window.addEventListener('online', () => void flushOutbox(supabase));
  setInterval(() => void flushOutbox(supabase), 60_000);
}
