/**
 * Pure projections from the opening fixtures to the opening contract (src/contracts/opening.ts).
 *
 * Every function takes the caller's tenant id (or a row already filtered by it), so no projection can leak another
 * buyer's or supplier's rows. Sealed content never appears: bid rows carry receipt metadata and envelope states only.
 */
import type {
  BidEnvelopeState,
  ClarificationDetail,
  ClarificationRow,
  ComplianceBidRow,
  ComplianceCheck,
  EnvelopeOpening,
  ExclusionDetail,
  ExclusionRow,
  IneligibleReason,
  LotRef,
  OpeningParticipant,
  OpeningProgress,
  OpeningReadinessItem,
  OpeningSessionDetail,
  OpeningSessionRow,
  OpeningStage,
  OpeningTenderRow,
  PriceGateState,
  QuorumState,
  SessionBid,
  TenderOpeningOverview,
} from '../../../contracts/opening.js';
import type { OpeningSessionsEnvelope, TenderEnvelopesEnvelope } from '../../../contracts/enums.js';
import {
  BID_CLARIFICATIONS,
  COMPLIANCE_CHECKS,
  ENVELOPE_OPENINGS,
  EXCLUSIONS,
  OPENING_BIDS,
  OPENING_LOTS,
  OPENING_PARTICIPANTS,
  OPENING_SESSIONS,
  OPENING_TENDERS,
  OPENING_TIME_ZONE,
  PRICE_GATE_RELEASES,
} from '../../fixtures/opening.js';
import type {
  FixtureBidClarification,
  FixtureComplianceCheck,
  FixtureEnvelopeOpening,
  FixtureExclusion,
  FixtureOpeningBid,
  FixtureOpeningParticipant,
  FixtureOpeningSession,
  FixtureOpeningTender,
} from '../../fixtures/opening.js';
import { findPersonaById, personRef } from '../../persona.js';

// ---------------------------------------------------------------------------------------------------------
// Lookups (always scoped by the buyer tenant)
// ---------------------------------------------------------------------------------------------------------

export function tendersOf(tenantId: number): FixtureOpeningTender[] {
  return OPENING_TENDERS.filter((tender) => tender.tenantId === tenantId);
}

export function tenderOf(tenantId: number, tenderId: number): FixtureOpeningTender | undefined {
  return OPENING_TENDERS.find((tender) => tender.tenantId === tenantId && tender.tenderId === tenderId);
}

export function bidsOfTender(tender: FixtureOpeningTender): FixtureOpeningBid[] {
  return OPENING_BIDS.filter((bid) => bid.tenantId === tender.tenantId && bid.tenderId === tender.tenderId);
}

export function bidOf(tenantId: number, bidId: number): FixtureOpeningBid | undefined {
  return OPENING_BIDS.find((bid) => bid.tenantId === tenantId && bid.bidId === bidId);
}

export function tenderOfBid(bid: FixtureOpeningBid): FixtureOpeningTender {
  const tender = tenderOf(bid.tenantId, bid.tenderId);
  if (tender === undefined) {
    throw new Error(`Bid ${bid.bidId} has no tender fixture.`);
  }
  return tender;
}

export function sessionsOfTender(tender: FixtureOpeningTender): FixtureOpeningSession[] {
  return OPENING_SESSIONS.filter((session) => session.tenantId === tender.tenantId && session.tenderId === tender.tenderId);
}

export function sessionOf(tenantId: number, sessionId: number): FixtureOpeningSession | undefined {
  return OPENING_SESSIONS.find((session) => session.tenantId === tenantId && session.id === sessionId);
}

export function tenderOfSession(session: FixtureOpeningSession): FixtureOpeningTender {
  const tender = tenderOf(session.tenantId, session.tenderId);
  if (tender === undefined) {
    throw new Error(`Session ${session.id} has no tender fixture.`);
  }
  return tender;
}

export function participantsOf(sessionId: number): FixtureOpeningParticipant[] {
  return OPENING_PARTICIPANTS.filter((participant) => participant.sessionId === sessionId);
}

export function checksOfBid(bid: FixtureOpeningBid): FixtureComplianceCheck[] {
  return COMPLIANCE_CHECKS.filter((check) => check.tenantId === bid.tenantId && check.bidId === bid.bidId);
}

export function checkOf(tenantId: number, checkId: number): FixtureComplianceCheck | undefined {
  return COMPLIANCE_CHECKS.find((check) => check.tenantId === tenantId && check.id === checkId);
}

export function clarificationsOf(tenantId: number): FixtureBidClarification[] {
  return BID_CLARIFICATIONS.filter((clarification) => clarification.tenantId === tenantId);
}

export function clarificationOf(tenantId: number, clarificationId: number): FixtureBidClarification | undefined {
  return BID_CLARIFICATIONS.find((clarification) => clarification.tenantId === tenantId && clarification.id === clarificationId);
}

export function exclusionsOf(tenantId: number): FixtureExclusion[] {
  return EXCLUSIONS.filter((exclusion) => exclusion.tenantId === tenantId);
}

export function exclusionOf(tenantId: number, exclusionId: number): FixtureExclusion | undefined {
  return EXCLUSIONS.find((exclusion) => exclusion.tenantId === tenantId && exclusion.id === exclusionId);
}

export function openingsOfBid(bid: FixtureOpeningBid): FixtureEnvelopeOpening[] {
  return ENVELOPE_OPENINGS.filter((opening) => opening.tenantId === bid.tenantId && opening.bidId === bid.bidId);
}

export function bidOfClarification(clarification: FixtureBidClarification): FixtureOpeningBid {
  const bid = bidOf(clarification.tenantId, clarification.bidId);
  if (bid === undefined) {
    throw new Error(`Clarification ${clarification.id} has no bid fixture.`);
  }
  return bid;
}

// ---------------------------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------------------------

export function lotRef(lotId: number): LotRef {
  const lot = OPENING_LOTS.find((row) => row.lotId === lotId);
  if (lot === undefined) {
    throw new Error(`Unknown lot ${lotId}.`);
  }
  return { lotId: lot.lotId, lotNo: lot.lotNo, title: lot.title, stage: lot.stage };
}

export function deadline(at: string): { at: string; timeZone: string } {
  return { at, timeZone: OPENING_TIME_ZONE };
}

export function capacityOf(userId: number, tenantId: number): string | null {
  const membership = findPersonaById(userId)?.memberships.find((row) => row.tenantId === tenantId);
  return membership?.capacity ?? null;
}

/** Envelopes a session opens: its own envelope, or all of the tender's for a single-stage session (DD-05). */
export function envelopesOfSession(tender: FixtureOpeningTender, envelope: OpeningSessionsEnvelope): TenderEnvelopesEnvelope[] {
  return envelope === 'all' ? [...tender.envelopes] : [envelope];
}

export function isTenderClosed(tender: FixtureOpeningTender): boolean {
  return tender.closedAt !== null && tender.status !== 'open';
}

export function openedEnvelopesOfTender(tender: FixtureOpeningTender): Set<TenderEnvelopesEnvelope> {
  const bidIds = new Set(bidsOfTender(tender).map((bid) => bid.bidId));
  return new Set(
    ENVELOPE_OPENINGS.filter((opening) => opening.tenantId === tender.tenantId && bidIds.has(opening.bidId)).map(
      (opening) => opening.envelope,
    ),
  );
}

export function priceGateOf(tender: FixtureOpeningTender, lotId: number | null): PriceGateState {
  const applies = tender.openingMode === 'staged';
  const release = PRICE_GATE_RELEASES.find(
    (row) => row.tenantId === tender.tenantId && row.tenderId === tender.tenderId && (row.lotId === null || row.lotId === lotId),
  );
  return {
    lotId,
    applies,
    released: applies && release !== undefined,
    releasedAt: release?.releasedAt ?? null,
    releasedBy: release === undefined ? null : personRef(release.releasedBy),
    nonPriceCompleteConfirmed: release?.nonPriceCompleteConfirmed ?? false,
    note: release?.note ?? null,
  };
}

/** Earlier envelopes (open order) that are not opened yet: a staged stage may open only after them. */
export function missingEarlierStages(tender: FixtureOpeningTender, envelope: OpeningSessionsEnvelope): TenderEnvelopesEnvelope[] {
  if (tender.openingMode !== 'staged' || envelope === 'all') {
    return [];
  }
  const opened = openedEnvelopesOfTender(tender);
  const index = tender.envelopes.indexOf(envelope);
  return tender.envelopes.slice(0, Math.max(index, 0)).filter((earlier) => !opened.has(earlier));
}

export function activeExclusionOf(bid: FixtureOpeningBid): FixtureExclusion | undefined {
  return EXCLUSIONS.find(
    (exclusion) =>
      exclusion.tenantId === bid.tenantId &&
      exclusion.bidId === bid.bidId &&
      (exclusion.status === 'proposed' || exclusion.status === 'awaiting_approval' || exclusion.status === 'approved'),
  );
}

export function isOpenClarification(clarification: FixtureBidClarification): boolean {
  return (
    clarification.consolidatedIntoId === null &&
    (clarification.status === 'draft' ||
      clarification.status === 'approved' ||
      clarification.status === 'issued' ||
      clarification.status === 'responded')
  );
}

export function qualificationOpened(bid: FixtureOpeningBid): boolean {
  return openingsOfBid(bid).some((opening) => opening.envelope === 'qualification');
}

// ---------------------------------------------------------------------------------------------------------
// Envelopes, eligibility and quorum
// ---------------------------------------------------------------------------------------------------------

/** The envelope states of a bid: opened (unseal record), withheld (a completed session skipped it) or sealed. */
export function bidEnvelopes(bid: FixtureOpeningBid, extraOpenings: readonly FixtureEnvelopeOpening[] = []): BidEnvelopeState[] {
  const tender = tenderOfBid(bid);
  const openings = [...openingsOfBid(bid), ...extraOpenings.filter((opening) => opening.bidId === bid.bidId)];
  const completed = sessionsOfTender(tender).filter((session) => session.status === 'completed');
  return tender.envelopes.map((envelope) => {
    const opening = openings.find((row) => row.envelope === envelope);
    if (opening !== undefined) {
      return { envelope, state: 'opened', openedAt: opening.openedAt };
    }
    const skipped = completed.some((session) => session.envelope === envelope || session.envelope === 'all');
    return { envelope, state: skipped ? 'withheld' : 'sealed', openedAt: null };
  });
}

export function ineligibleReason(bid: FixtureOpeningBid, envelopes: readonly TenderEnvelopesEnvelope[], lotId: number | null): IneligibleReason | null {
  if (bid.submissionState === 'withdrawn' || bid.receiptStatus === 'withdrawn') {
    return 'withdrawn';
  }
  if (bid.receiptStatus === 'late_rejected') {
    return 'late_rejected';
  }
  if (lotId !== null && !bid.lotIds.includes(lotId)) {
    return 'not_in_lot';
  }
  if (bid.complianceStatus === 'excluded') {
    return 'excluded';
  }
  const exclusion = activeExclusionOf(bid);
  if (exclusion !== undefined && envelopes.includes('commercial')) {
    return exclusion.status === 'approved' ? 'excluded' : 'exclusion_pending';
  }
  return null;
}

export function quorumOf(session: Pick<FixtureOpeningSession, 'quorumRequired' | 'openingOfficerUserId'>, participants: readonly FixtureOpeningParticipant[]): QuorumState {
  const counted = participants.filter((participant) => participant.role !== 'observer' && participant.confirmedAt !== null);
  const officerConfirmed = counted.some((participant) => participant.userId === session.openingOfficerUserId);
  return {
    required: session.quorumRequired,
    confirmed: counted.length,
    met: officerConfirmed && counted.length >= session.quorumRequired,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------------------------------------

export function sessionRow(session: FixtureOpeningSession, participants: readonly FixtureOpeningParticipant[] = participantsOf(session.id), openingsCount?: number): OpeningSessionRow {
  const tender = tenderOfSession(session);
  return {
    id: session.id,
    tenderId: tender.tenderId,
    tenderReference: tender.reference,
    tenderTitle: tender.title,
    lot: session.lotId === null ? null : lotRef(session.lotId),
    envelope: session.envelope,
    status: session.status,
    scheduledAt: deadline(session.scheduledAt),
    openedAt: session.openedAt,
    openingOfficer: personRef(session.openingOfficerUserId),
    quorum: quorumOf(session, participants),
    envelopesOpened: openingsCount ?? ENVELOPE_OPENINGS.filter((opening) => opening.tenantId === session.tenantId && opening.sessionId === session.id).length,
    publicReleaseApproved: session.publicReleaseApproved,
  };
}

export function readinessOf(session: FixtureOpeningSession, participants: readonly FixtureOpeningParticipant[]): OpeningReadinessItem[] {
  const tender = tenderOfSession(session);
  const quorum = quorumOf(session, participants);
  const officerConfirmed = participants.some(
    (participant) => participant.userId === session.openingOfficerUserId && participant.confirmedAt !== null,
  );
  const completed = session.status === 'completed';
  const items: OpeningReadinessItem[] = [
    { code: 'tender_closed', status: completed || isTenderClosed(tender) ? 'passed' : 'blocking' },
    { code: 'officer_confirmed', status: completed || officerConfirmed ? 'passed' : 'blocking' },
    { code: 'quorum', status: completed || quorum.met ? 'passed' : 'blocking' },
  ];
  if (tender.openingMode === 'staged') {
    items.push({ code: 'stage_order', status: completed || missingEarlierStages(tender, session.envelope).length === 0 ? 'passed' : 'blocking' });
    if (session.envelope === 'commercial') {
      items.push({ code: 'price_gate', status: priceGateOf(tender, session.lotId).released ? 'passed' : 'blocking' });
    }
  }
  return items;
}

export interface SessionDetailOptions {
  readonly callerUserId: number;
  readonly participants?: readonly FixtureOpeningParticipant[];
  /** Unseal records written by the command being answered (static, never stored). */
  readonly newOpenings?: readonly FixtureEnvelopeOpening[];
}

export function sessionDetail(session: FixtureOpeningSession, options: SessionDetailOptions): OpeningSessionDetail {
  const tender = tenderOfSession(session);
  const participants = options.participants ?? participantsOf(session.id);
  const newOpenings = options.newOpenings ?? [];
  const sessionOpenings = [
    ...ENVELOPE_OPENINGS.filter((opening) => opening.tenantId === session.tenantId && opening.sessionId === session.id),
    ...newOpenings,
  ];
  const envelopes = envelopesOfSession(tender, session.envelope);
  const bids: SessionBid[] = bidsOfTender(tender).map((bid) => {
    const openedHere = sessionOpenings.some((opening) => opening.bidId === bid.bidId);
    const reason = ineligibleReason(bid, envelopes, session.lotId);
    const eligible = session.status === 'completed' ? openedHere : reason === null;
    return {
      bidId: bid.bidId,
      revisionId: bid.revisionId,
      supplier: { tenantId: bid.supplierTenantId, name: bid.supplierName },
      receiptNo: bid.receiptNo,
      receivedAt: bid.receivedAt,
      submissionState: bid.submissionState,
      eligible,
      ineligibleReason: eligible ? null : (reason ?? 'withdrawn'),
      envelopes: bidEnvelopes(bid, newOpenings),
    };
  });
  const openings: EnvelopeOpening[] = sessionOpenings.map((opening) => {
    const bid = OPENING_BIDS.find((row) => row.bidId === opening.bidId && row.tenantId === opening.tenantId);
    if (bid === undefined) {
      throw new Error(`Opening ${opening.id} has no bid fixture.`);
    }
    return {
      id: opening.id,
      bidId: opening.bidId,
      revisionId: opening.revisionId,
      supplier: { tenantId: bid.supplierTenantId, name: bid.supplierName },
      envelope: opening.envelope,
      openedAt: opening.openedAt,
    };
  });
  const participantRows: OpeningParticipant[] = participants.map((participant) => ({
    id: participant.id,
    user: personRef(participant.userId),
    capacity: capacityOf(participant.userId, session.tenantId),
    role: participant.role,
    confirmedAt: participant.confirmedAt,
  }));
  return {
    ...sessionRow(session, participants, openings.length),
    tenderStatus: session.status === 'completed' && tender.status === 'closed' && newOpenings.length > 0 ? 'under_assessment' : tender.status,
    openingMode: tender.openingMode,
    quorumRequired: session.quorumRequired,
    participants: participantRows,
    myParticipantId: participants.find((participant) => participant.userId === options.callerUserId)?.id ?? null,
    bids,
    openings,
    priceGate: priceGateOf(tender, session.lotId),
    readiness: readinessOf(session, participants),
    minutes: session.minutes,
    irregularities: session.irregularities,
    publicReleaseSummary: session.publicReleaseSummary,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Tenders
// ---------------------------------------------------------------------------------------------------------

export function progressOf(tender: FixtureOpeningTender): OpeningProgress {
  if (!isTenderClosed(tender)) {
    return 'not_closed';
  }
  const opened = openedEnvelopesOfTender(tender);
  if (opened.size === 0) {
    return 'awaiting_opening';
  }
  return tender.envelopes.every((envelope) => opened.has(envelope)) ? 'fully_opened' : 'partially_opened';
}

function pendingClarificationCount(tender: FixtureOpeningTender): number {
  const bidIds = new Set(bidsOfTender(tender).map((bid) => bid.bidId));
  return BID_CLARIFICATIONS.filter((row) => row.tenantId === tender.tenantId && bidIds.has(row.bidId) && isOpenClarification(row)).length;
}

function activeExclusionCount(tender: FixtureOpeningTender): number {
  return bidsOfTender(tender).filter((bid) => activeExclusionOf(bid) !== undefined).length;
}

export function tenderRow(tender: FixtureOpeningTender): OpeningTenderRow {
  const opened = openedEnvelopesOfTender(tender);
  const next = sessionsOfTender(tender)
    .filter((session) => session.status === 'scheduled' || session.status === 'awaiting_quorum')
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0];
  const closed = isTenderClosed(tender);
  return {
    tenderId: tender.tenderId,
    reference: tender.reference,
    title: tender.title,
    eventType: tender.eventType,
    procedure: tender.procedure,
    participation: tender.participation,
    status: tender.status,
    openingMode: tender.openingMode,
    owner: personRef(tender.ownerUserId),
    submissionDeadline: deadline(tender.submissionDeadline),
    closedAt: tender.closedAt,
    progress: progressOf(tender),
    effectiveSubmissionCount: closed ? bidsOfTender(tender).filter((bid) => bid.submissionState === 'submitted').length : null,
    envelopesOpened: tender.envelopes.filter((envelope) => opened.has(envelope)),
    nextSession:
      next === undefined
        ? null
        : {
            sessionId: next.id,
            envelope: next.envelope,
            lot: next.lotId === null ? null : lotRef(next.lotId),
            scheduledAt: deadline(next.scheduledAt),
            status: next.status,
          },
    priceGatePending: tender.openingMode === 'staged' && !opened.has('commercial') && !priceGateOf(tender, null).released,
    pendingClarifications: pendingClarificationCount(tender),
    activeExclusions: activeExclusionCount(tender),
  };
}

export function stagesOf(tender: FixtureOpeningTender): OpeningStage[] {
  const sessions = sessionsOfTender(tender).filter((session) => session.status !== 'aborted');
  const opened = openedEnvelopesOfTender(tender);
  const plan: OpeningSessionsEnvelope[] = tender.openingMode === 'single_stage' ? ['all'] : [...tender.envelopes];
  return plan.map((envelope, index) => {
    const own = sessions
      .filter((session) => session.envelope === envelope)
      .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))[0];
    const isOpened = envelope === 'all' ? opened.size > 0 : opened.has(envelope);
    let state: OpeningStage['state'];
    if (tender.status === 'cancelled' && !isOpened) {
      state = 'cancelled';
    } else if (isOpened) {
      state = 'opened';
    } else if (envelope === 'commercial' && !priceGateOf(tender, null).released) {
      state = 'blocked_by_price_gate';
    } else if (own !== undefined && (own.status === 'scheduled' || own.status === 'awaiting_quorum')) {
      // The stage state follows the confirmed presence, not the stored status alone: a session whose quorum is met
      // is ready to open, and one that has entered its presence check without quorum awaits quorum.
      const quorum = quorumOf(own, participantsOf(own.id));
      state = own.status === 'awaiting_quorum' && !quorum.met ? 'awaiting_quorum' : 'scheduled';
    } else {
      state = 'sealed';
    }
    return {
      envelope,
      openOrder: index + 1,
      lot: null,
      state,
      sessionId: own?.id ?? null,
      openedAt: isOpened && own?.status === 'completed' ? own.openedAt : null,
    };
  });
}

export function tenderOverview(tender: FixtureOpeningTender): TenderOpeningOverview {
  const { nextSession: _nextSession, ...row } = tenderRow(tender);
  const lots = OPENING_LOTS.filter((lot) => lot.tenderId === tender.tenderId).map((lot) => lotRef(lot.lotId));
  return {
    tender: { ...row, officialTimeZone: OPENING_TIME_ZONE, publicOpeningRequired: tender.publicOpeningRequired },
    lots,
    stages: stagesOf(tender),
    // A tender with lots releases its price gate per lot (DD-02); a tender without lots has one gate.
    priceGates:
      tender.openingMode !== 'staged' ? [] : lots.length === 0 ? [priceGateOf(tender, null)] : lots.map((lot) => priceGateOf(tender, lot.lotId)),
    sessions: sessionsOfTender(tender)
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
      .map((session) => sessionRow(session)),
    bids: isTenderClosed(tender)
      ? bidsOfTender(tender).map((bid) => ({
          bidId: bid.bidId,
          revisionId: bid.revisionId,
          supplier: { tenantId: bid.supplierTenantId, name: bid.supplierName },
          receiptNo: bid.receiptNo,
          receivedAt: bid.receivedAt,
          submissionState: bid.submissionState,
          receiptStatus: bid.receiptStatus,
          documentCount: bid.documentCount,
          lots: bid.lotIds.map(lotRef),
          envelopes: bidEnvelopes(bid),
        }))
      : [],
  };
}

// ---------------------------------------------------------------------------------------------------------
// Compliance
// ---------------------------------------------------------------------------------------------------------

export function checkRow(check: FixtureComplianceCheck): ComplianceCheck {
  return {
    id: check.id,
    bidId: check.bidId,
    revisionId: check.revisionId,
    checkType: check.checkType,
    requirement: check.requirement === null ? null : { ...check.requirement },
    findingClass: check.findingClass,
    result: check.result,
    reason: check.reason,
    evidenceRef: check.evidenceRef,
    assessedBy: check.assessedBy === null ? null : personRef(check.assessedBy),
    assessedAt: check.assessedAt,
  };
}

export function isRankingEligible(bid: FixtureOpeningBid): boolean {
  return (
    bid.submissionState === 'submitted' &&
    bid.receiptStatus !== 'late_rejected' &&
    bid.complianceStatus !== 'excluded' &&
    bid.complianceStatus !== 'non_compliant' &&
    activeExclusionOf(bid) === undefined
  );
}

export function complianceBidRow(bid: FixtureOpeningBid, overrides: Partial<Pick<ComplianceBidRow, 'complianceStatus'>> = {}): ComplianceBidRow {
  const checks = checksOfBid(bid);
  const count = (result: FixtureComplianceCheck['result']): number => checks.filter((check) => check.result === result).length;
  const exclusions = EXCLUSIONS.filter((exclusion) => exclusion.tenantId === bid.tenantId && exclusion.bidId === bid.bidId);
  const shown = activeExclusionOf(bid) ?? [...exclusions].sort((a, b) => b.proposedAt.localeCompare(a.proposedAt))[0];
  return {
    bidId: bid.bidId,
    revisionId: bid.revisionId,
    tenderId: bid.tenderId,
    supplier: { tenantId: bid.supplierTenantId, name: bid.supplierName },
    receiptNo: bid.receiptNo,
    receivedAt: bid.receivedAt,
    submissionState: bid.submissionState,
    receiptStatus: bid.receiptStatus,
    lots: bid.lotIds.map(lotRef),
    complianceStatus: overrides.complianceStatus ?? bid.complianceStatus,
    evaluationStatus: bid.evaluationStatus,
    envelopes: bidEnvelopes(bid),
    checkSummary: {
      pass: count('pass'),
      fail: count('fail'),
      clarificationRequired: count('clarification_required'),
      pending: count('pending'),
      notApplicable: count('not_applicable'),
    },
    openClarifications: BID_CLARIFICATIONS.filter(
      (row) => row.tenantId === bid.tenantId && row.bidId === bid.bidId && isOpenClarification(row),
    ).length,
    exclusion: shown === undefined ? null : { exclusionId: shown.id, status: shown.status },
    rankingEligible: isRankingEligible(bid),
  };
}

// ---------------------------------------------------------------------------------------------------------
// Clarifications
// ---------------------------------------------------------------------------------------------------------

export function clarificationRow(clarification: FixtureBidClarification): ClarificationRow {
  const bid = bidOfClarification(clarification);
  const tender = tenderOfBid(bid);
  return {
    id: clarification.id,
    tenderId: tender.tenderId,
    tenderReference: tender.reference,
    bidId: bid.bidId,
    supplier: { tenantId: bid.supplierTenantId, name: bid.supplierName },
    source: clarification.source,
    question: clarification.question,
    permittedScope: clarification.permittedScope,
    dueAt: clarification.dueAt === null ? null : deadline(clarification.dueAt),
    status: clarification.status,
    raisedBy: personRef(clarification.raisedBy),
    raisedAt: clarification.raisedAt,
    approvedBy: clarification.approvedBy === null ? null : personRef(clarification.approvedBy),
    consolidatedIntoId: clarification.consolidatedIntoId,
    consolidatedCount: BID_CLARIFICATIONS.filter(
      (row) => row.tenantId === clarification.tenantId && row.consolidatedIntoId === clarification.id,
    ).length,
    respondedAt: clarification.respondedAt,
    effect: clarification.effect,
  };
}

export function clarificationDetail(
  clarification: FixtureBidClarification,
  merged: readonly FixtureBidClarification[] = BID_CLARIFICATIONS.filter(
    (row) => row.tenantId === clarification.tenantId && row.consolidatedIntoId === clarification.id,
  ),
): ClarificationDetail {
  return {
    ...clarificationRow(clarification),
    consolidatedCount: merged.length,
    responseText: clarification.responseText,
    respondedBy: clarification.respondedBy === null ? null : personRef(clarification.respondedBy),
    effectNote: clarification.effectNote,
    attachments: clarification.attachments.map((attachment) => ({ ...attachment })),
    consolidated: merged.map((row) => clarificationRow(row)),
    distributedTo: clarification.distributedTo.map((userId) => personRef(userId)),
  };
}

// ---------------------------------------------------------------------------------------------------------
// Exclusions
// ---------------------------------------------------------------------------------------------------------

export function exclusionRow(exclusion: FixtureExclusion): ExclusionRow {
  const bid = bidOf(exclusion.tenantId, exclusion.bidId);
  if (bid === undefined) {
    throw new Error(`Exclusion ${exclusion.id} has no bid fixture.`);
  }
  const tender = tenderOfBid(bid);
  const commercial = bidEnvelopes(bid).find((envelope) => envelope.envelope === 'commercial');
  return {
    id: exclusion.id,
    tenderId: tender.tenderId,
    tenderReference: tender.reference,
    tenderTitle: tender.title,
    bidId: bid.bidId,
    supplier: { tenantId: bid.supplierTenantId, name: bid.supplierName },
    grounds: exclusion.grounds,
    checkIds: [...exclusion.checkIds],
    status: exclusion.status,
    proposedBy: personRef(exclusion.proposedBy),
    proposedAt: exclusion.proposedAt,
    approvalRequestId: exclusion.approvalRequestId,
    approvalStatus: exclusion.approvalStatus,
    noticeId: exclusion.noticeId,
    noticeStatus: exclusion.noticeStatus,
    notifiedAt: exclusion.notifiedAt,
    challengeRoute: exclusion.challengeRoute,
    commercialEnvelope: commercial?.state ?? 'sealed',
  };
}

export function exclusionDetail(exclusion: FixtureExclusion): ExclusionDetail {
  const checks = exclusion.checkIds
    .map((checkId) => checkOf(exclusion.tenantId, checkId))
    .filter((check): check is FixtureComplianceCheck => check !== undefined)
    .map(checkRow);
  return {
    ...exclusionRow(exclusion),
    checks,
    approval:
      exclusion.approvalRequestId === null || exclusion.approvalStatus === null
        ? null
        : {
            approvalRequestId: exclusion.approvalRequestId,
            status: exclusion.approvalStatus,
            decidedAt: exclusion.approvalDecidedAt,
            decidedBy: exclusion.approvalDecidedBy === null ? null : personRef(exclusion.approvalDecidedBy),
          },
    withdrawnReason: exclusion.withdrawnReason,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Sorting and search
// ---------------------------------------------------------------------------------------------------------

type SortValue = string | number | null;

/** Sorts rows by one key (nulls last in both directions). */
export function sortRows<T>(rows: readonly T[], key: (row: T) => SortValue, dir: 'asc' | 'desc'): T[] {
  const factor = dir === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const left = key(a);
    const right = key(b);
    if (left === right) {
      return 0;
    }
    if (left === null) {
      return 1;
    }
    if (right === null) {
      return -1;
    }
    if (typeof left === 'number' && typeof right === 'number') {
      return (left - right) * factor;
    }
    return String(left).localeCompare(String(right)) * factor;
  });
}

/** Case-insensitive search over the given fields. */
export function matchesSearch(q: string | undefined, fields: ReadonlyArray<string | null>): boolean {
  if (q === undefined || q.trim() === '') {
    return true;
  }
  const needle = q.trim().toLowerCase();
  return fields.some((field) => field !== null && field.toLowerCase().includes(needle));
}

const OFFICIAL_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: OPENING_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Whether an instant falls within calendar dates (`YYYY-MM-DD`, inclusive) in the official time zone. */
export function withinDates(instant: string | null, from: string | undefined, to: string | undefined): boolean {
  if (from === undefined && to === undefined) {
    return true;
  }
  if (instant === null) {
    return false;
  }
  const local = OFFICIAL_DATE.format(new Date(instant));
  return (from === undefined || local >= from) && (to === undefined || local <= to);
}
