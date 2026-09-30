/**
 * Opening client (the `opening` contract; FR-13): opening sessions (BUY-20), compliance review and exclusions
 * (BUY-21), clarification coordination (EVA-03) and supplier assessment requests (SUP-18). Pages use the hooks with the
 * contract endpoints directly; these typed wrappers serve code outside hooks.
 */
import { openingEndpoints } from '@contracts/opening';
import type { EndpointRequest, EndpointResponse } from '@contracts/endpoint';

import { call } from './client';
import type { CallOptions } from './client';

type Endpoints = typeof openingEndpoints;
/** The request (`params`, `query`, `body`) of an opening endpoint. */
export type OpeningRequest<K extends keyof Endpoints> = EndpointRequest<Endpoints[K]>;
/** The response of an opening endpoint. */
export type OpeningResponse<K extends keyof Endpoints> = EndpointResponse<Endpoints[K]>;

function send<K extends keyof Endpoints>(
  key: K,
  request: OpeningRequest<K>,
  options?: CallOptions,
): Promise<OpeningResponse<K>> {
  return call(openingEndpoints[key], request, options);
}

/** GET /api/v1/buyer/opening/tenders (`buyer.opening.listTenders`): Tenders approaching or in opening (BUY-20). */
export function listTenders(
  request: OpeningRequest<'listTenders'>,
  options?: CallOptions,
): Promise<OpeningResponse<'listTenders'>> {
  return send('listTenders', request, options);
}

/** GET /api/v1/buyer/opening/tenders/:tenderId (`buyer.opening.getTender`): The opening plan of a tender (BUY-20). */
export function getTender(
  request: OpeningRequest<'getTender'>,
  options?: CallOptions,
): Promise<OpeningResponse<'getTender'>> {
  return send('getTender', request, options);
}

/** GET /api/v1/buyer/opening/tenders/:tenderId/opening-team (`buyer.opening.getOpeningTeam`): People who may take part in an opening (BUY-20). */
export function getOpeningTeam(
  request: OpeningRequest<'getOpeningTeam'>,
  options?: CallOptions,
): Promise<OpeningResponse<'getOpeningTeam'>> {
  return send('getOpeningTeam', request, options);
}

/** GET /api/v1/buyer/opening/sessions (`buyer.opening.listSessions`): Opening sessions (BUY-20). */
export function listSessions(
  request: OpeningRequest<'listSessions'>,
  options?: CallOptions,
): Promise<OpeningResponse<'listSessions'>> {
  return send('listSessions', request, options);
}

/** GET /api/v1/buyer/opening/sessions/:sessionId (`buyer.opening.getSession`): One opening session with its participants, bids and unseal records (BUY-20). */
export function getSession(
  request: OpeningRequest<'getSession'>,
  options?: CallOptions,
): Promise<OpeningResponse<'getSession'>> {
  return send('getSession', request, options);
}

/** POST /api/v1/buyer/opening/sessions (`buyer.opening.scheduleSession`): Schedules an opening stage (idempotent). */
export function scheduleSession(
  request: OpeningRequest<'scheduleSession'>,
  options?: CallOptions,
): Promise<OpeningResponse<'scheduleSession'>> {
  return send('scheduleSession', request, options);
}

/** POST /api/v1/buyer/opening/sessions/:sessionId/participants/:participantId/confirm (`buyer.opening.confirmParticipant`): Confirms the caller’s presence at an opening. */
export function confirmParticipant(
  request: OpeningRequest<'confirmParticipant'>,
  options?: CallOptions,
): Promise<OpeningResponse<'confirmParticipant'>> {
  return send('confirmParticipant', request, options);
}

/** POST /api/v1/buyer/opening/sessions/:sessionId/open (`buyer.opening.openSession`): Opens the eligible envelopes of a session. */
export function openSession(
  request: OpeningRequest<'openSession'>,
  options?: CallOptions,
): Promise<OpeningResponse<'openSession'>> {
  return send('openSession', request, options);
}

/** PUT /api/v1/buyer/opening/sessions/:sessionId/record (`buyer.opening.recordSession`): Records the minutes and irregularities of a completed session. */
export function recordSession(
  request: OpeningRequest<'recordSession'>,
  options?: CallOptions,
): Promise<OpeningResponse<'recordSession'>> {
  return send('recordSession', request, options);
}

/** POST /api/v1/buyer/opening/sessions/:sessionId/public-summary (`buyer.opening.releasePublicSummary`): Issues the permitted public opening information. */
export function releasePublicSummary(
  request: OpeningRequest<'releasePublicSummary'>,
  options?: CallOptions,
): Promise<OpeningResponse<'releasePublicSummary'>> {
  return send('releasePublicSummary', request, options);
}

/** POST /api/v1/buyer/opening/sessions/:sessionId/abort (`buyer.opening.abortSession`): Aborts an opening that has not happened. */
export function abortSession(
  request: OpeningRequest<'abortSession'>,
  options?: CallOptions,
): Promise<OpeningResponse<'abortSession'>> {
  return send('abortSession', request, options);
}

/** GET /api/v1/buyer/opening/tenders/:tenderId/bids (`buyer.opening.listBids`): The compliance register of a tender (BUY-21). */
export function listBids(
  request: OpeningRequest<'listBids'>,
  options?: CallOptions,
): Promise<OpeningResponse<'listBids'>> {
  return send('listBids', request, options);
}

/** GET /api/v1/buyer/opening/bids/:bidId/compliance (`buyer.opening.getBidCompliance`): The compliance review of one bid (BUY-21). */
export function getBidCompliance(
  request: OpeningRequest<'getBidCompliance'>,
  options?: CallOptions,
): Promise<OpeningResponse<'getBidCompliance'>> {
  return send('getBidCompliance', request, options);
}

/** PUT /api/v1/buyer/opening/checks/:checkId (`buyer.opening.recordCheck`): Records a compliance finding. */
export function recordCheck(
  request: OpeningRequest<'recordCheck'>,
  options?: CallOptions,
): Promise<OpeningResponse<'recordCheck'>> {
  return send('recordCheck', request, options);
}

/** POST /api/v1/buyer/opening/bids/:bidId/compliance-decision (`buyer.opening.decideCompliance`): Concludes the compliance review of a bid. */
export function decideCompliance(
  request: OpeningRequest<'decideCompliance'>,
  options?: CallOptions,
): Promise<OpeningResponse<'decideCompliance'>> {
  return send('decideCompliance', request, options);
}

/** GET /api/v1/buyer/opening/clarifications (`buyer.opening.listClarifications`): Bid clarifications (BUY-21, EVA-03). */
export function listClarifications(
  request: OpeningRequest<'listClarifications'>,
  options?: CallOptions,
): Promise<OpeningResponse<'listClarifications'>> {
  return send('listClarifications', request, options);
}

/** GET /api/v1/buyer/opening/clarifications/:clarificationId (`buyer.opening.getClarification`): One bid clarification (BUY-21, EVA-03). */
export function getClarification(
  request: OpeningRequest<'getClarification'>,
  options?: CallOptions,
): Promise<OpeningResponse<'getClarification'>> {
  return send('getClarification', request, options);
}

/** POST /api/v1/buyer/opening/clarifications (`buyer.opening.raiseClarification`): Drafts a clarification question (idempotent). */
export function raiseClarification(
  request: OpeningRequest<'raiseClarification'>,
  options?: CallOptions,
): Promise<OpeningResponse<'raiseClarification'>> {
  return send('raiseClarification', request, options);
}

/** POST /api/v1/buyer/opening/clarifications/:clarificationId/consolidate (`buyer.opening.consolidateClarifications`): Merges duplicate assessor questions (EVA-03). */
export function consolidateClarifications(
  request: OpeningRequest<'consolidateClarifications'>,
  options?: CallOptions,
): Promise<OpeningResponse<'consolidateClarifications'>> {
  return send('consolidateClarifications', request, options);
}

/** POST /api/v1/buyer/opening/clarifications/:clarificationId/approve (`buyer.opening.approveClarification`): Approves a draft question. */
export function approveClarification(
  request: OpeningRequest<'approveClarification'>,
  options?: CallOptions,
): Promise<OpeningResponse<'approveClarification'>> {
  return send('approveClarification', request, options);
}

/** POST /api/v1/buyer/opening/clarifications/:clarificationId/issue (`buyer.opening.issueClarification`): Issues an approved question to the supplier. */
export function issueClarification(
  request: OpeningRequest<'issueClarification'>,
  options?: CallOptions,
): Promise<OpeningResponse<'issueClarification'>> {
  return send('issueClarification', request, options);
}

/** POST /api/v1/buyer/opening/clarifications/:clarificationId/effect (`buyer.opening.recordClarificationEffect`): Records the effect of an answer and distributes it. */
export function recordClarificationEffect(
  request: OpeningRequest<'recordClarificationEffect'>,
  options?: CallOptions,
): Promise<OpeningResponse<'recordClarificationEffect'>> {
  return send('recordClarificationEffect', request, options);
}

/** GET /api/v1/buyer/opening/exclusions (`buyer.opening.listExclusions`): Exclusions (BUY-21). */
export function listExclusions(
  request: OpeningRequest<'listExclusions'>,
  options?: CallOptions,
): Promise<OpeningResponse<'listExclusions'>> {
  return send('listExclusions', request, options);
}

/** GET /api/v1/buyer/opening/exclusions/:exclusionId (`buyer.opening.getExclusion`): One exclusion with its cited checks and approval (BUY-21). */
export function getExclusion(
  request: OpeningRequest<'getExclusion'>,
  options?: CallOptions,
): Promise<OpeningResponse<'getExclusion'>> {
  return send('getExclusion', request, options);
}

/** POST /api/v1/buyer/opening/exclusions (`buyer.opening.proposeExclusion`): Proposes an exclusion (idempotent). */
export function proposeExclusion(
  request: OpeningRequest<'proposeExclusion'>,
  options?: CallOptions,
): Promise<OpeningResponse<'proposeExclusion'>> {
  return send('proposeExclusion', request, options);
}

/** POST /api/v1/buyer/opening/exclusions/:exclusionId/withdraw (`buyer.opening.withdrawExclusion`): Withdraws a pending exclusion. */
export function withdrawExclusion(
  request: OpeningRequest<'withdrawExclusion'>,
  options?: CallOptions,
): Promise<OpeningResponse<'withdrawExclusion'>> {
  return send('withdrawExclusion', request, options);
}

/** POST /api/v1/buyer/opening/exclusions/:exclusionId/notice (`buyer.opening.issueExclusionNotice`): Issues the formal exclusion notice. */
export function issueExclusionNotice(
  request: OpeningRequest<'issueExclusionNotice'>,
  options?: CallOptions,
): Promise<OpeningResponse<'issueExclusionNotice'>> {
  return send('issueExclusionNotice', request, options);
}

/** GET /api/v1/supplier/assessment-requests (`supplier.opening.listAssessmentRequests`): The supplier’s own assessment requests (SUP-18). */
export function listAssessmentRequests(
  request: OpeningRequest<'listAssessmentRequests'>,
  options?: CallOptions,
): Promise<OpeningResponse<'listAssessmentRequests'>> {
  return send('listAssessmentRequests', request, options);
}

/** GET /api/v1/supplier/assessment-requests/:requestId (`supplier.opening.getAssessmentRequest`): One assessment request (SUP-18). */
export function getAssessmentRequest(
  request: OpeningRequest<'getAssessmentRequest'>,
  options?: CallOptions,
): Promise<OpeningResponse<'getAssessmentRequest'>> {
  return send('getAssessmentRequest', request, options);
}

/** POST /api/v1/supplier/assessment-requests/:requestId/response (`supplier.opening.respondAssessmentRequest`): Responds within the permitted scope (SUP-18). */
export function respondAssessmentRequest(
  request: OpeningRequest<'respondAssessmentRequest'>,
  options?: CallOptions,
): Promise<OpeningResponse<'respondAssessmentRequest'>> {
  return send('respondAssessmentRequest', request, options);
}
