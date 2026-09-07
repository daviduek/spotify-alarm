/**
 * Runtime configuration. Everything is optional at build time so the landing page deploys before any
 * secret exists; features degrade with a clear message instead of crashing (spec §56).
 */
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
  /** Server-only. Needed for the Spotify token store (token columns are hidden from the browser role). */
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY ?? '',
  /** Canonical public URL (https://wakealarm.vercel.app). Falls back to the request origin. */
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? '',
  spotifyClientId: process.env.SPOTIFY_CLIENT_ID ?? process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID ?? '',
  /** Optional: when absent the server uses PKCE (no secret) — both are supported by Spotify. */
  spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET ?? '',
};

export const isSupabaseConfigured = (): boolean => Boolean(env.supabaseUrl && env.supabaseAnonKey);
/** Spotify needs the app client id AND the server-side key that guards the token store. */
export const isSpotifyConfigured = (): boolean => Boolean(env.spotifyClientId && env.supabaseServiceRoleKey);

if (process.env.NODE_ENV === 'production' && typeof window === 'undefined' && !isSupabaseConfigured()) {
  console.error('[wake] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set: sign-in and alarms are disabled.');
}

export const SPOTIFY_SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-library-read',
].join(' ');
