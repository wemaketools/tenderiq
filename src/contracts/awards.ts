/**
 * Awards contract (domain 13): award recommendation and approval, outcome notices and standstill, debriefs and
 * complaints, the public award notice and event closeout (FR-17, BR-31..BR-35; BUY-26, BUY-28, BUY-29, BUY-30,
 * SUP-21, SUP-22, PUB-05; AC-25, AC-26, AC-27, AC-29, AC-39).
 *
 * Business rules the endpoints carry (Stage B enforces them with the declared error codes):
 * - A recommendation assembles evaluation, commercial comparison, affordability, qualification, diligence,
 *   negotiation, conflicts and exceptions. Every lot has an explicit outcome (award, partial, conditional, no award,
 *   cancelled) and the lot values reconcile with the approved total and the contract allocations (BR-33).
 *   Approvers approve, approve with conditions, reject or return with a rationale; "no award" is a lot outcome with
 *   a reason. Deciding requires `award.approve` and sufficient authority, never self-approval (DD-24, BR-07).
 * - The intention-to-award notice is distinct from the final award notice. The standstill has its own calendar,
 *   end date and extensions; final award is blocked while it runs or while a blocking complaint hold is active
 *   (BR-32, AC-25). Preferred or intended status is never presented as a final award (BR-31).
 * - A debrief explains the recipient's own result only (AC-27). Complaints record standing, acknowledgment, an
 *   independent owner, the hold, investigation, response, appeal, closure and history.
 * - The public award notice is published only after the confidentiality and personal-information reviews (BR-34).
 * - Event closure is blocked while a lot lacks an outcome, a contract is unsigned, a handover is not accepted or a
 *   complaint is open (AC-29). An RFI closes with market findings and a linked next step, without an award (AC-39).
 *
 * Paths: buyer screens address the award file by tender id; supplier paths use tender ids (DD-22); public paths
 * carry the buyer slug and the tender reference.
 */
import { z } from 'zod';

import { IdParam } from './common.js';
import {
  AcceptNoticeTermsBody,
  AcknowledgeComplaintBody,
  AppealComplaintBody,
  ArchiveEventBody,
  AssignComplaintOwnerBody,
  AwardOverview,
  AwardRegisterPage,
  AwardRegisterQuery,
  BuyerPublicAwardNotice,
  CloseEventBody,
  CloseoutState,
  ComplaintTenderOptions,
  ComplaintDetail,
  ComplaintListQuery,
  ComplaintOwnerCandidates,
  ComplaintPage,
  CreateComplaintBody,
  CreateOutcomeNoticeBody,
  CreateRecommendationBody,
  DebriefDetail,
  DebriefListQuery,
  DebriefPage,
  DecideRecommendationBody,
  DeclineDebriefBody,
  EvidencePack,
  ExtendStandstillBody,
  FinalAwardBody,
  IssueOutcomeNoticeBody,
  LotOutcome,
  NoticeAcknowledgment,
  OutcomeNoticeDetail,
  OutcomeNoticeListQuery,
  OutcomeNoticePage,
  PlaceHoldBody,
  ProvideDebriefBody,
  PublicAwardDetail,
  PublicAwardListQuery,
  PublicAwardNoticeFile,
  PublicAwardPage,
  PublicAwardParams,
  PublicNoticeState,
  RecommendationDetail,
  RecordAppealOutcomeBody,
  ReleaseHoldBody,
  RequestDebriefBody,
  RequestEvidencePackBody,
  ResendNoticeResult,
  RespondComplaintBody,
  ReviewPublicNoticeBody,
  SavePublicNoticeBody,
  ScheduleDebriefBody,
  StandstillOverview,
  StandstillPeriod,
  SubmitRecommendationBody,
  SupplierComplaintDetail,
  SupplierComplaintListQuery,
  SupplierComplaintPage,
  SupplierDebrief,
  SupplierOutcomeDetail,
  SupplierOutcomeListQuery,
  SupplierOutcomePage,
  TransitionComplaintBody,
  UpdateCloseoutBody,
  UpdateRecommendationBody,
  WithdrawComplaintBody,
} from './awards/model.js';
import { defineEndpoint } from './endpoint.js';
import type { EndpointPermission } from './endpoint.js';

export * from './awards/model.js';

// ---------------------------------------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------------------------------------

/** Who may read the award file of a tender (award team, approvers, oversight). */
export const AWARD_READ_PERMISSIONS = [
  'award.recommend',
  'award.approve',
  'notice.issue',
  'event.closeout',
  'audit.view',
] as const satisfies EndpointPermission;

/** Who may read outcome notices and the standstill. */
export const NOTICE_READ_PERMISSIONS = [
  'notice.issue',
  'award.recommend',
  'award.approve',
  'complaint.manage',
  'audit.view',
] as const satisfies EndpointPermission;

/** Who may read debriefs and complaints (case owners, debrief managers, oversight). */
export const CASE_READ_PERMISSIONS = ['complaint.manage', 'debrief.manage', 'audit.view'] as const satisfies EndpointPermission;

/** Who may read the event closeout. */
export const CLOSEOUT_READ_PERMISSIONS = ['event.closeout', 'award.recommend', 'audit.view'] as const satisfies EndpointPermission;

// ---------------------------------------------------------------------------------------------------------
// Params
// ---------------------------------------------------------------------------------------------------------

export const TenderParams = z.object({ tenderId: IdParam });
export const RecommendationParams = z.object({ recommendationId: IdParam });
export const LotOutcomeParams = z.object({ lotOutcomeId: IdParam });
export const NoticeParams = z.object({ noticeId: IdParam });
export const NoticeRecipientParams = z.object({ noticeId: IdParam, recipientId: IdParam });
export const StandstillParams = z.object({ standstillId: IdParam });
export const PublicNoticeParams = z.object({ publicNoticeId: IdParam });
export const DebriefParams = z.object({ debriefId: IdParam });
export const ComplaintParams = z.object({ complaintId: IdParam });

// ---------------------------------------------------------------------------------------------------------
// Buyer: award register, overview and recommendation (BUY-26)
// ---------------------------------------------------------------------------------------------------------

export const listAwards = defineEndpoint({
  id: 'buyer.awards.list',
  method: 'GET',
  path: '/api/v1/buyer/awards',
  audience: 'buyer',
  permission: AWARD_READ_PERMISSIONS,
  query: AwardRegisterQuery,
  response: AwardRegisterPage,
  errors: [],
  screens: ['BUY-26', 'BUY-30'],
  summary: 'Award register: tenders at the award, notice or closeout stage with per-lot progress and next step.',
});

export const getAwardOverview = defineEndpoint({
  id: 'buyer.awards.get',
  method: 'GET',
  path: '/api/v1/buyer/awards/:tenderId',
  audience: 'buyer',
  permission: AWARD_READ_PERMISSIONS,
  params: TenderParams,
  response: AwardOverview,
  errors: [],
  screens: ['BUY-26', 'BUY-28'],
  summary: 'Award file of a tender: per-lot outcomes and final-award gates, recommendations, reconciliation, holds.',
});

export const getRecommendation = defineEndpoint({
  id: 'buyer.awards.getRecommendation',
  method: 'GET',
  path: '/api/v1/buyer/award-recommendations/:recommendationId',
  audience: 'buyer',
  permission: AWARD_READ_PERMISSIONS,
  params: RecommendationParams,
  response: RecommendationDetail,
  errors: [],
  screens: ['BUY-26'],
});

export const createRecommendation = defineEndpoint({
  id: 'buyer.awards.createRecommendation',
  method: 'POST',
  path: '/api/v1/buyer/awards/:tenderId/recommendations',
  audience: 'buyer',
  permission: 'award.recommend',
  params: TenderParams,
  body: CreateRecommendationBody,
  response: RecommendationDetail,
  errors: ['TENDER_NOT_AT_AWARD_STAGE', 'RECOMMENDATION_ALREADY_OPEN', 'LOT_NOT_IN_TENDER', 'LOT_ALREADY_DECIDED'],
  screens: ['BUY-26'],
  idempotent: true,
});

export const updateRecommendation = defineEndpoint({
  id: 'buyer.awards.updateRecommendation',
  method: 'PUT',
  path: '/api/v1/buyer/award-recommendations/:recommendationId',
  audience: 'buyer',
  permission: 'award.recommend',
  params: RecommendationParams,
  body: UpdateRecommendationBody,
  response: RecommendationDetail,
  errors: ['RECOMMENDATION_NOT_EDITABLE', 'LOT_NOT_IN_TENDER', 'LOT_OUTCOME_MISSING', 'BID_NOT_ELIGIBLE', 'CURRENCY_MISMATCH'],
  screens: ['BUY-26'],
});

export const submitRecommendation = defineEndpoint({
  id: 'buyer.awards.submitRecommendation',
  method: 'POST',
  path: '/api/v1/buyer/award-recommendations/:recommendationId/submit',
  audience: 'buyer',
  permission: 'award.recommend',
  params: RecommendationParams,
  body: SubmitRecommendationBody,
  response: RecommendationDetail,
  errors: [
    'RECOMMENDATION_NOT_EDITABLE',
    'EVALUATION_NOT_SIGNED_OFF',
    'LOT_OUTCOME_MISSING',
    'TOTALS_DO_NOT_RECONCILE',
    'DILIGENCE_BLOCKING',
    'CONFLICT_UNRESOLVED',
    'FUNDING_NOT_CONFIRMED',
  ],
  screens: ['BUY-26'],
  summary: 'Submits the exact recommendation version for award approval (subject type award).',
});

export const decideRecommendation = defineEndpoint({
  id: 'buyer.awards.decideRecommendation',
  method: 'POST',
  path: '/api/v1/buyer/award-recommendations/:recommendationId/decision',
  audience: 'buyer',
  permission: 'award.approve',
  params: RecommendationParams,
  body: DecideRecommendationBody,
  response: RecommendationDetail,
  errors: [
    'RECOMMENDATION_NOT_AWAITING_APPROVAL',
    'SELF_APPROVAL_BLOCKED',
    'AUTHORITY_EXCEEDED',
    'CONFLICT_UNRESOLVED',
    'DILIGENCE_BLOCKING',
  ],
  screens: ['BUY-26'],
  summary: 'Approve, approve with conditions, reject or return the pending recommendation step, with a rationale.',
});

export const finalAwardLotOutcome = defineEndpoint({
  id: 'buyer.awards.finalAward',
  method: 'POST',
  path: '/api/v1/buyer/lot-outcomes/:lotOutcomeId/final-award',
  audience: 'buyer',
  permission: ['award.recommend', 'award.approve'],
  params: LotOutcomeParams,
  body: FinalAwardBody,
  response: LotOutcome,
  errors: [
    'LOT_OUTCOME_NOT_AWARDABLE',
    'ALREADY_FINAL_AWARDED',
    'INTENT_NOT_NOTIFIED',
    'FINAL_AWARD_BLOCKED_BY_HOLD',
    'STANDSTILL_NOT_COMPLETE',
    'FINAL_AWARD_APPROVAL_MISSING',
    'AWARD_CONDITIONS_UNMET',
  ],
  screens: ['BUY-26', 'BUY-28'],
  summary: 'Records the final award of one lot outcome once every final-award gate passes.',
});

// ---------------------------------------------------------------------------------------------------------
// Buyer: outcome notices, standstill, public award notice (BUY-28)
// ---------------------------------------------------------------------------------------------------------

export const listOutcomeNotices = defineEndpoint({
  id: 'buyer.awards.listNotices',
  method: 'GET',
  path: '/api/v1/buyer/awards/:tenderId/notices',
  audience: 'buyer',
  permission: NOTICE_READ_PERMISSIONS,
  params: TenderParams,
  query: OutcomeNoticeListQuery,
  response: OutcomeNoticePage,
  errors: [],
  screens: ['BUY-28'],
});

export const getOutcomeNotice = defineEndpoint({
  id: 'buyer.awards.getNotice',
  method: 'GET',
  path: '/api/v1/buyer/outcome-notices/:noticeId',
  audience: 'buyer',
  permission: NOTICE_READ_PERMISSIONS,
  params: NoticeParams,
  response: OutcomeNoticeDetail,
  errors: [],
  screens: ['BUY-28'],
});

export const createOutcomeNotice = defineEndpoint({
  id: 'buyer.awards.createNotice',
  method: 'POST',
  path: '/api/v1/buyer/awards/:tenderId/notices',
  audience: 'buyer',
  permission: 'notice.issue',
  params: TenderParams,
  body: CreateOutcomeNoticeBody,
  response: OutcomeNoticeDetail,
  errors: [
    'LOT_NOT_IN_TENDER',
    'RECOMMENDATION_NOT_APPROVED',
    'INTENT_ALREADY_ISSUED',
    'FINAL_AWARD_BLOCKED_BY_HOLD',
    'STANDSTILL_NOT_COMPLETE',
    'STANDSTILL_NOT_ACTIVE',
  ],
  screens: ['BUY-28'],
  idempotent: true,
});

export const issueOutcomeNotice = defineEndpoint({
  id: 'buyer.awards.issueNotice',
  method: 'POST',
  path: '/api/v1/buyer/outcome-notices/:noticeId/issue',
  audience: 'buyer',
  permission: 'notice.issue',
  params: NoticeParams,
  body: IssueOutcomeNoticeBody,
  response: OutcomeNoticeDetail,
  errors: ['NOTICE_NOT_DRAFT', 'FINAL_AWARD_BLOCKED_BY_HOLD', 'STANDSTILL_NOT_COMPLETE'],
  screens: ['BUY-28'],
});

export const resendOutcomeNotice = defineEndpoint({
  id: 'buyer.awards.resendNotice',
  method: 'POST',
  path: '/api/v1/buyer/outcome-notices/:noticeId/recipients/:recipientId/resend',
  audience: 'buyer',
  permission: 'notice.issue',
  params: NoticeRecipientParams,
  response: ResendNoticeResult,
  errors: ['NOTICE_NOT_ISSUED', 'RECIPIENT_NOT_FAILED'],
  screens: ['BUY-28'],
  summary: 'Re-sends a failed delivery. A delivery failure never changes a deadline by itself (BR-42).',
});

export const getStandstill = defineEndpoint({
  id: 'buyer.awards.getStandstill',
  method: 'GET',
  path: '/api/v1/buyer/awards/:tenderId/standstill',
  audience: 'buyer',
  permission: NOTICE_READ_PERMISSIONS,
  params: TenderParams,
  response: StandstillOverview,
  errors: [],
  screens: ['BUY-28'],
});

export const extendStandstill = defineEndpoint({
  id: 'buyer.awards.extendStandstill',
  method: 'POST',
  path: '/api/v1/buyer/standstill-periods/:standstillId/extend',
  audience: 'buyer',
  permission: 'notice.issue',
  params: StandstillParams,
  body: ExtendStandstillBody,
  response: StandstillPeriod,
  errors: ['STANDSTILL_NOT_ACTIVE', 'EXTENSION_NOT_LATER'],
  screens: ['BUY-28'],
});

export const getPublicNotice = defineEndpoint({
  id: 'buyer.awards.getPublicNotice',
  method: 'GET',
  path: '/api/v1/buyer/awards/:tenderId/public-notice',
  audience: 'buyer',
  permission: NOTICE_READ_PERMISSIONS,
  params: TenderParams,
  response: PublicNoticeState,
  errors: [],
  screens: ['BUY-28'],
});

export const savePublicNotice = defineEndpoint({
  id: 'buyer.awards.savePublicNotice',
  method: 'PUT',
  path: '/api/v1/buyer/awards/:tenderId/public-notice',
  audience: 'buyer',
  permission: 'notice.issue',
  params: TenderParams,
  body: SavePublicNoticeBody,
  response: BuyerPublicAwardNotice,
  errors: ['PUBLIC_NOTICE_NOT_EDITABLE', 'NO_APPROVED_OUTCOME'],
  screens: ['BUY-28'],
  summary: 'Creates or edits the draft public award notice; an edit clears earlier reviews (BR-34).',
});

export const reviewPublicNotice = defineEndpoint({
  id: 'buyer.awards.reviewPublicNotice',
  method: 'POST',
  path: '/api/v1/buyer/public-award-notices/:publicNoticeId/review',
  audience: 'buyer',
  permission: 'notice.issue',
  params: PublicNoticeParams,
  body: ReviewPublicNoticeBody,
  response: BuyerPublicAwardNotice,
  errors: ['PUBLIC_NOTICE_NOT_EDITABLE', 'REVIEW_ALREADY_RECORDED'],
  screens: ['BUY-28'],
});

export const publishPublicNotice = defineEndpoint({
  id: 'buyer.awards.publishPublicNotice',
  method: 'POST',
  path: '/api/v1/buyer/public-award-notices/:publicNoticeId/publish',
  audience: 'buyer',
  permission: 'notice.issue',
  params: PublicNoticeParams,
  response: BuyerPublicAwardNotice,
  errors: ['PUBLIC_NOTICE_ALREADY_PUBLISHED', 'PUBLIC_NOTICE_REVIEW_INCOMPLETE', 'NO_FINAL_AWARD'],
  screens: ['BUY-28', 'PUB-05'],
});

// ---------------------------------------------------------------------------------------------------------
// Buyer: debriefs (BUY-29)
// ---------------------------------------------------------------------------------------------------------

export const listDebriefs = defineEndpoint({
  id: 'buyer.awards.listDebriefs',
  method: 'GET',
  path: '/api/v1/buyer/debriefs',
  audience: 'buyer',
  permission: CASE_READ_PERMISSIONS,
  query: DebriefListQuery,
  response: DebriefPage,
  errors: [],
  screens: ['BUY-29'],
});

export const getDebrief = defineEndpoint({
  id: 'buyer.awards.getDebrief',
  method: 'GET',
  path: '/api/v1/buyer/debriefs/:debriefId',
  audience: 'buyer',
  permission: CASE_READ_PERMISSIONS,
  params: DebriefParams,
  response: DebriefDetail,
  errors: [],
  screens: ['BUY-29'],
});

export const scheduleDebrief = defineEndpoint({
  id: 'buyer.awards.scheduleDebrief',
  method: 'POST',
  path: '/api/v1/buyer/debriefs/:debriefId/schedule',
  audience: 'buyer',
  permission: 'debrief.manage',
  params: DebriefParams,
  body: ScheduleDebriefBody,
  response: DebriefDetail,
  errors: ['DEBRIEF_NOT_OPEN', 'MEETING_AFTER_DUE_DATE'],
  screens: ['BUY-29'],
});

export const provideDebrief = defineEndpoint({
  id: 'buyer.awards.provideDebrief',
  method: 'POST',
  path: '/api/v1/buyer/debriefs/:debriefId/provide',
  audience: 'buyer',
  permission: 'debrief.manage',
  params: DebriefParams,
  body: ProvideDebriefBody,
  response: DebriefDetail,
  errors: ['DEBRIEF_NOT_OPEN'],
  screens: ['BUY-29'],
});

export const declineDebrief = defineEndpoint({
  id: 'buyer.awards.declineDebrief',
  method: 'POST',
  path: '/api/v1/buyer/debriefs/:debriefId/decline',
  audience: 'buyer',
  permission: 'debrief.manage',
  params: DebriefParams,
  body: DeclineDebriefBody,
  response: DebriefDetail,
  errors: ['DEBRIEF_NOT_OPEN'],
  screens: ['BUY-29'],
});

// ---------------------------------------------------------------------------------------------------------
// Buyer: complaints and holds (BUY-29)
// ---------------------------------------------------------------------------------------------------------

export const listComplaints = defineEndpoint({
  id: 'buyer.awards.listComplaints',
  method: 'GET',
  path: '/api/v1/buyer/complaints',
  audience: 'buyer',
  permission: CASE_READ_PERMISSIONS,
  query: ComplaintListQuery,
  response: ComplaintPage,
  errors: [],
  screens: ['BUY-29'],
});

export const getComplaint = defineEndpoint({
  id: 'buyer.awards.getComplaint',
  method: 'GET',
  path: '/api/v1/buyer/complaints/:complaintId',
  audience: 'buyer',
  permission: CASE_READ_PERMISSIONS,
  params: ComplaintParams,
  response: ComplaintDetail,
  errors: [],
  screens: ['BUY-29'],
});

export const listComplaintOwnerCandidates = defineEndpoint({
  id: 'buyer.awards.complaintOwnerCandidates',
  method: 'GET',
  path: '/api/v1/buyer/complaints/:complaintId/owner-candidates',
  audience: 'buyer',
  permission: 'complaint.manage',
  params: ComplaintParams,
  response: ComplaintOwnerCandidates,
  errors: [],
  screens: ['BUY-29'],
  summary: 'People who may own the case, each marked independent or not of the challenged conduct.',
});

export const acknowledgeComplaint = defineEndpoint({
  id: 'buyer.awards.acknowledgeComplaint',
  method: 'POST',
  path: '/api/v1/buyer/complaints/:complaintId/acknowledge',
  audience: 'buyer',
  permission: 'complaint.manage',
  params: ComplaintParams,
  body: AcknowledgeComplaintBody,
  response: ComplaintDetail,
  errors: ['INVALID_COMPLAINT_TRANSITION'],
  screens: ['BUY-29'],
});

export const assignComplaintOwner = defineEndpoint({
  id: 'buyer.awards.assignComplaintOwner',
  method: 'POST',
  path: '/api/v1/buyer/complaints/:complaintId/owner',
  audience: 'buyer',
  permission: 'complaint.manage',
  params: ComplaintParams,
  body: AssignComplaintOwnerBody,
  response: ComplaintDetail,
  errors: ['COMPLAINT_CLOSED', 'OWNER_NOT_INDEPENDENT', 'OWNER_LACKS_PERMISSION'],
  screens: ['BUY-29'],
});

export const transitionComplaint = defineEndpoint({
  id: 'buyer.awards.transitionComplaint',
  method: 'POST',
  path: '/api/v1/buyer/complaints/:complaintId/transition',
  audience: 'buyer',
  permission: 'complaint.manage',
  params: ComplaintParams,
  body: TransitionComplaintBody,
  response: ComplaintDetail,
  errors: ['INVALID_COMPLAINT_TRANSITION', 'INDEPENDENT_OWNER_REQUIRED', 'STANDING_NOT_ASSESSED', 'HOLD_STILL_ACTIVE'],
  screens: ['BUY-29'],
});

export const respondToComplaint = defineEndpoint({
  id: 'buyer.awards.respondToComplaint',
  method: 'POST',
  path: '/api/v1/buyer/complaints/:complaintId/response',
  audience: 'buyer',
  permission: 'complaint.manage',
  params: ComplaintParams,
  body: RespondComplaintBody,
  response: ComplaintDetail,
  errors: ['INVALID_COMPLAINT_TRANSITION', 'INDEPENDENT_OWNER_REQUIRED'],
  screens: ['BUY-29'],
});

export const recordComplaintAppealOutcome = defineEndpoint({
  id: 'buyer.awards.recordAppealOutcome',
  method: 'POST',
  path: '/api/v1/buyer/complaints/:complaintId/appeal-outcome',
  audience: 'buyer',
  permission: 'complaint.manage',
  params: ComplaintParams,
  body: RecordAppealOutcomeBody,
  response: ComplaintDetail,
  errors: ['INVALID_COMPLAINT_TRANSITION'],
  screens: ['BUY-29'],
});

export const placeComplaintHold = defineEndpoint({
  id: 'buyer.awards.placeHold',
  method: 'POST',
  path: '/api/v1/buyer/complaints/:complaintId/hold',
  audience: 'buyer',
  permission: 'complaint.manage',
  params: ComplaintParams,
  body: PlaceHoldBody,
  response: ComplaintDetail,
  errors: ['COMPLAINT_CLOSED', 'HOLD_ALREADY_ACTIVE'],
  screens: ['BUY-29'],
  summary: 'Places a complaint hold that blocks the listed actions. A hold never changes dates (BR-13).',
});

export const releaseComplaintHold = defineEndpoint({
  id: 'buyer.awards.releaseHold',
  method: 'POST',
  path: '/api/v1/buyer/complaints/:complaintId/hold/release',
  audience: 'buyer',
  permission: 'complaint.manage',
  params: ComplaintParams,
  body: ReleaseHoldBody,
  response: ComplaintDetail,
  errors: ['HOLD_NOT_ACTIVE', 'COMPLAINT_NOT_DECIDED'],
  screens: ['BUY-29'],
});

// ---------------------------------------------------------------------------------------------------------
// Buyer: event closeout (BUY-30)
// ---------------------------------------------------------------------------------------------------------

export const getCloseout = defineEndpoint({
  id: 'buyer.awards.getCloseout',
  method: 'GET',
  path: '/api/v1/buyer/awards/:tenderId/closeout',
  audience: 'buyer',
  permission: CLOSEOUT_READ_PERMISSIONS,
  params: TenderParams,
  response: CloseoutState,
  errors: [],
  screens: ['BUY-30'],
});

export const updateCloseout = defineEndpoint({
  id: 'buyer.awards.updateCloseout',
  method: 'PUT',
  path: '/api/v1/buyer/awards/:tenderId/closeout',
  audience: 'buyer',
  permission: 'event.closeout',
  params: TenderParams,
  body: UpdateCloseoutBody,
  response: CloseoutState,
  errors: ['CLOSEOUT_ALREADY_CLOSED', 'LINKED_TENDER_NOT_FOUND'],
  screens: ['BUY-30'],
});

export const closeEvent = defineEndpoint({
  id: 'buyer.awards.closeEvent',
  method: 'POST',
  path: '/api/v1/buyer/awards/:tenderId/closeout/close',
  audience: 'buyer',
  permission: 'event.closeout',
  params: TenderParams,
  body: CloseEventBody,
  response: CloseoutState,
  errors: ['CLOSEOUT_ALREADY_CLOSED', 'CLOSEOUT_BLOCKED', 'HANDOVER_NOT_ACCEPTED', 'RFI_FINDINGS_REQUIRED'],
  screens: ['BUY-30'],
  summary: 'Closes the event when the gate passes; an unaccepted handover keeps it blocked (AC-29).',
});

export const archiveEvent = defineEndpoint({
  id: 'buyer.awards.archiveEvent',
  method: 'POST',
  path: '/api/v1/buyer/awards/:tenderId/closeout/archive',
  audience: 'buyer',
  permission: 'event.closeout',
  params: TenderParams,
  body: ArchiveEventBody,
  response: CloseoutState,
  errors: ['CLOSEOUT_NOT_CLOSED', 'ALREADY_ARCHIVED', 'RETENTION_CLASS_REQUIRED'],
  screens: ['BUY-30'],
});

export const requestEvidencePack = defineEndpoint({
  id: 'buyer.awards.requestEvidencePack',
  method: 'POST',
  path: '/api/v1/buyer/awards/:tenderId/closeout/evidence-packs',
  audience: 'buyer',
  permission: 'export.create',
  params: TenderParams,
  body: RequestEvidencePackBody,
  response: EvidencePack,
  errors: [],
  screens: ['BUY-30'],
  idempotent: true,
});

// ---------------------------------------------------------------------------------------------------------
// Supplier: outcomes and debriefs (SUP-21)
// ---------------------------------------------------------------------------------------------------------

export const listSupplierOutcomes = defineEndpoint({
  id: 'supplier.outcomes.list',
  method: 'GET',
  path: '/api/v1/supplier/outcomes',
  audience: 'supplier',
  permission: 'supplier.outcomes.view',
  query: SupplierOutcomeListQuery,
  response: SupplierOutcomePage,
  errors: [],
  screens: ['SUP-21'],
});

export const getSupplierOutcome = defineEndpoint({
  id: 'supplier.outcomes.get',
  method: 'GET',
  path: '/api/v1/supplier/outcomes/:tenderId',
  audience: 'supplier',
  permission: 'supplier.outcomes.view',
  params: TenderParams,
  response: SupplierOutcomeDetail,
  errors: [],
  screens: ['SUP-21'],
});

export const acknowledgeOutcomeNotice = defineEndpoint({
  id: 'supplier.outcomes.acknowledgeNotice',
  method: 'POST',
  path: '/api/v1/supplier/outcome-notices/:noticeId/acknowledge',
  audience: 'supplier',
  permission: 'supplier.notices.acknowledge',
  params: NoticeParams,
  response: NoticeAcknowledgment,
  errors: ['ACKNOWLEDGMENT_NOT_REQUIRED', 'NOTICE_ALREADY_ACKNOWLEDGED'],
  screens: ['SUP-21'],
  summary: 'Acknowledges receipt; reading, acknowledging and accepting terms are distinct events (BR-41).',
});

export const acceptOutcomeNoticeTerms = defineEndpoint({
  id: 'supplier.outcomes.acceptTerms',
  method: 'POST',
  path: '/api/v1/supplier/outcome-notices/:noticeId/accept-terms',
  audience: 'supplier',
  // Accepting award terms commits the supplier (PRD §4.1): only the authorized signatory's submission authority
  // qualifies. `supplier.contract.participate` alone (for example supplier_finance) is not enough.
  permission: 'supplier.response.submit',
  params: NoticeParams,
  body: AcceptNoticeTermsBody,
  response: NoticeAcknowledgment,
  errors: ['NOTICE_HAS_NO_TERMS', 'TERMS_ALREADY_ACCEPTED', 'NOTICE_NOT_ACKNOWLEDGED'],
  screens: ['SUP-21'],
  summary:
    'Accepts the terms of an award notice on behalf of the supplier; requires the authorized signatory capability (supplier.response.submit).',
});

export const requestDebrief = defineEndpoint({
  id: 'supplier.outcomes.requestDebrief',
  method: 'POST',
  path: '/api/v1/supplier/outcomes/:tenderId/debrief-requests',
  audience: 'supplier',
  permission: 'supplier.outcomes.view',
  params: TenderParams,
  body: RequestDebriefBody,
  response: SupplierDebrief,
  errors: ['DEBRIEF_NOT_AVAILABLE', 'DEBRIEF_ALREADY_REQUESTED', 'DEBRIEF_WINDOW_CLOSED'],
  screens: ['SUP-21'],
  idempotent: true,
});

// ---------------------------------------------------------------------------------------------------------
// Supplier: complaints and appeals (SUP-22)
// ---------------------------------------------------------------------------------------------------------

export const listSupplierComplaints = defineEndpoint({
  id: 'supplier.complaints.list',
  method: 'GET',
  path: '/api/v1/supplier/complaints',
  audience: 'supplier',
  permission: ['supplier.complaint.submit', 'supplier.outcomes.view'],
  query: SupplierComplaintListQuery,
  response: SupplierComplaintPage,
  errors: [],
  screens: ['SUP-22'],
});

export const getSupplierComplaint = defineEndpoint({
  id: 'supplier.complaints.get',
  method: 'GET',
  path: '/api/v1/supplier/complaints/:complaintId',
  audience: 'supplier',
  permission: ['supplier.complaint.submit', 'supplier.outcomes.view'],
  params: ComplaintParams,
  response: SupplierComplaintDetail,
  errors: [],
  screens: ['SUP-22'],
});

export const listComplaintTenders = defineEndpoint({
  id: 'supplier.complaints.tenders',
  method: 'GET',
  path: '/api/v1/supplier/complaint-tenders',
  audience: 'supplier',
  permission: 'supplier.complaint.submit',
  response: ComplaintTenderOptions,
  errors: [],
  screens: ['SUP-22'],
  summary: 'The tenders the supplier may complain about, with their lots and the complaint deadline where one runs.',
});

export const createComplaint = defineEndpoint({
  id: 'supplier.complaints.create',
  method: 'POST',
  path: '/api/v1/supplier/complaints',
  audience: 'supplier',
  permission: 'supplier.complaint.submit',
  body: CreateComplaintBody,
  response: SupplierComplaintDetail,
  errors: ['TENDER_NOT_AVAILABLE', 'LOT_NOT_IN_TENDER', 'DUPLICATE_OPEN_COMPLAINT'],
  screens: ['SUP-22'],
  idempotent: true,
  summary: 'Files a complaint. A late filing is received and marked outside the window, not refused.',
});

export const appealComplaint = defineEndpoint({
  id: 'supplier.complaints.appeal',
  method: 'POST',
  path: '/api/v1/supplier/complaints/:complaintId/appeal',
  audience: 'supplier',
  permission: 'supplier.complaint.submit',
  params: ComplaintParams,
  body: AppealComplaintBody,
  response: SupplierComplaintDetail,
  errors: ['APPEAL_NOT_AVAILABLE', 'APPEAL_WINDOW_CLOSED'],
  screens: ['SUP-22'],
});

export const withdrawComplaint = defineEndpoint({
  id: 'supplier.complaints.withdraw',
  method: 'POST',
  path: '/api/v1/supplier/complaints/:complaintId/withdraw',
  audience: 'supplier',
  permission: 'supplier.complaint.submit',
  params: ComplaintParams,
  body: WithdrawComplaintBody,
  response: SupplierComplaintDetail,
  errors: ['COMPLAINT_ALREADY_CLOSED'],
  screens: ['SUP-22'],
});

// ---------------------------------------------------------------------------------------------------------
// Public: award search and detail (PUB-05)
// ---------------------------------------------------------------------------------------------------------

export const listPublicAwards = defineEndpoint({
  id: 'public.awards.list',
  method: 'GET',
  path: '/api/v1/public/awards',
  audience: 'public',
  query: PublicAwardListQuery,
  response: PublicAwardPage,
  errors: [],
  screens: ['PUB-05', 'PUB-01'],
});

export const getPublicAward = defineEndpoint({
  id: 'public.awards.get',
  method: 'GET',
  path: '/api/v1/public/awards/:buyerSlug/:reference',
  audience: 'public',
  params: PublicAwardParams,
  response: PublicAwardDetail,
  errors: [],
  screens: ['PUB-05'],
});

export const downloadPublicAwardNotice = defineEndpoint({
  id: 'public.awards.downloadNotice',
  method: 'GET',
  path: '/api/v1/public/awards/:buyerSlug/:reference/notice',
  audience: 'public',
  params: PublicAwardParams,
  response: PublicAwardNoticeFile,
  errors: [],
  screens: ['PUB-05'],
});

// ---------------------------------------------------------------------------------------------------------
// The domain map
// ---------------------------------------------------------------------------------------------------------

export const awardEndpoints = {
  listAwards,
  getAwardOverview,
  getRecommendation,
  createRecommendation,
  updateRecommendation,
  submitRecommendation,
  decideRecommendation,
  finalAwardLotOutcome,
  listOutcomeNotices,
  getOutcomeNotice,
  createOutcomeNotice,
  issueOutcomeNotice,
  resendOutcomeNotice,
  getStandstill,
  extendStandstill,
  getPublicNotice,
  savePublicNotice,
  reviewPublicNotice,
  publishPublicNotice,
  listDebriefs,
  getDebrief,
  scheduleDebrief,
  provideDebrief,
  declineDebrief,
  listComplaints,
  getComplaint,
  listComplaintOwnerCandidates,
  acknowledgeComplaint,
  assignComplaintOwner,
  transitionComplaint,
  respondToComplaint,
  recordComplaintAppealOutcome,
  placeComplaintHold,
  releaseComplaintHold,
  getCloseout,
  updateCloseout,
  closeEvent,
  archiveEvent,
  requestEvidencePack,
  listSupplierOutcomes,
  getSupplierOutcome,
  acknowledgeOutcomeNotice,
  acceptOutcomeNoticeTerms,
  requestDebrief,
  listSupplierComplaints,
  getSupplierComplaint,
  listComplaintTenders,
  createComplaint,
  appealComplaint,
  withdrawComplaint,
  listPublicAwards,
  getPublicAward,
  downloadPublicAwardNotice,
} as const;
