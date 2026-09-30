/**
 * Bids client (the `bids` contract; FR-11, FR-12): supplier response preparation, internal approval, submission,
 * receipts, revisions and withdrawal (SUP-12..SUP-17), and buyer submission monitoring and closing (BUY-19).
 * Pages use the hooks with the contract endpoints directly; these typed wrappers serve code outside hooks
 * (downloads, multi-step submission flows).
 */
import { bidEndpoints } from '@contracts/bids';
import type { EndpointRequest, EndpointResponse } from '@contracts/endpoint';

import { call } from './client';
import type { CallOptions } from './client';

type Endpoints = typeof bidEndpoints;
/** The request (`params`, `query`, `body`) of a bids endpoint. */
export type BidsRequest<K extends keyof Endpoints> = EndpointRequest<Endpoints[K]>;
/** The response of a bids endpoint. */
export type BidsResponse<K extends keyof Endpoints> = EndpointResponse<Endpoints[K]>;

function send<K extends keyof Endpoints>(
  key: K,
  request: BidsRequest<K>,
  options?: CallOptions,
): Promise<BidsResponse<K>> {
  return call(bidEndpoints[key], request, options);
}

// ---------------------------------------------------------------------------------------------------------
// Supplier: responses and workspace (SUP-12..SUP-17)
// ---------------------------------------------------------------------------------------------------------

/** GET /api/v1/supplier/bids (`supplier.bids.list`). */
export function listBids(
  request: BidsRequest<'listBids'>,
  options?: CallOptions,
): Promise<BidsResponse<'listBids'>> {
  return send('listBids', request, options);
}

/** GET /api/v1/supplier/bid-starts/:tenderId (`supplier.bids.startOptions`). */
export function getBidStartOptions(
  request: BidsRequest<'getBidStartOptions'>,
  options?: CallOptions,
): Promise<BidsResponse<'getBidStartOptions'>> {
  return send('getBidStartOptions', request, options);
}

/** POST /api/v1/supplier/bids (`supplier.bids.start`), idempotent. */
export function startBid(
  request: BidsRequest<'startBid'>,
  options?: CallOptions,
): Promise<BidsResponse<'startBid'>> {
  return send('startBid', request, options);
}

/** GET /api/v1/supplier/bids/:bidId (`supplier.bids.get`). */
export function getBid(
  request: BidsRequest<'getBid'>,
  options?: CallOptions,
): Promise<BidsResponse<'getBid'>> {
  return send('getBid', request, options);
}

/** PUT /api/v1/supplier/bids/:bidId/lots (`supplier.bids.updateLots`). */
export function updateBidLots(
  request: BidsRequest<'updateBidLots'>,
  options?: CallOptions,
): Promise<BidsResponse<'updateBidLots'>> {
  return send('updateBidLots', request, options);
}

/** GET /api/v1/supplier/bids/:bidId/answers (`supplier.bids.answers`). */
export function listAnswers(
  request: BidsRequest<'listAnswers'>,
  options?: CallOptions,
): Promise<BidsResponse<'listAnswers'>> {
  return send('listAnswers', request, options);
}

/** GET /api/v1/supplier/bids/:bidId/answers/:requirementId (`supplier.bids.getAnswer`). */
export function getAnswer(
  request: BidsRequest<'getAnswer'>,
  options?: CallOptions,
): Promise<BidsResponse<'getAnswer'>> {
  return send('getAnswer', request, options);
}

/** PUT /api/v1/supplier/bids/:bidId/answers/:requirementId (`supplier.bids.saveAnswer`). */
export function saveAnswer(
  request: BidsRequest<'saveAnswer'>,
  options?: CallOptions,
): Promise<BidsResponse<'saveAnswer'>> {
  return send('saveAnswer', request, options);
}

/** POST /api/v1/supplier/bids/:bidId/answers/:requirementId/assign (`supplier.bids.assignAnswer`). */
export function assignAnswer(
  request: BidsRequest<'assignAnswer'>,
  options?: CallOptions,
): Promise<BidsResponse<'assignAnswer'>> {
  return send('assignAnswer', request, options);
}

/** POST /api/v1/supplier/bids/:bidId/answers/:requirementId/comments (`supplier.bids.addComment`), idempotent. */
export function addAnswerComment(
  request: BidsRequest<'addAnswerComment'>,
  options?: CallOptions,
): Promise<BidsResponse<'addAnswerComment'>> {
  return send('addAnswerComment', request, options);
}

/** GET /api/v1/supplier/bids/:bidId/answers/:requirementId/reuse-candidates (`supplier.bids.reuseCandidates`). */
export function listReuseCandidates(
  request: BidsRequest<'listReuseCandidates'>,
  options?: CallOptions,
): Promise<BidsResponse<'listReuseCandidates'>> {
  return send('listReuseCandidates', request, options);
}

/** POST /api/v1/supplier/bids/:bidId/answers/:requirementId/reuse (`supplier.bids.reuseAnswer`). */
export function reuseAnswer(
  request: BidsRequest<'reuseAnswer'>,
  options?: CallOptions,
): Promise<BidsResponse<'reuseAnswer'>> {
  return send('reuseAnswer', request, options);
}

/** POST /api/v1/supplier/bids/:bidId/answers/:requirementId/documents (`supplier.bids.attachDocument`), idempotent. */
export function attachAnswerDocument(
  request: BidsRequest<'attachAnswerDocument'>,
  options?: CallOptions,
): Promise<BidsResponse<'attachAnswerDocument'>> {
  return send('attachAnswerDocument', request, options);
}

/** DELETE /api/v1/supplier/bids/:bidId/answers/:requirementId/documents/:attachmentId (`supplier.bids.detachDocument`). */
export function detachAnswerDocument(
  request: BidsRequest<'detachAnswerDocument'>,
  options?: CallOptions,
): Promise<BidsResponse<'detachAnswerDocument'>> {
  return send('detachAnswerDocument', request, options);
}

/** GET /api/v1/supplier/bids/:bidId/pricing (`supplier.bids.pricing`). */
export function getPricing(
  request: BidsRequest<'getPricing'>,
  options?: CallOptions,
): Promise<BidsResponse<'getPricing'>> {
  return send('getPricing', request, options);
}

/** PUT /api/v1/supplier/bids/:bidId/pricing (`supplier.bids.savePricing`). */
export function savePricing(
  request: BidsRequest<'savePricing'>,
  options?: CallOptions,
): Promise<BidsResponse<'savePricing'>> {
  return send('savePricing', request, options);
}

/** GET /api/v1/supplier/bids/:bidId/declarations (`supplier.bids.declarations`). */
export function getDeclarations(
  request: BidsRequest<'getDeclarations'>,
  options?: CallOptions,
): Promise<BidsResponse<'getDeclarations'>> {
  return send('getDeclarations', request, options);
}

/** PUT /api/v1/supplier/bids/:bidId/declarations (`supplier.bids.saveDeclarations`). */
export function saveDeclarations(
  request: BidsRequest<'saveDeclarations'>,
  options?: CallOptions,
): Promise<BidsResponse<'saveDeclarations'>> {
  return send('saveDeclarations', request, options);
}

/** PUT /api/v1/supplier/bids/:bidId/subcontractors (`supplier.bids.saveSubcontractors`). */
export function saveSubcontractors(
  request: BidsRequest<'saveSubcontractors'>,
  options?: CallOptions,
): Promise<BidsResponse<'saveSubcontractors'>> {
  return send('saveSubcontractors', request, options);
}

/** PUT /api/v1/supplier/bids/:bidId/key-personnel (`supplier.bids.saveKeyPersonnel`). */
export function saveKeyPersonnel(
  request: BidsRequest<'saveKeyPersonnel'>,
  options?: CallOptions,
): Promise<BidsResponse<'saveKeyPersonnel'>> {
  return send('saveKeyPersonnel', request, options);
}

/** PUT /api/v1/supplier/bids/:bidId/consortium (`supplier.bids.saveConsortium`). */
export function saveConsortium(
  request: BidsRequest<'saveConsortium'>,
  options?: CallOptions,
): Promise<BidsResponse<'saveConsortium'>> {
  return send('saveConsortium', request, options);
}

/** PUT /api/v1/supplier/bids/:bidId/exceptions (`supplier.bids.saveExceptions`). */
export function saveExceptions(
  request: BidsRequest<'saveExceptions'>,
  options?: CallOptions,
): Promise<BidsResponse<'saveExceptions'>> {
  return send('saveExceptions', request, options);
}

/** POST /api/v1/supplier/bids/:bidId/evidence (`supplier.bids.attachEvidence`), idempotent. */
export function attachEvidence(
  request: BidsRequest<'attachEvidence'>,
  options?: CallOptions,
): Promise<BidsResponse<'attachEvidence'>> {
  return send('attachEvidence', request, options);
}

/** DELETE /api/v1/supplier/bids/:bidId/evidence/:evidenceItemId (`supplier.bids.detachEvidence`). */
export function detachEvidence(
  request: BidsRequest<'detachEvidence'>,
  options?: CallOptions,
): Promise<BidsResponse<'detachEvidence'>> {
  return send('detachEvidence', request, options);
}

/** GET /api/v1/supplier/bids/:bidId/readiness (`supplier.bids.readiness`). */
export function getReadiness(
  request: BidsRequest<'getReadiness'>,
  options?: CallOptions,
): Promise<BidsResponse<'getReadiness'>> {
  return send('getReadiness', request, options);
}

/** GET /api/v1/supplier/bids/:bidId/revisions (`supplier.bids.revisions`). */
export function listRevisions(
  request: BidsRequest<'listRevisions'>,
  options?: CallOptions,
): Promise<BidsResponse<'listRevisions'>> {
  return send('listRevisions', request, options);
}

/** POST /api/v1/supplier/bids/:bidId/revisions (`supplier.bids.createRevision`), idempotent. */
export function createRevision(
  request: BidsRequest<'createRevision'>,
  options?: CallOptions,
): Promise<BidsResponse<'createRevision'>> {
  return send('createRevision', request, options);
}

/** GET /api/v1/supplier/bids/:bidId/review (`supplier.bids.review`). */
export function getInternalReview(
  request: BidsRequest<'getInternalReview'>,
  options?: CallOptions,
): Promise<BidsResponse<'getInternalReview'>> {
  return send('getInternalReview', request, options);
}

/** POST /api/v1/supplier/bids/:bidId/approvals (`supplier.bids.requestApproval`), idempotent. */
export function requestInternalApproval(
  request: BidsRequest<'requestInternalApproval'>,
  options?: CallOptions,
): Promise<BidsResponse<'requestInternalApproval'>> {
  return send('requestInternalApproval', request, options);
}

/** POST /api/v1/supplier/bids/:bidId/approvals/:approvalId/decide (`supplier.bids.decideApproval`). */
export function decideInternalApproval(
  request: BidsRequest<'decideInternalApproval'>,
  options?: CallOptions,
): Promise<BidsResponse<'decideInternalApproval'>> {
  return send('decideInternalApproval', request, options);
}

/** GET /api/v1/supplier/bids/:bidId/submission (`supplier.bids.submissionPreview`). */
export function getSubmissionPreview(
  request: BidsRequest<'getSubmissionPreview'>,
  options?: CallOptions,
): Promise<BidsResponse<'getSubmissionPreview'>> {
  return send('getSubmissionPreview', request, options);
}

/** POST /api/v1/supplier/bids/:bidId/submit (`supplier.bids.submit`), idempotent: returns the official receipt. */
export function submitBid(
  request: BidsRequest<'submitBid'>,
  options?: CallOptions,
): Promise<BidsResponse<'submitBid'>> {
  return send('submitBid', request, options);
}

/** GET /api/v1/supplier/bids/:bidId/receipts (`supplier.bids.receipts`). */
export function listBidReceipts(
  request: BidsRequest<'listBidReceipts'>,
  options?: CallOptions,
): Promise<BidsResponse<'listBidReceipts'>> {
  return send('listBidReceipts', request, options);
}

/** GET /api/v1/supplier/bids/:bidId/submission-attempts (`supplier.bids.attempts`). */
export function listSubmissionAttempts(
  request: BidsRequest<'listSubmissionAttempts'>,
  options?: CallOptions,
): Promise<BidsResponse<'listSubmissionAttempts'>> {
  return send('listSubmissionAttempts', request, options);
}

/** GET /api/v1/supplier/bids/:bidId/withdrawals (`supplier.bids.withdrawals`). */
export function listWithdrawals(
  request: BidsRequest<'listWithdrawals'>,
  options?: CallOptions,
): Promise<BidsResponse<'listWithdrawals'>> {
  return send('listWithdrawals', request, options);
}

/** POST /api/v1/supplier/bids/:bidId/withdraw (`supplier.bids.withdraw`), idempotent: returns the confirmation. */
export function withdrawBid(
  request: BidsRequest<'withdrawBid'>,
  options?: CallOptions,
): Promise<BidsResponse<'withdrawBid'>> {
  return send('withdrawBid', request, options);
}

/** GET /api/v1/supplier/receipts (`supplier.receipts.list`). */
export function listSupplierReceipts(
  request: BidsRequest<'listSupplierReceipts'>,
  options?: CallOptions,
): Promise<BidsResponse<'listSupplierReceipts'>> {
  return send('listSupplierReceipts', request, options);
}

/** GET /api/v1/supplier/receipts/:receiptId (`supplier.receipts.get`). */
export function getReceipt(
  request: BidsRequest<'getReceipt'>,
  options?: CallOptions,
): Promise<BidsResponse<'getReceipt'>> {
  return send('getReceipt', request, options);
}

/** GET /api/v1/supplier/receipts/:receiptId/download (`supplier.receipts.download`): the printable receipt. */
export function downloadReceipt(
  request: BidsRequest<'downloadReceipt'>,
  options?: CallOptions,
): Promise<BidsResponse<'downloadReceipt'>> {
  return send('downloadReceipt', request, options);
}

// ---------------------------------------------------------------------------------------------------------
// Buyer: submission monitoring and closing (BUY-19)
// ---------------------------------------------------------------------------------------------------------

/** GET /api/v1/buyer/submission-monitoring (`buyer.submissions.list`). */
export function listMonitoring(
  request: BidsRequest<'listMonitoring'>,
  options?: CallOptions,
): Promise<BidsResponse<'listMonitoring'>> {
  return send('listMonitoring', request, options);
}

/** GET /api/v1/buyer/submission-monitoring/tenders/:tenderId (`buyer.submissions.get`). */
export function getMonitoring(
  request: BidsRequest<'getMonitoring'>,
  options?: CallOptions,
): Promise<BidsResponse<'getMonitoring'>> {
  return send('getMonitoring', request, options);
}

/** GET /api/v1/buyer/submission-monitoring/tenders/:tenderId/receipts (`buyer.submissions.receipts`). */
export function listMonitoringReceipts(
  request: BidsRequest<'listMonitoringReceipts'>,
  options?: CallOptions,
): Promise<BidsResponse<'listMonitoringReceipts'>> {
  return send('listMonitoringReceipts', request, options);
}

/** POST /api/v1/buyer/submission-monitoring/tenders/:tenderId/close (`buyer.submissions.close`). */
export function closeTender(
  request: BidsRequest<'closeTender'>,
  options?: CallOptions,
): Promise<BidsResponse<'closeTender'>> {
  return send('closeTender', request, options);
}
