/**
 * Schemas of the bids contract (FR-11, FR-12; BR-17..BR-21; SUP-12..SUP-17, BUY-19). The endpoint map lives in
 * `../bids.ts`, which re-exports everything here.
 *
 * Field names mirror the blueprint Migration 09 tables (`bids`, `bid_lots`, `bid_revisions`, `bid_answers`,
 * `bid_answer_documents`, `bid_prices`, `bid_commercial_terms`, `bid_declarations`, `bid_subcontractors`,
 * `bid_key_personnel`, `bid_exceptions`, `consortium_members`, `bid_internal_approvals`, `bid_internal_comments`,
 * `submission_attempts`, `submission_receipts`, `receipt_inventory_items`, `withdrawals`) and the view
 * `v_bid_receipt_metadata` (DD-13), in camelCase.
 *
 * Business rules the shapes encode:
 * - `bids.submission_state` is the ONLY official status. A revision that is `approved_internally` is still
 *   `not_submitted` until a receipt exists (BR-18, AC-11).
 * - A failed replacement never supersedes the effective receipt (BR-19, AC-12); a late attempt is recorded with its
 *   true completion time and rejected (BR-20, AC-13); an explicit withdrawal returns a confirmation number (AC-14).
 * - Prices are decimal strings. `priced`, `included` and `not_offered` are distinct from a zero price; a line that is
 *   not yet entered has `priceStatus: null` (DD-32).
 * - Readiness separates `blocking` errors from `warning`s (FR-11).
 * - The buyer sees receipt metadata only (unique suppliers, never drafts, never content) before opening (BR-17).
 *
 * Pure module: zod and sibling contract files only.
 */
import { z } from 'zod';

import {
  CurrencyCode,
  DecimalString,
  Id,
  IdParam,
  Instant,
  LinkPath,
  Money,
  NonNegativeDecimalString,
  OfficialDeadline,
  PersonRef,
  ActorRef,
  QueryBoolean,
  ReasonText,
  Reference,
  issue,
  listQueryWithSort,
  pageOf,
  queryList,
} from '../common.js';
import {
  BidAnswersEnvelope,
  BidAnswersProgress,
  BidDeclarationsDeclarationType,
  BidInternalApprovalsApprovalType,
  BidInternalApprovalsStatus,
  BidPricesPriceStatus,
  BidRevisionsStatus,
  BidsRoundType,
  BidsSubmissionState,
  AddendaExistingSubmissionAction,
  EvidenceItemsEvidenceType,
  EvidenceItemsStatus,
  EvidenceItemsVerificationStatus,
  LateSubmissionExceptionsDecision,
  LotsStage,
  PricingItemsChargeType,
  PricingItemsRecurrence,
  PursuitTeamMembersResponsibility,
  ReceiptInventoryItemsEnvelope,
  RequirementsMissingConsequence,
  RequirementsResponseType,
  RequirementsTreatment,
  ServiceIncidentsStatus,
  SubmissionAttemptsOutcome,
  SubmissionReceiptsStatus,
  TendersEventType,
  TendersParticipation,
  TendersStatus,
} from '../enums.js';
import { ServiceIncidentSeverity } from '../operations/shared.js';

// ---------------------------------------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------------------------------------

/** A SHA-256 content hash (lower-case hex) of a revision or a file. */
export const ContentHash = z
  .string()
  .regex(/^[0-9a-f]{64}$/, issue('INVALID_CONTENT_HASH', 'Must be a SHA-256 hex digest.'));
export type ContentHash = z.infer<typeof ContentHash>;

/** Short free text (answers, notes). */
const LongText = z.string().max(20_000, issue('TEXT_TOO_LONG', 'At most 20000 characters.'));
const ShortText = z.string().trim().max(500, issue('TEXT_TOO_LONG', 'At most 500 characters.'));
const NoteText = z.string().trim().max(4000, issue('TEXT_TOO_LONG', 'At most 4000 characters.'));

/** The buyer organization of a tender, as a supplier sees it. */
export const BuyerLabel = z.object({
  tenantId: Id,
  name: z.string().min(1),
  slug: z.string().min(1),
});
export type BuyerLabel = z.infer<typeof BuyerLabel>;

/** The supplier legal party of a response (BR-04; the legal name valid at the relevant time). */
export const LegalParty = z.object({
  tenantId: Id,
  legalName: z.string().min(1),
});
export type LegalParty = z.infer<typeof LegalParty>;

/** A lot reference. */
export const LotRef = z.object({
  lotId: Id,
  lotNo: z.number().int().min(1),
  title: z.string().min(1),
});
export type LotRef = z.infer<typeof LotRef>;

/** The tender a response belongs to, as the supplier sees it. */
export const BidTenderRef = z.object({
  tenderId: Id,
  reference: Reference,
  title: z.string().min(1),
  eventType: TendersEventType,
  status: TendersStatus,
  buyer: BuyerLabel,
});
export type BidTenderRef = z.infer<typeof BidTenderRef>;

/** Confirmation of the acting organization and capacity before a consequential action (COM-02). */
export const ContextConfirmation = z.object({
  tenantId: Id,
  capacity: z.string().trim().min(1, issue('CAPACITY_REQUIRED', 'Confirm the capacity you act in.')).max(200),
});
export type ContextConfirmation = z.infer<typeof ContextConfirmation>;

// ---------------------------------------------------------------------------------------------------------
// Revisions, receipts, attempts, withdrawals
// ---------------------------------------------------------------------------------------------------------

/** `bid_revisions` as the supplier team sees it. */
export const BidRevision = z.object({
  id: Id,
  bidId: Id,
  revisionNo: z.number().int().min(1),
  status: BidRevisionsStatus,
  basedOnRevisionId: Id.nullable(),
  basedOnRevisionNo: z.number().int().min(1).nullable(),
  contentHash: ContentHash,
  acknowledgedTenderVersion: z.number().int().min(0),
  internallyApprovedAt: Instant.nullable(),
  /** The official receipt time (only for a revision that obtained a receipt). */
  submittedAt: Instant.nullable(),
  receiptId: Id.nullable(),
  receiptNo: Reference.nullable(),
  createdBy: PersonRef,
  createdAt: Instant,
  updatedAt: Instant,
  /** The revision behind the effective receipt. */
  isEffective: z.boolean(),
  /** The revision the team is currently preparing (draft, review, approved internally, or failed and retryable). */
  isWorking: z.boolean(),
});
export type BidRevision = z.infer<typeof BidRevision>;

/** A receipt in a list (`submission_receipts`). */
export const ReceiptSummary = z.object({
  id: Id,
  receiptNo: Reference,
  bidId: Id,
  revisionId: Id,
  revisionNo: z.number().int().min(1),
  receivedAt: Instant,
  status: SubmissionReceiptsStatus,
  statusChangedAt: Instant,
  documentCount: z.number().int().min(0),
  /** True for the receipt that currently establishes the submission. */
  isEffective: z.boolean(),
});
export type ReceiptSummary = z.infer<typeof ReceiptSummary>;

/** One submitted file (`receipt_inventory_items`). */
export const ReceiptInventoryItem = z.object({
  id: Id,
  documentVersionId: Id,
  fileName: z.string().min(1),
  sha256: ContentHash,
  sizeBytes: z.number().int().min(0),
  envelope: ReceiptInventoryItemsEnvelope,
});
export type ReceiptInventoryItem = z.infer<typeof ReceiptInventoryItem>;

/** The official receipt (FR-12): event, supplier, lots, revision, official time, status and inventory. */
export const Receipt = ReceiptSummary.extend({
  tender: BidTenderRef,
  legalParty: LegalParty,
  submittedBy: ActorRef,
  submitterAuthorityNote: z.string().nullable(),
  lotsSummary: z.string().min(1),
  lots: z.array(LotRef),
  tenderVersionNo: z.number().int().min(0),
  /** The official deadline in force at receipt. */
  deadline: OfficialDeadline,
  inventory: z.array(ReceiptInventoryItem),
  roundType: BidsRoundType,
  /**
   * For a `late_rejected` receipt: how late the attempt completed against the deadline that applied to it, and why it
   * was rejected (BR-20, AC-13). The true receipt time stays in `receivedAt`. Null for every other receipt.
   */
  lateRejection: z
    .object({
      attemptId: Id,
      deadlineAtAttempt: OfficialDeadline,
      lateBySeconds: z.number().int().min(1),
      reason: z.string().nullable(),
    })
    .nullable(),
});
export type Receipt = z.infer<typeof Receipt>;

/** A printable receipt (text/plain), downloaded by the SPA as a file. */
export const ReceiptDownload = z.object({
  fileName: z.string().min(1),
  contentType: z.literal('text/plain'),
  content: z.string().min(1),
});
export type ReceiptDownload = z.infer<typeof ReceiptDownload>;

/** `submission_attempts`: every attempt, including failures, with the true completion time (BR-20, DD-39). */
export const SubmissionAttempt = z.object({
  id: Id,
  bidId: Id,
  revisionId: Id,
  revisionNo: z.number().int().min(1),
  attemptedBy: PersonRef,
  startedAt: Instant,
  /** The server clock at completion (`clock_timestamp()`); null only while an attempt is still in flight. */
  completedAt: Instant.nullable(),
  outcome: SubmissionAttemptsOutcome,
  failureReason: z.string().nullable(),
  /** The official deadline that applied to this attempt. */
  deadlineAtAttempt: OfficialDeadline,
  /** Seconds after the deadline for a late attempt; null otherwise. */
  lateBySeconds: z.number().int().min(1).nullable(),
  /** The receipt produced by this attempt (a success, or the late-rejected record), if any. */
  receiptId: Id.nullable(),
  receiptNo: Reference.nullable(),
});
export type SubmissionAttempt = z.infer<typeof SubmissionAttempt>;

/** `withdrawals`: an explicit withdrawal with its confirmation number (BR-19, AC-14). */
export const Withdrawal = z.object({
  id: Id,
  bidId: Id,
  revisionId: Id,
  revisionNo: z.number().int().min(1),
  receiptId: Id,
  receiptNo: Reference,
  confirmationNo: Reference,
  withdrawnAt: Instant,
  withdrawnBy: ActorRef,
  reason: z.string().min(1),
});
export type Withdrawal = z.infer<typeof Withdrawal>;

/** Why the current effective offer is what it is (SUP-17 "explain the current effective offer"). */
export const EFFECTIVE_OFFER_EXPLANATIONS = [
  'none_submitted',
  'effective_receipt',
  'replacement_in_preparation',
  'replacement_failed_earlier_effective',
  'late_rejected_earlier_effective',
  'late_rejected_none_effective',
  'withdrawn',
] as const;
export const EffectiveOfferExplanation = z.enum(EFFECTIVE_OFFER_EXPLANATIONS);
export type EffectiveOfferExplanation = z.infer<typeof EffectiveOfferExplanation>;

export const EffectiveOffer = z.object({
  explanation: EffectiveOfferExplanation,
  receipt: ReceiptSummary.nullable(),
  /** The last failed or late-rejected attempt that did NOT change the effective offer. */
  lastUnsuccessfulAttempt: SubmissionAttempt.nullable(),
  withdrawal: Withdrawal.nullable(),
});
export type EffectiveOffer = z.infer<typeof EffectiveOffer>;

// ---------------------------------------------------------------------------------------------------------
// Supplier response list and workspace (SUP-12..SUP-17)
// ---------------------------------------------------------------------------------------------------------

/** Answer progress counts (never pricing content). */
export const ProgressCounts = z.object({
  total: z.number().int().min(0),
  notStarted: z.number().int().min(0),
  inProgress: z.number().int().min(0),
  readyForReview: z.number().int().min(0),
  complete: z.number().int().min(0),
});
export type ProgressCounts = z.infer<typeof ProgressCounts>;

/** A response in the supplier's list. */
export const BidSummary = z.object({
  id: Id,
  tender: BidTenderRef,
  roundType: BidsRoundType,
  isAlternative: z.boolean(),
  isConsortium: z.boolean(),
  /** The official status (BR-18). `approved_internally` work is still `not_submitted`. */
  submissionState: BidsSubmissionState,
  deadline: OfficialDeadline,
  lots: z.array(LotRef),
  workingRevision: z
    .object({ id: Id, revisionNo: z.number().int().min(1), status: BidRevisionsStatus })
    .nullable(),
  effectiveReceipt: ReceiptSummary.nullable(),
  progress: ProgressCounts,
  bidManager: PersonRef.nullable(),
  updatedAt: Instant,
});
export type BidSummary = z.infer<typeof BidSummary>;

export const BID_LIST_SORTS = ['deadline', 'reference', 'updatedAt', 'submissionState'] as const;

export const BidListQuery = listQueryWithSort(BID_LIST_SORTS).extend({
  submissionState: queryList(BidsSubmissionState).optional(),
  revisionStatus: queryList(BidRevisionsStatus).optional(),
  roundType: queryList(BidsRoundType).optional(),
  tenderStatus: queryList(TendersStatus).optional(),
  /** The responses to one tender (the opportunity workspace hands off by tender id). */
  tenderId: IdParam.optional(),
  buyerTenantId: IdParam.optional(),
  bidManagerUserId: IdParam.optional(),
  /** Only responses where the caller has assigned answers. */
  assignedToMe: QueryBoolean.optional(),
  deadlineFrom: Instant.optional(),
  deadlineTo: Instant.optional(),
});
export type BidListQuery = z.output<typeof BidListQuery>;
export type BidListQueryInput = z.input<typeof BidListQuery>;

export const BidPage = pageOf(BidSummary);
export type BidPage = z.infer<typeof BidPage>;

/**
 * Why a response workspace cannot be opened for a tender round (the `startBid` refusals, plus the caller's missing
 * `supplier.response.edit` permission). Not a database enumeration: these mirror the endpoint's error codes.
 */
export const BID_START_BLOCKS = [
  'TENDER_NOT_OPEN',
  'ROUND_NOT_OPEN',
  'BID_ALREADY_EXISTS',
  'ALTERNATIVES_NOT_ALLOWED',
  'NOT_PERMITTED',
] as const;
export const BidStartBlock = z.enum(BID_START_BLOCKS);
export type BidStartBlock = z.infer<typeof BidStartBlock>;

/** One workspace the supplier could open for the current round: the main offer or an alternative offer. */
export const BidStartOption = z.object({
  isAlternative: z.boolean(),
  canStart: z.boolean(),
  /** The first reason the workspace cannot be opened; null when `canStart`. */
  blockedBy: BidStartBlock.nullable(),
  /** The supplier's existing response for this round and variant (`BID_ALREADY_EXISTS`). */
  existingBidId: Id.nullable(),
});
export type BidStartOption = z.infer<typeof BidStartOption>;

/** What the supplier may start for a tender (SUP-08 hand-off to SUP-12): the round, deadline and offer variants. */
export const BidStartOptions = z.object({
  tender: BidTenderRef,
  /** The current round, which a new workspace answers. */
  roundType: BidsRoundType,
  deadline: OfficialDeadline,
  alternativesAllowed: z.boolean(),
  lots: z.array(LotRef),
  /** The main offer first, then the alternative offer when the tender accepts alternatives. */
  options: z.array(BidStartOption).min(1),
});
export type BidStartOptions = z.infer<typeof BidStartOptions>;

/** A lot of the tender, with the supplier's eligibility and selection. */
export const BidLotOption = LotRef.extend({
  description: z.string().nullable(),
  stage: LotsStage,
  /** The authoritative deadline of the lot (DD-15). */
  deadline: OfficialDeadline,
  selected: z.boolean(),
  eligible: z.boolean(),
  /** Why the lot cannot be selected (a participation or qualification gate), null when eligible. */
  ineligibleReason: z.string().nullable(),
});
export type BidLotOption = z.infer<typeof BidLotOption>;

/** One response section with its progress (SUP-12). */
export const BidSection = z.object({
  section: z.string().min(1),
  envelope: BidAnswersEnvelope,
  progress: ProgressCounts,
  mandatoryOpen: z.number().int().min(0),
});
export type BidSection = z.infer<typeof BidSection>;

/** A member of the supplier's response team (`pursuit_team_members`). */
export const BidTeamMember = PersonRef.extend({
  capacity: z.string().nullable(),
  responsibility: PursuitTeamMembersResponsibility,
  canViewPricing: z.boolean(),
  canApprove: z.boolean(),
  canSubmit: z.boolean(),
});
export type BidTeamMember = z.infer<typeof BidTeamMember>;

/** An issued addendum and the supplier's acknowledgment (DD-42: `participant_acknowledgments` is authoritative). */
export const BidAddendum = z.object({
  addendumId: Id,
  number: z.number().int().min(1),
  title: z.string().min(1),
  issuedAt: Instant,
  material: z.boolean(),
  existingSubmissionAction: AddendaExistingSubmissionAction,
  resultingVersionNo: z.number().int().min(1),
  acknowledged: z.boolean(),
  acknowledgedAt: Instant.nullable(),
  acknowledgedBy: PersonRef.nullable(),
  /** Where the acknowledgment is recorded (the opportunity workspace, SUP-08). */
  link: LinkPath,
});
export type BidAddendum = z.infer<typeof BidAddendum>;

/** What the caller may do on this response (their permissions in the supplier tenant, AC-03). */
export const BidViewer = z.object({
  canEditResponse: z.boolean(),
  canViewPricing: z.boolean(),
  canEditPricing: z.boolean(),
  canAssign: z.boolean(),
  canComment: z.boolean(),
  canApprove: z.boolean(),
  canSubmit: z.boolean(),
});
export type BidViewer = z.infer<typeof BidViewer>;

/** The response workspace (SUP-12..SUP-17 header and navigation). */
export const BidDetail = BidSummary.extend({
  legalParty: LegalParty,
  officialTimeZone: z.string().min(1),
  currency: CurrencyCode,
  acceptedCurrencies: z.array(CurrencyCode).min(1),
  participation: TendersParticipation,
  bidValidityDays: z.number().int().min(1),
  partialBidsAllowed: z.boolean(),
  alternativesAllowed: z.boolean(),
  maxLotsPerSupplier: z.number().int().min(1).nullable(),
  currentTenderVersionNo: z.number().int().min(0),
  /** True while the official deadline has not passed and the tender accepts submissions. */
  submissionWindowOpen: z.boolean(),
  /** A replacement may be prepared (window open and an effective receipt exists). */
  replacementPermitted: z.boolean(),
  leadMemberName: z.string().nullable(),
  lotOptions: z.array(BidLotOption),
  sections: z.array(BidSection),
  team: z.array(BidTeamMember),
  addenda: z.array(BidAddendum),
  effectiveOffer: EffectiveOffer,
  viewer: BidViewer,
});
export type BidDetail = z.infer<typeof BidDetail>;

export const StartBidBody = z.object({
  tenderId: Id,
  roundType: BidsRoundType.default('initial'),
  isAlternative: z.boolean().default(false),
  alternativeOfBidId: Id.optional(),
});
export type StartBidBody = z.input<typeof StartBidBody>;

export const UpdateBidLotsBody = z.object({
  revisionId: Id,
  lotIds: z.array(Id).min(1, issue('NO_LOTS_SELECTED', 'Select at least one lot.')).max(50),
});
export type UpdateBidLotsBody = z.infer<typeof UpdateBidLotsBody>;

// ---------------------------------------------------------------------------------------------------------
// Answers (SUP-12)
// ---------------------------------------------------------------------------------------------------------

/** Where reused content came from; reuse is not a fresh certification and must be reviewed (FR-11). */
export const ReuseSource = z.object({
  sourceAnswerId: Id,
  tenderReference: Reference,
  tenderTitle: z.string().min(1),
  revisionNo: z.number().int().min(1),
  submittedAt: Instant.nullable(),
  reusedAt: Instant,
  reusedBy: PersonRef,
  /** Null until a team member confirms the content is relevant and current. */
  reviewedAt: Instant.nullable(),
  reviewedBy: PersonRef.nullable(),
});
export type ReuseSource = z.infer<typeof ReuseSource>;

/** A requirement with the revision's answer (`requirements` × `bid_answers`). */
export const BidAnswerRow = z.object({
  requirementId: Id,
  refCode: z.string().min(1),
  section: z.string().min(1),
  lot: LotRef.nullable(),
  text: z.string().min(1),
  responseType: RequirementsResponseType,
  choices: z.array(z.string()),
  responseInstructions: z.string().nullable(),
  evidenceRequired: z.string().nullable(),
  treatment: RequirementsTreatment,
  envelope: BidAnswersEnvelope,
  missingConsequence: RequirementsMissingConsequence,
  /** The addendum that added or changed this requirement, if any. */
  addendumNumber: z.number().int().min(1).nullable(),
  answerText: z.string().nullable(),
  answerNumber: DecimalString.nullable(),
  answerChoice: z.string().nullable(),
  answerBool: z.boolean().nullable(),
  isDeviation: z.boolean(),
  deviationNote: z.string().nullable(),
  assignedUser: PersonRef.nullable(),
  dueAt: Instant.nullable(),
  progress: BidAnswersProgress,
  reuse: ReuseSource.nullable(),
  documentCount: z.number().int().min(0),
  commentCount: z.number().int().min(0),
  updatedBy: PersonRef.nullable(),
  updatedAt: Instant.nullable(),
});
export type BidAnswerRow = z.infer<typeof BidAnswerRow>;

export const ANSWER_LIST_SORTS = ['refCode', 'section', 'progress', 'dueAt', 'updatedAt'] as const;

export const AnswerListQuery = listQueryWithSort(ANSWER_LIST_SORTS).extend({
  /** The revision to read; the working (or else effective) revision by default. */
  revisionId: IdParam.optional(),
  section: z.string().trim().min(1).max(200).optional(),
  lotId: IdParam.optional(),
  envelope: queryList(BidAnswersEnvelope).optional(),
  progress: queryList(BidAnswersProgress).optional(),
  treatment: queryList(RequirementsTreatment).optional(),
  assignedUserId: IdParam.optional(),
  assignedToMe: QueryBoolean.optional(),
  deviationsOnly: QueryBoolean.optional(),
  reuseToReview: QueryBoolean.optional(),
  dueFrom: Instant.optional(),
  dueTo: Instant.optional(),
});
export type AnswerListQuery = z.output<typeof AnswerListQuery>;
export type AnswerListQueryInput = z.input<typeof AnswerListQuery>;

export const AnswerPage = pageOf(BidAnswerRow).extend({
  revisionId: Id,
  revisionNo: z.number().int().min(1),
  revisionStatus: BidRevisionsStatus,
  editable: z.boolean(),
  sections: z.array(BidSection),
});
export type AnswerPage = z.infer<typeof AnswerPage>;

/** A file attached to an answer (`bid_answer_documents`), a snapshot of an uploaded version or evidence edition. */
export const AnswerAttachment = z.object({
  id: Id,
  documentId: Id,
  documentVersionId: Id,
  fileName: z.string().min(1),
  sizeBytes: z.number().int().min(0),
  sha256: ContentHash,
  envelope: BidAnswersEnvelope,
  evidenceSubmissionId: Id.nullable(),
  evidenceTitle: z.string().nullable(),
  attachedAt: Instant,
  attachedBy: PersonRef,
});
export type AnswerAttachment = z.infer<typeof AnswerAttachment>;

/** A private review comment (`bid_internal_comments`); never visible to the buyer. */
export const BidComment = z.object({
  id: Id,
  requirementId: Id.nullable(),
  revisionId: Id,
  author: PersonRef,
  body: z.string().min(1),
  createdAt: Instant,
});
export type BidComment = z.infer<typeof BidComment>;

export const BidAnswerDetail = BidAnswerRow.extend({
  revisionId: Id,
  revisionNo: z.number().int().min(1),
  editable: z.boolean(),
  attachments: z.array(AnswerAttachment),
  comments: z.array(BidComment),
});
export type BidAnswerDetail = z.infer<typeof BidAnswerDetail>;

export const AnswerParams = z.object({ bidId: IdParam, requirementId: IdParam });
export const AnswerQuery = z.object({ revisionId: IdParam.optional() });

export const SaveAnswerBody = z
  .object({
    revisionId: Id,
    answerText: LongText.nullable().optional(),
    answerNumber: DecimalString.nullable().optional(),
    answerChoice: z.string().max(200).nullable().optional(),
    answerBool: z.boolean().nullable().optional(),
    isDeviation: z.boolean(),
    deviationNote: NoteText.nullable().optional(),
    progress: BidAnswersProgress,
    /** Confirms that reused content was reviewed for relevance and currency. */
    reuseReviewed: z.boolean().optional(),
  })
  .superRefine((body, context) => {
    if (body.isDeviation && (body.deviationNote === undefined || body.deviationNote === null || body.deviationNote === '')) {
      context.addIssue({
        code: 'custom',
        path: ['deviationNote'],
        message: issue('DEVIATION_NOTE_REQUIRED', 'Explain the deviation.'),
      });
    }
  });
export type SaveAnswerBody = z.input<typeof SaveAnswerBody>;

/** The result of an edit: the answer, and the internal approvals the edit invalidated (BR-10). */
export const SaveAnswerResult = z.object({
  answer: BidAnswerDetail,
  contentHash: ContentHash,
  invalidatedApprovalIds: z.array(Id),
});
export type SaveAnswerResult = z.infer<typeof SaveAnswerResult>;

export const AssignAnswerBody = z.object({
  revisionId: Id,
  assigneeUserId: Id.nullable(),
  dueAt: Instant.nullable().optional(),
});
export type AssignAnswerBody = z.input<typeof AssignAnswerBody>;

export const AddCommentBody = z.object({
  revisionId: Id,
  body: z
    .string()
    .trim()
    .min(1, issue('COMMENT_REQUIRED', 'Write a comment.'))
    .max(4000, issue('TEXT_TOO_LONG', 'At most 4000 characters.')),
});
export type AddCommentBody = z.infer<typeof AddCommentBody>;

/** Earlier content of the same supplier that may be reused (it is flagged for review once reused). */
export const ReuseCandidate = z.object({
  sourceAnswerId: Id,
  tenderReference: Reference,
  tenderTitle: z.string().min(1),
  revisionNo: z.number().int().min(1),
  submittedAt: Instant.nullable(),
  refCode: z.string().min(1),
  requirementText: z.string().min(1),
  answerText: z.string().min(1),
});
export type ReuseCandidate = z.infer<typeof ReuseCandidate>;

export const ReuseCandidateQuery = listQueryWithSort(['submittedAt', 'tenderReference'] as const);
export const ReuseCandidatePage = pageOf(ReuseCandidate);
export type ReuseCandidatePage = z.infer<typeof ReuseCandidatePage>;

export const ReuseAnswerBody = z.object({ revisionId: Id, sourceAnswerId: Id });
export type ReuseAnswerBody = z.infer<typeof ReuseAnswerBody>;

export const AttachAnswerDocumentBody = z
  .object({
    revisionId: Id,
    /** An uploaded version (shared document widget, related type `bid_answer`). */
    documentVersionId: Id.optional(),
    /** An evidence library item; its current edition is snapshotted (`evidence_submissions`). */
    evidenceItemId: Id.optional(),
  })
  .superRefine((body, context) => {
    if ((body.documentVersionId === undefined) === (body.evidenceItemId === undefined)) {
      context.addIssue({
        code: 'custom',
        path: ['documentVersionId'],
        message: issue('ONE_SOURCE_REQUIRED', 'Attach either an uploaded file or an evidence item.'),
      });
    }
  });
export type AttachAnswerDocumentBody = z.input<typeof AttachAnswerDocumentBody>;

export const AttachmentParams = z.object({ bidId: IdParam, requirementId: IdParam, attachmentId: IdParam });
export const RevisionQuery = z.object({ revisionId: IdParam });

// ---------------------------------------------------------------------------------------------------------
// Pricing and commercial offer (SUP-13)
// ---------------------------------------------------------------------------------------------------------

/** A buyer pricing item with the supplier's price line (`pricing_items` × `bid_prices`). */
export const PriceLine = z.object({
  pricingItemId: Id,
  itemCode: z.string().min(1),
  description: z.string().min(1),
  unit: z.string().min(1),
  /** The buyer's quantity. */
  requestedQuantity: NonNegativeDecimalString,
  chargeType: PricingItemsChargeType,
  recurrence: PricingItemsRecurrence.nullable(),
  isOptional: z.boolean(),
  isProvisional: z.boolean(),
  includeInEvaluation: z.boolean(),
  /** Null until the supplier states how the item is offered. */
  priceStatus: BidPricesPriceStatus.nullable(),
  unitPrice: NonNegativeDecimalString.nullable(),
  /** The offered quantity. */
  quantity: NonNegativeDecimalString.nullable(),
  currency: CurrencyCode.nullable(),
  taxRate: NonNegativeDecimalString.nullable(),
  discountAmount: NonNegativeDecimalString.nullable(),
  /** quantity × unitPrice − discount, rounded to 2 places (tax excluded). Null unless priced. */
  lineTotal: Money.nullable(),
  notes: z.string().nullable(),
});
export type PriceLine = z.infer<typeof PriceLine>;

export const PriceSchedule = z.object({
  scheduleId: Id,
  title: z.string().min(1),
  lot: LotRef.nullable(),
  lines: z.array(PriceLine),
});
export type PriceSchedule = z.infer<typeof PriceSchedule>;

/** `bid_commercial_terms`. */
export const CommercialTerms = z.object({
  validityDays: z.number().int().min(1).nullable(),
  paymentTerms: z.string().nullable(),
  conditionalDiscounts: z.string().nullable(),
  assumptions: z.string().nullable(),
  totalOneTime: Money.nullable(),
  totalRecurringPerPeriod: Money.nullable(),
  currency: CurrencyCode,
});
export type CommercialTerms = z.infer<typeof CommercialTerms>;

/** Net, tax and gross of a group of lines, from decimal strings. */
export const PriceTotal = z.object({
  net: Money,
  tax: Money,
  gross: Money,
});
export type PriceTotal = z.infer<typeof PriceTotal>;

export const PricingTotals = z.object({
  oneTime: PriceTotal,
  recurring: z.array(PriceTotal.extend({ recurrence: PricingItemsRecurrence })),
  /** Optional items are shown separately and never added to the offer total. */
  optionalOneTime: PriceTotal,
  byLot: z.array(z.object({ lot: LotRef, oneTime: PriceTotal })),
  pricedCount: z.number().int().min(0),
  includedCount: z.number().int().min(0),
  notOfferedCount: z.number().int().min(0),
  missingCount: z.number().int().min(0),
});
export type PricingTotals = z.infer<typeof PricingTotals>;

/** A pricing consistency finding. */
export const PRICING_ISSUE_CODES = [
  'PRICE_MISSING',
  'MANDATORY_ITEM_NOT_OFFERED',
  'QUANTITY_DIFFERS',
  'CURRENCY_NOT_ACCEPTED',
  'DISCOUNT_EXCEEDS_LINE',
  'TERMS_TOTAL_MISMATCH',
  'VALIDITY_TOO_SHORT',
] as const;
export const PricingIssueCode = z.enum(PRICING_ISSUE_CODES);
export type PricingIssueCode = z.infer<typeof PricingIssueCode>;

export const PricingIssue = z.object({
  code: PricingIssueCode,
  severity: z.enum(['blocking', 'warning']),
  pricingItemId: Id.nullable(),
  itemCode: z.string().nullable(),
});
export type PricingIssue = z.infer<typeof PricingIssue>;

export const BidPricing = z.object({
  bidId: Id,
  revisionId: Id,
  revisionNo: z.number().int().min(1),
  revisionStatus: BidRevisionsStatus,
  editable: z.boolean(),
  currency: CurrencyCode,
  acceptedCurrencies: z.array(CurrencyCode).min(1),
  bidValidityDays: z.number().int().min(1),
  schedules: z.array(PriceSchedule),
  commercialTerms: CommercialTerms,
  totals: PricingTotals,
  issues: z.array(PricingIssue),
});
export type BidPricing = z.infer<typeof BidPricing>;

export const PriceLineInput = z
  .object({
    pricingItemId: Id,
    priceStatus: BidPricesPriceStatus,
    unitPrice: NonNegativeDecimalString.nullable().optional(),
    quantity: NonNegativeDecimalString.nullable().optional(),
    currency: CurrencyCode.nullable().optional(),
    taxRate: NonNegativeDecimalString.nullable().optional(),
    discountAmount: NonNegativeDecimalString.nullable().optional(),
    notes: NoteText.nullable().optional(),
  })
  .superRefine((line, context) => {
    const priced = line.priceStatus === 'priced';
    const has = (value: string | null | undefined): boolean => value !== undefined && value !== null && value !== '';
    if (priced && !has(line.unitPrice)) {
      context.addIssue({ code: 'custom', path: ['unitPrice'], message: issue('PRICE_REQUIRED', 'Enter a unit price.') });
    }
    if (priced && !has(line.quantity)) {
      context.addIssue({ code: 'custom', path: ['quantity'], message: issue('QUANTITY_REQUIRED', 'Enter the offered quantity.') });
    }
    if (priced && !has(line.currency)) {
      context.addIssue({ code: 'custom', path: ['currency'], message: issue('CURRENCY_REQUIRED', 'Choose the currency.') });
    }
    if (!priced && (has(line.unitPrice) || has(line.discountAmount))) {
      context.addIssue({
        code: 'custom',
        path: ['unitPrice'],
        message: issue('PRICE_NOT_ALLOWED', 'Included and not-offered items carry no price (they are not a zero price).'),
      });
    }
  });
export type PriceLineInput = z.input<typeof PriceLineInput>;

export const SavePricingBody = z.object({
  revisionId: Id,
  lines: z.array(PriceLineInput).max(500),
  commercialTerms: z.object({
    validityDays: z.number().int().min(1, issue('VALIDITY_REQUIRED', 'State the bid validity.')).max(730).nullable(),
    paymentTerms: NoteText.nullable(),
    conditionalDiscounts: NoteText.nullable(),
    assumptions: NoteText.nullable(),
  }),
});
export type SavePricingBody = z.input<typeof SavePricingBody>;

export const SavePricingResult = z.object({
  pricing: BidPricing,
  contentHash: ContentHash,
  invalidatedApprovalIds: z.array(Id),
});
export type SavePricingResult = z.infer<typeof SavePricingResult>;

// ---------------------------------------------------------------------------------------------------------
// Declarations, parties, exceptions and evidence (SUP-14)
// ---------------------------------------------------------------------------------------------------------

/** `bid_declarations`: a supplier statement, never a buyer verification. */
export const BidDeclaration = z.object({
  declarationType: BidDeclarationsDeclarationType,
  required: z.boolean(),
  accepted: z.boolean().nullable(),
  explanation: z.string().nullable(),
  declaredBy: PersonRef.nullable(),
  declaredAt: Instant.nullable(),
});
export type BidDeclaration = z.infer<typeof BidDeclaration>;

/** `bid_subcontractors`. */
export const BidSubcontractor = z.object({
  id: Id,
  name: z.string().min(1),
  scope: z.string().min(1),
  sharePercent: NonNegativeDecimalString,
  qualificationEvidenceDocumentId: Id.nullable(),
  qualificationEvidenceFileName: z.string().nullable(),
});
export type BidSubcontractor = z.infer<typeof BidSubcontractor>;

/** `bid_key_personnel`. */
export const BidKeyPerson = z.object({
  id: Id,
  name: z.string().min(1),
  role: z.string().min(1),
  qualifications: z.string().nullable(),
  cvDocumentId: Id.nullable(),
  cvFileName: z.string().nullable(),
});
export type BidKeyPerson = z.infer<typeof BidKeyPerson>;

/** `consortium_members`. */
export const ConsortiumMember = z.object({
  id: Id,
  memberTenantId: Id.nullable(),
  memberName: z.string().min(1),
  isLead: z.boolean(),
  responsibilities: z.string().nullable(),
  authorityEvidenceDocumentId: Id.nullable(),
});
export type ConsortiumMember = z.infer<typeof ConsortiumMember>;

/** `bid_exceptions`: proposed contract exceptions (commercial envelope). */
export const BidException = z.object({
  id: Id,
  clauseRef: z.string().min(1),
  proposedChange: z.string().min(1),
  rationale: z.string().nullable(),
});
export type BidException = z.infer<typeof BidException>;

/** Evidence attached to the revision as an immutable snapshot of one edition (`evidence_submissions`). */
export const BidEvidence = z.object({
  evidenceItemId: Id,
  evidenceSubmissionId: Id.nullable(),
  documentVersionId: Id,
  title: z.string().min(1),
  evidenceType: EvidenceItemsEvidenceType,
  issuer: z.string().nullable(),
  fileName: z.string().min(1),
  versionNo: z.number().int().min(1),
  validFrom: Instant.nullable(),
  expiresAt: Instant.nullable(),
  status: EvidenceItemsStatus,
  /** The supplier's own statement vs the buyer's check (SUP-14 must distinguish them). */
  verificationStatus: EvidenceItemsVerificationStatus,
  attachedAt: Instant,
  attachedBy: PersonRef,
  /** True when the edition expires before the end of the bid validity period. */
  expiresDuringValidity: z.boolean(),
});
export type BidEvidence = z.infer<typeof BidEvidence>;

/** An evidence library item that may be attached. */
export const EvidenceOption = z.object({
  evidenceItemId: Id,
  title: z.string().min(1),
  evidenceType: EvidenceItemsEvidenceType,
  expiresAt: Instant.nullable(),
  status: EvidenceItemsStatus,
  attached: z.boolean(),
});
export type EvidenceOption = z.infer<typeof EvidenceOption>;

export const BidDeclarations = z.object({
  bidId: Id,
  revisionId: Id,
  revisionNo: z.number().int().min(1),
  revisionStatus: BidRevisionsStatus,
  editable: z.boolean(),
  legalParty: LegalParty,
  bidValidityDays: z.number().int().min(1),
  declarations: z.array(BidDeclaration),
  subcontractors: z.array(BidSubcontractor),
  keyPersonnel: z.array(BidKeyPerson),
  isConsortium: z.boolean(),
  leadMemberName: z.string().nullable(),
  consortiumMembers: z.array(ConsortiumMember),
  exceptions: z.array(BidException),
  evidence: z.array(BidEvidence),
  evidenceOptions: z.array(EvidenceOption),
  addenda: z.array(BidAddendum),
});
export type BidDeclarations = z.infer<typeof BidDeclarations>;

export const SaveDeclarationsBody = z.object({
  revisionId: Id,
  declarations: z
    .array(
      z
        .object({
          declarationType: BidDeclarationsDeclarationType,
          accepted: z.boolean(),
          explanation: NoteText.nullable().optional(),
        })
        .superRefine((value, context) => {
          if (!value.accepted && (value.explanation === undefined || value.explanation === null || value.explanation === '')) {
            context.addIssue({
              code: 'custom',
              path: ['explanation'],
              message: issue('EXPLANATION_REQUIRED', 'Explain why the declaration cannot be confirmed.'),
            });
          }
        }),
    )
    .min(1)
    .max(20),
});
export type SaveDeclarationsBody = z.input<typeof SaveDeclarationsBody>;

export const SaveSubcontractorsBody = z
  .object({
    revisionId: Id,
    subcontractors: z
      .array(
        z.object({
          name: ShortText.min(1, issue('NAME_REQUIRED', 'Name the subcontractor.')),
          scope: NoteText.min(1, issue('SCOPE_REQUIRED', 'Describe the scope.')),
          sharePercent: NonNegativeDecimalString,
          qualificationEvidenceDocumentId: Id.nullable().optional(),
        }),
      )
      .max(30),
  })
  .superRefine((body, context) => {
    let totalHundredths = 0;
    body.subcontractors.forEach((row, index) => {
      const [whole = '0', fraction = ''] = row.sharePercent.split('.');
      const hundredths = Number(whole) * 100 + Number((fraction + '00').slice(0, 2));
      if (hundredths > 10_000) {
        context.addIssue({
          code: 'custom',
          path: ['subcontractors', index, 'sharePercent'],
          message: issue('SHARE_OUT_OF_RANGE', 'A share is between 0 and 100 percent.'),
        });
      }
      totalHundredths += hundredths;
    });
    if (totalHundredths > 10_000) {
      context.addIssue({
        code: 'custom',
        path: ['subcontractors'],
        message: issue('SHARE_EXCEEDS_100', 'Subcontracted shares cannot exceed 100 percent in total.'),
      });
    }
  });
export type SaveSubcontractorsBody = z.input<typeof SaveSubcontractorsBody>;

export const SaveKeyPersonnelBody = z.object({
  revisionId: Id,
  keyPersonnel: z
    .array(
      z.object({
        name: ShortText.min(1, issue('NAME_REQUIRED', 'Name the person.')),
        role: ShortText.min(1, issue('ROLE_REQUIRED', 'State the role.')),
        qualifications: NoteText.nullable().optional(),
        cvDocumentId: Id.nullable().optional(),
      }),
    )
    .max(50),
});
export type SaveKeyPersonnelBody = z.input<typeof SaveKeyPersonnelBody>;

export const SaveConsortiumBody = z
  .object({
    revisionId: Id,
    isConsortium: z.boolean(),
    members: z
      .array(
        z.object({
          memberTenantId: Id.nullable().optional(),
          memberName: ShortText.min(1, issue('NAME_REQUIRED', 'Name the member.')),
          isLead: z.boolean(),
          responsibilities: NoteText.nullable().optional(),
          authorityEvidenceDocumentId: Id.nullable().optional(),
        }),
      )
      .max(20),
  })
  .superRefine((body, context) => {
    if (!body.isConsortium) {
      if (body.members.length > 0) {
        context.addIssue({
          code: 'custom',
          path: ['members'],
          message: issue('MEMBERS_WITHOUT_CONSORTIUM', 'Members are only listed for a consortium bid.'),
        });
      }
      return;
    }
    if (body.members.length < 2) {
      context.addIssue({
        code: 'custom',
        path: ['members'],
        message: issue('CONSORTIUM_MEMBERS_REQUIRED', 'A consortium lists at least two members.'),
      });
    }
    if (body.members.filter((member) => member.isLead).length !== 1) {
      context.addIssue({
        code: 'custom',
        path: ['members'],
        message: issue('ONE_LEAD_REQUIRED', 'Mark exactly one lead member.'),
      });
    }
  });
export type SaveConsortiumBody = z.input<typeof SaveConsortiumBody>;

export const SaveExceptionsBody = z.object({
  revisionId: Id,
  exceptions: z
    .array(
      z.object({
        clauseRef: ShortText.min(1, issue('CLAUSE_REQUIRED', 'Name the clause.')),
        proposedChange: NoteText.min(1, issue('CHANGE_REQUIRED', 'Describe the proposed change.')),
        rationale: NoteText.nullable().optional(),
      }),
    )
    .max(50),
});
export type SaveExceptionsBody = z.input<typeof SaveExceptionsBody>;

export const AttachEvidenceBody = z.object({ revisionId: Id, evidenceItemId: Id });
export type AttachEvidenceBody = z.infer<typeof AttachEvidenceBody>;

export const EvidenceParams = z.object({ bidId: IdParam, evidenceItemId: IdParam });

/** Every SUP-14 command returns the refreshed pack, the new content hash and the approvals it invalidated. */
export const SaveDeclarationsResult = z.object({
  declarations: BidDeclarations,
  contentHash: ContentHash,
  invalidatedApprovalIds: z.array(Id),
});
export type SaveDeclarationsResult = z.infer<typeof SaveDeclarationsResult>;

// ---------------------------------------------------------------------------------------------------------
// Readiness (SUP-12, SUP-16)
// ---------------------------------------------------------------------------------------------------------

export const READINESS_CATEGORIES = [
  'lots',
  'answers',
  'pricing',
  'declarations',
  'evidence',
  'addenda',
  'participation',
  'approval',
  'authority',
  'deadline',
] as const;
export const ReadinessCategory = z.enum(READINESS_CATEGORIES);
export type ReadinessCategory = z.infer<typeof ReadinessCategory>;

/** Stable readiness codes (Stage B computes the same checks). */
export const READINESS_CODES = [
  'CHECK_PASSED',
  'NO_LOTS_SELECTED',
  'REQUIRED_ANSWER_MISSING',
  'ANSWER_NOT_COMPLETE',
  'REUSED_CONTENT_NOT_REVIEWED',
  'DEVIATION_DECLARED',
  'PRICING_INCOMPLETE',
  'PRICING_INCONSISTENT',
  'DECLARATION_NOT_CONFIRMED',
  'DECLARATION_EXPLAINED',
  'EVIDENCE_EXPIRED',
  'EVIDENCE_EXPIRES_DURING_VALIDITY',
  'CONTRACT_EXCEPTIONS_DECLARED',
  'ADDENDUM_NOT_ACKNOWLEDGED',
  'ADDENDUM_SUPPLEMENT_REQUIRED',
  'PARTICIPATION_CONDITION_UNMET',
  'INTERNAL_APPROVAL_MISSING',
  'INTERNAL_APPROVAL_PENDING',
  'INTERNAL_APPROVAL_INVALIDATED',
  'SUBMIT_AUTHORITY_MISSING',
  'SUBMISSION_WINDOW_CLOSED',
] as const;
export const ReadinessCode = z.enum(READINESS_CODES);
export type ReadinessCode = z.infer<typeof ReadinessCode>;

export const READINESS_SEVERITIES = ['blocking', 'warning', 'passed'] as const;
export const ReadinessSeverity = z.enum(READINESS_SEVERITIES);
export type ReadinessSeverity = z.infer<typeof ReadinessSeverity>;

export const ReadinessItem = z.object({
  id: z.string().min(1),
  category: ReadinessCategory,
  severity: ReadinessSeverity,
  code: ReadinessCode,
  /** How many records the finding concerns (answers, lines, declarations…), when countable. */
  count: z.number().int().min(0).nullable(),
  /** The subject named in the message: an addendum title, an evidence title, a lot list. */
  subject: z.string().nullable(),
  requirementIds: z.array(Id),
  /** Where the finding is fixed. */
  link: LinkPath.nullable(),
});
export type ReadinessItem = z.infer<typeof ReadinessItem>;

export const BidReadiness = z.object({
  bidId: Id,
  revisionId: Id,
  revisionNo: z.number().int().min(1),
  revisionStatus: BidRevisionsStatus,
  checkedAt: Instant,
  /** No blocking finding. Readiness is never a submission (AC-11). */
  ready: z.boolean(),
  blockingCount: z.number().int().min(0),
  warningCount: z.number().int().min(0),
  items: z.array(ReadinessItem),
});
export type BidReadiness = z.infer<typeof BidReadiness>;

// ---------------------------------------------------------------------------------------------------------
// Revisions and internal approval (SUP-15)
// ---------------------------------------------------------------------------------------------------------

export const RevisionListQuery = listQueryWithSort(['revisionNo', 'createdAt'] as const).extend({
  status: queryList(BidRevisionsStatus).optional(),
});
export type RevisionListQueryInput = z.input<typeof RevisionListQuery>;
export const RevisionPage = pageOf(BidRevision);
export type RevisionPage = z.infer<typeof RevisionPage>;

export const CreateRevisionBody = z.object({
  /** The revision the replacement starts from (normally the effective one). */
  basedOnRevisionId: Id,
  reason: NoteText.optional(),
});
export type CreateRevisionBody = z.infer<typeof CreateRevisionBody>;

/** `bid_internal_approvals`. */
export const InternalApproval = z.object({
  id: Id,
  bidId: Id,
  revisionId: Id,
  revisionNo: z.number().int().min(1),
  approvalType: BidInternalApprovalsApprovalType,
  approver: PersonRef,
  status: BidInternalApprovalsStatus,
  requestedBy: PersonRef,
  requestedAt: Instant,
  contentHashAtDecision: ContentHash.nullable(),
  decidedAt: Instant.nullable(),
  note: z.string().nullable(),
  /** Set when a later material change invalidated the approval (BR-10). */
  invalidatedAt: Instant.nullable(),
});
export type InternalApproval = z.infer<typeof InternalApproval>;

export const RequiredApproval = z.object({
  approvalType: BidInternalApprovalsApprovalType,
  /** approved (current content) | pending | invalidated | missing. */
  state: z.enum(['approved', 'pending', 'invalidated', 'missing', 'rejected', 'returned']),
  approvalId: Id.nullable(),
});
export type RequiredApproval = z.infer<typeof RequiredApproval>;

/** What an approver weighs (SUP-15). Prices are summarized only for callers who may see pricing. */
export const CommercialExposure = z.object({
  visible: z.boolean(),
  totalOneTime: Money.nullable(),
  recurring: z.array(z.object({ recurrence: PricingItemsRecurrence, gross: Money })),
  validityDays: z.number().int().min(1).nullable(),
  exceptionCount: z.number().int().min(0),
  deviationCount: z.number().int().min(0),
  subcontractedSharePercent: NonNegativeDecimalString,
});
export type CommercialExposure = z.infer<typeof CommercialExposure>;

export const InternalReview = z.object({
  bidId: Id,
  revision: BidRevision,
  readiness: BidReadiness,
  commercialExposure: CommercialExposure,
  requiredApprovals: z.array(RequiredApproval),
  /** Approvals of the reviewed revision, newest first. */
  approvals: z.array(InternalApproval),
  /** Every approval of the response, including earlier revisions and invalidated ones. */
  history: z.array(InternalApproval),
  /** True when the content changed after at least one approval was given. */
  materialChangeSinceApproval: z.boolean(),
  /** People in the supplier who hold `supplier.response.approve`. */
  eligibleApprovers: z.array(PersonRef),
  viewer: BidViewer,
});
export type InternalReview = z.infer<typeof InternalReview>;

export const RequestInternalApprovalBody = z.object({
  revisionId: Id,
  contentHash: ContentHash,
  approvers: z
    .array(z.object({ approvalType: BidInternalApprovalsApprovalType, approverUserId: Id }))
    .min(1, issue('APPROVER_REQUIRED', 'Choose at least one approver.'))
    .max(8),
  note: NoteText.optional(),
});
export type RequestInternalApprovalBody = z.infer<typeof RequestInternalApprovalBody>;

export const INTERNAL_APPROVAL_DECISIONS = ['approve', 'reject', 'return', 'delegate'] as const;
export const InternalApprovalDecision = z.enum(INTERNAL_APPROVAL_DECISIONS);
export type InternalApprovalDecision = z.infer<typeof InternalApprovalDecision>;

export const DecideInternalApprovalBody = z
  .object({
    decision: InternalApprovalDecision,
    /** The content the approver reviewed; a mismatch means a material change (BR-10). */
    contentHash: ContentHash,
    note: NoteText.optional(),
    delegateToUserId: Id.optional(),
  })
  .superRefine((body, context) => {
    if ((body.decision === 'reject' || body.decision === 'return') && (body.note === undefined || body.note === '')) {
      context.addIssue({ code: 'custom', path: ['note'], message: issue('REASON_REQUIRED', 'Give the reason.') });
    }
    if (body.decision === 'delegate' && body.delegateToUserId === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['delegateToUserId'],
        message: issue('DELEGATE_REQUIRED', 'Choose who takes over the approval.'),
      });
    }
  });
export type DecideInternalApprovalBody = z.infer<typeof DecideInternalApprovalBody>;

export const InternalApprovalParams = z.object({ bidId: IdParam, approvalId: IdParam });

// ---------------------------------------------------------------------------------------------------------
// Final review and submission (SUP-16)
// ---------------------------------------------------------------------------------------------------------

export const SUBMIT_BLOCK_REASONS = [
  'SUBMIT_PERMISSION_MISSING',
  'READINESS_BLOCKING',
  'SUBMISSION_WINDOW_CLOSED',
  'NO_WORKING_REVISION',
] as const;
export const SubmitBlockReason = z.enum(SUBMIT_BLOCK_REASONS);
export type SubmitBlockReason = z.infer<typeof SubmitBlockReason>;

export const SubmissionPreview = z.object({
  bidId: Id,
  tender: BidTenderRef,
  /** The exact revision that would be submitted (null when there is nothing to submit). */
  revision: BidRevision.nullable(),
  legalParty: LegalParty,
  /**
   * The caller, as the authorized representative who would submit, when they hold `supplier.response.submit`.
   * Null when they do not (AC-03): the final declaration then names `authority.authorizedSubmitters` instead, so an
   * unauthorized person is never presented as the representative (FR-11).
   */
  representative: ActorRef.nullable(),
  lots: z.array(LotRef),
  deadline: OfficialDeadline,
  submissionWindowOpen: z.boolean(),
  isReplacement: z.boolean(),
  effectiveOffer: EffectiveOffer,
  readiness: BidReadiness.nullable(),
  finalDeclaration: z.object({
    bidValidityDays: z.number().int().min(1),
    tenderVersionNo: z.number().int().min(0),
    termsReference: z.string().min(1),
    outstandingExceptionCount: z.number().int().min(0),
    deviationCount: z.number().int().min(0),
  }),
  authority: z.object({
    canSubmit: z.boolean(),
    blockReasons: z.array(SubmitBlockReason),
    /** Who in the organization holds `supplier.response.submit` (AC-03: a contributor sees who can). */
    authorizedSubmitters: z.array(PersonRef),
  }),
});
export type SubmissionPreview = z.infer<typeof SubmissionPreview>;

export const SubmitBody = z.object({
  revisionId: Id,
  contentHash: ContentHash,
  confirmation: ContextConfirmation,
  finalDeclarationAccepted: z.literal(true, {
    error: issue('FINAL_DECLARATION_REQUIRED', 'Accept the final declaration.'),
  }),
  /** Must be true when an effective receipt exists: the replacement supersedes it only on success. */
  replacementAcknowledged: z.boolean().optional(),
});
export type SubmitBody = z.infer<typeof SubmitBody>;

/** A successful submission: the attempt and the official receipt. Failures are problem+json errors. */
export const SubmissionResult = z.object({
  attempt: SubmissionAttempt,
  receipt: Receipt,
  supersededReceiptId: Id.nullable(),
});
export type SubmissionResult = z.infer<typeof SubmissionResult>;

// ---------------------------------------------------------------------------------------------------------
// Receipts, attempts and withdrawal (SUP-17)
// ---------------------------------------------------------------------------------------------------------

export const BidReceiptListQuery = listQueryWithSort(['receivedAt', 'receiptNo'] as const).extend({
  status: queryList(SubmissionReceiptsStatus).optional(),
});
export type BidReceiptListQueryInput = z.input<typeof BidReceiptListQuery>;

export const ReceiptPage = pageOf(ReceiptSummary);
export type ReceiptPage = z.infer<typeof ReceiptPage>;

/** A receipt across all responses of the supplier. */
export const SupplierReceiptRow = ReceiptSummary.extend({
  tender: BidTenderRef,
  roundType: BidsRoundType,
  lotsSummary: z.string().min(1),
});
export type SupplierReceiptRow = z.infer<typeof SupplierReceiptRow>;

export const SupplierReceiptListQuery = listQueryWithSort(['receivedAt', 'receiptNo', 'reference'] as const).extend({
  status: queryList(SubmissionReceiptsStatus).optional(),
  tenderId: IdParam.optional(),
  buyerTenantId: IdParam.optional(),
  receivedFrom: Instant.optional(),
  receivedTo: Instant.optional(),
  effectiveOnly: QueryBoolean.optional(),
});
export type SupplierReceiptListQueryInput = z.input<typeof SupplierReceiptListQuery>;
export const SupplierReceiptPage = pageOf(SupplierReceiptRow);
export type SupplierReceiptPage = z.infer<typeof SupplierReceiptPage>;

export const AttemptListQuery = listQueryWithSort(['startedAt'] as const).extend({
  outcome: queryList(SubmissionAttemptsOutcome).optional(),
});
export type AttemptListQueryInput = z.input<typeof AttemptListQuery>;
export const AttemptPage = pageOf(SubmissionAttempt);
export type AttemptPage = z.infer<typeof AttemptPage>;

export const WithdrawalListQuery = listQueryWithSort(['withdrawnAt'] as const);
export const WithdrawalPage = pageOf(Withdrawal);
export type WithdrawalPage = z.infer<typeof WithdrawalPage>;

export const WithdrawBody = z.object({
  receiptId: Id,
  reason: ReasonText,
  confirmation: ContextConfirmation,
  /** The supplier understands the response is removed from ordinary evaluation (BR-21). */
  effectUnderstood: z.literal(true, {
    error: issue('EFFECT_NOT_CONFIRMED', 'Confirm that you understand the effect of withdrawal.'),
  }),
});
export type WithdrawBody = z.infer<typeof WithdrawBody>;

export const WithdrawalResult = z.object({
  withdrawal: Withdrawal,
  receipt: ReceiptSummary,
  submissionState: BidsSubmissionState,
});
export type WithdrawalResult = z.infer<typeof WithdrawalResult>;

export const BidParams = z.object({ bidId: IdParam });
export const ReceiptParams = z.object({ receiptId: IdParam });

// ---------------------------------------------------------------------------------------------------------
// Buyer submission monitoring and closing (BUY-19): metadata only
// ---------------------------------------------------------------------------------------------------------

export const CLOSING_STATUSES = ['open', 'deadline_passed', 'closed'] as const;
export const ClosingStatus = z.enum(CLOSING_STATUSES);
export type ClosingStatus = z.infer<typeof ClosingStatus>;

/** A released tender in the monitoring list. Counts are unique suppliers, not revisions (AC-34). */
export const MonitoringRow = z.object({
  tenderId: Id,
  reference: Reference,
  title: z.string().min(1),
  eventType: TendersEventType,
  participation: TendersParticipation,
  status: TendersStatus,
  owner: PersonRef,
  deadline: OfficialDeadline,
  closingStatus: ClosingStatus,
  closedAt: Instant.nullable(),
  lotCount: z.number().int().min(0),
  effectiveSupplierCount: z.number().int().min(0),
  receiptCount: z.number().int().min(0),
  lastReceiptAt: Instant.nullable(),
  incidentCount: z.number().int().min(0),
});
export type MonitoringRow = z.infer<typeof MonitoringRow>;

export const MonitoringListQuery = listQueryWithSort([
  'deadline',
  'reference',
  'effectiveSupplierCount',
  'lastReceiptAt',
] as const).extend({
  status: queryList(TendersStatus).optional(),
  closingStatus: queryList(ClosingStatus).optional(),
  eventType: queryList(TendersEventType).optional(),
  ownerUserId: IdParam.optional(),
  deadlineFrom: Instant.optional(),
  deadlineTo: Instant.optional(),
});
export type MonitoringListQueryInput = z.input<typeof MonitoringListQuery>;
export const MonitoringPage = pageOf(MonitoringRow);
export type MonitoringPage = z.infer<typeof MonitoringPage>;

/** A service incident affecting the tender (`service_incidents` × `service_incident_impacts`). */
export const MonitoringIncident = z.object({
  incidentId: Id,
  title: z.string().min(1),
  /** `service_incidents.severity` (fixed by the operations contract; free text in the blueprint). */
  severity: ServiceIncidentSeverity,
  status: ServiceIncidentsStatus,
  startedAt: Instant,
  resolvedAt: Instant.nullable(),
  impactNote: z.string().nullable(),
  buyerDecisionNote: z.string().nullable(),
});
export type MonitoringIncident = z.infer<typeof MonitoringIncident>;

/** A late attempt as metadata: supplier, true completion time, deadline, and any exception decision. */
export const LateAttemptRow = z.object({
  attemptId: Id,
  supplierTenantId: Id,
  supplierLegalName: z.string().min(1),
  completedAt: Instant,
  deadlineAtAttempt: OfficialDeadline,
  lateBySeconds: z.number().int().min(1),
  exceptionDecision: LateSubmissionExceptionsDecision.nullable(),
});
export type LateAttemptRow = z.infer<typeof LateAttemptRow>;

export const CLOSE_BLOCKERS = ['DEADLINE_NOT_REACHED', 'TENDER_NOT_OPEN', 'UNRESOLVED_SERVICE_INCIDENT'] as const;
export const CloseBlocker = z.enum(CLOSE_BLOCKERS);
export type CloseBlocker = z.infer<typeof CloseBlocker>;

export const MonitoringDetail = MonitoringRow.extend({
  officialTimeZone: z.string().min(1),
  lots: z.array(
    LotRef.extend({ stage: LotsStage, deadline: OfficialDeadline, effectiveSupplierCount: z.number().int().min(0) }),
  ),
  closedBy: PersonRef.nullable(),
  counts: z.object({
    effectiveSuppliers: z.number().int().min(0),
    received: z.number().int().min(0),
    superseded: z.number().int().min(0),
    withdrawn: z.number().int().min(0),
    lateRejected: z.number().int().min(0),
    selectedForEvaluation: z.number().int().min(0),
  }),
  /** Effective receipts per official calendar day (for the receipt trend). */
  receiptsByDay: z.array(z.object({ date: z.iso.date(), count: z.number().int().min(0) })),
  incidents: z.array(MonitoringIncident),
  lateAttempts: z.array(LateAttemptRow),
  canClose: z.boolean(),
  closeBlockers: z.array(CloseBlocker),
});
export type MonitoringDetail = z.infer<typeof MonitoringDetail>;

/** A row of `v_bid_receipt_metadata`: never content, never drafts (BR-17, DD-13). */
export const ReceiptMetadataRow = z.object({
  receiptId: Id,
  receiptNo: Reference,
  bidId: Id,
  supplierTenantId: Id,
  /** The supplier legal name valid at `receivedAt`. */
  supplierLegalName: z.string().min(1),
  receivedAt: Instant,
  status: SubmissionReceiptsStatus,
  documentCount: z.number().int().min(0),
  isEffective: z.boolean(),
  roundType: BidsRoundType,
});
export type ReceiptMetadataRow = z.infer<typeof ReceiptMetadataRow>;

export const MonitoringReceiptQuery = listQueryWithSort(['receivedAt', 'supplierLegalName', 'receiptNo'] as const).extend({
  status: queryList(SubmissionReceiptsStatus).optional(),
  /** Default true: one row per supplier's effective submission (unique suppliers, not revisions). */
  effectiveOnly: QueryBoolean.optional(),
  receivedFrom: Instant.optional(),
  receivedTo: Instant.optional(),
});
export type MonitoringReceiptQueryInput = z.input<typeof MonitoringReceiptQuery>;
export const MonitoringReceiptPage = pageOf(ReceiptMetadataRow);
export type MonitoringReceiptPage = z.infer<typeof MonitoringReceiptPage>;

export const TenderParams = z.object({ tenderId: IdParam });

export const CloseTenderBody = z.object({
  confirmation: ContextConfirmation,
  note: NoteText.optional(),
});
export type CloseTenderBody = z.infer<typeof CloseTenderBody>;

export const ClosingRecord = z.object({
  tenderId: Id,
  reference: Reference,
  status: TendersStatus,
  closingStatus: ClosingStatus,
  closedAt: Instant,
  closedBy: ActorRef,
  deadline: OfficialDeadline,
  effectiveSupplierCount: z.number().int().min(0),
  lateAttemptCount: z.number().int().min(0),
  note: z.string().nullable(),
});
export type ClosingRecord = z.infer<typeof ClosingRecord>;
