/**
 * Org-admin contract, buyer authority (ADM-05): authority limits, committees and delegations (FR-03, BR-06, BR-07).
 *
 * - Authority limits (`authority_limits`) belong to a user, a role or a committee, per decision type, with an
 *   optional maximum (null = unlimited within scope), legal entity, category and effective dates.
 * - Delegations (`delegations`) name the decisions, the amount cap, the dates and the reason. A delegation can never
 *   exceed the delegator's own limit for every delegated decision type (`DELEGATION_EXCEEDS_LIMIT`), and nobody can
 *   delegate to themselves.
 * - Committees (`committees`, `committee_members`) show quorum, chair, alternates and effective dates.
 *
 * Pure module: zod and sibling contract files only.
 */
import { z } from 'zod';

import {
  Id,
  IdParam,
  Instant,
  Money,
  NonNegativeMoney,
  PersonRef,
  QueryBoolean,
  ReasonText,
  issue,
  listQueryWithSort,
  pageOf,
  queryList,
} from '../common.js';
import { defineEndpoint } from '../endpoint.js';
import {
  AuthorityLimitsDecisionType,
  AuthorityLimitsSubjectType,
  CommitteeMembersMemberRole,
  CommitteesPurpose,
} from '../enums.js';
import { AccessItemStatus } from './shared.js';

/** A named reference to a structure value (legal entity, category, committee, role). */
export const NamedRef = z.object({ id: Id, name: z.string().min(1) });
export type NamedRef = z.infer<typeof NamedRef>;

// ---------------------------------------------------------------------------------------------------------
// Authority limits
// ---------------------------------------------------------------------------------------------------------

export const AuthorityLimitRow = z.object({
  limitId: Id,
  subjectType: AuthorityLimitsSubjectType,
  subject: NamedRef,
  decisionType: AuthorityLimitsDecisionType,
  /** `null`: unlimited within the scope. */
  maxAmount: Money.nullable(),
  legalEntity: NamedRef.nullable(),
  category: NamedRef.nullable(),
  effectiveFrom: Instant,
  effectiveTo: Instant.nullable(),
  approvedBy: PersonRef.nullable(),
  status: AccessItemStatus,
});
export type AuthorityLimitRow = z.infer<typeof AuthorityLimitRow>;

export const AUTHORITY_LIMIT_SORTS = ['decisionType', 'subject', 'effectiveFrom', 'maxAmount'] as const;

export const AuthorityLimitListQuery = listQueryWithSort(AUTHORITY_LIMIT_SORTS).extend({
  subjectType: queryList(AuthorityLimitsSubjectType).optional(),
  decisionType: queryList(AuthorityLimitsDecisionType).optional(),
  userId: IdParam.optional(),
  status: queryList(AccessItemStatus).optional(),
});

export const listAuthorityLimits = defineEndpoint({
  id: 'buyer.admin.authorityLimits.list',
  method: 'GET',
  path: '/api/v1/buyer/admin/authority-limits',
  audience: 'buyer',
  permission: ['org.authority.manage', 'org.access.review'],
  query: AuthorityLimitListQuery,
  response: pageOf(AuthorityLimitRow),
  errors: [],
  screens: ['ADM-05'],
});

export const CreateAuthorityLimitBody = z
  .object({
    subjectType: AuthorityLimitsSubjectType,
    subjectId: Id,
    decisionType: AuthorityLimitsDecisionType,
    maxAmount: NonNegativeMoney.nullable(),
    legalEntityId: Id.nullable(),
    categoryId: Id.nullable(),
    effectiveFrom: Instant,
    effectiveTo: Instant.nullable(),
    reason: ReasonText,
  })
  .refine((value) => value.effectiveTo === null || Date.parse(value.effectiveTo) > Date.parse(value.effectiveFrom), {
    message: issue('LIMIT_DATES_INVALID', 'The end must be after the start.'),
    path: ['effectiveTo'],
  });
export type CreateAuthorityLimitBody = z.infer<typeof CreateAuthorityLimitBody>;

export const createAuthorityLimit = defineEndpoint({
  id: 'buyer.admin.authorityLimits.create',
  method: 'POST',
  path: '/api/v1/buyer/admin/authority-limits',
  audience: 'buyer',
  permission: 'org.authority.manage',
  body: CreateAuthorityLimitBody,
  response: AuthorityLimitRow,
  idempotent: true,
  errors: ['SUBJECT_NOT_FOUND', 'SELF_AUTHORITY_FORBIDDEN', 'LIMIT_OVERLAPS', 'CURRENCY_NOT_ACCEPTED', 'SCOPE_NOT_FOUND'],
  screens: ['ADM-05'],
});

export const LimitParams = z.object({ limitId: IdParam });

export const endAuthorityLimit = defineEndpoint({
  id: 'buyer.admin.authorityLimits.end',
  method: 'POST',
  path: '/api/v1/buyer/admin/authority-limits/:limitId/end',
  audience: 'buyer',
  permission: 'org.authority.manage',
  params: LimitParams,
  body: z.object({ effectiveTo: Instant, reason: ReasonText }),
  response: AuthorityLimitRow,
  errors: ['LIMIT_ALREADY_ENDED', 'LIMIT_DATES_INVALID', 'SELF_AUTHORITY_FORBIDDEN'],
  screens: ['ADM-05'],
});

// ---------------------------------------------------------------------------------------------------------
// Delegations
// ---------------------------------------------------------------------------------------------------------

export const DelegationRow = z.object({
  delegationId: Id,
  delegator: PersonRef,
  delegate: PersonRef,
  decisionTypes: z.array(AuthorityLimitsDecisionType).min(1),
  maxAmount: Money.nullable(),
  /** The delegator's own limit for the delegated decisions (the cap), `null` = unlimited. */
  delegatorLimit: Money.nullable(),
  legalEntity: NamedRef.nullable(),
  category: NamedRef.nullable(),
  startsAt: Instant,
  endsAt: Instant,
  reason: z.string().min(1),
  revokedAt: Instant.nullable(),
  revokedBy: PersonRef.nullable(),
  status: AccessItemStatus,
});
export type DelegationRow = z.infer<typeof DelegationRow>;

export const DELEGATION_SORTS = ['startsAt', 'endsAt', 'delegator', 'delegate'] as const;

export const DelegationListQuery = listQueryWithSort(DELEGATION_SORTS).extend({
  status: queryList(AccessItemStatus).optional(),
  delegatorUserId: IdParam.optional(),
  delegateUserId: IdParam.optional(),
  decisionType: queryList(AuthorityLimitsDecisionType).optional(),
});

export const listDelegations = defineEndpoint({
  id: 'buyer.admin.delegations.list',
  method: 'GET',
  path: '/api/v1/buyer/admin/delegations',
  audience: 'buyer',
  permission: ['org.authority.manage', 'org.access.review'],
  query: DelegationListQuery,
  response: pageOf(DelegationRow),
  errors: [],
  screens: ['ADM-05', 'ADM-03'],
});

export const CreateDelegationBody = z
  .object({
    delegatorUserId: Id,
    delegateUserId: Id,
    decisionTypes: z.array(AuthorityLimitsDecisionType).min(1, issue('DECISION_TYPES_REQUIRED', 'Choose at least one decision.')),
    maxAmount: NonNegativeMoney,
    legalEntityId: Id.nullable(),
    categoryId: Id.nullable(),
    startsAt: Instant,
    endsAt: Instant,
    reason: ReasonText,
  })
  .refine((value) => value.delegatorUserId !== value.delegateUserId, {
    message: issue('DELEGATE_SAME_AS_DELEGATOR', 'A person cannot delegate to themselves.'),
    path: ['delegateUserId'],
  })
  .refine((value) => Date.parse(value.endsAt) > Date.parse(value.startsAt), {
    message: issue('DELEGATION_DATES_INVALID', 'The end must be after the start.'),
    path: ['endsAt'],
  });
export type CreateDelegationBody = z.infer<typeof CreateDelegationBody>;

export const createDelegation = defineEndpoint({
  id: 'buyer.admin.delegations.create',
  method: 'POST',
  path: '/api/v1/buyer/admin/delegations',
  audience: 'buyer',
  permission: 'org.authority.manage',
  body: CreateDelegationBody,
  response: DelegationRow,
  idempotent: true,
  errors: [
    'DELEGATION_EXCEEDS_LIMIT',
    'DELEGATION_EXCEEDS_SCOPE',
    'DELEGATOR_HAS_NO_AUTHORITY',
    'DELEGATE_NOT_ACTIVE',
    'DELEGATE_CONFLICT',
    'SELF_DELEGATION_FORBIDDEN',
    'CURRENCY_NOT_ACCEPTED',
  ],
  screens: ['ADM-05'],
  summary:
    'Delegates named decisions for fixed dates, capped at the delegator’s own authority: amount, legal entity, category (or a descendant) and validity window (BR-06).',
});

export const DelegationParams = z.object({ delegationId: IdParam });

export const revokeDelegation = defineEndpoint({
  id: 'buyer.admin.delegations.revoke',
  method: 'POST',
  path: '/api/v1/buyer/admin/delegations/:delegationId/revoke',
  audience: 'buyer',
  permission: 'org.authority.manage',
  params: DelegationParams,
  body: z.object({ reason: ReasonText }),
  response: DelegationRow,
  errors: ['DELEGATION_ALREADY_ENDED'],
  screens: ['ADM-05', 'ADM-03'],
});

// ---------------------------------------------------------------------------------------------------------
// Committees
// ---------------------------------------------------------------------------------------------------------

export const CommitteeRow = z.object({
  committeeId: Id,
  name: z.string().min(1),
  purpose: CommitteesPurpose,
  quorum: z.number().int().min(1),
  legalEntity: NamedRef.nullable(),
  active: z.boolean(),
  chair: PersonRef.nullable(),
  /** Every live seat: chair, members, alternates and the secretary. */
  activeMemberCount: z.number().int().min(0),
  /** Live seats that vote (chair and members); these count towards the quorum. */
  votingMemberCount: z.number().int().min(0),
  alternateCount: z.number().int().min(0),
  /** Active voting members (chair + members) reach the quorum. */
  quorumMet: z.boolean(),
});
export type CommitteeRow = z.infer<typeof CommitteeRow>;

export const COMMITTEE_SORTS = ['name', 'purpose', 'quorum'] as const;

export const CommitteeListQuery = listQueryWithSort(COMMITTEE_SORTS).extend({
  purpose: queryList(CommitteesPurpose).optional(),
  active: QueryBoolean.optional(),
});

export const listCommittees = defineEndpoint({
  id: 'buyer.admin.committees.list',
  method: 'GET',
  path: '/api/v1/buyer/admin/committees',
  audience: 'buyer',
  permission: ['org.authority.manage', 'org.structure.manage'],
  query: CommitteeListQuery,
  response: pageOf(CommitteeRow),
  errors: [],
  screens: ['ADM-05'],
});

export const CommitteeMemberRow = z.object({
  memberId: Id,
  person: PersonRef,
  capacity: z.string().nullable(),
  memberRole: CommitteeMembersMemberRole,
  startsAt: Instant,
  endsAt: Instant.nullable(),
  status: AccessItemStatus,
});
export type CommitteeMemberRow = z.infer<typeof CommitteeMemberRow>;

export const CommitteeDetail = CommitteeRow.extend({
  members: z.array(CommitteeMemberRow),
  authorityLimits: z.array(AuthorityLimitRow),
  deactivatedAt: Instant.nullable(),
});
export type CommitteeDetail = z.infer<typeof CommitteeDetail>;

export const CommitteeParams = z.object({ committeeId: IdParam });

export const getCommittee = defineEndpoint({
  id: 'buyer.admin.committees.get',
  method: 'GET',
  path: '/api/v1/buyer/admin/committees/:committeeId',
  audience: 'buyer',
  permission: ['org.authority.manage', 'org.structure.manage'],
  params: CommitteeParams,
  response: CommitteeDetail,
  errors: [],
  screens: ['ADM-05'],
});

export const CreateCommitteeBody = z.object({
  name: z.string().trim().min(3, issue('NAME_REQUIRED', 'At least 3 characters.')).max(200),
  purpose: CommitteesPurpose,
  quorum: z.number().int().min(1, issue('QUORUM_INVALID', 'At least 1.')).max(25, issue('QUORUM_INVALID', 'At most 25.')),
  legalEntityId: Id.nullable(),
});
export type CreateCommitteeBody = z.infer<typeof CreateCommitteeBody>;

export const createCommittee = defineEndpoint({
  id: 'buyer.admin.committees.create',
  method: 'POST',
  path: '/api/v1/buyer/admin/committees',
  audience: 'buyer',
  permission: 'org.authority.manage',
  body: CreateCommitteeBody,
  response: CommitteeDetail,
  idempotent: true,
  errors: ['COMMITTEE_NAME_TAKEN', 'SCOPE_NOT_FOUND'],
  screens: ['ADM-05'],
});

export const AddCommitteeMemberBody = z
  .object({
    userId: Id,
    memberRole: CommitteeMembersMemberRole,
    startsAt: Instant,
    endsAt: Instant.nullable(),
  })
  .refine((value) => value.endsAt === null || Date.parse(value.endsAt) > Date.parse(value.startsAt), {
    message: issue('MEMBER_DATES_INVALID', 'The end must be after the start.'),
    path: ['endsAt'],
  });
export type AddCommitteeMemberBody = z.infer<typeof AddCommitteeMemberBody>;

export const addCommitteeMember = defineEndpoint({
  id: 'buyer.admin.committees.addMember',
  method: 'POST',
  path: '/api/v1/buyer/admin/committees/:committeeId/members',
  audience: 'buyer',
  permission: 'org.authority.manage',
  params: CommitteeParams,
  body: AddCommitteeMemberBody,
  response: CommitteeDetail,
  errors: ['ALREADY_COMMITTEE_MEMBER', 'CHAIR_ALREADY_ASSIGNED', 'USER_NOT_ACTIVE', 'COMMITTEE_INACTIVE'],
  screens: ['ADM-05'],
});

export const CommitteeMemberParams = z.object({ committeeId: IdParam, memberId: IdParam });

export const endCommitteeMember = defineEndpoint({
  id: 'buyer.admin.committees.endMember',
  method: 'POST',
  path: '/api/v1/buyer/admin/committees/:committeeId/members/:memberId/end',
  audience: 'buyer',
  permission: 'org.authority.manage',
  params: CommitteeMemberParams,
  body: z.object({ reason: ReasonText }),
  response: CommitteeDetail,
  errors: ['MEMBER_ALREADY_ENDED', 'QUORUM_WOULD_BREAK'],
  screens: ['ADM-05'],
});

export const deactivateCommittee = defineEndpoint({
  id: 'buyer.admin.committees.deactivate',
  method: 'POST',
  path: '/api/v1/buyer/admin/committees/:committeeId/deactivate',
  audience: 'buyer',
  permission: 'org.authority.manage',
  params: CommitteeParams,
  body: z.object({ reason: ReasonText }),
  response: CommitteeDetail,
  errors: ['COMMITTEE_INACTIVE', 'COMMITTEE_HAS_OPEN_WORK'],
  screens: ['ADM-05'],
  summary: 'Deactivates a committee; it stays interpretable on historical decisions.',
});
