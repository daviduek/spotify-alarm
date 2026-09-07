'use client';

/**
 * Spotify Web Playback SDK wrapper (browser). Creates a "Wake" Connect device in the tab and can
 * transfer playback to it, so Spotify plays through the alarm page without the desktop/phone app.
 * Requires Premium (SDK limitation). Falls back to the Web API when the SDK can't be used.
 */
type SpotifyNamespace = {
  Player: new (opts: {
    name: string;
    getOAuthToken: (cb: (token: string) => void) => void;
    volume?: number;
  }) => SpotifyPlayer;
};

type SpotifyPlayer = {
  connect: () => Promise<boolean>;
  disconnect: () => void;
  addListener: (event: string, cb: (payload: unknown) => void) => void;
  getVolume: () => Promise<number>;
  setVolume: (v: number) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
};

declare global {
  interface Window {
    Spotify?: SpotifyNamespace;
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

const SDK_SRC = 'https://sdk.scdn.co/spotify-player.js';
const API = 'https://api.spotify.com/v1';

let sdkPromise: Promise<void> | null = null;

function loadSdk(): Promise<void> {
  if (window.Spotify) return Promise.resolve();
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<void>((resolve, reject) => {
    window.onSpotifyWebPlaybackSDKReady = () => resolve();
    const script = document.createElement('script');
    script.src = SDK_SRC;
    script.async = true;
    script.onerror = () => reject(new Error('Spotify SDK failed to load'));
    document.body.appendChild(script);
  });
  return sdkPromise;
}

async function fetchToken(): Promise<string> {
  const res = await fetch('/api/spotify/token', { cache: 'no-store' });
  if (!res.ok) throw new Error(`token ${res.status}`);
  const json = (await res.json()) as { accessToken: string };
  return json.accessToken;
}

export type SpotifyPlaybackOutcome = { success: true; via: 'web_playback' | 'web_api' } | { success: false; reason: string };

export class SpotifyBrowserPlayer {
  private player: SpotifyPlayer | null = null;
  private deviceId: string | null = null;
  private ready = false;
  private lastState: { paused: boolean; position: number; at: number } | null = null;

  /** Idempotent: loads the SDK, connects, and remembers this tab's device id. */
  async init(): Promise<boolean> {
    if (this.ready) return true;
    try {
      await loadSdk();
      const token = await fetchToken();
      const player = new window.Spotify!.Player({
        name: 'Wake',
        getOAuthToken: (cb) => {
          void fetchToken().then(cb).catch(() => cb(token));
        },
        volume: 0.5,
      });
      this.player = player;
      player.addListener('player_state_changed', (payload) => {
        const st = payload as { paused?: boolean; position?: number } | null;
        if (st) this.lastState = { paused: Boolean(st.paused), position: st.position ?? 0, at: Date.now() };
      });
      await new Promise<void>((resolve, reject) => {
        player.addListener('ready', (payload) => {
          this.deviceId = (payload as { device_id: string }).device_id;
          this.ready = true;
          resolve();
        });
        player.addListener('initialization_error', () => reject(new Error('init')));
        player.addListener('authentication_error', () => reject(new Error('auth')));
        player.addListener('account_error', () => reject(new Error('premium')));
        void player.connect().then((ok) => {
          if (!ok) reject(new Error('connect'));
        });
        setTimeout(() => reject(new Error('timeout')), 12000);
      });
      return true;
    } catch {
      this.ready = false;
      return false;
    }
  }

  /** Plays a Spotify URI. Tries this tab's device first, then any active device via the Web API. */
  async play(uri: string): Promise<SpotifyPlaybackOutcome> {
    try {
      const token = await fetchToken();
      if (await this.init()) {
        const res = await this.startPlayback(token, uri, this.deviceId ?? undefined);
        if (res.ok) return { success: true, via: 'web_playback' };
      }
      // Fallback: an already-active device (phone/desktop app).
      const res = await this.startPlayback(token, uri);
      if (res.ok) return { success: true, via: 'web_api' };
      if (res.status === 404) return { success: false, reason: 'no_active_device' };
      if (res.status === 403) return { success: false, reason: 'premium_required' };
      return { success: false, reason: `http_${res.status}` };
    } catch (error) {
      return { success: false, reason: error instanceof Error ? error.message : 'unknown' };
    }
  }

  /**
   * After a 2xx from /me/player/play, confirm audio is really flowing before silencing the fallback:
   * SDK device → wait for a non-paused state whose position advances; Web API device → poll /me/player.
   */
  async confirmPlaying(timeoutMs = 6000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    const usingSdk = this.ready && this.player !== null;
    let firstPos: number | null = null;
    while (Date.now() < deadline) {
      if (usingSdk) {
        const st = this.lastState;
        if (st && !st.paused) {
          if (firstPos === null) firstPos = st.position;
          else if (st.position > firstPos) return true;
        }
      } else {
        try {
          const token = await fetchToken();
          const res = await fetch(`${API}/me/player`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
          if (res.status === 200) {
            const j = (await res.json()) as { is_playing?: boolean; progress_ms?: number };
            if (j.is_playing) {
              if (firstPos === null) firstPos = j.progress_ms ?? 0;
              else if ((j.progress_ms ?? 0) > firstPos) return true;
            }
          }
        } catch {
          /* keep polling until the deadline */
        }
      }
      await new Promise((r) => setTimeout(r, usingSdk ? 400 : 1200));
    }
    return false;
  }

  private startPlayback(token: string, uri: string, deviceId?: string): Promise<Response> {
    const isTrack = uri.startsWith('spotify:track:');
    const body = isTrack ? { uris: [uri] } : { context_uri: uri };
    const query = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : '';
    return fetch(`${API}/me/player/play${query}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  async setVolume(volume: number): Promise<void> {
    try {
      await this.player?.setVolume(Math.min(1, Math.max(0, volume)));
    } catch {
      /* device without volume control */
    }
  }

  async pause(): Promise<void> {
    try {
      if (this.player) return await this.player.pause();
      const token = await fetchToken();
      await fetch(`${API}/me/player/pause`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
    } catch {
      /* ignore */
    }
  }

  disconnect(): void {
    try {
      this.player?.disconnect();
    } catch {
      /* ignore */
    }
    this.player = null;
    this.ready = false;
  }
}
