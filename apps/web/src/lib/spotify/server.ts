import 'server-only';

import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

import { env } from '../env';

/**
 * Server-side Spotify OAuth (Authorization Code). Uses the client secret when configured,
 * otherwise PKCE — either way no secret ever reaches the browser. Tokens are stored per user
 * in `spotify_connections` (RLS) and refreshed here.
 */
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
export const AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const API = 'https://api.spotify.com/v1';

const TokenResponse = z.object({
  access_token: z.string(),
  token_type: z.string(),
  expires_in: z.number(),
  refresh_token: z.string().optional(),
  scope: z.string().optional(),
});

const MeResponse = z.object({
  id: z.string(),
  display_name: z.string().nullable().optional(),
  product: z.string().optional(),
  country: z.string().optional(),
  email: z.string().optional(),
});

export type SpotifyConnectionRow = {
  user_id: string;
  spotify_user_id: string | null;
  display_name: string | null;
  product: string | null;
  country: string | null;
  scope: string | null;
  access_token: string;
  refresh_token: string;
  expires_at: string;
};

export class SpotifyServerError extends Error {
  constructor(
    public readonly code: 'not_configured' | 'exchange_failed' | 'refresh_failed' | 'not_connected' | 'revoked',
    message: string,
  ) {
    super(message);
  }
}

function basicAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded' };
  if (env.spotifyClientSecret) {
    headers.Authorization = `Basic ${Buffer.from(`${env.spotifyClientId}:${env.spotifyClientSecret}`).toString('base64')}`;
  }
  return headers;
}

export function randomToken(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Buffer.from(arr).toString('base64url');
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return Buffer.from(digest).toString('base64url');
}

export async function exchangeCode(code: string, redirectUri: string, codeVerifier?: string) {
  if (!env.spotifyClientId) throw new SpotifyServerError('not_configured', 'SPOTIFY_CLIENT_ID is not set');
  const body = new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri });
  if (!env.spotifyClientSecret) {
    body.set('client_id', env.spotifyClientId);
    if (codeVerifier) body.set('code_verifier', codeVerifier);
  }
  const res = await fetch(TOKEN_URL, { method: 'POST', headers: basicAuthHeaders(), body, cache: 'no-store' });
  if (!res.ok) throw new SpotifyServerError('exchange_failed', `Spotify token exchange failed (${res.status}): ${await res.text()}`);
  return TokenResponse.parse(await res.json());
}

export async function refreshAccessToken(refreshToken: string) {
  if (!env.spotifyClientId) throw new SpotifyServerError('not_configured', 'SPOTIFY_CLIENT_ID is not set');
  const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken });
  if (!env.spotifyClientSecret) body.set('client_id', env.spotifyClientId);
  const res = await fetch(TOKEN_URL, { method: 'POST', headers: basicAuthHeaders(), body, cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 400 && /invalid_grant|revoked/i.test(text)) throw new SpotifyServerError('revoked', 'Spotify access was revoked');
    throw new SpotifyServerError('refresh_failed', `Spotify refresh failed (${res.status}): ${text}`);
  }
  return TokenResponse.parse(await res.json());
}

export async function fetchMe(accessToken: string) {
  const res = await fetch(`${API}/me`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' });
  if (!res.ok) return null;
  const parsed = MeResponse.safeParse(await res.json());
  return parsed.success ? parsed.data : null;
}

/** Returns a valid access token for the signed-in user, refreshing and persisting when needed. */
export async function getFreshAccessToken(supabase: SupabaseClient, userId: string): Promise<{ accessToken: string; expiresAt: string; row: SpotifyConnectionRow }> {
  const { data, error } = await supabase.from('spotify_connections').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new SpotifyServerError('not_connected', 'Spotify is not connected');
  const row = data as SpotifyConnectionRow;
  const expiresAt = new Date(row.expires_at).getTime();
  if (expiresAt - Date.now() > 60_000) return { accessToken: row.access_token, expiresAt: row.expires_at, row };

  try {
    const refreshed = await refreshAccessToken(row.refresh_token);
    const nextExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
    const { error: updateError } = await supabase
      .from('spotify_connections')
      .update({
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token ?? row.refresh_token,
        expires_at: nextExpiry,
        scope: refreshed.scope ?? row.scope,
      })
      .eq('user_id', userId);
    if (updateError) throw new Error(updateError.message);
    return { accessToken: refreshed.access_token, expiresAt: nextExpiry, row: { ...row, access_token: refreshed.access_token, expires_at: nextExpiry } };
  } catch (error) {
    if (error instanceof SpotifyServerError && error.code === 'revoked') {
      await supabase.from('spotify_connections').delete().eq('user_id', userId);
    }
    throw error;
  }
}

/** Public origin for OAuth redirects: configured URL first, else the incoming request's origin. */
export function publicOrigin(requestUrl: string): string {
  if (env.appUrl) return env.appUrl.replace(/\/$/, '');
  return new URL(requestUrl).origin;
}
