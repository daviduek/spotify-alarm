import type { Recurrence, Weekday } from '../alarm/types';

/** UI locales supported by the shared formatters. Defaults to English everywhere. */
export type FormatLocale = 'en' | 'es';

const WEEKDAY_SHORT_BY_LOCALE: Record<FormatLocale, Record<Weekday, string>> = {
  en: { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' },
  es: { 0: 'Dom', 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb' },
};

const RECURRENCE_LABELS: Record<FormatLocale, { once: string; everyDay: string; weekdays: string; weekends: string }> = {
  en: { once: 'Once', everyDay: 'Every day', weekdays: 'Weekdays', weekends: 'Weekends' },
  es: { once: 'Una vez', everyDay: 'Todos los días', weekdays: 'Días hábiles', weekends: 'Fines de semana' },
};

const DAY_LABELS: Record<FormatLocale, { today: string; tomorrow: string }> = {
  en: { today: 'Today', tomorrow: 'Tomorrow' },
  es: { today: 'Hoy', tomorrow: 'Mañana' },
};

export const WEEKDAY_SHORT: Record<Weekday, string> = WEEKDAY_SHORT_BY_LOCALE.en;

export function weekdayShort(day: Weekday, locale: FormatLocale = 'en'): string {
  return WEEKDAY_SHORT_BY_LOCALE[locale][day];
}

export function formatTime(hour: number, minute: number, use24h = true): string {
  const mm = String(minute).padStart(2, '0');
  if (use24h) return `${String(hour).padStart(2, '0')}:${mm}`;
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${mm} ${hour < 12 ? 'AM' : 'PM'}`;
}

export function formatRecurrence(recurrence: Recurrence, locale: FormatLocale = 'en'): string {
  const labels = RECURRENCE_LABELS[locale];
  if (recurrence.type === 'once') return labels.once;
  const days = [...recurrence.weekdays].sort((a, b) => a - b);
  const set = new Set(days);
  if (days.length === 7) return labels.everyDay;
  if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d as Weekday))) return labels.weekdays;
  if (days.length === 2 && set.has(0) && set.has(6)) return labels.weekends;
  // Display Monday-first, like the mockups.
  const mondayFirst: Weekday[] = [1, 2, 3, 4, 5, 6, 0];
  return mondayFirst.filter((d) => set.has(d)).map((d) => WEEKDAY_SHORT_BY_LOCALE[locale][d]).join(' ');
}

/** "Tomorrow", "Today", "Mon" — relative label for the next-alarm header. */
export function relativeDayLabel(at: Date, now: Date = new Date(), locale: FormatLocale = 'en'): string {
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOf(at) - startOf(now)) / 86_400_000);
  if (diffDays === 0) return DAY_LABELS[locale].today;
  if (diffDays === 1) return DAY_LABELS[locale].tomorrow;
  return WEEKDAY_SHORT_BY_LOCALE[locale][at.getDay() as Weekday];
}

/** "7h 12m" */
export function formatTimeUntil(at: Date, now: Date = new Date()): string {
  const totalMinutes = Math.max(0, Math.round((at.getTime() - now.getTime()) / 60_000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}
