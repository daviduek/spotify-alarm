import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioSource as ExpoAudioSource } from 'expo-audio';
import {
  DEFAULT_CROSSFADE_SECONDS,
  crossfadeAt,
  fadeSpecFromConfig,
  volumeAt,
  type Alarm,
  type AlarmAudioEngine,
  type AudioEngineState,
  type AudioSource,
  type FadeRuntimeConfig,
} from '@wake/domain';

import { logger } from '../logger';
import { soundAssetFor } from './localSounds';

const FADE_TICK_MS = 250;

/**
 * JavaScript audio engine used while the app is in the foreground: sound previews, the
 * progressive-volume test and the JS alarm screen (recording / Spotify hand-off).
 *
 * The *guaranteed* alarm audio is native (AlarmKit alert sound / Android AlarmService) and
 * never depends on this class — spec §2, §17, §52. Fades here run on a JS interval, which is
 * fine while the screen is open; the native fallback has its own fade on Android.
 */
class JsAlarmAudioEngine implements AlarmAudioEngine {
  private alarm: Alarm | null = null;
  private fallback: AudioPlayer | null = null;
  private main: AudioPlayer | null = null;
  private fadeTimer: ReturnType<typeof setInterval> | null = null;
  private state: AudioEngineState = 'idle';
  private ready = false;

  private async ensureAudioMode(): Promise<void> {
    if (this.ready) return;
    await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' });
    this.ready = true;
  }

  getState(): AudioEngineState {
    return this.state;
  }

  async prepare(alarm: Alarm): Promise<void> {
    await this.ensureAudioMode();
    await this.stop();
    this.alarm = alarm;
    this.fallback = createAudioPlayer(soundAssetFor(alarm.fallbackSoundId));
    this.fallback.loop = true;
    this.state = 'prepared';
  }

  async start(): Promise<void> {
    if (!this.alarm || !this.fallback) throw new Error('prepare() first');
    const fade = fadeSpecFromConfig(this.alarm.fadeIn);
    this.fallback.volume = fade ? fade.startVolume : 1;
    this.fallback.play();
    this.state = 'playing_fallback';
    if (fade) void this.fade({ startVolume: fade.startVolume, endVolume: fade.endVolume, durationSeconds: fade.durationSeconds, curve: fade.curve });
  }

  /** Preview a bundled sound or recording outside an alarm context. */
  async preview(source: AudioSource, volume = 1): Promise<void> {
    await this.ensureAudioMode();
    await this.stop();
    const expoSource: ExpoAudioSource = source.type === 'local' ? soundAssetFor(source.soundId) : source.type === 'recording' ? { uri: source.fileUri ?? '' } : null;
    if (expoSource === null) throw new Error('Streaming sources are played by their provider');
    this.main = createAudioPlayer(expoSource);
    this.main.loop = source.type === 'local';
    this.main.volume = volume;
    this.main.play();
    this.state = 'playing_plan';
  }

  /** Progressive-volume test on a bundled sound (spec §27, §70). */
  async previewFade(soundId: string, config: FadeRuntimeConfig): Promise<void> {
    await this.preview({ type: 'local', soundId }, config.startVolume);
    await this.fade(config);
  }

  /**
   * Hand over from the fallback sound to a recording (spec §36 crossfade). Resolves once the
   * recording is playing. Throws if the file cannot be loaded — the caller keeps the fallback.
   */
  async crossfadeToRecording(fileUri: string): Promise<void> {
    await this.ensureAudioMode();
    const incoming = createAudioPlayer({ uri: fileUri });
    incoming.volume = 0;
    incoming.play();
    this.main = incoming;
    await this.crossfade(this.fallback, incoming, this.fallback?.volume ?? 1);
    this.state = 'playing_plan';
  }

  /** Fade the fallback out because an external player (Spotify) took over. */
  async fadeOutFallback(): Promise<void> {
    await this.crossfade(this.fallback, null, this.fallback?.volume ?? 1);
  }

  private crossfade(outgoing: AudioPlayer | null, incoming: AudioPlayer | null, targetVolume: number): Promise<void> {
    return new Promise((resolve) => {
      const startedAt = Date.now();
      const spec = { durationSeconds: DEFAULT_CROSSFADE_SECONDS, targetVolume };
      const timer = setInterval(() => {
        const elapsed = (Date.now() - startedAt) / 1000;
        const { outgoing: out, incoming: inn } = crossfadeAt(spec, elapsed);
        if (outgoing) outgoing.volume = out;
        if (incoming) incoming.volume = inn;
        if (elapsed >= spec.durationSeconds) {
          clearInterval(timer);
          outgoing?.pause();
          resolve();
        }
      }, 50);
    });
  }

  async setVolume(value: number): Promise<void> {
    const v = Math.min(1, Math.max(0, value));
    if (this.main) this.main.volume = v;
    else if (this.fallback) this.fallback.volume = v;
  }

  async fade(config: FadeRuntimeConfig): Promise<void> {
    this.clearFade();
    const target = () => this.main ?? this.fallback;
    const startedAt = Date.now();
    const spec = { startVolume: config.startVolume, endVolume: config.endVolume, durationSeconds: config.durationSeconds, curve: config.curve };
    const player = target();
    if (player) player.volume = spec.startVolume;
    this.fadeTimer = setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      const p = target();
      if (p) p.volume = volumeAt(spec, elapsed);
      if (elapsed >= spec.durationSeconds) this.clearFade();
    }, FADE_TICK_MS);
    logger.info('fade_started', { durationSeconds: spec.durationSeconds, from: spec.startVolume, to: spec.endVolume, curve: spec.curve });
  }

  private clearFade(): void {
    if (this.fadeTimer) clearInterval(this.fadeTimer);
    this.fadeTimer = null;
  }

  async stop(): Promise<void> {
    this.clearFade();
    for (const p of [this.fallback, this.main]) {
      try {
        p?.pause();
        p?.remove();
      } catch {
        /* already released */
      }
    }
    this.fallback = null;
    this.main = null;
    this.state = this.alarm ? 'stopped' : 'idle';
  }

  isPlaying(): boolean {
    return Boolean(this.main?.playing || this.fallback?.playing);
  }
}

export const alarmAudioEngine = new JsAlarmAudioEngine();
