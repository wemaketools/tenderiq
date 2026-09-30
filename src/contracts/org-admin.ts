/**
 * Org-admin contract (domain 01 "Identity and organization administration"): FR-01, FR-03, PRD §5.3, §5.4; BR-02,
 * BR-06, BR-07, BR-38; screens COM-01, COM-02, COM-03, ADM-01 … ADM-05 and SUP-04; acceptance AC-02, AC-03, AC-04.
 *
 * The schemas live in `org-admin/*` by area; this module re-exports them and publishes the ONE endpoint map
 * `orgAdminEndpoints` (architecture-plan §3.10):
 * - account (`/public/invitations`, `/me/invitations`, `/me/memberships`, `/me/profile`, `/me/access-summary`);
 * - member administration, defined once per audience: `/buyer/admin/*` (ADM-03, ADM-04) and `/supplier/admin/*`
 *   (SUP-04) share keys and schemas; grantable roles follow the tenant kind;
 * - buyer organization and structure (ADM-01, ADM-02), access governance (ADM-04) and authority (ADM-05);
 * - supplier tender assignments, submission authority and signing limits (SUP-04).
 *
 * Pure module: zod and sibling contract files only.
 */
import {
  acceptInvitation,
  cancelContactChange,
  getMyAccessSummary,
  getMyProfile,
  leaveMembership,
  listMyMemberships,
  previewInvitation,
  requestContactChange,
  updateMyProfile,
  withdrawMembershipRequest,
} from './org-admin/account.js';
import {
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
  updateSodPolicy,
} from './org-admin/access.js';
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
} from './org-admin/authority.js';
import { buyerMemberAdmin, supplierMemberAdmin } from './org-admin/members.js';
import {
  categoryRoutes,
  costCenterRoutes,
  departmentRoutes,
  fundingSourceRoutes,
  getOrganization,
  legalEntityRoutes,
  listCategoryCatalog,
  locationRoutes,
  reviewOrganizationImpact,
  updateOrganization,
} from './org-admin/organization.js';
import {
  createTenderAssignment,
  endTenderAssignment,
  listAssignableTenders,
  listSupplierAuthority,
  listTenderAssignments,
  setSigningLimit,
  setSubmissionAuthority,
} from './org-admin/supplier.js';

export * from './org-admin/account.js';
export * from './org-admin/access.js';
export * from './org-admin/authority.js';
export * from './org-admin/members.js';
export * from './org-admin/organization.js';
export * from './org-admin/shared.js';
export * from './org-admin/supplier.js';

/** Prefixes every key of an endpoint group so the flat map stays readable (`buyerListMembers`). */
function prefixed<const P extends string, const M extends Record<string, unknown>>(
  prefix: P,
  group: M,
): { [K in keyof M & string as `${P}${Capitalize<K>}`]: M[K] } {
  return Object.fromEntries(
    Object.entries(group).map(([key, value]) => [`${prefix}${key.charAt(0).toUpperCase()}${key.slice(1)}`, value]),
  ) as { [K in keyof M & string as `${P}${Capitalize<K>}`]: M[K] };
}

/** The org-admin endpoint map. */
export const orgAdminEndpoints = {
  // COM-01 … COM-03
  previewInvitation,
  acceptInvitation,
  listMyMemberships,
  withdrawMembershipRequest,
  leaveMembership,
  getMyProfile,
  updateMyProfile,
  requestContactChange,
  cancelContactChange,
  getMyAccessSummary,
  // ADM-03, ADM-04 (buyer) and SUP-04 (supplier) member administration
  ...prefixed('buyer', buyerMemberAdmin),
  ...prefixed('supplier', supplierMemberAdmin),
  // ADM-01, ADM-02
  getOrganization,
  reviewOrganizationImpact,
  updateOrganization,
  ...prefixed('legalEntities', legalEntityRoutes),
  ...prefixed('departments', departmentRoutes),
  ...prefixed('locations', locationRoutes),
  ...prefixed('categories', categoryRoutes),
  ...prefixed('costCenters', costCenterRoutes),
  ...prefixed('fundingSources', fundingSourceRoutes),
  listCategoryCatalog,
  // ADM-04 access governance
  listAccessGrants,
  createAccessGrant,
  revokeAccessGrant,
  extendAccessGrant,
  listAccessRestrictions,
  createAccessRestriction,
  liftAccessRestriction,
  getEffectiveAccess,
  listAccessFindings,
  listConflictDeclarations,
  getConflictDeclaration,
  decideConflictDeclaration,
  // ADM-05 authority
  listSodPolicies,
  updateSodPolicy,
  listAuthorityLimits,
  createAuthorityLimit,
  endAuthorityLimit,
  listDelegations,
  createDelegation,
  revokeDelegation,
  listCommittees,
  getCommittee,
  createCommittee,
  addCommitteeMember,
  endCommitteeMember,
  deactivateCommittee,
  // SUP-04 supplier authority
  listAssignableTenders,
  listTenderAssignments,
  createTenderAssignment,
  endTenderAssignment,
  listSupplierAuthority,
  setSigningLimit,
  setSubmissionAuthority,
} as const;
