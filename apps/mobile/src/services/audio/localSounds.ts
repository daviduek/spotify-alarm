import { findWakeSound, WAKE_SOUNDS, type WakeSound } from '@wake/domain';

/**
 * Bundled Wake sounds for in-app playback (previews, JS-side alarm screen).
 * Native code plays the same files from the module's resources without JS.
 */
const ASSETS: Record<string, number> = {
  wake_classic: require('../../../assets/sounds/wake_classic.wav'),
  wake_soft: require('../../../assets/sounds/wake_soft.wav'),
  wake_sunrise: require('../../../assets/sounds/wake_sunrise.wav'),
  wake_piano: require('../../../assets/sounds/wake_piano.wav'),
  wake_birds: require('../../../assets/sounds/wake_birds.wav'),
};

export function soundAssetFor(soundId: string): number {
  const sound: WakeSound | undefined = findWakeSound(soundId) ?? WAKE_SOUNDS[0];
  const asset = sound ? ASSETS[sound.file] : undefined;
  return asset ?? ASSETS.wake_classic!;
}

export function soundFileFor(soundId: string): string {
  return findWakeSound(soundId)?.file ?? 'wake_classic';
}
