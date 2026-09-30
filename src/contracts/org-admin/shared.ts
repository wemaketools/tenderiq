/**
 * Org-admin contract: building blocks shared by the account (COM-01..03), buyer administration (ADM-01..05) and
 * supplier users and authority (SUP-04) schemas.
 *
 * Contract-defined enumerations live here until Integration moves them into `enums.ts` (they are derived display
 * states or free-text columns in the blueprint, never stored CHECK lists): the access item display status
 * (DD-18: request-time comparison of `starts_at`, `expires_at`, `revoked_at`), outstanding work kinds (AC-04),
 * contact change fields and states (COM-03), access review finding types (ADM-04) and permission sources.
 *
 * Pure module: zod and sibling contract files only.
 */
import { z } from 'zod';

import { ACCESS_ITEM_STATUSES } from '../enums.js';

export { ACCESS_ITEM_STATUSES };

import { Id, Instant, PersonRef, issue } from '../common.js';
import { RoleAssignmentsScopeType } from '../enums.js';
import { RoleTemplateCode } from '../permissions.js';

// ---------------------------------------------------------------------------------------------------------
// Contract-defined enumerations
// ---------------------------------------------------------------------------------------------------------

/**
 * Display status of anything with a validity window (role assignments, direct grants, restrictions, delegations,
 * authority limits). Derived at request time from `starts_at`, `expires_at`/`ends_at` and `revoked_at` (DD-18);
 * `expiring_soon` = active and ending within `EXPIRING_SOON_DAYS`.
 */
export const AccessItemStatus = z.enum(ACCESS_ITEM_STATUSES);
export type AccessItemStatus = z.infer<typeof AccessItemStatus>;

/** Days before the end of a validity window when an item is reported as `expiring_soon` (ADM-04 review). */
export const EXPIRING_SOON_DAYS = 30;

/**
 * The display status of a validity window at `now` (DD-18). Pure: used by the mock API and the backend alike.
 * `endsAt = null` means open-ended.
 */
export function accessItemStatus(
  window: { startsAt: string; endsAt: string | null; revokedAt: string | null },
  now: Date,
): AccessItemStatus {
  const at = now.getTime();
  if (window.revokedAt !== null && Date.parse(window.revokedAt) <= at) {
    return 'revoked';
  }
  if (Date.parse(window.startsAt) > at) {
    return 'scheduled';
  }
  if (window.endsAt !== null) {
    const end = Date.parse(window.endsAt);
    if (end <= at) {
      return 'expired';
    }
    if (end - at <= EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000) {
      return 'expiring_soon';
    }
  }
  return 'active';
}

/** Outstanding work a leaver may hold (ADM-03 deactivation review, SUP-04 reassignment; AC-04). */
export const WORK_ITEM_KINDS = [
  'task',
  'approval_step',
  'tender_team',
  'evaluation_assignment',
  'pursuit_assignment',
  'committee_seat',
  'record_owner',
] as const;
export const WorkItemKind = z.enum(WORK_ITEM_KINDS);
export type WorkItemKind = z.infer<typeof WorkItemKind>;

/** Historical actions that stay attributed to a person after deactivation (BR-38, AC-04). */
export const ATTRIBUTED_RECORD_KINDS = [
  'approval_decision',
  'bid_submission',
  'publication',
  'request',
  'evaluation_score',
  'contract_signature',
  'opening_record',
] as const;
export const AttributedRecordKind = z.enum(ATTRIBUTED_RECORD_KINDS);
export type AttributedRecordKind = z.infer<typeof AttributedRecordKind>;

/** Where an effective permission comes from (ADM-04 effective access). */
export const PERMISSION_SOURCE_KINDS = ['role', 'group_role', 'direct_grant'] as const;
export const PermissionSourceKind = z.enum(PERMISSION_SOURCE_KINDS);
export type PermissionSourceKind = z.infer<typeof PermissionSourceKind>;

// ---------------------------------------------------------------------------------------------------------
// Shared shapes
// ---------------------------------------------------------------------------------------------------------

/** An invitation token as it appears in `/invite/:token` (the database keeps only `token_hash`). */
export const InvitationToken = z
  .string()
  .regex(/^[A-Za-z0-9_-]{16,128}$/, issue('INVALID_TOKEN', 'This invitation link is not valid.'));
export type InvitationToken = z.infer<typeof InvitationToken>;

/** A role as shown on a person or a group (`roles`). */
export const RoleRef = z.object({
  roleId: Id,
  code: z.string().min(1),
  name: z.string().min(1),
  templateCode: RoleTemplateCode.nullable(),
});
export type RoleRef = z.infer<typeof RoleRef>;

/** A group reference (`user_groups`). */
export const GroupSummaryRef = z.object({
  groupId: Id,
  name: z.string().min(1),
});
export type GroupSummaryRef = z.infer<typeof GroupSummaryRef>;

/** A scope of an assignment, grant or restriction (`scope_type`, `scope_id`) with its display label. */
export const AccessScope = z.object({
  scopeType: RoleAssignmentsScopeType,
  scopeId: Id.nullable(),
  /** Human label: "Whole organization", "Operations department", "T-2026-0003 SCADA telemetry upgrade". */
  scopeLabel: z.string().min(1),
});
export type AccessScope = z.infer<typeof AccessScope>;

/** A scope in a request body: `scopeId` is null iff `scopeType = organization` (blueprint `role_assignments`). */
export const AccessScopeInput = z
  .object({
    scopeType: RoleAssignmentsScopeType,
    scopeId: Id.nullable(),
  })
  .refine((value) => (value.scopeType === 'organization') === (value.scopeId === null), {
    message: issue('SCOPE_INVALID', 'Choose a record for a limited scope, or none for the whole organization.'),
    path: ['scopeId'],
  });
export type AccessScopeInput = z.infer<typeof AccessScopeInput>;

/** A role assignment held by a user directly or through a group (`role_assignments`). */
export const RoleAssignmentRow = z.object({
  assignmentId: Id,
  role: RoleRef,
  scope: AccessScope,
  /** Set when the role reaches the user through a group. */
  viaGroup: GroupSummaryRef.nullable(),
  startsAt: Instant,
  endsAt: Instant.nullable(),
  grantedBy: PersonRef.nullable(),
  revokedAt: Instant.nullable(),
  reason: z.string().nullable(),
  status: AccessItemStatus,
});
export type RoleAssignmentRow = z.infer<typeof RoleAssignmentRow>;

/** One open work item of a person (AC-04). */
export const WorkItem = z.object({
  workItemId: Id,
  kind: WorkItemKind,
  title: z.string().min(1),
  /** Reference of the related record (`T-2026-0008`, `PR-2026-0004`), when there is one. */
  reference: z.string().nullable(),
  dueAt: Instant.nullable(),
  isOverdue: z.boolean(),
  /** Whether it must be reassigned before deactivation (formal work) or may lapse (reminders). */
  requiresReassignment: z.boolean(),
});
export type WorkItem = z.infer<typeof WorkItem>;

/** A historical action that stays attributed to the person (BR-38). */
export const AttributedRecord = z.object({
  kind: AttributedRecordKind,
  reference: z.string().min(1),
  description: z.string().min(1),
  occurredAt: Instant,
  /** The capacity the person acted in at the time (BR-02). */
  capacity: z.string().nullable(),
});
export type AttributedRecord = z.infer<typeof AttributedRecord>;

/** A reassignment instruction: move one open work item to another active member. */
export const ReassignmentInput = z.object({
  workItemId: Id,
  toUserId: Id,
});
export type ReassignmentInput = z.infer<typeof ReassignmentInput>;
