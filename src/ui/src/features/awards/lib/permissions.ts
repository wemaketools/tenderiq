/**
 * Permission requirements of the award screens, taken from the contract so the UI hides exactly what the API
 * refuses (the API still enforces every permission).
 */
import {
  AWARD_READ_PERMISSIONS,
  CASE_READ_PERMISSIONS,
  CLOSEOUT_READ_PERMISSIONS,
  NOTICE_READ_PERMISSIONS,
} from '@contracts/awards';

import type { PermissionRequirement } from '../../../app/featureTypes';

export const AWARD_READ: PermissionRequirement = AWARD_READ_PERMISSIONS;
export const NOTICE_READ: PermissionRequirement = NOTICE_READ_PERMISSIONS;
export const CASE_READ: PermissionRequirement = CASE_READ_PERMISSIONS;
export const CLOSEOUT_READ: PermissionRequirement = CLOSEOUT_READ_PERMISSIONS;
