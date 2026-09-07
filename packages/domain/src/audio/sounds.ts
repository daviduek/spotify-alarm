/**
 * Catalogue of bundled Wake sounds. The asset files live in apps/mobile/assets/sounds
 * (Android: also copied to res/raw by the config plugin; iOS: bundle resources).
 * Only the ids are shared here so the domain stays platform-free.
 */
export type WakeSound = {
  id: string;
  name: string;
  /** File name without extension; the same base name is used on both platforms. */
  file: string;
  /** Rough character for UI hints. */
  intensity: 'soft' | 'medium' | 'strong';
};

export const WAKE_SOUNDS: readonly WakeSound[] = [
  { id: 'sunrise', name: 'Sunrise', file: 'wake_sunrise', intensity: 'soft' },
  { id: 'soft', name: 'Soft', file: 'wake_soft', intensity: 'soft' },
  { id: 'piano', name: 'Soft Piano', file: 'wake_piano', intensity: 'medium' },
  { id: 'birds', name: 'Birds', file: 'wake_birds', intensity: 'medium' },
  { id: 'classic', name: 'Classic Alarm', file: 'wake_classic', intensity: 'strong' },
];

export const DEFAULT_FALLBACK_SOUND_ID = 'classic';

export function findWakeSound(id: string): WakeSound | undefined {
  return WAKE_SOUNDS.find((s) => s.id === id);
}

export function wakeSoundName(id: string): string | undefined {
  return findWakeSound(id)?.name;
}
