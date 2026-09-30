/**
 * Shared helpers of the planning feature (BUY-05, PUB-06): paths, permissions, month arithmetic for the plan
 * calendar, business error messages and the next required action of plan items and advance notices (PRD §19).
 */
import { PLAN_READ } from '@contracts/requests';
import type { AdvanceNoticeDetail, PlanItemDetail, UpdatePlanItemBody } from '@contracts/requests';
import { enumValues } from '@contracts/enums';
import type { EnumName } from '@contracts/enums';

import { ApiError } from '../../api/client';
import { hasTranslation, t, tEnum } from '../../lib/i18n';

export { PLAN_READ };

export const PLANNING_BASE = '/buyer/planning';

export const planningPaths = {
  plan: PLANNING_BASE,
  newItem: `${PLANNING_BASE}/items/new`,
  item: (id: number) => `${PLANNING_BASE}/items/${id}`,
  editItem: (id: number) => `${PLANNING_BASE}/items/${id}/edit`,
  newNotice: (planItemId?: number) =>
    planItemId === undefined
      ? `${PLANNING_BASE}/notices/new`
      : `${PLANNING_BASE}/notices/new?planItemId=${planItemId}`,
  notice: (id: number) => `${PLANNING_BASE}/notices/${id}`,
  request: (id: number) => `/buyer/requests/${id}`,
  contract: (id: number) => `/buyer/contracts/${id}`,
  publicPlans: '/plans',
  publicNotice: (buyerSlug: string, noticeId: number) => `/plans/${buyerSlug}/${noticeId}`,
};

/** Select options of an enumeration, labelled through the catalogs. */
export function enumOptions<N extends EnumName>(name: N, only?: readonly string[]) {
  const values: readonly string[] = enumValues(name);
  return values
    .filter((value) => only === undefined || only.includes(value))
    .map((value) => ({ value, label: tEnum(name, value) }));
}

/** A declared error code explained through the planning catalog; anything else keeps the server's detail. */
export function explainError(error: ApiError | null): ApiError | null {
  if (error === null || error.code === null) {
    return error;
  }
  const key = `planning.errors.${error.code}`;
  if (!hasTranslation(key)) {
    return error;
  }
  return new ApiError({
    // A refused business rule (403 AUTHORITY_EXCEEDED, SELF_APPROVAL_BLOCKED…) is shown with its explanation:
    // the shared error text for `forbidden` would only say "restricted", hiding the rule that applied.
    kind: error.kind === 'forbidden' ? 'conflict' : error.kind,
    status: error.status,
    title: error.title,
    code: error.code,
    detail: t(key),
    fieldErrors: error.fieldErrors,
    correlationId: error.correlationId,
    endpointId: error.endpointId,
  });
}

// ---------------------------------------------------------------------------------------------------------
// Months (`YYYY-MM`)
// ---------------------------------------------------------------------------------------------------------

/** The calendar month of an instant in an IANA zone, `YYYY-MM`. */
export function monthOf(now: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date(now));
  const year = parts.find((part) => part.type === 'year')?.value ?? '2026';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  return `${year}-${month}`;
}

/** `YYYY-MM` shifted by `delta` months. */
export function addMonths(month: string, delta: number): string {
  const [year = 2026, index = 1] = month.split('-').map(Number);
  const total = year * 12 + (index - 1) + delta;
  const nextYear = Math.floor(total / 12);
  const nextMonth = (total % 12) + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
}

/** "October 2026". */
export function monthLabel(month: string): string {
  const [year = 2026, index = 1] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, index - 1, 1)));
}

/** "Oct 26". */
export function shortMonthLabel(month: string): string {
  const [year = 2026, index = 1] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, index - 1, 1)));
}

/** The weeks of a month (Monday first) as `YYYY-MM-DD` dates, `null` for days outside the month. */
export function monthWeeks(month: string): (string | null)[][] {
  const [year = 2026, index = 1] = month.split('-').map(Number);
  const first = new Date(Date.UTC(year, index - 1, 1));
  const days = new Date(Date.UTC(year, index, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const cells: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_, day) => `${month}-${String(day + 1).padStart(2, '0')}`),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let start = 0; start < cells.length; start += 7) {
    weeks.push(cells.slice(start, start + 7));
  }
  return weeks;
}

/** Monday-first weekday names ("Mon" … "Sun"). */
export function weekdayNames(): string[] {
  return Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' }).format(
      new Date(Date.UTC(2026, 0, 5 + index)),
    ),
  );
}

// ---------------------------------------------------------------------------------------------------------
// Next required action (PRD §19)
// ---------------------------------------------------------------------------------------------------------

export function planItemNextAction(item: PlanItemDetail): string {
  if (item.warnings.length > 0 && (item.status === 'planned' || item.status === 'scheduled')) {
    return t('planning.next.resolveWarnings');
  }
  switch (item.status) {
    case 'planned':
      return item.owner === null ? t('planning.next.allocateOwner') : t('planning.next.schedule');
    case 'scheduled':
      return item.advanceNotice === null && item.allowedActions.includes('create_notice')
        ? t('planning.next.notice')
        : t('planning.next.release');
    case 'in_progress':
      return t('planning.next.inProgress');
    default:
      return t('planning.next.none');
  }
}

export function noticeNextAction(notice: AdvanceNoticeDetail): string {
  switch (notice.status) {
    case 'draft':
      if (!notice.portalShowsAdvanceNotices) return t('planning.next.portalDisabled');
      return notice.publishReadiness.some((item) => item.status === 'blocking')
        ? t('planning.next.completeNotice')
        : t('planning.next.publish');
    case 'published':
      return t('planning.next.published');
    default:
      return t('planning.next.none');
  }
}

/** The full update body of an item with a new status (the API replaces the item). */
export function updateBodyOf(
  item: PlanItemDetail,
  status: UpdatePlanItemBody['status'],
): UpdatePlanItemBody {
  return {
    title: item.title,
    projectId: item.project?.id ?? null,
    requestId: item.request?.id ?? null,
    categoryId: item.category?.id ?? null,
    departmentId: item.department?.id ?? null,
    ownerUserId: item.owner?.userId ?? null,
    budgetPeriod: item.budgetPeriod,
    expectedValue: item.expectedValue,
    plannedReleaseDate: item.plannedReleaseDate,
    plannedAwardDate: item.plannedAwardDate,
    resourceDemandDays: item.resourceDemandDays,
    priority: item.priority,
    dependsOnId: item.dependsOn?.id ?? null,
    status,
  };
}
