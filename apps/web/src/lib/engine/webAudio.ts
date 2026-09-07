'use client';

import { fadeSpecFromConfig, volumeAt, type FadeConfig } from '@wake/domain';

/**
 * Browser audio for the alarm: <audio> elements on GainNodes so we can fade the fallback sound
 * and crossfade to a recording. Volume is player-only; we never touch OS volume (spec §16).
 *
 * Autoplay: iOS Safari only lets an <audio> element play later if it was played inside a user
 * gesture. `unlock()` must be called from a click/tap: it resumes the AudioContext and primes a
 * small pool of elements that are then reused (src swapped) when the alarm actually fires.
 */
type Slot = { el: HTMLAudioElement; gain: GainNode; busy: boolean };

const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

export class WebAudioEngine {
  private ctx: AudioContext | null = null;
  private pool: Slot[] = [];
  private fallback: Slot | null = null;
  private main: Slot | null = null;
  private fadeRaf: number | null = null;
  private unlocked = false;

  private ensureCtx(): AudioContext {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private newSlot(): Slot {
    const ctx = this.ensureCtx();
    const el = new Audio();
    el.crossOrigin = 'anonymous';
    el.preload = 'auto';
    const node = ctx.createMediaElementSource(el);
    const gain = ctx.createGain();
    node.connect(gain).connect(ctx.destination);
    return { el, gain, busy: false };
  }

  /** Call inside a user gesture (arm button). Primes 2 reusable elements + resumes the context. */
  async unlock(): Promise<boolean> {
    try {
      const ctx = this.ensureCtx();
      await ctx.resume();
      while (this.pool.length < 2) this.pool.push(this.newSlot());
      await Promise.all(
        this.pool.map(async (s) => {
          if (s.busy) return;
          s.el.src = SILENT_WAV;
          s.el.loop = false;
          try {
            await s.el.play();
          } catch {
            /* still primed for most browsers */
          }
          s.el.pause();
        }),
      );
      this.unlocked = ctx.state === 'running';
      return this.unlocked;
    } catch {
      return false;
    }
  }

  get isUnlocked(): boolean {
    return this.unlocked;
  }

  private acquire(src: string, loop: boolean): Slot {
    let slot = this.pool.find((s) => !s.busy);
    if (!slot) {
      slot = this.newSlot();
      this.pool.push(slot);
    }
    slot.busy = true;
    slot.el.loop = loop;
    slot.el.src = src;
    slot.el.currentTime = 0;
    return slot;
  }

  private release(slot: Slot | null): void {
    if (!slot) return;
    slot.el.pause();
    slot.el.removeAttribute('src');
    slot.busy = false;
  }

  /** Starts the guaranteed fallback sound, applying the fade config from t=0. Resolves true when audible. */
  async startFallback(src: string, fade: FadeConfig): Promise<boolean> {
    this.stop();
    const spec = fadeSpecFromConfig(fade);
    const startVol = spec ? spec.startVolume : 1;
    this.fallback = this.acquire(src, true);
    this.fallback.gain.gain.value = startVol;
    const ok = await this.play(this.fallback.el);
    if (spec) this.runFade(() => this.fallback?.gain ?? null, spec);
    return ok;
  }

  /** Preview a sound or a recording at a fixed volume (no loop for recordings). */
  async preview(src: string, loop: boolean, volume = 1): Promise<boolean> {
    this.stop();
    this.main = this.acquire(src, loop);
    this.main.gain.gain.value = volume;
    return this.play(this.main.el);
  }

  /** Progressive-volume test (spec §70) on any source. */
  async previewFade(src: string, fade: FadeConfig): Promise<boolean> {
    const spec = fadeSpecFromConfig(fade);
    const ok = await this.preview(src, true, spec ? spec.startVolume : 1);
    if (spec && this.main) this.runFade(() => this.main?.gain ?? null, spec);
    return ok;
  }

  /**
   * Crossfade fallback → a recording (spec §36). Rejects — leaving the fallback untouched — if the
   * recording cannot start (expired URL, decode error, autoplay block).
   */
  async crossfadeToRecording(src: string, seconds = 1): Promise<void> {
    const incoming = this.acquire(src, true);
    incoming.gain.gain.value = 0;
    const ok = await this.play(incoming.el);
    if (!ok) {
      this.release(incoming);
      throw new Error('recording_play_failed');
    }
    try {
      await waitForPlaying(incoming.el, 4000);
    } catch {
      this.release(incoming);
      throw new Error('recording_not_playing');
    }
    const outgoing = this.fallback;
    const start = performance.now();
    return new Promise((resolve) => {
      const step = () => {
        const t = Math.min(1, (performance.now() - start) / (seconds * 1000));
        incoming.gain.gain.value = t;
        if (outgoing) outgoing.gain.gain.value = 1 - t;
        if (t < 1) requestAnimationFrame(step);
        else {
          this.release(outgoing);
          this.fallback = null;
          this.main = incoming;
          resolve();
        }
      };
      requestAnimationFrame(step);
    });
  }

  /** Fade the fallback out because Spotify took over. */
  fadeOutFallback(seconds = 1): void {
    const target = this.fallback;
    if (!target) return;
    const start = performance.now();
    const from = target.gain.gain.value;
    const step = () => {
      const t = Math.min(1, (performance.now() - start) / (seconds * 1000));
      target.gain.gain.value = from * (1 - t);
      if (t < 1) requestAnimationFrame(step);
      else {
        this.release(target);
        if (this.fallback === target) this.fallback = null;
      }
    };
    requestAnimationFrame(step);
  }

  private runFade(getGain: () => GainNode | null, spec: ReturnType<typeof fadeSpecFromConfig>): void {
    if (!spec) return;
    if (this.fadeRaf) cancelAnimationFrame(this.fadeRaf);
    const start = performance.now();
    const tick = () => {
      const elapsed = (performance.now() - start) / 1000;
      const gain = getGain();
      if (gain) gain.gain.value = volumeAt(spec, elapsed);
      if (elapsed < spec.durationSeconds) this.fadeRaf = requestAnimationFrame(tick);
    };
    this.fadeRaf = requestAnimationFrame(tick);
  }

  private async play(el: HTMLAudioElement): Promise<boolean> {
    try {
      await el.play();
      return true;
    } catch (error) {
      console.warn('audio play blocked', error instanceof Error ? error.message : error);
      return false;
    }
  }

  stop(): void {
    if (this.fadeRaf) cancelAnimationFrame(this.fadeRaf);
    this.fadeRaf = null;
    this.release(this.fallback);
    this.release(this.main);
    this.fallback = null;
    this.main = null;
  }
}

function waitForPlaying(el: HTMLAudioElement, timeoutMs: number): Promise<void> {
  if (!el.paused && el.currentTime > 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const done = () => {
      cleanup();
      resolve();
    };
    const fail = () => {
      cleanup();
      reject(new Error('media_error'));
    };
    const timer = setTimeout(fail, timeoutMs);
    const cleanup = () => {
      clearTimeout(timer);
      el.removeEventListener('playing', done);
      el.removeEventListener('timeupdate', done);
      el.removeEventListener('error', fail);
    };
    el.addEventListener('playing', done);
    el.addEventListener('timeupdate', done);
    el.addEventListener('error', fail);
  });
}
