/**
 * Official times for printable receipts (DD-33): `25 Sep 2026, 10:00:38 (UTC+02:00) Africa/Gaborone`. Receipt times
 * carry seconds so a late receipt never reads as the deadline minute (BR-20, AC-13); deadlines are shown to the minute.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((row) => row.type === type)?.value ?? '';
}

/** `GMT+2`, `GMT+02:00` or `GMT` as `UTC+02:00`. */
function normalizeOffset(raw: string): string {
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

export function formatOfficialInstant(at: string, timeZone: string, withSeconds: boolean): string {
  const date = new Date(at);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const offset = normalizeOffset(
    part(new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' }).formatToParts(date), 'timeZoneName'),
  );
  const month = MONTHS[Number(part(parts, 'month')) - 1] ?? part(parts, 'month');
  const time = `${part(parts, 'hour')}:${part(parts, 'minute')}${withSeconds ? `:${part(parts, 'second')}` : ''}`;
  return `${part(parts, 'day')} ${month} ${part(parts, 'year')}, ${time} (${offset}) ${timeZone}`;
}
