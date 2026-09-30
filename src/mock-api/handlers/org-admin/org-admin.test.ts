/**
 * Handler tests of the org-admin mock API: tenant filtering, supplier isolation, 403 for the wrong tenant kind or a
 * missing permission, `/me` audience isolation, the declared business errors and contract-valid responses.
 * Runs offline with the test-only fixture verifier (`auth: 'fixture'`); real sign-in is covered by the platform
 * tests of the foundation.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { orgAdminEndpoints as ep } from '../../../contracts/org-admin.js';
import type { AnyEndpoint } from '../../../contracts/endpoint.js';
import { createTestMockApp } from '../../testing/index.js';
import type { TestMockApp, TestResponse } from '../../testing/index.js';

const NOW = new Date('2026-09-30T08:00:00Z');
const email = (login: string) => `${login}@tenderiq.local`;

let api: TestMockApp;

beforeAll(async () => {
  api = await createTestMockApp({ now: () => NOW });
});

function parsed<E extends AnyEndpoint>(endpoint: E, response: TestResponse) {
  expect(response.status, response.text).toBe(endpoint.status);
  return endpoint.response.parse(response.body) as ReturnType<E['response']['parse']>;
}

function problemCode(response: TestResponse): string | undefined {
  return (response.body as { code?: string } | null)?.code;
}

describe('org-admin module registration', () => {
  it('loads the org-admin handler module without failures', () => {
    expect(api.loaded).toContain('org-admin/index');
    expect(api.failed.map((failure) => failure.module)).not.toContain('org-admin/index');
  });

  it('mounts every org-admin endpoint', () => {
    const missing = Object.values(ep)
      .map((endpoint) => endpoint.id)
      .filter((id) => !api.endpointIds.includes(id));
    expect(missing).toEqual([]);
  });
});

describe('contract-valid reads for every audience', () => {
  const buyerReads = [
    ep.buyerListMembers,
    ep.buyerListInvitations,
    ep.buyerListRoles,
    ep.buyerGetRoleCatalog,
    ep.buyerListGroups,
    ep.getOrganization,
    ep.legalEntitiesList,
    ep.departmentsList,
    ep.locationsList,
    ep.categoriesList,
    ep.costCentersList,
    ep.fundingSourcesList,
    ep.listCategoryCatalog,
    ep.listAccessGrants,
    ep.listAccessRestrictions,
    ep.listAccessFindings,
    ep.listConflictDeclarations,
    ep.listSodPolicies,
    ep.listAuthorityLimits,
    ep.listDelegations,
    ep.listCommittees,
  ];

  it.each(['kwu', 'odc'])('answers every buyer list for the %s administrator with contract-valid bodies', async (slug) => {
    for (const endpoint of buyerReads) {
      const response = await api.callAs(email(`admin.${slug}`), endpoint, { tenant: slug });
      expect(response.status, `${endpoint.id}: ${response.text}`).toBe(200);
      expect(() => endpoint.response.parse(response.body), endpoint.id).not.toThrow();
    }
  });

  const supplierReads = [
    ep.supplierListMembers,
    ep.supplierListInvitations,
    ep.supplierListRoles,
    ep.supplierGetRoleCatalog,
    ep.supplierListGroups,
    ep.listAssignableTenders,
    ep.listTenderAssignments,
    ep.listSupplierAuthority,
  ];

  it.each(['tsodilo', 'chobe-pipe', 'serowe-ict', 'gaborone-meter', 'makgadikgadi', 'limpopo-env'])(
    'answers every supplier list for the %s administrator with contract-valid bodies',
    async (slug) => {
      for (const endpoint of supplierReads) {
        const response = await api.callAs(email(`${slug}.admin`), endpoint, { tenant: slug });
        expect(response.status, `${endpoint.id}: ${response.text}`).toBe(200);
        expect(() => endpoint.response.parse(response.body), endpoint.id).not.toThrow();
      }
    },
  );

  it.each(['sam.dual', 'ops.admin', 'tebogo.officer', 'tsodilo.contributor', 'dineo.legal'])(
    'answers the personal reads of %s with contract-valid bodies',
    async (login) => {
      for (const endpoint of [ep.listMyMemberships, ep.getMyProfile, ep.getMyAccessSummary]) {
        const response = await api.callAs(email(login), endpoint);
        expect(response.status, `${endpoint.id}: ${response.text}`).toBe(200);
        expect(() => endpoint.response.parse(response.body), endpoint.id).not.toThrow();
      }
    },
  );

  it('answers every buyer member detail, deactivation review and effective access of KWU', async () => {
    const members = parsed(ep.buyerListMembers, await api.callAs(email('admin.kwu'), ep.buyerListMembers, { tenant: 'kwu', query: { pageSize: 100 } }));
    expect(members.total).toBeGreaterThan(20);
    for (const member of members.items) {
      for (const endpoint of [ep.buyerGetMember, ep.buyerGetDeactivationReview, ep.getEffectiveAccess]) {
        const response = await api.callAs(email('admin.kwu'), endpoint, { tenant: 'kwu', params: { userId: member.userId } });
        expect(response.status, `${endpoint.id} ${member.fullName}: ${response.text}`).toBe(200);
        expect(() => endpoint.response.parse(response.body)).not.toThrow();
      }
    }
  });

  it('answers every role, group, committee and conflict detail of KWU', async () => {
    const admin = email('admin.kwu');
    const roles = parsed(ep.buyerListRoles, await api.callAs(admin, ep.buyerListRoles, { tenant: 'kwu', query: { pageSize: 100 } }));
    for (const role of roles.items) {
      parsed(ep.buyerGetRole, await api.callAs(admin, ep.buyerGetRole, { tenant: 'kwu', params: { roleId: role.roleId } }));
    }
    const groups = parsed(ep.buyerListGroups, await api.callAs(admin, ep.buyerListGroups, { tenant: 'kwu' }));
    for (const group of groups.items) {
      parsed(ep.buyerGetGroup, await api.callAs(admin, ep.buyerGetGroup, { tenant: 'kwu', params: { groupId: group.groupId } }));
    }
    const committees = parsed(ep.listCommittees, await api.callAs(admin, ep.listCommittees, { tenant: 'kwu' }));
    for (const committee of committees.items) {
      parsed(ep.getCommittee, await api.callAs(admin, ep.getCommittee, { tenant: 'kwu', params: { committeeId: committee.committeeId } }));
    }
    const conflicts = parsed(ep.listConflictDeclarations, await api.callAs(admin, ep.listConflictDeclarations, { tenant: 'kwu' }));
    for (const declaration of conflicts.items) {
      parsed(
        ep.getConflictDeclaration,
        await api.callAs(admin, ep.getConflictDeclaration, { tenant: 'kwu', params: { declarationId: declaration.declarationId } }),
      );
    }
  });

  it('answers every supplier member detail of Tsodilo', async () => {
    const members = parsed(ep.supplierListMembers, await api.callAs(email('tsodilo.admin'), ep.supplierListMembers, { tenant: 'tsodilo' }));
    for (const member of members.items) {
      parsed(ep.supplierGetMember, await api.callAs(email('tsodilo.admin'), ep.supplierGetMember, { tenant: 'tsodilo', params: { userId: member.userId } }));
    }
  });
});

describe('tenant filtering and isolation', () => {
  it('lists only the active buyer tenant’s members', async () => {
    const odc = parsed(ep.buyerListMembers, await api.callAs(email('admin.odc'), ep.buyerListMembers, { tenant: 'odc' }));
    const names = odc.items.map((row) => row.fullName);
    expect(names).toContain('Wame Olebile');
    expect(names).not.toContain('Tebogo Molefe');
  });

  it('answers 404 for another buyer’s member, as if it did not exist', async () => {
    const response = await api.callAs(email('admin.odc'), ep.buyerGetMember, { tenant: 'odc', params: { userId: 5 } });
    expect(response.status).toBe(404);
  });

  it('never shows one supplier’s members, assignments or authority to another supplier', async () => {
    const tsodilo = parsed(ep.supplierListMembers, await api.callAs(email('tsodilo.admin'), ep.supplierListMembers, { tenant: 'tsodilo' }));
    expect(tsodilo.items.map((row) => row.fullName)).not.toContain('Chedza Ramokate');
    const assignments = parsed(
      ep.listTenderAssignments,
      await api.callAs(email('chobe-pipe.admin'), ep.listTenderAssignments, { tenant: 'chobe-pipe', query: { pageSize: 100 } }),
    );
    expect(assignments.items.map((row) => row.member.fullName)).not.toContain('Ditiro Kebonang');
    const foreign = await api.callAs(email('chobe-pipe.admin'), ep.supplierGetMember, { tenant: 'chobe-pipe', params: { userId: 26 } });
    expect(foreign.status).toBe(404);
  });

  it('answers the identical 403 when a supplier calls a buyer endpoint', async () => {
    const response = await api.callAs(email('tsodilo.admin'), ep.buyerListMembers, { tenant: 'tsodilo' });
    expect(response.status).toBe(403);
    expect(problemCode(response)).toBe('TENANT_ACCESS_DENIED');
  });

  it('answers the identical 403 when a buyer administrator calls a supplier endpoint', async () => {
    const response = await api.callAs(email('admin.kwu'), ep.supplierListMembers, { tenant: 'kwu' });
    expect(response.status).toBe(403);
    expect(problemCode(response)).toBe('TENANT_ACCESS_DENIED');
  });

  it('answers the identical 403 for a tenant the caller does not belong to', async () => {
    const response = await api.callAs(email('admin.odc'), ep.buyerListMembers, { tenant: 'kwu' });
    expect(response.status).toBe(403);
    expect(problemCode(response)).toBe('TENANT_ACCESS_DENIED');
  });

  it('answers 403 FORBIDDEN when a procurement officer opens the user directory', async () => {
    const response = await api.callAs(email('tebogo.officer'), ep.buyerListMembers, { tenant: 'kwu' });
    expect(response.status).toBe(403);
    expect(problemCode(response)).toBe('FORBIDDEN');
  });

  it('lets the auditor read the directory but not invite anybody', async () => {
    expect((await api.callAs(email('pule.auditor'), ep.buyerListMembers, { tenant: 'kwu' })).status).toBe(200);
    const invite = await api.callAs(email('pule.auditor'), ep.buyerInviteMember, {
      tenant: 'kwu',
      body: { email: 'new@kwu.co.bw', fullName: 'New Person', capacity: 'Analyst', roleIds: [203], groupIds: [], expiresInDays: 14, message: null },
    });
    expect(invite.status).toBe(403);
  });

  it('keeps a contributor out of supplier administration so they cannot grant themselves authority (AC-03)', async () => {
    const list = await api.callAs(email('tsodilo.contributor'), ep.supplierListMembers, { tenant: 'tsodilo' });
    expect(list.status).toBe(403);
    const selfGrant = await api.callAs(email('tsodilo.contributor'), ep.setSubmissionAuthority, {
      tenant: 'tsodilo',
      params: { userId: 26 },
      body: { granted: true, scope: { scopeType: 'organization', scopeId: null }, reason: 'I want to submit.' },
    });
    expect(selfGrant.status).toBe(403);
    expect(problemCode(selfGrant)).toBe('FORBIDDEN');
  });

  it('shows the contributor without submission authority on the supplier authority list (AC-03)', async () => {
    const page = parsed(ep.listSupplierAuthority, await api.callAs(email('tsodilo.admin'), ep.listSupplierAuthority, { tenant: 'tsodilo' }));
    const contributor = page.items.find((row) => row.member.userId === 26);
    expect(contributor?.canPrepare).toBe(true);
    expect(contributor?.canSubmit).toBe(false);
    const signatory = page.items.find((row) => row.member.userId === 27);
    expect(signatory?.canSubmit).toBe(true);
    expect(signatory?.signingLimit?.maxAmount).toEqual({ amount: '5000000.00', currency: 'BWP' });
  });

  it('offers a supplier administrator only supplier permissions and templates', async () => {
    const catalog = parsed(ep.supplierGetRoleCatalog, await api.callAs(email('tsodilo.admin'), ep.supplierGetRoleCatalog, { tenant: 'tsodilo' }));
    expect(catalog.permissions.every((permission) => permission.code.startsWith('supplier.'))).toBe(true);
    expect(catalog.templates.map((template) => template.code)).not.toContain('org_admin');
    const buyer = parsed(ep.buyerGetRoleCatalog, await api.callAs(email('admin.kwu'), ep.buyerGetRoleCatalog, { tenant: 'kwu' }));
    expect(buyer.permissions.some((permission) => permission.code.startsWith('supplier.org'))).toBe(false);
    expect(buyer.permissions.map((permission) => permission.code)).not.toContain('support.view');
  });
});

describe('personal audience (/me)', () => {
  it('lists the dual-capacity person’s memberships with the pending one explained (AC-02, COM-02)', async () => {
    const page = parsed(ep.listMyMemberships, await api.callAs(email('sam.dual'), ep.listMyMemberships));
    expect(page.items.map((row) => row.organization.tenantName)).toEqual(
      expect.arrayContaining(['Kalahari Water Utilities (Pilot)', 'Tsodilo Engineering', 'Chobe Pipe & Valve Supplies', 'Serowe ICT Solutions']),
    );
    expect(page.summary.holdsBuyerAndSupplierMemberships).toBe(true);
    const pending = page.items.find((row) => row.status === 'pending_approval');
    expect(pending?.explanation).toMatch(/waiting/);
    expect(pending?.canWithdraw).toBe(true);
  });

  it('never returns another person’s memberships', async () => {
    const page = parsed(ep.listMyMemberships, await api.callAs(email('tebogo.officer'), ep.listMyMemberships));
    expect(page.items).toHaveLength(1);
    expect(page.summary.holdsBuyerAndSupplierMemberships).toBe(false);
  });

  it('filters memberships by tenant kind', async () => {
    const page = parsed(ep.listMyMemberships, await api.callAs(email('sam.dual'), ep.listMyMemberships, { query: { kind: 'supplier' } }));
    expect(page.items.every((row) => row.organization.tenantKind === 'supplier')).toBe(true);
  });

  it('withdraws the pending membership request', async () => {
    const page = parsed(ep.listMyMemberships, await api.callAs(email('sam.dual'), ep.listMyMemberships, { query: { status: 'pending_approval' } }));
    const membershipId = page.items[0]?.membershipId ?? 0;
    const withdrawn = parsed(
      ep.withdrawMembershipRequest,
      await api.callAs(email('sam.dual'), ep.withdrawMembershipRequest, { params: { membershipId }, body: {} }),
    );
    expect(withdrawn.status).toBe('revoked');
  });

  it('refuses to end a membership while formal work is assigned', async () => {
    const page = parsed(ep.listMyMemberships, await api.callAs(email('sam.dual'), ep.listMyMemberships, { query: { kind: 'buyer' } }));
    const response = await api.callAs(email('sam.dual'), ep.leaveMembership, {
      params: { membershipId: page.items[0]?.membershipId ?? 0 },
      body: { reason: 'Leaving', confirmHistoryRetained: true },
    });
    expect(response.status).toBe(409);
    expect(problemCode(response)).toBe('OPEN_WORK_EXISTS');
  });

  it('refuses to let the only administrator leave', async () => {
    const page = parsed(ep.listMyMemberships, await api.callAs(email('admin.odc'), ep.listMyMemberships));
    const response = await api.callAs(email('admin.odc'), ep.leaveMembership, {
      params: { membershipId: page.items[0]?.membershipId ?? 0 },
      body: { reason: 'Leaving', confirmHistoryRetained: true },
    });
    expect(problemCode(response)).toBe('LAST_ADMINISTRATOR');
  });

  it('shows pending contact changes on the profile and refuses a second one for the same detail', async () => {
    const profile = parsed(ep.getMyProfile, await api.callAs(email('tebogo.officer'), ep.getMyProfile));
    expect(profile.pendingContactChanges.map((change) => change.field)).toEqual(['phone']);
    const again = await api.callAs(email('tebogo.officer'), ep.requestContactChange, { body: { field: 'phone', newValue: '+267 71 555 000' } });
    expect(problemCode(again)).toBe('CONTACT_CHANGE_PENDING');
    const email1 = await api.callAs(email('tebogo.officer'), ep.requestContactChange, { body: { field: 'email', newValue: 'mpho.manager@tenderiq.local' } });
    expect(problemCode(email1)).toBe('EMAIL_IN_USE');
    const same = await api.callAs(email('tebogo.officer'), ep.requestContactChange, { body: { field: 'email', newValue: 'tebogo.officer@tenderiq.local' } });
    expect(problemCode(same)).toBe('SAME_AS_CURRENT');
    const created = await api.callAs(email('tebogo.officer'), ep.requestContactChange, { body: { field: 'email', newValue: 'tebogo@kwu.co.bw' } });
    expect(parsed(ep.requestContactChange, created).status).toBe('pending_confirmation');
  });

  it('rejects an invalid phone number with a field error', async () => {
    const response = await api.callAs(email('tebogo.officer'), ep.requestContactChange, { body: { field: 'phone', newValue: 'call me' } });
    expect(response.status).toBe(422);
    expect(JSON.stringify(response.body)).toContain('INVALID_PHONE');
  });

  it('cancels a pending change and refuses to cancel a confirmed one', async () => {
    expect(parsed(ep.cancelContactChange, await api.callAs(email('sam.dual'), ep.cancelContactChange, { params: { changeId: 2 } })).status).toBe('cancelled');
    expect(problemCode(await api.callAs(email('sam.dual'), ep.cancelContactChange, { params: { changeId: 3 } }))).toBe('CONTACT_CHANGE_NOT_PENDING');
    expect((await api.callAs(email('tebogo.officer'), ep.cancelContactChange, { params: { changeId: 2 } })).status).toBe(404);
  });

  it('updates the profile name, language and display zone', async () => {
    const profile = parsed(
      ep.updateMyProfile,
      await api.callAs(email('tebogo.officer'), ep.updateMyProfile, { body: { fullName: 'Tebogo K. Molefe', locale: 'en-GB', displayTimeZone: 'Europe/London' } }),
    );
    expect(profile.fullName).toBe('Tebogo K. Molefe');
    expect(profile.officialTimeZones[0]?.timeZone).toBe('Africa/Gaborone');
  });

  it('reports the personal access of each active organization', async () => {
    const summary = parsed(ep.getMyAccessSummary, await api.callAs(email('mpho.manager'), ep.getMyAccessSummary));
    const kwu = summary.organizations[0];
    expect(kwu?.delegationsReceived.some((item) => item.counterpart?.fullName === 'Keabetswe Nkwe')).toBe(true);
    expect(kwu?.delegationsGiven.length).toBeGreaterThan(0);
  });
});

describe('invitations (COM-01)', () => {
  it('previews an invitation publicly without exposing the full e-mail', async () => {
    const response = await api.request('GET', '/api/v1/public/invitations/odc-inv-dineo-masire-3b9e7a12');
    const preview = parsed(ep.previewInvitation, response);
    expect(preview.organizationName).toBe('Okavango District Council');
    expect(preview.emailMasked).toBe('d***@tenderiq.local');
    expect(preview.status).toBe('pending');
  });

  it('answers 404 for an unknown invitation link', async () => {
    expect((await api.request('GET', '/api/v1/public/invitations/unknown-token-000000000')).status).toBe(404);
  });

  it('reports a pending invitation past its expiry as expired (request-time check)', async () => {
    const preview = parsed(ep.previewInvitation, await api.request('GET', '/api/v1/public/invitations/chobe-inv-dikeledi-phiri-0d5e7f18'));
    expect(preview.status).toBe('expired');
  });

  it('accepts an invitation addressed to the caller and activates the membership', async () => {
    const result = parsed(
      ep.acceptInvitation,
      await api.callAs(email('dineo.legal'), ep.acceptInvitation, { params: { token: 'odc-inv-dineo-masire-3b9e7a12' }, body: { confirmCapacity: true } }),
    );
    expect(result.membership.status).toBe('active');
    expect(result.membership.organization.tenantName).toBe('Okavango District Council');
  });

  it.each([
    ['odc-inv-dineo-masire-3b9e7a12', 'tebogo.officer', 'INVITATION_EMAIL_MISMATCH'],
    ['kwu-inv-kopano-dube-5a1d93e0', 'tebogo.officer', 'INVITATION_EXPIRED'],
    ['kwu-inv-lebogang-seane-9ab3f40c', 'tebogo.officer', 'INVITATION_REVOKED'],
    ['kwu-inv-sam-keitumetse-0b7d6e21', 'sam.dual', 'INVITATION_ALREADY_ACCEPTED'],
    ['kwu-inv-mothusi-kgari-1e44a0b8', 'tebogo.officer', 'INVITATION_SUPERSEDED'],
  ])('refuses token %s for %s with %s', async (token, login, code) => {
    const response = await api.callAs(email(login), ep.acceptInvitation, { params: { token }, body: { confirmCapacity: true } });
    expect(problemCode(response)).toBe(code);
  });

  it('requires the capacity confirmation', async () => {
    const response = await api.callAs(email('dineo.legal'), ep.acceptInvitation, { params: { token: 'odc-inv-dineo-masire-3b9e7a12' }, body: {} });
    expect(response.status).toBe(422);
  });
});

describe('member lifecycle (ADM-03, SUP-04, AC-04)', () => {
  const admin = email('admin.kwu');

  it('filters the directory by status, open work and search', async () => {
    const invited = parsed(ep.buyerListMembers, await api.callAs(admin, ep.buyerListMembers, { tenant: 'kwu', query: { status: 'invited' } }));
    expect(invited.items.every((row) => row.membershipStatus === 'invited')).toBe(true);
    expect(invited.items.find((row) => row.fullName === 'Kopano Dube')?.invitation?.status).toBe('expired');
    const busy = parsed(ep.buyerListMembers, await api.callAs(admin, ep.buyerListMembers, { tenant: 'kwu', query: { hasOpenWork: 'true' } }));
    expect(busy.items.every((row) => row.openWorkCount > 0)).toBe(true);
    const search = parsed(ep.buyerListMembers, await api.callAs(admin, ep.buyerListMembers, { tenant: 'kwu', query: { q: 'letsholo' } }));
    expect(search.items.map((row) => row.fullName)).toEqual(['Gaone Letsholo']);
  });

  it('shows the departed officer’s open work and attributed history (AC-04, BR-38)', async () => {
    const detail = parsed(ep.buyerGetMember, await api.callAs(admin, ep.buyerGetMember, { tenant: 'kwu', params: { userId: 21 } }));
    expect(detail.userStatus).toBe('deactivated');
    expect(detail.openWork.length).toBeGreaterThan(0);
    expect(detail.attributedHistory.map((record) => record.reference)).toContain('T-2026-0008');
    expect(detail.delegationsReceived[0]?.status).toBe('revoked');
    expect(detail.availableActions).toContain('reassignWork');
  });

  it('refuses to deactivate somebody twice but reassigns their remaining work', async () => {
    const again = await api.callAs(admin, ep.buyerDeactivateMember, {
      tenant: 'kwu',
      params: { userId: 21 },
      body: { reason: 'Left', reassignments: [], confirmDelegationsReviewed: true, confirmHistoryRetained: true },
    });
    expect(problemCode(again)).toBe('MEMBER_ALREADY_DEACTIVATED');
    const reassigned = parsed(
      ep.buyerReassignWork,
      await api.callAs(admin, ep.buyerReassignWork, { tenant: 'kwu', params: { userId: 21 }, body: { reason: 'Leaver', reassignments: [{ workItemId: 1, toUserId: 5 }] } }),
    );
    expect(reassigned.effects.reassignedWorkItems).toBe(1);
    const wrong = await api.callAs(admin, ep.buyerReassignWork, {
      tenant: 'kwu',
      params: { userId: 21 },
      body: { reason: 'Leaver', reassignments: [{ workItemId: 1, toUserId: 21 }] },
    });
    expect(problemCode(wrong)).toBe('REASSIGNEE_NOT_ELIGIBLE');
    const notOpen = await api.callAs(admin, ep.buyerReassignWork, {
      tenant: 'kwu',
      params: { userId: 21 },
      body: { reason: 'Leaver', reassignments: [{ workItemId: 4, toUserId: 4 }] },
    });
    expect(problemCode(notOpen)).toBe('WORK_ITEM_NOT_OPEN');
  });

  it('requires every formal work item to be reassigned before deactivation', async () => {
    const missing = await api.callAs(admin, ep.buyerDeactivateMember, {
      tenant: 'kwu',
      params: { userId: 5 },
      body: { reason: 'Transfer', reassignments: [], confirmDelegationsReviewed: true, confirmHistoryRetained: true },
    });
    expect(problemCode(missing)).toBe('OPEN_WORK_NOT_REASSIGNED');
    const review = parsed(ep.buyerGetDeactivationReview, await api.callAs(admin, ep.buyerGetDeactivationReview, { tenant: 'kwu', params: { userId: 5 } }));
    const reassignments = review.openWork.filter((item) => item.requiresReassignment).map((item) => ({ workItemId: item.workItemId, toUserId: 4 }));
    const done = parsed(
      ep.buyerDeactivateMember,
      await api.callAs(admin, ep.buyerDeactivateMember, {
        tenant: 'kwu',
        params: { userId: 5 },
        body: { reason: 'Transfer', reassignments, confirmDelegationsReviewed: true, confirmHistoryRetained: true },
      }),
    );
    expect(done.member.userStatus).toBe('deactivated');
    expect(done.effects.reassignedWorkItems).toBe(reassignments.length);
    expect(done.effects.endedGrants).toBe(1);
  });

  it('never lets an administrator change their own status or remove the last administrator role', async () => {
    const suspend = await api.callAs(admin, ep.buyerSuspendMember, { tenant: 'kwu', params: { userId: 3 }, body: { reason: 'Test', until: null } });
    expect(problemCode(suspend)).toBe('CANNOT_CHANGE_OWN_STATUS');
    const detail = parsed(ep.buyerGetMember, await api.callAs(admin, ep.buyerGetMember, { tenant: 'kwu', params: { userId: 3 } }));
    const assignmentId = detail.roleAssignments[0]?.assignmentId ?? 0;
    const revoke = await api.callAs(admin, ep.buyerRevokeRoleAssignment, { tenant: 'kwu', params: { userId: 3, assignmentId }, body: { reason: 'Test' } });
    expect(problemCode(revoke)).toBe('LAST_ADMINISTRATOR');
  });

  it('suspends and reactivates members with the right state checks', async () => {
    expect(parsed(ep.buyerSuspendMember, await api.callAs(admin, ep.buyerSuspendMember, { tenant: 'kwu', params: { userId: 6 }, body: { reason: 'Leave', until: null } })).member.membershipStatus).toBe('suspended');
    expect(problemCode(await api.callAs(admin, ep.buyerSuspendMember, { tenant: 'kwu', params: { userId: 102 }, body: { reason: 'Leave', until: null } }))).toBe('MEMBER_NOT_ACTIVE');
    expect(parsed(ep.buyerActivateMember, await api.callAs(admin, ep.buyerActivateMember, { tenant: 'kwu', params: { userId: 102 }, body: { reason: 'Cleared' } })).member.membershipStatus).toBe('active');
    expect(problemCode(await api.callAs(admin, ep.buyerActivateMember, { tenant: 'kwu', params: { userId: 6 }, body: { reason: 'x' } }))).toBe('MEMBER_NOT_SUSPENDED');
  });

  it('invites, refuses duplicates and roles of another organization', async () => {
    const roles = parsed(ep.buyerListRoles, await api.callAs(admin, ep.buyerListRoles, { tenant: 'kwu', query: { q: 'evaluator' } }));
    const roleId = roles.items[0]?.roleId ?? 0;
    const body = { email: 'Neo.New@KWU.co.bw', fullName: 'Neo New', capacity: 'Evaluator', roleIds: [roleId], groupIds: [1], expiresInDays: 14, message: null };
    const created = parsed(ep.buyerInviteMember, await api.callAs(admin, ep.buyerInviteMember, { tenant: 'kwu', body }));
    expect(created.email).toBe('neo.new@kwu.co.bw');
    expect(created.status).toBe('pending');
    expect(problemCode(await api.callAs(admin, ep.buyerInviteMember, { tenant: 'kwu', body: { ...body, email: 'tebogo.officer@tenderiq.local' } }))).toBe('ALREADY_MEMBER');
    expect(problemCode(await api.callAs(admin, ep.buyerInviteMember, { tenant: 'kwu', body: { ...body, email: 'naledi.moyo@kwu.co.bw' } }))).toBe('INVITATION_ALREADY_PENDING');
    expect(problemCode(await api.callAs(admin, ep.buyerInviteMember, { tenant: 'kwu', body: { ...body, roleIds: [401] } }))).toBe('ROLE_NOT_GRANTABLE');
    expect(problemCode(await api.callAs(admin, ep.buyerInviteMember, { tenant: 'kwu', body: { ...body, groupIds: [6] } }))).toBe('GROUP_NOT_FOUND');
    const invalid = await api.callAs(admin, ep.buyerInviteMember, { tenant: 'kwu', body: { ...body, email: 'not-an-email' } });
    expect(invalid.status).toBe(422);
  });

  it('reissues an expired invitation and refuses to reissue an accepted one', async () => {
    const reissued = parsed(ep.buyerReissueInvitation, await api.callAs(admin, ep.buyerReissueInvitation, { tenant: 'kwu', params: { invitationId: 2 }, body: { expiresInDays: 14 } }));
    expect(reissued.reissuedFromId).toBe(2);
    expect(reissued.status).toBe('pending');
    expect(problemCode(await api.callAs(admin, ep.buyerReissueInvitation, { tenant: 'kwu', params: { invitationId: 6 }, body: { expiresInDays: 14 } }))).toBe('INVITATION_NOT_REISSUABLE');
    expect(problemCode(await api.callAs(admin, ep.buyerRevokeInvitation, { tenant: 'kwu', params: { invitationId: 6 }, body: { reason: 'x' } }))).toBe('INVITATION_NOT_REVOCABLE');
    expect(parsed(ep.buyerRevokeInvitation, await api.callAs(admin, ep.buyerRevokeInvitation, { tenant: 'kwu', params: { invitationId: 1 }, body: { reason: 'Hired elsewhere' } })).status).toBe('revoked');
  });

  it('approves the pending supplier membership request of the dual-capacity person', async () => {
    const serowe = email('serowe-ict.admin');
    const pending = parsed(ep.supplierListMembers, await api.callAs(serowe, ep.supplierListMembers, { tenant: 'serowe-ict', query: { status: 'pending_approval' } }));
    expect(pending.items.map((row) => row.fullName)).toEqual(['Sam Keitumetse']);
    const roles = parsed(ep.supplierListRoles, await api.callAs(serowe, ep.supplierListRoles, { tenant: 'serowe-ict', query: { q: 'contributor' } }));
    const result = parsed(
      ep.supplierApproveMembership,
      await api.callAs(serowe, ep.supplierApproveMembership, {
        tenant: 'serowe-ict',
        params: { userId: 42 },
        body: { capacity: 'Technical Contributor', roleIds: [roles.items[0]?.roleId ?? 0] },
      }),
    );
    expect(result.member.membershipStatus).toBe('active');
    expect(problemCode(await api.callAs(serowe, ep.supplierApproveMembership, { tenant: 'serowe-ict', params: { userId: 33 }, body: { capacity: 'x y', roleIds: [701] } }))).toBe('MEMBERSHIP_NOT_PENDING');
  });

  it('refuses self-assignment of roles and duplicate or unknown-scope assignments', async () => {
    const self = await api.callAs(admin, ep.buyerAddRoleAssignment, {
      tenant: 'kwu',
      params: { userId: 3 },
      body: { roleId: 202, scope: { scopeType: 'organization', scopeId: null }, startsAt: null, endsAt: null, reason: 'Self' },
    });
    expect(problemCode(self)).toBe('SELF_GRANT_FORBIDDEN');
    const duplicate = await api.callAs(admin, ep.buyerAddRoleAssignment, {
      tenant: 'kwu',
      params: { userId: 5 },
      body: { roleId: 203, scope: { scopeType: 'organization', scopeId: null }, startsAt: null, endsAt: null, reason: 'Again' },
    });
    expect(problemCode(duplicate)).toBe('ROLE_ALREADY_ASSIGNED');
    const scope = await api.callAs(admin, ep.buyerAddRoleAssignment, {
      tenant: 'kwu',
      params: { userId: 5 },
      body: { roleId: 211, scope: { scopeType: 'tender', scopeId: 11 }, startsAt: null, endsAt: null, reason: 'ODC tender' },
    });
    expect(problemCode(scope)).toBe('SCOPE_NOT_FOUND');
    const scoped = parsed(
      ep.buyerAddRoleAssignment,
      await api.callAs(admin, ep.buyerAddRoleAssignment, {
        tenant: 'kwu',
        params: { userId: 13 },
        body: { roleId: 211, scope: { scopeType: 'tender', scopeId: 9 }, startsAt: null, endsAt: '2026-12-31T15:00:00Z', reason: 'Legal review of T-2026-0009' },
      }),
    );
    expect(scoped.scope.scopeLabel).toContain('T-2026-0009');
  });

  it('blocks an assignment that combines incompatible duties on one event', async () => {
    const roles = parsed(ep.buyerListRoles, await api.callAs(admin, ep.buyerListRoles, { tenant: 'kwu', query: { q: 'award_approver' } }));
    const response = await api.callAs(admin, ep.buyerAddRoleAssignment, {
      tenant: 'kwu',
      params: { userId: 11 },
      body: { roleId: roles.items[0]?.roleId ?? 0, scope: { scopeType: 'tender', scopeId: 3 }, startsAt: null, endsAt: null, reason: 'Award' },
    });
    expect(problemCode(response)).toBe('SOD_CONFLICT');
  });

  it('manages custom roles within the tenant kind and policy', async () => {
    const base = { code: 'site_visit_host', name: 'Site visit host', description: null, permissionCodes: ['tender.view', 'tender.sessions.manage'] };
    expect(parsed(ep.buyerCreateRole, await api.callAs(admin, ep.buyerCreateRole, { tenant: 'kwu', body: base })).permissionCount).toBe(2);
    expect(problemCode(await api.callAs(admin, ep.buyerCreateRole, { tenant: 'kwu', body: { ...base, code: 'evaluator' } }))).toBe('ROLE_CODE_TAKEN');
    expect(problemCode(await api.callAs(admin, ep.buyerCreateRole, { tenant: 'kwu', body: { ...base, permissionCodes: ['supplier.response.submit'] } }))).toBe('PERMISSION_WRONG_TENANT_KIND');
    expect(problemCode(await api.callAs(admin, ep.buyerCreateRole, { tenant: 'kwu', body: { ...base, permissionCodes: ['support.view'] } }))).toBe('PERMISSION_NOT_GRANTABLE');
    expect(problemCode(await api.callAs(admin, ep.buyerCreateRole, { tenant: 'kwu', body: { ...base, permissionCodes: ['evaluation.score', 'award.approve'] } }))).toBe('SOD_INCOMPATIBLE_PERMISSIONS');
    expect(problemCode(await api.callAs(email('tsodilo.admin'), ep.supplierCreateRole, { tenant: 'tsodilo', body: { ...base, permissionCodes: ['tender.view'] } }))).toBe('PERMISSION_WRONG_TENANT_KIND');
    expect(problemCode(await api.callAs(admin, ep.buyerUpdateRole, { tenant: 'kwu', params: { roleId: 211 }, body: { name: 'X role', description: null, permissionCodes: ['tender.view'] } }))).toBe('SYSTEM_ROLE_READ_ONLY');
    expect(problemCode(await api.callAs(admin, ep.buyerDeactivateRole, { tenant: 'kwu', params: { roleId: 291 }, body: { reason: 'x' } }))).toBe('ROLE_HAS_ACTIVE_ASSIGNMENTS');
    expect(problemCode(await api.callAs(admin, ep.buyerDeactivateRole, { tenant: 'kwu', params: { roleId: 292 }, body: { reason: 'x' } }))).toBe('ROLE_INACTIVE');
  });

  it('manages group membership', async () => {
    expect(problemCode(await api.callAs(admin, ep.buyerAddGroupMember, { tenant: 'kwu', params: { groupId: 1 }, body: { userId: 11 } }))).toBe('ALREADY_GROUP_MEMBER');
    expect(problemCode(await api.callAs(admin, ep.buyerAddGroupMember, { tenant: 'kwu', params: { groupId: 4 }, body: { userId: 11 } }))).toBe('GROUP_INACTIVE');
    expect(problemCode(await api.callAs(admin, ep.buyerAddGroupMember, { tenant: 'kwu', params: { groupId: 1 }, body: { userId: 103 } }))).toBe('USER_NOT_ACTIVE');
    expect(parsed(ep.buyerAddGroupMember, await api.callAs(admin, ep.buyerAddGroupMember, { tenant: 'kwu', params: { groupId: 1 }, body: { userId: 101 } })).memberCount).toBe(4);
    expect(problemCode(await api.callAs(admin, ep.buyerRemoveGroupMember, { tenant: 'kwu', params: { groupId: 1, userId: 42 }, body: { reason: 'x' } }))).toBe('NOT_GROUP_MEMBER');
    expect(problemCode(await api.callAs(admin, ep.buyerCreateGroup, { tenant: 'kwu', body: { name: 'Bid opening panel', description: null } }))).toBe('GROUP_NAME_TAKEN');
  });
});

describe('access governance (ADM-04, AC-02)', () => {
  const admin = email('admin.kwu');

  it('shows the dual memberships of the pending declarant to the reviewer (AC-02)', async () => {
    const queue = parsed(ep.listConflictDeclarations, await api.callAs(admin, ep.listConflictDeclarations, { tenant: 'kwu', query: { disposition: 'pending_review', dualMembership: 'true' } }));
    expect(queue.items.map((row) => row.declarant.fullName)).toEqual(['Sam Keitumetse']);
    expect(queue.items[0]?.accessBlocked).toBe(true);
    const detail = parsed(ep.getConflictDeclaration, await api.callAs(admin, ep.getConflictDeclaration, { tenant: 'kwu', params: { declarationId: 1 } }));
    expect(detail.supplierMemberships.map((membership) => membership.organizationName)).toEqual(
      expect.arrayContaining(['Tsodilo Engineering', 'Chobe Pipe & Valve Supplies']),
    );
    expect(detail.restriction?.restrictionType).toBe('conflict');
    expect(detail.allowedDispositions).toContain('recused');
  });

  it('lets the evaluation chair review the queue but not a buyer officer', async () => {
    expect((await api.callAs(email('boitumelo.chair'), ep.listConflictDeclarations, { tenant: 'kwu' })).status).toBe(200);
    expect((await api.callAs(email('tebogo.officer'), ep.listConflictDeclarations, { tenant: 'kwu' })).status).toBe(403);
  });

  it('records a disposition and refuses to decide twice or to reassign to an ineligible person', async () => {
    const decided = parsed(
      ep.decideConflictDeclaration,
      await api.callAs(admin, ep.decideConflictDeclaration, { tenant: 'kwu', params: { declarationId: 1 }, body: { disposition: 'mitigated', reviewNote: 'No access to Tsodilo', reassignToUserId: null } }),
    );
    expect(decided.accessBlocked).toBe(false);
    expect(decided.restriction?.status).toBe('expired');
    expect(problemCode(await api.callAs(admin, ep.decideConflictDeclaration, { tenant: 'kwu', params: { declarationId: 3 }, body: { disposition: 'cleared', reviewNote: 'x', reassignToUserId: null } }))).toBe('DECLARATION_ALREADY_DECIDED');
    expect(problemCode(await api.callAs(admin, ep.decideConflictDeclaration, { tenant: 'kwu', params: { declarationId: 7 }, body: { disposition: 'reassigned', reviewNote: 'x', reassignToUserId: 102 } }))).toBe('REASSIGNEE_NOT_ELIGIBLE');
    const missing = await api.callAs(admin, ep.decideConflictDeclaration, { tenant: 'kwu', params: { declarationId: 7 }, body: { disposition: 'reassigned', reviewNote: 'x', reassignToUserId: null } });
    expect(missing.status).toBe(422);
  });

  it('never lets a reviewer decide their own declaration', async () => {
    const response = await api.callAs(email('boitumelo.chair'), ep.decideConflictDeclaration, {
      tenant: 'kwu',
      params: { declarationId: 6 },
      body: { disposition: 'cleared', reviewNote: 'Mine', reassignToUserId: null },
    });
    expect(problemCode(response)).toBe('CANNOT_REVIEW_OWN_DECLARATION');
  });

  it('reports incompatible authority, expiring grants, dormant accounts and restrictions', async () => {
    const page = parsed(ep.listAccessFindings, await api.callAs(admin, ep.listAccessFindings, { tenant: 'kwu', query: { pageSize: 100 } }));
    expect(page.summary.sodConflicts).toBeGreaterThan(0);
    expect(page.summary.expiringGrants).toBe(1);
    expect(page.summary.dormantAccounts).toBe(1);
    expect(page.summary.pendingConflictReviews).toBe(2);
    expect(page.items.some((row) => row.type === 'sod_conflict' && row.user.fullName === 'Mpho Dikgang')).toBe(true);
    const critical = parsed(ep.listAccessFindings, await api.callAs(admin, ep.listAccessFindings, { tenant: 'kwu', query: { severity: 'critical' } }));
    expect(critical.items.every((row) => row.severity === 'critical')).toBe(true);
  });

  it('shows effective permissions with sources and the restrictions that win', async () => {
    const sam = parsed(ep.getEffectiveAccess, await api.callAs(admin, ep.getEffectiveAccess, { tenant: 'kwu', params: { userId: 42 } }));
    const score = sam.permissions.find((permission) => permission.code === 'evaluation.score');
    expect(score?.sources.some((source) => source.kind === 'role')).toBe(true);
    expect(score?.sources.some((source) => source.kind === 'group_role')).toBe(false);
    expect(score?.restrictedBy[0]?.scopeLabel).toContain('T-2026-0003');
    const suspended = parsed(ep.getEffectiveAccess, await api.callAs(admin, ep.getEffectiveAccess, { tenant: 'kwu', params: { userId: 6 } }));
    expect(suspended.permissions.find((permission) => permission.code === 'org.structure.manage')?.sources[0]?.kind).toBe('direct_grant');
  });

  it('keeps a suspended member’s roles visible and blocked by the suspension (PRD §4.2)', async () => {
    const onkemetse = parsed(ep.getEffectiveAccess, await api.callAs(admin, ep.getEffectiveAccess, { tenant: 'kwu', params: { userId: 102 } }));
    expect(onkemetse.membershipStatus).toBe('suspended');
    expect(onkemetse.permissions.length).toBeGreaterThan(0);
    expect(onkemetse.permissions.every((permission) => !permission.effective)).toBe(true);
    expect(onkemetse.permissions.every((permission) => permission.restrictedBy.some((restriction) => restriction.restrictionType === 'suspension'))).toBe(true);
    expect(onkemetse.permissions.find((permission) => permission.code === 'tender.view')?.sources[0]?.kind).toBe('role');
  });

  it('holds nothing for invited, pending or ended memberships (FR-03)', async () => {
    for (const userId of [103, 107, 109]) {
      const access = parsed(ep.getEffectiveAccess, await api.callAs(admin, ep.getEffectiveAccess, { tenant: 'kwu', params: { userId } }));
      expect(access.permissions, String(userId)).toEqual([]);
    }
    const pending = parsed(ep.supplierGetMember, await api.callAs(email('serowe-ict.admin'), ep.supplierGetMember, { tenant: 'serowe-ict', params: { userId: 42 } }));
    expect(pending.membershipStatus).toBe('pending_approval');
    expect(pending.roleAssignments).toEqual([]);
    expect(pending.availableActions).toContain('approveMembership');
  });

  it('flags a scoped restriction while the permission stays effective elsewhere (AC-02)', async () => {
    const sam = parsed(ep.getEffectiveAccess, await api.callAs(admin, ep.getEffectiveAccess, { tenant: 'kwu', params: { userId: 42 } }));
    const view = sam.permissions.find((permission) => permission.code === 'tender.view');
    expect(view?.effective).toBe(true);
    expect(view?.restrictedBy.map((restriction) => restriction.restrictionType)).toEqual(['conflict']);
  });

  it('grants only what the granter holds, never to themselves, and within the maximum length', async () => {
    const body = {
      userId: 6,
      permissionCode: 'org.fields.manage',
      scope: { scopeType: 'organization', scopeId: null },
      reason: 'Configure request fields',
      ownerUserId: 4,
      startsAt: '2026-10-01T07:00:00Z',
      expiresAt: '2026-11-30T15:00:00Z',
    };
    expect(parsed(ep.createAccessGrant, await api.callAs(admin, ep.createAccessGrant, { tenant: 'kwu', body })).status).toBe('scheduled');
    expect(problemCode(await api.callAs(admin, ep.createAccessGrant, { tenant: 'kwu', body: { ...body, permissionCode: 'tender.view' } }))).toBe('GRANT_NOT_HELD');
    expect(problemCode(await api.callAs(admin, ep.createAccessGrant, { tenant: 'kwu', body: { ...body, userId: 3 } }))).toBe('SELF_GRANT_FORBIDDEN');
    expect(problemCode(await api.callAs(admin, ep.createAccessGrant, { tenant: 'kwu', body: { ...body, permissionCode: 'support.view' } }))).toBe('PERMISSION_NOT_GRANTABLE');
    expect(problemCode(await api.callAs(admin, ep.createAccessGrant, { tenant: 'kwu', body: { ...body, permissionCode: 'supplier.org.manage' } }))).toBe('PERMISSION_WRONG_TENANT_KIND');
    expect(problemCode(await api.callAs(admin, ep.createAccessGrant, { tenant: 'kwu', body: { ...body, expiresAt: '2027-06-30T15:00:00Z' } }))).toBe('GRANT_TOO_LONG');
    expect(problemCode(await api.callAs(admin, ep.createAccessGrant, { tenant: 'kwu', body: { ...body, userId: 102 } }))).toBe('USER_NOT_ACTIVE');
    expect(problemCode(await api.callAs(admin, ep.createAccessGrant, { tenant: 'kwu', body: { ...body, userId: 42, scope: { scopeType: 'tender', scopeId: 3 } } }))).toBe('RESTRICTION_APPLIES');
    const invalid = await api.callAs(admin, ep.createAccessGrant, { tenant: 'kwu', body: { ...body, expiresAt: '2026-09-01T00:00:00Z' } });
    expect(invalid.status).toBe(422);
    expect(JSON.stringify(invalid.body)).toContain('GRANT_DATES_INVALID');
  });

  it('revokes and extends grants with the state checks', async () => {
    expect(parsed(ep.revokeAccessGrant, await api.callAs(admin, ep.revokeAccessGrant, { tenant: 'kwu', params: { grantId: 1 }, body: { reason: 'Done' } })).status).toBe('revoked');
    expect(problemCode(await api.callAs(admin, ep.revokeAccessGrant, { tenant: 'kwu', params: { grantId: 3 }, body: { reason: 'Done' } }))).toBe('GRANT_ALREADY_ENDED');
    expect(parsed(ep.extendAccessGrant, await api.callAs(admin, ep.extendAccessGrant, { tenant: 'kwu', params: { grantId: 1 }, body: { expiresAt: '2026-11-15T15:00:00Z', reason: 'Budget cycle extended' } })).expiresAt).toBe('2026-11-15T15:00:00Z');
    expect(problemCode(await api.callAs(admin, ep.extendAccessGrant, { tenant: 'kwu', params: { grantId: 1 }, body: { expiresAt: '2027-12-31T15:00:00Z', reason: 'x' } }))).toBe('GRANT_TOO_LONG');
    expect((await api.callAs(email('admin.odc'), ep.revokeAccessGrant, { tenant: 'odc', params: { grantId: 1 }, body: { reason: 'x' } })).status).toBe(404);
  });

  it('keeps a pending conflict restriction until the review', async () => {
    expect(problemCode(await api.callAs(admin, ep.liftAccessRestriction, { tenant: 'kwu', params: { restrictionId: 1 }, body: { reason: 'x' } }))).toBe('RESTRICTION_CONFLICT_PENDING');
    expect(problemCode(await api.callAs(admin, ep.liftAccessRestriction, { tenant: 'kwu', params: { restrictionId: 3 }, body: { reason: 'x' } }))).toBe('RESTRICTION_ALREADY_ENDED');
    expect(parsed(ep.liftAccessRestriction, await api.callAs(admin, ep.liftAccessRestriction, { tenant: 'kwu', params: { restrictionId: 2 }, body: { reason: 'HR process closed' } })).status).toBe('expired');
    expect(problemCode(await api.callAs(admin, ep.createAccessRestriction, {
      tenant: 'kwu',
      body: { userId: 3, permissionCode: null, scope: { scopeType: 'organization', scopeId: null }, restrictionType: 'other', reason: 'x', startsAt: '2026-10-01T00:00:00Z', endsAt: null },
    }))).toBe('CANNOT_RESTRICT_SELF');
  });

  it('requires documented alternative oversight instead of silently disabling a control', async () => {
    const invalid = await api.callAs(admin, ep.updateSodPolicy, { tenant: 'kwu', params: { ruleCode: 'draft_vs_final_approval' }, body: { mode: 'alternative_oversight', alternativeOversightNote: null, reason: 'Small team' } });
    expect(invalid.status).toBe(422);
    expect(JSON.stringify(invalid.body)).toContain('ALTERNATIVE_OVERSIGHT_NOTE_REQUIRED');
    expect(problemCode(await api.callAs(admin, ep.updateSodPolicy, { tenant: 'kwu', params: { ruleCode: 'draft_vs_final_approval' }, body: { mode: 'enforced', alternativeOversightNote: null, reason: 'x' } }))).toBe('SOD_POLICY_UNCHANGED');
    const odc = parsed(ep.listSodPolicies, await api.callAs(email('admin.odc'), ep.listSodPolicies, { tenant: 'odc' }));
    expect(odc.items.filter((row) => !row.configured)).toHaveLength(3);
  });
});

describe('authority (ADM-05)', () => {
  const admin = email('admin.kwu');

  it('caps a delegation at the delegator’s own limit (BR-06)', async () => {
    const body = {
      delegatorUserId: 4,
      delegateUserId: 17,
      decisionTypes: ['release_approval'],
      maxAmount: { amount: '3000000.00', currency: 'BWP' },
      legalEntityId: null,
      categoryId: null,
      startsAt: '2026-10-20T06:00:00Z',
      endsAt: '2026-10-30T15:00:00Z',
      reason: 'Travel',
    };
    expect(problemCode(await api.callAs(admin, ep.createDelegation, { tenant: 'kwu', body }))).toBe('DELEGATION_EXCEEDS_LIMIT');
    const ok = parsed(ep.createDelegation, await api.callAs(admin, ep.createDelegation, { tenant: 'kwu', body: { ...body, maxAmount: { amount: '1500000.00', currency: 'BWP' } } }));
    expect(ok.delegatorLimit).toEqual({ amount: '2000000.00', currency: 'BWP' });
    expect(problemCode(await api.callAs(admin, ep.createDelegation, { tenant: 'kwu', body: { ...body, delegatorUserId: 5 } }))).toBe('DELEGATOR_HAS_NO_AUTHORITY');
    expect(problemCode(await api.callAs(admin, ep.createDelegation, { tenant: 'kwu', body: { ...body, decisionTypes: ['request_approval'], delegateUserId: 6, maxAmount: { amount: '1000.00', currency: 'BWP' } } }))).toBe('DELEGATE_CONFLICT');
    expect(problemCode(await api.callAs(admin, ep.createDelegation, { tenant: 'kwu', body: { ...body, delegateUserId: 3 } }))).toBe('SELF_DELEGATION_FORBIDDEN');
    expect(problemCode(await api.callAs(admin, ep.createDelegation, { tenant: 'kwu', body: { ...body, delegateUserId: 21 } }))).toBe('DELEGATE_NOT_ACTIVE');
    expect((await api.callAs(admin, ep.createDelegation, { tenant: 'kwu', body: { ...body, delegateUserId: 4 } })).status).toBe(422);
    expect(problemCode(await api.callAs(admin, ep.revokeDelegation, { tenant: 'kwu', params: { delegationId: 2 }, body: { reason: 'x' } }))).toBe('DELEGATION_ALREADY_ENDED');
  });

  it('refuses a delegation wider than the legal entity or category of the delegator’s limit (BR-06)', async () => {
    const body = {
      delegatorUserId: 18,
      delegateUserId: 17,
      decisionTypes: ['contract_signature'],
      maxAmount: { amount: '1000000.00', currency: 'BWP' },
      legalEntityId: null,
      categoryId: null,
      startsAt: '2026-10-20T06:00:00Z',
      endsAt: '2026-10-30T15:00:00Z',
      reason: 'Leave',
    };
    const all = await api.callAs(admin, ep.createDelegation, { tenant: 'kwu', body });
    expect(all.status).toBe(409);
    expect(problemCode(all)).toBe('DELEGATION_EXCEEDS_SCOPE');
    expect(parsed(ep.createDelegation, await api.callAs(admin, ep.createDelegation, { tenant: 'kwu', body: { ...body, legalEntityId: 1 } })).legalEntity?.id).toBe(1);
    const qualification = { ...body, delegatorUserId: 4, decisionTypes: ['qualification_decision'] };
    expect(problemCode(await api.callAs(admin, ep.createDelegation, { tenant: 'kwu', body: qualification }))).toBe('DELEGATION_EXCEEDS_SCOPE');
    expect(problemCode(await api.callAs(admin, ep.createDelegation, { tenant: 'kwu', body: { ...qualification, categoryId: 4 } }))).toBe('DELEGATION_EXCEEDS_SCOPE');
    expect(parsed(ep.createDelegation, await api.callAs(admin, ep.createDelegation, { tenant: 'kwu', body: { ...qualification, categoryId: 2 } })).category?.name).toBe('Pumps and mechanical equipment');
  });

  it('refuses a delegation that outlasts the delegator’s own limit (BR-06)', async () => {
    const body = {
      delegatorUserId: 4,
      delegateUserId: 17,
      decisionTypes: ['change_approval'],
      maxAmount: { amount: '500000.00', currency: 'BWP' },
      legalEntityId: 1,
      categoryId: null,
      startsAt: '2027-03-01T06:00:00Z',
      endsAt: '2027-06-30T15:00:00Z',
      reason: 'Sabbatical',
    };
    const late = await api.callAs(admin, ep.createDelegation, { tenant: 'kwu', body });
    expect(problemCode(late)).toBe('DELEGATION_EXCEEDS_SCOPE');
    expect(JSON.stringify(late.body)).toContain('2027-03-31');
    expect(parsed(ep.createDelegation, await api.callAs(admin, ep.createDelegation, { tenant: 'kwu', body: { ...body, endsAt: '2027-03-31T15:00:00Z' } })).status).toBe('scheduled');
  });

  it('counts voting members (chair and members) apart from alternates and the secretary', async () => {
    const page = parsed(ep.listCommittees, await api.callAs(admin, ep.listCommittees, { tenant: 'kwu' }));
    const award = page.items.find((row) => row.name === 'Tender Award Committee');
    expect(award).toMatchObject({ votingMemberCount: 3, alternateCount: 1, activeMemberCount: 5 });
    const scada = parsed(ep.getCommittee, await api.callAs(admin, ep.getCommittee, { tenant: 'kwu', params: { committeeId: 2 } }));
    expect(scada.votingMemberCount).toBe(4);
    expect(scada.alternateCount).toBe(1);
    const added = parsed(ep.addCommitteeMember, await api.callAs(admin, ep.addCommitteeMember, { tenant: 'kwu', params: { committeeId: 1 }, body: { userId: 20, memberRole: 'alternate', startsAt: '2026-09-30T07:00:00Z', endsAt: null } }));
    expect(added.votingMemberCount).toBe(3);
    expect(added.alternateCount).toBe(2);
  });

  it('lists limits by decision and refuses overlapping or self limits', async () => {
    const page = parsed(ep.listAuthorityLimits, await api.callAs(admin, ep.listAuthorityLimits, { tenant: 'kwu', query: { decisionType: 'award_approval' } }));
    expect(page.items.every((row) => row.decisionType === 'award_approval')).toBe(true);
    expect(page.items.some((row) => row.subjectType === 'committee' && row.maxAmount === null)).toBe(true);
    const body = {
      subjectType: 'user',
      subjectId: 4,
      decisionType: 'request_approval',
      maxAmount: { amount: '2500000.00', currency: 'BWP' },
      legalEntityId: null,
      categoryId: null,
      effectiveFrom: '2026-10-01T00:00:00Z',
      effectiveTo: null,
      reason: 'Raise',
    };
    expect(problemCode(await api.callAs(admin, ep.createAuthorityLimit, { tenant: 'kwu', body }))).toBe('LIMIT_OVERLAPS');
    expect(problemCode(await api.callAs(admin, ep.createAuthorityLimit, { tenant: 'kwu', body: { ...body, subjectId: 3 } }))).toBe('SELF_AUTHORITY_FORBIDDEN');
    expect(problemCode(await api.callAs(admin, ep.createAuthorityLimit, { tenant: 'kwu', body: { ...body, subjectId: 22 } }))).toBe('SUBJECT_NOT_FOUND');
    expect(problemCode(await api.callAs(admin, ep.createAuthorityLimit, { tenant: 'kwu', body: { ...body, decisionType: 'disposal_approval', maxAmount: { amount: '1.00', currency: 'EUR' } } }))).toBe('CURRENCY_NOT_ACCEPTED');
    expect(parsed(ep.createAuthorityLimit, await api.callAs(admin, ep.createAuthorityLimit, { tenant: 'kwu', body: { ...body, decisionType: 'disposal_approval' } })).status).toBe('scheduled');
    expect(problemCode(await api.callAs(admin, ep.endAuthorityLimit, { tenant: 'kwu', params: { limitId: 13 }, body: { effectiveTo: '2026-10-01T00:00:00Z', reason: 'x' } }))).toBe('LIMIT_ALREADY_ENDED');
  });

  it('keeps committees within quorum and a single chair', async () => {
    const complaints = parsed(ep.getCommittee, await api.callAs(admin, ep.getCommittee, { tenant: 'kwu', params: { committeeId: 4 } }));
    expect(complaints.quorumMet).toBe(false);
    expect(problemCode(await api.callAs(admin, ep.addCommitteeMember, { tenant: 'kwu', params: { committeeId: 4 }, body: { userId: 20, memberRole: 'chair', startsAt: '2026-10-01T00:00:00Z', endsAt: null } }))).toBe('CHAIR_ALREADY_ASSIGNED');
    expect(problemCode(await api.callAs(admin, ep.addCommitteeMember, { tenant: 'kwu', params: { committeeId: 4 }, body: { userId: 17, memberRole: 'member', startsAt: '2026-10-01T00:00:00Z', endsAt: null } }))).toBe('ALREADY_COMMITTEE_MEMBER');
    expect(problemCode(await api.callAs(admin, ep.addCommitteeMember, { tenant: 'kwu', params: { committeeId: 5 }, body: { userId: 20, memberRole: 'member', startsAt: '2026-10-01T00:00:00Z', endsAt: null } }))).toBe('COMMITTEE_INACTIVE');
    const added = parsed(ep.addCommitteeMember, await api.callAs(admin, ep.addCommitteeMember, { tenant: 'kwu', params: { committeeId: 4 }, body: { userId: 20, memberRole: 'member', startsAt: '2026-09-30T07:00:00Z', endsAt: null } }));
    expect(added.quorumMet).toBe(true);
    expect(problemCode(await api.callAs(admin, ep.endCommitteeMember, { tenant: 'kwu', params: { committeeId: 3, memberId: 13 }, body: { reason: 'x' } }))).toBe('QUORUM_WOULD_BREAK');
    expect(problemCode(await api.callAs(admin, ep.endCommitteeMember, { tenant: 'kwu', params: { committeeId: 2, memberId: 10 }, body: { reason: 'x' } }))).toBe('MEMBER_ALREADY_ENDED');
    expect(problemCode(await api.callAs(admin, ep.deactivateCommittee, { tenant: 'kwu', params: { committeeId: 2 }, body: { reason: 'x' } }))).toBe('COMMITTEE_HAS_OPEN_WORK');
    expect(problemCode(await api.callAs(admin, ep.deactivateCommittee, { tenant: 'kwu', params: { committeeId: 5 }, body: { reason: 'x' } }))).toBe('COMMITTEE_INACTIVE');
    expect(parsed(ep.deactivateCommittee, await api.callAs(admin, ep.deactivateCommittee, { tenant: 'kwu', params: { committeeId: 4 }, body: { reason: 'Merged' } })).active).toBe(false);
    expect(problemCode(await api.callAs(admin, ep.createCommittee, { tenant: 'kwu', body: { name: 'Bid Opening Panel', purpose: 'opening', quorum: 2, legalEntityId: null } }))).toBe('COMMITTEE_NAME_TAKEN');
  });
});

describe('organization and structure (ADM-01, ADM-02)', () => {
  const admin = email('admin.kwu');
  const settingsBody = {
    tradingName: 'Kalahari Water',
    brandingDisplayName: 'Kalahari Water Utilities',
    officialTimeZone: 'Africa/Gaborone',
    workingLanguages: ['en'],
    defaultCurrency: 'BWP',
    acceptedCurrencies: ['BWP', 'ZAR', 'USD'],
    responsibilities: {
      procurementOwner: 4,
      administrator: 3,
      budgetApprovalOwner: 7,
      publicationOwner: 5,
      complaintsOwner: 17,
      recordsOwner: 108,
      contractOwner: 19,
      supportContact: null,
    },
    publicPortalEnabled: true,
    portalIntro: 'Kalahari Water Utilities publishes open tenders, clarifications and award notices here. Register once to take part in any open procurement.',
    acknowledgeImpact: false,
  };

  it('reviews the impact of a time-zone change on open events and requires acknowledgement', async () => {
    const changed = { ...settingsBody, officialTimeZone: 'Africa/Johannesburg' };
    const review = parsed(ep.reviewOrganizationImpact, await api.callAs(admin, ep.reviewOrganizationImpact, { tenant: 'kwu', body: changed }));
    expect(review.requiresAcknowledgement).toBe(true);
    expect(review.impacts.find((impact) => impact.area === 'deadlines')?.references).toContain('T-2026-0002');
    expect(problemCode(await api.callAs(admin, ep.updateOrganization, { tenant: 'kwu', body: changed }))).toBe('IMPACT_NOT_ACKNOWLEDGED');
    const saved = parsed(ep.updateOrganization, await api.callAs(admin, ep.updateOrganization, { tenant: 'kwu', body: { ...changed, acknowledgeImpact: true } }));
    expect(saved.organization.identity.officialTimeZone).toBe('Africa/Johannesburg');
  });

  it('refuses owners who are not active members and a default currency that is not accepted', async () => {
    const outsider = { ...settingsBody, responsibilities: { ...settingsBody.responsibilities, contractOwner: 22 } };
    expect(problemCode(await api.callAs(admin, ep.reviewOrganizationImpact, { tenant: 'kwu', body: outsider }))).toBe('OWNER_NOT_ACTIVE_MEMBER');
    const currency = await api.callAs(admin, ep.updateOrganization, { tenant: 'kwu', body: { ...settingsBody, defaultCurrency: 'EUR' } });
    expect(currency.status).toBe(422);
    expect(JSON.stringify(currency.body)).toContain('DEFAULT_CURRENCY_NOT_ACCEPTED');
  });

  it('shows ODC’s missing responsibilities as readiness gaps', async () => {
    const odc = parsed(ep.getOrganization, await api.callAs(email('admin.odc'), ep.getOrganization, { tenant: 'odc' }));
    expect(odc.readiness.filter((item) => item.status === 'blocking').map((item) => item.id)).toEqual(
      expect.arrayContaining(['responsibility.complaintsOwner', 'calendar', 'policy']),
    );
  });

  it('filters structure by active state and parent and never deletes a value', async () => {
    const inactive = parsed(ep.departmentsList, await api.callAs(admin, ep.departmentsList, { tenant: 'kwu', query: { active: 'false' } }));
    expect(inactive.items.map((row) => row.name)).toEqual(['Rural Water Supply (merged into Operations)']);
    const children = parsed(ep.departmentsList, await api.callAs(admin, ep.departmentsList, { tenant: 'kwu', query: { parentId: 11 } }));
    expect(children.items.every((row) => row.parent?.id === 11)).toBe(true);
    expect(problemCode(await api.callAs(admin, ep.departmentsDeactivate, { tenant: 'kwu', params: { valueId: 11 }, body: { reason: 'x' } }))).toBe('HAS_ACTIVE_CHILDREN');
    expect(problemCode(await api.callAs(admin, ep.departmentsDeactivate, { tenant: 'kwu', params: { valueId: 20 }, body: { reason: 'x' } }))).toBe('ALREADY_INACTIVE');
    const done = parsed(ep.locationsDeactivate, await api.callAs(admin, ep.locationsDeactivate, { tenant: 'kwu', params: { valueId: 23 }, body: { reason: 'Depot closed' } }));
    expect(done.active).toBe(false);
    expect(done.usage.referenceCount).toBeGreaterThan(0);
    expect(problemCode(await api.callAs(email('admin.odc'), ep.legalEntitiesDeactivate, { tenant: 'odc', params: { valueId: 61 }, body: { reason: 'x' } }))).toBe('LAST_CONTRACTING_ENTITY');
  });

  it('validates structure codes, names, parents and cycles', async () => {
    const dept = { name: 'Operations', code: 'OPS2', parentId: null, legalEntityId: 1, headUserId: null };
    expect(problemCode(await api.callAs(admin, ep.departmentsCreate, { tenant: 'kwu', body: dept }))).toBe('STRUCTURE_NAME_TAKEN');
    expect(problemCode(await api.callAs(admin, ep.departmentsCreate, { tenant: 'kwu', body: { ...dept, name: 'Asset Management', code: 'OPS' } }))).toBe('STRUCTURE_CODE_TAKEN');
    expect(problemCode(await api.callAs(admin, ep.departmentsCreate, { tenant: 'kwu', body: { ...dept, name: 'Asset Management', parentId: 20 } }))).toBe('PARENT_INACTIVE');
    expect(problemCode(await api.callAs(admin, ep.departmentsCreate, { tenant: 'kwu', body: { ...dept, name: 'Asset Management', parentId: 62 } }))).toBe('PARENT_NOT_FOUND');
    expect(problemCode(await api.callAs(admin, ep.departmentsUpdate, { tenant: 'kwu', params: { valueId: 11 }, body: { ...dept, parentId: 12 } }))).toBe('PARENT_CYCLE');
    expect(problemCode(await api.callAs(admin, ep.costCentersUpdate, { tenant: 'kwu', params: { valueId: 46 }, body: { code: 'CC-RWS-900', name: 'Rural', departmentId: null } }))).toBe('VALUE_INACTIVE');
    expect(parsed(ep.categoriesCreate, await api.callAs(admin, ep.categoriesCreate, { tenant: 'kwu', body: { name: 'Borehole drilling', code: 'WTR-DRILL', parentId: 1, catalogCode: 'WTR-INFRA' } })).parent?.name).toBe('Water infrastructure');
    expect((await api.callAs(admin, ep.fundingSourcesCreate, { tenant: 'kwu', body: { code: 'bad code', name: 'Bad', sourceType: 'grant', externalReference: null } })).status).toBe(422);
  });
});

describe('supplier authority (SUP-04, AC-03)', () => {
  const admin = email('tsodilo.admin');

  it('assigns work within authority and keeps pricing and signing with the right people', async () => {
    const base = { userId: 26, tenderId: 6, responsibility: 'signatory', sectionScope: [], dueAt: null, canViewPricing: false };
    expect(problemCode(await api.callAs(admin, ep.createTenderAssignment, { tenant: 'tsodilo', body: base }))).toBe('RESPONSIBILITY_REQUIRES_AUTHORITY');
    expect(problemCode(await api.callAs(admin, ep.createTenderAssignment, { tenant: 'tsodilo', body: { ...base, responsibility: 'reviewer', canViewPricing: true } }))).toBe('PRICING_REQUIRES_PERMISSION');
    expect(problemCode(await api.callAs(admin, ep.createTenderAssignment, { tenant: 'tsodilo', body: { ...base, responsibility: 'contributor' } }))).toBe('ALREADY_ASSIGNED');
    expect(problemCode(await api.callAs(admin, ep.createTenderAssignment, { tenant: 'tsodilo', body: { ...base, responsibility: 'contributor', tenderId: 9 } }))).toBe('TENDER_NOT_AVAILABLE');
    expect(problemCode(await api.callAs(admin, ep.createTenderAssignment, { tenant: 'tsodilo', body: { ...base, userId: 121, responsibility: 'contributor' } }))).toBe('USER_NOT_ACTIVE');
    expect(problemCode(await api.callAs(admin, ep.createTenderAssignment, { tenant: 'tsodilo', body: { ...base, userId: 24 } }))).toBe('SELF_GRANT_FORBIDDEN');
    const ok = parsed(ep.createTenderAssignment, await api.callAs(admin, ep.createTenderAssignment, { tenant: 'tsodilo', body: { ...base, responsibility: 'reviewer', tenderId: 3, sectionScope: ['Commissioning plan'] } }));
    expect(ok.tender.reference).toBe('T-2026-0003');
    expect(problemCode(await api.callAs(admin, ep.endTenderAssignment, { tenant: 'tsodilo', params: { assignmentId: 8 }, body: { reason: 'x' } }))).toBe('ASSIGNMENT_ALREADY_ENDED');
  });

  it('grants submission authority explicitly and never to oneself', async () => {
    const granted = parsed(
      ep.setSubmissionAuthority,
      await api.callAs(admin, ep.setSubmissionAuthority, { tenant: 'tsodilo', params: { userId: 25 }, body: { granted: true, scope: { scopeType: 'tender', scopeId: 6 }, reason: 'Sign T-2026-0006' } }),
    );
    expect(granted.submissionSource).toBe('tender_role');
    expect(granted.submissionTenders.map((tender) => tender.reference)).toEqual(['T-2026-0006']);
    expect(problemCode(await api.callAs(admin, ep.setSubmissionAuthority, { tenant: 'tsodilo', params: { userId: 24 }, body: { granted: true, scope: { scopeType: 'organization', scopeId: null }, reason: 'x' } }))).toBe('SELF_GRANT_FORBIDDEN');
    expect(problemCode(await api.callAs(admin, ep.setSubmissionAuthority, { tenant: 'tsodilo', params: { userId: 27 }, body: { granted: true, scope: { scopeType: 'organization', scopeId: null }, reason: 'x' } }))).toBe('SUBMISSION_AUTHORITY_UNCHANGED');
    expect((await api.callAs(admin, ep.setSubmissionAuthority, { tenant: 'tsodilo', params: { userId: 25 }, body: { granted: true, scope: { scopeType: 'department', scopeId: 1 }, reason: 'x' } })).status).toBe(422);
  });

  it('offers no authority action on the administrator’s own row and no signing limit without submission (AC-03)', async () => {
    const page = parsed(ep.listSupplierAuthority, await api.callAs(admin, ep.listSupplierAuthority, { tenant: 'tsodilo', query: { pageSize: 100 } }));
    const own = page.items.find((row) => row.member.userId === 24);
    expect(own).toMatchObject({ availableActions: [], blockedBy: 'self' });
    const contributor = page.items.find((row) => row.member.userId === 26);
    expect(contributor).toMatchObject({ availableActions: ['changeSubmission'], blockedBy: 'no_submission_authority' });
    const signatory = page.items.find((row) => row.member.userId === 27);
    expect(signatory).toMatchObject({ availableActions: ['changeSubmission', 'setSigningLimit'], blockedBy: null });
    const departed = page.items.find((row) => row.member.userId === 121);
    expect(departed).toMatchObject({ availableActions: [], blockedBy: 'inactive' });
  });

  it('sets signing limits only for signatories', async () => {
    const body = { maxAmount: { amount: '6000000.00', currency: 'BWP' }, effectiveFrom: '2026-10-01T00:00:00Z', effectiveTo: null, reason: 'Board resolution 2026/14' };
    expect(parsed(ep.setSigningLimit, await api.callAs(admin, ep.setSigningLimit, { tenant: 'tsodilo', params: { userId: 27 }, body })).signingLimit?.maxAmount).toEqual(body.maxAmount);
    expect(problemCode(await api.callAs(admin, ep.setSigningLimit, { tenant: 'tsodilo', params: { userId: 26 }, body }))).toBe('SIGNING_LIMIT_REQUIRES_SIGNATORY');
    expect(problemCode(await api.callAs(admin, ep.setSigningLimit, { tenant: 'tsodilo', params: { userId: 27 }, body: { ...body, maxAmount: { amount: '1.00', currency: 'USD' } } }))).toBe('CURRENCY_NOT_ACCEPTED');
  });

  it('shows the departed bid coordinator’s pricing assignment for reassignment and her submission as history', async () => {
    const detail = parsed(ep.supplierGetMember, await api.callAs(admin, ep.supplierGetMember, { tenant: 'tsodilo', params: { userId: 121 } }));
    expect(detail.userStatus).toBe('deactivated');
    expect(detail.openWork.map((item) => item.reference)).toContain('T-2026-0006');
    expect(detail.attributedHistory[0]?.kind).toBe('bid_submission');
  });
});
