/**
 * The member detail after a lifecycle command (ADM-03, AC-04). A command returns the updated member row and its
 * effects; the tabs of the detail (open work, role assignments, grants, delegations) are brought in line with them
 * here, so the page never shows responsibilities that the command has just reassigned or ended.
 */
import type {
  AccessItemStatus,
  LifecycleResult,
  MemberDetail,
  RoleAssignmentRow,
} from '@contracts/org-admin';

const LIVE: ReadonlySet<AccessItemStatus> = new Set(['scheduled', 'active', 'expiring_soon']);

function isLive(status: AccessItemStatus): boolean {
  return LIVE.has(status);
}

/** Every live role assignment ended at `endedAt` (deactivation ends access, BR-38 keeps the history). */
export function endLiveAssignments(
  assignments: readonly RoleAssignmentRow[],
  endedAt: string,
): RoleAssignmentRow[] {
  return assignments.map((assignment) =>
    isLive(assignment.status)
      ? { ...assignment, revokedAt: endedAt, status: 'revoked' as const }
      : assignment,
  );
}

/** The detail after reassigning `workItemIds` to other members. */
export function afterReassignment(
  member: MemberDetail,
  result: LifecycleResult,
  workItemIds: readonly number[],
): MemberDetail {
  const moved = new Set(workItemIds);
  const openWork = member.openWork.filter((item) => !moved.has(item.workItemId));
  return { ...member, ...result.member, openWork, openWorkCount: openWork.length };
}

/**
 * The detail after deactivation: every open item is reassigned or closed with the account, and live role
 * assignments, direct grants and delegations (given and received) end at `endedAt`.
 */
export function afterDeactivation(
  member: MemberDetail,
  result: LifecycleResult,
  endedAt: string,
): MemberDetail {
  const end = <T extends { status: AccessItemStatus; revokedAt: string | null }>(row: T): T =>
    isLive(row.status) ? { ...row, revokedAt: endedAt, status: 'revoked' } : row;
  return {
    ...member,
    ...result.member,
    endedAt: member.endedAt ?? endedAt,
    openWork: [],
    openWorkCount: 0,
    roleAssignments: endLiveAssignments(member.roleAssignments, endedAt),
    directGrants: member.directGrants.map(end),
    delegationsGiven: member.delegationsGiven.map(end),
    delegationsReceived: member.delegationsReceived.map(end),
    activeDelegationCount: 0,
    availableActions: [],
  };
}
