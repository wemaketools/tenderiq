/**
 * Helpers shared by the policy mock handlers: permission checks on the validated tenant, the BR-07 self-approval
 * decision, free-text matching, sorting and date-range filters. Pure functions over fixture rows.
 */
import type { PermissionCode } from '../../../contracts/permissions.js';
import { CONFIGURATION_OVERSIGHT } from '../../fixtures/policy.js';
import { allPersonas, isPersonaActive, membershipPermissions } from '../../persona.js';
import type { TenantAccess } from '../../persona.js';

/** Whether the caller holds a permission in the active tenant. */
export function holds(access: TenantAccess, code: PermissionCode): boolean {
  return access.permissions.includes(code);
}

/** Case-insensitive match of `q` against any of the texts (an absent `q` matches everything). */
export function matchesText(q: string | undefined, ...texts: ReadonlyArray<string | null | undefined>): boolean {
  if (q === undefined || q.length === 0) return true;
  const needle = q.toLowerCase();
  return texts.some((text) => text !== null && text !== undefined && text.toLowerCase().includes(needle));
}

/** Whether an ISO instant or date lies within the optional bounds (inclusive). */
export function withinRange(value: string | null, from: string | undefined, to: string | undefined): boolean {
  if (from === undefined && to === undefined) return true;
  if (value === null) return false;
  if (from !== undefined && value < from) return false;
  if (to !== undefined && value > to) return false;
  return true;
}

type SortValue = string | number | boolean | null;

/** Sorts a copy of `rows` by the value `pick` returns; nulls sort last in both directions. */
export function sortRows<T>(rows: readonly T[], pick: (row: T) => SortValue, dir: 'asc' | 'desc'): T[] {
  const factor = dir === 'desc' ? -1 : 1;
  return [...rows].sort((left, right) => {
    const a = pick(left);
    const b = pick(right);
    if (a === b) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    if (typeof a === 'number' && typeof b === 'number') return (a - b) * factor;
    return String(a).localeCompare(String(b)) * factor;
  });
}

/** The calendar date (UTC) of an instant, for comparing review dates with "today". */
export function calendarDateOf(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** The outcome of the BR-07 check for one caller deciding one submission. */
export interface SelfApprovalDecision {
  /** Whether the caller may approve (the permission and status checks are separate). */
  readonly allowed: boolean;
  /** Why the caller may not approve, or null. */
  readonly blockedReason: string | null;
  /** The documented alternative oversight the caller's own approval relies on, or null. */
  readonly oversightNote: string | null;
}

/**
 * The BR-07 rule for configuration approvals, as a pure function: someone other than the submitter decides; the
 * submitter may decide only when nobody else holds the approval permission AND the organization documented
 * alternative oversight.
 */
export function decideSelfApproval(input: {
  readonly callerId: number;
  readonly submitterId: number | null;
  readonly otherApproverCount: number;
  readonly oversightNote: string | null;
  /** What was submitted, for the message ("version", "proposal"). */
  readonly subject: string;
}): SelfApprovalDecision {
  if (input.submitterId === null || input.submitterId !== input.callerId) {
    return { allowed: true, blockedReason: null, oversightNote: null };
  }
  if (input.otherApproverCount > 0) {
    return {
      allowed: false,
      blockedReason: `You submitted this ${input.subject}, so another approver must decide it (BR-07).`,
      oversightNote: null,
    };
  }
  if (input.oversightNote === null) {
    return {
      allowed: false,
      blockedReason: `You submitted this ${input.subject}, nobody else holds the approval permission and no alternative oversight is documented (BR-07). Assign a second approver or document the oversight first.`,
      oversightNote: null,
    };
  }
  return { allowed: true, blockedReason: null, oversightNote: input.oversightNote };
}

/** Active members of the tenant, other than `callerId`, whose roles grant `permission`. */
export function otherPermissionHolders(tenantId: number, permission: PermissionCode, callerId: number): number[] {
  return allPersonas()
    .filter((persona) => persona.userId !== callerId && isPersonaActive(persona))
    .filter((persona) =>
      persona.memberships.some(
        (membership) =>
          membership.tenantId === tenantId && membership.status === 'active' && membershipPermissions(membership).includes(permission),
      ),
    )
    .map((persona) => persona.userId);
}

/** The documented alternative oversight for configuration approvals of a tenant, or null. */
export function configurationOversightNote(tenantId: number): string | null {
  return CONFIGURATION_OVERSIGHT.find((row) => row.tenantId === tenantId)?.note ?? null;
}

/** The BR-07 decision for the caller of `access` on a submission by `submitterId`. */
export function selfApprovalFor(
  access: TenantAccess,
  callerId: number,
  submitterId: number | null,
  permission: PermissionCode,
  subject: string,
): SelfApprovalDecision {
  return decideSelfApproval({
    callerId,
    submitterId,
    otherApproverCount: submitterId === callerId ? otherPermissionHolders(access.tenant.id, permission, callerId).length : 0,
    oversightNote: configurationOversightNote(access.tenant.id),
    subject,
  });
}
