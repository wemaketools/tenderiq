/**
 * The views of the approval workspace (docs/plan/design1 §4): each one is a plain mapping onto the query
 * capabilities the inbox endpoint already has, never a client-side slice.
 * - `review`: approvals whose current step the caller can decide (`awaitingMyDecision`).
 * - `sent`: approvals the caller requested (`involvement: requester`).
 * - `history`: decided approvals (every status except `pending`).
 * - `all`: everything the caller is involved in (the default: nothing is hidden).
 */
import type {
  ApprovalInvolvement,
  MyApprovalItem,
  MyApprovalListQuery,
} from '@contracts/approvals';
import { APPROVAL_REQUESTS_STATUS } from '@contracts/enums';
import type { ApprovalRequestsStatus } from '@contracts/enums';

export const APPROVAL_VIEWS = ['all', 'review', 'sent', 'history'] as const;
export type ApprovalView = (typeof APPROVAL_VIEWS)[number];

/** The statuses of a decided (or otherwise closed) approval. */
export const DECIDED_STATUSES: readonly ApprovalRequestsStatus[] = APPROVAL_REQUESTS_STATUS.filter(
  (status) => status !== 'pending',
);

export function approvalView(value: string): ApprovalView {
  return (APPROVAL_VIEWS as readonly string[]).includes(value) ? (value as ApprovalView) : 'all';
}

/** The query fragment of a view; a status the user chose in the filters narrows the history view further. */
export function viewQuery(
  view: ApprovalView,
  status: ApprovalRequestsStatus[] | undefined,
): Pick<MyApprovalListQuery, 'awaitingMyDecision' | 'involvement' | 'status'> {
  switch (view) {
    case 'review':
      return { awaitingMyDecision: true, status };
    case 'sent':
      return { involvement: ['requester' satisfies ApprovalInvolvement], status };
    case 'history':
      return { status: status ?? [...DECIDED_STATUSES] };
    default:
      return { status };
  }
}

/** True when the row belongs to the view (used for the counts of a fully loaded overview). */
export function inView(row: MyApprovalItem, view: ApprovalView): boolean {
  switch (view) {
    case 'review':
      return row.myStep?.canDecide === true;
    case 'sent':
      return row.involvement === 'requester';
    case 'history':
      return row.status !== 'pending';
    default:
      return true;
  }
}
