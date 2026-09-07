import type { Alarm, Recurrence, Weekday } from '../alarm/types';

type TimeIntent = Pick<Alarm, 'hour' | 'minute' | 'recurrence'>;

/**
 * Next wall-clock occurrence of an alarm, evaluated in the device's current
 * time zone. Uses the JS Date local-component constructor so DST transitions
 * are resolved by the platform (a non-existent 02:30 on spring-forward day is
 * shifted forward, an ambiguous 01:30 on fall-back day is resolved once).
 *
 * This is used for UI ("Next alarm · Tomorrow") and for reconciliation; native
 * schedulers with recurrence support (AlarmKit relative schedules) receive the
 * weekday intent directly rather than a list of instants (spec §38).
 */
export function nextOccurrence(alarm: TimeIntent, now: Date = new Date()): Date | null {
  for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
    const candidate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + dayOffset,
      alarm.hour,
      alarm.minute,
      0,
      0,
    );
    if (candidate.getTime() <= now.getTime()) continue;
    if (matchesRecurrence(alarm.recurrence, candidate.getDay() as Weekday)) return candidate;
  }
  return null;
}

export function matchesRecurrence(recurrence: Recurrence, weekday: Weekday): boolean {
  if (recurrence.type === 'once') return true;
  return recurrence.weekdays.includes(weekday);
}

/** Next enabled alarm across a list, for the home header. */
export function nextAlarmAmong(alarms: readonly Alarm[], now: Date = new Date()): { alarm: Alarm; at: Date } | null {
  let best: { alarm: Alarm; at: Date } | null = null;
  for (const alarm of alarms) {
    if (!alarm.enabled) continue;
    const at = nextOccurrence(alarm, now);
    if (!at) continue;
    if (!best || at.getTime() < best.at.getTime()) best = { alarm, at };
  }
  return best;
}

export function snoozeUntil(now: Date, minutes: number): Date {
  return new Date(now.getTime() + Math.max(1, minutes) * 60_000);
}
