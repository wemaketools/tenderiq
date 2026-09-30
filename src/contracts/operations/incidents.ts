/**
 * Service incidents and continuity (OPS-05) and platform oversight (OPS-06). Blueprint: `service_incidents`,
 * `service_incident_impacts` (`customer_tenant_id`, DD-04), plus the contract-defined privileged-access reviews and
 * service conduct cases (see `shared.ts`).
 *
 * Rules the contract carries (Stage B enforces them):
 * - The operator records incident timing and affected actions as evidence; the responsible buyer decides any
 *   deadline extension or restart (PRD §19, §20 "Service outage near closing"). Operators never record a buyer
 *   decision on the buyer's behalf: `buyerDecisionNote` is written by the buyer.
 * - Oversight shows aggregate usage and service conduct only; it never exposes confidential procurement content or
 *   enables sealed-bid access (OPS-06).
 * - A privileged-access review is completed by someone other than the person reviewed (BR-07 style SoD,
 *   `SELF_REVIEW_BLOCKED`).
 *
 * Pure module: zod and sibling contract files only.
 */
import { z } from 'zod';

import {
  CalendarDate,
  Id,
  IdParam,
  Instant,
  PersonRef,
  ReasonText,
  Reference,
  issue,
  listQueryWithSort,
  pageOf,
  queryList,
} from '../common.js';
import { defineEndpoint } from '../endpoint.js';
import { SERVICE_INCIDENTS_STATUS, ServiceIncidentsStatus } from '../enums.js';
import {
  AccessReviewOutcome,
  AccessReviewStatus,
  ActivityEntry,
  ConductCaseKind,
  ConductCaseStatus,
  CustomerLabel,
  NoteText,
  ServiceIncidentSeverity,
  bodyText,
  choice,
  optionalText,
  titleText,
} from './shared.js';

// ---------------------------------------------------------------------------------------------------------
// Incidents (OPS-05)
// ---------------------------------------------------------------------------------------------------------

/** One affected customer (and optionally one affected event) of an incident. */
export const IncidentImpact = z.object({
  id: Id,
  customer: CustomerLabel,
  /** The affected event, when the impact concerns one. */
  tenderId: Id.nullable(),
  tenderReference: Reference.nullable(),
  impactNote: z.string().min(1),
  /** The responsible buyer's recorded decision (deadline kept, extended, restarted); `null` while pending. */
  buyerDecisionNote: z.string().nullable(),
});
export type IncidentImpact = z.infer<typeof IncidentImpact>;

/** One row of the incident register. */
export const IncidentRow = z.object({
  id: Id,
  reference: z.string().regex(/^INC-\d{4}-\d{3}$/),
  title: z.string().min(1),
  severity: ServiceIncidentSeverity,
  status: ServiceIncidentsStatus,
  startedAt: Instant,
  resolvedAt: Instant.nullable(),
  affectedCustomers: z.number().int().min(0),
  affectedEvents: z.number().int().min(0),
  pendingBuyerDecisions: z.number().int().min(0),
});
export type IncidentRow = z.infer<typeof IncidentRow>;

export const INCIDENT_SORT_FIELDS = ['startedAt', 'severity', 'status', 'title'] as const;
export const IncidentListQuery = listQueryWithSort(INCIDENT_SORT_FIELDS).extend({
  status: queryList(ServiceIncidentsStatus).optional(),
  severity: queryList(ServiceIncidentSeverity).optional(),
  customerTenantId: IdParam.optional(),
  startedFrom: CalendarDate.optional(),
  startedTo: CalendarDate.optional(),
});
export type IncidentListQuery = z.input<typeof IncidentListQuery>;

/** The incident detail: description, customer notice, impacts and the timing evidence. */
export const IncidentDetail = IncidentRow.extend({
  description: z.string().min(1),
  customerNotice: z.string().nullable(),
  impacts: z.array(IncidentImpact),
  /** Timeline of status updates and notices: the timing evidence buyers rely on. */
  timeline: z.array(ActivityEntry),
  /** Standing reminder: the buyer decides deadlines and restarts. */
  decisionRule: z.string().min(1),
});
export type IncidentDetail = z.infer<typeof IncidentDetail>;

export const IncidentParams = z.object({ incidentId: IdParam });

export const CreateIncidentBody = z.object({
  title: titleText('TITLE_REQUIRED'),
  description: bodyText('DESCRIPTION_REQUIRED', 8000),
  severity: ServiceIncidentSeverity,
  startedAt: Instant,
  customerNotice: optionalText(4000).optional(),
});
export type CreateIncidentBody = z.infer<typeof CreateIncidentBody>;

export const UpdateIncidentBody = z.object({
  status: choice(SERVICE_INCIDENTS_STATUS, 'INVALID_STATUS', 'Choose investigating, identified, monitoring or resolved.'),
  note: bodyText('NOTE_REQUIRED', 4000),
  /** A revised customer notice (published to affected customers). */
  customerNotice: optionalText(4000).optional(),
  /** Required when resolving. */
  resolvedAt: Instant.optional(),
});
export type UpdateIncidentBody = z.infer<typeof UpdateIncidentBody>;

export const AddIncidentImpactBody = z.object({
  customerTenantId: Id,
  tenderReference: z.string({ error: issue('INVALID_REFERENCE', 'Not a reference.') }).pipe(Reference).optional(),
  impactNote: bodyText('IMPACT_NOTE_REQUIRED', 4000),
});
export type AddIncidentImpactBody = z.infer<typeof AddIncidentImpactBody>;

// ---------------------------------------------------------------------------------------------------------
// Oversight (OPS-06)
// ---------------------------------------------------------------------------------------------------------

/** Aggregate usage of one customer (counts only). */
export const UsageRow = z.object({
  customer: CustomerLabel,
  activeUsers: z.number().int().min(0),
  publishedEventsYtd: z.number().int().min(0),
  submissionsReceivedYtd: z.number().int().min(0),
  activeContracts: z.number().int().min(0),
  storageUsedGb: z.string().regex(/^\d+(\.\d{1,2})?$/),
  openSupportCases: z.number().int().min(0),
  lastActivityAt: Instant.nullable(),
});
export type UsageRow = z.infer<typeof UsageRow>;

/** The oversight dashboard. */
export const OversightSummary = z.object({
  asOf: Instant,
  customers: z.object({ buyers: z.number().int().min(0), suppliers: z.number().int().min(0) }),
  activeSupportGrants: z.number().int().min(0),
  supportGrantsLast90Days: z.number().int().min(0),
  accessReviewsDue: z.number().int().min(0),
  openConductCases: z.number().int().min(0),
  openIncidents: z.number().int().min(0),
  usage: z.array(UsageRow),
  /** Standing statement of what oversight never shows. */
  confidentialityNote: z.string().min(1),
});
export type OversightSummary = z.infer<typeof OversightSummary>;

/** One privileged-access review of an operator account or of support-grant use. */
export const AccessReviewRow = z.object({
  id: Id,
  subject: PersonRef,
  capacity: z.string().min(1),
  privileges: z.array(z.string().min(1)),
  /** Support grants the subject used in the last 90 days. */
  grantsLast90Days: z.number().int().min(0),
  status: AccessReviewStatus,
  dueOn: CalendarDate,
  reviewer: PersonRef.nullable(),
  reviewedAt: Instant.nullable(),
  outcome: AccessReviewOutcome.nullable(),
  note: z.string().nullable(),
});
export type AccessReviewRow = z.infer<typeof AccessReviewRow>;

export const AccessReviewListQuery = listQueryWithSort(['dueOn', 'status', 'subject'] as const).extend({
  status: queryList(AccessReviewStatus).optional(),
  subjectUserId: IdParam.optional(),
});
export type AccessReviewListQuery = z.input<typeof AccessReviewListQuery>;

export const AccessReviewParams = z.object({ reviewId: IdParam });

export const CompleteAccessReviewBody = z.object({
  outcome: AccessReviewOutcome,
  note: ReasonText,
});
export type CompleteAccessReviewBody = z.infer<typeof CompleteAccessReviewBody>;

/** A service complaint or misuse case. Content is service metadata only. */
export const ConductCaseRow = z.object({
  id: Id,
  reference: z.string().regex(/^CC-\d{4}-\d{3}$/),
  kind: ConductCaseKind,
  customer: CustomerLabel.nullable(),
  summary: z.string().min(1),
  status: ConductCaseStatus,
  reportedAt: Instant,
  owner: PersonRef.nullable(),
  outcome: z.string().nullable(),
  closedAt: Instant.nullable(),
});
export type ConductCaseRow = z.infer<typeof ConductCaseRow>;

export const ConductCaseListQuery = listQueryWithSort(['reportedAt', 'status', 'kind'] as const).extend({
  kind: queryList(ConductCaseKind).optional(),
  status: queryList(ConductCaseStatus).optional(),
  reportedFrom: CalendarDate.optional(),
  reportedTo: CalendarDate.optional(),
});
export type ConductCaseListQuery = z.input<typeof ConductCaseListQuery>;

export const ConductCaseParams = z.object({ conductCaseId: IdParam });

export const REVIEW_CONDUCT_TARGETS = ['under_review', 'closed'] as const;
export const ReviewConductCaseBody = z.object({
  status: z.enum(REVIEW_CONDUCT_TARGETS, { error: issue('INVALID_STATUS', 'Choose under review or closed.') }),
  note: NoteText.optional(),
  outcome: NoteText.optional(),
});
export type ReviewConductCaseBody = z.infer<typeof ReviewConductCaseBody>;

// ---------------------------------------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------------------------------------

const INCIDENT_READ = ['ops.incidents.manage', 'ops.oversight.view'] as const;

export const listIncidents = defineEndpoint({
  id: 'ops.operations.incidents.list',
  method: 'GET',
  path: '/api/v1/ops/incidents',
  audience: 'ops',
  permission: INCIDENT_READ,
  query: IncidentListQuery,
  response: pageOf(IncidentRow),
  errors: [],
  screens: ['OPS-05'],
});

export const getIncident = defineEndpoint({
  id: 'ops.operations.incidents.get',
  method: 'GET',
  path: '/api/v1/ops/incidents/:incidentId',
  audience: 'ops',
  permission: INCIDENT_READ,
  params: IncidentParams,
  response: IncidentDetail,
  errors: [],
  screens: ['OPS-05'],
});

export const createIncident = defineEndpoint({
  id: 'ops.operations.incidents.create',
  method: 'POST',
  path: '/api/v1/ops/incidents',
  audience: 'ops',
  permission: 'ops.incidents.manage',
  body: CreateIncidentBody,
  response: IncidentDetail,
  idempotent: true,
  errors: ['START_IN_FUTURE'],
  screens: ['OPS-05'],
});

export const updateIncident = defineEndpoint({
  id: 'ops.operations.incidents.update',
  method: 'POST',
  path: '/api/v1/ops/incidents/:incidentId/updates',
  audience: 'ops',
  permission: 'ops.incidents.manage',
  params: IncidentParams,
  body: UpdateIncidentBody,
  response: IncidentDetail,
  errors: ['INCIDENT_ALREADY_RESOLVED', 'RESOLVED_AT_REQUIRED', 'RESOLVED_BEFORE_START'],
  screens: ['OPS-05'],
});

export const addIncidentImpact = defineEndpoint({
  id: 'ops.operations.incidents.addImpact',
  method: 'POST',
  path: '/api/v1/ops/incidents/:incidentId/impacts',
  audience: 'ops',
  permission: 'ops.incidents.manage',
  params: IncidentParams,
  body: AddIncidentImpactBody,
  response: IncidentDetail,
  idempotent: true,
  errors: ['IMPACT_DUPLICATE', 'IMPACT_TENDER_NOT_FOUND'],
  screens: ['OPS-05'],
});

export const getOversightSummary = defineEndpoint({
  id: 'ops.operations.oversight.summary',
  method: 'GET',
  path: '/api/v1/ops/oversight',
  audience: 'ops',
  permission: 'ops.oversight.view',
  response: OversightSummary,
  errors: [],
  screens: ['OPS-06'],
});

export const listAccessReviews = defineEndpoint({
  id: 'ops.operations.accessReviews.list',
  method: 'GET',
  path: '/api/v1/ops/privileged-access-reviews',
  audience: 'ops',
  permission: 'ops.oversight.view',
  query: AccessReviewListQuery,
  response: pageOf(AccessReviewRow),
  errors: [],
  screens: ['OPS-06'],
});

export const completeAccessReview = defineEndpoint({
  id: 'ops.operations.accessReviews.complete',
  method: 'POST',
  path: '/api/v1/ops/privileged-access-reviews/:reviewId/complete',
  audience: 'ops',
  permission: 'ops.oversight.view',
  params: AccessReviewParams,
  body: CompleteAccessReviewBody,
  response: AccessReviewRow,
  errors: ['SELF_REVIEW_BLOCKED', 'REVIEW_ALREADY_COMPLETED'],
  screens: ['OPS-06'],
});

export const listConductCases = defineEndpoint({
  id: 'ops.operations.conductCases.list',
  method: 'GET',
  path: '/api/v1/ops/conduct-cases',
  audience: 'ops',
  permission: 'ops.oversight.view',
  query: ConductCaseListQuery,
  response: pageOf(ConductCaseRow),
  errors: [],
  screens: ['OPS-06'],
});

export const reviewConductCase = defineEndpoint({
  id: 'ops.operations.conductCases.review',
  method: 'POST',
  path: '/api/v1/ops/conduct-cases/:conductCaseId/review',
  audience: 'ops',
  permission: 'ops.oversight.view',
  params: ConductCaseParams,
  body: ReviewConductCaseBody,
  response: ConductCaseRow,
  errors: ['CONDUCT_CASE_CLOSED', 'OUTCOME_REQUIRED'],
  screens: ['OPS-06'],
});

export const incidentRoutes = {
  listIncidents,
  getIncident,
  createIncident,
  updateIncident,
  addIncidentImpact,
  getOversightSummary,
  listAccessReviews,
  completeAccessReview,
  listConductCases,
  reviewConductCase,
} as const;
