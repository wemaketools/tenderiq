/**
 * Publication client (the `publication` contract; FR-08, FR-09): publication and distribution (BUY-14),
 * participants and document access (BUY-15), the public portal (PUB-01, PUB-02, PUB-03, PUB-07) and supplier
 * discovery, invitations, the opportunity workspace and the private pursuit (SUP-06..SUP-09). Pages use the hooks
 * with the contract endpoints directly; these typed wrappers serve code outside hooks.
 */
import { publicationEndpoints } from '@contracts/publication';
import type { EndpointRequest, EndpointResponse } from '@contracts/endpoint';

import { call } from './client';
import type { CallOptions } from './client';

type Endpoints = typeof publicationEndpoints;
/** The request (`params`, `query`, `body`) of a publication endpoint. */
export type PublicationRequest<K extends keyof Endpoints> = EndpointRequest<Endpoints[K]>;
/** The response of a publication endpoint. */
export type PublicationResponse<K extends keyof Endpoints> = EndpointResponse<Endpoints[K]>;

function send<K extends keyof Endpoints>(
  key: K,
  request: PublicationRequest<K>,
  options?: CallOptions,
): Promise<PublicationResponse<K>> {
  return call(publicationEndpoints[key], request, options);
}

/** GET /api/v1/public/portal (`public.publication.home`). */
export function portalHome(
  request: PublicationRequest<'portalHome'>,
  options?: CallOptions,
): Promise<PublicationResponse<'portalHome'>> {
  return send('portalHome', request, options);
}

/** GET /api/v1/public/buyers/:buyerSlug (`public.publication.buyerHome`). */
export function buyerPortal(
  request: PublicationRequest<'buyerPortal'>,
  options?: CallOptions,
): Promise<PublicationResponse<'buyerPortal'>> {
  return send('buyerPortal', request, options);
}

/** GET /api/v1/public/opportunities (`public.publication.search`). */
export function searchPublic(
  request: PublicationRequest<'searchPublic'>,
  options?: CallOptions,
): Promise<PublicationResponse<'searchPublic'>> {
  return send('searchPublic', request, options);
}

/** GET /api/v1/public/opportunity-filters (`public.publication.filters`). */
export function publicFilters(
  request: PublicationRequest<'publicFilters'>,
  options?: CallOptions,
): Promise<PublicationResponse<'publicFilters'>> {
  return send('publicFilters', request, options);
}

/** GET /api/v1/public/opportunities/:buyerSlug/:reference (`public.publication.notice`). */
export function publicNotice(
  request: PublicationRequest<'publicNotice'>,
  options?: CallOptions,
): Promise<PublicationResponse<'publicNotice'>> {
  return send('publicNotice', request, options);
}

/** GET /api/v1/public/opportunities/:buyerSlug/:reference/documents/:documentId/download (`public.publication.documentDownload`). */
export function publicDocumentDownload(
  request: PublicationRequest<'publicDocumentDownload'>,
  options?: CallOptions,
): Promise<PublicationResponse<'publicDocumentDownload'>> {
  return send('publicDocumentDownload', request, options);
}

/** POST /api/v1/public/opportunities/:buyerSlug/:reference/interest (`public.publication.registerInterest`). */
export function publicRegisterInterest(
  request: PublicationRequest<'publicRegisterInterest'>,
  options?: CallOptions,
): Promise<PublicationResponse<'publicRegisterInterest'>> {
  return send('publicRegisterInterest', request, options);
}

/** GET /api/v1/public/guidance (`public.publication.guidance`). */
export function publicGuidance(
  request: PublicationRequest<'publicGuidance'>,
  options?: CallOptions,
): Promise<PublicationResponse<'publicGuidance'>> {
  return send('publicGuidance', request, options);
}

/** GET /api/v1/public/guidance/:articleSlug (`public.publication.guidanceArticle`). */
export function publicGuidanceArticle(
  request: PublicationRequest<'publicGuidanceArticle'>,
  options?: CallOptions,
): Promise<PublicationResponse<'publicGuidanceArticle'>> {
  return send('publicGuidanceArticle', request, options);
}

/** GET /api/v1/buyer/publications (`buyer.publication.list`). */
export function listPublications(
  request: PublicationRequest<'listPublications'>,
  options?: CallOptions,
): Promise<PublicationResponse<'listPublications'>> {
  return send('listPublications', request, options);
}

/** GET /api/v1/buyer/tenders/:tenderId/publication (`buyer.publication.overview`). */
export function publicationOverview(
  request: PublicationRequest<'publicationOverview'>,
  options?: CallOptions,
): Promise<PublicationResponse<'publicationOverview'>> {
  return send('publicationOverview', request, options);
}

/** POST /api/v1/buyer/tenders/:tenderId/publication/publish (`buyer.publication.publish`). */
export function publish(
  request: PublicationRequest<'publish'>,
  options?: CallOptions,
): Promise<PublicationResponse<'publish'>> {
  return send('publish', request, options);
}

/** POST /api/v1/buyer/tenders/:tenderId/publication/cancel-schedule (`buyer.publication.cancelSchedule`). */
export function cancelSchedule(
  request: PublicationRequest<'cancelSchedule'>,
  options?: CallOptions,
): Promise<PublicationResponse<'cancelSchedule'>> {
  return send('cancelSchedule', request, options);
}

/** POST /api/v1/buyer/publications/:publicationId/retry (`buyer.publication.retry`). */
export function retryExternal(
  request: PublicationRequest<'retryExternal'>,
  options?: CallOptions,
): Promise<PublicationResponse<'retryExternal'>> {
  return send('retryExternal', request, options);
}

/** POST /api/v1/buyer/publications/:publicationId/reconcile (`buyer.publication.reconcile`). */
export function reconcileExternal(
  request: PublicationRequest<'reconcileExternal'>,
  options?: CallOptions,
): Promise<PublicationResponse<'reconcileExternal'>> {
  return send('reconcileExternal', request, options);
}

/** POST /api/v1/buyer/tenders/:tenderId/invitations/distribute (`buyer.publication.distributeInvitations`). */
export function distributeInvitations(
  request: PublicationRequest<'distributeInvitations'>,
  options?: CallOptions,
): Promise<PublicationResponse<'distributeInvitations'>> {
  return send('distributeInvitations', request, options);
}

/** GET /api/v1/buyer/tenders/:tenderId/participants (`buyer.participants.list`). */
export function listParticipants(
  request: PublicationRequest<'listParticipants'>,
  options?: CallOptions,
): Promise<PublicationResponse<'listParticipants'>> {
  return send('listParticipants', request, options);
}

/** GET /api/v1/buyer/tenders/:tenderId/participant-summary (`buyer.participants.summary`). */
export function participantSummary(
  request: PublicationRequest<'participantSummary'>,
  options?: CallOptions,
): Promise<PublicationResponse<'participantSummary'>> {
  return send('participantSummary', request, options);
}

/** GET /api/v1/buyer/tenders/:tenderId/participants/:participantId (`buyer.participants.get`). */
export function getParticipant(
  request: PublicationRequest<'getParticipant'>,
  options?: CallOptions,
): Promise<PublicationResponse<'getParticipant'>> {
  return send('getParticipant', request, options);
}

/** GET /api/v1/buyer/tenders/:tenderId/invitation-candidates (`buyer.participants.candidates`). */
export function invitationCandidates(
  request: PublicationRequest<'invitationCandidates'>,
  options?: CallOptions,
): Promise<PublicationResponse<'invitationCandidates'>> {
  return send('invitationCandidates', request, options);
}

/** POST /api/v1/buyer/tenders/:tenderId/participants (`buyer.participants.invite`). */
export function inviteSupplier(
  request: PublicationRequest<'inviteSupplier'>,
  options?: CallOptions,
): Promise<PublicationResponse<'inviteSupplier'>> {
  return send('inviteSupplier', request, options);
}

/** POST /api/v1/buyer/tenders/:tenderId/participants/:participantId/contact (`buyer.participants.replaceContact`). */
export function replaceContact(
  request: PublicationRequest<'replaceContact'>,
  options?: CallOptions,
): Promise<PublicationResponse<'replaceContact'>> {
  return send('replaceContact', request, options);
}

/** POST /api/v1/buyer/tenders/:tenderId/participants/:participantId/access-decision (`buyer.participants.decideAccess`). */
export function decideAccess(
  request: PublicationRequest<'decideAccess'>,
  options?: CallOptions,
): Promise<PublicationResponse<'decideAccess'>> {
  return send('decideAccess', request, options);
}

/** POST /api/v1/buyer/tenders/:tenderId/participants/:participantId/resend (`buyer.participants.resendInvitation`). */
export function resendInvitation(
  request: PublicationRequest<'resendInvitation'>,
  options?: CallOptions,
): Promise<PublicationResponse<'resendInvitation'>> {
  return send('resendInvitation', request, options);
}

/** POST /api/v1/buyer/tenders/:tenderId/participants/:participantId/reminders (`buyer.participants.remind`). */
export function remindParticipant(
  request: PublicationRequest<'remindParticipant'>,
  options?: CallOptions,
): Promise<PublicationResponse<'remindParticipant'>> {
  return send('remindParticipant', request, options);
}

/** GET /api/v1/supplier/opportunities (`supplier.opportunities.list`). */
export function listOpportunities(
  request: PublicationRequest<'listOpportunities'>,
  options?: CallOptions,
): Promise<PublicationResponse<'listOpportunities'>> {
  return send('listOpportunities', request, options);
}

/** GET /api/v1/supplier/opportunity-filters (`supplier.opportunities.filters`). */
export function opportunityFilters(
  request: PublicationRequest<'opportunityFilters'>,
  options?: CallOptions,
): Promise<PublicationResponse<'opportunityFilters'>> {
  return send('opportunityFilters', request, options);
}

/** POST /api/v1/supplier/opportunities/:tenderId/dismiss (`supplier.opportunities.dismiss`). */
export function dismissOpportunity(
  request: PublicationRequest<'dismissOpportunity'>,
  options?: CallOptions,
): Promise<PublicationResponse<'dismissOpportunity'>> {
  return send('dismissOpportunity', request, options);
}

/** DELETE /api/v1/supplier/opportunities/:tenderId/dismiss (`supplier.opportunities.restore`). */
export function restoreOpportunity(
  request: PublicationRequest<'restoreOpportunity'>,
  options?: CallOptions,
): Promise<PublicationResponse<'restoreOpportunity'>> {
  return send('restoreOpportunity', request, options);
}

/** GET /api/v1/supplier/watchlist (`supplier.watchlist.list`). */
export function listWatchlist(
  request: PublicationRequest<'listWatchlist'>,
  options?: CallOptions,
): Promise<PublicationResponse<'listWatchlist'>> {
  return send('listWatchlist', request, options);
}

/** POST /api/v1/supplier/watchlist (`supplier.watchlist.add`). */
export function addToWatchlist(
  request: PublicationRequest<'addToWatchlist'>,
  options?: CallOptions,
): Promise<PublicationResponse<'addToWatchlist'>> {
  return send('addToWatchlist', request, options);
}

/** DELETE /api/v1/supplier/watchlist/:watchlistItemId (`supplier.watchlist.remove`). */
export function removeFromWatchlist(
  request: PublicationRequest<'removeFromWatchlist'>,
  options?: CallOptions,
): Promise<PublicationResponse<'removeFromWatchlist'>> {
  return send('removeFromWatchlist', request, options);
}

/** GET /api/v1/supplier/saved-searches (`supplier.savedSearches.list`). */
export function listSavedSearches(
  request: PublicationRequest<'listSavedSearches'>,
  options?: CallOptions,
): Promise<PublicationResponse<'listSavedSearches'>> {
  return send('listSavedSearches', request, options);
}

/** POST /api/v1/supplier/saved-searches (`supplier.savedSearches.create`). */
export function createSavedSearch(
  request: PublicationRequest<'createSavedSearch'>,
  options?: CallOptions,
): Promise<PublicationResponse<'createSavedSearch'>> {
  return send('createSavedSearch', request, options);
}

/** PUT /api/v1/supplier/saved-searches/:savedSearchId (`supplier.savedSearches.update`). */
export function updateSavedSearch(
  request: PublicationRequest<'updateSavedSearch'>,
  options?: CallOptions,
): Promise<PublicationResponse<'updateSavedSearch'>> {
  return send('updateSavedSearch', request, options);
}

/** DELETE /api/v1/supplier/saved-searches/:savedSearchId (`supplier.savedSearches.delete`). */
export function deleteSavedSearch(
  request: PublicationRequest<'deleteSavedSearch'>,
  options?: CallOptions,
): Promise<PublicationResponse<'deleteSavedSearch'>> {
  return send('deleteSavedSearch', request, options);
}

/** GET /api/v1/supplier/notice-subscriptions (`supplier.subscriptions.list`). */
export function listSubscriptions(
  request: PublicationRequest<'listSubscriptions'>,
  options?: CallOptions,
): Promise<PublicationResponse<'listSubscriptions'>> {
  return send('listSubscriptions', request, options);
}

/** POST /api/v1/supplier/notice-subscriptions (`supplier.subscriptions.create`). */
export function createSubscription(
  request: PublicationRequest<'createSubscription'>,
  options?: CallOptions,
): Promise<PublicationResponse<'createSubscription'>> {
  return send('createSubscription', request, options);
}

/** PUT /api/v1/supplier/notice-subscriptions/:subscriptionId (`supplier.subscriptions.update`). */
export function updateSubscription(
  request: PublicationRequest<'updateSubscription'>,
  options?: CallOptions,
): Promise<PublicationResponse<'updateSubscription'>> {
  return send('updateSubscription', request, options);
}

/** DELETE /api/v1/supplier/notice-subscriptions/:subscriptionId (`supplier.subscriptions.delete`). */
export function deleteSubscription(
  request: PublicationRequest<'deleteSubscription'>,
  options?: CallOptions,
): Promise<PublicationResponse<'deleteSubscription'>> {
  return send('deleteSubscription', request, options);
}

/** GET /api/v1/supplier/invitations (`supplier.invitations.list`). */
export function listInvitations(
  request: PublicationRequest<'listInvitations'>,
  options?: CallOptions,
): Promise<PublicationResponse<'listInvitations'>> {
  return send('listInvitations', request, options);
}

/** GET /api/v1/supplier/invitations/:participantId (`supplier.invitations.get`). */
export function getInvitation(
  request: PublicationRequest<'getInvitation'>,
  options?: CallOptions,
): Promise<PublicationResponse<'getInvitation'>> {
  return send('getInvitation', request, options);
}

/** POST /api/v1/supplier/invitations/:participantId/accept (`supplier.invitations.accept`). */
export function acceptInvitation(
  request: PublicationRequest<'acceptInvitation'>,
  options?: CallOptions,
): Promise<PublicationResponse<'acceptInvitation'>> {
  return send('acceptInvitation', request, options);
}

/** POST /api/v1/supplier/invitations/:participantId/decline (`supplier.invitations.decline`). */
export function declineInvitation(
  request: PublicationRequest<'declineInvitation'>,
  options?: CallOptions,
): Promise<PublicationResponse<'declineInvitation'>> {
  return send('declineInvitation', request, options);
}

/** POST /api/v1/supplier/opportunities/:tenderId/access-request (`supplier.opportunities.requestAccess`). */
export function requestAccess(
  request: PublicationRequest<'requestAccess'>,
  options?: CallOptions,
): Promise<PublicationResponse<'requestAccess'>> {
  return send('requestAccess', request, options);
}

/** POST /api/v1/supplier/opportunities/:tenderId/confidentiality (`supplier.opportunities.acceptConfidentiality`). */
export function acceptConfidentiality(
  request: PublicationRequest<'acceptConfidentiality'>,
  options?: CallOptions,
): Promise<PublicationResponse<'acceptConfidentiality'>> {
  return send('acceptConfidentiality', request, options);
}

/** GET /api/v1/supplier/opportunities/:tenderId (`supplier.opportunities.get`). */
export function opportunityWorkspace(
  request: PublicationRequest<'opportunityWorkspace'>,
  options?: CallOptions,
): Promise<PublicationResponse<'opportunityWorkspace'>> {
  return send('opportunityWorkspace', request, options);
}

/** POST /api/v1/supplier/opportunities/:tenderId/interest (`supplier.opportunities.registerInterest`). */
export function registerInterest(
  request: PublicationRequest<'registerInterest'>,
  options?: CallOptions,
): Promise<PublicationResponse<'registerInterest'>> {
  return send('registerInterest', request, options);
}

/** POST /api/v1/supplier/opportunities/:tenderId/acknowledgments (`supplier.opportunities.acknowledge`). */
export function acknowledge(
  request: PublicationRequest<'acknowledge'>,
  options?: CallOptions,
): Promise<PublicationResponse<'acknowledge'>> {
  return send('acknowledge', request, options);
}

/** PUT /api/v1/supplier/opportunities/:tenderId/lots (`supplier.opportunities.selectLots`). */
export function selectLots(
  request: PublicationRequest<'selectLots'>,
  options?: CallOptions,
): Promise<PublicationResponse<'selectLots'>> {
  return send('selectLots', request, options);
}

/** GET /api/v1/supplier/opportunities/:tenderId/documents/:documentId/download (`supplier.opportunities.documentDownload`). */
export function opportunityDocumentDownload(
  request: PublicationRequest<'opportunityDocumentDownload'>,
  options?: CallOptions,
): Promise<PublicationResponse<'opportunityDocumentDownload'>> {
  return send('opportunityDocumentDownload', request, options);
}

/** POST /api/v1/supplier/opportunities/:tenderId/start-response (`supplier.opportunities.startResponse`). */
export function startResponse(
  request: PublicationRequest<'startResponse'>,
  options?: CallOptions,
): Promise<PublicationResponse<'startResponse'>> {
  return send('startResponse', request, options);
}

/** GET /api/v1/supplier/pursuits (`supplier.pursuits.list`). */
export function listPursuits(
  request: PublicationRequest<'listPursuits'>,
  options?: CallOptions,
): Promise<PublicationResponse<'listPursuits'>> {
  return send('listPursuits', request, options);
}

/** GET /api/v1/supplier/pursuit-team-candidates (`supplier.pursuits.teamCandidates`). */
export function pursuitTeamCandidates(
  request: PublicationRequest<'pursuitTeamCandidates'>,
  options?: CallOptions,
): Promise<PublicationResponse<'pursuitTeamCandidates'>> {
  return send('pursuitTeamCandidates', request, options);
}

/** GET /api/v1/supplier/opportunities/:tenderId/pursuit (`supplier.pursuits.get`). */
export function getPursuit(
  request: PublicationRequest<'getPursuit'>,
  options?: CallOptions,
): Promise<PublicationResponse<'getPursuit'>> {
  return send('getPursuit', request, options);
}

/** PUT /api/v1/supplier/opportunities/:tenderId/pursuit (`supplier.pursuits.save`). */
export function savePursuit(
  request: PublicationRequest<'savePursuit'>,
  options?: CallOptions,
): Promise<PublicationResponse<'savePursuit'>> {
  return send('savePursuit', request, options);
}

/** POST /api/v1/supplier/opportunities/:tenderId/pursuit/decision (`supplier.pursuits.decide`). */
export function decidePursuit(
  request: PublicationRequest<'decidePursuit'>,
  options?: CallOptions,
): Promise<PublicationResponse<'decidePursuit'>> {
  return send('decidePursuit', request, options);
}

/** POST /api/v1/supplier/opportunities/:tenderId/pursuit/notify-buyer (`supplier.pursuits.notifyBuyer`). */
export function notifyBuyer(
  request: PublicationRequest<'notifyBuyer'>,
  options?: CallOptions,
): Promise<PublicationResponse<'notifyBuyer'>> {
  return send('notifyBuyer', request, options);
}

/** POST /api/v1/supplier/opportunities/:tenderId/pursuit/team (`supplier.pursuits.addTeamMember`). */
export function addTeamMember(
  request: PublicationRequest<'addTeamMember'>,
  options?: CallOptions,
): Promise<PublicationResponse<'addTeamMember'>> {
  return send('addTeamMember', request, options);
}

/** PUT /api/v1/supplier/opportunities/:tenderId/pursuit/team/:memberId (`supplier.pursuits.updateTeamMember`). */
export function updateTeamMember(
  request: PublicationRequest<'updateTeamMember'>,
  options?: CallOptions,
): Promise<PublicationResponse<'updateTeamMember'>> {
  return send('updateTeamMember', request, options);
}

/** DELETE /api/v1/supplier/opportunities/:tenderId/pursuit/team/:memberId (`supplier.pursuits.removeTeamMember`). */
export function removeTeamMember(
  request: PublicationRequest<'removeTeamMember'>,
  options?: CallOptions,
): Promise<PublicationResponse<'removeTeamMember'>> {
  return send('removeTeamMember', request, options);
}

/** POST /api/v1/supplier/opportunities/:tenderId/pursuit/notes (`supplier.pursuits.addNote`). */
export function addNote(
  request: PublicationRequest<'addNote'>,
  options?: CallOptions,
): Promise<PublicationResponse<'addNote'>> {
  return send('addNote', request, options);
}
