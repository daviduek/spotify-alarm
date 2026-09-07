import { describe, expect, it } from 'vitest';
import { computeReadiness, createAlarm, createSinglePlan, curveProgress, defaultAlarmDraft, fadeSchedule, nextOccurrence, RecurrenceSchema, volumeAt, type FadeCurve } from '../src';

describe('nextOccurrence guards (audit 2026-09)', () => {
  it('returns null for out-of-range or non-integer times instead of Invalid Date', () => {
    const now = new Date(2026, 8, 7, 6, 30);
    expect(nextOccurrence({ hour: 25, minute: 0, recurrence: { type: 'once' } }, now)).toBeNull();
    expect(nextOccurrence({ hour: NaN, minute: 0, recurrence: { type: 'once' } }, now)).toBeNull();
    expect(nextOccurrence({ hour: 7, minute: 60, recurrence: { type: 'once' } }, now)).toBeNull();
    expect(nextOccurrence({ hour: 7, minute: 0, recurrence: { type: 'once' } }, new Date(NaN))).toBeNull();
  });

  it('an alarm exactly at "now" rolls to the next day', () => {
    const now = new Date(2026, 8, 7, 7, 0, 0, 0);
    const at = nextOccurrence({ hour: 7, minute: 0, recurrence: { type: 'once' } }, now);
    expect(at?.getDate()).toBe(8);
  });

  it('23:59:59.999 → 00:00 next day', () => {
    const now = new Date(2026, 8, 7, 23, 59, 59, 999);
    const at = nextOccurrence({ hour: 0, minute: 0, recurrence: { type: 'weekly', weekdays: [0, 1, 2, 3, 4, 5, 6] } }, now);
    expect(at?.getDate()).toBe(8);
    expect(at?.getHours()).toBe(0);
  });

  it('crosses the year boundary', () => {
    const now = new Date(2026, 11, 31, 23, 30);
    const at = nextOccurrence({ hour: 7, minute: 0, recurrence: { type: 'once' } }, now);
    expect(at?.getFullYear()).toBe(2027);
    expect(at?.getMonth()).toBe(0);
    expect(at?.getDate()).toBe(1);
  });
});

describe('fade robustness', () => {
  it('unknown curve degrades to linear, never NaN/silent', () => {
    expect(curveProgress('bogus' as FadeCurve, 0.5)).toBe(0.5);
    const v = volumeAt({ startVolume: 0.1, endVolume: 1, durationSeconds: 60, curve: 'bogus' as FadeCurve }, 30);
    expect(v).toBeGreaterThan(0.1);
    expect(v).toBeLessThan(1);
  });

  it('NaN duration jumps to endVolume and yields a single-point schedule', () => {
    const spec = { startVolume: 0.1, endVolume: 0.8, durationSeconds: NaN, curve: 'linear' as const };
    expect(volumeAt(spec, 10)).toBe(0.8);
    expect(fadeSchedule(spec)).toEqual([{ atSeconds: 0, volume: 0.8 }]);
  });

  it('schedule uses exact multiples of the step (no float drift) and is monotonic', () => {
    const pts = fadeSchedule({ startVolume: 0, endVolume: 1, durationSeconds: 10, curve: 'logarithmic' }, 0.1);
    expect(pts[3].atSeconds).toBeCloseTo(0.3, 12);
    for (let i = 1; i < pts.length; i++) expect(pts[i].volume).toBeGreaterThanOrEqual(pts[i - 1].volume);
    expect(pts[pts.length - 1]).toEqual({ atSeconds: 10, volume: 1 });
  });

  it('decreasing fades stay monotonic and clamped', () => {
    const spec = { startVolume: 1, endVolume: 0.2, durationSeconds: 5, curve: 'ease_in' as const };
    let prev = 1;
    for (let t = 0; t <= 5; t += 0.5) {
      const v = volumeAt(spec, t);
      expect(v).toBeLessThanOrEqual(prev);
      expect(v).toBeGreaterThanOrEqual(0.2);
      prev = v;
    }
  });
});

describe('validation', () => {
  it('rejects duplicate weekdays', () => {
    expect(RecurrenceSchema.safeParse({ type: 'weekly', weekdays: [1, 1, 2] }).success).toBe(false);
    expect(RecurrenceSchema.safeParse({ type: 'weekly', weekdays: [1, 2] }).success).toBe(true);
  });
});

describe('readiness never claims "ready" blindly', () => {
  const base = createAlarm({ ...defaultAlarmDraft(), name: 'Test' }, 'alarm-1');
  const permissions = { alarms: 'granted' as const, notifications: 'granted' as const, fullScreenIntent: 'granted' as const };

  it('flags a music plan whose provider was not checked', () => {
    const alarm = { ...base, audioPlan: createSinglePlan({ type: 'music', provider: 'spotify', uri: 'spotify:playlist:x', title: 'x' }) };
    const r = computeReadiness({ alarm, permissions, nativeScheduled: true, fallbackSoundAvailable: true });
    expect(r.status).not.toBe('ready');
    expect(r.issues.some((i) => i.code === 'provider_unknown')).toBe(true);
  });

  it('flags a recording plan whose file availability is unknown', () => {
    const alarm = { ...base, audioPlan: createSinglePlan({ type: 'recording', recordingId: 'r1', title: 'me' }) };
    const r = computeReadiness({ alarm, permissions, nativeScheduled: true, fallbackSoundAvailable: true });
    expect(r.issues.some((i) => i.code === 'recording_file_missing')).toBe(true);
  });
});
