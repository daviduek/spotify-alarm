import type { MusicProviderId } from '../audio/types';

export type SpotifyReadiness =
  | 'ready'
  | 'not_authenticated'
  | 'app_missing'
  | 'premium_required'
  | 'connection_problem'
  | 'unknown';

/** Provider-agnostic readiness; Spotify's enum is a superset used verbatim. */
export type ProviderReadiness = SpotifyReadiness;

export type MusicItemKind = 'playlist' | 'album' | 'track' | 'artist';

export type MusicItem = {
  provider: MusicProviderId;
  kind: MusicItemKind;
  uri: string;
  title: string;
  subtitle?: string;
  artworkUrl?: string;
};

export type PlaybackResult =
  | { success: true; via: 'app_remote' | 'web_api' | 'deep_link' }
  | { success: false; reason: PlaybackFailureReason; detail?: string };

export type PlaybackFailureReason =
  | 'not_authenticated'
  | 'token_expired'
  | 'app_missing'
  | 'premium_required'
  | 'no_active_device'
  | 'offline'
  | 'content_unavailable'
  | 'rate_limited'
  | 'provider_error'
  | 'unknown';

export type PlaybackState = {
  isPlaying: boolean;
  uri?: string;
  title?: string;
  progressMs?: number;
  durationMs?: number;
  volumePercent?: number;
  deviceName?: string;
};

/**
 * Spec §10/§14: every streaming integration implements this. Wake never calls a
 * provider SDK directly from screens; it goes through a MusicProvider so Spotify
 * can be swapped, disabled by feature flag, or complemented by Apple Music.
 */
export interface MusicProvider {
  readonly id: MusicProviderId;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): Promise<boolean>;
  getReadiness(): Promise<ProviderReadiness>;
  search(query: string): Promise<MusicItem[]>;
  getPlaylists(): Promise<MusicItem[]>;
  play(uri: string): Promise<PlaybackResult>;
  pause(): Promise<void>;
  /** 0..1 player volume; providers map to their own scale. */
  setVolume(volume: number): Promise<void>;
  getPlaybackState(): Promise<PlaybackState | null>;
}

/** User-facing copy for readiness states. Never show raw SDK errors (spec §56). */
export function describeProviderReadiness(readiness: ProviderReadiness, providerName = 'Spotify'): string {
  switch (readiness) {
    case 'ready':
      return `${providerName} connected`;
    case 'not_authenticated':
      return `${providerName} not connected`;
    case 'app_missing':
      return `${providerName} app not installed`;
    case 'premium_required':
      return `${providerName} Premium required for playback`;
    case 'connection_problem':
      return `${providerName} connection problem`;
    case 'unknown':
      return `${providerName} status unknown`;
  }
}

export function playbackFailureMessage(reason: PlaybackFailureReason, providerName = 'Spotify'): string {
  switch (reason) {
    case 'not_authenticated':
    case 'token_expired':
      return `${providerName} isn't connected. Your fallback alarm is playing instead.`;
    case 'app_missing':
      return `${providerName} isn't installed. Your fallback alarm is playing instead.`;
    case 'premium_required':
      return `${providerName} Premium is required to start playback. Your fallback alarm is playing instead.`;
    case 'no_active_device':
      return `${providerName} wasn't ready to play on this phone. Your fallback alarm is playing instead.`;
    case 'offline':
      return `You're offline, so ${providerName} couldn't start. Your fallback alarm is playing instead.`;
    case 'content_unavailable':
      return `That ${providerName} content isn't available right now. Your fallback alarm is playing instead.`;
    case 'rate_limited':
    case 'provider_error':
    case 'unknown':
      return `${providerName} couldn't start. Your fallback alarm is playing instead.`;
  }
}
