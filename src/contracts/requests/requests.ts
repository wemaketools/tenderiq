/**
 * Procurement requests: the register (BUY-02), the request and business case (BUY-03) and the request and funding
 * decision (BUY-04). PRD FR-04, §8.1, BR-06, BR-07, BR-10; blueprint `procurement_requests`, `request_links`,
 * `request_info_requests`.
 *
 * - Field names mirror the blueprint columns in camelCase (`problem_statement` → `problemStatement`).
 * - Visibility: `request.view_all` sees every submitted request of the tenant; `request.create` alone sees only the
 *   requests where the caller is requester, sponsor, owner or budget owner. A `draft` is visible only to those
 *   parties. Another tenant's request is `NOT_FOUND`.
 * - Funding distinguishes `indicative`, `approved_budget` and `firm_commitment` (FR-04). Approval needs at least an
 *   approved budget (`FUNDING_NOT_CONFIRMED`).
 * - The approval route and the authority check use the whole contemplated commitment (`valueBasis.approvalValue`):
 *   the larger of `estimatedTotalCommitment` (options, renewals, associated purchases) and `estimatedValue`.
 * - Combining keeps the original requests (status `closed`, `combinedInto` set, requesters and funding preserved);
 *   the approval route uses the sum of every original's total commitment. Splitting never hides the overall
 *   value: the parts must add up to the original estimate and the value used for the approval route stays the
 *   original's (`SplitResult.policyValue`).
 * - The decision checks the caller's delegated authority (BR-06, AC-05): above the limit the answer is
 *   `AUTHORITY_EXCEEDED` and the view names the higher route. The requester cannot approve their own request
 *   (`SELF_APPROVAL_BLOCKED`, SoD rule `requester_vs_request_approval`, BR-07).
 * - A material change to an approved request invalidates the approval (BR-10): `reapprovalRequired` is true and
 *   the request goes back to `under_review`.
 */
import { z } from 'zod';

import { ApprovalDecision, AuthorityCheck, ContentHash, EligibleApprover } from '../approvals.js';
import { CustomFieldValues } from '../policy/shared.js';
import {
  ActorRef,
  CalendarDate,
  Id,
  IdParam,
  Instant,
  LinkPath,
  Money,
  NonNegativeMoney,
  PersonRef,
  QueryBoolean,
  ReasonText,
  Reference,
  issue,
  listQueryWithSort,
  pageOf,
  queryList,
} from '../common.js';
import { defineEndpoint } from '../endpoint.js';
import {
  ApprovalRequestsStatus,
  AuthorityLimitsDecisionType,
  FundingSourcesSourceType,
  ProcurementRequestsFundingStatus,
  ProcurementRequestsNeedType,
  ProcurementRequestsPriority,
  ProcurementRequestsStatus,
  RequestInfoRequestsStatus,
  RequestLinksLinkType,
} from '../enums.js';
import {
  CodedRef,
  ContractRef,
  NamedRef,
  PlanItemRef,
  ProjectRef,
  ReadinessItem,
  RequestAction,
  RequestRef,
  StrategyRef,
  SupplierRef,
  TenderRef,
  OPTIONS_READ,
  REQUEST_READ,
} from './shared.js';

// ---------------------------------------------------------------------------------------------------------
// Rows and details
// ---------------------------------------------------------------------------------------------------------

/** One row of the request register (BUY-02). */
export const RequestRow = z.object({
  id: Id,
  reference: Reference,
  title: z.string().min(1),
  /** The purpose shown in the register: the problem statement. */
  problemStatement: z.string().nullable(),
  requester: PersonRef,
  owner: PersonRef.nullable(),
  category: CodedRef.nullable(),
  department: CodedRef.nullable(),
  estimatedValue: Money.nullable(),
  estimatedTotalCommitment: Money.nullable(),
  fundingStatus: ProcurementRequestsFundingStatus,
  priority: ProcurementRequestsPriority,
  status: ProcurementRequestsStatus,
  needType: ProcurementRequestsNeedType,
  targetDate: CalendarDate.nullable(),
  submittedAt: Instant.nullable(),
  /** Whole days since submission (or creation for a draft) until the decision or now. */
  ageDays: z.number().int().min(0),
  revision: z.number().int().min(1),
  reapprovalRequired: z.boolean(),
  combinedInto: RequestRef.nullable(),
  deferredUntil: CalendarDate.nullable(),
  createdAt: Instant,
  updatedAt: Instant,
});
export type RequestRow = z.infer<typeof RequestRow>;

/** A link between requests (`request_links`), seen from the request being shown. */
export const RequestLink = z.object({
  id: Id,
  linkType: RequestLinksLinkType,
  /** `outgoing`: this request is `from_request_id`; `incoming`: it is `to_request_id`. */
  direction: z.enum(['outgoing', 'incoming']),
  request: RequestRef,
  requester: PersonRef,
  estimatedValue: Money.nullable(),
  fundingStatus: ProcurementRequestsFundingStatus,
  note: z.string().nullable(),
});
export type RequestLink = z.infer<typeof RequestLink>;

/** A request for more information (`request_info_requests`). */
export const InfoRequest = z.object({
  id: Id,
  question: z.string().min(1),
  requestedBy: PersonRef,
  requestedAt: Instant,
  dueAt: Instant.nullable(),
  responseText: z.string().nullable(),
  respondedBy: PersonRef.nullable(),
  respondedAt: Instant.nullable(),
  status: RequestInfoRequestsStatus,
});
export type InfoRequest = z.infer<typeof InfoRequest>;

/** One revision of the business case (from the audit trail). */
export const RequestRevision = z.object({
  revision: z.number().int().min(1),
  createdAt: Instant,
  createdBy: PersonRef,
  changeSummary: z.string().min(1),
  changedFields: z.array(z.string()),
  material: z.boolean(),
});
export type RequestRevision = z.infer<typeof RequestRevision>;

/** A material change after approval (BR-10). */
export const MaterialChange = z.object({
  approvedRevision: z.number().int().min(1),
  currentRevision: z.number().int().min(1),
  changedFields: z.array(z.string()).min(1),
  detectedAt: Instant,
  approvalInvalidated: z.boolean(),
});
export type MaterialChange = z.infer<typeof MaterialChange>;

/**
 * Which figure the approval route uses: the estimate alone (`own_value`), the total contemplated commitment when it
 * exceeds the estimate (`total_commitment`), and the same two for a combined request (`aggregate_value`,
 * `aggregate_commitment`: the sum over every original).
 */
export const ApprovalValueBasis = z.enum(['own_value', 'total_commitment', 'aggregate_value', 'aggregate_commitment']);
export type ApprovalValueBasis = z.infer<typeof ApprovalValueBasis>;

/** The value used for the approval route (FR-04: options, lots and associated purchases stay visible). */
export const RequestValueBasis = z.object({
  ownValue: Money.nullable(),
  /** Sum of the estimated values of this request and every request combined into it; `null` when nothing was combined. */
  combinedValue: Money.nullable(),
  totalCommitment: Money.nullable(),
  /**
   * The value the approval route and authority check use: the whole contemplated commitment (the larger of the total
   * commitment and the estimate), summed over the originals when combined; never a split part alone.
   */
  approvalValue: Money.nullable(),
  basis: ApprovalValueBasis,
  explanation: z.string().min(1),
});
export type RequestValueBasis = z.infer<typeof RequestValueBasis>;

/** Kinds of entries in a request's decision history (final decisions and escalations). */
export const RequestDecisionKind = z.enum(['approve', 'approve_with_conditions', 'reject', 'return', 'defer', 'rescind', 'escalate', 'route_to_contract']);
export type RequestDecisionKind = z.infer<typeof RequestDecisionKind>;

/** The recorded outcome of the latest final decision, and the latest history entry of any kind (an escalation too). */
export const RequestDecisionRecord = z.object({
  decidedAt: Instant.nullable(),
  decisionReason: z.string().nullable(),
  deferredUntil: CalendarDate.nullable(),
  latest: z
    .object({
      decision: RequestDecisionKind,
      decidedBy: ActorRef,
      decidedAt: Instant,
      reason: z.string().min(1),
    })
    .nullable(),
  /**
   * The approver the open decision waits on when that is someone other than the caller (the request was routed or
   * escalated above the caller's authority, AC-05); `null` when no approval is pending or the caller is the approver.
   */
  awaitingDecisionFrom: PersonRef.nullable(),
});
export type RequestDecisionRecord = z.infer<typeof RequestDecisionRecord>;

/** The request and business case (BUY-03): every FR-04 field. */
export const RequestDetail = RequestRow.extend({
  sponsor: PersonRef.nullable(),
  budgetOwner: PersonRef.nullable(),
  legalEntity: NamedRef.nullable(),
  costCenter: CodedRef.nullable(),
  fundingSource: CodedRef.nullable(),
  project: ProjectRef.nullable(),
  expectedOutcomes: z.string().nullable(),
  scopeDescription: z.string().nullable(),
  quantities: z.string().nullable(),
  deliveryLocations: z.string().nullable(),
  constraints: z.string().nullable(),
  stakeholders: z.string().nullable(),
  consequenceOfDelay: z.string().nullable(),
  risks: z.string().nullable(),
  replacesContract: ContractRef.nullable(),
  estimationBasis: z.string().nullable(),
  accountingReference: z.string().nullable(),
  contractTermMonths: z.number().int().min(1).nullable(),
  renewalOptions: z.string().nullable(),
  routedContract: ContractRef.nullable(),
  convertedTender: TenderRef.nullable(),
  planItem: PlanItemRef.nullable(),
  strategy: StrategyRef.nullable(),
  decision: RequestDecisionRecord,
  links: z.array(RequestLink),
  infoRequests: z.array(InfoRequest),
  revisions: z.array(RequestRevision).min(1),
  materialChange: MaterialChange.nullable(),
  valueBasis: RequestValueBasis,
  submissionReadiness: z.array(ReadinessItem),
  /** Actions the caller may take now (no dead buttons). */
  allowedActions: z.array(RequestAction),
  /** `/buyer/tenders/new?fromRequest=ID` when the request is approved and the caller may create tenders. */
  createTenderPath: LinkPath.nullable(),
  approvalId: Id.nullable(),
  /** The organization's additional business fields of the request form (ADM-07); absent when none are recorded. */
  customFields: CustomFieldValues.optional(),
});
export type RequestDetail = z.infer<typeof RequestDetail>;

// ---------------------------------------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------------------------------------

export const REQUEST_SORT_FIELDS = [
  'reference',
  'title',
  'submittedAt',
  'estimatedValue',
  'priority',
  'status',
  'targetDate',
  'ageDays',
] as const;

export const RequestListQuery = listQueryWithSort(REQUEST_SORT_FIELDS).extend({
  status: queryList(ProcurementRequestsStatus).optional(),
  priority: queryList(ProcurementRequestsPriority).optional(),
  fundingStatus: queryList(ProcurementRequestsFundingStatus).optional(),
  ownerUserId: IdParam.optional(),
  requesterUserId: IdParam.optional(),
  categoryId: IdParam.optional(),
  departmentId: IdParam.optional(),
  /** Only requests where the caller is requester, sponsor, owner or budget owner. */
  mine: QueryBoolean.optional(),
  /** Only requests without an owner (to assign). */
  unassigned: QueryBoolean.optional(),
  submittedFrom: CalendarDate.optional(),
  submittedTo: CalendarDate.optional(),
  targetFrom: CalendarDate.optional(),
  targetTo: CalendarDate.optional(),
});
export type RequestListQuery = z.input<typeof RequestListQuery>;

export const RequestPage = pageOf(RequestRow);
export type RequestPage = z.infer<typeof RequestPage>;

/** Register KPIs over the requests the caller may see (BR-43: totals count only visible rows). */
export const RequestSummary = z.object({
  byStatus: z.array(z.object({ status: ProcurementRequestsStatus, count: z.number().int().min(0) })),
  openCount: z.number().int().min(0),
  unassignedCount: z.number().int().min(0),
  awaitingMyDecisionCount: z.number().int().min(0),
  openInfoRequestCount: z.number().int().min(0),
  reapprovalRequiredCount: z.number().int().min(0),
  /** Estimated value of open requests, per currency. */
  openEstimatedValue: z.array(Money),
});
export type RequestSummary = z.infer<typeof RequestSummary>;

// ---------------------------------------------------------------------------------------------------------
// Form options
// ---------------------------------------------------------------------------------------------------------

export const FundingSourceOption = CodedRef.extend({ sourceType: FundingSourcesSourceType });
export const DepartmentOption = CodedRef.extend({ legalEntityId: Id.nullable() });
export const CategoryOption = CodedRef.extend({ parentId: Id.nullable() });
export const CostCenterOption = CodedRef.extend({ departmentId: Id.nullable() });
export const PersonOption = PersonRef.extend({
  capacity: z.string().nullable(),
  /** What the person can be chosen as. */
  roles: z.array(z.enum(['requester', 'owner', 'sponsor', 'budget_owner', 'plan_owner'])).min(1),
});
export const ContractOption = ContractRef.extend({ expiresOn: CalendarDate.nullable() });

/** Everything the request, plan and strategy forms offer (organization structure, people, projects, suppliers). */
export const RequestOptions = z.object({
  legalEntities: z.array(NamedRef),
  departments: z.array(DepartmentOption),
  categories: z.array(CategoryOption),
  costCenters: z.array(CostCenterOption),
  fundingSources: z.array(FundingSourceOption),
  projects: z.array(ProjectRef),
  people: z.array(PersonOption),
  contracts: z.array(ContractOption),
  suppliers: z.array(SupplierRef),
  currencies: z.array(z.string().regex(/^[A-Z]{3}$/)).min(1),
  budgetPeriods: z.array(z.string().min(1)).min(1),
});
export type RequestOptions = z.infer<typeof RequestOptions>;

// ---------------------------------------------------------------------------------------------------------
// Bodies
// ---------------------------------------------------------------------------------------------------------

const LongText = z.string().trim().max(8000, issue('TEXT_TOO_LONG', 'At most 8000 characters.'));
const OptionalText = LongText.nullable().optional();

/**
 * The business case (FR-04). A draft may be incomplete: only the title is required, and `submissionReadiness`
 * lists what is missing before submission (`REQUEST_INCOMPLETE`).
 */
export const BusinessCaseFields = z.object({
    title: z
      .string()
      .trim()
      .min(3, issue('TITLE_TOO_SHORT', 'At least 3 characters.'))
      .max(200, issue('TITLE_TOO_LONG', 'At most 200 characters.')),
    problemStatement: OptionalText,
    expectedOutcomes: OptionalText,
    scopeDescription: OptionalText,
    quantities: OptionalText,
    deliveryLocations: OptionalText,
    targetDate: CalendarDate.nullable().optional(),
    constraints: OptionalText,
    stakeholders: OptionalText,
    consequenceOfDelay: OptionalText,
    risks: OptionalText,
    needType: ProcurementRequestsNeedType,
    replacesContractId: Id.nullable().optional(),
    legalEntityId: Id.nullable().optional(),
    departmentId: Id.nullable().optional(),
    categoryId: Id.nullable().optional(),
    costCenterId: Id.nullable().optional(),
    fundingSourceId: Id.nullable().optional(),
    projectId: Id.nullable().optional(),
    sponsorUserId: Id.nullable().optional(),
    budgetOwnerUserId: Id.nullable().optional(),
    estimatedValue: NonNegativeMoney.nullable().optional(),
    estimationBasis: OptionalText,
    accountingReference: z.string().trim().max(100, issue('TEXT_TOO_LONG', 'At most 100 characters.')).nullable().optional(),
    contractTermMonths: z
      .number()
      .int(issue('INVALID_TERM', 'Use whole months.'))
      .min(1, issue('INVALID_TERM', 'At least 1 month.'))
      .max(240, issue('INVALID_TERM', 'At most 240 months.'))
      .nullable()
      .optional(),
    renewalOptions: OptionalText,
    estimatedTotalCommitment: NonNegativeMoney.nullable().optional(),
    fundingStatus: ProcurementRequestsFundingStatus.default('none'),
    priority: ProcurementRequestsPriority.default('normal'),
    /**
     * Values of the organization's additional business fields (ADM-07), keyed by field key. A save rejects values of
     * the wrong type (`customFields.<key>`); required fields are checked on submission (`REQUEST_INCOMPLETE`).
     * Omitted: the stored values stay unchanged.
     */
    customFields: CustomFieldValues.optional(),
});

function checkBusinessCase(body: z.output<typeof BusinessCaseFields>, ctx: z.RefinementCtx): void {
    if (body.needType !== 'new_expenditure' && (body.replacesContractId === null || body.replacesContractId === undefined)) {
      ctx.addIssue({
        code: 'custom',
        path: ['replacesContractId'],
        message: issue('REPLACED_CONTRACT_REQUIRED', 'Name the contract this request replaces or extends.'),
      });
    }
    const value = body.estimatedValue;
    const total = body.estimatedTotalCommitment;
    if (value !== null && value !== undefined && total !== null && total !== undefined && value.currency !== total.currency) {
      ctx.addIssue({
        code: 'custom',
        path: ['estimatedTotalCommitment', 'currency'],
        message: issue('CURRENCY_MISMATCH', 'Use the same currency as the estimated value.'),
      });
    }
}

export const BusinessCaseBody = BusinessCaseFields.superRefine(checkBusinessCase);
export type BusinessCaseBody = z.input<typeof BusinessCaseBody>;

export const UpdateRequestBody = BusinessCaseFields.extend({
  expectedRevision: z.number().int().min(1, issue('INVALID_REVISION', 'Must be a revision number.')),
}).superRefine(checkBusinessCase);
export type UpdateRequestBody = z.input<typeof UpdateRequestBody>;

/** The outcome of an edit: the change assessment says whether it was material (BR-10). */
export const RequestChangeAssessment = z.object({
  revision: z.number().int().min(1),
  changedFields: z.array(z.string()),
  material: z.boolean(),
  reapprovalRequired: z.boolean(),
  message: z.string().min(1),
});
export type RequestChangeAssessment = z.infer<typeof RequestChangeAssessment>;

export const RequestUpdateResult = z.object({
  request: RequestDetail,
  changeAssessment: RequestChangeAssessment,
});
export type RequestUpdateResult = z.infer<typeof RequestUpdateResult>;

export const RevisionBody = z.object({
  expectedRevision: z.number().int().min(1, issue('INVALID_REVISION', 'Must be a revision number.')),
});
export type RevisionBody = z.input<typeof RevisionBody>;

export const ReasonBody = z.object({ reason: ReasonText });
export type ReasonBody = z.input<typeof ReasonBody>;

export const AssignRequestBody = z.object({
  ownerUserId: Id,
  note: z.string().trim().max(2000, issue('TEXT_TOO_LONG', 'At most 2000 characters.')).nullable().optional(),
});
export type AssignRequestBody = z.input<typeof AssignRequestBody>;

export const RequestInfoBody = z.object({
  question: z.string().trim().min(5, issue('QUESTION_REQUIRED', 'Ask a question of at least 5 characters.')).max(4000),
  dueAt: Instant.nullable().optional(),
});
export type RequestInfoBody = z.input<typeof RequestInfoBody>;

export const RespondInfoBody = z.object({
  responseText: z.string().trim().min(1, issue('RESPONSE_REQUIRED', 'A response is required.')).max(8000),
  /** Resubmit the request with the response (information_requested → submitted). */
  resubmit: z.boolean().default(true),
});
export type RespondInfoBody = z.input<typeof RespondInfoBody>;

export const CombineRequestsBody = z.object({
  sourceRequestIds: z
    .array(Id)
    .min(1, issue('COMBINE_SOURCE_REQUIRED', 'Choose at least one request to combine.'))
    .max(10, issue('COMBINE_TOO_MANY', 'At most 10 requests at once.'))
    .refine((ids) => new Set(ids).size === ids.length, issue('DUPLICATE_REQUEST', 'Each request may appear once.')),
  reason: ReasonText,
});
export type CombineRequestsBody = z.input<typeof CombineRequestsBody>;

export const CombineResult = z.object({
  request: RequestDetail,
  combined: z.array(RequestRef).min(1),
  aggregateValue: Money,
  /** Whether the aggregate value moves the request to a higher approval level. */
  approvalRouteChanged: z.boolean(),
  eligibleApprovers: z.array(EligibleApprover),
});
export type CombineResult = z.infer<typeof CombineResult>;

export const SplitPartBody = z.object({
  title: z.string().trim().min(3, issue('TITLE_TOO_SHORT', 'At least 3 characters.')).max(200),
  scopeDescription: z.string().trim().min(1, issue('SCOPE_REQUIRED', 'Describe the scope of this part.')).max(8000),
  estimatedValue: NonNegativeMoney,
});

export const SplitRequestBody = z.object({
  parts: z.array(SplitPartBody).min(2, issue('SPLIT_TOO_FEW', 'A split needs at least two parts.')).max(10),
  justification: ReasonText,
});
export type SplitRequestBody = z.input<typeof SplitRequestBody>;

export const SplitResult = z.object({
  request: RequestDetail,
  parts: z.array(RequestRef.extend({ estimatedValue: Money })).min(2),
  /** The overall value still used for the approved procurement policy (FR-04). */
  policyValue: Money,
});
export type SplitResult = z.infer<typeof SplitResult>;

export const DeferRequestBody = z.object({
  deferredUntil: CalendarDate,
  reason: ReasonText,
});
export type DeferRequestBody = z.input<typeof DeferRequestBody>;

export const RouteToContractBody = z.object({
  contractId: Id,
  reason: ReasonText,
});
export type RouteToContractBody = z.input<typeof RouteToContractBody>;

/** A contract the request could be routed to, with the eligibility verdict. */
export const RoutingOption = ContractRef.extend({
  supplier: SupplierRef,
  category: CodedRef.nullable(),
  status: z.string().min(1),
  expiresOn: CalendarDate.nullable(),
  ceiling: Money.nullable(),
  remainingCeiling: Money.nullable(),
  eligible: z.boolean(),
  reasons: z.array(z.string().min(1)),
});
export type RoutingOption = z.infer<typeof RoutingOption>;

export const RoutingOptions = z.object({
  requestId: Id,
  requestValue: Money.nullable(),
  options: z.array(RoutingOption),
});
export type RoutingOptions = z.infer<typeof RoutingOptions>;

// ---------------------------------------------------------------------------------------------------------
// Funding and decision (BUY-04)
// ---------------------------------------------------------------------------------------------------------

export const REQUEST_COMMENT_KINDS = ['review', 'funding', 'decision', 'requester'] as const;
export const RequestCommentKind = z.enum(REQUEST_COMMENT_KINDS);

export const RequestComment = z.object({
  id: Id,
  author: ActorRef,
  kind: RequestCommentKind,
  text: z.string().min(1),
  createdAt: Instant,
});
export type RequestComment = z.infer<typeof RequestComment>;

export const FundingConfirmation = z.object({
  status: ProcurementRequestsFundingStatus,
  fundingSource: CodedRef.nullable(),
  budgetOwner: PersonRef.nullable(),
  confirmedAmount: Money.nullable(),
  confirmedBy: PersonRef.nullable(),
  confirmedAt: Instant.nullable(),
  accountingReference: z.string().nullable(),
  note: z.string().nullable(),
  /** Whether the funding status is enough to approve the request (approved budget or firm commitment). */
  sufficientForApproval: z.boolean(),
});
export type FundingConfirmation = z.infer<typeof FundingConfirmation>;

export const ApprovedVersion = z.object({
  revision: z.number().int().min(1),
  contentHash: ContentHash,
  approvedAt: Instant,
  approvedBy: ActorRef,
  conditions: z.string().nullable(),
  approvedValue: Money.nullable(),
});
export type ApprovedVersion = z.infer<typeof ApprovedVersion>;

export const DecisionHistoryEntry = z.object({
  id: Id,
  decision: RequestDecisionKind,
  decidedBy: ActorRef,
  decidedAt: Instant,
  revision: z.number().int().min(1),
  reason: z.string().min(1),
});
export type DecisionHistoryEntry = z.infer<typeof DecisionHistoryEntry>;

export const ApprovalRouteState = z.object({
  approvalId: Id.nullable(),
  status: ApprovalRequestsStatus.nullable(),
  currentApprover: PersonRef.nullable(),
  requestedAt: Instant.nullable(),
  dueAt: Instant.nullable(),
});
export type ApprovalRouteState = z.infer<typeof ApprovalRouteState>;

/** Everything BUY-04 shows: requested authority, the caller's authority check, the route, funding and history. */
export const RequestDecisionView = z.object({
  request: RequestRow,
  subjectRevision: z.number().int().min(1),
  contentHash: ContentHash,
  requestedAuthority: z.object({
    decisionType: AuthorityLimitsDecisionType,
    amount: Money.nullable(),
    basis: ApprovalValueBasis,
    explanation: z.string().min(1),
  }),
  /** The caller's authority for `request_approval`; `null` when the caller cannot decide requests. */
  callerAuthority: AuthorityCheck.nullable(),
  /** Deciders whose authority covers the amount, lowest sufficient level first. */
  eligibleApprovers: z.array(EligibleApprover),
  /** True when the usual first level lacks authority and the decision goes up (AC-05). */
  routedToNextLevel: z.boolean(),
  skippedLevel: EligibleApprover.nullable(),
  route: ApprovalRouteState,
  /** `route.currentApprover` when the pending decision waits on someone other than the caller (AC-05); else `null`. */
  awaitingDecisionFrom: PersonRef.nullable(),
  funding: FundingConfirmation,
  comments: z.array(RequestComment),
  conditions: z.string().nullable(),
  approvedVersion: ApprovedVersion.nullable(),
  reapprovalRequired: z.boolean(),
  materialChange: MaterialChange.nullable(),
  history: z.array(DecisionHistoryEntry),
  segregation: z.object({
    rule: z.literal('requester_vs_request_approval'),
    callerIsRequester: z.boolean(),
    blocked: z.boolean(),
  }),
  allowedActions: z.array(RequestAction),
});
export type RequestDecisionView = z.infer<typeof RequestDecisionView>;

export const DecideRequestBody = z
  .object({
    decision: ApprovalDecision,
    reason: ReasonText,
    conditions: z.string().trim().max(4000, issue('TEXT_TOO_LONG', 'At most 4000 characters.')).nullable().optional(),
    /** The revision shown to the decider: a newer revision gives `REVISION_CONFLICT` (BR-10). */
    subjectRevision: z.number().int().min(1),
  })
  .superRefine((body, ctx) => {
    if (body.decision === 'approve_with_conditions' && (body.conditions === null || body.conditions === undefined || body.conditions === '')) {
      ctx.addIssue({
        code: 'custom',
        path: ['conditions'],
        message: issue('CONDITIONS_REQUIRED', 'State the conditions of the approval.'),
      });
    }
  });
export type DecideRequestBody = z.input<typeof DecideRequestBody>;

export const EscalateRequestBody = z.object({ reason: ReasonText });
export type EscalateRequestBody = z.input<typeof EscalateRequestBody>;

export const ConfirmFundingBody = z.object({
  fundingStatus: z.enum(['indicative', 'approved_budget', 'firm_commitment']),
  fundingSourceId: Id,
  confirmedAmount: NonNegativeMoney,
  accountingReference: z.string().trim().max(100).nullable().optional(),
  note: z.string().trim().max(4000).nullable().optional(),
  subjectRevision: z.number().int().min(1),
});
export type ConfirmFundingBody = z.input<typeof ConfirmFundingBody>;

export const CommentBody = z.object({
  text: z.string().trim().min(1, issue('COMMENT_REQUIRED', 'Write a comment.')).max(4000, issue('TEXT_TOO_LONG', 'At most 4000 characters.')),
});
export type CommentBody = z.input<typeof CommentBody>;

export const ReconsiderBody = z.object({
  reason: ReasonText,
  /** What changed since the rejection, withdrawal or deferral (PRD §8.1: reconsideration reviews the changed basis). */
  changedBasis: z.string().trim().min(1, issue('CHANGED_BASIS_REQUIRED', 'Describe what changed.')).max(4000),
});
export type ReconsiderBody = z.input<typeof ReconsiderBody>;

// ---------------------------------------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------------------------------------

export const RequestParams = z.object({ requestId: IdParam });
export const InfoRequestParams = z.object({ requestId: IdParam, infoRequestId: IdParam });

/** GET /api/v1/buyer/requests (BUY-02). */
export const listRequests = defineEndpoint({
  id: 'buyer.requests.list',
  method: 'GET',
  path: '/api/v1/buyer/requests',
  audience: 'buyer',
  permission: REQUEST_READ,
  query: RequestListQuery,
  response: RequestPage,
  errors: [],
  screens: ['BUY-02'],
  summary: 'The request register. `request.create` alone lists only the caller’s own requests; drafts only for their parties.',
});

/** GET /api/v1/buyer/request-summary (BUY-02 KPIs). */
export const getRequestSummary = defineEndpoint({
  id: 'buyer.requests.summary',
  method: 'GET',
  path: '/api/v1/buyer/request-summary',
  audience: 'buyer',
  permission: REQUEST_READ,
  response: RequestSummary,
  errors: [],
  screens: ['BUY-02'],
});

/** GET /api/v1/buyer/request-options (BUY-03, BUY-05, BUY-06 forms). */
export const getRequestOptions = defineEndpoint({
  id: 'buyer.requests.options',
  method: 'GET',
  path: '/api/v1/buyer/request-options',
  audience: 'buyer',
  permission: OPTIONS_READ,
  response: RequestOptions,
  errors: [],
  screens: ['BUY-03', 'BUY-05', 'BUY-06'],
});

/** GET /api/v1/buyer/requests/:requestId (BUY-03). */
export const getRequest = defineEndpoint({
  id: 'buyer.requests.get',
  method: 'GET',
  path: '/api/v1/buyer/requests/:requestId',
  audience: 'buyer',
  permission: REQUEST_READ,
  params: RequestParams,
  response: RequestDetail,
  errors: [],
  screens: ['BUY-03', 'BUY-04'],
});

/** POST /api/v1/buyer/requests (BUY-03): a new draft. */
export const createRequest = defineEndpoint({
  id: 'buyer.requests.create',
  method: 'POST',
  path: '/api/v1/buyer/requests',
  audience: 'buyer',
  permission: 'request.create',
  body: BusinessCaseBody,
  response: RequestDetail,
  idempotent: true,
  errors: ['REFERENCE_NOT_FOUND'],
  screens: ['BUY-02', 'BUY-03'],
});

/** PUT /api/v1/buyer/requests/:requestId (BUY-03): revise the business case. */
export const updateRequest = defineEndpoint({
  id: 'buyer.requests.update',
  method: 'PUT',
  path: '/api/v1/buyer/requests/:requestId',
  audience: 'buyer',
  permission: 'request.create',
  params: RequestParams,
  body: UpdateRequestBody,
  response: RequestUpdateResult,
  errors: ['REQUEST_NOT_EDITABLE', 'NOT_REQUEST_PARTY', 'REVISION_CONFLICT', 'REFERENCE_NOT_FOUND'],
  screens: ['BUY-03'],
  summary: 'A material change to an approved request invalidates the approval and requires re-approval (BR-10).',
});

/** POST /api/v1/buyer/requests/:requestId/submit (BUY-03): submit or resubmit. */
export const submitRequest = defineEndpoint({
  id: 'buyer.requests.submit',
  method: 'POST',
  path: '/api/v1/buyer/requests/:requestId/submit',
  audience: 'buyer',
  permission: 'request.create',
  params: RequestParams,
  body: RevisionBody,
  response: RequestDetail,
  errors: ['INVALID_TRANSITION', 'NOT_REQUEST_PARTY', 'REQUEST_INCOMPLETE', 'REVISION_CONFLICT', 'INFO_REQUEST_UNANSWERED'],
  screens: ['BUY-03'],
});

/** POST /api/v1/buyer/requests/:requestId/withdraw (BUY-03): the requester abandons the request. */
export const withdrawRequest = defineEndpoint({
  id: 'buyer.requests.withdraw',
  method: 'POST',
  path: '/api/v1/buyer/requests/:requestId/withdraw',
  audience: 'buyer',
  permission: 'request.create',
  params: RequestParams,
  body: ReasonBody,
  response: RequestDetail,
  errors: ['INVALID_TRANSITION', 'NOT_REQUEST_PARTY'],
  screens: ['BUY-03'],
});

/** POST /api/v1/buyer/requests/:requestId/assign (BUY-02): set the procurement owner. */
export const assignRequest = defineEndpoint({
  id: 'buyer.requests.assign',
  method: 'POST',
  path: '/api/v1/buyer/requests/:requestId/assign',
  audience: 'buyer',
  permission: 'request.review',
  params: RequestParams,
  body: AssignRequestBody,
  response: RequestDetail,
  errors: ['INVALID_TRANSITION', 'ASSIGNEE_NOT_ELIGIBLE'],
  screens: ['BUY-02', 'BUY-04'],
});

/** POST /api/v1/buyer/requests/:requestId/info-requests (BUY-04): ask the requester for information. */
export const requestInformation = defineEndpoint({
  id: 'buyer.requests.requestInfo',
  method: 'POST',
  path: '/api/v1/buyer/requests/:requestId/info-requests',
  audience: 'buyer',
  permission: 'request.review',
  params: RequestParams,
  body: RequestInfoBody,
  response: InfoRequest,
  idempotent: true,
  errors: ['INVALID_TRANSITION', 'DUE_DATE_NOT_FUTURE'],
  screens: ['BUY-03', 'BUY-04'],
});

/** POST /api/v1/buyer/requests/:requestId/info-requests/:infoRequestId/respond (BUY-03). */
export const respondToInfoRequest = defineEndpoint({
  id: 'buyer.requests.respondInfo',
  method: 'POST',
  path: '/api/v1/buyer/requests/:requestId/info-requests/:infoRequestId/respond',
  audience: 'buyer',
  permission: 'request.create',
  params: InfoRequestParams,
  body: RespondInfoBody,
  response: RequestDetail,
  errors: ['INFO_REQUEST_CLOSED', 'NOT_REQUEST_PARTY'],
  screens: ['BUY-03'],
});

/** POST /api/v1/buyer/requests/:requestId/combine (BUY-02): combine other requests into this one. */
export const combineRequests = defineEndpoint({
  id: 'buyer.requests.combine',
  method: 'POST',
  path: '/api/v1/buyer/requests/:requestId/combine',
  audience: 'buyer',
  permission: 'request.review',
  params: RequestParams,
  body: CombineRequestsBody,
  response: CombineResult,
  errors: ['INVALID_TRANSITION', 'COMBINE_SELF', 'COMBINE_SOURCE_INVALID', 'COMBINE_CURRENCY_MISMATCH'],
  screens: ['BUY-02', 'BUY-04'],
  summary: 'Originals are preserved (closed, combined into this request); the approval uses the aggregate value.',
});

/** POST /api/v1/buyer/requests/:requestId/split (BUY-04): divide the work into justified parts or lots. */
export const splitRequest = defineEndpoint({
  id: 'buyer.requests.split',
  method: 'POST',
  path: '/api/v1/buyer/requests/:requestId/split',
  audience: 'buyer',
  permission: 'request.review',
  params: RequestParams,
  body: SplitRequestBody,
  response: SplitResult,
  errors: ['INVALID_TRANSITION', 'SPLIT_TOTAL_MISMATCH', 'SPLIT_CURRENCY_MISMATCH'],
  screens: ['BUY-04'],
  summary: 'The parts must add up to the original estimate: splitting never hides the overall value (FR-04).',
});

/** POST /api/v1/buyer/requests/:requestId/defer (BUY-02, BUY-04). */
export const deferRequest = defineEndpoint({
  id: 'buyer.requests.defer',
  method: 'POST',
  path: '/api/v1/buyer/requests/:requestId/defer',
  audience: 'buyer',
  permission: 'request.review',
  params: RequestParams,
  body: DeferRequestBody,
  response: RequestDetail,
  errors: ['INVALID_TRANSITION', 'DEFER_DATE_NOT_FUTURE'],
  screens: ['BUY-02', 'BUY-04'],
});

/** GET /api/v1/buyer/requests/:requestId/routing-options (BUY-04): existing contracts the need could use. */
export const getRoutingOptions = defineEndpoint({
  id: 'buyer.requests.routingOptions',
  method: 'GET',
  path: '/api/v1/buyer/requests/:requestId/routing-options',
  audience: 'buyer',
  permission: 'request.review',
  params: RequestParams,
  response: RoutingOptions,
  errors: [],
  screens: ['BUY-02', 'BUY-04'],
});

/** POST /api/v1/buyer/requests/:requestId/route-to-contract (BUY-02, BUY-04). */
export const routeRequestToContract = defineEndpoint({
  id: 'buyer.requests.routeToContract',
  method: 'POST',
  path: '/api/v1/buyer/requests/:requestId/route-to-contract',
  audience: 'buyer',
  permission: 'request.review',
  params: RequestParams,
  body: RouteToContractBody,
  response: RequestDetail,
  errors: ['INVALID_TRANSITION', 'CONTRACT_NOT_ELIGIBLE'],
  screens: ['BUY-02', 'BUY-04'],
});

/** GET /api/v1/buyer/requests/:requestId/decision (BUY-04). */
export const getRequestDecision = defineEndpoint({
  id: 'buyer.requests.decisionView',
  method: 'GET',
  path: '/api/v1/buyer/requests/:requestId/decision',
  audience: 'buyer',
  permission: ['request.review', 'request.approve', 'request.funding_confirm', 'request.view_all'],
  params: RequestParams,
  response: RequestDecisionView,
  errors: [],
  screens: ['BUY-04'],
});

/** POST /api/v1/buyer/requests/:requestId/decision (BUY-04): approve, approve with conditions, reject or return. */
export const decideRequest = defineEndpoint({
  id: 'buyer.requests.decide',
  method: 'POST',
  path: '/api/v1/buyer/requests/:requestId/decision',
  audience: 'buyer',
  permission: 'request.approve',
  params: RequestParams,
  body: DecideRequestBody,
  response: RequestDecisionView,
  errors: ['INVALID_TRANSITION', 'AUTHORITY_EXCEEDED', 'SELF_APPROVAL_BLOCKED', 'FUNDING_NOT_CONFIRMED', 'REVISION_CONFLICT'],
  screens: ['BUY-04'],
  summary: 'Authority is checked against the approval value (aggregate when combined, AC-05, BR-06).',
});

/** POST /api/v1/buyer/requests/:requestId/decision/escalate (BUY-04): send the decision to the higher authority. */
export const escalateRequest = defineEndpoint({
  id: 'buyer.requests.escalate',
  method: 'POST',
  path: '/api/v1/buyer/requests/:requestId/decision/escalate',
  audience: 'buyer',
  permission: 'request.approve',
  params: RequestParams,
  body: EscalateRequestBody,
  response: RequestDecisionView,
  errors: ['INVALID_TRANSITION', 'AUTHORITY_SUFFICIENT', 'NO_HIGHER_AUTHORITY'],
  screens: ['BUY-04'],
});

/** POST /api/v1/buyer/requests/:requestId/funding (BUY-04): the budget owner confirms funding. */
export const confirmFunding = defineEndpoint({
  id: 'buyer.requests.confirmFunding',
  method: 'POST',
  path: '/api/v1/buyer/requests/:requestId/funding',
  audience: 'buyer',
  permission: 'request.funding_confirm',
  params: RequestParams,
  body: ConfirmFundingBody,
  response: RequestDecisionView,
  errors: ['INVALID_TRANSITION', 'FUNDING_BELOW_ESTIMATE', 'FUNDING_CURRENCY_MISMATCH', 'REVISION_CONFLICT', 'REFERENCE_NOT_FOUND'],
  screens: ['BUY-04'],
});

/** POST /api/v1/buyer/requests/:requestId/comments (BUY-04): a review comment. */
export const commentOnRequest = defineEndpoint({
  id: 'buyer.requests.comment',
  method: 'POST',
  path: '/api/v1/buyer/requests/:requestId/comments',
  audience: 'buyer',
  permission: ['request.review', 'request.approve', 'request.funding_confirm'],
  params: RequestParams,
  body: CommentBody,
  response: RequestComment,
  idempotent: true,
  errors: ['INVALID_TRANSITION'],
  screens: ['BUY-04'],
});

/** POST /api/v1/buyer/requests/:requestId/rescind (BUY-04): withdraw an approval before conversion. */
export const rescindRequest = defineEndpoint({
  id: 'buyer.requests.rescind',
  method: 'POST',
  path: '/api/v1/buyer/requests/:requestId/rescind',
  audience: 'buyer',
  permission: 'request.approve',
  params: RequestParams,
  body: ReasonBody,
  response: RequestDetail,
  errors: ['INVALID_TRANSITION', 'REQUEST_ALREADY_CONVERTED'],
  screens: ['BUY-04'],
});

/** POST /api/v1/buyer/requests/:requestId/reconsider (BUY-04): reopen a rejected, withdrawn or deferred request. */
export const reconsiderRequest = defineEndpoint({
  id: 'buyer.requests.reconsider',
  method: 'POST',
  path: '/api/v1/buyer/requests/:requestId/reconsider',
  audience: 'buyer',
  permission: 'request.review',
  params: RequestParams,
  body: ReconsiderBody,
  response: RequestDetail,
  errors: ['INVALID_TRANSITION'],
  screens: ['BUY-02', 'BUY-04'],
});

/** POST /api/v1/buyer/requests/:requestId/close (BUY-02): close a rejected, withdrawn or deferred request. */
export const closeRequest = defineEndpoint({
  id: 'buyer.requests.close',
  method: 'POST',
  path: '/api/v1/buyer/requests/:requestId/close',
  audience: 'buyer',
  permission: 'request.review',
  params: RequestParams,
  body: ReasonBody,
  response: RequestDetail,
  errors: ['INVALID_TRANSITION'],
  screens: ['BUY-02'],
});
