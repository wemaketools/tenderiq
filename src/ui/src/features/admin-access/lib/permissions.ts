/**
 * Permission requirements of the users-and-access screens (ADM-03, ADM-04, SUP-04). They mirror the org-admin
 * contract (`src/contracts/org-admin/*`): hiding is a convenience, the API enforces every permission.
 */
import type { PermissionRequirement } from '../../../app/featureRegistry';

/** ADM-03 directory and user detail. */
export const BUYER_USERS_READ = [
  'org.users.view',
  'org.users.manage',
] as const satisfies PermissionRequirement;
/** ADM-03 lifecycle commands (invite, suspend, deactivate, reassign, recover). */
export const BUYER_USERS_MANAGE = 'org.users.manage' satisfies PermissionRequirement;
/** ADM-04 roles and groups (read). */
export const BUYER_ROLES_READ = [
  'org.roles.manage',
  'org.access.review',
  'org.users.manage',
] as const satisfies PermissionRequirement;
/** ADM-04 roles, groups, role assignments, grants and restrictions (write). */
export const BUYER_ROLES_MANAGE = 'org.roles.manage' satisfies PermissionRequirement;
/** ADM-04 direct grants, restrictions and effective access (read). */
export const BUYER_GRANTS_READ = [
  'org.access.review',
  'org.roles.manage',
] as const satisfies PermissionRequirement;
/** ADM-04 access review findings. */
export const BUYER_FINDINGS_READ = 'org.access.review' satisfies PermissionRequirement;
/** ADM-04 conflict-declaration review queue (AC-02). */
export const BUYER_CONFLICTS_READ = [
  'org.access.review',
  'evaluation.chair',
] as const satisfies PermissionRequirement;
/** Any users-and-access screen of a buyer organization (the sidebar entry). */
export const BUYER_ACCESS_AREA = [
  'org.users.view',
  'org.users.manage',
  'org.roles.manage',
  'org.access.review',
  'evaluation.chair',
] as const satisfies PermissionRequirement;

/** SUP-04: every supplier users-and-authority screen belongs to the supplier administrator. */
export const SUPPLIER_USERS_MANAGE = 'supplier.users.manage' satisfies PermissionRequirement;
