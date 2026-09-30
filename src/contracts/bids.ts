/**
 * Bids contract: supplier response preparation, internal approval, submission, receipts, revisions and withdrawal
 * (SUP-12..SUP-17), and buyer submission monitoring and closing (BUY-19). FR-11, FR-12; BR-17..BR-21;
 * AC-03, AC-11..AC-14. Schemas live in `./bids/model.ts` and are re-exported here.
 *
 * Audiences and permissions:
 * - `/api/v1/supplier/bids/**` and `/api/v1/supplier/receipts/**` serve the caller's OWN supplier tenant only. A draft
 *   is visible to the authorized response team (`RESPONSE_TEAM_PERMISSIONS`) and never to the buyer (BR-17).
 * - Pricing is restricted to pricing personas: `supplier.pricing.edit` edits, approvers may read it to weigh the
 *   commercial exposure. A contributor gets 403 on pricing and sees only whether pricing is complete.
 * - Submission and withdrawal require `supplier.response.submit` (AC-03). The submission preview tells a caller
 *   without it WHY they cannot submit and who can.
 * - `/api/v1/buyer/submission-monitoring/**` exposes receipt metadata only (`v_bid_receipt_metadata`, DD-13): unique
 *   supplier counts, receipt numbers, times, statuses, document counts, closing status and incidents. There is NO
 *   buyer content endpoint in this domain; opening belongs to the opening domain.
 *
 * Commands that change response content return the new `contentHash` and the internal approvals the change
 * invalidated (BR-10). Submission failures are problem+json errors and never produce a success receipt (BR-18, BR-19).
 */
import { defineEndpoint } from './endpoint.js';
import type { PermissionCode } from './permissions.js';
import {
  AddCommentBody,
  AnswerListQuery,
  AnswerPage,
  AnswerParams,
  AnswerQuery,
  AssignAnswerBody,
  AttachAnswerDocumentBody,
  AttachEvidenceBody,
  AttachmentParams,
  AttemptListQuery,
  AttemptPage,
  BidAnswerDetail,
  BidAnswerRow,
  BidComment,
  BidDeclarations,
  BidDetail,
  BidListQuery,
  BidPage,
  BidParams,
  BidPricing,
  BidReadiness,
  BidReceiptListQuery,
  BidRevision,
  CloseTenderBody,
  ClosingRecord,
  CreateRevisionBody,
  DecideInternalApprovalBody,
  EvidenceParams,
  InternalApprovalParams,
  InternalReview,
  MonitoringDetail,
  MonitoringListQuery,
  MonitoringPage,
  MonitoringReceiptPage,
  MonitoringReceiptQuery,
  Receipt,
  ReceiptDownload,
  ReceiptPage,
  ReceiptParams,
  RequestInternalApprovalBody,
  ReuseAnswerBody,
  ReuseCandidatePage,
  ReuseCandidateQuery,
  RevisionListQuery,
  RevisionPage,
  RevisionQuery,
  SaveAnswerBody,
  SaveAnswerResult,
  SaveConsortiumBody,
  SaveDeclarationsBody,
  SaveDeclarationsResult,
  SaveExceptionsBody,
  SaveKeyPersonnelBody,
  SavePricingBody,
  SavePricingResult,
  SaveSubcontractorsBody,
  BidStartOptions,
  StartBidBody,
  SubmissionPreview,
  SubmissionResult,
  SubmitBody,
  SupplierReceiptListQuery,
  SupplierReceiptPage,
  TenderParams,
  UpdateBidLotsBody,
  WithdrawBody,
  WithdrawalListQuery,
  WithdrawalPage,
  WithdrawalResult,
} from './bids/model.js';

export * from './bids/model.js';

// ---------------------------------------------------------------------------------------------------------
// Permission sets
// ---------------------------------------------------------------------------------------------------------

/** Anyone on the supplier's response team may read the workspace (never the buyer). */
export const RESPONSE_TEAM_PERMISSIONS = [
  'supplier.response.edit',
  'supplier.pricing.edit',
  'supplier.response.approve',
  'supplier.response.submit',
] as const satisfies readonly [PermissionCode, ...PermissionCode[]];

/** Pricing is readable by pricing contributors and by internal approvers weighing the commercial exposure. */
export const PRICING_VIEW_PERMISSIONS = [
  'supplier.pricing.edit',
  'supplier.response.approve',
] as const satisfies readonly [PermissionCode, ...PermissionCode[]];

/** Official receipts are also readable by the supplier administrator (outcomes). */
export const RECEIPT_VIEW_PERMISSIONS = [
  ...RESPONSE_TEAM_PERMISSIONS,
  'supplier.outcomes.view',
] as const satisfies readonly [PermissionCode, ...PermissionCode[]];

/** Review comments come from the response team and the internal approvers. */
export const COMMENT_PERMISSIONS = [
  'supplier.response.edit',
  'supplier.response.approve',
] as const satisfies readonly [PermissionCode, ...PermissionCode[]];

/** Errors every response-content command can return. */
const CONTENT_COMMAND_ERRORS = ['BID_NOT_FOUND', 'REVISION_NOT_FOUND', 'REVISION_NOT_EDITABLE'] as const;

// ---------------------------------------------------------------------------------------------------------
// Supplier: response list and workspace (SUP-12..SUP-17)
// ---------------------------------------------------------------------------------------------------------

/** GET /api/v1/supplier/bids: the supplier's responses (drafts included for its own team). */
export const listBids = defineEndpoint({
  id: 'supplier.bids.list',
  method: 'GET',
  path: '/api/v1/supplier/bids',
  audience: 'supplier',
  permission: RESPONSE_TEAM_PERMISSIONS,
  query: BidListQuery,
  response: BidPage,
  errors: [],
  screens: ['SUP-12', 'SUP-16', 'SUP-17'],
});

/** POST /api/v1/supplier/bids: opens a response workspace for a tender round. */
export const startBid = defineEndpoint({
  id: 'supplier.bids.start',
  method: 'POST',
  path: '/api/v1/supplier/bids',
  audience: 'supplier',
  permission: 'supplier.response.edit',
  body: StartBidBody,
  response: BidDetail,
  idempotent: true,
  errors: ['TENDER_NOT_FOUND', 'TENDER_NOT_OPEN', 'BID_ALREADY_EXISTS', 'ALTERNATIVES_NOT_ALLOWED', 'ROUND_NOT_OPEN'],
  screens: ['SUP-12'],
});

/**
 * GET /api/v1/supplier/bid-starts/:tenderId: whether the supplier can open a response workspace (main offer and,
 * when accepted, an alternative offer) for the tender's current round, and which existing response to open instead.
 */
export const getBidStartOptions = defineEndpoint({
  id: 'supplier.bids.startOptions',
  method: 'GET',
  path: '/api/v1/supplier/bid-starts/:tenderId',
  audience: 'supplier',
  permission: RESPONSE_TEAM_PERMISSIONS,
  params: TenderParams,
  response: BidStartOptions,
  errors: ['TENDER_NOT_FOUND'],
  screens: ['SUP-12'],
});

/** GET /api/v1/supplier/bids/:bidId: the workspace header, lots, sections, team, addenda and effective offer. */
export const getBid = defineEndpoint({
  id: 'supplier.bids.get',
  method: 'GET',
  path: '/api/v1/supplier/bids/:bidId',
  audience: 'supplier',
  permission: RESPONSE_TEAM_PERMISSIONS,
  params: BidParams,
  response: BidDetail,
  errors: ['BID_NOT_FOUND'],
  screens: ['SUP-12', 'SUP-13', 'SUP-14', 'SUP-15', 'SUP-16', 'SUP-17'],
});

/** PUT /api/v1/supplier/bids/:bidId/lots: selects the offered lots. */
export const updateBidLots = defineEndpoint({
  id: 'supplier.bids.updateLots',
  method: 'PUT',
  path: '/api/v1/supplier/bids/:bidId/lots',
  audience: 'supplier',
  permission: 'supplier.response.edit',
  params: BidParams,
  body: UpdateBidLotsBody,
  response: BidDetail,
  errors: [...CONTENT_COMMAND_ERRORS, 'LOT_NOT_ELIGIBLE', 'MAX_LOTS_EXCEEDED', 'PARTIAL_BIDS_NOT_ALLOWED'],
  screens: ['SUP-12'],
});

// ---------------------------------------------------------------------------------------------------------
// Supplier: answers (SUP-12)
// ---------------------------------------------------------------------------------------------------------

/** GET /api/v1/supplier/bids/:bidId/answers: requirements with answers, by section and lot. */
export const listAnswers = defineEndpoint({
  id: 'supplier.bids.answers',
  method: 'GET',
  path: '/api/v1/supplier/bids/:bidId/answers',
  audience: 'supplier',
  permission: RESPONSE_TEAM_PERMISSIONS,
  params: BidParams,
  query: AnswerListQuery,
  response: AnswerPage,
  errors: ['BID_NOT_FOUND', 'REVISION_NOT_FOUND'],
  screens: ['SUP-12'],
});

/** GET /api/v1/supplier/bids/:bidId/answers/:requirementId: one answer with attachments and review comments. */
export const getAnswer = defineEndpoint({
  id: 'supplier.bids.getAnswer',
  method: 'GET',
  path: '/api/v1/supplier/bids/:bidId/answers/:requirementId',
  audience: 'supplier',
  permission: RESPONSE_TEAM_PERMISSIONS,
  params: AnswerParams,
  query: AnswerQuery,
  response: BidAnswerDetail,
  errors: ['BID_NOT_FOUND', 'REVISION_NOT_FOUND', 'REQUIREMENT_NOT_FOUND'],
  screens: ['SUP-12'],
});

/** PUT /api/v1/supplier/bids/:bidId/answers/:requirementId: saves an answer (a contributor only its assigned ones). */
export const saveAnswer = defineEndpoint({
  id: 'supplier.bids.saveAnswer',
  method: 'PUT',
  path: '/api/v1/supplier/bids/:bidId/answers/:requirementId',
  audience: 'supplier',
  permission: 'supplier.response.edit',
  params: AnswerParams,
  body: SaveAnswerBody,
  response: SaveAnswerResult,
  errors: [
    ...CONTENT_COMMAND_ERRORS,
    'REQUIREMENT_NOT_FOUND',
    'ANSWER_NOT_ASSIGNED',
    'ANSWER_TYPE_MISMATCH',
    'CHOICE_NOT_ALLOWED',
    'REQUIREMENT_LOT_NOT_SELECTED',
  ],
  screens: ['SUP-12'],
});

/** POST /api/v1/supplier/bids/:bidId/answers/:requirementId/assign: assigns a contributor and an internal due date. */
export const assignAnswer = defineEndpoint({
  id: 'supplier.bids.assignAnswer',
  method: 'POST',
  path: '/api/v1/supplier/bids/:bidId/answers/:requirementId/assign',
  audience: 'supplier',
  permission: 'supplier.pursuit.manage',
  params: AnswerParams,
  body: AssignAnswerBody,
  response: BidAnswerRow,
  errors: [...CONTENT_COMMAND_ERRORS, 'REQUIREMENT_NOT_FOUND', 'ASSIGNEE_NOT_ON_TEAM', 'ASSIGNEE_CANNOT_VIEW_PRICING'],
  screens: ['SUP-12'],
});

/** POST /api/v1/supplier/bids/:bidId/answers/:requirementId/comments: a private review comment. */
export const addAnswerComment = defineEndpoint({
  id: 'supplier.bids.addComment',
  method: 'POST',
  path: '/api/v1/supplier/bids/:bidId/answers/:requirementId/comments',
  audience: 'supplier',
  permission: COMMENT_PERMISSIONS,
  params: AnswerParams,
  body: AddCommentBody,
  response: BidComment,
  idempotent: true,
  errors: ['BID_NOT_FOUND', 'REVISION_NOT_FOUND', 'REQUIREMENT_NOT_FOUND'],
  screens: ['SUP-12', 'SUP-15'],
});

/** GET /api/v1/supplier/bids/:bidId/answers/:requirementId/reuse-candidates: the supplier's earlier answers. */
export const listReuseCandidates = defineEndpoint({
  id: 'supplier.bids.reuseCandidates',
  method: 'GET',
  path: '/api/v1/supplier/bids/:bidId/answers/:requirementId/reuse-candidates',
  audience: 'supplier',
  permission: 'supplier.response.edit',
  params: AnswerParams,
  query: ReuseCandidateQuery,
  response: ReuseCandidatePage,
  errors: ['BID_NOT_FOUND', 'REQUIREMENT_NOT_FOUND'],
  screens: ['SUP-12'],
});

/** POST /api/v1/supplier/bids/:bidId/answers/:requirementId/reuse: copies earlier content, flagged for review. */
export const reuseAnswer = defineEndpoint({
  id: 'supplier.bids.reuseAnswer',
  method: 'POST',
  path: '/api/v1/supplier/bids/:bidId/answers/:requirementId/reuse',
  audience: 'supplier',
  permission: 'supplier.response.edit',
  params: AnswerParams,
  body: ReuseAnswerBody,
  response: SaveAnswerResult,
  errors: [...CONTENT_COMMAND_ERRORS, 'REQUIREMENT_NOT_FOUND', 'ANSWER_NOT_ASSIGNED', 'REUSE_SOURCE_NOT_FOUND'],
  screens: ['SUP-12'],
});

/** POST /api/v1/supplier/bids/:bidId/answers/:requirementId/documents: attaches an upload or an evidence snapshot. */
export const attachAnswerDocument = defineEndpoint({
  id: 'supplier.bids.attachDocument',
  method: 'POST',
  path: '/api/v1/supplier/bids/:bidId/answers/:requirementId/documents',
  audience: 'supplier',
  permission: 'supplier.response.edit',
  params: AnswerParams,
  body: AttachAnswerDocumentBody,
  response: SaveAnswerResult,
  idempotent: true,
  errors: [
    ...CONTENT_COMMAND_ERRORS,
    'REQUIREMENT_NOT_FOUND',
    'ANSWER_NOT_ASSIGNED',
    'DOCUMENT_NOT_FOUND',
    'EVIDENCE_NOT_FOUND',
    'EVIDENCE_EXPIRED',
    'EVIDENCE_NOT_CURRENT',
  ],
  screens: ['SUP-12'],
});

/** DELETE /api/v1/supplier/bids/:bidId/answers/:requirementId/documents/:attachmentId: removes it from the draft. */
export const detachAnswerDocument = defineEndpoint({
  id: 'supplier.bids.detachDocument',
  method: 'DELETE',
  path: '/api/v1/supplier/bids/:bidId/answers/:requirementId/documents/:attachmentId',
  audience: 'supplier',
  permission: 'supplier.response.edit',
  params: AttachmentParams,
  query: RevisionQuery,
  response: SaveAnswerResult,
  errors: [...CONTENT_COMMAND_ERRORS, 'REQUIREMENT_NOT_FOUND', 'ANSWER_NOT_ASSIGNED', 'ATTACHMENT_NOT_FOUND'],
  screens: ['SUP-12'],
});

// ---------------------------------------------------------------------------------------------------------
// Supplier: pricing and commercial offer (SUP-13)
// ---------------------------------------------------------------------------------------------------------

/** GET /api/v1/supplier/bids/:bidId/pricing: price schedules, commercial terms and decimal-string totals. */
export const getPricing = defineEndpoint({
  id: 'supplier.bids.pricing',
  method: 'GET',
  path: '/api/v1/supplier/bids/:bidId/pricing',
  audience: 'supplier',
  permission: PRICING_VIEW_PERMISSIONS,
  params: BidParams,
  query: AnswerQuery,
  response: BidPricing,
  errors: ['BID_NOT_FOUND', 'REVISION_NOT_FOUND'],
  screens: ['SUP-13', 'SUP-15'],
});

/** PUT /api/v1/supplier/bids/:bidId/pricing: saves price lines and commercial terms; totals are recomputed. */
export const savePricing = defineEndpoint({
  id: 'supplier.bids.savePricing',
  method: 'PUT',
  path: '/api/v1/supplier/bids/:bidId/pricing',
  audience: 'supplier',
  permission: 'supplier.pricing.edit',
  params: BidParams,
  body: SavePricingBody,
  response: SavePricingResult,
  errors: [...CONTENT_COMMAND_ERRORS, 'PRICING_ITEM_NOT_FOUND', 'CURRENCY_NOT_ACCEPTED', 'LOT_NOT_SELECTED'],
  screens: ['SUP-13'],
});

// ---------------------------------------------------------------------------------------------------------
// Supplier: declarations, parties, exceptions and evidence (SUP-14)
// ---------------------------------------------------------------------------------------------------------

/** GET /api/v1/supplier/bids/:bidId/declarations: declarations, subcontractors, personnel, consortium, evidence. */
export const getDeclarations = defineEndpoint({
  id: 'supplier.bids.declarations',
  method: 'GET',
  path: '/api/v1/supplier/bids/:bidId/declarations',
  audience: 'supplier',
  permission: RESPONSE_TEAM_PERMISSIONS,
  params: BidParams,
  query: AnswerQuery,
  response: BidDeclarations,
  errors: ['BID_NOT_FOUND', 'REVISION_NOT_FOUND'],
  screens: ['SUP-14'],
});

/** PUT /api/v1/supplier/bids/:bidId/declarations: confirms or explains each declaration. */
export const saveDeclarations = defineEndpoint({
  id: 'supplier.bids.saveDeclarations',
  method: 'PUT',
  path: '/api/v1/supplier/bids/:bidId/declarations',
  audience: 'supplier',
  permission: 'supplier.response.edit',
  params: BidParams,
  body: SaveDeclarationsBody,
  response: SaveDeclarationsResult,
  errors: [...CONTENT_COMMAND_ERRORS, 'DECLARATION_NOT_REQUIRED'],
  screens: ['SUP-14'],
});

/** PUT /api/v1/supplier/bids/:bidId/subcontractors: the proposed subcontractors. */
export const saveSubcontractors = defineEndpoint({
  id: 'supplier.bids.saveSubcontractors',
  method: 'PUT',
  path: '/api/v1/supplier/bids/:bidId/subcontractors',
  audience: 'supplier',
  permission: 'supplier.response.edit',
  params: BidParams,
  body: SaveSubcontractorsBody,
  response: SaveDeclarationsResult,
  errors: [...CONTENT_COMMAND_ERRORS, 'DOCUMENT_NOT_FOUND'],
  screens: ['SUP-14'],
});

/** PUT /api/v1/supplier/bids/:bidId/key-personnel: the proposed key personnel. */
export const saveKeyPersonnel = defineEndpoint({
  id: 'supplier.bids.saveKeyPersonnel',
  method: 'PUT',
  path: '/api/v1/supplier/bids/:bidId/key-personnel',
  audience: 'supplier',
  permission: 'supplier.response.edit',
  params: BidParams,
  body: SaveKeyPersonnelBody,
  response: SaveDeclarationsResult,
  errors: [...CONTENT_COMMAND_ERRORS, 'DOCUMENT_NOT_FOUND'],
  screens: ['SUP-14'],
});

/** PUT /api/v1/supplier/bids/:bidId/consortium: consortium status and members. */
export const saveConsortium = defineEndpoint({
  id: 'supplier.bids.saveConsortium',
  method: 'PUT',
  path: '/api/v1/supplier/bids/:bidId/consortium',
  audience: 'supplier',
  permission: 'supplier.response.edit',
  params: BidParams,
  body: SaveConsortiumBody,
  response: SaveDeclarationsResult,
  errors: [...CONTENT_COMMAND_ERRORS, 'LEAD_MUST_BE_SUPPLIER'],
  screens: ['SUP-14'],
});

/** PUT /api/v1/supplier/bids/:bidId/exceptions: proposed contract exceptions. */
export const saveExceptions = defineEndpoint({
  id: 'supplier.bids.saveExceptions',
  method: 'PUT',
  path: '/api/v1/supplier/bids/:bidId/exceptions',
  audience: 'supplier',
  permission: 'supplier.response.edit',
  params: BidParams,
  body: SaveExceptionsBody,
  response: SaveDeclarationsResult,
  errors: [...CONTENT_COMMAND_ERRORS],
  screens: ['SUP-14'],
});

/** POST /api/v1/supplier/bids/:bidId/evidence: snapshots the current edition of an evidence item. */
export const attachEvidence = defineEndpoint({
  id: 'supplier.bids.attachEvidence',
  method: 'POST',
  path: '/api/v1/supplier/bids/:bidId/evidence',
  audience: 'supplier',
  permission: 'supplier.response.edit',
  params: BidParams,
  body: AttachEvidenceBody,
  response: SaveDeclarationsResult,
  idempotent: true,
  errors: [...CONTENT_COMMAND_ERRORS, 'EVIDENCE_NOT_FOUND', 'EVIDENCE_EXPIRED', 'EVIDENCE_NOT_CURRENT', 'EVIDENCE_ALREADY_ATTACHED'],
  screens: ['SUP-14'],
});

/** DELETE /api/v1/supplier/bids/:bidId/evidence/:evidenceItemId: removes an evidence snapshot from the draft. */
export const detachEvidence = defineEndpoint({
  id: 'supplier.bids.detachEvidence',
  method: 'DELETE',
  path: '/api/v1/supplier/bids/:bidId/evidence/:evidenceItemId',
  audience: 'supplier',
  permission: 'supplier.response.edit',
  params: EvidenceParams,
  query: RevisionQuery,
  response: SaveDeclarationsResult,
  errors: [...CONTENT_COMMAND_ERRORS, 'EVIDENCE_NOT_ATTACHED'],
  screens: ['SUP-14'],
});

// ---------------------------------------------------------------------------------------------------------
// Supplier: readiness, revisions and internal approval (SUP-12, SUP-15, SUP-16)
// ---------------------------------------------------------------------------------------------------------

/** GET /api/v1/supplier/bids/:bidId/readiness: blocking errors separated from warnings. */
export const getReadiness = defineEndpoint({
  id: 'supplier.bids.readiness',
  method: 'GET',
  path: '/api/v1/supplier/bids/:bidId/readiness',
  audience: 'supplier',
  permission: RESPONSE_TEAM_PERMISSIONS,
  params: BidParams,
  query: AnswerQuery,
  response: BidReadiness,
  errors: ['BID_NOT_FOUND', 'REVISION_NOT_FOUND'],
  screens: ['SUP-12', 'SUP-15', 'SUP-16'],
});

/** GET /api/v1/supplier/bids/:bidId/revisions: revision history with statuses. */
export const listRevisions = defineEndpoint({
  id: 'supplier.bids.revisions',
  method: 'GET',
  path: '/api/v1/supplier/bids/:bidId/revisions',
  audience: 'supplier',
  permission: RESPONSE_TEAM_PERMISSIONS,
  params: BidParams,
  query: RevisionListQuery,
  response: RevisionPage,
  errors: ['BID_NOT_FOUND'],
  screens: ['SUP-15', 'SUP-17'],
});

/** POST /api/v1/supplier/bids/:bidId/revisions: prepares a replacement; the effective receipt stays effective. */
export const createRevision = defineEndpoint({
  id: 'supplier.bids.createRevision',
  method: 'POST',
  path: '/api/v1/supplier/bids/:bidId/revisions',
  audience: 'supplier',
  permission: 'supplier.response.edit',
  params: BidParams,
  body: CreateRevisionBody,
  response: BidRevision,
  idempotent: true,
  errors: ['BID_NOT_FOUND', 'REVISION_NOT_FOUND', 'WORKING_REVISION_EXISTS', 'SUBMISSION_WINDOW_CLOSED', 'BID_WITHDRAWN'],
  screens: ['SUP-17'],
});

/** GET /api/v1/supplier/bids/:bidId/review: the internal review of the working revision. */
export const getInternalReview = defineEndpoint({
  id: 'supplier.bids.review',
  method: 'GET',
  path: '/api/v1/supplier/bids/:bidId/review',
  audience: 'supplier',
  permission: RESPONSE_TEAM_PERMISSIONS,
  params: BidParams,
  query: AnswerQuery,
  response: InternalReview,
  errors: ['BID_NOT_FOUND', 'REVISION_NOT_FOUND'],
  screens: ['SUP-15'],
});

/** POST /api/v1/supplier/bids/:bidId/approvals: requests internal approval of the exact revision content. */
export const requestInternalApproval = defineEndpoint({
  id: 'supplier.bids.requestApproval',
  method: 'POST',
  path: '/api/v1/supplier/bids/:bidId/approvals',
  audience: 'supplier',
  permission: 'supplier.response.edit',
  params: BidParams,
  body: RequestInternalApprovalBody,
  response: InternalReview,
  idempotent: true,
  errors: [
    ...CONTENT_COMMAND_ERRORS,
    'CONTENT_HASH_MISMATCH',
    'APPROVER_NOT_AUTHORIZED',
    'APPROVAL_ALREADY_PENDING',
    'SELF_APPROVAL_NOT_ALLOWED',
  ],
  screens: ['SUP-15'],
});

/** POST /api/v1/supplier/bids/:bidId/approvals/:approvalId/decide: approve, reject, return or delegate. */
export const decideInternalApproval = defineEndpoint({
  id: 'supplier.bids.decideApproval',
  method: 'POST',
  path: '/api/v1/supplier/bids/:bidId/approvals/:approvalId/decide',
  audience: 'supplier',
  permission: 'supplier.response.approve',
  params: InternalApprovalParams,
  body: DecideInternalApprovalBody,
  response: InternalReview,
  errors: [
    'BID_NOT_FOUND',
    'APPROVAL_NOT_FOUND',
    'NOT_ASSIGNED_APPROVER',
    'APPROVAL_NOT_PENDING',
    'APPROVAL_INVALIDATED',
    'CONTENT_HASH_MISMATCH',
    'DELEGATE_NOT_AUTHORIZED',
  ],
  screens: ['SUP-15'],
});

// ---------------------------------------------------------------------------------------------------------
// Supplier: final review and submission (SUP-16)
// ---------------------------------------------------------------------------------------------------------

/** GET /api/v1/supplier/bids/:bidId/submission: exactly what would be submitted, and whether the caller may. */
export const getSubmissionPreview = defineEndpoint({
  id: 'supplier.bids.submissionPreview',
  method: 'GET',
  path: '/api/v1/supplier/bids/:bidId/submission',
  audience: 'supplier',
  permission: RESPONSE_TEAM_PERMISSIONS,
  params: BidParams,
  response: SubmissionPreview,
  errors: ['BID_NOT_FOUND'],
  screens: ['SUP-16'],
});

/**
 * POST /api/v1/supplier/bids/:bidId/submit: the deliberate, authorized submission. Success returns 201 with the
 * official receipt. Every failure is recorded as a `submission_attempts` row and answered with an error; a failed
 * replacement leaves the earlier receipt effective (BR-19); a late completion is rejected with the true time (BR-20).
 */
export const submitBid = defineEndpoint({
  id: 'supplier.bids.submit',
  method: 'POST',
  path: '/api/v1/supplier/bids/:bidId/submit',
  audience: 'supplier',
  permission: 'supplier.response.submit',
  params: BidParams,
  body: SubmitBody,
  response: SubmissionResult,
  idempotent: true,
  errors: [
    'BID_NOT_FOUND',
    'REVISION_NOT_FOUND',
    'REVISION_NOT_SUBMITTABLE',
    'CONTENT_HASH_MISMATCH',
    'CONTEXT_MISMATCH',
    'READINESS_BLOCKING',
    'INTERNAL_APPROVAL_REQUIRED',
    'REPLACEMENT_NOT_ACKNOWLEDGED',
    'SUBMISSION_LATE',
    'SUBMISSION_FAILED',
    'TENDER_NOT_OPEN',
  ],
  screens: ['SUP-16'],
});

// ---------------------------------------------------------------------------------------------------------
// Supplier: receipts, attempts and withdrawal (SUP-17)
// ---------------------------------------------------------------------------------------------------------

/** GET /api/v1/supplier/bids/:bidId/receipts: every receipt of the response. */
export const listBidReceipts = defineEndpoint({
  id: 'supplier.bids.receipts',
  method: 'GET',
  path: '/api/v1/supplier/bids/:bidId/receipts',
  audience: 'supplier',
  permission: RECEIPT_VIEW_PERMISSIONS,
  params: BidParams,
  query: BidReceiptListQuery,
  response: ReceiptPage,
  errors: ['BID_NOT_FOUND'],
  screens: ['SUP-17'],
});

/** GET /api/v1/supplier/bids/:bidId/submission-attempts: successful, failed and late attempts with true times. */
export const listSubmissionAttempts = defineEndpoint({
  id: 'supplier.bids.attempts',
  method: 'GET',
  path: '/api/v1/supplier/bids/:bidId/submission-attempts',
  audience: 'supplier',
  permission: RESPONSE_TEAM_PERMISSIONS,
  params: BidParams,
  query: AttemptListQuery,
  response: AttemptPage,
  errors: ['BID_NOT_FOUND'],
  screens: ['SUP-16', 'SUP-17'],
});

/** GET /api/v1/supplier/bids/:bidId/withdrawals: withdrawal confirmations. */
export const listWithdrawals = defineEndpoint({
  id: 'supplier.bids.withdrawals',
  method: 'GET',
  path: '/api/v1/supplier/bids/:bidId/withdrawals',
  audience: 'supplier',
  permission: RECEIPT_VIEW_PERMISSIONS,
  params: BidParams,
  query: WithdrawalListQuery,
  response: WithdrawalPage,
  errors: ['BID_NOT_FOUND'],
  screens: ['SUP-17'],
});

/** POST /api/v1/supplier/bids/:bidId/withdraw: explicit withdrawal of the effective response (AC-14). */
export const withdrawBid = defineEndpoint({
  id: 'supplier.bids.withdraw',
  method: 'POST',
  path: '/api/v1/supplier/bids/:bidId/withdraw',
  audience: 'supplier',
  permission: 'supplier.response.submit',
  params: BidParams,
  body: WithdrawBody,
  response: WithdrawalResult,
  idempotent: true,
  errors: ['BID_NOT_FOUND', 'NO_EFFECTIVE_SUBMISSION', 'RECEIPT_NOT_EFFECTIVE', 'SUBMISSION_WINDOW_CLOSED', 'CONTEXT_MISMATCH'],
  screens: ['SUP-17'],
});

/** GET /api/v1/supplier/receipts: all official receipts of the supplier. */
export const listSupplierReceipts = defineEndpoint({
  id: 'supplier.receipts.list',
  method: 'GET',
  path: '/api/v1/supplier/receipts',
  audience: 'supplier',
  permission: RECEIPT_VIEW_PERMISSIONS,
  query: SupplierReceiptListQuery,
  response: SupplierReceiptPage,
  errors: [],
  screens: ['SUP-17'],
});

/** GET /api/v1/supplier/receipts/:receiptId: one official receipt with its inventory. */
export const getReceipt = defineEndpoint({
  id: 'supplier.receipts.get',
  method: 'GET',
  path: '/api/v1/supplier/receipts/:receiptId',
  audience: 'supplier',
  permission: RECEIPT_VIEW_PERMISSIONS,
  params: ReceiptParams,
  response: Receipt,
  errors: ['RECEIPT_NOT_FOUND'],
  screens: ['SUP-16', 'SUP-17'],
});

/** GET /api/v1/supplier/receipts/:receiptId/download: the printable receipt. */
export const downloadReceipt = defineEndpoint({
  id: 'supplier.receipts.download',
  method: 'GET',
  path: '/api/v1/supplier/receipts/:receiptId/download',
  audience: 'supplier',
  permission: RECEIPT_VIEW_PERMISSIONS,
  params: ReceiptParams,
  response: ReceiptDownload,
  errors: ['RECEIPT_NOT_FOUND'],
  screens: ['SUP-17'],
});

// ---------------------------------------------------------------------------------------------------------
// Buyer: submission monitoring and closing (BUY-19) — metadata only
// ---------------------------------------------------------------------------------------------------------

/** GET /api/v1/buyer/submission-monitoring: released tenders with receipt counts and closing status. */
export const listMonitoring = defineEndpoint({
  id: 'buyer.submissions.list',
  method: 'GET',
  path: '/api/v1/buyer/submission-monitoring',
  audience: 'buyer',
  permission: 'bid.monitor',
  query: MonitoringListQuery,
  response: MonitoringPage,
  errors: [],
  screens: ['BUY-19'],
});

/** GET /api/v1/buyer/submission-monitoring/tenders/:tenderId: deadlines, counts, closing and incidents. */
export const getMonitoring = defineEndpoint({
  id: 'buyer.submissions.get',
  method: 'GET',
  path: '/api/v1/buyer/submission-monitoring/tenders/:tenderId',
  audience: 'buyer',
  permission: 'bid.monitor',
  params: TenderParams,
  response: MonitoringDetail,
  errors: ['TENDER_NOT_FOUND'],
  screens: ['BUY-19'],
});

/** GET /api/v1/buyer/submission-monitoring/tenders/:tenderId/receipts: `v_bid_receipt_metadata` rows. */
export const listMonitoringReceipts = defineEndpoint({
  id: 'buyer.submissions.receipts',
  method: 'GET',
  path: '/api/v1/buyer/submission-monitoring/tenders/:tenderId/receipts',
  audience: 'buyer',
  permission: 'bid.monitor',
  params: TenderParams,
  query: MonitoringReceiptQuery,
  response: MonitoringReceiptPage,
  errors: ['TENDER_NOT_FOUND'],
  screens: ['BUY-19'],
});

/** POST /api/v1/buyer/submission-monitoring/tenders/:tenderId/close: closes under the official deadline. */
export const closeTender = defineEndpoint({
  id: 'buyer.submissions.close',
  method: 'POST',
  path: '/api/v1/buyer/submission-monitoring/tenders/:tenderId/close',
  audience: 'buyer',
  permission: 'tender.close',
  params: TenderParams,
  body: CloseTenderBody,
  response: ClosingRecord,
  errors: ['TENDER_NOT_FOUND', 'DEADLINE_NOT_REACHED', 'TENDER_NOT_OPEN', 'UNRESOLVED_SERVICE_INCIDENT', 'CONTEXT_MISMATCH'],
  screens: ['BUY-19'],
});

// ---------------------------------------------------------------------------------------------------------
// Endpoint map
// ---------------------------------------------------------------------------------------------------------

export const bidEndpoints = {
  listBids,
  getBidStartOptions,
  startBid,
  getBid,
  updateBidLots,
  listAnswers,
  getAnswer,
  saveAnswer,
  assignAnswer,
  addAnswerComment,
  listReuseCandidates,
  reuseAnswer,
  attachAnswerDocument,
  detachAnswerDocument,
  getPricing,
  savePricing,
  getDeclarations,
  saveDeclarations,
  saveSubcontractors,
  saveKeyPersonnel,
  saveConsortium,
  saveExceptions,
  attachEvidence,
  detachEvidence,
  getReadiness,
  listRevisions,
  createRevision,
  getInternalReview,
  requestInternalApproval,
  decideInternalApproval,
  getSubmissionPreview,
  submitBid,
  listBidReceipts,
  listSubmissionAttempts,
  listWithdrawals,
  withdrawBid,
  listSupplierReceipts,
  getReceipt,
  downloadReceipt,
  listMonitoring,
  getMonitoring,
  listMonitoringReceipts,
  closeTender,
} as const;

