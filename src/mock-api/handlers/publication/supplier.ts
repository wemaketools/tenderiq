/**
 * Mock handlers of the supplier opportunity screens (SUP-06, SUP-07, SUP-08, SUP-09; FR-09; DD-41, DD-42).
 *
 * - A supplier sees the public notices plus the released events its organization takes part in; any other
 *   tender answers OPPORTUNITY_NOT_FOUND. Participant, pursuit and discovery rows are the active supplier
 *   organization's own; saved searches, watchlist items and subscriptions are the signed-in user's own.
 * - Matches are suggestions computed from the supplier profile, saved searches and subscriptions.
 * - The pursuit is private. Only `notifyBuyer` changes what the buyer sees (DD-41).
 */
import type { PermissionCode } from '../../../contracts/permissions.js';
import type {
  ConditionState,
  InvitationDetail,
  InvitationRow,
  OpportunityMatch,
  OpportunityRow,
  OpportunityWorkspace,
  PursuitDetail,
  ReadinessCheck,
  SavedSearch,
  WatchlistItem,
} from '../../../contracts/publication.js';
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
} from '../../../contracts/publication.js';
import { enumLabel } from '../../../contracts/enums.js';
import { mockRoute } from '../../app.js';
import type { MockApp } from '../../app.js';
import {
  DISMISSALS,
  PURSUITS,
  QUALIFICATION_STATUSES,
  SAVED_SEARCHES,
  SUBSCRIPTIONS,
  SUPPLIER_PROFILES,
  TENDERS,
  WATCHLIST_ITEMS,
} from '../../fixtures/publication.js';
import type {
  FixtureDocument,
  FixtureParticipant,
  FixturePursuit,
  FixtureSavedSearch,
  FixtureSubscription,
  FixtureTender,
} from '../../fixtures/publication.js';
import { CLARIFICATION_TENDERS } from '../../fixtures/clarifications/index.js';
import { allPersonas, findTenantById, findTenantRole, membershipPermissions } from '../../persona.js';
import type { Persona } from '../../persona.js';
import {
  buyerLabel,
  categoryOf,
  closingAt,
  inDateRange,
  isAcceptingResponses,
  isInvertedRange,
  isKnownCategory,
  isVisibleToSupplier,
  isoInstant,
  officialText,
  lastAmendedAt,
  matchesText,
  outstandingAcknowledgments,
  ownParticipation,
  packageDocumentOf,
  participantHistory,
  participantOf,
  personOf,
  requiresAccessDecision,
  requiresConfidentiality,
  sortRows,
  supplierParty,
  tenderById,
  tenderLabel,
  downloadLinkOf,
  hasDocumentAccess,
} from './projections.js';

type Fail = (status: number, code: string, detail?: string) => never;

// ---------------------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------------------

function visibleTenders(supplierTenantId: number): FixtureTender[] {
  return TENDERS.filter((tender) => isVisibleToSupplier(tender, supplierTenantId));
}

function visibleTender(supplierTenantId: number, tenderId: number, fail: Fail): FixtureTender {
  const tender = tenderById(tenderId);
  if (tender === undefined || !isVisibleToSupplier(tender, supplierTenantId)) {
    return fail(404, 'OPPORTUNITY_NOT_FOUND', 'No opportunity with this id is available to your organization.');
  }
  return tender;
}

/**
 * The tender an organization may ask access to: a visible one, or one it already asked for (a pending or denied
 * request, followed under /supplier/invitations), so a denied applicant can ask again without seeing the event.
 */
function requestableTender(supplierTenantId: number, tenderId: number, fail: Fail): FixtureTender {
  const tender = tenderById(tenderId);
  const participant = tender === undefined ? undefined : participantOf(tender.id, supplierTenantId);
  if (tender !== undefined && tender.releasedAt !== null && participant?.source === 'access_request') {
    return tender;
  }
  return visibleTender(supplierTenantId, tenderId, fail);
}

/**
 * The organization takes part in the event's clarification channel (SUP-10, SUP-11): the clarifications domain serves
 * the questions, published answers and sessions of an event to its participants only.
 */
function takesPartInClarifications(tenderId: number, supplierTenantId: number): boolean {
  return (
    CLARIFICATION_TENDERS.find((entry) => entry.id === tenderId)?.participants.some((entry) => entry.supplierTenantId === supplierTenantId) ?? false
  );
}

/** The declared qualification gate: the `qualification_required` condition, blocking or informational (AC-07). */
function qualificationGateOf(tender: FixtureTender): { blocking: boolean } | null {
  if (tender.qualificationProgram === null) {
    return null;
  }
  const declared = tender.conditions.find((condition) => condition.conditionType === 'qualification_required');
  return { blocking: declared?.blocking ?? true };
}

/** True when the declared gate keeps this participant from responding (a blocking gate that is not met). */
function blockedByQualification(tender: FixtureTender, participant: FixtureParticipant | undefined): boolean {
  const gate = qualificationGateOf(tender);
  return gate !== null && gate.blocking && participant !== undefined && participant.qualificationGate !== 'met' && participant.qualificationGate !== 'not_required';
}

function requireParticipant(tender: FixtureTender, supplierTenantId: number, fail: Fail): FixtureParticipant {
  const participant = participantOf(tender.id, supplierTenantId);
  if (participant === undefined) {
    return fail(409, 'NOT_A_PARTICIPANT', 'Register interest or accept an invitation first.');
  }
  return participant;
}

function categoryCovers(codes: readonly string[], tender: FixtureTender): boolean {
  const parent = categoryOf(tender.categoryCode).parentCode;
  return codes.includes(tender.categoryCode) || (parent !== null && codes.includes(parent));
}

function savedSearchMatches(search: FixtureSavedSearch, tender: FixtureTender): boolean {
  return (
    (search.keywords === null || matchesText(search.keywords, tender.title, tender.summary)) &&
    (search.catalogCodes.length === 0 || categoryCovers(search.catalogCodes, tender)) &&
    (search.buyerTenantIds.length === 0 || search.buyerTenantIds.includes(tender.tenantId)) &&
    (search.regions.length === 0 || tender.regions.some((region) => search.regions.includes(region))) &&
    (search.procedures.length === 0 || search.procedures.includes(tender.procedure))
  );
}

function subscriptionMatches(subscription: FixtureSubscription, tender: FixtureTender): boolean {
  return (
    subscription.active &&
    (subscription.buyerTenantId === null || subscription.buyerTenantId === tender.tenantId) &&
    (subscription.catalogCode === null || categoryCovers([subscription.catalogCode], tender))
  );
}

function matchOf(tender: FixtureTender, supplierTenantId: number, userId: number): OpportunityMatch {
  const reasons: OpportunityMatch['reasons'] = [];
  const profile = SUPPLIER_PROFILES.find((entry) => entry.tenantId === supplierTenantId);
  if (profile !== undefined && categoryCovers(profile.catalogCodes, tender)) {
    reasons.push({ kind: 'category', label: categoryOf(tender.categoryCode).name });
  }
  if (profile !== undefined) {
    for (const region of tender.regions.filter((entry) => profile.serviceAreas.includes(entry))) {
      reasons.push({ kind: 'region', label: region });
    }
  }
  for (const search of SAVED_SEARCHES.filter((entry) => entry.tenantId === supplierTenantId && entry.userId === userId)) {
    if (savedSearchMatches(search, tender)) {
      reasons.push({ kind: 'saved_search', label: search.name });
    }
  }
  if (SUBSCRIPTIONS.some((entry) => entry.tenantId === supplierTenantId && entry.userId === userId && subscriptionMatches(entry, tender))) {
    reasons.push({ kind: 'subscription', label: buyerLabel(tender.tenantId).name });
  }
  if (participantOf(tender.id, supplierTenantId)?.source === 'invited') {
    reasons.push({ kind: 'invitation', label: 'Invited by the buyer' });
  }
  return { isMatch: reasons.some((reason) => reason.kind !== 'region'), reasons };
}

function pursuitOf(supplierTenantId: number, tenderId: number): FixturePursuit | undefined {
  return PURSUITS.find((pursuit) => pursuit.tenantId === supplierTenantId && pursuit.tenderId === tenderId);
}

function watchItemOf(supplierTenantId: number, userId: number, tenderId: number) {
  return WATCHLIST_ITEMS.find((item) => item.tenantId === supplierTenantId && item.userId === userId && item.tenderId === tenderId);
}

function isDismissed(supplierTenantId: number, userId: number, tenderId: number): boolean {
  return DISMISSALS.some((entry) => entry.tenantId === supplierTenantId && entry.userId === userId && entry.tenderId === tenderId);
}

function opportunityRow(tender: FixtureTender, supplierTenantId: number, userId: number, now: Date): OpportunityRow {
  const participant = participantOf(tender.id, supplierTenantId);
  const buyer = buyerLabel(tender.tenantId);
  return {
    tender: tenderLabel(tender),
    buyer,
    summary: tender.summary,
    category: categoryOf(tender.categoryCode),
    regions: [...tender.regions],
    publishedAt: tender.releasedAt ?? '',
    closingAt: closingAt(tender),
    isAcceptingResponses: isAcceptingResponses(tender, now),
    lotCount: tender.lots.length,
    amendmentCount: tender.addenda.length,
    match: matchOf(tender, supplierTenantId, userId),
    watchlistItemId: watchItemOf(supplierTenantId, userId, tender.id)?.id ?? null,
    dismissed: isDismissed(supplierTenantId, userId, tender.id),
    participation: participant === undefined ? null : ownParticipation(participant),
    pursuitDecision: pursuitOf(supplierTenantId, tender.id)?.decision ?? null,
    linkPath: `/supplier/opportunities/${tender.id}`,
  };
}

function watchlistItem(item: (typeof WATCHLIST_ITEMS)[number], tender: FixtureTender, now: Date): WatchlistItem {
  return {
    id: item.id,
    tender: tenderLabel(tender),
    buyer: buyerLabel(tender.tenantId),
    closingAt: closingAt(tender),
    isAcceptingResponses: isAcceptingResponses(tender, now),
    lastAmendedAt: lastAmendedAt(tender),
    addedAt: item.addedAt,
    linkPath: `/supplier/opportunities/${tender.id}`,
  };
}

function savedSearchOf(search: FixtureSavedSearch): SavedSearch {
  return {
    id: search.id,
    name: search.name,
    keywords: search.keywords,
    catalogCodes: [...search.catalogCodes],
    buyerTenantIds: [...search.buyerTenantIds],
    regions: [...search.regions],
    procedures: [...search.procedures],
    notify: search.notify,
    matchCount: visibleTenders(search.tenantId).filter((tender) => savedSearchMatches(search, tender)).length,
    createdAt: search.createdAt,
    updatedAt: search.updatedAt,
  };
}

function subscriptionOf(subscription: FixtureSubscription) {
  return {
    id: subscription.id,
    buyer: subscription.buyerTenantId === null ? null : buyerLabel(subscription.buyerTenantId),
    category: subscription.catalogCode === null ? null : categoryOf(subscription.catalogCode),
    active: subscription.active,
    createdAt: subscription.createdAt,
  };
}

function qualificationFor(tender: FixtureTender, supplierTenantId: number) {
  if (tender.qualificationProgram === null) {
    return null;
  }
  const status = QUALIFICATION_STATUSES.find(
    (entry) => entry.buyerTenantId === tender.tenantId && entry.supplierTenantId === supplierTenantId && entry.programName === tender.qualificationProgram,
  );
  return {
    programName: tender.qualificationProgram,
    effectiveStatus: status?.effectiveStatus ?? ('not_assessed' as const),
    effectiveTo: status?.effectiveTo ?? null,
    conditions: status?.conditions ?? null,
  };
}

/** Why a document is locked for this participant, or `null` when it may be downloaded. */
function documentLock(tender: FixtureTender, document: FixtureDocument, participant: FixtureParticipant | undefined): string | null {
  if (document.accessRule === 'public') {
    return null;
  }
  if (participant === undefined) {
    return 'Register interest to open the participant documents.';
  }
  if (participant.invitationStatus === 'invited') {
    return 'Accept the invitation to open the package.';
  }
  if (participant.invitationStatus === 'declined' || participant.invitationStatus === 'expired') {
    return 'The invitation was not accepted.';
  }
  if (participant.accessStatus === 'requested') {
    return 'Your access request awaits the buyer’s decision.';
  }
  if (participant.accessStatus === 'denied') {
    return 'Document access was denied.';
  }
  if (!hasDocumentAccess(tender, participant)) {
    return 'Request access to open the restricted documents.';
  }
  if (document.accessRule === 'participants') {
    return null;
  }
  if (requiresConfidentiality(tender) && participant.confidentialityAcceptedAt === null) {
    return 'Accept the confidentiality undertaking to open this document.';
  }
  return null;
}

function conditionStates(tender: FixtureTender, participant: FixtureParticipant | undefined): ConditionState[] {
  const qualification = qualificationFor(tender, participant?.supplierTenantId ?? 0);
  return tender.conditions.map((condition) => {
    let state: ConditionState['state'] = 'outstanding';
    let metAt: string | null = null;
    switch (condition.conditionType) {
      case 'confidentiality_undertaking':
        metAt = participant?.confidentialityAcceptedAt ?? null;
        state = metAt === null ? 'outstanding' : 'met';
        break;
      case 'registration':
        state = participant === undefined ? 'outstanding' : 'met';
        metAt = participant?.registeredAt ?? null;
        break;
      case 'qualification_required':
        state =
          participant?.qualificationGate === 'met' ||
          qualification?.effectiveStatus === 'qualified' ||
          qualification?.effectiveStatus === 'qualified_with_conditions'
            ? 'met'
            : 'outstanding';
        break;
      case 'eligibility_review':
        state = participant?.accessStatus === 'granted' ? 'met' : 'outstanding';
        metAt = participant?.accessStatus === 'granted' ? participant.accessDecidedAt : null;
        break;
      case 'mandatory_briefing': {
        const registered = participant?.sessionRegistrations.some(
          (registration) =>
            tender.sessions.some((session) => session.sessionId === registration.sessionId && session.mandatory) &&
            (registration.status === 'registered' || registration.status === 'attended'),
        );
        state = registered === true ? 'met' : 'outstanding';
        break;
      }
    }
    return { ...condition, state, metAt };
  });
}

function readinessOf(tender: FixtureTender, participant: FixtureParticipant | undefined, now: Date): ReadinessCheck[] {
  const checks: ReadinessCheck[] = [];
  checks.push(
    isAcceptingResponses(tender, now)
      ? { id: 'response_window', label: 'Response window open', status: 'passed', detail: null }
      : { id: 'response_window', label: 'Response window open', status: 'blocking', detail: 'The response window is closed.' },
  );
  if (participant === undefined) {
    checks.push({ id: 'participation', label: 'Participation registered', status: 'blocking', detail: 'Register interest in this opportunity first.' });
    return checks;
  }
  checks.push({ id: 'participation', label: 'Participation registered', status: 'passed', detail: null });
  if (participant.source === 'invited') {
    checks.push(
      participant.invitationStatus === 'accepted'
        ? { id: 'invitation', label: 'Invitation accepted', status: 'passed', detail: null }
        : {
            id: 'invitation',
            label: 'Invitation accepted',
            status: 'blocking',
            detail: participant.invitationStatus === 'invited' ? 'An authorized representative must accept the invitation.' : 'The invitation was not accepted.',
          },
    );
  }
  if (participant.source !== 'invited' && (requiresAccessDecision(tender) || participant.accessStatus !== 'not_required')) {
    checks.push(
      participant.accessStatus === 'granted'
        ? { id: 'document_access', label: 'Document access granted', status: 'passed', detail: null }
        : {
            id: 'document_access',
            label: 'Document access granted',
            status: 'blocking',
            detail:
              participant.accessStatus === 'requested'
                ? 'Your access request awaits the buyer’s decision.'
                : participant.accessStatus === 'denied'
                  ? `Access denied: ${participant.accessDecisionReason ?? 'no reason given'}`
                  : 'Request access to the restricted documents.',
          },
    );
  }
  if (requiresConfidentiality(tender)) {
    checks.push(
      participant.confidentialityAcceptedAt !== null
        ? { id: 'confidentiality', label: 'Confidentiality undertaking accepted', status: 'passed', detail: null }
        : { id: 'confidentiality', label: 'Confidentiality undertaking accepted', status: 'blocking', detail: 'An authorized representative must accept it.' },
    );
  }
  const gate = qualificationGateOf(tender);
  if (gate !== null && tender.qualificationProgram !== null) {
    const program = tender.qualificationProgram;
    const pending = participant.qualificationGate === 'pending';
    if (participant.qualificationGate === 'met' || participant.qualificationGate === 'not_required') {
      checks.push({ id: 'qualification', label: 'Qualification gate', status: 'passed', detail: program });
    } else if (!gate.blocking) {
      // An informational gate (for example "before award") never blocks participation (AC-07).
      checks.push({
        id: 'qualification',
        label: 'Qualification before award',
        status: 'warning',
        detail: pending
          ? `A current "${program}" qualification is needed before award; your application awaits a decision.`
          : `A current "${program}" qualification is needed before award; you may respond meanwhile.`,
      });
    } else {
      checks.push({
        id: 'qualification',
        label: 'Qualification gate',
        status: 'blocking',
        detail: pending
          ? `A current "${program}" qualification is required to respond; your application awaits a decision.`
          : `A current "${program}" qualification is required to respond.`,
      });
    }
  }
  const outstanding = outstandingAcknowledgments(tender, participant);
  checks.push(
    outstanding.length === 0
      ? { id: 'acknowledgments', label: 'Addenda acknowledged', status: 'passed', detail: null }
      : { id: 'acknowledgments', label: 'Addenda acknowledged', status: 'blocking', detail: outstanding.map((subject) => subject.label).join('; ') },
  );
  for (const session of tender.sessions.filter((entry) => entry.mandatory && entry.status !== 'cancelled' && entry.alternativeOfId === null)) {
    const group = tender.sessions.filter((entry) => entry.sessionId === session.sessionId || entry.alternativeOfId === session.sessionId);
    const ok = participant.sessionRegistrations.some(
      (registration) =>
        group.some((entry) => entry.sessionId === registration.sessionId) &&
        (registration.status === 'registered' || registration.status === 'attended'),
    );
    checks.push({
      id: `session_${session.sessionId}`,
      label: `Mandatory ${session.sessionType === 'site_visit' ? 'site visit' : 'briefing'}`,
      status: ok ? 'passed' : 'blocking',
      detail: ok ? session.title : `Register for "${session.title}".`,
    });
  }
  if (tender.lots.length > 0) {
    checks.push(
      participant.selectedLotIds.length > 0
        ? { id: 'lots', label: 'Lots selected', status: 'passed', detail: null }
        : { id: 'lots', label: 'Lots selected', status: tender.lots.length > 1 ? 'blocking' : 'warning', detail: 'Select the lots you will respond to.' },
    );
  }
  return checks;
}

function has(permissions: readonly PermissionCode[], code: PermissionCode): boolean {
  return permissions.includes(code);
}

function workspaceOf(tender: FixtureTender, supplierTenantId: number, userId: number, permissions: readonly PermissionCode[], now: Date): OpportunityWorkspace {
  const participant = participantOf(tender.id, supplierTenantId);
  const accepting = isAcceptingResponses(tender, now);
  const readiness = readinessOf(tender, participant, now);
  const qualification = qualificationFor(tender, supplierTenantId);
  const eligibleForLots = !blockedByQualification(tender, participant);
  return {
    tender: {
      ...tenderLabel(tender),
      summary: tender.summary,
      category: categoryOf(tender.categoryCode),
      regions: [...tender.regions],
      officialTimeZone: tender.officialTimeZone,
      currentVersionNo: Math.max(tender.currentVersionNo, 1),
      eligibilitySummary: tender.eligibilitySummary,
      deliveryRequirements: tender.deliveryRequirements,
      submissionRules: tender.submissionRules,
      communicationChannelNote: tender.communicationChannelNote,
      contractConditions: tender.contractConditions,
      acceptedLanguages: [...tender.acceptedLanguages],
      maxLotsPerSupplier: tender.maxLotsPerSupplier,
      submissionDeadline: closingAt(tender),
      isAcceptingResponses: accepting,
      publishedAt: tender.releasedAt ?? '',
    },
    buyer: buyerLabel(tender.tenantId),
    participation: participant === undefined ? null : ownParticipation(participant),
    lots: tender.lots.map((entry) => ({
      ...entry,
      eligible: eligibleForLots && entry.stage === 'open',
      ineligibleReason: !eligibleForLots
        ? 'The qualification gate of this event is not met.'
        : entry.stage === 'open'
          ? null
          : `This lot is ${enumLabel('lots.stage', entry.stage).toLowerCase()}.`,
      selected: participant?.selectedLotIds.includes(entry.lotId) ?? false,
    })),
    milestones: [...tender.milestones],
    documents: tender.documents.map((document) => {
      const lockedReason = documentLock(tender, document, participant);
      return { ...packageDocumentOf(document), available: lockedReason === null, lockedReason };
    }),
    versions: [...tender.versions],
    addenda: tender.addenda.map(({ acknowledgmentRequired, ...addendum }) => {
      const ack = participant?.acknowledgments.find((entry) => entry.subjectType === 'addendum' && entry.subjectId === addendum.addendumId);
      return {
        ...addendum,
        acknowledgmentRequired,
        acknowledgedAt: ack?.acknowledgedAt ?? null,
        acknowledgedBy: personOf(ack?.acknowledgedByUserId ?? null),
      };
    }),
    sessions: tender.sessions.map((session) => ({
      sessionId: session.sessionId,
      sessionType: session.sessionType,
      title: session.title,
      lotNo: session.lotNo,
      startsAt: { at: session.startsAt, timeZone: tender.officialTimeZone },
      endsAt: session.endsAt,
      venue: session.venue,
      mandatory: session.mandatory,
      capacity: session.capacity,
      placesLeft: session.placesLeft,
      registrationDeadline: session.registrationDeadline === null ? null : { at: session.registrationDeadline, timeZone: tender.officialTimeZone },
      status: session.status,
      registrationStatus: participant?.sessionRegistrations.find((entry) => entry.sessionId === session.sessionId)?.status ?? null,
    })),
    conditions: conditionStates(tender, participant),
    qualification,
    readiness,
    pursuitDecision: pursuitOf(supplierTenantId, tender.id)?.decision ?? null,
    watchlistItemId: watchItemOf(supplierTenantId, userId, tender.id)?.id ?? null,
    capabilities: {
      canRegisterInterest:
        participant === undefined &&
        accepting &&
        tender.participation === 'open' &&
        (has(permissions, 'supplier.pursuit.manage') || has(permissions, 'supplier.notices.acknowledge')),
      canRequestAccess:
        accepting &&
        has(permissions, 'supplier.notices.acknowledge') &&
        requiresAccessDecision(tender) &&
        (participant === undefined || (participant.source !== 'invited' && participant.accessStatus === 'not_required')),
      canAcceptConfidentiality:
        has(permissions, 'supplier.notices.acknowledge') &&
        participant !== undefined &&
        requiresConfidentiality(tender) &&
        participant.confidentialityAcceptedAt === null &&
        participant.accessStatus !== 'requested' &&
        participant.accessStatus !== 'denied' &&
        participant.invitationStatus !== 'invited',
      canAcknowledge: has(permissions, 'supplier.notices.acknowledge') && participant !== undefined && outstandingAcknowledgments(tender, participant).length > 0,
      canSelectLots: has(permissions, 'supplier.pursuit.manage') && participant !== undefined && accepting && tender.lots.some((entry) => entry.stage === 'open'),
      canManagePursuit: has(permissions, 'supplier.pursuit.manage'),
      canStartResponse:
        (has(permissions, 'supplier.response.edit') || has(permissions, 'supplier.pursuit.manage')) &&
        readiness.every((check) => check.status !== 'blocking'),
      canViewClarifications: takesPartInClarifications(tender.id, supplierTenantId),
    },
  };
}

function isInvitationRow(participant: FixtureParticipant): boolean {
  return participant.source === 'invited' || participant.accessStatus !== 'not_required';
}

function invitationRow(participant: FixtureParticipant, tender: FixtureTender): InvitationRow {
  const confidentialityRequired = requiresConfidentiality(tender);
  return {
    participantId: participant.id,
    kind: participant.source === 'invited' ? 'invitation' : 'access_request',
    tender: tenderLabel(tender),
    buyer: buyerLabel(tender.tenantId),
    closingAt: closingAt(tender),
    invitationStatus: participant.invitationStatus,
    accessStatus: participant.accessStatus,
    invitedContactName: participant.invitedContactName,
    invitedContactEmail: participant.invitedContactEmail,
    invitedAt: participant.invitedAt,
    invitationExpiresAt: participant.invitationExpiresAt,
    accessRequestedAt: participant.accessRequestedAt,
    accessDecidedAt: participant.accessDecidedAt,
    confidentialityRequired,
    confidentialityAcceptedAt: participant.confidentialityAcceptedAt,
    awaitingResponse:
      participant.invitationStatus === 'invited' ||
      (confidentialityRequired &&
        participant.confidentialityAcceptedAt === null &&
        (participant.accessStatus === 'granted' || participant.invitationStatus === 'accepted')),
  };
}

function invitationDetail(participant: FixtureParticipant, tender: FixtureTender, permissions: readonly PermissionCode[]): InvitationDetail {
  const row = invitationRow(participant, tender);
  const canRespond = has(permissions, 'supplier.notices.acknowledge');
  return {
    ...row,
    intendedSupplier: supplierParty(participant.supplierTenantId),
    invitationMessage: participant.invitationMessage,
    confidentialityText: tender.confidentialityText,
    confidentialityAcceptedBy: personOf(participant.confidentialityAcceptedByUserId),
    conditions: conditionStates(tender, participant),
    accessRequestReason: participant.accessRequestReason,
    accessDecisionReason: participant.accessDecisionReason,
    sharedNoBidReason: participant.sharedNoBidReason,
    history: participantHistory(participant),
    opportunityPath: isVisibleToSupplier(tender, participant.supplierTenantId) ? `/supplier/opportunities/${tender.id}` : null,
    capabilities: {
      canRespond: canRespond && participant.invitationStatus === 'invited',
      canAcceptConfidentiality:
        canRespond &&
        row.confidentialityRequired &&
        participant.confidentialityAcceptedAt === null &&
        (participant.accessStatus === 'granted' || participant.invitationStatus === 'accepted'),
    },
  };
}

function supplierInvitation(supplierTenantId: number, participantId: number, fail: Fail) {
  const participant = TENDERS.flatMap((tender) => (participantOf(tender.id, supplierTenantId)?.id === participantId ? [participantOf(tender.id, supplierTenantId)] : []))[0];
  const tender = participant === undefined ? undefined : tenderById(participant.tenderId);
  if (participant === undefined || tender === undefined || !isInvitationRow(participant) || tender.releasedAt === null) {
    return fail(404, 'INVITATION_NOT_FOUND', 'No invitation or access request with this id for your organization.');
  }
  return { participant, tender };
}

function memberPersona(supplierTenantId: number, userId: number): Persona | undefined {
  return allPersonas().find(
    (persona) =>
      persona.userId === userId &&
      persona.status === 'active' &&
      persona.memberships.some((membership) => membership.tenantId === supplierTenantId && membership.status === 'active'),
  );
}

function memberPermissions(persona: Persona, supplierTenantId: number): PermissionCode[] {
  const membership = persona.memberships.find((entry) => entry.tenantId === supplierTenantId && entry.status === 'active');
  return membership === undefined ? [] : membershipPermissions(membership);
}

function pursuitDetail(pursuit: FixturePursuit, supplierTenantId: number): PursuitDetail {
  return {
    id: pursuit.id,
    tenderId: pursuit.tenderId,
    attractiveness: pursuit.attractiveness,
    capacityNote: pursuit.capacityNote,
    estimatedEffortHours: pursuit.estimatedEffortHours,
    risks: pursuit.risks,
    pursuitOwner: personOf(pursuit.pursuitOwnerUserId),
    decision: pursuit.decision,
    internalRationale: pursuit.internalRationale,
    decidedAt: pursuit.decidedAt,
    decidedBy: personOf(pursuit.decidedByUserId),
    team: pursuit.team.map((member) => ({
      id: member.id,
      user: personOf(member.userId) ?? { userId: member.userId, fullName: 'Former member' },
      capacity:
        memberPersona(supplierTenantId, member.userId)?.memberships.find((membership) => membership.tenantId === supplierTenantId)?.capacity ?? null,
      responsibility: member.responsibility,
      sectionScope: [...member.sectionScope],
      lotIds: [...member.lotIds],
      dueAt: member.dueAt,
      canViewPricing: member.canViewPricing,
    })),
    notes: sortRows(pursuit.notes, (note) => note.createdAt, 'desc').map((note) => ({
      id: note.id,
      author: personOf(note.authorUserId) ?? { userId: note.authorUserId, fullName: 'Former member' },
      body: note.body,
      createdAt: note.createdAt,
    })),
    createdAt: pursuit.createdAt,
    updatedAt: pursuit.updatedAt,
  };
}

/** A pursuit created on first save (static: the next GET still returns the fixture). */
function newPursuit(supplierTenantId: number, tender: FixtureTender, userId: number, now: Date): FixturePursuit {
  return {
    id: 900_000 + supplierTenantId * 1000 + tender.id,
    tenantId: supplierTenantId,
    buyerTenantId: tender.tenantId,
    tenderId: tender.id,
    attractiveness: null,
    capacityNote: null,
    estimatedEffortHours: null,
    risks: null,
    pursuitOwnerUserId: userId,
    decision: 'undecided',
    internalRationale: null,
    decidedAt: null,
    decidedByUserId: null,
    team: [],
    notes: [],
    createdAt: isoInstant(now),
    updatedAt: isoInstant(now),
  };
}

function requirePursuit(supplierTenantId: number, tenderId: number, fail: Fail): FixturePursuit {
  const pursuit = pursuitOf(supplierTenantId, tenderId);
  if (pursuit === undefined) {
    return fail(409, 'PURSUIT_NOT_STARTED', 'Save the pursuit assessment first.');
  }
  return pursuit;
}

function checkLots(tender: FixtureTender, lotIds: readonly number[], fail: Fail): void {
  for (const lotId of lotIds) {
    if (!tender.lots.some((entry) => entry.lotId === lotId)) {
      fail(422, 'LOT_NOT_FOUND', `Lot ${lotId} is not part of ${tender.reference}.`);
    }
  }
}

function checkSavedSearchReferences(body: { catalogCodes: readonly string[]; buyerTenantIds: readonly number[] }, fail: Fail): void {
  const unknownCategory = body.catalogCodes.find((code) => !isKnownCategory(code));
  if (unknownCategory !== undefined) {
    fail(422, 'UNKNOWN_CATEGORY', `Unknown category ${unknownCategory}.`);
  }
  const unknownBuyer = body.buyerTenantIds.find((id) => findTenantById(id)?.kind !== 'buyer');
  if (unknownBuyer !== undefined) {
    fail(422, 'UNKNOWN_BUYER', `No buyer organization with id ${unknownBuyer}.`);
  }
}

// ---------------------------------------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------------------------------------

export function registerSupplier(app: MockApp): void {
  mockRoute(app, listOpportunities, ({ requireTenant, requirePersona, query, now, fail, fixtures }) => {
    const supplierId = requireTenant().tenant.id;
    const userId = requirePersona().userId;
    if (isInvertedRange(query.closingFrom, query.closingTo)) {
      return fail(422, 'INVALID_DATE_RANGE', 'The start date must not be after the end date.');
    }
    let savedSearch: FixtureSavedSearch | undefined;
    if (query.savedSearchId !== undefined) {
      savedSearch = SAVED_SEARCHES.find((entry) => entry.id === query.savedSearchId && entry.tenantId === supplierId && entry.userId === userId);
      if (savedSearch === undefined) {
        return fail(404, 'SAVED_SEARCH_NOT_FOUND', 'No saved search with this id.');
      }
    }
    const rows = visibleTenders(supplierId)
      .filter((tender) => savedSearch === undefined || savedSearchMatches(savedSearch, tender))
      .filter((tender) => query.buyer === undefined || query.buyer.includes(tender.tenantId))
      .filter((tender) => query.category === undefined || categoryCovers(query.category, tender))
      .filter((tender) => query.region === undefined || tender.regions.some((region) => query.region?.includes(region)))
      .filter((tender) => query.procedure === undefined || query.procedure.includes(tender.procedure))
      .filter((tender) => query.eventType === undefined || query.eventType.includes(tender.eventType))
      .filter((tender) => query.status === undefined || query.status.includes(tender.status))
      .filter((tender) => inDateRange(tender.submissionDeadline, query.closingFrom, query.closingTo))
      .filter((tender) => matchesText(query.q, tender.reference, tender.title, tender.summary, buyerLabel(tender.tenantId).name))
      .map((tender) => opportunityRow(tender, supplierId, userId, now))
      .filter((row) => query.includeDismissed === true || !row.dismissed)
      .filter((row) => query.matchedOnly !== true || row.match.isMatch)
      .filter((row) => query.watchedOnly !== true || row.watchlistItemId !== null)
      .filter((row) => query.participatingOnly !== true || row.participation !== null);
    const sort = query.sort ?? 'publishedAt';
    const dir = query.sort === undefined ? 'desc' : query.dir;
    return fixtures.page(
      sortRows(
        rows,
        (row) =>
          sort === 'closingAt'
            ? (row.closingAt?.at ?? null)
            : sort === 'title'
              ? row.tender.title
              : sort === 'buyer'
                ? row.buyer.name
                : sort === 'match'
                  ? row.match.reasons.filter((reason) => reason.kind !== 'region').length
                  : row.publishedAt,
        dir,
      ),
    );
  });

  mockRoute(app, getOpportunityFilters, ({ requireTenant }) => {
    const supplierId = requireTenant().tenant.id;
    const tenders = visibleTenders(supplierId);
    const profile = SUPPLIER_PROFILES.find((entry) => entry.tenantId === supplierId);
    const count = (values: ReadonlyArray<{ value: string; label: string }>) => {
      const counts = new Map<string, { value: string; label: string; count: number }>();
      for (const entry of values) {
        counts.set(entry.value, { ...entry, count: (counts.get(entry.value)?.count ?? 0) + 1 });
      }
      return sortRows([...counts.values()], (option) => option.label, 'asc');
    };
    return {
      buyers: count(tenders.map((tender) => ({ value: String(tender.tenantId), label: buyerLabel(tender.tenantId).name }))),
      categories: count(tenders.map((tender) => ({ value: tender.categoryCode, label: categoryOf(tender.categoryCode).name }))),
      regions: count(tenders.flatMap((tender) => tender.regions.map((region) => ({ value: region, label: region })))),
      procedures: count(tenders.map((tender) => ({ value: tender.procedure, label: enumLabel('tenders.procedure', tender.procedure) }))),
      eventTypes: count(tenders.map((tender) => ({ value: tender.eventType, label: enumLabel('tenders.event_type', tender.eventType) }))),
      statuses: count(tenders.map((tender) => ({ value: tender.status, label: enumLabel('tenders.status', tender.status) }))),
      profileCategories: (profile?.catalogCodes ?? []).map(categoryOf),
      profileRegions: [...(profile?.serviceAreas ?? [])],
      total: tenders.length,
    };
  });

  mockRoute(app, getOpportunityWorkspace, ({ requireTenant, requirePersona, params, now, fail }) => {
    const access = requireTenant();
    const tender = visibleTender(access.tenant.id, params.tenderId, fail);
    return workspaceOf(tender, access.tenant.id, requirePersona().userId, access.permissions, now);
  });

  mockRoute(app, dismissOpportunity, ({ requireTenant, requirePersona, params, now, fail }) => {
    const supplierId = requireTenant().tenant.id;
    const tender = visibleTender(supplierId, params.tenderId, fail);
    if (isDismissed(supplierId, requirePersona().userId, tender.id)) {
      return fail(409, 'ALREADY_DISMISSED', 'This suggestion is already dismissed.');
    }
    return { tenderId: tender.id, dismissed: true, dismissedAt: isoInstant(now) };
  });

  mockRoute(app, restoreOpportunity, ({ requireTenant, requirePersona, params, now, fail }) => {
    const supplierId = requireTenant().tenant.id;
    const tender = visibleTender(supplierId, params.tenderId, fail);
    if (!isDismissed(supplierId, requirePersona().userId, tender.id)) {
      return fail(409, 'NOT_DISMISSED', 'This suggestion is not dismissed.');
    }
    return { tenderId: tender.id, dismissed: false as const, restoredAt: isoInstant(now) };
  });

  mockRoute(app, registerInterest, ({ requireTenant, params, now, fail }) => {
    const supplierId = requireTenant().tenant.id;
    const tender = visibleTender(supplierId, params.tenderId, fail);
    if (participantOf(tender.id, supplierId) !== undefined) {
      return fail(409, 'ALREADY_PARTICIPATING', 'Your organization already takes part in this event.');
    }
    if (tender.participation !== 'open') {
      return fail(409, 'INVITATION_ONLY', 'This event is open to invited or admitted suppliers only.');
    }
    if (!isAcceptingResponses(tender, now)) {
      return fail(409, 'NOTICE_NOT_OPEN', 'This event no longer accepts participants.');
    }
    const qualification = qualificationFor(tender, supplierId);
    return {
      participantId: 900_000 + tender.id * 100 + supplierId,
      source: 'registered_interest' as const,
      invitationStatus: 'not_invited' as const,
      accessStatus: 'not_required' as const,
      confidentialityAcceptedAt: null,
      bidIntent: 'undecided' as const,
      sharedNoBidReason: null,
      intentChangedAt: null,
      qualificationGate:
        qualification === null
          ? ('not_required' as const)
          : qualification.effectiveStatus === 'qualified' || qualification.effectiveStatus === 'qualified_with_conditions'
            ? ('met' as const)
            : ('not_met' as const),
      selectedLotIds: tender.lots.length === 1 && tender.lots[0] !== undefined ? [tender.lots[0].lotId] : [],
    };
  });

  mockRoute(app, requestAccess, ({ requireTenant, params, now, fail }) => {
    const supplierId = requireTenant().tenant.id;
    const tender = requestableTender(supplierId, params.tenderId, fail);
    if (!requiresAccessDecision(tender)) {
      return fail(409, 'ACCESS_NOT_REQUIRED', 'This event’s documents need no access decision.');
    }
    if (!isAcceptingResponses(tender, now)) {
      return fail(409, 'NOTICE_NOT_OPEN', 'This event no longer accepts access requests.');
    }
    const participant = participantOf(tender.id, supplierId);
    if (participant?.accessStatus === 'requested') {
      return fail(409, 'ACCESS_ALREADY_REQUESTED', 'Your access request awaits the buyer’s decision.');
    }
    if (participant?.accessStatus === 'granted') {
      return fail(409, 'ACCESS_ALREADY_GRANTED', 'Access is already granted.');
    }
    const base =
      participant === undefined
        ? {
            participantId: 900_000 + tender.id * 100 + supplierId,
            source: 'access_request' as const,
            invitationStatus: 'not_invited' as const,
            confidentialityAcceptedAt: null,
            bidIntent: 'undecided' as const,
            sharedNoBidReason: null,
            intentChangedAt: null,
            qualificationGate: 'not_required' as const,
            selectedLotIds: [],
          }
        : ownParticipation(participant);
    return { ...base, accessStatus: 'requested' as const };
  });

  mockRoute(app, acceptConfidentiality, ({ requireTenant, params, now, fail }) => {
    const supplierId = requireTenant().tenant.id;
    const tender = visibleTender(supplierId, params.tenderId, fail);
    const participant = requireParticipant(tender, supplierId, fail);
    if (!requiresConfidentiality(tender)) {
      return fail(409, 'CONFIDENTIALITY_NOT_REQUIRED', 'This event has no confidentiality undertaking.');
    }
    if (participant.confidentialityAcceptedAt !== null) {
      return fail(409, 'CONFIDENTIALITY_ALREADY_ACCEPTED', `Accepted on ${officialText(participant.confidentialityAcceptedAt, tender.officialTimeZone)}.`);
    }
    if (participant.accessStatus === 'requested' || participant.accessStatus === 'denied' || participant.invitationStatus === 'invited') {
      return fail(409, 'ACCESS_NOT_GRANTED', 'Access must be granted (or the invitation accepted) first.');
    }
    return { ...ownParticipation(participant), confidentialityAcceptedAt: isoInstant(now) };
  });

  mockRoute(app, acknowledgeSubject, ({ requireTenant, requirePersona, params, body, now, fail }) => {
    const supplierId = requireTenant().tenant.id;
    const persona = requirePersona();
    const tender = visibleTender(supplierId, params.tenderId, fail);
    const participant = requireParticipant(tender, supplierId, fail);
    const already = participant.acknowledgments.some((ack) => ack.subjectType === body.subjectType && ack.subjectId === body.subjectId);
    switch (body.subjectType) {
      case 'addendum': {
        const addendum = tender.addenda.find((entry) => entry.addendumId === body.subjectId);
        if (addendum === undefined) {
          return fail(404, 'SUBJECT_NOT_FOUND', 'No issued addendum with this id in the event.');
        }
        if (!addendum.acknowledgmentRequired) {
          return fail(409, 'ACKNOWLEDGMENT_NOT_REQUIRED', 'This addendum needs no acknowledgment.');
        }
        break;
      }
      case 'participation_condition':
        if (!tender.conditions.some((condition) => condition.conditionId === body.subjectId)) {
          return fail(404, 'SUBJECT_NOT_FOUND', 'No participation condition with this id in the event.');
        }
        break;
      case 'tender_version':
        if (!tender.versions.some((version) => version.versionNo === body.subjectId)) {
          return fail(404, 'SUBJECT_NOT_FOUND', 'No issued version with this number.');
        }
        break;
      case 'notice':
        if (!participant.deliveries.some((delivery) => delivery.noticeId === body.subjectId)) {
          return fail(404, 'SUBJECT_NOT_FOUND', 'No notice with this id was sent to your organization.');
        }
        break;
    }
    if (already) {
      return fail(409, 'ALREADY_ACKNOWLEDGED', 'Already acknowledged for your organization.');
    }
    return {
      participantId: participant.id,
      subjectType: body.subjectType,
      subjectId: body.subjectId,
      acknowledgedAt: isoInstant(now),
      acknowledgedBy: { userId: persona.userId, fullName: persona.fullName },
    };
  });

  mockRoute(app, selectLots, ({ requireTenant, params, body, now, fail }) => {
    const supplierId = requireTenant().tenant.id;
    const tender = visibleTender(supplierId, params.tenderId, fail);
    const participant = requireParticipant(tender, supplierId, fail);
    for (const lotId of body.lotIds) {
      const entry = tender.lots.find((candidate) => candidate.lotId === lotId);
      if (entry === undefined) {
        return fail(422, 'LOT_NOT_FOUND', `Lot ${lotId} is not part of ${tender.reference}.`);
      }
      if (entry.stage !== 'open' || !isAcceptingResponses(tender, now)) {
        return fail(409, 'LOT_NOT_OPEN', `Lot ${entry.lotNo} is not open for responses.`);
      }
    }
    if (blockedByQualification(tender, participant)) {
      return fail(409, 'LOT_NOT_ELIGIBLE', 'The qualification gate of this event is not met.');
    }
    if (tender.maxLotsPerSupplier !== null && body.lotIds.length > tender.maxLotsPerSupplier) {
      return fail(422, 'MAX_LOTS_EXCEEDED', `At most ${tender.maxLotsPerSupplier} lots per supplier.`);
    }
    return { participantId: participant.id, selectedLotIds: [...body.lotIds], updatedAt: isoInstant(now) };
  });

  mockRoute(app, downloadOpportunityDocument, ({ requireTenant, params, now, fail }) => {
    const supplierId = requireTenant().tenant.id;
    const tender = visibleTender(supplierId, params.tenderId, fail);
    const document = tender.documents.find((entry) => entry.documentId === params.documentId);
    if (document === undefined) {
      return fail(404, 'DOCUMENT_NOT_FOUND', 'No document with this id in the package.');
    }
    const participant = participantOf(tender.id, supplierId);
    const lock = documentLock(tender, document, participant);
    if (lock !== null) {
      const confidentialityOnly =
        document.accessRule === 'confidential' &&
        participant !== undefined &&
        participant.confidentialityAcceptedAt === null &&
        documentLock(tender, { ...document, accessRule: 'participants' }, participant) === null &&
        hasDocumentAccess(tender, participant);
      return confidentialityOnly
        ? fail(403, 'CONFIDENTIALITY_NOT_ACCEPTED', lock)
        : fail(403, 'DOCUMENT_ACCESS_NOT_GRANTED', lock);
    }
    return downloadLinkOf(document, now);
  });

  mockRoute(app, startResponse, ({ requireTenant, params, now, fail }) => {
    const supplierId = requireTenant().tenant.id;
    const tender = visibleTender(supplierId, params.tenderId, fail);
    const participant = requireParticipant(tender, supplierId, fail);
    if (!isAcceptingResponses(tender, now)) {
      return fail(409, 'NOTICE_NOT_OPEN', 'The response window is closed.');
    }
    const readiness = readinessOf(tender, participant, now);
    const blocking = readiness.filter((check) => check.status === 'blocking');
    if (blocking.length > 0) {
      return fail(409, 'READINESS_BLOCKED', `Resolve first: ${blocking.map((check) => check.label).join('; ')}.`);
    }
    return { tenderId: tender.id, participantId: participant.id, readiness, nextPath: `/supplier/responses?tenderId=${tender.id}` };
  });

  // Watchlist ----------------------------------------------------------------------------------------------------

  mockRoute(app, listWatchlist, ({ requireTenant, requirePersona, query, now, fixtures }) => {
    const supplierId = requireTenant().tenant.id;
    const userId = requirePersona().userId;
    const rows = WATCHLIST_ITEMS.filter((item) => item.tenantId === supplierId && item.userId === userId).flatMap((item) => {
      const tender = tenderById(item.tenderId);
      return tender === undefined || !isVisibleToSupplier(tender, supplierId) ? [] : [watchlistItem(item, tender, now)];
    });
    const filtered = rows
      .filter((row) => query.status === undefined || query.status.includes(row.tender.status))
      .filter((row) => matchesText(query.q, row.tender.reference, row.tender.title, row.buyer.name));
    const sort = query.sort ?? 'closingAt';
    return fixtures.page(
      sortRows(filtered, (row) => (sort === 'addedAt' ? row.addedAt : sort === 'title' ? row.tender.title : (row.closingAt?.at ?? null)), query.dir),
    );
  });

  mockRoute(app, addToWatchlist, ({ requireTenant, requirePersona, body, now, fail }) => {
    const supplierId = requireTenant().tenant.id;
    const userId = requirePersona().userId;
    const tender = visibleTender(supplierId, body.tenderId, fail);
    if (watchItemOf(supplierId, userId, tender.id) !== undefined) {
      return fail(409, 'ALREADY_WATCHED', 'This opportunity is already on your watchlist.');
    }
    return watchlistItem({ id: 900 + tender.id, tenantId: supplierId, userId, tenderId: tender.id, addedAt: isoInstant(now) }, tender, now);
  });

  mockRoute(app, removeFromWatchlist, ({ requireTenant, requirePersona, params, fail }) => {
    const supplierId = requireTenant().tenant.id;
    const userId = requirePersona().userId;
    if (!WATCHLIST_ITEMS.some((item) => item.id === params.watchlistItemId && item.tenantId === supplierId && item.userId === userId)) {
      return fail(404, 'WATCHLIST_ITEM_NOT_FOUND', 'No watchlist item with this id.');
    }
    return null;
  });

  // Saved searches -------------------------------------------------------------------------------------------------

  mockRoute(app, listSavedSearches, ({ requireTenant, requirePersona, query, fixtures }) => {
    const supplierId = requireTenant().tenant.id;
    const userId = requirePersona().userId;
    const rows = SAVED_SEARCHES.filter((search) => search.tenantId === supplierId && search.userId === userId)
      .filter((search) => matchesText(query.q, search.name, search.keywords))
      .map(savedSearchOf);
    return fixtures.page(sortRows(rows, (row) => (query.sort === 'updatedAt' ? row.updatedAt : row.name), query.dir));
  });

  mockRoute(app, createSavedSearch, ({ requireTenant, requirePersona, body, now, fail }) => {
    const supplierId = requireTenant().tenant.id;
    const userId = requirePersona().userId;
    if (SAVED_SEARCHES.some((search) => search.tenantId === supplierId && search.userId === userId && search.name.toLowerCase() === body.name.toLowerCase())) {
      return fail(409, 'DUPLICATE_SAVED_SEARCH_NAME', 'You already have a saved search with this name.');
    }
    checkSavedSearchReferences(body, fail);
    return savedSearchOf({ id: 900, tenantId: supplierId, userId, ...body, createdAt: isoInstant(now), updatedAt: isoInstant(now) });
  });

  mockRoute(app, updateSavedSearch, ({ requireTenant, requirePersona, params, body, now, fail }) => {
    const supplierId = requireTenant().tenant.id;
    const userId = requirePersona().userId;
    const existing = SAVED_SEARCHES.find((search) => search.id === params.savedSearchId && search.tenantId === supplierId && search.userId === userId);
    if (existing === undefined) {
      return fail(404, 'SAVED_SEARCH_NOT_FOUND', 'No saved search with this id.');
    }
    if (
      SAVED_SEARCHES.some(
        (search) => search.id !== existing.id && search.tenantId === supplierId && search.userId === userId && search.name.toLowerCase() === body.name.toLowerCase(),
      )
    ) {
      return fail(409, 'DUPLICATE_SAVED_SEARCH_NAME', 'You already have a saved search with this name.');
    }
    checkSavedSearchReferences(body, fail);
    return savedSearchOf({ ...existing, ...body, updatedAt: isoInstant(now) });
  });

  mockRoute(app, deleteSavedSearch, ({ requireTenant, requirePersona, params, fail }) => {
    const supplierId = requireTenant().tenant.id;
    const userId = requirePersona().userId;
    if (!SAVED_SEARCHES.some((search) => search.id === params.savedSearchId && search.tenantId === supplierId && search.userId === userId)) {
      return fail(404, 'SAVED_SEARCH_NOT_FOUND', 'No saved search with this id.');
    }
    return null;
  });

  // Subscriptions ----------------------------------------------------------------------------------------------------

  mockRoute(app, listSubscriptions, ({ requireTenant, requirePersona, query, fixtures }) => {
    const supplierId = requireTenant().tenant.id;
    const userId = requirePersona().userId;
    const rows = SUBSCRIPTIONS.filter((subscription) => subscription.tenantId === supplierId && subscription.userId === userId)
      .filter((subscription) => query.active === undefined || subscription.active === query.active)
      .map(subscriptionOf)
      .filter((row) => matchesText(query.q, row.buyer?.name, row.category?.name, row.category?.code));
    return fixtures.page(sortRows(rows, (row) => row.createdAt, query.dir));
  });

  mockRoute(app, createSubscription, ({ requireTenant, requirePersona, body, now, fail }) => {
    const supplierId = requireTenant().tenant.id;
    const userId = requirePersona().userId;
    if (body.catalogCode !== null && !isKnownCategory(body.catalogCode)) {
      return fail(422, 'UNKNOWN_CATEGORY', `Unknown category ${body.catalogCode}.`);
    }
    if (body.buyerTenantId !== null && findTenantById(body.buyerTenantId)?.kind !== 'buyer') {
      return fail(422, 'UNKNOWN_BUYER', `No buyer organization with id ${body.buyerTenantId}.`);
    }
    if (
      SUBSCRIPTIONS.some(
        (subscription) =>
          subscription.tenantId === supplierId &&
          subscription.userId === userId &&
          subscription.buyerTenantId === body.buyerTenantId &&
          subscription.catalogCode === body.catalogCode,
      )
    ) {
      return fail(409, 'SUBSCRIPTION_EXISTS', 'You already subscribe to these notices.');
    }
    return subscriptionOf({ id: 900, tenantId: supplierId, userId, buyerTenantId: body.buyerTenantId, catalogCode: body.catalogCode, active: true, createdAt: isoInstant(now) });
  });

  mockRoute(app, updateSubscription, ({ requireTenant, requirePersona, params, body, fail }) => {
    const supplierId = requireTenant().tenant.id;
    const userId = requirePersona().userId;
    const existing = SUBSCRIPTIONS.find((subscription) => subscription.id === params.subscriptionId && subscription.tenantId === supplierId && subscription.userId === userId);
    if (existing === undefined) {
      return fail(404, 'SUBSCRIPTION_NOT_FOUND', 'No subscription with this id.');
    }
    return subscriptionOf({ ...existing, active: body.active });
  });

  mockRoute(app, deleteSubscription, ({ requireTenant, requirePersona, params, fail }) => {
    const supplierId = requireTenant().tenant.id;
    const userId = requirePersona().userId;
    if (!SUBSCRIPTIONS.some((subscription) => subscription.id === params.subscriptionId && subscription.tenantId === supplierId && subscription.userId === userId)) {
      return fail(404, 'SUBSCRIPTION_NOT_FOUND', 'No subscription with this id.');
    }
    return null;
  });

  // Invitations and access requests (SUP-07) ------------------------------------------------------------------------

  mockRoute(app, listInvitations, ({ requireTenant, query, fail, fixtures }) => {
    const supplierId = requireTenant().tenant.id;
    if (isInvertedRange(query.closingFrom, query.closingTo)) {
      return fail(422, 'INVALID_DATE_RANGE', 'The start date must not be after the end date.');
    }
    const rows = TENDERS.filter((tender) => tender.releasedAt !== null)
      .flatMap((tender) => {
        const participant = participantOf(tender.id, supplierId);
        return participant !== undefined && isInvitationRow(participant) ? [invitationRow(participant, tender)] : [];
      })
      .filter((row) => query.kind === undefined || query.kind.includes(row.kind))
      .filter((row) => query.invitationStatus === undefined || query.invitationStatus.includes(row.invitationStatus))
      .filter((row) => query.accessStatus === undefined || query.accessStatus.includes(row.accessStatus))
      .filter((row) => query.buyer === undefined || query.buyer.includes(row.buyer.tenantId))
      .filter((row) => query.awaitingResponse === undefined || row.awaitingResponse === query.awaitingResponse)
      .filter((row) => inDateRange(row.closingAt?.at ?? null, query.closingFrom, query.closingTo))
      .filter((row) => matchesText(query.q, row.tender.reference, row.tender.title, row.buyer.name));
    const sort = query.sort ?? 'closingAt';
    return fixtures.page(
      sortRows(
        rows,
        (row) =>
          sort === 'invitedAt'
            ? (row.invitedAt ?? row.accessRequestedAt)
            : sort === 'buyer'
              ? row.buyer.name
              : sort === 'status'
                ? row.kind === 'invitation'
                  ? row.invitationStatus
                  : row.accessStatus
                : (row.closingAt?.at ?? null),
        query.dir,
      ),
    );
  });

  mockRoute(app, getInvitation, ({ requireTenant, params, fail }) => {
    const access = requireTenant();
    const { participant, tender } = supplierInvitation(access.tenant.id, params.participantId, fail);
    return invitationDetail(participant, tender, access.permissions);
  });

  mockRoute(app, acceptInvitation, ({ requireTenant, requirePersona, params, body, now, fail }) => {
    const access = requireTenant();
    const persona = requirePersona();
    const { participant, tender } = supplierInvitation(access.tenant.id, params.participantId, fail);
    if (participant.source !== 'invited') {
      return fail(409, 'NOT_AN_INVITATION', 'This is an access request, not an invitation.');
    }
    if (participant.invitationStatus !== 'invited') {
      return fail(409, 'INVITATION_NOT_PENDING', `The invitation is already ${participant.invitationStatus}.`);
    }
    if (participant.invitationExpiresAt !== null && new Date(participant.invitationExpiresAt) <= now) {
      return fail(409, 'INVITATION_EXPIRED', 'The invitation has expired.');
    }
    if (requiresConfidentiality(tender) && !body.acceptConfidentiality) {
      return fail(422, 'CONFIDENTIALITY_ACCEPTANCE_REQUIRED', 'This invitation requires the confidentiality undertaking.');
    }
    const at = isoInstant(now);
    const accepted: FixtureParticipant = {
      ...participant,
      invitationStatus: 'accepted',
      respondedAt: at,
      confidentialityAcceptedAt: requiresConfidentiality(tender) ? at : participant.confidentialityAcceptedAt,
      confidentialityAcceptedByUserId: requiresConfidentiality(tender) ? persona.userId : participant.confidentialityAcceptedByUserId,
      history: [
        ...participant.history,
        { at, actorUserId: persona.userId, actorTenantId: access.tenant.id, event: 'invitation_accepted', detail: `Accepted for ${access.tenant.legalName}.` },
      ],
    };
    return invitationDetail(accepted, tender, access.permissions);
  });

  mockRoute(app, declineInvitation, ({ requireTenant, requirePersona, params, body, now, fail }) => {
    const access = requireTenant();
    const persona = requirePersona();
    const { participant, tender } = supplierInvitation(access.tenant.id, params.participantId, fail);
    if (participant.source !== 'invited') {
      return fail(409, 'NOT_AN_INVITATION', 'This is an access request, not an invitation.');
    }
    if (participant.invitationStatus !== 'invited') {
      return fail(409, 'INVITATION_NOT_PENDING', `The invitation is already ${participant.invitationStatus}.`);
    }
    if (participant.invitationExpiresAt !== null && new Date(participant.invitationExpiresAt) <= now) {
      return fail(409, 'INVITATION_EXPIRED', 'The invitation has expired.');
    }
    const at = isoInstant(now);
    const shared = body.shareReasonWithBuyer ? (body.sharedReason ?? null) : null;
    const declined: FixtureParticipant = {
      ...participant,
      invitationStatus: 'declined',
      respondedAt: at,
      bidIntent: 'no_bid',
      sharedNoBidReason: shared,
      intentChangedAt: at,
      history: [
        ...participant.history,
        {
          at,
          actorUserId: persona.userId,
          actorTenantId: access.tenant.id,
          event: 'invitation_declined',
          detail: shared === null ? 'Declined without a shared reason.' : `Declined; reason shared with the buyer: ${shared}`,
        },
      ],
    };
    return invitationDetail(declined, tender, access.permissions);
  });

  // Pursuit (SUP-09) ---------------------------------------------------------------------------------------------------

  mockRoute(app, listPursuits, ({ requireTenant, requirePersona, query, fail, fixtures }) => {
    const supplierId = requireTenant().tenant.id;
    const userId = requirePersona().userId;
    if (isInvertedRange(query.closingFrom, query.closingTo)) {
      return fail(422, 'INVALID_DATE_RANGE', 'The start date must not be after the end date.');
    }
    const rows = PURSUITS.filter((pursuit) => pursuit.tenantId === supplierId)
      .filter((pursuit) => query.decision === undefined || query.decision.includes(pursuit.decision))
      .filter((pursuit) => query.ownerUserId === undefined || pursuit.pursuitOwnerUserId === query.ownerUserId)
      .filter((pursuit) => query.mine !== true || pursuit.pursuitOwnerUserId === userId || pursuit.team.some((member) => member.userId === userId))
      .flatMap((pursuit) => {
        const tender = tenderById(pursuit.tenderId);
        if (tender === undefined || !isVisibleToSupplier(tender, supplierId)) {
          return [];
        }
        return [
          {
            id: pursuit.id,
            tender: tenderLabel(tender),
            buyer: buyerLabel(tender.tenantId),
            closingAt: closingAt(tender),
            decision: pursuit.decision,
            attractiveness: pursuit.attractiveness,
            estimatedEffortHours: pursuit.estimatedEffortHours,
            pursuitOwner: personOf(pursuit.pursuitOwnerUserId),
            teamSize: pursuit.team.length,
            bidIntent: participantOf(tender.id, supplierId)?.bidIntent ?? null,
            updatedAt: pursuit.updatedAt,
            linkPath: `/supplier/opportunities/${tender.id}/pursuit`,
          },
        ];
      })
      .filter((row) => inDateRange(row.closingAt?.at ?? null, query.closingFrom, query.closingTo))
      .filter((row) => matchesText(query.q, row.tender.reference, row.tender.title, row.buyer.name));
    const sort = query.sort ?? 'closingAt';
    return fixtures.page(
      sortRows(
        rows,
        (row) => (sort === 'updatedAt' ? row.updatedAt : sort === 'attractiveness' ? row.attractiveness : sort === 'title' ? row.tender.title : (row.closingAt?.at ?? null)),
        query.dir,
      ),
    );
  });

  mockRoute(app, listPursuitTeamCandidates, ({ requireTenant }) => {
    const supplierId = requireTenant().tenant.id;
    const items = allPersonas()
      .filter((persona) => memberPersona(supplierId, persona.userId) !== undefined)
      .map((persona) => {
        const membership = persona.memberships.find((entry) => entry.tenantId === supplierId && entry.status === 'active');
        const permissions = memberPermissions(persona, supplierId);
        return {
          user: { userId: persona.userId, fullName: persona.fullName },
          capacity: membership?.capacity ?? null,
          roleNames: (membership?.roles ?? []).map((role) => findTenantRole(supplierId, role.roleCode)?.name ?? role.roleCode),
          canViewPricing: permissions.includes('supplier.pricing.edit'),
          canSubmit: permissions.includes('supplier.response.submit'),
        };
      });
    return { items: sortRows(items, (item) => item.user.fullName, 'asc') };
  });

  mockRoute(app, getPursuit, ({ requireTenant, params, now, fail }) => {
    const access = requireTenant();
    const supplierId = access.tenant.id;
    const tender = visibleTender(supplierId, params.tenderId, fail);
    const pursuit = pursuitOf(supplierId, tender.id);
    const participant = participantOf(tender.id, supplierId);
    const canManage = has(access.permissions, 'supplier.pursuit.manage');
    return {
      tender: { ...tenderLabel(tender), closingAt: closingAt(tender), isAcceptingResponses: isAcceptingResponses(tender, now) },
      buyer: buyerLabel(tender.tenantId),
      lots: tender.lots.map((entry) => ({ lotId: entry.lotId, lotNo: entry.lotNo, title: entry.title })),
      pursuit: pursuit === undefined ? null : pursuitDetail(pursuit, supplierId),
      buyerVisible: {
        participantId: participant?.id ?? null,
        bidIntent: participant?.bidIntent ?? 'undecided',
        sharedNoBidReason: participant?.sharedNoBidReason ?? null,
        intentChangedAt: participant?.intentChangedAt ?? null,
      },
      capabilities: {
        canManage,
        canNotifyBuyer: canManage && participant !== undefined && isAcceptingResponses(tender, now),
      },
    };
  });

  mockRoute(app, savePursuit, ({ requireTenant, requirePersona, params, body, now, fail }) => {
    const supplierId = requireTenant().tenant.id;
    const persona = requirePersona();
    const tender = visibleTender(supplierId, params.tenderId, fail);
    if (body.pursuitOwnerUserId !== null && memberPersona(supplierId, body.pursuitOwnerUserId) === undefined) {
      return fail(422, 'PURSUIT_OWNER_NOT_MEMBER', 'The pursuit owner must be an active member of your organization.');
    }
    const existing = pursuitOf(supplierId, tender.id) ?? newPursuit(supplierId, tender, persona.userId, now);
    return pursuitDetail({ ...existing, ...body, updatedAt: isoInstant(now) }, supplierId);
  });

  mockRoute(app, decidePursuit, ({ requireTenant, requirePersona, params, body, now, fail }) => {
    const supplierId = requireTenant().tenant.id;
    const persona = requirePersona();
    const tender = visibleTender(supplierId, params.tenderId, fail);
    if (!isAcceptingResponses(tender, now)) {
      return fail(409, 'OPPORTUNITY_CLOSED', 'The decision can be revised only while the event is open.');
    }
    const existing = pursuitOf(supplierId, tender.id) ?? newPursuit(supplierId, tender, persona.userId, now);
    if (existing.decision === body.decision && existing.internalRationale === body.internalRationale) {
      return fail(409, 'DECISION_UNCHANGED', 'This is already the recorded decision.');
    }
    const at = isoInstant(now);
    return pursuitDetail(
      { ...existing, decision: body.decision, internalRationale: body.internalRationale, decidedAt: at, decidedByUserId: persona.userId, updatedAt: at },
      supplierId,
    );
  });

  mockRoute(app, notifyBuyerOfIntent, ({ requireTenant, params, body, now, fail }) => {
    const supplierId = requireTenant().tenant.id;
    const tender = visibleTender(supplierId, params.tenderId, fail);
    const participant = requireParticipant(tender, supplierId, fail);
    if (!isAcceptingResponses(tender, now)) {
      return fail(409, 'OPPORTUNITY_CLOSED', 'The buyer can be notified only while the event is open.');
    }
    const reason = body.bidIntent === 'no_bid' ? (body.sharedNoBidReason ?? null) : null;
    if (participant.bidIntent === body.bidIntent && participant.sharedNoBidReason === reason) {
      return fail(409, 'INTENT_UNCHANGED', 'The buyer already sees this intent.');
    }
    return { participantId: participant.id, bidIntent: body.bidIntent, sharedNoBidReason: reason, intentChangedAt: isoInstant(now) };
  });

  mockRoute(app, addPursuitTeamMember, ({ requireTenant, params, body, fail }) => {
    const supplierId = requireTenant().tenant.id;
    const tender = visibleTender(supplierId, params.tenderId, fail);
    const pursuit = requirePursuit(supplierId, tender.id, fail);
    const member = memberPersona(supplierId, body.userId);
    if (member === undefined) {
      return fail(422, 'USER_NOT_MEMBER', 'Only active members of your organization can join the bid team.');
    }
    if (pursuit.team.some((entry) => entry.userId === body.userId)) {
      return fail(409, 'ALREADY_ON_TEAM', `${member.fullName} is already on the bid team.`);
    }
    if (body.canViewPricing && !memberPermissions(member, supplierId).includes('supplier.pricing.edit')) {
      return fail(422, 'PRICING_ACCESS_NOT_PERMITTED', `${member.fullName} has no pricing permission in your organization.`);
    }
    checkLots(tender, body.lotIds, fail);
    return {
      id: pursuit.id * 10 + 5,
      user: { userId: member.userId, fullName: member.fullName },
      capacity: member.memberships.find((membership) => membership.tenantId === supplierId)?.capacity ?? null,
      responsibility: body.responsibility,
      sectionScope: body.sectionScope,
      lotIds: body.lotIds,
      dueAt: body.dueAt,
      canViewPricing: body.canViewPricing,
    };
  });

  mockRoute(app, updatePursuitTeamMember, ({ requireTenant, params, body, fail }) => {
    const supplierId = requireTenant().tenant.id;
    const tender = visibleTender(supplierId, params.tenderId, fail);
    const pursuit = requirePursuit(supplierId, tender.id, fail);
    const existing = pursuit.team.find((entry) => entry.id === params.memberId);
    if (existing === undefined) {
      return fail(404, 'MEMBER_NOT_FOUND', 'No bid-team member with this id.');
    }
    const member = memberPersona(supplierId, existing.userId);
    if (body.canViewPricing && (member === undefined || !memberPermissions(member, supplierId).includes('supplier.pricing.edit'))) {
      return fail(422, 'PRICING_ACCESS_NOT_PERMITTED', 'This member has no pricing permission in your organization.');
    }
    checkLots(tender, body.lotIds, fail);
    return {
      id: existing.id,
      user: personOf(existing.userId) ?? { userId: existing.userId, fullName: 'Former member' },
      capacity: member?.memberships.find((membership) => membership.tenantId === supplierId)?.capacity ?? null,
      ...body,
    };
  });

  mockRoute(app, removePursuitTeamMember, ({ requireTenant, params, fail }) => {
    const supplierId = requireTenant().tenant.id;
    const tender = visibleTender(supplierId, params.tenderId, fail);
    const pursuit = requirePursuit(supplierId, tender.id, fail);
    const existing = pursuit.team.find((entry) => entry.id === params.memberId);
    if (existing === undefined) {
      return fail(404, 'MEMBER_NOT_FOUND', 'No bid-team member with this id.');
    }
    if (existing.responsibility === 'bid_manager' && pursuit.team.filter((entry) => entry.responsibility === 'bid_manager').length === 1) {
      return fail(409, 'LAST_BID_MANAGER', 'Assign another bid manager before removing the last one.');
    }
    return null;
  });

  mockRoute(app, addPursuitNote, ({ requireTenant, requirePersona, params, body, now, fail }) => {
    const supplierId = requireTenant().tenant.id;
    const persona = requirePersona();
    const tender = visibleTender(supplierId, params.tenderId, fail);
    const pursuit = requirePursuit(supplierId, tender.id, fail);
    return { id: pursuit.id * 10 + 9, author: { userId: persona.userId, fullName: persona.fullName }, body: body.body, createdAt: isoInstant(now) };
  });
}
