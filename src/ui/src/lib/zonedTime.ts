/**
 * Conversion between a wall-clock date and time in an IANA zone and a UTC instant, with Intl only (no date
 * library). Deadline inputs are entered in the event's OFFICIAL time zone, never the browser's
 * (docs/technical/09-frontend.md §12 "Deadline input").
 */

export interface WallTime {
  /** `YYYY-MM-DD` */
  readonly date: string;
  /** `HH:MM` (24 h) */
  readonly time: string;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

function wallParts(epochMs: number, timeZone: string): Record<string, number> {
  const parts: Record<string, number> = {};
  for (const part of formatterFor(timeZone).formatToParts(new Date(epochMs))) {
    if (part.type !== 'literal') {
      parts[part.type] = Number(part.value);
    }
  }
  return parts;
}

/** The zone's offset from UTC in minutes at an instant (Africa/Gaborone → 120). */
export function zoneOffsetMinutes(epochMs: number, timeZone: string): number {
  const parts = wallParts(epochMs, timeZone);
  const asUtc = Date.UTC(
    parts.year ?? 1970,
    (parts.month ?? 1) - 1,
    parts.day ?? 1,
    parts.hour ?? 0,
    parts.minute ?? 0,
    parts.second ?? 0,
  );
  const truncated = Math.floor(epochMs / 1000) * 1000;
  return Math.round((asUtc - truncated) / 60_000);
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * The UTC instant (`2026-10-14T10:00:00Z`) of a wall time in a zone, or `null` when the input is incomplete.
 * In a DST gap the time is shifted forward by the gap; in an overlap the earlier instant is used.
 */
export function wallTimeToInstant(wall: WallTime, timeZone: string): string | null {
  const dateMatch = DATE_PATTERN.exec(wall.date);
  const timeMatch = TIME_PATTERN.exec(wall.time);
  if (dateMatch === null || timeMatch === null) {
    return null;
  }
  const naive = Date.UTC(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
  );
  let guess = naive - zoneOffsetMinutes(naive, timeZone) * 60_000;
  guess = naive - zoneOffsetMinutes(guess, timeZone) * 60_000;
  return new Date(guess).toISOString().replace('.000Z', 'Z');
}

/** The wall date and time of an instant in a zone. */
export function instantToWallTime(instant: string, timeZone: string): WallTime {
  const parts = wallParts(new Date(instant).getTime(), timeZone);
  const pad = (value: number | undefined): string => String(value ?? 0).padStart(2, '0');
  return {
    date: `${String(parts.year ?? 1970).padStart(4, '0')}-${pad(parts.month)}-${pad(parts.day)}`,
    time: `${pad(parts.hour)}:${pad(parts.minute)}`,
  };
}
