/**
 * Procurement plan, calendar, resource demand and advance notices (BUY-05) and their public edition (PUB-06).
 * Blueprint `plan_items`, `advance_notices`; PRD §12.1 BUY-05, §11.2 PUB-06.
 *
 * - A plan item may depend on another one (`depends_on_id`): its planned release cannot precede the dependency's
 *   planned release (`DEPENDENCY_ORDER`), and a chain may not loop (`DEPENDENCY_CYCLE`).
 * - Resource demand is the planned procurement effort (days) per owner and month, compared with a nominal capacity.
 * - Only advance notices of `scheduled` or `in_progress` plan items can be published (`PLAN_ITEM_NOT_SCHEDULED`);
 *   the public sees only published notices of buyers whose portal shows advance notices. A forecast may change and
 *   is never an invitation to submit a bid (PUB-06).
 */
import { z } from 'zod';

import {
  CalendarDate,
  Id,
  IdParam,
  Instant,
  LinkPath,
  Money,
  NonNegativeMoney,
  PersonRef,
  ReasonText,
  Slug,
  TimeZone,
  issue,
  listQueryWithSort,
  pageOf,
  queryList,
} from '../common.js';
import { defineEndpoint } from '../endpoint.js';
import { AdvanceNoticesStatus, PlanItemsStatus, ProcurementRequestsPriority } from '../enums.js';
import {
  AdvanceNoticeRef,
  CodedRef,
  ContractRef,
  PlanItemRef,
  ProjectRef,
  PublicBuyer,
  ReadinessItem,
  RequestRef,
  TenderRef,
  PLAN_READ,
} from './shared.js';

// ---------------------------------------------------------------------------------------------------------
// Plan items
// ---------------------------------------------------------------------------------------------------------

/** A calendar month `YYYY-MM`. */
export const CalendarMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, issue('INVALID_MONTH', 'Use a month such as 2026-10.'));
export type CalendarMonth = z.infer<typeof CalendarMonth>;

/** One plan item row (BUY-05). */
export const PlanItemRow = z.object({
  id: Id,
  title: z.string().min(1),
  project: ProjectRef.nullable(),
  request: RequestRef.nullable(),
  category: CodedRef.nullable(),
  department: CodedRef.nullable(),
  owner: PersonRef.nullable(),
  budgetPeriod: z.string().min(1),
  expectedValue: Money.nullable(),
  plannedReleaseDate: CalendarDate.nullable(),
  plannedAwardDate: CalendarDate.nullable(),
  resourceDemandDays: z.number().int().min(0),
  priority: ProcurementRequestsPriority,
  dependsOn: PlanItemRef.nullable(),
  status: PlanItemsStatus,
  tender: TenderRef.nullable(),
  advanceNotice: AdvanceNoticeRef.nullable(),
  /** A contract whose expiry this item replaces (from the request's `replaces_contract_id`). */
  expiringContract: ContractRef.extend({ expiresOn: CalendarDate }).nullable(),
  /** Scheduling warnings (dependency later than this item, owner over capacity in the release month). */
  warnings: z.array(z.string().min(1)),
});
export type PlanItemRow = z.infer<typeof PlanItemRow>;

export const PlanItemDetail = PlanItemRow.extend({
  dependents: z.array(PlanItemRef),
  advanceNotices: z.array(AdvanceNoticeRef),
  createdAt: Instant,
  updatedAt: Instant,
  allowedActions: z.array(z.enum(['edit', 'schedule', 'defer', 'cancel', 'create_notice'])),
});
export type PlanItemDetail = z.infer<typeof PlanItemDetail>;

export const PLAN_ITEM_SORT_FIELDS = ['title', 'plannedReleaseDate', 'plannedAwardDate', 'expectedValue', 'priority', 'status'] as const;

export const PlanItemListQuery = listQueryWithSort(PLAN_ITEM_SORT_FIELDS).extend({
  status: queryList(PlanItemsStatus).optional(),
  priority: queryList(ProcurementRequestsPriority).optional(),
  ownerUserId: IdParam.optional(),
  categoryId: IdParam.optional(),
  departmentId: IdParam.optional(),
  budgetPeriod: z.string().trim().max(40).optional(),
  releaseFrom: CalendarDate.optional(),
  releaseTo: CalendarDate.optional(),
});
export type PlanItemListQuery = z.input<typeof PlanItemListQuery>;

export const PlanItemPage = pageOf(PlanItemRow);
export type PlanItemPage = z.infer<typeof PlanItemPage>;

const PlanItemFields = z.object({
  title: z.string().trim().min(3, issue('TITLE_TOO_SHORT', 'At least 3 characters.')).max(200),
  projectId: Id.nullable().optional(),
  requestId: Id.nullable().optional(),
  categoryId: Id.nullable().optional(),
  departmentId: Id.nullable().optional(),
  ownerUserId: Id.nullable().optional(),
  budgetPeriod: z.string().trim().min(1, issue('BUDGET_PERIOD_REQUIRED', 'Choose a budget period.')).max(40),
  expectedValue: NonNegativeMoney.nullable().optional(),
  plannedReleaseDate: CalendarDate.nullable().optional(),
  plannedAwardDate: CalendarDate.nullable().optional(),
  resourceDemandDays: z
    .number()
    .int(issue('INVALID_DAYS', 'Use whole days.'))
    .min(0, issue('INVALID_DAYS', 'Cannot be negative.'))
    .max(500, issue('INVALID_DAYS', 'At most 500 days.')),
  priority: ProcurementRequestsPriority.default('normal'),
  dependsOnId: Id.nullable().optional(),
});

function checkPlanDates(body: z.output<typeof PlanItemFields>, ctx: z.RefinementCtx): void {
  const release = body.plannedReleaseDate;
  const award = body.plannedAwardDate;
  if (release !== null && release !== undefined && award !== null && award !== undefined && award < release) {
    ctx.addIssue({
      code: 'custom',
      path: ['plannedAwardDate'],
      message: issue('INVALID_DATE_ORDER', 'The planned award cannot precede the planned release.'),
    });
  }
}

export const CreatePlanItemBody = PlanItemFields.superRefine(checkPlanDates);
export type CreatePlanItemBody = z.input<typeof CreatePlanItemBody>;

/** Schedule, prioritize and allocate owners (BUY-05). `status` moves planned ⇄ scheduled, or to deferred/cancelled. */
export const UpdatePlanItemBody = PlanItemFields.extend({
  status: z.enum(['planned', 'scheduled', 'deferred', 'cancelled']).optional(),
}).superRefine(checkPlanDates);
export type UpdatePlanItemBody = z.input<typeof UpdatePlanItemBody>;

export const PlanItemParams = z.object({ planItemId: IdParam });

// ---------------------------------------------------------------------------------------------------------
// Calendar and resource demand
// ---------------------------------------------------------------------------------------------------------

export const PLAN_CALENDAR_ENTRY_KINDS = [
  'planned_release',
  'planned_award',
  'advance_notice',
  'contract_expiry',
  'renewal_notice',
] as const;
export const PlanCalendarEntryKind = z.enum(PLAN_CALENDAR_ENTRY_KINDS);
export type PlanCalendarEntryKind = z.infer<typeof PlanCalendarEntryKind>;

export const PlanCalendarEntry = z.object({
  id: z.string().min(1),
  date: CalendarDate,
  kind: PlanCalendarEntryKind,
  title: z.string().min(1),
  reference: z.string().nullable(),
  planItemId: Id.nullable(),
  owner: PersonRef.nullable(),
  link: LinkPath.nullable(),
});
export type PlanCalendarEntry = z.infer<typeof PlanCalendarEntry>;

export const OwnerDemand = z.object({
  owner: PersonRef,
  demandDays: z.number().int().min(0),
  capacityDays: z.number().int().min(0),
  overAllocated: z.boolean(),
  itemCount: z.number().int().min(0),
});
export type OwnerDemand = z.infer<typeof OwnerDemand>;

export const PlanCalendarQuery = z.object({
  month: CalendarMonth,
  ownerUserId: IdParam.optional(),
});
export type PlanCalendarQuery = z.input<typeof PlanCalendarQuery>;

/** The month calendar of BUY-05 in the buyer's official time zone. */
export const PlanCalendar = z.object({
  month: CalendarMonth,
  timeZone: TimeZone,
  entries: z.array(PlanCalendarEntry),
  resourceDemand: z.array(OwnerDemand),
  /** Unscheduled items (no planned release date) that the calendar cannot place. */
  unscheduledCount: z.number().int().min(0),
});
export type PlanCalendar = z.infer<typeof PlanCalendar>;

export const ResourceDemandQuery = z
  .object({ from: CalendarMonth, to: CalendarMonth })
  .refine((query) => query.from <= query.to, { path: ['to'], error: issue('INVALID_RANGE', 'The end month cannot precede the start month.') })
  .refine((query) => monthsBetween(query.from, query.to) <= 12, { path: ['to'], error: issue('RANGE_TOO_LONG', 'At most 12 months.') });
export type ResourceDemandQuery = z.input<typeof ResourceDemandQuery>;

/** Number of months from `from` to `to`, both included (`YYYY-MM`). */
export function monthsBetween(from: string, to: string): number {
  const [fromYear = 0, fromMonth = 0] = from.split('-').map(Number);
  const [toYear = 0, toMonth = 0] = to.split('-').map(Number);
  return (toYear - fromYear) * 12 + (toMonth - fromMonth) + 1;
}

export const ResourceDemand = z.object({
  months: z.array(CalendarMonth).min(1),
  owners: z.array(
    z.object({
      owner: PersonRef,
      capacityDaysPerMonth: z.number().int().min(0),
      months: z.array(
        z.object({ month: CalendarMonth, demandDays: z.number().int().min(0), overAllocated: z.boolean() }),
      ),
    }),
  ),
  /** Demand without an owner yet, per month. */
  unassigned: z.array(z.object({ month: CalendarMonth, demandDays: z.number().int().min(0) })),
});
export type ResourceDemand = z.infer<typeof ResourceDemand>;

// ---------------------------------------------------------------------------------------------------------
// Advance notices
// ---------------------------------------------------------------------------------------------------------

export const AdvanceNoticeRow = z.object({
  id: Id,
  title: z.string().min(1),
  summary: z.string().min(1),
  planItem: PlanItemRef,
  category: CodedRef.nullable(),
  indicativeTiming: z.string().min(1),
  estimatedValueBand: z.string().nullable(),
  eoiInstructions: z.string().nullable(),
  status: AdvanceNoticesStatus,
  publishedAt: Instant.nullable(),
  publishedBy: PersonRef.nullable(),
  /** The public page (`/plans/:buyerSlug/:noticeId`) once published. */
  publicPath: LinkPath.nullable(),
  updatedAt: Instant,
});
export type AdvanceNoticeRow = z.infer<typeof AdvanceNoticeRow>;

export const AdvanceNoticeDetail = AdvanceNoticeRow.extend({
  withdrawnReason: z.string().nullable(),
  publishReadiness: z.array(ReadinessItem),
  portalShowsAdvanceNotices: z.boolean(),
  allowedActions: z.array(z.enum(['edit', 'publish', 'withdraw'])),
});
export type AdvanceNoticeDetail = z.infer<typeof AdvanceNoticeDetail>;

export const ADVANCE_NOTICE_SORT_FIELDS = ['title', 'publishedAt', 'status', 'updatedAt'] as const;

export const AdvanceNoticeListQuery = listQueryWithSort(ADVANCE_NOTICE_SORT_FIELDS).extend({
  status: queryList(AdvanceNoticesStatus).optional(),
  categoryId: IdParam.optional(),
});
export type AdvanceNoticeListQuery = z.input<typeof AdvanceNoticeListQuery>;

export const AdvanceNoticePage = pageOf(AdvanceNoticeRow);
export type AdvanceNoticePage = z.infer<typeof AdvanceNoticePage>;

const NoticeText = z.string().trim().max(4000, issue('TEXT_TOO_LONG', 'At most 4000 characters.'));

export const CreateAdvanceNoticeBody = z.object({
  planItemId: Id,
  title: z.string().trim().min(3, issue('TITLE_TOO_SHORT', 'At least 3 characters.')).max(200),
  summary: NoticeText.min(10, issue('SUMMARY_REQUIRED', 'Summarize the planned procurement (at least 10 characters).')),
  categoryId: Id.nullable().optional(),
  indicativeTiming: z.string().trim().min(2, issue('TIMING_REQUIRED', 'State the indicative timing, for example Q1 2027.')).max(100),
  estimatedValueBand: z.string().trim().max(100).nullable().optional(),
  eoiInstructions: NoticeText.nullable().optional(),
});
export type CreateAdvanceNoticeBody = z.input<typeof CreateAdvanceNoticeBody>;

export const UpdateAdvanceNoticeBody = CreateAdvanceNoticeBody.omit({ planItemId: true });
export type UpdateAdvanceNoticeBody = z.input<typeof UpdateAdvanceNoticeBody>;

export const AdvanceNoticeParams = z.object({ noticeId: IdParam });

// ---------------------------------------------------------------------------------------------------------
// Public edition (PUB-06)
// ---------------------------------------------------------------------------------------------------------

export const PublicAdvanceNotice = z.object({
  id: Id,
  buyer: PublicBuyer,
  title: z.string().min(1),
  summary: z.string().min(1),
  category: z.object({ code: z.string().min(1), name: z.string().min(1) }).nullable(),
  indicativeTiming: z.string().min(1),
  estimatedValueBand: z.string().nullable(),
  eoiInstructions: z.string().nullable(),
  /** The plan status the buyer reports (forecasts may change). */
  planStatus: PlanItemsStatus,
  publishedAt: Instant,
  /** `/plans/:buyerSlug/:noticeId`. */
  path: LinkPath,
});
export type PublicAdvanceNotice = z.infer<typeof PublicAdvanceNotice>;

export const PUBLIC_NOTICE_SORT_FIELDS = ['publishedAt', 'title'] as const;

export const PublicAdvanceNoticeQuery = listQueryWithSort(PUBLIC_NOTICE_SORT_FIELDS).extend({
  buyerSlug: Slug.optional(),
  categoryCode: z.string().trim().max(40).optional(),
});
export type PublicAdvanceNoticeQuery = z.input<typeof PublicAdvanceNoticeQuery>;

export const PublicAdvanceNoticePage = pageOf(PublicAdvanceNotice);
export type PublicAdvanceNoticePage = z.infer<typeof PublicAdvanceNoticePage>;

/** The planned categories per buyer, from published notices only. */
export const PublicPlanSummary = z.object({
  buyers: z.array(
    z.object({
      buyer: PublicBuyer,
      noticeCount: z.number().int().min(0),
      categories: z.array(
        z.object({ code: z.string().min(1), name: z.string().min(1), noticeCount: z.number().int().min(1), timings: z.array(z.string()) }),
      ),
      lastPublishedAt: Instant.nullable(),
    }),
  ),
});
export type PublicPlanSummary = z.infer<typeof PublicPlanSummary>;

export const PublicNoticeParams = z.object({ buyerSlug: Slug, noticeId: IdParam });

export const FollowNoticeBody = z.object({
  email: z.email(issue('INVALID_EMAIL', 'Enter a valid email address.')).max(254),
  organizationName: z.string().trim().max(200).nullable().optional(),
});
export type FollowNoticeBody = z.input<typeof FollowNoticeBody>;

export const FollowNoticeResult = z.object({
  noticeId: Id,
  status: z.literal('confirmation_sent'),
  message: z.string().min(1),
});
export type FollowNoticeResult = z.infer<typeof FollowNoticeResult>;

// ---------------------------------------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------------------------------------

/** GET /api/v1/buyer/plan-items (BUY-05). */
export const listPlanItems = defineEndpoint({
  id: 'buyer.planning.list',
  method: 'GET',
  path: '/api/v1/buyer/plan-items',
  audience: 'buyer',
  permission: PLAN_READ,
  query: PlanItemListQuery,
  response: PlanItemPage,
  errors: [],
  screens: ['BUY-05'],
});

/** GET /api/v1/buyer/plan-items/:planItemId (BUY-05). */
export const getPlanItem = defineEndpoint({
  id: 'buyer.planning.get',
  method: 'GET',
  path: '/api/v1/buyer/plan-items/:planItemId',
  audience: 'buyer',
  permission: PLAN_READ,
  params: PlanItemParams,
  response: PlanItemDetail,
  errors: [],
  screens: ['BUY-05'],
});

/** POST /api/v1/buyer/plan-items (BUY-05). */
export const createPlanItem = defineEndpoint({
  id: 'buyer.planning.create',
  method: 'POST',
  path: '/api/v1/buyer/plan-items',
  audience: 'buyer',
  permission: 'plan.manage',
  body: CreatePlanItemBody,
  response: PlanItemDetail,
  idempotent: true,
  errors: ['DEPENDENCY_ORDER', 'REFERENCE_NOT_FOUND', 'OWNER_NOT_ELIGIBLE'],
  screens: ['BUY-05'],
});

/** PUT /api/v1/buyer/plan-items/:planItemId (BUY-05): schedule, prioritize, allocate the owner. */
export const updatePlanItem = defineEndpoint({
  id: 'buyer.planning.update',
  method: 'PUT',
  path: '/api/v1/buyer/plan-items/:planItemId',
  audience: 'buyer',
  permission: 'plan.manage',
  params: PlanItemParams,
  body: UpdatePlanItemBody,
  response: PlanItemDetail,
  errors: ['PLAN_ITEM_LOCKED', 'DEPENDENCY_CYCLE', 'DEPENDENCY_ORDER', 'REFERENCE_NOT_FOUND', 'OWNER_NOT_ELIGIBLE', 'SCHEDULE_DATE_REQUIRED'],
  screens: ['BUY-05'],
});

/** GET /api/v1/buyer/plan-calendar?month=YYYY-MM (BUY-05). */
export const getPlanCalendar = defineEndpoint({
  id: 'buyer.planning.calendar',
  method: 'GET',
  path: '/api/v1/buyer/plan-calendar',
  audience: 'buyer',
  permission: PLAN_READ,
  query: PlanCalendarQuery,
  response: PlanCalendar,
  errors: [],
  screens: ['BUY-05'],
});

/** GET /api/v1/buyer/plan-resource-demand?from=YYYY-MM&to=YYYY-MM (BUY-05). */
export const getResourceDemand = defineEndpoint({
  id: 'buyer.planning.resourceDemand',
  method: 'GET',
  path: '/api/v1/buyer/plan-resource-demand',
  audience: 'buyer',
  permission: PLAN_READ,
  query: ResourceDemandQuery,
  response: ResourceDemand,
  errors: [],
  screens: ['BUY-05'],
});

/** GET /api/v1/buyer/advance-notices (BUY-05). */
export const listAdvanceNotices = defineEndpoint({
  id: 'buyer.planning.notices',
  method: 'GET',
  path: '/api/v1/buyer/advance-notices',
  audience: 'buyer',
  permission: PLAN_READ,
  query: AdvanceNoticeListQuery,
  response: AdvanceNoticePage,
  errors: [],
  screens: ['BUY-05'],
});

/** GET /api/v1/buyer/advance-notices/:noticeId (BUY-05). */
export const getAdvanceNotice = defineEndpoint({
  id: 'buyer.planning.notice',
  method: 'GET',
  path: '/api/v1/buyer/advance-notices/:noticeId',
  audience: 'buyer',
  permission: PLAN_READ,
  params: AdvanceNoticeParams,
  response: AdvanceNoticeDetail,
  errors: [],
  screens: ['BUY-05'],
});

/** POST /api/v1/buyer/advance-notices (BUY-05): a draft notice for a plan item. */
export const createAdvanceNotice = defineEndpoint({
  id: 'buyer.planning.createNotice',
  method: 'POST',
  path: '/api/v1/buyer/advance-notices',
  audience: 'buyer',
  permission: 'plan.manage',
  body: CreateAdvanceNoticeBody,
  response: AdvanceNoticeDetail,
  idempotent: true,
  errors: ['PLAN_ITEM_NOT_ACTIVE', 'NOTICE_EXISTS', 'REFERENCE_NOT_FOUND'],
  screens: ['BUY-05'],
});

/** PUT /api/v1/buyer/advance-notices/:noticeId (BUY-05): edit a draft. */
export const updateAdvanceNotice = defineEndpoint({
  id: 'buyer.planning.updateNotice',
  method: 'PUT',
  path: '/api/v1/buyer/advance-notices/:noticeId',
  audience: 'buyer',
  permission: 'plan.manage',
  params: AdvanceNoticeParams,
  body: UpdateAdvanceNoticeBody,
  response: AdvanceNoticeDetail,
  errors: ['NOTICE_NOT_EDITABLE', 'REFERENCE_NOT_FOUND'],
  screens: ['BUY-05'],
});

/** POST /api/v1/buyer/advance-notices/:noticeId/publish (BUY-05 → PUB-06). */
export const publishAdvanceNotice = defineEndpoint({
  id: 'buyer.planning.publishNotice',
  method: 'POST',
  path: '/api/v1/buyer/advance-notices/:noticeId/publish',
  audience: 'buyer',
  permission: 'plan.manage',
  params: AdvanceNoticeParams,
  response: AdvanceNoticeDetail,
  errors: ['INVALID_TRANSITION', 'NOTICE_INCOMPLETE', 'PLAN_ITEM_NOT_SCHEDULED', 'PORTAL_NOTICES_DISABLED'],
  screens: ['BUY-05'],
});

/** POST /api/v1/buyer/advance-notices/:noticeId/withdraw (BUY-05). */
export const withdrawAdvanceNotice = defineEndpoint({
  id: 'buyer.planning.withdrawNotice',
  method: 'POST',
  path: '/api/v1/buyer/advance-notices/:noticeId/withdraw',
  audience: 'buyer',
  permission: 'plan.manage',
  params: AdvanceNoticeParams,
  body: z.object({ reason: ReasonText }),
  response: AdvanceNoticeDetail,
  errors: ['INVALID_TRANSITION'],
  screens: ['BUY-05'],
});

/** GET /api/v1/public/advance-notices (PUB-06). */
export const listPublicAdvanceNotices = defineEndpoint({
  id: 'public.planning.notices',
  method: 'GET',
  path: '/api/v1/public/advance-notices',
  audience: 'public',
  query: PublicAdvanceNoticeQuery,
  response: PublicAdvanceNoticePage,
  errors: [],
  screens: ['PUB-06'],
  summary: 'Published advance notices only. Forecasts may change and are not invitations to bid.',
});

/** GET /api/v1/public/advance-notices/:buyerSlug/:noticeId (PUB-06). */
export const getPublicAdvanceNotice = defineEndpoint({
  id: 'public.planning.notice',
  method: 'GET',
  path: '/api/v1/public/advance-notices/:buyerSlug/:noticeId',
  audience: 'public',
  params: PublicNoticeParams,
  response: PublicAdvanceNotice,
  errors: [],
  screens: ['PUB-06'],
});

/** GET /api/v1/public/procurement-plans (PUB-06): planned categories per buyer. */
export const getPublicPlanSummary = defineEndpoint({
  id: 'public.planning.summary',
  method: 'GET',
  path: '/api/v1/public/procurement-plans',
  audience: 'public',
  query: z.object({ buyerSlug: Slug.optional() }),
  response: PublicPlanSummary,
  errors: [],
  screens: ['PUB-06'],
});

/** POST /api/v1/public/advance-notices/:buyerSlug/:noticeId/follow (PUB-06): follow a future opportunity by email. */
export const followPublicAdvanceNotice = defineEndpoint({
  id: 'public.planning.follow',
  method: 'POST',
  path: '/api/v1/public/advance-notices/:buyerSlug/:noticeId/follow',
  audience: 'public',
  params: PublicNoticeParams,
  body: FollowNoticeBody,
  response: FollowNoticeResult,
  status: 202,
  errors: ['NOTICE_NOT_AVAILABLE'],
  screens: ['PUB-06'],
  summary: 'Rate limited per IP and email hash (DD-28). A confirmation email is sent; following is not an expression of interest.',
});

/** Reference helper: the public path of a published notice. */
export function publicNoticePath(buyerSlug: string, noticeId: number): string {
  return `/plans/${buyerSlug}/${noticeId}`;
}
