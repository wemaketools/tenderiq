import { describe, expect, it } from 'vitest';

import {
  EMPTY_VALUE,
  formatAge,
  formatBytes,
  formatCalendarDate,
  formatCount,
  formatDateTime,
  formatDecimalString,
  formatInstantDate,
  formatMoney,
  formatOfficialTime,
  formatPercent,
  formatTimeRemaining,
  initialsOf,
  normalizeOffset,
  officialTimeParts,
} from './format';

describe('formatMoney', () => {
  it('formats a whole amount from its decimal string with the currency and no decimals', () => {
    expect(formatMoney({ amount: '1500000.00', currency: 'BWP' })).toBe('BWP 1,500,000');
  });

  it('keeps two decimals when the amount has a non-zero fraction', () => {
    expect(formatMoney({ amount: '1500000.5', currency: 'BWP' })).toBe('BWP 1,500,000.50');
  });

  it('abbreviates amounts for KPI cards when compact', () => {
    expect(formatMoney({ amount: '5300000', currency: 'BWP' }, { compact: true })).toBe('BWP 5.3M');
  });

  it('renders the em dash for a missing amount', () => {
    expect(formatMoney(null)).toBe(EMPTY_VALUE);
  });

  it('never loses precision beyond the float range', () => {
    expect(formatMoney({ amount: '12345678901234567.89', currency: 'USD' })).toBe(
      'USD 12,345,678,901,234,567.89',
    );
  });
});

describe('number helpers', () => {
  it('formats decimal strings, counts and percentages without floats', () => {
    expect(formatDecimalString('86.004', 2)).toBe('86.00');
    expect(formatDecimalString(null)).toBe(EMPTY_VALUE);
    expect(formatCount(12500)).toBe('12,500');
    expect(formatPercent('50')).toBe('50.0%');
  });
});

describe('official time (DD-33)', () => {
  it('renders the deadline with date, time, UTC offset and IANA zone', () => {
    expect(formatOfficialTime('2026-10-14T10:00:00Z', 'Africa/Gaborone')).toBe(
      '14 Oct 2026, 12:00 (UTC+02:00) Africa/Gaborone',
    );
  });

  it('uses the official zone, not the browser zone, including half-hour offsets', () => {
    expect(formatOfficialTime('2026-10-14T10:00:00Z', 'Asia/Kolkata')).toBe(
      '14 Oct 2026, 15:30 (UTC+05:30) Asia/Kolkata',
    );
  });

  it('reports UTC as UTC+00:00 and exposes a real abbreviation only', () => {
    const utc = officialTimeParts('2026-01-01T00:00:00Z', 'UTC');
    expect(utc.offset).toBe('UTC+00:00');
    expect(utc.abbreviation).toBeNull();
    const newYork = officialTimeParts('2026-01-15T17:00:00Z', 'America/New_York');
    expect(newYork.text).toBe('15 Jan 2026, 12:00 (UTC-05:00) America/New_York');
  });

  it('normalizes the GMT forms Intl produces', () => {
    expect(normalizeOffset('GMT+2')).toBe('UTC+02:00');
    expect(normalizeOffset('GMT-05:30')).toBe('UTC-05:30');
    expect(normalizeOffset('GMT')).toBe('UTC+00:00');
  });

  it('formats secondary timestamps and dates in a zone', () => {
    expect(formatDateTime('2026-09-29T22:30:00Z', 'Africa/Gaborone')).toBe('30 Sep 2026, 00:30');
    expect(formatInstantDate('2026-09-29T22:30:00Z', 'Africa/Gaborone')).toBe('30 Sep 2026');
    expect(formatDateTime(null, 'UTC')).toBe(EMPTY_VALUE);
  });

  it('formats calendar dates without a zone shift', () => {
    expect(formatCalendarDate('2026-10-01')).toBe('1 Oct 2026');
    expect(formatCalendarDate(null)).toBe(EMPTY_VALUE);
  });
});

describe('relative time', () => {
  const now = Date.parse('2026-09-29T12:00:00Z');

  it('shows ages as in the reference tables', () => {
    expect(formatAge('2026-08-22T12:00:00Z', now)).toBe('38d');
    expect(formatAge('2026-09-29T07:00:00Z', now)).toBe('5h');
    expect(formatAge('2026-09-29T11:48:00Z', now)).toBe('12m');
    expect(formatAge('2026-09-29T11:59:30Z', now)).toBe('now');
  });

  it('describes the time left or elapsed next to an official time', () => {
    expect(formatTimeRemaining('2026-10-01T16:00:00Z', now)).toBe('2 d 4 h left');
    expect(formatTimeRemaining('2026-09-29T15:05:00Z', now)).toBe('3 h 5 min left');
    expect(formatTimeRemaining('2026-09-27T12:00:00Z', now)).toBe('passed 2 d 0 h ago');
  });
});

describe('misc', () => {
  it('formats byte sizes and initials', () => {
    expect(formatBytes(12)).toBe('12 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(52_428_800)).toBe('50 MB');
    expect(initialsOf('Tebogo Molefe')).toBe('TM');
    expect(initialsOf('Sam')).toBe('S');
  });
});
