/** Calendar helpers of the records workspace. */

/** The UTC calendar date after the instant `now` (milliseconds), as `YYYY-MM-DD`. */
export function tomorrowOf(now: number): string {
  return new Date(now + 86_400_000).toISOString().slice(0, 10);
}
