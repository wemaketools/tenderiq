/**
 * Approvals client (the `approvals` contract, COM-04, COM-05 and the approval panels). Deciding carries the
 * approval's tenant as `X-Tenant-Id` (DD-21); buyer routes use the active tenant.
 */
import {
  checkAuthority,
  decideApproval,
  getApproval,
  getMyApproval,
  getSubjectApprovals,
  listMyApprovals,
  requestApproval,
  withdrawApproval,
} from '@contracts/approvals';
import type {
  ApprovalDetail,
  AuthorityCheckHint,
  AuthorityCheckQuery,
  DecideApprovalBody,
  MyApprovalPage,
  RequestApprovalBody,
  SubjectApprovals,
  WithdrawApprovalBody,
} from '@contracts/approvals';
import type { ApprovalRequestsSubjectType } from '@contracts/enums';
import type { EndpointQuery } from '@contracts/endpoint';

import { call } from './client';

/** GET /api/v1/me/approvals: approvals the caller decides (directly or by delegation) or requested. */
export function fetchMyApprovals(
  query: EndpointQuery<typeof listMyApprovals> = {},
): Promise<MyApprovalPage> {
  return call(listMyApprovals, { query });
}

/** GET /api/v1/me/approvals/:approvalId: the decision screen for the caller. */
export function fetchMyApproval(approvalId: number): Promise<ApprovalDetail> {
  return call(getMyApproval, { params: { approvalId } });
}

/** POST /api/v1/me/approvals/:approvalId/decide in the approval's organization. */
export function decide(
  approvalId: number,
  tenantId: number,
  body: DecideApprovalBody,
): Promise<ApprovalDetail> {
  return call(decideApproval, { params: { approvalId }, body }, { tenantId });
}

/** GET /api/v1/buyer/approvals/subjects/:subjectType/:subjectId: the approval panel of a record. */
export function fetchSubjectApprovals(
  subjectType: ApprovalRequestsSubjectType,
  subjectId: number,
): Promise<SubjectApprovals> {
  return call(getSubjectApprovals, { params: { subjectType, subjectId } });
}

/** GET /api/v1/buyer/approvals/:approvalId in the active buyer organization. */
export function fetchApproval(approvalId: number): Promise<ApprovalDetail> {
  return call(getApproval, { params: { approvalId } });
}

/** POST /api/v1/buyer/approvals (idempotent): requests approval of one exact version. */
export function requestSubjectApproval(
  body: RequestApprovalBody,
  idempotencyKey?: string,
): Promise<ApprovalDetail> {
  return call(requestApproval, { body }, idempotencyKey === undefined ? {} : { idempotencyKey });
}

/** POST /api/v1/buyer/approvals/:approvalId/withdraw. */
export function withdraw(approvalId: number, body: WithdrawApprovalBody): Promise<ApprovalDetail> {
  return call(withdrawApproval, { params: { approvalId }, body });
}

/** GET /api/v1/buyer/approval-authority-check: who can approve this amount (the AC-05 hint). */
export function fetchAuthorityHint(query: AuthorityCheckQuery): Promise<AuthorityCheckHint> {
  return call(checkAuthority, { query });
}
