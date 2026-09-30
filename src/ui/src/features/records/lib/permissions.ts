/** Permission sets of the ADM-14 records workspace (mirroring the records contract). */
import type { PermissionCode } from '@contracts/permissions';

type Requirement = readonly [PermissionCode, ...PermissionCode[]];

/** Any of these opens retention, holds and disposal. */
export const RECORDS_READ: Requirement = [
  'audit.view',
  'records.retention.manage',
  'records.hold.manage',
  'records.disposal.approve',
];
/** Any of these opens the ADM-14 workspace (evidence packs need only export.create). */
export const RECORDS_WORKSPACE: Requirement = [...RECORDS_READ, 'export.create'];
export const AUDIT_READ: Requirement = ['audit.view'];
export const EVIDENCE_PACKS_READ: Requirement = ['audit.view', 'export.create'];

export const recordsPaths = {
  overview: '/buyer/admin/records',
  audit: '/buyer/admin/records/audit',
  retention: '/buyer/admin/records/retention',
  holds: '/buyer/admin/records/holds',
  hold: (id: number) => `/buyer/admin/records/holds/${id}`,
  disposals: '/buyer/admin/records/disposals',
  disposal: (id: number) => `/buyer/admin/records/disposals/${id}`,
  evidencePacks: '/buyer/admin/records/evidence-packs',
} as const;
