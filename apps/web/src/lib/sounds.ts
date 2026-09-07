import { WAKE_SOUNDS, findWakeSound } from '@wake/domain';

/** Public URL for a bundled sound (copied to /public/sounds by the build). */
export function soundUrl(soundId: string): string {
  const sound = findWakeSound(soundId) ?? WAKE_SOUNDS[0];
  return `/sounds/${sound?.file ?? 'wake_classic'}.wav`;
}
