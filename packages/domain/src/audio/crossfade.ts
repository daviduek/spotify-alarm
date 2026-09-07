import { clampVolume } from './fade';

/**
 * Fallback → provider transition (spec §36). Pure: returns both volumes at a
 * given elapsed time so the platform layer can drive two players from one clock.
 */
export type CrossfadeSpec = {
  durationSeconds: number;
  /** Where the incoming player should land (the alarm's current effective volume). */
  targetVolume: number;
};

export const DEFAULT_CROSSFADE_SECONDS = 1;

export function crossfadeAt(spec: CrossfadeSpec, elapsedSeconds: number): { outgoing: number; incoming: number } {
  if (spec.durationSeconds <= 0) return { outgoing: 0, incoming: clampVolume(spec.targetVolume) };
  const t = Math.min(1, Math.max(0, elapsedSeconds / spec.durationSeconds));
  return {
    outgoing: clampVolume(spec.targetVolume * (1 - t)),
    incoming: clampVolume(spec.targetVolume * t),
  };
}
