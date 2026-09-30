/**
 * Org-admin mock handlers, buyer access governance (ADM-04) and SoD policies (ADM-05). Nobody grants what they do
 * not hold or grants themselves anything; restrictions win; a conflict restriction ends only through the conflict
 * review (DD-25). The review queue shows buyer/supplier dual memberships to the reviewer (AC-02).
 */
import {
  MAX_GRANT_DAYS,
  SOD_RULE_PERMISSIONS,
  createAccessGrant,
  createAccessRestriction,
  decideConflictDeclaration,
  extendAccessGrant,
  getConflictDeclaration,
  getEffectiveAccess,
  liftAccessRestriction,
  listAccessFindings,
  listAccessGrants,
  listAccessRestrictions,
  listConflictDeclarations,
  listSodPolicies,
  revokeAccessGrant,
  sodRulesBreachedBy,
  updateSodPolicy,
} from '../../../contracts/org-admin.js';
import type { EffectivePermission } from '../../../contracts/org-admin.js';
import { SOD_POLICIES_RULE_CODE } from '../../../contracts/enums.js';
import { GRANT_ONLY_PERMISSIONS, PERMISSION_CATALOG, PERMISSION_CODES, permissionTenantKind } from '../../../contracts/permissions.js';
import type { PermissionCode } from '../../../contracts/permissions.js';
import { mockRoute } from '../../app.js';
import type { MockApp } from '../../app.js';
import {
  ACCESS_GRANTS,
  ACCESS_RESTRICTIONS,
  CONFLICT_DECLARATIONS,
  MEMBERS,
  SOD_POLICIES,
  findTenantRoleByCode,
} from '../../fixtures/org-admin/index.js';
import {
  SEVERITY_ORDER,
  accessFindings,
  conflictDetail,
  conflictRow,
  grantRow,
  grantStatus,
  heldPermissionsOf,
  iso,
  matches,
  memberOfTenant,
  person,
  personOrNull,
  restrictionRow,
  restrictionStatus,
  roleAssignmentRowsOf,
  scopeLabelOf,
  sodPolicyMode,
  sortRows,
  withinDates,
} from './views.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function isLive(status: string): boolean {
  return status === 'active' || status === 'expiring_soon';
}

function activeMember(tenantId: number, userId: number): boolean {
  const member = memberOfTenant(tenantId, userId);
  return member !== undefined && member.membershipStatus === 'active' && member.userStatus === 'active';
}

export function registerAccess(app: MockApp): void {
  mockRoute(app, listAccessGrants, ({ requireTenant, query, fixtures, now }) => {
    const { tenant } = requireTenant();
    const rows = ACCESS_GRANTS.filter((grant) => grant.tenantId === tenant.id)
      .map((grant) => grantRow(grant, now))
      .filter((row) => query.status === undefined || query.status.includes(row.status))
      .filter((row) => query.userId === undefined || row.user.userId === query.userId)
      .filter((row) => query.ownerUserId === undefined || row.owner.userId === query.ownerUserId)
      .filter((row) => query.permissionCode === undefined || row.permissionCode === query.permissionCode)
      .filter((row) => withinDates(row.expiresAt, query.expiresFrom, query.expiresTo))
      .filter((row) => matches(query.q, row.user.fullName, row.permissionCode, row.reason, row.owner.fullName));
    return fixtures.page(
      sortRows(
        rows,
        query.sort,
        query.dir,
        {
          expiresAt: (row) => row.expiresAt,
          startsAt: (row) => row.startsAt,
          user: (row) => row.user.fullName,
          permissionCode: (row) => row.permissionCode,
        },
        'expiresAt',
      ),
    );
  });

  mockRoute(app, createAccessGrant, ({ requireTenant, requirePersona, body, fail, now }) => {
    const access = requireTenant();
    const tenantId = access.tenant.id;
    const caller = requirePersona();
    if (body.userId === caller.userId) {
      return fail(403, 'SELF_GRANT_FORBIDDEN', 'Nobody can grant access to themselves.');
    }
    if ((GRANT_ONLY_PERMISSIONS as readonly string[]).includes(body.permissionCode)) {
      return fail(422, 'PERMISSION_NOT_GRANTABLE', 'Support access is granted only through an authorized support grant.');
    }
    if (permissionTenantKind(body.permissionCode) !== 'buyer' && permissionTenantKind(body.permissionCode) !== 'any') {
      return fail(422, 'PERMISSION_WRONG_TENANT_KIND', 'This permission does not exist for a buyer organization.');
    }
    if (!access.permissions.includes(body.permissionCode)) {
      return fail(403, 'GRANT_NOT_HELD', `You do not hold ${body.permissionCode}, so you cannot grant it.`);
    }
    if (!activeMember(tenantId, body.userId)) {
      return fail(409, 'USER_NOT_ACTIVE', 'Access can be granted to active members only.');
    }
    if (!activeMember(tenantId, body.ownerUserId)) {
      return fail(409, 'OWNER_NOT_ACTIVE', 'The owner must be an active member.');
    }
    const label = scopeLabelOf(tenantId, body.scope.scopeType, body.scope.scopeId);
    if (label === null) {
      return fail(422, 'SCOPE_NOT_FOUND', 'The chosen record does not exist in this organization.');
    }
    if (Date.parse(body.expiresAt) - Date.parse(body.startsAt) > MAX_GRANT_DAYS * DAY_MS) {
      return fail(422, 'GRANT_TOO_LONG', `A direct grant lasts at most ${MAX_GRANT_DAYS} days.`);
    }
    const restricted = ACCESS_RESTRICTIONS.some(
      (restriction) =>
        restriction.tenantId === tenantId &&
        restriction.userId === body.userId &&
        isLive(restrictionStatus(restriction, now)) &&
        (restriction.permissionCode === null || restriction.permissionCode === body.permissionCode) &&
        (restriction.scope.scopeType === 'organization' ||
          (restriction.scope.scopeType === body.scope.scopeType && restriction.scope.scopeId === body.scope.scopeId)),
    );
    if (restricted) {
      return fail(409, 'RESTRICTION_APPLIES', 'An active restriction covers this permission and scope; it would win over the grant.');
    }
    return grantRow(
      {
        grantId: 900,
        tenantId,
        userId: body.userId,
        permissionCode: body.permissionCode,
        scope: { scopeType: body.scope.scopeType, scopeId: body.scope.scopeId, scopeLabel: label },
        reason: body.reason,
        ownerUserId: body.ownerUserId,
        grantedByUserId: caller.userId,
        startsAt: body.startsAt,
        expiresAt: body.expiresAt,
        revokedAt: null,
        revokedByUserId: null,
      },
      now,
    );
  });

  mockRoute(app, revokeAccessGrant, ({ requireTenant, requirePersona, params, notFound, fail, now }) => {
    const { tenant } = requireTenant();
    const grant = ACCESS_GRANTS.find((candidate) => candidate.tenantId === tenant.id && candidate.grantId === params.grantId);
    if (grant === undefined) {
      return notFound();
    }
    const status = grantStatus(grant, now);
    if (status === 'revoked' || status === 'expired') {
      return fail(409, 'GRANT_ALREADY_ENDED', 'This grant has already ended.');
    }
    const caller = requirePersona();
    return { ...grantRow(grant, now), revokedAt: iso(now), revokedBy: { userId: caller.userId, fullName: caller.fullName }, status: 'revoked' };
  });

  mockRoute(app, extendAccessGrant, ({ requireTenant, params, body, notFound, fail, now }) => {
    const access = requireTenant();
    const grant = ACCESS_GRANTS.find((candidate) => candidate.tenantId === access.tenant.id && candidate.grantId === params.grantId);
    if (grant === undefined) {
      return notFound();
    }
    const status = grantStatus(grant, now);
    if (status === 'revoked' || status === 'expired') {
      return fail(409, 'GRANT_ALREADY_ENDED', 'An ended grant cannot be extended. Create a new grant.');
    }
    if (!access.permissions.includes(grant.permissionCode)) {
      return fail(403, 'GRANT_NOT_HELD', `You do not hold ${grant.permissionCode}, so you cannot extend it.`);
    }
    if (Date.parse(body.expiresAt) <= Date.parse(grant.expiresAt)) {
      return fail(422, 'GRANT_DATES_INVALID', 'The new expiry must be later than the current one.');
    }
    if (Date.parse(body.expiresAt) - Date.parse(grant.startsAt) > MAX_GRANT_DAYS * DAY_MS) {
      return fail(422, 'GRANT_TOO_LONG', `A direct grant lasts at most ${MAX_GRANT_DAYS} days in total.`);
    }
    const row = grantRow({ ...grant, expiresAt: body.expiresAt }, now);
    return row;
  });

  mockRoute(app, listAccessRestrictions, ({ requireTenant, query, fixtures, now }) => {
    const { tenant } = requireTenant();
    const rows = ACCESS_RESTRICTIONS.filter((restriction) => restriction.tenantId === tenant.id)
      .map((restriction) => restrictionRow(restriction, now))
      .filter((row) => query.restrictionType === undefined || query.restrictionType.includes(row.restrictionType))
      .filter((row) => query.status === undefined || query.status.includes(row.status))
      .filter((row) => query.userId === undefined || row.user.userId === query.userId)
      .filter((row) => matches(query.q, row.user.fullName, row.reason, row.scope.scopeLabel));
    return fixtures.page(
      sortRows(
        rows,
        query.sort,
        query.dir,
        { startsAt: (row) => row.startsAt, endsAt: (row) => row.endsAt, user: (row) => row.user.fullName },
        'startsAt',
      ),
    );
  });

  mockRoute(app, createAccessRestriction, ({ requireTenant, requirePersona, body, fail, now }) => {
    const { tenant } = requireTenant();
    const caller = requirePersona();
    if (body.userId === caller.userId) {
      return fail(409, 'CANNOT_RESTRICT_SELF', 'Another administrator must restrict your own access.');
    }
    const member = memberOfTenant(tenant.id, body.userId);
    if (member === undefined || member.membershipStatus === 'revoked') {
      return fail(409, 'USER_NOT_MEMBER', 'Restrictions apply to current members only.');
    }
    const label = scopeLabelOf(tenant.id, body.scope.scopeType, body.scope.scopeId);
    if (label === null) {
      return fail(422, 'SCOPE_NOT_FOUND', 'The chosen record does not exist in this organization.');
    }
    return restrictionRow(
      {
        restrictionId: 900,
        tenantId: tenant.id,
        userId: body.userId,
        permissionCode: body.permissionCode,
        scope: { scopeType: body.scope.scopeType, scopeId: body.scope.scopeId, scopeLabel: label },
        restrictionType: body.restrictionType,
        reason: body.reason,
        startsAt: body.startsAt,
        endsAt: body.endsAt,
        imposedByUserId: caller.userId,
        conflictDeclarationId: null,
      },
      now,
    );
  });

  mockRoute(app, liftAccessRestriction, ({ requireTenant, params, notFound, fail, now }) => {
    const { tenant } = requireTenant();
    const restriction = ACCESS_RESTRICTIONS.find(
      (candidate) => candidate.tenantId === tenant.id && candidate.restrictionId === params.restrictionId,
    );
    if (restriction === undefined) {
      return notFound();
    }
    if (restrictionStatus(restriction, now) === 'expired') {
      return fail(409, 'RESTRICTION_ALREADY_ENDED', 'This restriction has already ended.');
    }
    const declaration = CONFLICT_DECLARATIONS.find((candidate) => candidate.declarationId === restriction.conflictDeclarationId);
    if (declaration !== undefined && declaration.disposition === 'pending_review') {
      return fail(409, 'RESTRICTION_CONFLICT_PENDING', 'This restriction ends with the conflict review disposition.');
    }
    return { ...restrictionRow(restriction, now), endsAt: iso(now), status: 'expired' };
  });

  mockRoute(app, getEffectiveAccess, ({ requireTenant, params, notFound, now }) => {
    const { tenant } = requireTenant();
    const member = memberOfTenant(tenant.id, params.userId);
    if (member === undefined) {
      return notFound();
    }
    const sources = new Map<PermissionCode, EffectivePermission['sources']>();
    const add = (code: PermissionCode, source: EffectivePermission['sources'][number]) => {
      sources.set(code, [...(sources.get(code) ?? []), source]);
    };
    // A suspended member keeps their roles and grants; the suspension restriction then overrides every one of them,
    // so the card shows what the suspension blocks (PRD §4.2). Invited, pending and ended memberships hold nothing.
    if (member.membershipStatus === 'active' || member.membershipStatus === 'suspended') {
      for (const row of roleAssignmentRowsOf(tenant.id, member.userId, now)) {
        if (!isLive(row.status)) {
          continue;
        }
        const role = findTenantRoleByCode(tenant.id, row.role.code);
        if (role === undefined || !role.active) {
          continue;
        }
        for (const code of role.permissions) {
          add(code, {
            kind: row.viaGroup === null ? 'role' : 'group_role',
            label: row.viaGroup === null ? role.name : `${role.name} via ${row.viaGroup.name}`,
            scope: row.scope,
            expiresAt: row.endsAt,
          });
        }
      }
      for (const grant of ACCESS_GRANTS) {
        if (grant.tenantId === tenant.id && grant.userId === member.userId && isLive(grantStatus(grant, now))) {
          add(grant.permissionCode, { kind: 'direct_grant', label: 'Direct grant', scope: grant.scope, expiresAt: grant.expiresAt });
        }
      }
    }
    const restrictions = ACCESS_RESTRICTIONS.filter(
      (restriction) => restriction.tenantId === tenant.id && restriction.userId === member.userId,
    );
    const liveRestrictions = restrictions.filter((restriction) => isLive(restrictionStatus(restriction, now)));
    const permissions = PERMISSION_CODES.filter((code) => sources.has(code)).map((code) => {
      const codeSources = sources.get(code) ?? [];
      const restrictedBy = liveRestrictions.filter(
        (restriction) => restriction.permissionCode === null || restriction.permissionCode === code,
      );
      const organizationWide =
        member.membershipStatus === 'suspended' || restrictedBy.some((restriction) => restriction.scope.scopeType === 'organization');
      return {
        code,
        category: PERMISSION_CATALOG[code].category,
        description: PERMISSION_CATALOG[code].description,
        effective: !organizationWide,
        sources: codeSources,
        restrictedBy: restrictedBy.map((restriction) => ({
          restrictionId: restriction.restrictionId,
          restrictionType: restriction.restrictionType,
          scopeLabel: restriction.scope.scopeLabel,
          reason: restriction.reason,
        })),
      };
    });
    const held = heldPermissionsOf(tenant.id, member.userId, now);
    return {
      user: person(member.userId),
      capacity: member.capacity,
      membershipStatus: member.membershipStatus,
      permissions,
      restrictions: restrictions.map((restriction) => restrictionRow(restriction, now)),
      sodBreaches: sodRulesBreachedBy(held).map((rule) => ({
        ruleCode: rule,
        mode: sodPolicyMode(tenant.id, rule),
        permissions: [...SOD_RULE_PERMISSIONS[rule]] as [PermissionCode, PermissionCode],
      })),
    };
  });

  mockRoute(app, listAccessFindings, ({ requireTenant, query, fixtures, now }) => {
    const { tenant } = requireTenant();
    const all = accessFindings(tenant.id, now);
    const rows = all
      .filter((row) => query.type === undefined || query.type.includes(row.type))
      .filter((row) => query.severity === undefined || query.severity.includes(row.severity))
      .filter((row) => query.userId === undefined || row.user.userId === query.userId)
      .filter((row) => matches(query.q, row.user.fullName, row.title, row.detail));
    const sorted = sortRows(
      rows,
      query.sort,
      query.dir,
      {
        severity: (row) => SEVERITY_ORDER[row.severity] ?? 3,
        dueAt: (row) => row.dueAt,
        user: (row) => row.user.fullName,
        type: (row) => row.type,
      },
      'severity',
    );
    const count = (type: string) => all.filter((row) => row.type === type).length;
    return {
      ...fixtures.page(sorted),
      summary: {
        sodConflicts: count('sod_conflict'),
        expiringGrants: count('grant_expiring'),
        dormantAccounts: count('dormant_account'),
        activeRestrictions: count('active_restriction'),
        pendingConflictReviews: count('pending_conflict_review'),
        generatedAt: iso(now),
      },
    };
  });

  const sodRow = (tenantId: number, rule: (typeof SOD_POLICIES_RULE_CODE)[number], now: Date) => {
    const policy = SOD_POLICIES.find((candidate) => candidate.tenantId === tenantId && candidate.ruleCode === rule);
    const holders = MEMBERS.filter(
      (member) =>
        member.tenantId === tenantId &&
        member.membershipStatus === 'active' &&
        sodRulesBreachedBy(heldPermissionsOf(tenantId, member.userId, now)).includes(rule),
    ).length;
    return {
      ruleCode: rule,
      permissions: [...SOD_RULE_PERMISSIONS[rule]] as [PermissionCode, PermissionCode],
      mode: policy?.mode ?? 'enforced',
      configured: policy !== undefined,
      alternativeOversightNote: policy?.alternativeOversightNote ?? null,
      approvedBy: personOrNull(policy?.approvedByUserId ?? null),
      effectiveFrom: policy?.effectiveFrom ?? null,
      holdersOfBoth: holders,
    };
  };

  mockRoute(app, listSodPolicies, ({ requireTenant, now }) => {
    const { tenant } = requireTenant();
    return { items: SOD_POLICIES_RULE_CODE.map((rule) => sodRow(tenant.id, rule, now)) };
  });

  mockRoute(app, updateSodPolicy, ({ requireTenant, requirePersona, params, body, fail, now }) => {
    const { tenant } = requireTenant();
    const current = sodRow(tenant.id, params.ruleCode, now);
    if (current.configured && current.mode === body.mode && current.alternativeOversightNote === body.alternativeOversightNote) {
      return fail(409, 'SOD_POLICY_UNCHANGED', 'The policy already has this setting.');
    }
    const caller = requirePersona();
    return {
      ...current,
      mode: body.mode,
      configured: true,
      alternativeOversightNote: body.mode === 'enforced' ? null : body.alternativeOversightNote,
      approvedBy: { userId: caller.userId, fullName: caller.fullName },
      effectiveFrom: iso(now),
    };
  });

  mockRoute(app, listConflictDeclarations, ({ requireTenant, query, fixtures }) => {
    const { tenant } = requireTenant();
    const rows = CONFLICT_DECLARATIONS.filter((declaration) => declaration.tenantId === tenant.id)
      .map(conflictRow)
      .filter((row) => query.disposition === undefined || query.disposition.includes(row.disposition))
      .filter((row) => query.subjectType === undefined || query.subjectType.includes(row.subject.subjectType))
      .filter((row) => query.nature === undefined || (row.nature !== null && query.nature.includes(row.nature)))
      .filter((row) => query.hasConflict === undefined || row.hasConflict === query.hasConflict)
      .filter((row) => query.dualMembership === undefined || row.holdsSupplierMemberships === query.dualMembership)
      .filter((row) => withinDates(row.declaredAt, query.declaredFrom, query.declaredTo))
      .filter((row) => matches(query.q, row.declarant.fullName, row.subject.reference, row.subject.title, row.supplierName));
    return fixtures.page(
      sortRows(
        rows,
        query.sort ?? 'declaredAt',
        query.sort === undefined ? 'desc' : query.dir,
        {
          declaredAt: (row) => row.declaredAt,
          disposition: (row) => (row.disposition === 'pending_review' ? '0' : `1${row.disposition}`),
          declarant: (row) => row.declarant.fullName,
        },
        'declaredAt',
      ),
    );
  });

  mockRoute(app, getConflictDeclaration, ({ requireTenant, requirePersona, params, notFound, now }) => {
    const { tenant } = requireTenant();
    const declaration = CONFLICT_DECLARATIONS.find(
      (candidate) => candidate.tenantId === tenant.id && candidate.declarationId === params.declarationId,
    );
    if (declaration === undefined) {
      return notFound();
    }
    return conflictDetail(declaration, requirePersona().userId, now);
  });

  mockRoute(app, decideConflictDeclaration, ({ requireTenant, requirePersona, params, body, notFound, fail, now }) => {
    const { tenant } = requireTenant();
    const declaration = CONFLICT_DECLARATIONS.find(
      (candidate) => candidate.tenantId === tenant.id && candidate.declarationId === params.declarationId,
    );
    if (declaration === undefined) {
      return notFound();
    }
    const caller = requirePersona();
    if (declaration.userId === caller.userId) {
      return fail(403, 'CANNOT_REVIEW_OWN_DECLARATION', 'Another reviewer must decide your own declaration.');
    }
    if (declaration.disposition !== 'pending_review') {
      return fail(409, 'DECLARATION_ALREADY_DECIDED', 'This declaration already has a disposition.');
    }
    if (body.disposition === 'reassigned') {
      const target = body.reassignToUserId;
      const eligible =
        target !== null &&
        target !== declaration.userId &&
        activeMember(tenant.id, target) &&
        !CONFLICT_DECLARATIONS.some(
          (candidate) =>
            candidate.userId === target &&
            candidate.subjectType === declaration.subjectType &&
            candidate.subjectId === declaration.subjectId &&
            candidate.hasConflict,
        );
      if (!eligible) {
        return fail(409, 'REASSIGNEE_NOT_ELIGIBLE', 'Choose an active member without a conflict on this subject.');
      }
    }
    const detail = conflictDetail(declaration, caller.userId, now);
    const reviewedAt = iso(now);
    const blocked = body.disposition === 'recused' || body.disposition === 'reassigned';
    return {
      ...detail,
      disposition: body.disposition,
      reviewedBy: { userId: caller.userId, fullName: caller.fullName },
      reviewedAt,
      reviewNote: body.reviewNote,
      accessBlocked: blocked,
      restriction:
        detail.restriction === null
          ? null
          : blocked
            ? detail.restriction
            : { ...detail.restriction, endsAt: reviewedAt, status: 'expired' },
      history: [
        ...detail.history,
        { at: reviewedAt, actor: { userId: caller.userId, fullName: caller.fullName }, action: `Disposition: ${body.disposition}`, note: body.reviewNote },
      ],
      allowedDispositions: [],
    };
  });
}
