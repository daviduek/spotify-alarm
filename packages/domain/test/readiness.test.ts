import { describe, expect, it } from 'vitest';
import { computeReadiness, createAlarm, createSinglePlan, defaultAlarmDraft, type PermissionSnapshot } from '../src';

const granted: PermissionSnapshot = { alarms: 'granted', notifications: 'granted', fullScreenIntent: 'granted' };
const now = new Date(2026, 8, 7, 22, 0);

describe('computeReadiness', () => {
  it('is ready when scheduled, permitted and fallback exists', () => {
    const alarm = createAlarm(defaultAlarmDraft(), 'a', now);
    const r = computeReadiness({ alarm, permissions: granted, nativeScheduled: true, fallbackSoundAvailable: true });
    expect(r.status).toBe('ready');
    expect(r.headline).toBe('Ready for tomorrow');
    expect(r.issues).toHaveLength(0);
  });

  it('never calls the alarm broken when Spotify is down but fallback is ready', () => {
    const alarm = createAlarm(
      defaultAlarmDraft({
        audioPlan: createSinglePlan({ type: 'music', provider: 'spotify', uri: 'spotify:playlist:x', title: 'Morning' }),
      }),
      'a',
      now,
    );
    const r = computeReadiness({
      alarm,
      permissions: granted,
      nativeScheduled: true,
      fallbackSoundAvailable: true,
      provider: { name: 'Spotify', readiness: 'connection_problem' },
    });
    expect(r.status).toBe('attention');
    expect(r.spotifyReady).toBe(false);
    expect(r.headline).toBe('Spotify unavailable');
    expect(r.detail).toBe('Fallback sound ready');
    expect(r.issues.every((i) => i.severity === 'warning')).toBe(true);
  });

  it('blocks when alarm permission is missing', () => {
    const alarm = createAlarm(defaultAlarmDraft(), 'a', now);
    const r = computeReadiness({
      alarm,
      permissions: { ...granted, alarms: 'denied' },
      nativeScheduled: false,
      fallbackSoundAvailable: true,
    });
    expect(r.status).toBe('blocked');
    expect(r.permissionsReady).toBe(false);
    expect(r.issues[0]?.code).toBe('alarm_permission_missing');
    expect(r.headline).toBe('Needs attention');
  });

  it('blocks when the native schedule is missing for an enabled alarm', () => {
    const alarm = createAlarm(defaultAlarmDraft(), 'a', now);
    const r = computeReadiness({ alarm, permissions: granted, nativeScheduled: false, fallbackSoundAvailable: true });
    expect(r.status).toBe('blocked');
    expect(r.issues.map((i) => i.code)).toContain('native_schedule_missing');
  });

  it('does not report a provider issue when the plan has no provider', () => {
    const alarm = createAlarm(defaultAlarmDraft(), 'a', now);
    const r = computeReadiness({
      alarm,
      permissions: granted,
      nativeScheduled: true,
      fallbackSoundAvailable: true,
      provider: { name: 'Spotify', readiness: 'not_authenticated' },
    });
    expect(r.status).toBe('ready');
    expect(r.spotifyReady).toBeUndefined();
  });
});
