/**
 * Awards client (the `awards` contract; FR-17, BR-31..BR-35): award register and recommendations (BUY-26), outcome
 * notices, standstill and the public award notice (BUY-28), debriefs and complaints (BUY-29), event closeout
 * (BUY-30), supplier outcomes and complaints (SUP-21, SUP-22) and public awards (PUB-05). Pages use the hooks with
 * the contract endpoints directly; these typed wrappers serve code outside hooks.
 */
import { awardEndpoints } from '@contracts/awards';
import type { EndpointRequest, EndpointResponse } from '@contracts/endpoint';

import { call } from './client';
import type { CallOptions } from './client';

type Endpoints = typeof awardEndpoints;
/** The request (`params`, `query`, `body`) of an awards endpoint. */
export type AwardsRequest<K extends keyof Endpoints> = EndpointRequest<Endpoints[K]>;
/** The response of an awards endpoint. */
export type AwardsResponse<K extends keyof Endpoints> = EndpointResponse<Endpoints[K]>;

function send<K extends keyof Endpoints>(
  key: K,
  request: AwardsRequest<K>,
  options?: CallOptions,
): Promise<AwardsResponse<K>> {
  return call(awardEndpoints[key], request, options);
}

/** GET /api/v1/buyer/awards (`buyer.awards.list`). */
export function listAwards(
  request: AwardsRequest<'listAwards'>,
  options?: CallOptions,
): Promise<AwardsResponse<'listAwards'>> {
  return send('listAwards', request, options);
}
/** GET /api/v1/buyer/awards/:tenderId (`buyer.awards.get`). */
export function getAwardOverview(
  request: AwardsRequest<'getAwardOverview'>,
  options?: CallOptions,
): Promise<AwardsResponse<'getAwardOverview'>> {
  return send('getAwardOverview', request, options);
}
/** GET /api/v1/buyer/award-recommendations/:recommendationId (`buyer.awards.getRecommendation`). */
export function getRecommendation(
  request: AwardsRequest<'getRecommendation'>,
  options?: CallOptions,
): Promise<AwardsResponse<'getRecommendation'>> {
  return send('getRecommendation', request, options);
}
/** POST /api/v1/buyer/awards/:tenderId/recommendations (`buyer.awards.createRecommendation`). Idempotent: pass `options.idempotencyKey` to retry safely. */
export function createRecommendation(
  request: AwardsRequest<'createRecommendation'>,
  options?: CallOptions,
): Promise<AwardsResponse<'createRecommendation'>> {
  return send('createRecommendation', request, options);
}
/** PUT /api/v1/buyer/award-recommendations/:recommendationId (`buyer.awards.updateRecommendation`). */
export function updateRecommendation(
  request: AwardsRequest<'updateRecommendation'>,
  options?: CallOptions,
): Promise<AwardsResponse<'updateRecommendation'>> {
  return send('updateRecommendation', request, options);
}
/** POST /api/v1/buyer/award-recommendations/:recommendationId/submit (`buyer.awards.submitRecommendation`). */
export function submitRecommendation(
  request: AwardsRequest<'submitRecommendation'>,
  options?: CallOptions,
): Promise<AwardsResponse<'submitRecommendation'>> {
  return send('submitRecommendation', request, options);
}
/** POST /api/v1/buyer/award-recommendations/:recommendationId/decision (`buyer.awards.decideRecommendation`). */
export function decideRecommendation(
  request: AwardsRequest<'decideRecommendation'>,
  options?: CallOptions,
): Promise<AwardsResponse<'decideRecommendation'>> {
  return send('decideRecommendation', request, options);
}
/** POST /api/v1/buyer/lot-outcomes/:lotOutcomeId/final-award (`buyer.awards.finalAward`). */
export function finalAwardLotOutcome(
  request: AwardsRequest<'finalAwardLotOutcome'>,
  options?: CallOptions,
): Promise<AwardsResponse<'finalAwardLotOutcome'>> {
  return send('finalAwardLotOutcome', request, options);
}
/** GET /api/v1/buyer/awards/:tenderId/notices (`buyer.awards.listNotices`). */
export function listOutcomeNotices(
  request: AwardsRequest<'listOutcomeNotices'>,
  options?: CallOptions,
): Promise<AwardsResponse<'listOutcomeNotices'>> {
  return send('listOutcomeNotices', request, options);
}
/** GET /api/v1/buyer/outcome-notices/:noticeId (`buyer.awards.getNotice`). */
export function getOutcomeNotice(
  request: AwardsRequest<'getOutcomeNotice'>,
  options?: CallOptions,
): Promise<AwardsResponse<'getOutcomeNotice'>> {
  return send('getOutcomeNotice', request, options);
}
/** POST /api/v1/buyer/awards/:tenderId/notices (`buyer.awards.createNotice`). Idempotent: pass `options.idempotencyKey` to retry safely. */
export function createOutcomeNotice(
  request: AwardsRequest<'createOutcomeNotice'>,
  options?: CallOptions,
): Promise<AwardsResponse<'createOutcomeNotice'>> {
  return send('createOutcomeNotice', request, options);
}
/** POST /api/v1/buyer/outcome-notices/:noticeId/issue (`buyer.awards.issueNotice`). */
export function issueOutcomeNotice(
  request: AwardsRequest<'issueOutcomeNotice'>,
  options?: CallOptions,
): Promise<AwardsResponse<'issueOutcomeNotice'>> {
  return send('issueOutcomeNotice', request, options);
}
/** POST /api/v1/buyer/outcome-notices/:noticeId/recipients/:recipientId/resend (`buyer.awards.resendNotice`). */
export function resendOutcomeNotice(
  request: AwardsRequest<'resendOutcomeNotice'>,
  options?: CallOptions,
): Promise<AwardsResponse<'resendOutcomeNotice'>> {
  return send('resendOutcomeNotice', request, options);
}
/** GET /api/v1/buyer/awards/:tenderId/standstill (`buyer.awards.getStandstill`). */
export function getStandstill(
  request: AwardsRequest<'getStandstill'>,
  options?: CallOptions,
): Promise<AwardsResponse<'getStandstill'>> {
  return send('getStandstill', request, options);
}
/** POST /api/v1/buyer/standstill-periods/:standstillId/extend (`buyer.awards.extendStandstill`). */
export function extendStandstill(
  request: AwardsRequest<'extendStandstill'>,
  options?: CallOptions,
): Promise<AwardsResponse<'extendStandstill'>> {
  return send('extendStandstill', request, options);
}
/** GET /api/v1/buyer/awards/:tenderId/public-notice (`buyer.awards.getPublicNotice`). */
export function getPublicNotice(
  request: AwardsRequest<'getPublicNotice'>,
  options?: CallOptions,
): Promise<AwardsResponse<'getPublicNotice'>> {
  return send('getPublicNotice', request, options);
}
/** PUT /api/v1/buyer/awards/:tenderId/public-notice (`buyer.awards.savePublicNotice`). */
export function savePublicNotice(
  request: AwardsRequest<'savePublicNotice'>,
  options?: CallOptions,
): Promise<AwardsResponse<'savePublicNotice'>> {
  return send('savePublicNotice', request, options);
}
/** POST /api/v1/buyer/public-award-notices/:publicNoticeId/review (`buyer.awards.reviewPublicNotice`). */
export function reviewPublicNotice(
  request: AwardsRequest<'reviewPublicNotice'>,
  options?: CallOptions,
): Promise<AwardsResponse<'reviewPublicNotice'>> {
  return send('reviewPublicNotice', request, options);
}
/** POST /api/v1/buyer/public-award-notices/:publicNoticeId/publish (`buyer.awards.publishPublicNotice`). */
export function publishPublicNotice(
  request: AwardsRequest<'publishPublicNotice'>,
  options?: CallOptions,
): Promise<AwardsResponse<'publishPublicNotice'>> {
  return send('publishPublicNotice', request, options);
}
/** GET /api/v1/buyer/debriefs (`buyer.awards.listDebriefs`). */
export function listDebriefs(
  request: AwardsRequest<'listDebriefs'>,
  options?: CallOptions,
): Promise<AwardsResponse<'listDebriefs'>> {
  return send('listDebriefs', request, options);
}
/** GET /api/v1/buyer/debriefs/:debriefId (`buyer.awards.getDebrief`). */
export function getDebrief(
  request: AwardsRequest<'getDebrief'>,
  options?: CallOptions,
): Promise<AwardsResponse<'getDebrief'>> {
  return send('getDebrief', request, options);
}
/** POST /api/v1/buyer/debriefs/:debriefId/schedule (`buyer.awards.scheduleDebrief`). */
export function scheduleDebrief(
  request: AwardsRequest<'scheduleDebrief'>,
  options?: CallOptions,
): Promise<AwardsResponse<'scheduleDebrief'>> {
  return send('scheduleDebrief', request, options);
}
/** POST /api/v1/buyer/debriefs/:debriefId/provide (`buyer.awards.provideDebrief`). */
export function provideDebrief(
  request: AwardsRequest<'provideDebrief'>,
  options?: CallOptions,
): Promise<AwardsResponse<'provideDebrief'>> {
  return send('provideDebrief', request, options);
}
/** POST /api/v1/buyer/debriefs/:debriefId/decline (`buyer.awards.declineDebrief`). */
export function declineDebrief(
  request: AwardsRequest<'declineDebrief'>,
  options?: CallOptions,
): Promise<AwardsResponse<'declineDebrief'>> {
  return send('declineDebrief', request, options);
}
/** GET /api/v1/buyer/complaints (`buyer.awards.listComplaints`). */
export function listComplaints(
  request: AwardsRequest<'listComplaints'>,
  options?: CallOptions,
): Promise<AwardsResponse<'listComplaints'>> {
  return send('listComplaints', request, options);
}
/** GET /api/v1/buyer/complaints/:complaintId (`buyer.awards.getComplaint`). */
export function getComplaint(
  request: AwardsRequest<'getComplaint'>,
  options?: CallOptions,
): Promise<AwardsResponse<'getComplaint'>> {
  return send('getComplaint', request, options);
}
/** GET /api/v1/buyer/complaints/:complaintId/owner-candidates (`buyer.awards.complaintOwnerCandidates`). */
export function listComplaintOwnerCandidates(
  request: AwardsRequest<'listComplaintOwnerCandidates'>,
  options?: CallOptions,
): Promise<AwardsResponse<'listComplaintOwnerCandidates'>> {
  return send('listComplaintOwnerCandidates', request, options);
}
/** POST /api/v1/buyer/complaints/:complaintId/acknowledge (`buyer.awards.acknowledgeComplaint`). */
export function acknowledgeComplaint(
  request: AwardsRequest<'acknowledgeComplaint'>,
  options?: CallOptions,
): Promise<AwardsResponse<'acknowledgeComplaint'>> {
  return send('acknowledgeComplaint', request, options);
}
/** POST /api/v1/buyer/complaints/:complaintId/owner (`buyer.awards.assignComplaintOwner`). */
export function assignComplaintOwner(
  request: AwardsRequest<'assignComplaintOwner'>,
  options?: CallOptions,
): Promise<AwardsResponse<'assignComplaintOwner'>> {
  return send('assignComplaintOwner', request, options);
}
/** POST /api/v1/buyer/complaints/:complaintId/transition (`buyer.awards.transitionComplaint`). */
export function transitionComplaint(
  request: AwardsRequest<'transitionComplaint'>,
  options?: CallOptions,
): Promise<AwardsResponse<'transitionComplaint'>> {
  return send('transitionComplaint', request, options);
}
/** POST /api/v1/buyer/complaints/:complaintId/response (`buyer.awards.respondToComplaint`). */
export function respondToComplaint(
  request: AwardsRequest<'respondToComplaint'>,
  options?: CallOptions,
): Promise<AwardsResponse<'respondToComplaint'>> {
  return send('respondToComplaint', request, options);
}
/** POST /api/v1/buyer/complaints/:complaintId/appeal-outcome (`buyer.awards.recordAppealOutcome`). */
export function recordComplaintAppealOutcome(
  request: AwardsRequest<'recordComplaintAppealOutcome'>,
  options?: CallOptions,
): Promise<AwardsResponse<'recordComplaintAppealOutcome'>> {
  return send('recordComplaintAppealOutcome', request, options);
}
/** POST /api/v1/buyer/complaints/:complaintId/hold (`buyer.awards.placeHold`). */
export function placeComplaintHold(
  request: AwardsRequest<'placeComplaintHold'>,
  options?: CallOptions,
): Promise<AwardsResponse<'placeComplaintHold'>> {
  return send('placeComplaintHold', request, options);
}
/** POST /api/v1/buyer/complaints/:complaintId/hold/release (`buyer.awards.releaseHold`). */
export function releaseComplaintHold(
  request: AwardsRequest<'releaseComplaintHold'>,
  options?: CallOptions,
): Promise<AwardsResponse<'releaseComplaintHold'>> {
  return send('releaseComplaintHold', request, options);
}
/** GET /api/v1/buyer/awards/:tenderId/closeout (`buyer.awards.getCloseout`). */
export function getCloseout(
  request: AwardsRequest<'getCloseout'>,
  options?: CallOptions,
): Promise<AwardsResponse<'getCloseout'>> {
  return send('getCloseout', request, options);
}
/** PUT /api/v1/buyer/awards/:tenderId/closeout (`buyer.awards.updateCloseout`). */
export function updateCloseout(
  request: AwardsRequest<'updateCloseout'>,
  options?: CallOptions,
): Promise<AwardsResponse<'updateCloseout'>> {
  return send('updateCloseout', request, options);
}
/** POST /api/v1/buyer/awards/:tenderId/closeout/close (`buyer.awards.closeEvent`). */
export function closeEvent(
  request: AwardsRequest<'closeEvent'>,
  options?: CallOptions,
): Promise<AwardsResponse<'closeEvent'>> {
  return send('closeEvent', request, options);
}
/** POST /api/v1/buyer/awards/:tenderId/closeout/archive (`buyer.awards.archiveEvent`). */
export function archiveEvent(
  request: AwardsRequest<'archiveEvent'>,
  options?: CallOptions,
): Promise<AwardsResponse<'archiveEvent'>> {
  return send('archiveEvent', request, options);
}
/** POST /api/v1/buyer/awards/:tenderId/closeout/evidence-packs (`buyer.awards.requestEvidencePack`). Idempotent: pass `options.idempotencyKey` to retry safely. */
export function requestEvidencePack(
  request: AwardsRequest<'requestEvidencePack'>,
  options?: CallOptions,
): Promise<AwardsResponse<'requestEvidencePack'>> {
  return send('requestEvidencePack', request, options);
}
/** GET /api/v1/supplier/outcomes (`supplier.outcomes.list`). */
export function listSupplierOutcomes(
  request: AwardsRequest<'listSupplierOutcomes'>,
  options?: CallOptions,
): Promise<AwardsResponse<'listSupplierOutcomes'>> {
  return send('listSupplierOutcomes', request, options);
}
/** GET /api/v1/supplier/outcomes/:tenderId (`supplier.outcomes.get`). */
export function getSupplierOutcome(
  request: AwardsRequest<'getSupplierOutcome'>,
  options?: CallOptions,
): Promise<AwardsResponse<'getSupplierOutcome'>> {
  return send('getSupplierOutcome', request, options);
}
/** POST /api/v1/supplier/outcome-notices/:noticeId/acknowledge (`supplier.outcomes.acknowledgeNotice`). */
export function acknowledgeOutcomeNotice(
  request: AwardsRequest<'acknowledgeOutcomeNotice'>,
  options?: CallOptions,
): Promise<AwardsResponse<'acknowledgeOutcomeNotice'>> {
  return send('acknowledgeOutcomeNotice', request, options);
}
/** POST /api/v1/supplier/outcome-notices/:noticeId/accept-terms (`supplier.outcomes.acceptTerms`). */
export function acceptOutcomeNoticeTerms(
  request: AwardsRequest<'acceptOutcomeNoticeTerms'>,
  options?: CallOptions,
): Promise<AwardsResponse<'acceptOutcomeNoticeTerms'>> {
  return send('acceptOutcomeNoticeTerms', request, options);
}
/** POST /api/v1/supplier/outcomes/:tenderId/debrief-requests (`supplier.outcomes.requestDebrief`). Idempotent: pass `options.idempotencyKey` to retry safely. */
export function requestDebrief(
  request: AwardsRequest<'requestDebrief'>,
  options?: CallOptions,
): Promise<AwardsResponse<'requestDebrief'>> {
  return send('requestDebrief', request, options);
}
/** GET /api/v1/supplier/complaints (`supplier.complaints.list`). */
export function listSupplierComplaints(
  request: AwardsRequest<'listSupplierComplaints'>,
  options?: CallOptions,
): Promise<AwardsResponse<'listSupplierComplaints'>> {
  return send('listSupplierComplaints', request, options);
}
/** GET /api/v1/supplier/complaints/:complaintId (`supplier.complaints.get`). */
export function getSupplierComplaint(
  request: AwardsRequest<'getSupplierComplaint'>,
  options?: CallOptions,
): Promise<AwardsResponse<'getSupplierComplaint'>> {
  return send('getSupplierComplaint', request, options);
}
/** GET /api/v1/supplier/complaint-tenders (`supplier.complaints.tenders`). */
export function listComplaintTenders(
  request: AwardsRequest<'listComplaintTenders'>,
  options?: CallOptions,
): Promise<AwardsResponse<'listComplaintTenders'>> {
  return send('listComplaintTenders', request, options);
}
/** POST /api/v1/supplier/complaints (`supplier.complaints.create`). Idempotent: pass `options.idempotencyKey` to retry safely. */
export function createComplaint(
  request: AwardsRequest<'createComplaint'>,
  options?: CallOptions,
): Promise<AwardsResponse<'createComplaint'>> {
  return send('createComplaint', request, options);
}
/** POST /api/v1/supplier/complaints/:complaintId/appeal (`supplier.complaints.appeal`). */
export function appealComplaint(
  request: AwardsRequest<'appealComplaint'>,
  options?: CallOptions,
): Promise<AwardsResponse<'appealComplaint'>> {
  return send('appealComplaint', request, options);
}
/** POST /api/v1/supplier/complaints/:complaintId/withdraw (`supplier.complaints.withdraw`). */
export function withdrawComplaint(
  request: AwardsRequest<'withdrawComplaint'>,
  options?: CallOptions,
): Promise<AwardsResponse<'withdrawComplaint'>> {
  return send('withdrawComplaint', request, options);
}
/** GET /api/v1/public/awards (`public.awards.list`). */
export function listPublicAwards(
  request: AwardsRequest<'listPublicAwards'>,
  options?: CallOptions,
): Promise<AwardsResponse<'listPublicAwards'>> {
  return send('listPublicAwards', request, options);
}
/** GET /api/v1/public/awards/:buyerSlug/:reference (`public.awards.get`). */
export function getPublicAward(
  request: AwardsRequest<'getPublicAward'>,
  options?: CallOptions,
): Promise<AwardsResponse<'getPublicAward'>> {
  return send('getPublicAward', request, options);
}
/** GET /api/v1/public/awards/:buyerSlug/:reference/notice (`public.awards.downloadNotice`). */
export function downloadPublicAwardNotice(
  request: AwardsRequest<'downloadPublicAwardNotice'>,
  options?: CallOptions,
): Promise<AwardsResponse<'downloadPublicAwardNotice'>> {
  return send('downloadPublicAwardNotice', request, options);
}
