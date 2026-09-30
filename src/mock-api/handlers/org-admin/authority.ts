/**
 * Org-admin mock handlers, buyer authority (ADM-05): authority limits, delegations (capped at the delegator's own
 * limit, BR-06) and committees (quorum, chair, alternates). Commands answer with the outcome; nothing is stored.
 */
import {
  addCommitteeMember,
  createAuthorityLimit,
  createCommittee,
  createDelegation,
  deactivateCommittee,
  endAuthorityLimit,
  endCommitteeMember,
  getCommittee,
  listAuthorityLimits,
  listCommittees,
  listDelegations,
  revokeDelegation,
  sodRulesBreachedBy,
} from '../../../contracts/org-admin.js';
import { gt } from '../../../contracts/decimal.js';
import { mockRoute } from '../../app.js';
import type { MockApp } from '../../app.js';
import {
  AUTHORITY_LIMITS,
  CATEGORIES,
  COMMITTEES,
  DELEGATIONS,
  LEGAL_ENTITIES,
  ORGANIZATION_SETTINGS,
  findTenantRoleById,
} from '../../fixtures/org-admin/index.js';
import {
  committeeDetail,
  committeeRow,
  delegationRow,
  delegationStatus,
  heldPermissionsOf,
  iso,
  limitRow,
  limitStatus,
  matches,
  memberOfTenant,
  person,
  sortRows,
  userLimitFor,
} from './views.js';
import type { UserLimitScope } from './views.js';

/** The decision whose approval a delegate would give, mapped to the permission that makes it incompatible. */
const DECISION_SOD_PERMISSION: Readonly<Record<string, string>> = {
  request_approval: 'request.approve',
  release_approval: 'tender.release_approve',
  award_approval: 'award.approve',
  exclusion_approval: 'exclusion.approve',
};

function acceptedCurrencies(tenantId: number): readonly string[] {
  return ORGANIZATION_SETTINGS.find((settings) => settings.tenantId === tenantId)?.acceptedCurrencies ?? ['BWP'];
}

/** Whether `categoryId` is `ancestorId` or one of its descendants (DD-26 category hierarchy). */
function isWithinCategory(tenantId: number, categoryId: number, ancestorId: number): boolean {
  let current: number | null = categoryId;
  const seen = new Set<number>();
  while (current !== null && !seen.has(current)) {
    if (current === ancestorId) {
      return true;
    }
    seen.add(current);
    const id: number = current;
    current = CATEGORIES.find((row) => row.id === id && row.tenantId === tenantId)?.parentId ?? null;
  }
  return false;
}

/**
 * Why a delegation would widen the delegator's limit (legal entity, category, validity window), or `null` when it
 * stays within it (BR-06: nobody delegates what they do not hold).
 */
export function scopeWidening(
  tenantId: number,
  limit: UserLimitScope,
  body: { legalEntityId: number | null; categoryId: number | null; startsAt: string; endsAt: string },
): string | null {
  if (limit.legalEntityId !== null && body.legalEntityId !== limit.legalEntityId) {
    const entity = LEGAL_ENTITIES.find((row) => row.id === limit.legalEntityId && row.tenantId === tenantId);
    return `The delegator’s authority covers ${entity?.name ?? 'one legal entity'} only.`;
  }
  if (limit.categoryId !== null && (body.categoryId === null || !isWithinCategory(tenantId, body.categoryId, limit.categoryId))) {
    const category = CATEGORIES.find((row) => row.id === limit.categoryId && row.tenantId === tenantId);
    return `The delegator’s authority covers the category ${category?.name ?? 'of the limit'} and its subcategories only.`;
  }
  if (Date.parse(limit.effectiveFrom) > Date.parse(body.startsAt)) {
    return `The delegator’s authority starts on ${limit.effectiveFrom.slice(0, 10)}; start the delegation on or after that date.`;
  }
  if (limit.effectiveTo !== null && Date.parse(limit.effectiveTo) < Date.parse(body.endsAt)) {
    return `The delegator’s authority ends on ${limit.effectiveTo.slice(0, 10)}; end the delegation on or before that date.`;
  }
  return null;
}

export function registerAuthority(app: MockApp): void {
  mockRoute(app, listAuthorityLimits, ({ requireTenant, query, fixtures, now }) => {
    const { tenant } = requireTenant();
    const rows = AUTHORITY_LIMITS.filter((limit) => limit.tenantId === tenant.id)
      .filter((limit) => query.userId === undefined || (limit.subjectType === 'user' && limit.subjectUserId === query.userId))
      .map((limit) => limitRow(limit, now))
      .filter((row) => query.subjectType === undefined || query.subjectType.includes(row.subjectType))
      .filter((row) => query.decisionType === undefined || query.decisionType.includes(row.decisionType))
      .filter((row) => query.status === undefined || query.status.includes(row.status))
      .filter((row) => matches(query.q, row.subject.name, row.decisionType, row.legalEntity?.name, row.category?.name));
    return fixtures.page(
      sortRows(
        rows,
        query.sort,
        query.dir,
        {
          decisionType: (row) => row.decisionType,
          subject: (row) => row.subject.name,
          effectiveFrom: (row) => row.effectiveFrom,
          maxAmount: (row) => (row.maxAmount === null ? Number.MAX_SAFE_INTEGER : Number(row.maxAmount.amount)),
        },
        'decisionType',
      ),
    );
  });

  mockRoute(app, createAuthorityLimit, ({ requireTenant, requirePersona, body, fail, now }) => {
    const { tenant } = requireTenant();
    const caller = requirePersona();
    let subject: { id: number; name: string };
    if (body.subjectType === 'user') {
      const member = memberOfTenant(tenant.id, body.subjectId);
      if (member === undefined || member.membershipStatus !== 'active') {
        return fail(422, 'SUBJECT_NOT_FOUND', 'Choose an active member of this organization.');
      }
      if (member.userId === caller.userId) {
        return fail(403, 'SELF_AUTHORITY_FORBIDDEN', 'Nobody can set their own approval authority.');
      }
      subject = { id: member.userId, name: member.fullName };
    } else if (body.subjectType === 'role') {
      const role = findTenantRoleById(tenant.id, body.subjectId);
      if (role === undefined || !role.active) {
        return fail(422, 'SUBJECT_NOT_FOUND', 'Choose an active role of this organization.');
      }
      subject = { id: role.roleId, name: role.name };
    } else {
      const committee = COMMITTEES.find((candidate) => candidate.tenantId === tenant.id && candidate.committeeId === body.subjectId && candidate.active);
      if (committee === undefined) {
        return fail(422, 'SUBJECT_NOT_FOUND', 'Choose an active committee of this organization.');
      }
      subject = { id: committee.committeeId, name: committee.name };
    }
    if (body.maxAmount !== null && !acceptedCurrencies(tenant.id).includes(body.maxAmount.currency)) {
      return fail(422, 'CURRENCY_NOT_ACCEPTED', 'Use one of the organization’s accepted currencies.');
    }
    const entity = body.legalEntityId === null ? null : LEGAL_ENTITIES.find((row) => row.id === body.legalEntityId && row.tenantId === tenant.id);
    const category = body.categoryId === null ? null : CATEGORIES.find((row) => row.id === body.categoryId && row.tenantId === tenant.id);
    if (entity === undefined || category === undefined) {
      return fail(422, 'SCOPE_NOT_FOUND', 'Choose a legal entity and category of this organization.');
    }
    const overlaps = AUTHORITY_LIMITS.some(
      (limit) =>
        limit.tenantId === tenant.id &&
        limit.subjectType === body.subjectType &&
        (body.subjectType === 'user'
          ? limit.subjectUserId === body.subjectId
          : body.subjectType === 'committee'
            ? limit.subjectCommitteeId === body.subjectId
            : limit.subjectRoleCode === findTenantRoleById(tenant.id, body.subjectId)?.code) &&
        limit.decisionType === body.decisionType &&
        limit.legalEntityId === body.legalEntityId &&
        limit.categoryId === body.categoryId &&
        ['active', 'expiring_soon', 'scheduled'].includes(limitStatus(limit, now)),
    );
    if (overlaps) {
      return fail(409, 'LIMIT_OVERLAPS', 'A limit for this decision and scope is already in force. End it first.');
    }
    return {
      limitId: 900,
      subjectType: body.subjectType,
      subject,
      decisionType: body.decisionType,
      maxAmount: body.maxAmount,
      legalEntity: entity === null ? null : { id: entity.id, name: entity.name },
      category: category === null ? null : { id: category.id, name: category.name },
      effectiveFrom: body.effectiveFrom,
      effectiveTo: body.effectiveTo,
      approvedBy: { userId: caller.userId, fullName: caller.fullName },
      status: Date.parse(body.effectiveFrom) > now.getTime() ? 'scheduled' : 'active',
    };
  });

  mockRoute(app, endAuthorityLimit, ({ requireTenant, requirePersona, params, body, notFound, fail, now }) => {
    const { tenant } = requireTenant();
    const limit = AUTHORITY_LIMITS.find((candidate) => candidate.tenantId === tenant.id && candidate.limitId === params.limitId);
    if (limit === undefined) {
      return notFound();
    }
    if (limitStatus(limit, now) === 'expired') {
      return fail(409, 'LIMIT_ALREADY_ENDED', 'This limit has already ended.');
    }
    if (limit.subjectType === 'user' && limit.subjectUserId === requirePersona().userId) {
      return fail(403, 'SELF_AUTHORITY_FORBIDDEN', 'Nobody can change their own approval authority.');
    }
    if (Date.parse(body.effectiveTo) <= Date.parse(limit.effectiveFrom)) {
      return fail(422, 'LIMIT_DATES_INVALID', 'The end must be after the start of the limit.');
    }
    return { ...limitRow(limit, now), effectiveTo: body.effectiveTo, status: Date.parse(body.effectiveTo) <= now.getTime() ? 'expired' : 'expiring_soon' };
  });

  mockRoute(app, listDelegations, ({ requireTenant, query, fixtures, now }) => {
    const { tenant } = requireTenant();
    const rows = DELEGATIONS.filter((delegation) => delegation.tenantId === tenant.id)
      .map((delegation) => delegationRow(delegation, now))
      .filter((row) => query.status === undefined || query.status.includes(row.status))
      .filter((row) => query.delegatorUserId === undefined || row.delegator.userId === query.delegatorUserId)
      .filter((row) => query.delegateUserId === undefined || row.delegate.userId === query.delegateUserId)
      .filter((row) => query.decisionType === undefined || row.decisionTypes.some((type) => query.decisionType?.includes(type) === true))
      .filter((row) => matches(query.q, row.delegator.fullName, row.delegate.fullName, row.reason));
    return fixtures.page(
      sortRows(
        rows,
        query.sort,
        query.dir,
        {
          startsAt: (row) => row.startsAt,
          endsAt: (row) => row.endsAt,
          delegator: (row) => row.delegator.fullName,
          delegate: (row) => row.delegate.fullName,
        },
        'startsAt',
      ),
    );
  });

  mockRoute(app, createDelegation, ({ requireTenant, requirePersona, body, fail, now }) => {
    const { tenant } = requireTenant();
    const caller = requirePersona();
    if (body.delegateUserId === caller.userId) {
      return fail(403, 'SELF_DELEGATION_FORBIDDEN', 'You cannot record a delegation to yourself.');
    }
    const delegate = memberOfTenant(tenant.id, body.delegateUserId);
    if (delegate === undefined || delegate.membershipStatus !== 'active' || delegate.userStatus !== 'active') {
      return fail(409, 'DELEGATE_NOT_ACTIVE', 'The delegate must be an active member.');
    }
    if (!acceptedCurrencies(tenant.id).includes(body.maxAmount.currency)) {
      return fail(422, 'CURRENCY_NOT_ACCEPTED', 'Use one of the organization’s accepted currencies.');
    }
    const limits = body.decisionTypes.map((type) => ({ type, limit: userLimitFor(tenant.id, body.delegatorUserId, type, now) }));
    const missing = limits.filter((entry) => entry.limit === undefined);
    if (missing.length > 0) {
      return fail(409, 'DELEGATOR_HAS_NO_AUTHORITY', `The delegator holds no authority for: ${missing.map((entry) => entry.type).join(', ')}.`);
    }
    const exceeded = limits.filter(
      (entry) =>
        entry.limit !== undefined &&
        entry.limit.amount !== null &&
        (entry.limit.currency !== body.maxAmount.currency || gt(body.maxAmount.amount, entry.limit.amount)),
    );
    if (exceeded.length > 0) {
      const cap = exceeded[0]?.limit;
      return fail(
        409,
        'DELEGATION_EXCEEDS_LIMIT',
        `A delegation cannot exceed the delegator’s own limit (${cap?.currency ?? ''} ${cap?.amount ?? ''}).`,
      );
    }
    const widened = limits.flatMap((entry) => {
      const reason = entry.limit === undefined ? null : scopeWidening(tenant.id, entry.limit, body);
      return reason === null ? [] : [`${entry.type}: ${reason}`];
    });
    if (widened.length > 0) {
      return fail(
        409,
        'DELEGATION_EXCEEDS_SCOPE',
        `A delegation cannot go beyond the delegator’s own authority. ${widened.join(' ')}`,
      );
    }
    const delegatePermissions = heldPermissionsOf(tenant.id, body.delegateUserId, now);
    const conflicting = body.decisionTypes.filter((type) => {
      const permission = DECISION_SOD_PERMISSION[type];
      return permission !== undefined && sodRulesBreachedBy([...delegatePermissions, permission]).length > sodRulesBreachedBy(delegatePermissions).length;
    });
    if (conflicting.length > 0) {
      return fail(409, 'DELEGATE_CONFLICT', `The delegate holds duties incompatible with: ${conflicting.join(', ')}.`);
    }
    const entity = body.legalEntityId === null ? null : LEGAL_ENTITIES.find((row) => row.id === body.legalEntityId && row.tenantId === tenant.id);
    const category = body.categoryId === null ? null : CATEGORIES.find((row) => row.id === body.categoryId && row.tenantId === tenant.id);
    const first = limits[0]?.limit;
    return {
      delegationId: 900,
      delegator: person(body.delegatorUserId),
      delegate: person(body.delegateUserId),
      decisionTypes: body.decisionTypes,
      maxAmount: body.maxAmount,
      delegatorLimit: first === undefined || first.amount === null ? null : { amount: first.amount, currency: first.currency },
      legalEntity: entity === null || entity === undefined ? null : { id: entity.id, name: entity.name },
      category: category === null || category === undefined ? null : { id: category.id, name: category.name },
      startsAt: body.startsAt,
      endsAt: body.endsAt,
      reason: body.reason,
      revokedAt: null,
      revokedBy: null,
      status: Date.parse(body.startsAt) > now.getTime() ? 'scheduled' : 'active',
    };
  });

  mockRoute(app, revokeDelegation, ({ requireTenant, requirePersona, params, notFound, fail, now }) => {
    const { tenant } = requireTenant();
    const delegation = DELEGATIONS.find((candidate) => candidate.tenantId === tenant.id && candidate.delegationId === params.delegationId);
    if (delegation === undefined) {
      return notFound();
    }
    const status = delegationStatus(delegation, now);
    if (status === 'revoked' || status === 'expired') {
      return fail(409, 'DELEGATION_ALREADY_ENDED', 'This delegation has already ended.');
    }
    const caller = requirePersona();
    return { ...delegationRow(delegation, now), revokedAt: iso(now), revokedBy: { userId: caller.userId, fullName: caller.fullName }, status: 'revoked' };
  });

  mockRoute(app, listCommittees, ({ requireTenant, query, fixtures, now }) => {
    const { tenant } = requireTenant();
    const rows = COMMITTEES.filter((committee) => committee.tenantId === tenant.id)
      .map((committee) => committeeRow(committee, now))
      .filter((row) => query.purpose === undefined || query.purpose.includes(row.purpose))
      .filter((row) => query.active === undefined || row.active === query.active)
      .filter((row) => matches(query.q, row.name, row.chair?.fullName));
    return fixtures.page(
      sortRows(rows, query.sort, query.dir, { name: (row) => row.name, purpose: (row) => row.purpose, quorum: (row) => row.quorum }, 'name'),
    );
  });

  const findCommittee = (tenantId: number, committeeId: number) =>
    COMMITTEES.find((committee) => committee.tenantId === tenantId && committee.committeeId === committeeId);

  mockRoute(app, getCommittee, ({ requireTenant, params, notFound, now }) => {
    const committee = findCommittee(requireTenant().tenant.id, params.committeeId);
    if (committee === undefined) {
      return notFound();
    }
    return committeeDetail(committee, now);
  });

  mockRoute(app, createCommittee, ({ requireTenant, body, fail }) => {
    const { tenant } = requireTenant();
    if (COMMITTEES.some((committee) => committee.tenantId === tenant.id && committee.name.toLowerCase() === body.name.toLowerCase())) {
      return fail(409, 'COMMITTEE_NAME_TAKEN', 'Another committee already has this name.');
    }
    const entity = body.legalEntityId === null ? null : LEGAL_ENTITIES.find((row) => row.id === body.legalEntityId && row.tenantId === tenant.id);
    if (entity === undefined) {
      return fail(422, 'SCOPE_NOT_FOUND', 'Choose a legal entity of this organization.');
    }
    return {
      committeeId: 900,
      name: body.name,
      purpose: body.purpose,
      quorum: body.quorum,
      legalEntity: entity === null ? null : { id: entity.id, name: entity.name },
      active: true,
      chair: null,
      activeMemberCount: 0,
      votingMemberCount: 0,
      alternateCount: 0,
      quorumMet: false,
      members: [],
      authorityLimits: [],
      deactivatedAt: null,
    };
  });

  mockRoute(app, addCommitteeMember, ({ requireTenant, params, body, notFound, fail, now }) => {
    const { tenant } = requireTenant();
    const committee = findCommittee(tenant.id, params.committeeId);
    if (committee === undefined) {
      return notFound();
    }
    if (!committee.active) {
      return fail(409, 'COMMITTEE_INACTIVE', 'Members cannot be added to a deactivated committee.');
    }
    const member = memberOfTenant(tenant.id, body.userId);
    if (member === undefined || member.membershipStatus !== 'active') {
      return fail(409, 'USER_NOT_ACTIVE', 'Only active members can sit on a committee.');
    }
    const detail = committeeDetail(committee, now);
    const live = detail.members.filter((seat) => seat.status === 'active' || seat.status === 'expiring_soon' || seat.status === 'scheduled');
    if (live.some((seat) => seat.person.userId === body.userId)) {
      return fail(409, 'ALREADY_COMMITTEE_MEMBER', `${member.fullName} already sits on this committee.`);
    }
    if (body.memberRole === 'chair' && live.some((seat) => seat.memberRole === 'chair')) {
      return fail(409, 'CHAIR_ALREADY_ASSIGNED', 'The committee already has a chair. End that seat first.');
    }
    const seat = {
      memberId: 900,
      person: person(member.userId),
      capacity: member.capacity,
      memberRole: body.memberRole,
      startsAt: body.startsAt,
      endsAt: body.endsAt,
      status: Date.parse(body.startsAt) > now.getTime() ? ('scheduled' as const) : ('active' as const),
    };
    const members = [...detail.members, seat];
    const voting = members.filter(
      (entry) => (entry.status === 'active' || entry.status === 'expiring_soon') && (entry.memberRole === 'chair' || entry.memberRole === 'member'),
    );
    return {
      ...detail,
      members,
      activeMemberCount: detail.activeMemberCount + (seat.status === 'active' ? 1 : 0),
      votingMemberCount: voting.length,
      alternateCount: detail.alternateCount + (seat.status === 'active' && seat.memberRole === 'alternate' ? 1 : 0),
      chair: seat.memberRole === 'chair' && seat.status === 'active' ? seat.person : detail.chair,
      quorumMet: voting.length >= committee.quorum,
    };
  });

  mockRoute(app, endCommitteeMember, ({ requireTenant, params, notFound, fail, now }) => {
    const { tenant } = requireTenant();
    const committee = findCommittee(tenant.id, params.committeeId);
    if (committee === undefined) {
      return notFound();
    }
    const detail = committeeDetail(committee, now);
    const seat = detail.members.find((candidate) => candidate.memberId === params.memberId);
    if (seat === undefined) {
      return notFound();
    }
    if (seat.status === 'expired' || seat.status === 'revoked') {
      return fail(409, 'MEMBER_ALREADY_ENDED', 'This seat has already ended.');
    }
    const votingAfter = detail.members.filter(
      (entry) =>
        entry.memberId !== seat.memberId &&
        (entry.status === 'active' || entry.status === 'expiring_soon') &&
        (entry.memberRole === 'chair' || entry.memberRole === 'member'),
    );
    const isVoting = seat.memberRole === 'chair' || seat.memberRole === 'member';
    if (committee.active && isVoting && detail.quorumMet && votingAfter.length < committee.quorum) {
      return fail(409, 'QUORUM_WOULD_BREAK', 'Ending this seat leaves the committee below its quorum. Add a member first.');
    }
    const endedAt = iso(now);
    return {
      ...detail,
      members: detail.members.map((entry) => (entry.memberId === seat.memberId ? { ...entry, endsAt: endedAt, status: 'expired' as const } : entry)),
      activeMemberCount: detail.activeMemberCount - (seat.status === 'scheduled' ? 0 : 1),
      votingMemberCount: votingAfter.length,
      alternateCount: detail.alternateCount - (seat.memberRole === 'alternate' ? 1 : 0),
      chair: seat.memberRole === 'chair' ? null : detail.chair,
      quorumMet: votingAfter.length >= committee.quorum,
    };
  });

  mockRoute(app, deactivateCommittee, ({ requireTenant, params, notFound, fail, now }) => {
    const { tenant } = requireTenant();
    const committee = findCommittee(tenant.id, params.committeeId);
    if (committee === undefined) {
      return notFound();
    }
    if (!committee.active) {
      return fail(409, 'COMMITTEE_INACTIVE', 'This committee is already deactivated.');
    }
    if (committee.openWork.length > 0) {
      return fail(409, 'COMMITTEE_HAS_OPEN_WORK', `Close the open work first: ${committee.openWork.join('; ')}.`);
    }
    const detail = committeeDetail(committee, now);
    return { ...detail, active: false, deactivatedAt: iso(now), quorumMet: false };
  });
}
