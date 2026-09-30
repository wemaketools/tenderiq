/**
 * Org-admin contract, member administration shared by buyers (ADM-03 users, ADM-04 roles and groups) and suppliers
 * (SUP-04 members, groups and roles). The same screens serve `/buyer/admin/*` and `/supplier/admin/*`, so every
 * endpoint below is defined once per audience by `memberAdminEndpoints(audience)`:
 *
 * - buyer: `org.users.view` to read the directory, `org.users.manage` for lifecycle commands, `org.roles.manage`
 *   for roles, groups and role assignments (`org.access.review` may read them);
 * - supplier: `supplier.users.manage` for everything (the supplier administrator).
 *
 * Rules the contract carries (FR-03, PRD §4.2, BR-38, AC-03, AC-04):
 * - grantable roles depend on the tenant kind: a supplier administrator never sees or assigns a buyer permission
 *   (`ROLE_NOT_GRANTABLE`, `PERMISSION_WRONG_TENANT_KIND`); `support.view` is never grantable;
 * - nobody assigns a role to themselves or raises their own authority (`SELF_GRANT_FORBIDDEN`);
 * - lifecycle: invited → pending → active ↔ suspended → deactivated; expired invitations are reissued without a new
 *   identity; deactivation shows open work to reassign and delegations to review, and history stays attributed;
 * - the last active administrator cannot be suspended, deactivated or stripped of the administrator role.
 *
 * Pure module: zod and sibling contract files only.
 */
import { z } from 'zod';

import {
  CalendarDate,
  Id,
  IdParam,
  Instant,
  Money,
  PersonRef,
  QueryBoolean,
  ReasonText,
  issue,
  listQueryWithSort,
  pageOf,
  queryList,
} from '../common.js';
import { defineEndpoint } from '../endpoint.js';
import type { EndpointPermission } from '../endpoint.js';
import { AuthorityLimitsDecisionType, InvitationsStatus, MembershipsStatus, UsersStatus } from '../enums.js';
import { PermissionCodeSchema, RoleTemplateCode } from '../permissions.js';
import { AccessGrantRow, AccessRestrictionRow } from './access.js';
import { DelegationRow } from './authority.js';
import {
  AccessItemStatus,
  AccessScope,
  AccessScopeInput,
  AttributedRecord,
  GroupSummaryRef,
  ReassignmentInput,
  RoleAssignmentRow,
  RoleRef,
  WorkItem,
} from './shared.js';
import { TenderAssignmentRow } from './supplier.js';

// ---------------------------------------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------------------------------------

/** Lifecycle actions the caller may take on a member now (the SPA shows only these). */
export const MEMBER_ACTIONS = [
  'edit',
  'assignRole',
  'activate',
  'approveMembership',
  'rejectMembership',
  'suspend',
  'deactivate',
  'recover',
  'reassignWork',
] as const;
export const MemberAction = z.enum(MEMBER_ACTIONS);
export type MemberAction = z.infer<typeof MemberAction>;

export const InvitationStateRef = z.object({
  invitationId: Id,
  /** Stored status, with `pending` past expiry reported as `expired` (DD-18). */
  status: InvitationsStatus,
  expiresAt: Instant,
});
export type InvitationStateRef = z.infer<typeof InvitationStateRef>;

/** Supplier-only authority summary on a member row (SUP-04, AC-03). `null` in buyer organizations. */
export const MemberSupplierAuthority = z.object({
  canSubmit: z.boolean(),
  canApprove: z.boolean(),
  canPrice: z.boolean(),
  signingLimit: Money.nullable(),
});
export type MemberSupplierAuthority = z.infer<typeof MemberSupplierAuthority>;

export const MemberRow = z.object({
  userId: Id,
  membershipId: Id,
  fullName: z.string().min(1),
  email: z.email(),
  capacity: z.string().nullable(),
  membershipStatus: MembershipsStatus,
  userStatus: UsersStatus,
  roles: z.array(RoleRef),
  groups: z.array(GroupSummaryRef),
  joinedAt: Instant.nullable(),
  lastSeenAt: Instant.nullable(),
  openWorkCount: z.number().int().min(0),
  activeDelegationCount: z.number().int().min(0),
  invitation: InvitationStateRef.nullable(),
  supplierAuthority: MemberSupplierAuthority.nullable(),
});
export type MemberRow = z.infer<typeof MemberRow>;

export const MEMBER_SORTS = ['fullName', 'status', 'joinedAt', 'lastSeenAt', 'openWorkCount'] as const;

export const MemberListQuery = listQueryWithSort(MEMBER_SORTS).extend({
  status: queryList(MembershipsStatus).optional(),
  roleId: IdParam.optional(),
  groupId: IdParam.optional(),
  hasOpenWork: QueryBoolean.optional(),
  joinedFrom: CalendarDate.optional(),
  joinedTo: CalendarDate.optional(),
});

export const MemberAuthorityLimit = z.object({
  limitId: Id,
  decisionType: AuthorityLimitsDecisionType,
  maxAmount: Money.nullable(),
  effectiveFrom: Instant,
  effectiveTo: Instant.nullable(),
  status: AccessItemStatus,
});

export const InvitationRow = z.object({
  invitationId: Id,
  email: z.email(),
  fullName: z.string().nullable(),
  capacity: z.string().nullable(),
  roles: z.array(RoleRef),
  /** Stored status, with `pending` past expiry reported as `expired` (DD-18). */
  status: InvitationsStatus,
  expiresAt: Instant,
  sentCount: z.number().int().min(0),
  invitedBy: PersonRef.nullable(),
  createdAt: Instant,
  acceptedAt: Instant.nullable(),
  reissuedFromId: Id.nullable(),
  reissuedToId: Id.nullable(),
  canReissue: z.boolean(),
  canRevoke: z.boolean(),
});
export type InvitationRow = z.infer<typeof InvitationRow>;

export const MemberDetail = MemberRow.extend({
  endedAt: Instant.nullable(),
  endReason: z.string().nullable(),
  roleAssignments: z.array(RoleAssignmentRow),
  directGrants: z.array(AccessGrantRow),
  restrictions: z.array(AccessRestrictionRow),
  delegationsGiven: z.array(DelegationRow),
  delegationsReceived: z.array(DelegationRow),
  authorityLimits: z.array(MemberAuthorityLimit),
  openWork: z.array(WorkItem),
  invitations: z.array(InvitationRow),
  tenderAssignments: z.array(TenderAssignmentRow),
  attributedHistory: z.array(AttributedRecord),
  availableActions: z.array(MemberAction),
});
export type MemberDetail = z.infer<typeof MemberDetail>;

export const MemberParams = z.object({ userId: IdParam });

export const UpdateMemberBody = z.object({
  capacity: z.string().trim().min(2, issue('CAPACITY_REQUIRED', 'Describe the capacity, such as Procurement Officer.')).max(200),
});

export const InviteMemberBody = z.object({
  email: z.email(issue('INVALID_EMAIL', 'Enter a valid e-mail address.')).transform((value) => value.toLowerCase()),
  fullName: z.string().trim().min(2, issue('NAME_REQUIRED', 'Enter the person’s name.')).max(200),
  capacity: z.string().trim().min(2, issue('CAPACITY_REQUIRED', 'Describe the capacity, such as Procurement Officer.')).max(200),
  roleIds: z.array(Id).min(1, issue('ROLE_REQUIRED', 'Choose at least one role.')),
  groupIds: z.array(Id),
  expiresInDays: z.number().int().min(1, issue('EXPIRY_INVALID', 'At least 1 day.')).max(30, issue('EXPIRY_INVALID', 'At most 30 days.')),
  message: z.string().trim().max(2000).nullable(),
});
export type InviteMemberBody = z.infer<typeof InviteMemberBody>;

export const INVITATION_SORTS = ['createdAt', 'expiresAt', 'email', 'status'] as const;

export const InvitationListQuery = listQueryWithSort(INVITATION_SORTS).extend({
  status: queryList(InvitationsStatus).optional(),
  createdFrom: CalendarDate.optional(),
  createdTo: CalendarDate.optional(),
});

export const InvitationParams = z.object({ invitationId: IdParam });

export const ReissueInvitationBody = z.object({
  expiresInDays: z.number().int().min(1, issue('EXPIRY_INVALID', 'At least 1 day.')).max(30, issue('EXPIRY_INVALID', 'At most 30 days.')),
});

export const LifecycleReasonBody = z.object({ reason: ReasonText });

export const SuspendMemberBody = z.object({
  reason: ReasonText,
  /** Planned end of the suspension (display only; reactivation is an explicit action). */
  until: Instant.nullable(),
});

export const ApproveMembershipBody = z.object({
  capacity: z.string().trim().min(2, issue('CAPACITY_REQUIRED', 'Describe the capacity.')).max(200),
  roleIds: z.array(Id).min(1, issue('ROLE_REQUIRED', 'Choose at least one role.')),
});

export const LifecycleEffects = z.object({
  reassignedWorkItems: z.number().int().min(0),
  endedDelegations: z.number().int().min(0),
  endedGrants: z.number().int().min(0),
  endedRoleAssignments: z.number().int().min(0),
  /** Records that stay attributed to the person (BR-38). */
  retainedHistoryRecords: z.number().int().min(0),
});
export type LifecycleEffects = z.infer<typeof LifecycleEffects>;

export const LifecycleResult = z.object({
  member: MemberRow,
  effects: LifecycleEffects,
});
export type LifecycleResult = z.infer<typeof LifecycleResult>;

export const DeactivationBlocker = z.object({
  code: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
  message: z.string().min(1),
});

export const ReassignmentCandidate = PersonRef.extend({ capacity: z.string().nullable() });

export const DeactivationReview = z.object({
  member: MemberRow,
  openWork: z.array(WorkItem),
  delegationsGiven: z.array(DelegationRow),
  delegationsReceived: z.array(DelegationRow),
  activeGrants: z.array(AccessGrantRow),
  activeRoleAssignments: z.number().int().min(0),
  tenderAssignments: z.array(TenderAssignmentRow),
  attributedHistory: z.array(AttributedRecord),
  blockers: z.array(DeactivationBlocker),
  candidates: z.array(ReassignmentCandidate),
});
export type DeactivationReview = z.infer<typeof DeactivationReview>;

export const DeactivateMemberBody = z.object({
  reason: ReasonText,
  reassignments: z.array(ReassignmentInput),
  confirmDelegationsReviewed: z.literal(true, {
    error: issue('CONFIRMATION_REQUIRED', 'Confirm that the delegations were reviewed.'),
  }),
  confirmHistoryRetained: z.literal(true, {
    error: issue('CONFIRMATION_REQUIRED', 'Confirm that past actions stay attributed.'),
  }),
});
export type DeactivateMemberBody = z.infer<typeof DeactivateMemberBody>;

export const ReassignWorkBody = z.object({
  reason: ReasonText,
  reassignments: z.array(ReassignmentInput).min(1, issue('REASSIGNMENT_REQUIRED', 'Choose at least one item.')),
});
export type ReassignWorkBody = z.infer<typeof ReassignWorkBody>;

export const RecoverMembershipBody = z.object({
  reason: ReasonText,
  roleIds: z.array(Id).min(1, issue('ROLE_REQUIRED', 'Choose at least one role.')),
});

export const AddRoleAssignmentBody = z
  .object({
    roleId: Id,
    scope: AccessScopeInput,
    startsAt: Instant.nullable(),
    endsAt: Instant.nullable(),
    reason: ReasonText,
  })
  .refine(
    (value) => value.endsAt === null || value.startsAt === null || Date.parse(value.endsAt) > Date.parse(value.startsAt),
    { message: issue('ASSIGNMENT_DATES_INVALID', 'The end must be after the start.'), path: ['endsAt'] },
  );
export type AddRoleAssignmentBody = z.infer<typeof AddRoleAssignmentBody>;

export const RoleAssignmentParams = z.object({ userId: IdParam, assignmentId: IdParam });

// Roles

export const RoleRow = z.object({
  roleId: Id,
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable(),
  templateCode: RoleTemplateCode.nullable(),
  isSystem: z.boolean(),
  active: z.boolean(),
  deactivatedAt: Instant.nullable(),
  permissionCount: z.number().int().min(0),
  activeAssignmentCount: z.number().int().min(0),
});
export type RoleRow = z.infer<typeof RoleRow>;

export const ROLE_SORTS = ['name', 'code', 'activeAssignmentCount'] as const;

export const RoleListQuery = listQueryWithSort(ROLE_SORTS).extend({
  active: QueryBoolean.optional(),
  isSystem: QueryBoolean.optional(),
});

export const PermissionInfo = z.object({
  code: PermissionCodeSchema,
  category: z.string().min(1),
  description: z.string().min(1),
});
export type PermissionInfo = z.infer<typeof PermissionInfo>;

export const RoleHolder = z.object({
  assignmentId: Id,
  holderKind: z.enum(['user', 'group']),
  holderId: Id,
  holderName: z.string().min(1),
  scope: AccessScope,
  status: AccessItemStatus,
});

export const RoleDetail = RoleRow.extend({
  permissions: z.array(PermissionInfo),
  holders: z.array(RoleHolder),
  /** Enforced SoD rules whose two permissions this role combines (buyer organizations). */
  sodWarnings: z.array(z.object({ ruleCode: z.string().min(1), permissions: z.array(PermissionCodeSchema) })),
});
export type RoleDetail = z.infer<typeof RoleDetail>;

export const RoleParams = z.object({ roleId: IdParam });

export const RoleTemplateInfo = z.object({
  code: RoleTemplateCode,
  name: z.string().min(1),
  description: z.string().min(1),
  permissionCodes: z.array(PermissionCodeSchema),
});

/** What the caller's organization may grant: templates and permissions of its own tenant kind only. */
export const RoleCatalog = z.object({
  templates: z.array(RoleTemplateInfo),
  permissions: z.array(PermissionInfo),
});
export type RoleCatalog = z.infer<typeof RoleCatalog>;

const RoleCode = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9_]{2,40}$/, issue('INVALID_ROLE_CODE', 'Use lowercase letters, digits and underscores.'));

export const CreateRoleBody = z.object({
  code: RoleCode,
  name: z.string().trim().min(3, issue('NAME_REQUIRED', 'At least 3 characters.')).max(120),
  description: z.string().trim().max(2000).nullable(),
  permissionCodes: z.array(PermissionCodeSchema).min(1, issue('PERMISSION_REQUIRED', 'Choose at least one permission.')),
});
export type CreateRoleBody = z.infer<typeof CreateRoleBody>;

export const UpdateRoleBody = z.object({
  name: z.string().trim().min(3, issue('NAME_REQUIRED', 'At least 3 characters.')).max(120),
  description: z.string().trim().max(2000).nullable(),
  permissionCodes: z.array(PermissionCodeSchema).min(1, issue('PERMISSION_REQUIRED', 'Choose at least one permission.')),
});
export type UpdateRoleBody = z.infer<typeof UpdateRoleBody>;

// Groups

export const GroupRow = z.object({
  groupId: Id,
  name: z.string().min(1),
  description: z.string().nullable(),
  active: z.boolean(),
  memberCount: z.number().int().min(0),
  roles: z.array(RoleRef),
  createdAt: Instant,
});
export type GroupRow = z.infer<typeof GroupRow>;

export const GROUP_SORTS = ['name', 'memberCount', 'createdAt'] as const;

export const GroupListQuery = listQueryWithSort(GROUP_SORTS).extend({
  active: QueryBoolean.optional(),
});

export const GroupMemberRow = PersonRef.extend({
  capacity: z.string().nullable(),
  addedAt: Instant,
  addedBy: PersonRef.nullable(),
});

export const GroupDetail = GroupRow.extend({
  members: z.array(GroupMemberRow),
  roleAssignments: z.array(RoleHolder.omit({ holderKind: true, holderId: true, holderName: true }).extend({ role: RoleRef })),
  deactivatedAt: Instant.nullable(),
});
export type GroupDetail = z.infer<typeof GroupDetail>;

export const GroupParams = z.object({ groupId: IdParam });
export const GroupMemberParams = z.object({ groupId: IdParam, userId: IdParam });

export const AddGroupMemberBody = z.object({ userId: Id });

export const CreateGroupBody = z.object({
  name: z.string().trim().min(3, issue('NAME_REQUIRED', 'At least 3 characters.')).max(120),
  description: z.string().trim().max(2000).nullable(),
});

// ---------------------------------------------------------------------------------------------------------
// Endpoints per audience
// ---------------------------------------------------------------------------------------------------------

type AdminAudience = 'buyer' | 'supplier';

interface AudiencePermissions {
  readonly view: EndpointPermission;
  readonly manage: EndpointPermission;
  readonly rolesView: EndpointPermission;
  readonly rolesManage: EndpointPermission;
}

const AUDIENCE_PERMISSIONS: Record<AdminAudience, AudiencePermissions> = {
  buyer: {
    view: ['org.users.view', 'org.users.manage'],
    manage: 'org.users.manage',
    rolesView: ['org.roles.manage', 'org.access.review', 'org.users.manage'],
    rolesManage: 'org.roles.manage',
  },
  supplier: {
    view: 'supplier.users.manage',
    manage: 'supplier.users.manage',
    rolesView: 'supplier.users.manage',
    rolesManage: 'supplier.users.manage',
  },
};

const SCREENS: Record<AdminAudience, { users: 'ADM-03' | 'SUP-04'; roles: 'ADM-04' | 'SUP-04' }> = {
  buyer: { users: 'ADM-03', roles: 'ADM-04' },
  supplier: { users: 'SUP-04', roles: 'SUP-04' },
};

/** Every member-administration endpoint of one audience. */
export function memberAdminEndpoints<const A extends AdminAudience>(audience: A) {
  const base = `/api/v1/${audience}/admin` as const;
  const permissions = AUDIENCE_PERMISSIONS[audience];
  const users = SCREENS[audience].users;
  const roles = SCREENS[audience].roles;
  return {
    listMembers: defineEndpoint({
      id: `${audience}.admin.users.list`,
      method: 'GET',
      path: `${base}/users`,
      audience,
      permission: permissions.view,
      query: MemberListQuery,
      response: pageOf(MemberRow),
      errors: [],
      screens: [users],
      summary: 'Members with capacity, roles, groups, status, invitation state and outstanding work.',
    }),
    getMember: defineEndpoint({
      id: `${audience}.admin.users.get`,
      method: 'GET',
      path: `${base}/users/:userId`,
      audience,
      permission: permissions.view,
      params: MemberParams,
      response: MemberDetail,
      errors: [],
      screens: [users],
    }),
    updateMember: defineEndpoint({
      id: `${audience}.admin.users.update`,
      method: 'PATCH',
      path: `${base}/users/:userId`,
      audience,
      permission: permissions.manage,
      params: MemberParams,
      body: UpdateMemberBody,
      response: MemberRow,
      errors: ['USER_DEACTIVATED'],
      screens: [users],
    }),
    inviteMember: defineEndpoint({
      id: `${audience}.admin.invitations.create`,
      method: 'POST',
      path: `${base}/invitations`,
      audience,
      permission: permissions.manage,
      body: InviteMemberBody,
      response: InvitationRow,
      idempotent: true,
      errors: ['ALREADY_MEMBER', 'INVITATION_ALREADY_PENDING', 'ROLE_NOT_GRANTABLE', 'GROUP_NOT_FOUND'],
      screens: [users],
      summary: 'Invites a person with a capacity and roles of this organization’s kind only.',
    }),
    listInvitations: defineEndpoint({
      id: `${audience}.admin.invitations.list`,
      method: 'GET',
      path: `${base}/invitations`,
      audience,
      permission: permissions.view,
      query: InvitationListQuery,
      response: pageOf(InvitationRow),
      errors: [],
      screens: [users],
    }),
    reissueInvitation: defineEndpoint({
      id: `${audience}.admin.invitations.reissue`,
      method: 'POST',
      path: `${base}/invitations/:invitationId/reissue`,
      audience,
      permission: permissions.manage,
      params: InvitationParams,
      body: ReissueInvitationBody,
      response: InvitationRow,
      errors: ['INVITATION_NOT_REISSUABLE'],
      screens: [users],
      summary: 'Issues a fresh link for an expired, failed or pending invitation, without a new identity (FR-03).',
    }),
    revokeInvitation: defineEndpoint({
      id: `${audience}.admin.invitations.revoke`,
      method: 'POST',
      path: `${base}/invitations/:invitationId/revoke`,
      audience,
      permission: permissions.manage,
      params: InvitationParams,
      body: LifecycleReasonBody,
      response: InvitationRow,
      errors: ['INVITATION_NOT_REVOCABLE'],
      screens: [users],
    }),
    activateMember: defineEndpoint({
      id: `${audience}.admin.users.activate`,
      method: 'POST',
      path: `${base}/users/:userId/activate`,
      audience,
      permission: permissions.manage,
      params: MemberParams,
      body: LifecycleReasonBody,
      response: LifecycleResult,
      errors: ['MEMBER_NOT_SUSPENDED', 'CANNOT_CHANGE_OWN_STATUS'],
      screens: [users],
      summary: 'Lifts a suspension.',
    }),
    approveMembership: defineEndpoint({
      id: `${audience}.admin.users.approveMembership`,
      method: 'POST',
      path: `${base}/users/:userId/approve-membership`,
      audience,
      permission: permissions.manage,
      params: MemberParams,
      body: ApproveMembershipBody,
      response: LifecycleResult,
      errors: ['MEMBERSHIP_NOT_PENDING', 'ROLE_NOT_GRANTABLE'],
      screens: [users],
      summary: 'Approves a pending membership request with a capacity and roles.',
    }),
    rejectMembership: defineEndpoint({
      id: `${audience}.admin.users.rejectMembership`,
      method: 'POST',
      path: `${base}/users/:userId/reject-membership`,
      audience,
      permission: permissions.manage,
      params: MemberParams,
      body: LifecycleReasonBody,
      response: LifecycleResult,
      errors: ['MEMBERSHIP_NOT_PENDING'],
      screens: [users],
    }),
    suspendMember: defineEndpoint({
      id: `${audience}.admin.users.suspend`,
      method: 'POST',
      path: `${base}/users/:userId/suspend`,
      audience,
      permission: permissions.manage,
      params: MemberParams,
      body: SuspendMemberBody,
      response: LifecycleResult,
      errors: ['MEMBER_NOT_ACTIVE', 'CANNOT_CHANGE_OWN_STATUS', 'LAST_ADMINISTRATOR'],
      screens: [users],
      summary: 'Suspends access at once; work stays assigned and history stays attributed.',
    }),
    getDeactivationReview: defineEndpoint({
      id: `${audience}.admin.users.deactivationReview`,
      method: 'GET',
      path: `${base}/users/:userId/deactivation-review`,
      audience,
      permission: permissions.manage,
      params: MemberParams,
      response: DeactivationReview,
      errors: [],
      screens: [users],
      summary: 'Open work to reassign, delegations and grants to review, and the history that stays attributed.',
    }),
    deactivateMember: defineEndpoint({
      id: `${audience}.admin.users.deactivate`,
      method: 'POST',
      path: `${base}/users/:userId/deactivate`,
      audience,
      permission: permissions.manage,
      params: MemberParams,
      body: DeactivateMemberBody,
      response: LifecycleResult,
      errors: [
        'OPEN_WORK_NOT_REASSIGNED',
        'REASSIGNEE_NOT_ELIGIBLE',
        'CANNOT_CHANGE_OWN_STATUS',
        'LAST_ADMINISTRATOR',
        'MEMBER_ALREADY_DEACTIVATED',
      ],
      screens: [users],
      summary:
        'Ends access, reassigns open work and ends delegations and grants. Submissions, approvals and contracts are untouched (BR-38).',
    }),
    reassignWork: defineEndpoint({
      id: `${audience}.admin.users.reassignWork`,
      method: 'POST',
      path: `${base}/users/:userId/reassign-work`,
      audience,
      permission: permissions.manage,
      params: MemberParams,
      body: ReassignWorkBody,
      response: LifecycleResult,
      errors: ['REASSIGNEE_NOT_ELIGIBLE', 'WORK_ITEM_NOT_OPEN'],
      screens: [users],
      summary: 'Moves open responsibilities of a member (for example a leaver) to other active members (AC-04).',
    }),
    recoverMembership: defineEndpoint({
      id: `${audience}.admin.users.recover`,
      method: 'POST',
      path: `${base}/users/:userId/recover`,
      audience,
      permission: permissions.manage,
      params: MemberParams,
      body: RecoverMembershipBody,
      response: LifecycleResult,
      errors: ['MEMBERSHIP_NOT_REVOKED', 'USER_DEACTIVATED', 'ROLE_NOT_GRANTABLE'],
      screens: [users],
      summary: 'Restores a revoked membership of a still-active person (a deactivated person is invited again).',
    }),
    addRoleAssignment: defineEndpoint({
      id: `${audience}.admin.users.addRole`,
      method: 'POST',
      path: `${base}/users/:userId/role-assignments`,
      audience,
      permission: permissions.rolesManage,
      params: MemberParams,
      body: AddRoleAssignmentBody,
      response: RoleAssignmentRow,
      idempotent: true,
      errors: [
        'ROLE_NOT_GRANTABLE',
        'SELF_GRANT_FORBIDDEN',
        'SCOPE_NOT_FOUND',
        'ROLE_ALREADY_ASSIGNED',
        'USER_NOT_ACTIVE',
        'SOD_CONFLICT',
      ],
      screens: [users, roles],
    }),
    revokeRoleAssignment: defineEndpoint({
      id: `${audience}.admin.users.revokeRole`,
      method: 'POST',
      path: `${base}/users/:userId/role-assignments/:assignmentId/revoke`,
      audience,
      permission: permissions.rolesManage,
      params: RoleAssignmentParams,
      body: LifecycleReasonBody,
      response: RoleAssignmentRow,
      errors: ['ASSIGNMENT_ALREADY_ENDED', 'LAST_ADMINISTRATOR', 'ASSIGNMENT_VIA_GROUP'],
      screens: [users, roles],
    }),
    listRoles: defineEndpoint({
      id: `${audience}.admin.roles.list`,
      method: 'GET',
      path: `${base}/roles`,
      audience,
      permission: permissions.rolesView,
      query: RoleListQuery,
      response: pageOf(RoleRow),
      errors: [],
      screens: [roles],
    }),
    getRole: defineEndpoint({
      id: `${audience}.admin.roles.get`,
      method: 'GET',
      path: `${base}/roles/:roleId`,
      audience,
      permission: permissions.rolesView,
      params: RoleParams,
      response: RoleDetail,
      errors: [],
      screens: [roles],
    }),
    getRoleCatalog: defineEndpoint({
      id: `${audience}.admin.roles.catalog`,
      method: 'GET',
      path: `${base}/role-catalog`,
      audience,
      permission: permissions.rolesView,
      response: RoleCatalog,
      errors: [],
      screens: [roles],
      summary: 'Role templates and permissions of this organization’s kind only; support access is never listed.',
    }),
    createRole: defineEndpoint({
      id: `${audience}.admin.roles.create`,
      method: 'POST',
      path: `${base}/roles`,
      audience,
      permission: permissions.rolesManage,
      body: CreateRoleBody,
      response: RoleDetail,
      idempotent: true,
      errors: ['ROLE_CODE_TAKEN', 'PERMISSION_WRONG_TENANT_KIND', 'PERMISSION_NOT_GRANTABLE', 'SOD_INCOMPATIBLE_PERMISSIONS'],
      screens: [roles],
    }),
    updateRole: defineEndpoint({
      id: `${audience}.admin.roles.update`,
      method: 'PUT',
      path: `${base}/roles/:roleId`,
      audience,
      permission: permissions.rolesManage,
      params: RoleParams,
      body: UpdateRoleBody,
      response: RoleDetail,
      errors: [
        'SYSTEM_ROLE_READ_ONLY',
        'ROLE_INACTIVE',
        'PERMISSION_WRONG_TENANT_KIND',
        'PERMISSION_NOT_GRANTABLE',
        'SOD_INCOMPATIBLE_PERMISSIONS',
      ],
      screens: [roles],
    }),
    deactivateRole: defineEndpoint({
      id: `${audience}.admin.roles.deactivate`,
      method: 'POST',
      path: `${base}/roles/:roleId/deactivate`,
      audience,
      permission: permissions.rolesManage,
      params: RoleParams,
      body: LifecycleReasonBody,
      response: RoleDetail,
      errors: ['SYSTEM_ROLE_READ_ONLY', 'ROLE_INACTIVE', 'ROLE_HAS_ACTIVE_ASSIGNMENTS'],
      screens: [roles],
    }),
    listGroups: defineEndpoint({
      id: `${audience}.admin.groups.list`,
      method: 'GET',
      path: `${base}/groups`,
      audience,
      permission: permissions.rolesView,
      query: GroupListQuery,
      response: pageOf(GroupRow),
      errors: [],
      screens: [roles],
    }),
    getGroup: defineEndpoint({
      id: `${audience}.admin.groups.get`,
      method: 'GET',
      path: `${base}/groups/:groupId`,
      audience,
      permission: permissions.rolesView,
      params: GroupParams,
      response: GroupDetail,
      errors: [],
      screens: [roles],
    }),
    createGroup: defineEndpoint({
      id: `${audience}.admin.groups.create`,
      method: 'POST',
      path: `${base}/groups`,
      audience,
      permission: permissions.rolesManage,
      body: CreateGroupBody,
      response: GroupDetail,
      idempotent: true,
      errors: ['GROUP_NAME_TAKEN'],
      screens: [roles],
    }),
    deactivateGroup: defineEndpoint({
      id: `${audience}.admin.groups.deactivate`,
      method: 'POST',
      path: `${base}/groups/:groupId/deactivate`,
      audience,
      permission: permissions.rolesManage,
      params: GroupParams,
      body: LifecycleReasonBody,
      response: GroupDetail,
      errors: ['GROUP_INACTIVE'],
      screens: [roles],
      summary: 'Deactivates a group; its role assignments end and past membership stays recorded.',
    }),
    addGroupMember: defineEndpoint({
      id: `${audience}.admin.groups.addMember`,
      method: 'POST',
      path: `${base}/groups/:groupId/members`,
      audience,
      permission: permissions.rolesManage,
      params: GroupParams,
      body: AddGroupMemberBody,
      response: GroupDetail,
      errors: ['GROUP_INACTIVE', 'ALREADY_GROUP_MEMBER', 'USER_NOT_ACTIVE', 'SELF_GRANT_FORBIDDEN'],
      screens: [roles],
    }),
    removeGroupMember: defineEndpoint({
      id: `${audience}.admin.groups.removeMember`,
      method: 'POST',
      path: `${base}/groups/:groupId/members/:userId/remove`,
      audience,
      permission: permissions.rolesManage,
      params: GroupMemberParams,
      body: LifecycleReasonBody,
      response: GroupDetail,
      errors: ['NOT_GROUP_MEMBER', 'LAST_ADMINISTRATOR'],
      screens: [roles],
    }),
  };
}

export const buyerMemberAdmin = memberAdminEndpoints('buyer');
export const supplierMemberAdmin = memberAdminEndpoints('supplier');

/** The member-administration endpoint set of either audience (same keys and schemas). */
export type MemberAdminEndpointSet = typeof buyerMemberAdmin | typeof supplierMemberAdmin;
