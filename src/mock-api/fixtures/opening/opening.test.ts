/**
 * The opening fixtures: every projection parses against the contract, references resolve, and the storyline's
 * sealing anchors hold (AC-15 T-2026-0008 unopened, AC-16 gate before commercial, AC-17 excluded bid sealed).
 */
import { describe, expect, it } from 'vitest';

import {
  ClarificationDetail,
  ComplianceBidRow,
  ConsistentComplianceCheck,
  ExclusionDetail,
  OpeningSessionDetail,
  OpeningTenderRow,
  TenderOpeningOverview,
} from '../../../contracts/opening.js';
import {
  checkRow,
  clarificationDetail,
  complianceBidRow,
  exclusionDetail,
  sessionDetail,
  tenderOverview,
  tenderRow,
} from '../../handlers/opening/projections.js';
import { findPersonaById, findTenantById } from '../../persona.js';
import {
  BID_CLARIFICATIONS,
  COMPLIANCE_CHECKS,
  ENVELOPE_OPENINGS,
  EXCLUSIONS,
  OPENING_BIDS,
  OPENING_LOTS,
  OPENING_PARTICIPANTS,
  OPENING_SESSIONS,
  OPENING_TEAM,
  OPENING_TENDERS,
  PRICE_GATE_RELEASES,
} from '../opening.js';
import { APPROVALS } from '../approvals.js';
import { BIDS, BID_WITHDRAWALS, SUBMISSION_RECEIPTS } from '../bids/index.js';
import { TENANT_IDS } from '../platform.js';
import { LOTS, MILESTONES, TENDERS } from '../tenders/index.js';

describe('opening fixtures parse against the contract', () => {
  it.each(OPENING_TENDERS.map((tender) => [tender.reference, tender] as const))('projects %s as a list row and an overview', (_ref, tender) => {
    // Assert
    expect(OpeningTenderRow.safeParse(tenderRow(tender)).success).toBe(true);
    expect(TenderOpeningOverview.safeParse(tenderOverview(tender)).success).toBe(true);
  });

  it.each(OPENING_SESSIONS.map((session) => [session.id, session] as const))('projects session %i as a detail', (_id, session) => {
    // Act
    const result = OpeningSessionDetail.safeParse(sessionDetail(session, { callerUserId: 15 }));

    // Assert
    expect(result.error).toBeUndefined();
  });

  it('projects every bid, clarification and exclusion', () => {
    // Assert
    for (const bid of OPENING_BIDS) {
      expect(ComplianceBidRow.safeParse(complianceBidRow(bid)).error).toBeUndefined();
    }
    for (const clarification of BID_CLARIFICATIONS) {
      expect(ClarificationDetail.safeParse(clarificationDetail(clarification)).error).toBeUndefined();
    }
    for (const exclusion of EXCLUSIONS) {
      expect(ExclusionDetail.safeParse(exclusionDetail(exclusion)).error).toBeUndefined();
    }
  });

  it('holds consistent compliance findings (a reason for not applicable, evidence for a disposition)', () => {
    // Assert
    for (const check of COMPLIANCE_CHECKS) {
      expect(ConsistentComplianceCheck.safeParse(checkRow(check)).error, `check ${check.id}`).toBeUndefined();
    }
  });
});

describe('opening fixtures are internally consistent', () => {
  it('references known tenders, bids, sessions, lots and personas in the right tenant', () => {
    // Arrange
    const tenders = new Map(OPENING_TENDERS.map((tender) => [tender.tenderId, tender]));
    const bids = new Map(OPENING_BIDS.map((bid) => [bid.bidId, bid]));
    const sessions = new Map(OPENING_SESSIONS.map((session) => [session.id, session]));

    // Assert
    for (const bid of OPENING_BIDS) {
      expect(tenders.get(bid.tenderId)?.tenantId).toBe(bid.tenantId);
      expect(findTenantById(bid.supplierTenantId)?.kind).toBe('supplier');
      for (const lotId of bid.lotIds) {
        expect(OPENING_LOTS.find((lot) => lot.lotId === lotId)?.tenderId).toBe(bid.tenderId);
      }
    }
    for (const session of OPENING_SESSIONS) {
      expect(tenders.get(session.tenderId)?.tenantId).toBe(session.tenantId);
      expect(findPersonaById(session.openingOfficerUserId)).toBeDefined();
    }
    for (const participant of OPENING_PARTICIPANTS) {
      expect(sessions.has(participant.sessionId)).toBe(true);
      expect(findPersonaById(participant.userId)).toBeDefined();
    }
    for (const opening of ENVELOPE_OPENINGS) {
      const bid = bids.get(opening.bidId);
      expect(bid?.revisionId).toBe(opening.revisionId);
      expect(sessions.get(opening.sessionId)?.tenderId).toBe(bid?.tenderId);
      expect(sessions.get(opening.sessionId)?.status).toBe('completed');
    }
    for (const member of OPENING_TEAM) {
      expect(tenders.get(member.tenderId)?.tenantId).toBe(member.tenantId);
    }
    for (const clarification of BID_CLARIFICATIONS) {
      expect(bids.get(clarification.bidId)?.tenantId).toBe(clarification.tenantId);
      if (clarification.consolidatedIntoId !== null) {
        const target = BID_CLARIFICATIONS.find((row) => row.id === clarification.consolidatedIntoId);
        expect(target?.bidId).toBe(clarification.bidId);
      }
    }
  });

  it('opens each envelope of a revision at most once', () => {
    // Act
    const keys = ENVELOPE_OPENINGS.map((opening) => `${opening.revisionId}:${opening.envelope}`);

    // Assert
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('cites failed checks of the same bid for every active exclusion', () => {
    // Assert
    for (const exclusion of EXCLUSIONS.filter((row) => row.status === 'awaiting_approval' || row.status === 'approved')) {
      for (const checkId of exclusion.checkIds) {
        const check = COMPLIANCE_CHECKS.find((row) => row.id === checkId);
        expect(check?.bidId).toBe(exclusion.bidId);
        expect(check?.result).toBe('fail');
      }
    }
  });

  it('keeps T-2026-0008 unopened with its qualification session ready (AC-15)', () => {
    // Arrange
    const tender = OPENING_TENDERS.find((row) => row.reference === 'T-2026-0008');
    const bidIds = OPENING_BIDS.filter((bid) => bid.tenderId === tender?.tenderId).map((bid) => bid.bidId);

    // Assert
    expect(tender?.status).toBe('closed');
    expect(ENVELOPE_OPENINGS.filter((opening) => bidIds.includes(opening.bidId))).toEqual([]);
    expect(COMPLIANCE_CHECKS.filter((check) => bidIds.includes(check.bidId))).toEqual([]);
  });

  it('opens commercial envelopes only after the price gate of a staged tender (AC-16)', () => {
    // Assert
    for (const session of OPENING_SESSIONS.filter((row) => row.envelope === 'commercial' && row.status === 'completed')) {
      const gate = PRICE_GATE_RELEASES.find((row) => row.tenderId === session.tenderId);
      expect(gate).toBeDefined();
      expect((gate?.releasedAt ?? '') < (session.openedAt ?? '')).toBe(true);
    }
  });

  it('never opens the commercial envelope of an excluded or pending bid (AC-17)', () => {
    // Arrange
    const withheld = EXCLUSIONS.filter((row) => row.status === 'awaiting_approval' || row.status === 'approved').map((row) => row.bidId);

    // Assert
    expect(withheld).toEqual(expect.arrayContaining([3003, 1003]));
    expect(ENVELOPE_OPENINGS.filter((opening) => withheld.includes(opening.bidId) && opening.envelope === 'commercial')).toEqual([]);
  });

  it('gives ODC its own tender and no KWU record', () => {
    // Assert
    expect(OPENING_TENDERS.filter((tender) => tender.tenantId === TENANT_IDS.odc).map((tender) => tender.reference)).toEqual(['T-2026-0011']);
    expect(OPENING_BIDS.every((bid) => bid.tenantId === TENANT_IDS.kwu)).toBe(true);
  });
});

describe('opening fixtures agree with the rest of the demo world', () => {
  it('takes every official deadline, closing time, title and status from the tenders fixtures', () => {
    for (const tender of OPENING_TENDERS) {
      // Arrange
      const source = TENDERS.find((row) => row.id === tender.tenderId);
      const deadline = MILESTONES.find(
        (row) => row.tenderId === tender.tenderId && row.lotId === null && row.milestone === 'submission_deadline',
      );

      // Assert
      expect(source).toMatchObject({ reference: tender.reference, title: tender.title, status: tender.status, closedAt: tender.closedAt });
      expect(deadline?.at).toBe(tender.submissionDeadline);
    }
  });

  it('uses the lots of the tenders fixtures (T-2026-0001 Lots 101-103, T-2026-0002 Lot 201, T-2026-0008 Lots 801-802, T-2026-0011 Lots 1101-1102)', () => {
    // Assert
    expect(OPENING_LOTS.map((lot) => lot.lotId)).toEqual([101, 102, 103, 201, 801, 802, 1101, 1102]);
    for (const lot of OPENING_LOTS) {
      expect(LOTS.find((row) => row.id === lot.lotId)).toMatchObject({ tenderId: lot.tenderId, lotNo: lot.lotNo, title: lot.title, stage: lot.stage });
    }
  });

  it('keeps every receipt before its official deadline and every session, check and clarification after closing', () => {
    for (const tender of OPENING_TENDERS.filter((row) => row.closedAt !== null)) {
      // Arrange
      const closedAt = tender.closedAt ?? '';
      const bids = OPENING_BIDS.filter((bid) => bid.tenderId === tender.tenderId);
      const bidIds = new Set(bids.map((bid) => bid.bidId));
      const sessions = OPENING_SESSIONS.filter((session) => session.tenderId === tender.tenderId);

      // Assert
      expect(bids.every((bid) => bid.receivedAt <= tender.submissionDeadline)).toBe(true);
      expect(sessions.every((session) => session.scheduledAt >= closedAt)).toBe(true);
      expect(OPENING_PARTICIPANTS.filter((row) => sessions.some((session) => session.id === row.sessionId)).every((row) => row.confirmedAt === null || row.confirmedAt >= closedAt)).toBe(true);
      expect(COMPLIANCE_CHECKS.filter((check) => bidIds.has(check.bidId)).every((check) => check.assessedAt === null || check.assessedAt > closedAt)).toBe(true);
      expect(BID_CLARIFICATIONS.filter((row) => bidIds.has(row.bidId)).every((row) => row.raisedAt > closedAt)).toBe(true);
      expect(EXCLUSIONS.filter((row) => bidIds.has(row.bidId)).every((row) => row.proposedAt > closedAt)).toBe(true);
    }
  });

  it('schedules every session, open tenders included, no earlier than the tender submission deadline (BR-17)', () => {
    for (const session of OPENING_SESSIONS) {
      // Arrange
      const tender = OPENING_TENDERS.find((row) => row.tenderId === session.tenderId);

      // Assert
      expect(tender, `session ${String(session.id)}`).toBeDefined();
      expect(session.scheduledAt >= (tender?.submissionDeadline ?? ''), `session ${String(session.id)}`).toBe(true);
    }
  });

  it('schedules the first unopened session of each tender at the timetable opening milestone', () => {
    for (const tender of OPENING_TENDERS) {
      // Arrange
      const sessions = OPENING_SESSIONS.filter((row) => row.tenderId === tender.tenderId && row.lotId === null);
      const first = [...sessions].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0];
      const milestone = MILESTONES.find((row) => row.tenderId === tender.tenderId && row.lotId === null && row.milestone === 'opening');
      if (first === undefined || first.status !== 'scheduled' || milestone === undefined) {
        continue;
      }

      // Assert
      expect(first.scheduledAt, tender.reference).toBe(milestone.at);
    }
  });

  it('confirms presence before the officer opens and before the demo clock (30 Sep 2026, 08:00 Africa/Gaborone)', () => {
    for (const participant of OPENING_PARTICIPANTS.filter((row) => row.confirmedAt !== null)) {
      // Arrange
      const session = OPENING_SESSIONS.find((row) => row.id === participant.sessionId);

      // Assert
      expect((participant.confirmedAt ?? '') < '2026-09-30T06:00:00Z').toBe(true);
      expect(session?.openedAt === null || (participant.confirmedAt ?? '') <= (session?.openedAt ?? '')).toBe(true);
    }
  });

  it('shows the T-2026-0008 receipts of the bids fixtures: Chobe revision 1 effective, Tsodilo withdrawn (AC-14)', () => {
    // Arrange
    const chobe = OPENING_BIDS.find((bid) => bid.tenderId === 8 && bid.supplierTenantId === TENANT_IDS['chobe-pipe']);
    const tsodilo = OPENING_BIDS.find((bid) => bid.tenderId === 8 && bid.supplierTenantId === TENANT_IDS.tsodilo);
    const chobeSource = BIDS.find((row) => row.tenderId === 8 && row.supplierTenantId === TENANT_IDS['chobe-pipe']);
    const tsodiloSource = BIDS.find((row) => row.tenderId === 8 && row.supplierTenantId === TENANT_IDS.tsodilo);
    const chobeReceipt = SUBMISSION_RECEIPTS.find((row) => row.bidId === chobeSource?.id && row.status === 'received');
    const tsodiloReceipt = SUBMISSION_RECEIPTS.find((row) => row.bidId === tsodiloSource?.id);

    // Assert
    expect(chobe).toMatchObject({ submissionState: 'submitted', receiptStatus: 'received', receiptNo: chobeReceipt?.receiptNo, receivedAt: '2026-09-22T10:00:00Z', lotIds: [801, 802] });
    expect(tsodilo).toMatchObject({ submissionState: 'withdrawn', receiptStatus: 'withdrawn', receiptNo: tsodiloReceipt?.receiptNo, receivedAt: tsodiloReceipt?.receivedAt });
    expect(BID_WITHDRAWALS.some((row) => row.bidId === tsodiloSource?.id)).toBe(true);
    expect(SUBMISSION_RECEIPTS.some((row) => row.receiptNo === chobe?.receiptNo && row.status === 'late_rejected')).toBe(false);
  });

  it('matches the receipt number, time and state of the bids fixtures for T-2026-0001 and T-2026-0003', () => {
    for (const bid of OPENING_BIDS.filter((row) => row.tenderId === 1 || row.tenderId === 3)) {
      // Arrange
      const source = BIDS.find((row) => row.tenderId === bid.tenderId && row.supplierTenantId === bid.supplierTenantId);
      const receipt = SUBMISSION_RECEIPTS.find((row) => row.receiptNo === bid.receiptNo);

      // Assert
      expect(receipt).toMatchObject({ bidId: source?.id, receivedAt: bid.receivedAt, status: bid.receiptStatus });
      expect(bid.submissionState).toBe(source?.submissionState);
    }
  });

  it('links the pending T-2026-0003 exclusion to its approval request in the approvals fixtures (AC-17)', () => {
    // Arrange
    const exclusion = EXCLUSIONS.find((row) => row.id === 5101);
    const request = APPROVALS.find((row) => row.id === exclusion?.approvalRequestId);

    // Assert
    expect(request).toMatchObject({ subjectType: 'exclusion', status: 'pending', requestedAt: exclusion?.proposedAt });
    expect(findPersonaById(exclusion?.proposedBy ?? 0)?.email).toBe('boitumelo.chair@tenderiq.local');
  });

  it('gives every open clarification a response window of a few working days, each its own', () => {
    // Arrange: a draft's proposed deadline counts from the demo clock (it is not issued yet), others from raising.
    const demoNow = Date.parse('2026-09-30T06:00:00Z');
    const open = BID_CLARIFICATIONS.filter((row) => ['draft', 'approved', 'issued'].includes(row.status));
    const days = (row: (typeof open)[number]) =>
      (Date.parse(row.dueAt ?? '') - (row.status === 'draft' ? demoNow : Date.parse(row.raisedAt))) / 86_400_000;

    // Assert
    expect(open.map((row) => [row.id, days(row) > 0 && days(row) <= 14])).toEqual(open.map((row) => [row.id, true]));
    expect(new Set(open.map((row) => row.dueAt)).size).toBeGreaterThan(open.length / 2);
  });
});
