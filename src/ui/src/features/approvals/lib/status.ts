/** Status helpers of the approval screens (COM-04, COM-05). */
import type { MyApprovalItem } from '@contracts/approvals';

/** Pending, and the caller holds a step that cannot be decided now. */
export function isBlockedForMe(row: MyApprovalItem): boolean {
  return (
    row.status === 'pending' &&
    row.myStep !== null &&
    !row.myStep.canDecide &&
    row.myStep.blockers.length > 0
  );
}
