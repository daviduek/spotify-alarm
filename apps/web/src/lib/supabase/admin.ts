import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { env } from '../env';

let cached: SupabaseClient | null = null;

/**
 * Service-role client (bypasses RLS). Used ONLY for the Spotify token store: the browser must never
 * be able to read `access_token` / `refresh_token`, so those columns are revoked from `authenticated`
 * (migration 0002) and every read/write goes through here, always filtered by the signed-in user id.
 */
export function getSupabaseAdminClient(): SupabaseClient {
  if (!env.supabaseServiceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set (required for Spotify token storage).');
  }
  if (!cached) {
    cached = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return cached;
}
