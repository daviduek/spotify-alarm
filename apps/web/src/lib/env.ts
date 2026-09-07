/**
 * Runtime configuration. Everything is optional at build time so the landing page deploys before any
 * secret exists; features degrade with a clear message instead of crashing (spec §56).
 */
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
  /** Canonical public URL (https://wake.example.com). Falls back to the request origin. */
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? '',
  spotifyClientId: process.env.SPOTIFY_CLIENT_ID ?? process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID ?? '',
  /** Optional: when absent the server uses PKCE (no secret) — both are supported by Spotify. */
  spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET ?? '',
};

export const isSupabaseConfigured = (): boolean => Boolean(env.supabaseUrl && env.supabaseAnonKey);
export const isSpotifyConfigured = (): boolean => Boolean(env.spotifyClientId);

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
