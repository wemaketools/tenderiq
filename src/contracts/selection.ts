/**
 * Selection contract: demonstrations, interviews and reference checks, shortlists and stage progression,
 * conditional preferred bidders, due diligence, negotiation and final-offer (BAFO) rounds (PRD §7.12, §7.13, §20;
 * FR-15, FR-16, BR-30, BR-31; BUY-22..BUY-25, BUY-27, SUP-18 assessment invites, SUP-19; AC-21..AC-24).
 *
 * Business rules the contract fixes for both stages:
 * - Every assessment session declares its basis (`scored_criterion`, `claim_verification`, `eligibility_gate`)
 *   before invitations; a finding may only carry an effect the basis allows (`ASSESSMENT_BASIS_EFFECTS`, AC-21).
 *   Equal treatment is confirmed before invitations are issued, and each invitee gets the declared preparation time.
 * - Reference feedback is recorded only with the referee's consent (`REFERENCE_CONSENT_REQUIRED`); confidential
 *   feedback is returned only to callers holding `selection.manage` (the others get `feedbackRestricted`).
 * - A shortlist names its rule and threshold; every entry has a reason; approval goes through the shared approvals
 *   contract (subject `shortlist`); outcome notices and next-stage invitations go only to the right audience (AC-22).
 *   A change after approval needs a reason and returns the shortlist for approval.
 * - Preferred-bidder status is conditional (BR-31): scope, proposed value, rationale, remaining checks, authorized
 *   negotiation topics, decision owner, contingency and fallback. It is never an award or a contract.
 * - Due diligence findings are recorded per area with a disposition; an unresolved finding needs an owner and a due
 *   date. A failed case blocks the award and requires a recorded fallback decision (AC-24).
 * - Negotiation and final-offer rounds require explicit procedural authority (BR-30). When the issued conditions do
 *   not permit them, the command is refused (`NEGOTIATION_NOT_PERMITTED`, `BAFO_NOT_PERMITTED`) and a process
 *   decision is required (`PROCESS_DECISION_REQUIRED`, AC-23). A clarification never replaces a negotiation round.
 * - Buyer-internal tables are `[R]` (DD-03): suppliers see only their own invitations, their own negotiation rounds
 *   marked `supplierVisible`, and final-offer rounds they are invited to (SUP-18, SUP-19).
 *
 * Pure module: zod and sibling contract files only.
 */
import { z } from 'zod';

import { ContentHash } from './approvals.js';
import {
  CalendarDate,
  Id,
  IdParam,
  Instant,
  LinkPath,
  Money,
  NonNegativeDecimalString,
  NonNegativeMoney,
  OfficialDeadline,
  PersonRef,
  QueryBoolean,
  ReasonText,
  Reference,
  Score,
  TimeZone,
  issue,
  listQueryWithSort,
  pageOf,
  queryList,
} from './common.js';
import { defineEndpoint } from './endpoint.js';
import type { EndpointPermission } from './endpoint.js';
import {
  ApprovalRequestsStatus,
  AssessmentFindingsEffect,
  AssessmentInvitesStatus,
  AssessmentSessionsAssessmentBasis,
  AssessmentSessionsSessionType,
  AssessmentSessionsStatus,
  BidClarificationsStatus,
  DueDiligenceCasesStatus,
  DueDiligenceFindingsArea,
  DueDiligenceFindingsDisposition,
  FinalOfferRoundsStatus,
  NegotiationsStatus,
  NoticesNoticeType,
  NoticesStatus,
  PreferredBiddersStatus,
  ProcessDecisionsDecisionType,
  ProcessDecisionsStatus,
  ShortlistsStatus,
  TendersEventType,
  TendersProcedure,
  TendersStatus,
} from './enums.js';
import type { AssessmentFindingsEffect as FindingEffect, AssessmentSessionsAssessmentBasis as Basis } from './enums.js';

// ---------------------------------------------------------------------------------------------------------
// Rules shared by the SPA, the mock API and Stage B
// ---------------------------------------------------------------------------------------------------------

/** The finding effects each declared assessment basis allows (AC-21: the effect follows the announced basis). */
export const ASSESSMENT_BASIS_EFFECTS = {
  scored_criterion: ['score_input'],
  claim_verification: ['claim_verified', 'claim_not_verified'],
  eligibility_gate: ['gate_passed', 'gate_failed'],
} as const satisfies Record<Basis, readonly FindingEffect[]>;

/** True when `effect` is allowed for a session with the given basis. */
export function isEffectAllowed(basis: Basis, effect: FindingEffect): boolean {
  const allowed: readonly FindingEffect[] = ASSESSMENT_BASIS_EFFECTS[basis];
  return allowed.includes(effect);
}

/** Preferred-bidder statuses that still hold the conditional selection (at most one per tender and lot). */
export const ACTIVE_PREFERRED_BIDDER_STATUSES = ['proposed', 'awaiting_approval', 'approved'] as const satisfies readonly z.infer<
  typeof PreferredBiddersStatus
>[];

/** Who may read the selection records of a tender (buyer-internal, DD-03). */
export const SELECTION_VIEW_PERMISSIONS = [
  'selection.manage',
  'shortlist.approve',
  'diligence.manage',
  'negotiation.conduct',
  'negotiation.approve',
  'award.approve',
  'audit.view',
] as const satisfies EndpointPermission;

/** Assessment sessions are also read by the evaluation panel that records findings. */
export const ASSESSMENT_VIEW_PERMISSIONS = [
  ...SELECTION_VIEW_PERMISSIONS,
  'evaluation.chair',
  'evaluation.score',
] as const satisfies EndpointPermission;

/** Who may record an assessment finding (the organizer or an assigned assessor). */
export const FINDING_RECORD_PERMISSIONS = ['selection.manage', 'evaluation.score'] as const satisfies EndpointPermission;

/** Who may decide a due-diligence case (the case owner's team or the approving manager). */
export const DILIGENCE_DECIDE_PERMISSIONS = ['diligence.manage', 'shortlist.approve'] as const satisfies EndpointPermission;

/** Supplier roles that may read their organization's negotiation and final-offer records (SUP-19). */
export const SUPPLIER_NEGOTIATION_VIEW_PERMISSIONS = [
  'supplier.outcomes.view',
  'supplier.pricing.edit',
] as const satisfies EndpointPermission;

/** Supplier roles that may send an internally approved round response for the organization (SUP-19). */
export const SUPPLIER_ROUND_RESPOND_PERMISSIONS = [
  'supplier.response.approve',
  'supplier.notices.acknowledge',
] as const satisfies EndpointPermission;

// ---------------------------------------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------------------------------------

function requiredText(max: number) {
  return z
    .string({ error: issue('TEXT_REQUIRED', 'This field is required.') })
    .trim()
    .min(1, issue('TEXT_REQUIRED', 'This field is required.'))
    .max(max, issue('TEXT_TOO_LONG', `At most ${max} characters.`));
}

function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max, issue('TEXT_TOO_LONG', `At most ${max} characters.`))
    .nullable()
    .optional();
}

const TopicText = z
  .string()
  .trim()
  .min(1, issue('TOPIC_REQUIRED', 'A topic cannot be empty.'))
  .max(200, issue('TEXT_TOO_LONG', 'At most 200 characters.'));

/** A business rule that currently blocks an action, with the explanation the UI shows (AC-23, AC-24). */
export const SelectionBlocker = z.object({
  code: z.string().regex(/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/),
  message: z.string().min(1),
});
export type SelectionBlocker = z.infer<typeof SelectionBlocker>;

/** Whether an action is available now and, if not, every reason why. */
export const SelectionGate = z.object({
  allowed: z.boolean(),
  blockers: z.array(SelectionBlocker),
});
export type SelectionGate = z.infer<typeof SelectionGate>;

/** The tender a selection record belongs to. Deadlines of the tender use `officialTimeZone`. */
export const SelectionTenderRef = z.object({
  tenderId: Id,
  reference: Reference,
  title: z.string().min(1),
  officialTimeZone: TimeZone,
});
export type SelectionTenderRef = z.infer<typeof SelectionTenderRef>;

/** A lot of the tender (`null` on records that apply to the whole tender). */
export const SelectionLotRef = z.object({
  lotId: Id,
  lotNo: z.number().int().min(1),
  title: z.string().min(1),
});
export type SelectionLotRef = z.infer<typeof SelectionLotRef>;

/** A bid as buyer selection screens show it: the legal supplier valid at receipt and whether it is a variant. */
export const SelectionBidRef = z.object({
  bidId: Id,
  supplierTenantId: Id,
  supplierName: z.string().min(1),
  isAlternative: z.boolean(),
});
export type SelectionBidRef = z.infer<typeof SelectionBidRef>;

/** The latest approval of a subject (details and decisions live in the approvals contract). */
export const SelectionApprovalSummary = z.object({
  approvalRequestId: Id,
  status: ApprovalRequestsStatus,
  requestedAt: Instant,
  decidedAt: Instant.nullable(),
});
export type SelectionApprovalSummary = z.infer<typeof SelectionApprovalSummary>;

/** The exact version of a subject the approvals panel requests approval for (COM-05, BR-10). */
export const SelectionApprovalSubject = z.object({
  subjectType: z.enum(['shortlist', 'preferred_bidder', 'negotiation_mandate', 'final_offer_round', 'process_decision']),
  subjectId: Id,
  subjectVersion: z.number().int().min(1),
  contentHash: ContentHash,
});
export type SelectionApprovalSubject = z.infer<typeof SelectionApprovalSubject>;

/** A formal notice issued from a selection record (`notices`). */
export const SelectionNoticeSummary = z.object({
  noticeId: Id,
  noticeType: NoticesNoticeType,
  status: NoticesStatus,
  title: z.string().min(1),
  issuedAt: Instant.nullable(),
});
export type SelectionNoticeSummary = z.infer<typeof SelectionNoticeSummary>;

/** A candidate of the selection stage: a received, compliant bid with its evaluation standing. */
export const SelectionCandidate = z.object({
  bid: SelectionBidRef,
  lot: SelectionLotRef.nullable(),
  /** Non-price points of the stage (`evaluation_results.non_price_score`); shortlist thresholds apply to it. */
  nonPriceScore: Score.nullable(),
  /** Evaluation total of the stage (`evaluation_results.total_score`); `null` when not ranked or not yet evaluated. */
  totalScore: Score.nullable(),
  rank: z.number().int().min(1).nullable(),
  passesGates: z.boolean(),
  /** Evaluated offer value used for comparison; `null` while prices are sealed. */
  evaluatedValue: Money.nullable(),
  /** `true` included, `false` excluded, `null` not on an approved shortlist. */
  shortlisted: z.boolean().nullable(),
});
export type SelectionCandidate = z.infer<typeof SelectionCandidate>;

const DateFrom = CalendarDate.optional();

// ---------------------------------------------------------------------------------------------------------
// Selection register and tender summary
// ---------------------------------------------------------------------------------------------------------

/** The procedure conditions that govern selection (`tenders.*_permitted`), as issued. */
export const SelectionConditions = z.object({
  demonstrationsPermitted: z.boolean(),
  referencesPermitted: z.boolean(),
  negotiationPermitted: z.boolean(),
  bafoPermitted: z.boolean(),
  alternativesAllowed: z.boolean(),
  /** The issued clause the conditions come from, quoted on blocked actions. */
  conditionsNote: z.string().min(1),
});
export type SelectionConditions = z.infer<typeof SelectionConditions>;

export const SelectionTenderRow = z.object({
  tenderId: Id,
  reference: Reference,
  title: z.string().min(1),
  eventType: TendersEventType,
  procedure: TendersProcedure,
  status: TendersStatus,
  stageNo: z.number().int().min(1),
  owner: PersonRef,
  officialTimeZone: TimeZone,
  conditions: SelectionConditions,
  sessionCount: z.number().int().min(0),
  shortlistStatus: ShortlistsStatus.nullable(),
  preferredBidderStatus: PreferredBiddersStatus.nullable(),
  dueDiligenceStatus: DueDiligenceCasesStatus.nullable(),
  negotiationStatus: NegotiationsStatus.nullable(),
  /** Number of actions blocked right now (award, negotiation, final offers). */
  blockerCount: z.number().int().min(0),
  updatedAt: Instant,
});
export type SelectionTenderRow = z.infer<typeof SelectionTenderRow>;

export const SelectionTenderListQuery = listQueryWithSort(['reference', 'updatedAt', 'status'] as const).extend({
  status: queryList(TendersStatus).optional(),
  procedure: queryList(TendersProcedure).optional(),
  ownerUserId: IdParam.optional(),
  hasBlockers: QueryBoolean.optional(),
});
export type SelectionTenderListQuery = z.output<typeof SelectionTenderListQuery>;

export const TenderSelectionSummary = z.object({
  tender: SelectionTenderRow,
  lots: z.array(SelectionLotRef),
  candidates: z.array(SelectionCandidate),
  /** Buyer team members of this tender who can read its selection records. */
  team: z.array(PersonRef),
  /**
   * Team members eligible for each assignment: decision owners hold `selection.manage`, due-diligence finding owners
   * hold `diligence.manage` and negotiators hold `negotiation.conduct` (DECISION_OWNER_NOT_ELIGIBLE,
   * FINDING_OWNER_NOT_ELIGIBLE, NEGOTIATOR_NOT_ELIGIBLE).
   */
  eligible: z.object({
    decisionOwners: z.array(PersonRef),
    findingOwners: z.array(PersonRef),
    negotiators: z.array(PersonRef),
  }),
  /** Evaluation criteria a scored session can feed (`evaluation_criteria`). */
  criteria: z.array(z.object({ criterionId: Id, name: z.string().min(1), weight: Score })),
  gates: z.object({
    negotiation: SelectionGate,
    finalOffer: SelectionGate,
    award: SelectionGate,
  }),
});
export type TenderSelectionSummary = z.infer<typeof TenderSelectionSummary>;

export const TenderParams = z.object({ tenderId: IdParam });

// ---------------------------------------------------------------------------------------------------------
// Assessment sessions, invitations, findings, reference checks (BUY-22, SUP-18)
// ---------------------------------------------------------------------------------------------------------

export const AssessmentSessionRow = z.object({
  sessionId: Id,
  tender: SelectionTenderRef,
  lot: SelectionLotRef.nullable(),
  sessionType: AssessmentSessionsSessionType,
  purpose: z.string().min(1),
  assessmentBasis: AssessmentSessionsAssessmentBasis,
  criterion: z.object({ criterionId: Id, name: z.string().min(1), weight: Score }).nullable(),
  status: AssessmentSessionsStatus,
  preparationDays: z.number().int().min(0),
  /** Earliest scheduled appointment of the session; `null` before invitations. */
  firstScheduledAt: Instant.nullable(),
  inviteCount: z.number().int().min(0),
  confirmedCount: z.number().int().min(0),
  findingCount: z.number().int().min(0),
  equalTreatmentConfirmed: z.boolean(),
  createdBy: PersonRef,
  updatedAt: Instant,
});
export type AssessmentSessionRow = z.infer<typeof AssessmentSessionRow>;

export const AssessmentInvite = z.object({
  inviteId: Id,
  bid: SelectionBidRef,
  scheduledAt: Instant.nullable(),
  status: AssessmentInvitesStatus,
  invitedAt: Instant,
  supplierConfirmedAt: Instant.nullable(),
  supplierConfirmedBy: PersonRef.nullable(),
});
export type AssessmentInvite = z.infer<typeof AssessmentInvite>;

export const AssessmentFinding = z.object({
  findingId: Id,
  bid: SelectionBidRef,
  assessor: PersonRef,
  finding: z.string().min(1),
  effect: AssessmentFindingsEffect,
  evidenceDocumentId: Id.nullable(),
  evidenceTitle: z.string().nullable(),
  recordedAt: Instant,
});
export type AssessmentFinding = z.infer<typeof AssessmentFinding>;

/** One equal-treatment check derived from the session and its invitations (FR-15). */
export const EqualTreatmentCheck = z.object({
  check: z.enum(['basis_declared', 'same_instructions', 'preparation_time', 'all_candidates_invited', 'no_undisclosed_criteria']),
  satisfied: z.boolean(),
  detail: z.string().min(1),
});
export type EqualTreatmentCheck = z.infer<typeof EqualTreatmentCheck>;

export const ReferenceCheck = z.object({
  referenceCheckId: Id,
  tender: SelectionTenderRef,
  bid: SelectionBidRef,
  refereeName: z.string().min(1),
  refereeOrganization: z.string().min(1),
  consentConfirmed: z.boolean(),
  contactedAt: Instant.nullable(),
  /** `null` when not yet recorded, or when confidential and the caller may not read it (`feedbackRestricted`). */
  feedback: z.string().nullable(),
  feedbackRestricted: z.boolean(),
  confidential: z.boolean(),
  assessor: PersonRef.nullable(),
  outcome: z.string().nullable(),
  updatedAt: Instant,
});
export type ReferenceCheck = z.infer<typeof ReferenceCheck>;

export const AssessmentSessionDetail = AssessmentSessionRow.extend({
  agenda: z.string().min(1),
  instructions: z.string().min(1),
  equalTreatment: z.object({
    confirmedBy: PersonRef.nullable(),
    confirmedAt: Instant.nullable(),
    checks: z.array(EqualTreatmentCheck),
  }),
  /** The announced evaluation treatment of the basis (the only effects a finding may carry). */
  treatment: z.object({
    allowedEffects: z.array(AssessmentFindingsEffect).min(1),
    description: z.string().min(1),
  }),
  invites: z.array(AssessmentInvite),
  findings: z.array(AssessmentFinding),
  referenceChecks: z.array(ReferenceCheck),
  /** Candidates that could still be invited (compliant, in scope, not yet invited). */
  invitableBids: z.array(SelectionBidRef),
  completionSummary: z.string().nullable(),
  cancellationReason: z.string().nullable(),
});
export type AssessmentSessionDetail = z.infer<typeof AssessmentSessionDetail>;

export const AssessmentSessionListQuery = listQueryWithSort([
  'firstScheduledAt',
  'tenderReference',
  'status',
  'updatedAt',
] as const).extend({
  tenderId: IdParam.optional(),
  sessionType: queryList(AssessmentSessionsSessionType).optional(),
  assessmentBasis: queryList(AssessmentSessionsAssessmentBasis).optional(),
  status: queryList(AssessmentSessionsStatus).optional(),
  createdByUserId: IdParam.optional(),
  /** Scheduled on or after this date (official zone of the tender). */
  from: DateFrom,
  /** Scheduled on or before this date. */
  to: DateFrom,
});
export type AssessmentSessionListQuery = z.output<typeof AssessmentSessionListQuery>;

export const SessionParams = z.object({ sessionId: IdParam });

export const CreateAssessmentSessionBody = z
  .object({
    tenderId: Id,
    lotId: Id.nullable().optional(),
    sessionType: AssessmentSessionsSessionType,
    purpose: requiredText(2000),
    agenda: requiredText(4000),
    assessmentBasis: AssessmentSessionsAssessmentBasis,
    criterionId: Id.nullable().optional(),
    instructions: requiredText(4000),
    preparationDays: z
      .number({ error: issue('PREPARATION_DAYS_REQUIRED', 'Enter the preparation time in days.') })
      .int(issue('PREPARATION_DAYS_INVALID', 'Use a whole number of days.'))
      .min(0, issue('PREPARATION_DAYS_INVALID', 'Cannot be negative.'))
      .max(60, issue('PREPARATION_DAYS_INVALID', 'At most 60 days.')),
  })
  .superRefine((body, context) => {
    if (body.assessmentBasis === 'scored_criterion' && (body.criterionId === undefined || body.criterionId === null)) {
      context.addIssue({
        code: 'custom',
        path: ['criterionId'],
        message: issue('CRITERION_REQUIRED', 'A scored session must name the announced criterion it feeds.'),
      });
    }
    if (body.assessmentBasis !== 'scored_criterion' && body.criterionId !== undefined && body.criterionId !== null) {
      context.addIssue({
        code: 'custom',
        path: ['criterionId'],
        message: issue('CRITERION_NOT_ALLOWED', 'Only a scored session feeds an evaluation criterion.'),
      });
    }
  });
export type CreateAssessmentSessionBody = z.infer<typeof CreateAssessmentSessionBody>;

export const ConfirmEqualTreatmentBody = z.object({
  confirmed: z.literal(true, { error: issue('CONFIRMATION_REQUIRED', 'Confirm equal treatment explicitly.') }),
  note: optionalText(2000),
});

export const IssueAssessmentInvitesBody = z.object({
  invites: z
    .array(z.object({ bidId: Id, scheduledAt: Instant }))
    .min(1, issue('INVITES_REQUIRED', 'Invite at least one candidate.'))
    .max(50, issue('TOO_MANY_INVITES', 'At most 50 invitations at once.')),
});

export const RecordAssessmentFindingBody = z.object({
  bidId: Id,
  finding: requiredText(4000),
  effect: AssessmentFindingsEffect,
  evidenceDocumentId: Id.nullable().optional(),
});

export const CompleteAssessmentSessionBody = z.object({
  summary: ReasonText,
});

export const CancelAssessmentSessionBody = z.object({
  reason: ReasonText,
});

export const ReferenceCheckListQuery = listQueryWithSort(['refereeName', 'contactedAt', 'updatedAt'] as const).extend({
  tenderId: IdParam.optional(),
  bidId: IdParam.optional(),
  consentConfirmed: QueryBoolean.optional(),
  recorded: QueryBoolean.optional(),
});

export const ReferenceCheckParams = z.object({ referenceCheckId: IdParam });

export const CreateReferenceCheckBody = z.object({
  bidId: Id,
  refereeName: requiredText(200),
  refereeOrganization: requiredText(300),
  consentConfirmed: z.boolean(),
  confidential: z.boolean(),
});

export const RecordReferenceFeedbackBody = z.object({
  contactedAt: Instant,
  feedback: requiredText(4000),
  outcome: requiredText(500),
});

// ---------------------------------------------------------------------------------------------------------
// Shortlists (BUY-23)
// ---------------------------------------------------------------------------------------------------------

export const ShortlistRow = z.object({
  shortlistId: Id,
  tender: SelectionTenderRef,
  lot: SelectionLotRef.nullable(),
  stageNo: z.number().int().min(1),
  selectionRule: z.string().min(1),
  /** Minimum non-price score for inclusion (`shortlists.threshold`); `null` when the rule is rank-only. */
  threshold: Score.nullable(),
  status: ShortlistsStatus,
  includedCount: z.number().int().min(0),
  excludedCount: z.number().int().min(0),
  approval: SelectionApprovalSummary.nullable(),
  approvedAt: Instant.nullable(),
  /** When every entry's outcome notice was issued; `null` while any is outstanding. */
  notifiedAt: Instant.nullable(),
  updatedAt: Instant,
});
export type ShortlistRow = z.infer<typeof ShortlistRow>;

export const ShortlistEntry = z.object({
  entryId: Id,
  bid: SelectionBidRef,
  included: z.boolean(),
  rank: z.number().int().min(1).nullable(),
  reason: z.string().min(1),
  conditions: z.string().nullable(),
  nonPriceScore: Score.nullable(),
  totalScore: Score.nullable(),
  notifiedAt: Instant.nullable(),
  notice: SelectionNoticeSummary.nullable(),
});
export type ShortlistEntry = z.infer<typeof ShortlistEntry>;

export const ShortlistDetail = ShortlistRow.extend({
  rationale: z.string().min(1),
  changeReason: z.string().nullable(),
  entries: z.array(ShortlistEntry),
  approvalSubject: SelectionApprovalSubject,
  /**
   * The linked next-stage event (a later stage of the same multi-stage event, or a separate linked event), or the
   * link that creates it once the shortlist is approved.
   */
  nextStage: z.object({
    tender: z.object({ tenderId: Id, reference: Reference, stageNo: z.number().int().min(1) }).nullable(),
    createLink: LinkPath.nullable(),
  }),
  notifyGate: SelectionGate,
});
export type ShortlistDetail = z.infer<typeof ShortlistDetail>;

export const ShortlistListQuery = listQueryWithSort(['tenderReference', 'status', 'updatedAt'] as const).extend({
  tenderId: IdParam.optional(),
  status: queryList(ShortlistsStatus).optional(),
});

export const ShortlistParams = z.object({ shortlistId: IdParam });

export const CreateShortlistBody = z.object({
  tenderId: Id,
  lotId: Id.nullable().optional(),
  stageNo: z.number().int().min(1).max(9),
  selectionRule: requiredText(2000),
  threshold: NonNegativeDecimalString.nullable().optional(),
  rationale: requiredText(4000),
});

const ShortlistEntryInput = z
  .object({
    bidId: Id,
    included: z.boolean(),
    rank: z.number().int().min(1).nullable().optional(),
    reason: z
      .string({ error: issue('SHORTLIST_REASON_REQUIRED', 'Every inclusion or exclusion needs a reason.') })
      .trim()
      .min(1, issue('SHORTLIST_REASON_REQUIRED', 'Every inclusion or exclusion needs a reason.'))
      .max(2000, issue('TEXT_TOO_LONG', 'At most 2000 characters.')),
    conditions: optionalText(2000),
  })
  .superRefine((entry, context) => {
    if (entry.included && (entry.rank === undefined || entry.rank === null)) {
      context.addIssue({
        code: 'custom',
        path: ['rank'],
        message: issue('RANK_REQUIRED', 'An included candidate needs its rank.'),
      });
    }
  });

export const UpdateShortlistBody = z.object({
  selectionRule: requiredText(2000),
  threshold: NonNegativeDecimalString.nullable().optional(),
  rationale: requiredText(4000),
  entries: z.array(ShortlistEntryInput).min(1, issue('SHORTLIST_EMPTY', 'List every candidate with a decision.')),
});

export const ChangeShortlistBody = UpdateShortlistBody.extend({
  changeReason: ReasonText,
});

export const NotifyShortlistBody = z.object({
  confirmed: z.literal(true, { error: issue('CONFIRMATION_REQUIRED', 'Confirm the notices explicitly.') }),
});

export const NotifyShortlistResult = z.object({
  shortlist: ShortlistDetail,
  outcomeNoticesIssued: z.number().int().min(0),
  nextStageInvitationsIssued: z.number().int().min(0),
});
export type NotifyShortlistResult = z.infer<typeof NotifyShortlistResult>;

// ---------------------------------------------------------------------------------------------------------
// Process decisions (lifecycle-owned table, recorded from selection screens)
// ---------------------------------------------------------------------------------------------------------

export const ProcessDecision = z.object({
  processDecisionId: Id,
  tender: SelectionTenderRef,
  lot: SelectionLotRef.nullable(),
  decisionType: ProcessDecisionsDecisionType,
  reason: z.string().min(1),
  status: ProcessDecisionsStatus,
  proposedBy: PersonRef,
  decidedBy: PersonRef.nullable(),
  approval: SelectionApprovalSummary.nullable(),
  approvalSubject: SelectionApprovalSubject,
  createdAt: Instant,
  updatedAt: Instant,
});
export type ProcessDecision = z.infer<typeof ProcessDecision>;

export const ProcessDecisionListQuery = listQueryWithSort(['createdAt', 'status'] as const).extend({
  tenderId: IdParam.optional(),
  decisionType: queryList(ProcessDecisionsDecisionType).optional(),
  status: queryList(ProcessDecisionsStatus).optional(),
});

export const ProposeProcessDecisionBody = z.object({
  tenderId: Id,
  lotId: Id.nullable().optional(),
  decisionType: ProcessDecisionsDecisionType,
  reason: ReasonText,
});

// ---------------------------------------------------------------------------------------------------------
// Preferred bidders (BUY-24)
// ---------------------------------------------------------------------------------------------------------

export const PreferredBidderRow = z.object({
  preferredBidderId: Id,
  tender: SelectionTenderRef,
  lot: SelectionLotRef.nullable(),
  bid: SelectionBidRef,
  scope: z.string().min(1),
  proposedValue: Money,
  status: PreferredBiddersStatus,
  statusReason: z.string().nullable(),
  decisionOwner: PersonRef,
  approval: SelectionApprovalSummary.nullable(),
  dueDiligence: z
    .object({ caseId: Id, status: DueDiligenceCasesStatus, awardBlockingCount: z.number().int().min(0) })
    .nullable(),
  fallbackBid: SelectionBidRef.nullable(),
  updatedAt: Instant,
});
export type PreferredBidderRow = z.infer<typeof PreferredBidderRow>;

export const PreferredBidderDetail = PreferredBidderRow.extend({
  rationale: z.string().min(1),
  remainingChecks: z.string().min(1),
  negotiationTopics: z.array(z.string().min(1)),
  contingencyPlan: z.string().min(1),
  comparison: z.array(SelectionCandidate),
  processDecisions: z.array(ProcessDecision),
  approvalSubject: SelectionApprovalSubject,
  /** A failed or withdrawn preferred bidder needs a recorded fallback decision (AC-24). */
  fallbackGate: SelectionGate,
  awardGate: SelectionGate,
});
export type PreferredBidderDetail = z.infer<typeof PreferredBidderDetail>;

export const PreferredBidderListQuery = listQueryWithSort(['tenderReference', 'status', 'updatedAt'] as const).extend({
  tenderId: IdParam.optional(),
  status: queryList(PreferredBiddersStatus).optional(),
  decisionOwnerUserId: IdParam.optional(),
});

export const PreferredBidderParams = z.object({ preferredBidderId: IdParam });

export const RecommendPreferredBidderBody = z
  .object({
    tenderId: Id,
    lotId: Id.nullable().optional(),
    bidId: Id,
    scope: requiredText(4000),
    proposedValue: NonNegativeMoney,
    rationale: requiredText(4000),
    remainingChecks: requiredText(4000),
    negotiationTopics: z.array(TopicText).max(20, issue('TOO_MANY_TOPICS', 'At most 20 topics.')),
    decisionOwnerUserId: Id,
    contingencyPlan: requiredText(4000),
    fallbackBidId: Id.nullable(),
  })
  .superRefine((body, context) => {
    if (body.fallbackBidId !== null && body.fallbackBidId === body.bidId) {
      context.addIssue({
        code: 'custom',
        path: ['fallbackBidId'],
        message: issue('FALLBACK_SAME_AS_PREFERRED', 'The fallback must be a different candidate.'),
      });
    }
  });

export const WithdrawPreferredBidderBody = z.object({ reason: ReasonText });

export const RecordFallbackBody = z.object({
  reason: ReasonText,
  fallbackBidId: Id,
  contingencyFollowed: z.literal(true, {
    error: issue('CONTINGENCY_CONFIRMATION_REQUIRED', 'Confirm that the declared contingency is being followed.'),
  }),
});

export const RecordFallbackResult = z.object({
  processDecision: ProcessDecision,
  preferredBidder: PreferredBidderDetail,
});

// ---------------------------------------------------------------------------------------------------------
// Due diligence (BUY-25)
// ---------------------------------------------------------------------------------------------------------

export const DueDiligenceFinding = z.object({
  findingId: Id,
  area: DueDiligenceFindingsArea,
  finding: z.string().min(1),
  disposition: DueDiligenceFindingsDisposition,
  owner: PersonRef.nullable(),
  dueAt: Instant.nullable(),
  evidenceDocumentId: Id.nullable(),
  evidenceTitle: z.string().nullable(),
  isAwardBlocking: z.boolean(),
  updatedAt: Instant,
});
export type DueDiligenceFinding = z.infer<typeof DueDiligenceFinding>;

export const DueDiligenceEvidenceRequest = z.object({
  clarificationId: Id,
  question: z.string().min(1),
  permittedScope: z.string().min(1),
  dueAt: Instant,
  status: BidClarificationsStatus,
  respondedAt: Instant.nullable(),
});
export type DueDiligenceEvidenceRequest = z.infer<typeof DueDiligenceEvidenceRequest>;

export const DueDiligenceCaseRow = z.object({
  caseId: Id,
  tender: SelectionTenderRef,
  preferredBidder: z.object({ preferredBidderId: Id, status: PreferredBiddersStatus }),
  bid: SelectionBidRef,
  owner: PersonRef,
  status: DueDiligenceCasesStatus,
  dispositionCounts: z.object({
    satisfied: z.number().int().min(0),
    condition: z.number().int().min(0),
    unresolved: z.number().int().min(0),
    failed: z.number().int().min(0),
  }),
  awardBlockingCount: z.number().int().min(0),
  nextDueAt: Instant.nullable(),
  decidedAt: Instant.nullable(),
  updatedAt: Instant,
});
export type DueDiligenceCaseRow = z.infer<typeof DueDiligenceCaseRow>;

export const DueDiligenceCaseDetail = DueDiligenceCaseRow.extend({
  decidedBy: PersonRef.nullable(),
  decisionNote: z.string().nullable(),
  findings: z.array(DueDiligenceFinding),
  /** Every area (PRD FR-16), with the worst disposition recorded so far (`null` = not yet reviewed). */
  areas: z.array(
    z.object({
      area: DueDiligenceFindingsArea,
      findingCount: z.number().int().min(0),
      worstDisposition: DueDiligenceFindingsDisposition.nullable(),
    }),
  ),
  evidenceRequests: z.array(DueDiligenceEvidenceRequest),
  /** Whether the case may be decided as passed now (failing an open case is always possible). */
  passGate: SelectionGate,
  awardGate: SelectionGate,
  /** The fallback decision recorded after a failure (AC-24). */
  fallbackDecision: ProcessDecision.nullable(),
});
export type DueDiligenceCaseDetail = z.infer<typeof DueDiligenceCaseDetail>;

export const DueDiligenceCaseListQuery = listQueryWithSort(['tenderReference', 'status', 'nextDueAt', 'updatedAt'] as const).extend({
  tenderId: IdParam.optional(),
  status: queryList(DueDiligenceCasesStatus).optional(),
  ownerUserId: IdParam.optional(),
  area: queryList(DueDiligenceFindingsArea).optional(),
  awardBlocking: QueryBoolean.optional(),
});

export const CaseParams = z.object({ caseId: IdParam });
export const CaseFindingParams = z.object({ caseId: IdParam, findingId: IdParam });

export const DueDiligenceFindingBody = z
  .object({
    area: DueDiligenceFindingsArea,
    finding: requiredText(4000),
    disposition: DueDiligenceFindingsDisposition,
    ownerUserId: Id.nullable().optional(),
    dueAt: Instant.nullable().optional(),
    evidenceDocumentId: Id.nullable().optional(),
    isAwardBlocking: z.boolean(),
  })
  .superRefine((body, context) => {
    if (body.disposition === 'unresolved' || body.disposition === 'condition') {
      if (body.ownerUserId === undefined || body.ownerUserId === null) {
        context.addIssue({
          code: 'custom',
          path: ['ownerUserId'],
          message: issue('FINDING_OWNER_REQUIRED', 'An open finding needs an owner.'),
        });
      }
      if (body.dueAt === undefined || body.dueAt === null) {
        context.addIssue({
          code: 'custom',
          path: ['dueAt'],
          message: issue('FINDING_DUE_DATE_REQUIRED', 'An open finding needs a due date.'),
        });
      }
    }
    if (body.disposition === 'failed' && !body.isAwardBlocking) {
      context.addIssue({
        code: 'custom',
        path: ['isAwardBlocking'],
        message: issue('FAILED_FINDING_BLOCKS_AWARD', 'A failed finding always blocks the award.'),
      });
    }
  });

export const RequestDiligenceEvidenceBody = z.object({
  question: requiredText(4000),
  permittedScope: requiredText(2000),
  dueAt: Instant,
});

export const DecideDueDiligenceBody = z.object({
  outcome: DueDiligenceCasesStatus.extract(['passed', 'failed']),
  decisionNote: ReasonText,
});

// ---------------------------------------------------------------------------------------------------------
// Negotiations and final-offer rounds (BUY-27, SUP-19)
// ---------------------------------------------------------------------------------------------------------

export const NegotiationRound = z.object({
  roundId: Id,
  roundNo: z.number().int().min(1),
  meetingAt: Instant.nullable(),
  participants: z.string().min(1),
  /** The authorized topics this round covered (a subset of the mandate's `allowedTopics`; `negotiation_rounds.topics`). */
  topics: z.array(z.string().min(1)),
  minutes: z.string().nullable(),
  buyerProposal: z.string().nullable(),
  supplierProposal: z.string().nullable(),
  concessions: z.string().nullable(),
  unresolvedIssues: z.string().nullable(),
  supplierResponseAt: Instant.nullable(),
  supplierVisible: z.boolean(),
});
export type NegotiationRound = z.infer<typeof NegotiationRound>;

export const NegotiationRow = z.object({
  negotiationId: Id,
  tender: SelectionTenderRef,
  lot: SelectionLotRef.nullable(),
  bid: SelectionBidRef,
  status: NegotiationsStatus,
  allowedTopics: z.array(z.string().min(1)),
  authorizedNegotiators: z.array(PersonRef),
  commercialAuthority: Money.nullable(),
  approval: SelectionApprovalSummary.nullable(),
  roundCount: z.number().int().min(0),
  lastMeetingAt: Instant.nullable(),
  affectsCompetitionBasis: z.boolean(),
  updatedAt: Instant,
});
export type NegotiationRow = z.infer<typeof NegotiationRow>;

export const NegotiationDetail = NegotiationRow.extend({
  outcomeSummary: z.string().nullable(),
  rounds: z.array(NegotiationRound),
  processDecision: ProcessDecision.nullable(),
  preferredBidderId: Id.nullable(),
  approvalSubject: SelectionApprovalSubject,
  /** Whether rounds may be recorded now (procedural authority and an approved mandate, BR-30). */
  roundGate: SelectionGate,
});
export type NegotiationDetail = z.infer<typeof NegotiationDetail>;

export const NegotiationListQuery = listQueryWithSort(['tenderReference', 'status', 'lastMeetingAt', 'updatedAt'] as const).extend({
  tenderId: IdParam.optional(),
  status: queryList(NegotiationsStatus).optional(),
  negotiatorUserId: IdParam.optional(),
});

export const NegotiationParams = z.object({ negotiationId: IdParam });

export const OpenNegotiationBody = z.object({
  tenderId: Id,
  lotId: Id.nullable().optional(),
  bidId: Id,
  allowedTopics: z.array(TopicText).min(1, issue('TOPICS_REQUIRED', 'Name at least one authorized topic.')).max(20),
  authorizedNegotiatorIds: z.array(Id).min(1, issue('NEGOTIATORS_REQUIRED', 'Name at least one authorized negotiator.')),
  commercialAuthority: NonNegativeMoney,
});

export const RecordNegotiationRoundBody = z.object({
  meetingAt: Instant,
  participants: requiredText(2000),
  topics: z.array(TopicText).min(1, issue('TOPICS_REQUIRED', 'Name the topics discussed.')),
  minutes: requiredText(8000),
  buyerProposal: optionalText(4000),
  supplierProposal: optionalText(4000),
  concessions: optionalText(4000),
  unresolvedIssues: optionalText(4000),
  supplierVisible: z.boolean(),
});

export const ConcludeNegotiationBody = z.object({
  outcomeSummary: ReasonText,
  affectsCompetitionBasis: z.boolean(),
});

export const FinalOfferInvitee = z.object({
  bid: SelectionBidRef,
  notifiedAt: Instant.nullable(),
  /** Receipt time of the final offer (bids domain); `null` until received. */
  finalOfferReceivedAt: Instant.nullable(),
  /** Earlier offer value retained for comparison; the final round never rewrites it. */
  earlierOffer: Money.nullable(),
  /** Final offer value, visible only after the round's opening. */
  finalOffer: Money.nullable(),
});
export type FinalOfferInvitee = z.infer<typeof FinalOfferInvitee>;

export const FinalOfferRoundRow = z.object({
  roundId: Id,
  tender: SelectionTenderRef,
  lot: SelectionLotRef.nullable(),
  status: FinalOfferRoundsStatus,
  deadline: OfficialDeadline.nullable(),
  inviteeCount: z.number().int().min(0),
  proceduralAuthorityRef: z.string().min(1),
  approval: SelectionApprovalSummary.nullable(),
  updatedAt: Instant,
});
export type FinalOfferRoundRow = z.infer<typeof FinalOfferRoundRow>;

export const FinalOfferRoundDetail = FinalOfferRoundRow.extend({
  instructions: z.string().min(1),
  permittedChanges: z.string().min(1),
  openingRules: z.string().min(1),
  evaluationTreatment: z.string().min(1),
  invitees: z.array(FinalOfferInvitee),
  approvalSubject: SelectionApprovalSubject,
  /** Whether the round may be issued now (BAFO permitted, process decision, approval, deadline, AC-23). */
  issueGate: SelectionGate,
});
export type FinalOfferRoundDetail = z.infer<typeof FinalOfferRoundDetail>;

export const FinalOfferRoundListQuery = listQueryWithSort(['tenderReference', 'status', 'deadline', 'updatedAt'] as const).extend({
  tenderId: IdParam.optional(),
  status: queryList(FinalOfferRoundsStatus).optional(),
});

export const FinalOfferRoundParams = z.object({ roundId: IdParam });

export const CreateFinalOfferRoundBody = z.object({
  tenderId: Id,
  lotId: Id.nullable().optional(),
  instructions: requiredText(8000),
  permittedChanges: requiredText(4000),
  deadline: Instant,
  openingRules: requiredText(4000),
  evaluationTreatment: requiredText(4000),
  proceduralAuthorityRef: requiredText(500),
  inviteeBidIds: z.array(Id).min(1, issue('INVITEES_REQUIRED', 'Invite at least one eligible bidder.')),
});

export const IssueFinalOfferRoundBody = z.object({
  confirmed: z.literal(true, { error: issue('CONFIRMATION_REQUIRED', 'Confirm the invitation explicitly.') }),
});

export const CancelFinalOfferRoundBody = z.object({ reason: ReasonText });

// ---------------------------------------------------------------------------------------------------------
// Supplier projections (SUP-18 assessment invites, SUP-19)
// ---------------------------------------------------------------------------------------------------------

/** The buying organization shown on supplier rows. */
export const SelectionBuyerLabel = z.object({ tenantId: Id, name: z.string().min(1) });

export const SupplierTenderRef = z.object({
  tenderId: Id,
  reference: Reference,
  title: z.string().min(1),
  officialTimeZone: TimeZone,
});

export const SupplierAssessmentInvite = z.object({
  inviteId: Id,
  buyer: SelectionBuyerLabel,
  tender: SupplierTenderRef,
  sessionType: AssessmentSessionsSessionType,
  sessionStatus: AssessmentSessionsStatus,
  purpose: z.string().min(1),
  agenda: z.string().min(1),
  instructions: z.string().min(1),
  preparationDays: z.number().int().min(0),
  /** Whether the session feeds a score, verifies a claim or checks a gate (announced to every invitee). */
  assessmentBasis: AssessmentSessionsAssessmentBasis,
  scheduledAt: Instant.nullable(),
  status: AssessmentInvitesStatus,
  invitedAt: Instant,
  supplierConfirmedAt: Instant.nullable(),
  supplierConfirmedBy: PersonRef.nullable(),
  respondGate: SelectionGate,
});
export type SupplierAssessmentInvite = z.infer<typeof SupplierAssessmentInvite>;

export const SupplierInviteListQuery = listQueryWithSort(['scheduledAt', 'invitedAt', 'status'] as const).extend({
  status: queryList(AssessmentInvitesStatus).optional(),
  tenderId: IdParam.optional(),
});

export const InviteParams = z.object({ inviteId: IdParam });

export const RespondAssessmentInviteBody = z.object({
  response: AssessmentInvitesStatus.extract(['confirmed', 'declined']),
  note: optionalText(2000),
});

export const SupplierNegotiationRound = NegotiationRound.omit({ supplierVisible: true }).extend({
  awaitingResponse: z.boolean(),
});
export type SupplierNegotiationRound = z.infer<typeof SupplierNegotiationRound>;

export const SupplierFinalOfferRound = z.object({
  roundId: Id,
  buyer: SelectionBuyerLabel,
  tender: SupplierTenderRef,
  status: FinalOfferRoundsStatus,
  deadline: OfficialDeadline.nullable(),
  instructions: z.string().min(1),
  permittedChanges: z.string().min(1),
  openingRules: z.string().min(1),
  evaluationTreatment: z.string().min(1),
  notifiedAt: Instant.nullable(),
  finalOfferReceivedAt: Instant.nullable(),
  /** The response workspace where the final offer is prepared and submitted (bids domain, round `bafo`). */
  responseWorkspaceLink: LinkPath,
});
export type SupplierFinalOfferRound = z.infer<typeof SupplierFinalOfferRound>;

export const SupplierNegotiationRow = z.object({
  negotiationId: Id,
  buyer: SelectionBuyerLabel,
  tender: SupplierTenderRef,
  status: NegotiationsStatus,
  allowedTopics: z.array(z.string().min(1)),
  roundCount: z.number().int().min(0),
  awaitingResponse: z.boolean(),
  lastMeetingAt: Instant.nullable(),
  updatedAt: Instant,
});
export type SupplierNegotiationRow = z.infer<typeof SupplierNegotiationRow>;

export const SupplierNegotiationDetail = SupplierNegotiationRow.extend({
  isAlternative: z.boolean(),
  outcomeSummary: z.string().nullable(),
  rounds: z.array(SupplierNegotiationRound),
  finalOfferRounds: z.array(SupplierFinalOfferRound),
});
export type SupplierNegotiationDetail = z.infer<typeof SupplierNegotiationDetail>;

export const SupplierNegotiationListQuery = listQueryWithSort(['updatedAt', 'lastMeetingAt', 'status'] as const).extend({
  status: queryList(NegotiationsStatus).optional(),
  awaitingResponse: QueryBoolean.optional(),
});

export const SupplierRoundParams = z.object({ negotiationId: IdParam, roundId: IdParam });

export const RespondNegotiationRoundBody = z.object({
  supplierProposal: requiredText(4000),
  concessions: optionalText(4000),
  internalApprovalConfirmed: z.literal(true, {
    error: issue('INTERNAL_APPROVAL_REQUIRED', 'Confirm that the response is approved internally.'),
  }),
});

export const SupplierFinalOfferListQuery = listQueryWithSort(['deadline', 'status'] as const).extend({
  status: queryList(FinalOfferRoundsStatus).optional(),
});

// ---------------------------------------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------------------------------------

const BUYER = '/api/v1/buyer/selection';
const SUPPLIER = '/api/v1/supplier/selection';

export const selectionEndpoints = {
  // Register and tender summary -------------------------------------------------------------------------------
  listTenders: defineEndpoint({
    id: 'buyer.selection.tenders',
    method: 'GET',
    path: `${BUYER}/tenders`,
    audience: 'buyer',
    permission: SELECTION_VIEW_PERMISSIONS,
    query: SelectionTenderListQuery,
    response: pageOf(SelectionTenderRow),
    errors: [],
    screens: ['BUY-22', 'BUY-23', 'BUY-24', 'BUY-25', 'BUY-27'],
    summary: 'Tenders in the selection stage with their shortlist, preferred-bidder, diligence and negotiation status.',
  }),
  getTender: defineEndpoint({
    id: 'buyer.selection.tender',
    method: 'GET',
    path: `${BUYER}/tenders/:tenderId`,
    audience: 'buyer',
    permission: ASSESSMENT_VIEW_PERMISSIONS,
    params: TenderParams,
    response: TenderSelectionSummary,
    errors: [],
    screens: ['BUY-22', 'BUY-23', 'BUY-24', 'BUY-25', 'BUY-27'],
    summary: 'Candidates, team, criteria, issued conditions and the negotiation, final-offer and award gates of one tender.',
  }),

  // Assessment sessions ---------------------------------------------------------------------------------------
  listSessions: defineEndpoint({
    id: 'buyer.selection.sessions.list',
    method: 'GET',
    path: `${BUYER}/assessment-sessions`,
    audience: 'buyer',
    permission: ASSESSMENT_VIEW_PERMISSIONS,
    query: AssessmentSessionListQuery,
    response: pageOf(AssessmentSessionRow),
    errors: [],
    screens: ['BUY-22'],
  }),
  getSession: defineEndpoint({
    id: 'buyer.selection.sessions.get',
    method: 'GET',
    path: `${BUYER}/assessment-sessions/:sessionId`,
    audience: 'buyer',
    permission: ASSESSMENT_VIEW_PERMISSIONS,
    params: SessionParams,
    response: AssessmentSessionDetail,
    errors: [],
    screens: ['BUY-22'],
  }),
  createSession: defineEndpoint({
    id: 'buyer.selection.sessions.create',
    method: 'POST',
    path: `${BUYER}/assessment-sessions`,
    audience: 'buyer',
    permission: 'selection.manage',
    body: CreateAssessmentSessionBody,
    response: AssessmentSessionDetail,
    idempotent: true,
    errors: ['TENDER_NOT_IN_ASSESSMENT', 'SESSION_TYPE_NOT_PERMITTED', 'CRITERION_NOT_IN_PLAN', 'LOT_NOT_IN_TENDER'],
    screens: ['BUY-22'],
    summary: 'Plans a demonstration, interview, presentation, sample, site inspection or reference check with its declared basis.',
  }),
  confirmEqualTreatment: defineEndpoint({
    id: 'buyer.selection.sessions.confirmEqualTreatment',
    method: 'POST',
    path: `${BUYER}/assessment-sessions/:sessionId/equal-treatment`,
    audience: 'buyer',
    permission: 'selection.manage',
    params: SessionParams,
    body: ConfirmEqualTreatmentBody,
    response: AssessmentSessionDetail,
    errors: ['SESSION_NOT_EDITABLE', 'EQUAL_TREATMENT_ALREADY_CONFIRMED', 'EQUAL_TREATMENT_CHECK_FAILED'],
    screens: ['BUY-22'],
  }),
  issueInvites: defineEndpoint({
    id: 'buyer.selection.sessions.issueInvites',
    method: 'POST',
    path: `${BUYER}/assessment-sessions/:sessionId/invites`,
    audience: 'buyer',
    permission: 'selection.manage',
    params: SessionParams,
    body: IssueAssessmentInvitesBody,
    response: AssessmentSessionDetail,
    errors: [
      'SESSION_NOT_EDITABLE',
      'EQUAL_TREATMENT_NOT_CONFIRMED',
      'BID_NOT_ELIGIBLE',
      'ALREADY_INVITED',
      'PREPARATION_TIME_TOO_SHORT',
    ],
    screens: ['BUY-22'],
    summary: 'Invites candidates with comparable instructions and at least the declared preparation time.',
  }),
  recordFinding: defineEndpoint({
    id: 'buyer.selection.sessions.recordFinding',
    method: 'POST',
    path: `${BUYER}/assessment-sessions/:sessionId/findings`,
    audience: 'buyer',
    permission: FINDING_RECORD_PERMISSIONS,
    params: SessionParams,
    body: RecordAssessmentFindingBody,
    response: AssessmentFinding,
    idempotent: true,
    errors: ['SESSION_NOT_OPEN_FOR_FINDINGS', 'BID_NOT_INVITED', 'FINDING_EFFECT_NOT_ALLOWED'],
    screens: ['BUY-22'],
    summary: 'Records a finding whose effect must follow the announced assessment basis (AC-21).',
  }),
  completeSession: defineEndpoint({
    id: 'buyer.selection.sessions.complete',
    method: 'POST',
    path: `${BUYER}/assessment-sessions/:sessionId/complete`,
    audience: 'buyer',
    permission: 'selection.manage',
    params: SessionParams,
    body: CompleteAssessmentSessionBody,
    response: AssessmentSessionDetail,
    errors: ['SESSION_NOT_EDITABLE', 'FINDINGS_INCOMPLETE'],
    screens: ['BUY-22'],
  }),
  cancelSession: defineEndpoint({
    id: 'buyer.selection.sessions.cancel',
    method: 'POST',
    path: `${BUYER}/assessment-sessions/:sessionId/cancel`,
    audience: 'buyer',
    permission: 'selection.manage',
    params: SessionParams,
    body: CancelAssessmentSessionBody,
    response: AssessmentSessionDetail,
    errors: ['SESSION_NOT_EDITABLE'],
    screens: ['BUY-22'],
  }),

  // Reference checks ------------------------------------------------------------------------------------------
  listReferenceChecks: defineEndpoint({
    id: 'buyer.selection.references.list',
    method: 'GET',
    path: `${BUYER}/reference-checks`,
    audience: 'buyer',
    permission: ASSESSMENT_VIEW_PERMISSIONS,
    query: ReferenceCheckListQuery,
    response: pageOf(ReferenceCheck),
    errors: [],
    screens: ['BUY-22'],
  }),
  createReferenceCheck: defineEndpoint({
    id: 'buyer.selection.references.create',
    method: 'POST',
    path: `${BUYER}/reference-checks`,
    audience: 'buyer',
    permission: 'selection.manage',
    body: CreateReferenceCheckBody,
    response: ReferenceCheck,
    idempotent: true,
    errors: ['REFERENCES_NOT_PERMITTED', 'BID_NOT_ELIGIBLE'],
    screens: ['BUY-22'],
  }),
  recordReferenceFeedback: defineEndpoint({
    id: 'buyer.selection.references.recordFeedback',
    method: 'POST',
    path: `${BUYER}/reference-checks/:referenceCheckId/feedback`,
    audience: 'buyer',
    permission: 'selection.manage',
    params: ReferenceCheckParams,
    body: RecordReferenceFeedbackBody,
    response: ReferenceCheck,
    errors: ['REFERENCE_CONSENT_REQUIRED', 'REFERENCE_FEEDBACK_RECORDED'],
    screens: ['BUY-22'],
    summary: 'Records referee feedback; refused without the referee’s consent.',
  }),

  // Shortlists ------------------------------------------------------------------------------------------------
  listShortlists: defineEndpoint({
    id: 'buyer.selection.shortlists.list',
    method: 'GET',
    path: `${BUYER}/shortlists`,
    audience: 'buyer',
    permission: SELECTION_VIEW_PERMISSIONS,
    query: ShortlistListQuery,
    response: pageOf(ShortlistRow),
    errors: [],
    screens: ['BUY-23'],
  }),
  getShortlist: defineEndpoint({
    id: 'buyer.selection.shortlists.get',
    method: 'GET',
    path: `${BUYER}/shortlists/:shortlistId`,
    audience: 'buyer',
    permission: SELECTION_VIEW_PERMISSIONS,
    params: ShortlistParams,
    response: ShortlistDetail,
    errors: [],
    screens: ['BUY-23'],
  }),
  createShortlist: defineEndpoint({
    id: 'buyer.selection.shortlists.create',
    method: 'POST',
    path: `${BUYER}/shortlists`,
    audience: 'buyer',
    permission: 'selection.manage',
    body: CreateShortlistBody,
    response: ShortlistDetail,
    idempotent: true,
    errors: ['TENDER_NOT_IN_ASSESSMENT', 'SHORTLIST_EXISTS', 'LOT_NOT_IN_TENDER'],
    screens: ['BUY-23'],
  }),
  updateShortlist: defineEndpoint({
    id: 'buyer.selection.shortlists.update',
    method: 'PUT',
    path: `${BUYER}/shortlists/:shortlistId`,
    audience: 'buyer',
    permission: 'selection.manage',
    params: ShortlistParams,
    body: UpdateShortlistBody,
    response: ShortlistDetail,
    errors: ['SHORTLIST_NOT_EDITABLE', 'ENTRY_BID_UNKNOWN', 'CANDIDATE_MISSING', 'INCLUDED_BELOW_THRESHOLD'],
    screens: ['BUY-23'],
  }),
  changeShortlist: defineEndpoint({
    id: 'buyer.selection.shortlists.change',
    method: 'POST',
    path: `${BUYER}/shortlists/:shortlistId/change`,
    audience: 'buyer',
    permission: 'selection.manage',
    params: ShortlistParams,
    body: ChangeShortlistBody,
    response: ShortlistDetail,
    errors: ['SHORTLIST_NOT_APPROVED', 'ENTRY_BID_UNKNOWN', 'CANDIDATE_MISSING', 'INCLUDED_BELOW_THRESHOLD'],
    screens: ['BUY-23'],
    summary: 'Changes an approved shortlist with a recorded reason; the change returns it for approval and review of invitations.',
  }),
  notifyShortlist: defineEndpoint({
    id: 'buyer.selection.shortlists.notify',
    method: 'POST',
    path: `${BUYER}/shortlists/:shortlistId/notify`,
    audience: 'buyer',
    permission: 'selection.manage',
    params: ShortlistParams,
    body: NotifyShortlistBody,
    response: NotifyShortlistResult,
    errors: ['SHORTLIST_NOT_APPROVED', 'OUTCOME_NOTICES_ALREADY_ISSUED'],
    screens: ['BUY-23'],
    summary: 'Issues outcome notices to every candidate and next-stage invitations only to included ones (AC-22).',
  }),

  // Process decisions -----------------------------------------------------------------------------------------
  listProcessDecisions: defineEndpoint({
    id: 'buyer.selection.processDecisions.list',
    method: 'GET',
    path: `${BUYER}/process-decisions`,
    audience: 'buyer',
    permission: SELECTION_VIEW_PERMISSIONS,
    query: ProcessDecisionListQuery,
    response: pageOf(ProcessDecision),
    errors: [],
    screens: ['BUY-24', 'BUY-25', 'BUY-27'],
  }),
  proposeProcessDecision: defineEndpoint({
    id: 'buyer.selection.processDecisions.propose',
    method: 'POST',
    path: `${BUYER}/process-decisions`,
    audience: 'buyer',
    permission: ['selection.manage', 'negotiation.conduct'],
    body: ProposeProcessDecisionBody,
    response: ProcessDecision,
    idempotent: true,
    errors: ['TENDER_NOT_IN_ASSESSMENT', 'PROCESS_DECISION_PENDING'],
    screens: ['BUY-24', 'BUY-25', 'BUY-27'],
  }),

  // Preferred bidders -----------------------------------------------------------------------------------------
  listPreferredBidders: defineEndpoint({
    id: 'buyer.selection.preferredBidders.list',
    method: 'GET',
    path: `${BUYER}/preferred-bidders`,
    audience: 'buyer',
    permission: SELECTION_VIEW_PERMISSIONS,
    query: PreferredBidderListQuery,
    response: pageOf(PreferredBidderRow),
    errors: [],
    screens: ['BUY-24'],
  }),
  getPreferredBidder: defineEndpoint({
    id: 'buyer.selection.preferredBidders.get',
    method: 'GET',
    path: `${BUYER}/preferred-bidders/:preferredBidderId`,
    audience: 'buyer',
    permission: SELECTION_VIEW_PERMISSIONS,
    params: PreferredBidderParams,
    response: PreferredBidderDetail,
    errors: [],
    screens: ['BUY-24'],
  }),
  recommendPreferredBidder: defineEndpoint({
    id: 'buyer.selection.preferredBidders.recommend',
    method: 'POST',
    path: `${BUYER}/preferred-bidders`,
    audience: 'buyer',
    permission: 'selection.manage',
    body: RecommendPreferredBidderBody,
    response: PreferredBidderDetail,
    idempotent: true,
    errors: [
      'TENDER_NOT_IN_ASSESSMENT',
      'PREFERRED_BIDDER_ACTIVE',
      'BID_NOT_ELIGIBLE',
      'FALLBACK_BID_NOT_ELIGIBLE',
      'DECISION_OWNER_NOT_ELIGIBLE',
    ],
    screens: ['BUY-24'],
    summary: 'Recommends a conditional preferred bidder (never an award, BR-31) with contingency and fallback.',
  }),
  withdrawPreferredBidder: defineEndpoint({
    id: 'buyer.selection.preferredBidders.withdraw',
    method: 'POST',
    path: `${BUYER}/preferred-bidders/:preferredBidderId/withdraw`,
    audience: 'buyer',
    permission: 'selection.manage',
    params: PreferredBidderParams,
    body: WithdrawPreferredBidderBody,
    response: PreferredBidderDetail,
    errors: ['PREFERRED_BIDDER_NOT_ACTIVE'],
    screens: ['BUY-24'],
  }),
  recordFallback: defineEndpoint({
    id: 'buyer.selection.preferredBidders.recordFallback',
    method: 'POST',
    path: `${BUYER}/preferred-bidders/:preferredBidderId/fallback`,
    audience: 'buyer',
    permission: 'selection.manage',
    params: PreferredBidderParams,
    body: RecordFallbackBody,
    response: RecordFallbackResult,
    idempotent: true,
    errors: ['FALLBACK_NOT_AVAILABLE', 'FALLBACK_ALREADY_RECORDED', 'FALLBACK_BID_NOT_ELIGIBLE'],
    screens: ['BUY-24', 'BUY-25'],
    summary: 'Records the fallback decision after the preferred bidder failed diligence or withdrew (AC-24).',
  }),

  // Due diligence ---------------------------------------------------------------------------------------------
  listDiligenceCases: defineEndpoint({
    id: 'buyer.selection.diligence.list',
    method: 'GET',
    path: `${BUYER}/due-diligence-cases`,
    audience: 'buyer',
    permission: SELECTION_VIEW_PERMISSIONS,
    query: DueDiligenceCaseListQuery,
    response: pageOf(DueDiligenceCaseRow),
    errors: [],
    screens: ['BUY-25'],
  }),
  getDiligenceCase: defineEndpoint({
    id: 'buyer.selection.diligence.get',
    method: 'GET',
    path: `${BUYER}/due-diligence-cases/:caseId`,
    audience: 'buyer',
    permission: SELECTION_VIEW_PERMISSIONS,
    params: CaseParams,
    response: DueDiligenceCaseDetail,
    errors: [],
    screens: ['BUY-25'],
  }),
  recordDiligenceFinding: defineEndpoint({
    id: 'buyer.selection.diligence.recordFinding',
    method: 'POST',
    path: `${BUYER}/due-diligence-cases/:caseId/findings`,
    audience: 'buyer',
    permission: 'diligence.manage',
    params: CaseParams,
    body: DueDiligenceFindingBody,
    response: DueDiligenceFinding,
    idempotent: true,
    errors: ['CASE_DECIDED', 'FINDING_OWNER_NOT_ELIGIBLE'],
    screens: ['BUY-25'],
  }),
  updateDiligenceFinding: defineEndpoint({
    id: 'buyer.selection.diligence.updateFinding',
    method: 'PUT',
    path: `${BUYER}/due-diligence-cases/:caseId/findings/:findingId`,
    audience: 'buyer',
    permission: 'diligence.manage',
    params: CaseFindingParams,
    body: DueDiligenceFindingBody,
    response: DueDiligenceFinding,
    errors: ['CASE_DECIDED', 'FINDING_OWNER_NOT_ELIGIBLE'],
    screens: ['BUY-25'],
  }),
  requestDiligenceEvidence: defineEndpoint({
    id: 'buyer.selection.diligence.requestEvidence',
    method: 'POST',
    path: `${BUYER}/due-diligence-cases/:caseId/evidence-requests`,
    audience: 'buyer',
    permission: 'diligence.manage',
    params: CaseParams,
    body: RequestDiligenceEvidenceBody,
    response: DueDiligenceEvidenceRequest,
    idempotent: true,
    errors: ['CASE_DECIDED', 'DUE_DATE_IN_PAST'],
    screens: ['BUY-25'],
    summary: 'Requests evidence from the preferred bidder through a due-diligence clarification with a permitted scope.',
  }),
  decideDiligenceCase: defineEndpoint({
    id: 'buyer.selection.diligence.decide',
    method: 'POST',
    path: `${BUYER}/due-diligence-cases/:caseId/decide`,
    audience: 'buyer',
    permission: DILIGENCE_DECIDE_PERMISSIONS,
    params: CaseParams,
    body: DecideDueDiligenceBody,
    response: DueDiligenceCaseDetail,
    errors: ['CASE_DECIDED', 'DILIGENCE_FINDINGS_UNRESOLVED', 'DILIGENCE_FAILED_FINDING'],
    screens: ['BUY-25'],
    summary: 'Approves or rejects readiness. A failure blocks the award and requires a fallback decision (AC-24).',
  }),

  // Negotiations ----------------------------------------------------------------------------------------------
  listNegotiations: defineEndpoint({
    id: 'buyer.selection.negotiations.list',
    method: 'GET',
    path: `${BUYER}/negotiations`,
    audience: 'buyer',
    permission: SELECTION_VIEW_PERMISSIONS,
    query: NegotiationListQuery,
    response: pageOf(NegotiationRow),
    errors: [],
    screens: ['BUY-27'],
  }),
  getNegotiation: defineEndpoint({
    id: 'buyer.selection.negotiations.get',
    method: 'GET',
    path: `${BUYER}/negotiations/:negotiationId`,
    audience: 'buyer',
    permission: SELECTION_VIEW_PERMISSIONS,
    params: NegotiationParams,
    response: NegotiationDetail,
    errors: [],
    screens: ['BUY-27'],
  }),
  openNegotiation: defineEndpoint({
    id: 'buyer.selection.negotiations.open',
    method: 'POST',
    path: `${BUYER}/negotiations`,
    audience: 'buyer',
    permission: 'negotiation.conduct',
    body: OpenNegotiationBody,
    response: NegotiationDetail,
    idempotent: true,
    errors: [
      'TENDER_NOT_IN_ASSESSMENT',
      'NEGOTIATION_NOT_PERMITTED',
      'PROCESS_DECISION_REQUIRED',
      'BID_NOT_PREFERRED',
      'NEGOTIATION_EXISTS',
      'NEGOTIATOR_NOT_ELIGIBLE',
      'AUTHORITY_EXCEEDS_PROPOSED_VALUE',
    ],
    screens: ['BUY-27'],
    summary: 'Opens a negotiation with its mandate (topics, negotiators, commercial authority); refused where not permitted (BR-30).',
  }),
  recordNegotiationRound: defineEndpoint({
    id: 'buyer.selection.negotiations.recordRound',
    method: 'POST',
    path: `${BUYER}/negotiations/:negotiationId/rounds`,
    audience: 'buyer',
    permission: 'negotiation.conduct',
    params: NegotiationParams,
    body: RecordNegotiationRoundBody,
    response: NegotiationRound,
    idempotent: true,
    errors: ['NEGOTIATION_NOT_ACTIVE', 'MANDATE_NOT_APPROVED', 'TOPIC_NOT_AUTHORIZED', 'NEGOTIATOR_NOT_AUTHORIZED'],
    screens: ['BUY-27'],
  }),
  concludeNegotiation: defineEndpoint({
    id: 'buyer.selection.negotiations.conclude',
    method: 'POST',
    path: `${BUYER}/negotiations/:negotiationId/conclude`,
    audience: 'buyer',
    permission: 'negotiation.conduct',
    params: NegotiationParams,
    body: ConcludeNegotiationBody,
    response: NegotiationDetail,
    errors: ['NEGOTIATION_NOT_ACTIVE', 'PROCESS_DECISION_REQUIRED'],
    screens: ['BUY-27'],
    summary: 'Concludes a negotiation; a change to the basis of competition requires an approved process decision.',
  }),

  // Final-offer rounds ----------------------------------------------------------------------------------------
  listFinalOfferRounds: defineEndpoint({
    id: 'buyer.selection.finalOffers.list',
    method: 'GET',
    path: `${BUYER}/final-offer-rounds`,
    audience: 'buyer',
    permission: SELECTION_VIEW_PERMISSIONS,
    query: FinalOfferRoundListQuery,
    response: pageOf(FinalOfferRoundRow),
    errors: [],
    screens: ['BUY-27'],
  }),
  getFinalOfferRound: defineEndpoint({
    id: 'buyer.selection.finalOffers.get',
    method: 'GET',
    path: `${BUYER}/final-offer-rounds/:roundId`,
    audience: 'buyer',
    permission: SELECTION_VIEW_PERMISSIONS,
    params: FinalOfferRoundParams,
    response: FinalOfferRoundDetail,
    errors: [],
    screens: ['BUY-27'],
  }),
  createFinalOfferRound: defineEndpoint({
    id: 'buyer.selection.finalOffers.create',
    method: 'POST',
    path: `${BUYER}/final-offer-rounds`,
    audience: 'buyer',
    permission: 'selection.manage',
    body: CreateFinalOfferRoundBody,
    response: FinalOfferRoundDetail,
    idempotent: true,
    errors: [
      'TENDER_NOT_IN_ASSESSMENT',
      'BAFO_NOT_PERMITTED',
      'PROCESS_DECISION_REQUIRED',
      'INVITEE_NOT_ELIGIBLE',
      'DEADLINE_IN_PAST',
      'FINAL_OFFER_ROUND_OPEN',
    ],
    screens: ['BUY-27'],
    summary: 'Requests a best and final offer round; blocked where the issued conditions do not permit it (AC-23).',
  }),
  issueFinalOfferRound: defineEndpoint({
    id: 'buyer.selection.finalOffers.issue',
    method: 'POST',
    path: `${BUYER}/final-offer-rounds/:roundId/issue`,
    audience: 'buyer',
    permission: 'selection.manage',
    params: FinalOfferRoundParams,
    body: IssueFinalOfferRoundBody,
    response: FinalOfferRoundDetail,
    errors: ['BAFO_NOT_PERMITTED', 'PROCESS_DECISION_REQUIRED', 'ROUND_NOT_APPROVED', 'ROUND_NOT_ISSUABLE', 'DEADLINE_IN_PAST'],
    screens: ['BUY-27'],
  }),
  cancelFinalOfferRound: defineEndpoint({
    id: 'buyer.selection.finalOffers.cancel',
    method: 'POST',
    path: `${BUYER}/final-offer-rounds/:roundId/cancel`,
    audience: 'buyer',
    permission: 'selection.manage',
    params: FinalOfferRoundParams,
    body: CancelFinalOfferRoundBody,
    response: FinalOfferRoundDetail,
    errors: ['ROUND_NOT_CANCELLABLE'],
    screens: ['BUY-27'],
  }),

  // Supplier: assessment invites (SUP-18) ---------------------------------------------------------------------
  listSupplierInvites: defineEndpoint({
    id: 'supplier.selection.invites.list',
    method: 'GET',
    path: `${SUPPLIER}/assessment-invites`,
    audience: 'supplier',
    permission: 'supplier.opportunities.view',
    query: SupplierInviteListQuery,
    response: pageOf(SupplierAssessmentInvite),
    errors: [],
    screens: ['SUP-18'],
    summary: 'The supplier’s own demonstration, interview, presentation, sample, inspection and reference invitations.',
  }),
  respondToInvite: defineEndpoint({
    id: 'supplier.selection.invites.respond',
    method: 'POST',
    path: `${SUPPLIER}/assessment-invites/:inviteId/respond`,
    audience: 'supplier',
    permission: 'supplier.notices.acknowledge',
    params: InviteParams,
    body: RespondAssessmentInviteBody,
    response: SupplierAssessmentInvite,
    errors: ['INVITE_NOT_OPEN', 'SESSION_CANCELLED'],
    screens: ['SUP-18'],
  }),

  // Supplier: negotiation and final offers (SUP-19) -----------------------------------------------------------
  listSupplierNegotiations: defineEndpoint({
    id: 'supplier.selection.negotiations.list',
    method: 'GET',
    path: `${SUPPLIER}/negotiations`,
    audience: 'supplier',
    permission: SUPPLIER_NEGOTIATION_VIEW_PERMISSIONS,
    query: SupplierNegotiationListQuery,
    response: pageOf(SupplierNegotiationRow),
    errors: [],
    screens: ['SUP-19'],
  }),
  getSupplierNegotiation: defineEndpoint({
    id: 'supplier.selection.negotiations.get',
    method: 'GET',
    path: `${SUPPLIER}/negotiations/:negotiationId`,
    audience: 'supplier',
    permission: SUPPLIER_NEGOTIATION_VIEW_PERMISSIONS,
    params: NegotiationParams,
    response: SupplierNegotiationDetail,
    errors: [],
    screens: ['SUP-19'],
    summary: 'The supplier’s own negotiation: authorized topics and the rounds shared with it; other suppliers stay hidden.',
  }),
  respondToRound: defineEndpoint({
    id: 'supplier.selection.negotiations.respond',
    method: 'POST',
    path: `${SUPPLIER}/negotiations/:negotiationId/rounds/:roundId/respond`,
    audience: 'supplier',
    permission: SUPPLIER_ROUND_RESPOND_PERMISSIONS,
    params: SupplierRoundParams,
    body: RespondNegotiationRoundBody,
    response: SupplierNegotiationRound,
    errors: ['NEGOTIATION_NOT_ACTIVE', 'ROUND_NOT_AWAITING_RESPONSE'],
    screens: ['SUP-19'],
    summary: 'Sends the internally approved response to a negotiation round.',
  }),
  listSupplierFinalOffers: defineEndpoint({
    id: 'supplier.selection.finalOffers.list',
    method: 'GET',
    path: `${SUPPLIER}/final-offer-rounds`,
    audience: 'supplier',
    permission: SUPPLIER_NEGOTIATION_VIEW_PERMISSIONS,
    query: SupplierFinalOfferListQuery,
    response: pageOf(SupplierFinalOfferRound),
    errors: [],
    screens: ['SUP-19'],
    summary: 'Final-offer rounds the supplier is invited to, with a link to the response workspace for the BAFO.',
  }),
  getSupplierFinalOffer: defineEndpoint({
    id: 'supplier.selection.finalOffers.get',
    method: 'GET',
    path: `${SUPPLIER}/final-offer-rounds/:roundId`,
    audience: 'supplier',
    permission: SUPPLIER_NEGOTIATION_VIEW_PERMISSIONS,
    params: FinalOfferRoundParams,
    response: SupplierFinalOfferRound,
    errors: [],
    screens: ['SUP-19'],
  }),
};
