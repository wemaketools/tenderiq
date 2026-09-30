/**
 * Permission requirements of the organization screens (ADM-01, ADM-02, ADM-05). They mirror the org-admin contract:
 * hiding is a convenience, the API enforces every permission.
 */
import type { PermissionRequirement } from '../../../app/featureRegistry';

/** ADM-01 organization settings and legal entities (read). */
export const ORG_READ = [
  'org.settings.manage',
  'org.structure.manage',
] as const satisfies PermissionRequirement;
/** ADM-01 settings changes. */
export const ORG_MANAGE = 'org.settings.manage' satisfies PermissionRequirement;
/** ADM-02 structure registers (read). */
export const STRUCTURE_READ = [
  'org.structure.manage',
  'org.settings.manage',
] as const satisfies PermissionRequirement;
/** ADM-01 legal entities and ADM-02 values (add, revise, deactivate). */
export const STRUCTURE_MANAGE = 'org.structure.manage' satisfies PermissionRequirement;
/** ADM-05 authority limits, delegations and SoD policies (read). */
export const AUTHORITY_READ = [
  'org.authority.manage',
  'org.access.review',
] as const satisfies PermissionRequirement;
/** ADM-05 commands. */
export const AUTHORITY_MANAGE = 'org.authority.manage' satisfies PermissionRequirement;
/** ADM-05 committees (read). */
export const COMMITTEES_READ = [
  'org.authority.manage',
  'org.structure.manage',
] as const satisfies PermissionRequirement;
/** Any organization screen (the sidebar entry). */
export const ORG_AREA = [
  'org.settings.manage',
  'org.structure.manage',
  'org.authority.manage',
  'org.access.review',
] as const satisfies PermissionRequirement;
/** ADM-05 page (limits, delegations and SoD policies, or committees). */
export const AUTHORITY_AREA = [
  'org.authority.manage',
  'org.access.review',
  'org.structure.manage',
] as const satisfies PermissionRequirement;
