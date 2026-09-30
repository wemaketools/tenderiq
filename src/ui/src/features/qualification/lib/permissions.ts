/**
 * Permission sets of the qualification screens, mirrored from the contract so routes, navigation and the API agree.
 */
import {
  QUALIFICATION_PROGRAM_VIEW_PERMISSIONS,
  QUALIFICATION_WORK_PERMISSIONS,
  SUPPLIER_DECISION_VIEW_PERMISSIONS,
} from '@contracts/qualification';
import type { PermissionCode } from '@contracts/permissions';

type AnyOf = [PermissionCode, ...PermissionCode[]];

/** BUY-33, BUY-34, BUY-35: the review queue, assessment, decisions and monitoring. */
export const WORK_READ: AnyOf = [...QUALIFICATION_WORK_PERMISSIONS];

/** ADM-09: the program register (managers and everyone who applies the criteria). */
export const PROGRAM_READ: AnyOf = [...QUALIFICATION_PROGRAM_VIEW_PERMISSIONS];

/** SUP-20 overview and SUP-24 decisions. */
export const SUPPLIER_DECISIONS_READ: AnyOf = [...SUPPLIER_DECISION_VIEW_PERMISSIONS];
