/**
 * Org-admin fixture tests: every fixture row projects to a contract-valid row, and the fixtures are internally
 * consistent with each other and with the platform personas (demo storyline).
 */
import { describe, expect, it } from 'vitest';

import { lte } from '../../../contracts/decimal.js';
import {
  AccessGrantRow,
  AccessRestrictionRow,
  AuthorityLimitRow,
  CommitteeDetail,
  ConflictDeclarationDetail,
  DelegationRow,
  GroupDetail,
  InvitationRow,
  InvitationToken,
  MemberDetail,
  MyMembership,
  RoleDetail,
  SupplierAuthorityRow,
  TenderAssignmentRow,
  CatalogCategory,
  ContactChange,
  AccessFinding,
} from '../../../contracts/org-admin.js';
import { permissionTenantKind } from '../../../contracts/permissions.js';
import {
  committeeDetail,
  conflictDetail,
  delegationRow,
  grantRow,
  groupDetail,
  invitationRow,
  limitRow,
  memberDetail,
  myMembership,
  restrictionRow,
  roleDetail,
  supplierAuthorityRow,
  assignmentRow,
  accessFindings,
  availableActions,
  userLimitFor,
} from '../../handlers/org-admin/views.js';
import { scopeWidening } from '../../handlers/org-admin/authority.js';
import { STRUCTURE_PROJECTIONS, organizationOf, settingsOf } from '../../handlers/org-admin/organization.js';
import { OrganizationSettings } from '../../../contracts/org-admin.js';
import { PERSONAS, TENANTS, TENANT_IDS } from '../platform.js';
import { PURSUITS } from '../publication/pursuits.js';
import { MILESTONES, TENDERS } from '../tenders/index.js';
import {
  ACCESS_GRANTS,
  ACCESS_RESTRICTIONS,
  AUTHORITY_LIMITS,
  CATEGORY_CATALOG,
  COMMITTEES,
  CONFLICT_DECLARATIONS,
  CONTACT_CHANGES,
  DELEGATIONS,
  GROUPS,
  INVITATIONS,
  MEMBERS,
  ROLE_ASSIGNMENTS,
  ASSIGNABLE_TENDER_IDS,
  FIXTURE_AS_OF,
  TENDER_ASSIGNMENTS,
  TENDER_REFS,
  WORK_ITEMS,
  administratorOf,
  findTenantRoleByCode,
  tenantRoles,
} from './index.js';

const NOW = new Date('2026-09-30T08:00:00Z');
const userIds = new Set(MEMBERS.map((member) => member.userId));

describe('org-admin fixtures parse against the contract', () => {
  it('projects every member of every tenant to a valid member detail', () => {
    for (const member of MEMBERS) {
      expect(() => MemberDetail.parse(memberDetail(member, 3, NOW)), `${member.fullName}@${member.tenantId}`).not.toThrow();
      expect(() => MyMembership.parse(myMembership(member, NOW))).not.toThrow();
    }
  });

  it('projects every role, group, invitation and supplier authority row', () => {
    for (const tenant of TENANTS) {
      for (const role of tenantRoles(tenant.id)) {
        expect(() => RoleDetail.parse(roleDetail(tenant.id, role.code, NOW)), role.code).not.toThrow();
      }
    }
    GROUPS.forEach((group) => expect(() => GroupDetail.parse(groupDetail(group, NOW))).not.toThrow());
    INVITATIONS.forEach((invitation) => expect(() => InvitationRow.parse(invitationRow(invitation, NOW))).not.toThrow());
    MEMBERS.filter((member) => TENANTS.find((tenant) => tenant.id === member.tenantId)?.kind === 'supplier').forEach((member) =>
      expect(() => SupplierAuthorityRow.parse(supplierAuthorityRow(member, NOW))).not.toThrow(),
    );
    TENDER_ASSIGNMENTS.forEach((assignment) => expect(() => TenderAssignmentRow.parse(assignmentRow(assignment))).not.toThrow());
  });

  it('projects every grant, restriction, limit, delegation, committee and declaration', () => {
    ACCESS_GRANTS.forEach((grant) => expect(() => AccessGrantRow.parse(grantRow(grant, NOW))).not.toThrow());
    ACCESS_RESTRICTIONS.forEach((restriction) => expect(() => AccessRestrictionRow.parse(restrictionRow(restriction, NOW))).not.toThrow());
    AUTHORITY_LIMITS.forEach((limit) => expect(() => AuthorityLimitRow.parse(limitRow(limit, NOW))).not.toThrow());
    DELEGATIONS.forEach((delegation) => expect(() => DelegationRow.parse(delegationRow(delegation, NOW))).not.toThrow());
    COMMITTEES.forEach((committee) => expect(() => CommitteeDetail.parse(committeeDetail(committee, NOW))).not.toThrow());
    CONFLICT_DECLARATIONS.forEach((declaration) =>
      expect(() => ConflictDeclarationDetail.parse(conflictDetail(declaration, 3, NOW))).not.toThrow(),
    );
    for (const tenantId of [TENANT_IDS.kwu, TENANT_IDS.odc]) {
      accessFindings(tenantId, NOW).forEach((finding) => expect(() => AccessFinding.parse(finding)).not.toThrow());
    }
  });

  it('projects both buyers’ settings and every structure value', () => {
    for (const tenantId of [TENANT_IDS.kwu, TENANT_IDS.odc]) {
      const tenant = TENANTS.find((candidate) => candidate.id === tenantId);
      const settings = settingsOf(tenantId);
      expect(tenant).toBeDefined();
      expect(settings).toBeDefined();
      if (tenant !== undefined && settings !== undefined) {
        expect(() => OrganizationSettings.parse(organizationOf(tenant, settings))).not.toThrow();
      }
      for (const [kind, project] of Object.entries(STRUCTURE_PROJECTIONS)) {
        expect(project(tenantId).length, `${kind} of ${tenantId}`).toBeGreaterThan(0);
      }
    }
    CATEGORY_CATALOG.forEach((entry) => expect(() => CatalogCategory.parse(entry)).not.toThrow());
    CONTACT_CHANGES.forEach(({ userId: _userId, ...change }) => expect(() => ContactChange.parse(change)).not.toThrow());
  });
});

describe('org-admin fixtures are consistent with the storyline', () => {
  it('includes every persona membership and gives every tenant members', () => {
    const membershipIds = new Set(MEMBERS.map((member) => member.membershipId));
    expect(membershipIds.size).toBe(MEMBERS.length);
    for (const persona of PERSONAS) {
      for (const membership of persona.memberships) {
        expect(membershipIds.has(membership.membershipId)).toBe(true);
      }
    }
    for (const tenant of TENANTS) {
      expect(MEMBERS.some((member) => member.tenantId === tenant.id), tenant.slug).toBe(true);
    }
  });

  it('references only known people and roles', () => {
    const people = [
      ...ACCESS_GRANTS.flatMap((grant) => [grant.userId, grant.ownerUserId, grant.grantedByUserId]),
      ...ACCESS_RESTRICTIONS.map((restriction) => restriction.userId),
      ...DELEGATIONS.flatMap((delegation) => [delegation.delegatorUserId, delegation.delegateUserId]),
      ...COMMITTEES.flatMap((committee) => committee.members.map((member) => member.userId)),
      ...GROUPS.flatMap((group) => group.members.map((member) => member.userId)),
      ...WORK_ITEMS.map((item) => item.userId),
      ...CONFLICT_DECLARATIONS.map((declaration) => declaration.userId),
      ...INVITATIONS.map((invitation) => invitation.invitedByUserId),
    ];
    expect(people.filter((userId) => !userIds.has(userId))).toEqual([]);
    const unknownRoles = [
      ...ROLE_ASSIGNMENTS.map((assignment) => ({ tenantId: assignment.tenantId, code: assignment.roleCode })),
      ...INVITATIONS.flatMap((invitation) => invitation.roleCodes.map((code) => ({ tenantId: invitation.tenantId, code }))),
    ].filter((ref) => findTenantRoleByCode(ref.tenantId, ref.code) === undefined);
    expect(unknownRoles).toEqual([]);
  });

  it('keeps people inside the tenant of each record', () => {
    const inTenant = (tenantId: number, userId: number) => MEMBERS.some((member) => member.tenantId === tenantId && member.userId === userId);
    expect(ACCESS_GRANTS.filter((grant) => !inTenant(grant.tenantId, grant.userId))).toEqual([]);
    expect(DELEGATIONS.filter((delegation) => !inTenant(delegation.tenantId, delegation.delegateUserId))).toEqual([]);
    expect(TENDER_ASSIGNMENTS.filter((assignment) => !inTenant(assignment.tenantId, assignment.userId))).toEqual([]);
    expect(WORK_ITEMS.filter((item) => !inTenant(item.tenantId, item.userId))).toEqual([]);
  });

  it('offers “recover membership” for at least one ended member of every buyer (ADM-03)', () => {
    for (const tenantId of [TENANT_IDS.kwu, TENANT_IDS.odc]) {
      const recoverable = MEMBERS.filter(
        (member) => member.tenantId === tenantId && availableActions(member, administratorOf(tenantId)).includes('recover'),
      );
      expect(recoverable.length, `tenant ${tenantId}`).toBeGreaterThan(0);
      expect(recoverable.every((member) => !WORK_ITEMS.some((item) => item.tenantId === tenantId && item.userId === member.userId))).toBe(true);
    }
  });

  it('grants no role before an invitation is accepted or a membership request approved (FR-03)', () => {
    const notYet = MEMBERS.filter((member) => member.membershipStatus === 'invited' || member.membershipStatus === 'pending_approval');
    expect(notYet.length).toBeGreaterThan(0);
    const early = ROLE_ASSIGNMENTS.filter((assignment) =>
      notYet.some((member) => member.tenantId === assignment.tenantId && member.userId === assignment.userId),
    );
    expect(early.map((assignment) => assignment.assignmentId)).toEqual([]);
    const samAtSerowe = notYet.find((member) => member.tenantId === TENANT_IDS['serowe-ict'] && member.membershipStatus === 'pending_approval');
    expect(samAtSerowe).toBeDefined();
    if (samAtSerowe !== undefined) {
      expect(memberDetail(samAtSerowe, administratorOf(TENANT_IDS['serowe-ict']), NOW).roleAssignments).toEqual([]);
    }
  });

  it('uses unique, well-formed invitation tokens', () => {
    const tokens = INVITATIONS.map((invitation) => invitation.token);
    expect(new Set(tokens).size).toBe(tokens.length);
    tokens.forEach((token) => expect(InvitationToken.safeParse(token).success, token).toBe(true));
  });

  it('only contains direct grants of permissions the granting administrator holds', () => {
    const notHeld = ACCESS_GRANTS.filter((grant) => {
      const granter = PERSONAS.find((persona) => persona.userId === grant.grantedByUserId);
      const membership = granter?.memberships.find((candidate) => candidate.tenantId === grant.tenantId);
      return membership === undefined || !membership.roles.some((role) => findTenantRoleByCode(grant.tenantId, role.roleCode)?.permissions.includes(grant.permissionCode));
    });
    expect(notHeld.map((grant) => grant.grantId)).toEqual([]);
    expect(ACCESS_GRANTS.every((grant) => permissionTenantKind(grant.permissionCode) === 'buyer')).toBe(true);
  });

  it('keeps every delegation within its delegator’s limit at its start (BR-06)', () => {
    for (const delegation of DELEGATIONS) {
      for (const type of delegation.decisionTypes) {
        const limit = userLimitFor(delegation.tenantId, delegation.delegatorUserId, type, new Date(delegation.startsAt));
        expect(limit, `delegation ${delegation.delegationId} ${type}`).toBeDefined();
        if (limit?.amount !== null && limit !== undefined && delegation.maxAmount !== null) {
          expect(lte(delegation.maxAmount, limit.amount)).toBe(true);
        }
        if (limit !== undefined) {
          expect(scopeWidening(delegation.tenantId, limit, delegation), `delegation ${delegation.delegationId} ${type}`).toBeNull();
        }
      }
    }
  });

  it('agrees with the approval limits of the platform personas (AC-05)', () => {
    for (const persona of PERSONAS) {
      for (const membership of persona.memberships) {
        if (membership.authorityLimit === null) {
          continue;
        }
        const limit = AUTHORITY_LIMITS.find(
          (candidate) => candidate.subjectUserId === persona.userId && candidate.decisionType === 'request_approval' && candidate.effectiveTo === null,
        );
        expect(limit?.maxAmount, persona.email).toBe(membership.authorityLimit.amount);
      }
    }
  });

  it('demonstrates the dual-capacity conflict routed for review (AC-02)', () => {
    const sam = PERSONAS.find((persona) => persona.email === 'sam.dual@tenderiq.local');
    const pending = CONFLICT_DECLARATIONS.filter((declaration) => declaration.userId === sam?.userId && declaration.disposition === 'pending_review');
    expect(pending.map((declaration) => declaration.subjectReference)).toEqual(['T-2026-0003']);
  });
});

describe('org-admin tender references agree with the tender register (DD-33, SUP-04)', () => {
  const officialDeadline = (tenderId: number) =>
    MILESTONES.find((row) => row.tenderId === tenderId && row.lotId === null && row.milestone === 'submission_deadline')?.at ?? null;

  it.each([
    ['T-2026-0001', '2026-07-24T08:00:00Z'],
    ['T-2026-0002', '2026-10-21T10:00:00Z'],
    ['T-2026-0003', '2026-08-28T08:00:00Z'],
    ['T-2026-0006', '2026-10-14T10:00:00Z'],
    ['T-2026-0007', '2026-06-26T08:00:00Z'],
    ['T-2026-0008', '2026-09-25T08:00:00Z'],
    ['T-2026-0010', '2026-02-03T08:00:00Z'],
  ])('shows %s with the official submission deadline %s of its timetable', (reference, deadline) => {
    // Arrange
    const ref = TENDER_REFS.find((row) => row.reference === reference);

    // Assert
    expect(ref?.submissionDeadline).toBe(deadline);
    expect(ref?.officialTimeZone).toBe('Africa/Gaborone');
  });

  it('keeps the title, buyer, deadline and zone of every referenced tender identical to the tender fixtures', () => {
    for (const ref of TENDER_REFS) {
      const tender = TENDERS.find((row) => row.id === ref.tenderId);
      expect(tender, ref.reference).toBeDefined();
      expect(ref, ref.reference).toEqual({
        tenderId: tender?.id,
        buyerTenantId: tender?.tenantId,
        reference: tender?.reference,
        title: tender?.title,
        submissionDeadline: officialDeadline(ref.tenderId),
        officialTimeZone: tender?.officialTimeZone,
      });
    }
  });

  it('projects every assignable tender with its official deadline and time zone', () => {
    for (const assignment of TENDER_ASSIGNMENTS) {
      const row = assignmentRow(assignment);
      const tender = TENDERS.find((candidate) => candidate.id === assignment.tenderId);
      const deadline = officialDeadline(assignment.tenderId);
      expect(row.tender.submissionDeadline, `assignment ${assignment.assignmentId}`).toEqual(
        deadline === null ? null : { at: deadline, timeZone: tender?.officialTimeZone },
      );
    }
  });

  it('assigns every member of an open multi-member pursuit team to that tender with the same responsibility (SUP-09)', () => {
    // Arrange
    const openTeams = PURSUITS.filter((pursuit) => {
      const deadline = officialDeadline(pursuit.tenderId);
      return pursuit.decision === 'bid' && pursuit.team.length > 1 && deadline !== null && deadline > FIXTURE_AS_OF;
    });

    // Assert
    expect(openTeams.map((pursuit) => pursuit.id).sort()).toEqual(expect.arrayContaining([4002, 4006]));
    for (const pursuit of openTeams) {
      expect(ASSIGNABLE_TENDER_IDS[pursuit.tenantId], `pursuit ${pursuit.id}`).toContain(pursuit.tenderId);
      for (const member of pursuit.team) {
        const assigned = TENDER_ASSIGNMENTS.some(
          (row) =>
            row.tenantId === pursuit.tenantId &&
            row.tenderId === pursuit.tenderId &&
            row.userId === member.userId &&
            row.responsibility === member.responsibility &&
            row.endedAt === null,
        );
        expect(assigned, `pursuit ${pursuit.id} member ${member.userId} (${member.responsibility})`).toBe(true);
      }
    }
  });
});
