/**
 * Requests domain handlers (05) — requests, business cases and funding decisions (BUY-02, BUY-03, BUY-04):
 * tenant and requester visibility, 403s for the wrong tenant kind or permission, AC-05 authority routing,
 * segregation of duties, BR-10 re-approval and every declared business error.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { Problem } from '../../../contracts/common.js';
import type { AnyEndpoint } from '../../../contracts/endpoint.js';
import {
  CombineResult,
  InfoRequest,
  RequestDecisionView,
  RequestDetail,
  RequestOptions,
  RequestPage,
  RequestSummary,
  RequestUpdateResult,
  RoutingOptions,
  SplitResult,
  requestEndpoints as e,
} from '../../../contracts/requests.js';
import { createTestMockApp } from '../../testing/index.js';
import type { TestMockApp, TestResponse } from '../../testing/index.js';
import { register } from './index.js';

const TEBOGO = 'tebogo.officer@tenderiq.local';
const MPHO = 'mpho.manager@tenderiq.local';
const KAGISO = 'kagiso.requester@tenderiq.local';
const ONALENNA = 'onalenna.budget@tenderiq.local';
const KEABETSWE = 'keabetswe.approver@tenderiq.local';
const ODC_OFFICER = 'officer.odc@tenderiq.local';

let api: TestMockApp;

beforeAll(async () => {
  api = await createTestMockApp({
    modules: [{ name: 'requests', register }],
    now: () => new Date('2026-09-30T08:00:00Z'),
  });
});

type CallOptions = Parameters<TestMockApp['callAs']>[2];

async function call(email: string, endpoint: AnyEndpoint, options: CallOptions = {}): Promise<TestResponse> {
  return api.callAs(email, endpoint, { tenant: email.endsWith('odc@tenderiq.local') ? 'odc' : 'kwu', ...options });
}

function problemCode(response: TestResponse): string | undefined {
  return Problem.parse(response.body).code;
}

async function expectError(response: Promise<TestResponse>, status: number, code: string): Promise<void> {
  const result = await response;
  expect(result.status, result.text).toBe(status);
  expect(problemCode(result)).toBe(code);
}

async function detail(email: string, requestId: number): Promise<RequestDetail> {
  const response = await call(email, e.getRequest, { params: { requestId } });
  expect(response.status, response.text).toBe(200);
  return RequestDetail.parse(response.body);
}

describe('module', () => {
  it('registers every requests endpoint without failures', () => {
    expect(api.failed).toEqual([]);
    expect(api.loaded).toEqual(['requests']);
    expect(api.endpointIds).toHaveLength(Object.keys(e).length);
  });
});

describe('buyer.requests.list (BUY-02)', () => {
  it('returns every non-draft KWU request to a procurement officer, never ODC rows or another requester’s draft', async () => {
    // Act
    const page = RequestPage.parse((await call(TEBOGO, e.listRequests, { query: { pageSize: 100 } })).body);

    // Assert
    const references = page.items.map((row) => row.reference);
    expect(page.total).toBe(13);
    expect(references).not.toContain('PR-2026-0007');
    expect(references).not.toContain('PR-2026-0014');
    expect(page.items.every((row) => row.id < 100)).toBe(true);
  });

  it('limits a requester without request.view_all to their own requests, including their draft', async () => {
    const page = RequestPage.parse((await call(KAGISO, e.listRequests, { query: { pageSize: 100 } })).body);
    const references = page.items.map((row) => row.reference);
    expect(references).toContain('PR-2026-0007');
    expect(references).not.toContain('PR-2026-0002');
    expect(references).not.toContain('PR-2026-0006');
    expect(page.items.every((row) => row.requester.userId === 6 || row.owner?.userId === 6)).toBe(true);
  });

  it('isolates ODC: its officer sees only ODC requests and gets 404 for a KWU request', async () => {
    const page = RequestPage.parse((await call(ODC_OFFICER, e.listRequests)).body);
    expect(page.items.map((row) => row.id).sort()).toEqual([101, 102]);
    await expectError(call(ODC_OFFICER, e.getRequest, { params: { requestId: 3 } }), 404, 'NOT_FOUND');
  });

  it('filters by status, searches, sorts by value and paginates', async () => {
    const filtered = RequestPage.parse((await call(TEBOGO, e.listRequests, { query: { status: ['approved', 'under_review'] } })).body);
    expect(filtered.items.map((row) => row.reference).sort()).toEqual(['PR-2026-0003', 'PR-2026-0005', 'PR-2026-0013', 'PR-2026-0015']);

    const searched = RequestPage.parse((await call(TEBOGO, e.listRequests, { query: { q: 'valve' } })).body);
    expect(searched.items.map((row) => row.reference).sort()).toEqual(['PR-2026-0005', 'PR-2026-0006']);

    const sorted = RequestPage.parse((await call(TEBOGO, e.listRequests, { query: { sort: 'estimatedValue', dir: 'desc', pageSize: 2, page: 1 } })).body);
    expect(sorted.items.map((row) => row.reference)).toEqual(['PR-2026-0001', 'PR-2026-0003']);
    expect(sorted.total).toBe(13);

    const unassigned = RequestPage.parse((await call(TEBOGO, e.listRequests, { query: { unassigned: 'true' } })).body);
    expect(unassigned.items.map((row) => row.reference)).toEqual(['PR-2026-0008']);
  });

  it('answers 403 to a supplier, to a buyer without request permissions and to a metadata-only support grant', async () => {
    await expectError(api.callAs('tsodilo.admin@tenderiq.local', e.listRequests, { tenant: 'kwu' }), 403, 'TENANT_ACCESS_DENIED');
    await expectError(api.callAs('tsodilo.admin@tenderiq.local', e.listRequests, { tenant: 'tsodilo' }), 403, 'TENANT_ACCESS_DENIED');
    await expectError(call('masego.contracts@tenderiq.local', e.listRequests), 403, 'FORBIDDEN');
    await expectError(api.callAs('support.agent@tenderiq.local', e.listRequests, { tenant: 'kwu' }), 403, 'FORBIDDEN');
  });

  it('returns 422 for an unknown sort field', async () => {
    const response = await call(TEBOGO, e.listRequests, { query: { sort: 'budget' } });
    expect(response.status).toBe(422);
  });
});

describe('buyer.requests.summary and options', () => {
  it('counts only visible requests', async () => {
    const summary = RequestSummary.parse((await call(TEBOGO, e.getRequestSummary)).body);
    expect(summary.byStatus.reduce((total, entry) => total + entry.count, 0)).toBe(13);
    expect(summary.unassignedCount).toBe(1);
    expect(summary.reapprovalRequiredCount).toBe(1);
    const approver = RequestSummary.parse((await call(KEABETSWE, e.getRequestSummary)).body);
    expect(approver.awaitingMyDecisionCount).toBe(2);
  });

  it('offers only the caller’s organization structure', async () => {
    const options = RequestOptions.parse((await call(ODC_OFFICER, e.getRequestOptions)).body);
    expect(options.legalEntities.map((entity) => entity.name)).toEqual(['Okavango District Council']);
    expect(options.people.every((person) => [22, 23].includes(person.userId))).toBe(true);
  });
});

describe('buyer.requests.get (BUY-03)', () => {
  it('returns a contract-valid business case for every visible request', async () => {
    const page = RequestPage.parse((await call(TEBOGO, e.listRequests, { query: { pageSize: 100 } })).body);
    for (const row of page.items) {
      await detail(TEBOGO, row.id);
    }
  });

  it('hides a draft from everyone but its parties', async () => {
    await expectError(call(TEBOGO, e.getRequest, { params: { requestId: 7 } }), 404, 'NOT_FOUND');
    const draft = await detail(KAGISO, 7);
    expect(draft.submissionReadiness.filter((item) => item.status === 'blocking').map((item) => item.id)).toEqual(
      expect.arrayContaining(['estimatedValue', 'fundingSourceId']),
    );
    expect(draft.allowedActions).not.toContain('submit');
  });

  it('shows the aggregate approval value on the combined PR-2026-0005 and withholds the tender until its draft strategy is approved', async () => {
    const request = await detail(TEBOGO, 5);
    expect(request.valueBasis.approvalValue).toEqual({ amount: '1770000.00', currency: 'BWP' });
    expect(request.links.some((link) => link.linkType === 'combined_into' && link.request.reference === 'PR-2026-0006')).toBe(true);
    expect(request.strategy).toMatchObject({ id: 506, status: 'draft' });
    expect(request.allowedActions).not.toContain('create_tender');
    expect(request.createTenderPath).toBeNull();
  });

  it('offers the create-tender link on the approved PR-2026-0015, which has no strategy', async () => {
    const request = await detail(TEBOGO, 15);
    expect(request).toMatchObject({ status: 'approved', strategy: null });
    expect(request.allowedActions).toContain('create_tender');
    expect(request.allowedActions).toContain('create_strategy');
    expect(request.createTenderPath).toBe('/buyer/tenders/new?fromRequest=15');
  });

  it('lets the requester submit the complete draft PR-2026-0014 and keeps PR-2026-0007 blocked', async () => {
    const complete = await detail(KAGISO, 14);
    expect(complete.submissionReadiness.some((item) => item.status === 'blocking')).toBe(false);
    expect(complete.submissionReadiness.find((item) => item.id === 'fundingStatus')?.status).toBe('warning');
    expect(complete.allowedActions).toContain('submit');
    const submitted = await call(KAGISO, e.submitRequest, { params: { requestId: 14 }, body: { expectedRevision: 1 } });
    expect(submitted.status, submitted.text).toBe(200);
    expect(RequestDetail.parse(submitted.body).status).toBe('submitted');
    await expectError(call(TEBOGO, e.getRequest, { params: { requestId: 14 } }), 404, 'NOT_FOUND');
  });

  it('flags re-approval after the material change on PR-2026-0013 (BR-10)', async () => {
    const request = await detail(TEBOGO, 13);
    expect(request.reapprovalRequired).toBe(true);
    expect(request.materialChange).toMatchObject({ approvedRevision: 1, currentRevision: 2, approvalInvalidated: true });
    expect(request.createTenderPath).toBeNull();
  });
});

describe('business case commands (BUY-03)', () => {
  it('creates a draft for the caller (201) and rejects a too-short title with a field error', async () => {
    const created = await call(KAGISO, e.createRequest, { body: { title: 'Pump house roof repair', needType: 'new_expenditure' } });
    expect(created.status).toBe(201);
    expect(RequestDetail.parse(created.body)).toMatchObject({ status: 'draft', requester: { userId: 6 } });

    const invalid = await call(KAGISO, e.createRequest, { body: { title: 'x', needType: 'new_expenditure' } });
    expect(invalid.status).toBe(422);
    expect(Problem.parse(invalid.body).errors).toEqual([expect.objectContaining({ field: 'title', code: 'TITLE_TOO_SHORT' })]);
  });

  it('rejects a reference to another organization’s record', async () => {
    await expectError(
      call(KAGISO, e.createRequest, { body: { title: 'Pump house roof', needType: 'new_expenditure', departmentId: 11 } }),
      422,
      'REFERENCE_NOT_FOUND',
    );
  });

  it('turns a material edit of an approved request into a re-approval (BR-10)', async () => {
    const current = await detail(TEBOGO, 5);
    const response = await call(TEBOGO, e.updateRequest, {
      params: { requestId: 5 },
      body: {
        title: current.title,
        needType: current.needType,
        scopeDescription: current.scopeDescription,
        estimatedValue: { amount: '1400000.00', currency: 'BWP' },
        estimatedTotalCommitment: current.estimatedTotalCommitment,
        fundingStatus: current.fundingStatus,
        priority: current.priority,
        expectedRevision: current.revision,
      },
    });
    expect(response.status, response.text).toBe(200);
    const result = RequestUpdateResult.parse(response.body);
    expect(result.changeAssessment).toMatchObject({ material: true, reapprovalRequired: true });
    expect(result.request.status).toBe('under_review');
  });

  it('refuses edits by non-parties, of closed requests and of stale revisions', async () => {
    const body = { title: 'Northern wellfield pipeline extension', needType: 'new_expenditure', expectedRevision: 1 } as const;
    await expectError(call(MPHO, e.updateRequest, { params: { requestId: 3 }, body }), 403, 'NOT_REQUEST_PARTY');
    await expectError(call(TEBOGO, e.updateRequest, { params: { requestId: 9 }, body }), 409, 'REQUEST_NOT_EDITABLE');
    await expectError(call(TEBOGO, e.updateRequest, { params: { requestId: 3 }, body: { ...body, expectedRevision: 4 } }), 409, 'REVISION_CONFLICT');
  });

  it('blocks submission of an incomplete draft and of a request with an open information request', async () => {
    await expectError(call(KAGISO, e.submitRequest, { params: { requestId: 7 }, body: { expectedRevision: 1 } }), 422, 'REQUEST_INCOMPLETE');
    await expectError(call(KAGISO, e.submitRequest, { params: { requestId: 4 }, body: { expectedRevision: 1 } }), 409, 'INFO_REQUEST_UNANSWERED');
    await expectError(call(KAGISO, e.submitRequest, { params: { requestId: 3 }, body: { expectedRevision: 1 } }), 409, 'INVALID_TRANSITION');
  });

  it('resubmits PR-2026-0004 when the requester answers the open information request', async () => {
    const response = await call(KAGISO, e.respondToInfoRequest, {
      params: { requestId: 4, infoRequestId: 2 },
      body: { responseText: 'Yes, LIMS integration is required; both price lists are attached.' },
    });
    expect(response.status, response.text).toBe(200);
    const request = RequestDetail.parse(response.body);
    expect(request.status).toBe('submitted');
    expect(request.infoRequests.every((info) => info.status === 'answered')).toBe(true);
    await expectError(
      call(KAGISO, e.respondToInfoRequest, { params: { requestId: 4, infoRequestId: 1 }, body: { responseText: 'Again' } }),
      409,
      'INFO_REQUEST_CLOSED',
    );
  });

  it('withdraws an open request and refuses to withdraw a withdrawn one', async () => {
    const withdrawn = RequestDetail.parse((await call(KAGISO, e.withdrawRequest, { params: { requestId: 8 }, body: { reason: 'Covered by stores stock.' } })).body);
    expect(withdrawn.status).toBe('withdrawn');
    await expectError(call(KAGISO, e.withdrawRequest, { params: { requestId: 10 }, body: { reason: 'Again' } }), 409, 'INVALID_TRANSITION');
  });
});

describe('review commands (BUY-02, BUY-04)', () => {
  it('assigns an eligible owner and refuses a requester as owner', async () => {
    const assigned = RequestDetail.parse((await call(TEBOGO, e.assignRequest, { params: { requestId: 8 }, body: { ownerUserId: 5 } })).body);
    expect(assigned).toMatchObject({ status: 'under_review', owner: { userId: 5 } });
    await expectError(call(TEBOGO, e.assignRequest, { params: { requestId: 8 }, body: { ownerUserId: 6 } }), 422, 'ASSIGNEE_NOT_ELIGIBLE');
  });

  it('asks for information with a future due date only (201)', async () => {
    const created = await call(TEBOGO, e.requestInformation, { params: { requestId: 8 }, body: { question: 'Which sizes are missing from stock?', dueAt: '2026-10-09T13:00:00Z' } });
    expect(created.status).toBe(201);
    expect(InfoRequest.parse(created.body).status).toBe('open');
    await expectError(
      call(TEBOGO, e.requestInformation, { params: { requestId: 8 }, body: { question: 'Which sizes are missing?', dueAt: '2026-09-01T13:00:00Z' } }),
      422,
      'DUE_DATE_NOT_FUTURE',
    );
  });

  it('combines on the sum of every original’s total commitment and refuses self, closed and cross-tenant sources', async () => {
    const response = await call(TEBOGO, e.combineRequests, { params: { requestId: 3 }, body: { sourceRequestIds: [8], reason: 'One network programme.' } });
    expect(response.status, response.text).toBe(200);
    const result = CombineResult.parse(response.body);
    expect(result.aggregateValue).toEqual({ amount: '5960000.00', currency: 'BWP' });
    expect(result.request.valueBasis).toMatchObject({
      approvalValue: { amount: '5960000.00', currency: 'BWP' },
      combinedValue: { amount: '5270000.00', currency: 'BWP' },
      basis: 'aggregate_commitment',
    });
    expect(result.combined[0]).toMatchObject({ reference: 'PR-2026-0008', status: 'closed' });

    await expectError(call(TEBOGO, e.combineRequests, { params: { requestId: 3 }, body: { sourceRequestIds: [3], reason: 'x' } }), 422, 'COMBINE_SELF');
    await expectError(call(TEBOGO, e.combineRequests, { params: { requestId: 3 }, body: { sourceRequestIds: [9], reason: 'x' } }), 409, 'COMBINE_SOURCE_INVALID');
    await expectError(call(TEBOGO, e.combineRequests, { params: { requestId: 3 }, body: { sourceRequestIds: [102], reason: 'x' } }), 409, 'COMBINE_SOURCE_INVALID');
  });

  it('splits only into parts that add up to the estimate and keeps the whole commitment as the policy value', async () => {
    const part = (amount: string) => ({ title: `Section ${amount}`, scopeDescription: 'Pipeline section', estimatedValue: { amount, currency: 'BWP' } });
    await expectError(
      call(TEBOGO, e.splitRequest, { params: { requestId: 3 }, body: { parts: [part('1000000.00'), part('1000000.00')], justification: 'Two sections' } }),
      422,
      'SPLIT_TOTAL_MISMATCH',
    );
    await expectError(
      call(TEBOGO, e.splitRequest, {
        params: { requestId: 3 },
        body: { parts: [part('2850000.00'), { ...part('2000000.00'), estimatedValue: { amount: '2000000.00', currency: 'USD' } }], justification: 'Two sections' },
      }),
      422,
      'SPLIT_CURRENCY_MISMATCH',
    );
    const split = SplitResult.parse(
      (await call(TEBOGO, e.splitRequest, { params: { requestId: 3 }, body: { parts: [part('2850000.00'), part('2000000.00')], justification: 'Two sections' } })).body,
    );
    expect(split.policyValue).toEqual({ amount: '5120000.00', currency: 'BWP' });
    expect(split.parts).toHaveLength(2);
  });

  it('defers to a future date only', async () => {
    const deferred = RequestDetail.parse((await call(TEBOGO, e.deferRequest, { params: { requestId: 8 }, body: { deferredUntil: '2027-04-01', reason: 'Next budget.' } })).body);
    expect(deferred).toMatchObject({ status: 'deferred', deferredUntil: '2027-04-01' });
    await expectError(call(TEBOGO, e.deferRequest, { params: { requestId: 8 }, body: { deferredUntil: '2026-09-01', reason: 'x' } }), 422, 'DEFER_DATE_NOT_FUTURE');
  });

  it('routes only to an eligible existing contract', async () => {
    const options = RoutingOptions.parse((await call(TEBOGO, e.getRoutingOptions, { params: { requestId: 8 } })).body);
    expect(options.options.every((option) => !option.eligible)).toBe(true);
    await expectError(call(TEBOGO, e.routeRequestToContract, { params: { requestId: 8 }, body: { contractId: 1, reason: 'x' } }), 409, 'CONTRACT_NOT_ELIGIBLE');
  });

  it('reconsiders a deferred request, closes a rejected one and refuses to rescind a converted one', async () => {
    expect(RequestDetail.parse((await call(TEBOGO, e.reconsiderRequest, { params: { requestId: 11 }, body: { reason: 'Grant confirmed.', changedBasis: 'WSRG approved.' } })).body).status).toBe(
      'under_review',
    );
    expect(RequestDetail.parse((await call(TEBOGO, e.closeRequest, { params: { requestId: 9 }, body: { reason: 'Final.' } })).body).status).toBe('closed');
    await expectError(call(MPHO, e.rescindRequest, { params: { requestId: 1 }, body: { reason: 'x' } }), 409, 'REQUEST_ALREADY_CONVERTED');
    expect(RequestDetail.parse((await call(MPHO, e.rescindRequest, { params: { requestId: 5 }, body: { reason: 'Budget withdrawn.' } })).body).status).toBe('rescinded');
  });

  it('adds a review comment (201) and refuses comments on a closed request', async () => {
    expect((await call(TEBOGO, e.commentOnRequest, { params: { requestId: 3 }, body: { text: 'Checked.' } })).status).toBe(201);
    await expectError(call(TEBOGO, e.commentOnRequest, { params: { requestId: 6 }, body: { text: 'Late.' } }), 409, 'INVALID_TRANSITION');
  });
});

describe('funding and decision (BUY-04, AC-05)', () => {
  it('shows the manager that PR-2026-0003 exceeds their authority and names the higher route', async () => {
    const view = RequestDecisionView.parse((await call(MPHO, e.getRequestDecision, { params: { requestId: 3 } })).body);
    expect(view.callerAuthority).toMatchObject({ sufficient: false, limit: { amount: '2000000.00', currency: 'BWP' }, basis: 'authority_limit' });
    expect(view.routedToNextLevel).toBe(true);
    expect(view.skippedLevel?.userId).toBe(4);
    expect(view.eligibleApprovers.map((approver) => approver.userId)).toEqual([18]);
    expect(view.route.currentApprover?.userId).toBe(18);
    expect(view.allowedActions).not.toContain('decide');
  });

  it('reports the escalation of PR-2026-0003 as its latest decision although no final decision exists yet', async () => {
    const request = RequestDetail.parse((await call(MPHO, e.getRequest, { params: { requestId: 3 } })).body);
    expect(request.decision).toMatchObject({ decidedAt: null, latest: { decision: 'escalate', decidedBy: { userId: 4 } } });
  });

  it('names the approver PR-2026-0003 awaits for the manager but not for that approver herself (AC-05)', async () => {
    const managerView = RequestDecisionView.parse((await call(MPHO, e.getRequestDecision, { params: { requestId: 3 } })).body);
    const managerDetail = RequestDetail.parse((await call(MPHO, e.getRequest, { params: { requestId: 3 } })).body);
    expect(managerView.awaitingDecisionFrom).toEqual({ userId: 18, fullName: 'Keabetswe Nkwe' });
    expect(managerDetail.decision.awaitingDecisionFrom?.userId).toBe(18);

    const approverView = RequestDecisionView.parse((await call(KEABETSWE, e.getRequestDecision, { params: { requestId: 3 } })).body);
    const approverDetail = RequestDetail.parse((await call(KEABETSWE, e.getRequest, { params: { requestId: 3 } })).body);
    expect(approverView.awaitingDecisionFrom).toBeNull();
    expect(approverDetail.decision.awaitingDecisionFrom).toBeNull();
  });

  it('checks authority against the total contemplated commitment, not the initial estimate', async () => {
    const view3 = RequestDecisionView.parse((await call(MPHO, e.getRequestDecision, { params: { requestId: 3 } })).body);
    expect(view3.requestedAuthority).toMatchObject({ amount: { amount: '5120000.00', currency: 'BWP' }, basis: 'total_commitment' });

    const view13 = RequestDecisionView.parse((await call(MPHO, e.getRequestDecision, { params: { requestId: 13 } })).body);
    expect(view13.requestedAuthority).toMatchObject({ amount: { amount: '2475000.00', currency: 'BWP' }, basis: 'total_commitment' });
    expect(view13.callerAuthority).toMatchObject({ sufficient: false, limit: { amount: '2000000.00', currency: 'BWP' } });

    const detail5 = RequestDetail.parse((await call(MPHO, e.getRequest, { params: { requestId: 5 } })).body);
    expect(detail5.valueBasis).toMatchObject({
      ownValue: { amount: '1150000.00', currency: 'BWP' },
      combinedValue: { amount: '1770000.00', currency: 'BWP' },
      approvalValue: { amount: '1770000.00', currency: 'BWP' },
      basis: 'aggregate_value',
    });

    const detail8 = RequestDetail.parse((await call(TEBOGO, e.getRequest, { params: { requestId: 8 } })).body);
    expect(detail8.valueBasis).toMatchObject({ approvalValue: { amount: '840000.00', currency: 'BWP' }, basis: 'total_commitment' });
  });

  it('refuses the manager’s approval beyond their authority and accepts the award approver’s', async () => {
    const body = { decision: 'approve', reason: 'Business case sound.', subjectRevision: 1 } as const;
    await expectError(call(MPHO, e.decideRequest, { params: { requestId: 3 }, body }), 403, 'AUTHORITY_EXCEEDED');
    const approved = RequestDecisionView.parse((await call(KEABETSWE, e.decideRequest, { params: { requestId: 3 }, body })).body);
    expect(approved.request.status).toBe('approved');
    expect(approved.approvedVersion).toMatchObject({ revision: 1, approvedBy: { userId: 18 } });
  });

  it('blocks the requester from approving their own request and a stale revision', async () => {
    await expectError(call(MPHO, e.decideRequest, { params: { requestId: 13 }, body: { decision: 'approve', reason: 'Urgent.', subjectRevision: 2 } }), 403, 'SELF_APPROVAL_BLOCKED');
    await expectError(call(KEABETSWE, e.decideRequest, { params: { requestId: 13 }, body: { decision: 'approve', reason: 'Old view.', subjectRevision: 1 } }), 409, 'REVISION_CONFLICT');
    const view = RequestDecisionView.parse((await call(MPHO, e.getRequestDecision, { params: { requestId: 13 } })).body);
    expect(view.segregation).toEqual({ rule: 'requester_vs_request_approval', callerIsRequester: true, blocked: true });
    expect(view.reapprovalRequired).toBe(true);
  });

  it('refuses approval on indicative funding and lets the budget owner confirm funding', async () => {
    await expectError(call(MPHO, e.decideRequest, { params: { requestId: 8 }, body: { decision: 'approve', reason: 'Needed.', subjectRevision: 1 } }), 409, 'FUNDING_NOT_CONFIRMED');
    const returned = RequestDecisionView.parse((await call(MPHO, e.decideRequest, { params: { requestId: 8 }, body: { decision: 'return', reason: 'Add sizes.', subjectRevision: 1 } })).body);
    expect(returned.request.status).toBe('information_requested');

    const funding = { fundingStatus: 'firm_commitment', fundingSourceId: 2, confirmedAmount: { amount: '420000.00', currency: 'BWP' }, subjectRevision: 1 } as const;
    const funded = RequestDecisionView.parse((await call(ONALENNA, e.confirmFunding, { params: { requestId: 8 }, body: funding })).body);
    expect(funded.funding).toMatchObject({ status: 'firm_commitment', sufficientForApproval: true, confirmedBy: { userId: 7 } });
    await expectError(call(ONALENNA, e.confirmFunding, { params: { requestId: 8 }, body: { ...funding, confirmedAmount: { amount: '100.00', currency: 'BWP' } } }), 422, 'FUNDING_BELOW_ESTIMATE');
    await expectError(call(ONALENNA, e.confirmFunding, { params: { requestId: 8 }, body: { ...funding, confirmedAmount: { amount: '420000.00', currency: 'USD' } } }), 422, 'FUNDING_CURRENCY_MISMATCH');
    await expectError(call(ONALENNA, e.confirmFunding, { params: { requestId: 8 }, body: { ...funding, fundingSourceId: 11 } }), 422, 'REFERENCE_NOT_FOUND');
    await expectError(call(TEBOGO, e.confirmFunding, { params: { requestId: 8 }, body: funding }), 403, 'FORBIDDEN');
  });

  it('escalates only when the caller’s authority is insufficient', async () => {
    await expectError(call(MPHO, e.escalateRequest, { params: { requestId: 8 }, body: { reason: 'x' } }), 409, 'AUTHORITY_SUFFICIENT');
    const escalated = RequestDecisionView.parse((await call(MPHO, e.escalateRequest, { params: { requestId: 3 }, body: { reason: 'Above my limit.' } })).body);
    expect(escalated.route.currentApprover?.userId).toBe(18);
  });

  it('never lets the procurement officer decide (no request.approve)', async () => {
    await expectError(call(TEBOGO, e.decideRequest, { params: { requestId: 8 }, body: { decision: 'reject', reason: 'x', subjectRevision: 1 } }), 403, 'FORBIDDEN');
  });
});
