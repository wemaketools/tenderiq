/** Routes and working-day helpers of the calendar screens (ADM-10). */
import { t } from '../../../lib/i18n';

export const calendarPaths = {
  list: '/buyer/admin/calendars',
  create: '/buyer/admin/calendars/new',
  calendar: (calendarId: number) => `/buyer/admin/calendars/${calendarId}`,
} as const;

/** ISO weekdays 1 (Monday) … 7 (Sunday). */
export const ISO_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

/** Anyone who maintains calendars or picks one for an event may read them (the contract's read permissions). */
export const CALENDAR_READ = ['org.calendars.manage', 'tender.edit', 'tender.view'] as const;

/** "Mon–Fri", "Mon–Sat" or a list such as "Mon, Wed, Fri". */
export function formatWorkingDays(days: readonly number[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (first === undefined || last === undefined) return '—';
  const contiguous = sorted.every((day, index) => day === first + index);
  if (contiguous && sorted.length > 2) {
    return `${t(`calendars.weekday.short.${first}`)}–${t(`calendars.weekday.short.${last}`)}`;
  }
  return sorted.map((day) => t(`calendars.weekday.short.${day}`)).join(', ');
}

/** The ISO weekday (1 = Monday) of a calendar date `YYYY-MM-DD`. */
export function isoWeekday(date: string): number {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

/** True when two working-day lists hold the same days. */
export function sameDays(a: readonly number[], b: readonly number[]): boolean {
  const left = [...a].sort((x, y) => x - y).join(',');
  const right = [...b].sort((x, y) => x - y).join(',');
  return left === right;
}
