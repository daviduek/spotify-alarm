import type { FadeConfig } from '../alarm/types';
import type { FadeCurve } from './types';

/**
 * FadeEngine — pure math. No timers live here: the platform layer asks
 * `volumeAt()` on its own clock, or precomputes `fadeSchedule()` and hands the
 * ramp to native code so the JS thread does not need to stay alive (spec §17).
 */
export type FadeSpec = {
  startVolume: number;
  endVolume: number;
  durationSeconds: number;
  curve: FadeCurve;
};

export type FadePoint = { atSeconds: number; volume: number };

export type FadePresetId = 'gentle' | 'normal' | 'strong';

export type FadePreset = {
  id: FadePresetId;
  label: string;
  startVolume: number;
  endVolume: number;
  durationSeconds: number;
};

export const FADE_PRESETS: Record<FadePresetId, FadePreset> = {
  gentle: { id: 'gentle', label: 'Gentle', startVolume: 0.05, endVolume: 0.5, durationSeconds: 5 * 60 },
  normal: { id: 'normal', label: 'Normal', startVolume: 0.1, endVolume: 0.7, durationSeconds: 3 * 60 },
  strong: { id: 'strong', label: 'Strong', startVolume: 0.15, endVolume: 1.0, durationSeconds: 2 * 60 },
};

export const DEFAULT_FADE: FadeConfig = {
  enabled: true,
  durationSeconds: FADE_PRESETS.normal.durationSeconds,
  initialVolume: FADE_PRESETS.normal.startVolume,
  finalVolume: FADE_PRESETS.normal.endVolume,
  curve: 'linear',
};

export function clampVolume(v: number): number {
  if (Number.isNaN(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

/** Maps normalised time t∈[0,1] to progress p∈[0,1] according to the curve. */
export function curveProgress(curve: FadeCurve, t: number): number {
  const x = Math.min(1, Math.max(0, t));
  switch (curve) {
    case 'linear':
      return x;
    case 'ease_in':
      return x * x;
    case 'logarithmic':
      // Perceptually smoother: fast early rise in linear gain ≈ even rise in loudness.
      return Math.log10(1 + 9 * x);
    default:
      return x;
  }
}

export function volumeAt(spec: FadeSpec, elapsedSeconds: number): number {
  const start = clampVolume(spec.startVolume);
  const end = clampVolume(spec.endVolume);
  if (!Number.isFinite(spec.durationSeconds) || spec.durationSeconds <= 0 || elapsedSeconds >= spec.durationSeconds) return end;
  if (elapsedSeconds <= 0) return start;
  const p = curveProgress(spec.curve, elapsedSeconds / spec.durationSeconds);
  return clampVolume(start + (end - start) * p);
}

/**
 * Precomputed ramp for native players. Always includes t=0 and t=duration.
 * `stepSeconds` defaults to 1s; a 5-minute fade is 301 points — trivial to ship
 * across the bridge once and forget.
 */
export function fadeSchedule(spec: FadeSpec, stepSeconds = 1): FadePoint[] {
  const step = stepSeconds > 0 ? stepSeconds : 1;
  const points: FadePoint[] = [];
  if (!Number.isFinite(spec.durationSeconds) || spec.durationSeconds <= 0) {
    return [{ atSeconds: 0, volume: clampVolume(spec.endVolume) }];
  }
  const count = Math.min(Math.ceil(spec.durationSeconds / step), 100_000);
  for (let i = 0; i < count; i++) {
    const t = i * step;
    if (t >= spec.durationSeconds) break;
    points.push({ atSeconds: t, volume: volumeAt(spec, t) });
  }
  points.push({ atSeconds: spec.durationSeconds, volume: clampVolume(spec.endVolume) });
  return points;
}

export function fadeSpecFromConfig(config: FadeConfig): FadeSpec | null {
  if (!config.enabled) return null;
  return {
    startVolume: config.initialVolume,
    endVolume: config.finalVolume,
    durationSeconds: config.durationSeconds,
    curve: config.curve ?? 'linear',
  };
}

export function fadeConfigFromPreset(preset: FadePresetId): FadeConfig {
  const p = FADE_PRESETS[preset];
  return {
    enabled: true,
    durationSeconds: p.durationSeconds,
    initialVolume: p.startVolume,
    finalVolume: p.endVolume,
    curve: 'linear',
  };
}

/** Which preset a config matches, or 'custom'. Used by the editor UI. */
export function fadePresetFor(config: FadeConfig): FadePresetId | 'custom' | 'off' {
  if (!config.enabled) return 'off';
  for (const p of Object.values(FADE_PRESETS)) {
    if (
      approx(p.startVolume, config.initialVolume) &&
      approx(p.endVolume, config.finalVolume) &&
      p.durationSeconds === config.durationSeconds &&
      (config.curve ?? 'linear') === 'linear'
    ) {
      return p.id;
    }
  }
  return 'custom';
}

function approx(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.0001;
}

/** "Progressive · 5 min" / "Off" — for the alarm editor row. */
export function describeFade(config: FadeConfig): string {
  if (!config.enabled) return 'Off';
  const preset = fadePresetFor(config);
  const minutes = Math.round(config.durationSeconds / 60);
  const dur = minutes >= 1 ? `${minutes} min` : `${config.durationSeconds} s`;
  if (preset !== 'custom' && preset !== 'off') return `${FADE_PRESETS[preset].label} · ${dur}`;
  return `Progressive · ${dur}`;
}
