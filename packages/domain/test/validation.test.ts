import { describe, expect, it } from 'vitest';
import { AlarmSchema, AudioPlanSchema, SpotifyPlaylistPageSchema, createAlarm, defaultAlarmDraft, redact, createLogger, resolveFlags } from '../src';

describe('schemas', () => {
  it('accepts a default alarm and rejects bad hours', () => {
    const alarm = createAlarm(defaultAlarmDraft(), 'id-1');
    expect(AlarmSchema.safeParse(alarm).success).toBe(true);
    expect(AlarmSchema.safeParse({ ...alarm, hour: 24 }).success).toBe(false);
    expect(AlarmSchema.safeParse({ ...alarm, recurrence: { type: 'weekly', weekdays: [] } }).success).toBe(false);
  });

  it('rejects an empty audio plan and unknown source types', () => {
    expect(AudioPlanSchema.safeParse({ version: 1, mode: 'single', steps: [] }).success).toBe(false);
    expect(
      AudioPlanSchema.safeParse({ version: 1, mode: 'single', steps: [{ id: 's', source: { type: 'nope' }, startOffsetSeconds: 0 }] })
        .success,
    ).toBe(false);
  });

  it('parses a Spotify playlist page with null items (Spotify does that)', () => {
    const parsed = SpotifyPlaylistPageSchema.safeParse({
      items: [null, { id: '1', uri: 'spotify:playlist:1', name: 'Morning', images: null }],
      next: null,
    });
    expect(parsed.success).toBe(true);
  });
});

describe('logger', () => {
  it('redacts sensitive keys recursively', () => {
    expect(redact({ access_token: 'abc', nested: { refreshToken: 'x', ok: 1 }, alarmId: 'a' })).toEqual({
      access_token: '[redacted]',
      nested: { refreshToken: '[redacted]', ok: 1 },
      alarmId: 'a',
    });
  });

  it('emits structured records', () => {
    const records: unknown[] = [];
    const log = createLogger((r) => records.push(r), () => new Date(0));
    log.info('alarm_scheduled', { alarmId: 'a', Authorization: 'Bearer x' });
    expect(records[0]).toEqual({
      level: 'info',
      event: 'alarm_scheduled',
      data: { alarmId: 'a', Authorization: '[redacted]' },
      at: '1970-01-01T00:00:00.000Z',
    });
  });
});

describe('flags', () => {
  it('resolves overrides from strings and booleans', () => {
    const f = resolveFlags({ spotify_enabled: 'false', cloud_sync_enabled: true, alarm_sequences_enabled: 'garbage' });
    expect(f.spotify_enabled).toBe(false);
    expect(f.cloud_sync_enabled).toBe(true);
    expect(f.alarm_sequences_enabled).toBe(false);
  });
});
