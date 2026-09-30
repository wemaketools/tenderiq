/**
 * Org-admin projections: fixture rows → contract rows, shared by the handler modules of this domain and the
 * fixture tests. Everything is computed from static fixtures at request time (`now`), so display statuses follow
 * the request-time rules of DD-18 (validity windows compared directly).
 */
import type { PersonRef } from '../../../contracts/common.js';
import type { SodPoliciesRuleCode } from '../../../contracts/enums.js';
import type {
  AccessFinding,
  AccessGrantRow,
  AccessRestrictionRow,
  AuthorityLimitRow,
  CommitteeDetail,
  CommitteeRow,
  ConflictDeclarationDetail,
  ConflictDeclarationRow,
  DelegationRow,
  InvitationRow,
  MemberDetail,
  MemberRow,
  MyMembership,
  RoleAssignmentRow,
  RoleDetail,
  RoleRow,
  GroupRow,
  GroupDetail,
  SupplierAuthorityRow,
  TenderAssignmentRow,
  WorkItem,
  MemberAction,
} from '../../../contracts/org-admin.js';
import { DORMANT_AFTER_DAYS, SOD_RULE_PERMISSIONS, accessItemStatus, sodRulesBreachedBy } from '../../../contracts/org-admin.js';
import type { AccessItemStatus } from '../../../contracts/org-admin.js';
import { PERMISSION_CATALOG, PERMISSION_CODES } from '../../../contracts/permissions.js';
import type { PermissionCode } from '../../../contracts/permissions.js';
import {
  ACCESS_GRANTS,
  ACCESS_RESTRICTIONS,
  ASSIGNABLE_TENDER_IDS,
  ATTRIBUTED_HISTORY,
  AUTHORITY_LIMITS,
  CATEGORIES,
  CONTRACT_REFS,
  DEPARTMENTS,
  TENDER_REFS,
  COMMITTEES,
  CONFLICT_DECLARATIONS,
  DELEGATIONS,
  GROUPS,
  INVITATIONS,
  LEGAL_ENTITIES,
  MEMBERS,
  ROLE_ASSIGNMENTS,
  SOD_POLICIES,
  TENDER_ASSIGNMENTS,
  WORK_ITEMS,
  findTenantRoleByCode,
  personName,
  tenderRef,
} from '../../fixtures/org-admin/index.js';
import type {
  FixtureAccessGrant,
  FixtureAccessRestriction,
  FixtureAuthorityLimit,
  FixtureCommittee,
  FixtureConflictDeclaration,
  FixtureDelegation,
  FixtureGroup,
  FixtureInvitation,
  FixtureMember,
  FixtureRoleAssignment,
  FixtureTenderAssignment,
} from '../../fixtures/org-admin/index.js';
import { TENANTS } from '../../fixtures/platform.js';

// ---------------------------------------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------------------------------------

/** An ISO instant without milliseconds (`2026-10-14T10:00:00Z`). */
export function iso(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function addDays(date: Date, days: number): string {
  return iso(new Date(date.getTime() + days * 24 * 60 * 60 * 1000));
}

export function person(userId: number): PersonRef {
  return { userId, fullName: personName(userId) };
}

export function personOrNull(userId: number | null): PersonRef | null {
  return userId === null ? null : person(userId);
}

/** Case-insensitive match of `q` against any of the values. */
export function matches(q: string | undefined, ...values: Array<string | null | undefined>): boolean {
  if (q === undefined || q === '') {
    return true;
  }
  const needle = q.toLowerCase();
  return values.some((value) => value !== null && value !== undefined && value.toLowerCase().includes(needle));
}

/** Instant within an inclusive calendar-date range (`YYYY-MM-DD`). */
export function withinDates(instant: string | null, from: string | undefined, to: string | undefined): boolean {
  if (from === undefined && to === undefined) {
    return true;
  }
  if (instant === null) {
    return false;
  }
  const day = instant.slice(0, 10);
  return (from === undefined || day >= from) && (to === undefined || day <= to);
}

type SortValue = string | number | boolean | null;

/** Stable sort by a named accessor; nulls last. */
export function sortRows<T>(
  rows: readonly T[],
  sort: string | undefined,
  dir: 'asc' | 'desc',
  accessors: Readonly<Record<string, (row: T) => SortValue>>,
  fallback: string,
): T[] {
  const accessor = accessors[sort ?? fallback] ?? accessors[fallback];
  if (accessor === undefined) {
    return [...rows];
  }
  const factor = dir === 'desc' ? -1 : 1;
  return rows
    .map((row, index) => ({ row, index, value: accessor(row) }))
    .sort((left, right) => {
      if (left.value === right.value) {
        return left.index - right.index;
      }
      if (left.value === null) {
        return 1;
      }
      if (right.value === null) {
        return -1;
      }
      return (left.value < right.value ? -1 : 1) * factor;
    })
    .map((entry) => entry.row);
}

export function tenantKindOf(tenantId: number): 'buyer' | 'supplier' | 'operator' {
  const tenant = TENANTS.find((candidate) => candidate.id === tenantId);
  if (tenant === undefined) {
    throw new Error(`Unknown tenant ${tenantId}.`);
  }
  return tenant.kind;
}

export function tenantName(tenantId: number): string {
  return TENANTS.find((candidate) => candidate.id === tenantId)?.name ?? `Tenant ${tenantId}`;
}

const ADMIN_TEMPLATES = new Set(['org_admin', 'supplier_admin']);

// ---------------------------------------------------------------------------------------------------------
// Roles and effective permissions
// ---------------------------------------------------------------------------------------------------------

export function roleRefOf(tenantId: number, roleCode: string) {
  const role = findTenantRoleByCode(tenantId, roleCode);
  if (role === undefined) {
    throw new Error(`Unknown role ${roleCode} in tenant ${tenantId}.`);
  }
  return { roleId: role.roleId, code: role.code, name: role.name, templateCode: role.templateCode };
}

function windowStatus(assignment: FixtureRoleAssignment, now: Date): AccessItemStatus {
  return accessItemStatus({ startsAt: assignment.startsAt, endsAt: assignment.endsAt, revokedAt: assignment.revokedAt }, now);
}

function isLive(status: AccessItemStatus): boolean {
  return status === 'active' || status === 'expiring_soon';
}

export function activeGroupIdsOf(tenantId: number, userId: number): number[] {
  return GROUPS.filter(
    (group) => group.tenantId === tenantId && group.active && group.members.some((member) => member.userId === userId && member.removedAt === null),
  ).map((group) => group.groupId);
}

/** Role assignments reaching a user directly or through an active group. */
export function roleAssignmentRowsOf(tenantId: number, userId: number, now: Date): RoleAssignmentRow[] {
  const groupIds = activeGroupIdsOf(tenantId, userId);
  return ROLE_ASSIGNMENTS.filter(
    (assignment) =>
      assignment.tenantId === tenantId &&
      (assignment.userId === userId || (assignment.groupId !== null && groupIds.includes(assignment.groupId))),
  ).map((assignment) => roleAssignmentRow(assignment, now));
}

export function roleAssignmentRow(assignment: FixtureRoleAssignment, now: Date): RoleAssignmentRow {
  const group = assignment.groupId === null ? null : GROUPS.find((candidate) => candidate.groupId === assignment.groupId);
  return {
    assignmentId: assignment.assignmentId,
    role: roleRefOf(assignment.tenantId, assignment.roleCode),
    scope: { scopeType: assignment.scopeType, scopeId: assignment.scopeId, scopeLabel: assignment.scopeLabel },
    viaGroup: group === undefined || group === null ? null : { groupId: group.groupId, name: group.name },
    startsAt: assignment.startsAt,
    endsAt: assignment.endsAt,
    grantedBy: personOrNull(assignment.grantedByUserId),
    revokedAt: assignment.revokedAt,
    reason: assignment.reason,
    status: windowStatus(assignment, now),
  };
}

export function memberOfTenant(tenantId: number, userId: number): FixtureMember | undefined {
  return MEMBERS.find((member) => member.tenantId === tenantId && member.userId === userId);
}

/** Permissions a member holds through live role assignments (membership must be active). */
export function rolePermissionsOf(tenantId: number, userId: number, now: Date): PermissionCode[] {
  const member = memberOfTenant(tenantId, userId);
  if (member === undefined || member.membershipStatus !== 'active') {
    return [];
  }
  const held = new Set<PermissionCode>();
  for (const row of roleAssignmentRowsOf(tenantId, userId, now)) {
    if (!isLive(row.status)) {
      continue;
    }
    const role = findTenantRoleByCode(tenantId, row.role.code);
    if (role !== undefined && role.active) {
      role.permissions.forEach((code) => held.add(code));
    }
  }
  return PERMISSION_CODES.filter((code) => held.has(code));
}

/** Role and direct-grant permissions (before restrictions). */
export function heldPermissionsOf(tenantId: number, userId: number, now: Date): PermissionCode[] {
  const held = new Set(rolePermissionsOf(tenantId, userId, now));
  const member = memberOfTenant(tenantId, userId);
  if (member?.membershipStatus === 'active') {
    for (const grant of ACCESS_GRANTS) {
      if (grant.tenantId === tenantId && grant.userId === userId && isLive(grantStatus(grant, now))) {
        held.add(grant.permissionCode);
      }
    }
  }
  return PERMISSION_CODES.filter((code) => held.has(code));
}

export function isAdministrator(tenantId: number, userId: number, now: Date): boolean {
  return roleAssignmentRowsOf(tenantId, userId, now).some(
    (row) => isLive(row.status) && row.role.templateCode !== null && ADMIN_TEMPLATES.has(row.role.templateCode),
  );
}

/** Active administrators of a tenant (the last one cannot be removed). */
export function activeAdministrators(tenantId: number, now: Date): number[] {
  return MEMBERS.filter(
    (member) => member.tenantId === tenantId && member.membershipStatus === 'active' && isAdministrator(tenantId, member.userId, now),
  ).map((member) => member.userId);
}

export function roleRow(tenantId: number, roleCode: string, now: Date): RoleRow {
  const role = findTenantRoleByCode(tenantId, roleCode);
  if (role === undefined) {
    throw new Error(`Unknown role ${roleCode}.`);
  }
  const activeAssignments = ROLE_ASSIGNMENTS.filter(
    (assignment) => assignment.tenantId === tenantId && assignment.roleCode === roleCode && isLive(windowStatus(assignment, now)),
  );
  return {
    roleId: role.roleId,
    code: role.code,
    name: role.name,
    description: role.description,
    templateCode: role.templateCode,
    isSystem: role.templateCode !== null,
    active: role.active,
    deactivatedAt: role.deactivatedAt,
    permissionCount: role.permissions.length,
    activeAssignmentCount: activeAssignments.length,
  };
}

export function permissionInfo(code: PermissionCode) {
  return { code, category: PERMISSION_CATALOG[code].category, description: PERMISSION_CATALOG[code].description };
}

/** Enforced SoD rules a permission set combines (buyer tenants only). */
export function enforcedSodBreaches(tenantId: number, permissions: readonly string[]): SodPoliciesRuleCode[] {
  if (tenantKindOf(tenantId) !== 'buyer') {
    return [];
  }
  return sodRulesBreachedBy(permissions).filter((rule) => sodPolicyMode(tenantId, rule) === 'enforced');
}

export function roleDetail(tenantId: number, roleCode: string, now: Date): RoleDetail {
  const role = findTenantRoleByCode(tenantId, roleCode);
  if (role === undefined) {
    throw new Error(`Unknown role ${roleCode}.`);
  }
  const holders = ROLE_ASSIGNMENTS.filter((assignment) => assignment.tenantId === tenantId && assignment.roleCode === roleCode).map(
    (assignment) => {
      const group = assignment.groupId === null ? undefined : GROUPS.find((candidate) => candidate.groupId === assignment.groupId);
      return {
        assignmentId: assignment.assignmentId,
        holderKind: assignment.userId !== null ? ('user' as const) : ('group' as const),
        holderId: assignment.userId ?? assignment.groupId ?? 0,
        holderName: assignment.userId !== null ? personName(assignment.userId) : (group?.name ?? 'Group'),
        scope: { scopeType: assignment.scopeType, scopeId: assignment.scopeId, scopeLabel: assignment.scopeLabel },
        status: windowStatus(assignment, now),
      };
    },
  );
  return {
    ...roleRow(tenantId, roleCode, now),
    permissions: role.permissions.map(permissionInfo),
    holders,
    sodWarnings: enforcedSodBreaches(tenantId, role.permissions).map((rule) => ({
      ruleCode: rule,
      permissions: [...SOD_RULE_PERMISSIONS[rule]],
    })),
  };
}

export function sodPolicyMode(tenantId: number, rule: SodPoliciesRuleCode): 'enforced' | 'alternative_oversight' {
  return SOD_POLICIES.find((policy) => policy.tenantId === tenantId && policy.ruleCode === rule)?.mode ?? 'enforced';
}

// ---------------------------------------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------------------------------------

export function groupRow(group: FixtureGroup): GroupRow {
  const roles = ROLE_ASSIGNMENTS.filter((assignment) => assignment.groupId === group.groupId).map((assignment) =>
    roleRefOf(group.tenantId, assignment.roleCode),
  );
  return {
    groupId: group.groupId,
    name: group.name,
    description: group.description,
    active: group.active,
    memberCount: group.members.filter((member) => member.removedAt === null).length,
    roles,
    createdAt: group.createdAt,
  };
}

export function groupDetail(group: FixtureGroup, now: Date): GroupDetail {
  return {
    ...groupRow(group),
    members: group.members
      .filter((member) => member.removedAt === null)
      .map((member) => ({
        ...person(member.userId),
        capacity: memberOfTenant(group.tenantId, member.userId)?.capacity ?? null,
        addedAt: member.addedAt,
        addedBy: personOrNull(member.addedByUserId),
      })),
    roleAssignments: ROLE_ASSIGNMENTS.filter((assignment) => assignment.groupId === group.groupId).map((assignment) => ({
      assignmentId: assignment.assignmentId,
      role: roleRefOf(group.tenantId, assignment.roleCode),
      scope: { scopeType: assignment.scopeType, scopeId: assignment.scopeId, scopeLabel: assignment.scopeLabel },
      status: windowStatus(assignment, now),
    })),
    deactivatedAt: group.deactivatedAt,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------------------------------------

/** The stored status, with a `pending` or `send_failed` invitation past its expiry reported as `expired` (DD-18). */
export function invitationStatus(invitation: FixtureInvitation, now: Date) {
  if ((invitation.status === 'pending' || invitation.status === 'send_failed') && Date.parse(invitation.expiresAt) <= now.getTime()) {
    return 'expired' as const;
  }
  return invitation.status;
}

export function invitationRow(invitation: FixtureInvitation, now: Date): InvitationRow {
  const status = invitationStatus(invitation, now);
  const reissuedTo = INVITATIONS.find((candidate) => candidate.reissuedFromId === invitation.invitationId);
  return {
    invitationId: invitation.invitationId,
    email: invitation.email,
    fullName: invitation.fullName,
    capacity: invitation.capacity,
    roles: invitation.roleCodes.map((code) => roleRefOf(invitation.tenantId, code)),
    status,
    expiresAt: invitation.expiresAt,
    sentCount: invitation.sentCount,
    invitedBy: person(invitation.invitedByUserId),
    createdAt: invitation.createdAt,
    acceptedAt: invitation.acceptedAt,
    reissuedFromId: invitation.reissuedFromId,
    reissuedToId: reissuedTo?.invitationId ?? null,
    canReissue: status === 'expired' || status === 'send_failed' || status === 'pending',
    canRevoke: status === 'pending' || status === 'send_failed',
  };
}

/** The latest invitation of a member (by membership, else by e-mail). */
export function latestInvitationOf(member: FixtureMember): FixtureInvitation | undefined {
  const candidates = INVITATIONS.filter(
    (invitation) =>
      invitation.tenantId === member.tenantId &&
      (invitation.membershipId === member.membershipId || invitation.email === member.email),
  );
  return candidates.sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
}

// ---------------------------------------------------------------------------------------------------------
// Grants, restrictions, delegations, limits
// ---------------------------------------------------------------------------------------------------------

export function grantStatus(grant: FixtureAccessGrant, now: Date): AccessItemStatus {
  return accessItemStatus({ startsAt: grant.startsAt, endsAt: grant.expiresAt, revokedAt: grant.revokedAt }, now);
}

export function grantRow(grant: FixtureAccessGrant, now: Date): AccessGrantRow {
  return {
    grantId: grant.grantId,
    user: person(grant.userId),
    capacity: memberOfTenant(grant.tenantId, grant.userId)?.capacity ?? null,
    permissionCode: grant.permissionCode,
    permissionDescription: PERMISSION_CATALOG[grant.permissionCode].description,
    scope: grant.scope,
    reason: grant.reason,
    owner: person(grant.ownerUserId),
    grantedBy: person(grant.grantedByUserId),
    startsAt: grant.startsAt,
    expiresAt: grant.expiresAt,
    revokedAt: grant.revokedAt,
    revokedBy: personOrNull(grant.revokedByUserId),
    status: grantStatus(grant, now),
  };
}

export function restrictionStatus(restriction: FixtureAccessRestriction, now: Date): AccessItemStatus {
  return accessItemStatus({ startsAt: restriction.startsAt, endsAt: restriction.endsAt, revokedAt: null }, now);
}

export function restrictionRow(restriction: FixtureAccessRestriction, now: Date): AccessRestrictionRow {
  return {
    restrictionId: restriction.restrictionId,
    user: person(restriction.userId),
    capacity: memberOfTenant(restriction.tenantId, restriction.userId)?.capacity ?? null,
    permissionCode: restriction.permissionCode,
    scope: restriction.scope,
    restrictionType: restriction.restrictionType,
    reason: restriction.reason,
    startsAt: restriction.startsAt,
    endsAt: restriction.endsAt,
    imposedBy: personOrNull(restriction.imposedByUserId),
    conflictDeclarationId: restriction.conflictDeclarationId,
    status: restrictionStatus(restriction, now),
  };
}

function money(amount: string | null, currency: string) {
  return amount === null ? null : { amount, currency };
}

function namedLegalEntity(id: number | null) {
  if (id === null) {
    return null;
  }
  const entity = LEGAL_ENTITIES.find((candidate) => candidate.id === id);
  return entity === undefined ? null : { id: entity.id, name: entity.name };
}

function namedCategory(id: number | null) {
  if (id === null) {
    return null;
  }
  const category = CATEGORIES.find((candidate) => candidate.id === id);
  return category === undefined ? null : { id: category.id, name: category.name };
}

export function limitStatus(limit: FixtureAuthorityLimit, now: Date): AccessItemStatus {
  return accessItemStatus({ startsAt: limit.effectiveFrom, endsAt: limit.effectiveTo, revokedAt: null }, now);
}

export function limitSubjectName(limit: FixtureAuthorityLimit): { id: number; name: string } {
  if (limit.subjectType === 'user' && limit.subjectUserId !== null) {
    return { id: limit.subjectUserId, name: personName(limit.subjectUserId) };
  }
  if (limit.subjectType === 'role' && limit.subjectRoleCode !== null) {
    const role = roleRefOf(limit.tenantId, limit.subjectRoleCode);
    return { id: role.roleId, name: role.name };
  }
  const committee = COMMITTEES.find((candidate) => candidate.committeeId === limit.subjectCommitteeId);
  return { id: committee?.committeeId ?? 0, name: committee?.name ?? 'Committee' };
}

export function limitRow(limit: FixtureAuthorityLimit, now: Date): AuthorityLimitRow {
  return {
    limitId: limit.limitId,
    subjectType: limit.subjectType,
    subject: limitSubjectName(limit),
    decisionType: limit.decisionType,
    maxAmount: money(limit.maxAmount, limit.currency),
    legalEntity: namedLegalEntity(limit.legalEntityId),
    category: namedCategory(limit.categoryId),
    effectiveFrom: limit.effectiveFrom,
    effectiveTo: limit.effectiveTo,
    approvedBy: personOrNull(limit.approvedByUserId),
    status: limitStatus(limit, now),
  };
}

/** A user's own live limit for a decision type: amount (null = unlimited) or `undefined` when none. */
/** The delegator's live limit for a decision: amount and the scope a delegation must stay within (BR-06). */
export interface UserLimitScope {
  readonly amount: string | null;
  readonly currency: string;
  readonly legalEntityId: number | null;
  readonly categoryId: number | null;
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
}

export function userLimitFor(tenantId: number, userId: number, decisionType: string, now: Date): UserLimitScope | undefined {
  const limit = AUTHORITY_LIMITS.find(
    (candidate) =>
      candidate.tenantId === tenantId &&
      candidate.subjectType === 'user' &&
      candidate.subjectUserId === userId &&
      candidate.decisionType === decisionType &&
      isLive(limitStatus(candidate, now)),
  );
  return limit === undefined
    ? undefined
    : {
        amount: limit.maxAmount,
        currency: limit.currency,
        legalEntityId: limit.legalEntityId,
        categoryId: limit.categoryId,
        effectiveFrom: limit.effectiveFrom,
        effectiveTo: limit.effectiveTo,
      };
}

export function delegationStatus(delegation: FixtureDelegation, now: Date): AccessItemStatus {
  return accessItemStatus({ startsAt: delegation.startsAt, endsAt: delegation.endsAt, revokedAt: delegation.revokedAt }, now);
}

export function delegationRow(delegation: FixtureDelegation, now: Date): DelegationRow {
  const caps = delegation.decisionTypes.map((type) => userLimitFor(delegation.tenantId, delegation.delegatorUserId, type, now));
  const first = caps[0];
  return {
    delegationId: delegation.delegationId,
    delegator: person(delegation.delegatorUserId),
    delegate: person(delegation.delegateUserId),
    decisionTypes: [...delegation.decisionTypes],
    maxAmount: money(delegation.maxAmount, delegation.currency),
    delegatorLimit: first === undefined ? null : money(first.amount, first.currency),
    legalEntity: namedLegalEntity(delegation.legalEntityId),
    category: namedCategory(delegation.categoryId),
    startsAt: delegation.startsAt,
    endsAt: delegation.endsAt,
    reason: delegation.reason,
    revokedAt: delegation.revokedAt,
    revokedBy: personOrNull(delegation.revokedByUserId),
    status: delegationStatus(delegation, now),
  };
}

// ---------------------------------------------------------------------------------------------------------
// Committees
// ---------------------------------------------------------------------------------------------------------

export function committeeRow(committee: FixtureCommittee, now: Date): CommitteeRow {
  const live = committee.members.filter((member) =>
    isLive(accessItemStatus({ startsAt: member.startsAt, endsAt: member.endsAt, revokedAt: null }, now)),
  );
  const voting = live.filter((member) => member.memberRole === 'chair' || member.memberRole === 'member');
  const chair = live.find((member) => member.memberRole === 'chair');
  return {
    committeeId: committee.committeeId,
    name: committee.name,
    purpose: committee.purpose,
    quorum: committee.quorum,
    legalEntity: namedLegalEntity(committee.legalEntityId),
    active: committee.active,
    chair: chair === undefined ? null : person(chair.userId),
    activeMemberCount: live.length,
    votingMemberCount: voting.length,
    alternateCount: live.filter((member) => member.memberRole === 'alternate').length,
    quorumMet: committee.active && voting.length >= committee.quorum,
  };
}

export function committeeDetail(committee: FixtureCommittee, now: Date): CommitteeDetail {
  return {
    ...committeeRow(committee, now),
    members: committee.members.map((member) => ({
      memberId: member.memberId,
      person: person(member.userId),
      capacity: memberOfTenant(committee.tenantId, member.userId)?.capacity ?? null,
      memberRole: member.memberRole,
      startsAt: member.startsAt,
      endsAt: member.endsAt,
      status: accessItemStatus({ startsAt: member.startsAt, endsAt: member.endsAt, revokedAt: null }, now),
    })),
    authorityLimits: AUTHORITY_LIMITS.filter(
      (limit) => limit.subjectType === 'committee' && limit.subjectCommitteeId === committee.committeeId,
    ).map((limit) => limitRow(limit, now)),
    deactivatedAt: committee.deactivatedAt,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Conflicts
// ---------------------------------------------------------------------------------------------------------

export function supplierMembershipsOf(userId: number) {
  return MEMBERS.filter((member) => member.userId === userId && tenantKindOf(member.tenantId) === 'supplier').map((member) => ({
    organizationName: tenantName(member.tenantId),
    capacity: member.capacity,
    status: member.membershipStatus,
  }));
}

export function conflictRow(declaration: FixtureConflictDeclaration): ConflictDeclarationRow {
  const blocked =
    declaration.hasConflict &&
    (declaration.disposition === 'pending_review' || declaration.disposition === 'recused' || declaration.disposition === 'reassigned');
  return {
    declarationId: declaration.declarationId,
    declarant: person(declaration.userId),
    capacity: memberOfTenant(declaration.tenantId, declaration.userId)?.capacity ?? null,
    subject: {
      subjectType: declaration.subjectType,
      subjectId: declaration.subjectId,
      reference: declaration.subjectReference,
      title: declaration.subjectTitle,
    },
    supplierName: declaration.supplierTenantId === null ? null : tenantName(declaration.supplierTenantId),
    hasConflict: declaration.hasConflict,
    nature: declaration.nature,
    declaredAt: declaration.declaredAt,
    disposition: declaration.disposition,
    reviewedBy: personOrNull(declaration.reviewedByUserId),
    reviewedAt: declaration.reviewedAt,
    holdsSupplierMemberships: supplierMembershipsOf(declaration.userId).length > 0,
    accessBlocked: blocked,
  };
}

export function conflictDetail(declaration: FixtureConflictDeclaration, callerUserId: number, now: Date): ConflictDeclarationDetail {
  const restriction = ACCESS_RESTRICTIONS.find((candidate) => candidate.conflictDeclarationId === declaration.declarationId);
  const history: ConflictDeclarationDetail['history'] = [
    { at: declaration.declaredAt, actor: person(declaration.userId), action: 'Declared', note: declaration.details },
  ];
  if (restriction !== undefined && declaration.disposition === 'pending_review') {
    history.push({
      at: restriction.startsAt,
      actor: person(restriction.imposedByUserId ?? declaration.userId),
      action: 'Restricted access pending review',
      note: restriction.reason,
    });
  }
  if (declaration.reviewedAt !== null && declaration.reviewedByUserId !== null) {
    history.push({
      at: declaration.reviewedAt,
      actor: person(declaration.reviewedByUserId),
      action: `Disposition: ${declaration.disposition}`,
      note: declaration.reviewNote,
    });
  }
  const open = declaration.disposition === 'pending_review' && declaration.userId !== callerUserId;
  return {
    ...conflictRow(declaration),
    details: declaration.details,
    reviewNote: declaration.reviewNote,
    supplierMemberships: supplierMembershipsOf(declaration.userId),
    restriction: restriction === undefined ? null : restrictionRow(restriction, now),
    history,
    allowedDispositions: open ? ['cleared', 'mitigated', 'recused', 'reassigned'] : [],
  };
}

// ---------------------------------------------------------------------------------------------------------
// Work, assignments, supplier authority
// ---------------------------------------------------------------------------------------------------------

export function workItemsOf(tenantId: number, userId: number, now: Date): WorkItem[] {
  return WORK_ITEMS.filter((item) => item.tenantId === tenantId && item.userId === userId).map((item) => ({
    workItemId: item.workItemId,
    kind: item.kind,
    title: item.title,
    reference: item.reference,
    dueAt: item.dueAt,
    isOverdue: item.dueAt !== null && Date.parse(item.dueAt) < now.getTime(),
    requiresReassignment: item.requiresReassignment,
  }));
}

export function attributedHistoryOf(tenantId: number, userId: number) {
  return ATTRIBUTED_HISTORY.filter((record) => record.tenantId === tenantId && record.userId === userId).map((record) => ({
    kind: record.kind,
    reference: record.reference,
    description: record.description,
    occurredAt: record.occurredAt,
    capacity: record.capacity,
  }));
}

export function assignableTender(tenderId: number) {
  const tender = tenderRef(tenderId);
  return {
    tenderId: tender.tenderId,
    reference: tender.reference,
    title: tender.title,
    buyerName: tenantName(tender.buyerTenantId),
    submissionDeadline: tender.submissionDeadline === null ? null : { at: tender.submissionDeadline, timeZone: tender.officialTimeZone },
  };
}

export function assignableTenderIds(tenantId: number): readonly number[] {
  return ASSIGNABLE_TENDER_IDS[tenantId] ?? [];
}

export function assignmentRow(assignment: FixtureTenderAssignment): TenderAssignmentRow {
  return {
    assignmentId: assignment.assignmentId,
    member: person(assignment.userId),
    capacity: memberOfTenant(assignment.tenantId, assignment.userId)?.capacity ?? null,
    tender: assignableTender(assignment.tenderId),
    responsibility: assignment.responsibility,
    sectionScope: [...assignment.sectionScope],
    lotLabels: [...assignment.lotLabels],
    dueAt: assignment.dueAt,
    canViewPricing: assignment.canViewPricing,
    assignedAt: assignment.assignedAt,
    endedAt: assignment.endedAt,
    active: assignment.endedAt === null,
  };
}

export function signingLimitOf(tenantId: number, userId: number, now: Date) {
  const limit = AUTHORITY_LIMITS.find(
    (candidate) =>
      candidate.tenantId === tenantId &&
      candidate.subjectType === 'user' &&
      candidate.subjectUserId === userId &&
      candidate.decisionType === 'contract_signature',
  );
  if (limit === undefined) {
    return null;
  }
  return {
    limitId: limit.limitId,
    maxAmount: money(limit.maxAmount, limit.currency),
    effectiveFrom: limit.effectiveFrom,
    effectiveTo: limit.effectiveTo,
    status: limitStatus(limit, now),
  };
}

/**
 * The authority row of a supplier member. `callerUserId` is the administrator viewing it: their own row offers no
 * action (nobody changes their own authority, AC-03), and a signing limit needs submission authority first.
 */
export function supplierAuthorityRow(member: FixtureMember, now: Date, callerUserId: number | null = null): SupplierAuthorityRow {
  const permissions = new Set(heldPermissionsOf(member.tenantId, member.userId, now));
  const submitAssignments = roleAssignmentRowsOf(member.tenantId, member.userId, now).filter(
    (row) => isLive(row.status) && row.role.templateCode === 'authorized_signatory',
  );
  const tenderScoped = submitAssignments.filter((row) => row.scope.scopeType === 'tender' && row.scope.scopeId !== null);
  const canSubmit = permissions.has('supplier.response.submit');
  return {
    member: person(member.userId),
    capacity: member.capacity,
    membershipStatus: member.membershipStatus,
    canPrepare: permissions.has('supplier.response.edit'),
    canPrice: permissions.has('supplier.pricing.edit'),
    canApprove: permissions.has('supplier.response.approve'),
    canSubmit,
    submissionSource: !canSubmit
      ? 'none'
      : submitAssignments.some((row) => row.scope.scopeType === 'organization')
        ? 'organization_role'
        : 'tender_role',
    submissionTenders: tenderScoped.map((row) => ({ tenderId: row.scope.scopeId ?? 0, reference: tenderRef(row.scope.scopeId ?? 0).reference })),
    signingLimit: signingLimitOf(member.tenantId, member.userId, now),
    delegationsReceived: DELEGATIONS.filter(
      (delegation) => delegation.tenantId === member.tenantId && delegation.delegateUserId === member.userId && isLive(delegationStatus(delegation, now)),
    ).length,
    activeAssignments: TENDER_ASSIGNMENTS.filter(
      (assignment) => assignment.tenantId === member.tenantId && assignment.userId === member.userId && assignment.endedAt === null,
    ).length,
    ...supplierAuthorityActions(member, canSubmit, callerUserId),
  };
}

function supplierAuthorityActions(
  member: FixtureMember,
  canSubmit: boolean,
  callerUserId: number | null,
): Pick<SupplierAuthorityRow, 'availableActions' | 'blockedBy'> {
  if (member.membershipStatus !== 'active' || member.userStatus !== 'active') {
    return { availableActions: [], blockedBy: 'inactive' };
  }
  if (member.userId === callerUserId) {
    return { availableActions: [], blockedBy: 'self' };
  }
  return canSubmit
    ? { availableActions: ['changeSubmission', 'setSigningLimit'], blockedBy: null }
    : { availableActions: ['changeSubmission'], blockedBy: 'no_submission_authority' };
}

// ---------------------------------------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------------------------------------

export function membersOfTenant(tenantId: number): FixtureMember[] {
  return MEMBERS.filter((member) => member.tenantId === tenantId);
}

export function memberRow(member: FixtureMember, now: Date): MemberRow {
  const roleRows = roleAssignmentRowsOf(member.tenantId, member.userId, now).filter(
    (row) => row.viaGroup === null && (isLive(row.status) || member.membershipStatus !== 'active'),
  );
  const invitation = latestInvitationOf(member);
  // An invitation grants nothing before acceptance: its proposed roles are shown, but no assignment exists (FR-03).
  const proposed = member.membershipStatus === 'invited' && invitation !== undefined ? invitation.roleCodes.map((code) => roleRefOf(member.tenantId, code)) : [];
  const uniqueRoles = new Map([...roleRows.map((row) => row.role), ...proposed].map((role) => [role.roleId, role]));
  const isSupplier = tenantKindOf(member.tenantId) === 'supplier';
  const authority = isSupplier ? supplierAuthorityRow(member, now) : null;
  return {
    userId: member.userId,
    membershipId: member.membershipId,
    fullName: member.fullName,
    email: member.email,
    capacity: member.capacity,
    membershipStatus: member.membershipStatus,
    userStatus: member.userStatus,
    roles: [...uniqueRoles.values()],
    groups: activeGroupIdsOf(member.tenantId, member.userId).map((groupId) => {
      const group = GROUPS.find((candidate) => candidate.groupId === groupId);
      return { groupId, name: group?.name ?? 'Group' };
    }),
    joinedAt: member.joinedAt,
    lastSeenAt: member.lastSeenAt,
    openWorkCount: WORK_ITEMS.filter((item) => item.tenantId === member.tenantId && item.userId === member.userId).length,
    activeDelegationCount: DELEGATIONS.filter(
      (delegation) =>
        delegation.tenantId === member.tenantId &&
        (delegation.delegatorUserId === member.userId || delegation.delegateUserId === member.userId) &&
        isLive(delegationStatus(delegation, now)),
    ).length,
    invitation:
      invitation === undefined || member.membershipStatus !== 'invited'
        ? null
        : { invitationId: invitation.invitationId, status: invitationStatus(invitation, now), expiresAt: invitation.expiresAt },
    supplierAuthority:
      authority === null
        ? null
        : {
            canSubmit: authority.canSubmit,
            canApprove: authority.canApprove,
            canPrice: authority.canPrice,
            signingLimit: authority.signingLimit?.maxAmount ?? null,
          },
  };
}

export function availableActions(member: FixtureMember, callerUserId: number): MemberAction[] {
  const self = member.userId === callerUserId;
  const actions: MemberAction[] = [];
  const deactivated = member.userStatus === 'deactivated';
  if (!deactivated && member.membershipStatus !== 'revoked') {
    actions.push('edit');
  }
  if (member.membershipStatus === 'active' && !self) {
    actions.push('assignRole', 'suspend', 'deactivate');
  }
  if (member.membershipStatus === 'suspended' && !self) {
    actions.push('activate', 'deactivate');
  }
  if (member.membershipStatus === 'pending_approval') {
    actions.push('approveMembership', 'rejectMembership');
  }
  if (member.membershipStatus === 'revoked' && !deactivated && member.joinedAt !== null) {
    actions.push('recover');
  }
  if (WORK_ITEMS.some((item) => item.tenantId === member.tenantId && item.userId === member.userId)) {
    actions.push('reassignWork');
  }
  return actions;
}

export function memberDetail(member: FixtureMember, callerUserId: number, now: Date): MemberDetail {
  const tenantId = member.tenantId;
  return {
    ...memberRow(member, now),
    endedAt: member.endedAt,
    endReason: member.endReason,
    roleAssignments: roleAssignmentRowsOf(tenantId, member.userId, now),
    directGrants: ACCESS_GRANTS.filter((grant) => grant.tenantId === tenantId && grant.userId === member.userId).map((grant) =>
      grantRow(grant, now),
    ),
    restrictions: ACCESS_RESTRICTIONS.filter(
      (restriction) => restriction.tenantId === tenantId && restriction.userId === member.userId,
    ).map((restriction) => restrictionRow(restriction, now)),
    delegationsGiven: DELEGATIONS.filter(
      (delegation) => delegation.tenantId === tenantId && delegation.delegatorUserId === member.userId,
    ).map((delegation) => delegationRow(delegation, now)),
    delegationsReceived: DELEGATIONS.filter(
      (delegation) => delegation.tenantId === tenantId && delegation.delegateUserId === member.userId,
    ).map((delegation) => delegationRow(delegation, now)),
    authorityLimits: AUTHORITY_LIMITS.filter(
      (limit) => limit.tenantId === tenantId && limit.subjectType === 'user' && limit.subjectUserId === member.userId,
    ).map((limit) => ({
      limitId: limit.limitId,
      decisionType: limit.decisionType,
      maxAmount: money(limit.maxAmount, limit.currency),
      effectiveFrom: limit.effectiveFrom,
      effectiveTo: limit.effectiveTo,
      status: limitStatus(limit, now),
    })),
    openWork: workItemsOf(tenantId, member.userId, now),
    invitations: INVITATIONS.filter(
      (invitation) =>
        invitation.tenantId === tenantId &&
        (invitation.membershipId === member.membershipId || invitation.email === member.email),
    ).map((invitation) => invitationRow(invitation, now)),
    tenderAssignments: TENDER_ASSIGNMENTS.filter(
      (assignment) => assignment.tenantId === tenantId && assignment.userId === member.userId,
    ).map(assignmentRow),
    attributedHistory: attributedHistoryOf(tenantId, member.userId),
    availableActions: availableActions(member, callerUserId),
  };
}

/** Active members other than `userId` who can take over work (AC-04). */
export function reassignmentCandidates(tenantId: number, userId: number) {
  return MEMBERS.filter(
    (member) => member.tenantId === tenantId && member.userId !== userId && member.membershipStatus === 'active' && member.userStatus === 'active',
  ).map((member) => ({ ...person(member.userId), capacity: member.capacity }));
}

// ---------------------------------------------------------------------------------------------------------
// /me memberships
// ---------------------------------------------------------------------------------------------------------

export function myMembership(member: FixtureMember, now: Date): MyMembership {
  const tenant = TENANTS.find((candidate) => candidate.id === member.tenantId);
  if (tenant === undefined) {
    throw new Error(`Unknown tenant ${member.tenantId}.`);
  }
  const explanation: Record<string, string | null> = {
    active: null,
    invited: `You have been invited to ${tenant.name}. Accept the invitation to start working in this capacity.`,
    pending_approval: `Your request to join ${tenant.name} is waiting for its administrator. You cannot act for this organization yet.`,
    suspended: `Your access to ${tenant.name} is suspended. Contact its administrator.`,
    revoked: `This membership has ended. Your past actions stay attributed to you.`,
  };
  const roles = roleAssignmentRowsOf(member.tenantId, member.userId, now).filter((row) => row.viaGroup === null);
  const invitation = member.membershipStatus === 'invited' ? latestInvitationOf(member) : undefined;
  const proposedRoleNames = (invitation?.roleCodes ?? []).map((code) => roleRefOf(member.tenantId, code).name);
  const pendingWork = WORK_ITEMS.some(
    (item) => item.tenantId === member.tenantId && item.userId === member.userId && item.requiresReassignment,
  );
  return {
    membershipId: member.membershipId,
    organization: { tenantId: tenant.id, tenantName: tenant.name, tenantKind: tenant.kind },
    organizationSlug: tenant.slug,
    capacity: member.capacity,
    status: member.membershipStatus,
    roleNames: [...new Set([...roles.map((row) => row.role.name), ...proposedRoleNames])],
    joinedAt: member.joinedAt,
    requestedAt: member.requestedAt,
    endedAt: member.endedAt,
    explanation: explanation[member.membershipStatus] ?? null,
    canWithdraw: member.membershipStatus === 'pending_approval' || member.membershipStatus === 'invited',
    canLeave: member.membershipStatus === 'active' && !pendingWork,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Access review
// ---------------------------------------------------------------------------------------------------------

export function accessFindings(tenantId: number, now: Date): AccessFinding[] {
  const findings: AccessFinding[] = [];
  let nextId = 1;
  const active = MEMBERS.filter((member) => member.tenantId === tenantId && member.membershipStatus === 'active');
  for (const member of active) {
    const held = heldPermissionsOf(tenantId, member.userId, now);
    for (const rule of sodRulesBreachedBy(held)) {
      const mode = sodPolicyMode(tenantId, rule);
      const [first, second] = SOD_RULE_PERMISSIONS[rule];
      findings.push({
        findingId: nextId++,
        type: 'sod_conflict',
        severity: mode === 'enforced' ? 'warning' : 'info',
        user: person(member.userId),
        capacity: member.capacity,
        title: 'Holds incompatible authority',
        detail:
          mode === 'enforced'
            ? `Holds both ${first} and ${second}. The policy is enforced per record: the same person cannot do both on one event.`
            : `Holds both ${first} and ${second}. Covered by documented alternative oversight.`,
        ruleCode: rule,
        relatedId: null,
        dueAt: null,
      });
    }
    if (member.lastSeenAt !== null && now.getTime() - Date.parse(member.lastSeenAt) > DORMANT_AFTER_DAYS * 24 * 60 * 60 * 1000) {
      findings.push({
        findingId: nextId++,
        type: 'dormant_account',
        severity: 'warning',
        user: person(member.userId),
        capacity: member.capacity,
        title: 'Dormant account',
        detail: `No sign-in for more than ${DORMANT_AFTER_DAYS} days. Confirm the membership is still needed.`,
        ruleCode: null,
        relatedId: null,
        dueAt: null,
      });
    }
  }
  for (const grant of ACCESS_GRANTS.filter((candidate) => candidate.tenantId === tenantId)) {
    if (grantStatus(grant, now) === 'expiring_soon') {
      findings.push({
        findingId: nextId++,
        type: 'grant_expiring',
        severity: 'info',
        user: person(grant.userId),
        capacity: memberOfTenant(tenantId, grant.userId)?.capacity ?? null,
        title: `Direct grant ${grant.permissionCode} expires soon`,
        detail: `Owner ${personName(grant.ownerUserId)} should extend or let it lapse. Reason: ${grant.reason}`,
        ruleCode: null,
        relatedId: grant.grantId,
        dueAt: grant.expiresAt,
      });
    }
  }
  for (const restriction of ACCESS_RESTRICTIONS.filter((candidate) => candidate.tenantId === tenantId)) {
    if (isLive(restrictionStatus(restriction, now))) {
      findings.push({
        findingId: nextId++,
        type: 'active_restriction',
        severity: restriction.restrictionType === 'suspension' ? 'critical' : 'info',
        user: person(restriction.userId),
        capacity: memberOfTenant(tenantId, restriction.userId)?.capacity ?? null,
        title: `Active ${restriction.restrictionType} restriction`,
        detail: `${restriction.scope.scopeLabel}: ${restriction.reason}`,
        ruleCode: null,
        relatedId: restriction.restrictionId,
        dueAt: restriction.endsAt,
      });
    }
  }
  for (const declaration of CONFLICT_DECLARATIONS.filter((candidate) => candidate.tenantId === tenantId)) {
    if (declaration.disposition === 'pending_review') {
      findings.push({
        findingId: nextId++,
        type: 'pending_conflict_review',
        severity: 'critical',
        user: person(declaration.userId),
        capacity: memberOfTenant(tenantId, declaration.userId)?.capacity ?? null,
        title: `Conflict declaration awaiting review (${declaration.subjectReference ?? declaration.subjectTitle})`,
        detail:
          supplierMembershipsOf(declaration.userId).length > 0
            ? 'The declarant also belongs to supplier organizations. Restricted access is blocked until the review.'
            : 'Restricted access is blocked until the review.',
        ruleCode: null,
        relatedId: declaration.declarationId,
        dueAt: null,
      });
    }
  }
  return findings;
}

export const SEVERITY_ORDER: Readonly<Record<string, number>> = { critical: 0, warning: 1, info: 2 };

/**
 * The display label of a scope in a tenant, or `null` when the record does not exist there (`SCOPE_NOT_FOUND`).
 * Buyers scope to their own records; a supplier scopes to the tenders it pursues.
 */
export function scopeLabelOf(tenantId: number, scopeType: string, scopeId: number | null): string | null {
  if (scopeType === 'organization') {
    return scopeId === null ? 'Whole organization' : null;
  }
  if (scopeId === null) {
    return null;
  }
  const kind = tenantKindOf(tenantId);
  switch (scopeType) {
    case 'tender': {
      const tender = TENDER_REFS.find((candidate) => candidate.tenderId === scopeId);
      const visible =
        tender !== undefined &&
        (kind === 'buyer' ? tender.buyerTenantId === tenantId : assignableTenderIds(tenantId).includes(tender.tenderId));
      return visible ? `${tender.reference} ${tender.title}` : null;
    }
    case 'contract': {
      const contract = CONTRACT_REFS.find((candidate) => candidate.id === scopeId && candidate.tenantId === tenantId);
      return contract === undefined ? null : `${contract.reference} ${contract.title}`;
    }
    case 'legal_entity': {
      const entity = LEGAL_ENTITIES.find((candidate) => candidate.id === scopeId && candidate.tenantId === tenantId);
      return entity === undefined ? null : entity.name;
    }
    case 'department': {
      const department = DEPARTMENTS.find((candidate) => candidate.id === scopeId && candidate.tenantId === tenantId);
      return department === undefined ? null : `${department.name} department`;
    }
    case 'category': {
      const category = CATEGORIES.find((candidate) => candidate.id === scopeId && candidate.tenantId === tenantId);
      return category === undefined ? null : `${category.name} (and subcategories)`;
    }
    default:
      return null;
  }
}
