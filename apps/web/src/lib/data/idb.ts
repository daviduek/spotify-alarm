/**
 * Minimal promise-based IndexedDB wrapper for the Wake web app.
 *
 * Database 'wake' with two stores:
 *  - 'alarms': cached alarm rows, keyed by `${userId}:${alarmId}`.
 *  - 'outbox': queued offline writes, autoIncrement key (drain in insertion order).
 *
 * Every helper is resilient: on any failure (IndexedDB unavailable — SSR, private
 * mode, blocked storage — or a transaction error) it resolves to `undefined`
 * instead of throwing, so callers can treat the cache as best-effort.
 */

const DB_NAME = 'wake';
const DB_VERSION = 1;

export type StoreName = 'alarms' | 'outbox';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> | null {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') return null;
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('alarms')) db.createObjectStore('alarms');
        if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { autoIncrement: true });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('IndexedDB open blocked'));
    });
    // Allow a retry on the next call if opening failed.
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

async function run<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T | undefined> {
  try {
    const opening = openDb();
    if (!opening) return undefined;
    const db = await opening;
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const req = fn(tx.objectStore(store));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return undefined;
  }
}

export const idbGet = <T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> => run<T>(store, 'readonly', (s) => s.get(key));

export const idbSet = (store: StoreName, key: IDBValidKey, value: unknown): Promise<IDBValidKey | undefined> =>
  run<IDBValidKey>(store, 'readwrite', (s) => s.put(value, key));

/** For autoIncrement stores (outbox): appends and resolves to the generated key. */
export const idbAdd = (store: StoreName, value: unknown): Promise<IDBValidKey | undefined> => run<IDBValidKey>(store, 'readwrite', (s) => s.add(value));

export const idbDelete = (store: StoreName, key: IDBValidKey | IDBKeyRange): Promise<undefined> => run<undefined>(store, 'readwrite', (s) => s.delete(key));

export const idbGetAll = <T>(store: StoreName, query?: IDBKeyRange): Promise<T[] | undefined> => run<T[]>(store, 'readonly', (s) => s.getAll(query));

export const idbGetAllKeys = (store: StoreName, query?: IDBKeyRange): Promise<IDBValidKey[] | undefined> =>
  run<IDBValidKey[]>(store, 'readonly', (s) => s.getAllKeys(query));

/** Key range covering every key with the given string prefix. */
export const prefixRange = (prefix: string): IDBKeyRange => IDBKeyRange.bound(prefix, `${prefix}\uffff`);
