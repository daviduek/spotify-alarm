import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

import { logger } from './logger';

/**
 * Optional cloud account (same Supabase project as the web). Local SQLite remains the source
 * of truth for ringing; everything here exists only for sync (see SYNC.md).
 *
 * Session storage is expo-secure-store (Keychain / Keystore) — same place Spotify tokens live.
 */
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

const secureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(storeKey(key)),
  setItem: async (key: string, value: string) => {
    await SecureStore.setItemAsync(storeKey(key), value);
  },
  removeItem: async (key: string) => {
    await SecureStore.deleteItemAsync(storeKey(key));
  },
};

/** SecureStore keys must be alphanumeric plus ".", "-", "_". */
function storeKey(key: string): string {
  return key.replace(/[^A-Za-z0-9._-]/g, '_');
}

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: secureStoreAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}

/** Current signed-in user id, or null (also null when Supabase is not configured). */
export async function getUserId(): Promise<string | null> {
  try {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  } catch (error) {
    logger.warn('supabase_session_read_failed', { message: String(error) });
    return null;
  }
}
