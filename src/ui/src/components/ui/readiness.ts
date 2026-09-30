/** Readiness check statuses and the "nothing blocks" rule shared by ReadinessChecklist and its callers. */
export type ReadinessStatus = 'blocking' | 'warning' | 'passed';

/** True when no item blocks the step. */
export function isReady(items: ReadonlyArray<{ readonly status: ReadinessStatus }>): boolean {
  return items.every((item) => item.status !== 'blocking');
}
