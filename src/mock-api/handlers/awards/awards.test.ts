/**
 * Mock handlers of the awards contract (BUY-26, BUY-28..30, SUP-21, SUP-22, PUB-05): tenant filtering, 403 for the
 * wrong tenant kind or a missing permission, supplier and public audience isolation, the storyline scenarios
 * (AC-25, AC-26, AC-27, AC-29, AC-39) and the declared business errors. Real Supabase Auth (DD-43).
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { awardEndpoints as api } from '../../../contracts/awards.js';
import type { AnyEndpoint } from '../../../contracts/endpoint.js';
import { createTestMockApp } from '../../testing/index.js';
import type { TestMockApp, TestResponse } from '../../testing/index.js';
import { register } from './index.js';

const NOW = new Date('2026-09-30T08:00:00Z');

const TEBOGO = 'tebogo.officer@tenderiq.local';
const MPHO = 'mpho.manager@tenderiq.local';
const KEABETSWE = 'keabetswe.approver@tenderiq.local';
const DINEO = 'dineo.legal@tenderiq.local';
const PULE = 'pule.auditor@tenderiq.local';
const ADMIN_KWU = 'admin.kwu@tenderiq.local';
const KAGISO = 'kagiso.requester@tenderiq.local';
const OFFICER_ODC = 'officer.odc@tenderiq.local';
const TSODILO_BID = 'tsodilo.bidmanager@tenderiq.local';
const TSODILO_CONTRIBUTOR = 'tsodilo.contributor@tenderiq.local';
const CHOBE_BID = 'chobe-pipe.bidmanager@tenderiq.local';
const LIMPOPO = 'limpopo-env.admin@tenderiq.local';
const MAKGADIKGADI = 'makgadikgadi.admin@tenderiq.local';
const SEROWE_BID = 'serowe-ict.bidmanager@tenderiq.local';
const GABORONE_BID = 'gaborone-meter.bidmanager@tenderiq.local';

let app: TestMockApp;

beforeAll(async () => {
  app = await createTestMockApp({ modules: [{ name: 'awards', register }], now: () => NOW });
});

type CallOptions = Parameters<TestMockApp['callAs']>[2];

async function call(email: string, endpoint: AnyEndpoint, options: CallOptions = {}): Promise<TestResponse> {
  return app.callAs(email, endpoint, options);
}

function code(response: TestResponse): string | undefined {
  return (response.body as { code?: string } | null)?.code;
}

function fieldCodes(response: TestResponse): string[] {
  return ((response.body as { errors?: { code: string }[] } | null)?.errors ?? []).map((error) => error.code);
}

describe('awards module', () => {
  it('registers every awards endpoint without failures', () => {
    expect(app.failed).toEqual([]);
    for (const endpoint of Object.values(api)) {
      expect(app.endpointIds).toContain(endpoint.id);
    }
  });
});

describe('supplier complaint tenders (SUP-22)', () => {
  it('lists only the tenders the supplier took part in, with lots and the complaint deadline', async () => {
    const response = await call(LIMPOPO, api.listComplaintTenders, { tenant: 'limpopo-env' });
    const { tenders } = api.listComplaintTenders.response.parse(response.body);
    const t7 = tenders.find((row) => row.reference === 'T-2026-0007');
    expect(t7?.lots.length).toBeGreaterThan(0);
    expect(tenders.every((row) => row.tenderId !== 1)).toBe(true);
  });

  it('refuses a buyer persona on the supplier endpoint', async () => {
    const response = await call(TEBOGO, api.listComplaintTenders, { tenant: 'kwu' });
    expect(response.status).toBe(403);
  });
});

describe('buyer award register and overview (BUY-26)', () => {
  it('lists the six KWU award files for the tender owner', async () => {
    const response = await call(TEBOGO, api.listAwards, { tenant: 'kwu' });
    expect(response.status).toBe(200);
    const page = api.listAwards.response.parse(response.body);
    expect(page.total).toBe(6);
    expect(page.items.map((row) => row.tender.reference)).toEqual([
      'T-2026-0001',
      'T-2026-0003',
      'T-2026-0004',
      'T-2026-0007',
      'T-2026-0009',
      'T-2026-0010',
    ]);
  });

  it('filters the register by active hold and by next step', async () => {
    const held = api.listAwards.response.parse(
      (await call(TEBOGO, api.listAwards, { tenant: 'kwu', query: { hasActiveHold: 'true' } })).body,
    );
    expect(held.items.map((row) => row.tender.reference)).toEqual(['T-2026-0007']);
    const closing = api.listAwards.response.parse(
      (await call(TEBOGO, api.listAwards, { tenant: 'kwu', query: { nextStep: 'close_event' } })).body,
    );
    expect(closing.items.map((row) => row.tender.reference)).toEqual(['T-2026-0010']);
  });

  it('returns an empty register for ODC, whose only tender is open', async () => {
    const response = await call(OFFICER_ODC, api.listAwards, { tenant: 'odc' });
    expect(api.listAwards.response.parse(response.body)).toMatchObject({ total: 0, items: [] });
  });

  it('answers 404 when ODC asks for a KWU award file', async () => {
    const response = await call(OFFICER_ODC, api.getAwardOverview, { tenant: 'odc', params: { tenderId: 1 } });
    expect(response.status).toBe(404);
  });

  it('shows T-2026-0001 per lot: lot 1 awarded, lot 2 cancelled, lot 3 still in evaluation (AC-26)', async () => {
    const response = await call(TEBOGO, api.getAwardOverview, { tenant: 'kwu', params: { tenderId: 1 } });
    const overview = api.getAwardOverview.response.parse(response.body);
    expect(overview.tender.status).toBe('partially_awarded');
    expect(overview.lots.map((lot) => [lot.lot.lotNo, lot.stage, lot.outcome?.outcome ?? null])).toEqual([
      [1, 'awarded', 'award'],
      [2, 'cancelled', 'cancelled'],
      [3, 'under_assessment', null],
    ]);
    expect(overview.reconciliation).toMatchObject({
      value: { basis: 'final_awarded', total: { amount: '5340000.00' }, finalAwardedTotal: { amount: '5340000.00' } },
      reconciles: true,
    });
  });

  it('labels register values by basis and never counts a proposed outcome as decided (BR-31)', async () => {
    const page = api.listAwards.response.parse((await call(TEBOGO, api.listAwards, { tenant: 'kwu' })).body);
    const row = (reference: string) => page.items.find((item) => item.tender.reference === reference);
    expect(row('T-2026-0003')).toMatchObject({
      lotsWithOutcome: 0,
      lotsWithProposedOutcome: 1,
      value: { basis: 'recommended', total: { amount: '120000.00' }, finalAwardedTotal: { amount: '0.00' } },
    });
    expect(row('T-2026-0009')).toMatchObject({ lotsWithOutcome: 0, lotsWithProposedOutcome: 1, value: { basis: 'recommended' } });
    expect(row('T-2026-0007')).toMatchObject({ lotsWithOutcome: 1, lotsWithProposedOutcome: 0, value: { basis: 'intended' } });
    expect(row('T-2026-0001')).toMatchObject({ lotsWithOutcome: 2, lotsFinalAwarded: 1, value: { basis: 'final_awarded' } });
  });

  it('offers the final-award approval per lot outcome only when it may be requested (DD-14)', async () => {
    const t7 = api.getAwardOverview.response.parse((await call(TEBOGO, api.getAwardOverview, { tenant: 'kwu', params: { tenderId: 7 } })).body);
    const approval = t7.lots[0]?.finalAwardApproval;
    expect(approval).toMatchObject({ lotOutcomeId: 141, subjectVersion: 1, approvalRequestId: null, requestable: false });
    expect(approval?.unavailableReason).toContain('CMP-2026-0002');
    expect(approval?.contentHash).toMatch(/^[a-f0-9]{64}$/);
    const t1 = api.getAwardOverview.response.parse((await call(TEBOGO, api.getAwardOverview, { tenant: 'kwu', params: { tenderId: 1 } })).body);
    expect(t1.lots.map((lot) => lot.finalAwardApproval?.requestable ?? null)).toEqual([false, null, null]);
    const t3 = api.getAwardOverview.response.parse((await call(TEBOGO, api.getAwardOverview, { tenant: 'kwu', params: { tenderId: 3 } })).body);
    expect(t3.lots[0]?.finalAwardApproval?.unavailableReason).toContain('intention to award is notified');
  });

  it('lets the auditor read the register but not act on it', async () => {
    expect((await call(PULE, api.listAwards, { tenant: 'kwu' })).status).toBe(200);
    const response = await call(PULE, api.submitRecommendation, { tenant: 'kwu', params: { recommendationId: 13 }, body: {} });
    expect(response.status).toBe(403);
    expect(code(response)).toBe('FORBIDDEN');
  });

  it('refuses the register to a requester and to the organization administrator (403 FORBIDDEN)', async () => {
    for (const email of [KAGISO, ADMIN_KWU]) {
      const response = await call(email, api.listAwards, { tenant: 'kwu' });
      expect(response.status).toBe(403);
      expect(code(response)).toBe('FORBIDDEN');
    }
  });

  it('refuses buyer endpoints to a supplier organization (wrong tenant kind)', async () => {
    const response = await call(TSODILO_BID, api.listAwards, { tenant: 'tsodilo' });
    expect(response.status).toBe(403);
    expect(code(response)).toBe('TENANT_ACCESS_DENIED');
  });
});

describe('recommendation commands (BUY-26)', () => {
  it('blocks the T-2026-0003 draft while the evaluation is not signed off', async () => {
    const response = await call(TEBOGO, api.submitRecommendation, { tenant: 'kwu', params: { recommendationId: 13 }, body: {} });
    expect(response.status).toBe(409);
    expect(code(response)).toBe('EVALUATION_NOT_SIGNED_OFF');
  });

  it('refuses to edit an approved recommendation', async () => {
    const current = api.getRecommendation.response.parse(
      (await call(TEBOGO, api.getRecommendation, { tenant: 'kwu', params: { recommendationId: 14902 } })).body,
    );
    const response = await call(TEBOGO, api.updateRecommendation, {
      tenant: 'kwu',
      params: { recommendationId: 14902 },
      body: {
        summary: current.summary,
        compliantOffersSummary: current.compliantOffersSummary,
        affordabilitySummary: current.affordabilitySummary,
        conflictsSummary: current.conflictsSummary,
        exceptionsSummary: current.exceptionsSummary,
        negotiationSummary: current.negotiationSummary,
        unresolvedConditions: current.unresolvedConditions,
        lotOutcomes: [{ lotId: 101, outcome: 'award', bidId: 104, awardedValue: { amount: '5340000.00', currency: 'BWP' }, conditions: null, reason: null }],
      },
    });
    expect(code(response)).toBe('RECOMMENDATION_NOT_EDITABLE');
  });

  it('rejects an awarding lot outcome without an offer or value (422)', async () => {
    const response = await call(TEBOGO, api.updateRecommendation, {
      tenant: 'kwu',
      params: { recommendationId: 13 },
      body: {
        summary: 'x',
        compliantOffersSummary: 'x',
        affordabilitySummary: 'x',
        conflictsSummary: 'x',
        exceptionsSummary: 'x',
        negotiationSummary: 'x',
        unresolvedConditions: 'x',
        lotOutcomes: [{ lotId: 301, outcome: 'award', bidId: null, awardedValue: null, conditions: null, reason: null }],
      },
    });
    expect(response.status).toBe(422);
    expect(fieldCodes(response)).toEqual(expect.arrayContaining(['AWARDED_BID_REQUIRED', 'AWARDED_VALUE_REQUIRED']));
  });

  it('saves a draft with a no-award outcome and recomputes the reconciliation', async () => {
    const response = await call(TEBOGO, api.updateRecommendation, {
      tenant: 'kwu',
      params: { recommendationId: 13 },
      body: {
        summary: 'No award: both offers exceed the revised budget.',
        compliantOffersSummary: 'Two compliant offers.',
        affordabilitySummary: 'Both offers exceed the revised budget.',
        conflictsSummary: 'None open.',
        exceptionsSummary: 'None.',
        negotiationSummary: 'None.',
        unresolvedConditions: 'None.',
        lotOutcomes: [{ lotId: 301, outcome: 'no_award', bidId: null, awardedValue: null, conditions: null, reason: 'Budget withdrawn.' }],
      },
    });
    expect(response.status).toBe(200);
    const detail = api.updateRecommendation.response.parse(response.body);
    expect(detail.lotOutcomes[0]).toMatchObject({ outcome: 'no_award', supplier: null });
    expect(detail.reconciliation.value).toMatchObject({ basis: 'recommended', total: { amount: '0.00' } });
  });

  it('creates a draft for T-2026-0001 lot 3 but not for an already decided lot', async () => {
    const created = await call(TEBOGO, api.createRecommendation, { tenant: 'kwu', params: { tenderId: 1 }, body: { lotIds: [103] } });
    expect(created.status).toBe(201);
    expect(api.createRecommendation.response.parse(created.body)).toMatchObject({ status: 'draft', version: 3 });
    const decided = await call(TEBOGO, api.createRecommendation, { tenant: 'kwu', params: { tenderId: 1 }, body: { lotIds: [101] } });
    expect(code(decided)).toBe('LOT_ALREADY_DECIDED');
    const open = await call(TEBOGO, api.createRecommendation, { tenant: 'kwu', params: { tenderId: 3 }, body: { lotIds: [301] } });
    expect(code(open)).toBe('RECOMMENDATION_ALREADY_OPEN');
  });

  it('blocks approval of the T-2026-0009 fallback recommendation while diligence is open (AC-24) but lets the approver return it', async () => {
    const approve = await call(KEABETSWE, api.decideRecommendation, {
      tenant: 'kwu',
      params: { recommendationId: 15 },
      body: { decision: 'approve', rationale: 'Approve.' },
    });
    expect(approve.status).toBe(409);
    expect(code(approve)).toBe('DILIGENCE_BLOCKING');
    const returned = await call(KEABETSWE, api.decideRecommendation, {
      tenant: 'kwu',
      params: { recommendationId: 15 },
      body: { decision: 'return', rationale: 'Complete the insurance verification first.' },
    });
    expect(returned.status).toBe(200);
    expect(api.decideRecommendation.response.parse(returned.body)).toMatchObject({ status: 'returned', approval: { status: 'returned' } });
  });

  it('requires conditions for an approval with conditions (422)', async () => {
    const response = await call(KEABETSWE, api.decideRecommendation, {
      tenant: 'kwu',
      params: { recommendationId: 15 },
      body: { decision: 'approve_with_conditions', rationale: 'Approve.' },
    });
    expect(response.status).toBe(422);
    expect(fieldCodes(response)).toContain('CONDITIONS_REQUIRED');
  });

  it('refuses decisions to anyone without award.approve and on a recommendation that is not pending', async () => {
    const officer = await call(TEBOGO, api.decideRecommendation, {
      tenant: 'kwu',
      params: { recommendationId: 15 },
      body: { decision: 'approve', rationale: 'x' },
    });
    expect(officer.status).toBe(403);
    const approved = await call(KEABETSWE, api.decideRecommendation, {
      tenant: 'kwu',
      params: { recommendationId: 14 },
      body: { decision: 'reject', rationale: 'x' },
    });
    expect(code(approved)).toBe('RECOMMENDATION_NOT_AWAITING_APPROVAL');
  });
});

describe('final award, notices and standstill (BUY-28, AC-25)', () => {
  it('blocks the T-2026-0007 final award while the complaint hold is active', async () => {
    const response = await call(TEBOGO, api.finalAwardLotOutcome, {
      tenant: 'kwu',
      params: { lotOutcomeId: 141 },
      body: { confirmation: true },
    });
    expect(response.status).toBe(409);
    expect(code(response)).toBe('FINAL_AWARD_BLOCKED_BY_HOLD');
  });

  it('refuses a second final award and a final award of a cancelled lot', async () => {
    const again = await call(TEBOGO, api.finalAwardLotOutcome, { tenant: 'kwu', params: { lotOutcomeId: 14011 }, body: { confirmation: true } });
    expect(code(again)).toBe('ALREADY_FINAL_AWARDED');
    const cancelled = await call(TEBOGO, api.finalAwardLotOutcome, { tenant: 'kwu', params: { lotOutcomeId: 14012 }, body: { confirmation: true } });
    expect(code(cancelled)).toBe('LOT_OUTCOME_NOT_AWARDABLE');
  });

  it('refuses to issue the drafted T-2026-0007 final award notice while the hold is active', async () => {
    const response = await call(TEBOGO, api.issueOutcomeNotice, {
      tenant: 'kwu',
      params: { noticeId: 60 },
      body: { disclosureReviewed: true },
    });
    expect(code(response)).toBe('FINAL_AWARD_BLOCKED_BY_HOLD');
  });

  it('shows the running standstill, the active hold and its blocked actions', async () => {
    const response = await call(TEBOGO, api.getStandstill, { tenant: 'kwu', params: { tenderId: 7 } });
    const standstill = api.getStandstill.response.parse(response.body);
    expect(standstill.periods[0]).toMatchObject({ status: 'running', dayType: 'working', effectiveEndsAt: { timeZone: 'Africa/Gaborone' } });
    expect(standstill.blockedActions).toEqual(expect.arrayContaining(['award_final', 'contract_sign']));
    expect(standstill.lotReadiness[0]?.checks.find((check) => check.code === 'blocking_complaint')?.status).toBe('blocking');
  });

  it('extends a running standstill and rejects an earlier end', async () => {
    const earlier = await call(TEBOGO, api.extendStandstill, {
      tenant: 'kwu',
      params: { standstillId: 32 },
      body: { extendedTo: '2026-10-01T15:00:00Z', reason: 'Too early.', notifyParticipants: true },
    });
    expect(code(earlier)).toBe('EXTENSION_NOT_LATER');
    const later = await call(TEBOGO, api.extendStandstill, {
      tenant: 'kwu',
      params: { standstillId: 32 },
      body: { extendedTo: '2026-10-20T15:00:00Z', reason: 'Complaint decision pending.', notifyParticipants: true },
    });
    expect(api.extendStandstill.response.parse(later.body)).toMatchObject({ status: 'extended', extendedTo: { at: '2026-10-20T15:00:00Z' } });
    const completed = await call(TEBOGO, api.extendStandstill, {
      tenant: 'kwu',
      params: { standstillId: 31 },
      body: { extendedTo: '2026-10-20T15:00:00Z', reason: 'x', notifyParticipants: false },
    });
    expect(code(completed)).toBe('STANDSTILL_NOT_ACTIVE');
  });

  it('lists T-2026-0007 notices with the failed delivery and re-sends it', async () => {
    const page = api.listOutcomeNotices.response.parse(
      (await call(TEBOGO, api.listOutcomeNotices, { tenant: 'kwu', params: { tenderId: 7 }, query: { status: 'issued' } })).body,
    );
    expect(page.items.map((row) => row.noticeId).sort()).toEqual([57, 58, 59]);
    expect(page.items.find((row) => row.noticeId === 57)?.failedCount).toBe(1);
    const resent = await call(TEBOGO, api.resendOutcomeNotice, { tenant: 'kwu', params: { noticeId: 57, recipientId: 5704 } });
    expect(api.resendOutcomeNotice.response.parse(resent.body).recipient.deliveryStatus).toBe('pending');
    const delivered = await call(TEBOGO, api.resendOutcomeNotice, { tenant: 'kwu', params: { noticeId: 57, recipientId: 5701 } });
    expect(code(delivered)).toBe('RECIPIENT_NOT_FAILED');
  });

  it('drafts a standstill change notice and refuses an intent notice without an approved recommendation', async () => {
    const created = await call(TEBOGO, api.createOutcomeNotice, {
      tenant: 'kwu',
      params: { tenderId: 7 },
      body: {
        noticeType: 'standstill_change',
        lotIds: [701],
        title: 'Standstill extended',
        body: 'The standstill is extended to 20 Oct 2026 pending the complaint decision.',
        requiresAcknowledgment: false,
      },
    });
    expect(created.status).toBe(201);
    expect(api.createOutcomeNotice.response.parse(created.body)).toMatchObject({ status: 'draft', noticeType: 'standstill_change' });
    const intent = await call(TEBOGO, api.createOutcomeNotice, {
      tenant: 'kwu',
      params: { tenderId: 1 },
      body: { noticeType: 'intent_to_award', lotIds: [103], title: 'Intent lot 3', body: 'Intention to award lot 3 of T-2026-0001.', requiresAcknowledgment: true },
    });
    expect(code(intent)).toBe('RECOMMENDATION_NOT_APPROVED');
  });

  it('refuses to publish a public notice before both reviews and re-publishing a published one (BR-34)', async () => {
    const incomplete = await call(TEBOGO, api.publishPublicNotice, { tenant: 'kwu', params: { publicNoticeId: 62 } });
    expect(code(incomplete)).toBe('PUBLIC_NOTICE_REVIEW_INCOMPLETE');
    const published = await call(TEBOGO, api.publishPublicNotice, { tenant: 'kwu', params: { publicNoticeId: 61 } });
    expect(code(published)).toBe('PUBLIC_NOTICE_ALREADY_PUBLISHED');
    const review = await call(MPHO, api.reviewPublicNotice, {
      tenant: 'kwu',
      params: { publicNoticeId: 62 },
      body: { area: 'personal_information' },
    });
    expect(api.reviewPublicNotice.response.parse(review.body).reviewPersonalInfoBy?.fullName).toBe('Mpho Dikgang');
  });
});

describe('debriefs, complaints and holds (BUY-29)', () => {
  it('lists KWU debriefs only and filters by status', async () => {
    const page = api.listDebriefs.response.parse((await call(TEBOGO, api.listDebriefs, { tenant: 'kwu' })).body);
    expect(page.total).toBe(4);
    const provided = api.listDebriefs.response.parse(
      (await call(TEBOGO, api.listDebriefs, { tenant: 'kwu', query: { status: 'provided' } })).body,
    );
    expect(provided.items.map((row) => row.debriefId).sort()).toEqual([81, 82]);
    const odc = api.listDebriefs.response.parse((await call(OFFICER_ODC, api.listDebriefs, { tenant: 'odc' })).body);
    expect(odc.total).toBe(0);
  });

  it('provides the scheduled debrief and refuses to act on a provided one', async () => {
    const provided = await call(TEBOGO, api.provideDebrief, {
      tenant: 'kwu',
      params: { debriefId: 83 },
      body: { writtenResponse: 'Your offer ranked second; see the per-criterion feedback.', effectOnDeadlines: 'None.' },
    });
    expect(api.provideDebrief.response.parse(provided.body).status).toBe('provided');
    const again = await call(TEBOGO, api.declineDebrief, { tenant: 'kwu', params: { debriefId: 82 }, body: { reason: 'Already provided.' } });
    expect(code(again)).toBe('DEBRIEF_NOT_OPEN');
  });

  it('keeps each buyer’s complaints separate', async () => {
    const kwu = api.listComplaints.response.parse((await call(DINEO, api.listComplaints, { tenant: 'kwu' })).body);
    expect(kwu.items.map((row) => row.reference).sort()).toEqual(['CMP-2026-0001', 'CMP-2026-0002', 'CMP-2026-0003']);
    const odc = api.listComplaints.response.parse((await call(OFFICER_ODC, api.listComplaints, { tenant: 'odc' })).body);
    expect(odc.items.map((row) => row.complaintId)).toEqual([93]);
    expect((await call(OFFICER_ODC, api.getComplaint, { tenant: 'odc', params: { complaintId: 92 } })).status).toBe(404);
  });

  it('shows the blocking hold on CMP-2026-0002 and refuses to release it before the decision (AC-25)', async () => {
    const detail = api.getComplaint.response.parse((await call(DINEO, api.getComplaint, { tenant: 'kwu', params: { complaintId: 92 } })).body);
    expect(detail).toMatchObject({ isBlocking: true, holdActive: true, status: 'under_investigation', hold: { holdId: 42 } });
    const release = await call(DINEO, api.releaseComplaintHold, { tenant: 'kwu', params: { complaintId: 92 }, body: { reason: 'Release.' } });
    expect(code(release)).toBe('COMPLAINT_NOT_DECIDED');
    const place = await call(DINEO, api.placeComplaintHold, {
      tenant: 'kwu',
      params: { complaintId: 92 },
      body: { blockedActions: ['award_final'], reason: 'Again.', reviewDate: '2026-10-09' },
    });
    expect(code(place)).toBe('HOLD_ALREADY_ACTIVE');
  });

  it('issues a response on the independent owner’s case and records the history', async () => {
    const response = await call(DINEO, api.respondToComplaint, {
      tenant: 'kwu',
      params: { complaintId: 92 },
      body: { outcome: 'dismissed', responseText: 'The sub-criterion was published in section 4.3 of the evaluation plan.' },
    });
    const detail = api.respondToComplaint.response.parse(response.body);
    expect(detail).toMatchObject({ status: 'response_issued', outcome: 'dismissed' });
    expect(detail.events.at(-1)).toMatchObject({ eventType: 'response_issued', toStatus: 'response_issued' });
  });

  it('lists the complaint managers of the buyer as owner candidates, marking who took part in the challenged decision', async () => {
    const response = await call(DINEO, api.listComplaintOwnerCandidates, { tenant: 'kwu', params: { complaintId: 92 } });
    const { candidates } = api.listComplaintOwnerCandidates.response.parse(response.body);
    expect(candidates.map((row) => row.person.userId)).toContain(17);
    expect(candidates.every((row) => row.person.userId !== 5)).toBe(true);
    expect(candidates.every((row) => row.independent)).toBe(true);
    const terms = api.listComplaintOwnerCandidates.response.parse(
      (await call(DINEO, api.listComplaintOwnerCandidates, { tenant: 'kwu', params: { complaintId: 94 } })).body,
    );
    const mpho = terms.candidates.find((row) => row.person.userId === 4);
    expect(mpho).toMatchObject({ independent: false });
    expect(mpho?.note).toContain('Approved the release');
    expect(terms.candidates.find((row) => row.person.userId === 17)).toMatchObject({ independent: true, note: null });
    const other = await call(OFFICER_ODC, api.listComplaintOwnerCandidates, { tenant: 'odc', params: { complaintId: 92 } });
    expect([403, 404]).toContain(other.status);
  });

  it('refuses the challenged tender owner as case owner and requires a remedy for an upheld complaint', async () => {
    const owner = await call(DINEO, api.assignComplaintOwner, {
      tenant: 'kwu',
      params: { complaintId: 94 },
      body: { caseOwnerUserId: 5, independenceConfirmed: true },
    });
    expect(code(owner)).toBe('OWNER_NOT_INDEPENDENT');
    const approver = await call(DINEO, api.assignComplaintOwner, {
      tenant: 'kwu',
      params: { complaintId: 94 },
      body: { caseOwnerUserId: 4, independenceConfirmed: true },
    });
    expect(approver.status).toBe(409);
    expect(code(approver)).toBe('OWNER_NOT_INDEPENDENT');
    const independent = await call(DINEO, api.assignComplaintOwner, {
      tenant: 'kwu',
      params: { complaintId: 94 },
      body: { caseOwnerUserId: 17, independenceConfirmed: true },
    });
    expect(api.assignComplaintOwner.response.parse(independent.body).caseOwner?.userId).toBe(17);
    const upheld = await call(DINEO, api.respondToComplaint, {
      tenant: 'kwu',
      params: { complaintId: 92 },
      body: { outcome: 'upheld', responseText: 'The complaint is upheld after investigation.' },
    });
    expect(upheld.status).toBe(422);
    expect(fieldCodes(upheld)).toContain('REMEDY_REQUIRED');
  });

  it('acknowledges a received complaint and refuses complaint work to the procurement officer', async () => {
    const acknowledged = await call(DINEO, api.acknowledgeComplaint, {
      tenant: 'kwu',
      params: { complaintId: 94 },
      body: { standingConfirmed: true, withinWindow: true },
    });
    expect(api.acknowledgeComplaint.response.parse(acknowledged.body).status).toBe('acknowledged');
    const officer = await call(TEBOGO, api.acknowledgeComplaint, {
      tenant: 'kwu',
      params: { complaintId: 94 },
      body: { standingConfirmed: true, withinWindow: true },
    });
    expect(officer.status).toBe(403);
  });
});

describe('event closeout (BUY-30)', () => {
  it('keeps T-2026-0001 blocked on the unaccepted handover (AC-29)', async () => {
    const response = await call(TEBOGO, api.closeEvent, { tenant: 'kwu', params: { tenderId: 1 }, body: { confirmation: true } });
    expect(response.status).toBe(409);
    expect(code(response)).toBe('HANDOVER_NOT_ACCEPTED');
    const detail = (response.body as { detail?: string }).detail ?? '';
    expect(detail).toContain('C-2026-0002, C-2026-0003 and C-2026-0004 are not accepted');
    expect(detail.split('not accepted').length).toBe(2);
    const state = api.getCloseout.response.parse((await call(TEBOGO, api.getCloseout, { tenant: 'kwu', params: { tenderId: 1 } })).body);
    expect(state.contracts.map((row) => [row.reference, row.handoverStatus])).toEqual([
      ['C-2026-0002', 'draft'],
      ['C-2026-0003', 'returned'],
      ['C-2026-0004', 'submitted'],
    ]);
  });

  it('closes T-2026-0010, whose gate passes', async () => {
    const response = await call(TEBOGO, api.closeEvent, { tenant: 'kwu', params: { tenderId: 10 }, body: { confirmation: true } });
    expect(api.closeEvent.response.parse(response.body)).toMatchObject({ status: 'closed', closedBy: { fullName: 'Tebogo Molefe' } });
  });

  it('shows the RFI closed with findings and a linked next event, and archives it (AC-39)', async () => {
    const state = api.getCloseout.response.parse((await call(TEBOGO, api.getCloseout, { tenant: 'kwu', params: { tenderId: 4 } })).body);
    expect(state).toMatchObject({ status: 'closed', isInformationOnly: true, linkedNextTender: { reference: 'T-2026-0009' } });
    const closeAgain = await call(TEBOGO, api.closeEvent, { tenant: 'kwu', params: { tenderId: 4 }, body: { confirmation: true } });
    expect(code(closeAgain)).toBe('CLOSEOUT_ALREADY_CLOSED');
    const archived = await call(TEBOGO, api.archiveEvent, { tenant: 'kwu', params: { tenderId: 4 }, body: { confirmation: true } });
    expect(api.archiveEvent.response.parse(archived.body).status).toBe('archived');
  });

  it('queues an evidence pack', async () => {
    const response = await call(TEBOGO, api.requestEvidencePack, {
      tenant: 'kwu',
      params: { tenderId: 1 },
      body: { scopeDescription: 'Award decision and notices for lots 1 and 2' },
    });
    expect(response.status).toBe(201);
    expect(api.requestEvidencePack.response.parse(response.body).status).toBe('queued');
  });
});

describe('supplier outcomes and debriefs (SUP-21)', () => {
  it('shows Limpopo only its own T-2026-0007 result, its own notices and its provided debrief (AC-27)', async () => {
    const page = api.listSupplierOutcomes.response.parse((await call(LIMPOPO, api.listSupplierOutcomes, { tenant: 'limpopo-env' })).body);
    expect(page.items.map((row) => row.reference).sort()).toEqual(['T-2026-0007', 'T-2026-0009']);
    const response = await call(LIMPOPO, api.getSupplierOutcome, { tenant: 'limpopo-env', params: { tenderId: 7 } });
    const detail = api.getSupplierOutcome.response.parse(response.body);
    expect(detail.result).toBe('unsuccessful');
    expect(detail.debrief?.ownResult?.totalScore).toBe('72.40');
    expect(detail.procurementHoldActive).toBe(true);
    expect(detail.complaints.map((row) => row.reference)).toEqual(['CMP-2026-0002']);
    const text = response.text;
    for (const other of ['80.33', '69.99', '83.60', 'Tsodilo', 'Chobe']) {
      expect(text).not.toContain(other);
    }
  });

  it('presents Makgadikgadi’s intention to award as not final (BR-31) and offers it no debrief', async () => {
    const detail = api.getSupplierOutcome.response.parse(
      (await call(MAKGADIKGADI, api.getSupplierOutcome, { tenant: 'makgadikgadi', params: { tenderId: 7 } })).body,
    );
    expect(detail.result).toBe('intent_to_award');
    expect(detail.lots[0]?.reason).toContain('not a final award');
    const request = await call(MAKGADIKGADI, api.requestDebrief, { tenant: 'makgadikgadi', params: { tenderId: 7 }, body: {} });
    expect(code(request)).toBe('DEBRIEF_NOT_AVAILABLE');
  });

  it('hides the scheduled debrief result until it is provided', async () => {
    const detail = api.getSupplierOutcome.response.parse(
      (await call(TSODILO_BID, api.getSupplierOutcome, { tenant: 'tsodilo', params: { tenderId: 7 } })).body,
    );
    expect(detail.debrief).toMatchObject({ status: 'scheduled', ownResult: null });
  });

  it('refuses Chobe a debrief after the window of the outcome notice closed and refuses a second request from Tsodilo', async () => {
    const detail = api.getSupplierOutcome.response.parse(
      (await call(CHOBE_BID, api.getSupplierOutcome, { tenant: 'chobe-pipe', params: { tenderId: 7 } })).body,
    );
    expect(detail).toMatchObject({ canRequestDebrief: false, debriefDeadline: { at: '2026-09-29T15:00:00Z' } });
    expect(detail.complaintDeadline?.at).toBe('2026-10-08T15:00:00Z');
    const late = await call(CHOBE_BID, api.requestDebrief, { tenant: 'chobe-pipe', params: { tenderId: 7 }, body: {} });
    expect(late.status).toBe(409);
    expect(code(late)).toBe('DEBRIEF_WINDOW_CLOSED');
    const again = await call(TSODILO_BID, api.requestDebrief, { tenant: 'tsodilo', params: { tenderId: 7 }, body: {} });
    expect(code(again)).toBe('DEBRIEF_ALREADY_REQUESTED');
  });

  it('acknowledges an unacknowledged notice and refuses a notice of another supplier', async () => {
    const acknowledged = await call(TSODILO_BID, api.acknowledgeOutcomeNotice, { tenant: 'tsodilo', params: { noticeId: 57 } });
    expect(acknowledged.status).toBe(200);
    const twice = await call(TSODILO_BID, api.acknowledgeOutcomeNotice, { tenant: 'tsodilo', params: { noticeId: 51 } });
    expect(code(twice)).toBe('NOTICE_ALREADY_ACKNOWLEDGED');
    const foreign = await call(TSODILO_BID, api.acknowledgeOutcomeNotice, { tenant: 'tsodilo', params: { noticeId: 52 } });
    expect(foreign.status).toBe(404);
  });

  it('shows Serowe ICT its withdrawn preferred-bidder status and Limpopo its preferred status, neither as an award (BR-31)', async () => {
    const serowe = api.getSupplierOutcome.response.parse(
      (await call(SEROWE_BID, api.getSupplierOutcome, { tenant: 'serowe-ict', params: { tenderId: 9 } })).body,
    );
    expect(serowe).toMatchObject({ result: 'preferred_withdrawn', canRequestDebrief: false, standstill: null });
    expect(serowe.notices.map((row) => [row.noticeId, row.noticeType])).toEqual([
      [68, 'preferred_bidder'],
      [69, 'preferred_bidder'],
    ]);
    expect(JSON.stringify(serowe)).not.toContain('Limpopo');
    const limpopo = api.getSupplierOutcome.response.parse(
      (await call(LIMPOPO, api.getSupplierOutcome, { tenant: 'limpopo-env', params: { tenderId: 9 } })).body,
    );
    expect(limpopo.lots[0]).toMatchObject({ result: 'preferred_bidder', awardedValue: null });
    expect(limpopo.lots[0]?.reason).toContain('not an award');
    expect(limpopo.notices.map((row) => row.noticeId)).toEqual([70]);
    expect(JSON.stringify(limpopo)).not.toContain('Serowe');
    const request = await call(LIMPOPO, api.requestDebrief, { tenant: 'limpopo-env', params: { tenderId: 9 }, body: {} });
    expect(code(request)).toBe('DEBRIEF_NOT_AVAILABLE');
    const notices = api.listOutcomeNotices.response.parse(
      (await call(TEBOGO, api.listOutcomeNotices, { tenant: 'kwu', params: { tenderId: 9 }, query: { noticeType: 'preferred_bidder' } })).body,
    );
    expect(notices.total).toBe(3);
  });

  it('shows an empty outcome list to a supplier without notices and refuses a contributor', async () => {
    const empty = api.listSupplierOutcomes.response.parse((await call(GABORONE_BID, api.listSupplierOutcomes, { tenant: 'gaborone-meter' })).body);
    expect(empty.total).toBe(0);
    const contributor = await call(TSODILO_CONTRIBUTOR, api.listSupplierOutcomes, { tenant: 'tsodilo' });
    expect(contributor.status).toBe(403);
    const buyer = await call(TEBOGO, api.listSupplierOutcomes, { tenant: 'kwu' });
    expect(code(buyer)).toBe('TENANT_ACCESS_DENIED');
  });

  it('refuses term acceptance to a bid manager without contract authority', async () => {
    const response = await call(TSODILO_BID, api.acceptOutcomeNoticeTerms, { tenant: 'tsodilo', params: { noticeId: 56 }, body: { confirmation: true } });
    expect(response.status).toBe(403);
  });
});

describe('supplier complaints (SUP-22)', () => {
  it('shows Limpopo both of its complaints across buyers and nothing internal', async () => {
    const page = api.listSupplierComplaints.response.parse((await call(LIMPOPO, api.listSupplierComplaints, { tenant: 'limpopo-env' })).body);
    expect(page.items.map((row) => `${row.buyer.slug}:${row.reference}`).sort()).toEqual(['kwu:CMP-2026-0002', 'odc:CMP-2026-0001']);
    const detail = api.getSupplierComplaint.response.parse(
      (await call(LIMPOPO, api.getSupplierComplaint, { tenant: 'limpopo-env', params: { complaintId: 92 } })).body,
    );
    expect(detail.events.every((event) => event.supplierVisible)).toBe(true);
    expect(detail.events.some((event) => event.eventType === 'note')).toBe(false);
  });

  it('never shows one supplier another supplier’s complaint', async () => {
    const response = await call(TSODILO_BID, api.getSupplierComplaint, { tenant: 'tsodilo', params: { complaintId: 92 } });
    expect(response.status).toBe(404);
    const page = api.listSupplierComplaints.response.parse((await call(TSODILO_BID, api.listSupplierComplaints, { tenant: 'tsodilo' })).body);
    expect(page.total).toBe(0);
  });

  it('files a complaint, refuses a duplicate open one and refuses an appeal before a response', async () => {
    const created = await call(TSODILO_BID, api.createComplaint, {
      tenant: 'tsodilo',
      body: { tenderId: 7, subject: 'award', grounds: 'The intended award ignores the published mobilisation limit.' },
    });
    expect(created.status).toBe(201);
    expect(api.createComplaint.response.parse(created.body)).toMatchObject({ reference: 'CMP-2026-0004', status: 'received' });
    const duplicate = await call(LIMPOPO, api.createComplaint, {
      tenant: 'limpopo-env',
      body: { tenderId: 7, subject: 'evaluation', grounds: 'Second complaint about the same evaluation.' },
    });
    expect(code(duplicate)).toBe('DUPLICATE_OPEN_COMPLAINT');
    const appeal = await call(LIMPOPO, api.appealComplaint, {
      tenant: 'limpopo-env',
      params: { complaintId: 92 },
      body: { appealGrounds: 'The decision has not been issued yet but we appeal.' },
    });
    expect(code(appeal)).toBe('APPEAL_NOT_AVAILABLE');
  });

  it('withdraws an open complaint and refuses to withdraw a closed one', async () => {
    const withdrawn = await call(LIMPOPO, api.withdrawComplaint, { tenant: 'limpopo-env', params: { complaintId: 93 }, body: { reason: 'Resolved informally.' } });
    expect(api.withdrawComplaint.response.parse(withdrawn.body).status).toBe('withdrawn');
    const closed = await call(CHOBE_BID, api.withdrawComplaint, { tenant: 'chobe-pipe', params: { complaintId: 91 }, body: { reason: 'x' } });
    expect(code(closed)).toBe('COMPLAINT_ALREADY_CLOSED');
  });
});

describe('public awards (PUB-05)', () => {
  it('lists only published award notices, newest first, without signing in', async () => {
    const response = await app.request('GET', '/api/v1/public/awards');
    const page = api.listPublicAwards.response.parse(response.body);
    expect(page.items.map((row) => row.reference)).toEqual(['T-2026-0001', 'T-2026-0010']);
  });

  it('shows the published detail and its downloadable notice but not the draft T-2026-0007 notice', async () => {
    const detail = await app.request('GET', '/api/v1/public/awards/kwu/T-2026-0001');
    expect(api.getPublicAward.response.parse(detail.body).lots.map((lot) => lot.outcome)).toEqual(['award', 'cancelled', null]);
    const file = await app.request('GET', '/api/v1/public/awards/kwu/T-2026-0001/notice');
    expect(api.downloadPublicAwardNotice.response.parse(file.body).content).toContain('T-2026-0001');
    expect((await app.request('GET', '/api/v1/public/awards/kwu/T-2026-0007')).status).toBe(404);
    expect((await app.request('GET', '/api/v1/public/awards/odc/T-2026-0001')).status).toBe(404);
  });

  it('filters public awards by buyer and outcome', async () => {
    const cancelled = api.listPublicAwards.response.parse(
      (await app.request('GET', '/api/v1/public/awards', { query: { outcome: 'cancelled' } })).body,
    );
    expect(cancelled.items.map((row) => row.reference)).toEqual(['T-2026-0001']);
    const odc = api.listPublicAwards.response.parse((await app.request('GET', '/api/v1/public/awards', { query: { buyerSlug: 'odc' } })).body);
    expect(odc.total).toBe(0);
  });
});

describe('every read endpoint answers with a contract-valid body', () => {
  it('serves every buyer read for the tender owner and the auditor', async () => {
    const reads: [AnyEndpoint, CallOptions][] = [
      [api.getRecommendation, { params: { recommendationId: 14902 } }],
      [api.getOutcomeNotice, { params: { noticeId: 57 } }],
      [api.getPublicNotice, { params: { tenderId: 7 } }],
      [api.getDebrief, { params: { debriefId: 82 } }],
      [api.getCloseout, { params: { tenderId: 1 } }],
    ];
    for (const email of [TEBOGO, PULE]) {
      for (const tenderId of [1, 3, 4, 7, 9, 10]) {
        expect((await call(email, api.getAwardOverview, { tenant: 'kwu', params: { tenderId } })).status).toBe(200);
        expect((await call(email, api.getStandstill, { tenant: 'kwu', params: { tenderId } })).status).toBe(200);
        expect((await call(email, api.listOutcomeNotices, { tenant: 'kwu', params: { tenderId } })).status).toBe(200);
        expect((await call(email, api.getCloseout, { tenant: 'kwu', params: { tenderId } })).status).toBe(200);
      }
      for (const [endpoint, options] of reads) {
        expect((await call(email, endpoint, { tenant: 'kwu', ...options })).status).toBe(200);
      }
    }
    for (const complaintId of [91, 92, 94]) {
      expect((await call(DINEO, api.getComplaint, { tenant: 'kwu', params: { complaintId } })).status).toBe(200);
    }
    expect(app.logs.some((line) => line.includes('drift'))).toBe(false);
  });

  it('serves every supplier outcome to its own supplier', async () => {
    const pairs: [string, string, number][] = [
      [TSODILO_BID, 'tsodilo', 1],
      [TSODILO_BID, 'tsodilo', 10],
      [CHOBE_BID, 'chobe-pipe', 1],
      [MAKGADIKGADI, 'makgadikgadi', 10],
    ];
    for (const [email, tenant, tenderId] of pairs) {
      expect((await call(email, api.getSupplierOutcome, { tenant, params: { tenderId } })).status).toBe(200);
    }
    expect((await call(CHOBE_BID, api.getSupplierOutcome, { tenant: 'chobe-pipe', params: { tenderId: 10 } })).status).toBe(404);
  });
});
