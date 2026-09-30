/**
 * The application clock: the browser clock corrected by the offset of the server's clock, as reported by every API
 * response (`X-Server-Time` header) and by `/me/context.serverTime` (docs/technical/09-frontend.md §13 rule 7:
 * deadline logic is the server's).
 *
 * In prototype mode the mock API serves the demo storyline clock, so countdowns, "overdue" badges and relative times
 * run from the same "now" as the fixtures and the dashboards' "data as of" footers; against a real API the offset is
 * only the clock skew between the browser and the server. Components read the clock through `useNow()`; event
 * handlers call `clockNow()`. Neither is ever called during render.
 */

type Listener = () => void;

/** Offset changes smaller than this are request latency, not a different clock (no re-render for them). */
const TOLERANCE_MS = 1_000;

let offsetMs = 0;
const listeners = new Set<Listener>();

/** The current instant (epoch milliseconds) on the application clock. */
export function clockNow(): number {
  return Date.now() + offsetMs;
}

/** The current instant on the application clock as a `Date`. */
export function clockDate(): Date {
  return new Date(clockNow());
}

/**
 * Aligns the application clock with the server time of a response received at `receivedAt` (browser epoch
 * milliseconds). An unparsable server time leaves the clock unchanged.
 */
export function syncServerClock(serverTime: string, receivedAt: number = Date.now()): void {
  const serverMs = Date.parse(serverTime);
  if (Number.isNaN(serverMs)) {
    return;
  }
  const next = serverMs - receivedAt;
  if (Math.abs(next - offsetMs) < TOLERANCE_MS) {
    return;
  }
  offsetMs = next;
  for (const listener of listeners) {
    listener();
  }
}

/** Returns the application clock to the browser clock (sign-out, tests). */
export function resetServerClock(): void {
  if (offsetMs === 0) {
    return;
  }
  offsetMs = 0;
  for (const listener of listeners) {
    listener();
  }
}

/** Calls `listener` whenever the clock offset changes; returns the unsubscribe function. */
export function subscribeClock(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
