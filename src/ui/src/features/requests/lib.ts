/**
 * Shared helpers of the requests feature (FR-04, FR-05): paths, permission sets, enum options, business error
 * messages, the actions a caller may take on a register row and the "next required action" of each record
 * (PRD §19).
 */
import {
  REQUEST_ACTION_PERMISSIONS,
  REQUEST_ACTION_STATUSES,
  REQUEST_READ,
  STRATEGY_READ,
} from '@contracts/requests';
import type {
  RequestAction,
  RequestDecisionView,
  RequestDetail,
  RequestRow,
  StrategyDetail,
} from '@contracts/requests';
import { enumValues } from '@contracts/enums';
import type { EnumName, ProcurementRequestsStatus } from '@contracts/enums';
import type { PermissionCode } from '@contracts/permissions';

import { ApiError } from '../../api/client';
import { hasTranslation, t, tEnum } from '../../lib/i18n';

export { REQUEST_READ, STRATEGY_READ };

/** The decision workspace (BUY-04) is open to reviewers, approvers, budget owners and readers of all requests. */
export const DECISION_READ = [
  'request.review',
  'request.approve',
  'request.funding_confirm',
  'request.view_all',
] as const satisfies readonly PermissionCode[];

export const REQUESTS_BASE = '/buyer/requests';
export const STRATEGIES_BASE = '/buyer/strategies';

export const requestPaths = {
  register: REQUESTS_BASE,
  create: `${REQUESTS_BASE}/new`,
  request: (id: number) => `${REQUESTS_BASE}/${id}`,
  edit: (id: number) => `${REQUESTS_BASE}/${id}/edit`,
  decision: (id: number) => `${REQUESTS_BASE}/${id}/decision`,
  strategies: STRATEGIES_BASE,
  newStrategy: (requestId?: number) =>
    requestId === undefined
      ? `${STRATEGIES_BASE}/new`
      : `${STRATEGIES_BASE}/new?requestId=${requestId}`,
  strategy: (id: number) => `${STRATEGIES_BASE}/${id}`,
  editStrategy: (id: number) => `${STRATEGIES_BASE}/${id}/edit`,
  contract: (id: number) => `/buyer/contracts/${id}`,
  planItem: (id: number) => `/buyer/planning/items/${id}`,
};

/** Select options of an enumeration, labelled through the catalogs. */
export function enumOptions<N extends EnumName>(name: N, only?: readonly string[]) {
  const values: readonly string[] = enumValues(name);
  return values
    .filter((value) => only === undefined || only.includes(value))
    .map((value) => ({ value, label: tEnum(name, value) }));
}

/**
 * The same failure with a clear business message: a declared error code (`AUTHORITY_EXCEEDED`) is explained
 * through the feature catalog; anything else keeps the server's problem detail.
 */
export function explainError(error: ApiError | null): ApiError | null {
  if (error === null || error.code === null) {
    return error;
  }
  const key = `requests.errors.${error.code}`;
  if (!hasTranslation(key)) {
    return error;
  }
  return new ApiError({
    // A refused business rule (403 AUTHORITY_EXCEEDED, SELF_APPROVAL_BLOCKED…) is shown with its explanation:
    // the shared error text for `forbidden` would only say "restricted", hiding the rule that applied.
    kind: error.kind === 'forbidden' ? 'conflict' : error.kind,
    status: error.status,
    title: error.title,
    code: error.code,
    detail: t(key),
    fieldErrors: error.fieldErrors,
    correlationId: error.correlationId,
    endpointId: error.endpointId,
  });
}

/** Actions a register row offers to a caller holding `permissions` (the API re-checks relationship and state). */
export function rowActions(
  status: ProcurementRequestsStatus,
  permissions: readonly string[],
): RequestAction[] {
  const candidates: RequestAction[] = [
    'assign',
    'defer',
    'route_to_contract',
    'combine',
    'reconsider',
    'close',
  ];
  return candidates.filter(
    (action) =>
      (REQUEST_ACTION_STATUSES[action] as readonly string[]).includes(status) &&
      permissions.includes(REQUEST_ACTION_PERMISSIONS[action]),
  );
}

/** Whether a request is still open (not decided or closed). */
export function isOpenRequest(status: ProcurementRequestsStatus): boolean {
  return ['submitted', 'under_review', 'information_requested'].includes(status);
}

/** The next required action on a request (PRD §19). */
export function requestNextAction(
  request: Pick<RequestDetail, 'status' | 'owner' | 'reapprovalRequired' | 'fundingStatus'> & {
    readonly strategy?: RequestDetail['strategy'];
    readonly decision?: Pick<RequestDetail['decision'], 'awaitingDecisionFrom'>;
  },
): string {
  if (request.reapprovalRequired) {
    return t('requests.next.reapproval');
  }
  // AC-05: once routed or escalated above the caller's authority, the next action is the other approver's decision.
  const awaiting = request.decision?.awaitingDecisionFrom ?? null;
  if (awaiting !== null && isOpenRequest(request.status)) {
    return t('requests.next.awaiting', { name: awaiting.fullName });
  }
  switch (request.status) {
    case 'draft':
      return t('requests.next.draft');
    case 'submitted':
      return request.owner === null ? t('requests.next.assign') : t('requests.next.review');
    case 'under_review':
      return request.fundingStatus === 'none' || request.fundingStatus === 'indicative'
        ? t('requests.next.funding')
        : t('requests.next.decide');
    case 'information_requested':
      return t('requests.next.respond');
    case 'approved':
      // PRD §8.1 approved → converted: the tender waits for the strategy approval appropriate to the route.
      if (request.strategy !== undefined && request.strategy !== null) {
        return request.strategy.status === 'approved'
          ? t('requests.next.convertApproved')
          : t('requests.next.strategyPending');
      }
      return t('requests.next.convert');
    case 'rejected':
    case 'withdrawn':
    case 'deferred':
      return t('requests.next.closeOrReconsider');
    default:
      return t('requests.next.none');
  }
}

/** The request's strategy blocks the tender: it exists and is not approved yet (PRD §8.1). */
export function strategyBlocksTender(
  request: Pick<RequestDetail, 'status' | 'strategy' | 'convertedTender'>,
): boolean {
  return (
    request.status === 'approved' &&
    request.convertedTender === null &&
    request.strategy !== null &&
    request.strategy.status !== 'approved'
  );
}

/** The next required action on a decision (PRD §19, AC-05). */
export function decisionNextAction(view: RequestDecisionView): string {
  if (view.segregation.blocked) {
    return t('requests.next.selfApproval');
  }
  if (view.awaitingDecisionFrom !== null && isOpenRequest(view.request.status)) {
    return t('requests.next.awaiting', { name: view.awaitingDecisionFrom.fullName });
  }
  if (
    view.callerAuthority !== null &&
    !view.callerAuthority.sufficient &&
    view.allowedActions.includes('decide')
  ) {
    return t('requests.next.escalate');
  }
  if (!view.funding.sufficientForApproval && isOpenRequest(view.request.status)) {
    return t('requests.next.funding');
  }
  return requestNextAction(view.request);
}

/** The next required action on a strategy (PRD §19). */
export function strategyNextAction(strategy: StrategyDetail): string {
  switch (strategy.status) {
    case 'draft':
      if (strategy.pendingFairnessReviews > 0) {
        return t('requests.next.strategy.fairness');
      }
      return strategy.submissionReadiness.some((item) => item.status === 'blocking')
        ? t('requests.next.strategy.complete')
        : t('requests.next.strategy.submit');
    case 'returned':
      return t('requests.next.strategy.revise');
    case 'awaiting_approval':
      return t('requests.next.strategy.approval');
    case 'approved': {
      if (strategy.eventType === 'rfi') {
        const outcome = strategy.rfiOutcome;
        if (outcome === null || outcome.reviewedAt === null) {
          return t('requests.next.strategy.rfi');
        }
        return outcome.nextEvent === null
          ? t('requests.next.none')
          : t('requests.next.strategy.followEvent', { reference: outcome.nextEvent.reference });
      }
      const [tender] = strategy.tenders;
      if (tender !== undefined) {
        return t('requests.next.strategy.followEvent', { reference: tender.reference });
      }
      return strategy.createTenderPath === null
        ? t('requests.next.none')
        : t('requests.next.strategy.tender');
    }
    default:
      return t('requests.next.none');
  }
}

/**
 * The first known currency: the record's own, then the organization's default or the first offered currency.
 * Never a literal code: an empty string leaves the currency to be chosen.
 */
export function currencyFallback(...candidates: readonly (string | null | undefined)[]): string {
  return (
    candidates.find(
      (candidate) => candidate !== null && candidate !== undefined && candidate !== '',
    ) ?? ''
  );
}

/** Trims a text input to `null` when empty. */
export function textOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** A numeric select value (`''` → `null`). */
export function idOrNull(value: string): number | null {
  return value === '' ? null : Number(value);
}

/** Selected id as a select value. */
export function idValue(value: { readonly id: number } | null | undefined): string {
  return value === null || value === undefined ? '' : String(value.id);
}

/** A person as a select value. */
export function personValue(value: { readonly userId: number } | null | undefined): string {
  return value === null || value === undefined ? '' : String(value.userId);
}

/** The row fields of a request detail (to refresh a decision view after a command). */
export function rowOf(detail: RequestDetail): RequestRow {
  return {
    id: detail.id,
    reference: detail.reference,
    title: detail.title,
    problemStatement: detail.problemStatement,
    requester: detail.requester,
    owner: detail.owner,
    category: detail.category,
    department: detail.department,
    estimatedValue: detail.estimatedValue,
    estimatedTotalCommitment: detail.estimatedTotalCommitment,
    fundingStatus: detail.fundingStatus,
    priority: detail.priority,
    status: detail.status,
    needType: detail.needType,
    targetDate: detail.targetDate,
    submittedAt: detail.submittedAt,
    ageDays: detail.ageDays,
    revision: detail.revision,
    reapprovalRequired: detail.reapprovalRequired,
    combinedInto: detail.combinedInto,
    deferredUntil: detail.deferredUntil,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
  };
}
