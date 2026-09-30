import { beforeAll, describe, expect, it } from 'vitest';

import {
  ApprovalDetail,
  approvalEndpoints,
} from '../../../contracts/approvals.js';
import { WORKSPACE_AS_OF, tid, uid } from '../../fixtures/approvals/world.js';
import { allPersonas } from '../../persona.js';
import { createTestMockApp } from '../../testing/index.js';
import type { TestMockApp } from '../../testing/index.js';
import { register } from './index.js';
import { authorityCheck } from './view.js';

const EMAIL = (login: string): string => `${login}@tenderiq.local`;
const MPHO = EMAIL('mpho.manager');
const KEABETSWE = EMAIL('keabetswe.approver');
const TEBOGO = EMAIL('tebogo.officer');

let api: TestMockApp;

beforeAll(async () => {
  api = await createTestMockApp({ auth: 'fixture', modules: [{ name: 'approvals', register }] });
});

function detail(body: unknown): ApprovalDetail {
  return ApprovalDetail.parse(body);
}

describe('approvals module', () => {
  it('loads without skipped modules', () => {
    expect(api.failed).toEqual([]);
    expect(api.loaded).toContain('approvals');
  });

  it.each(allPersonas().filter((persona) => persona.status === 'active').map((persona) => [persona.email] as const))(
    'serves a contract-valid inbox for %s',
    async (email) => {
      const response = await api.callAs(email, approvalEndpoints.listMyApprovals, { query: { pageSize: 100 } });
      expect(response.status).toBe(200);
      const page = approvalEndpoints.listMyApprovals.response.parse(response.body);
      for (const row of page.items) {
        const opened = await api.callAs(email, approvalEndpoints.getMyApproval, { params: { approvalId: row.id } });
        expect(opened.status).toBe(200);
      }
    },
  );
});

describe('me.approvals.list', () => {
  it('lists the approvals a manager decides, including the one routed above his authority', async () => {
    const response = await api.callAs(MPHO, approvalEndpoints.listMyApprovals, { query: { pageSize: 100 } });
    const ids = approvalEndpoints.listMyApprovals.response.parse(response.body).items.map((row) => row.id);
    expect(ids).toEqual(expect.arrayContaining([30, 31, 36, 37, 43, 44, 305, 328, 1207]));
    expect(ids).not.toContain(34);
  });

  it('filters to the approvals awaiting the caller’s decision', async () => {
    const response = await api.callAs(KEABETSWE, approvalEndpoints.listMyApprovals, { query: { awaitingMyDecision: 'true' } });
    const rows = approvalEndpoints.listMyApprovals.response.parse(response.body).items;
    expect(rows.map((row) => row.id)).toEqual([306, 305, 39, 36]);
    expect(rows[0]?.myStep?.canDecide).toBe(true);
  });

  it('marks delegated work with the delegate involvement', async () => {
    const response = await api.callAs(MPHO, approvalEndpoints.listMyApprovals, { query: { involvement: 'delegate' } });
    const rows = approvalEndpoints.listMyApprovals.response.parse(response.body).items;
    expect(rows.map((row) => row.id)).toEqual([36]);
    expect(rows[0]?.myStep?.actingFor?.fullName).toBe('Keabetswe Nkwe');
  });

  it('gives supplier personas an empty inbox (buyer approvals never leak)', async () => {
    const response = await api.callAs(EMAIL('tsodilo.bidmanager'), approvalEndpoints.listMyApprovals);
    expect(approvalEndpoints.listMyApprovals.response.parse(response.body)).toMatchObject({ items: [], total: 0 });
  });

  it('counts only visible rows in the total', async () => {
    const response = await api.callAs(MPHO, approvalEndpoints.listMyApprovals, { query: { pageSize: 2 } });
    const page = approvalEndpoints.listMyApprovals.response.parse(response.body);
    expect(page.items).toHaveLength(2);
    expect(page.total).toBeGreaterThan(2);
  });
});

describe('me.approvals.get', () => {
  it('shows the manager that PR-2026-0003 exceeds his authority and was routed to Keabetswe (AC-05)', async () => {
    const view = detail((await api.callAs(MPHO, approvalEndpoints.getMyApproval, { params: { approvalId: 305 } })).body);
    expect(view.title).toBe('Approve PR-2026-0003 Northern wellfield pipeline extension');
    expect(view.amount).toEqual({ amount: '5120000.00', currency: 'BWP' });
    expect(view.myStep?.canDecide).toBe(false);
    expect(view.myStep?.blockers).toEqual(expect.arrayContaining(['authority_insufficient', 'not_current_step']));
    expect(view.routing?.reason).toBe('authority_exceeded');
    expect(view.routing?.routedTo?.fullName).toBe('Keabetswe Nkwe');
    expect(view.routing?.skippedLimit).toEqual({ amount: '2000000.00', currency: 'BWP' });
    expect(view.allowedDecisions).toEqual([]);
  });

  it('lets the routed approver decide with every decision the route permits', async () => {
    const view = detail((await api.callAs(KEABETSWE, approvalEndpoints.getMyApproval, { params: { approvalId: 305 } })).body);
    expect(view.authority?.sufficient).toBe(true);
    expect(view.allowedDecisions).toEqual(['approve', 'approve_with_conditions', 'reject', 'return']);
  });

  it('shows the invalidation by change with before and after values (AC-06)', async () => {
    const view = detail((await api.callAs(MPHO, approvalEndpoints.getMyApproval, { params: { approvalId: 31 } })).body);
    expect(view.status).toBe('invalidated');
    expect(view.subjectVersion).toBe(2);
    expect(view.currentSubjectVersion).toBe(3);
    expect(view.invalidation?.changes.map((change) => [change.key, change.before, change.after])).toEqual([
      ['lots', '2 lots', '3 lots'],
      ['overview', 'BWP 1,450,000.00', 'BWP 1,920,000.00'],
    ]);
    expect(view.myStep?.blockers).toEqual(expect.arrayContaining(['approval_not_pending', 'version_changed']));
  });

  it('lists the earlier returned approval of the same tender as a previous decision (AC-06)', async () => {
    const view = detail((await api.callAs(MPHO, approvalEndpoints.getMyApproval, { params: { approvalId: 31 } })).body);
    expect((view.relatedApprovals ?? []).map((row) => [row.id, row.status])).toEqual([[30, 'returned']]);
  });

  it('pins the evidence to the version captured with the snapshot, not the latest one (BR-10)', async () => {
    const view = detail((await api.callAs(MPHO, approvalEndpoints.getMyApproval, { params: { approvalId: 31 } })).body);
    expect(view.evidence).toEqual([expect.objectContaining({ documentId: 203, versionId: 2032, versionNo: 2, latestVersionNo: 3 })]);
  });

  it('converts a foreign-currency amount at the request-date rate and routes up without a rate', () => {
    const at = '2026-10-02T10:00:00Z';
    const converted = authorityCheck(tid('kwu'), uid('mpho.manager'), 'request_approval', { amount: '145000.00', currency: 'USD' }, at);
    expect(converted.conversion?.convertedAmount).toEqual({ amount: '1974900.00', currency: 'BWP' });
    expect(converted.sufficient).toBe(true);
    const missing = authorityCheck(tid('kwu'), uid('mpho.manager'), 'request_approval', { amount: '1000.00', currency: 'EUR' }, at);
    expect(missing).toMatchObject({ sufficient: false, missingExchangeRate: true, routedToNextLevel: true });
  });

  it('blocks a decision while the caller’s conflict is pending review', async () => {
    const view = detail((await api.callAs(MPHO, approvalEndpoints.getMyApproval, { params: { approvalId: 43 } })).body);
    expect(view.conflict).toMatchObject({ hasConflict: true, disposition: 'pending_review', blocksDecision: true });
  });

  it('hides evidence the viewer may not read', async () => {
    const view = detail((await api.callAs(KEABETSWE, approvalEndpoints.getMyApproval, { params: { approvalId: 305 } })).body);
    expect(view.evidence.map((item) => [item.documentId, item.versionId])).toEqual([
      [204, 2041],
      [205, 2051],
    ]);
  });

  it('answers 404 for an approval the caller is not involved in', async () => {
    const response = await api.callAs(EMAIL('pule.auditor'), approvalEndpoints.getMyApproval, { params: { approvalId: 305 } });
    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ code: 'APPROVAL_NOT_FOUND' });
  });
});

describe('me.approvals.decide', () => {
  const base = (approvalId: number, version: number, hash: string) => ({ params: { approvalId }, tenant: 'kwu' as const, body: { subjectVersion: version, contentHash: hash } });

  async function current(email: string, approvalId: number): Promise<ApprovalDetail> {
    return detail((await api.callAs(email, approvalEndpoints.getMyApproval, { params: { approvalId } })).body);
  }

  it('approves the exact version and closes the approval', async () => {
    const view = await current(MPHO, 328);
    const request = base(328, view.subjectVersion, view.contentHash);
    const response = await api.callAs(MPHO, approvalEndpoints.decideApproval, { ...request, body: { ...request.body, decision: 'approve' } });
    expect(response.status).toBe(200);
    const outcome = detail(response.body);
    expect(outcome).toMatchObject({ status: 'approved', myStep: { status: 'approved', canDecide: false } });
    // Stamped on the storyline clock: never before the records it acts on.
    expect(Date.parse(outcome.decidedAt ?? '')).toBeGreaterThanOrEqual(Date.parse(WORKSPACE_AS_OF));
  });

  it('keeps a sequential approval pending for the next step after the first approves', async () => {
    const view = await current(EMAIL('dineo.legal'), 42);
    const request = base(42, view.subjectVersion, view.contentHash);
    const response = await api.callAs(EMAIL('dineo.legal'), approvalEndpoints.decideApproval, {
      ...request,
      body: { ...request.body, decision: 'approve' },
    });
    const outcome = detail(response.body);
    expect(outcome.status).toBe('pending');
    expect(outcome.currentStep?.approver?.fullName).toBe('Keabetswe Nkwe');
  });

  it('requires a reason to reject', async () => {
    const view = await current(MPHO, 328);
    const request = base(328, view.subjectVersion, view.contentHash);
    const response = await api.callAs(MPHO, approvalEndpoints.decideApproval, { ...request, body: { ...request.body, decision: 'reject' } });
    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ errors: [{ field: 'reason', code: 'REASON_REQUIRED' }] });
  });

  it.each([
    ['APPROVAL_INVALIDATED', MPHO, 31],
    ['NOT_CURRENT_STEP', MPHO, 305],
    ['CONFLICT_UNRESOLVED', MPHO, 43],
    ['SOD_SELF_APPROVAL_BLOCKED', MPHO, 44],
    ['APPROVAL_NOT_PENDING', KEABETSWE, 35],
    ['APPROVAL_EXPIRED', EMAIL('onalenna.budget'), 45],
  ] as const)('answers %s where the fixture state implies it', async (code, email, approvalId) => {
    const view = await current(email, approvalId);
    const request = base(approvalId, view.subjectVersion, view.contentHash);
    const response = await api.callAs(email, approvalEndpoints.decideApproval, {
      ...request,
      body: { ...request.body, decision: 'approve' },
    });
    expect(response.body).toMatchObject({ code });
  });

  it('refuses a conditional approval where the route does not permit one', async () => {
    const view = await current(EMAIL('onalenna.budget'), 34);
    const request = base(34, view.subjectVersion, view.contentHash);
    const response = await api.callAs(EMAIL('onalenna.budget'), approvalEndpoints.decideApproval, {
      ...request,
      body: { ...request.body, decision: 'approve_with_conditions', reason: 'Budget tight', conditions: 'Phase deliveries' },
    });
    expect(response.body).toMatchObject({ code: 'CONDITIONS_NOT_PERMITTED' });
  });

  it('refuses a decision on a version other than the one under approval', async () => {
    const view = await current(MPHO, 328);
    const response = await api.callAs(MPHO, approvalEndpoints.decideApproval, {
      ...base(328, view.subjectVersion + 1, view.contentHash),
      body: { subjectVersion: view.subjectVersion + 1, contentHash: view.contentHash, decision: 'approve' },
    });
    expect(response.body).toMatchObject({ code: 'APPROVAL_VERSION_MISMATCH' });
  });

  it('lets a delegate decide within the delegation and records whom they acted for', async () => {
    const view = await current(MPHO, 36);
    const request = base(36, view.subjectVersion, view.contentHash);
    const response = await api.callAs(MPHO, approvalEndpoints.decideApproval, { ...request, body: { ...request.body, decision: 'approve' } });
    const outcome = detail(response.body);
    expect(outcome.status).toBe('approved');
    expect(outcome.steps[0]?.actingFor?.fullName).toBe('Keabetswe Nkwe');
    expect(outcome.authority?.basis).toBe('delegation');
  });

  it('answers the one identical 403 when the row tenant header names another organization', async () => {
    const view = await current(MPHO, 328);
    const request = base(328, view.subjectVersion, view.contentHash);
    const response = await api.callAs(MPHO, approvalEndpoints.decideApproval, {
      ...request,
      tenant: 'odc',
      body: { ...request.body, decision: 'approve' },
    });
    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ code: 'TENANT_ACCESS_DENIED' });
  });

  it('answers 403 FORBIDDEN to a member without approval.decide', async () => {
    const response = await api.callAs(TEBOGO, approvalEndpoints.decideApproval, {
      params: { approvalId: 31 },
      tenant: 'kwu',
      body: { decision: 'approve', subjectVersion: 3, contentHash: 'a'.repeat(64) },
    });
    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('buyer approval panels', () => {
  it('shows the subject history with the invalidated approval and allows a new request (AC-06)', async () => {
    const response = await api.callAs(TEBOGO, approvalEndpoints.getSubjectApprovals, {
      params: { subjectType: 'tender_release', subjectId: 5 },
      tenant: 'kwu',
    });
    const panel = approvalEndpoints.getSubjectApprovals.response.parse(response.body);
    expect(panel.history.map((row) => [row.id, row.status])).toEqual([
      [31, 'invalidated'],
      [30, 'returned'],
    ]);
    expect(panel.current).toBeNull();
    expect(panel.canRequest).toBe(true);
  });

  it('keeps another buyer’s approvals out of reach (tenant isolation)', async () => {
    const panel = await api.callAs(EMAIL('officer.odc'), approvalEndpoints.getSubjectApprovals, {
      params: { subjectType: 'tender_release', subjectId: 5 },
      tenant: 'odc',
    });
    expect(approvalEndpoints.getSubjectApprovals.response.parse(panel.body).history).toEqual([]);
    const single = await api.callAs(EMAIL('officer.odc'), approvalEndpoints.getApproval, { params: { approvalId: 31 }, tenant: 'odc' });
    expect(single.status).toBe(404);
  });

  it('answers 403 to a supplier persona on a buyer route', async () => {
    const response = await api.callAs(EMAIL('tsodilo.admin'), approvalEndpoints.getApproval, { params: { approvalId: 31 }, tenant: 'tsodilo' });
    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ code: 'TENANT_ACCESS_DENIED' });
  });

  it('routes a request above the manager’s limit to the executive (AC-05)', async () => {
    const response = await api.callAs(TEBOGO, approvalEndpoints.checkAuthority, {
      tenant: 'kwu',
      query: { subjectType: 'procurement_request', amount: '5120000.00', currency: 'BWP' },
    });
    const hint = approvalEndpoints.checkAuthority.response.parse(response.body);
    expect(hint.routedToNextLevel).toBe(true);
    expect(hint.skippedLevel?.fullName).toBe('Mpho Dikgang');
    expect(hint.eligibleApprovers.map((approver) => approver.fullName)).toEqual(['Keabetswe Nkwe']);
  });

  it('answers NO_ELIGIBLE_APPROVER when nobody holds the authority', async () => {
    const response = await api.callAs(TEBOGO, approvalEndpoints.checkAuthority, {
      tenant: 'kwu',
      query: { subjectType: 'procurement_request', amount: '25000000.00', currency: 'BWP' },
    });
    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ code: 'NO_ELIGIBLE_APPROVER' });
  });

  it('requests a routed approval for the exact version', async () => {
    const response = await api.callAs(TEBOGO, approvalEndpoints.requestApproval, {
      tenant: 'kwu',
      body: {
        subjectType: 'tender_release',
        subjectId: 5,
        subjectVersion: 3,
        contentHash: 'b'.repeat(64),
        title: 'Release T-2026-0005 revision 3',
        amount: { amount: '1920000.00', currency: 'BWP' },
        justification: 'Lot 3 added and the value revised; revision 3 needs approval.',
      },
    });
    expect(response.status).toBe(201);
    expect(detail(response.body)).toMatchObject({
      status: 'pending',
      subjectVersion: 3,
      subjectLinkPath: '/buyer/tenders/5/release',
      currentStep: { approver: { fullName: 'Mpho Dikgang' } },
    });
  });

  it('refuses a request for a stale version and a duplicate pending request', async () => {
    const stale = await api.callAs(TEBOGO, approvalEndpoints.requestApproval, {
      tenant: 'kwu',
      body: { subjectType: 'tender_release', subjectId: 5, subjectVersion: 2, contentHash: 'b'.repeat(64), title: 'Release', justification: 'Retry' },
    });
    expect(stale.body).toMatchObject({ code: 'SUBJECT_VERSION_MISMATCH' });
    const duplicate = await api.callAs(EMAIL('kagiso.requester'), approvalEndpoints.requestApproval, {
      tenant: 'kwu',
      body: { subjectType: 'procurement_request', subjectId: 3, subjectVersion: 1, contentHash: 'b'.repeat(64), title: 'Again', justification: 'Retry' },
    });
    expect(duplicate.body).toMatchObject({ code: 'APPROVAL_ALREADY_PENDING' });
  });

  it('lets only the requester withdraw a pending approval', async () => {
    const other = await api.callAs(EMAIL('kagiso.requester'), approvalEndpoints.withdrawApproval, {
      params: { approvalId: 328 },
      tenant: 'kwu',
      body: { reason: 'Not needed' },
    });
    expect(other.status).toBe(403);
    const own = await api.callAs(TEBOGO, approvalEndpoints.withdrawApproval, {
      params: { approvalId: 328 },
      tenant: 'kwu',
      body: { reason: 'Motors repaired under warranty; no purchase needed' },
    });
    expect(detail(own.body).status).toBe('withdrawn');
  });
});
