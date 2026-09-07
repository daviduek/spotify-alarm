import { describe, expect, it } from 'vitest';
import { formatRecurrence, formatTime, formatTimeUntil, nextAlarmAmong, nextOccurrence, relativeDayLabel, snoozeUntil } from '../src';
import { createAlarm, defaultAlarmDraft } from '../src';

describe('nextOccurrence', () => {
  it('picks today when the time is still ahead', () => {
    const now = new Date(2026, 8, 7, 6, 30); // Monday 2026-09-07 06:30 local
    const at = nextOccurrence({ hour: 7, minute: 0, recurrence: { type: 'once' } }, now);
    expect(at?.getDate()).toBe(7);
    expect(at?.getHours()).toBe(7);
    expect(at?.getMinutes()).toBe(0);
  });

  it('rolls to tomorrow when the time already passed', () => {
    const now = new Date(2026, 8, 7, 7, 0, 1);
    const at = nextOccurrence({ hour: 7, minute: 0, recurrence: { type: 'once' } }, now);
    expect(at?.getDate()).toBe(8);
  });

  it('respects weekday recurrence', () => {
    const friday = new Date(2026, 8, 11, 8, 0); // Friday
    const at = nextOccurrence({ hour: 7, minute: 0, recurrence: { type: 'weekly', weekdays: [1, 2, 3, 4, 5] } }, friday);
    expect(at?.getDay()).toBe(1); // next Monday
    expect(at?.getDate()).toBe(14);
  });

  it('handles a single weekday a week away', () => {
    const monday0701 = new Date(2026, 8, 7, 7, 1);
    const at = nextOccurrence({ hour: 7, minute: 0, recurrence: { type: 'weekly', weekdays: [1] } }, monday0701);
    expect(at?.getDate()).toBe(14);
  });

  it('returns null for an empty weekday set', () => {
    expect(nextOccurrence({ hour: 7, minute: 0, recurrence: { type: 'weekly', weekdays: [] } }, new Date())).toBeNull();
  });

  it('keeps wall-clock intent across a month boundary', () => {
    const now = new Date(2026, 8, 30, 23, 59);
    const at = nextOccurrence({ hour: 0, minute: 5, recurrence: { type: 'once' } }, now);
    expect(at?.getMonth()).toBe(9);
    expect(at?.getDate()).toBe(1);
    expect(at?.getHours()).toBe(0);
    expect(at?.getMinutes()).toBe(5);
  });
});

describe('nextAlarmAmong / snooze / formatting', () => {
  it('finds the soonest enabled alarm', () => {
    const now = new Date(2026, 8, 7, 6, 0);
    const a = createAlarm(defaultAlarmDraft({ hour: 8, minute: 0 }), 'a', now);
    const b = createAlarm(defaultAlarmDraft({ hour: 6, minute: 30 }), 'b', now);
    const c = createAlarm(defaultAlarmDraft({ hour: 6, minute: 5, enabled: false }), 'c', now);
    expect(nextAlarmAmong([a, b, c], now)?.alarm.id).toBe('b');
  });

  it('snoozes N minutes', () => {
    const now = new Date(2026, 8, 7, 7, 0);
    expect(snoozeUntil(now, 10).getMinutes()).toBe(10);
  });

  it('formats time and recurrence', () => {
    expect(formatTime(7, 5)).toBe('07:05');
    expect(formatTime(19, 5, false)).toBe('7:05 PM');
    expect(formatTime(0, 0, false)).toBe('12:00 AM');
    expect(formatRecurrence({ type: 'weekly', weekdays: [1, 2, 3, 4, 5] })).toBe('Weekdays');
    expect(formatRecurrence({ type: 'weekly', weekdays: [0, 6] })).toBe('Weekends');
    expect(formatRecurrence({ type: 'weekly', weekdays: [0, 1, 2, 3, 4, 5, 6] })).toBe('Every day');
    expect(formatRecurrence({ type: 'weekly', weekdays: [0, 3] })).toBe('Wed Sun');
    expect(formatRecurrence({ type: 'once' })).toBe('Once');
  });

  it('labels relative days and durations', () => {
    const now = new Date(2026, 8, 7, 23, 48);
    const at = new Date(2026, 8, 8, 7, 0);
    expect(relativeDayLabel(at, now)).toBe('Tomorrow');
    expect(relativeDayLabel(now, now)).toBe('Today');
    expect(formatTimeUntil(at, now)).toBe('7h 12m');
  });
});
