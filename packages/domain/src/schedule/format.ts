import type { Recurrence, Weekday } from '../alarm/types';

export const WEEKDAY_SHORT: Record<Weekday, string> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
};

export function formatTime(hour: number, minute: number, use24h = true): string {
  const mm = String(minute).padStart(2, '0');
  if (use24h) return `${String(hour).padStart(2, '0')}:${mm}`;
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${mm} ${hour < 12 ? 'AM' : 'PM'}`;
}

export function formatRecurrence(recurrence: Recurrence): string {
  if (recurrence.type === 'once') return 'Once';
  const days = [...recurrence.weekdays].sort((a, b) => a - b);
  const set = new Set(days);
  if (days.length === 7) return 'Every day';
  if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d as Weekday))) return 'Weekdays';
  if (days.length === 2 && set.has(0) && set.has(6)) return 'Weekends';
  // Display Monday-first, like the mockups.
  const mondayFirst: Weekday[] = [1, 2, 3, 4, 5, 6, 0];
  return mondayFirst.filter((d) => set.has(d)).map((d) => WEEKDAY_SHORT[d]).join(' ');
}

/** "Tomorrow", "Today", "Mon" — relative label for the next-alarm header. */
export function relativeDayLabel(at: Date, now: Date = new Date()): string {
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOf(at) - startOf(now)) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  return WEEKDAY_SHORT[at.getDay() as Weekday];
}

/** "7h 12m" */
export function formatTimeUntil(at: Date, now: Date = new Date()): string {
  const totalMinutes = Math.max(0, Math.round((at.getTime() - now.getTime()) / 60_000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}
