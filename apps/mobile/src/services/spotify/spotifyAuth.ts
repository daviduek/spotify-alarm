import { AuthRequest, ResponseType, exchangeCodeAsync, refreshAsync, type TokenResponse } from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';

import { logger } from '../logger';
import { SPOTIFY_DISCOVERY, SPOTIFY_REDIRECT_URI, SPOTIFY_SCOPES, isSpotifyConfigured, spotifyClientId } from './spotifyConfig';

WebBrowser.maybeCompleteAuthSession();

const TOKENS_KEY = 'wake.spotify.tokens.v1';

export type StoredTokens = {
  accessToken: string;
  refreshToken?: string;
  /** Epoch ms. */
  expiresAt: number;
  scope?: string;
};

export class SpotifyAuthError extends Error {
  constructor(
    public readonly code: 'not_configured' | 'cancelled' | 'exchange_failed' | 'refresh_failed' | 'not_authenticated',
    message: string,
  ) {
    super(message);
    this.name = 'SpotifyAuthError';
  }
}

/** Tokens live in the Keychain / Android Keystore-backed store only (spec §44). */
export async function loadTokens(): Promise<StoredTokens | null> {
  const raw = await SecureStore.getItemAsync(TOKENS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredTokens;
  } catch {
    await SecureStore.deleteItemAsync(TOKENS_KEY);
    return null;
  }
}

async function saveTokens(tokens: StoredTokens): Promise<void> {
  await SecureStore.setItemAsync(TOKENS_KEY, JSON.stringify(tokens), {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
  });
}

function fromTokenResponse(response: TokenResponse, previous?: StoredTokens | null): StoredTokens {
  const expiresIn = response.expiresIn ?? 3600;
  return {
    accessToken: response.accessToken,
    // Spotify may omit the refresh token on refresh — keep the previous one.
    refreshToken: response.refreshToken ?? previous?.refreshToken,
    expiresAt: (response.issuedAt ?? Math.floor(Date.now() / 1000)) * 1000 + expiresIn * 1000 - 30_000,
    scope: response.scope,
  };
}

export async function isSpotifyConnected(): Promise<boolean> {
  return (await loadTokens()) !== null;
}

/** Opens the official Spotify consent page. Resolves true when connected. */
export async function connectSpotify(): Promise<boolean> {
  if (!isSpotifyConfigured()) {
    throw new SpotifyAuthError('not_configured', 'Spotify Client ID is missing (EXPO_PUBLIC_SPOTIFY_CLIENT_ID).');
  }
  const request = new AuthRequest({
    clientId: spotifyClientId,
    redirectUri: SPOTIFY_REDIRECT_URI,
    scopes: SPOTIFY_SCOPES,
    responseType: ResponseType.Code,
    usePKCE: true,
  });
  logger.info('spotify_auth_started', { redirectUri: SPOTIFY_REDIRECT_URI });
  const result = await request.promptAsync(SPOTIFY_DISCOVERY);
  if (result.type !== 'success') {
    logger.warn('spotify_auth_not_completed', { type: result.type });
    if (result.type === 'error') {
      throw new SpotifyAuthError('exchange_failed', result.error?.message ?? 'Spotify sign-in failed');
    }
    return false;
  }
  const code = result.params.code;
  if (!code || !request.codeVerifier) {
    throw new SpotifyAuthError('exchange_failed', 'Spotify did not return an authorization code');
  }
  try {
    const token = await exchangeCodeAsync(
      {
        clientId: spotifyClientId,
        code,
        redirectUri: SPOTIFY_REDIRECT_URI,
        extraParams: { code_verifier: request.codeVerifier },
      },
      SPOTIFY_DISCOVERY,
    );
    await saveTokens(fromTokenResponse(token));
    logger.info('spotify_connected');
    return true;
  } catch (error) {
    logger.error('spotify_token_exchange_failed', { message: String(error) });
    throw new SpotifyAuthError('exchange_failed', 'Could not finish connecting Spotify');
  }
}

export async function disconnectSpotify(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKENS_KEY);
  logger.info('spotify_disconnected');
}

/** Returns a fresh access token, refreshing when needed. Null when not connected. */
export async function getValidAccessToken(force = false): Promise<string | null> {
  const tokens = await loadTokens();
  if (!tokens) return null;
  if (!force && Date.now() < tokens.expiresAt) return tokens.accessToken;
  if (!tokens.refreshToken) {
    logger.warn('spotify_refresh_missing');
    return null;
  }
  try {
    const refreshed = await refreshAsync({ clientId: spotifyClientId, refreshToken: tokens.refreshToken }, SPOTIFY_DISCOVERY);
    const next = fromTokenResponse(refreshed, tokens);
    await saveTokens(next);
    logger.info('spotify_token_refreshed');
    return next.accessToken;
  } catch (error) {
    logger.error('spotify_token_refresh_failed', { message: String(error) });
    // Refresh token revoked (user logged out / removed app access): force re-auth.
    if (/invalid_grant|revoked/i.test(String(error))) await disconnectSpotify();
    return null;
  }
}
