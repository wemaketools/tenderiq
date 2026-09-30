/**
 * Contract-valid response bodies for the opening page tests (test data only; the application's data comes from the
 * API). Every builder is parsed with the contract schema, so a drift fails loudly here.
 */
import { openingEndpoints } from '@contracts/opening';
import type {
  AssessmentRequestDetail,
  ClarificationDetail,
  ClarificationRow,
  ComplianceBidRow,
  ComplianceCheck,
  ExclusionDetail,
  ExclusionRow,
  OpeningSessionDetail,
  OpeningTenderRow,
  TenderOpeningOverview,
} from '@contracts/opening';
import type { PermissionCode } from '@contracts/permissions';

import { makeTenant, signedInSession, makeUser } from '../../../test/fixtures';
import type { RootState } from '../../../app/store';

export const TZ = 'Africa/Gaborone';

export function page<T>(items: readonly T[]) {
  return { items: [...items], total: items.length, page: 1, pageSize: 25 };
}

export function stateFor(
  permissions: readonly PermissionCode[],
  userId = 15,
  kind: 'buyer' | 'supplier' = 'buyer',
): Partial<RootState> {
  return {
    session: signedInSession({
      user: makeUser({ id: userId, displayTimeZone: TZ }),
      activeTenant: makeTenant(
        kind === 'buyer'
          ? { capacity: 'Bid Opening Officer' }
          : {
              tenantId: 5,
              kind: 'supplier',
              name: 'Chobe Pipe & Valve Supplies',
              slug: 'chobe-pipe',
            },
        permissions,
      ),
    }),
  };
}

export function tenderRow(overrides: Partial<OpeningTenderRow> = {}): OpeningTenderRow {
  return openingEndpoints.listTenders.response.parse(
    page([
      {
        tenderId: 8,
        reference: 'T-2026-0008',
        title: 'Pipeline valves bulk supply',
        eventType: 'tender',
        procedure: 'open',
        participation: 'open',
        status: 'closed',
        openingMode: 'staged',
        owner: { userId: 5, fullName: 'Tebogo Molefe' },
        submissionDeadline: { at: '2026-09-28T10:00:00Z', timeZone: TZ },
        closedAt: '2026-09-28T10:00:00Z',
        progress: 'awaiting_opening',
        effectiveSubmissionCount: 1,
        envelopesOpened: [],
        nextSession: {
          sessionId: 180,
          envelope: 'qualification',
          lot: null,
          scheduledAt: { at: '2026-09-30T08:00:00Z', timeZone: TZ },
          status: 'awaiting_quorum',
        },
        priceGatePending: true,
        pendingClarifications: 0,
        activeExclusions: 0,
        ...overrides,
      },
    ]),
  ).items[0] as OpeningTenderRow;
}

export function overview(): TenderOpeningOverview {
  const { nextSession: _next, ...tender } = tenderRow();
  return openingEndpoints.getTender.response.parse({
    tender: { ...tender, officialTimeZone: TZ, publicOpeningRequired: true },
    lots: [],
    stages: [
      {
        envelope: 'qualification',
        openOrder: 1,
        lot: null,
        state: 'awaiting_quorum',
        sessionId: 180,
        openedAt: null,
      },
      {
        envelope: 'technical',
        openOrder: 2,
        lot: null,
        state: 'sealed',
        sessionId: null,
        openedAt: null,
      },
      {
        envelope: 'commercial',
        openOrder: 3,
        lot: null,
        state: 'blocked_by_price_gate',
        sessionId: null,
        openedAt: null,
      },
    ],
    priceGates: [
      {
        lotId: null,
        applies: true,
        released: false,
        releasedAt: null,
        releasedBy: null,
        nonPriceCompleteConfirmed: false,
        note: null,
      },
    ],
    sessions: [],
    bids: [
      {
        bidId: 8001,
        revisionId: 80011,
        supplier: { tenantId: 5, name: 'Chobe Pipe & Valve Supplies (Pty) Ltd' },
        receiptNo: 'RCPT-2026-000024',
        receivedAt: '2026-09-22T10:00:00Z',
        submissionState: 'submitted',
        receiptStatus: 'received',
        documentCount: 12,
        lots: [],
        envelopes: [
          { envelope: 'qualification', state: 'sealed', openedAt: null },
          { envelope: 'commercial', state: 'sealed', openedAt: null },
        ],
      },
    ],
  });
}

export function session(overrides: Partial<OpeningSessionDetail> = {}): OpeningSessionDetail {
  return openingEndpoints.getSession.response.parse({
    id: 180,
    tenderId: 8,
    tenderReference: 'T-2026-0008',
    tenderTitle: 'Pipeline valves bulk supply',
    lot: null,
    envelope: 'qualification',
    status: 'awaiting_quorum',
    scheduledAt: { at: '2026-09-30T08:00:00Z', timeZone: TZ },
    openedAt: null,
    openingOfficer: { userId: 15, fullName: 'Oratile Baitse' },
    quorum: { required: 2, confirmed: 1, met: false },
    envelopesOpened: 0,
    publicReleaseApproved: false,
    tenderStatus: 'closed',
    openingMode: 'staged',
    quorumRequired: 2,
    participants: [
      {
        id: 1801,
        user: { userId: 15, fullName: 'Oratile Baitse' },
        capacity: 'Bid Opening Officer',
        role: 'opening_officer',
        confirmedAt: '2026-09-30T07:52:00Z',
      },
      {
        id: 1802,
        user: { userId: 16, fullName: 'Goitse Mooketsi' },
        capacity: 'Opening Witness',
        role: 'witness',
        confirmedAt: null,
      },
    ],
    myParticipantId: 1801,
    bids: [
      {
        bidId: 8001,
        revisionId: 80011,
        supplier: { tenantId: 5, name: 'Chobe Pipe & Valve Supplies (Pty) Ltd' },
        receiptNo: 'RCPT-2026-000024',
        receivedAt: '2026-09-22T10:00:00Z',
        submissionState: 'submitted',
        eligible: true,
        ineligibleReason: null,
        envelopes: [{ envelope: 'qualification', state: 'sealed', openedAt: null }],
      },
    ],
    openings: [],
    priceGate: {
      lotId: null,
      applies: true,
      released: false,
      releasedAt: null,
      releasedBy: null,
      nonPriceCompleteConfirmed: false,
      note: null,
    },
    readiness: [
      { code: 'tender_closed', status: 'passed' },
      { code: 'officer_confirmed', status: 'passed' },
      { code: 'quorum', status: 'blocking' },
      { code: 'stage_order', status: 'passed' },
    ],
    minutes: null,
    irregularities: null,
    publicReleaseSummary: null,
    ...overrides,
  });
}

export function bidRow(overrides: Partial<ComplianceBidRow> = {}): ComplianceBidRow {
  return {
    bidId: 3003,
    revisionId: 30031,
    tenderId: 3,
    supplier: { tenantId: 6, name: 'Makgadikgadi Civil Works (Pty) Ltd' },
    receiptNo: 'RCPT-2026-000303',
    receivedAt: '2026-09-07T09:36:18Z',
    submissionState: 'submitted',
    receiptStatus: 'selected_for_evaluation',
    lots: [],
    complianceStatus: 'pending',
    evaluationStatus: 'not_started',
    envelopes: [
      { envelope: 'qualification', state: 'opened', openedAt: '2026-09-08T07:05:31Z' },
      { envelope: 'commercial', state: 'withheld', openedAt: null },
    ],
    checkSummary: { pass: 1, fail: 0, clarificationRequired: 0, pending: 1, notApplicable: 0 },
    openClarifications: 0,
    exclusion: null,
    rankingEligible: true,
    ...overrides,
  };
}

export function check(overrides: Partial<ComplianceCheck> = {}): ComplianceCheck {
  return {
    id: 300305,
    bidId: 3003,
    revisionId: 30031,
    checkType: 'mandatory_requirement',
    requirement: { requirementId: 31, refCode: 'REQ-Q-03', text: 'A valid ISO 9001 certificate.' },
    findingClass: 'none',
    result: 'pending',
    reason: null,
    evidenceRef: null,
    assessedBy: null,
    assessedAt: null,
    ...overrides,
  };
}

export function bidCompliance(
  overrides: {
    bid?: ComplianceBidRow;
    checks?: ComplianceCheck[];
    contentAvailable?: boolean;
    exclusions?: ExclusionRow[];
  } = {},
) {
  return openingEndpoints.getBidCompliance.response.parse({
    bid: overrides.bid ?? bidRow(),
    tender: {
      tenderId: 3,
      reference: 'T-2026-0003',
      title: 'SCADA telemetry upgrade',
      status: 'under_assessment',
      openingMode: 'staged',
    },
    contentAvailable: overrides.contentAvailable ?? true,
    checks: overrides.checks ?? [check()],
    clarifications: [],
    exclusions: overrides.exclusions ?? [],
  });
}

export function exclusion(overrides: Partial<ExclusionDetail> = {}): ExclusionDetail {
  return openingEndpoints.getExclusion.response.parse({
    id: 5101,
    tenderId: 3,
    tenderReference: 'T-2026-0003',
    tenderTitle: 'SCADA telemetry upgrade',
    bidId: 3003,
    supplier: { tenantId: 6, name: 'Makgadikgadi Civil Works (Pty) Ltd' },
    grounds: 'Mandatory requirement REQ-Q-03 is not met.',
    checkIds: [300305],
    status: 'awaiting_approval',
    proposedBy: { userId: 10, fullName: 'Boitumelo Kgari' },
    proposedAt: '2026-09-29T11:00:00Z',
    approvalRequestId: 37,
    approvalStatus: 'pending',
    noticeId: null,
    noticeStatus: null,
    notifiedAt: null,
    challengeRoute: 'Ask the KWU Procurement Review Panel within 10 working days.',
    commercialEnvelope: 'withheld',
    checks: [
      check({
        result: 'fail',
        findingClass: 'substantive_noncompliance',
        reason: 'No valid certificate at closing.',
        evidenceRef: 'ISO9001-Makgadikgadi.pdf',
      }),
    ],
    approval: { approvalRequestId: 37, status: 'pending', decidedAt: null, decidedBy: null },
    withdrawnReason: null,
    ...overrides,
  });
}

export function clarificationRow(overrides: Partial<ClarificationRow> = {}): ClarificationRow {
  return {
    id: 4103,
    tenderId: 3,
    tenderReference: 'T-2026-0003',
    bidId: 3002,
    supplier: { tenantId: 4, name: 'Tsodilo Engineering (Pty) Ltd' },
    source: 'evaluation',
    question: 'Please state the default retention period offered.',
    permittedScope: 'Confirm the period already offered; no new equipment or price.',
    dueAt: { at: '2026-11-13T10:00:00Z', timeZone: TZ },
    status: 'draft',
    raisedBy: { userId: 11, fullName: 'Thato Mokgosi' },
    raisedAt: '2026-09-16T09:00:00Z',
    approvedBy: null,
    consolidatedIntoId: null,
    consolidatedCount: 0,
    respondedAt: null,
    effect: null,
    ...overrides,
  };
}

export function clarification(overrides: Partial<ClarificationDetail> = {}): ClarificationDetail {
  return openingEndpoints.getClarification.response.parse({
    ...clarificationRow(),
    responseText: null,
    respondedBy: null,
    effectNote: null,
    attachments: [],
    consolidated: [],
    distributedTo: [],
    ...overrides,
  });
}

export function assessmentRequest(
  overrides: Partial<AssessmentRequestDetail> = {},
): AssessmentRequestDetail {
  return openingEndpoints.getAssessmentRequest.response.parse({
    id: 4109,
    reference: 'CL-4109',
    buyer: { tenantId: 2, name: 'Kalahari Water Utilities (Pilot)' },
    tenderId: 1,
    tenderReference: 'T-2026-0001',
    tenderTitle: 'Borehole pump replacement programme',
    bidId: 1002,
    source: 'evaluation',
    question: 'Please confirm the rating of the enclosure offered.',
    permittedScope: 'Confirm the rating already offered; the model and price cannot change.',
    dueAt: { at: '2026-11-13T10:00:00Z', timeZone: TZ },
    status: 'issued',
    respondedAt: null,
    respondedBy: null,
    responseText: null,
    attachments: [],
    ...overrides,
  });
}
