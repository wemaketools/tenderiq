/**
 * Mock handlers of the opening contract (src/contracts/opening.ts; BUY-20, BUY-21, EVA-03, SUP-18).
 *
 * - Every buyer read is scoped to the caller's buyer tenant; another tenant's record is simply not found.
 * - Administrators, auditors and operator support grants never reach these handlers: none of them holds an opening,
 *   compliance or clarification permission, so the middleware answers 403 (AC-15, BR-26).
 * - Before opening, bid rows carry receipt metadata only and compliance checks stay empty (BR-17).
 * - Evaluators without compliance, chair or approver permissions see only their own questions and the answers
 *   distributed to them.
 * - Suppliers see only their own issued clarifications (never drafts, other suppliers, assessors or effects).
 * - Commands validate against the fixture state, answer the business error it implies, or return the outcome.
 *   Nothing persists.
 */
import { openingEndpoints } from '../../../contracts/opening.js';
import type { AssessmentRequestDetail, AssessmentRequestRow, OpeningTenderRow } from '../../../contracts/opening.js';
import type { PermissionCode } from '../../../contracts/permissions.js';
import { mockRoute } from '../../app.js';
import type { MockApp } from '../../app.js';
import { OPENING_LOTS, OPENING_TEAM, OPENING_TENDERS } from '../../fixtures/opening.js';
import type {
  FixtureBidClarification,
  FixtureEnvelopeOpening,
  FixtureExclusion,
  FixtureOpeningParticipant,
  FixtureOpeningSession,
} from '../../fixtures/opening.js';
import { findPersonaById, membershipPermissions, personRef } from '../../persona.js';
import {
  activeExclusionOf,
  bidOf,
  bidOfClarification,
  bidsOfTender,
  capacityOf,
  checkOf,
  checkRow,
  checksOfBid,
  clarificationDetail,
  clarificationOf,
  clarificationRow,
  clarificationsOf,
  complianceBidRow,
  deadline,
  envelopesOfSession,
  exclusionDetail,
  exclusionOf,
  exclusionRow,
  exclusionsOf,
  ineligibleReason,
  isOpenClarification,
  isTenderClosed,
  matchesSearch,
  missingEarlierStages,
  openedEnvelopesOfTender,
  participantsOf,
  priceGateOf,
  qualificationOpened,
  quorumOf,
  sessionDetail,
  sessionOf,
  sessionRow,
  sessionsOfTender,
  sortRows,
  tenderOf,
  tenderOfBid,
  tenderOfSession,
  tenderOverview,
  tenderRow,
  tendersOf,
  withinDates,
} from './projections.js';

/** Buyer tenants whose clarifications a supplier may receive (every buyer with opening fixtures). */
const BUYER_TENANT_IDS: readonly number[] = [...new Set(OPENING_TENDERS.map((tender) => tender.tenantId))];

/** First id of records a command "creates" (static prototype: nothing is stored). */
const NEW_ID = 900;

function hasAny(granted: readonly PermissionCode[], codes: readonly PermissionCode[]): boolean {
  return codes.some((code) => granted.includes(code));
}

/** Full clarification visibility: compliance assessors, the chair and exclusion approvers. */
const CLARIFICATION_OVERSIGHT: readonly PermissionCode[] = ['compliance.assess', 'evaluation.chair', 'exclusion.approve'];

function canSeeClarification(clarification: FixtureBidClarification, userId: number, permissions: readonly PermissionCode[]): boolean {
  if (hasAny(permissions, CLARIFICATION_OVERSIGHT)) {
    return true;
  }
  return clarification.raisedBy === userId || clarification.distributedTo.includes(userId);
}

/** Whether a person holds `evaluation.score` in the tenant (a valid recipient of a distributed answer). */
function isAssessor(userId: number, tenantId: number): boolean {
  const membership = findPersonaById(userId)?.memberships.find((row) => row.tenantId === tenantId && row.status === 'active');
  return membership !== undefined && membershipPermissions(membership).includes('evaluation.score');
}

function supplierRow(clarification: FixtureBidClarification, buyerName: string): AssessmentRequestRow | null {
  if (
    clarification.consolidatedIntoId !== null ||
    !(
      clarification.status === 'issued' ||
      clarification.status === 'responded' ||
      clarification.status === 'closed' ||
      clarification.status === 'expired'
    )
  ) {
    return null;
  }
  const bid = bidOfClarification(clarification);
  const tender = tenderOfBid(bid);
  return {
    id: clarification.id,
    buyer: { tenantId: clarification.tenantId, name: buyerName },
    tenderId: tender.tenderId,
    tenderReference: tender.reference,
    tenderTitle: tender.title,
    bidId: bid.bidId,
    source: clarification.source,
    question: clarification.question,
    permittedScope: clarification.permittedScope,
    dueAt: clarification.dueAt === null ? null : deadline(clarification.dueAt),
    status: clarification.status,
    respondedAt: clarification.respondedAt,
    respondedBy: clarification.respondedBy === null ? null : personRef(clarification.respondedBy),
  };
}

function supplierDetail(row: AssessmentRequestRow, clarification: FixtureBidClarification): AssessmentRequestDetail {
  return {
    ...row,
    responseText: clarification.responseText,
    attachments: clarification.attachments.map((attachment) => ({ ...attachment })),
  };
}

export function register(app: MockApp): void {
  // BUY-20 -----------------------------------------------------------------------------------------------

  mockRoute(app, openingEndpoints.listTenders, ({ requireTenant, query, fixtures }) => {
    const { tenant } = requireTenant();
    const rows = tendersOf(tenant.id)
      .map(tenderRow)
      .filter((row) => matchesSearch(query.q, [row.reference, row.title]))
      .filter((row) => query.status === undefined || query.status.includes(row.status))
      .filter((row) => query.openingMode === undefined || query.openingMode.includes(row.openingMode))
      .filter((row) => query.progress === undefined || query.progress.includes(row.progress))
      .filter((row) => query.ownerUserId === undefined || row.owner.userId === query.ownerUserId)
      .filter((row) => query.priceGatePending === undefined || row.priceGatePending === query.priceGatePending)
      .filter((row) => withinDates(row.closedAt, query.closedFrom, query.closedTo));
    const keys: Record<NonNullable<typeof query.sort>, (row: OpeningTenderRow) => string | null> = {
      reference: (row) => row.reference,
      deadline: (row) => row.submissionDeadline?.at ?? null,
      closedAt: (row) => row.closedAt,
      status: (row) => row.status,
    };
    return fixtures.page(sortRows(rows, keys[query.sort ?? 'deadline'], query.sort === undefined ? 'desc' : query.dir));
  });

  mockRoute(app, openingEndpoints.getTender, ({ requireTenant, params, notFound }) => {
    const tender = tenderOf(requireTenant().tenant.id, params.tenderId) ?? notFound();
    return tenderOverview(tender);
  });

  mockRoute(app, openingEndpoints.getOpeningTeam, ({ requireTenant, params, notFound }) => {
    const tenantId = requireTenant().tenant.id;
    const tender = tenderOf(tenantId, params.tenderId) ?? notFound();
    return {
      items: OPENING_TEAM.filter((member) => member.tenantId === tenantId && member.tenderId === tender.tenderId).map((member) => ({
        user: personRef(member.userId),
        capacity: capacityOf(member.userId, tenantId),
        teamRole: member.teamRole,
        eligibleRoles: [...member.eligibleRoles],
      })),
    };
  });

  mockRoute(app, openingEndpoints.listSessions, ({ requireTenant, query, fixtures }) => {
    const tenantId = requireTenant().tenant.id;
    const rows = tendersOf(tenantId)
      .filter((tender) => query.tenderId === undefined || tender.tenderId === query.tenderId)
      .flatMap((tender) => sessionsOfTender(tender))
      .filter((session) => query.status === undefined || query.status.includes(session.status))
      .filter((session) => query.envelope === undefined || query.envelope.includes(session.envelope))
      .filter((session) => query.officerUserId === undefined || session.openingOfficerUserId === query.officerUserId)
      .filter((session) => withinDates(session.scheduledAt, query.scheduledFrom, query.scheduledTo))
      .map((session) => sessionRow(session))
      .filter((row) => matchesSearch(query.q, [row.tenderReference, row.tenderTitle, row.openingOfficer.fullName]));
    const sort = query.sort ?? 'scheduledAt';
    const keyed = sortRows(
      rows,
      (row) => (sort === 'scheduledAt' ? row.scheduledAt.at : sort === 'openedAt' ? row.openedAt : sort === 'reference' ? row.tenderReference : row.status),
      query.sort === undefined ? 'desc' : query.dir,
    );
    return fixtures.page(keyed);
  });

  mockRoute(app, openingEndpoints.getSession, ({ requireTenant, requirePersona, params, notFound }) => {
    const session = sessionOf(requireTenant().tenant.id, params.sessionId) ?? notFound();
    return sessionDetail(session, { callerUserId: requirePersona().userId });
  });

  mockRoute(app, openingEndpoints.scheduleSession, ({ requireTenant, requirePersona, body, fail, notFound }) => {
    const tenantId = requireTenant().tenant.id;
    const tender = tenderOf(tenantId, body.tenderId) ?? notFound('Tender not found.');
    const lotId = body.lotId ?? null;
    if (lotId !== null) {
      const lot =
        OPENING_LOTS.find((row) => row.lotId === lotId && row.tenderId === tender.tenderId) ??
        fail(422, 'LOT_NOT_IN_TENDER', 'The lot does not belong to this tender.');
      if (lot.stage === 'cancelled') {
        fail(409, 'LOT_CANCELLED', 'The lot is cancelled; its envelopes are not opened.');
      }
    }
    if ((tender.openingMode === 'single_stage') !== (body.envelope === 'all')) {
      fail(
        422,
        'ENVELOPE_NOT_IN_PLAN',
        tender.openingMode === 'single_stage'
          ? 'This tender opens in a single stage: schedule the whole submission (all envelopes).'
          : 'This tender opens in stages: schedule one envelope at a time.',
      );
    }
    if (body.scheduledAt < tender.submissionDeadline) {
      fail(422, 'SCHEDULED_BEFORE_CLOSING', 'The opening cannot be scheduled before the submission deadline.');
    }
    const opened = openedEnvelopesOfTender(tender);
    if (envelopesOfSession(tender, body.envelope).some((envelope) => opened.has(envelope))) {
      fail(409, 'STAGE_ALREADY_OPENED', 'This stage has already been opened.');
    }
    const pending = sessionsOfTender(tender).find(
      (session) =>
        session.envelope === body.envelope &&
        session.lotId === lotId &&
        (session.status === 'scheduled' || session.status === 'awaiting_quorum'),
    );
    if (pending !== undefined) {
      fail(409, 'SESSION_ALREADY_SCHEDULED', 'A session for this stage is already scheduled.');
    }
    if (tender.openingMode === 'staged' && body.envelope === 'commercial' && !priceGateOf(tender, lotId).released) {
      fail(409, 'PRICE_GATE_NOT_RELEASED', 'The evaluation chair has not released the price gate for this tender.');
    }
    const team = OPENING_TEAM.filter((member) => member.tenantId === tenantId && member.tenderId === tender.tenderId);
    for (const participant of body.participants) {
      const member = team.find((row) => row.userId === participant.userId);
      if (member === undefined || !member.eligibleRoles.includes(participant.role)) {
        fail(422, 'PARTICIPANT_NOT_ELIGIBLE', 'Every participant must be on the tender team in a role they may hold at an opening.');
      }
    }
    const officer = body.participants.find((participant) => participant.role === 'opening_officer');
    const session: FixtureOpeningSession = {
      tenantId,
      id: NEW_ID,
      tenderId: tender.tenderId,
      lotId,
      envelope: body.envelope,
      scheduledAt: body.scheduledAt,
      openedAt: null,
      status: 'scheduled',
      openingOfficerUserId: officer?.userId ?? requirePersona().userId,
      quorumRequired: body.quorumRequired,
      minutes: null,
      irregularities: null,
      publicReleaseSummary: null,
      publicReleaseApproved: false,
    };
    const participants: FixtureOpeningParticipant[] = body.participants.map((participant, index) => ({
      id: NEW_ID * 10 + index + 1,
      sessionId: NEW_ID,
      userId: participant.userId,
      role: participant.role,
      confirmedAt: null,
    }));
    return sessionDetail(session, { callerUserId: requirePersona().userId, participants });
  });

  mockRoute(app, openingEndpoints.confirmParticipant, ({ requireTenant, requirePersona, params, now, fail, notFound }) => {
    const session = sessionOf(requireTenant().tenant.id, params.sessionId) ?? notFound();
    const participants = participantsOf(session.id);
    const participant = participants.find((row) => row.id === params.participantId) ?? notFound();
    if (participant.userId !== requirePersona().userId) {
      fail(403, 'NOT_THE_PARTICIPANT', 'Only the named participant can confirm their own presence.');
    }
    if (session.status === 'completed' || session.status === 'aborted') {
      fail(409, 'SESSION_NOT_OPEN', 'The session is already completed or aborted.');
    }
    if (!isTenderClosed(tenderOfSession(session))) {
      fail(409, 'TENDER_NOT_CLOSED', 'Participants confirm at the opening, after the tender has closed.');
    }
    if (participant.confirmedAt !== null) {
      fail(409, 'PARTICIPANT_ALREADY_CONFIRMED', 'Your presence is already confirmed.');
    }
    const confirmed: FixtureOpeningParticipant = { ...participant, confirmedAt: now.toISOString().replace(/\.\d{3}Z$/, 'Z') };
    const updated = participants.map((row) => (row.id === confirmed.id ? confirmed : row));
    return {
      sessionId: session.id,
      participant: {
        id: confirmed.id,
        user: personRef(confirmed.userId),
        capacity: capacityOf(confirmed.userId, session.tenantId),
        role: confirmed.role,
        confirmedAt: confirmed.confirmedAt,
      },
      sessionStatus: 'awaiting_quorum' as const,
      quorum: quorumOf(session, updated),
    };
  });

  mockRoute(app, openingEndpoints.openSession, ({ requireTenant, requirePersona, params, body, now, fail, notFound }) => {
    const session = sessionOf(requireTenant().tenant.id, params.sessionId) ?? notFound();
    const callerUserId = requirePersona().userId;
    if (session.openingOfficerUserId !== callerUserId) {
      fail(403, 'NOT_OPENING_OFFICER', 'Only the assigned opening officer can open this session.');
    }
    if (session.status === 'completed' || session.status === 'aborted') {
      fail(409, 'SESSION_NOT_OPEN', 'The session is already completed or aborted.');
    }
    const tender = tenderOfSession(session);
    if (!isTenderClosed(tender)) {
      fail(409, 'TENDER_NOT_CLOSED', 'The tender has not closed.');
    }
    if (!quorumOf(session, participantsOf(session.id)).met) {
      fail(409, 'QUORUM_NOT_MET', 'The opening officer and the required witnesses have not all confirmed their presence.');
    }
    if (missingEarlierStages(tender, session.envelope).length > 0) {
      fail(409, 'STAGE_OUT_OF_ORDER', 'Earlier envelopes of this tender are not opened yet.');
    }
    if (tender.openingMode === 'staged' && session.envelope === 'commercial' && !priceGateOf(tender, session.lotId).released) {
      fail(409, 'PRICE_GATE_NOT_RELEASED', 'The evaluation chair has not released the price gate (AC-16).');
    }
    const openedAt = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
    const envelopes = envelopesOfSession(tender, session.envelope);
    let nextId = NEW_ID * 100;
    const newOpenings: FixtureEnvelopeOpening[] = bidsOfTender(tender)
      .filter((bid) => ineligibleReason(bid, envelopes, session.lotId) === null)
      .flatMap((bid) =>
        envelopes.map((envelope) => {
          nextId += 1;
          return { tenantId: session.tenantId, id: nextId, sessionId: session.id, bidId: bid.bidId, revisionId: bid.revisionId, envelope, openedAt };
        }),
      );
    const completed: FixtureOpeningSession = {
      ...session,
      status: 'completed',
      openedAt,
      minutes: body.minutes ?? session.minutes,
      irregularities: body.irregularities ?? session.irregularities,
    };
    return sessionDetail(completed, { callerUserId, newOpenings });
  });

  mockRoute(app, openingEndpoints.recordSession, ({ requireTenant, requirePersona, params, body, fail, notFound }) => {
    const session = sessionOf(requireTenant().tenant.id, params.sessionId) ?? notFound();
    const callerUserId = requirePersona().userId;
    if (session.openingOfficerUserId !== callerUserId) {
      fail(403, 'NOT_OPENING_OFFICER', 'Only the assigned opening officer records the minutes.');
    }
    if (session.status !== 'completed') {
      fail(409, 'SESSION_NOT_COMPLETED', 'Minutes are recorded for a completed session.');
    }
    return sessionDetail({ ...session, minutes: body.minutes, irregularities: body.irregularities }, { callerUserId });
  });

  mockRoute(app, openingEndpoints.releasePublicSummary, ({ requireTenant, requirePersona, params, body, fail, notFound }) => {
    const session = sessionOf(requireTenant().tenant.id, params.sessionId) ?? notFound();
    const callerUserId = requirePersona().userId;
    if (session.openingOfficerUserId !== callerUserId) {
      fail(403, 'NOT_OPENING_OFFICER', 'Only the assigned opening officer issues the public opening information.');
    }
    if (session.status !== 'completed') {
      fail(409, 'SESSION_NOT_COMPLETED', 'Public opening information follows a completed opening.');
    }
    if (!tenderOfSession(session).publicOpeningRequired) {
      fail(409, 'PUBLIC_OPENING_NOT_REQUIRED', 'The procedure of this tender does not provide for a public opening.');
    }
    if (session.publicReleaseApproved) {
      fail(409, 'PUBLIC_SUMMARY_ALREADY_RELEASED', 'The public opening information of this session has already been issued.');
    }
    return sessionDetail({ ...session, publicReleaseSummary: body.publicReleaseSummary, publicReleaseApproved: true }, { callerUserId });
  });

  mockRoute(app, openingEndpoints.abortSession, ({ requireTenant, requirePersona, params, body, fail, notFound }) => {
    const session = sessionOf(requireTenant().tenant.id, params.sessionId) ?? notFound();
    const callerUserId = requirePersona().userId;
    if (session.openingOfficerUserId !== callerUserId) {
      fail(403, 'NOT_OPENING_OFFICER', 'Only the assigned opening officer can abort this session.');
    }
    if (session.status === 'completed') {
      fail(409, 'SESSION_ALREADY_COMPLETED', 'A completed opening cannot be aborted.');
    }
    if (session.status === 'aborted') {
      fail(409, 'SESSION_ALREADY_ABORTED', 'The session is already aborted.');
    }
    return sessionDetail({ ...session, status: 'aborted', irregularities: body.reason }, { callerUserId });
  });

  // BUY-21 -----------------------------------------------------------------------------------------------

  mockRoute(app, openingEndpoints.listBids, ({ requireTenant, params, query, fixtures, notFound }) => {
    const tender = tenderOf(requireTenant().tenant.id, params.tenderId) ?? notFound();
    const rows = (isTenderClosed(tender) ? bidsOfTender(tender) : [])
      .map((bid) => complianceBidRow(bid))
      .filter((row) => matchesSearch(query.q, [row.supplier.name, row.receiptNo]))
      .filter((row) => query.complianceStatus === undefined || query.complianceStatus.includes(row.complianceStatus))
      .filter((row) => query.submissionState === undefined || query.submissionState.includes(row.submissionState))
      .filter((row) => query.lotId === undefined || row.lots.some((lot) => lot.lotId === query.lotId))
      .filter((row) => query.rankingEligible === undefined || row.rankingEligible === query.rankingEligible);
    const sort = query.sort ?? 'receivedAt';
    return fixtures.page(
      sortRows(rows, (row) => (sort === 'supplierName' ? row.supplier.name : sort === 'receivedAt' ? row.receivedAt : row.complianceStatus), query.dir),
    );
  });

  mockRoute(app, openingEndpoints.getBidCompliance, ({ requireTenant, params, notFound }) => {
    const tenantId = requireTenant().tenant.id;
    const bid = bidOf(tenantId, params.bidId) ?? notFound();
    const tender = tenderOfBid(bid);
    const contentAvailable = qualificationOpened(bid);
    return {
      bid: complianceBidRow(bid),
      tender: {
        tenderId: tender.tenderId,
        reference: tender.reference,
        title: tender.title,
        status: tender.status,
        openingMode: tender.openingMode,
      },
      contentAvailable,
      checks: contentAvailable ? checksOfBid(bid).map(checkRow) : [],
      clarifications: clarificationsOf(tenantId)
        .filter((row) => row.bidId === bid.bidId && row.consolidatedIntoId === null)
        .map(clarificationRow),
      exclusions: exclusionsOf(tenantId)
        .filter((row) => row.bidId === bid.bidId)
        .map(exclusionRow),
    };
  });

  mockRoute(app, openingEndpoints.recordCheck, ({ requireTenant, requirePersona, params, body, now, fail, notFound }) => {
    const tenantId = requireTenant().tenant.id;
    const check = checkOf(tenantId, params.checkId) ?? notFound();
    const bid = bidOf(tenantId, check.bidId) ?? notFound();
    if (!qualificationOpened(bid)) {
      fail(409, 'ENVELOPE_NOT_OPENED', 'The bid has not been opened.');
    }
    if (bid.complianceStatus === 'excluded') {
      fail(409, 'BID_EXCLUDED', 'The bid is excluded; its record is kept as it was decided.');
    }
    if (bid.complianceStatus === 'compliant' || bid.complianceStatus === 'non_compliant') {
      fail(409, 'COMPLIANCE_DECIDED', 'The compliance review of this bid is concluded.');
    }
    return checkRow({
      ...check,
      result: body.result,
      findingClass: body.findingClass,
      reason: body.reason ?? null,
      evidenceRef: body.evidenceRef ?? null,
      assessedBy: requirePersona().userId,
      assessedAt: now.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    });
  });

  mockRoute(app, openingEndpoints.decideCompliance, ({ requireTenant, params, body, fail, notFound }) => {
    const tenantId = requireTenant().tenant.id;
    const bid = bidOf(tenantId, params.bidId) ?? notFound();
    if (!qualificationOpened(bid)) {
      fail(409, 'ENVELOPE_NOT_OPENED', 'The bid has not been opened.');
    }
    if (bid.complianceStatus === 'excluded') {
      fail(409, 'BID_EXCLUDED', 'The bid is excluded.');
    }
    if (activeExclusionOf(bid) !== undefined) {
      fail(409, 'EXCLUSION_IN_PROGRESS', 'An exclusion of this bid is in progress.');
    }
    if (bid.complianceStatus === 'compliant' || bid.complianceStatus === 'non_compliant') {
      fail(409, 'COMPLIANCE_DECIDED', 'The compliance review of this bid is concluded.');
    }
    const checks = checksOfBid(bid);
    if (checks.some((check) => check.result === 'pending' || check.result === 'clarification_required')) {
      fail(409, 'CHECKS_PENDING', 'Every check needs a disposition before the review is concluded.');
    }
    if (clarificationsOf(tenantId).some((row) => row.bidId === bid.bidId && row.source === 'compliance' && isOpenClarification(row))) {
      fail(409, 'CLARIFICATION_OPEN', 'A compliance clarification of this bid is still open.');
    }
    const failed = checks.some((check) => check.result === 'fail');
    if ((body.outcome === 'compliant' && failed) || (body.outcome === 'non_compliant' && !failed)) {
      fail(409, 'OUTCOME_CONTRADICTS_CHECKS', 'The outcome must follow the recorded findings.');
    }
    return complianceBidRow(bid, { complianceStatus: body.outcome });
  });

  // Clarifications (BUY-21, EVA-03) ----------------------------------------------------------------------

  mockRoute(app, openingEndpoints.listClarifications, ({ requireTenant, requirePersona, query, fixtures }) => {
    const { tenant, permissions } = requireTenant();
    const userId = requirePersona().userId;
    const rows = clarificationsOf(tenant.id)
      .filter((row) => canSeeClarification(row, userId, permissions))
      .filter((row) => query.includeConsolidated === true || row.consolidatedIntoId === null)
      .filter((row) => query.bidId === undefined || row.bidId === query.bidId)
      .filter((row) => query.status === undefined || query.status.includes(row.status))
      .filter((row) => query.source === undefined || query.source.includes(row.source))
      .filter((row) => query.raisedBy === undefined || row.raisedBy === query.raisedBy)
      .filter((row) => withinDates(row.dueAt, query.dueFrom, query.dueTo))
      .map(clarificationRow)
      .filter((row) => query.tenderId === undefined || row.tenderId === query.tenderId)
      .filter((row) => matchesSearch(query.q, [row.tenderReference, row.supplier.name, row.question]));
    const sort = query.sort ?? 'dueAt';
    return fixtures.page(
      sortRows(
        rows,
        (row) => (sort === 'dueAt' ? (row.dueAt?.at ?? null) : sort === 'raisedAt' ? row.raisedAt : sort === 'status' ? row.status : row.tenderReference),
        query.dir,
      ),
    );
  });

  mockRoute(app, openingEndpoints.getClarification, ({ requireTenant, requirePersona, params, notFound }) => {
    const { tenant, permissions } = requireTenant();
    const clarification = clarificationOf(tenant.id, params.clarificationId);
    if (clarification === undefined || !canSeeClarification(clarification, requirePersona().userId, permissions)) {
      return notFound();
    }
    return clarificationDetail(clarification);
  });

  mockRoute(app, openingEndpoints.raiseClarification, ({ requireTenant, requirePersona, body, now, fail, notFound }) => {
    const { tenant, permissions } = requireTenant();
    const bid = bidOf(tenant.id, body.bidId) ?? notFound('Bid not found.');
    const permitted =
      body.source === 'evaluation'
        ? hasAny(permissions, ['evaluation.score', 'evaluation.chair'])
        : permissions.includes('compliance.assess');
    if (!permitted) {
      fail(403, 'SOURCE_NOT_PERMITTED', 'Your role cannot raise a clarification from this stage.');
    }
    if (bid.submissionState !== 'submitted' || bid.receiptStatus === 'late_rejected') {
      fail(409, 'BID_NOT_ELIGIBLE', 'A withdrawn or late bid is not assessed.');
    }
    if (!qualificationOpened(bid)) {
      fail(409, 'BID_NOT_OPENED', 'The bid has not been opened.');
    }
    if (bid.complianceStatus === 'excluded') {
      fail(409, 'BID_EXCLUDED', 'The bid is excluded.');
    }
    if (new Date(body.dueAt).getTime() <= now.getTime()) {
      fail(422, 'DUE_DATE_IN_PAST', 'The response deadline must be in the future.');
    }
    const draft: FixtureBidClarification = {
      tenantId: tenant.id,
      id: NEW_ID,
      bidId: bid.bidId,
      raisedBy: requirePersona().userId,
      raisedAt: now.toISOString().replace(/\.\d{3}Z$/, 'Z'),
      source: body.source,
      question: body.question,
      permittedScope: body.permittedScope,
      dueAt: body.dueAt,
      status: 'draft',
      approvedBy: null,
      consolidatedIntoId: null,
      responseText: null,
      respondedBy: null,
      respondedAt: null,
      effect: null,
      effectNote: null,
      attachments: [],
      distributedTo: [],
    };
    return clarificationDetail(draft, []);
  });

  mockRoute(app, openingEndpoints.consolidateClarifications, ({ requireTenant, params, body, fail, notFound }) => {
    const tenantId = requireTenant().tenant.id;
    const target = clarificationOf(tenantId, params.clarificationId) ?? notFound();
    if (target.status !== 'draft' || target.consolidatedIntoId !== null) {
      fail(409, 'CLARIFICATION_NOT_DRAFT', 'Only a draft question can absorb others.');
    }
    if (body.clarificationIds.includes(target.id)) {
      fail(422, 'CONSOLIDATION_SELF', 'A question cannot be merged into itself.');
    }
    const sources = body.clarificationIds.map((id) => clarificationOf(tenantId, id) ?? notFound(`Clarification ${id} not found.`));
    if (sources.some((row) => row.status !== 'draft' || row.consolidatedIntoId !== null)) {
      fail(409, 'CLARIFICATION_NOT_DRAFT', 'Only draft questions can be merged.');
    }
    if (sources.some((row) => row.bidId !== target.bidId)) {
      fail(422, 'CONSOLIDATION_DIFFERENT_BID', 'Merged questions must concern the same bid.');
    }
    const merged = sources.map((row) => ({ ...row, status: 'closed' as const, consolidatedIntoId: target.id }));
    const existing = clarificationsOf(tenantId).filter((row) => row.consolidatedIntoId === target.id);
    return clarificationDetail(
      { ...target, question: body.question ?? target.question, permittedScope: body.permittedScope ?? target.permittedScope },
      [...existing, ...merged],
    );
  });

  mockRoute(app, openingEndpoints.approveClarification, ({ requireTenant, requirePersona, params, fail, notFound }) => {
    const { tenant, permissions } = requireTenant();
    const userId = requirePersona().userId;
    const clarification = clarificationOf(tenant.id, params.clarificationId) ?? notFound();
    if (clarification.consolidatedIntoId !== null) {
      fail(409, 'CLARIFICATION_CONSOLIDATED', 'This question was merged into another; approve that one instead.');
    }
    if (clarification.status !== 'draft') {
      fail(409, 'CLARIFICATION_NOT_DRAFT', 'Only a draft question can be approved.');
    }
    const approver: PermissionCode = clarification.source === 'evaluation' ? 'evaluation.chair' : 'exclusion.approve';
    if (!permissions.includes(approver)) {
      fail(403, 'FORBIDDEN', 'Questions from this stage are approved by another role.');
    }
    if (clarification.raisedBy === userId) {
      fail(403, 'SELF_APPROVAL_NOT_PERMITTED', 'You cannot approve a question you raised.');
    }
    return clarificationDetail({ ...clarification, status: 'approved', approvedBy: userId });
  });

  mockRoute(app, openingEndpoints.issueClarification, ({ requireTenant, params, now, fail, notFound }) => {
    const clarification = clarificationOf(requireTenant().tenant.id, params.clarificationId) ?? notFound();
    if (clarification.status !== 'approved') {
      fail(409, 'CLARIFICATION_NOT_APPROVED', 'The question must be approved before it is issued.');
    }
    if (clarification.dueAt !== null && new Date(clarification.dueAt).getTime() <= now.getTime()) {
      fail(422, 'DUE_DATE_IN_PAST', 'The response deadline has passed; set a new one.');
    }
    return clarificationDetail({ ...clarification, status: 'issued' });
  });

  mockRoute(app, openingEndpoints.recordClarificationEffect, ({ requireTenant, params, body, fail, notFound }) => {
    const tenantId = requireTenant().tenant.id;
    const clarification = clarificationOf(tenantId, params.clarificationId) ?? notFound();
    if (clarification.status !== 'responded' && clarification.status !== 'expired') {
      fail(409, 'CLARIFICATION_NOT_RESPONDED', 'The effect is recorded once the supplier responded or the deadline expired.');
    }
    if (body.distributeToUserIds.some((userId) => !isAssessor(userId, tenantId))) {
      fail(422, 'RECIPIENT_NOT_ASSESSOR', 'Answers are distributed to assessors only.');
    }
    return clarificationDetail({
      ...clarification,
      status: 'closed',
      effect: body.effect,
      effectNote: body.effectNote,
      distributedTo: [...new Set([...clarification.distributedTo, ...body.distributeToUserIds])],
    });
  });

  // Exclusions (BUY-21) ----------------------------------------------------------------------------------

  mockRoute(app, openingEndpoints.listExclusions, ({ requireTenant, query, fixtures }) => {
    const rows = exclusionsOf(requireTenant().tenant.id)
      .filter((row) => query.status === undefined || query.status.includes(row.status))
      .filter((row) => query.proposedBy === undefined || row.proposedBy === query.proposedBy)
      .filter((row) => withinDates(row.proposedAt, query.proposedFrom, query.proposedTo))
      .map(exclusionRow)
      .filter((row) => query.tenderId === undefined || row.tenderId === query.tenderId)
      .filter((row) => matchesSearch(query.q, [row.tenderReference, row.tenderTitle, row.supplier.name, row.grounds]));
    const sort = query.sort ?? 'proposedAt';
    return fixtures.page(
      sortRows(
        rows,
        (row) => (sort === 'proposedAt' ? row.proposedAt : sort === 'status' ? row.status : row.tenderReference),
        query.sort === undefined ? 'desc' : query.dir,
      ),
    );
  });

  mockRoute(app, openingEndpoints.getExclusion, ({ requireTenant, params, notFound }) => {
    const exclusion = exclusionOf(requireTenant().tenant.id, params.exclusionId) ?? notFound();
    return exclusionDetail(exclusion);
  });

  mockRoute(app, openingEndpoints.proposeExclusion, ({ requireTenant, requirePersona, body, now, fail, notFound }) => {
    const tenantId = requireTenant().tenant.id;
    const bid = bidOf(tenantId, body.bidId) ?? notFound('Bid not found.');
    if (!qualificationOpened(bid)) {
      fail(409, 'BID_NOT_OPENED', 'The bid has not been opened.');
    }
    if (activeExclusionOf(bid) !== undefined) {
      fail(409, 'EXCLUSION_ALREADY_ACTIVE', 'An exclusion of this bid is already proposed or decided.');
    }
    const checks = body.checkIds.map((checkId) => checkOf(tenantId, checkId));
    if (checks.some((check) => check === undefined || check.bidId !== bid.bidId)) {
      fail(422, 'CHECK_NOT_ON_BID', 'Cite checks recorded on this bid.');
    }
    if (clarificationsOf(tenantId).some((row) => row.bidId === bid.bidId && row.source === 'compliance' && isOpenClarification(row))) {
      fail(409, 'CLARIFICATION_OPEN', 'A compliance clarification that may resolve the finding is still open.');
    }
    if (checks.some((check) => check?.result !== 'fail')) {
      fail(409, 'CHECKS_NOT_FAILED', 'An exclusion cites failed checks only.');
    }
    const proposed: FixtureExclusion = {
      tenantId,
      id: NEW_ID,
      bidId: bid.bidId,
      grounds: body.grounds,
      checkIds: body.checkIds,
      status: 'proposed',
      proposedBy: requirePersona().userId,
      proposedAt: now.toISOString().replace(/\.\d{3}Z$/, 'Z'),
      approvalRequestId: null,
      approvalStatus: null,
      approvalDecidedAt: null,
      approvalDecidedBy: null,
      noticeId: null,
      noticeStatus: null,
      notifiedAt: null,
      challengeRoute: body.challengeRoute,
      withdrawnReason: null,
    };
    return exclusionDetail(proposed);
  });

  mockRoute(app, openingEndpoints.withdrawExclusion, ({ requireTenant, params, body, fail, notFound }) => {
    const exclusion = exclusionOf(requireTenant().tenant.id, params.exclusionId) ?? notFound();
    if (exclusion.status !== 'proposed' && exclusion.status !== 'awaiting_approval') {
      fail(409, 'EXCLUSION_ALREADY_DECIDED', 'A decided or withdrawn exclusion cannot be withdrawn.');
    }
    return exclusionDetail({
      ...exclusion,
      status: 'withdrawn',
      approvalStatus: exclusion.approvalRequestId === null ? null : 'withdrawn',
      withdrawnReason: body.reason,
    });
  });

  mockRoute(app, openingEndpoints.issueExclusionNotice, ({ requireTenant, params, now, fail, notFound }) => {
    const exclusion = exclusionOf(requireTenant().tenant.id, params.exclusionId) ?? notFound();
    if (exclusion.status !== 'approved') {
      fail(409, 'EXCLUSION_NOT_APPROVED', 'The exclusion must be approved before the supplier is notified.');
    }
    if (exclusion.noticeId !== null) {
      fail(409, 'NOTICE_ALREADY_ISSUED', 'The exclusion notice has already been issued.');
    }
    return exclusionDetail({
      ...exclusion,
      noticeId: NEW_ID,
      noticeStatus: 'issued',
      notifiedAt: now.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    });
  });

  // SUP-18 -----------------------------------------------------------------------------------------------

  mockRoute(app, openingEndpoints.listAssessmentRequests, ({ requireTenant, query, fixtures }) => {
    const supplierTenantId = requireTenant().tenant.id;
    const rows = BUYER_TENANT_IDS.flatMap((buyerTenantId) => {
      const buyerName = fixtures.tenant(buyerTenantId)?.name ?? '';
      return clarificationsOf(buyerTenantId)
        .filter((row) => bidOfClarification(row).supplierTenantId === supplierTenantId)
        .map((row) => supplierRow(row, buyerName))
        .filter((row): row is AssessmentRequestRow => row !== null);
    })
      .filter((row) => query.status === undefined || query.status.includes(row.status))
      .filter((row) => query.source === undefined || query.source.includes(row.source))
      .filter((row) => query.tenderId === undefined || row.tenderId === query.tenderId)
      .filter((row) => withinDates(row.dueAt?.at ?? null, query.dueFrom, query.dueTo))
      .filter((row) => matchesSearch(query.q, [row.tenderReference, row.tenderTitle, row.question, row.buyer.name]));
    const sort = query.sort ?? 'dueAt';
    return fixtures.page(
      sortRows(
        rows,
        (row) => (sort === 'dueAt' ? (row.dueAt?.at ?? null) : sort === 'reference' ? row.tenderReference : row.status),
        query.sort === undefined ? 'desc' : query.dir,
      ),
    );
  });

  mockRoute(app, openingEndpoints.getAssessmentRequest, ({ requireTenant, params, fixtures, notFound }) => {
    const supplierTenantId = requireTenant().tenant.id;
    for (const buyerTenantId of BUYER_TENANT_IDS) {
      const clarification = clarificationOf(buyerTenantId, params.requestId);
      if (clarification !== undefined && bidOfClarification(clarification).supplierTenantId === supplierTenantId) {
        const row = supplierRow(clarification, fixtures.tenant(buyerTenantId)?.name ?? '');
        if (row !== null) {
          return supplierDetail(row, clarification);
        }
      }
    }
    return notFound();
  });

  mockRoute(app, openingEndpoints.respondAssessmentRequest, ({ requireTenant, requirePersona, params, body, now, fixtures, fail, notFound }) => {
    const supplierTenantId = requireTenant().tenant.id;
    for (const buyerTenantId of BUYER_TENANT_IDS) {
      const clarification = clarificationOf(buyerTenantId, params.requestId);
      if (clarification === undefined || bidOfClarification(clarification).supplierTenantId !== supplierTenantId) {
        continue;
      }
      const row = supplierRow(clarification, fixtures.tenant(buyerTenantId)?.name ?? '');
      if (row === null) {
        continue;
      }
      if (clarification.status !== 'issued') {
        fail(409, 'REQUEST_NOT_OPEN', 'This request is no longer open for a response.');
      }
      if (clarification.dueAt !== null && new Date(clarification.dueAt).getTime() <= now.getTime()) {
        fail(409, 'RESPONSE_DEADLINE_PASSED', 'The response deadline has passed.');
      }
      const userId = requirePersona().userId;
      const respondedAt = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
      return supplierDetail(
        { ...row, status: 'responded', respondedAt, respondedBy: personRef(userId) },
        { ...clarification, responseText: body.responseText, attachments: body.attachments },
      );
    }
    return notFound();
  });
}

