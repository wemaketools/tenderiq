/**
 * Market research and procurement strategy (BUY-06). PRD FR-05, AC-39; blueprint `procurement_strategies`,
 * `market_research_entries`, `fairness_reviews`.
 *
 * - The procedure is one of the FR-05 procedures; `framework_calloff` is never offered for writes (DD-40).
 *   The policy profile version decides which procedures are permitted (`PROCEDURE_NOT_PERMITTED`), and the value
 *   thresholds say whether the chosen procedure fits the estimate.
 * - A `direct` procedure needs the exception grounds (`DIRECT_AWARD_GROUNDS_REQUIRED`); an `rfi` event uses the
 *   `rfi` procedure and never leads to an award by itself (`EVENT_TYPE_PROCEDURE_MISMATCH`). An RFI states how the
 *   information suppliers share will be used and that taking part creates no award entitlement
 *   (`supplierInformationUse`, `SUPPLIER_INFORMATION_USE_REQUIRED`); competition-only fields (rationale, lots,
 *   qualification, evaluation, award model, negotiation) do not apply to an RFI.
 * - Market research records its source and distinguishes an unverified estimate from a supplier commitment.
 *   Prior supplier involvement in shaping the specification opens a fairness review, and a strategy cannot be
 *   submitted while one is `pending` (`FAIRNESS_REVIEW_PENDING`).
 * - An RFI can conclude with reviewed findings and a linked next-step event without an award (AC-39): the strategy
 *   shows the source RFI, its findings and the separately identified next event.
 * - Approval checks the approver's authority for `strategy_approval` against the estimated value (BR-06) and the
 *   exact revision (BR-10).
 */
import { z } from 'zod';

import { ApprovalDecision, AuthorityCheck } from '../approvals.js';
import {
  ActorRef,
  Id,
  IdParam,
  Instant,
  LinkPath,
  Money,
  PersonRef,
  ReasonText,
  issue,
  listQueryWithSort,
  pageOf,
  queryList,
} from '../common.js';
import { defineEndpoint } from '../endpoint.js';
import {
  ApprovalRequestsStatus,
  FairnessReviewsOutcome,
  FairnessReviewsSubjectType,
  MarketResearchEntriesSourceType,
  PROCUREMENT_STRATEGIES_PROCEDURE_WRITE,
  ProcurementStrategiesAwardModel,
  ProcurementStrategiesEventType,
  ProcurementStrategiesProcedure,
  ProcurementStrategiesStatus,
} from '../enums.js';
import {
  CodedRef,
  ProjectRef,
  ReadinessItem,
  RequestRef,
  StrategyAction,
  SupplierRef,
  TenderRef,
  STRATEGY_READ,
} from './shared.js';

/** The procedures a strategy may choose (no `framework_calloff`, DD-40). */
export const StrategyProcedureWrite = z.enum(PROCUREMENT_STRATEGIES_PROCEDURE_WRITE, {
  error: issue('PROCEDURE_NOT_OFFERED', 'Choose one of the offered procedures.'),
});
export type StrategyProcedureWrite = z.infer<typeof StrategyProcedureWrite>;

// ---------------------------------------------------------------------------------------------------------
// Research and fairness
// ---------------------------------------------------------------------------------------------------------

/** A market research entry (`market_research_entries`). */
export const MarketResearchEntry = z.object({
  id: Id,
  sourceType: MarketResearchEntriesSourceType,
  source: z.string().min(1),
  finding: z.string().min(1),
  /** `false`: an unverified estimate or observation; `true`: a commitment given by the named supplier. */
  isSupplierCommitment: z.boolean(),
  supplier: SupplierRef.nullable(),
  priorSpecificationInvolvement: z.boolean(),
  recordedAt: Instant,
  recordedBy: PersonRef.nullable(),
});
export type MarketResearchEntry = z.infer<typeof MarketResearchEntry>;

/** A fairness review (`fairness_reviews`) opened by prior supplier involvement. */
export const FairnessReview = z.object({
  id: Id,
  subjectType: FairnessReviewsSubjectType,
  subjectId: Id,
  supplier: SupplierRef,
  reason: z.string().min(1),
  reviewer: PersonRef.nullable(),
  outcome: FairnessReviewsOutcome,
  note: z.string().nullable(),
  createdAt: Instant,
  decidedAt: Instant.nullable(),
});
export type FairnessReview = z.infer<typeof FairnessReview>;

// ---------------------------------------------------------------------------------------------------------
// Strategy
// ---------------------------------------------------------------------------------------------------------

export const StrategyRow = z.object({
  id: Id,
  /** The project or request title the strategy serves. */
  title: z.string().min(1),
  project: ProjectRef.nullable(),
  request: RequestRef.nullable(),
  revision: z.number().int().min(1),
  eventType: ProcurementStrategiesEventType,
  procedure: ProcurementStrategiesProcedure,
  awardModel: ProcurementStrategiesAwardModel,
  status: ProcurementStrategiesStatus,
  owner: PersonRef.nullable(),
  category: CodedRef.nullable(),
  estimatedValue: Money.nullable(),
  pendingFairnessReviews: z.number().int().min(0),
  tenders: z.array(TenderRef),
  updatedAt: Instant,
});
export type StrategyRow = z.infer<typeof StrategyRow>;

/** One FR-05 "required distinction" of the chosen procedure and whether the strategy records it. */
export const ProcedureDistinction = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  satisfied: z.boolean(),
  detail: z.string().nullable(),
});
export type ProcedureDistinction = z.infer<typeof ProcedureDistinction>;

export const PolicyProcedureCheck = z.object({
  policyProfileVersion: z.object({ id: Id, name: z.string().min(1), versionNo: z.number().int().min(1) }).nullable(),
  permittedProcedures: z.array(ProcurementStrategiesProcedure),
  procedurePermitted: z.boolean(),
  /** Whether the estimated value is within the policy threshold of the chosen procedure (`null`: no threshold). */
  withinThreshold: z.boolean().nullable(),
  thresholdNote: z.string().nullable(),
  requiresPublicNotice: z.boolean(),
});
export type PolicyProcedureCheck = z.infer<typeof PolicyProcedureCheck>;

/** The AC-39 view of an RFI: reviewed findings and the linked next-step decision, without an award. */
export const RfiOutcome = z.object({
  rfiTender: TenderRef,
  findingsSummary: z.string().min(1),
  reviewedBy: PersonRef.nullable(),
  reviewedAt: Instant.nullable(),
  nextStepDecision: z.string().min(1),
  nextEvent: TenderRef.nullable(),
  /** RFI participation creates no award entitlement, and unsuccessful RFI participants are not excluded later. */
  participationNote: z.string().min(1),
});
export type RfiOutcome = z.infer<typeof RfiOutcome>;

export const StrategyApproval = z.object({
  approvalId: Id.nullable(),
  status: ApprovalRequestsStatus,
  approvedRevision: z.number().int().min(1).nullable(),
  decidedBy: ActorRef.nullable(),
  decidedAt: Instant.nullable(),
  conditions: z.string().nullable(),
  reason: z.string().nullable(),
});
export type StrategyApproval = z.infer<typeof StrategyApproval>;

export const StrategyDetail = StrategyRow.extend({
  intendedOutcome: z.string().nullable(),
  competitionRationale: z.string().nullable(),
  directAwardGrounds: z.string().nullable(),
  risks: z.string().nullable(),
  qualificationApproach: z.string().nullable(),
  lotStrategy: z.string().nullable(),
  evaluationApproach: z.string().nullable(),
  negotiationPermitted: z.boolean(),
  timetableSummary: z.string().nullable(),
  externalOversight: z.string().nullable(),
  /** RFI only (FR-05): no award entitlement and how the information suppliers share may be used later. */
  supplierInformationUse: z.string().nullable(),
  policy: PolicyProcedureCheck,
  procedureDistinctions: z.array(ProcedureDistinction),
  marketResearch: z.array(MarketResearchEntry),
  fairnessReviews: z.array(FairnessReview),
  approval: StrategyApproval.nullable(),
  /** The caller's authority for `strategy_approval`; `null` when the caller cannot approve strategies. */
  callerAuthority: AuthorityCheck.nullable(),
  rfiOutcome: RfiOutcome.nullable(),
  submissionReadiness: z.array(ReadinessItem),
  allowedActions: z.array(StrategyAction),
  /** `/buyer/tenders/new?fromRequest=ID` once approved (when the strategy serves a request). */
  createTenderPath: LinkPath.nullable(),
});
export type StrategyDetail = z.infer<typeof StrategyDetail>;

export const STRATEGY_SORT_FIELDS = ['title', 'status', 'procedure', 'updatedAt', 'estimatedValue'] as const;

export const StrategyListQuery = listQueryWithSort(STRATEGY_SORT_FIELDS).extend({
  status: queryList(ProcurementStrategiesStatus).optional(),
  procedure: queryList(ProcurementStrategiesProcedure).optional(),
  eventType: queryList(ProcurementStrategiesEventType).optional(),
  ownerUserId: IdParam.optional(),
});
export type StrategyListQuery = z.input<typeof StrategyListQuery>;

export const StrategyPage = pageOf(StrategyRow);
export type StrategyPage = z.infer<typeof StrategyPage>;

/** One procedure option in the comparison of approaches (FR-05 table + policy + value). */
export const ProcedureOption = z.object({
  procedure: StrategyProcedureWrite,
  eventTypes: z.array(ProcurementStrategiesEventType).min(1),
  purpose: z.string().min(1),
  requiredDistinctions: z.array(z.string().min(1)).min(1),
  permittedByPolicy: z.boolean(),
  withinThreshold: z.boolean().nullable(),
  thresholdNote: z.string().nullable(),
  requiresExceptionApproval: z.boolean(),
  typicalDurationDays: z.number().int().min(1),
  selected: z.boolean(),
});
export type ProcedureOption = z.infer<typeof ProcedureOption>;

export const ProcedureOptions = z.object({
  strategyId: Id,
  estimatedValue: Money.nullable(),
  options: z.array(ProcedureOption).min(1),
});
export type ProcedureOptions = z.infer<typeof ProcedureOptions>;

// ---------------------------------------------------------------------------------------------------------
// Bodies
// ---------------------------------------------------------------------------------------------------------

const StrategyText = z.string().trim().max(8000, issue('TEXT_TOO_LONG', 'At most 8000 characters.')).nullable().optional();

const StrategyFields = z.object({
  eventType: ProcurementStrategiesEventType,
  procedure: StrategyProcedureWrite,
  awardModel: ProcurementStrategiesAwardModel,
  intendedOutcome: StrategyText,
  competitionRationale: StrategyText,
  directAwardGrounds: StrategyText,
  risks: StrategyText,
  qualificationApproach: StrategyText,
  lotStrategy: StrategyText,
  evaluationApproach: StrategyText,
  negotiationPermitted: z.boolean().default(false),
  timetableSummary: StrategyText,
  externalOversight: StrategyText,
  supplierInformationUse: StrategyText,
});

function checkStrategy(body: z.output<typeof StrategyFields>, ctx: z.RefinementCtx): void {
  if ((body.eventType === 'rfi') !== (body.procedure === 'rfi')) {
    ctx.addIssue({
      code: 'custom',
      path: ['procedure'],
      message: issue('EVENT_TYPE_PROCEDURE_MISMATCH', 'An RFI uses the RFI procedure, and only an RFI does.'),
    });
  }
  if (
    body.eventType === 'rfi' &&
    (body.supplierInformationUse === null || body.supplierInformationUse === undefined || body.supplierInformationUse === '')
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['supplierInformationUse'],
      message: issue(
        'SUPPLIER_INFORMATION_USE_REQUIRED',
        'State how the information suppliers share will be used and that taking part creates no award entitlement.',
      ),
    });
  }
  if (body.procedure === 'direct' && (body.directAwardGrounds === null || body.directAwardGrounds === undefined || body.directAwardGrounds === '')) {
    ctx.addIssue({
      code: 'custom',
      path: ['directAwardGrounds'],
      message: issue('DIRECT_AWARD_GROUNDS_REQUIRED', 'State the approved exception grounds for a direct procurement.'),
    });
  }
}

export const CreateStrategyBody = StrategyFields.extend({
  requestId: Id.nullable().optional(),
  projectId: Id.nullable().optional(),
})
  .superRefine(checkStrategy)
  .superRefine((body, ctx) => {
    const hasRequest = body.requestId !== null && body.requestId !== undefined;
    const hasProject = body.projectId !== null && body.projectId !== undefined;
    if (!hasRequest && !hasProject) {
      ctx.addIssue({
        code: 'custom',
        path: ['requestId'],
        message: issue('STRATEGY_SUBJECT_REQUIRED', 'Choose the approved request or the project this strategy serves.'),
      });
    }
  });
export type CreateStrategyBody = z.input<typeof CreateStrategyBody>;

export const UpdateStrategyBody = StrategyFields.extend({
  expectedRevision: z.number().int().min(1, issue('INVALID_REVISION', 'Must be a revision number.')),
}).superRefine(checkStrategy);
export type UpdateStrategyBody = z.input<typeof UpdateStrategyBody>;

export const AddMarketResearchBody = z
  .object({
    sourceType: MarketResearchEntriesSourceType,
    source: z.string().trim().min(2, issue('SOURCE_REQUIRED', 'Name the source.')).max(500),
    finding: z.string().trim().min(5, issue('FINDING_REQUIRED', 'Record the finding.')).max(8000),
    isSupplierCommitment: z.boolean(),
    supplierTenantId: Id.nullable().optional(),
    priorSpecificationInvolvement: z.boolean().default(false),
  })
  .superRefine((body, ctx) => {
    const noSupplier = body.supplierTenantId === null || body.supplierTenantId === undefined;
    if ((body.isSupplierCommitment || body.priorSpecificationInvolvement) && noSupplier) {
      ctx.addIssue({
        code: 'custom',
        path: ['supplierTenantId'],
        message: issue('SUPPLIER_REQUIRED', 'Name the supplier that gave the commitment or was involved.'),
      });
    }
  });
export type AddMarketResearchBody = z.input<typeof AddMarketResearchBody>;

export const AddMarketResearchResult = z.object({
  entry: MarketResearchEntry,
  /** The fairness review opened because of prior specification involvement, if any. */
  fairnessReview: FairnessReview.nullable(),
});
export type AddMarketResearchResult = z.infer<typeof AddMarketResearchResult>;

export const DecideFairnessBody = z.object({
  outcome: z.enum(['no_issue', 'mitigated', 'excluded_from_drafting'], {
    error: issue('OUTCOME_REQUIRED', 'Choose the review outcome.'),
  }),
  note: ReasonText,
});
export type DecideFairnessBody = z.input<typeof DecideFairnessBody>;

export const SubmitStrategyBody = z.object({
  expectedRevision: z.number().int().min(1),
  justification: z.string().trim().max(4000).nullable().optional(),
});
export type SubmitStrategyBody = z.input<typeof SubmitStrategyBody>;

export const DecideStrategyBody = z
  .object({
    decision: ApprovalDecision,
    reason: ReasonText,
    conditions: z.string().trim().max(4000).nullable().optional(),
    subjectRevision: z.number().int().min(1),
  })
  .superRefine((body, ctx) => {
    if (body.decision === 'approve_with_conditions' && (body.conditions === null || body.conditions === undefined || body.conditions === '')) {
      ctx.addIssue({ code: 'custom', path: ['conditions'], message: issue('CONDITIONS_REQUIRED', 'State the conditions of the approval.') });
    }
  });
export type DecideStrategyBody = z.input<typeof DecideStrategyBody>;

export const StrategyParams = z.object({ strategyId: IdParam });
export const FairnessReviewParams = z.object({ strategyId: IdParam, reviewId: IdParam });

// ---------------------------------------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------------------------------------

/** GET /api/v1/buyer/strategies (BUY-06). */
export const listStrategies = defineEndpoint({
  id: 'buyer.strategies.list',
  method: 'GET',
  path: '/api/v1/buyer/strategies',
  audience: 'buyer',
  permission: STRATEGY_READ,
  query: StrategyListQuery,
  response: StrategyPage,
  errors: [],
  screens: ['BUY-06'],
});

/** GET /api/v1/buyer/strategies/:strategyId (BUY-06). */
export const getStrategy = defineEndpoint({
  id: 'buyer.strategies.get',
  method: 'GET',
  path: '/api/v1/buyer/strategies/:strategyId',
  audience: 'buyer',
  permission: STRATEGY_READ,
  params: StrategyParams,
  response: StrategyDetail,
  errors: [],
  screens: ['BUY-06'],
});

/** POST /api/v1/buyer/strategies (BUY-06): a draft strategy for an approved request or a project. */
export const createStrategy = defineEndpoint({
  id: 'buyer.strategies.create',
  method: 'POST',
  path: '/api/v1/buyer/strategies',
  audience: 'buyer',
  permission: 'strategy.manage',
  body: CreateStrategyBody,
  response: StrategyDetail,
  idempotent: true,
  errors: ['REQUEST_NOT_APPROVED', 'STRATEGY_EXISTS', 'PROCEDURE_NOT_PERMITTED', 'REFERENCE_NOT_FOUND'],
  screens: ['BUY-06'],
});

/** PUT /api/v1/buyer/strategies/:strategyId (BUY-06). */
export const updateStrategy = defineEndpoint({
  id: 'buyer.strategies.update',
  method: 'PUT',
  path: '/api/v1/buyer/strategies/:strategyId',
  audience: 'buyer',
  permission: 'strategy.manage',
  params: StrategyParams,
  body: UpdateStrategyBody,
  response: StrategyDetail,
  errors: ['STRATEGY_NOT_EDITABLE', 'REVISION_CONFLICT', 'PROCEDURE_NOT_PERMITTED'],
  screens: ['BUY-06'],
});

/** GET /api/v1/buyer/strategies/:strategyId/procedure-options (BUY-06): compare approaches. */
export const getProcedureOptions = defineEndpoint({
  id: 'buyer.strategies.procedureOptions',
  method: 'GET',
  path: '/api/v1/buyer/strategies/:strategyId/procedure-options',
  audience: 'buyer',
  permission: STRATEGY_READ,
  params: StrategyParams,
  response: ProcedureOptions,
  errors: [],
  screens: ['BUY-06'],
});

/** POST /api/v1/buyer/strategies/:strategyId/market-research (BUY-06): record a consultation or finding. */
export const addMarketResearch = defineEndpoint({
  id: 'buyer.strategies.addResearch',
  method: 'POST',
  path: '/api/v1/buyer/strategies/:strategyId/market-research',
  audience: 'buyer',
  permission: 'strategy.manage',
  params: StrategyParams,
  body: AddMarketResearchBody,
  response: AddMarketResearchResult,
  idempotent: true,
  errors: ['STRATEGY_NOT_EDITABLE', 'REFERENCE_NOT_FOUND'],
  screens: ['BUY-06'],
});

/** POST /api/v1/buyer/strategies/:strategyId/fairness-reviews/:reviewId/decision (BUY-06). */
export const decideFairnessReview = defineEndpoint({
  id: 'buyer.strategies.decideFairness',
  method: 'POST',
  path: '/api/v1/buyer/strategies/:strategyId/fairness-reviews/:reviewId/decision',
  audience: 'buyer',
  permission: 'strategy.approve',
  params: FairnessReviewParams,
  body: DecideFairnessBody,
  response: FairnessReview,
  errors: ['FAIRNESS_REVIEW_CLOSED'],
  screens: ['BUY-06'],
});

/** POST /api/v1/buyer/strategies/:strategyId/submit (BUY-06): request strategy approval. */
export const submitStrategy = defineEndpoint({
  id: 'buyer.strategies.submit',
  method: 'POST',
  path: '/api/v1/buyer/strategies/:strategyId/submit',
  audience: 'buyer',
  permission: 'strategy.manage',
  params: StrategyParams,
  body: SubmitStrategyBody,
  response: StrategyDetail,
  errors: [
    'INVALID_TRANSITION',
    'REVISION_CONFLICT',
    'STRATEGY_INCOMPLETE',
    'FAIRNESS_REVIEW_PENDING',
    'DIRECT_AWARD_GROUNDS_REQUIRED',
    'PROCEDURE_NOT_PERMITTED',
    'PROCEDURE_THRESHOLD_EXCEEDED',
  ],
  screens: ['BUY-06'],
});

/** POST /api/v1/buyer/strategies/:strategyId/decision (BUY-06): approve, reject or return the strategy. */
export const decideStrategy = defineEndpoint({
  id: 'buyer.strategies.decide',
  method: 'POST',
  path: '/api/v1/buyer/strategies/:strategyId/decision',
  audience: 'buyer',
  permission: 'strategy.approve',
  params: StrategyParams,
  body: DecideStrategyBody,
  response: StrategyDetail,
  errors: ['INVALID_TRANSITION', 'AUTHORITY_EXCEEDED', 'SELF_APPROVAL_BLOCKED', 'REVISION_CONFLICT'],
  screens: ['BUY-06'],
});
