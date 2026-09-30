/**
 * Awards domain schemas (domain 13; FR-17, BR-31..BR-35; BUY-26, BUY-28, BUY-29, BUY-30, SUP-21, SUP-22, PUB-05).
 *
 * Field names mirror the blueprint tables `award_recommendations`, `lot_outcomes`, `standstill_periods`,
 * `debrief_requests`, `complaints`, `complaint_events`, `public_award_notices`, `event_closeouts`, `notices`,
 * `notice_recipients` and `holds` (camelCase). Projections that assemble data owned by other domains (evaluation
 * results, due diligence, qualification, contracts and handovers) are read-only here and carry only what the award
 * screens need.
 *
 * Audience rules (PRD §4.3, DD-03):
 * - Buyer schemas are for the assigned buyer team only.
 * - Supplier schemas carry the supplier's OWN result only: no other bidder's scores, prices or complaints. The
 *   successful supplier's name and awarded value appear only where the issued notice discloses them.
 * - Public schemas come only from published public award notices (DD-13 `v_public_awards`).
 *
 * Pure module: zod and sibling contract files only.
 */
import { z } from 'zod';

import {
  CalendarDate,
  CurrencyCode,
  Id,
  IdParam,
  Instant,
  Money,
  NonNegativeMoney,
  OfficialDeadline,
  PersonRef,
  QueryBoolean,
  ReasonText,
  Reference,
  Score,
  Slug,
  TimeZone,
  issue,
  listQueryWithSort,
  pageOf,
  queryList,
} from '../common.js';
import {
  ApprovalRequestsStatus,
  AwardRecommendationsStatus,
  BidsComplianceStatus,
  ComplaintsOutcome,
  ComplaintsStatus,
  ComplaintsSubject,
  ContractsStatus,
  DebriefRequestsStatus,
  DueDiligenceCasesStatus,
  EventCloseoutsStatus,
  ExportsStatus,
  HandoversStatus,
  HoldsBlockedActions,
  HoldsHoldType,
  HoldsSubjectType,
  LotOutcomesOutcome,
  LotOutcomesStatus,
  LotsStage,
  NoticeRecipientsDeliveryStatus,
  NoticesPeriodStartBasis,
  NoticesStatus,
  PolicyProfileVersionsStandstillDayType,
  PublicAwardNoticesStatus,
  RetentionClassesRecordClass,
  StandstillPeriodsStatus,
  TendersAwardModel,
  TendersEventType,
  TendersProcedure,
  TendersStatus,
  VQualificationStatusEffectiveStatus,
} from '../enums.js';
import { ContentHash } from '../approvals.js';

// ---------------------------------------------------------------------------------------------------------
// Contract-level enumerations (not database CHECK lists)
// ---------------------------------------------------------------------------------------------------------

/**
 * The notice types the outcome screens show (a subset of `notices.notice_type`). `preferred_bidder` notices are
 * issued by the selection domain; they state an exact status that is NOT an award (BR-31) and appear here read-only.
 */
export const OUTCOME_NOTICE_TYPES = [
  'preferred_bidder',
  'intent_to_award',
  'final_award',
  'unsuccessful_outcome',
  'standstill_change',
  'complaint_update',
  'cancellation',
] as const;
export const OutcomeNoticeType = z.enum(OUTCOME_NOTICE_TYPES, {
  error: issue('INVALID_NOTICE_TYPE', 'Choose an outcome notice type.'),
});
export type OutcomeNoticeType = z.infer<typeof OutcomeNoticeType>;

/** Notice types a buyer may draft from BUY-28 (complaint updates come from BUY-29, cancellations from the tender). */
export const DRAFTABLE_OUTCOME_NOTICE_TYPES = [
  'intent_to_award',
  'final_award',
  'unsuccessful_outcome',
  'standstill_change',
] as const;
export const DraftableOutcomeNoticeType = z.enum(DRAFTABLE_OUTCOME_NOTICE_TYPES, {
  error: issue('INVALID_NOTICE_TYPE', 'Choose intent, final award, unsuccessful outcome or standstill change.'),
});
export type DraftableOutcomeNoticeType = z.infer<typeof DraftableOutcomeNoticeType>;

/** The next step of an award file, derived from its records (BUY-26 register). */
export const AWARD_NEXT_STEPS = [
  'prepare_recommendation',
  'submit_recommendation',
  'await_recommendation_approval',
  'issue_intent_notice',
  'await_standstill',
  'resolve_complaint',
  'final_award',
  'publish_award_notice',
  'close_event',
  'archive',
  'none',
] as const;
export const AwardNextStep = z.enum(AWARD_NEXT_STEPS);
export type AwardNextStep = z.infer<typeof AwardNextStep>;

/** Next steps that place a tender in the closeout register (BUY-30) even before a closeout record exists. */
export const AWARD_CLOSEOUT_NEXT_STEPS = ['close_event', 'archive', 'none'] as const satisfies readonly AwardNextStep[];

/**
 * Register views: `award` lists every award file (BUY-26); `closeout` lists the files at the closeout stage (BUY-30),
 * i.e. every file whose closure is blocked, closed or archived, or whose next step is closing or archiving, so each
 * file the closeout KPIs count is listed whatever its next step (AC-29: a blocked handover stays visible).
 */
export const AWARD_REGISTER_VIEWS = ['award', 'closeout'] as const;
export const AwardRegisterView = z.enum(AWARD_REGISTER_VIEWS);
export type AwardRegisterView = z.infer<typeof AwardRegisterView>;

/** A gate check status, rendered by the ReadinessChecklist (warnings do not block; blocking items do). */
export const GATE_CHECK_STATUSES = ['passed', 'warning', 'blocking'] as const;
export const GateCheckStatus = z.enum(GATE_CHECK_STATUSES);
export type GateCheckStatus = z.infer<typeof GateCheckStatus>;

/** The final-award gate conditions per lot outcome (FR-17, BR-32; data model 10 §4). */
export const FINAL_AWARD_GATE_CHECKS = [
  'intent_approval',
  'intent_notice',
  'final_award_approval',
  'diligence',
  'blocking_complaint',
  'standstill',
  'award_conditions',
] as const;
/** The event closeout gate conditions (BUY-30, AC-29, AC-39). */
export const CLOSEOUT_GATE_CHECKS = [
  'lot_outcomes',
  'contracts_signed',
  'handover_accepted',
  'complaints_closed',
  'debriefs_closed',
  'securities_resolved',
  'retention_class',
  'rfi_findings',
] as const;
/** The recommendation submission checks (BUY-26). */
export const RECOMMENDATION_GATE_CHECKS = [
  'evaluation_signed_off',
  'every_lot_has_outcome',
  'totals_reconcile',
  'diligence',
  'conflicts',
  'funding',
] as const;
/** Every gate check code (the union of the three gates, each code once). */
export const GATE_CHECK_CODES = [
  'intent_approval',
  'intent_notice',
  'final_award_approval',
  'diligence',
  'blocking_complaint',
  'standstill',
  'award_conditions',
  'lot_outcomes',
  'contracts_signed',
  'handover_accepted',
  'complaints_closed',
  'debriefs_closed',
  'securities_resolved',
  'retention_class',
  'rfi_findings',
  'evaluation_signed_off',
  'every_lot_has_outcome',
  'totals_reconcile',
  'conflicts',
  'funding',
] as const;
export const GateCheckCode = z.enum(GATE_CHECK_CODES);
export type GateCheckCode = z.infer<typeof GateCheckCode>;

/** One gate condition: `code` names it (the SPA translates it), `detail` is the record-specific explanation. */
export const GateCheck = z.object({
  code: GateCheckCode,
  status: GateCheckStatus,
  detail: z.string().nullable(),
});
export type GateCheck = z.infer<typeof GateCheck>;

/** A decision on a recommendation (BUY-26): approve, approve with conditions, reject or return. */
export const RECOMMENDATION_DECISIONS = ['approve', 'approve_with_conditions', 'reject', 'return'] as const;
export const RecommendationDecision = z.enum(RECOMMENDATION_DECISIONS, {
  error: issue('INVALID_DECISION', 'Choose approve, approve with conditions, reject or return.'),
});
export type RecommendationDecision = z.infer<typeof RecommendationDecision>;

/** Recommendation history actions. */
export const RECOMMENDATION_HISTORY_ACTIONS = [
  'created',
  'edited',
  'submitted',
  'approved',
  'approved_with_conditions',
  'returned',
  'rejected',
  'superseded',
] as const;
export const RecommendationHistoryAction = z.enum(RECOMMENDATION_HISTORY_ACTIONS);
export type RecommendationHistoryAction = z.infer<typeof RecommendationHistoryAction>;

/** Disclosure review state of an outcome notice before issue (BUY-28, BR-34). */
export const DISCLOSURE_REVIEW_STATUSES = ['pending', 'completed'] as const;
export const DisclosureReviewStatus = z.enum(DISCLOSURE_REVIEW_STATUSES);
export type DisclosureReviewStatus = z.infer<typeof DisclosureReviewStatus>;

/** Public award notice review areas (BR-34). */
export const PUBLIC_NOTICE_REVIEW_AREAS = ['confidentiality', 'personal_information'] as const;
export const PublicNoticeReviewArea = z.enum(PUBLIC_NOTICE_REVIEW_AREAS, {
  error: issue('INVALID_REVIEW_AREA', 'Choose confidentiality or personal information.'),
});
export type PublicNoticeReviewArea = z.infer<typeof PublicNoticeReviewArea>;

/** Complaint transitions a buyer performs with the generic transition command. */
export const COMPLAINT_BUYER_TRANSITIONS = ['admissibility_review', 'under_investigation', 'resolved', 'closed'] as const;
export const ComplaintBuyerTransition = z.enum(COMPLAINT_BUYER_TRANSITIONS, {
  error: issue('INVALID_TRANSITION', 'Choose admissibility review, investigation, resolved or closed.'),
});
export type ComplaintBuyerTransition = z.infer<typeof ComplaintBuyerTransition>;

/** Outcomes a buyer may issue in a complaint response (withdrawn is set only by the complainant). */
export const COMPLAINT_RESPONSE_OUTCOMES = ['upheld', 'partially_upheld', 'dismissed', 'inadmissible'] as const;
export const ComplaintResponseOutcome = z.enum(COMPLAINT_RESPONSE_OUTCOMES, {
  error: issue('INVALID_OUTCOME', 'Choose upheld, partially upheld, dismissed or inadmissible.'),
});
export type ComplaintResponseOutcome = z.infer<typeof ComplaintResponseOutcome>;

/** Complaint history event types (`complaint_events.event_type`, no list stated in the blueprint). */
export const COMPLAINT_EVENT_TYPES = [
  'received',
  'acknowledged',
  'owner_assigned',
  'status_changed',
  'hold_placed',
  'hold_released',
  'response_issued',
  'appeal_lodged',
  'appeal_decided',
  'withdrawn',
  'closed',
  'note',
] as const;
export const ComplaintEventType = z.enum(COMPLAINT_EVENT_TYPES);
export type ComplaintEventType = z.infer<typeof ComplaintEventType>;

/**
 * A supplier's result on one lot (SUP-21). `pending` = no outcome decided yet. `preferred_bidder` is a selection
 * status that is NOT an award (BR-31); `preferred_withdrawn` = the preferred status was withdrawn (for example after
 * failed due diligence) and no award was ever made.
 */
export const SUPPLIER_LOT_RESULTS = [
  'preferred_bidder',
  'preferred_withdrawn',
  'intent_to_award',
  'awarded',
  'unsuccessful',
  'no_award',
  'cancelled',
  'pending',
] as const;
export const SupplierLotResult = z.enum(SUPPLIER_LOT_RESULTS);
export type SupplierLotResult = z.infer<typeof SupplierLotResult>;

/** A supplier's overall result on a tender (`mixed` when its lots differ). Preferred states are never awards (BR-31). */
export const SUPPLIER_OUTCOME_RESULTS = [
  'preferred_bidder',
  'preferred_withdrawn',
  'intent_to_award',
  'awarded',
  'unsuccessful',
  'cancelled',
  'mixed',
] as const;
export const SupplierOutcomeResult = z.enum(SUPPLIER_OUTCOME_RESULTS);
export type SupplierOutcomeResult = z.infer<typeof SupplierOutcomeResult>;

/** Tender statuses a public award notice may carry (DD-13). */
export const PUBLIC_AWARD_TENDER_STATUSES = ['award_pending', 'awarded', 'partially_awarded', 'completed_without_award', 'cancelled'] as const;
export const PublicAwardTenderStatus = z.enum(PUBLIC_AWARD_TENDER_STATUSES);
export type PublicAwardTenderStatus = z.infer<typeof PublicAwardTenderStatus>;

// ---------------------------------------------------------------------------------------------------------
// Shared references
// ---------------------------------------------------------------------------------------------------------

/** A tender as the award screens show it. */
export const AwardTenderRef = z.object({
  tenderId: Id,
  reference: Reference,
  title: z.string().min(1),
  eventType: TendersEventType,
  procedure: TendersProcedure,
  status: TendersStatus,
  officialTimeZone: TimeZone,
  currency: CurrencyCode,
});
export type AwardTenderRef = z.infer<typeof AwardTenderRef>;

/** A short tender reference (lists). */
export const TenderBrief = z.object({
  tenderId: Id,
  reference: Reference,
  title: z.string().min(1),
});
export type TenderBrief = z.infer<typeof TenderBrief>;

/** A lot reference. */
export const LotRef = z.object({
  lotId: Id,
  lotNo: z.number().int().min(1),
  title: z.string().min(1),
});
export type LotRef = z.infer<typeof LotRef>;

/** A supplier organization named on a buyer record. */
export const SupplierRef = z.object({
  supplierTenantId: Id,
  name: z.string().min(1),
});
export type SupplierRef = z.infer<typeof SupplierRef>;

/** A buyer organization named on a supplier or public record. */
export const BuyerRef = z.object({
  tenantId: Id,
  name: z.string().min(1),
  slug: Slug,
});
export type BuyerRef = z.infer<typeof BuyerRef>;

/** A hold (`holds`): a separate condition with an owner, reason, scope and blocked actions (PRD §8.2, BR-13). */
export const Hold = z.object({
  holdId: Id,
  subjectType: HoldsSubjectType,
  subjectLabel: z.string().min(1),
  holdType: HoldsHoldType,
  reason: z.string().min(1),
  owner: PersonRef,
  authorityNote: z.string().nullable(),
  blockedActions: z.array(HoldsBlockedActions).min(1),
  scopeDescription: z.string().min(1),
  startedAt: Instant,
  reviewDate: CalendarDate.nullable(),
  releasedAt: Instant.nullable(),
  releasedBy: PersonRef.nullable(),
  releaseReason: z.string().nullable(),
  complaintId: Id.nullable(),
  complaintReference: Reference.nullable(),
});
export type Hold = z.infer<typeof Hold>;

// ---------------------------------------------------------------------------------------------------------
// Lot outcomes and reconciliation (BR-33)
// ---------------------------------------------------------------------------------------------------------

/**
 * What a total of lot values represents (BR-31: a recommended or intended value is never presented as an award):
 * - `recommended`: at least one valued lot outcome is only proposed (draft or awaiting approval): NOT an award.
 * - `approved`: every valued outcome is approved, but no intention-to-award notice has been issued yet.
 * - `intended`: the intention to award is notified; the award is not final.
 * - `final_awarded`: every valued outcome is finally awarded.
 * The least advanced status of the valued outcomes decides, so a total is never overstated.
 */
export const AWARD_VALUE_BASES = ['recommended', 'approved', 'intended', 'final_awarded'] as const;
export const AwardValueBasis = z.enum(AWARD_VALUE_BASES);
export type AwardValueBasis = z.infer<typeof AwardValueBasis>;

/** Lot outcome statuses that count as an approved (decided) outcome; `recommended` is only proposed. */
export const APPROVED_LOT_OUTCOME_STATUSES: readonly LotOutcomesStatus[] = ['approved', 'intent_notified', 'final_awarded'];

/** The basis of the statuses of the valued lot outcomes (see `AWARD_VALUE_BASES`); `null` when nothing is valued. */
export function awardValueBasisOf(statuses: readonly LotOutcomesStatus[]): AwardValueBasis | null {
  if (statuses.length === 0) {
    return null;
  }
  if (statuses.some((status) => status === 'recommended' || status === 'withdrawn')) {
    return 'recommended';
  }
  if (statuses.includes('approved')) {
    return 'approved';
  }
  if (statuses.includes('intent_notified')) {
    return 'intended';
  }
  return 'final_awarded';
}

/**
 * The value of the awarding lot outcomes of the latest recommendation, labelled by what it represents.
 * `total` sums every valued lot; `finalAwardedTotal` is the part already finally awarded (the only awarded value).
 */
export const AwardValue = z.object({
  basis: AwardValueBasis,
  total: NonNegativeMoney,
  finalAwardedTotal: NonNegativeMoney,
});
export type AwardValue = z.infer<typeof AwardValue>;

/** One lot's explicit outcome (`lot_outcomes`). Supplier, bid and value are null only for no_award/cancelled. */
export const LotOutcome = z.object({
  lotOutcomeId: Id,
  recommendationId: Id,
  lot: LotRef,
  outcome: LotOutcomesOutcome,
  supplier: SupplierRef.nullable(),
  bidId: Id.nullable(),
  awardedValue: NonNegativeMoney.nullable(),
  conditions: z.string().nullable(),
  reason: z.string().nullable(),
  status: LotOutcomesStatus,
  finalAwardedAt: Instant.nullable(),
  finalAwardApprovalId: Id.nullable(),
  finalAwardApprovedBy: PersonRef.nullable(),
});
export type LotOutcome = z.infer<typeof LotOutcome>;

/** A contract allocation of a lot outcome (`contract_lot_allocations`, owned by contracts; read-only here). */
export const ContractAllocation = z.object({
  contractId: Id,
  contractReference: Reference,
  contractStatus: ContractsStatus,
  lotOutcomeId: Id,
  allocatedValue: NonNegativeMoney,
});
export type ContractAllocation = z.infer<typeof ContractAllocation>;

/**
 * Totals that must reconcile: lot values vs the recommendation total vs contract allocations, no double counting.
 * `value.basis` says whether the total is recommended, approved, intended or finally awarded (BR-31).
 */
export const AwardReconciliation = z.object({
  currency: CurrencyCode,
  value: AwardValue,
  lotTotals: z.array(
    z.object({
      lotId: Id,
      lotNo: z.number().int().min(1),
      outcome: LotOutcomesOutcome.nullable(),
      status: LotOutcomesStatus.nullable(),
      awardedValue: NonNegativeMoney.nullable(),
    }),
  ),
  contractAllocations: z.array(ContractAllocation),
  allocatedTotal: NonNegativeMoney,
  unallocated: Money,
  reconciles: z.boolean(),
  note: z.string().nullable(),
});
export type AwardReconciliation = z.infer<typeof AwardReconciliation>;

/**
 * The final-award approval of one lot outcome (DD-14: its own approval, `approval_requests.subject_type`
 * `final_award`, subject id = the lot outcome id). `requestable` is true when the approval may be requested now
 * (intention notified, no final-award approval yet, no blocking complaint hold); `unavailableReason` explains why not.
 */
export const FinalAwardApprovalState = z.object({
  lotOutcomeId: Id,
  subjectVersion: z.number().int().min(1),
  contentHash: ContentHash,
  approvalRequestId: Id.nullable(),
  requestable: z.boolean(),
  unavailableReason: z.string().nullable(),
});
export type FinalAwardApprovalState = z.infer<typeof FinalAwardApprovalState>;

/** A lot's award status on the award overview (per-lot timelines, AC-26). */
export const LotAwardStatus = z.object({
  lot: LotRef,
  stage: LotsStage,
  outcome: LotOutcome.nullable(),
  standstillStatus: StandstillPeriodsStatus.nullable(),
  standstillEndsAt: OfficialDeadline.nullable(),
  finalAwardGate: z.array(GateCheck),
  /** Null when the lot has no awarding outcome (no final award applies). */
  finalAwardApproval: FinalAwardApprovalState.nullable(),
});
export type LotAwardStatus = z.infer<typeof LotAwardStatus>;

// ---------------------------------------------------------------------------------------------------------
// Award register and overview (BUY-26)
// ---------------------------------------------------------------------------------------------------------

export const AwardRecommendationRef = z.object({
  recommendationId: Id,
  version: z.number().int().min(1),
  status: AwardRecommendationsStatus,
});
export type AwardRecommendationRef = z.infer<typeof AwardRecommendationRef>;

/** One tender in the award register. */
export const AwardRegisterRow = z.object({
  tender: AwardTenderRef,
  owner: PersonRef,
  lotCount: z.number().int().min(0),
  /** Lots whose outcome is approved (approved, intent notified or final awarded). */
  lotsWithOutcome: z.number().int().min(0),
  /** Lots whose outcome is only proposed in a recommendation that is not approved: never presented as decided. */
  lotsWithProposedOutcome: z.number().int().min(0),
  lotsFinalAwarded: z.number().int().min(0),
  latestRecommendation: AwardRecommendationRef.nullable(),
  /** The value of the latest recommendation, labelled by its basis (never "awarded" before the final award). */
  value: AwardValue.nullable(),
  standstillStatus: StandstillPeriodsStatus.nullable(),
  standstillEndsAt: OfficialDeadline.nullable(),
  activeHoldCount: z.number().int().min(0),
  openComplaintCount: z.number().int().min(0),
  closeoutStatus: EventCloseoutsStatus.nullable(),
  nextStep: AwardNextStep,
  updatedAt: Instant,
});
export type AwardRegisterRow = z.infer<typeof AwardRegisterRow>;

export const AWARD_REGISTER_SORT_FIELDS = ['reference', 'title', 'status', 'updatedAt', 'standstillEndsAt'] as const;
export const AwardRegisterQuery = listQueryWithSort(AWARD_REGISTER_SORT_FIELDS).extend({
  status: queryList(TendersStatus).optional(),
  recommendationStatus: queryList(AwardRecommendationsStatus).optional(),
  nextStep: queryList(AwardNextStep).optional(),
  closeoutStatus: queryList(EventCloseoutsStatus).optional(),
  view: AwardRegisterView.optional(),
  ownerUserId: IdParam.optional(),
  hasActiveHold: QueryBoolean.optional(),
  updatedFrom: CalendarDate.optional(),
  updatedTo: CalendarDate.optional(),
});
export type AwardRegisterQuery = z.input<typeof AwardRegisterQuery>;
export const AwardRegisterPage = pageOf(AwardRegisterRow);
export type AwardRegisterPage = z.infer<typeof AwardRegisterPage>;

/** The award file of one tender: per-lot outcomes, recommendations, reconciliation, holds and next step. */
export const AwardOverview = z.object({
  tender: AwardTenderRef,
  owner: PersonRef,
  awardModel: TendersAwardModel,
  lots: z.array(LotAwardStatus),
  recommendations: z.array(
    AwardRecommendationRef.extend({
      lotNos: z.array(z.number().int().min(1)),
      createdAt: Instant,
      decidedAt: Instant.nullable(),
    }),
  ),
  reconciliation: AwardReconciliation.nullable(),
  holds: z.array(Hold),
  openComplaintCount: z.number().int().min(0),
  openDebriefCount: z.number().int().min(0),
  publicNoticeStatus: PublicAwardNoticesStatus.nullable(),
  closeoutStatus: EventCloseoutsStatus.nullable(),
  nextStep: AwardNextStep,
});
export type AwardOverview = z.infer<typeof AwardOverview>;

// ---------------------------------------------------------------------------------------------------------
// Recommendation (BUY-26)
// ---------------------------------------------------------------------------------------------------------

/** Evaluation and commercial comparison of a compliant offer (read from evaluation; buyer-only). */
export const RecommendationOfferRow = z.object({
  bidId: Id,
  supplier: SupplierRef,
  lotNos: z.array(z.number().int().min(1)),
  complianceStatus: BidsComplianceStatus,
  technicalScore: Score.nullable(),
  commercialScore: Score.nullable(),
  totalScore: Score.nullable(),
  rank: z.number().int().min(1).nullable(),
  evaluatedPrice: NonNegativeMoney.nullable(),
  note: z.string().nullable(),
});
export type RecommendationOfferRow = z.infer<typeof RecommendationOfferRow>;

export const RecommendationQualificationRow = z.object({
  supplier: SupplierRef,
  status: VQualificationStatusEffectiveStatus,
  scope: z.string().min(1),
  validTo: CalendarDate.nullable(),
  conditions: z.string().nullable(),
});
export type RecommendationQualificationRow = z.infer<typeof RecommendationQualificationRow>;

export const RecommendationDiligenceRow = z.object({
  supplier: SupplierRef,
  caseStatus: DueDiligenceCasesStatus,
  blockingFindings: z.number().int().min(0),
  summary: z.string().min(1),
});
export type RecommendationDiligenceRow = z.infer<typeof RecommendationDiligenceRow>;

export const RecommendationAffordability = z.object({
  budgetAmount: NonNegativeMoney.nullable(),
  fundingConfirmed: z.boolean(),
  withinBudget: z.boolean(),
});
export type RecommendationAffordability = z.infer<typeof RecommendationAffordability>;

export const ProposedContract = z.object({
  supplier: SupplierRef,
  lotNos: z.array(z.number().int().min(1)).min(1),
  value: NonNegativeMoney,
  contractId: Id.nullable(),
  contractReference: Reference.nullable(),
  contractStatus: ContractsStatus.nullable(),
});
export type ProposedContract = z.infer<typeof ProposedContract>;

export const RecommendationApproval = z.object({
  approvalRequestId: Id.nullable(),
  status: ApprovalRequestsStatus.nullable(),
  approver: PersonRef.nullable(),
  decidedAt: Instant.nullable(),
  conditions: z.string().nullable(),
  rationale: z.string().nullable(),
});
export type RecommendationApproval = z.infer<typeof RecommendationApproval>;

export const RecommendationHistoryEntry = z.object({
  at: Instant,
  action: RecommendationHistoryAction,
  actor: PersonRef,
  version: z.number().int().min(1),
  note: z.string().nullable(),
});
export type RecommendationHistoryEntry = z.infer<typeof RecommendationHistoryEntry>;

/** The full recommendation (`award_recommendations` + projections + `lot_outcomes`). */
export const RecommendationDetail = z.object({
  recommendationId: Id,
  tender: AwardTenderRef,
  version: z.number().int().min(1),
  status: AwardRecommendationsStatus,
  summary: z.string(),
  compliantOffersSummary: z.string(),
  affordabilitySummary: z.string(),
  conflictsSummary: z.string(),
  exceptionsSummary: z.string(),
  negotiationSummary: z.string(),
  unresolvedConditions: z.string(),
  offers: z.array(RecommendationOfferRow),
  affordability: RecommendationAffordability,
  qualification: z.array(RecommendationQualificationRow),
  diligence: z.array(RecommendationDiligenceRow),
  unresolvedConflictCount: z.number().int().min(0),
  lotOutcomes: z.array(LotOutcome),
  reconciliation: AwardReconciliation,
  proposedContracts: z.array(ProposedContract),
  submissionChecks: z.array(GateCheck),
  approval: RecommendationApproval,
  history: z.array(RecommendationHistoryEntry),
  snapshotId: Id.nullable(),
  createdBy: PersonRef,
  createdAt: Instant,
  updatedAt: Instant,
});
export type RecommendationDetail = z.infer<typeof RecommendationDetail>;

export const CreateRecommendationBody = z.object({
  lotIds: z.array(Id).min(1, issue('LOTS_REQUIRED', 'Choose at least one lot.')),
  summary: z.string().trim().max(8000, issue('TEXT_TOO_LONG', 'At most 8000 characters.')).optional(),
});
export type CreateRecommendationBody = z.infer<typeof CreateRecommendationBody>;

const LongText = z.string().trim().max(8000, issue('TEXT_TOO_LONG', 'At most 8000 characters.'));

const AWARDING_OUTCOMES: readonly string[] = ['award', 'partial_award', 'conditional_award'];

/** One lot outcome as proposed in a draft recommendation. */
export const LotOutcomeInput = z
  .object({
    lotId: Id,
    outcome: LotOutcomesOutcome,
    bidId: Id.nullable(),
    awardedValue: NonNegativeMoney.nullable(),
    conditions: LongText.nullable(),
    reason: LongText.nullable(),
  })
  .superRefine((value, context) => {
    if (AWARDING_OUTCOMES.includes(value.outcome)) {
      if (value.bidId === null) {
        context.addIssue({ code: 'custom', path: ['bidId'], message: issue('AWARDED_BID_REQUIRED', 'Choose the awarded offer.') });
      }
      if (value.awardedValue === null) {
        context.addIssue({
          code: 'custom',
          path: ['awardedValue'],
          message: issue('AWARDED_VALUE_REQUIRED', 'Enter the awarded value.'),
        });
      }
    } else {
      if (value.bidId !== null) {
        context.addIssue({
          code: 'custom',
          path: ['bidId'],
          message: issue('NO_BID_FOR_NO_AWARD', 'A lot without an award has no awarded offer.'),
        });
      }
      if (value.reason === null || value.reason.length === 0) {
        context.addIssue({
          code: 'custom',
          path: ['reason'],
          message: issue('OUTCOME_REASON_REQUIRED', 'Explain why the lot has no award or is cancelled.'),
        });
      }
    }
    if (value.outcome === 'conditional_award' && (value.conditions === null || value.conditions.length === 0)) {
      context.addIssue({
        code: 'custom',
        path: ['conditions'],
        message: issue('CONDITIONS_REQUIRED', 'State the award conditions.'),
      });
    }
  });
export type LotOutcomeInput = z.infer<typeof LotOutcomeInput>;

export const UpdateRecommendationBody = z.object({
  summary: LongText,
  compliantOffersSummary: LongText,
  affordabilitySummary: LongText,
  conflictsSummary: LongText,
  exceptionsSummary: LongText,
  negotiationSummary: LongText,
  unresolvedConditions: LongText,
  lotOutcomes: z.array(LotOutcomeInput).min(1, issue('LOT_OUTCOME_MISSING', 'Every lot needs an explicit outcome.')),
});
export type UpdateRecommendationBody = z.infer<typeof UpdateRecommendationBody>;

export const SubmitRecommendationBody = z.object({
  note: z.string().trim().max(4000, issue('TEXT_TOO_LONG', 'At most 4000 characters.')).optional(),
});
export type SubmitRecommendationBody = z.infer<typeof SubmitRecommendationBody>;

export const DecideRecommendationBody = z
  .object({
    decision: RecommendationDecision,
    rationale: ReasonText,
    conditions: z.string().trim().max(4000, issue('TEXT_TOO_LONG', 'At most 4000 characters.')).optional(),
  })
  .superRefine((value, context) => {
    if (value.decision === 'approve_with_conditions' && (value.conditions === undefined || value.conditions.length === 0)) {
      context.addIssue({
        code: 'custom',
        path: ['conditions'],
        message: issue('CONDITIONS_REQUIRED', 'State the approval conditions.'),
      });
    }
  });
export type DecideRecommendationBody = z.infer<typeof DecideRecommendationBody>;

export const FinalAwardBody = z.object({
  confirmation: z.literal(true, { error: issue('CONFIRMATION_REQUIRED', 'Confirm the final award.') }),
  note: z.string().trim().max(4000, issue('TEXT_TOO_LONG', 'At most 4000 characters.')).optional(),
});
export type FinalAwardBody = z.infer<typeof FinalAwardBody>;

// ---------------------------------------------------------------------------------------------------------
// Outcome notices and standstill (BUY-28)
// ---------------------------------------------------------------------------------------------------------

export const NoticeRecipient = z.object({
  recipientId: Id,
  supplier: SupplierRef,
  recipientUser: PersonRef.nullable(),
  deliveryStatus: NoticeRecipientsDeliveryStatus,
  deliveredAt: Instant.nullable(),
  openedAt: Instant.nullable(),
  acknowledgedAt: Instant.nullable(),
  acknowledgedBy: PersonRef.nullable(),
  termsAcceptedAt: Instant.nullable(),
  failureReason: z.string().nullable(),
});
export type NoticeRecipient = z.infer<typeof NoticeRecipient>;

export const OutcomeNoticeSummary = z.object({
  noticeId: Id,
  tenderId: Id,
  noticeType: OutcomeNoticeType,
  version: z.number().int().min(1),
  title: z.string().min(1),
  status: NoticesStatus,
  lotNos: z.array(z.number().int().min(1)),
  requiresAcknowledgment: z.boolean(),
  periodStartBasis: NoticesPeriodStartBasis.nullable(),
  recipientCount: z.number().int().min(0),
  deliveredCount: z.number().int().min(0),
  failedCount: z.number().int().min(0),
  acknowledgedCount: z.number().int().min(0),
  issuedAt: Instant.nullable(),
  issuedBy: PersonRef.nullable(),
});
export type OutcomeNoticeSummary = z.infer<typeof OutcomeNoticeSummary>;

export const OutcomeNoticeDetail = OutcomeNoticeSummary.extend({
  body: z.string().min(1),
  audienceDescription: z.string().min(1),
  approvalRequestId: Id.nullable(),
  disclosureReview: z.object({
    status: DisclosureReviewStatus,
    reviewedBy: PersonRef.nullable(),
    reviewedAt: Instant.nullable(),
    note: z.string().nullable(),
  }),
  recipients: z.array(NoticeRecipient),
});
export type OutcomeNoticeDetail = z.infer<typeof OutcomeNoticeDetail>;

export const NOTICE_SORT_FIELDS = ['issuedAt', 'title', 'noticeType', 'status'] as const;
export const OutcomeNoticeListQuery = listQueryWithSort(NOTICE_SORT_FIELDS).extend({
  noticeType: queryList(OutcomeNoticeType).optional(),
  status: queryList(NoticesStatus).optional(),
  issuedFrom: CalendarDate.optional(),
  issuedTo: CalendarDate.optional(),
});
export type OutcomeNoticeListQuery = z.input<typeof OutcomeNoticeListQuery>;
export const OutcomeNoticePage = pageOf(OutcomeNoticeSummary);
export type OutcomeNoticePage = z.infer<typeof OutcomeNoticePage>;

export const CreateOutcomeNoticeBody = z.object({
  noticeType: DraftableOutcomeNoticeType,
  lotIds: z.array(Id).min(1, issue('LOTS_REQUIRED', 'Choose at least one lot.')),
  title: z.string().trim().min(5, issue('TITLE_TOO_SHORT', 'At least 5 characters.')).max(200, issue('TEXT_TOO_LONG', 'At most 200 characters.')),
  body: z.string().trim().min(20, issue('BODY_TOO_SHORT', 'At least 20 characters.')).max(20000, issue('TEXT_TOO_LONG', 'At most 20000 characters.')),
  requiresAcknowledgment: z.boolean(),
  periodStartBasis: NoticesPeriodStartBasis.optional(),
});
export type CreateOutcomeNoticeBody = z.infer<typeof CreateOutcomeNoticeBody>;

export const IssueOutcomeNoticeBody = z.object({
  disclosureReviewed: z.literal(true, {
    error: issue('DISCLOSURE_REVIEW_REQUIRED', 'Confirm that the disclosure review is complete.'),
  }),
  note: z.string().trim().max(4000, issue('TEXT_TOO_LONG', 'At most 4000 characters.')).optional(),
});
export type IssueOutcomeNoticeBody = z.infer<typeof IssueOutcomeNoticeBody>;

export const ResendNoticeResult = z.object({
  noticeId: Id,
  recipient: NoticeRecipient,
});
export type ResendNoticeResult = z.infer<typeof ResendNoticeResult>;

export const StandstillPeriod = z.object({
  standstillId: Id,
  tenderId: Id,
  lot: LotRef.nullable(),
  intentNoticeId: Id.nullable(),
  startsAt: OfficialDeadline,
  endsAt: OfficialDeadline,
  dayType: PolicyProfileVersionsStandstillDayType,
  extendedTo: OfficialDeadline.nullable(),
  extensionReason: z.string().nullable(),
  effectiveEndsAt: OfficialDeadline,
  status: StandstillPeriodsStatus,
  notApplicableReason: z.string().nullable(),
});
export type StandstillPeriod = z.infer<typeof StandstillPeriod>;

export const StandstillPolicy = z.object({
  standstillRequired: z.boolean(),
  standstillLength: z.number().int().min(0),
  standstillDayType: PolicyProfileVersionsStandstillDayType,
  calendarName: z.string().min(1),
  complaintWindowDays: z.number().int().min(0),
  policyLabel: z.string().min(1),
});
export type StandstillPolicy = z.infer<typeof StandstillPolicy>;

export const StandstillOverview = z.object({
  tender: AwardTenderRef,
  policy: StandstillPolicy,
  periods: z.array(StandstillPeriod),
  holds: z.array(Hold),
  blockedActions: z.array(HoldsBlockedActions),
  lotReadiness: z.array(
    z.object({
      lot: LotRef,
      lotOutcomeId: Id.nullable(),
      checks: z.array(GateCheck),
    }),
  ),
});
export type StandstillOverview = z.infer<typeof StandstillOverview>;

export const ExtendStandstillBody = z.object({
  extendedTo: Instant,
  reason: ReasonText,
  notifyParticipants: z.boolean(),
});
export type ExtendStandstillBody = z.infer<typeof ExtendStandstillBody>;

// ---------------------------------------------------------------------------------------------------------
// Public award notice (BUY-28 → PUB-05)
// ---------------------------------------------------------------------------------------------------------

export const BuyerPublicAwardNotice = z.object({
  publicNoticeId: Id,
  tenderId: Id,
  status: PublicAwardNoticesStatus,
  content: z.string(),
  disclosedValues: z.boolean(),
  reviewConfidentialityBy: PersonRef.nullable(),
  reviewPersonalInfoBy: PersonRef.nullable(),
  publishedAt: Instant.nullable(),
  updatedAt: Instant,
});
export type BuyerPublicAwardNotice = z.infer<typeof BuyerPublicAwardNotice>;

export const PublicNoticeState = z.object({
  tender: AwardTenderRef,
  notice: BuyerPublicAwardNotice.nullable(),
  finalAwardedLotCount: z.number().int().min(0),
});
export type PublicNoticeState = z.infer<typeof PublicNoticeState>;

export const SavePublicNoticeBody = z.object({
  content: z.string().trim().min(20, issue('CONTENT_TOO_SHORT', 'At least 20 characters.')).max(20000, issue('TEXT_TOO_LONG', 'At most 20000 characters.')),
  disclosedValues: z.boolean(),
});
export type SavePublicNoticeBody = z.infer<typeof SavePublicNoticeBody>;

export const ReviewPublicNoticeBody = z.object({
  area: PublicNoticeReviewArea,
  note: z.string().trim().max(4000, issue('TEXT_TOO_LONG', 'At most 4000 characters.')).optional(),
});
export type ReviewPublicNoticeBody = z.infer<typeof ReviewPublicNoticeBody>;

// ---------------------------------------------------------------------------------------------------------
// Debriefs (BUY-29, SUP-21)
// ---------------------------------------------------------------------------------------------------------

/** The recipient's own result, at the permitted level (AC-27). Never another bidder's scores or prices. */
export const DebriefOwnResult = z.object({
  totalScore: Score.nullable(),
  maxScore: Score,
  rank: z.number().int().min(1).nullable(),
  criteria: z.array(
    z.object({
      criterion: z.string().min(1),
      weight: Score,
      ownScore: Score.nullable(),
      maxScore: Score,
      feedback: z.string().min(1),
    }),
  ),
  successfulTenderAdvantages: z.string().nullable(),
});
export type DebriefOwnResult = z.infer<typeof DebriefOwnResult>;

export const DebriefRow = z.object({
  debriefId: Id,
  tender: TenderBrief,
  supplier: SupplierRef,
  bidId: Id,
  requestedBy: PersonRef,
  requestedAt: Instant,
  dueAt: OfficialDeadline,
  meetingAt: OfficialDeadline.nullable(),
  status: DebriefRequestsStatus,
  providedBy: PersonRef.nullable(),
});
export type DebriefRow = z.infer<typeof DebriefRow>;

export const DebriefDetail = DebriefRow.extend({
  requestNote: z.string().nullable(),
  writtenResponse: z.string().nullable(),
  effectOnDeadlines: z.string(),
  declineReason: z.string().nullable(),
  ownResult: DebriefOwnResult,
  challengeInstructions: z.string().min(1),
});
export type DebriefDetail = z.infer<typeof DebriefDetail>;

export const DEBRIEF_SORT_FIELDS = ['dueAt', 'requestedAt', 'status', 'reference'] as const;
export const DebriefListQuery = listQueryWithSort(DEBRIEF_SORT_FIELDS).extend({
  status: queryList(DebriefRequestsStatus).optional(),
  tenderId: IdParam.optional(),
  dueFrom: CalendarDate.optional(),
  dueTo: CalendarDate.optional(),
});
export type DebriefListQuery = z.input<typeof DebriefListQuery>;
export const DebriefPage = pageOf(DebriefRow);
export type DebriefPage = z.infer<typeof DebriefPage>;

export const ScheduleDebriefBody = z.object({
  meetingAt: Instant,
  effectOnDeadlines: z.string().trim().max(4000, issue('TEXT_TOO_LONG', 'At most 4000 characters.')).optional(),
});
export type ScheduleDebriefBody = z.infer<typeof ScheduleDebriefBody>;

export const ProvideDebriefBody = z.object({
  writtenResponse: z.string().trim().min(20, issue('RESPONSE_TOO_SHORT', 'At least 20 characters.')).max(20000, issue('TEXT_TOO_LONG', 'At most 20000 characters.')),
  effectOnDeadlines: z.string().trim().min(1, issue('EFFECT_REQUIRED', 'State the effect on deadlines (or none).')).max(4000, issue('TEXT_TOO_LONG', 'At most 4000 characters.')),
});
export type ProvideDebriefBody = z.infer<typeof ProvideDebriefBody>;

export const DeclineDebriefBody = z.object({ reason: ReasonText });
export type DeclineDebriefBody = z.infer<typeof DeclineDebriefBody>;

// ---------------------------------------------------------------------------------------------------------
// Complaints (BUY-29, SUP-22)
// ---------------------------------------------------------------------------------------------------------

export const ComplaintEvent = z.object({
  eventId: Id,
  eventType: ComplaintEventType,
  fromStatus: ComplaintsStatus.nullable(),
  toStatus: ComplaintsStatus.nullable(),
  note: z.string(),
  actor: PersonRef,
  occurredAt: Instant,
  supplierVisible: z.boolean(),
});
export type ComplaintEvent = z.infer<typeof ComplaintEvent>;

export const ComplaintRow = z.object({
  complaintId: Id,
  reference: Reference,
  tender: TenderBrief,
  lot: LotRef.nullable(),
  complainant: SupplierRef,
  subject: ComplaintsSubject,
  status: ComplaintsStatus,
  receivedAt: Instant,
  withinWindow: z.boolean(),
  standingConfirmed: z.boolean(),
  acknowledgedAt: Instant.nullable(),
  caseOwner: PersonRef.nullable(),
  independenceConfirmed: z.boolean(),
  isBlocking: z.boolean(),
  holdActive: z.boolean(),
  outcome: ComplaintsOutcome.nullable(),
  responseDueAt: OfficialDeadline.nullable(),
});
export type ComplaintRow = z.infer<typeof ComplaintRow>;

/**
 * One complaint case. Its evidence documents are the documents domain's records related to the complaint
 * (`documents.related_type = 'complaint'`, related id = the complaint id), read by buyer and complainant alike.
 */
export const ComplaintDetail = ComplaintRow.extend({
  grounds: z.string().min(1),
  complainantUser: PersonRef,
  hold: Hold.nullable(),
  responseText: z.string().nullable(),
  remedy: z.string().nullable(),
  appealGrounds: z.string().nullable(),
  appealOutcome: z.string().nullable(),
  closedAt: Instant.nullable(),
  publicSummary: z.string().nullable(),
  procurementEffect: z.object({
    blockedActions: z.array(HoldsBlockedActions),
    affectedLotOutcomeIds: z.array(Id),
    standstillEffect: z.string().nullable(),
  }),
  events: z.array(ComplaintEvent),
});
export type ComplaintDetail = z.infer<typeof ComplaintDetail>;

export const COMPLAINT_SORT_FIELDS = ['receivedAt', 'reference', 'status', 'responseDueAt'] as const;
export const ComplaintListQuery = listQueryWithSort(COMPLAINT_SORT_FIELDS).extend({
  status: queryList(ComplaintsStatus).optional(),
  subject: queryList(ComplaintsSubject).optional(),
  tenderId: IdParam.optional(),
  ownerUserId: IdParam.optional(),
  blocking: QueryBoolean.optional(),
  receivedFrom: CalendarDate.optional(),
  receivedTo: CalendarDate.optional(),
});
export type ComplaintListQuery = z.input<typeof ComplaintListQuery>;
export const ComplaintPage = pageOf(ComplaintRow);
export type ComplaintPage = z.infer<typeof ComplaintPage>;

export const AcknowledgeComplaintBody = z.object({
  standingConfirmed: z.boolean(),
  withinWindow: z.boolean(),
  note: z.string().trim().max(4000, issue('TEXT_TOO_LONG', 'At most 4000 characters.')).optional(),
});
export type AcknowledgeComplaintBody = z.infer<typeof AcknowledgeComplaintBody>;

/** A person who may own a complaint case: holds `complaint.manage`; `independent` is false for the challenged owner. */
export const ComplaintOwnerCandidate = z.object({
  person: PersonRef,
  capacity: z.string().nullable(),
  independent: z.boolean(),
  note: z.string().nullable(),
});
export type ComplaintOwnerCandidate = z.infer<typeof ComplaintOwnerCandidate>;

export const ComplaintOwnerCandidates = z.object({ candidates: z.array(ComplaintOwnerCandidate) });
export type ComplaintOwnerCandidates = z.infer<typeof ComplaintOwnerCandidates>;

export const AssignComplaintOwnerBody = z.object({
  caseOwnerUserId: Id,
  independenceConfirmed: z.literal(true, {
    error: issue('INDEPENDENCE_CONFIRMATION_REQUIRED', 'Confirm that the case owner is independent of the challenged conduct.'),
  }),
});
export type AssignComplaintOwnerBody = z.infer<typeof AssignComplaintOwnerBody>;

export const TransitionComplaintBody = z.object({
  toStatus: ComplaintBuyerTransition,
  note: ReasonText,
});
export type TransitionComplaintBody = z.infer<typeof TransitionComplaintBody>;

export const RespondComplaintBody = z
  .object({
    outcome: ComplaintResponseOutcome,
    responseText: z.string().trim().min(20, issue('RESPONSE_TOO_SHORT', 'At least 20 characters.')).max(20000, issue('TEXT_TOO_LONG', 'At most 20000 characters.')),
    remedy: z.string().trim().max(8000, issue('TEXT_TOO_LONG', 'At most 8000 characters.')).optional(),
    publicSummary: z.string().trim().max(4000, issue('TEXT_TOO_LONG', 'At most 4000 characters.')).optional(),
  })
  .superRefine((value, context) => {
    if ((value.outcome === 'upheld' || value.outcome === 'partially_upheld') && (value.remedy === undefined || value.remedy.length === 0)) {
      context.addIssue({
        code: 'custom',
        path: ['remedy'],
        message: issue('REMEDY_REQUIRED', 'A complaint that is upheld needs a remedy.'),
      });
    }
  });
export type RespondComplaintBody = z.infer<typeof RespondComplaintBody>;

export const RecordAppealOutcomeBody = z.object({ appealOutcome: ReasonText });
export type RecordAppealOutcomeBody = z.infer<typeof RecordAppealOutcomeBody>;

export const PlaceHoldBody = z.object({
  blockedActions: z.array(HoldsBlockedActions).min(1, issue('BLOCKED_ACTIONS_REQUIRED', 'Choose at least one blocked action.')),
  reason: ReasonText,
  reviewDate: CalendarDate,
});
export type PlaceHoldBody = z.infer<typeof PlaceHoldBody>;

export const ReleaseHoldBody = z.object({ reason: ReasonText });
export type ReleaseHoldBody = z.infer<typeof ReleaseHoldBody>;

// ---------------------------------------------------------------------------------------------------------
// Event closeout (BUY-30)
// ---------------------------------------------------------------------------------------------------------

export const CloseoutContract = z.object({
  contractId: Id,
  reference: Reference,
  status: ContractsStatus,
  supplier: SupplierRef,
  lotNos: z.array(z.number().int().min(1)),
  handoverStatus: HandoversStatus.nullable(),
});
export type CloseoutContract = z.infer<typeof CloseoutContract>;

export const EvidencePack = z.object({
  exportId: Id,
  exportType: z.literal('evidence_pack'),
  status: ExportsStatus,
  scopeDescription: z.string().min(1),
  requestedBy: PersonRef,
  requestedAt: Instant,
  completedAt: Instant.nullable(),
});
export type EvidencePack = z.infer<typeof EvidencePack>;

export const CloseoutState = z.object({
  tender: AwardTenderRef,
  closeoutId: Id.nullable(),
  status: EventCloseoutsStatus,
  isInformationOnly: z.boolean(),
  lots: z.array(
    z.object({
      lot: LotRef,
      stage: LotsStage,
      outcome: LotOutcomesOutcome.nullable(),
      outcomeStatus: LotOutcomesStatus.nullable(),
    }),
  ),
  contracts: z.array(CloseoutContract),
  outstandingComplaints: z.array(z.object({ complaintId: Id, reference: Reference, status: ComplaintsStatus })),
  openDebriefCount: z.number().int().min(0),
  securitiesNote: z.string().nullable(),
  lessonsLearned: z.string().nullable(),
  retentionClass: RetentionClassesRecordClass.nullable(),
  marketFindings: z.string().nullable(),
  nextStepDecision: z.string().nullable(),
  linkedNextTender: TenderBrief.nullable(),
  gate: z.array(GateCheck),
  blockingReasons: z.array(z.string()),
  closedBy: PersonRef.nullable(),
  closedAt: Instant.nullable(),
  archivedAt: Instant.nullable(),
  evidencePacks: z.array(EvidencePack),
});
export type CloseoutState = z.infer<typeof CloseoutState>;

export const UpdateCloseoutBody = z.object({
  lessonsLearned: LongText.nullable(),
  retentionClass: RetentionClassesRecordClass.nullable(),
  marketFindings: LongText.nullable(),
  nextStepDecision: LongText.nullable(),
  linkedNextTenderId: Id.nullable(),
  securitiesNote: LongText.nullable(),
});
export type UpdateCloseoutBody = z.infer<typeof UpdateCloseoutBody>;

export const CloseEventBody = z.object({
  confirmation: z.literal(true, { error: issue('CONFIRMATION_REQUIRED', 'Confirm the event closure.') }),
});
export type CloseEventBody = z.infer<typeof CloseEventBody>;

export const ArchiveEventBody = z.object({
  confirmation: z.literal(true, { error: issue('CONFIRMATION_REQUIRED', 'Confirm the archive.') }),
});
export type ArchiveEventBody = z.infer<typeof ArchiveEventBody>;

export const RequestEvidencePackBody = z.object({
  scopeDescription: z.string().trim().min(5, issue('SCOPE_TOO_SHORT', 'Describe the scope (at least 5 characters).')).max(1000, issue('TEXT_TOO_LONG', 'At most 1000 characters.')),
});
export type RequestEvidencePackBody = z.infer<typeof RequestEvidencePackBody>;

// ---------------------------------------------------------------------------------------------------------
// Supplier outcomes (SUP-21)
// ---------------------------------------------------------------------------------------------------------

export const SupplierOutcomeLot = z.object({
  lot: LotRef,
  result: SupplierLotResult,
  awardedValue: NonNegativeMoney.nullable(),
  conditions: z.string().nullable(),
  reason: z.string().nullable(),
});
export type SupplierOutcomeLot = z.infer<typeof SupplierOutcomeLot>;

export const SupplierOutcomeRow = z.object({
  tenderId: Id,
  buyer: BuyerRef,
  reference: Reference,
  title: z.string().min(1),
  result: SupplierOutcomeResult,
  lots: z.array(SupplierOutcomeLot),
  latestNoticeAt: Instant,
  standstillEndsAt: OfficialDeadline.nullable(),
  awaitingAcknowledgment: z.number().int().min(0),
  debriefStatus: DebriefRequestsStatus.nullable(),
  openComplaintCount: z.number().int().min(0),
});
export type SupplierOutcomeRow = z.infer<typeof SupplierOutcomeRow>;

export const SupplierOutcomeNotice = z.object({
  noticeId: Id,
  noticeType: OutcomeNoticeType,
  title: z.string().min(1),
  body: z.string().min(1),
  lotNos: z.array(z.number().int().min(1)),
  issuedAt: Instant,
  requiresAcknowledgment: z.boolean(),
  hasTerms: z.boolean(),
  acknowledgedAt: Instant.nullable(),
  acknowledgedBy: PersonRef.nullable(),
  termsAcceptedAt: Instant.nullable(),
});
export type SupplierOutcomeNotice = z.infer<typeof SupplierOutcomeNotice>;

export const SupplierDebrief = z.object({
  debriefId: Id,
  status: DebriefRequestsStatus,
  requestedBy: PersonRef,
  requestedAt: Instant,
  dueAt: OfficialDeadline,
  meetingAt: OfficialDeadline.nullable(),
  writtenResponse: z.string().nullable(),
  effectOnDeadlines: z.string(),
  declineReason: z.string().nullable(),
  ownResult: DebriefOwnResult.nullable(),
});
export type SupplierDebrief = z.infer<typeof SupplierDebrief>;

export const SupplierOutcomeDetail = SupplierOutcomeRow.extend({
  officialTimeZone: TimeZone,
  notices: z.array(SupplierOutcomeNotice),
  standstill: z
    .object({
      status: StandstillPeriodsStatus,
      endsAt: OfficialDeadline,
      extendedTo: OfficialDeadline.nullable(),
      effectiveEndsAt: OfficialDeadline,
      dayType: PolicyProfileVersionsStandstillDayType,
      extensionReason: z.string().nullable(),
    })
    .nullable(),
  procurementHoldActive: z.boolean(),
  debrief: SupplierDebrief.nullable(),
  canRequestDebrief: z.boolean(),
  debriefDeadline: OfficialDeadline.nullable(),
  debriefInstructions: z.string().min(1),
  challengeInstructions: z.string().min(1),
  complaintDeadline: OfficialDeadline.nullable(),
  complaints: z.array(z.object({ complaintId: Id, reference: Reference, status: ComplaintsStatus })),
});
export type SupplierOutcomeDetail = z.infer<typeof SupplierOutcomeDetail>;

export const SUPPLIER_OUTCOME_SORT_FIELDS = ['latestNoticeAt', 'reference', 'title'] as const;
export const SupplierOutcomeListQuery = listQueryWithSort(SUPPLIER_OUTCOME_SORT_FIELDS).extend({
  result: queryList(SupplierOutcomeResult).optional(),
  awaitingAcknowledgment: QueryBoolean.optional(),
  noticeFrom: CalendarDate.optional(),
  noticeTo: CalendarDate.optional(),
});
export type SupplierOutcomeListQuery = z.input<typeof SupplierOutcomeListQuery>;
export const SupplierOutcomePage = pageOf(SupplierOutcomeRow);
export type SupplierOutcomePage = z.infer<typeof SupplierOutcomePage>;

export const NoticeAcknowledgment = z.object({
  noticeId: Id,
  acknowledgedAt: Instant,
  acknowledgedBy: PersonRef,
  termsAcceptedAt: Instant.nullable(),
});
export type NoticeAcknowledgment = z.infer<typeof NoticeAcknowledgment>;

export const AcceptNoticeTermsBody = z.object({
  confirmation: z.literal(true, { error: issue('CONFIRMATION_REQUIRED', 'Confirm that you accept the terms.') }),
});
export type AcceptNoticeTermsBody = z.infer<typeof AcceptNoticeTermsBody>;

export const RequestDebriefBody = z.object({
  note: z.string().trim().max(4000, issue('TEXT_TOO_LONG', 'At most 4000 characters.')).optional(),
});
export type RequestDebriefBody = z.infer<typeof RequestDebriefBody>;

// ---------------------------------------------------------------------------------------------------------
// Supplier complaints (SUP-22)
// ---------------------------------------------------------------------------------------------------------

export const SupplierComplaintRow = z.object({
  complaintId: Id,
  reference: Reference,
  buyer: BuyerRef,
  tender: TenderBrief,
  lot: LotRef.nullable(),
  subject: ComplaintsSubject,
  status: ComplaintsStatus,
  receivedAt: Instant,
  acknowledgedAt: Instant.nullable(),
  outcome: ComplaintsOutcome.nullable(),
  procurementHoldActive: z.boolean(),
  responseDueAt: OfficialDeadline.nullable(),
});
export type SupplierComplaintRow = z.infer<typeof SupplierComplaintRow>;

export const SupplierComplaintDetail = SupplierComplaintRow.extend({
  grounds: z.string().min(1),
  complainantUser: PersonRef,
  withinWindow: z.boolean(),
  responseText: z.string().nullable(),
  remedy: z.string().nullable(),
  appealGrounds: z.string().nullable(),
  appealOutcome: z.string().nullable(),
  appealAvailable: z.boolean(),
  appealDeadline: OfficialDeadline.nullable(),
  closedAt: Instant.nullable(),
  events: z.array(ComplaintEvent),
});
export type SupplierComplaintDetail = z.infer<typeof SupplierComplaintDetail>;

export const SUPPLIER_COMPLAINT_SORT_FIELDS = ['receivedAt', 'reference', 'status'] as const;
export const SupplierComplaintListQuery = listQueryWithSort(SUPPLIER_COMPLAINT_SORT_FIELDS).extend({
  status: queryList(ComplaintsStatus).optional(),
  subject: queryList(ComplaintsSubject).optional(),
  receivedFrom: CalendarDate.optional(),
  receivedTo: CalendarDate.optional(),
});
export type SupplierComplaintListQuery = z.input<typeof SupplierComplaintListQuery>;
export const SupplierComplaintPage = pageOf(SupplierComplaintRow);
export type SupplierComplaintPage = z.infer<typeof SupplierComplaintPage>;

/** A tender the supplier may lodge a complaint about (it took part, or the tender is open to everyone). */
export const ComplaintTenderOption = z.object({
  tenderId: Id,
  buyer: BuyerRef,
  reference: Reference,
  title: z.string().min(1),
  status: TendersStatus,
  lots: z.array(LotRef),
  complaintDeadline: OfficialDeadline.nullable(),
});
export type ComplaintTenderOption = z.infer<typeof ComplaintTenderOption>;

export const ComplaintTenderOptions = z.object({ tenders: z.array(ComplaintTenderOption) });
export type ComplaintTenderOptions = z.infer<typeof ComplaintTenderOptions>;

export const CreateComplaintBody = z.object({
  tenderId: Id,
  lotId: Id.optional(),
  subject: ComplaintsSubject,
  grounds: z.string().trim().min(20, issue('GROUNDS_TOO_SHORT', 'Describe the grounds (at least 20 characters).')).max(20000, issue('TEXT_TOO_LONG', 'At most 20000 characters.')),
  evidenceDocumentIds: z.array(Id).max(20, issue('TOO_MANY_DOCUMENTS', 'At most 20 documents.')).optional(),
});
export type CreateComplaintBody = z.infer<typeof CreateComplaintBody>;

export const AppealComplaintBody = z.object({
  appealGrounds: z.string().trim().min(20, issue('GROUNDS_TOO_SHORT', 'Describe the appeal grounds (at least 20 characters).')).max(20000, issue('TEXT_TOO_LONG', 'At most 20000 characters.')),
});
export type AppealComplaintBody = z.infer<typeof AppealComplaintBody>;

export const WithdrawComplaintBody = z.object({ reason: ReasonText });
export type WithdrawComplaintBody = z.infer<typeof WithdrawComplaintBody>;

// ---------------------------------------------------------------------------------------------------------
// Public awards (PUB-05)
// ---------------------------------------------------------------------------------------------------------

export const PublicAwardLot = z.object({
  lotNo: z.number().int().min(1),
  title: z.string().min(1),
  outcome: LotOutcomesOutcome.nullable(),
  supplierName: z.string().nullable(),
  awardedValue: NonNegativeMoney.nullable(),
  finalAwardedAt: Instant.nullable(),
});
export type PublicAwardLot = z.infer<typeof PublicAwardLot>;

export const PublicAwardRow = z.object({
  buyer: z.object({ name: z.string().min(1), slug: Slug }),
  reference: Reference,
  title: z.string().min(1),
  eventType: TendersEventType,
  tenderStatus: PublicAwardTenderStatus,
  publishedAt: Instant,
  lots: z.array(PublicAwardLot),
  disclosedValues: z.boolean(),
  totalAwardedValue: NonNegativeMoney.nullable(),
});
export type PublicAwardRow = z.infer<typeof PublicAwardRow>;

export const PublicAwardDetail = PublicAwardRow.extend({
  officialTimeZone: TimeZone,
  content: z.string().min(1),
  noticeFileName: z.string().min(1),
});
export type PublicAwardDetail = z.infer<typeof PublicAwardDetail>;

export const PUBLIC_AWARD_SORT_FIELDS = ['publishedAt', 'reference', 'title'] as const;
export const PublicAwardListQuery = listQueryWithSort(PUBLIC_AWARD_SORT_FIELDS).extend({
  buyerSlug: Slug.optional(),
  outcome: queryList(LotOutcomesOutcome).optional(),
  eventType: queryList(TendersEventType).optional(),
  publishedFrom: CalendarDate.optional(),
  publishedTo: CalendarDate.optional(),
});
export type PublicAwardListQuery = z.input<typeof PublicAwardListQuery>;
export const PublicAwardPage = pageOf(PublicAwardRow);
export type PublicAwardPage = z.infer<typeof PublicAwardPage>;

export const PublicAwardParams = z.object({ buyerSlug: Slug, reference: Reference });

/** The approved public edition of the notice, as a downloadable text document. */
export const PublicAwardNoticeFile = z.object({
  fileName: z.string().min(1),
  contentType: z.literal('text/plain'),
  content: z.string().min(1),
});
export type PublicAwardNoticeFile = z.infer<typeof PublicAwardNoticeFile>;
