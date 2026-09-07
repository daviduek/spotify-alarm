import { Linking, Platform } from 'react-native';
import type { MusicItem, MusicProvider, PlaybackResult, PlaybackState, ProviderReadiness } from '@wake/domain';

import { flags } from '../config';
import { logger } from '../logger';
import { SpotifyApiError, spotifyApi } from './spotifyApi';
import { connectSpotify, disconnectSpotify, isSpotifyConnected } from './spotifyAuth';
import { isSpotifyConfigured } from './spotifyConfig';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * SpotifyProvider — Web API based remote control (spec §10–§14).
 *
 * Playback needs an *active device*: the Spotify app on this phone must be alive. When no
 * device is listed we deep-link `spotify:` to wake the app and retry a few times. This is
 * exactly the behaviour Phase 0 must measure on real devices (locked screen, Spotify killed…).
 * The App Remote SDK path is a documented follow-up spike, not a dependency of the alarm.
 */
export class SpotifyProvider implements MusicProvider {
  readonly id = 'spotify' as const;
  private readinessCache: { at: number; value: ProviderReadiness } | null = null;

  async connect(): Promise<void> {
    await connectSpotify();
    this.readinessCache = null;
  }

  async disconnect(): Promise<void> {
    await disconnectSpotify();
    this.readinessCache = null;
  }

  isConnected(): Promise<boolean> {
    return isSpotifyConnected();
  }

  async isAppInstalled(): Promise<boolean> {
    try {
      return await Linking.canOpenURL('spotify:');
    } catch {
      return false;
    }
  }

  async getReadiness(force = false): Promise<ProviderReadiness> {
    if (!force && this.readinessCache && Date.now() - this.readinessCache.at < 60_000) return this.readinessCache.value;
    const value = await this.computeReadiness();
    this.readinessCache = { at: Date.now(), value };
    return value;
  }

  private async computeReadiness(): Promise<ProviderReadiness> {
    if (!flags.spotify_enabled || !isSpotifyConfigured()) return 'unknown';
    if (!(await isSpotifyConnected())) return 'not_authenticated';
    if (!(await this.isAppInstalled())) return 'app_missing';
    try {
      const me = await spotifyApi.me();
      if (me.product && me.product !== 'premium') return 'premium_required';
      return 'ready';
    } catch (error) {
      if (error instanceof SpotifyApiError) {
        if (error.reason === 'not_authenticated' || error.reason === 'token_expired') return 'not_authenticated';
        if (error.reason === 'offline') return 'connection_problem';
        if (error.reason === 'premium_required') return 'premium_required';
      }
      return 'connection_problem';
    }
  }

  async getPlaylists(): Promise<MusicItem[]> {
    const page = await spotifyApi.myPlaylists();
    return page.items
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .map((p) => ({
        provider: 'spotify' as const,
        kind: 'playlist' as const,
        uri: p.uri,
        title: p.name,
        subtitle: p.owner?.display_name ? `by ${p.owner.display_name}` : undefined,
        artworkUrl: p.images?.[0]?.url,
      }));
  }

  async search(query: string): Promise<MusicItem[]> {
    if (!query.trim()) return [];
    const res = await spotifyApi.search(query);
    const items: MusicItem[] = [];
    for (const p of res.playlists?.items ?? []) {
      if (p) items.push({ provider: 'spotify', kind: 'playlist', uri: p.uri, title: p.name, subtitle: p.owner?.display_name ?? undefined, artworkUrl: p.images?.[0]?.url });
    }
    for (const a of res.albums?.items ?? []) {
      if (a) items.push({ provider: 'spotify', kind: 'album', uri: a.uri, title: a.name, subtitle: a.artists?.map((x) => x.name).join(', '), artworkUrl: a.images?.[0]?.url });
    }
    for (const t of res.tracks?.items ?? []) {
      if (t) items.push({ provider: 'spotify', kind: 'track', uri: t.uri, title: t.name, subtitle: t.artists?.map((x) => x.name).join(', '), artworkUrl: t.album?.images?.[0]?.url });
    }
    return items;
  }

  /**
   * Try hard, but bounded: the caller (alarm screen) already has the fallback sound ringing.
   * Never throws — every failure becomes a typed PlaybackResult (spec §11, §13).
   */
  async play(uri: string): Promise<PlaybackResult> {
    const startedAt = Date.now();
    try {
      if (!(await isSpotifyConnected())) return { success: false, reason: 'not_authenticated' };

      let deviceId = await this.findThisPhoneDevice();
      if (!deviceId) {
        // Wake the Spotify app so it registers as a Connect device, then poll.
        const opened = await this.openSpotifyApp();
        logger.info('spotify_wake_attempt', { opened });
        for (let attempt = 0; attempt < 5 && !deviceId; attempt++) {
          await sleep(1500);
          deviceId = await this.findThisPhoneDevice();
        }
      }
      if (!deviceId) return { success: false, reason: 'no_active_device', detail: 'Spotify has no active device on this phone' };

      await spotifyApi.play(uri, deviceId);
      logger.info('spotify_playback_success', { uri, deviceId, ms: Date.now() - startedAt });
      return { success: true, via: 'web_api' };
    } catch (error) {
      if (error instanceof SpotifyApiError) {
        logger.warn('spotify_playback_fallback', { reason: error.reason, status: error.status, ms: Date.now() - startedAt });
        return { success: false, reason: error.reason, detail: error.message };
      }
      logger.error('spotify_playback_unknown_error', { message: String(error) });
      return { success: false, reason: 'unknown', detail: String(error) };
    }
  }

  async pause(): Promise<void> {
    try {
      await spotifyApi.pause();
    } catch (error) {
      logger.warn('spotify_pause_failed', { message: String(error) });
    }
  }

  async setVolume(volume: number): Promise<void> {
    try {
      await spotifyApi.setVolume(Math.round(volume * 100));
    } catch (error) {
      // Volume control is not available on every device type; never fatal.
      logger.warn('spotify_volume_failed', { message: String(error) });
    }
  }

  async getPlaybackState(): Promise<PlaybackState | null> {
    try {
      const s = await spotifyApi.playbackState();
      if (!s) return null;
      return {
        isPlaying: s.is_playing,
        uri: s.item?.uri ?? s.context?.uri ?? undefined,
        title: s.item?.name,
        progressMs: s.progress_ms ?? undefined,
        durationMs: s.item?.duration_ms,
        volumePercent: s.device?.volume_percent ?? undefined,
        deviceName: s.device?.name,
      };
    } catch {
      return null;
    }
  }

  private async findThisPhoneDevice(): Promise<string | null> {
    const { devices } = await spotifyApi.devices();
    const active = devices.find((d) => d.is_active && d.id);
    if (active?.id) return active.id;
    const phone = devices.find((d) => d.type.toLowerCase() === 'smartphone' && d.id);
    return phone?.id ?? devices.find((d) => d.id)?.id ?? null;
  }

  private async openSpotifyApp(): Promise<boolean> {
    try {
      if (!(await Linking.canOpenURL('spotify:'))) return false;
      // iOS will app-switch; Android usually starts the app in the background.
      await Linking.openURL(Platform.OS === 'ios' ? 'spotify:' : 'spotify://');
      return true;
    } catch {
      return false;
    }
  }
}

export const spotifyProvider = new SpotifyProvider();
