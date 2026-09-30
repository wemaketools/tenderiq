/**
 * Permission requirements of the buyer service screens, mirroring the operations contract. Integration exceptions
 * are also open to the tender owner (`tender.publish`), who resolves a failed external publication (AC-33).
 */
import type { PermissionRequirement } from '../../../app/featureRegistry';

export const INTEGRATIONS_MANAGE: PermissionRequirement = 'org.integrations.manage';
export const EXCEPTIONS_ACCESS: PermissionRequirement = [
  'org.integrations.manage',
  'tender.publish',
];
export const IMPORTS_MANAGE: PermissionRequirement = 'org.imports.manage';
export const SUBSCRIPTION_VIEW: PermissionRequirement = 'org.subscription.view';
export const SUBSCRIPTION_MANAGE: PermissionRequirement = 'org.settings.manage';
export const SUPPORT_ACCESS: PermissionRequirement = 'org.support_access.authorize';
/** Any service screen (the sidebar entry). */
export const SERVICE_AREA: PermissionRequirement = [
  'org.integrations.manage',
  'tender.publish',
  'org.imports.manage',
  'org.subscription.view',
  'org.support_access.authorize',
];
