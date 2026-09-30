/**
 * The permission requirements of the supplier organization screens, matching the suppliers contract so navigation,
 * route guards and the mock API agree (the API enforces every one of them).
 */
import type { PermissionRequirement } from '../../../app/featureRegistry';

/** Every supplier member may read the profile (`supplier.suppliers.profile.get`). */
export const PROFILE_READ: PermissionRequirement = [
  'supplier.org.manage',
  'supplier.dashboard.view',
];
export const PROFILE_MANAGE: PermissionRequirement = 'supplier.org.manage';
/** The evidence library readers (`supplier.suppliers.evidence.list`). */
export const EVIDENCE_READ: PermissionRequirement = [
  'supplier.evidence.manage',
  'supplier.evidence.share',
  'supplier.financial.view',
];
export const EVIDENCE_MANAGE: PermissionRequirement = 'supplier.evidence.manage';
export const EVIDENCE_SHARE: PermissionRequirement = 'supplier.evidence.share';
export const USERS_MANAGE: PermissionRequirement = 'supplier.users.manage';
