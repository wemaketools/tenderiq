/**
 * The single storyline clock of the demo world (docs/plan/demo-storyline.md, architecture-plan §3.11).
 *
 * Every fixture domain is written "as of" `DEMO_AS_OF`: a record that has happened (created, sent, decided,
 * submitted, read, signed in) carries an instant at or before it, and a deadline, expiry or scheduled event that is
 * still ahead carries one after it. The workspace, org-admin and reporting "as of" values are this instant, and the
 * mock API serves requests on the storyline clock (`storylineNow`), which `/me/context` reports as `serverTime`. The
 * SPA runs its countdowns and relative times from that server time, so a countdown, an "overdue" badge and a "data
 * as of" footer on one screen agree whatever the real clock says.
 *
 * Tuesday 6 October 2026, 10:00 in Africa/Gaborone: the notifications and tasks of 1–5 October have happened, the
 * T-2026-0008 opening (7 Oct) and the T-2026-0007 standstill end (8 Oct) are still ahead, and the C-2026-0001
 * renewal notice window opens in five days (AC-32).
 */

/** The storyline "now" (ISO 8601 UTC, no milliseconds). */
export const DEMO_AS_OF = '2026-10-06T08:00:00Z';

/** The official zone of every demo organization. */
export const DEMO_TIME_ZONE = 'Africa/Gaborone';

/** `DEMO_AS_OF` as a calendar date in the official zone (`DEMO_TIME_ZONE`). */
export const DEMO_AS_OF_DATE = '2026-10-06';

/**
 * The storyline clock at the real instant `now`: never earlier than `DEMO_AS_OF` (the fixtures run to early October,
 * so a real clock before that would show records that have not happened yet), and the real clock once it has
 * passed the storyline.
 */
export function storylineNow(now: Date): Date {
  const asOf = Date.parse(DEMO_AS_OF);
  return now.getTime() >= asOf ? now : new Date(asOf);
}

/** `storylineNow` as an ISO 8601 UTC instant without milliseconds. */
export function storylineInstant(now: Date): string {
  return storylineNow(now).toISOString().replace(/\.\d{3}Z$/, 'Z');
}
