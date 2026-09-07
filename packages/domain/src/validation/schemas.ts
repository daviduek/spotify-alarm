import { z } from 'zod';

/** Runtime validation for persisted rows and external API responses (spec §61). */

export const WeekdaySchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
]);

export const RecurrenceSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('once') }),
  z.object({ type: z.literal('weekly'), weekdays: z.array(WeekdaySchema).min(1) }),
]);

export const SnoozeConfigSchema = z.object({
  enabled: z.boolean(),
  durationMinutes: z.number().int().min(1).max(120),
  maxSnoozes: z.number().int().min(1).max(20).optional(),
});

export const VibrationConfigSchema = z.object({
  enabled: z.boolean(),
  pattern: z.enum(['default', 'gentle', 'strong']).optional(),
});

export const FadeCurveSchema = z.enum(['linear', 'ease_in', 'logarithmic']);

export const FadeConfigSchema = z.object({
  enabled: z.boolean(),
  durationSeconds: z.number().int().min(0).max(60 * 60),
  initialVolume: z.number().min(0).max(1),
  finalVolume: z.number().min(0).max(1),
  curve: FadeCurveSchema.optional(),
});

export const MusicProviderIdSchema = z.enum(['spotify', 'apple_music', 'youtube_music', 'local_library']);

export const AudioSourceSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('local'), soundId: z.string().min(1) }),
  z.object({
    type: z.literal('recording'),
    recordingId: z.string().min(1),
    fileUri: z.string().optional(),
    title: z.string().optional(),
  }),
  z.object({
    type: z.literal('music'),
    provider: MusicProviderIdSchema,
    uri: z.string().min(1),
    title: z.string(),
    subtitle: z.string().optional(),
    artworkUrl: z.string().optional(),
  }),
]);

export const AudioStepSchema = z.object({
  id: z.string().min(1),
  source: AudioSourceSchema,
  startOffsetSeconds: z.number().min(0),
  durationSeconds: z.number().positive().optional(),
  volume: z.number().min(0).max(1).optional(),
  fade: z
    .object({
      from: z.number().min(0).max(1),
      to: z.number().min(0).max(1),
      durationSeconds: z.number().min(0),
      curve: FadeCurveSchema.optional(),
    })
    .optional(),
});

export const AudioPlanSchema = z.object({
  version: z.literal(1),
  mode: z.enum(['single', 'sequence']),
  steps: z.array(AudioStepSchema).min(1),
});

export const AlarmSchema = z.object({
  id: z.string().min(1),
  name: z.string().max(60),
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
  enabled: z.boolean(),
  recurrence: RecurrenceSchema,
  snooze: SnoozeConfigSchema,
  vibration: VibrationConfigSchema,
  audioPlan: AudioPlanSchema,
  fadeIn: FadeConfigSchema,
  fallbackSoundId: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type AlarmInput = z.input<typeof AlarmSchema>;

// ---------------------------------------------------------------------------
// Spotify Web API responses — only the fields Wake reads.
// ---------------------------------------------------------------------------

export const SpotifyTokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
  expires_in: z.number(),
  refresh_token: z.string().optional(),
  scope: z.string().optional(),
});

export const SpotifyImageSchema = z.object({ url: z.string(), height: z.number().nullable().optional(), width: z.number().nullable().optional() });

export const SpotifyUserSchema = z.object({
  id: z.string(),
  display_name: z.string().nullable().optional(),
  product: z.string().optional(),
  country: z.string().optional(),
});

export const SpotifyPlaylistSchema = z.object({
  id: z.string(),
  uri: z.string(),
  name: z.string(),
  images: z.array(SpotifyImageSchema).nullable().optional(),
  owner: z.object({ display_name: z.string().nullable().optional() }).optional(),
  tracks: z.object({ total: z.number() }).optional(),
});

export const SpotifyPagingSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    items: z.array(item.nullable()),
    next: z.string().nullable().optional(),
    total: z.number().optional(),
  });

export const SpotifyPlaylistPageSchema = SpotifyPagingSchema(SpotifyPlaylistSchema);

export const SpotifyArtistSchema = z.object({ name: z.string() });

export const SpotifyAlbumSchema = z.object({
  id: z.string(),
  uri: z.string(),
  name: z.string(),
  images: z.array(SpotifyImageSchema).optional(),
  artists: z.array(SpotifyArtistSchema).optional(),
});

export const SpotifyTrackSchema = z.object({
  id: z.string(),
  uri: z.string(),
  name: z.string(),
  artists: z.array(SpotifyArtistSchema).optional(),
  album: z.object({ name: z.string(), images: z.array(SpotifyImageSchema).optional() }).optional(),
});

export const SpotifySearchResponseSchema = z.object({
  playlists: SpotifyPagingSchema(SpotifyPlaylistSchema).optional(),
  albums: SpotifyPagingSchema(SpotifyAlbumSchema).optional(),
  tracks: SpotifyPagingSchema(SpotifyTrackSchema).optional(),
});

export const SpotifyDeviceSchema = z.object({
  id: z.string().nullable(),
  is_active: z.boolean(),
  name: z.string(),
  type: z.string(),
  volume_percent: z.number().nullable().optional(),
});

export const SpotifyDevicesResponseSchema = z.object({ devices: z.array(SpotifyDeviceSchema) });

export const SpotifyPlaybackStateSchema = z.object({
  is_playing: z.boolean(),
  progress_ms: z.number().nullable().optional(),
  device: SpotifyDeviceSchema.optional(),
  item: z
    .object({ uri: z.string(), name: z.string(), duration_ms: z.number().optional() })
    .nullable()
    .optional(),
  context: z.object({ uri: z.string() }).nullable().optional(),
});

export const SpotifyErrorSchema = z.object({
  error: z.object({ status: z.number(), message: z.string(), reason: z.string().optional() }),
});
