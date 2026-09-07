import { describe, expect, it } from 'vitest';
import {
  FADE_PRESETS,
  describeFade,
  fadeConfigFromPreset,
  fadePresetFor,
  fadeSchedule,
  volumeAt,
  type FadeSpec,
} from '../src';

const spec: FadeSpec = { startVolume: 0.1, endVolume: 0.7, durationSeconds: 300, curve: 'linear' };

describe('FadeEngine', () => {
  it('starts at startVolume and ends at endVolume', () => {
    expect(volumeAt(spec, 0)).toBeCloseTo(0.1);
    expect(volumeAt(spec, 300)).toBeCloseTo(0.7);
    expect(volumeAt(spec, 999)).toBeCloseTo(0.7);
    expect(volumeAt(spec, -5)).toBeCloseTo(0.1);
  });

  it('is linear halfway', () => {
    expect(volumeAt(spec, 150)).toBeCloseTo(0.4);
  });

  it('ease_in is below linear at the midpoint, logarithmic is above', () => {
    expect(volumeAt({ ...spec, curve: 'ease_in' }, 150)).toBeLessThan(0.4);
    expect(volumeAt({ ...spec, curve: 'logarithmic' }, 150)).toBeGreaterThan(0.4);
  });

  it('clamps to 0..1', () => {
    expect(volumeAt({ ...spec, startVolume: -1, endVolume: 5 }, 300)).toBe(1);
    expect(volumeAt({ ...spec, startVolume: -1, endVolume: 5 }, 0)).toBe(0);
  });

  it('builds a schedule including both endpoints', () => {
    const points = fadeSchedule(spec, 60);
    expect(points[0]).toEqual({ atSeconds: 0, volume: 0.1 });
    expect(points.at(-1)).toEqual({ atSeconds: 300, volume: 0.7 });
    expect(points).toHaveLength(6);
  });

  it('zero duration jumps straight to endVolume', () => {
    expect(fadeSchedule({ ...spec, durationSeconds: 0 })).toEqual([{ atSeconds: 0, volume: 0.7 }]);
  });

  it('round-trips presets', () => {
    for (const preset of Object.values(FADE_PRESETS)) {
      expect(fadePresetFor(fadeConfigFromPreset(preset.id))).toBe(preset.id);
    }
    expect(fadePresetFor({ enabled: false, durationSeconds: 0, initialVolume: 0, finalVolume: 1 })).toBe('off');
    expect(fadePresetFor({ enabled: true, durationSeconds: 42, initialVolume: 0.2, finalVolume: 0.9 })).toBe('custom');
  });

  it('describes fades for the editor row', () => {
    expect(describeFade(fadeConfigFromPreset('gentle'))).toBe('Gentle · 5 min');
    expect(describeFade({ enabled: false, durationSeconds: 0, initialVolume: 0, finalVolume: 1 })).toBe('Off');
    expect(describeFade({ enabled: true, durationSeconds: 240, initialVolume: 0.2, finalVolume: 0.9 })).toBe('Progressive · 4 min');
  });
});
