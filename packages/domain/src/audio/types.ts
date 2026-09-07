/**
 * Audio sources an alarm step can play. The alarm never contains a bare
 * `sound = X`; it contains an AudioPlan so sequences (spec §8, §76) can be
 * added later without a schema migration.
 */
export type MusicProviderId = 'spotify' | 'apple_music' | 'youtube_music' | 'local_library';

export type LocalSoundSource = {
  type: 'local';
  soundId: string;
};

export type RecordingSource = {
  type: 'recording';
  recordingId: string;
  /** Denormalised for fast native access; the recordings table stays authoritative. */
  fileUri?: string;
  title?: string;
};

/**
 * Streaming provider content. `provider` keeps Wake provider-agnostic (spec §14);
 * `uri` is the provider's stable identifier (e.g. `spotify:playlist:37i9…`).
 */
export type MusicSource = {
  type: 'music';
  provider: MusicProviderId;
  uri: string;
  title: string;
  subtitle?: string;
  artworkUrl?: string;
};

export type SpotifySource = MusicSource & { provider: 'spotify' };

export type AudioSource = LocalSoundSource | RecordingSource | MusicSource;

export type FadeCurve = 'linear' | 'ease_in' | 'logarithmic';

export type StepFade = {
  from: number;
  to: number;
  durationSeconds: number;
  curve?: FadeCurve;
};

export type AudioStep = {
  id: string;
  source: AudioSource;
  /** Seconds after the alarm fires at which this step starts. */
  startOffsetSeconds: number;
  /** Omit to play until the alarm is stopped or the next step starts. */
  durationSeconds?: number;
  /** Player volume 0..1 for this step. */
  volume?: number;
  fade?: StepFade;
};

export type AudioPlan = {
  /** Schema version for forward-compatible migrations. */
  version: 1;
  mode: 'single' | 'sequence';
  steps: AudioStep[];
};

export const AUDIO_PLAN_VERSION = 1 as const;
