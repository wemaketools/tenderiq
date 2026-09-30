/**
 * Selection client (the `selection` contract; FR-15, FR-16, BR-30, BR-31): assessment sessions and reference checks
 * (BUY-22), shortlists (BUY-23), preferred bidders (BUY-24), due diligence (BUY-25), negotiation and final-offer rounds
 * (BUY-27), supplier assessment invitations (SUP-18) and the supplier's own negotiation (SUP-19). Pages use the hooks
 * with the contract endpoints directly; these typed wrappers serve code outside hooks.
 */
import { selectionEndpoints } from '@contracts/selection';
import type { EndpointRequest, EndpointResponse } from '@contracts/endpoint';

import { call } from './client';
import type { CallOptions } from './client';

type Endpoints = typeof selectionEndpoints;
/** The request (`params`, `query`, `body`) of a selection endpoint. */
export type SelectionRequest<K extends keyof Endpoints> = EndpointRequest<Endpoints[K]>;
/** The response of a selection endpoint. */
export type SelectionResponse<K extends keyof Endpoints> = EndpointResponse<Endpoints[K]>;

function send<K extends keyof Endpoints>(
  key: K,
  request: SelectionRequest<K>,
  options?: CallOptions,
): Promise<SelectionResponse<K>> {
  return call(selectionEndpoints[key], request, options);
}

/** GET /api/v1/buyer/selection/tenders (`buyer.selection.tenders`): Tenders in the selection stage with their shortlist, preferred-bidder, diligence and negotiation status (BUY-22, BUY-23, BUY-24, BUY-25, BUY-27). */
export function listTenders(
  request: SelectionRequest<'listTenders'>,
  options?: CallOptions,
): Promise<SelectionResponse<'listTenders'>> {
  return send('listTenders', request, options);
}

/** GET /api/v1/buyer/selection/tenders/:tenderId (`buyer.selection.tender`): Candidates, team, criteria, issued conditions and the negotiation, final-offer and award gates of one tender (BUY-22, BUY-23, BUY-24, BUY-25, BUY-27). */
export function getTender(
  request: SelectionRequest<'getTender'>,
  options?: CallOptions,
): Promise<SelectionResponse<'getTender'>> {
  return send('getTender', request, options);
}

/** GET /api/v1/buyer/selection/assessment-sessions (`buyer.selection.sessions.list`): List sessions (BUY-22). */
export function listSessions(
  request: SelectionRequest<'listSessions'>,
  options?: CallOptions,
): Promise<SelectionResponse<'listSessions'>> {
  return send('listSessions', request, options);
}

/** GET /api/v1/buyer/selection/assessment-sessions/:sessionId (`buyer.selection.sessions.get`): Get session (BUY-22). */
export function getSession(
  request: SelectionRequest<'getSession'>,
  options?: CallOptions,
): Promise<SelectionResponse<'getSession'>> {
  return send('getSession', request, options);
}

/** POST /api/v1/buyer/selection/assessment-sessions (`buyer.selection.sessions.create`): Plans a demonstration, interview, presentation, sample, site inspection or reference check with its declared basis (BUY-22). */
export function createSession(
  request: SelectionRequest<'createSession'>,
  options?: CallOptions,
): Promise<SelectionResponse<'createSession'>> {
  return send('createSession', request, options);
}

/** POST /api/v1/buyer/selection/assessment-sessions/:sessionId/equal-treatment (`buyer.selection.sessions.confirmEqualTreatment`): Confirm equal treatment (BUY-22). */
export function confirmEqualTreatment(
  request: SelectionRequest<'confirmEqualTreatment'>,
  options?: CallOptions,
): Promise<SelectionResponse<'confirmEqualTreatment'>> {
  return send('confirmEqualTreatment', request, options);
}

/** POST /api/v1/buyer/selection/assessment-sessions/:sessionId/invites (`buyer.selection.sessions.issueInvites`): Invites candidates with comparable instructions and at least the declared preparation time (BUY-22). */
export function issueInvites(
  request: SelectionRequest<'issueInvites'>,
  options?: CallOptions,
): Promise<SelectionResponse<'issueInvites'>> {
  return send('issueInvites', request, options);
}

/** POST /api/v1/buyer/selection/assessment-sessions/:sessionId/findings (`buyer.selection.sessions.recordFinding`): Records a finding whose effect must follow the announced assessment basis (AC-21) (BUY-22). */
export function recordFinding(
  request: SelectionRequest<'recordFinding'>,
  options?: CallOptions,
): Promise<SelectionResponse<'recordFinding'>> {
  return send('recordFinding', request, options);
}

/** POST /api/v1/buyer/selection/assessment-sessions/:sessionId/complete (`buyer.selection.sessions.complete`): Complete session (BUY-22). */
export function completeSession(
  request: SelectionRequest<'completeSession'>,
  options?: CallOptions,
): Promise<SelectionResponse<'completeSession'>> {
  return send('completeSession', request, options);
}

/** POST /api/v1/buyer/selection/assessment-sessions/:sessionId/cancel (`buyer.selection.sessions.cancel`): Cancel session (BUY-22). */
export function cancelSession(
  request: SelectionRequest<'cancelSession'>,
  options?: CallOptions,
): Promise<SelectionResponse<'cancelSession'>> {
  return send('cancelSession', request, options);
}

/** GET /api/v1/buyer/selection/reference-checks (`buyer.selection.references.list`): List reference checks (BUY-22). */
export function listReferenceChecks(
  request: SelectionRequest<'listReferenceChecks'>,
  options?: CallOptions,
): Promise<SelectionResponse<'listReferenceChecks'>> {
  return send('listReferenceChecks', request, options);
}

/** POST /api/v1/buyer/selection/reference-checks (`buyer.selection.references.create`): Create reference check (BUY-22). */
export function createReferenceCheck(
  request: SelectionRequest<'createReferenceCheck'>,
  options?: CallOptions,
): Promise<SelectionResponse<'createReferenceCheck'>> {
  return send('createReferenceCheck', request, options);
}

/** POST /api/v1/buyer/selection/reference-checks/:referenceCheckId/feedback (`buyer.selection.references.recordFeedback`): Records referee feedback; refused without the referee’s consent (BUY-22). */
export function recordReferenceFeedback(
  request: SelectionRequest<'recordReferenceFeedback'>,
  options?: CallOptions,
): Promise<SelectionResponse<'recordReferenceFeedback'>> {
  return send('recordReferenceFeedback', request, options);
}

/** GET /api/v1/buyer/selection/shortlists (`buyer.selection.shortlists.list`): List shortlists (BUY-23). */
export function listShortlists(
  request: SelectionRequest<'listShortlists'>,
  options?: CallOptions,
): Promise<SelectionResponse<'listShortlists'>> {
  return send('listShortlists', request, options);
}

/** GET /api/v1/buyer/selection/shortlists/:shortlistId (`buyer.selection.shortlists.get`): Get shortlist (BUY-23). */
export function getShortlist(
  request: SelectionRequest<'getShortlist'>,
  options?: CallOptions,
): Promise<SelectionResponse<'getShortlist'>> {
  return send('getShortlist', request, options);
}

/** POST /api/v1/buyer/selection/shortlists (`buyer.selection.shortlists.create`): Create shortlist (BUY-23). */
export function createShortlist(
  request: SelectionRequest<'createShortlist'>,
  options?: CallOptions,
): Promise<SelectionResponse<'createShortlist'>> {
  return send('createShortlist', request, options);
}

/** PUT /api/v1/buyer/selection/shortlists/:shortlistId (`buyer.selection.shortlists.update`): Update shortlist (BUY-23). */
export function updateShortlist(
  request: SelectionRequest<'updateShortlist'>,
  options?: CallOptions,
): Promise<SelectionResponse<'updateShortlist'>> {
  return send('updateShortlist', request, options);
}

/** POST /api/v1/buyer/selection/shortlists/:shortlistId/change (`buyer.selection.shortlists.change`): Changes an approved shortlist with a recorded reason; the change returns it for approval and review of invitations (BUY-23). */
export function changeShortlist(
  request: SelectionRequest<'changeShortlist'>,
  options?: CallOptions,
): Promise<SelectionResponse<'changeShortlist'>> {
  return send('changeShortlist', request, options);
}

/** POST /api/v1/buyer/selection/shortlists/:shortlistId/notify (`buyer.selection.shortlists.notify`): Issues outcome notices to every candidate and next-stage invitations only to included ones (AC-22) (BUY-23). */
export function notifyShortlist(
  request: SelectionRequest<'notifyShortlist'>,
  options?: CallOptions,
): Promise<SelectionResponse<'notifyShortlist'>> {
  return send('notifyShortlist', request, options);
}

/** GET /api/v1/buyer/selection/process-decisions (`buyer.selection.processDecisions.list`): List process decisions (BUY-24, BUY-25, BUY-27). */
export function listProcessDecisions(
  request: SelectionRequest<'listProcessDecisions'>,
  options?: CallOptions,
): Promise<SelectionResponse<'listProcessDecisions'>> {
  return send('listProcessDecisions', request, options);
}

/** POST /api/v1/buyer/selection/process-decisions (`buyer.selection.processDecisions.propose`): Propose process decision (BUY-24, BUY-25, BUY-27). */
export function proposeProcessDecision(
  request: SelectionRequest<'proposeProcessDecision'>,
  options?: CallOptions,
): Promise<SelectionResponse<'proposeProcessDecision'>> {
  return send('proposeProcessDecision', request, options);
}

/** GET /api/v1/buyer/selection/preferred-bidders (`buyer.selection.preferredBidders.list`): List preferred bidders (BUY-24). */
export function listPreferredBidders(
  request: SelectionRequest<'listPreferredBidders'>,
  options?: CallOptions,
): Promise<SelectionResponse<'listPreferredBidders'>> {
  return send('listPreferredBidders', request, options);
}

/** GET /api/v1/buyer/selection/preferred-bidders/:preferredBidderId (`buyer.selection.preferredBidders.get`): Get preferred bidder (BUY-24). */
export function getPreferredBidder(
  request: SelectionRequest<'getPreferredBidder'>,
  options?: CallOptions,
): Promise<SelectionResponse<'getPreferredBidder'>> {
  return send('getPreferredBidder', request, options);
}

/** POST /api/v1/buyer/selection/preferred-bidders (`buyer.selection.preferredBidders.recommend`): Recommends a conditional preferred bidder (never an award, BR-31) with contingency and fallback (BUY-24). */
export function recommendPreferredBidder(
  request: SelectionRequest<'recommendPreferredBidder'>,
  options?: CallOptions,
): Promise<SelectionResponse<'recommendPreferredBidder'>> {
  return send('recommendPreferredBidder', request, options);
}

/** POST /api/v1/buyer/selection/preferred-bidders/:preferredBidderId/withdraw (`buyer.selection.preferredBidders.withdraw`): Withdraw preferred bidder (BUY-24). */
export function withdrawPreferredBidder(
  request: SelectionRequest<'withdrawPreferredBidder'>,
  options?: CallOptions,
): Promise<SelectionResponse<'withdrawPreferredBidder'>> {
  return send('withdrawPreferredBidder', request, options);
}

/** POST /api/v1/buyer/selection/preferred-bidders/:preferredBidderId/fallback (`buyer.selection.preferredBidders.recordFallback`): Records the fallback decision after the preferred bidder failed diligence or withdrew (AC-24) (BUY-24, BUY-25). */
export function recordFallback(
  request: SelectionRequest<'recordFallback'>,
  options?: CallOptions,
): Promise<SelectionResponse<'recordFallback'>> {
  return send('recordFallback', request, options);
}

/** GET /api/v1/buyer/selection/due-diligence-cases (`buyer.selection.diligence.list`): List diligence cases (BUY-25). */
export function listDiligenceCases(
  request: SelectionRequest<'listDiligenceCases'>,
  options?: CallOptions,
): Promise<SelectionResponse<'listDiligenceCases'>> {
  return send('listDiligenceCases', request, options);
}

/** GET /api/v1/buyer/selection/due-diligence-cases/:caseId (`buyer.selection.diligence.get`): Get diligence case (BUY-25). */
export function getDiligenceCase(
  request: SelectionRequest<'getDiligenceCase'>,
  options?: CallOptions,
): Promise<SelectionResponse<'getDiligenceCase'>> {
  return send('getDiligenceCase', request, options);
}

/** POST /api/v1/buyer/selection/due-diligence-cases/:caseId/findings (`buyer.selection.diligence.recordFinding`): Record diligence finding (BUY-25). */
export function recordDiligenceFinding(
  request: SelectionRequest<'recordDiligenceFinding'>,
  options?: CallOptions,
): Promise<SelectionResponse<'recordDiligenceFinding'>> {
  return send('recordDiligenceFinding', request, options);
}

/** PUT /api/v1/buyer/selection/due-diligence-cases/:caseId/findings/:findingId (`buyer.selection.diligence.updateFinding`): Update diligence finding (BUY-25). */
export function updateDiligenceFinding(
  request: SelectionRequest<'updateDiligenceFinding'>,
  options?: CallOptions,
): Promise<SelectionResponse<'updateDiligenceFinding'>> {
  return send('updateDiligenceFinding', request, options);
}

/** POST /api/v1/buyer/selection/due-diligence-cases/:caseId/evidence-requests (`buyer.selection.diligence.requestEvidence`): Requests evidence from the preferred bidder through a due-diligence clarification with a permitted scope (BUY-25). */
export function requestDiligenceEvidence(
  request: SelectionRequest<'requestDiligenceEvidence'>,
  options?: CallOptions,
): Promise<SelectionResponse<'requestDiligenceEvidence'>> {
  return send('requestDiligenceEvidence', request, options);
}

/** POST /api/v1/buyer/selection/due-diligence-cases/:caseId/decide (`buyer.selection.diligence.decide`): Approves or rejects readiness. A failure blocks the award and requires a fallback decision (AC-24) (BUY-25). */
export function decideDiligenceCase(
  request: SelectionRequest<'decideDiligenceCase'>,
  options?: CallOptions,
): Promise<SelectionResponse<'decideDiligenceCase'>> {
  return send('decideDiligenceCase', request, options);
}

/** GET /api/v1/buyer/selection/negotiations (`buyer.selection.negotiations.list`): List negotiations (BUY-27). */
export function listNegotiations(
  request: SelectionRequest<'listNegotiations'>,
  options?: CallOptions,
): Promise<SelectionResponse<'listNegotiations'>> {
  return send('listNegotiations', request, options);
}

/** GET /api/v1/buyer/selection/negotiations/:negotiationId (`buyer.selection.negotiations.get`): Get negotiation (BUY-27). */
export function getNegotiation(
  request: SelectionRequest<'getNegotiation'>,
  options?: CallOptions,
): Promise<SelectionResponse<'getNegotiation'>> {
  return send('getNegotiation', request, options);
}

/** POST /api/v1/buyer/selection/negotiations (`buyer.selection.negotiations.open`): Opens a negotiation with its mandate (topics, negotiators, commercial authority); refused where not permitted (BR-30) (BUY-27). */
export function openNegotiation(
  request: SelectionRequest<'openNegotiation'>,
  options?: CallOptions,
): Promise<SelectionResponse<'openNegotiation'>> {
  return send('openNegotiation', request, options);
}

/** POST /api/v1/buyer/selection/negotiations/:negotiationId/rounds (`buyer.selection.negotiations.recordRound`): Record negotiation round (BUY-27). */
export function recordNegotiationRound(
  request: SelectionRequest<'recordNegotiationRound'>,
  options?: CallOptions,
): Promise<SelectionResponse<'recordNegotiationRound'>> {
  return send('recordNegotiationRound', request, options);
}

/** POST /api/v1/buyer/selection/negotiations/:negotiationId/conclude (`buyer.selection.negotiations.conclude`): Concludes a negotiation; a change to the basis of competition requires an approved process decision (BUY-27). */
export function concludeNegotiation(
  request: SelectionRequest<'concludeNegotiation'>,
  options?: CallOptions,
): Promise<SelectionResponse<'concludeNegotiation'>> {
  return send('concludeNegotiation', request, options);
}

/** GET /api/v1/buyer/selection/final-offer-rounds (`buyer.selection.finalOffers.list`): List final offer rounds (BUY-27). */
export function listFinalOfferRounds(
  request: SelectionRequest<'listFinalOfferRounds'>,
  options?: CallOptions,
): Promise<SelectionResponse<'listFinalOfferRounds'>> {
  return send('listFinalOfferRounds', request, options);
}

/** GET /api/v1/buyer/selection/final-offer-rounds/:roundId (`buyer.selection.finalOffers.get`): Get final offer round (BUY-27). */
export function getFinalOfferRound(
  request: SelectionRequest<'getFinalOfferRound'>,
  options?: CallOptions,
): Promise<SelectionResponse<'getFinalOfferRound'>> {
  return send('getFinalOfferRound', request, options);
}

/** POST /api/v1/buyer/selection/final-offer-rounds (`buyer.selection.finalOffers.create`): Requests a best and final offer round; blocked where the issued conditions do not permit it (AC-23) (BUY-27). */
export function createFinalOfferRound(
  request: SelectionRequest<'createFinalOfferRound'>,
  options?: CallOptions,
): Promise<SelectionResponse<'createFinalOfferRound'>> {
  return send('createFinalOfferRound', request, options);
}

/** POST /api/v1/buyer/selection/final-offer-rounds/:roundId/issue (`buyer.selection.finalOffers.issue`): Issue final offer round (BUY-27). */
export function issueFinalOfferRound(
  request: SelectionRequest<'issueFinalOfferRound'>,
  options?: CallOptions,
): Promise<SelectionResponse<'issueFinalOfferRound'>> {
  return send('issueFinalOfferRound', request, options);
}

/** POST /api/v1/buyer/selection/final-offer-rounds/:roundId/cancel (`buyer.selection.finalOffers.cancel`): Cancel final offer round (BUY-27). */
export function cancelFinalOfferRound(
  request: SelectionRequest<'cancelFinalOfferRound'>,
  options?: CallOptions,
): Promise<SelectionResponse<'cancelFinalOfferRound'>> {
  return send('cancelFinalOfferRound', request, options);
}

/** GET /api/v1/supplier/selection/assessment-invites (`supplier.selection.invites.list`): The supplier’s own demonstration, interview, presentation, sample, inspection and reference invitations (SUP-18). */
export function listSupplierInvites(
  request: SelectionRequest<'listSupplierInvites'>,
  options?: CallOptions,
): Promise<SelectionResponse<'listSupplierInvites'>> {
  return send('listSupplierInvites', request, options);
}

/** POST /api/v1/supplier/selection/assessment-invites/:inviteId/respond (`supplier.selection.invites.respond`): Respond to invite (SUP-18). */
export function respondToInvite(
  request: SelectionRequest<'respondToInvite'>,
  options?: CallOptions,
): Promise<SelectionResponse<'respondToInvite'>> {
  return send('respondToInvite', request, options);
}

/** GET /api/v1/supplier/selection/negotiations (`supplier.selection.negotiations.list`): List supplier negotiations (SUP-19). */
export function listSupplierNegotiations(
  request: SelectionRequest<'listSupplierNegotiations'>,
  options?: CallOptions,
): Promise<SelectionResponse<'listSupplierNegotiations'>> {
  return send('listSupplierNegotiations', request, options);
}

/** GET /api/v1/supplier/selection/negotiations/:negotiationId (`supplier.selection.negotiations.get`): The supplier’s own negotiation: authorized topics and the rounds shared with it; other suppliers stay hidden (SUP-19). */
export function getSupplierNegotiation(
  request: SelectionRequest<'getSupplierNegotiation'>,
  options?: CallOptions,
): Promise<SelectionResponse<'getSupplierNegotiation'>> {
  return send('getSupplierNegotiation', request, options);
}

/** POST /api/v1/supplier/selection/negotiations/:negotiationId/rounds/:roundId/respond (`supplier.selection.negotiations.respond`): Sends the internally approved response to a negotiation round (SUP-19). */
export function respondToRound(
  request: SelectionRequest<'respondToRound'>,
  options?: CallOptions,
): Promise<SelectionResponse<'respondToRound'>> {
  return send('respondToRound', request, options);
}

/** GET /api/v1/supplier/selection/final-offer-rounds (`supplier.selection.finalOffers.list`): Final-offer rounds the supplier is invited to, with a link to the response workspace for the BAFO (SUP-19). */
export function listSupplierFinalOffers(
  request: SelectionRequest<'listSupplierFinalOffers'>,
  options?: CallOptions,
): Promise<SelectionResponse<'listSupplierFinalOffers'>> {
  return send('listSupplierFinalOffers', request, options);
}

/** GET /api/v1/supplier/selection/final-offer-rounds/:roundId (`supplier.selection.finalOffers.get`): Get supplier final offer (SUP-19). */
export function getSupplierFinalOffer(
  request: SelectionRequest<'getSupplierFinalOffer'>,
  options?: CallOptions,
): Promise<SelectionResponse<'getSupplierFinalOffer'>> {
  return send('getSupplierFinalOffer', request, options);
}
