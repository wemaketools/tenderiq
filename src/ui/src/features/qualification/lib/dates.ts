/**
 * Calendar-date helpers. Decision dates are calendar dates in the buyer's official time zone; "today" comes from
 * `useNow()` (never `Date.now()` during render).
 */

/** The calendar date (`YYYY-MM-DD`) of an epoch millisecond value in an IANA time zone. */
export function calendarDateIn(epochMs: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(epochMs));
  const part = (type: 'year' | 'month' | 'day'): string =>
    parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Adds whole days to a `YYYY-MM-DD` calendar date. */
export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
