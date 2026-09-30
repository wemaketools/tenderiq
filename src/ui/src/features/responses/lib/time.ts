/**
 * Official receipt and attempt times to the second (BR-20, AC-13). A deadline is shown to the minute, but a receipt
 * received 38 seconds after it must never read as the same minute without its seconds: every `receivedAt` and
 * `completedAt` renders with seconds and the official offset (DD-33).
 */
import { officialTimeParts } from '../../../lib/format';

function secondsOf(at: string): string {
  return String(new Date(at).getUTCSeconds()).padStart(2, '0');
}

/** `25 Sep 2026, 10:00:38 (UTC+02:00)`: for table cells where the page already names the official zone. */
export function formatReceiptTime(at: string, timeZone: string): string {
  const parts = officialTimeParts(at, timeZone);
  return `${parts.dateTime}:${secondsOf(at)} (${parts.offset})`;
}

/** `25 Sep 2026, 10:00:38 (UTC+02:00) Africa/Gaborone` (DD-33, to the second). */
export function formatOfficialReceiptTime(at: string, timeZone: string): string {
  return `${formatReceiptTime(at, timeZone)} ${timeZone}`;
}
