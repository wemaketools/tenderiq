/**
 * Org-admin mock handlers, member administration shared by `/buyer/admin/*` (ADM-03, ADM-04) and
 * `/supplier/admin/*` (SUP-04). One implementation serves both audiences: every read and check is scoped to the
 * caller's active tenant, and grantable roles are that tenant's roles only, so a supplier administrator never sees
 * or assigns a buyer permission. Commands validate against the fixture state and answer with the outcome; nothing
 * is stored.
 */
import { buyerMemberAdmin, supplierMemberAdmin } from '../../../contracts/org-admin.js';
import type { LifecycleEffects, MemberRow } from '../../../contracts/org-admin.js';
import { PERMISSION_CODES, ROLE_TEMPLATES, ROLE_TEMPLATE_CODES, GRANT_ONLY_PERMISSIONS, permissionTenantKind } from '../../../contracts/permissions.js';
import type { PermissionCode } from '../../../contracts/permissions.js';
import { mockRoute } from '../../app.js';
import type { MockApp } from '../../app.js';
import {
  ACCESS_GRANTS,
  DELEGATIONS,
  GROUPS,
  INVITATIONS,
  MEMBERS,
  ROLE_ASSIGNMENTS,
  TENDER_ASSIGNMENTS,
  WORK_ITEMS,
  findTenantRoleById,
  tenantRoles,
} from '../../fixtures/org-admin/index.js';
import type { FixtureMember } from '../../fixtures/org-admin/index.js';
import {
  activeAdministrators,
  addDays,
  attributedHistoryOf,
  assignmentRow,
  delegationRow,
  delegationStatus,
  enforcedSodBreaches,
  grantRow,
  grantStatus,
  groupDetail,
  groupRow,
  heldPermissionsOf,
  invitationRow,
  invitationStatus,
  iso,
  matches,
  memberDetail,
  memberRow,
  permissionInfo,
  reassignmentCandidates,
  roleAssignmentRow,
  roleAssignmentRowsOf,
  roleDetail,
  roleRow,
  scopeLabelOf,
  sortRows,
  tenantKindOf,
  withinDates,
  workItemsOf,
} from './views.js';

type MemberAdminSet = typeof buyerMemberAdmin;

const NO_EFFECTS: LifecycleEffects = {
  reassignedWorkItems: 0,
  endedDelegations: 0,
  endedGrants: 0,
  endedRoleAssignments: 0,
  retainedHistoryRecords: 0,
};

function isLiveStatus(status: string): boolean {
  return status === 'active' || status === 'expiring_soon';
}

/** Permissions a tenant of this kind may put into a role (never another kind's, never grant-only ones). */
export function grantablePermissions(tenantId: number): PermissionCode[] {
  const kind = tenantKindOf(tenantId);
  return PERMISSION_CODES.filter(
    (code) =>
      (permissionTenantKind(code) === kind || permissionTenantKind(code) === 'any') &&
      !(GRANT_ONLY_PERMISSIONS as readonly string[]).includes(code),
  );
}

function registerSet(app: MockApp, set: MemberAdminSet): void {
  const findMember = (tenantId: number, userId: number): FixtureMember | undefined =>
    MEMBERS.find((member) => member.tenantId === tenantId && member.userId === userId);

  const withStatus = (row: MemberRow, membershipStatus: MemberRow['membershipStatus']): MemberRow => ({ ...row, membershipStatus });

  const checkRoles = (tenantId: number, roleIds: readonly number[]): boolean =>
    roleIds.every((roleId) => {
      const role = findTenantRoleById(tenantId, roleId);
      return role !== undefined && role.active;
    });

  mockRoute(app, set.listMembers, ({ requireTenant, query, fixtures, now }) => {
    const { tenant } = requireTenant();
    const rows = MEMBERS.filter((member) => member.tenantId === tenant.id)
      .filter((member) => query.status === undefined || query.status.includes(member.membershipStatus))
      .filter((member) => withinDates(member.joinedAt, query.joinedFrom, query.joinedTo))
      .map((member) => memberRow(member, now))
      .filter((row) => matches(query.q, row.fullName, row.email, row.capacity))
      .filter((row) => query.roleId === undefined || row.roles.some((role) => role.roleId === query.roleId))
      .filter((row) => query.groupId === undefined || row.groups.some((group) => group.groupId === query.groupId))
      .filter((row) => query.hasOpenWork === undefined || (row.openWorkCount > 0) === query.hasOpenWork);
    return fixtures.page(
      sortRows(
        rows,
        query.sort,
        query.dir,
        {
          fullName: (row) => row.fullName,
          status: (row) => row.membershipStatus,
          joinedAt: (row) => row.joinedAt,
          lastSeenAt: (row) => row.lastSeenAt,
          openWorkCount: (row) => row.openWorkCount,
        },
        'fullName',
      ),
    );
  });

  mockRoute(app, set.getMember, ({ requireTenant, requirePersona, params, notFound, now }) => {
    const { tenant } = requireTenant();
    const member = findMember(tenant.id, params.userId);
    if (member === undefined) {
      return notFound();
    }
    return memberDetail(member, requirePersona().userId, now);
  });

  mockRoute(app, set.updateMember, ({ requireTenant, params, body, notFound, fail, now }) => {
    const { tenant } = requireTenant();
    const member = findMember(tenant.id, params.userId);
    if (member === undefined) {
      return notFound();
    }
    if (member.userStatus === 'deactivated') {
      return fail(409, 'USER_DEACTIVATED', 'A deactivated person cannot be edited; their history stays as recorded.');
    }
    return { ...memberRow(member, now), capacity: body.capacity };
  });

  mockRoute(app, set.inviteMember, ({ requireTenant, requirePersona, body, fail, now }) => {
    const { tenant } = requireTenant();
    const existing = MEMBERS.find((member) => member.tenantId === tenant.id && member.email.toLowerCase() === body.email);
    if (existing !== undefined && (existing.membershipStatus === 'active' || existing.membershipStatus === 'suspended' || existing.membershipStatus === 'pending_approval')) {
      return fail(409, 'ALREADY_MEMBER', `${existing.fullName} already belongs to this organization.`);
    }
    const pending = INVITATIONS.find(
      (invitation) =>
        invitation.tenantId === tenant.id && invitation.email === body.email && invitationStatus(invitation, now) === 'pending',
    );
    if (pending !== undefined) {
      return fail(409, 'INVITATION_ALREADY_PENDING', 'An invitation to this address is still open. Reissue it instead.');
    }
    if (!checkRoles(tenant.id, body.roleIds)) {
      return fail(422, 'ROLE_NOT_GRANTABLE', 'Choose active roles of this organization.');
    }
    if (!body.groupIds.every((groupId) => GROUPS.some((group) => group.groupId === groupId && group.tenantId === tenant.id && group.active))) {
      return fail(422, 'GROUP_NOT_FOUND', 'Choose active groups of this organization.');
    }
    const roles = body.roleIds.flatMap((roleId) => {
      const role = findTenantRoleById(tenant.id, roleId);
      return role === undefined ? [] : [{ roleId: role.roleId, code: role.code, name: role.name, templateCode: role.templateCode }];
    });
    const caller = requirePersona();
    return {
      invitationId: 900,
      email: body.email,
      fullName: body.fullName,
      capacity: body.capacity,
      roles,
      status: 'pending',
      expiresAt: addDays(now, body.expiresInDays),
      sentCount: 1,
      invitedBy: { userId: caller.userId, fullName: caller.fullName },
      createdAt: iso(now),
      acceptedAt: null,
      reissuedFromId: null,
      reissuedToId: null,
      canReissue: true,
      canRevoke: true,
    };
  });

  mockRoute(app, set.listInvitations, ({ requireTenant, query, fixtures, now }) => {
    const { tenant } = requireTenant();
    const rows = INVITATIONS.filter((invitation) => invitation.tenantId === tenant.id)
      .map((invitation) => invitationRow(invitation, now))
      .filter((row) => query.status === undefined || query.status.includes(row.status))
      .filter((row) => withinDates(row.createdAt, query.createdFrom, query.createdTo))
      .filter((row) => matches(query.q, row.email, row.fullName, row.capacity));
    return fixtures.page(
      sortRows(
        rows,
        query.sort,
        query.dir,
        {
          createdAt: (row) => row.createdAt,
          expiresAt: (row) => row.expiresAt,
          email: (row) => row.email,
          status: (row) => row.status,
        },
        'createdAt',
      ),
    );
  });

  mockRoute(app, set.reissueInvitation, ({ requireTenant, requirePersona, params, body, notFound, fail, now }) => {
    const { tenant } = requireTenant();
    const invitation = INVITATIONS.find((candidate) => candidate.tenantId === tenant.id && candidate.invitationId === params.invitationId);
    if (invitation === undefined) {
      return notFound();
    }
    const row = invitationRow(invitation, now);
    if (!row.canReissue) {
      return fail(409, 'INVITATION_NOT_REISSUABLE', `An invitation that is ${row.status} cannot be reissued.`);
    }
    const caller = requirePersona();
    return {
      ...row,
      invitationId: 901,
      status: 'pending',
      expiresAt: addDays(now, body.expiresInDays),
      sentCount: 1,
      invitedBy: { userId: caller.userId, fullName: caller.fullName },
      createdAt: iso(now),
      reissuedFromId: invitation.invitationId,
      reissuedToId: null,
      canReissue: true,
      canRevoke: true,
    };
  });

  mockRoute(app, set.revokeInvitation, ({ requireTenant, params, notFound, fail, now }) => {
    const { tenant } = requireTenant();
    const invitation = INVITATIONS.find((candidate) => candidate.tenantId === tenant.id && candidate.invitationId === params.invitationId);
    if (invitation === undefined) {
      return notFound();
    }
    const row = invitationRow(invitation, now);
    if (!row.canRevoke) {
      return fail(409, 'INVITATION_NOT_REVOCABLE', `An invitation that is ${row.status} cannot be revoked.`);
    }
    return { ...row, status: 'revoked', canReissue: false, canRevoke: false };
  });

  mockRoute(app, set.activateMember, ({ requireTenant, requirePersona, params, notFound, fail, now }) => {
    const { tenant } = requireTenant();
    const member = findMember(tenant.id, params.userId);
    if (member === undefined) {
      return notFound();
    }
    if (member.userId === requirePersona().userId) {
      return fail(409, 'CANNOT_CHANGE_OWN_STATUS', 'Another administrator must change your own status.');
    }
    if (member.membershipStatus !== 'suspended') {
      return fail(409, 'MEMBER_NOT_SUSPENDED', 'Only a suspended member can be reactivated.');
    }
    return { member: withStatus(memberRow(member, now), 'active'), effects: NO_EFFECTS };
  });

  mockRoute(app, set.approveMembership, ({ requireTenant, params, body, notFound, fail, now }) => {
    const { tenant } = requireTenant();
    const member = findMember(tenant.id, params.userId);
    if (member === undefined) {
      return notFound();
    }
    if (member.membershipStatus !== 'pending_approval') {
      return fail(409, 'MEMBERSHIP_NOT_PENDING', 'Only a pending membership request can be approved.');
    }
    if (!checkRoles(tenant.id, body.roleIds)) {
      return fail(422, 'ROLE_NOT_GRANTABLE', 'Choose active roles of this organization.');
    }
    const roles = body.roleIds.flatMap((roleId) => {
      const role = findTenantRoleById(tenant.id, roleId);
      return role === undefined ? [] : [{ roleId: role.roleId, code: role.code, name: role.name, templateCode: role.templateCode }];
    });
    return {
      member: { ...memberRow(member, now), membershipStatus: 'active', capacity: body.capacity, roles, joinedAt: iso(now) },
      effects: NO_EFFECTS,
    };
  });

  mockRoute(app, set.rejectMembership, ({ requireTenant, params, notFound, fail, now }) => {
    const { tenant } = requireTenant();
    const member = findMember(tenant.id, params.userId);
    if (member === undefined) {
      return notFound();
    }
    if (member.membershipStatus !== 'pending_approval') {
      return fail(409, 'MEMBERSHIP_NOT_PENDING', 'Only a pending membership request can be rejected.');
    }
    return { member: withStatus(memberRow(member, now), 'revoked'), effects: NO_EFFECTS };
  });

  mockRoute(app, set.suspendMember, ({ requireTenant, requirePersona, params, notFound, fail, now }) => {
    const { tenant } = requireTenant();
    const member = findMember(tenant.id, params.userId);
    if (member === undefined) {
      return notFound();
    }
    if (member.userId === requirePersona().userId) {
      return fail(409, 'CANNOT_CHANGE_OWN_STATUS', 'Another administrator must change your own status.');
    }
    if (member.membershipStatus !== 'active') {
      return fail(409, 'MEMBER_NOT_ACTIVE', 'Only an active member can be suspended.');
    }
    const admins = activeAdministrators(tenant.id, now);
    if (admins.length === 1 && admins[0] === member.userId) {
      return fail(409, 'LAST_ADMINISTRATOR', 'This is the only administrator. Appoint another administrator first.');
    }
    return { member: withStatus(memberRow(member, now), 'suspended'), effects: NO_EFFECTS };
  });

  mockRoute(app, set.getDeactivationReview, ({ requireTenant, requirePersona, params, notFound, now }) => {
    const { tenant } = requireTenant();
    const member = findMember(tenant.id, params.userId);
    if (member === undefined) {
      return notFound();
    }
    const blockers: Array<{ code: string; message: string }> = [];
    if (member.userId === requirePersona().userId) {
      blockers.push({ code: 'CANNOT_CHANGE_OWN_STATUS', message: 'Another administrator must deactivate your own account.' });
    }
    const admins = activeAdministrators(tenant.id, now);
    if (admins.length === 1 && admins[0] === member.userId) {
      blockers.push({ code: 'LAST_ADMINISTRATOR', message: 'This is the only administrator. Appoint another administrator first.' });
    }
    if (member.userStatus === 'deactivated' || member.membershipStatus === 'revoked') {
      blockers.push({ code: 'MEMBER_ALREADY_DEACTIVATED', message: 'Access has already ended. Remaining work can still be reassigned.' });
    }
    return {
      member: memberRow(member, now),
      openWork: workItemsOf(tenant.id, member.userId, now),
      delegationsGiven: DELEGATIONS.filter(
        (delegation) => delegation.tenantId === tenant.id && delegation.delegatorUserId === member.userId,
      ).map((delegation) => delegationRow(delegation, now)),
      delegationsReceived: DELEGATIONS.filter(
        (delegation) => delegation.tenantId === tenant.id && delegation.delegateUserId === member.userId,
      ).map((delegation) => delegationRow(delegation, now)),
      activeGrants: ACCESS_GRANTS.filter(
        (grant) => grant.tenantId === tenant.id && grant.userId === member.userId && grantStatus(grant, now) !== 'revoked' && grantStatus(grant, now) !== 'expired',
      ).map((grant) => grantRow(grant, now)),
      activeRoleAssignments: roleAssignmentRowsOf(tenant.id, member.userId, now).filter((row) => isLiveStatus(row.status)).length,
      tenderAssignments: TENDER_ASSIGNMENTS.filter(
        (assignment) => assignment.tenantId === tenant.id && assignment.userId === member.userId && assignment.endedAt === null,
      ).map(assignmentRow),
      attributedHistory: attributedHistoryOf(tenant.id, member.userId),
      blockers,
      candidates: reassignmentCandidates(tenant.id, member.userId),
    };
  });

  const validateReassignments = (
    tenantId: number,
    userId: number,
    reassignments: ReadonlyArray<{ workItemId: number; toUserId: number }>,
    fail: (status: number, code: string, detail?: string) => never,
  ): void => {
    for (const reassignment of reassignments) {
      const item = WORK_ITEMS.find(
        (candidate) => candidate.tenantId === tenantId && candidate.userId === userId && candidate.workItemId === reassignment.workItemId,
      );
      if (item === undefined) {
        fail(409, 'WORK_ITEM_NOT_OPEN', `Work item ${reassignment.workItemId} is not open for this member.`);
      }
      const target = findMember(tenantId, reassignment.toUserId);
      if (target === undefined || target.membershipStatus !== 'active' || target.userStatus !== 'active' || target.userId === userId) {
        fail(409, 'REASSIGNEE_NOT_ELIGIBLE', 'Work can only move to another active member of this organization.');
      }
    }
  };

  mockRoute(app, set.deactivateMember, ({ requireTenant, requirePersona, params, body, notFound, fail, now }) => {
    const { tenant } = requireTenant();
    const member = findMember(tenant.id, params.userId);
    if (member === undefined) {
      return notFound();
    }
    if (member.userId === requirePersona().userId) {
      return fail(409, 'CANNOT_CHANGE_OWN_STATUS', 'Another administrator must deactivate your own account.');
    }
    if (member.userStatus === 'deactivated' || member.membershipStatus === 'revoked') {
      return fail(409, 'MEMBER_ALREADY_DEACTIVATED', 'Access has already ended. Use reassign work for what remains.');
    }
    const admins = activeAdministrators(tenant.id, now);
    if (admins.length === 1 && admins[0] === member.userId) {
      return fail(409, 'LAST_ADMINISTRATOR', 'This is the only administrator. Appoint another administrator first.');
    }
    const formal = WORK_ITEMS.filter((item) => item.tenantId === tenant.id && item.userId === member.userId && item.requiresReassignment);
    const covered = new Set(body.reassignments.map((reassignment) => reassignment.workItemId));
    if (formal.some((item) => !covered.has(item.workItemId))) {
      return fail(409, 'OPEN_WORK_NOT_REASSIGNED', 'Reassign every formal work item before deactivating.');
    }
    validateReassignments(tenant.id, member.userId, body.reassignments, fail);
    const endedDelegations = DELEGATIONS.filter(
      (delegation) =>
        delegation.tenantId === tenant.id &&
        (delegation.delegatorUserId === member.userId || delegation.delegateUserId === member.userId) &&
        ['scheduled', 'active', 'expiring_soon'].includes(delegationStatus(delegation, now)),
    ).length;
    const endedGrants = ACCESS_GRANTS.filter(
      (grant) => grant.tenantId === tenant.id && grant.userId === member.userId && ['scheduled', 'active', 'expiring_soon'].includes(grantStatus(grant, now)),
    ).length;
    return {
      member: { ...memberRow(member, now), membershipStatus: 'revoked', userStatus: 'deactivated', openWorkCount: 0, activeDelegationCount: 0 },
      effects: {
        reassignedWorkItems: body.reassignments.length,
        endedDelegations,
        endedGrants,
        endedRoleAssignments: roleAssignmentRowsOf(tenant.id, member.userId, now).filter((row) => isLiveStatus(row.status)).length,
        retainedHistoryRecords: attributedHistoryOf(tenant.id, member.userId).length,
      },
    };
  });

  mockRoute(app, set.reassignWork, ({ requireTenant, params, body, notFound, fail, now }) => {
    const { tenant } = requireTenant();
    const member = findMember(tenant.id, params.userId);
    if (member === undefined) {
      return notFound();
    }
    validateReassignments(tenant.id, member.userId, body.reassignments, fail);
    const row = memberRow(member, now);
    return {
      member: { ...row, openWorkCount: Math.max(0, row.openWorkCount - body.reassignments.length) },
      effects: { ...NO_EFFECTS, reassignedWorkItems: body.reassignments.length, retainedHistoryRecords: attributedHistoryOf(tenant.id, member.userId).length },
    };
  });

  mockRoute(app, set.recoverMembership, ({ requireTenant, params, body, notFound, fail, now }) => {
    const { tenant } = requireTenant();
    const member = findMember(tenant.id, params.userId);
    if (member === undefined) {
      return notFound();
    }
    if (member.membershipStatus !== 'revoked') {
      return fail(409, 'MEMBERSHIP_NOT_REVOKED', 'Only an ended membership can be recovered.');
    }
    if (member.userStatus === 'deactivated') {
      return fail(409, 'USER_DEACTIVATED', 'This person’s account is deactivated. Send a new invitation instead.');
    }
    if (!checkRoles(tenant.id, body.roleIds)) {
      return fail(422, 'ROLE_NOT_GRANTABLE', 'Choose active roles of this organization.');
    }
    return { member: { ...withStatus(memberRow(member, now), 'active'), joinedAt: iso(now) }, effects: NO_EFFECTS };
  });

  mockRoute(app, set.addRoleAssignment, ({ requireTenant, requirePersona, params, body, notFound, fail, now }) => {
    const { tenant } = requireTenant();
    const member = findMember(tenant.id, params.userId);
    if (member === undefined) {
      return notFound();
    }
    const caller = requirePersona();
    if (member.userId === caller.userId) {
      return fail(403, 'SELF_GRANT_FORBIDDEN', 'Nobody can assign a role to themselves.');
    }
    if (member.membershipStatus !== 'active') {
      return fail(409, 'USER_NOT_ACTIVE', 'Roles can be assigned to active members only.');
    }
    const role = findTenantRoleById(tenant.id, body.roleId);
    if (role === undefined || !role.active) {
      return fail(422, 'ROLE_NOT_GRANTABLE', 'Choose an active role of this organization.');
    }
    const scope = body.scope;
    const label = scopeLabelOf(tenant.id, scope.scopeType, scope.scopeId);
    if (label === null) {
      return fail(422, 'SCOPE_NOT_FOUND', 'The chosen record does not exist in this organization.');
    }
    const existing = ROLE_ASSIGNMENTS.find(
      (assignment) =>
        assignment.tenantId === tenant.id &&
        assignment.userId === member.userId &&
        assignment.roleCode === role.code &&
        assignment.scopeType === scope.scopeType &&
        assignment.scopeId === scope.scopeId &&
        assignment.revokedAt === null,
    );
    if (existing !== undefined) {
      return fail(409, 'ROLE_ALREADY_ASSIGNED', `${member.fullName} already holds ${role.name} in this scope.`);
    }
    if (scope.scopeType === 'tender') {
      const combined = [...heldPermissionsOf(tenant.id, member.userId, now), ...role.permissions];
      const before = enforcedSodBreaches(tenant.id, heldPermissionsOf(tenant.id, member.userId, now));
      const after = enforcedSodBreaches(tenant.id, combined).filter((rule) => !before.includes(rule));
      if (after.length > 0) {
        return fail(409, 'SOD_CONFLICT', `On one event this would combine incompatible duties (${after.join(', ')}).`);
      }
    }
    return roleAssignmentRow(
      {
        assignmentId: 900,
        tenantId: tenant.id,
        userId: member.userId,
        groupId: null,
        roleCode: role.code,
        scopeType: scope.scopeType,
        scopeId: scope.scopeId,
        scopeLabel: label,
        startsAt: body.startsAt ?? iso(now),
        endsAt: body.endsAt,
        grantedByUserId: caller.userId,
        revokedAt: null,
        reason: body.reason,
      },
      now,
    );
  });

  mockRoute(app, set.revokeRoleAssignment, ({ requireTenant, params, notFound, fail, now }) => {
    const { tenant } = requireTenant();
    const member = findMember(tenant.id, params.userId);
    if (member === undefined) {
      return notFound();
    }
    const row = roleAssignmentRowsOf(tenant.id, member.userId, now).find((candidate) => candidate.assignmentId === params.assignmentId);
    if (row === undefined) {
      return notFound();
    }
    if (row.viaGroup !== null) {
      return fail(409, 'ASSIGNMENT_VIA_GROUP', `This role comes from the group ${row.viaGroup.name}. Remove the member from the group instead.`);
    }
    if (!isLiveStatus(row.status) && row.status !== 'scheduled') {
      return fail(409, 'ASSIGNMENT_ALREADY_ENDED', 'This role assignment has already ended.');
    }
    const admins = activeAdministrators(tenant.id, now);
    if (row.role.templateCode !== null && ['org_admin', 'supplier_admin'].includes(row.role.templateCode) && admins.length === 1 && admins[0] === member.userId) {
      return fail(409, 'LAST_ADMINISTRATOR', 'This is the only administrator. Appoint another administrator first.');
    }
    return { ...row, revokedAt: iso(now), status: 'revoked' };
  });

  mockRoute(app, set.listRoles, ({ requireTenant, query, fixtures, now }) => {
    const { tenant } = requireTenant();
    const rows = tenantRoles(tenant.id)
      .map((role) => roleRow(tenant.id, role.code, now))
      .filter((row) => query.active === undefined || row.active === query.active)
      .filter((row) => query.isSystem === undefined || row.isSystem === query.isSystem)
      .filter((row) => matches(query.q, row.name, row.code, row.description));
    return fixtures.page(
      sortRows(
        rows,
        query.sort,
        query.dir,
        { name: (row) => row.name, code: (row) => row.code, activeAssignmentCount: (row) => row.activeAssignmentCount },
        'name',
      ),
    );
  });

  mockRoute(app, set.getRole, ({ requireTenant, params, notFound, now }) => {
    const { tenant } = requireTenant();
    const role = findTenantRoleById(tenant.id, params.roleId);
    if (role === undefined) {
      return notFound();
    }
    return roleDetail(tenant.id, role.code, now);
  });

  mockRoute(app, set.getRoleCatalog, ({ requireTenant }) => {
    const { tenant } = requireTenant();
    return {
      templates: ROLE_TEMPLATE_CODES.filter((code) => ROLE_TEMPLATES[code].tenantKind === tenant.kind).map((code) => ({
        code,
        name: ROLE_TEMPLATES[code].name,
        description: ROLE_TEMPLATES[code].description,
        permissionCodes: [...ROLE_TEMPLATES[code].permissions],
      })),
      permissions: grantablePermissions(tenant.id).map(permissionInfo),
    };
  });

  const checkPermissions = (
    tenantId: number,
    codes: readonly PermissionCode[],
    fail: (status: number, code: string, detail?: string) => never,
  ): void => {
    if (codes.some((code) => (GRANT_ONLY_PERMISSIONS as readonly string[]).includes(code))) {
      fail(422, 'PERMISSION_NOT_GRANTABLE', 'Support access is granted only through an authorized support grant.');
    }
    const allowed = new Set(grantablePermissions(tenantId));
    const foreign = codes.filter((code) => !allowed.has(code));
    if (foreign.length > 0) {
      fail(422, 'PERMISSION_WRONG_TENANT_KIND', `Not available to this organization: ${foreign.join(', ')}.`);
    }
    const breaches = enforcedSodBreaches(tenantId, codes);
    if (breaches.length > 0) {
      fail(422, 'SOD_INCOMPATIBLE_PERMISSIONS', `The role would combine duties the policy keeps apart (${breaches.join(', ')}).`);
    }
  };

  mockRoute(app, set.createRole, ({ requireTenant, body, fail }) => {
    const { tenant } = requireTenant();
    if (tenantRoles(tenant.id).some((role) => role.code === body.code)) {
      return fail(409, 'ROLE_CODE_TAKEN', `The code ${body.code} is already used by another role.`);
    }
    checkPermissions(tenant.id, body.permissionCodes, fail);
    const codes = PERMISSION_CODES.filter((code) => body.permissionCodes.includes(code));
    return {
      roleId: 900,
      code: body.code,
      name: body.name,
      description: body.description,
      templateCode: null,
      isSystem: false,
      active: true,
      deactivatedAt: null,
      permissionCount: codes.length,
      activeAssignmentCount: 0,
      permissions: codes.map(permissionInfo),
      holders: [],
      sodWarnings: [],
    };
  });

  mockRoute(app, set.updateRole, ({ requireTenant, params, body, notFound, fail, now }) => {
    const { tenant } = requireTenant();
    const role = findTenantRoleById(tenant.id, params.roleId);
    if (role === undefined) {
      return notFound();
    }
    if (role.templateCode !== null) {
      return fail(409, 'SYSTEM_ROLE_READ_ONLY', 'Roles copied from a template cannot be changed. Create a custom role instead.');
    }
    if (!role.active) {
      return fail(409, 'ROLE_INACTIVE', 'This role is deactivated.');
    }
    checkPermissions(tenant.id, body.permissionCodes, fail);
    const codes = PERMISSION_CODES.filter((code) => body.permissionCodes.includes(code));
    const detail = roleDetail(tenant.id, role.code, now);
    return { ...detail, name: body.name, description: body.description, permissionCount: codes.length, permissions: codes.map(permissionInfo) };
  });

  mockRoute(app, set.deactivateRole, ({ requireTenant, params, notFound, fail, now }) => {
    const { tenant } = requireTenant();
    const role = findTenantRoleById(tenant.id, params.roleId);
    if (role === undefined) {
      return notFound();
    }
    if (role.templateCode !== null) {
      return fail(409, 'SYSTEM_ROLE_READ_ONLY', 'Roles copied from a template cannot be deactivated.');
    }
    if (!role.active) {
      return fail(409, 'ROLE_INACTIVE', 'This role is already deactivated.');
    }
    const detail = roleDetail(tenant.id, role.code, now);
    if (detail.activeAssignmentCount > 0) {
      return fail(409, 'ROLE_HAS_ACTIVE_ASSIGNMENTS', 'Revoke the active assignments of this role first.');
    }
    return { ...detail, active: false, deactivatedAt: iso(now) };
  });

  mockRoute(app, set.listGroups, ({ requireTenant, query, fixtures }) => {
    const { tenant } = requireTenant();
    const rows = GROUPS.filter((group) => group.tenantId === tenant.id)
      .map(groupRow)
      .filter((row) => query.active === undefined || row.active === query.active)
      .filter((row) => matches(query.q, row.name, row.description));
    return fixtures.page(
      sortRows(rows, query.sort, query.dir, { name: (row) => row.name, memberCount: (row) => row.memberCount, createdAt: (row) => row.createdAt }, 'name'),
    );
  });

  const findGroup = (tenantId: number, groupId: number) =>
    GROUPS.find((group) => group.tenantId === tenantId && group.groupId === groupId);

  mockRoute(app, set.getGroup, ({ requireTenant, params, notFound, now }) => {
    const { tenant } = requireTenant();
    const group = findGroup(tenant.id, params.groupId);
    if (group === undefined) {
      return notFound();
    }
    return groupDetail(group, now);
  });

  mockRoute(app, set.createGroup, ({ requireTenant, body, fail, now }) => {
    const { tenant } = requireTenant();
    if (GROUPS.some((group) => group.tenantId === tenant.id && group.name.toLowerCase() === body.name.toLowerCase())) {
      return fail(409, 'GROUP_NAME_TAKEN', 'Another group already has this name.');
    }
    return {
      groupId: 900,
      name: body.name,
      description: body.description,
      active: true,
      memberCount: 0,
      roles: [],
      createdAt: iso(now),
      members: [],
      roleAssignments: [],
      deactivatedAt: null,
    };
  });

  mockRoute(app, set.deactivateGroup, ({ requireTenant, params, notFound, fail, now }) => {
    const { tenant } = requireTenant();
    const group = findGroup(tenant.id, params.groupId);
    if (group === undefined) {
      return notFound();
    }
    if (!group.active) {
      return fail(409, 'GROUP_INACTIVE', 'This group is already deactivated.');
    }
    const detail = groupDetail(group, now);
    return {
      ...detail,
      active: false,
      deactivatedAt: iso(now),
      roleAssignments: detail.roleAssignments.map((assignment) => ({ ...assignment, status: 'revoked' as const })),
    };
  });

  mockRoute(app, set.addGroupMember, ({ requireTenant, requirePersona, params, body, notFound, fail, now }) => {
    const { tenant } = requireTenant();
    const group = findGroup(tenant.id, params.groupId);
    if (group === undefined) {
      return notFound();
    }
    if (!group.active) {
      return fail(409, 'GROUP_INACTIVE', 'Members cannot be added to a deactivated group.');
    }
    const member = findMember(tenant.id, body.userId);
    if (member === undefined || member.membershipStatus !== 'active') {
      return fail(409, 'USER_NOT_ACTIVE', 'Only active members can join a group.');
    }
    const caller = requirePersona();
    if (member.userId === caller.userId && ROLE_ASSIGNMENTS.some((assignment) => assignment.groupId === group.groupId)) {
      return fail(403, 'SELF_GRANT_FORBIDDEN', 'Joining a group that carries roles would grant you authority. Ask another administrator.');
    }
    if (group.members.some((candidate) => candidate.userId === member.userId && candidate.removedAt === null)) {
      return fail(409, 'ALREADY_GROUP_MEMBER', `${member.fullName} is already in this group.`);
    }
    const detail = groupDetail(group, now);
    return {
      ...detail,
      memberCount: detail.memberCount + 1,
      members: [
        ...detail.members,
        { userId: member.userId, fullName: member.fullName, capacity: member.capacity, addedAt: iso(now), addedBy: { userId: caller.userId, fullName: caller.fullName } },
      ],
    };
  });

  mockRoute(app, set.removeGroupMember, ({ requireTenant, params, notFound, fail, now }) => {
    const { tenant } = requireTenant();
    const group = findGroup(tenant.id, params.groupId);
    if (group === undefined) {
      return notFound();
    }
    if (!group.members.some((candidate) => candidate.userId === params.userId && candidate.removedAt === null)) {
      return fail(409, 'NOT_GROUP_MEMBER', 'This person is not a current member of the group.');
    }
    const carriesAdmin = ROLE_ASSIGNMENTS.some(
      (assignment) => assignment.groupId === group.groupId && ['org_admin', 'supplier_admin'].includes(assignment.roleCode),
    );
    const admins = activeAdministrators(tenant.id, now);
    if (carriesAdmin && admins.length === 1 && admins[0] === params.userId) {
      return fail(409, 'LAST_ADMINISTRATOR', 'This is the only administrator. Appoint another administrator first.');
    }
    const detail = groupDetail(group, now);
    return {
      ...detail,
      memberCount: detail.memberCount - 1,
      members: detail.members.filter((candidate) => candidate.userId !== params.userId),
    };
  });
}

export function registerMembers(app: MockApp): void {
  registerSet(app, buyerMemberAdmin);
  // Same keys and schemas; only the ids, paths, audience and permissions differ (see members.ts in the contracts).
  registerSet(app, supplierMemberAdmin as unknown as MemberAdminSet);
}
