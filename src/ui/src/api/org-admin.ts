/**
 * Org-admin client (the `org-admin` contract; FR-01, FR-03, PRD §5.3, §5.4): invitation acceptance (COM-01),
 * memberships (COM-02), profile (COM-03), buyer organization, structure, users, roles, access review and authority
 * (ADM-01 … ADM-05) and supplier users and authority (SUP-04). Pages use the hooks with the contract endpoints
 * directly; these typed wrappers serve code outside hooks. The member-administration screens are shared by buyers
 * and suppliers: `memberAdminEndpointsFor(kind)` returns the endpoint set of the active tenant's kind.
 */
import { buyerMemberAdmin, orgAdminEndpoints, supplierMemberAdmin } from '@contracts/org-admin';
import type { EndpointRequest, EndpointResponse } from '@contracts/endpoint';

import { call } from './client';
import type { CallOptions } from './client';

type Endpoints = typeof orgAdminEndpoints;
/** The request (`params`, `query`, `body`) of an org-admin endpoint. */
export type OrgAdminRequest<K extends keyof Endpoints> = EndpointRequest<Endpoints[K]>;
/** The response of an org-admin endpoint. */
export type OrgAdminResponse<K extends keyof Endpoints> = EndpointResponse<Endpoints[K]>;

/** The member-administration endpoints (users, invitations, roles, groups) of either organization kind. */
export type MemberAdminEndpoints = typeof buyerMemberAdmin;

/**
 * The member-administration endpoint set for the active tenant's kind. Both sets have the same keys and schemas;
 * only the audience, path and permission differ, so one screen serves `/buyer/admin/*` and `/supplier/admin/*`.
 */
export function memberAdminEndpointsFor(kind: 'buyer' | 'supplier'): MemberAdminEndpoints {
  return kind === 'buyer'
    ? buyerMemberAdmin
    : (supplierMemberAdmin as unknown as MemberAdminEndpoints);
}

function send<K extends keyof Endpoints>(
  key: K,
  request: OrgAdminRequest<K>,
  options?: CallOptions,
): Promise<OrgAdminResponse<K>> {
  return call(orgAdminEndpoints[key], request, options);
}

/** GET /api/v1/public/invitations/:token (`public.invitations.preview`). */
export function previewInvitation(
  request: OrgAdminRequest<'previewInvitation'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'previewInvitation'>> {
  return send('previewInvitation', request, options);
}
/** POST /api/v1/me/invitations/:token/accept (`me.invitations.accept`). */
export function acceptInvitation(
  request: OrgAdminRequest<'acceptInvitation'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'acceptInvitation'>> {
  return send('acceptInvitation', request, options);
}
/** GET /api/v1/me/memberships (`me.memberships.list`). */
export function listMyMemberships(
  request: OrgAdminRequest<'listMyMemberships'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'listMyMemberships'>> {
  return send('listMyMemberships', request, options);
}
/** POST /api/v1/me/memberships/:membershipId/withdraw-request (`me.memberships.withdrawRequest`). */
export function withdrawMembershipRequest(
  request: OrgAdminRequest<'withdrawMembershipRequest'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'withdrawMembershipRequest'>> {
  return send('withdrawMembershipRequest', request, options);
}
/** POST /api/v1/me/memberships/:membershipId/leave (`me.memberships.leave`). */
export function leaveMembership(
  request: OrgAdminRequest<'leaveMembership'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'leaveMembership'>> {
  return send('leaveMembership', request, options);
}
/** GET /api/v1/me/profile (`me.profile.get`). */
export function getMyProfile(
  request: OrgAdminRequest<'getMyProfile'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'getMyProfile'>> {
  return send('getMyProfile', request, options);
}
/** PUT /api/v1/me/profile (`me.profile.update`). */
export function updateMyProfile(
  request: OrgAdminRequest<'updateMyProfile'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'updateMyProfile'>> {
  return send('updateMyProfile', request, options);
}
/** POST /api/v1/me/profile/contact-changes (`me.profile.requestContactChange`). Idempotent: pass `options.idempotencyKey` to retry safely. */
export function requestContactChange(
  request: OrgAdminRequest<'requestContactChange'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'requestContactChange'>> {
  return send('requestContactChange', request, options);
}
/** POST /api/v1/me/profile/contact-changes/:changeId/cancel (`me.profile.cancelContactChange`). */
export function cancelContactChange(
  request: OrgAdminRequest<'cancelContactChange'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'cancelContactChange'>> {
  return send('cancelContactChange', request, options);
}
/** GET /api/v1/me/access-summary (`me.profile.access`). */
export function getMyAccessSummary(
  request: OrgAdminRequest<'getMyAccessSummary'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'getMyAccessSummary'>> {
  return send('getMyAccessSummary', request, options);
}
/** GET /api/v1/buyer/admin/users (`buyer.admin.users.list`). */
export function buyerListMembers(
  request: OrgAdminRequest<'buyerListMembers'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'buyerListMembers'>> {
  return send('buyerListMembers', request, options);
}
/** GET /api/v1/buyer/admin/users/:userId (`buyer.admin.users.get`). */
export function buyerGetMember(
  request: OrgAdminRequest<'buyerGetMember'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'buyerGetMember'>> {
  return send('buyerGetMember', request, options);
}
/** PATCH /api/v1/buyer/admin/users/:userId (`buyer.admin.users.update`). */
export function buyerUpdateMember(
  request: OrgAdminRequest<'buyerUpdateMember'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'buyerUpdateMember'>> {
  return send('buyerUpdateMember', request, options);
}
/** POST /api/v1/buyer/admin/invitations (`buyer.admin.invitations.create`). Idempotent: pass `options.idempotencyKey` to retry safely. */
export function buyerInviteMember(
  request: OrgAdminRequest<'buyerInviteMember'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'buyerInviteMember'>> {
  return send('buyerInviteMember', request, options);
}
/** GET /api/v1/buyer/admin/invitations (`buyer.admin.invitations.list`). */
export function buyerListInvitations(
  request: OrgAdminRequest<'buyerListInvitations'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'buyerListInvitations'>> {
  return send('buyerListInvitations', request, options);
}
/** POST /api/v1/buyer/admin/invitations/:invitationId/reissue (`buyer.admin.invitations.reissue`). */
export function buyerReissueInvitation(
  request: OrgAdminRequest<'buyerReissueInvitation'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'buyerReissueInvitation'>> {
  return send('buyerReissueInvitation', request, options);
}
/** POST /api/v1/buyer/admin/invitations/:invitationId/revoke (`buyer.admin.invitations.revoke`). */
export function buyerRevokeInvitation(
  request: OrgAdminRequest<'buyerRevokeInvitation'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'buyerRevokeInvitation'>> {
  return send('buyerRevokeInvitation', request, options);
}
/** POST /api/v1/buyer/admin/users/:userId/activate (`buyer.admin.users.activate`). */
export function buyerActivateMember(
  request: OrgAdminRequest<'buyerActivateMember'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'buyerActivateMember'>> {
  return send('buyerActivateMember', request, options);
}
/** POST /api/v1/buyer/admin/users/:userId/approve-membership (`buyer.admin.users.approveMembership`). */
export function buyerApproveMembership(
  request: OrgAdminRequest<'buyerApproveMembership'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'buyerApproveMembership'>> {
  return send('buyerApproveMembership', request, options);
}
/** POST /api/v1/buyer/admin/users/:userId/reject-membership (`buyer.admin.users.rejectMembership`). */
export function buyerRejectMembership(
  request: OrgAdminRequest<'buyerRejectMembership'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'buyerRejectMembership'>> {
  return send('buyerRejectMembership', request, options);
}
/** POST /api/v1/buyer/admin/users/:userId/suspend (`buyer.admin.users.suspend`). */
export function buyerSuspendMember(
  request: OrgAdminRequest<'buyerSuspendMember'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'buyerSuspendMember'>> {
  return send('buyerSuspendMember', request, options);
}
/** GET /api/v1/buyer/admin/users/:userId/deactivation-review (`buyer.admin.users.deactivationReview`). */
export function buyerGetDeactivationReview(
  request: OrgAdminRequest<'buyerGetDeactivationReview'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'buyerGetDeactivationReview'>> {
  return send('buyerGetDeactivationReview', request, options);
}
/** POST /api/v1/buyer/admin/users/:userId/deactivate (`buyer.admin.users.deactivate`). */
export function buyerDeactivateMember(
  request: OrgAdminRequest<'buyerDeactivateMember'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'buyerDeactivateMember'>> {
  return send('buyerDeactivateMember', request, options);
}
/** POST /api/v1/buyer/admin/users/:userId/reassign-work (`buyer.admin.users.reassignWork`). */
export function buyerReassignWork(
  request: OrgAdminRequest<'buyerReassignWork'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'buyerReassignWork'>> {
  return send('buyerReassignWork', request, options);
}
/** POST /api/v1/buyer/admin/users/:userId/recover (`buyer.admin.users.recover`). */
export function buyerRecoverMembership(
  request: OrgAdminRequest<'buyerRecoverMembership'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'buyerRecoverMembership'>> {
  return send('buyerRecoverMembership', request, options);
}
/** POST /api/v1/buyer/admin/users/:userId/role-assignments (`buyer.admin.users.addRole`). Idempotent: pass `options.idempotencyKey` to retry safely. */
export function buyerAddRoleAssignment(
  request: OrgAdminRequest<'buyerAddRoleAssignment'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'buyerAddRoleAssignment'>> {
  return send('buyerAddRoleAssignment', request, options);
}
/** POST /api/v1/buyer/admin/users/:userId/role-assignments/:assignmentId/revoke (`buyer.admin.users.revokeRole`). */
export function buyerRevokeRoleAssignment(
  request: OrgAdminRequest<'buyerRevokeRoleAssignment'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'buyerRevokeRoleAssignment'>> {
  return send('buyerRevokeRoleAssignment', request, options);
}
/** GET /api/v1/buyer/admin/roles (`buyer.admin.roles.list`). */
export function buyerListRoles(
  request: OrgAdminRequest<'buyerListRoles'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'buyerListRoles'>> {
  return send('buyerListRoles', request, options);
}
/** GET /api/v1/buyer/admin/roles/:roleId (`buyer.admin.roles.get`). */
export function buyerGetRole(
  request: OrgAdminRequest<'buyerGetRole'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'buyerGetRole'>> {
  return send('buyerGetRole', request, options);
}
/** GET /api/v1/buyer/admin/role-catalog (`buyer.admin.roles.catalog`). */
export function buyerGetRoleCatalog(
  request: OrgAdminRequest<'buyerGetRoleCatalog'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'buyerGetRoleCatalog'>> {
  return send('buyerGetRoleCatalog', request, options);
}
/** POST /api/v1/buyer/admin/roles (`buyer.admin.roles.create`). Idempotent: pass `options.idempotencyKey` to retry safely. */
export function buyerCreateRole(
  request: OrgAdminRequest<'buyerCreateRole'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'buyerCreateRole'>> {
  return send('buyerCreateRole', request, options);
}
/** PUT /api/v1/buyer/admin/roles/:roleId (`buyer.admin.roles.update`). */
export function buyerUpdateRole(
  request: OrgAdminRequest<'buyerUpdateRole'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'buyerUpdateRole'>> {
  return send('buyerUpdateRole', request, options);
}
/** POST /api/v1/buyer/admin/roles/:roleId/deactivate (`buyer.admin.roles.deactivate`). */
export function buyerDeactivateRole(
  request: OrgAdminRequest<'buyerDeactivateRole'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'buyerDeactivateRole'>> {
  return send('buyerDeactivateRole', request, options);
}
/** GET /api/v1/buyer/admin/groups (`buyer.admin.groups.list`). */
export function buyerListGroups(
  request: OrgAdminRequest<'buyerListGroups'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'buyerListGroups'>> {
  return send('buyerListGroups', request, options);
}
/** GET /api/v1/buyer/admin/groups/:groupId (`buyer.admin.groups.get`). */
export function buyerGetGroup(
  request: OrgAdminRequest<'buyerGetGroup'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'buyerGetGroup'>> {
  return send('buyerGetGroup', request, options);
}
/** POST /api/v1/buyer/admin/groups (`buyer.admin.groups.create`). Idempotent: pass `options.idempotencyKey` to retry safely. */
export function buyerCreateGroup(
  request: OrgAdminRequest<'buyerCreateGroup'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'buyerCreateGroup'>> {
  return send('buyerCreateGroup', request, options);
}
/** POST /api/v1/buyer/admin/groups/:groupId/deactivate (`buyer.admin.groups.deactivate`). */
export function buyerDeactivateGroup(
  request: OrgAdminRequest<'buyerDeactivateGroup'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'buyerDeactivateGroup'>> {
  return send('buyerDeactivateGroup', request, options);
}
/** POST /api/v1/buyer/admin/groups/:groupId/members (`buyer.admin.groups.addMember`). */
export function buyerAddGroupMember(
  request: OrgAdminRequest<'buyerAddGroupMember'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'buyerAddGroupMember'>> {
  return send('buyerAddGroupMember', request, options);
}
/** POST /api/v1/buyer/admin/groups/:groupId/members/:userId/remove (`buyer.admin.groups.removeMember`). */
export function buyerRemoveGroupMember(
  request: OrgAdminRequest<'buyerRemoveGroupMember'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'buyerRemoveGroupMember'>> {
  return send('buyerRemoveGroupMember', request, options);
}
/** GET /api/v1/supplier/admin/users (`supplier.admin.users.list`). */
export function supplierListMembers(
  request: OrgAdminRequest<'supplierListMembers'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'supplierListMembers'>> {
  return send('supplierListMembers', request, options);
}
/** GET /api/v1/supplier/admin/users/:userId (`supplier.admin.users.get`). */
export function supplierGetMember(
  request: OrgAdminRequest<'supplierGetMember'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'supplierGetMember'>> {
  return send('supplierGetMember', request, options);
}
/** PATCH /api/v1/supplier/admin/users/:userId (`supplier.admin.users.update`). */
export function supplierUpdateMember(
  request: OrgAdminRequest<'supplierUpdateMember'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'supplierUpdateMember'>> {
  return send('supplierUpdateMember', request, options);
}
/** POST /api/v1/supplier/admin/invitations (`supplier.admin.invitations.create`). Idempotent: pass `options.idempotencyKey` to retry safely. */
export function supplierInviteMember(
  request: OrgAdminRequest<'supplierInviteMember'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'supplierInviteMember'>> {
  return send('supplierInviteMember', request, options);
}
/** GET /api/v1/supplier/admin/invitations (`supplier.admin.invitations.list`). */
export function supplierListInvitations(
  request: OrgAdminRequest<'supplierListInvitations'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'supplierListInvitations'>> {
  return send('supplierListInvitations', request, options);
}
/** POST /api/v1/supplier/admin/invitations/:invitationId/reissue (`supplier.admin.invitations.reissue`). */
export function supplierReissueInvitation(
  request: OrgAdminRequest<'supplierReissueInvitation'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'supplierReissueInvitation'>> {
  return send('supplierReissueInvitation', request, options);
}
/** POST /api/v1/supplier/admin/invitations/:invitationId/revoke (`supplier.admin.invitations.revoke`). */
export function supplierRevokeInvitation(
  request: OrgAdminRequest<'supplierRevokeInvitation'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'supplierRevokeInvitation'>> {
  return send('supplierRevokeInvitation', request, options);
}
/** POST /api/v1/supplier/admin/users/:userId/activate (`supplier.admin.users.activate`). */
export function supplierActivateMember(
  request: OrgAdminRequest<'supplierActivateMember'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'supplierActivateMember'>> {
  return send('supplierActivateMember', request, options);
}
/** POST /api/v1/supplier/admin/users/:userId/approve-membership (`supplier.admin.users.approveMembership`). */
export function supplierApproveMembership(
  request: OrgAdminRequest<'supplierApproveMembership'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'supplierApproveMembership'>> {
  return send('supplierApproveMembership', request, options);
}
/** POST /api/v1/supplier/admin/users/:userId/reject-membership (`supplier.admin.users.rejectMembership`). */
export function supplierRejectMembership(
  request: OrgAdminRequest<'supplierRejectMembership'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'supplierRejectMembership'>> {
  return send('supplierRejectMembership', request, options);
}
/** POST /api/v1/supplier/admin/users/:userId/suspend (`supplier.admin.users.suspend`). */
export function supplierSuspendMember(
  request: OrgAdminRequest<'supplierSuspendMember'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'supplierSuspendMember'>> {
  return send('supplierSuspendMember', request, options);
}
/** GET /api/v1/supplier/admin/users/:userId/deactivation-review (`supplier.admin.users.deactivationReview`). */
export function supplierGetDeactivationReview(
  request: OrgAdminRequest<'supplierGetDeactivationReview'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'supplierGetDeactivationReview'>> {
  return send('supplierGetDeactivationReview', request, options);
}
/** POST /api/v1/supplier/admin/users/:userId/deactivate (`supplier.admin.users.deactivate`). */
export function supplierDeactivateMember(
  request: OrgAdminRequest<'supplierDeactivateMember'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'supplierDeactivateMember'>> {
  return send('supplierDeactivateMember', request, options);
}
/** POST /api/v1/supplier/admin/users/:userId/reassign-work (`supplier.admin.users.reassignWork`). */
export function supplierReassignWork(
  request: OrgAdminRequest<'supplierReassignWork'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'supplierReassignWork'>> {
  return send('supplierReassignWork', request, options);
}
/** POST /api/v1/supplier/admin/users/:userId/recover (`supplier.admin.users.recover`). */
export function supplierRecoverMembership(
  request: OrgAdminRequest<'supplierRecoverMembership'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'supplierRecoverMembership'>> {
  return send('supplierRecoverMembership', request, options);
}
/** POST /api/v1/supplier/admin/users/:userId/role-assignments (`supplier.admin.users.addRole`). Idempotent: pass `options.idempotencyKey` to retry safely. */
export function supplierAddRoleAssignment(
  request: OrgAdminRequest<'supplierAddRoleAssignment'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'supplierAddRoleAssignment'>> {
  return send('supplierAddRoleAssignment', request, options);
}
/** POST /api/v1/supplier/admin/users/:userId/role-assignments/:assignmentId/revoke (`supplier.admin.users.revokeRole`). */
export function supplierRevokeRoleAssignment(
  request: OrgAdminRequest<'supplierRevokeRoleAssignment'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'supplierRevokeRoleAssignment'>> {
  return send('supplierRevokeRoleAssignment', request, options);
}
/** GET /api/v1/supplier/admin/roles (`supplier.admin.roles.list`). */
export function supplierListRoles(
  request: OrgAdminRequest<'supplierListRoles'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'supplierListRoles'>> {
  return send('supplierListRoles', request, options);
}
/** GET /api/v1/supplier/admin/roles/:roleId (`supplier.admin.roles.get`). */
export function supplierGetRole(
  request: OrgAdminRequest<'supplierGetRole'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'supplierGetRole'>> {
  return send('supplierGetRole', request, options);
}
/** GET /api/v1/supplier/admin/role-catalog (`supplier.admin.roles.catalog`). */
export function supplierGetRoleCatalog(
  request: OrgAdminRequest<'supplierGetRoleCatalog'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'supplierGetRoleCatalog'>> {
  return send('supplierGetRoleCatalog', request, options);
}
/** POST /api/v1/supplier/admin/roles (`supplier.admin.roles.create`). Idempotent: pass `options.idempotencyKey` to retry safely. */
export function supplierCreateRole(
  request: OrgAdminRequest<'supplierCreateRole'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'supplierCreateRole'>> {
  return send('supplierCreateRole', request, options);
}
/** PUT /api/v1/supplier/admin/roles/:roleId (`supplier.admin.roles.update`). */
export function supplierUpdateRole(
  request: OrgAdminRequest<'supplierUpdateRole'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'supplierUpdateRole'>> {
  return send('supplierUpdateRole', request, options);
}
/** POST /api/v1/supplier/admin/roles/:roleId/deactivate (`supplier.admin.roles.deactivate`). */
export function supplierDeactivateRole(
  request: OrgAdminRequest<'supplierDeactivateRole'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'supplierDeactivateRole'>> {
  return send('supplierDeactivateRole', request, options);
}
/** GET /api/v1/supplier/admin/groups (`supplier.admin.groups.list`). */
export function supplierListGroups(
  request: OrgAdminRequest<'supplierListGroups'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'supplierListGroups'>> {
  return send('supplierListGroups', request, options);
}
/** GET /api/v1/supplier/admin/groups/:groupId (`supplier.admin.groups.get`). */
export function supplierGetGroup(
  request: OrgAdminRequest<'supplierGetGroup'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'supplierGetGroup'>> {
  return send('supplierGetGroup', request, options);
}
/** POST /api/v1/supplier/admin/groups (`supplier.admin.groups.create`). Idempotent: pass `options.idempotencyKey` to retry safely. */
export function supplierCreateGroup(
  request: OrgAdminRequest<'supplierCreateGroup'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'supplierCreateGroup'>> {
  return send('supplierCreateGroup', request, options);
}
/** POST /api/v1/supplier/admin/groups/:groupId/deactivate (`supplier.admin.groups.deactivate`). */
export function supplierDeactivateGroup(
  request: OrgAdminRequest<'supplierDeactivateGroup'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'supplierDeactivateGroup'>> {
  return send('supplierDeactivateGroup', request, options);
}
/** POST /api/v1/supplier/admin/groups/:groupId/members (`supplier.admin.groups.addMember`). */
export function supplierAddGroupMember(
  request: OrgAdminRequest<'supplierAddGroupMember'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'supplierAddGroupMember'>> {
  return send('supplierAddGroupMember', request, options);
}
/** POST /api/v1/supplier/admin/groups/:groupId/members/:userId/remove (`supplier.admin.groups.removeMember`). */
export function supplierRemoveGroupMember(
  request: OrgAdminRequest<'supplierRemoveGroupMember'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'supplierRemoveGroupMember'>> {
  return send('supplierRemoveGroupMember', request, options);
}
/** GET /api/v1/buyer/admin/organization (`buyer.admin.organization.get`). */
export function getOrganization(
  request: OrgAdminRequest<'getOrganization'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'getOrganization'>> {
  return send('getOrganization', request, options);
}
/** POST /api/v1/buyer/admin/organization/impact-review (`buyer.admin.organization.impactReview`). */
export function reviewOrganizationImpact(
  request: OrgAdminRequest<'reviewOrganizationImpact'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'reviewOrganizationImpact'>> {
  return send('reviewOrganizationImpact', request, options);
}
/** PUT /api/v1/buyer/admin/organization (`buyer.admin.organization.update`). */
export function updateOrganization(
  request: OrgAdminRequest<'updateOrganization'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'updateOrganization'>> {
  return send('updateOrganization', request, options);
}
/** GET /api/v1/buyer/admin/legal-entities (`buyer.admin.legalEntities.list`). */
export function legalEntitiesList(
  request: OrgAdminRequest<'legalEntitiesList'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'legalEntitiesList'>> {
  return send('legalEntitiesList', request, options);
}
/** POST /api/v1/buyer/admin/legal-entities (`buyer.admin.legalEntities.create`). Idempotent: pass `options.idempotencyKey` to retry safely. */
export function legalEntitiesCreate(
  request: OrgAdminRequest<'legalEntitiesCreate'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'legalEntitiesCreate'>> {
  return send('legalEntitiesCreate', request, options);
}
/** PUT /api/v1/buyer/admin/legal-entities/:valueId (`buyer.admin.legalEntities.update`). */
export function legalEntitiesUpdate(
  request: OrgAdminRequest<'legalEntitiesUpdate'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'legalEntitiesUpdate'>> {
  return send('legalEntitiesUpdate', request, options);
}
/** POST /api/v1/buyer/admin/legal-entities/:valueId/deactivate (`buyer.admin.legalEntities.deactivate`). */
export function legalEntitiesDeactivate(
  request: OrgAdminRequest<'legalEntitiesDeactivate'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'legalEntitiesDeactivate'>> {
  return send('legalEntitiesDeactivate', request, options);
}
/** GET /api/v1/buyer/admin/departments (`buyer.admin.departments.list`). */
export function departmentsList(
  request: OrgAdminRequest<'departmentsList'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'departmentsList'>> {
  return send('departmentsList', request, options);
}
/** POST /api/v1/buyer/admin/departments (`buyer.admin.departments.create`). Idempotent: pass `options.idempotencyKey` to retry safely. */
export function departmentsCreate(
  request: OrgAdminRequest<'departmentsCreate'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'departmentsCreate'>> {
  return send('departmentsCreate', request, options);
}
/** PUT /api/v1/buyer/admin/departments/:valueId (`buyer.admin.departments.update`). */
export function departmentsUpdate(
  request: OrgAdminRequest<'departmentsUpdate'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'departmentsUpdate'>> {
  return send('departmentsUpdate', request, options);
}
/** POST /api/v1/buyer/admin/departments/:valueId/deactivate (`buyer.admin.departments.deactivate`). */
export function departmentsDeactivate(
  request: OrgAdminRequest<'departmentsDeactivate'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'departmentsDeactivate'>> {
  return send('departmentsDeactivate', request, options);
}
/** GET /api/v1/buyer/admin/locations (`buyer.admin.locations.list`). */
export function locationsList(
  request: OrgAdminRequest<'locationsList'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'locationsList'>> {
  return send('locationsList', request, options);
}
/** POST /api/v1/buyer/admin/locations (`buyer.admin.locations.create`). Idempotent: pass `options.idempotencyKey` to retry safely. */
export function locationsCreate(
  request: OrgAdminRequest<'locationsCreate'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'locationsCreate'>> {
  return send('locationsCreate', request, options);
}
/** PUT /api/v1/buyer/admin/locations/:valueId (`buyer.admin.locations.update`). */
export function locationsUpdate(
  request: OrgAdminRequest<'locationsUpdate'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'locationsUpdate'>> {
  return send('locationsUpdate', request, options);
}
/** POST /api/v1/buyer/admin/locations/:valueId/deactivate (`buyer.admin.locations.deactivate`). */
export function locationsDeactivate(
  request: OrgAdminRequest<'locationsDeactivate'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'locationsDeactivate'>> {
  return send('locationsDeactivate', request, options);
}
/** GET /api/v1/buyer/admin/categories (`buyer.admin.categories.list`). */
export function categoriesList(
  request: OrgAdminRequest<'categoriesList'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'categoriesList'>> {
  return send('categoriesList', request, options);
}
/** POST /api/v1/buyer/admin/categories (`buyer.admin.categories.create`). Idempotent: pass `options.idempotencyKey` to retry safely. */
export function categoriesCreate(
  request: OrgAdminRequest<'categoriesCreate'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'categoriesCreate'>> {
  return send('categoriesCreate', request, options);
}
/** PUT /api/v1/buyer/admin/categories/:valueId (`buyer.admin.categories.update`). */
export function categoriesUpdate(
  request: OrgAdminRequest<'categoriesUpdate'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'categoriesUpdate'>> {
  return send('categoriesUpdate', request, options);
}
/** POST /api/v1/buyer/admin/categories/:valueId/deactivate (`buyer.admin.categories.deactivate`). */
export function categoriesDeactivate(
  request: OrgAdminRequest<'categoriesDeactivate'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'categoriesDeactivate'>> {
  return send('categoriesDeactivate', request, options);
}
/** GET /api/v1/buyer/admin/cost-centers (`buyer.admin.costCenters.list`). */
export function costCentersList(
  request: OrgAdminRequest<'costCentersList'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'costCentersList'>> {
  return send('costCentersList', request, options);
}
/** POST /api/v1/buyer/admin/cost-centers (`buyer.admin.costCenters.create`). Idempotent: pass `options.idempotencyKey` to retry safely. */
export function costCentersCreate(
  request: OrgAdminRequest<'costCentersCreate'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'costCentersCreate'>> {
  return send('costCentersCreate', request, options);
}
/** PUT /api/v1/buyer/admin/cost-centers/:valueId (`buyer.admin.costCenters.update`). */
export function costCentersUpdate(
  request: OrgAdminRequest<'costCentersUpdate'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'costCentersUpdate'>> {
  return send('costCentersUpdate', request, options);
}
/** POST /api/v1/buyer/admin/cost-centers/:valueId/deactivate (`buyer.admin.costCenters.deactivate`). */
export function costCentersDeactivate(
  request: OrgAdminRequest<'costCentersDeactivate'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'costCentersDeactivate'>> {
  return send('costCentersDeactivate', request, options);
}
/** GET /api/v1/buyer/admin/funding-sources (`buyer.admin.fundingSources.list`). */
export function fundingSourcesList(
  request: OrgAdminRequest<'fundingSourcesList'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'fundingSourcesList'>> {
  return send('fundingSourcesList', request, options);
}
/** POST /api/v1/buyer/admin/funding-sources (`buyer.admin.fundingSources.create`). Idempotent: pass `options.idempotencyKey` to retry safely. */
export function fundingSourcesCreate(
  request: OrgAdminRequest<'fundingSourcesCreate'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'fundingSourcesCreate'>> {
  return send('fundingSourcesCreate', request, options);
}
/** PUT /api/v1/buyer/admin/funding-sources/:valueId (`buyer.admin.fundingSources.update`). */
export function fundingSourcesUpdate(
  request: OrgAdminRequest<'fundingSourcesUpdate'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'fundingSourcesUpdate'>> {
  return send('fundingSourcesUpdate', request, options);
}
/** POST /api/v1/buyer/admin/funding-sources/:valueId/deactivate (`buyer.admin.fundingSources.deactivate`). */
export function fundingSourcesDeactivate(
  request: OrgAdminRequest<'fundingSourcesDeactivate'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'fundingSourcesDeactivate'>> {
  return send('fundingSourcesDeactivate', request, options);
}
/** GET /api/v1/buyer/admin/category-catalog (`buyer.admin.categoryCatalog.list`). */
export function listCategoryCatalog(
  request: OrgAdminRequest<'listCategoryCatalog'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'listCategoryCatalog'>> {
  return send('listCategoryCatalog', request, options);
}
/** GET /api/v1/buyer/admin/access-grants (`buyer.admin.grants.list`). */
export function listAccessGrants(
  request: OrgAdminRequest<'listAccessGrants'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'listAccessGrants'>> {
  return send('listAccessGrants', request, options);
}
/** POST /api/v1/buyer/admin/access-grants (`buyer.admin.grants.create`). Idempotent: pass `options.idempotencyKey` to retry safely. */
export function createAccessGrant(
  request: OrgAdminRequest<'createAccessGrant'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'createAccessGrant'>> {
  return send('createAccessGrant', request, options);
}
/** POST /api/v1/buyer/admin/access-grants/:grantId/revoke (`buyer.admin.grants.revoke`). */
export function revokeAccessGrant(
  request: OrgAdminRequest<'revokeAccessGrant'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'revokeAccessGrant'>> {
  return send('revokeAccessGrant', request, options);
}
/** POST /api/v1/buyer/admin/access-grants/:grantId/extend (`buyer.admin.grants.extend`). */
export function extendAccessGrant(
  request: OrgAdminRequest<'extendAccessGrant'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'extendAccessGrant'>> {
  return send('extendAccessGrant', request, options);
}
/** GET /api/v1/buyer/admin/access-restrictions (`buyer.admin.restrictions.list`). */
export function listAccessRestrictions(
  request: OrgAdminRequest<'listAccessRestrictions'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'listAccessRestrictions'>> {
  return send('listAccessRestrictions', request, options);
}
/** POST /api/v1/buyer/admin/access-restrictions (`buyer.admin.restrictions.create`). Idempotent: pass `options.idempotencyKey` to retry safely. */
export function createAccessRestriction(
  request: OrgAdminRequest<'createAccessRestriction'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'createAccessRestriction'>> {
  return send('createAccessRestriction', request, options);
}
/** POST /api/v1/buyer/admin/access-restrictions/:restrictionId/lift (`buyer.admin.restrictions.lift`). */
export function liftAccessRestriction(
  request: OrgAdminRequest<'liftAccessRestriction'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'liftAccessRestriction'>> {
  return send('liftAccessRestriction', request, options);
}
/** GET /api/v1/buyer/admin/access/users/:userId (`buyer.admin.access.effective`). */
export function getEffectiveAccess(
  request: OrgAdminRequest<'getEffectiveAccess'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'getEffectiveAccess'>> {
  return send('getEffectiveAccess', request, options);
}
/** GET /api/v1/buyer/admin/access/findings (`buyer.admin.access.findings`). */
export function listAccessFindings(
  request: OrgAdminRequest<'listAccessFindings'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'listAccessFindings'>> {
  return send('listAccessFindings', request, options);
}
/** GET /api/v1/buyer/admin/conflict-declarations (`buyer.admin.conflicts.list`). */
export function listConflictDeclarations(
  request: OrgAdminRequest<'listConflictDeclarations'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'listConflictDeclarations'>> {
  return send('listConflictDeclarations', request, options);
}
/** GET /api/v1/buyer/admin/conflict-declarations/:declarationId (`buyer.admin.conflicts.get`). */
export function getConflictDeclaration(
  request: OrgAdminRequest<'getConflictDeclaration'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'getConflictDeclaration'>> {
  return send('getConflictDeclaration', request, options);
}
/** POST /api/v1/buyer/admin/conflict-declarations/:declarationId/decide (`buyer.admin.conflicts.decide`). */
export function decideConflictDeclaration(
  request: OrgAdminRequest<'decideConflictDeclaration'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'decideConflictDeclaration'>> {
  return send('decideConflictDeclaration', request, options);
}
/** GET /api/v1/buyer/admin/sod-policies (`buyer.admin.sod.list`). */
export function listSodPolicies(
  request: OrgAdminRequest<'listSodPolicies'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'listSodPolicies'>> {
  return send('listSodPolicies', request, options);
}
/** PUT /api/v1/buyer/admin/sod-policies/:ruleCode (`buyer.admin.sod.update`). */
export function updateSodPolicy(
  request: OrgAdminRequest<'updateSodPolicy'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'updateSodPolicy'>> {
  return send('updateSodPolicy', request, options);
}
/** GET /api/v1/buyer/admin/authority-limits (`buyer.admin.authorityLimits.list`). */
export function listAuthorityLimits(
  request: OrgAdminRequest<'listAuthorityLimits'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'listAuthorityLimits'>> {
  return send('listAuthorityLimits', request, options);
}
/** POST /api/v1/buyer/admin/authority-limits (`buyer.admin.authorityLimits.create`). Idempotent: pass `options.idempotencyKey` to retry safely. */
export function createAuthorityLimit(
  request: OrgAdminRequest<'createAuthorityLimit'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'createAuthorityLimit'>> {
  return send('createAuthorityLimit', request, options);
}
/** POST /api/v1/buyer/admin/authority-limits/:limitId/end (`buyer.admin.authorityLimits.end`). */
export function endAuthorityLimit(
  request: OrgAdminRequest<'endAuthorityLimit'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'endAuthorityLimit'>> {
  return send('endAuthorityLimit', request, options);
}
/** GET /api/v1/buyer/admin/delegations (`buyer.admin.delegations.list`). */
export function listDelegations(
  request: OrgAdminRequest<'listDelegations'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'listDelegations'>> {
  return send('listDelegations', request, options);
}
/** POST /api/v1/buyer/admin/delegations (`buyer.admin.delegations.create`). Idempotent: pass `options.idempotencyKey` to retry safely. */
export function createDelegation(
  request: OrgAdminRequest<'createDelegation'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'createDelegation'>> {
  return send('createDelegation', request, options);
}
/** POST /api/v1/buyer/admin/delegations/:delegationId/revoke (`buyer.admin.delegations.revoke`). */
export function revokeDelegation(
  request: OrgAdminRequest<'revokeDelegation'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'revokeDelegation'>> {
  return send('revokeDelegation', request, options);
}
/** GET /api/v1/buyer/admin/committees (`buyer.admin.committees.list`). */
export function listCommittees(
  request: OrgAdminRequest<'listCommittees'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'listCommittees'>> {
  return send('listCommittees', request, options);
}
/** GET /api/v1/buyer/admin/committees/:committeeId (`buyer.admin.committees.get`). */
export function getCommittee(
  request: OrgAdminRequest<'getCommittee'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'getCommittee'>> {
  return send('getCommittee', request, options);
}
/** POST /api/v1/buyer/admin/committees (`buyer.admin.committees.create`). Idempotent: pass `options.idempotencyKey` to retry safely. */
export function createCommittee(
  request: OrgAdminRequest<'createCommittee'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'createCommittee'>> {
  return send('createCommittee', request, options);
}
/** POST /api/v1/buyer/admin/committees/:committeeId/members (`buyer.admin.committees.addMember`). */
export function addCommitteeMember(
  request: OrgAdminRequest<'addCommitteeMember'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'addCommitteeMember'>> {
  return send('addCommitteeMember', request, options);
}
/** POST /api/v1/buyer/admin/committees/:committeeId/members/:memberId/end (`buyer.admin.committees.endMember`). */
export function endCommitteeMember(
  request: OrgAdminRequest<'endCommitteeMember'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'endCommitteeMember'>> {
  return send('endCommitteeMember', request, options);
}
/** POST /api/v1/buyer/admin/committees/:committeeId/deactivate (`buyer.admin.committees.deactivate`). */
export function deactivateCommittee(
  request: OrgAdminRequest<'deactivateCommittee'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'deactivateCommittee'>> {
  return send('deactivateCommittee', request, options);
}
/** GET /api/v1/supplier/admin/assignable-tenders (`supplier.admin.assignableTenders.list`). */
export function listAssignableTenders(
  request: OrgAdminRequest<'listAssignableTenders'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'listAssignableTenders'>> {
  return send('listAssignableTenders', request, options);
}
/** GET /api/v1/supplier/admin/tender-assignments (`supplier.admin.assignments.list`). */
export function listTenderAssignments(
  request: OrgAdminRequest<'listTenderAssignments'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'listTenderAssignments'>> {
  return send('listTenderAssignments', request, options);
}
/** POST /api/v1/supplier/admin/tender-assignments (`supplier.admin.assignments.create`). Idempotent: pass `options.idempotencyKey` to retry safely. */
export function createTenderAssignment(
  request: OrgAdminRequest<'createTenderAssignment'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'createTenderAssignment'>> {
  return send('createTenderAssignment', request, options);
}
/** POST /api/v1/supplier/admin/tender-assignments/:assignmentId/end (`supplier.admin.assignments.end`). */
export function endTenderAssignment(
  request: OrgAdminRequest<'endTenderAssignment'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'endTenderAssignment'>> {
  return send('endTenderAssignment', request, options);
}
/** GET /api/v1/supplier/admin/authority (`supplier.admin.authority.list`). */
export function listSupplierAuthority(
  request: OrgAdminRequest<'listSupplierAuthority'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'listSupplierAuthority'>> {
  return send('listSupplierAuthority', request, options);
}
/** PUT /api/v1/supplier/admin/authority/:userId/signing-limit (`supplier.admin.authority.setSigningLimit`). */
export function setSigningLimit(
  request: OrgAdminRequest<'setSigningLimit'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'setSigningLimit'>> {
  return send('setSigningLimit', request, options);
}
/** PUT /api/v1/supplier/admin/authority/:userId/submission (`supplier.admin.authority.setSubmission`). */
export function setSubmissionAuthority(
  request: OrgAdminRequest<'setSubmissionAuthority'>,
  options?: CallOptions,
): Promise<OrgAdminResponse<'setSubmissionAuthority'>> {
  return send('setSubmissionAuthority', request, options);
}
