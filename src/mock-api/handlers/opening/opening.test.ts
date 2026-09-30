/**
 * The opening module on the mock API with REAL authentication (DD-43): tenant isolation, AC-15 restricted
 * personas, supplier isolation (SUP-18), and the business errors the fixture state implies for every command.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { Problem } from '../../../contracts/common.js';
import {
  AssessmentRequestDetail,
  ClarificationDetail,
  ConfirmParticipantResponse,
  ExclusionDetail,
  OpeningSessionDetail,
  TenderOpeningOverview,
  openingEndpoints as E,
} from '../../../contracts/opening.js';
import { createTestMockApp } from '../../testing/index.js';
import type { TestMockApp, TestResponse } from '../../testing/index.js';

const OFFICER = 'oratile.opener@tenderiq.local';
const WITNESS = 'goitse.witness@tenderiq.local';
const TEBOGO = 'tebogo.officer@tenderiq.local';
const CHAIR = 'boitumelo.chair@tenderiq.local';
const MANAGER = 'mpho.manager@tenderiq.local';
const THATO = 'thato.eval@tenderiq.local';

let api: TestMockApp;

/** The demo clock (30 Sep 2026, 11:00 Africa/Gaborone) so deadline rules do not depend on the day the suite runs. */
const DEMO_NOW = new Date('2026-09-30T09:00:00Z');

beforeAll(async () => {
  api = await createTestMockApp({ now: () => DEMO_NOW });
});

function codeOf(response: TestResponse): string | undefined {
  return Problem.parse(response.body).code;
}

function page(response: TestResponse): { items: Array<Record<string, unknown>>; total: number } {
  expect(response.status).toBe(200);
  return response.body as { items: Array<Record<string, unknown>>; total: number };
}

describe('module registration', () => {
  it('loads the opening module with all 30 endpoints', () => {
    // Assert
    expect(api.failed).toEqual([]);
    expect(api.loaded).toContain('opening/index');
    expect(api.endpointIds.filter((id) => id.includes('.opening.'))).toHaveLength(30);
  });
});

describe('restricted personas (AC-15, BR-26)', () => {
  it.each([
    ['admin.kwu@tenderiq.local', 'kwu'],
    ['pule.auditor@tenderiq.local', 'kwu'],
    ['support.agent@tenderiq.local', 'kwu'],
    ['admin.odc@tenderiq.local', 'odc'],
  ])('answers 403 to %s on the T-2026-0008 session and the compliance register', async (email, tenant) => {
    // Act
    const session = await api.callAs(email, E.getSession, { tenant, params: { sessionId: 180 } });
    const bids = await api.callAs(email, E.listBids, { tenant, params: { tenderId: 8 } });
    const tenders = await api.callAs(email, E.listTenders, { tenant });

    // Assert
    expect(session.status).toBe(403);
    expect(bids.status).toBe(403);
    expect(tenders.status).toBe(403);
  });
});

describe('buyer tenant isolation', () => {
  it('lists only KWU tenders for KWU and only T-2026-0011 for ODC', async () => {
    // Act
    const kwu = page(await api.callAs(TEBOGO, E.listTenders, { tenant: 'kwu' }));
    const odc = page(await api.callAs('officer.odc@tenderiq.local', E.listTenders, { tenant: 'odc' }));

    // Assert
    expect(kwu.items.map((row) => row.reference)).not.toContain('T-2026-0011');
    expect(kwu.total).toBe(6);
    expect(odc.items.map((row) => row.reference)).toEqual(['T-2026-0011']);
  });

  it('does not find a KWU session or tender from ODC', async () => {
    // Act
    const tender = await api.callAs('officer.odc@tenderiq.local', E.getTender, { tenant: 'odc', params: { tenderId: 3 } });

    // Assert
    expect(tender.status).toBe(404);
  });

  it('refuses a KWU header for an ODC persona', async () => {
    // Act
    const response = await api.callAs('officer.odc@tenderiq.local', E.listTenders, { tenant: 'kwu' });

    // Assert
    expect(response.status).toBe(403);
    expect(codeOf(response)).toBe('TENANT_ACCESS_DENIED');
  });

  it('filters tenders by progress and price gate', async () => {
    // Act
    const pending = page(await api.callAs(OFFICER, E.listTenders, { tenant: 'kwu', query: { priceGatePending: 'true' } }));
    const awaiting = page(await api.callAs(OFFICER, E.listTenders, { tenant: 'kwu', query: { progress: 'awaiting_opening' } }));

    // Assert
    expect(pending.items.map((row) => row.reference)).toEqual(['T-2026-0008']);
    expect(awaiting.items.map((row) => row.reference)).toEqual(['T-2026-0008']);
  });
});

describe('BUY-20 opening sessions', () => {
  it('shows T-2026-0008 sealed with receipt metadata only and commercial blocked by the price gate', async () => {
    // Act
    const overview = TenderOpeningOverview.parse((await api.callAs(WITNESS, E.getTender, { tenant: 'kwu', params: { tenderId: 8 } })).body);

    // Assert
    expect(overview.tender.progress).toBe('awaiting_opening');
    expect(overview.stages.map((stage) => stage.state)).toEqual(['scheduled', 'scheduled', 'blocked_by_price_gate']);
    expect(overview.sessions.find((session) => session.id === 180)?.quorum).toEqual({ required: 2, confirmed: 2, met: true });
    expect(overview.bids.flatMap((bid) => bid.envelopes.map((envelope) => envelope.state))).toEqual(Array(6).fill('sealed'));
  });

  it('filters sessions by status and envelope', async () => {
    // Act
    const rows = page(await api.callAs(OFFICER, E.listSessions, { tenant: 'kwu', query: { status: ['completed'], envelope: 'commercial' } }));

    // Assert
    expect(rows.items.map((row) => row.id).sort()).toEqual([112, 132]);
  });

  it('opens the ready T-2026-0008 qualification stage for the eligible effective bid only', async () => {
    // Act
    const response = await api.callAs(OFFICER, E.openSession, { tenant: 'kwu', params: { sessionId: 180 }, body: { noConflictConfirmed: true } });

    // Assert
    const detail = OpeningSessionDetail.parse(response.body);
    expect(detail.status).toBe('completed');
    expect(detail.openings.map((opening) => [opening.bidId, opening.envelope])).toEqual([[8001, 'qualification']]);
    expect(detail.bids.find((bid) => bid.bidId === 8002)?.ineligibleReason).toBe('withdrawn');
    expect(detail.tenderStatus).toBe('under_assessment');
  });

  it('refuses the witness to open and the officer to open without quorum or before closing', async () => {
    // Act
    const witness = await api.callAs(WITNESS, E.openSession, { tenant: 'kwu', params: { sessionId: 180 }, body: { noConflictConfirmed: true } });
    const quorum = await api.callAs(OFFICER, E.openSession, { tenant: 'kwu', params: { sessionId: 181 }, body: { noConflictConfirmed: true } });
    const open = await api.callAs(OFFICER, E.openSession, { tenant: 'kwu', params: { sessionId: 120 }, body: { noConflictConfirmed: true } });
    const done = await api.callAs(OFFICER, E.openSession, { tenant: 'kwu', params: { sessionId: 132 }, body: { noConflictConfirmed: true } });

    // Assert
    expect(witness.status).toBe(403);
    expect([codeOf(quorum), codeOf(open), codeOf(done)]).toEqual(['QUORUM_NOT_MET', 'TENDER_NOT_CLOSED', 'SESSION_NOT_OPEN']);
  });

  it('requires the conflict confirmation', async () => {
    // Act
    const response = await api.callAs(OFFICER, E.openSession, { tenant: 'kwu', params: { sessionId: 180 }, body: {} });

    // Assert
    expect(response.status).toBe(422);
    expect(Problem.parse(response.body).errors?.[0]?.code).toBe('CONFLICT_CONFIRMATION_REQUIRED');
  });

  it('lets the witness confirm presence on the scheduled technical session and nobody else', async () => {
    // Act
    const confirmed = await api.callAs(WITNESS, E.confirmParticipant, { tenant: 'kwu', params: { sessionId: 181, participantId: 1812 } });
    const other = await api.callAs(OFFICER, E.confirmParticipant, { tenant: 'kwu', params: { sessionId: 181, participantId: 1812 } });
    const again = await api.callAs(WITNESS, E.confirmParticipant, { tenant: 'kwu', params: { sessionId: 180, participantId: 1802 } });
    const early = await api.callAs(WITNESS, E.confirmParticipant, { tenant: 'kwu', params: { sessionId: 120, participantId: 1202 } });

    // Assert
    expect(ConfirmParticipantResponse.parse(confirmed.body).quorum).toEqual({ required: 2, confirmed: 1, met: false });
    expect(codeOf(other)).toBe('NOT_THE_PARTICIPANT');
    expect(codeOf(again)).toBe('PARTICIPANT_ALREADY_CONFIRMED');
    expect(codeOf(early)).toBe('TENDER_NOT_CLOSED');
  });

  it('blocks scheduling the T-2026-0008 commercial stage until the price gate is released (AC-16)', async () => {
    // Arrange
    const participants = [
      { userId: 15, role: 'opening_officer' },
      { userId: 16, role: 'witness' },
    ];

    // Act
    const commercial = await api.callAs(OFFICER, E.scheduleSession, {
      tenant: 'kwu',
      body: { tenderId: 8, envelope: 'commercial', scheduledAt: '2026-10-20T08:00:00Z', quorumRequired: 2, participants },
    });
    const technical = await api.callAs(OFFICER, E.scheduleSession, {
      tenant: 'kwu',
      body: { tenderId: 8, envelope: 'technical', scheduledAt: '2026-10-20T08:00:00Z', quorumRequired: 2, participants },
    });
    const opened = await api.callAs(OFFICER, E.scheduleSession, {
      tenant: 'kwu',
      body: { tenderId: 3, envelope: 'technical', scheduledAt: '2026-10-20T08:00:00Z', quorumRequired: 2, participants },
    });
    const wrongEnvelope = await api.callAs(OFFICER, E.scheduleSession, {
      tenant: 'kwu',
      body: { tenderId: 6, envelope: 'technical', scheduledAt: '2026-10-22T08:00:00Z', quorumRequired: 2, participants },
    });
    const early = await api.callAs(OFFICER, E.scheduleSession, {
      tenant: 'kwu',
      body: { tenderId: 6, envelope: 'all', scheduledAt: '2026-10-13T08:00:00Z', quorumRequired: 2, participants },
    });
    const ineligible = await api.callAs(OFFICER, E.scheduleSession, {
      tenant: 'kwu',
      body: {
        tenderId: 6,
        envelope: 'all',
        scheduledAt: '2026-10-22T08:00:00Z',
        quorumRequired: 2,
        participants: [
          { userId: 15, role: 'opening_officer' },
          { userId: 5, role: 'witness' },
        ],
      },
    });

    // Assert
    expect(codeOf(commercial)).toBe('PRICE_GATE_NOT_RELEASED');
    expect(codeOf(technical)).toBe('SESSION_ALREADY_SCHEDULED');
    expect(codeOf(opened)).toBe('STAGE_ALREADY_OPENED');
    expect(codeOf(wrongEnvelope)).toBe('ENVELOPE_NOT_IN_PLAN');
    expect(codeOf(early)).toBe('SCHEDULED_BEFORE_CLOSING');
    expect(codeOf(ineligible)).toBe('PARTICIPANT_NOT_ELIGIBLE');
  });

  it('schedules the T-2026-0006 single-stage opening', async () => {
    // Act
    const response = await api.callAs(OFFICER, E.scheduleSession, {
      tenant: 'kwu',
      body: {
        tenderId: 6,
        envelope: 'all',
        scheduledAt: '2026-10-22T08:00:00Z',
        quorumRequired: 2,
        participants: [
          { userId: 15, role: 'opening_officer' },
          { userId: 16, role: 'witness' },
        ],
      },
    });

    // Assert
    expect(response.status).toBe(201);
    const detail = OpeningSessionDetail.parse(response.body);
    expect(detail).toMatchObject({ status: 'scheduled', envelope: 'all', myParticipantId: 9001 });
    expect(detail.readiness.find((item) => item.code === 'tender_closed')?.status).toBe('blocking');
  });

  it('rejects scheduling on a cancelled lot or a lot of another tender', async () => {
    // Arrange
    const participants = [
      { userId: 15, role: 'opening_officer' },
      { userId: 16, role: 'witness' },
    ];

    // Act
    const cancelled = await api.callAs(OFFICER, E.scheduleSession, {
      tenant: 'kwu',
      body: { tenderId: 1, lotId: 102, envelope: 'commercial', scheduledAt: '2026-10-20T08:00:00Z', quorumRequired: 2, participants },
    });
    const foreign = await api.callAs(OFFICER, E.scheduleSession, {
      tenant: 'kwu',
      body: { tenderId: 6, lotId: 101, envelope: 'all', scheduledAt: '2026-10-22T08:00:00Z', quorumRequired: 2, participants },
    });

    // Assert
    expect(codeOf(cancelled)).toBe('LOT_CANCELLED');
    expect(codeOf(foreign)).toBe('LOT_NOT_IN_TENDER');
  });

  it('records minutes, issues a public summary once, and aborts only open sessions', async () => {
    // Act
    const minutes = await api.callAs(OFFICER, E.recordSession, {
      tenant: 'kwu',
      params: { sessionId: 131 },
      body: { minutes: 'Technical envelopes opened.', irregularities: null },
    });
    const notDone = await api.callAs(OFFICER, E.recordSession, { tenant: 'kwu', params: { sessionId: 180 }, body: { minutes: 'x', irregularities: null } });
    const summary = await api.callAs(OFFICER, E.releasePublicSummary, { tenant: 'kwu', params: { sessionId: 131 }, body: { publicReleaseSummary: 'Technical envelopes opened.' } });
    const twice = await api.callAs(OFFICER, E.releasePublicSummary, { tenant: 'kwu', params: { sessionId: 130 }, body: { publicReleaseSummary: 'Again.' } });
    const notPublic = await api.callAs(OFFICER, E.releasePublicSummary, { tenant: 'kwu', params: { sessionId: 110 }, body: { publicReleaseSummary: 'No.' } });
    const pending = await api.callAs(OFFICER, E.releasePublicSummary, { tenant: 'kwu', params: { sessionId: 180 }, body: { publicReleaseSummary: 'No.' } });
    const abort = await api.callAs(OFFICER, E.abortSession, { tenant: 'kwu', params: { sessionId: 120 }, body: { reason: 'Witness unavailable.' } });
    const abortDone = await api.callAs(OFFICER, E.abortSession, { tenant: 'kwu', params: { sessionId: 130 }, body: { reason: 'x' } });
    const abortTwice = await api.callAs(OFFICER, E.abortSession, { tenant: 'kwu', params: { sessionId: 129 }, body: { reason: 'x' } });

    // Assert
    expect(OpeningSessionDetail.parse(minutes.body).minutes).toBe('Technical envelopes opened.');
    expect(codeOf(notDone)).toBe('SESSION_NOT_COMPLETED');
    expect(OpeningSessionDetail.parse(summary.body).publicReleaseApproved).toBe(true);
    expect([codeOf(twice), codeOf(notPublic), codeOf(pending)]).toEqual([
      'PUBLIC_SUMMARY_ALREADY_RELEASED',
      'PUBLIC_OPENING_NOT_REQUIRED',
      'SESSION_NOT_COMPLETED',
    ]);
    expect(OpeningSessionDetail.parse(abort.body).status).toBe('aborted');
    expect([codeOf(abortDone), codeOf(abortTwice)]).toEqual(['SESSION_ALREADY_COMPLETED', 'SESSION_ALREADY_ABORTED']);
  });

  it('lists the opening team for scheduling, only to bid.open holders', async () => {
    // Act
    const team = await api.callAs(OFFICER, E.getOpeningTeam, { tenant: 'kwu', params: { tenderId: 8 } });
    const denied = await api.callAs(WITNESS, E.getOpeningTeam, { tenant: 'kwu', params: { tenderId: 8 } });

    // Assert
    expect((team.body as { items: unknown[] }).items).toHaveLength(6);
    expect(denied.status).toBe(403);
  });
});

describe('BUY-21 compliance and exclusions (AC-17)', () => {
  it('lists T-2026-0003 bids with Makgadikgadi not rankable and its commercial envelope withheld', async () => {
    // Act
    const rows = page(await api.callAs(TEBOGO, E.listBids, { tenant: 'kwu', params: { tenderId: 3 } }));
    const makgadikgadi = rows.items.find((row) => row.bidId === 3003) as {
      rankingEligible: boolean;
      envelopes: Array<{ envelope: string; state: string }>;
      exclusion: { status: string };
    };

    // Assert
    expect(rows.total).toBe(3);
    expect(makgadikgadi.rankingEligible).toBe(false);
    expect(makgadikgadi.exclusion.status).toBe('awaiting_approval');
    expect(makgadikgadi.envelopes.find((row) => row.envelope === 'commercial')?.state).toBe('withheld');
  });

  it('filters the register by ranking eligibility', async () => {
    // Act
    const rows = page(await api.callAs(TEBOGO, E.listBids, { tenant: 'kwu', params: { tenderId: 1 }, query: { rankingEligible: 'false' } }));

    // Assert
    expect(rows.items.map((row) => row.bidId)).toEqual([1003]);
  });

  it('keeps T-2026-0008 checks empty before opening', async () => {
    // Act
    const response = await api.callAs(TEBOGO, E.getBidCompliance, { tenant: 'kwu', params: { bidId: 8001 } });

    // Assert
    expect(response.body).toMatchObject({ contentAvailable: false, checks: [] });
  });

  it('records a check and refuses one on an excluded or concluded bid', async () => {
    // Arrange
    const body = { result: 'pass', findingClass: 'none', evidenceRef: 'Attendance register of 18 Aug 2026.' };

    // Act
    const ok = await api.callAs(TEBOGO, E.recordCheck, { tenant: 'kwu', params: { checkId: 300110 }, body });
    const excluded = await api.callAs(TEBOGO, E.recordCheck, { tenant: 'kwu', params: { checkId: 100301 }, body });
    const decided = await api.callAs(TEBOGO, E.recordCheck, { tenant: 'kwu', params: { checkId: 100101 }, body });
    const invalid = await api.callAs(TEBOGO, E.recordCheck, { tenant: 'kwu', params: { checkId: 300110 }, body: { result: 'not_applicable', findingClass: 'none' } });
    const chair = await api.callAs(MANAGER, E.recordCheck, { tenant: 'kwu', params: { checkId: 300110 }, body });

    // Assert
    expect(ok.status).toBe(200);
    expect([codeOf(excluded), codeOf(decided)]).toEqual(['BID_EXCLUDED', 'COMPLIANCE_DECIDED']);
    expect(Problem.parse(invalid.body).errors?.map((item) => item.code)).toEqual(['REASON_REQUIRED']);
    expect(chair.status).toBe(403);
  });

  it('concludes compliance only when the findings support it', async () => {
    // Act
    const pending = await api.callAs(TEBOGO, E.decideCompliance, { tenant: 'kwu', params: { bidId: 3001 }, body: { outcome: 'compliant' } });
    const inProgress = await api.callAs(TEBOGO, E.decideCompliance, { tenant: 'kwu', params: { bidId: 3003 }, body: { outcome: 'non_compliant' } });
    const contradicts = await api.callAs(TEBOGO, E.decideCompliance, { tenant: 'kwu', params: { bidId: 1002 }, body: { outcome: 'compliant' } });
    const ok = await api.callAs(TEBOGO, E.decideCompliance, { tenant: 'kwu', params: { bidId: 1002 }, body: { outcome: 'non_compliant' } });
    const sealed = await api.callAs(TEBOGO, E.decideCompliance, { tenant: 'kwu', params: { bidId: 8001 }, body: { outcome: 'compliant' } });
    const excluded = await api.callAs(TEBOGO, E.decideCompliance, { tenant: 'kwu', params: { bidId: 1003 }, body: { outcome: 'compliant' } });
    const decided = await api.callAs(TEBOGO, E.decideCompliance, { tenant: 'kwu', params: { bidId: 1001 }, body: { outcome: 'compliant' } });

    // Assert
    expect([codeOf(pending), codeOf(inProgress), codeOf(contradicts)]).toEqual(['CHECKS_PENDING', 'EXCLUSION_IN_PROGRESS', 'OUTCOME_CONTRADICTS_CHECKS']);
    expect((ok.body as { complianceStatus: string; rankingEligible: boolean }).complianceStatus).toBe('non_compliant');
    expect([codeOf(sealed), codeOf(excluded), codeOf(decided)]).toEqual(['ENVELOPE_NOT_OPENED', 'BID_EXCLUDED', 'COMPLIANCE_DECIDED']);
  });

  it('proposes an exclusion citing the failed security check and refuses invalid proposals', async () => {
    // Arrange
    const base = { grounds: 'The bid security expired before the extended bid validity.', challengeRoute: 'Request a review within 10 working days.' };

    // Act
    const ok = await api.callAs(TEBOGO, E.proposeExclusion, { tenant: 'kwu', body: { ...base, bidId: 1002, checkIds: [100208] } });
    const active = await api.callAs(TEBOGO, E.proposeExclusion, { tenant: 'kwu', body: { ...base, bidId: 3003, checkIds: [300305] } });
    const notFailed = await api.callAs(TEBOGO, E.proposeExclusion, { tenant: 'kwu', body: { ...base, bidId: 1002, checkIds: [100201] } });
    const foreign = await api.callAs(TEBOGO, E.proposeExclusion, { tenant: 'kwu', body: { ...base, bidId: 1002, checkIds: [300305] } });
    const open = await api.callAs(TEBOGO, E.proposeExclusion, { tenant: 'kwu', body: { ...base, bidId: 3001, checkIds: [300103] } });
    const sealed = await api.callAs(TEBOGO, E.proposeExclusion, { tenant: 'kwu', body: { ...base, bidId: 8001, checkIds: [300305] } });

    // Assert
    expect(ok.status).toBe(201);
    expect(ExclusionDetail.parse(ok.body)).toMatchObject({ status: 'proposed', checkIds: [100208] });
    expect([codeOf(active), codeOf(notFailed), codeOf(foreign), codeOf(open), codeOf(sealed)]).toEqual([
      'EXCLUSION_ALREADY_ACTIVE',
      'CHECKS_NOT_FAILED',
      'CHECK_NOT_ON_BID',
      'CLARIFICATION_OPEN',
      'BID_NOT_OPENED',
    ]);
  });

  it('shows the pending T-2026-0003 exclusion with its approval and sealed commercial envelope', async () => {
    // Act
    const detail = ExclusionDetail.parse((await api.callAs(MANAGER, E.getExclusion, { tenant: 'kwu', params: { exclusionId: 5101 } })).body);

    // Assert
    expect(detail).toMatchObject({ status: 'awaiting_approval', approvalStatus: 'pending', commercialEnvelope: 'withheld' });
    expect(detail.checks.map((check) => check.result)).toEqual(['fail']);
  });

  it('withdraws a pending exclusion and notifies only an approved, un-notified one', async () => {
    // Act
    const withdrawn = await api.callAs(TEBOGO, E.withdrawExclusion, { tenant: 'kwu', params: { exclusionId: 5101 }, body: { reason: 'Reconsidered.' } });
    const decided = await api.callAs(TEBOGO, E.withdrawExclusion, { tenant: 'kwu', params: { exclusionId: 5102 }, body: { reason: 'x' } });
    const notApproved = await api.callAs(TEBOGO, E.issueExclusionNotice, { tenant: 'kwu', params: { exclusionId: 5101 }, body: {} });
    const twice = await api.callAs(TEBOGO, E.issueExclusionNotice, { tenant: 'kwu', params: { exclusionId: 5102 }, body: {} });

    // Assert
    expect(ExclusionDetail.parse(withdrawn.body).status).toBe('withdrawn');
    expect([codeOf(decided), codeOf(notApproved), codeOf(twice)]).toEqual(['EXCLUSION_ALREADY_DECIDED', 'EXCLUSION_NOT_APPROVED', 'NOTICE_ALREADY_ISSUED']);
  });

  it('filters exclusions by status', async () => {
    // Act
    const rows = page(await api.callAs(MANAGER, E.listExclusions, { tenant: 'kwu', query: { status: ['approved', 'rejected'] } }));

    // Assert
    expect(rows.items.map((row) => row.id).sort()).toEqual([5102, 5104]);
  });
});

describe('EVA-03 clarifications', () => {
  it('shows an evaluator only their own questions and answers distributed to them', async () => {
    // Act
    const thato = page(await api.callAs(THATO, E.listClarifications, { tenant: 'kwu' }));
    const hidden = await api.callAs(THATO, E.getClarification, { tenant: 'kwu', params: { clarificationId: 4102 } });
    const chair = page(await api.callAs(CHAIR, E.listClarifications, { tenant: 'kwu', query: { pageSize: 100 } }));

    // Assert
    expect(thato.items.map((row) => row.id).sort()).toEqual([4103, 4106, 4110, 4114]);
    expect(hidden.status).toBe(404);
    expect(chair.total).toBe(17);
  });

  it('lets the chair consolidate duplicate drafts on the same bid', async () => {
    // Act
    const ok = await api.callAs(CHAIR, E.consolidateClarifications, { tenant: 'kwu', params: { clarificationId: 4103 }, body: { clarificationIds: [4104] } });
    const self = await api.callAs(CHAIR, E.consolidateClarifications, { tenant: 'kwu', params: { clarificationId: 4103 }, body: { clarificationIds: [4103] } });
    const other = await api.callAs(CHAIR, E.consolidateClarifications, { tenant: 'kwu', params: { clarificationId: 4103 }, body: { clarificationIds: [4101] } });
    const notDraft = await api.callAs(CHAIR, E.consolidateClarifications, { tenant: 'kwu', params: { clarificationId: 4106 }, body: { clarificationIds: [4103] } });
    const evaluator = await api.callAs(THATO, E.consolidateClarifications, { tenant: 'kwu', params: { clarificationId: 4103 }, body: { clarificationIds: [4104] } });

    // Assert
    const detail = ClarificationDetail.parse(ok.body);
    expect(detail.consolidated.map((row) => row.id)).toEqual([4104]);
    expect(detail.consolidatedCount).toBe(1);
    expect([codeOf(self), codeOf(other), codeOf(notDraft)]).toEqual(['CONSOLIDATION_SELF', 'CLARIFICATION_NOT_DRAFT', 'CLARIFICATION_NOT_DRAFT']);
    expect(evaluator.status).toBe(403);
  });

  it('approves, issues and records the effect along the permitted route', async () => {
    // Act
    const approved = await api.callAs(CHAIR, E.approveClarification, { tenant: 'kwu', params: { clarificationId: 4104 } });
    const merged = await api.callAs(CHAIR, E.approveClarification, { tenant: 'kwu', params: { clarificationId: 4105 } });
    const notDraft = await api.callAs(CHAIR, E.approveClarification, { tenant: 'kwu', params: { clarificationId: 4106 } });
    const wrongRole = await api.callAs(MANAGER, E.approveClarification, { tenant: 'kwu', params: { clarificationId: 4103 } });
    const issued = await api.callAs(TEBOGO, E.issueClarification, { tenant: 'kwu', params: { clarificationId: 4107 } });
    const notApproved = await api.callAs(TEBOGO, E.issueClarification, { tenant: 'kwu', params: { clarificationId: 4103 } });
    const effect = await api.callAs(CHAIR, E.recordClarificationEffect, {
      tenant: 'kwu',
      params: { clarificationId: 4108 },
      body: { effect: 'resolved', effectNote: 'Gateway confirmed as offered.', distributeToUserIds: [11, 12, 13] },
    });
    const notResponded = await api.callAs(CHAIR, E.recordClarificationEffect, {
      tenant: 'kwu',
      params: { clarificationId: 4106 },
      body: { effect: 'resolved', effectNote: 'x' },
    });
    const notAssessor = await api.callAs(CHAIR, E.recordClarificationEffect, {
      tenant: 'kwu',
      params: { clarificationId: 4108 },
      body: { effect: 'resolved', effectNote: 'x', distributeToUserIds: [3] },
    });

    // Assert
    expect(ClarificationDetail.parse(approved.body)).toMatchObject({ status: 'approved', approvedBy: { userId: 10 } });
    expect([codeOf(merged), codeOf(notDraft), codeOf(wrongRole)]).toEqual(['CLARIFICATION_CONSOLIDATED', 'CLARIFICATION_NOT_DRAFT', 'FORBIDDEN']);
    expect(ClarificationDetail.parse(issued.body).status).toBe('issued');
    expect(codeOf(notApproved)).toBe('CLARIFICATION_NOT_APPROVED');
    expect(ClarificationDetail.parse(effect.body).distributedTo.map((person) => person.userId)).toEqual([11, 12, 13]);
    expect([codeOf(notResponded), codeOf(notAssessor)]).toEqual(['CLARIFICATION_NOT_RESPONDED', 'RECIPIENT_NOT_ASSESSOR']);
  });

  it('blocks the chair from approving a question the chair raised', async () => {
    // Act
    const response = await api.callAs(CHAIR, E.approveClarification, { tenant: 'kwu', params: { clarificationId: 4118 } });

    // Assert
    expect(response.status).toBe(403);
    expect(codeOf(response)).toBe('SELF_APPROVAL_NOT_PERMITTED');
  });

  it('raises a draft within the permitted stage and refuses ineligible bids', async () => {
    // Arrange
    const base = { source: 'evaluation', question: 'Please confirm the warranty period offered.', permittedScope: 'Confirmation only; no change to the offer.', dueAt: '2026-12-01T10:00:00Z' };

    // Act
    const ok = await api.callAs(THATO, E.raiseClarification, { tenant: 'kwu', body: { ...base, bidId: 3002 } });
    const source = await api.callAs(THATO, E.raiseClarification, { tenant: 'kwu', body: { ...base, source: 'compliance', bidId: 3002 } });
    const withdrawn = await api.callAs(THATO, E.raiseClarification, { tenant: 'kwu', body: { ...base, bidId: 8002 } });
    const sealed = await api.callAs(THATO, E.raiseClarification, { tenant: 'kwu', body: { ...base, bidId: 8001 } });
    const excluded = await api.callAs(THATO, E.raiseClarification, { tenant: 'kwu', body: { ...base, bidId: 1003 } });
    const past = await api.callAs(THATO, E.raiseClarification, { tenant: 'kwu', body: { ...base, bidId: 3002, dueAt: '2026-01-01T10:00:00Z' } });

    // Assert
    expect(ok.status).toBe(201);
    expect(ClarificationDetail.parse(ok.body)).toMatchObject({ status: 'draft', raisedBy: { userId: 11 } });
    expect([codeOf(source), codeOf(withdrawn), codeOf(sealed), codeOf(excluded), codeOf(past)]).toEqual([
      'SOURCE_NOT_PERMITTED',
      'BID_NOT_ELIGIBLE',
      'BID_NOT_OPENED',
      'BID_EXCLUDED',
      'DUE_DATE_IN_PAST',
    ]);
  });
});

describe('SUP-18 supplier assessment requests', () => {
  it('shows Serowe only its own issued and answered requests, never drafts', async () => {
    // Act
    const rows = page(await api.callAs('serowe-ict.bidmanager@tenderiq.local', E.listAssessmentRequests, { tenant: 'serowe-ict' }));

    // Assert
    expect(rows.items.map((row) => row.id).sort()).toEqual([4101, 4106, 4111]);
    expect(rows.items.every((row) => !('effect' in row) && !('raisedBy' in row))).toBe(true);
  });

  it('gives each request its own CL reference, distinct from the tender reference, and searches and sorts by it', async () => {
    // Act
    const rows = page(await api.callAs('tsodilo.bidmanager@tenderiq.local', E.listAssessmentRequests, { tenant: 'tsodilo', query: { sort: 'reference', dir: 'desc' } }));
    const searched = page(await api.callAs('tsodilo.bidmanager@tenderiq.local', E.listAssessmentRequests, { tenant: 'tsodilo', query: { q: 'CL-4108' } }));

    // Assert
    expect(rows.items.length).toBeGreaterThan(1);
    expect(rows.items.every((row) => row.reference === `CL-${String(row.id)}` && row.reference !== row.tenderReference)).toBe(true);
    expect(new Set(rows.items.map((row) => row.reference)).size).toBe(rows.items.length);
    expect(rows.items.map((row) => row.reference)).toEqual([...rows.items.map((row) => row.reference)].sort().reverse());
    expect(searched.items.map((row) => row.id)).toEqual([4108]);
  });

  it('hides another supplier’s request and a draft', async () => {
    // Act
    const other = await api.callAs('serowe-ict.bidmanager@tenderiq.local', E.getAssessmentRequest, { tenant: 'serowe-ict', params: { requestId: 4108 } });
    const draft = await api.callAs('tsodilo.bidmanager@tenderiq.local', E.getAssessmentRequest, { tenant: 'tsodilo', params: { requestId: 4103 } });
    const own = await api.callAs('tsodilo.bidmanager@tenderiq.local', E.getAssessmentRequest, { tenant: 'tsodilo', params: { requestId: 4108 } });

    // Assert
    expect(other.status).toBe(404);
    expect(draft.status).toBe(404);
    expect(AssessmentRequestDetail.parse(own.body).status).toBe('responded');
  });

  it('accepts a response within scope from the signatory and refuses closed or late requests', async () => {
    // Arrange
    const body = { responseText: 'The 8-hour figure in Annex T-3 applies.', offerUnchangedConfirmed: true };

    // Act
    const ok = await api.callAs('serowe-ict.signatory@tenderiq.local', E.respondAssessmentRequest, { tenant: 'serowe-ict', params: { requestId: 4106 }, body });
    const closed = await api.callAs('serowe-ict.signatory@tenderiq.local', E.respondAssessmentRequest, { tenant: 'serowe-ict', params: { requestId: 4101 }, body });
    const late = await api.callAs('chobe-pipe.signatory@tenderiq.local', E.respondAssessmentRequest, { tenant: 'chobe-pipe', params: { requestId: 4117 }, body });

    // Assert
    expect(AssessmentRequestDetail.parse(ok.body)).toMatchObject({ status: 'responded', responseText: body.responseText, respondedAt: '2026-09-30T09:00:00Z' });
    expect([codeOf(closed), codeOf(late)]).toEqual(['REQUEST_NOT_OPEN', 'RESPONSE_DEADLINE_PASSED']);
  });

  it.each([
    ['a contributor', 'serowe-ict.contributor@tenderiq.local'],
    ['a bid manager', 'serowe-ict.bidmanager@tenderiq.local'],
    ['an organization administrator', 'serowe-ict.admin@tenderiq.local'],
  ])('refuses %s without submission authority the formal answer (AC-03)', async (_label, email) => {
    // Arrange
    const body = { responseText: 'The 8-hour figure in Annex T-3 applies.', offerUnchangedConfirmed: true };

    // Act
    const response = await api.callAs(email, E.respondAssessmentRequest, { tenant: 'serowe-ict', params: { requestId: 4106 }, body });

    // Assert
    expect(response.status).toBe(403);
  });

  it('refuses a buyer persona on supplier routes and a supplier on buyer routes', async () => {
    // Act
    const buyer = await api.callAs(TEBOGO, E.listAssessmentRequests, { tenant: 'kwu' });
    const supplier = await api.callAs('tsodilo.bidmanager@tenderiq.local', E.listClarifications, { tenant: 'tsodilo' });

    // Assert
    expect(buyer.status).toBe(403);
    expect(supplier.status).toBe(403);
  });
});
