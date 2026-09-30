/**
 * Publication domain contract (domain 07): publication and distribution, participants and document access, the
 * public portal, and supplier discovery, invitations, the opportunity workspace and the private pursuit
 * (PRD §7.5, §7.6, §11.2, §11.3, §12.1; FR-08, FR-09; BR-14, BR-15, BR-46; AC-01, AC-33; DD-13, DD-15, DD-22,
 * DD-28, DD-41, DD-42).
 *
 * Screens: BUY-14, BUY-15, PUB-01, PUB-02, PUB-03, PUB-07, SUP-06, SUP-07, SUP-08, SUP-09.
 *
 * The schemas live in `publication/{shared,public,buyer,supplier}.ts`; this module re-exports them and exports the
 * one endpoint map of the domain, `publicationEndpoints`.
 *
 * Pure module: zod and sibling contract files only.
 */
import {
  downloadPublicDocument,
  getBuyerPortal,
  getPortalHome,
  getPublicGuidanceArticle,
  getPublicNotice,
  getPublicOpportunityFilters,
  listPublicGuidance,
  registerPublicInterest,
  searchPublicOpportunities,
} from './publication/public.js';
import {
  cancelScheduledPublication,
  decideParticipantAccess,
  distributeInvitations,
  getParticipant,
  getParticipantSummary,
  getPublicationOverview,
  inviteSupplier,
  listInvitationCandidates,
  listParticipants,
  listPublications,
  publishTender,
  reconcileExternalPublication,
  remindParticipant,
  replaceParticipantContact,
  resendInvitation,
  retryExternalPublication,
} from './publication/buyer.js';
import {
  acceptConfidentiality,
  acceptInvitation,
  acknowledgeSubject,
  addPursuitNote,
  addPursuitTeamMember,
  addToWatchlist,
  createSavedSearch,
  createSubscription,
  declineInvitation,
  decidePursuit,
  deleteSavedSearch,
  deleteSubscription,
  dismissOpportunity,
  restoreOpportunity,
  downloadOpportunityDocument,
  getInvitation,
  getOpportunityFilters,
  getOpportunityWorkspace,
  getPursuit,
  listInvitations,
  listOpportunities,
  listPursuitTeamCandidates,
  listPursuits,
  listSavedSearches,
  listSubscriptions,
  listWatchlist,
  notifyBuyerOfIntent,
  registerInterest,
  removeFromWatchlist,
  removePursuitTeamMember,
  requestAccess,
  savePursuit,
  selectLots,
  startResponse,
  updatePursuitTeamMember,
  updateSavedSearch,
  updateSubscription,
} from './publication/supplier.js';

export * from './publication/shared.js';
export * from './publication/public.js';
export * from './publication/buyer.js';
export * from './publication/supplier.js';

/** Every endpoint of the publication domain. */
export const publicationEndpoints = {
  // Public portal (PUB-01, PUB-02, PUB-03, PUB-07)
  portalHome: getPortalHome,
  buyerPortal: getBuyerPortal,
  searchPublic: searchPublicOpportunities,
  publicFilters: getPublicOpportunityFilters,
  publicNotice: getPublicNotice,
  publicDocumentDownload: downloadPublicDocument,
  publicRegisterInterest: registerPublicInterest,
  publicGuidance: listPublicGuidance,
  publicGuidanceArticle: getPublicGuidanceArticle,
  // Buyer publication (BUY-14)
  listPublications,
  publicationOverview: getPublicationOverview,
  publish: publishTender,
  cancelSchedule: cancelScheduledPublication,
  retryExternal: retryExternalPublication,
  reconcileExternal: reconcileExternalPublication,
  distributeInvitations,
  // Buyer participants (BUY-15)
  listParticipants,
  participantSummary: getParticipantSummary,
  getParticipant,
  invitationCandidates: listInvitationCandidates,
  inviteSupplier,
  replaceContact: replaceParticipantContact,
  decideAccess: decideParticipantAccess,
  resendInvitation,
  remindParticipant,
  // Supplier discovery (SUP-06)
  listOpportunities,
  opportunityFilters: getOpportunityFilters,
  dismissOpportunity,
  restoreOpportunity,
  listWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  listSavedSearches,
  createSavedSearch,
  updateSavedSearch,
  deleteSavedSearch,
  listSubscriptions,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  // Supplier invitations and access (SUP-07)
  listInvitations,
  getInvitation,
  acceptInvitation,
  declineInvitation,
  requestAccess,
  acceptConfidentiality,
  // Supplier workspace (SUP-08)
  opportunityWorkspace: getOpportunityWorkspace,
  registerInterest,
  acknowledge: acknowledgeSubject,
  selectLots,
  opportunityDocumentDownload: downloadOpportunityDocument,
  startResponse,
  // Supplier pursuit (SUP-09)
  listPursuits,
  pursuitTeamCandidates: listPursuitTeamCandidates,
  getPursuit,
  savePursuit,
  decidePursuit,
  notifyBuyer: notifyBuyerOfIntent,
  addTeamMember: addPursuitTeamMember,
  updateTeamMember: updatePursuitTeamMember,
  removeTeamMember: removePursuitTeamMember,
  addNote: addPursuitNote,
} as const;
