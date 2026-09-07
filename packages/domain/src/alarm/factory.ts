import { createSinglePlan } from '../audio/plan';
import { DEFAULT_FADE } from '../audio/fade';
import { DEFAULT_FALLBACK_SOUND_ID } from '../audio/sounds';
import type { Alarm, AlarmDraft } from './types';
import { DEFAULT_SNOOZE, DEFAULT_VIBRATION, WORKDAYS } from './types';

export type IdGenerator = () => string;

export function defaultAlarmDraft(overrides: Partial<AlarmDraft> = {}): AlarmDraft {
  return {
    name: 'Alarm',
    hour: 7,
    minute: 0,
    enabled: true,
    recurrence: { type: 'weekly', weekdays: [...WORKDAYS] },
    snooze: { ...DEFAULT_SNOOZE },
    vibration: { ...DEFAULT_VIBRATION },
    audioPlan: createSinglePlan({ type: 'local', soundId: DEFAULT_FALLBACK_SOUND_ID }),
    fadeIn: { ...DEFAULT_FADE },
    fallbackSoundId: DEFAULT_FALLBACK_SOUND_ID,
    ...overrides,
  };
}

export function createAlarm(draft: AlarmDraft, id: string, now: Date = new Date()): Alarm {
  const iso = now.toISOString();
  return { ...draft, id, createdAt: iso, updatedAt: iso };
}

export function touchAlarm(alarm: Alarm, patch: Partial<AlarmDraft>, now: Date = new Date()): Alarm {
  return { ...alarm, ...patch, updatedAt: now.toISOString() };
}
