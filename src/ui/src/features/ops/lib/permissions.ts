/**
 * Permission requirements of the operator screens, mirroring the operations contract: reads accept the managing
 * permission or `ops.oversight.view`; commands need the managing permission (the API enforces both).
 */
import type { PermissionRequirement } from '../../../app/featureRegistry';

export const CUSTOMERS_READ: PermissionRequirement = [
  'ops.customers.manage',
  'ops.support.manage',
  'ops.oversight.view',
];
export const CUSTOMERS_MANAGE: PermissionRequirement = 'ops.customers.manage';
export const PLANS_READ: PermissionRequirement = [
  'ops.subscriptions.manage',
  'ops.customers.manage',
  'ops.oversight.view',
];
export const SUBSCRIPTIONS_READ: PermissionRequirement = [
  'ops.subscriptions.manage',
  'ops.oversight.view',
];
export const SUBSCRIPTIONS_MANAGE: PermissionRequirement = 'ops.subscriptions.manage';
export const SUPPORT_READ: PermissionRequirement = ['ops.support.manage', 'ops.oversight.view'];
export const SUPPORT_MANAGE: PermissionRequirement = 'ops.support.manage';
export const INCIDENTS_READ: PermissionRequirement = ['ops.incidents.manage', 'ops.oversight.view'];
export const INCIDENTS_MANAGE: PermissionRequirement = 'ops.incidents.manage';
export const OVERSIGHT: PermissionRequirement = 'ops.oversight.view';
export const CONTENT_READ: PermissionRequirement = ['ops.content.manage', 'ops.oversight.view'];
export const CONTENT_MANAGE: PermissionRequirement = 'ops.content.manage';
