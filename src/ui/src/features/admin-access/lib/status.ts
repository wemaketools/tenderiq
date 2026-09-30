/**
 * Display helpers for the contract-defined states of the org-admin domain (not stored enumerations, so they have
 * no `enums.ts` entry): validity windows (`AccessItemStatus`, DD-18), finding severities, work item kinds and
 * permission sources.
 */
import type { ChipTone } from '@contracts/enums';
import type { AccessItemStatus, FindingSeverity } from '@contracts/org-admin';

import { t } from '../../../lib/i18n';

export const ACCESS_STATUS_TONE: Readonly<Record<AccessItemStatus, ChipTone>> = {
  scheduled: 'info',
  active: 'success',
  expiring_soon: 'warning',
  expired: 'neutral-outlined',
  revoked: 'neutral',
};

export function accessStatusLabel(status: AccessItemStatus): string {
  return t(`admin-access.accessStatus.${status}`);
}

export const SEVERITY_TONE: Readonly<Record<FindingSeverity, ChipTone>> = {
  critical: 'danger',
  warning: 'warning',
  info: 'info',
};

/** The options of an AccessItemStatus filter. */
export function accessStatusOptions(
  statuses: readonly AccessItemStatus[],
): { value: string; label: string }[] {
  return statuses.map((value) => ({ value, label: accessStatusLabel(value) }));
}

/** Yes or No. */
export function yesNo(value: boolean): string {
  return value ? t('admin-access.common.yes') : t('admin-access.common.no');
}
