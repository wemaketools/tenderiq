/**
 * Permission requirements of the publication screens, mirroring the contract (`publicationEndpoints`). The API still
 * enforces every permission; these only hide navigation and actions the membership cannot use.
 */
import type { PermissionRequirement } from '../../../app/featureRegistry';

/** BUY-14 read: the register and the tender publication page. */
export const PUBLICATION_READ: PermissionRequirement = ['tender.view', 'tender.publish'];
/** BUY-14 commands (publish, schedule, retry, reconcile). */
export const PUBLICATION_MANAGE: PermissionRequirement = 'tender.publish';
/** BUY-15 read. */
export const PARTICIPANT_READ: PermissionRequirement = [
  'tender.view',
  'tender.participants.manage',
];
/** BUY-15 commands (invite, contacts, access decisions, reminders). */
export const PARTICIPANT_MANAGE: PermissionRequirement = 'tender.participants.manage';
/** Distribute invitations (BUY-14 and BUY-15). */
export const DISTRIBUTE: PermissionRequirement = ['tender.publish', 'tender.participants.manage'];

/** SUP-06..SUP-08 read. */
export const OPPORTUNITY_READ: PermissionRequirement = 'supplier.opportunities.view';
/** SUP-09 read (the private pursuit). */
export const PURSUIT_READ: PermissionRequirement = [
  'supplier.pursuit.manage',
  'supplier.opportunities.view',
];
/** SUP-09 commands. */
export const PURSUIT_MANAGE: PermissionRequirement = 'supplier.pursuit.manage';
/** Formal answers by an authorized representative (SUP-07, SUP-08). */
export const NOTICES_ACKNOWLEDGE: PermissionRequirement = 'supplier.notices.acknowledge';
