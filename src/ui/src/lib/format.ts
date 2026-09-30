/**
 * Display formatting (docs/technical/09-frontend.md §13, §14; DD-32, DD-33). Pure functions, no date library.
 *
 * - Money is formatted from its decimal STRING with `src/contracts/decimal.ts`; it never passes through a float.
 * - Official times render as `14 Oct 2026, 12:00 (UTC+02:00) Africa/Gaborone`: the IANA zone plus the numeric
 *   offset from Intl. A short abbreviation (CAT) is returned separately, only when Intl provides a real one.
 * - Month names come from the `format.month.*` catalog keys, so the output does not depend on the ICU locale data
 *   (en-GB, for example, writes "Sept").
 * - Functions that depend on the current time take `now` as a parameter: components get it from `useNow()`.
 */
import {
  format as formatDecimal,
  formatMoney as formatMoneyExact,
  formatMoneyCompact,
} from '@contracts/decimal';

import { t } from './i18n';

/** Something that carries an amount and its currency (the contract `Money`). */
export interface MoneyValue {
  readonly amount: string;
  readonly currency: string;
}

export interface MoneyFormatOptions {
  /** `BWP 5.3M` style for KPI cards. */
  readonly compact?: boolean;
  /**
   * Decimal places. `'auto'` (default) shows 2 places only when the amount has a non-zero fraction, as in the
   * reference tables (`BWP 1,500,000`).
   */
  readonly places?: number | 'auto';
}

/** `BWP 1,500,000`, `BWP 1,500,000.50`, or `BWP 5.3M` (compact). `null` renders the em dash. */
export function formatMoney(
  money: MoneyValue | null | undefined,
  options: MoneyFormatOptions = {},
): string {
  if (money === null || money === undefined) {
    return EMPTY_VALUE;
  }
  if (options.compact === true) {
    return formatMoneyCompact(money.amount, money.currency);
  }
  const places = options.places ?? 'auto';
  if (places === 'auto') {
    const fraction = money.amount.split('.')[1] ?? '';
    const hasFraction = /[1-9]/.test(fraction);
    return formatMoneyExact(money.amount, money.currency, { places: hasFraction ? 2 : 0 });
  }
  return formatMoneyExact(money.amount, money.currency, { places });
}

/** A decimal string with grouping, optionally rounded: `formatDecimalString('86.004', 2)` → `86.00`. */
export function formatDecimalString(value: string | null | undefined, places?: number): string {
  if (value === null || value === undefined) {
    return EMPTY_VALUE;
  }
  return places === undefined ? formatDecimal(value) : formatDecimal(value, { places });
}

/** A whole number with grouping: `12500` → `12,500`. */
export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return EMPTY_VALUE;
  }
  return new Intl.NumberFormat('en').format(value);
}

/** A percentage from a decimal string ratio or percent value: `formatPercent('50.0')` → `50.0%`. */
export function formatPercent(value: string | null | undefined, places = 1): string {
  if (value === null || value === undefined) {
    return EMPTY_VALUE;
  }
  return `${formatDecimal(value, { places })}%`;
}

/** The em dash shown for an empty value, as in the reference screenshots. */
export const EMPTY_VALUE = '—';

// ---------------------------------------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------------------------------------

interface ZonedParts {
  readonly year: string;
  readonly month: number;
  readonly day: string;
  readonly hour: string;
  readonly minute: string;
  /** `UTC+02:00`, `UTC-05:30`, `UTC+00:00`. */
  readonly offset: string;
  /** `CAT`, or `null` when Intl only offers a GMT-style name. */
  readonly abbreviation: string | null;
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>();
const offsetFormatters = new Map<string, Intl.DateTimeFormat>();
const abbreviationFormatters = new Map<string, Intl.DateTimeFormat>();

function cached(
  cache: Map<string, Intl.DateTimeFormat>,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  let formatter = cache.get(timeZone);
  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat('en-US', { ...options, timeZone });
    cache.set(timeZone, formatter);
  }
  return formatter;
}

function partValue(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((part) => part.type === type)?.value ?? '';
}

/** Normalizes Intl's `GMT+2`, `GMT+02:00` or `GMT` to `UTC+02:00`. */
export function normalizeOffset(raw: string): string {
  const match = /^(?:GMT|UTC)(?:([+-])(\d{1,2})(?::?(\d{2}))?)?$/.exec(raw.trim());
  if (match === null) {
    return raw;
  }
  const [, sign, hours, minutes] = match;
  if (sign === undefined || hours === undefined) {
    return 'UTC+00:00';
  }
  return `UTC${sign}${hours.padStart(2, '0')}:${(minutes ?? '00').padStart(2, '0')}`;
}

function zonedParts(at: Date, timeZone: string): ZonedParts {
  const parts = cached(partsFormatters, timeZone, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const offsetRaw = partValue(
    cached(offsetFormatters, timeZone, { timeZoneName: 'longOffset' }).formatToParts(at),
    'timeZoneName',
  );
  const shortName = partValue(
    cached(abbreviationFormatters, timeZone, { timeZoneName: 'short' }).formatToParts(at),
    'timeZoneName',
  );
  const abbreviation =
    /^[A-Z]{2,5}$/.test(shortName) && !/^(GMT|UTC)$/.test(shortName) ? shortName : null;
  return {
    year: partValue(parts, 'year'),
    month: Number(partValue(parts, 'month')),
    day: partValue(parts, 'day'),
    hour: partValue(parts, 'hour'),
    minute: partValue(parts, 'minute'),
    offset: normalizeOffset(offsetRaw),
    abbreviation,
  };
}

function monthName(month: number): string {
  return t(`format.month.${month}`);
}

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

/** The browser's IANA zone (for local-time help only; never for official times). */
export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export interface OfficialTimeParts {
  /** `14 Oct 2026, 12:00` */
  readonly dateTime: string;
  /** `UTC+02:00` */
  readonly offset: string;
  /** `Africa/Gaborone` */
  readonly timeZone: string;
  /** `CAT` when Intl provides a real abbreviation, else `null`. */
  readonly abbreviation: string | null;
  /** `14 Oct 2026, 12:00 (UTC+02:00) Africa/Gaborone` */
  readonly text: string;
}

/** The parts of an instant shown in a given official zone (DD-33). */
export function officialTimeParts(at: string | Date, timeZone: string): OfficialTimeParts {
  const parts = zonedParts(toDate(at), timeZone);
  const dateTime = `${parts.day} ${monthName(parts.month)} ${parts.year}, ${parts.hour}:${parts.minute}`;
  return {
    dateTime,
    offset: parts.offset,
    timeZone,
    abbreviation: parts.abbreviation,
    text: `${dateTime} (${parts.offset}) ${timeZone}`,
  };
}

/** `14 Oct 2026, 12:00 (UTC+02:00) Africa/Gaborone` (DD-33). */
export function formatOfficialTime(at: string | Date, timeZone: string): string {
  return officialTimeParts(at, timeZone).text;
}

/** `14 Oct 2026, 12:00` in a zone, without the zone (for secondary timestamps in lists). */
export function formatDateTime(at: string | Date | null | undefined, timeZone: string): string {
  if (at === null || at === undefined) {
    return EMPTY_VALUE;
  }
  return officialTimeParts(at, timeZone).dateTime;
}

/** `14 Oct 2026` for an instant in a zone. */
export function formatInstantDate(at: string | Date | null | undefined, timeZone: string): string {
  if (at === null || at === undefined) {
    return EMPTY_VALUE;
  }
  const parts = zonedParts(toDate(at), timeZone);
  return `${parts.day} ${monthName(parts.month)} ${parts.year}`;
}

/** `14 Oct 2026` for a calendar date `2026-10-14` (no zone involved). */
export function formatCalendarDate(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return EMPTY_VALUE;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) {
    return value;
  }
  const [, year, month, day] = match;
  return `${Number(day)} ${monthName(Number(month))} ${year}`;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Age since an instant, as in the reference tables: `38d`, `5h`, `12m`, or `now`. */
export function formatAge(from: string | Date, now: number): string {
  const elapsed = now - toDate(from).getTime();
  if (elapsed < MINUTE) {
    return t('format.age.now');
  }
  if (elapsed < HOUR) {
    return t('format.age.minutes', { value: Math.floor(elapsed / MINUTE) });
  }
  if (elapsed < DAY) {
    return t('format.age.hours', { value: Math.floor(elapsed / HOUR) });
  }
  return t('format.age.days', { value: Math.floor(elapsed / DAY) });
}

/**
 * A time remaining (or elapsed) in words: `2 days 4 hours left`, `3 hours 5 minutes left`, `closed 2 days ago`.
 * Used only NEXT TO an official time, never on its own (BR-11).
 */
export function formatTimeRemaining(until: string | Date, now: number): string {
  const delta = toDate(until).getTime() - now;
  const magnitude = Math.abs(delta);
  const days = Math.floor(magnitude / DAY);
  const hours = Math.floor((magnitude % DAY) / HOUR);
  const minutes = Math.floor((magnitude % HOUR) / MINUTE);
  let span: string;
  if (days > 0) {
    span = t('format.span.daysHours', { days, hours });
  } else if (hours > 0) {
    span = t('format.span.hoursMinutes', { hours, minutes });
  } else {
    span = t('format.span.minutes', { minutes: Math.max(minutes, delta >= 0 ? 1 : 0) });
  }
  return delta >= 0 ? t('format.remaining.left', { span }) : t('format.remaining.ago', { span });
}

/** `1.2 MB`, `830 KB`, `12 B`. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return t('format.bytes.b', { value: bytes });
  }
  const units = ['kb', 'mb', 'gb'] as const;
  let value = bytes / 1024;
  let unit: (typeof units)[number] = 'kb';
  for (const candidate of units) {
    unit = candidate;
    if (value < 1024 || candidate === 'gb') {
      break;
    }
    value /= 1024;
  }
  const rounded =
    value >= 100 ? Math.round(value).toString() : value.toFixed(1).replace(/\.0$/, '');
  return t(`format.bytes.${unit}`, { value: rounded });
}

/** Initials for an avatar: `Tebogo Moremi` → `TM`. */
export function initialsOf(fullName: string): string {
  const words = fullName
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);
  const first = words[0]?.charAt(0) ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.charAt(0) ?? '') : '';
  return `${first}${last}`.toUpperCase();
}
