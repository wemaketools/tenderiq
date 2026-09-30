/**
 * Selection mock handlers with REAL authentication (DD-43): tenant filtering, permission and tenant-kind denials,
 * supplier isolation (DD-03, PRD §4.3) and the business errors the fixtures imply (AC-21..AC-24, BR-30, BR-31).
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { Problem } from '../../../contracts/common.js';
import { selectionEndpoints as E } from '../../../contracts/selection.js';
import { createTestMockApp } from '../../testing/index.js';
import type { TestMockApp, TestResponse } from '../../testing/index.js';

const OFFICER = 'tebogo.officer@tenderiq.local';
const MANAGER = 'mpho.manager@tenderiq.local';
const AUDITOR = 'pule.auditor@tenderiq.local';
const EVALUATOR = 'thato.eval@tenderiq.local';
const KWU_ADMIN = 'admin.kwu@tenderiq.local';
const ODC_OFFICER = 'officer.odc@tenderiq.local';
const SUPPORT = 'support.agent@tenderiq.local';
const LIMPOPO = 'limpopo-env.admin@tenderiq.local';
const SEROWE = 'serowe-ict.bidmanager@tenderiq.local';
const TSODILO_ADMIN = 'tsodilo.admin@tenderiq.local';
const TSODILO_BID = 'tsodilo.bidmanager@tenderiq.local';
const TSODILO_CONTRIBUTOR = 'tsodilo.contributor@tenderiq.local';
const CHOBE = 'chobe-pipe.bidmanager@tenderiq.local';
const GABORONE = 'gaborone-meter.admin@tenderiq.local';

let api: TestMockApp;

beforeAll(async () => {
  api = await createTestMockApp();
});

function problemCode(response: TestResponse): string | undefined {
  return Problem.parse(response.body).code;
}

function expectProblem(response: TestResponse, status: number, code: string): void {
  expect(response.status).toBe(status);
  expect(problemCode(response)).toBe(code);
}

describe('module registration', () => {
  it('loads the selection module and registers every contract endpoint', () => {
    expect(api.loaded).toContain('selection/index');
    expect(api.failed.map((failure) => failure.module)).not.toContain('selection/index');
    expect(api.endpointIds).toEqual(expect.arrayContaining(Object.values(E).map((endpoint) => endpoint.id)));
  });
});

describe('buyer tenant filtering', () => {
  it('returns KWU’s selection tenders to the KWU officer with their gates', async () => {
    // Act
    const response = await api.callAs(OFFICER, E.listTenders, { tenant: 'kwu' });

    // Assert
    expect(response.status).toBe(200);
    const page = E.listTenders.response.parse(response.body);
    expect(page.items.map((row) => row.reference).sort()).toEqual(['T-2026-0001', 'T-2026-0009']);
    expect(page.total).toBe(2);
  });

  it('returns an empty register to the ODC officer and hides KWU records as not found', async () => {
    const list = await api.callAs(ODC_OFFICER, E.listShortlists, { tenant: 'odc' });
    expect(E.listShortlists.response.parse(list.body)).toMatchObject({ items: [], total: 0 });

    const detail = await api.callAs(ODC_OFFICER, E.getShortlist, { tenant: 'odc', params: { shortlistId: 9 } });
    expectProblem(detail, 404, 'NOT_FOUND');
  });

  it('refuses another buyer’s tenant header with the identical 403', async () => {
    const response = await api.callAs(OFFICER, E.listTenders, { tenant: 'odc' });
    expectProblem(response, 403, 'TENANT_ACCESS_DENIED');
  });

  it('filters sessions by type and status and paginates', async () => {
    const response = await api.callAs(OFFICER, E.listSessions, {
      tenant: 'kwu',
      query: { status: ['scheduled', 'planned'], pageSize: 2 },
    });
    const page = E.listSessions.response.parse(response.body);
    expect(page.total).toBe(3);
    expect(page.items).toHaveLength(2);
    expect(page.items.every((row) => row.status === 'scheduled' || row.status === 'planned')).toBe(true);
  });

  it('shows the award, negotiation and final-offer gates of T-2026-0009 (AC-23, AC-24)', async () => {
    const response = await api.callAs(OFFICER, E.getTender, { tenant: 'kwu', params: { tenderId: 9 } });
    const summary = E.getTender.response.parse(response.body);
    expect(summary.gates.finalOffer.blockers.map((row) => row.code)).toEqual(['BAFO_NOT_PERMITTED', 'PROCESS_DECISION_REQUIRED']);
    expect(summary.gates.award.allowed).toBe(false);
    expect(summary.gates.award.blockers.map((row) => row.code)).toContain('DILIGENCE_NOT_PASSED');
    expect(summary.candidates.find((row) => row.bid.bidId === 909)?.shortlisted).toBe(false);
  });
});

describe('permissions and tenant kinds', () => {
  it('forbids the organization administrator and an operator under a support grant', async () => {
    expectProblem(await api.callAs(KWU_ADMIN, E.listPreferredBidders, { tenant: 'kwu' }), 403, 'FORBIDDEN');
    expectProblem(await api.callAs(SUPPORT, E.listPreferredBidders, { tenant: 'kwu' }), 403, 'FORBIDDEN');
  });

  it('lets an evaluator read assessment sessions but not preferred bidders or diligence', async () => {
    expect((await api.callAs(EVALUATOR, E.listSessions, { tenant: 'kwu' })).status).toBe(200);
    expectProblem(await api.callAs(EVALUATOR, E.listDiligenceCases, { tenant: 'kwu' }), 403, 'FORBIDDEN');
  });

  it('lets the auditor read, restricts confidential reference feedback, and forbids commands', async () => {
    // Act
    const response = await api.callAs(AUDITOR, E.listReferenceChecks, { tenant: 'kwu' });
    const page = E.listReferenceChecks.response.parse(response.body);

    // Assert
    const confidential = page.items.find((row) => row.referenceCheckId === 1);
    expect(confidential).toMatchObject({ feedback: null, feedbackRestricted: true });
    expect(page.items.find((row) => row.referenceCheckId === 2)?.feedback).not.toBeNull();
    const command = await api.callAs(AUDITOR, E.cancelSession, {
      tenant: 'kwu',
      params: { sessionId: 5 },
      body: { reason: 'Not needed' },
    });
    expectProblem(command, 403, 'FORBIDDEN');
  });

  it('refuses a supplier on a buyer endpoint and a buyer on a supplier endpoint', async () => {
    expect((await api.callAs(LIMPOPO, E.listTenders, { tenant: 'limpopo-env' })).status).toBe(403);
    expect((await api.callAs(OFFICER, E.listSupplierInvites, { tenant: 'kwu' })).status).toBe(403);
  });

  it('forbids a supplier contributor from negotiation records and from answering invitations', async () => {
    expectProblem(await api.callAs(TSODILO_CONTRIBUTOR, E.listSupplierNegotiations, { tenant: 'tsodilo' }), 403, 'FORBIDDEN');
    const respond = await api.callAs(TSODILO_CONTRIBUTOR, E.respondToInvite, {
      tenant: 'tsodilo',
      params: { inviteId: 6 },
      body: { response: 'declined' },
    });
    expectProblem(respond, 403, 'FORBIDDEN');
  });
});

describe('supplier isolation (SUP-18, SUP-19)', () => {
  it('shows each supplier only its own assessment invitations', async () => {
    const cases: ReadonlyArray<[string, string, number[]]> = [
      [LIMPOPO, 'limpopo-env', [2, 4, 5, 9]],
      [SEROWE, 'serowe-ict', [1, 3, 8]],
      [TSODILO_CONTRIBUTOR, 'tsodilo', [6]],
      [CHOBE, 'chobe-pipe', [7]],
      [GABORONE, 'gaborone-meter', [10]],
    ];
    for (const [email, tenant, expected] of cases) {
      const response = await api.callAs(email, E.listSupplierInvites, { tenant });
      const page = E.listSupplierInvites.response.parse(response.body);
      expect(page.items.map((row) => row.inviteId).sort((a, b) => a - b)).toEqual(expected);
    }
  });

  it('shows Limpopo its mandated negotiation with supplier-visible rounds and never the planned variant one', async () => {
    const list = E.listSupplierNegotiations.response.parse(
      (await api.callAs(LIMPOPO, E.listSupplierNegotiations, { tenant: 'limpopo-env' })).body,
    );
    expect(list.items.map((row) => row.negotiationId)).toEqual([2]);
    expect(list.items[0]?.awaitingResponse).toBe(true);

    const detail = E.getSupplierNegotiation.response.parse(
      (await api.callAs(LIMPOPO, E.getSupplierNegotiation, { tenant: 'limpopo-env', params: { negotiationId: 2 } })).body,
    );
    expect(detail.rounds.map((row) => row.roundNo)).toEqual([1, 2]);
    expect(detail.finalOfferRounds).toEqual([]);
    expectProblem(
      await api.callAs(LIMPOPO, E.getSupplierNegotiation, { tenant: 'limpopo-env', params: { negotiationId: 3 } }),
      404,
      'NOT_FOUND',
    );
  });

  it('never shows one supplier another supplier’s negotiation', async () => {
    expectProblem(
      await api.callAs(SEROWE, E.getSupplierNegotiation, { tenant: 'serowe-ict', params: { negotiationId: 2 } }),
      404,
      'NOT_FOUND',
    );
    const tsodilo = E.listSupplierNegotiations.response.parse(
      (await api.callAs(TSODILO_BID, E.listSupplierNegotiations, { tenant: 'tsodilo' })).body,
    );
    expect(tsodilo.total).toBe(0);
  });

  it('never shows a draft final-offer round to its invitee', async () => {
    const page = E.listSupplierFinalOffers.response.parse(
      (await api.callAs(LIMPOPO, E.listSupplierFinalOffers, { tenant: 'limpopo-env' })).body,
    );
    expect(page.total).toBe(0);
    expectProblem(
      await api.callAs(LIMPOPO, E.getSupplierFinalOffer, { tenant: 'limpopo-env', params: { roundId: 1 } }),
      404,
      'NOT_FOUND',
    );
  });
});

describe('issued final-offer round (SUP-19, BR-30)', () => {
  it('shows each invited supplier the issued Lot 3 round with instructions, the official deadline and its own response link', async () => {
    // Act
    const list = E.listSupplierFinalOffers.response.parse(
      (await api.callAs(TSODILO_BID, E.listSupplierFinalOffers, { tenant: 'tsodilo' })).body,
    );
    const detail = E.getSupplierFinalOffer.response.parse(
      (await api.callAs(TSODILO_BID, E.getSupplierFinalOffer, { tenant: 'tsodilo', params: { roundId: 2 } })).body,
    );
    const chobe = E.getSupplierFinalOffer.response.parse(
      (await api.callAs(CHOBE, E.getSupplierFinalOffer, { tenant: 'chobe-pipe', params: { roundId: 2 } })).body,
    );

    // Assert
    expect(list.items.map((row) => row.roundId)).toEqual([2]);
    expect(detail).toMatchObject({
      status: 'issued',
      tender: { reference: 'T-2026-0001' },
      deadline: { at: '2026-10-16T08:00:00Z', timeZone: 'Africa/Gaborone' },
      finalOfferReceivedAt: null,
      responseWorkspaceLink: '/supplier/responses/1',
    });
    expect(detail.instructions.length).toBeGreaterThan(0);
    expect(chobe.responseWorkspaceLink).toBe('/supplier/responses/2');
  });

  it('hides the round from a supplier that was not invited', async () => {
    expectProblem(
      await api.callAs(SEROWE, E.getSupplierFinalOffer, { tenant: 'serowe-ict', params: { roundId: 2 } }),
      404,
      'NOT_FOUND',
    );
  });

  it('authorizes the round on T-2026-0001 by the approved reopen decision and refuses a second open round', async () => {
    const summary = E.getTender.response.parse(
      (await api.callAs(OFFICER, E.getTender, { tenant: 'kwu', params: { tenderId: 1 } })).body,
    );
    expect(summary.gates.finalOffer.allowed).toBe(true);
    expectProblem(
      await api.callAs(OFFICER, E.createFinalOfferRound, {
        tenant: 'kwu',
        body: {
          tenderId: 1,
          lotId: 103,
          instructions: 'Submit a final offer',
          permittedChanges: 'Prices only',
          deadline: '2026-12-01T08:00:00Z',
          openingRules: 'Opened with a witness',
          evaluationTreatment: 'Commercial score only',
          proceduralAuthorityRef: 'Approved reopen decision',
          inviteeBidIds: [104, 105],
        },
      }),
      409,
      'FINAL_OFFER_ROUND_OPEN',
    );
  });
});

describe('supplier commands', () => {
  it('confirms an open invitation and refuses one whose session was cancelled or already answered', async () => {
    const confirmed = await api.callAs(LIMPOPO, E.respondToInvite, {
      tenant: 'limpopo-env',
      params: { inviteId: 5 },
      body: { response: 'confirmed' },
    });
    expect(confirmed.status).toBe(200);
    expect(E.respondToInvite.response.parse(confirmed.body)).toMatchObject({ status: 'confirmed', respondGate: { allowed: false } });

    const cancelled = await api.callAs(GABORONE, E.respondToInvite, {
      tenant: 'gaborone-meter',
      params: { inviteId: 10 },
      body: { response: 'confirmed' },
    });
    expectProblem(cancelled, 409, 'SESSION_CANCELLED');

    const answered = await api.callAs(TSODILO_BID, E.respondToInvite, {
      tenant: 'tsodilo',
      params: { inviteId: 6 },
      body: { response: 'declined' },
    });
    expectProblem(answered, 409, 'INVITE_NOT_OPEN');
  });

  it('sends the internally approved response to the open round only', async () => {
    const body = { supplierProposal: 'Service credits capped at 6%; 15 working days’ notice.', internalApprovalConfirmed: true };
    const open = await api.callAs(LIMPOPO, E.respondToRound, {
      tenant: 'limpopo-env',
      params: { negotiationId: 2, roundId: 2 },
      body,
    });
    expect(open.status).toBe(200);
    expect(E.respondToRound.response.parse(open.body)).toMatchObject({ awaitingResponse: false });
    expect(E.respondToRound.response.parse(open.body).supplierResponseAt).not.toBeNull();

    const closed = await api.callAs(LIMPOPO, E.respondToRound, {
      tenant: 'limpopo-env',
      params: { negotiationId: 2, roundId: 1 },
      body,
    });
    expectProblem(closed, 409, 'ROUND_NOT_AWAITING_RESPONSE');
  });

  it('refuses a round response from the supplier administrator or a bid manager without submission authority', async () => {
    // Arrange
    const body = { supplierProposal: 'Service credits capped at 6%.', internalApprovalConfirmed: true };

    // Act
    const byAdmin = await api.callAs(TSODILO_ADMIN, E.respondToRound, {
      tenant: 'tsodilo',
      params: { negotiationId: 2, roundId: 2 },
      body,
    });
    const byBidManager = await api.callAs(TSODILO_BID, E.respondToRound, {
      tenant: 'tsodilo',
      params: { negotiationId: 2, roundId: 2 },
      body,
    });

    // Assert
    expectProblem(byAdmin, 403, 'FORBIDDEN');
    expectProblem(byBidManager, 403, 'FORBIDDEN');
  });
});

describe('assessment sessions and references (AC-21)', () => {
  it('plans a demonstration with its declared basis and refuses a scored session without a criterion', async () => {
    const body = {
      tenderId: 9,
      sessionType: 'presentation',
      purpose: 'Stage-two data platform presentation',
      agenda: '30 minutes presentation, 15 minutes standard questions',
      assessmentBasis: 'scored_criterion',
      criterionId: 9506,
      instructions: 'Same five questions for every candidate',
      preparationDays: 7,
    };
    const created = await api.callAs(OFFICER, E.createSession, { tenant: 'kwu', body });
    expect(created.status).toBe(201);
    expect(E.createSession.response.parse(created.body)).toMatchObject({ status: 'planned', equalTreatmentConfirmed: false });

    const invalid = await api.callAs(OFFICER, E.createSession, { tenant: 'kwu', body: { ...body, criterionId: null } });
    expect(invalid.status).toBe(422);
    expect(Problem.parse(invalid.body).errors).toEqual([expect.objectContaining({ field: 'criterionId', code: 'CRITERION_REQUIRED' })]);

    const notInPlan = await api.callAs(OFFICER, E.createSession, { tenant: 'kwu', body: { ...body, criterionId: 1501 } });
    expectProblem(notInPlan, 422, 'CRITERION_NOT_IN_PLAN');
  });

  it('refuses a reference-check session where the procedure has none', async () => {
    const response = await api.callAs(OFFICER, E.createSession, {
      tenant: 'kwu',
      body: {
        tenderId: 1,
        lotId: 103,
        sessionType: 'reference_check',
        purpose: 'Verify references',
        agenda: 'Calls',
        assessmentBasis: 'claim_verification',
        instructions: 'Provide referees',
        preparationDays: 5,
      },
    });
    expectProblem(response, 409, 'SESSION_TYPE_NOT_PERMITTED');
  });

  it('confirms equal treatment once and requires it before invitations', async () => {
    expect((await api.callAs(OFFICER, E.confirmEqualTreatment, { tenant: 'kwu', params: { sessionId: 5 }, body: { confirmed: true } })).status).toBe(200);
    expectProblem(
      await api.callAs(OFFICER, E.confirmEqualTreatment, { tenant: 'kwu', params: { sessionId: 3 }, body: { confirmed: true } }),
      409,
      'EQUAL_TREATMENT_ALREADY_CONFIRMED',
    );
    expectProblem(
      await api.callAs(OFFICER, E.issueInvites, {
        tenant: 'kwu',
        params: { sessionId: 5 },
        body: { invites: [{ bidId: 104, scheduledAt: '2026-12-01T06:00:00Z' }] },
      }),
      409,
      'EQUAL_TREATMENT_NOT_CONFIRMED',
    );
  });

  it('refuses invitations outside the eligible scope or duplicated', async () => {
    expectProblem(
      await api.callAs(OFFICER, E.issueInvites, {
        tenant: 'kwu',
        params: { sessionId: 3 },
        body: { invites: [{ bidId: 909, scheduledAt: '2026-12-01T06:00:00Z' }] },
      }),
      409,
      'BID_NOT_ELIGIBLE',
    );
    expectProblem(
      await api.callAs(OFFICER, E.issueInvites, {
        tenant: 'kwu',
        params: { sessionId: 4 },
        body: { invites: [{ bidId: 104, scheduledAt: '2026-12-01T06:00:00Z' }] },
      }),
      409,
      'ALREADY_INVITED',
    );
  });

  it('records a finding only with an effect of the announced basis', async () => {
    const wrongEffect = await api.callAs(EVALUATOR, E.recordFinding, {
      tenant: 'kwu',
      params: { sessionId: 4 },
      body: { bidId: 104, finding: 'Panel polled without loss', effect: 'score_input' },
    });
    expectProblem(wrongEffect, 422, 'FINDING_EFFECT_NOT_ALLOWED');

    const recorded = await api.callAs(EVALUATOR, E.recordFinding, {
      tenant: 'kwu',
      params: { sessionId: 4 },
      body: { bidId: 104, finding: 'Panel polled without loss for 4 hours', effect: 'gate_passed' },
    });
    expect(recorded.status).toBe(201);
    expect(E.recordFinding.response.parse(recorded.body)).toMatchObject({ effect: 'gate_passed', assessor: { userId: 11 } });

    expectProblem(
      await api.callAs(OFFICER, E.recordFinding, {
        tenant: 'kwu',
        params: { sessionId: 3 },
        body: { bidId: 908, finding: 'Engineer available', effect: 'claim_verified' },
      }),
      409,
      'BID_NOT_INVITED',
    );
    expectProblem(
      await api.callAs(OFFICER, E.recordFinding, {
        tenant: 'kwu',
        params: { sessionId: 1 },
        body: { bidId: 907, finding: 'Late note', effect: 'score_input' },
      }),
      409,
      'SESSION_NOT_OPEN_FOR_FINDINGS',
    );
  });

  it('refuses to complete a session with missing findings or to cancel a completed one', async () => {
    expectProblem(
      await api.callAs(OFFICER, E.completeSession, { tenant: 'kwu', params: { sessionId: 4 }, body: { summary: 'Done' } }),
      409,
      'FINDINGS_INCOMPLETE',
    );
    expectProblem(
      await api.callAs(OFFICER, E.cancelSession, { tenant: 'kwu', params: { sessionId: 1 }, body: { reason: 'Duplicate' } }),
      409,
      'SESSION_NOT_EDITABLE',
    );
  });

  it('refuses reference feedback without consent or twice, and references where none are permitted', async () => {
    const feedback = { contactedAt: '2026-09-30T07:00:00Z', feedback: 'Good work', outcome: 'Verified' };
    expectProblem(
      await api.callAs(OFFICER, E.recordReferenceFeedback, { tenant: 'kwu', params: { referenceCheckId: 4 }, body: feedback }),
      409,
      'REFERENCE_CONSENT_REQUIRED',
    );
    expectProblem(
      await api.callAs(OFFICER, E.recordReferenceFeedback, { tenant: 'kwu', params: { referenceCheckId: 1 }, body: feedback }),
      409,
      'REFERENCE_FEEDBACK_RECORDED',
    );
    expectProblem(
      await api.callAs(OFFICER, E.createReferenceCheck, {
        tenant: 'kwu',
        body: { bidId: 104, refereeName: 'A Referee', refereeOrganization: 'Council', consentConfirmed: true, confidential: false },
      }),
      409,
      'REFERENCES_NOT_PERMITTED',
    );
  });
});

describe('shortlists (AC-22)', () => {
  const entries = [
    { bidId: 907, included: true, rank: 1, reason: 'Meets threshold' },
    { bidId: 908, included: true, rank: 2, reason: 'Meets threshold' },
    { bidId: 909, included: false, reason: 'Below threshold' },
  ];

  it('refuses duplicate notices and edits of an approved shortlist, and changes it with a reason', async () => {
    expectProblem(
      await api.callAs(OFFICER, E.notifyShortlist, { tenant: 'kwu', params: { shortlistId: 9 }, body: { confirmed: true } }),
      409,
      'OUTCOME_NOTICES_ALREADY_ISSUED',
    );
    const body = { selectionRule: 'Top two', threshold: '49.00', rationale: 'Scores signed off', entries };
    expectProblem(await api.callAs(OFFICER, E.updateShortlist, { tenant: 'kwu', params: { shortlistId: 9 }, body }), 409, 'SHORTLIST_NOT_EDITABLE');

    const changed = await api.callAs(OFFICER, E.changeShortlist, {
      tenant: 'kwu',
      params: { shortlistId: 9 },
      body: { ...body, changeReason: 'Correct the recorded rule wording' },
    });
    expect(changed.status).toBe(200);
    expect(E.changeShortlist.response.parse(changed.body)).toMatchObject({ status: 'changed', approval: null, notifiedAt: null });
  });

  it('refuses a change that includes a candidate below the threshold or omits one', async () => {
    const base = { selectionRule: 'Top two', threshold: '49.00', rationale: 'Scores signed off', changeReason: 'Review' };
    expectProblem(
      await api.callAs(OFFICER, E.changeShortlist, {
        tenant: 'kwu',
        params: { shortlistId: 9 },
        body: { ...base, entries: entries.map((entry) => ({ ...entry, included: true, rank: 3 })) },
      }),
      422,
      'INCLUDED_BELOW_THRESHOLD',
    );
    expectProblem(
      await api.callAs(OFFICER, E.changeShortlist, { tenant: 'kwu', params: { shortlistId: 9 }, body: { ...base, entries: entries.slice(0, 2) } }),
      422,
      'CANDIDATE_MISSING',
    );
  });

  it('refuses a second shortlist for the same stage and drafts one for another scope', async () => {
    const body = { tenderId: 9, stageNo: 1, selectionRule: 'Top two', threshold: '49.00', rationale: 'Signed-off scores' };
    expectProblem(await api.callAs(OFFICER, E.createShortlist, { tenant: 'kwu', body }), 409, 'SHORTLIST_EXISTS');
    const created = await api.callAs(OFFICER, E.createShortlist, { tenant: 'kwu', body: { ...body, tenderId: 1, lotId: 103 } });
    expect(created.status).toBe(201);
    expect(E.createShortlist.response.parse(created.body)).toMatchObject({ status: 'draft', notifyGate: { allowed: false } });
  });
});

describe('preferred bidders and due diligence (BR-31, AC-24)', () => {
  it('refuses a second active preferred bidder and recommends a conditional one elsewhere', async () => {
    const body = {
      tenderId: 9,
      bidId: 908,
      scope: 'Surveys',
      proposedValue: { amount: '2940000.00', currency: 'BWP' },
      rationale: 'Second ranked',
      remainingChecks: 'Insurance',
      negotiationTopics: ['Service credits'],
      decisionOwnerUserId: 4,
      contingencyPlan: 'New competition',
      fallbackBidId: null,
    };
    expectProblem(await api.callAs(OFFICER, E.recommendPreferredBidder, { tenant: 'kwu', body }), 409, 'PREFERRED_BIDDER_ACTIVE');

    const other = await api.callAs(OFFICER, E.recommendPreferredBidder, {
      tenant: 'kwu',
      body: { ...body, tenderId: 1, lotId: 103, bidId: 104, fallbackBidId: 105 },
    });
    expect(other.status).toBe(201);
    expect(E.recommendPreferredBidder.response.parse(other.body)).toMatchObject({ status: 'proposed', approval: null });

    expectProblem(
      await api.callAs(OFFICER, E.recommendPreferredBidder, {
        tenant: 'kwu',
        body: { ...body, tenderId: 1, lotId: 103, bidId: 104, fallbackBidId: null, decisionOwnerUserId: 22 },
      }),
      422,
      'DECISION_OWNER_NOT_ELIGIBLE',
    );
  });

  it('keeps the recorded fallback and refuses one where the preferred bidder is still active', async () => {
    const body = { reason: 'Failed diligence', fallbackBidId: 908, contingencyFollowed: true };
    expectProblem(
      await api.callAs(OFFICER, E.recordFallback, { tenant: 'kwu', params: { preferredBidderId: 1 }, body }),
      409,
      'FALLBACK_ALREADY_RECORDED',
    );
    expectProblem(
      await api.callAs(OFFICER, E.recordFallback, { tenant: 'kwu', params: { preferredBidderId: 2 }, body }),
      409,
      'FALLBACK_NOT_AVAILABLE',
    );
    expectProblem(
      await api.callAs(OFFICER, E.withdrawPreferredBidder, { tenant: 'kwu', params: { preferredBidderId: 1 }, body: { reason: 'Test' } }),
      409,
      'PREFERRED_BIDDER_NOT_ACTIVE',
    );
  });

  it('refuses to pass a case with unresolved findings and blocks the award when it fails', async () => {
    const pass = await api.callAs(MANAGER, E.decideDiligenceCase, {
      tenant: 'kwu',
      params: { caseId: 2 },
      body: { outcome: 'passed', decisionNote: 'All clear' },
    });
    expectProblem(pass, 409, 'DILIGENCE_FINDINGS_UNRESOLVED');

    const fail = await api.callAs(MANAGER, E.decideDiligenceCase, {
      tenant: 'kwu',
      params: { caseId: 2 },
      body: { outcome: 'failed', decisionNote: 'Insurance could not be verified' },
    });
    expect(fail.status).toBe(200);
    const detail = E.decideDiligenceCase.response.parse(fail.body);
    expect(detail.status).toBe('failed');
    expect(detail.preferredBidder.status).toBe('failed_diligence');
    expect(detail.awardGate.blockers.map((row) => row.code)).toEqual(['DILIGENCE_FAILED', 'FALLBACK_DECISION_REQUIRED']);
    expect(detail.awardGate.blockers[0]?.message).toContain('Limpopo Environmental Services');
  });

  it('puts the bidder’s failed due diligence first in the award gate of its preferred-bidder record and case (AC-24)', async () => {
    // Act
    const preferred = E.getPreferredBidder.response.parse(
      (await api.callAs(OFFICER, E.getPreferredBidder, { tenant: 'kwu', params: { preferredBidderId: 1 } })).body,
    );
    const diligence = E.getDiligenceCase.response.parse(
      (await api.callAs(OFFICER, E.getDiligenceCase, { tenant: 'kwu', params: { caseId: 1 } })).body,
    );

    // Assert
    for (const awardGate of [preferred.awardGate, diligence.awardGate]) {
      expect(awardGate.allowed).toBe(false);
      expect(awardGate.blockers[0]).toEqual({
        code: 'DILIGENCE_FAILED',
        message: 'Serowe ICT Solutions (Pty) Ltd failed due diligence on financial position; no award can be made to this bidder.',
      });
    }
    const current = E.getPreferredBidder.response.parse(
      (await api.callAs(OFFICER, E.getPreferredBidder, { tenant: 'kwu', params: { preferredBidderId: 2 } })).body,
    );
    expect(current.awardGate.blockers.map((row) => row.code)).not.toContain('DILIGENCE_FAILED');
  });

  it('accepts a finding owner holding diligence.manage and refuses a team member without it', async () => {
    const finding = { area: 'insurance', finding: 'Insurer letter pending', disposition: 'condition', isAwardBlocking: true, dueAt: '2026-12-01T13:00:00Z' };
    expectProblem(
      await api.callAs(OFFICER, E.recordDiligenceFinding, { tenant: 'kwu', params: { caseId: 2 }, body: { ...finding, ownerUserId: 11 } }),
      422,
      'FINDING_OWNER_NOT_ELIGIBLE',
    );
    const accepted = await api.callAs(OFFICER, E.recordDiligenceFinding, {
      tenant: 'kwu',
      params: { caseId: 2 },
      body: { ...finding, ownerUserId: 5 },
    });
    expect(accepted.status).toBe(201);
    expect(E.recordDiligenceFinding.response.parse(accepted.body).owner?.fullName).toBe('Tebogo Molefe');
  });

  it('refuses findings on a decided case, owners outside the organization and past due dates', async () => {
    const finding = { area: 'insurance', finding: 'Certificate received', disposition: 'satisfied', isAwardBlocking: false };
    expectProblem(
      await api.callAs(OFFICER, E.recordDiligenceFinding, { tenant: 'kwu', params: { caseId: 1 }, body: finding }),
      409,
      'CASE_DECIDED',
    );
    expectProblem(
      await api.callAs(OFFICER, E.recordDiligenceFinding, {
        tenant: 'kwu',
        params: { caseId: 2 },
        body: { ...finding, disposition: 'condition', ownerUserId: 29, dueAt: '2026-12-01T13:00:00Z' },
      }),
      422,
      'FINDING_OWNER_NOT_ELIGIBLE',
    );
    expectProblem(
      await api.callAs(OFFICER, E.requestDiligenceEvidence, {
        tenant: 'kwu',
        params: { caseId: 2 },
        body: { question: 'Send the certificate', permittedScope: 'Certificate only', dueAt: '2026-01-01T10:00:00Z' },
      }),
      422,
      'DUE_DATE_IN_PAST',
    );
    const recorded = await api.callAs(OFFICER, E.recordDiligenceFinding, { tenant: 'kwu', params: { caseId: 2 }, body: finding });
    expect(recorded.status).toBe(201);
  });
});

describe('negotiation and final offers (BR-30, AC-23)', () => {
  const mandate = {
    tenderId: 9,
    allowedTopics: ['Service credits'],
    authorizedNegotiatorIds: [5],
    commercialAuthority: { amount: '2600000.00', currency: 'BWP' },
  };

  it('refuses negotiation on the variant and a second negotiation with the preferred bidder', async () => {
    expectProblem(
      await api.callAs(OFFICER, E.openNegotiation, { tenant: 'kwu', body: { ...mandate, bidId: 910 } }),
      409,
      'NEGOTIATION_NOT_PERMITTED',
    );
    expectProblem(
      await api.callAs(OFFICER, E.openNegotiation, { tenant: 'kwu', body: { ...mandate, bidId: 908 } }),
      409,
      'NEGOTIATION_EXISTS',
    );
    expectProblem(
      await api.callAs(OFFICER, E.openNegotiation, { tenant: 'kwu', body: { ...mandate, tenderId: 1, bidId: 104 } }),
      409,
      'NEGOTIATION_NOT_PERMITTED',
    );
  });

  it('records a round within the mandate and refuses topics outside it or a round without a mandate', async () => {
    const round = {
      meetingAt: '2026-10-06T06:00:00Z',
      participants: 'KWU and Limpopo',
      topics: ['Service credits'],
      minutes: 'Discussed the cap.',
      supplierVisible: true,
    };
    const recorded = await api.callAs(OFFICER, E.recordNegotiationRound, { tenant: 'kwu', params: { negotiationId: 2 }, body: round });
    expect(recorded.status).toBe(201);
    expect(E.recordNegotiationRound.response.parse(recorded.body)).toMatchObject({ roundNo: 3, topics: ['Service credits'] });

    expectProblem(
      await api.callAs(OFFICER, E.recordNegotiationRound, {
        tenant: 'kwu',
        params: { negotiationId: 2 },
        body: { ...round, topics: ['Unit prices'] },
      }),
      422,
      'TOPIC_NOT_AUTHORIZED',
    );
    const planned = await api.callAs(OFFICER, E.recordNegotiationRound, { tenant: 'kwu', params: { negotiationId: 3 }, body: round });
    expect(planned.status).toBe(409);
    expect(['NEGOTIATION_NOT_ACTIVE', 'MANDATE_NOT_APPROVED']).toContain(problemCode(planned));
  });

  it('requires a process decision to conclude with a change to the basis of competition', async () => {
    expectProblem(
      await api.callAs(OFFICER, E.concludeNegotiation, {
        tenant: 'kwu',
        params: { negotiationId: 2 },
        body: { outcomeSummary: 'Scope reduced', affectsCompetitionBasis: true },
      }),
      409,
      'PROCESS_DECISION_REQUIRED',
    );
  });

  it('blocks the final-offer round where the conditions provide none (AC-23)', async () => {
    expectProblem(
      await api.callAs(OFFICER, E.issueFinalOfferRound, { tenant: 'kwu', params: { roundId: 1 }, body: { confirmed: true } }),
      409,
      'BAFO_NOT_PERMITTED',
    );
    expectProblem(
      await api.callAs(OFFICER, E.createFinalOfferRound, {
        tenant: 'kwu',
        body: {
          tenderId: 9,
          instructions: 'Submit a final offer',
          permittedChanges: 'Rates only',
          deadline: '2026-12-01T08:00:00Z',
          openingRules: 'Opened with a witness',
          evaluationTreatment: 'Commercial score only',
          proceduralAuthorityRef: 'None',
          inviteeBidIds: [908],
        },
      }),
      409,
      'BAFO_NOT_PERMITTED',
    );
    expectProblem(
      await api.callAs(OFFICER, E.proposeProcessDecision, {
        tenant: 'kwu',
        body: { tenderId: 9, decisionType: 'reopen_round', reason: 'Seek authority again' },
      }),
      409,
      'PROCESS_DECISION_PENDING',
    );
  });

  it('refuses a negotiator who does not hold negotiation.conduct (NEGOTIATOR_NOT_ELIGIBLE)', async () => {
    expectProblem(
      await api.callAs(OFFICER, E.openNegotiation, { tenant: 'kwu', body: { ...mandate, bidId: 908, authorizedNegotiatorIds: [5, 11] } }),
      422,
      'NEGOTIATOR_NOT_ELIGIBLE',
    );
  });

  it('returns the topics each recorded round covered', async () => {
    const response = await api.callAs(OFFICER, E.getNegotiation, { tenant: 'kwu', params: { negotiationId: 2 } });
    const detail = E.getNegotiation.response.parse(response.body);
    expect(detail.rounds.map((row) => row.topics)).toEqual([
      ['Mobilisation schedule', 'Data ownership', 'Service credits'],
      ['Service credits', 'Key personnel substitution'],
    ]);
    expect(detail.authorizedNegotiators.map((row) => row.fullName)).toEqual(['Tebogo Molefe']);
  });

  it('forbids a commercial reviewer without negotiation.conduct from recording rounds', async () => {
    const response = await api.callAs('refilwe.commercial@tenderiq.local', E.recordNegotiationRound, {
      tenant: 'kwu',
      params: { negotiationId: 2 },
      body: { meetingAt: '2026-10-06T06:00:00Z', participants: 'KWU', topics: ['Service credits'], minutes: 'Notes', supplierVisible: false },
    });
    expectProblem(response, 403, 'FORBIDDEN');
  });
});

describe('assignments, next stage and user-facing messages', () => {
  it('lists only eligible people as decision owners, finding owners and negotiators of T-2026-0009', async () => {
    // Act
    const response = await api.callAs(OFFICER, E.getTender, { tenant: 'kwu', params: { tenderId: 9 } });

    // Assert
    const summary = E.getTender.response.parse(response.body);
    expect(summary.eligible.decisionOwners.map((row) => row.fullName)).toEqual(['Mpho Dikgang', 'Tebogo Molefe']);
    expect(summary.eligible.findingOwners.map((row) => row.fullName)).toEqual(['Tebogo Molefe']);
    expect(summary.eligible.negotiators.map((row) => row.fullName)).toEqual(['Tebogo Molefe']);
    expect(summary.team.map((row) => row.fullName)).not.toContain('Lesego Seretse');
    expect(summary.team.map((row) => row.fullName)).not.toContain('Refilwe Motsumi');
  });

  it('refuses a decision owner on the team who does not manage selection', async () => {
    const body = {
      tenderId: 1,
      lotId: 103,
      bidId: 104,
      scope: 'Lot 3 panels',
      proposedValue: { amount: '900000.00', currency: 'BWP' },
      rationale: 'Only candidate passing the gate',
      remainingChecks: 'Insurance',
      negotiationTopics: [],
      decisionOwnerUserId: 11,
      contingencyPlan: 'Approach Chobe Pipe',
      fallbackBidId: 105,
    };
    expectProblem(await api.callAs(OFFICER, E.recommendPreferredBidder, { tenant: 'kwu', body }), 422, 'DECISION_OWNER_NOT_ELIGIBLE');
  });

  it('links the approved shortlist to stage 2 of the same event instead of offering a new event (AC-22)', async () => {
    const response = await api.callAs(OFFICER, E.getShortlist, { tenant: 'kwu', params: { shortlistId: 9 } });
    const shortlist = E.getShortlist.response.parse(response.body);
    expect(shortlist.nextStage).toEqual({ tender: { tenderId: 9, reference: 'T-2026-0009', stageNo: 2 }, createLink: null });
  });

  it('words every gate blocker of T-2026-0009 without internal record numbers', async () => {
    const tender = E.getTender.response.parse((await api.callAs(OFFICER, E.getTender, { tenant: 'kwu', params: { tenderId: 9 } })).body);
    const preferred = E.getPreferredBidder.response.parse(
      (await api.callAs(OFFICER, E.getPreferredBidder, { tenant: 'kwu', params: { preferredBidderId: 1 } })).body,
    );
    const messages = [
      ...tender.gates.award.blockers,
      ...tender.gates.finalOffer.blockers,
      ...tender.gates.negotiation.blockers,
      ...preferred.awardGate.blockers,
      ...preferred.fallbackGate.blockers,
    ].map((row) => row.message);
    expect(messages.length).toBeGreaterThan(0);
    for (const message of messages) {
      expect(message).not.toMatch(/\b(case|negotiation|process decision|preferred bidder|fallback decision|criterion|session) \d+/i);
    }
  });
});
