/**
 * Projections of the selection fixtures onto the selection contract, and the business gates the fixtures imply
 * (AC-21..AC-24, BR-30, BR-31). Pure functions over `fixtures/selection`; the handlers filter by tenant first.
 */
import type { PersonRef } from '../../../contracts/common.js';
import type {
  AssessmentSessionDetail,
  AssessmentSessionRow,
  DueDiligenceCaseDetail,
  DueDiligenceCaseRow,
  DueDiligenceFinding,
  EqualTreatmentCheck,
  FinalOfferRoundDetail,
  FinalOfferRoundRow,
  NegotiationDetail,
  NegotiationRound,
  NegotiationRow,
  PreferredBidderDetail,
  PreferredBidderRow,
  ProcessDecision,
  ReferenceCheck,
  SelectionApprovalSummary,
  SelectionBidRef,
  SelectionBlocker,
  SelectionCandidate,
  SelectionGate,
  SelectionLotRef,
  SelectionTenderRef,
  SelectionTenderRow,
  ShortlistDetail,
  ShortlistRow,
  SupplierAssessmentInvite,
  SupplierFinalOfferRound,
  SupplierNegotiationDetail,
  SupplierNegotiationRound,
  SupplierNegotiationRow,
  TenderSelectionSummary,
} from '../../../contracts/selection.js';
import { ACTIVE_PREFERRED_BIDDER_STATUSES, ASSESSMENT_BASIS_EFFECTS } from '../../../contracts/selection.js';
import { DUE_DILIGENCE_FINDINGS_AREA } from '../../../contracts/enums.js';
import type { DueDiligenceFindingsArea, DueDiligenceFindingsDisposition, PreferredBiddersStatus } from '../../../contracts/enums.js';
import {
  ASSESSMENT_FINDINGS,
  ASSESSMENT_INVITES,
  ASSESSMENT_SESSIONS,
  DUE_DILIGENCE_CASES,
  FINAL_OFFER_ROUNDS,
  NEGOTIATIONS,
  PREFERRED_BIDDERS,
  PROCESS_DECISIONS,
  REFERENCE_CHECKS,
  SELECTION_BIDS,
  SELECTION_TENDERS,
  SHORTLISTS,
} from '../../fixtures/selection/index.js';
import type {
  FixtureApproval,
  FixtureAssessmentInvite,
  FixtureAssessmentSession,
  FixtureDiligenceCase,
  FixtureDiligenceFinding,
  FixtureFinalOfferRound,
  FixtureNegotiation,
  FixtureNegotiationRound,
  FixturePreferredBidder,
  FixtureProcessDecision,
  FixtureReferenceCheck,
  FixtureSelectionBid,
  FixtureSelectionTender,
  FixtureShortlist,
} from '../../fixtures/selection/index.js';
import type { PermissionCode } from '../../../contracts/permissions.js';
import { activeMemberships, findPersonaById, findTenantById, membershipPermissions, personRef } from '../../persona.js';

// ---------------------------------------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------------------------------------

export function tenderOf(tenantId: number, tenderId: number): FixtureSelectionTender | undefined {
  return SELECTION_TENDERS.find((row) => row.tenantId === tenantId && row.tenderId === tenderId);
}

function requireTenderFixture(tenantId: number, tenderId: number): FixtureSelectionTender {
  const tender = tenderOf(tenantId, tenderId);
  if (tender === undefined) {
    throw new Error(`Selection fixture tender ${tenderId} is missing for tenant ${tenantId}.`);
  }
  return tender;
}

export function bidOf(tenantId: number, bidId: number): FixtureSelectionBid | undefined {
  return SELECTION_BIDS.find((row) => row.tenantId === tenantId && row.bidId === bidId);
}

function requireBidFixture(tenantId: number, bidId: number): FixtureSelectionBid {
  const bid = bidOf(tenantId, bidId);
  if (bid === undefined) {
    throw new Error(`Selection fixture bid ${bidId} is missing for tenant ${tenantId}.`);
  }
  return bid;
}

export function tenderRef(tender: FixtureSelectionTender): SelectionTenderRef {
  return {
    tenderId: tender.tenderId,
    reference: tender.reference,
    title: tender.title,
    officialTimeZone: tender.officialTimeZone,
  };
}

export function lotRef(tender: FixtureSelectionTender, lotId: number | null): SelectionLotRef | null {
  if (lotId === null) {
    return null;
  }
  const lot = tender.lots.find((row) => row.lotId === lotId);
  return lot === undefined ? null : { lotId: lot.lotId, lotNo: lot.lotNo, title: lot.title };
}

export function bidRef(bid: FixtureSelectionBid): SelectionBidRef {
  return {
    bidId: bid.bidId,
    supplierTenantId: bid.supplierTenantId,
    supplierName: bid.supplierName,
    isAlternative: bid.isAlternative,
  };
}

function approvalOf(approval: FixtureApproval | null): SelectionApprovalSummary | null {
  return approval === null ? null : { ...approval };
}

function personOrNull(userId: number | null): PersonRef | null {
  return userId === null ? null : personRef(userId);
}

function gate(blockers: SelectionBlocker[]): SelectionGate {
  return { allowed: blockers.length === 0, blockers };
}

/** True when the user is an active member of the tenant whose roles grant `code` (assignment eligibility). */
export function holdsPermission(tenantId: number, userId: number, code: PermissionCode): boolean {
  const persona = findPersonaById(userId);
  if (persona === undefined || persona.status !== 'active') {
    return false;
  }
  return activeMemberships(persona).some(
    (membership) => membership.tenantId === tenantId && membershipPermissions(membership).includes(code),
  );
}

/** The permission each selection assignment requires (decision owner, finding owner, negotiator). */
export const ASSIGNMENT_PERMISSIONS = {
  decisionOwner: 'selection.manage',
  findingOwner: 'diligence.manage',
  negotiator: 'negotiation.conduct',
  equalTreatment: 'selection.manage',
} as const satisfies Record<string, PermissionCode>;

/** True when the user is on the tender team and holds the permission the assignment requires. */
export function isEligibleFor(
  tender: FixtureSelectionTender,
  userId: number,
  assignment: keyof typeof ASSIGNMENT_PERMISSIONS,
): boolean {
  return tender.teamUserIds.includes(userId) && holdsPermission(tender.tenantId, userId, ASSIGNMENT_PERMISSIONS[assignment]);
}

/** Due-diligence areas as they read in a sentence ("failed due diligence on financial position"). */
const AREA_PHRASE: Record<DueDiligenceFindingsArea, string> = {
  financial: 'financial position',
  capacity: 'capacity',
  references: 'references',
  insurance: 'insurance',
  licenses: 'licences',
  restrictions: 'restrictions and debarment',
  ownership: 'ownership',
  key_personnel: 'key personnel',
  subcontractors: 'subcontractors',
  contract_exceptions: 'contract exceptions',
  security: 'security',
};

function supplierNameOf(tenantId: number, bidId: number): string {
  return SELECTION_BIDS.find((row) => row.tenantId === tenantId && row.bidId === bidId)?.supplierName ?? 'The bidder';
}

export function buyerName(tenantId: number): string {
  return findTenantById(tenantId)?.name ?? 'Buyer';
}

// ---------------------------------------------------------------------------------------------------------
// Candidates and shortlist standing
// ---------------------------------------------------------------------------------------------------------

export function approvedShortlistOf(tenantId: number, tenderId: number): FixtureShortlist | undefined {
  return SHORTLISTS.find((row) => row.tenantId === tenantId && row.tenderId === tenderId && row.status === 'approved');
}

/** `true` included, `false` excluded, `null` no approved shortlist. A variant follows its supplier's main bid. */
export function shortlistStanding(bid: FixtureSelectionBid): boolean | null {
  const shortlist = approvedShortlistOf(bid.tenantId, bid.tenderId);
  if (shortlist === undefined) {
    return null;
  }
  const direct = shortlist.entries.find((entry) => entry.bidId === bid.bidId);
  if (direct !== undefined) {
    return direct.included;
  }
  const sameSupplier = shortlist.entries.find(
    (entry) => bidOf(bid.tenantId, entry.bidId)?.supplierTenantId === bid.supplierTenantId,
  );
  return sameSupplier === undefined ? false : sameSupplier.included;
}

export function bidsOfTender(tender: FixtureSelectionTender): FixtureSelectionBid[] {
  return SELECTION_BIDS.filter((bid) => bid.tenantId === tender.tenantId && bid.tenderId === tender.tenderId);
}

export function candidateOf(tender: FixtureSelectionTender, bid: FixtureSelectionBid): SelectionCandidate {
  return {
    bid: bidRef(bid),
    lot: lotRef(tender, bid.lotId),
    nonPriceScore: bid.nonPriceScore,
    totalScore: bid.totalScore,
    rank: bid.rank,
    passesGates: bid.passesGates,
    evaluatedValue: bid.evaluatedValue === null ? null : { ...bid.evaluatedValue },
    shortlisted: shortlistStanding(bid),
  };
}

/**
 * A bid that may take part in selection steps: passes gates, is not excluded by an approved shortlist, and did not
 * fail due diligence as a preferred bidder.
 */
export function isEligibleBid(bid: FixtureSelectionBid): boolean {
  const failedDiligence = PREFERRED_BIDDERS.some(
    (row) => row.tenantId === bid.tenantId && row.bidId === bid.bidId && row.status === 'failed_diligence',
  );
  return bid.passesGates && shortlistStanding(bid) !== false && !failedDiligence;
}

// ---------------------------------------------------------------------------------------------------------
// Process decisions
// ---------------------------------------------------------------------------------------------------------

export function processDecisionView(decision: FixtureProcessDecision): ProcessDecision {
  const tender = requireTenderFixture(decision.tenantId, decision.tenderId);
  return {
    processDecisionId: decision.processDecisionId,
    tender: tenderRef(tender),
    lot: lotRef(tender, decision.lotId),
    decisionType: decision.decisionType,
    reason: decision.reason,
    status: decision.status,
    proposedBy: personRef(decision.proposedBy),
    decidedBy: personOrNull(decision.decidedBy),
    approval: approvalOf(decision.approval),
    approvalSubject: {
      subjectType: 'process_decision',
      subjectId: decision.processDecisionId,
      subjectVersion: decision.version,
      contentHash: decision.contentHash,
    },
    createdAt: decision.createdAt,
    updatedAt: decision.updatedAt,
  };
}

export function processDecisionsOf(tenantId: number, tenderId: number): FixtureProcessDecision[] {
  return PROCESS_DECISIONS.filter((row) => row.tenantId === tenantId && row.tenderId === tenderId);
}

function processDecisionById(tenantId: number, id: number | null): FixtureProcessDecision | undefined {
  return id === null ? undefined : PROCESS_DECISIONS.find((row) => row.tenantId === tenantId && row.processDecisionId === id);
}

// ---------------------------------------------------------------------------------------------------------
// Gates (AC-23, AC-24, BR-30)
// ---------------------------------------------------------------------------------------------------------

function isActivePreferred(status: PreferredBiddersStatus): boolean {
  const active: readonly PreferredBiddersStatus[] = ACTIVE_PREFERRED_BIDDER_STATUSES;
  return active.includes(status);
}

export function preferredBiddersOf(tenantId: number, tenderId: number): FixturePreferredBidder[] {
  return PREFERRED_BIDDERS.filter((row) => row.tenantId === tenantId && row.tenderId === tenderId);
}

export function approvedPreferredOf(tender: FixtureSelectionTender): FixturePreferredBidder | undefined {
  return preferredBiddersOf(tender.tenantId, tender.tenderId).find((row) => row.status === 'approved');
}

export function diligenceCaseOf(preferred: FixturePreferredBidder): FixtureDiligenceCase | undefined {
  return DUE_DILIGENCE_CASES.find(
    (row) => row.tenantId === preferred.tenantId && row.preferredBidderId === preferred.preferredBidderId,
  );
}

/** The approved process decision that authorizes a round the issued conditions do not provide for. */
function approvedReopenDecision(tender: FixtureSelectionTender): FixtureProcessDecision | undefined {
  return processDecisionsOf(tender.tenantId, tender.tenderId).find(
    (row) => row.decisionType === 'reopen_round' && row.status === 'approved',
  );
}

function pendingReopenDecision(tender: FixtureSelectionTender): FixtureProcessDecision | undefined {
  return processDecisionsOf(tender.tenantId, tender.tenderId).find(
    (row) => row.decisionType === 'reopen_round' && row.status === 'proposed',
  );
}

function processDecisionRequiredBlocker(tender: FixtureSelectionTender): SelectionBlocker {
  const pending = pendingReopenDecision(tender);
  return {
    code: 'PROCESS_DECISION_REQUIRED',
    message:
      pending === undefined
        ? 'A procedural decision authorizing this round is required. Propose a process decision and obtain its approval first.'
        : 'A reopen-round process decision is proposed and awaiting approval; nothing can be requested from bidders until it is approved.',
  };
}

/** Blockers of a final-offer (BAFO) round on this tender (AC-23). */
export function finalOfferBlockers(tender: FixtureSelectionTender): SelectionBlocker[] {
  if (tender.conditions.bafoPermitted || approvedReopenDecision(tender) !== undefined) {
    return [];
  }
  return [
    {
      code: 'BAFO_NOT_PERMITTED',
      message: `The issued conditions do not provide for a best and final offer round. ${tender.conditions.conditionsNote}`,
    },
    processDecisionRequiredBlocker(tender),
  ];
}

/** Blockers of negotiating with one bid (only the approved preferred bidder's conforming offer, BR-30). */
export function negotiationBlockers(tender: FixtureSelectionTender, bid: FixtureSelectionBid | null): SelectionBlocker[] {
  const blockers: SelectionBlocker[] = [];
  if (!tender.conditions.negotiationPermitted) {
    blockers.push({
      code: 'NEGOTIATION_NOT_PERMITTED',
      message: `The issued conditions do not permit negotiation. ${tender.conditions.conditionsNote}`,
    });
    blockers.push(processDecisionRequiredBlocker(tender));
    return blockers;
  }
  const preferred = approvedPreferredOf(tender);
  if (preferred === undefined) {
    blockers.push({
      code: 'BID_NOT_PREFERRED',
      message: 'Negotiation is held only with an approved preferred bidder; none is approved on this tender.',
    });
    return blockers;
  }
  if (bid !== null && bid.bidId !== preferred.bidId) {
    blockers.push({
      code: 'NEGOTIATION_NOT_PERMITTED',
      message: `${bid.isAlternative ? 'Variant offers cannot be negotiated' : 'Only the approved preferred bidder’s offer can be negotiated'}. ${tender.conditions.conditionsNote}`,
    });
    blockers.push(processDecisionRequiredBlocker(tender));
  }
  return blockers;
}

/** What selection still blocks before an award recommendation can proceed (AC-24, BR-31). */
export function awardBlockers(tender: FixtureSelectionTender): SelectionBlocker[] {
  const blockers: SelectionBlocker[] = [];
  const preferredRows = preferredBiddersOf(tender.tenantId, tender.tenderId);
  for (const preferred of preferredRows) {
    if ((preferred.status === 'failed_diligence' || preferred.status === 'withdrawn') && preferred.fallbackProcessDecisionId === null) {
      blockers.push({
        code: 'FALLBACK_DECISION_REQUIRED',
        message: `${supplierNameOf(preferred.tenantId, preferred.bidId)} cannot proceed as preferred bidder; record the fallback decision under the declared contingency before approaching another bidder.`,
      });
    }
  }
  const openSessions = ASSESSMENT_SESSIONS.filter(
    (row) =>
      row.tenantId === tender.tenantId &&
      row.tenderId === tender.tenderId &&
      (row.status === 'planned' || row.status === 'scheduled'),
  );
  if (preferredRows.length === 0) {
    if (openSessions.length > 0) {
      blockers.push({
        code: 'ASSESSMENT_PENDING',
        message: `${openSessions.length} assessment session(s) announced for this event are not complete; their treatment must be applied first.`,
      });
    }
    return blockers;
  }
  const active = preferredRows.find((row) => isActivePreferred(row.status));
  if (active === undefined) {
    blockers.push({
      code: 'NO_APPROVED_PREFERRED_BIDDER',
      message: 'No preferred bidder is approved. Preferred status is conditional and is never an award.',
    });
    return blockers;
  }
  if (active.status !== 'approved') {
    blockers.push({
      code: 'NO_APPROVED_PREFERRED_BIDDER',
      message: `The conditional preferred status of ${supplierNameOf(active.tenantId, active.bidId)} is ${active.status.replace(/_/g, ' ')}; it needs approval first.`,
    });
  }
  const diligence = diligenceCaseOf(active);
  if (diligence === undefined || diligence.status !== 'passed') {
    const blocking = diligence === undefined ? 0 : diligence.findings.filter((row) => row.isAwardBlocking && row.disposition !== 'satisfied').length;
    blockers.push({
      code: diligence?.status === 'failed' ? 'AWARD_BLOCKED_BY_DILIGENCE' : 'DILIGENCE_NOT_PASSED',
      message:
        diligence === undefined
          ? 'No due-diligence case is recorded for the preferred bidder.'
          : diligence.status === 'failed'
            ? `Due diligence on ${supplierNameOf(active.tenantId, active.bidId)} failed; the award is blocked and the declared fallback applies.`
            : `Due diligence on ${supplierNameOf(active.tenantId, active.bidId)} is ${diligence.status.replace(/_/g, ' ')} with ${blocking} award-blocking finding(s) outstanding.`,
    });
  }
  const activeNegotiation = NEGOTIATIONS.find(
    (row) => row.tenantId === tender.tenantId && row.tenderId === tender.tenderId && row.bidId === active.bidId && row.status === 'active',
  );
  if (activeNegotiation !== undefined) {
    blockers.push({
      code: 'NEGOTIATION_IN_PROGRESS',
      message: `The negotiation with ${supplierNameOf(activeNegotiation.tenantId, activeNegotiation.bidId)} is still active; conclude it and record its outcome first.`,
    });
  }
  if (openSessions.length > 0) {
    blockers.push({
      code: 'ASSESSMENT_PENDING',
      message: `${openSessions.length} assessment session(s) announced for this event are not complete.`,
    });
  }
  return blockers;
}

/**
 * The award gate seen from one preferred-bidder record or its due-diligence case (AC-24): a bidder that failed due
 * diligence or withdrew is never awarded, and that reason comes first; the tender-level blockers follow.
 */
export function preferredAwardBlockers(preferred: FixturePreferredBidder): SelectionBlocker[] {
  const tender = requireTenderFixture(preferred.tenantId, preferred.tenderId);
  const supplier = supplierNameOf(preferred.tenantId, preferred.bidId);
  const own: SelectionBlocker[] = [];
  if (preferred.status === 'failed_diligence') {
    const diligence = diligenceCaseOf(preferred);
    const areas = (diligence?.findings ?? [])
      .filter((row) => row.disposition === 'failed')
      .map((row) => AREA_PHRASE[row.area]);
    own.push({
      code: 'DILIGENCE_FAILED',
      message:
        areas.length === 0
          ? `${supplier} failed due diligence; no award can be made to this bidder.`
          : `${supplier} failed due diligence on ${areas.join(', ')}; no award can be made to this bidder.`,
    });
  } else if (preferred.status === 'withdrawn') {
    own.push({
      code: 'PREFERRED_BIDDER_WITHDRAWN',
      message: `${supplier} withdrew as preferred bidder; no award can be made to this bidder.`,
    });
  }
  return [...own, ...awardBlockers(tender)];
}

// ---------------------------------------------------------------------------------------------------------
// Register and tender summary
// ---------------------------------------------------------------------------------------------------------

function latestStatus<T extends { readonly updatedAt: string }>(rows: readonly T[]): T | undefined {
  return [...rows].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
}

export function tenderRow(tender: FixtureSelectionTender): SelectionTenderRow {
  const tenantId = tender.tenantId;
  const shortlist = latestStatus(SHORTLISTS.filter((row) => row.tenantId === tenantId && row.tenderId === tender.tenderId));
  const preferredRows = preferredBiddersOf(tenantId, tender.tenderId);
  const preferred = preferredRows.find((row) => isActivePreferred(row.status)) ?? latestStatus(preferredRows);
  const diligence = preferred === undefined ? undefined : diligenceCaseOf(preferred);
  const negotiation = latestStatus(
    NEGOTIATIONS.filter((row) => row.tenantId === tenantId && row.tenderId === tender.tenderId && row.status !== 'planned'),
  );
  const sessions = ASSESSMENT_SESSIONS.filter((row) => row.tenantId === tenantId && row.tenderId === tender.tenderId);
  const negotiationGate = negotiationBlockers(tender, null);
  const blockerCount =
    awardBlockers(tender).length + finalOfferBlockers(tender).length + (negotiationGate.length > 0 ? 1 : 0);
  return {
    tenderId: tender.tenderId,
    reference: tender.reference,
    title: tender.title,
    eventType: tender.eventType,
    procedure: tender.procedure,
    status: tender.status,
    stageNo: tender.stageNo,
    owner: personRef(tender.ownerUserId),
    officialTimeZone: tender.officialTimeZone,
    conditions: { ...tender.conditions },
    sessionCount: sessions.length,
    shortlistStatus: shortlist?.status ?? null,
    preferredBidderStatus: preferred?.status ?? null,
    dueDiligenceStatus: diligence?.status ?? null,
    negotiationStatus: negotiation?.status ?? null,
    blockerCount,
    updatedAt: tender.updatedAt,
  };
}

export function tenderSummary(tender: FixtureSelectionTender): TenderSelectionSummary {
  return {
    tender: tenderRow(tender),
    lots: tender.lots.map((lot) => ({ ...lot })),
    candidates: bidsOfTender(tender).map((bid) => candidateOf(tender, bid)),
    team: tender.teamUserIds.map((userId) => personRef(userId)),
    eligible: {
      decisionOwners: tender.teamUserIds.filter((userId) => isEligibleFor(tender, userId, 'decisionOwner')).map(personRef),
      findingOwners: tender.teamUserIds.filter((userId) => isEligibleFor(tender, userId, 'findingOwner')).map(personRef),
      negotiators: tender.teamUserIds.filter((userId) => isEligibleFor(tender, userId, 'negotiator')).map(personRef),
    },
    criteria: tender.criteria.map(({ criterionId, name, weight }) => ({ criterionId, name, weight })),
    gates: {
      negotiation: gate(negotiationBlockers(tender, null)),
      finalOffer: gate(finalOfferBlockers(tender)),
      award: gate(awardBlockers(tender)),
    },
  };
}

// ---------------------------------------------------------------------------------------------------------
// Assessment sessions (AC-21)
// ---------------------------------------------------------------------------------------------------------

export function invitesOf(session: FixtureAssessmentSession): FixtureAssessmentInvite[] {
  return ASSESSMENT_INVITES.filter((row) => row.tenantId === session.tenantId && row.sessionId === session.sessionId);
}

function findingsOf(session: FixtureAssessmentSession) {
  return ASSESSMENT_FINDINGS.filter((row) => row.tenantId === session.tenantId && row.sessionId === session.sessionId);
}

function criterionOf(tender: FixtureSelectionTender, criterionId: number | null) {
  if (criterionId === null) {
    return null;
  }
  const criterion = tender.criteria.find((row) => row.criterionId === criterionId);
  return criterion === undefined ? null : { criterionId: criterion.criterionId, name: criterion.name, weight: criterion.weight };
}

export function sessionRow(session: FixtureAssessmentSession): AssessmentSessionRow {
  const tender = requireTenderFixture(session.tenantId, session.tenderId);
  const invites = invitesOf(session);
  const scheduled = invites.map((row) => row.scheduledAt).filter((value): value is string => value !== null).sort();
  return {
    sessionId: session.sessionId,
    tender: tenderRef(tender),
    lot: lotRef(tender, session.lotId),
    sessionType: session.sessionType,
    purpose: session.purpose,
    assessmentBasis: session.assessmentBasis,
    criterion: criterionOf(tender, session.criterionId),
    status: session.status,
    preparationDays: session.preparationDays,
    firstScheduledAt: scheduled[0] ?? null,
    inviteCount: invites.length,
    confirmedCount: invites.filter((row) => row.status === 'confirmed' || row.status === 'attended').length,
    findingCount: findingsOf(session).length,
    equalTreatmentConfirmed: session.equalTreatmentConfirmedAt !== null,
    createdBy: personRef(session.createdBy),
    updatedAt: session.updatedAt,
  };
}

/** Candidates in the session's scope that may be invited (main offers only; one appointment per supplier). */
export function sessionScopeBids(session: FixtureAssessmentSession): FixtureSelectionBid[] {
  const tender = requireTenderFixture(session.tenantId, session.tenderId);
  return bidsOfTender(tender).filter(
    (bid) => !bid.isAlternative && isEligibleBid(bid) && (session.lotId === null || bid.lotId === session.lotId),
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;

function hasPreparationTime(invite: FixtureAssessmentInvite, preparationDays: number): boolean {
  if (invite.scheduledAt === null) {
    return true;
  }
  return Date.parse(invite.scheduledAt) - Date.parse(invite.invitedAt) >= preparationDays * DAY_MS;
}

export function equalTreatmentChecks(session: FixtureAssessmentSession): EqualTreatmentCheck[] {
  const tender = requireTenderFixture(session.tenantId, session.tenderId);
  const invites = invitesOf(session);
  const criterion = criterionOf(tender, session.criterionId);
  const invitedBidIds = new Set(invites.map((row) => row.bidId));
  const scope = sessionScopeBids(session);
  const missing = scope.filter((bid) => !invitedBidIds.has(bid.bidId));
  const shortPrep = invites.filter((row) => !hasPreparationTime(row, session.preparationDays));
  const supplierSpecific = session.assessmentBasis === 'claim_verification';
  return [
    {
      check: 'basis_declared',
      satisfied: session.assessmentBasis !== 'scored_criterion' || criterion !== null,
      detail:
        session.assessmentBasis === 'scored_criterion'
          ? criterion === null
            ? 'The scored criterion is not in the approved evaluation plan.'
            : `Feeds the announced criterion "${criterion.name}" (${criterion.weight}%).`
          : session.assessmentBasis === 'claim_verification'
            ? 'Verifies claims made in the responses; the outcome does not change scores.'
            : 'Pass/fail eligibility gate announced in the issued conditions.',
    },
    {
      check: 'same_instructions',
      satisfied: true,
      detail: 'Every invitee receives the same agenda and instructions.',
    },
    {
      check: 'preparation_time',
      satisfied: shortPrep.length === 0,
      detail:
        invites.length === 0
          ? `Each invitee will have at least ${session.preparationDays} day(s) to prepare; checked when invitations are issued.`
          : shortPrep.length === 0
            ? `Every invitee had at least ${session.preparationDays} day(s) to prepare.`
            : `${shortPrep.length} invitation(s) give less than ${session.preparationDays} day(s) to prepare.`,
    },
    {
      check: 'all_candidates_invited',
      satisfied: supplierSpecific || missing.length === 0 || invites.length === 0,
      detail: supplierSpecific
        ? 'Supplier-specific claim verification: only the supplier whose claim is verified is invited.'
        : invites.length === 0
          ? `${scope.length} eligible candidate(s) in scope; invitations not yet issued.`
          : missing.length === 0
            ? 'Every eligible candidate in scope is invited.'
            : `Not invited: ${missing.map((bid) => bid.supplierName).join(', ')}.`,
    },
    {
      check: 'no_undisclosed_criteria',
      satisfied: session.assessmentBasis !== 'scored_criterion' || criterion !== null,
      detail:
        session.assessmentBasis === 'scored_criterion'
          ? 'Findings feed only the announced criterion.'
          : 'No score is derived from this session.',
    },
  ];
}

const TREATMENT_TEXT: Record<FixtureAssessmentSession['assessmentBasis'], string> = {
  scored_criterion: 'Findings are inputs to the announced criterion score only; no other score changes.',
  claim_verification: 'Findings verify or fail to verify claims; scores are not changed by this session.',
  eligibility_gate: 'Findings pass or fail the announced eligibility gate; a failure excludes the candidate from this lot.',
};

export function referenceCheckView(check: FixtureReferenceCheck, canReadConfidential: boolean): ReferenceCheck {
  const bid = requireBidFixture(check.tenantId, check.bidId);
  const tender = requireTenderFixture(check.tenantId, bid.tenderId);
  const restricted = check.confidential && check.feedback !== null && !canReadConfidential;
  return {
    referenceCheckId: check.referenceCheckId,
    tender: tenderRef(tender),
    bid: bidRef(bid),
    refereeName: check.refereeName,
    refereeOrganization: check.refereeOrganization,
    consentConfirmed: check.consentConfirmed,
    contactedAt: check.contactedAt,
    feedback: restricted ? null : check.feedback,
    feedbackRestricted: restricted,
    confidential: check.confidential,
    assessor: personOrNull(check.assessorUserId),
    outcome: check.outcome,
    updatedAt: check.updatedAt,
  };
}

export function sessionDetail(session: FixtureAssessmentSession, canReadConfidential: boolean): AssessmentSessionDetail {
  const invites = invitesOf(session);
  const invitedBidIds = new Set(invites.map((row) => row.bidId));
  const referenceChecks =
    session.sessionType === 'reference_check'
      ? REFERENCE_CHECKS.filter((row) => row.tenantId === session.tenantId && invitedBidIds.has(row.bidId))
      : [];
  const editable = session.status === 'planned' || session.status === 'scheduled';
  return {
    ...sessionRow(session),
    agenda: session.agenda,
    instructions: session.instructions,
    equalTreatment: {
      confirmedBy: personOrNull(session.equalTreatmentConfirmedBy),
      confirmedAt: session.equalTreatmentConfirmedAt,
      checks: equalTreatmentChecks(session),
    },
    treatment: {
      allowedEffects: [...ASSESSMENT_BASIS_EFFECTS[session.assessmentBasis]],
      description: TREATMENT_TEXT[session.assessmentBasis],
    },
    invites: invites.map((invite) => ({
      inviteId: invite.inviteId,
      bid: bidRef(requireBidFixture(invite.tenantId, invite.bidId)),
      scheduledAt: invite.scheduledAt,
      status: invite.status,
      invitedAt: invite.invitedAt,
      supplierConfirmedAt: invite.supplierConfirmedAt,
      supplierConfirmedBy: personOrNull(invite.supplierConfirmedBy),
    })),
    findings: findingsOf(session).map((finding) => ({
      findingId: finding.findingId,
      bid: bidRef(requireBidFixture(finding.tenantId, finding.bidId)),
      assessor: personRef(finding.assessorUserId),
      finding: finding.finding,
      effect: finding.effect,
      evidenceDocumentId: finding.evidenceDocumentId,
      evidenceTitle: finding.evidenceTitle,
      recordedAt: finding.recordedAt,
    })),
    referenceChecks: referenceChecks.map((row) => referenceCheckView(row, canReadConfidential)),
    invitableBids: editable ? sessionScopeBids(session).filter((bid) => !invitedBidIds.has(bid.bidId)).map(bidRef) : [],
    completionSummary: session.completionSummary,
    cancellationReason: session.cancellationReason,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Shortlists (AC-22)
// ---------------------------------------------------------------------------------------------------------

function allNotifiedAt(shortlist: FixtureShortlist): string | null {
  if (shortlist.entries.length === 0 || shortlist.entries.some((entry) => entry.notifiedAt === null)) {
    return null;
  }
  return shortlist.entries.map((entry) => entry.notifiedAt ?? '').sort().at(-1) ?? null;
}

export function shortlistRow(shortlist: FixtureShortlist): ShortlistRow {
  const tender = requireTenderFixture(shortlist.tenantId, shortlist.tenderId);
  return {
    shortlistId: shortlist.shortlistId,
    tender: tenderRef(tender),
    lot: lotRef(tender, shortlist.lotId),
    stageNo: shortlist.stageNo,
    selectionRule: shortlist.selectionRule,
    threshold: shortlist.threshold,
    status: shortlist.status,
    includedCount: shortlist.entries.filter((entry) => entry.included).length,
    excludedCount: shortlist.entries.filter((entry) => !entry.included).length,
    approval: approvalOf(shortlist.approval),
    approvedAt: shortlist.approvedAt,
    notifiedAt: allNotifiedAt(shortlist),
    updatedAt: shortlist.updatedAt,
  };
}

export function shortlistNotifyBlockers(shortlist: FixtureShortlist): SelectionBlocker[] {
  if (shortlist.status !== 'approved') {
    return [{ code: 'SHORTLIST_NOT_APPROVED', message: 'Outcome notices are issued only after the shortlist is approved.' }];
  }
  if (allNotifiedAt(shortlist) !== null) {
    return [{ code: 'OUTCOME_NOTICES_ALREADY_ISSUED', message: 'Every candidate has already received its outcome notice.' }];
  }
  return [];
}

export function shortlistDetail(shortlist: FixtureShortlist): ShortlistDetail {
  return {
    ...shortlistRow(shortlist),
    rationale: shortlist.rationale,
    changeReason: shortlist.changeReason,
    entries: shortlist.entries.map((entry) => {
      const bid = requireBidFixture(shortlist.tenantId, entry.bidId);
      return {
        entryId: entry.entryId,
        bid: bidRef(bid),
        included: entry.included,
        rank: entry.rank,
        reason: entry.reason,
        conditions: entry.conditions,
        nonPriceScore: bid.nonPriceScore,
        totalScore: bid.totalScore,
        notifiedAt: entry.notifiedAt,
        notice: entry.notice === null ? null : { ...entry.notice },
      };
    }),
    approvalSubject: {
      subjectType: 'shortlist',
      subjectId: shortlist.shortlistId,
      subjectVersion: shortlist.version,
      contentHash: shortlist.contentHash,
    },
    nextStage: {
      tender: shortlist.nextStageTender === null ? null : { ...shortlist.nextStageTender },
      createLink:
        shortlist.nextStageTender === null && shortlist.status === 'approved'
          ? `/buyer/tenders/new?linkedFrom=${shortlist.tenderId}&linkType=next_stage&shortlistId=${shortlist.shortlistId}`
          : null,
    },
    notifyGate: gate(shortlistNotifyBlockers(shortlist)),
  };
}

// ---------------------------------------------------------------------------------------------------------
// Preferred bidders (BR-31, AC-24)
// ---------------------------------------------------------------------------------------------------------

function blockingCount(diligence: FixtureDiligenceCase): number {
  return diligence.findings.filter((row) => row.isAwardBlocking && row.disposition !== 'satisfied').length;
}

export function preferredRow(preferred: FixturePreferredBidder): PreferredBidderRow {
  const tender = requireTenderFixture(preferred.tenantId, preferred.tenderId);
  const diligence = diligenceCaseOf(preferred);
  const fallback = preferred.fallbackBidId === null ? undefined : bidOf(preferred.tenantId, preferred.fallbackBidId);
  return {
    preferredBidderId: preferred.preferredBidderId,
    tender: tenderRef(tender),
    lot: lotRef(tender, preferred.lotId),
    bid: bidRef(requireBidFixture(preferred.tenantId, preferred.bidId)),
    scope: preferred.scope,
    proposedValue: { ...preferred.proposedValue },
    status: preferred.status,
    statusReason: preferred.statusReason,
    decisionOwner: personRef(preferred.decisionOwnerUserId),
    approval: approvalOf(preferred.approval),
    dueDiligence:
      diligence === undefined
        ? null
        : { caseId: diligence.caseId, status: diligence.status, awardBlockingCount: blockingCount(diligence) },
    fallbackBid: fallback === undefined ? null : bidRef(fallback),
    updatedAt: preferred.updatedAt,
  };
}

export function fallbackBlockers(preferred: FixturePreferredBidder): SelectionBlocker[] {
  if (preferred.status !== 'failed_diligence' && preferred.status !== 'withdrawn') {
    return [
      {
        code: 'FALLBACK_NOT_AVAILABLE',
        message: 'A fallback is recorded only when the preferred bidder withdraws or fails due diligence.',
      },
    ];
  }
  if (preferred.fallbackProcessDecisionId !== null) {
    return [
      {
        code: 'FALLBACK_ALREADY_RECORDED',
        message: 'The fallback decision is already recorded for this preferred bidder.',
      },
    ];
  }
  return [];
}

export function preferredDetail(preferred: FixturePreferredBidder): PreferredBidderDetail {
  const tender = requireTenderFixture(preferred.tenantId, preferred.tenderId);
  return {
    ...preferredRow(preferred),
    rationale: preferred.rationale,
    remainingChecks: preferred.remainingChecks,
    negotiationTopics: [...preferred.negotiationTopics],
    contingencyPlan: preferred.contingencyPlan,
    comparison: bidsOfTender(tender)
      .filter((bid) => preferred.lotId === null || bid.lotId === preferred.lotId)
      .map((bid) => candidateOf(tender, bid)),
    processDecisions: processDecisionsOf(preferred.tenantId, preferred.tenderId).map(processDecisionView),
    approvalSubject: {
      subjectType: 'preferred_bidder',
      subjectId: preferred.preferredBidderId,
      subjectVersion: preferred.version,
      contentHash: preferred.contentHash,
    },
    fallbackGate: gate(fallbackBlockers(preferred)),
    awardGate: gate(preferredAwardBlockers(preferred)),
  };
}

// ---------------------------------------------------------------------------------------------------------
// Due diligence (AC-24)
// ---------------------------------------------------------------------------------------------------------

const DISPOSITION_SEVERITY: Record<DueDiligenceFindingsDisposition, number> = {
  satisfied: 0,
  condition: 1,
  unresolved: 2,
  failed: 3,
};

export function diligenceFindingView(finding: FixtureDiligenceFinding): DueDiligenceFinding {
  return {
    findingId: finding.findingId,
    area: finding.area,
    finding: finding.finding,
    disposition: finding.disposition,
    owner: personOrNull(finding.ownerUserId),
    dueAt: finding.dueAt,
    evidenceDocumentId: finding.evidenceDocumentId,
    evidenceTitle: finding.evidenceTitle,
    isAwardBlocking: finding.isAwardBlocking,
    updatedAt: finding.updatedAt,
  };
}

export function preferredOfCase(diligence: FixtureDiligenceCase): FixturePreferredBidder {
  const preferred = PREFERRED_BIDDERS.find(
    (row) => row.tenantId === diligence.tenantId && row.preferredBidderId === diligence.preferredBidderId,
  );
  if (preferred === undefined) {
    throw new Error(`Due-diligence case ${diligence.caseId} has no preferred bidder fixture.`);
  }
  return preferred;
}

export function diligenceRow(diligence: FixtureDiligenceCase): DueDiligenceCaseRow {
  const preferred = preferredOfCase(diligence);
  const tender = requireTenderFixture(diligence.tenantId, preferred.tenderId);
  const count = (disposition: DueDiligenceFindingsDisposition) =>
    diligence.findings.filter((row) => row.disposition === disposition).length;
  const openDue = diligence.findings
    .filter((row) => row.disposition !== 'satisfied' && row.disposition !== 'failed' && row.dueAt !== null)
    .map((row) => row.dueAt ?? '')
    .sort();
  return {
    caseId: diligence.caseId,
    tender: tenderRef(tender),
    preferredBidder: { preferredBidderId: preferred.preferredBidderId, status: preferred.status },
    bid: bidRef(requireBidFixture(diligence.tenantId, preferred.bidId)),
    owner: personRef(diligence.ownerUserId),
    status: diligence.status,
    dispositionCounts: {
      satisfied: count('satisfied'),
      condition: count('condition'),
      unresolved: count('unresolved'),
      failed: count('failed'),
    },
    awardBlockingCount: blockingCount(diligence),
    nextDueAt: diligence.status === 'open' || diligence.status === 'ready_for_decision' ? (openDue[0] ?? null) : null,
    decidedAt: diligence.decidedAt,
    updatedAt: diligence.updatedAt,
  };
}

export function diligencePassBlockers(diligence: FixtureDiligenceCase): SelectionBlocker[] {
  if (diligence.status === 'passed' || diligence.status === 'failed') {
    return [{ code: 'CASE_DECIDED', message: `The case was decided as ${diligence.status}.` }];
  }
  const blockers: SelectionBlocker[] = [];
  const failed = diligence.findings.filter((row) => row.disposition === 'failed');
  if (failed.length > 0) {
    blockers.push({
      code: 'DILIGENCE_FAILED_FINDING',
      message: `${failed.length} finding(s) failed; the case cannot pass.`,
    });
  }
  const unresolved = diligence.findings.filter((row) => row.disposition === 'unresolved');
  if (unresolved.length > 0) {
    blockers.push({
      code: 'DILIGENCE_FINDINGS_UNRESOLVED',
      message: `${unresolved.length} finding(s) are unresolved: ${unresolved.map((row) => AREA_PHRASE[row.area]).join(', ')}.`,
    });
  }
  return blockers;
}

export function diligenceDetail(diligence: FixtureDiligenceCase): DueDiligenceCaseDetail {
  const preferred = preferredOfCase(diligence);
  const fallback = processDecisionById(diligence.tenantId, preferred.fallbackProcessDecisionId);
  return {
    ...diligenceRow(diligence),
    decidedBy: personOrNull(diligence.decidedBy),
    decisionNote: diligence.decisionNote,
    findings: diligence.findings.map(diligenceFindingView),
    areas: DUE_DILIGENCE_FINDINGS_AREA.map((area) => {
      const inArea = diligence.findings.filter((row) => row.area === area);
      const worst = [...inArea].sort((a, b) => DISPOSITION_SEVERITY[b.disposition] - DISPOSITION_SEVERITY[a.disposition])[0];
      return { area, findingCount: inArea.length, worstDisposition: worst?.disposition ?? null };
    }),
    evidenceRequests: diligence.evidenceRequests.map((row) => ({ ...row })),
    passGate: gate(diligencePassBlockers(diligence)),
    awardGate: gate(preferredAwardBlockers(preferred)),
    fallbackDecision: fallback === undefined ? null : processDecisionView(fallback),
  };
}

// ---------------------------------------------------------------------------------------------------------
// Negotiations (BR-30)
// ---------------------------------------------------------------------------------------------------------

function roundView(round: FixtureNegotiationRound): NegotiationRound {
  return { ...round, topics: [...round.topics] };
}

export function negotiationRow(negotiation: FixtureNegotiation): NegotiationRow {
  const tender = requireTenderFixture(negotiation.tenantId, negotiation.tenderId);
  const meetings = negotiation.rounds.map((row) => row.meetingAt).filter((value): value is string => value !== null).sort();
  return {
    negotiationId: negotiation.negotiationId,
    tender: tenderRef(tender),
    lot: lotRef(tender, negotiation.lotId),
    bid: bidRef(requireBidFixture(negotiation.tenantId, negotiation.bidId)),
    status: negotiation.status,
    allowedTopics: [...negotiation.allowedTopics],
    authorizedNegotiators: negotiation.authorizedNegotiatorIds.map((userId) => personRef(userId)),
    commercialAuthority: negotiation.commercialAuthority === null ? null : { ...negotiation.commercialAuthority },
    approval: approvalOf(negotiation.approval),
    roundCount: negotiation.rounds.length,
    lastMeetingAt: meetings.at(-1) ?? null,
    affectsCompetitionBasis: negotiation.affectsCompetitionBasis,
    updatedAt: negotiation.updatedAt,
  };
}

export function negotiationRoundBlockers(negotiation: FixtureNegotiation): SelectionBlocker[] {
  const tender = requireTenderFixture(negotiation.tenantId, negotiation.tenderId);
  const bid = requireBidFixture(negotiation.tenantId, negotiation.bidId);
  const blockers = negotiationBlockers(tender, bid);
  if (negotiation.status !== 'active') {
    blockers.push({
      code: 'NEGOTIATION_NOT_ACTIVE',
      message: `The negotiation is ${negotiation.status.replace(/_/g, ' ')}; rounds are recorded only while it is active.`,
    });
  }
  if (negotiation.approval?.status !== 'approved') {
    blockers.push({
      code: 'MANDATE_NOT_APPROVED',
      message: 'The negotiation mandate (topics, negotiators, commercial authority) is not approved.',
    });
  }
  return blockers;
}

export function negotiationDetail(negotiation: FixtureNegotiation): NegotiationDetail {
  const preferred = PREFERRED_BIDDERS.find(
    (row) => row.tenantId === negotiation.tenantId && row.tenderId === negotiation.tenderId && row.bidId === negotiation.bidId,
  );
  const decision = processDecisionById(negotiation.tenantId, negotiation.processDecisionId);
  return {
    ...negotiationRow(negotiation),
    outcomeSummary: negotiation.outcomeSummary,
    rounds: negotiation.rounds.map(roundView),
    processDecision: decision === undefined ? null : processDecisionView(decision),
    preferredBidderId: preferred?.preferredBidderId ?? null,
    approvalSubject: {
      subjectType: 'negotiation_mandate',
      subjectId: negotiation.negotiationId,
      subjectVersion: negotiation.version,
      contentHash: negotiation.contentHash,
    },
    roundGate: gate(negotiationRoundBlockers(negotiation)),
  };
}

// ---------------------------------------------------------------------------------------------------------
// Final-offer rounds (AC-23)
// ---------------------------------------------------------------------------------------------------------

export function finalOfferRow(round: FixtureFinalOfferRound): FinalOfferRoundRow {
  const tender = requireTenderFixture(round.tenantId, round.tenderId);
  return {
    roundId: round.roundId,
    tender: tenderRef(tender),
    lot: lotRef(tender, round.lotId),
    status: round.status,
    deadline: round.deadline === null ? null : { at: round.deadline, timeZone: tender.officialTimeZone },
    inviteeCount: round.invitees.length,
    proceduralAuthorityRef: round.proceduralAuthorityRef,
    approval: approvalOf(round.approval),
    updatedAt: round.updatedAt,
  };
}

export function finalOfferIssueBlockers(round: FixtureFinalOfferRound, now: Date): SelectionBlocker[] {
  const tender = requireTenderFixture(round.tenantId, round.tenderId);
  if (round.status !== 'draft' && round.status !== 'awaiting_approval') {
    return [{ code: 'ROUND_NOT_ISSUABLE', message: `The round is ${round.status}; only a draft or approved round can be issued.` }];
  }
  const blockers = finalOfferBlockers(tender);
  if (round.approval?.status !== 'approved') {
    blockers.push({ code: 'ROUND_NOT_APPROVED', message: 'The final-offer round has no approval for its exact instructions and invitees.' });
  }
  if (round.deadline !== null && Date.parse(round.deadline) <= now.getTime()) {
    blockers.push({ code: 'DEADLINE_IN_PAST', message: 'The submission deadline has passed; set a new deadline.' });
  }
  return blockers;
}

export function finalOfferDetail(round: FixtureFinalOfferRound, now: Date): FinalOfferRoundDetail {
  const opened = round.status === 'closed' || round.status === 'evaluated';
  return {
    ...finalOfferRow(round),
    instructions: round.instructions,
    permittedChanges: round.permittedChanges,
    openingRules: round.openingRules,
    evaluationTreatment: round.evaluationTreatment,
    invitees: round.invitees.map((invitee) => {
      const bid = requireBidFixture(round.tenantId, invitee.bidId);
      return {
        bid: bidRef(bid),
        notifiedAt: invitee.notifiedAt,
        finalOfferReceivedAt: invitee.finalOfferReceivedAt,
        earlierOffer: bid.evaluatedValue === null ? null : { ...bid.evaluatedValue },
        finalOffer: opened && invitee.finalOffer !== null ? { ...invitee.finalOffer } : null,
      };
    }),
    approvalSubject: {
      subjectType: 'final_offer_round',
      subjectId: round.roundId,
      subjectVersion: round.version,
      contentHash: round.contentHash,
    },
    issueGate: gate(finalOfferIssueBlockers(round, now)),
  };
}

// ---------------------------------------------------------------------------------------------------------
// Supplier projections (SUP-18, SUP-19; DD-03)
// ---------------------------------------------------------------------------------------------------------

function supplierTenderRef(tender: FixtureSelectionTender) {
  return { tenderId: tender.tenderId, reference: tender.reference, title: tender.title, officialTimeZone: tender.officialTimeZone };
}

export function supplierInviteBlockers(invite: FixtureAssessmentInvite, session: FixtureAssessmentSession): SelectionBlocker[] {
  if (session.status === 'cancelled') {
    return [{ code: 'SESSION_CANCELLED', message: 'The buyer cancelled this session for every candidate.' }];
  }
  if (invite.status !== 'invited' || session.status === 'completed') {
    return [{ code: 'INVITE_NOT_OPEN', message: 'Your organization has already responded to this invitation.' }];
  }
  return [];
}

export function sessionOfInvite(invite: FixtureAssessmentInvite): FixtureAssessmentSession {
  const session = ASSESSMENT_SESSIONS.find((row) => row.tenantId === invite.tenantId && row.sessionId === invite.sessionId);
  if (session === undefined) {
    throw new Error(`Invite ${invite.inviteId} has no session fixture.`);
  }
  return session;
}

export function supplierInviteView(invite: FixtureAssessmentInvite): SupplierAssessmentInvite {
  const session = sessionOfInvite(invite);
  const tender = requireTenderFixture(session.tenantId, session.tenderId);
  return {
    inviteId: invite.inviteId,
    buyer: { tenantId: session.tenantId, name: buyerName(session.tenantId) },
    tender: supplierTenderRef(tender),
    sessionType: session.sessionType,
    sessionStatus: session.status,
    purpose: session.purpose,
    agenda: session.agenda,
    instructions: session.instructions,
    preparationDays: session.preparationDays,
    assessmentBasis: session.assessmentBasis,
    scheduledAt: invite.scheduledAt,
    status: invite.status,
    invitedAt: invite.invitedAt,
    supplierConfirmedAt: invite.supplierConfirmedAt,
    supplierConfirmedBy: personOrNull(invite.supplierConfirmedBy),
    respondGate: gate(supplierInviteBlockers(invite, session)),
  };
}

/** A negotiation is shown to its supplier once its mandate exists (never while planned or awaiting mandate). */
export function isSupplierVisibleNegotiation(negotiation: FixtureNegotiation): boolean {
  return negotiation.status === 'active' || negotiation.status === 'concluded' || negotiation.status === 'aborted';
}

function supplierRoundView(round: FixtureNegotiationRound, negotiation: FixtureNegotiation): SupplierNegotiationRound {
  const { supplierVisible: _supplierVisible, ...rest } = round;
  return {
    ...rest,
    topics: [...rest.topics],
    awaitingResponse: negotiation.status === 'active' && round.supplierResponseAt === null && round.buyerProposal !== null,
  };
}

export function supplierNegotiationRow(negotiation: FixtureNegotiation): SupplierNegotiationRow {
  const tender = requireTenderFixture(negotiation.tenantId, negotiation.tenderId);
  const rounds = negotiation.rounds.filter((row) => row.supplierVisible);
  const meetings = rounds.map((row) => row.meetingAt).filter((value): value is string => value !== null).sort();
  return {
    negotiationId: negotiation.negotiationId,
    buyer: { tenantId: negotiation.tenantId, name: buyerName(negotiation.tenantId) },
    tender: supplierTenderRef(tender),
    status: negotiation.status,
    allowedTopics: [...negotiation.allowedTopics],
    roundCount: rounds.length,
    awaitingResponse: rounds.some((row) => supplierRoundView(row, negotiation).awaitingResponse),
    lastMeetingAt: meetings.at(-1) ?? null,
    updatedAt: negotiation.updatedAt,
  };
}

/** Rounds a supplier may see: issued onwards, and only where it is an invitee. */
export function isSupplierVisibleRound(round: FixtureFinalOfferRound, supplierTenantId: number): boolean {
  return (
    round.status !== 'draft' &&
    round.status !== 'awaiting_approval' &&
    round.invitees.some((invitee) => invitee.supplierTenantId === supplierTenantId)
  );
}

export function supplierFinalOfferView(round: FixtureFinalOfferRound, supplierTenantId: number): SupplierFinalOfferRound {
  const tender = requireTenderFixture(round.tenantId, round.tenderId);
  const invitee = round.invitees.find((row) => row.supplierTenantId === supplierTenantId);
  return {
    roundId: round.roundId,
    buyer: { tenantId: round.tenantId, name: buyerName(round.tenantId) },
    tender: supplierTenderRef(tender),
    status: round.status,
    deadline: round.deadline === null ? null : { at: round.deadline, timeZone: tender.officialTimeZone },
    instructions: round.instructions,
    permittedChanges: round.permittedChanges,
    openingRules: round.openingRules,
    evaluationTreatment: round.evaluationTreatment,
    notifiedAt: invitee?.notifiedAt ?? null,
    finalOfferReceivedAt: invitee?.finalOfferReceivedAt ?? null,
    responseWorkspaceLink:
      invitee === undefined || invitee.responseBidId === null ? '/supplier/responses' : `/supplier/responses/${invitee.responseBidId}`,
  };
}

export function supplierNegotiationDetail(negotiation: FixtureNegotiation): SupplierNegotiationDetail {
  const bid = requireBidFixture(negotiation.tenantId, negotiation.bidId);
  return {
    ...supplierNegotiationRow(negotiation),
    isAlternative: bid.isAlternative,
    outcomeSummary: negotiation.status === 'active' ? null : negotiation.outcomeSummary,
    rounds: negotiation.rounds.filter((row) => row.supplierVisible).map((row) => supplierRoundView(row, negotiation)),
    finalOfferRounds: FINAL_OFFER_ROUNDS.filter(
      (round) =>
        round.tenantId === negotiation.tenantId &&
        round.tenderId === negotiation.tenderId &&
        isSupplierVisibleRound(round, negotiation.supplierTenantId),
    ).map((round) => supplierFinalOfferView(round, negotiation.supplierTenantId)),
  };
}

export function supplierRoundOf(negotiation: FixtureNegotiation, roundId: number): FixtureNegotiationRound | undefined {
  return negotiation.rounds.find((row) => row.roundId === roundId && row.supplierVisible);
}

export { supplierRoundView };
