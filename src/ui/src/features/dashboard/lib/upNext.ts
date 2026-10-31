/**
 * Pure helpers of the buyer overview (docs/plan/design1 §3): what is up next (approvals and deadlines merged by their
 * due instant, no approval twice), the relative day of an instant in the official zone, the seven days of the week
 * strip, and the tenders at a glance (the nearest deadline per tender). Nothing here invents a date or a count: every
 * figure comes from the dashboard response.
 */
import type { BuyerDashboard, DashboardApproval, DashboardDeadline } from '@contracts/reporting';

import { addCalendarDays, calendarDateOf } from '../../../lib/format';

export type RelativeDay = 'overdue' | 'today' | 'tomorrow' | 'later';

/** Where an instant falls relative to "now" in the official zone (overdue = already passed). */
export function relativeDay(at: string, now: number, timeZone: string): RelativeDay {
  if (new Date(at).getTime() < now) return 'overdue';
  const today = calendarDateOf(new Date(now), timeZone);
  const day = calendarDateOf(at, timeZone);
  if (day === today) return 'today';
  if (day === addCalendarDays(today, 1)) return 'tomorrow';
  return 'later';
}

export type UpNextItem =
  | {
      readonly kind: 'approval';
      readonly id: string;
      readonly due: string | null;
      readonly approval: DashboardApproval;
    }
  | {
      readonly kind: 'deadline';
      readonly id: string;
      readonly due: string;
      readonly deadline: DashboardDeadline;
    };

/** How many rows "Up next" shows; the section links to the full inbox. */
export const UP_NEXT_LIMIT = 5;

function deadlineKey(item: DashboardDeadline): string {
  return `${item.tenderId}-${item.milestone}-${item.lotLabel ?? 'event'}`;
}

/**
 * Approvals (each once) and the deadlines still ahead, ordered by their due instant; approvals without a due date
 * come last. Restricted panels contribute nothing.
 */
export function buildUpNext(data: BuyerDashboard, now: number): UpNextItem[] {
  const items: UpNextItem[] = [];
  const seen = new Set<number>();
  if (!data.approvals.restricted) {
    for (const approval of data.approvals.items) {
      if (seen.has(approval.approvalId)) continue;
      seen.add(approval.approvalId);
      items.push({
        kind: 'approval',
        id: `approval-${approval.approvalId}`,
        due: approval.dueAt,
        approval,
      });
    }
  }
  if (!data.deadlines.restricted) {
    for (const deadline of data.deadlines.items) {
      if (new Date(deadline.deadline.at).getTime() < now) continue;
      items.push({
        kind: 'deadline',
        id: `deadline-${deadlineKey(deadline)}`,
        due: deadline.deadline.at,
        deadline,
      });
    }
  }
  return items.sort((a, b) => {
    if (a.due === null) return b.due === null ? 0 : 1;
    if (b.due === null) return -1;
    return a.due.localeCompare(b.due);
  });
}

/** The number of items that need the user: approvals waiting plus attention exceptions (never double counted). */
export function decisionsNeeded(data: BuyerDashboard): number {
  const approvals = data.approvals.restricted ? 0 : data.approvals.items.length;
  return approvals + data.attention.length;
}

/** True only when the data establishes it: nothing needs attention, no approval is overdue, nothing is missing. */
export function everythingMoving(data: BuyerDashboard): boolean {
  const overdue = !data.approvals.restricted && data.approvals.items.some((item) => item.overdue);
  return data.attention.length === 0 && !overdue && data.completeness.complete;
}

export interface WeekDay {
  readonly date: string;
  readonly day: string;
  /** ISO weekday 1 (Monday) … 7 (Sunday). */
  readonly weekday: number;
  readonly today: boolean;
  /** Deadlines falling on this day (official zone). */
  readonly count: number;
}

/** Today and the six days after it in the official zone, with the number of deadlines on each. */
export function weekDays(
  now: number,
  timeZone: string,
  deadlines: readonly DashboardDeadline[],
): WeekDay[] {
  const today = calendarDateOf(new Date(now), timeZone);
  const counts = new Map<string, number>();
  for (const item of deadlines) {
    const day = calendarDateOf(item.deadline.at, timeZone);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return Array.from({ length: 7 }, (_, offset) => {
    const date = addCalendarDays(today, offset);
    const [year, month, day] = date.split('-').map(Number) as [number, number, number];
    const weekday = ((new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7) + 1;
    return { date, day: String(day), weekday, today: offset === 0, count: counts.get(date) ?? 0 };
  });
}

/** The deadlines still ahead, soonest first (the week column and the glance table). */
export function upcomingDeadlines(
  deadlines: readonly DashboardDeadline[],
  now: number,
): DashboardDeadline[] {
  return deadlines
    .filter((item) => new Date(item.deadline.at).getTime() >= now)
    .sort((a, b) => a.deadline.at.localeCompare(b.deadline.at));
}

/** One row per tender: its nearest deadline still ahead. */
export function tendersAtAGlance(
  deadlines: readonly DashboardDeadline[],
  now: number,
): DashboardDeadline[] {
  const seen = new Set<number>();
  const rows: DashboardDeadline[] = [];
  for (const item of upcomingDeadlines(deadlines, now)) {
    if (seen.has(item.tenderId)) continue;
    seen.add(item.tenderId);
    rows.push(item);
  }
  return rows;
}
