import type { z } from 'zod';
import {
  SpotifyDevicesResponseSchema,
  SpotifyErrorSchema,
  SpotifyPlaybackStateSchema,
  SpotifyPlaylistPageSchema,
  SpotifySearchResponseSchema,
  SpotifyUserSchema,
  type PlaybackFailureReason,
} from '@wake/domain';

import { logger } from '../logger';
import { getValidAccessToken } from './spotifyAuth';
import { SPOTIFY_API_BASE } from './spotifyConfig';

export class SpotifyApiError extends Error {
  constructor(
    public readonly reason: PlaybackFailureReason,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'SpotifyApiError';
  }
}

async function request<T>(path: string, schema: z.ZodType<T> | null, init: RequestInit = {}, retry = true): Promise<T | null> {
  const token = await getValidAccessToken();
  if (!token) throw new SpotifyApiError('not_authenticated', 401, 'Spotify is not connected');

  let response: Response;
  try {
    response = await fetch(`${SPOTIFY_API_BASE}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    });
  } catch (error) {
    throw new SpotifyApiError('offline', 0, `Network error: ${String(error)}`);
  }

  if (response.status === 401 && retry) {
    const refreshed = await getValidAccessToken(true);
    if (refreshed) return request(path, schema, init, false);
    throw new SpotifyApiError('token_expired', 401, 'Spotify session expired');
  }

  if (response.status === 204 || response.status === 202) return null;

  if (!response.ok) {
    let reason: PlaybackFailureReason = 'provider_error';
    let message = `Spotify API ${response.status}`;
    try {
      const body = SpotifyErrorSchema.safeParse(await response.json());
      if (body.success) {
        message = body.data.error.message;
        const spotifyReason = body.data.error.reason ?? '';
        if (spotifyReason === 'PREMIUM_REQUIRED' || /premium/i.test(message)) reason = 'premium_required';
        else if (spotifyReason === 'NO_ACTIVE_DEVICE' || /device/i.test(message)) reason = 'no_active_device';
        else if (/not available|unavailable|country/i.test(message)) reason = 'content_unavailable';
      }
    } catch {
      /* body not JSON */
    }
    if (response.status === 429) reason = 'rate_limited';
    if (response.status === 404 && reason === 'provider_error') reason = 'no_active_device';
    if (response.status === 403 && reason === 'provider_error') reason = 'premium_required';
    logger.warn('spotify_api_error', { path, status: response.status, reason });
    throw new SpotifyApiError(reason, response.status, message);
  }

  if (!schema) return null;
  const json: unknown = await response.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    logger.error('spotify_api_unexpected_shape', { path, issues: parsed.error.issues.slice(0, 3).map((i) => i.path.join('.')) });
    throw new SpotifyApiError('provider_error', response.status, 'Unexpected Spotify response');
  }
  return parsed.data;
}

export type SpotifyUser = z.infer<typeof SpotifyUserSchema>;
export type SpotifyDevices = z.infer<typeof SpotifyDevicesResponseSchema>;
export type SpotifyPlaybackState = z.infer<typeof SpotifyPlaybackStateSchema>;
export type SpotifyPlaylistPage = z.infer<typeof SpotifyPlaylistPageSchema>;
export type SpotifySearchResponse = z.infer<typeof SpotifySearchResponseSchema>;

export const spotifyApi = {
  me: () => request('/me', SpotifyUserSchema) as Promise<SpotifyUser>,
  myPlaylists: (limit = 50) => request(`/me/playlists?limit=${limit}`, SpotifyPlaylistPageSchema) as Promise<SpotifyPlaylistPage>,
  search: (query: string, types = 'playlist,album,track', limit = 10) =>
    request(`/search?q=${encodeURIComponent(query)}&type=${types}&limit=${limit}`, SpotifySearchResponseSchema) as Promise<SpotifySearchResponse>,
  devices: () => request('/me/player/devices', SpotifyDevicesResponseSchema) as Promise<SpotifyDevices>,
  playbackState: async () => {
    // 204 = nothing playing → null
    return request('/me/player', SpotifyPlaybackStateSchema);
  },
  play: (uri: string, deviceId?: string) => {
    const isTrack = uri.startsWith('spotify:track:');
    const body = isTrack ? { uris: [uri] } : { context_uri: uri };
    const query = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : '';
    return request(`/me/player/play${query}`, null, { method: 'PUT', body: JSON.stringify(body) });
  },
  pause: () => request('/me/player/pause', null, { method: 'PUT' }),
  setVolume: (percent: number, deviceId?: string) => {
    const query = `?volume_percent=${Math.round(Math.min(100, Math.max(0, percent)))}${deviceId ? `&device_id=${encodeURIComponent(deviceId)}` : ''}`;
    return request(`/me/player/volume${query}`, null, { method: 'PUT' });
  },
};
