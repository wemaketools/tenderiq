/**
 * Permission codes of the tender authoring screens. The API enforces every one; the SPA only hides what the
 * membership cannot use.
 */
import type { PermissionCode } from '@contracts/permissions';

export const TENDER_VIEW: PermissionCode = 'tender.view';
export const TENDER_CREATE: PermissionCode = 'tender.create';
export const TENDER_EDIT: PermissionCode = 'tender.edit';
export const TENDER_RELEASE_APPROVE: PermissionCode = 'tender.release_approve';
/** Recording release checks and requesting corrections: authors and release approvers. */
export const RELEASE_REVIEW: readonly [PermissionCode, ...PermissionCode[]] = [
  'tender.edit',
  'tender.release_approve',
];
