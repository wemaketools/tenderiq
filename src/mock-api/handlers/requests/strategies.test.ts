/**
 * Requests domain handlers (05) — market research and strategy (BUY-06, FR-05, AC-39): tenant isolation,
 * permissions, the RFI next-step view, fairness reviews, policy thresholds and strategy approval.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { Problem } from '../../../contracts/common.js';
import type { AnyEndpoint } from '../../../contracts/endpoint.js';
import {
  AddMarketResearchResult,
  FairnessReview,
  ProcedureOptions,
  StrategyDetail,
  StrategyPage,
  requestEndpoints as e,
} from '../../../contracts/requests.js';
import { createTestMockApp } from '../../testing/index.js';
import type { TestMockApp, TestResponse } from '../../testing/index.js';
import { register } from './index.js';

const TEBOGO = 'tebogo.officer@tenderiq.local';
const MPHO = 'mpho.manager@tenderiq.local';
const ODC_OFFICER = 'officer.odc@tenderiq.local';

let api: TestMockApp;

beforeAll(async () => {
  api = await createTestMockApp({ auth: 'fixture', modules: [{ name: 'requests', register }], now: () => new Date('2026-09-30T08:00:00Z') });
});

type CallOptions = Parameters<TestMockApp['callAs']>[2];

function call(email: string, endpoint: AnyEndpoint, options: CallOptions = {}): Promise<TestResponse> {
  return api.callAs(email, endpoint, { tenant: email.endsWith('odc@tenderiq.local') ? 'odc' : 'kwu', ...options });
}

async function expectError(response: Promise<TestResponse>, status: number, code: string): Promise<void> {
  const result = await response;
  expect(result.status, result.text).toBe(status);
  expect(Problem.parse(result.body).code).toBe(code);
}

async function strategy(email: string, strategyId: number): Promise<StrategyDetail> {
  const response = await call(email, e.getStrategy, { params: { strategyId } });
  expect(response.status, response.text).toBe(200);
  return StrategyDetail.parse(response.body);
}

const UPDATE = {
  eventType: 'tender',
  procedure: 'open',
  awardModel: 'single',
  intendedOutcome: 'Install 22 valves.',
  negotiationPermitted: false,
  expectedRevision: 1,
} as const;

describe('buyer.strategies.list and get (BUY-06)', () => {
  it('lists KWU strategies with contract-valid details, and only ODC’s for ODC', async () => {
    const page = StrategyPage.parse((await call(TEBOGO, e.listStrategies, { query: { pageSize: 100 } })).body);
    expect(page.total).toBe(11);
    for (const row of page.items) {
      await strategy(TEBOGO, row.id);
    }
    const odc = StrategyPage.parse((await call(ODC_OFFICER, e.listStrategies)).body);
    expect(odc.items.map((row) => row.id)).toEqual([601]);
    await expectError(call(ODC_OFFICER, e.getStrategy, { params: { strategyId: 501 } }), 404, 'NOT_FOUND');
  });

  it('filters by status and procedure', async () => {
    const page = StrategyPage.parse((await call(TEBOGO, e.listStrategies, { query: { status: ['draft', 'returned', 'awaiting_approval'], procedure: 'invitation_only' } })).body);
    expect(page.items.map((row) => row.id).sort()).toEqual([507, 511]);
  });

  it('lets the auditor read strategies and refuses assessors, requesters and suppliers', async () => {
    expect((await call('pule.auditor@tenderiq.local', e.listStrategies)).status).toBe(200);
    await expectError(call('neo.assessor@tenderiq.local', e.listStrategies), 403, 'FORBIDDEN');
    await expectError(call('kagiso.requester@tenderiq.local', e.getStrategy, { params: { strategyId: 501 } }), 403, 'FORBIDDEN');
    await expectError(api.callAs('serowe-ict.admin@tenderiq.local', e.listStrategies, { tenant: 'serowe-ict' }), 403, 'TENANT_ACCESS_DENIED');
    await expectError(call('pule.auditor@tenderiq.local', e.decideStrategy, { params: { strategyId: 509 }, body: { decision: 'approve', reason: 'x', subjectRevision: 1 } }), 403, 'FORBIDDEN');
  });

  it('concludes the RFI with reviewed findings and a linked next event, without an award (AC-39)', async () => {
    const rfi = await strategy(TEBOGO, 503);
    expect(rfi.rfiOutcome).toMatchObject({ rfiTender: { reference: 'T-2026-0004', status: 'information_collected' }, nextEvent: { reference: 'T-2026-0009' } });
    const next = await strategy(TEBOGO, 504);
    expect(next.procedure).toBe('multi_stage');
    const research = next.marketResearch.filter((entry) => entry.sourceType === 'rfi_response');
    expect(research.map((entry) => entry.isSupplierCommitment).sort()).toEqual([false, false, true]);
  });

  it('shows the mitigated fairness review, the FR-05 distinctions and the policy check', async () => {
    const scada = await strategy(TEBOGO, 502);
    expect(scada.fairnessReviews[0]).toMatchObject({ outcome: 'mitigated', supplier: { name: 'Serowe ICT Solutions' } });
    expect(scada.procedureDistinctions.every((distinction) => distinction.satisfied)).toBe(true);
    const direct = await strategy(MPHO, 509);
    expect(direct.directAwardGrounds).not.toBeNull();
    expect(direct.policy).toMatchObject({ procedurePermitted: true, withinThreshold: false });
    expect(direct.allowedActions).toContain('decide');
    expect(direct.callerAuthority?.sufficient).toBe(true);
  });

  it('compares procedures without framework call-off and flags the invitation-only threshold', async () => {
    const options = ProcedureOptions.parse((await call(TEBOGO, e.getProcedureOptions, { params: { strategyId: 507 } })).body);
    expect(options.options.map((option) => option.procedure)).not.toContain('framework_calloff');
    expect(options.options.find((option) => option.procedure === 'invitation_only')).toMatchObject({ selected: true, withinThreshold: false });
    expect(options.options.find((option) => option.procedure === 'direct')?.requiresExceptionApproval).toBe(true);
  });
});

describe('strategy commands (BUY-06)', () => {
  it('blocks submission while a fairness review is pending or the value exceeds the procedure threshold', async () => {
    await expectError(call(TEBOGO, e.submitStrategy, { params: { strategyId: 506 }, body: { expectedRevision: 1 } }), 409, 'FAIRNESS_REVIEW_PENDING');
    await expectError(call(TEBOGO, e.submitStrategy, { params: { strategyId: 507 }, body: { expectedRevision: 1 } }), 409, 'PROCEDURE_THRESHOLD_EXCEEDED');
    await expectError(call(TEBOGO, e.submitStrategy, { params: { strategyId: 501 }, body: { expectedRevision: 2 } }), 409, 'INVALID_TRANSITION');
    await expectError(call(TEBOGO, e.submitStrategy, { params: { strategyId: 506 }, body: { expectedRevision: 3 } }), 409, 'REVISION_CONFLICT');
  });

  it('submits the complete draft strategy 511 for approval', async () => {
    const draft = await strategy(TEBOGO, 511);
    expect(draft.submissionReadiness.some((item) => item.status === 'blocking')).toBe(false);
    expect(draft.allowedActions).toContain('submit');
    const submitted = await call(TEBOGO, e.submitStrategy, { params: { strategyId: 511 }, body: { expectedRevision: 2 } });
    expect(submitted.status, submitted.text).toBe(200);
    expect(StrategyDetail.parse(submitted.body).status).toBe('awaiting_approval');
  });

  it('records a fairness review outcome once', async () => {
    const decided = FairnessReview.parse(
      (await call(MPHO, e.decideFairnessReview, { params: { strategyId: 506, reviewId: 702 }, body: { outcome: 'mitigated', note: 'Sizing data shared with all bidders.' } })).body,
    );
    expect(decided).toMatchObject({ outcome: 'mitigated', reviewer: { userId: 4 } });
    await expectError(call(MPHO, e.decideFairnessReview, { params: { strategyId: 502, reviewId: 701 }, body: { outcome: 'no_issue', note: 'x' } }), 409, 'FAIRNESS_REVIEW_CLOSED');
    await expectError(call(TEBOGO, e.decideFairnessReview, { params: { strategyId: 506, reviewId: 702 }, body: { outcome: 'no_issue', note: 'x' } }), 403, 'FORBIDDEN');
  });

  it('opens a fairness review when research records prior specification involvement (201)', async () => {
    const response = await call(TEBOGO, e.addMarketResearch, {
      params: { strategyId: 506 },
      body: { sourceType: 'supplier_consultation', source: 'Site walk', finding: 'Proposed chamber layout', isSupplierCommitment: false, supplierTenantId: 4, priorSpecificationInvolvement: true },
    });
    expect(response.status).toBe(201);
    const result = AddMarketResearchResult.parse(response.body);
    expect(result.fairnessReview).toMatchObject({ outcome: 'pending', supplier: { tenantId: 4 } });
    await expectError(
      call(TEBOGO, e.addMarketResearch, { params: { strategyId: 501 }, body: { sourceType: 'desk_research', source: 'Report', finding: 'Prices rose 4%', isSupplierCommitment: false } }),
      409,
      'STRATEGY_NOT_EDITABLE',
    );
    await expectError(
      call(TEBOGO, e.addMarketResearch, { params: { strategyId: 506 }, body: { sourceType: 'supplier_consultation', source: 'Call', finding: 'Lead time ok', isSupplierCommitment: true, supplierTenantId: 2 } }),
      422,
      'REFERENCE_NOT_FOUND',
    );
  });

  it('approves a strategy within authority and blocks the preparer and stale revisions', async () => {
    const approved = StrategyDetail.parse(
      (await call(MPHO, e.decideStrategy, { params: { strategyId: 509 }, body: { decision: 'approve', reason: 'Grounds and price benchmark accepted.', subjectRevision: 1 } })).body,
    );
    expect(approved).toMatchObject({ status: 'approved', approval: { status: 'approved', approvedRevision: 1 } });
    await expectError(call(MPHO, e.decideStrategy, { params: { strategyId: 509 }, body: { decision: 'approve', reason: 'x', subjectRevision: 2 } }), 409, 'REVISION_CONFLICT');
    await expectError(call(MPHO, e.decideStrategy, { params: { strategyId: 501 }, body: { decision: 'approve', reason: 'x', subjectRevision: 2 } }), 409, 'INVALID_TRANSITION');
    const returned = StrategyDetail.parse((await call(MPHO, e.decideStrategy, { params: { strategyId: 509 }, body: { decision: 'return', reason: 'Add a second quote.', subjectRevision: 1 } })).body);
    expect(returned.status).toBe('returned');
  });

  it('creates strategies only for approved requests without one, under permitted procedures', async () => {
    await expectError(call(TEBOGO, e.createStrategy, { body: { eventType: 'tender', procedure: 'open', awardModel: 'single', requestId: 3 } }), 409, 'REQUEST_NOT_APPROVED');
    await expectError(call(TEBOGO, e.createStrategy, { body: { eventType: 'tender', procedure: 'open', awardModel: 'single', requestId: 5 } }), 409, 'STRATEGY_EXISTS');
    await expectError(call(TEBOGO, e.createStrategy, { body: { eventType: 'tender', procedure: 'open', awardModel: 'single', requestId: 102 } }), 422, 'REFERENCE_NOT_FOUND');
    await expectError(call(ODC_OFFICER, e.createStrategy, { body: { eventType: 'tender', procedure: 'restricted', awardModel: 'single', projectId: 11 } }), 409, 'PROCEDURE_NOT_PERMITTED');
    const created = await call(TEBOGO, e.createStrategy, { body: { eventType: 'tender', procedure: 'open', awardModel: 'single', projectId: 3 } });
    expect(created.status).toBe(201);
    expect(StrategyDetail.parse(created.body)).toMatchObject({ status: 'draft', owner: { userId: 5 } });
  });

  it('updates a draft strategy and refuses approved ones, stale revisions and direct procurement without grounds', async () => {
    const updated = StrategyDetail.parse((await call(TEBOGO, e.updateStrategy, { params: { strategyId: 506 }, body: UPDATE })).body);
    expect(updated.revision).toBe(2);
    await expectError(call(TEBOGO, e.updateStrategy, { params: { strategyId: 501 }, body: { ...UPDATE, expectedRevision: 2 } }), 409, 'STRATEGY_NOT_EDITABLE');
    await expectError(call(TEBOGO, e.updateStrategy, { params: { strategyId: 506 }, body: { ...UPDATE, expectedRevision: 5 } }), 409, 'REVISION_CONFLICT');
    const invalid = await call(TEBOGO, e.updateStrategy, { params: { strategyId: 506 }, body: { ...UPDATE, eventType: 'rfq', procedure: 'direct' } });
    expect(invalid.status).toBe(422);
    expect(Problem.parse(invalid.body).errors?.map((error) => error.code)).toContain('DIRECT_AWARD_GROUNDS_REQUIRED');
    await expectError(call(ODC_OFFICER, e.updateStrategy, { params: { strategyId: 601 }, body: UPDATE }), 409, 'STRATEGY_NOT_EDITABLE');
  });

  it('requires an RFI to state the use of supplier information and drops competition-only fields from it', async () => {
    const rfiBody = {
      ...UPDATE,
      eventType: 'rfi',
      procedure: 'rfi',
      competitionRationale: 'Should not be kept.',
      lotStrategy: 'Should not be kept.',
      qualificationApproach: 'Should not be kept.',
      evaluationApproach: 'Should not be kept.',
      negotiationPermitted: true,
    };
    const missing = await call(TEBOGO, e.updateStrategy, { params: { strategyId: 506 }, body: rfiBody });
    expect(missing.status).toBe(422);
    expect(Problem.parse(missing.body).errors?.map((error) => error.code)).toContain('SUPPLIER_INFORMATION_USE_REQUIRED');

    const saved = StrategyDetail.parse(
      (await call(TEBOGO, e.updateStrategy, { params: { strategyId: 506 }, body: { ...rfiBody, supplierInformationUse: 'No award entitlement; responses shape the later tender only.' } })).body,
    );
    expect(saved).toMatchObject({
      supplierInformationUse: 'No award entitlement; responses shape the later tender only.',
      competitionRationale: null,
      lotStrategy: null,
      qualificationApproach: null,
      evaluationApproach: null,
      negotiationPermitted: false,
    });
    expect(saved.submissionReadiness.map((item) => item.id)).toEqual(expect.arrayContaining(['intendedOutcome', 'supplierInformationUse', 'risks', 'timetableSummary']));
    expect(saved.submissionReadiness.map((item) => item.id)).not.toContain('lotStrategy');
  });

  it('satisfies the RFI distinctions from the recorded use of supplier information', async () => {
    const rfi = await strategy(TEBOGO, 503);
    expect(rfi.supplierInformationUse).toContain('no right to an award');
    expect(rfi.procedureDistinctions.map((distinction) => [distinction.id, distinction.satisfied])).toEqual([
      ['no_award_entitlement', true],
      ['information_use', true],
    ]);
  });
});
