/**
 * The permission requirements of the policy screens, taken from the contract so navigation, route guards and the
 * mock API agree (the API enforces every one of them).
 */
import {
  CUSTOM_FIELD_ADMIN_READ,
  PORTAL_POLICY_READ,
  POLICY_PROFILE_READ,
  TEMPLATE_ADMIN_READ,
} from '@contracts/policy';
import type { PermissionCode } from '@contracts/permissions';

import type { PermissionRequirement } from '../../../app/featureRegistry';

export const PROFILES_READ: PermissionRequirement = POLICY_PROFILE_READ;
export const FIELDS_READ: PermissionRequirement = CUSTOM_FIELD_ADMIN_READ;
export const TEMPLATES_READ: PermissionRequirement = TEMPLATE_ADMIN_READ;
export const PORTAL_READ: PermissionRequirement = PORTAL_POLICY_READ;

function codesOf(requirement: PermissionRequirement): readonly PermissionCode[] {
  return typeof requirement === 'string' ? [requirement] : requirement;
}

const areaCodes = [
  ...new Set([PROFILES_READ, FIELDS_READ, TEMPLATES_READ, PORTAL_READ].flatMap(codesOf)),
];
const [firstAreaCode, ...otherAreaCodes] = areaCodes;
if (firstAreaCode === undefined) {
  throw new Error('The policy screens need at least one read permission.');
}

/** Anyone who can open at least one of the four screens. */
export const POLICY_AREA_READ: PermissionRequirement = [firstAreaCode, ...otherAreaCodes];
