import type { AudioPlan, AudioSource, AudioStep, MusicProviderId } from './types';
import { AUDIO_PLAN_VERSION } from './types';

export function createSinglePlan(source: AudioSource, stepId = 'main'): AudioPlan {
  const step: AudioStep = { id: stepId, source, startOffsetSeconds: 0 };
  return { version: AUDIO_PLAN_VERSION, mode: 'single', steps: [step] };
}

export function createSequencePlan(steps: AudioStep[]): AudioPlan {
  const sorted = [...steps].sort((a, b) => a.startOffsetSeconds - b.startOffsetSeconds);
  return { version: AUDIO_PLAN_VERSION, mode: 'sequence', steps: sorted };
}

export function primarySource(plan: AudioPlan): AudioSource | undefined {
  return plan.steps[0]?.source;
}

export function planIncludesProvider(plan: AudioPlan, provider?: MusicProviderId): boolean {
  return plan.steps.some(
    (s) => s.source.type === 'music' && (provider === undefined || s.source.provider === provider),
  );
}

export function planIncludesRecording(plan: AudioPlan): boolean {
  return plan.steps.some((s) => s.source.type === 'recording');
}

export function planIncludesLocalSound(plan: AudioPlan): boolean {
  return plan.steps.some((s) => s.source.type === 'local');
}

/** Human label for list rows, e.g. "Spotify · Morning playlist". */
export function describeSource(source: AudioSource, soundName?: (id: string) => string | undefined): string {
  switch (source.type) {
    case 'local':
      return soundName?.(source.soundId) ?? source.soundId;
    case 'recording':
      return source.title ? `My recording · ${source.title}` : 'My recording';
    case 'music':
      return `${providerLabel(source.provider)} · ${source.title}`;
  }
}

export function providerLabel(provider: MusicProviderId): string {
  switch (provider) {
    case 'spotify':
      return 'Spotify';
    case 'apple_music':
      return 'Apple Music';
    case 'youtube_music':
      return 'YouTube Music';
    case 'local_library':
      return 'Music library';
  }
}
