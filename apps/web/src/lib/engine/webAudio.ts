'use client';

import { fadeSpecFromConfig, volumeAt, type FadeConfig } from '@wake/domain';

/**
 * Browser audio for the alarm: an <audio> element on a GainNode so we can fade the fallback sound
 * and crossfade to a recording. Volume is player-only; we never touch OS volume (spec §16).
 */
export class WebAudioEngine {
  private ctx: AudioContext | null = null;
  private fallback: { el: HTMLAudioElement; gain: GainNode } | null = null;
  private main: { el: HTMLAudioElement; gain: GainNode } | null = null;
  private fadeRaf: number | null = null;

  private ensureCtx(): AudioContext {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private makeSource(src: string, loop: boolean): { el: HTMLAudioElement; gain: GainNode } {
    const ctx = this.ensureCtx();
    const el = new Audio(src);
    el.loop = loop;
    el.crossOrigin = 'anonymous';
    const node = ctx.createMediaElementSource(el);
    const gain = ctx.createGain();
    node.connect(gain).connect(ctx.destination);
    return { el, gain };
  }

  /** Starts the guaranteed fallback sound, applying the fade config from t=0. Returns once playing. */
  async startFallback(src: string, fade: FadeConfig): Promise<void> {
    this.stop();
    const spec = fadeSpecFromConfig(fade);
    const startVol = spec ? spec.startVolume : 1;
    this.fallback = this.makeSource(src, true);
    this.fallback.gain.gain.value = startVol;
    await this.play(this.fallback.el);
    if (spec) this.runFade(() => this.fallback?.gain ?? null, spec);
  }

  /** Preview a sound or a recording at a fixed volume (no loop for recordings). */
  async preview(src: string, loop: boolean, volume = 1): Promise<void> {
    this.stop();
    this.main = this.makeSource(src, loop);
    this.main.gain.gain.value = volume;
    await this.play(this.main.el);
  }

  /** Progressive-volume test (spec §70) on any source. */
  async previewFade(src: string, fade: FadeConfig): Promise<void> {
    const spec = fadeSpecFromConfig(fade);
    await this.preview(src, true, spec ? spec.startVolume : 1);
    if (spec && this.main) this.runFade(() => this.main?.gain ?? null, spec);
  }

  /** Crossfade fallback → a recording (spec §36). */
  async crossfadeToRecording(src: string, seconds = 1): Promise<void> {
    const incoming = this.makeSource(src, true);
    incoming.gain.gain.value = 0;
    await this.play(incoming.el);
    const outgoing = this.fallback;
    const start = performance.now();
    return new Promise((resolve) => {
      const step = () => {
        const t = Math.min(1, (performance.now() - start) / (seconds * 1000));
        incoming.gain.gain.value = t;
        if (outgoing) outgoing.gain.gain.value = 1 - t;
        if (t < 1) requestAnimationFrame(step);
        else {
          outgoing?.el.pause();
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
      else target.el.pause();
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

  private async play(el: HTMLAudioElement): Promise<void> {
    try {
      await el.play();
    } catch {
      // Autoplay blocked — caller should have a user gesture; surfaced as a soft failure.
    }
  }

  stop(): void {
    if (this.fadeRaf) cancelAnimationFrame(this.fadeRaf);
    this.fadeRaf = null;
    for (const s of [this.fallback, this.main]) {
      if (s) {
        s.el.pause();
        s.el.src = '';
      }
    }
    this.fallback = null;
    this.main = null;
  }
}
