/**
 * Opening contract (domain 10): opening sessions, compliance review, bid clarifications and exclusions
 * (FR-13; BR-05, BR-17, BR-22, BR-23, BR-26; screens BUY-20, BUY-21, EVA-03, SUP-18; AC-15, AC-16, AC-17).
 *
 * Field names mirror blueprint Migration 10 (`opening_sessions`, `opening_participants`, `envelope_openings`,
 * `price_gate_releases`, `compliance_checks`, `bid_clarifications`, `exclusions`) and the receipt metadata of
 * `v_bid_receipt_metadata` (DD-13).
 *
 * Rules the contract encodes (Stage B enforces them with the declared error codes):
 * - Opening is its own authority (BR-05): scheduling, recording and opening need `bid.open`; confirming presence
 *   needs `bid.open` or `bid.witness`. The officer opens only when the required quorum (officer plus witness or
 *   committee) has confirmed (`QUORUM_NOT_MET`).
 * - Staged opening follows `tender_envelopes.open_order` (`STAGE_OUT_OF_ORDER`). A staged commercial envelope opens
 *   only after the evaluation chair released the price gate (`PRICE_GATE_NOT_RELEASED`, AC-16; the release itself
 *   belongs to the evaluation contract, DD-16, DD-23). A single-stage session (`envelope = 'all'`) opens every
 *   envelope of each eligible effective revision (DD-05).
 * - Organization administrators, auditors and operator support grants hold none of the permissions below, so every
 *   endpoint answers 403 and the SPA shows a restricted state with no content (AC-15, BR-26).
 * - Before opening, bid rows carry receipt metadata only; drafts never appear (BR-17, DD-13).
 * - A compliance finding cites evidence and has a disposition; `not_applicable` requires a reason (FR-13).
 * - A clarification states its permitted scope; the supplier's answer is text and documents attached to the
 *   clarification and never a new bid revision (BR-22). The chair consolidates duplicate assessor questions (EVA-03).
 * - An exclusion cites failed checks, needs approval (approval subject type `exclusion`, requested through the
 *   approvals contract), a formal notice and a challenge route. An excluded bid is not ranked, and its unopened
 *   commercial envelope stays sealed (AC-17). `compliance_checks` and `exclusions` are [R]: suppliers never read them
 *   (DD-03); SUP-18 exposes only the supplier's own issued clarifications.
 *
 * Pure module: zod and sibling contract files only.
 */
import { z } from 'zod';

import {
  CalendarDate,
  Id,
  IdParam,
  Instant,
  OfficialDeadline,
  PersonRef,
  QueryBoolean,
  ReasonText,
  Reference,
  issue,
  listQueryWithSort,
  pageOf,
  queryList,
} from './common.js';
import { defineEndpoint } from './endpoint.js';
import type { PermissionCode } from './permissions.js';
import {
  ApprovalRequestsStatus,
  BidClarificationsEffect,
  BidClarificationsSource,
  BidClarificationsStatus,
  BidsComplianceStatus,
  BidsEvaluationStatus,
  BidsSubmissionState,
  ComplianceChecksCheckType,
  ComplianceChecksFindingClass,
  ComplianceChecksResult,
  ExclusionsStatus,
  LotsStage,
  NoticesStatus,
  OpeningParticipantsRole,
  OpeningSessionsEnvelope,
  OpeningSessionsStatus,
  SubmissionReceiptsStatus,
  TenderEnvelopesEnvelope,
  TenderTeamMembersTeamRole,
  TendersEventType,
  TendersOpeningMode,
  TendersParticipation,
  TendersProcedure,
  TendersStatus,
} from './enums.js';

// ---------------------------------------------------------------------------------------------------------
// Permission sets
// ---------------------------------------------------------------------------------------------------------

/** Who may read opening records (BUY-20): the opening team, compliance assessors, the chair and exclusion approvers. */
export const OPENING_VIEW_PERMISSIONS = [
  'bid.open',
  'bid.witness',
  'compliance.assess',
  'evaluation.chair',
  'exclusion.approve',
] as const satisfies readonly [PermissionCode, ...PermissionCode[]];

/** Who may read the compliance register (BUY-21). */
export const COMPLIANCE_VIEW_PERMISSIONS = [
  'compliance.assess',
  'exclusion.approve',
  'evaluation.chair',
] as const satisfies readonly [PermissionCode, ...PermissionCode[]];

/**
 * Who may read bid clarifications (BUY-21, EVA-03). Evaluators without `compliance.assess`, `evaluation.chair` or
 * `exclusion.approve` see only the questions they raised and the answers distributed to them.
 */
export const CLARIFICATION_VIEW_PERMISSIONS = [
  'compliance.assess',
  'evaluation.chair',
  'exclusion.approve',
  'evaluation.score',
] as const satisfies readonly [PermissionCode, ...PermissionCode[]];

/** Who may draft a clarification: compliance assessors, the chair and evaluators (`SOURCE_NOT_PERMITTED` per source). */
export const CLARIFICATION_RAISE_PERMISSIONS = [
  'compliance.assess',
  'evaluation.chair',
  'evaluation.score',
] as const satisfies readonly [PermissionCode, ...PermissionCode[]];

/**
 * Who may send the formal answer to an assessment request (SUP-18): the answer is a statement of the organization to
 * the buyer, so it needs submission authority (AC-03, BR-10). Contributors and bid managers prepare the text but
 * cannot send it.
 */
export const ASSESSMENT_REQUEST_RESPOND_PERMISSION = 'supplier.response.submit' as const satisfies PermissionCode;

/** Who may read the supplier's own assessment requests (SUP-18). */
export const ASSESSMENT_REQUEST_VIEW_PERMISSIONS = [
  'supplier.response.edit',
  'supplier.response.approve',
  'supplier.response.submit',
  'supplier.outcomes.view',
] as const satisfies readonly [PermissionCode, ...PermissionCode[]];

// ---------------------------------------------------------------------------------------------------------
// Projection states (derived for display; not stored columns)
// ---------------------------------------------------------------------------------------------------------

/** The state of one envelope of one bid: sealed, opened (an `envelope_openings` row exists) or withheld. */
export const ENVELOPE_STATES = ['sealed', 'opened', 'withheld'] as const;
export const EnvelopeState = z.enum(ENVELOPE_STATES);
export type EnvelopeState = (typeof ENVELOPE_STATES)[number];

/** Why a bid is not opened in a session (withheld envelopes). */
export const INELIGIBLE_REASONS = ['withdrawn', 'late_rejected', 'excluded', 'exclusion_pending', 'not_in_lot'] as const;
export const IneligibleReason = z.enum(INELIGIBLE_REASONS);
export type IneligibleReason = (typeof INELIGIBLE_REASONS)[number];

/** The state of one opening stage of a tender (per envelope and lot). */
export const STAGE_STATES = [
  'sealed',
  'scheduled',
  'awaiting_quorum',
  'opened',
  'blocked_by_price_gate',
  'cancelled',
] as const;
export const StageState = z.enum(STAGE_STATES);
export type StageState = (typeof STAGE_STATES)[number];

/** Where a tender stands in its opening. */
export const OPENING_PROGRESS = ['not_closed', 'awaiting_opening', 'partially_opened', 'fully_opened'] as const;
export const OpeningProgress = z.enum(OPENING_PROGRESS);
export type OpeningProgress = (typeof OPENING_PROGRESS)[number];

/** The checks shown before an officer opens a session (rendered with ReadinessChecklist). */
export const OPENING_READINESS_CODES = [
  'tender_closed',
  'officer_confirmed',
  'quorum',
  'stage_order',
  'price_gate',
] as const;
export const OpeningReadinessCode = z.enum(OPENING_READINESS_CODES);
export type OpeningReadinessCode = (typeof OPENING_READINESS_CODES)[number];

export const READINESS_STATUSES = ['blocking', 'warning', 'passed'] as const;
export const ReadinessStatus = z.enum(READINESS_STATUSES);
export type ReadinessStatus = (typeof READINESS_STATUSES)[number];

/** Clarification statuses a supplier can see (never `draft` or `approved`). */
export const SUPPLIER_VISIBLE_CLARIFICATION_STATUSES = ['issued', 'responded', 'closed', 'expired'] as const;
export const SupplierClarificationStatus = z.enum(SUPPLIER_VISIBLE_CLARIFICATION_STATUSES);
export type SupplierClarificationStatus = (typeof SUPPLIER_VISIBLE_CLARIFICATION_STATUSES)[number];

// ---------------------------------------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------------------------------------

/** A lot reference (`lots.id`, `lots.lot_no`, `lots.title`, `lots.stage`). */
export const LotRef = z.object({
  lotId: Id,
  lotNo: z.number().int().min(1),
  title: z.string().min(1),
  stage: LotsStage,
});
export type LotRef = z.infer<typeof LotRef>;

/** The supplier legal party of a bid, as named at receipt (DD-13). */
export const BidSupplier = z.object({
  tenantId: Id,
  name: z.string().min(1),
});
export type BidSupplier = z.infer<typeof BidSupplier>;

/** A quorum summary: required participants, confirmed participants and whether the quorum is met. */
export const QuorumState = z.object({
  required: z.number().int().min(1),
  confirmed: z.number().int().min(0),
  met: z.boolean(),
});
export type QuorumState = z.infer<typeof QuorumState>;

/** One envelope of one bid and its state. */
export const BidEnvelopeState = z.object({
  envelope: TenderEnvelopesEnvelope,
  state: EnvelopeState,
  openedAt: Instant.nullable(),
});
export type BidEnvelopeState = z.infer<typeof BidEnvelopeState>;

/** A document attached to a clarification or its response (polymorphic `documents`, related type `bid_clarification`). */
export const ClarificationAttachment = z.object({
  documentId: Id,
  versionId: Id,
  title: z.string().min(1),
  fileName: z.string().min(1),
});
export type ClarificationAttachment = z.infer<typeof ClarificationAttachment>;

/** The price gate of a tender or lot (`price_gate_releases`, owned by evaluation; read here). */
export const PriceGateState = z.object({
  lotId: Id.nullable(),
  /** False for a single-stage tender: the gate does not apply. */
  applies: z.boolean(),
  released: z.boolean(),
  releasedAt: Instant.nullable(),
  releasedBy: PersonRef.nullable(),
  nonPriceCompleteConfirmed: z.boolean(),
  note: z.string().nullable(),
});
export type PriceGateState = z.infer<typeof PriceGateState>;

const LongText = (max: number, code = 'TEXT_TOO_LONG') =>
  z.string().trim().max(max, issue(code, `At most ${max} characters.`));

// ---------------------------------------------------------------------------------------------------------
// Tenders in opening (BUY-20)
// ---------------------------------------------------------------------------------------------------------

export const OpeningTenderRow = z.object({
  tenderId: Id,
  reference: Reference,
  title: z.string().min(1),
  eventType: TendersEventType,
  procedure: TendersProcedure,
  participation: TendersParticipation,
  status: TendersStatus,
  openingMode: TendersOpeningMode,
  owner: PersonRef,
  submissionDeadline: OfficialDeadline.nullable(),
  closedAt: Instant.nullable(),
  progress: OpeningProgress,
  /** Unique effective submissions (never drafts); `null` before closing. */
  effectiveSubmissionCount: z.number().int().min(0).nullable(),
  envelopesOpened: z.array(TenderEnvelopesEnvelope),
  nextSession: z
    .object({
      sessionId: Id,
      envelope: OpeningSessionsEnvelope,
      lot: LotRef.nullable(),
      scheduledAt: OfficialDeadline,
      status: OpeningSessionsStatus,
    })
    .nullable(),
  priceGatePending: z.boolean(),
  pendingClarifications: z.number().int().min(0),
  activeExclusions: z.number().int().min(0),
});
export type OpeningTenderRow = z.infer<typeof OpeningTenderRow>;

export const OPENING_TENDER_SORTS = ['reference', 'deadline', 'closedAt', 'status'] as const;
export const OpeningTenderListQuery = listQueryWithSort(OPENING_TENDER_SORTS).extend({
  status: queryList(TendersStatus).optional(),
  openingMode: queryList(TendersOpeningMode).optional(),
  progress: queryList(OpeningProgress).optional(),
  ownerUserId: IdParam.optional(),
  priceGatePending: QueryBoolean.optional(),
  closedFrom: CalendarDate.optional(),
  closedTo: CalendarDate.optional(),
});

export const TenderParams = z.object({ tenderId: IdParam });

export const OpeningStage = z.object({
  envelope: OpeningSessionsEnvelope,
  openOrder: z.number().int().min(1),
  lot: LotRef.nullable(),
  state: StageState,
  sessionId: Id.nullable(),
  openedAt: Instant.nullable(),
});
export type OpeningStage = z.infer<typeof OpeningStage>;

/** Receipt metadata of a bid (`v_bid_receipt_metadata`) plus its opening state. Never sealed content. */
export const OpeningBidRow = z.object({
  bidId: Id,
  revisionId: Id,
  supplier: BidSupplier,
  receiptNo: Reference,
  receivedAt: Instant,
  submissionState: BidsSubmissionState,
  receiptStatus: SubmissionReceiptsStatus,
  documentCount: z.number().int().min(0),
  lots: z.array(LotRef),
  envelopes: z.array(BidEnvelopeState),
});
export type OpeningBidRow = z.infer<typeof OpeningBidRow>;

export const OpeningSessionRow = z.object({
  id: Id,
  tenderId: Id,
  tenderReference: Reference,
  tenderTitle: z.string().min(1),
  lot: LotRef.nullable(),
  envelope: OpeningSessionsEnvelope,
  status: OpeningSessionsStatus,
  scheduledAt: OfficialDeadline,
  openedAt: Instant.nullable(),
  openingOfficer: PersonRef,
  quorum: QuorumState,
  envelopesOpened: z.number().int().min(0),
  publicReleaseApproved: z.boolean(),
});
export type OpeningSessionRow = z.infer<typeof OpeningSessionRow>;

export const TenderOpeningOverview = z.object({
  tender: OpeningTenderRow.omit({ nextSession: true }).extend({
    officialTimeZone: z.string().min(1),
    publicOpeningRequired: z.boolean(),
  }),
  lots: z.array(LotRef),
  stages: z.array(OpeningStage),
  priceGates: z.array(PriceGateState),
  sessions: z.array(OpeningSessionRow),
  /** Receipt metadata of every non-draft bid, including withdrawn ones (history is kept, BR-21). */
  bids: z.array(OpeningBidRow),
});
export type TenderOpeningOverview = z.infer<typeof TenderOpeningOverview>;

export const OpeningTeamMember = z.object({
  user: PersonRef,
  capacity: z.string().nullable(),
  teamRole: TenderTeamMembersTeamRole,
  eligibleRoles: z.array(OpeningParticipantsRole).min(1),
});
export type OpeningTeamMember = z.infer<typeof OpeningTeamMember>;

export const OpeningTeam = z.object({ items: z.array(OpeningTeamMember) });
export type OpeningTeam = z.infer<typeof OpeningTeam>;

// ---------------------------------------------------------------------------------------------------------
// Opening sessions (BUY-20)
// ---------------------------------------------------------------------------------------------------------

export const OPENING_SESSION_SORTS = ['scheduledAt', 'openedAt', 'reference', 'status'] as const;
export const OpeningSessionListQuery = listQueryWithSort(OPENING_SESSION_SORTS).extend({
  tenderId: IdParam.optional(),
  status: queryList(OpeningSessionsStatus).optional(),
  envelope: queryList(OpeningSessionsEnvelope).optional(),
  officerUserId: IdParam.optional(),
  scheduledFrom: CalendarDate.optional(),
  scheduledTo: CalendarDate.optional(),
});

export const SessionParams = z.object({ sessionId: IdParam });
export const ParticipantParams = z.object({ sessionId: IdParam, participantId: IdParam });

export const OpeningParticipant = z.object({
  id: Id,
  user: PersonRef,
  capacity: z.string().nullable(),
  role: OpeningParticipantsRole,
  confirmedAt: Instant.nullable(),
});
export type OpeningParticipant = z.infer<typeof OpeningParticipant>;

/** An eligible (or withheld) bid of a session, with receipt metadata only. */
export const SessionBid = z.object({
  bidId: Id,
  revisionId: Id,
  supplier: BidSupplier,
  receiptNo: Reference,
  receivedAt: Instant,
  submissionState: BidsSubmissionState,
  eligible: z.boolean(),
  ineligibleReason: IneligibleReason.nullable(),
  envelopes: z.array(BidEnvelopeState),
});
export type SessionBid = z.infer<typeof SessionBid>;

/** An `envelope_openings` row: the unseal record. */
export const EnvelopeOpening = z.object({
  id: Id,
  bidId: Id,
  revisionId: Id,
  supplier: BidSupplier,
  envelope: TenderEnvelopesEnvelope,
  openedAt: Instant,
});
export type EnvelopeOpening = z.infer<typeof EnvelopeOpening>;

export const OpeningReadinessItem = z.object({
  code: OpeningReadinessCode,
  status: ReadinessStatus,
});
export type OpeningReadinessItem = z.infer<typeof OpeningReadinessItem>;

export const OpeningSessionDetail = OpeningSessionRow.extend({
  tenderStatus: TendersStatus,
  openingMode: TendersOpeningMode,
  quorumRequired: z.number().int().min(1),
  participants: z.array(OpeningParticipant),
  /** The caller's own participant row, if any (the row they may confirm). */
  myParticipantId: Id.nullable(),
  bids: z.array(SessionBid),
  openings: z.array(EnvelopeOpening),
  priceGate: PriceGateState,
  readiness: z.array(OpeningReadinessItem),
  minutes: z.string().nullable(),
  irregularities: z.string().nullable(),
  publicReleaseSummary: z.string().nullable(),
});
export type OpeningSessionDetail = z.infer<typeof OpeningSessionDetail>;

export const ScheduleParticipant = z.object({
  userId: Id,
  role: OpeningParticipantsRole,
});

export const ScheduleOpeningSessionBody = z
  .object({
    tenderId: Id,
    lotId: Id.nullable().optional(),
    envelope: OpeningSessionsEnvelope,
    scheduledAt: Instant,
    quorumRequired: z
      .number({ error: issue('INVALID_QUORUM', 'Enter the number of participants required.') })
      .int(issue('INVALID_QUORUM', 'Use a whole number.'))
      .min(2, issue('INVALID_QUORUM', 'Opening needs at least the officer and a second person.'))
      .max(9, issue('INVALID_QUORUM', 'At most 9 participants.')),
    participants: z
      .array(ScheduleParticipant)
      .min(2, issue('WITNESS_REQUIRED', 'Name the opening officer and at least one witness.'))
      .max(12, issue('TOO_MANY_PARTICIPANTS', 'At most 12 participants.')),
  })
  .superRefine((body, ctx) => {
    const officers = body.participants.filter((participant) => participant.role === 'opening_officer');
    if (officers.length !== 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['participants'],
        message: issue('OPENING_OFFICER_REQUIRED', 'Name exactly one opening officer.'),
      });
    }
    if (!body.participants.some((participant) => participant.role === 'witness' || participant.role === 'committee_member')) {
      ctx.addIssue({
        code: 'custom',
        path: ['participants'],
        message: issue('WITNESS_REQUIRED', 'Name at least one witness or committee member.'),
      });
    }
    const userIds = body.participants.map((participant) => participant.userId);
    if (new Set(userIds).size !== userIds.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['participants'],
        message: issue('DUPLICATE_PARTICIPANT', 'Each person can take part once.'),
      });
    }
    const counted = body.participants.filter((participant) => participant.role !== 'observer').length;
    if (body.quorumRequired > counted) {
      ctx.addIssue({
        code: 'custom',
        path: ['quorumRequired'],
        message: issue('QUORUM_EXCEEDS_PARTICIPANTS', 'The quorum cannot exceed the officer, witnesses and committee members named.'),
      });
    }
  });
export type ScheduleOpeningSessionBody = z.infer<typeof ScheduleOpeningSessionBody>;

export const ConfirmParticipantResponse = z.object({
  sessionId: Id,
  participant: OpeningParticipant,
  sessionStatus: OpeningSessionsStatus,
  quorum: QuorumState,
});
export type ConfirmParticipantResponse = z.infer<typeof ConfirmParticipantResponse>;

export const OpenSessionBody = z.object({
  /** The officer confirms that no conflict or hold prevents opening (BR-08). */
  noConflictConfirmed: z.literal(true, {
    error: issue('CONFLICT_CONFIRMATION_REQUIRED', 'Confirm that you have no conflict with any bidder.'),
  }),
  minutes: LongText(20000).optional(),
  irregularities: LongText(4000).optional(),
});
export type OpenSessionBody = z.infer<typeof OpenSessionBody>;

export const RecordSessionBody = z.object({
  minutes: z
    .string()
    .trim()
    .min(1, issue('MINUTES_REQUIRED', 'Record the minutes.'))
    .max(20000, issue('TEXT_TOO_LONG', 'At most 20000 characters.')),
  irregularities: LongText(4000).nullable(),
});
export type RecordSessionBody = z.infer<typeof RecordSessionBody>;

export const PublicSummaryBody = z.object({
  publicReleaseSummary: z
    .string()
    .trim()
    .min(1, issue('SUMMARY_REQUIRED', 'Write the public opening summary.'))
    .max(4000, issue('TEXT_TOO_LONG', 'At most 4000 characters.')),
});
export type PublicSummaryBody = z.infer<typeof PublicSummaryBody>;

export const AbortSessionBody = z.object({ reason: ReasonText });
export type AbortSessionBody = z.infer<typeof AbortSessionBody>;

// ---------------------------------------------------------------------------------------------------------
// Compliance (BUY-21)
// ---------------------------------------------------------------------------------------------------------

export const CheckSummary = z.object({
  pass: z.number().int().min(0),
  fail: z.number().int().min(0),
  clarificationRequired: z.number().int().min(0),
  pending: z.number().int().min(0),
  notApplicable: z.number().int().min(0),
});
export type CheckSummary = z.infer<typeof CheckSummary>;

export const ComplianceBidRow = z.object({
  bidId: Id,
  revisionId: Id,
  tenderId: Id,
  supplier: BidSupplier,
  receiptNo: Reference,
  receivedAt: Instant,
  submissionState: BidsSubmissionState,
  receiptStatus: SubmissionReceiptsStatus,
  lots: z.array(LotRef),
  complianceStatus: BidsComplianceStatus,
  evaluationStatus: BidsEvaluationStatus,
  envelopes: z.array(BidEnvelopeState),
  checkSummary: CheckSummary,
  openClarifications: z.number().int().min(0),
  exclusion: z.object({ exclusionId: Id, status: ExclusionsStatus }).nullable(),
  /** False for excluded, withdrawn or late bids and while an exclusion is pending: never ranked (AC-17). */
  rankingEligible: z.boolean(),
});
export type ComplianceBidRow = z.infer<typeof ComplianceBidRow>;

export const COMPLIANCE_BID_SORTS = ['supplierName', 'receivedAt', 'complianceStatus'] as const;
export const ComplianceBidListQuery = listQueryWithSort(COMPLIANCE_BID_SORTS).extend({
  complianceStatus: queryList(BidsComplianceStatus).optional(),
  submissionState: queryList(BidsSubmissionState).optional(),
  lotId: IdParam.optional(),
  rankingEligible: QueryBoolean.optional(),
});

export const BidParams = z.object({ bidId: IdParam });
export const CheckParams = z.object({ checkId: IdParam });

export const RequirementRef = z.object({
  requirementId: Id,
  refCode: z.string().min(1),
  text: z.string().min(1),
});
export type RequirementRef = z.infer<typeof RequirementRef>;

export const ComplianceCheck = z.object({
  id: Id,
  bidId: Id,
  revisionId: Id,
  checkType: ComplianceChecksCheckType,
  requirement: RequirementRef.nullable(),
  findingClass: ComplianceChecksFindingClass,
  result: ComplianceChecksResult,
  reason: z.string().nullable(),
  evidenceRef: z.string().nullable(),
  assessedBy: PersonRef.nullable(),
  assessedAt: Instant.nullable(),
});
export type ComplianceCheck = z.infer<typeof ComplianceCheck>;

/** Consistency of a check's result, finding class, reason and evidence (FR-13). Shared by the body and fixtures. */
function refineCheck(
  check: { result: string; findingClass: string; reason?: string | null | undefined; evidenceRef?: string | null | undefined },
  ctx: z.RefinementCtx,
): void {
  const hasReason = typeof check.reason === 'string' && check.reason.trim() !== '';
  const hasEvidence = typeof check.evidenceRef === 'string' && check.evidenceRef.trim() !== '';
  if (check.result === 'not_applicable' && !hasReason) {
    ctx.addIssue({ code: 'custom', path: ['reason'], message: issue('REASON_REQUIRED', 'Explain why the check does not apply.') });
  }
  if ((check.result === 'fail' || check.result === 'pass' || check.result === 'clarification_required') && !hasEvidence) {
    ctx.addIssue({ code: 'custom', path: ['evidenceRef'], message: issue('EVIDENCE_REQUIRED', 'Cite the evidence for this finding.') });
  }
  if (check.result === 'fail' && !hasReason) {
    ctx.addIssue({ code: 'custom', path: ['reason'], message: issue('REASON_REQUIRED', 'Explain the failure.') });
  }
  if (
    check.result === 'fail' &&
    check.findingClass !== 'administrative_omission' &&
    check.findingClass !== 'substantive_noncompliance'
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['findingClass'],
      message: issue('FINDING_CLASS_MISMATCH', 'A failure is an administrative omission or a substantive noncompliance.'),
    });
  }
  if (check.result === 'clarification_required' && check.findingClass !== 'clarifiable') {
    ctx.addIssue({
      code: 'custom',
      path: ['findingClass'],
      message: issue('FINDING_CLASS_MISMATCH', 'Only a clarifiable matter can be sent for clarification.'),
    });
  }
  if ((check.result === 'not_applicable' || check.result === 'pending') && check.findingClass !== 'none') {
    ctx.addIssue({
      code: 'custom',
      path: ['findingClass'],
      message: issue('FINDING_CLASS_MISMATCH', 'A pending or not applicable check has no finding.'),
    });
  }
}

/** A compliance check whose fields are consistent (used to validate fixtures). */
export const ConsistentComplianceCheck = ComplianceCheck.superRefine(refineCheck);

export const RecordCheckBody = z
  .object({
    result: ComplianceChecksResult.exclude(['pending']),
    findingClass: ComplianceChecksFindingClass,
    reason: LongText(4000).nullable().optional(),
    evidenceRef: LongText(1000).nullable().optional(),
  })
  .superRefine(refineCheck);
export type RecordCheckBody = z.infer<typeof RecordCheckBody>;

export const ComplianceDecisionBody = z.object({
  outcome: BidsComplianceStatus.extract(['compliant', 'non_compliant']),
  note: LongText(4000).optional(),
});
export type ComplianceDecisionBody = z.infer<typeof ComplianceDecisionBody>;

// ---------------------------------------------------------------------------------------------------------
// Bid clarifications (BUY-21, EVA-03)
// ---------------------------------------------------------------------------------------------------------

export const ClarificationParams = z.object({ clarificationId: IdParam });

export const ClarificationRow = z.object({
  id: Id,
  tenderId: Id,
  tenderReference: Reference,
  bidId: Id,
  supplier: BidSupplier,
  source: BidClarificationsSource,
  question: z.string().min(1),
  permittedScope: z.string().min(1),
  dueAt: OfficialDeadline.nullable(),
  status: BidClarificationsStatus,
  raisedBy: PersonRef,
  raisedAt: Instant,
  approvedBy: PersonRef.nullable(),
  consolidatedIntoId: Id.nullable(),
  /** How many other questions were merged into this one. */
  consolidatedCount: z.number().int().min(0),
  respondedAt: Instant.nullable(),
  effect: BidClarificationsEffect.nullable(),
});
export type ClarificationRow = z.infer<typeof ClarificationRow>;

export const ClarificationDetail = ClarificationRow.extend({
  responseText: z.string().nullable(),
  respondedBy: PersonRef.nullable(),
  effectNote: z.string().nullable(),
  attachments: z.array(ClarificationAttachment),
  /** The questions merged into this one (EVA-03). */
  consolidated: z.array(ClarificationRow),
  /**
   * Assessors who received the answer (EVA-03, BR-22: every affected assessor gets the same answer).
   *
   * Storage source (Stage B): schema-blueprint Migration 10 has no column or table for it yet. The planned source is
   * a `bid_clarification_recipients(clarification_id, user_id, distributed_at)` table written by `recordEffect`
   * (reported as a blueprint follow-up by the opening domain); until it exists Stage B derives the list from the
   * `notifications` rows with `related_type = 'bid_clarification'` and `related_id` = this clarification.
   */
  distributedTo: z.array(PersonRef),
});
export type ClarificationDetail = z.infer<typeof ClarificationDetail>;

export const CLARIFICATION_SORTS = ['dueAt', 'raisedAt', 'status', 'reference'] as const;
export const ClarificationListQuery = listQueryWithSort(CLARIFICATION_SORTS).extend({
  tenderId: IdParam.optional(),
  bidId: IdParam.optional(),
  status: queryList(BidClarificationsStatus).optional(),
  source: queryList(BidClarificationsSource).optional(),
  raisedBy: IdParam.optional(),
  dueFrom: CalendarDate.optional(),
  dueTo: CalendarDate.optional(),
  /** Include questions already merged into another (default: hidden). */
  includeConsolidated: QueryBoolean.optional(),
});

const QuestionText = z
  .string()
  .trim()
  .min(10, issue('QUESTION_TOO_SHORT', 'Write the question in at least 10 characters.'))
  .max(4000, issue('TEXT_TOO_LONG', 'At most 4000 characters.'));
const ScopeText = z
  .string()
  .trim()
  .min(10, issue('SCOPE_REQUIRED', 'State what the supplier may clarify (BR-22).'))
  .max(2000, issue('TEXT_TOO_LONG', 'At most 2000 characters.'));

export const RaiseClarificationBody = z.object({
  bidId: Id,
  source: BidClarificationsSource,
  question: QuestionText,
  permittedScope: ScopeText,
  dueAt: Instant,
});
export type RaiseClarificationBody = z.infer<typeof RaiseClarificationBody>;

export const ConsolidateClarificationsBody = z.object({
  clarificationIds: z
    .array(Id)
    .min(1, issue('CONSOLIDATION_EMPTY', 'Select at least one question to merge.'))
    .max(20, issue('CONSOLIDATION_TOO_LARGE', 'Merge at most 20 questions at once.')),
  question: QuestionText.optional(),
  permittedScope: ScopeText.optional(),
});
export type ConsolidateClarificationsBody = z.infer<typeof ConsolidateClarificationsBody>;

export const RecordEffectBody = z.object({
  effect: BidClarificationsEffect,
  effectNote: z
    .string()
    .trim()
    .min(1, issue('EFFECT_NOTE_REQUIRED', 'Explain the effect on compliance or assessment.'))
    .max(4000, issue('TEXT_TOO_LONG', 'At most 4000 characters.')),
  /**
   * Assessors who receive the answer (EVA-03). Stored as `bid_clarification_recipients` rows in Stage B (blueprint
   * follow-up; see `ClarificationDetail.distributedTo`), each with a notification of `related_type = 'bid_clarification'`.
   */
  distributeToUserIds: z.array(Id).max(20, issue('TOO_MANY_RECIPIENTS', 'At most 20 assessors.')).default([]),
});
export type RecordEffectBody = z.infer<typeof RecordEffectBody>;

// ---------------------------------------------------------------------------------------------------------
// Exclusions (BUY-21, AC-17)
// ---------------------------------------------------------------------------------------------------------

export const ExclusionParams = z.object({ exclusionId: IdParam });

export const ExclusionRow = z.object({
  id: Id,
  tenderId: Id,
  tenderReference: Reference,
  tenderTitle: z.string().min(1),
  bidId: Id,
  supplier: BidSupplier,
  grounds: z.string().min(1),
  checkIds: z.array(Id).min(1),
  status: ExclusionsStatus,
  proposedBy: PersonRef,
  proposedAt: Instant,
  approvalRequestId: Id.nullable(),
  approvalStatus: ApprovalRequestsStatus.nullable(),
  noticeId: Id.nullable(),
  noticeStatus: NoticesStatus.nullable(),
  notifiedAt: Instant.nullable(),
  challengeRoute: z.string().min(1),
  /** The bid's commercial envelope: `withheld` (never opened) for an excluded or pending bid. */
  commercialEnvelope: EnvelopeState,
});
export type ExclusionRow = z.infer<typeof ExclusionRow>;

export const ExclusionDetail = ExclusionRow.extend({
  checks: z.array(ComplianceCheck),
  approval: z
    .object({
      approvalRequestId: Id,
      status: ApprovalRequestsStatus,
      decidedAt: Instant.nullable(),
      decidedBy: PersonRef.nullable(),
    })
    .nullable(),
  withdrawnReason: z.string().nullable(),
});
export type ExclusionDetail = z.infer<typeof ExclusionDetail>;

export const EXCLUSION_SORTS = ['proposedAt', 'status', 'reference'] as const;
export const ExclusionListQuery = listQueryWithSort(EXCLUSION_SORTS).extend({
  tenderId: IdParam.optional(),
  status: queryList(ExclusionsStatus).optional(),
  proposedBy: IdParam.optional(),
  proposedFrom: CalendarDate.optional(),
  proposedTo: CalendarDate.optional(),
});

export const ProposeExclusionBody = z.object({
  bidId: Id,
  grounds: z
    .string()
    .trim()
    .min(10, issue('GROUNDS_REQUIRED', 'State the grounds for exclusion.'))
    .max(4000, issue('TEXT_TOO_LONG', 'At most 4000 characters.')),
  checkIds: z
    .array(Id)
    .min(1, issue('CHECKS_REQUIRED', 'Cite at least one failed compliance check.'))
    .max(20, issue('TOO_MANY_CHECKS', 'Cite at most 20 checks.')),
  challengeRoute: z
    .string()
    .trim()
    .min(10, issue('CHALLENGE_ROUTE_REQUIRED', 'State how the supplier can challenge the decision.'))
    .max(2000, issue('TEXT_TOO_LONG', 'At most 2000 characters.')),
});
export type ProposeExclusionBody = z.infer<typeof ProposeExclusionBody>;

export const WithdrawExclusionBody = z.object({ reason: ReasonText });
export type WithdrawExclusionBody = z.infer<typeof WithdrawExclusionBody>;

export const IssueExclusionNoticeBody = z.object({
  /** Optional note added to the formal notice; the grounds and challenge route are always included. */
  message: LongText(4000).optional(),
});
export type IssueExclusionNoticeBody = z.infer<typeof IssueExclusionNoticeBody>;

// ---------------------------------------------------------------------------------------------------------
// Supplier assessment requests (SUP-18)
// ---------------------------------------------------------------------------------------------------------

export const AssessmentRequestParams = z.object({ requestId: IdParam });

/** A supplier's own issued clarification. Never shows internal assessors, consolidation or the recorded effect. */
export const AssessmentRequestRow = z.object({
  id: Id,
  buyer: z.object({ tenantId: Id, name: z.string().min(1) }),
  tenderId: Id,
  tenderReference: Reference,
  tenderTitle: z.string().min(1),
  bidId: Id,
  source: BidClarificationsSource,
  question: z.string().min(1),
  permittedScope: z.string().min(1),
  dueAt: OfficialDeadline.nullable(),
  status: SupplierClarificationStatus,
  respondedAt: Instant.nullable(),
  respondedBy: PersonRef.nullable(),
});
export type AssessmentRequestRow = z.infer<typeof AssessmentRequestRow>;

export const AssessmentRequestDetail = AssessmentRequestRow.extend({
  responseText: z.string().nullable(),
  attachments: z.array(ClarificationAttachment),
});
export type AssessmentRequestDetail = z.infer<typeof AssessmentRequestDetail>;

export const ASSESSMENT_REQUEST_SORTS = ['dueAt', 'reference', 'status'] as const;
export const AssessmentRequestListQuery = listQueryWithSort(ASSESSMENT_REQUEST_SORTS).extend({
  status: queryList(SupplierClarificationStatus).optional(),
  source: queryList(BidClarificationsSource).optional(),
  tenderId: IdParam.optional(),
  dueFrom: CalendarDate.optional(),
  dueTo: CalendarDate.optional(),
});

export const RespondAssessmentRequestBody = z.object({
  responseText: z
    .string()
    .trim()
    .min(1, issue('RESPONSE_REQUIRED', 'Write your response.'))
    .max(8000, issue('TEXT_TOO_LONG', 'At most 8000 characters.')),
  /** Documents uploaded through the supplier document service (related type `bid_clarification`). */
  attachments: z.array(ClarificationAttachment).max(10, issue('TOO_MANY_ATTACHMENTS', 'Attach at most 10 documents.')).default([]),
  /** The supplier confirms the response does not change its submitted offer (BR-22). */
  offerUnchangedConfirmed: z.literal(true, {
    error: issue('OFFER_UNCHANGED_CONFIRMATION_REQUIRED', 'Confirm that the response does not change your offer.'),
  }),
});
export type RespondAssessmentRequestBody = z.infer<typeof RespondAssessmentRequestBody>;

// ---------------------------------------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------------------------------------

const BASE = '/api/v1/buyer/opening' as const;

export const openingEndpoints = {
  // BUY-20 -------------------------------------------------------------------------------------------------
  listTenders: defineEndpoint({
    id: 'buyer.opening.listTenders',
    method: 'GET',
    path: `${BASE}/tenders`,
    audience: 'buyer',
    permission: OPENING_VIEW_PERMISSIONS,
    query: OpeningTenderListQuery,
    response: pageOf(OpeningTenderRow),
    errors: [],
    screens: ['BUY-20', 'BUY-21'],
    summary: 'Tenders approaching or in opening, with their opening progress.',
  }),
  getTender: defineEndpoint({
    id: 'buyer.opening.getTender',
    method: 'GET',
    path: `${BASE}/tenders/:tenderId`,
    audience: 'buyer',
    permission: OPENING_VIEW_PERMISSIONS,
    params: TenderParams,
    response: TenderOpeningOverview,
    errors: [],
    screens: ['BUY-20'],
    summary: 'The opening plan of a tender: stages, price gates, sessions and receipt metadata.',
  }),
  getOpeningTeam: defineEndpoint({
    id: 'buyer.opening.getOpeningTeam',
    method: 'GET',
    path: `${BASE}/tenders/:tenderId/opening-team`,
    audience: 'buyer',
    permission: 'bid.open',
    params: TenderParams,
    response: OpeningTeam,
    errors: [],
    screens: ['BUY-20'],
    summary: 'People assigned to the tender who may take part in an opening.',
  }),
  listSessions: defineEndpoint({
    id: 'buyer.opening.listSessions',
    method: 'GET',
    path: `${BASE}/sessions`,
    audience: 'buyer',
    permission: OPENING_VIEW_PERMISSIONS,
    query: OpeningSessionListQuery,
    response: pageOf(OpeningSessionRow),
    errors: [],
    screens: ['BUY-20'],
  }),
  getSession: defineEndpoint({
    id: 'buyer.opening.getSession',
    method: 'GET',
    path: `${BASE}/sessions/:sessionId`,
    audience: 'buyer',
    permission: OPENING_VIEW_PERMISSIONS,
    params: SessionParams,
    response: OpeningSessionDetail,
    errors: [],
    screens: ['BUY-20'],
  }),
  scheduleSession: defineEndpoint({
    id: 'buyer.opening.scheduleSession',
    method: 'POST',
    path: `${BASE}/sessions`,
    audience: 'buyer',
    permission: 'bid.open',
    body: ScheduleOpeningSessionBody,
    response: OpeningSessionDetail,
    errors: [
      'ENVELOPE_NOT_IN_PLAN',
      'LOT_NOT_IN_TENDER',
      'LOT_CANCELLED',
      'STAGE_ALREADY_OPENED',
      'SESSION_ALREADY_SCHEDULED',
      'PRICE_GATE_NOT_RELEASED',
      'PARTICIPANT_NOT_ELIGIBLE',
      'SCHEDULED_BEFORE_CLOSING',
    ],
    screens: ['BUY-20'],
    idempotent: true,
  }),
  confirmParticipant: defineEndpoint({
    id: 'buyer.opening.confirmParticipant',
    method: 'POST',
    path: `${BASE}/sessions/:sessionId/participants/:participantId/confirm`,
    audience: 'buyer',
    permission: ['bid.open', 'bid.witness'],
    params: ParticipantParams,
    response: ConfirmParticipantResponse,
    errors: ['NOT_THE_PARTICIPANT', 'PARTICIPANT_ALREADY_CONFIRMED', 'SESSION_NOT_OPEN', 'TENDER_NOT_CLOSED'],
    screens: ['BUY-20'],
  }),
  openSession: defineEndpoint({
    id: 'buyer.opening.openSession',
    method: 'POST',
    path: `${BASE}/sessions/:sessionId/open`,
    audience: 'buyer',
    permission: 'bid.open',
    params: SessionParams,
    body: OpenSessionBody,
    response: OpeningSessionDetail,
    errors: [
      'NOT_OPENING_OFFICER',
      'SESSION_NOT_OPEN',
      'QUORUM_NOT_MET',
      'TENDER_NOT_CLOSED',
      'STAGE_OUT_OF_ORDER',
      'PRICE_GATE_NOT_RELEASED',
    ],
    screens: ['BUY-20'],
    summary: 'Opens the eligible envelopes of the session (writes the unseal records).',
  }),
  recordSession: defineEndpoint({
    id: 'buyer.opening.recordSession',
    method: 'PUT',
    path: `${BASE}/sessions/:sessionId/record`,
    audience: 'buyer',
    permission: 'bid.open',
    params: SessionParams,
    body: RecordSessionBody,
    response: OpeningSessionDetail,
    errors: ['NOT_OPENING_OFFICER', 'SESSION_NOT_COMPLETED'],
    screens: ['BUY-20'],
    summary: 'Records the permitted minutes and any irregularities of a completed session.',
  }),
  releasePublicSummary: defineEndpoint({
    id: 'buyer.opening.releasePublicSummary',
    method: 'POST',
    path: `${BASE}/sessions/:sessionId/public-summary`,
    audience: 'buyer',
    permission: 'bid.open',
    params: SessionParams,
    body: PublicSummaryBody,
    response: OpeningSessionDetail,
    errors: ['NOT_OPENING_OFFICER', 'SESSION_NOT_COMPLETED', 'PUBLIC_SUMMARY_ALREADY_RELEASED', 'PUBLIC_OPENING_NOT_REQUIRED'],
    screens: ['BUY-20'],
    summary: 'Issues the permitted public opening information.',
  }),
  abortSession: defineEndpoint({
    id: 'buyer.opening.abortSession',
    method: 'POST',
    path: `${BASE}/sessions/:sessionId/abort`,
    audience: 'buyer',
    permission: 'bid.open',
    params: SessionParams,
    body: AbortSessionBody,
    response: OpeningSessionDetail,
    errors: ['NOT_OPENING_OFFICER', 'SESSION_ALREADY_COMPLETED', 'SESSION_ALREADY_ABORTED'],
    screens: ['BUY-20'],
  }),

  // BUY-21 -------------------------------------------------------------------------------------------------
  listBids: defineEndpoint({
    id: 'buyer.opening.listBids',
    method: 'GET',
    path: `${BASE}/tenders/:tenderId/bids`,
    audience: 'buyer',
    permission: COMPLIANCE_VIEW_PERMISSIONS,
    params: TenderParams,
    query: ComplianceBidListQuery,
    response: pageOf(ComplianceBidRow),
    errors: [],
    screens: ['BUY-21'],
    summary: 'The compliance register of a tender: one row per non-draft bid.',
  }),
  getBidCompliance: defineEndpoint({
    id: 'buyer.opening.getBidCompliance',
    method: 'GET',
    path: `${BASE}/bids/:bidId/compliance`,
    audience: 'buyer',
    permission: COMPLIANCE_VIEW_PERMISSIONS,
    params: BidParams,
    response: z.object({
      bid: ComplianceBidRow,
      tender: z.object({
        tenderId: Id,
        reference: Reference,
        title: z.string().min(1),
        status: TendersStatus,
        openingMode: TendersOpeningMode,
      }),
      /** False until the qualification envelope (or the single-stage session) is opened: checks stay empty. */
      contentAvailable: z.boolean(),
      checks: z.array(ComplianceCheck),
      clarifications: z.array(ClarificationRow),
      exclusions: z.array(ExclusionRow),
    }),
    errors: [],
    screens: ['BUY-21'],
  }),
  recordCheck: defineEndpoint({
    id: 'buyer.opening.recordCheck',
    method: 'PUT',
    path: `${BASE}/checks/:checkId`,
    audience: 'buyer',
    permission: 'compliance.assess',
    params: CheckParams,
    body: RecordCheckBody,
    response: ComplianceCheck,
    errors: ['ENVELOPE_NOT_OPENED', 'BID_EXCLUDED', 'COMPLIANCE_DECIDED'],
    screens: ['BUY-21'],
    summary: 'Records a finding with its class, disposition, reason and evidence.',
  }),
  decideCompliance: defineEndpoint({
    id: 'buyer.opening.decideCompliance',
    method: 'POST',
    path: `${BASE}/bids/:bidId/compliance-decision`,
    audience: 'buyer',
    permission: 'compliance.assess',
    params: BidParams,
    body: ComplianceDecisionBody,
    response: ComplianceBidRow,
    errors: [
      'ENVELOPE_NOT_OPENED',
      'BID_EXCLUDED',
      'CHECKS_PENDING',
      'CLARIFICATION_OPEN',
      'OUTCOME_CONTRADICTS_CHECKS',
      'EXCLUSION_IN_PROGRESS',
      'COMPLIANCE_DECIDED',
    ],
    screens: ['BUY-21'],
    summary: 'Concludes the compliance review of a bid once every check is resolved (BR-23).',
  }),

  // Clarifications (BUY-21, EVA-03) ------------------------------------------------------------------------
  listClarifications: defineEndpoint({
    id: 'buyer.opening.listClarifications',
    method: 'GET',
    path: `${BASE}/clarifications`,
    audience: 'buyer',
    permission: CLARIFICATION_VIEW_PERMISSIONS,
    query: ClarificationListQuery,
    response: pageOf(ClarificationRow),
    errors: [],
    screens: ['BUY-21', 'EVA-03'],
  }),
  getClarification: defineEndpoint({
    id: 'buyer.opening.getClarification',
    method: 'GET',
    path: `${BASE}/clarifications/:clarificationId`,
    audience: 'buyer',
    permission: CLARIFICATION_VIEW_PERMISSIONS,
    params: ClarificationParams,
    response: ClarificationDetail,
    errors: [],
    screens: ['BUY-21', 'EVA-03'],
  }),
  raiseClarification: defineEndpoint({
    id: 'buyer.opening.raiseClarification',
    method: 'POST',
    path: `${BASE}/clarifications`,
    audience: 'buyer',
    permission: CLARIFICATION_RAISE_PERMISSIONS,
    body: RaiseClarificationBody,
    response: ClarificationDetail,
    errors: ['BID_NOT_OPENED', 'BID_EXCLUDED', 'BID_NOT_ELIGIBLE', 'SOURCE_NOT_PERMITTED', 'DUE_DATE_IN_PAST'],
    screens: ['BUY-21', 'EVA-03'],
    idempotent: true,
    summary: 'Drafts a question to one supplier with its permitted scope (BR-22).',
  }),
  consolidateClarifications: defineEndpoint({
    id: 'buyer.opening.consolidateClarifications',
    method: 'POST',
    path: `${BASE}/clarifications/:clarificationId/consolidate`,
    audience: 'buyer',
    permission: 'evaluation.chair',
    params: ClarificationParams,
    body: ConsolidateClarificationsBody,
    response: ClarificationDetail,
    errors: ['CLARIFICATION_NOT_DRAFT', 'CONSOLIDATION_DIFFERENT_BID', 'CONSOLIDATION_SELF'],
    screens: ['EVA-03'],
    summary: 'Merges duplicate assessor questions into this draft.',
  }),
  approveClarification: defineEndpoint({
    id: 'buyer.opening.approveClarification',
    method: 'POST',
    path: `${BASE}/clarifications/:clarificationId/approve`,
    audience: 'buyer',
    permission: ['evaluation.chair', 'exclusion.approve'],
    params: ClarificationParams,
    response: ClarificationDetail,
    errors: ['CLARIFICATION_NOT_DRAFT', 'CLARIFICATION_CONSOLIDATED', 'SELF_APPROVAL_NOT_PERMITTED'],
    screens: ['BUY-21', 'EVA-03'],
  }),
  issueClarification: defineEndpoint({
    id: 'buyer.opening.issueClarification',
    method: 'POST',
    path: `${BASE}/clarifications/:clarificationId/issue`,
    audience: 'buyer',
    permission: ['compliance.assess', 'evaluation.chair'],
    params: ClarificationParams,
    response: ClarificationDetail,
    errors: ['CLARIFICATION_NOT_APPROVED', 'DUE_DATE_IN_PAST'],
    screens: ['BUY-21', 'EVA-03'],
  }),
  recordClarificationEffect: defineEndpoint({
    id: 'buyer.opening.recordClarificationEffect',
    method: 'POST',
    path: `${BASE}/clarifications/:clarificationId/effect`,
    audience: 'buyer',
    permission: ['compliance.assess', 'evaluation.chair'],
    params: ClarificationParams,
    body: RecordEffectBody,
    response: ClarificationDetail,
    errors: ['CLARIFICATION_NOT_RESPONDED', 'RECIPIENT_NOT_ASSESSOR'],
    screens: ['BUY-21', 'EVA-03'],
    summary: 'Records the effect of the answer and distributes it to the affected assessors.',
  }),

  // Exclusions (BUY-21) ------------------------------------------------------------------------------------
  listExclusions: defineEndpoint({
    id: 'buyer.opening.listExclusions',
    method: 'GET',
    path: `${BASE}/exclusions`,
    audience: 'buyer',
    permission: ['compliance.assess', 'exclusion.approve'],
    query: ExclusionListQuery,
    response: pageOf(ExclusionRow),
    errors: [],
    screens: ['BUY-21'],
  }),
  getExclusion: defineEndpoint({
    id: 'buyer.opening.getExclusion',
    method: 'GET',
    path: `${BASE}/exclusions/:exclusionId`,
    audience: 'buyer',
    permission: ['compliance.assess', 'exclusion.approve'],
    params: ExclusionParams,
    response: ExclusionDetail,
    errors: [],
    screens: ['BUY-21'],
  }),
  proposeExclusion: defineEndpoint({
    id: 'buyer.opening.proposeExclusion',
    method: 'POST',
    path: `${BASE}/exclusions`,
    audience: 'buyer',
    permission: 'compliance.assess',
    body: ProposeExclusionBody,
    response: ExclusionDetail,
    errors: ['BID_NOT_OPENED', 'CHECK_NOT_ON_BID', 'CHECKS_NOT_FAILED', 'EXCLUSION_ALREADY_ACTIVE', 'CLARIFICATION_OPEN'],
    screens: ['BUY-21'],
    idempotent: true,
    summary: 'Proposes an exclusion citing failed checks; approval is requested through the approvals contract.',
  }),
  withdrawExclusion: defineEndpoint({
    id: 'buyer.opening.withdrawExclusion',
    method: 'POST',
    path: `${BASE}/exclusions/:exclusionId/withdraw`,
    audience: 'buyer',
    permission: 'compliance.assess',
    params: ExclusionParams,
    body: WithdrawExclusionBody,
    response: ExclusionDetail,
    errors: ['EXCLUSION_ALREADY_DECIDED'],
    screens: ['BUY-21'],
  }),
  issueExclusionNotice: defineEndpoint({
    id: 'buyer.opening.issueExclusionNotice',
    method: 'POST',
    path: `${BASE}/exclusions/:exclusionId/notice`,
    audience: 'buyer',
    permission: 'notice.issue',
    params: ExclusionParams,
    body: IssueExclusionNoticeBody,
    response: ExclusionDetail,
    errors: ['EXCLUSION_NOT_APPROVED', 'NOTICE_ALREADY_ISSUED'],
    screens: ['BUY-21'],
    summary: 'Issues the formal exclusion notice with the challenge route.',
  }),

  // SUP-18 -------------------------------------------------------------------------------------------------
  listAssessmentRequests: defineEndpoint({
    id: 'supplier.opening.listAssessmentRequests',
    method: 'GET',
    path: '/api/v1/supplier/assessment-requests',
    audience: 'supplier',
    permission: ASSESSMENT_REQUEST_VIEW_PERMISSIONS,
    query: AssessmentRequestListQuery,
    response: pageOf(AssessmentRequestRow),
    errors: [],
    screens: ['SUP-18'],
  }),
  getAssessmentRequest: defineEndpoint({
    id: 'supplier.opening.getAssessmentRequest',
    method: 'GET',
    path: '/api/v1/supplier/assessment-requests/:requestId',
    audience: 'supplier',
    permission: ASSESSMENT_REQUEST_VIEW_PERMISSIONS,
    params: AssessmentRequestParams,
    response: AssessmentRequestDetail,
    errors: [],
    screens: ['SUP-18'],
  }),
  respondAssessmentRequest: defineEndpoint({
    id: 'supplier.opening.respondAssessmentRequest',
    method: 'POST',
    path: '/api/v1/supplier/assessment-requests/:requestId/response',
    audience: 'supplier',
    permission: ASSESSMENT_REQUEST_RESPOND_PERMISSION,
    params: AssessmentRequestParams,
    body: RespondAssessmentRequestBody,
    response: AssessmentRequestDetail,
    errors: ['REQUEST_NOT_OPEN', 'RESPONSE_DEADLINE_PASSED'],
    screens: ['SUP-18'],
    summary: 'Answers within the permitted scope; the answer is attached to the request and never becomes a new bid.',
  }),
};

/** The number of endpoints in this contract. */
export const OPENING_ENDPOINT_COUNT = Object.keys(openingEndpoints).length;
