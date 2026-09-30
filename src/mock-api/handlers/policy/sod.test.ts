/**
 * BR-07 for configuration approvals (ADM-06, ADM-08, ADM-11): the pure decision, and the handlers when the
 * organization has NOT documented alternative oversight (the governance fixture is replaced by an empty list here),
 * so the sole approver's own submissions are blocked with 403 SOD_SELF_APPROVAL_BLOCKED.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { PolicyVersionDetail, PortalPolicy, TemplateDetail, policyEndpoints as p } from '../../../contracts/policy.js';
import { createTestMockApp } from '../../testing/index.js';
import type { TestMockApp, TestResponse } from '../../testing/index.js';
import { decideSelfApproval, otherPermissionHolders } from './common.js';

vi.mock('../../fixtures/policy/governance.js', () => ({ CONFIGURATION_OVERSIGHT: [] }));

const ADMIN_KWU = 'admin.kwu@tenderiq.local';
const KWU_TENANT_ID = 2;
const ADMIN_KWU_ID = 3;

let api: TestMockApp;

beforeAll(async () => {
  api = await createTestMockApp();
});

function problemCode(response: TestResponse): string {
  const body = response.body as { code?: string; errors?: Array<{ code: string }> };
  return body.code ?? body.errors?.[0]?.code ?? '';
}

describe('decideSelfApproval', () => {
  const base = { callerId: 3, submitterId: 3, otherApproverCount: 0, oversightNote: 'Audit reviews it.', subject: 'version' };

  it('allows a caller who did not submit the item, without an oversight note', () => {
    expect(decideSelfApproval({ ...base, submitterId: 4 })).toEqual({ allowed: true, blockedReason: null, oversightNote: null });
    expect(decideSelfApproval({ ...base, submitterId: null })).toEqual({ allowed: true, blockedReason: null, oversightNote: null });
  });

  it('blocks the submitter when another approver exists, even with documented oversight', () => {
    const decision = decideSelfApproval({ ...base, otherApproverCount: 1 });
    expect(decision.allowed).toBe(false);
    expect(decision.blockedReason).toBe('You submitted this version, so another approver must decide it (BR-07).');
  });

  it('allows the sole approver under documented oversight and returns the note', () => {
    expect(decideSelfApproval(base)).toEqual({ allowed: true, blockedReason: null, oversightNote: 'Audit reviews it.' });
  });

  it('blocks the sole approver when no oversight is documented', () => {
    const decision = decideSelfApproval({ ...base, oversightNote: null, subject: 'proposal' });
    expect(decision.allowed).toBe(false);
    expect(decision.blockedReason).toContain('no alternative oversight is documented');
  });
});

describe('otherPermissionHolders', () => {
  it('finds nobody else holding policy approval at KWU, where the administrator is the only org_admin', () => {
    expect(otherPermissionHolders(KWU_TENANT_ID, 'org.policy.approve', ADMIN_KWU_ID)).toEqual([]);
  });

  it('finds the administrator when someone else asks', () => {
    expect(otherPermissionHolders(KWU_TENANT_ID, 'org.portal.manage', 4)).toEqual([ADMIN_KWU_ID]);
  });
});

describe('handlers without documented oversight', () => {
  it('blocks approving one’s own policy version with 403 and explains why on the version', async () => {
    const response = await api.callAs(ADMIN_KWU, p.approvePolicyVersion, { tenant: 'kwu', params: { profileId: 1, versionId: 3 }, body: {} });
    expect(response.status).toBe(403);
    expect(problemCode(response)).toBe('SOD_SELF_APPROVAL_BLOCKED');
    const version = PolicyVersionDetail.parse(
      (await api.callAs(ADMIN_KWU, p.getPolicyVersion, { tenant: 'kwu', params: { profileId: 1, versionId: 3 } })).body,
    );
    expect(version.capabilities).toMatchObject({ canApprove: false, canReturn: true, alternativeOversightNote: null });
    expect(version.capabilities.approvalBlockedReason).toContain('BR-07');
  });

  it('blocks approving one’s own template version with 403', async () => {
    const response = await api.callAs(ADMIN_KWU, p.approveTemplateVersion, { tenant: 'kwu', params: { templateId: 3, versionId: 6 }, body: {} });
    expect(response.status).toBe(403);
    expect(problemCode(response)).toBe('SOD_SELF_APPROVAL_BLOCKED');
    const template = TemplateDetail.parse((await api.callAs(ADMIN_KWU, p.getTemplate, { tenant: 'kwu', params: { templateId: 3 } })).body);
    expect(template.capabilities.canApprove).toBe(false);
    expect(template.capabilities.approvalBlockedReason).toContain('BR-07');
  });

  it('blocks approving one’s own portal proposal with 403 and offers only return and withdraw', async () => {
    const response = await api.callAs(ADMIN_KWU, p.approvePortalProposal, { tenant: 'kwu', body: { disclosureReviewed: true } });
    expect(response.status).toBe(403);
    expect(problemCode(response)).toBe('SOD_SELF_APPROVAL_BLOCKED');
    const policy = PortalPolicy.parse((await api.callAs(ADMIN_KWU, p.getPortalPolicy, { tenant: 'kwu' })).body);
    expect(policy.capabilities).toMatchObject({ canApprove: false, canReturn: true, canWithdraw: true, alternativeOversightNote: null });
    expect(policy.capabilities.approvalBlockedReason).toContain('BR-07');
  });
});
