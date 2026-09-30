/**
 * Requests domain handlers (05): the request register, business case and funding decision (BUY-02, BUY-03, BUY-04).
 *
 * Visibility (PRD §4.3): `request.view_all` sees every non-draft request of the tenant; `request.create` alone sees
 * only the requests where the caller is requester, sponsor, owner or budget owner; a draft is visible to its parties
 * only. Another tenant's request is simply not found. Commands validate the business state the fixtures imply and
 * return a static outcome: nothing is persisted.
 */
import type { Money, PersonRef } from '../../../contracts/common.js';
import { compare, lt } from '../../../contracts/decimal.js';
import type { PermissionCode } from '../../../contracts/permissions.js';
import {
  REQUEST_ACTIONS,
  REQUEST_ACTION_PERMISSIONS,
  REQUEST_ACTION_STATUSES,
  REQUEST_MATERIAL_FIELDS,
  createTenderPath,
  requestEndpoints,
} from '../../../contracts/requests.js';
import type {
  ApprovalValueBasis,
  InfoRequest,
  ReadinessItem,
  RequestAction,
  RequestComment,
  RequestDecisionView,
  RequestDetail,
  RequestRow,
  RoutingOption,
} from '../../../contracts/requests.js';
import type { ProcurementRequestsStatus } from '../../../contracts/enums.js';
import { valueBandOf } from '../../../contracts/policy.js';
import type { CustomFieldContext, CustomFieldValues } from '../../../contracts/policy.js';
import { mockRoute } from '../../app.js';
import { acceptCustomFields, customFieldIssues, customFieldValuesOf } from '../../custom-fields.js';
import type { MockApp, MockHandlerContext } from '../../app.js';
import type { AnyEndpoint } from '../../../contracts/endpoint.js';
import {
  BUDGET_PERIODS,
  CATEGORIES,
  CONTRACTS,
  COST_CENTERS,
  DEPARTMENTS,
  FUNDING_SOURCES,
  INFO_REQUESTS,
  LEGAL_ENTITIES,
  PLAN_ITEMS,
  PROJECTS,
  REQUESTS,
  REQUEST_COMMENTS,
  REQUEST_DECISIONS,
  REQUEST_LINKS,
  REQUEST_REVISIONS,
  STRATEGIES,
  SUPPLIER_TENANTS,
} from '../../fixtures/requests/index.js';
import type { FixtureInfoRequest, FixtureRequest } from '../../fixtures/requests/index.js';
import { personRef } from '../../persona.js';
import {
  NEW_ID,
  actorRef,
  approverRoute,
  authorityCheck,
  categoryRef,
  contentHash,
  contractRef,
  costCenterRef,
  daysBetween,
  dateInZone,
  departmentRef,
  fundingSourceRef,
  hasPermission,
  legalEntityRef,
  matchesSearch,
  personOrNull,
  projectRef,
  requestRefOf,
  sortRows,
  sumMoney,
  supplierRef,
  tenantPeople,
  tenantTimeZone,
  tenderRef,
} from './lookup.js';
import type { SortValue } from './lookup.js';

// ---------------------------------------------------------------------------------------------------------
// Viewer and visibility
// ---------------------------------------------------------------------------------------------------------

export interface Viewer {
  readonly tenantId: number;
  readonly userId: number;
  readonly permissions: ReadonlySet<PermissionCode>;
  readonly authorityLimit: Money | null;
  readonly now: Date;
}

export function viewerOf<E extends AnyEndpoint>(ctx: MockHandlerContext<E>): Viewer {
  const access = ctx.requireTenant();
  const persona = ctx.requirePersona();
  return {
    tenantId: access.tenant.id,
    userId: persona.userId,
    permissions: new Set(access.permissions),
    authorityLimit: access.membership?.authorityLimit ?? null,
    now: ctx.now,
  };
}

export function isParty(row: FixtureRequest, userId: number): boolean {
  return [row.requesterUserId, row.sponsorUserId, row.ownerUserId, row.budgetOwnerUserId].includes(userId);
}

export function canSeeRequest(row: FixtureRequest, viewer: Viewer): boolean {
  if (row.tenantId !== viewer.tenantId) {
    return false;
  }
  const party = isParty(row, viewer.userId);
  if (row.status === 'draft' && !party) {
    return false;
  }
  return party || viewer.permissions.has('request.view_all');
}

function findVisible<E extends AnyEndpoint>(ctx: MockHandlerContext<E>, viewer: Viewer, requestId: number): FixtureRequest {
  const row = REQUESTS.find((candidate) => candidate.id === requestId);
  if (row === undefined || !canSeeRequest(row, viewer)) {
    return ctx.notFound('No such procurement request.');
  }
  return row;
}

// ---------------------------------------------------------------------------------------------------------
// Projections
// ---------------------------------------------------------------------------------------------------------

const OPEN_STATUSES: readonly ProcurementRequestsStatus[] = ['submitted', 'under_review', 'information_requested', 'approved'];
const DECIDED_STATUSES: readonly ProcurementRequestsStatus[] = [
  'approved',
  'rejected',
  'withdrawn',
  'deferred',
  'converted',
  'routed_to_existing',
  'rescinded',
  'closed',
];

function combinedSources(row: FixtureRequest): FixtureRequest[] {
  return REQUESTS.filter((candidate) => candidate.combinedIntoId === row.id && candidate.tenantId === row.tenantId);
}

/**
 * The whole contemplated commitment of one request: the larger of the estimated total commitment (options,
 * renewals, associated purchases) and the estimated value (FR-04, BR-06). Either may be missing on a draft.
 */
export function commitmentOf(row: FixtureRequest): Money | null {
  const { estimatedValue, estimatedTotalCommitment } = row;
  if (estimatedTotalCommitment === null) {
    return estimatedValue;
  }
  if (estimatedValue === null || estimatedValue.currency !== estimatedTotalCommitment.currency) {
    return estimatedTotalCommitment;
  }
  return compare(estimatedTotalCommitment.amount, estimatedValue.amount) >= 0 ? estimatedTotalCommitment : estimatedValue;
}

/** The estimated value of the request, summed with every request combined into it (what a split must add up to). */
export function estimateValue(row: FixtureRequest, extra: readonly FixtureRequest[] = []): Money | null {
  const sources = [...combinedSources(row), ...extra];
  if (sources.length === 0) {
    return row.estimatedValue;
  }
  const values = [row, ...sources].map((request) => request.estimatedValue).filter((value): value is Money => value !== null);
  return sumMoney(values) ?? row.estimatedValue;
}

/**
 * The value the approval route and the authority check use: the total contemplated commitment, and for a combined
 * request the sum of every original's commitment (FR-04, docs/technical/05-lifecycles.md). A split never lowers it.
 */
export function approvalValue(row: FixtureRequest, extra: readonly FixtureRequest[] = []): Money | null {
  const sources = [...combinedSources(row), ...extra];
  if (sources.length === 0) {
    return commitmentOf(row);
  }
  const values = [row, ...sources].map(commitmentOf).filter((value): value is Money => value !== null);
  return sumMoney(values) ?? commitmentOf(row);
}

/** Which figure `approvalValue` took: the estimate alone, or a commitment that goes beyond it. */
export function approvalBasis(row: FixtureRequest, extra: readonly FixtureRequest[] = []): ApprovalValueBasis {
  const sources = [...combinedSources(row), ...extra];
  const all = [row, ...sources];
  const beyondEstimate = all.some((request) => {
    const commitment = commitmentOf(request);
    return commitment !== null && (request.estimatedValue === null || compare(commitment.amount, request.estimatedValue.amount) > 0);
  });
  if (sources.length > 0) {
    return beyondEstimate ? 'aggregate_commitment' : 'aggregate_value';
  }
  return beyondEstimate ? 'total_commitment' : 'own_value';
}

const APPROVAL_BASIS_EXPLANATION: Record<ApprovalValueBasis, string> = {
  own_value: 'The request is approved on its estimated value; no options, renewals or associated purchases add to it.',
  total_commitment:
    'The request is approved on its total contemplated commitment, including options, renewals and associated purchases, not on the initial estimate alone.',
  aggregate_value: 'Combined requests are approved on their aggregate value; splitting never lowers the value used for the approval route.',
  aggregate_commitment:
    'Combined requests are approved on the sum of every original’s total contemplated commitment, including options and renewals; splitting never lowers it.',
};

export function approvalBasisExplanation(row: FixtureRequest, extra: readonly FixtureRequest[] = []): string {
  const sources = [...combinedSources(row), ...extra];
  const basis = approvalBasis(row, extra);
  const text = APPROVAL_BASIS_EXPLANATION[basis];
  return sources.length > 0 ? `${text} Combined: ${sources.map((source) => source.reference).join(', ')} (FR-04).` : text;
}

export function reapprovalRequired(row: FixtureRequest): boolean {
  return row.materialChange !== null && !DECIDED_STATUSES.includes(row.status);
}

export function rowOf(row: FixtureRequest, now: Date): RequestRow {
  const combinedInto = row.combinedIntoId === null ? null : REQUESTS.find((candidate) => candidate.id === row.combinedIntoId);
  const started = row.submittedAt ?? row.createdAt;
  const ended = DECIDED_STATUSES.includes(row.status) && row.decidedAt !== null ? new Date(row.decidedAt) : now;
  return {
    id: row.id,
    reference: row.reference,
    title: row.title,
    problemStatement: row.problemStatement,
    requester: personRef(row.requesterUserId),
    owner: personOrNull(row.ownerUserId),
    category: categoryRef(row.tenantId, row.categoryId),
    department: departmentRef(row.tenantId, row.departmentId),
    estimatedValue: row.estimatedValue,
    estimatedTotalCommitment: row.estimatedTotalCommitment,
    fundingStatus: row.fundingStatus,
    priority: row.priority,
    status: row.status,
    needType: row.needType,
    targetDate: row.targetDate,
    submittedAt: row.submittedAt,
    ageDays: daysBetween(started, ended),
    revision: row.revision,
    reapprovalRequired: reapprovalRequired(row),
    combinedInto: combinedInto === undefined || combinedInto === null ? null : requestRefOf(combinedInto),
    deferredUntil: row.deferredUntil,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** The stored custom field values of a request (this command's values, else the recorded ones). */
function customValuesOf(row: FixtureRequest): CustomFieldValues {
  return { ...(row.customFields ?? customFieldValuesOf(row.tenantId, 'procurement_request', row.id)) };
}

/** The core values the request form's conditional custom fields read (category and value band). */
function customContextOf(row: FixtureRequest): CustomFieldContext {
  return {
    category_code: CATEGORIES.find((category) => category.id === row.categoryId)?.code ?? null,
    value_band: row.estimatedValue === null ? null : valueBandOf(row.estimatedValue.amount),
  };
}

function submissionReadiness(row: FixtureRequest): ReadinessItem[] {
  const required: [string, string, unknown][] = [
    ['problemStatement', 'Problem or opportunity', row.problemStatement],
    ['expectedOutcomes', 'Expected outcomes', row.expectedOutcomes],
    ['scopeDescription', 'Scope', row.scopeDescription],
    ['quantities', 'Quantities or service volumes', row.quantities],
    ['deliveryLocations', 'Delivery locations', row.deliveryLocations],
    ['targetDate', 'Target date', row.targetDate],
    ['consequenceOfDelay', 'Consequence of delay', row.consequenceOfDelay],
    ['estimatedValue', 'Estimated value and currency', row.estimatedValue],
    ['estimationBasis', 'Estimation basis', row.estimationBasis],
    ['fundingSourceId', 'Funding source', row.fundingSourceId],
    ['budgetOwnerUserId', 'Budget owner', row.budgetOwnerUserId],
    ['estimatedTotalCommitment', 'Estimated total commitment', row.estimatedTotalCommitment],
  ];
  const items: ReadinessItem[] = required.map(([id, label, value]) => ({
    id,
    label,
    status: value === null || value === '' ? 'blocking' : 'passed',
    detail: value === null || value === '' ? 'Required before submission.' : null,
  }));
  const recommended: [string, string, unknown][] = [
    ['stakeholders', 'Stakeholders', row.stakeholders],
    ['constraints', 'Known constraints', row.constraints],
    ['risks', 'Risks', row.risks],
    ['contractTermMonths', 'Proposed contract term', row.contractTermMonths],
    ['accountingReference', 'Accounting or project reference', row.accountingReference],
  ];
  for (const [id, label, value] of recommended) {
    items.push({ id, label, status: value === null || value === '' ? 'warning' : 'passed', detail: value === null || value === '' ? 'Recommended for the decision.' : null });
  }
  const fundingOk = row.fundingStatus === 'approved_budget' || row.fundingStatus === 'firm_commitment';
  items.push({
    id: 'fundingStatus',
    label: 'Funding status',
    status: fundingOk ? 'passed' : 'warning',
    detail: fundingOk ? null : 'Funding is not yet an approved budget or a firm commitment; approval needs one of them.',
  });
  if (row.needType !== 'new_expenditure') {
    items.push({
      id: 'replacesContractId',
      label: 'Contract replaced or extended',
      status: row.replacesContractId === null ? 'blocking' : 'passed',
      detail: row.replacesContractId === null ? 'Name the contract this request replaces or extends.' : null,
    });
  }
  for (const issue of customFieldIssues(row.tenantId, 'procurement_request', customValuesOf(row), customContextOf(row), true)) {
    items.push({ id: `customFields.${issue.key}`, label: issue.message, status: 'blocking', detail: 'Required before submission.' });
  }
  return items;
}

function hasOpenInfoRequest(row: FixtureRequest, extraAnswered: number | null = null): boolean {
  return INFO_REQUESTS.some((info) => info.requestId === row.id && info.status === 'open' && info.id !== extraAnswered);
}

function strategyOf(row: FixtureRequest) {
  return STRATEGIES.find((strategy) => strategy.requestId === row.id && strategy.tenantId === row.tenantId && strategy.status !== 'superseded');
}

export function requestActions(row: FixtureRequest, viewer: Viewer): RequestAction[] {
  const party = isParty(row, viewer.userId);
  const callerAuthority = authorityCheck(viewer.authorityLimit, 'request_approval', approvalValue(row));
  const route = approverRoute(row.tenantId, 'request.approve', 'request_approval', approvalValue(row));
  const routedToEligible =
    row.approval?.currentApproverUserId !== null &&
    row.approval?.currentApproverUserId !== undefined &&
    route.eligible.some((approver) => approver.userId === row.approval?.currentApproverUserId);
  return REQUEST_ACTIONS.filter((action) => {
    if (!(REQUEST_ACTION_STATUSES[action] as readonly ProcurementRequestsStatus[]).includes(row.status)) {
      return false;
    }
    if (!viewer.permissions.has(REQUEST_ACTION_PERMISSIONS[action])) {
      return false;
    }
    switch (action) {
      case 'edit':
      case 'withdraw':
        return party;
      case 'submit':
        return party && !hasOpenInfoRequest(row) && !submissionReadiness(row).some((item) => item.status === 'blocking');
      case 'respond_info':
        return party && hasOpenInfoRequest(row);
      case 'decide':
        return row.requesterUserId !== viewer.userId && callerAuthority.sufficient;
      case 'escalate':
        return !callerAuthority.sufficient && route.eligible.length > 0 && !routedToEligible;
      case 'create_tender': {
        // PRD §8.1 approved → converted: strategy approval appropriate to the route. Without a strategy the tender
        // wizard records it; with one, only its approved revision may be converted.
        const strategy = strategyOf(row);
        return !reapprovalRequired(row) && row.convertedTenderId === null && (strategy === undefined || strategy.status === 'approved');
      }
      case 'create_strategy':
        return !reapprovalRequired(row) && strategyOf(row) === undefined;
      default:
        return true;
    }
  });
}

/** The latest entry of the decision history (an escalation counts), or the row's own decision when it is newer. */
function latestDecisionOf(row: FixtureRequest): RequestDetail['decision']['latest'] {
  const latest = REQUEST_DECISIONS.filter((decision) => decision.requestId === row.id && decision.tenantId === row.tenantId).reduce<
    (typeof REQUEST_DECISIONS)[number] | null
  >((found, decision) => (found === null || decision.decidedAt > found.decidedAt ? decision : found), null);
  if (latest === null || (row.decidedAt !== null && row.decidedAt > latest.decidedAt)) {
    return null;
  }
  return { decision: latest.decision, decidedBy: actorRef(row.tenantId, latest.decidedByUserId), decidedAt: latest.decidedAt, reason: latest.reason };
}

export interface DetailOverrides {
  readonly combinedExtra?: readonly FixtureRequest[];
  readonly infoRequests?: readonly FixtureInfoRequest[];
}

/** The pending approval's current approver when that is someone other than the viewer (routed or escalated, AC-05). */
export function awaitingDecisionFrom(row: FixtureRequest, viewer: Viewer): PersonRef | null {
  const approverId = row.approval?.status === 'pending' ? row.approval.currentApproverUserId : null;
  if (approverId === null || approverId === viewer.userId || !isOpenStatus(row.status)) {
    return null;
  }
  return personOrNull(approverId);
}

function isOpenStatus(status: ProcurementRequestsStatus): boolean {
  return status === 'submitted' || status === 'under_review' || status === 'information_requested';
}

export function detailOf(row: FixtureRequest, viewer: Viewer, overrides: DetailOverrides = {}): RequestDetail {
  const tenantId = row.tenantId;
  const planItem = PLAN_ITEMS.find((item) => item.requestId === row.id && item.tenantId === tenantId);
  const strategy = strategyOf(row);
  const links = REQUEST_LINKS.filter((link) => link.tenantId === tenantId && (link.fromRequestId === row.id || link.toRequestId === row.id)).flatMap(
    (link) => {
      const otherId = link.fromRequestId === row.id ? link.toRequestId : link.fromRequestId;
      const other = REQUESTS.find((candidate) => candidate.id === otherId);
      if (other === undefined) {
        return [];
      }
      return [
        {
          id: link.id,
          linkType: link.linkType,
          direction: link.fromRequestId === row.id ? ('outgoing' as const) : ('incoming' as const),
          request: requestRefOf(other),
          requester: personRef(other.requesterUserId),
          estimatedValue: other.estimatedValue,
          fundingStatus: other.fundingStatus,
          note: link.note,
        },
      ];
    },
  );
  const infoRows = overrides.infoRequests ?? INFO_REQUESTS.filter((info) => info.requestId === row.id && info.tenantId === tenantId);
  const sources = [...combinedSources(row), ...(overrides.combinedExtra ?? [])];
  const value = approvalValue(row, overrides.combinedExtra ?? []);
  const combinedValue = sources.length === 0 ? null : estimateValue(row, overrides.combinedExtra ?? []);
  const revisions = REQUEST_REVISIONS.filter((revision) => revision.requestId === row.id && revision.tenantId === tenantId);
  const allowed = requestActions(row, viewer);
  return {
    ...rowOf(row, viewer.now),
    sponsor: personOrNull(row.sponsorUserId),
    budgetOwner: personOrNull(row.budgetOwnerUserId),
    legalEntity: legalEntityRef(tenantId, row.legalEntityId),
    costCenter: costCenterRef(tenantId, row.costCenterId),
    fundingSource: fundingSourceRef(tenantId, row.fundingSourceId),
    project: projectRef(tenantId, row.projectId),
    expectedOutcomes: row.expectedOutcomes,
    scopeDescription: row.scopeDescription,
    quantities: row.quantities,
    deliveryLocations: row.deliveryLocations,
    constraints: row.constraints,
    stakeholders: row.stakeholders,
    consequenceOfDelay: row.consequenceOfDelay,
    risks: row.risks,
    replacesContract: contractRef(tenantId, row.replacesContractId),
    estimationBasis: row.estimationBasis,
    accountingReference: row.accountingReference,
    contractTermMonths: row.contractTermMonths,
    renewalOptions: row.renewalOptions,
    routedContract: contractRef(tenantId, row.routedContractId),
    convertedTender: tenderRef(tenantId, row.convertedTenderId),
    planItem: planItem === undefined ? null : { id: planItem.id, title: planItem.title, status: planItem.status },
    strategy:
      strategy === undefined ? null : { id: strategy.id, revision: strategy.revision, procedure: strategy.procedure, status: strategy.status },
    decision: { decidedAt: row.decidedAt, decisionReason: row.decisionReason, deferredUntil: row.deferredUntil, latest: latestDecisionOf(row), awaitingDecisionFrom: awaitingDecisionFrom(row, viewer) },
    links,
    infoRequests: infoRows.map(infoRequestOf),
    revisions:
      revisions.length > 0
        ? revisions.map((revision) => ({
            revision: revision.revision,
            createdAt: revision.createdAt,
            createdBy: personRef(revision.createdByUserId),
            changeSummary: revision.changeSummary,
            changedFields: [...revision.changedFields],
            material: revision.material,
          }))
        : [
            {
              revision: row.revision,
              createdAt: row.createdAt,
              createdBy: personRef(row.requesterUserId),
              changeSummary: 'Request created.',
              changedFields: [],
              material: false,
            },
          ],
    materialChange:
      row.materialChange === null
        ? null
        : {
            approvedRevision: row.materialChange.approvedRevision,
            currentRevision: row.revision,
            changedFields: [...row.materialChange.changedFields],
            detectedAt: row.materialChange.detectedAt,
            approvalInvalidated: true,
          },
    valueBasis: {
      ownValue: row.estimatedValue,
      combinedValue,
      totalCommitment: row.estimatedTotalCommitment,
      approvalValue: value,
      basis: approvalBasis(row, overrides.combinedExtra ?? []),
      explanation: approvalBasisExplanation(row, overrides.combinedExtra ?? []),
    },
    submissionReadiness: submissionReadiness(row),
    allowedActions: allowed,
    createTenderPath: allowed.includes('create_tender') ? createTenderPath(row.id) : null,
    approvalId: row.approval?.approvalId ?? null,
    customFields: customValuesOf(row),
  };
}

function infoRequestOf(info: FixtureInfoRequest): InfoRequest {
  return {
    id: info.id,
    question: info.question,
    requestedBy: personRef(info.requestedByUserId),
    requestedAt: info.requestedAt,
    dueAt: info.dueAt,
    responseText: info.responseText,
    respondedBy: personOrNull(info.respondedByUserId),
    respondedAt: info.respondedAt,
    status: info.status,
  };
}

export function decisionViewOf(row: FixtureRequest, viewer: Viewer, extras: { comments?: RequestComment[]; history?: RequestDecisionView['history'] } = {}): RequestDecisionView {
  const value = approvalValue(row);
  const route = approverRoute(row.tenantId, 'request.approve', 'request_approval', value);
  const funding = row.funding;
  const fundingSufficient = row.fundingStatus === 'approved_budget' || row.fundingStatus === 'firm_commitment';
  const callerIsRequester = row.requesterUserId === viewer.userId;
  return {
    request: rowOf(row, viewer.now),
    subjectRevision: row.revision,
    contentHash: contentHash('procurement_request', row.id, row.revision),
    requestedAuthority: {
      decisionType: 'request_approval',
      amount: value,
      basis: approvalBasis(row),
      explanation: approvalBasisExplanation(row),
    },
    callerAuthority: viewer.permissions.has('request.approve') ? authorityCheck(viewer.authorityLimit, 'request_approval', value) : null,
    eligibleApprovers: route.eligible,
    routedToNextLevel: route.routedToNextLevel,
    skippedLevel: route.skipped,
    route: {
      approvalId: row.approval?.approvalId ?? null,
      status: row.approval?.status ?? null,
      currentApprover: personOrNull(row.approval?.currentApproverUserId ?? null),
      requestedAt: row.approval?.requestedAt ?? null,
      dueAt: row.approval?.dueAt ?? null,
    },
    awaitingDecisionFrom: awaitingDecisionFrom(row, viewer),
    funding: {
      status: row.fundingStatus,
      fundingSource: fundingSourceRef(row.tenantId, row.fundingSourceId),
      budgetOwner: personOrNull(row.budgetOwnerUserId),
      confirmedAmount: funding?.confirmedAmount ?? null,
      confirmedBy: personOrNull(funding?.confirmedByUserId ?? null),
      confirmedAt: funding?.confirmedAt ?? null,
      accountingReference: row.accountingReference,
      note: funding?.note ?? null,
      sufficientForApproval: fundingSufficient,
    },
    comments: [
      ...REQUEST_COMMENTS.filter((comment) => comment.requestId === row.id && comment.tenantId === row.tenantId).map((comment) => ({
        id: comment.id,
        author: actorRef(row.tenantId, comment.authorUserId),
        kind: comment.kind,
        text: comment.text,
        createdAt: comment.createdAt,
      })),
      ...(extras.comments ?? []),
    ],
    conditions: row.approvalConditions,
    approvedVersion:
      row.approvedRevision === null || row.approvedAt === null || row.approvedByUserId === null
        ? null
        : {
            revision: row.approvedRevision,
            contentHash: contentHash('procurement_request', row.id, row.approvedRevision),
            approvedAt: row.approvedAt,
            approvedBy: actorRef(row.tenantId, row.approvedByUserId),
            conditions: row.approvalConditions,
            approvedValue: row.approvedValue,
          },
    reapprovalRequired: reapprovalRequired(row),
    materialChange:
      row.materialChange === null
        ? null
        : {
            approvedRevision: row.materialChange.approvedRevision,
            currentRevision: row.revision,
            changedFields: [...row.materialChange.changedFields],
            detectedAt: row.materialChange.detectedAt,
            approvalInvalidated: true,
          },
    history: [
      ...REQUEST_DECISIONS.filter((decision) => decision.requestId === row.id && decision.tenantId === row.tenantId).map((decision) => ({
        id: decision.id,
        decision: decision.decision,
        decidedBy: actorRef(row.tenantId, decision.decidedByUserId),
        decidedAt: decision.decidedAt,
        revision: decision.revision,
        reason: decision.reason,
      })),
      ...(extras.history ?? []),
    ],
    segregation: { rule: 'requester_vs_request_approval', callerIsRequester, blocked: callerIsRequester },
    allowedActions: requestActions(row, viewer),
  };
}

// ---------------------------------------------------------------------------------------------------------
// Validation helpers for commands
// ---------------------------------------------------------------------------------------------------------

function nowIso(now: Date): string {
  return `${now.toISOString().slice(0, 19)}Z`;
}

function requireStatus<E extends AnyEndpoint>(
  ctx: MockHandlerContext<E>,
  row: FixtureRequest,
  action: RequestAction,
): void {
  if (!(REQUEST_ACTION_STATUSES[action] as readonly ProcurementRequestsStatus[]).includes(row.status)) {
    ctx.fail(409, 'INVALID_TRANSITION', `A request in status ${row.status} cannot be changed this way.`);
  }
}

function requireParty<E extends AnyEndpoint>(ctx: MockHandlerContext<E>, row: FixtureRequest, viewer: Viewer): void {
  if (!isParty(row, viewer.userId)) {
    ctx.fail(403, 'NOT_REQUEST_PARTY', 'Only the requester, sponsor, owner or budget owner can do this.');
  }
}

function requireRevision<E extends AnyEndpoint>(ctx: MockHandlerContext<E>, row: FixtureRequest, revision: number): void {
  if (revision !== row.revision) {
    ctx.fail(409, 'REVISION_CONFLICT', `The request is now at revision ${row.revision}; reload before continuing.`);
  }
}

interface BusinessCaseInput {
  readonly title: string;
  readonly problemStatement?: string | null | undefined;
  readonly expectedOutcomes?: string | null | undefined;
  readonly scopeDescription?: string | null | undefined;
  readonly quantities?: string | null | undefined;
  readonly deliveryLocations?: string | null | undefined;
  readonly targetDate?: string | null | undefined;
  readonly constraints?: string | null | undefined;
  readonly stakeholders?: string | null | undefined;
  readonly consequenceOfDelay?: string | null | undefined;
  readonly risks?: string | null | undefined;
  readonly needType: FixtureRequest['needType'];
  readonly replacesContractId?: number | null | undefined;
  readonly legalEntityId?: number | null | undefined;
  readonly departmentId?: number | null | undefined;
  readonly categoryId?: number | null | undefined;
  readonly costCenterId?: number | null | undefined;
  readonly fundingSourceId?: number | null | undefined;
  readonly projectId?: number | null | undefined;
  readonly sponsorUserId?: number | null | undefined;
  readonly budgetOwnerUserId?: number | null | undefined;
  readonly estimatedValue?: Money | null | undefined;
  readonly estimationBasis?: string | null | undefined;
  readonly accountingReference?: string | null | undefined;
  readonly contractTermMonths?: number | null | undefined;
  readonly renewalOptions?: string | null | undefined;
  readonly estimatedTotalCommitment?: Money | null | undefined;
  readonly fundingStatus: FixtureRequest['fundingStatus'];
  readonly priority: FixtureRequest['priority'];
}

function orNull<T>(value: T | null | undefined): T | null {
  return value === undefined || value === '' ? null : value;
}

/** Checks every referenced record exists in the caller's tenant (`REFERENCE_NOT_FOUND`). */
function checkReferences<E extends AnyEndpoint>(ctx: MockHandlerContext<E>, tenantId: number, body: BusinessCaseInput): void {
  const people = tenantPeople(tenantId);
  const checks: [string, number | null | undefined, (id: number) => boolean][] = [
    ['legalEntityId', body.legalEntityId, (id) => LEGAL_ENTITIES.some((row) => row.id === id && row.tenantId === tenantId)],
    ['departmentId', body.departmentId, (id) => DEPARTMENTS.some((row) => row.id === id && row.tenantId === tenantId)],
    ['categoryId', body.categoryId, (id) => CATEGORIES.some((row) => row.id === id && row.tenantId === tenantId)],
    ['costCenterId', body.costCenterId, (id) => COST_CENTERS.some((row) => row.id === id && row.tenantId === tenantId)],
    ['fundingSourceId', body.fundingSourceId, (id) => FUNDING_SOURCES.some((row) => row.id === id && row.tenantId === tenantId)],
    ['projectId', body.projectId, (id) => PROJECTS.some((row) => row.id === id && row.tenantId === tenantId)],
    ['replacesContractId', body.replacesContractId, (id) => CONTRACTS.some((row) => row.id === id && row.tenantId === tenantId)],
    ['sponsorUserId', body.sponsorUserId, (id) => people.some((person) => person.userId === id)],
    ['budgetOwnerUserId', body.budgetOwnerUserId, (id) => people.some((person) => person.userId === id && hasPermission(person, 'request.funding_confirm'))],
  ];
  for (const [field, id, exists] of checks) {
    if (id !== null && id !== undefined && !exists(id)) {
      ctx.fail(422, 'REFERENCE_NOT_FOUND', `${field} does not name a record of this organization.`);
    }
  }
}

function applyBusinessCase(row: FixtureRequest, body: BusinessCaseInput): FixtureRequest {
  return {
    ...row,
    title: body.title,
    problemStatement: orNull(body.problemStatement),
    expectedOutcomes: orNull(body.expectedOutcomes),
    scopeDescription: orNull(body.scopeDescription),
    quantities: orNull(body.quantities),
    deliveryLocations: orNull(body.deliveryLocations),
    targetDate: orNull(body.targetDate),
    constraints: orNull(body.constraints),
    stakeholders: orNull(body.stakeholders),
    consequenceOfDelay: orNull(body.consequenceOfDelay),
    risks: orNull(body.risks),
    needType: body.needType,
    replacesContractId: orNull(body.replacesContractId),
    legalEntityId: orNull(body.legalEntityId),
    departmentId: orNull(body.departmentId),
    categoryId: orNull(body.categoryId),
    costCenterId: orNull(body.costCenterId),
    fundingSourceId: orNull(body.fundingSourceId),
    projectId: orNull(body.projectId),
    sponsorUserId: orNull(body.sponsorUserId),
    budgetOwnerUserId: orNull(body.budgetOwnerUserId),
    estimatedValue: orNull(body.estimatedValue),
    estimationBasis: orNull(body.estimationBasis),
    accountingReference: orNull(body.accountingReference),
    contractTermMonths: orNull(body.contractTermMonths),
    renewalOptions: orNull(body.renewalOptions),
    estimatedTotalCommitment: orNull(body.estimatedTotalCommitment),
    fundingStatus: body.fundingStatus,
    priority: body.priority,
  };
}

const COMPARED_FIELDS = [
  'title',
  'problemStatement',
  'expectedOutcomes',
  'scopeDescription',
  'quantities',
  'deliveryLocations',
  'targetDate',
  'constraints',
  'stakeholders',
  'consequenceOfDelay',
  'risks',
  'needType',
  'replacesContractId',
  'legalEntityId',
  'departmentId',
  'categoryId',
  'costCenterId',
  'fundingSourceId',
  'projectId',
  'sponsorUserId',
  'budgetOwnerUserId',
  'estimatedValue',
  'estimationBasis',
  'accountingReference',
  'contractTermMonths',
  'renewalOptions',
  'estimatedTotalCommitment',
  'fundingStatus',
  'priority',
] as const satisfies readonly (keyof FixtureRequest)[];

function sameValue(left: unknown, right: unknown): boolean {
  if (typeof left === 'object' && left !== null && typeof right === 'object' && right !== null) {
    const a = left as Money;
    const b = right as Money;
    return a.currency === b.currency && Number(a.amount) === Number(b.amount);
  }
  return left === right;
}

function changedFields(before: FixtureRequest, after: FixtureRequest): string[] {
  const changed: string[] = COMPARED_FIELDS.filter((field) => !sameValue(before[field], after[field]));
  const customBefore = customValuesOf(before);
  const customAfter = customValuesOf(after);
  const keys = new Set([...Object.keys(customBefore), ...Object.keys(customAfter)]);
  if ([...keys].some((key) => (customBefore[key] ?? null) !== (customAfter[key] ?? null))) {
    changed.push('customFields');
  }
  return changed;
}

const PRIORITY_ORDER = { low: 0, normal: 1, high: 2, critical: 3 } as const;

function eligibleContract(row: FixtureRequest, contractId: number): RoutingOption | null {
  return routingOptionsOf(row).find((option) => option.id === contractId) ?? null;
}

function routingOptionsOf(row: FixtureRequest): RoutingOption[] {
  const value = approvalValue(row);
  const requestCategory = CATEGORIES.find((category) => category.id === row.categoryId);
  return CONTRACTS.filter((contract) => contract.tenantId === row.tenantId).map((contract) => {
    const reasons: string[] = [];
    if (contract.status !== 'active') {
      reasons.push(contract.status === 'expired' ? `Expired on ${contract.expiresOn}.` : 'Not yet signed and effective.');
    }
    const contractCategory = CATEGORIES.find((category) => category.id === contract.categoryId);
    const sameCategory =
      requestCategory !== undefined &&
      contractCategory !== undefined &&
      (requestCategory.id === contractCategory.id || requestCategory.parentId === contractCategory.id);
    if (!sameCategory) {
      reasons.push(`Scope covers ${contractCategory?.name ?? 'another category'}, not the requested category.`);
    }
    let remaining: Money | null = null;
    if (contract.ceiling === null) {
      reasons.push('No ceiling value is recorded for this contract.');
    } else {
      remaining = { amount: (Number(contract.ceiling.amount) - Number(contract.committed.amount)).toFixed(2), currency: contract.ceiling.currency };
      if (value !== null && lt(remaining.amount, value.amount)) {
        reasons.push('The remaining ceiling is below the request value.');
      }
    }
    const supplier = supplierRef(contract.supplierTenantId);
    return {
      id: contract.id,
      reference: contract.reference,
      title: contract.title,
      supplier: supplier ?? { tenantId: contract.supplierTenantId, name: 'Supplier' },
      category: categoryRef(row.tenantId, contract.categoryId),
      status: contract.status,
      expiresOn: contract.expiresOn,
      ceiling: contract.ceiling,
      remainingCeiling: remaining,
      eligible: reasons.length === 0,
      reasons: reasons.length === 0 ? ['Active, same scope and enough remaining ceiling.'] : reasons,
    };
  });
}

// ---------------------------------------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------------------------------------

const SORT_KEYS: Record<string, (row: RequestRow) => SortValue> = {
  reference: (row) => row.reference,
  title: (row) => row.title,
  submittedAt: (row) => row.submittedAt,
  estimatedValue: (row) => row.estimatedValue,
  priority: (row) => PRIORITY_ORDER[row.priority],
  status: (row) => row.status,
  targetDate: (row) => row.targetDate,
  ageDays: (row) => row.ageDays,
};

export function registerRequests(app: MockApp): void {
  const e = requestEndpoints;

  mockRoute(app, e.listRequests, (ctx) => {
    const viewer = viewerOf(ctx);
    const { query } = ctx;
    const today = dateInZone(ctx.now, tenantTimeZone(viewer.tenantId));
    const rows = REQUESTS.filter((row) => canSeeRequest(row, viewer))
      .filter((row) => query.status === undefined || query.status.includes(row.status))
      .filter((row) => query.priority === undefined || query.priority.includes(row.priority))
      .filter((row) => query.fundingStatus === undefined || query.fundingStatus.includes(row.fundingStatus))
      .filter((row) => query.ownerUserId === undefined || row.ownerUserId === query.ownerUserId)
      .filter((row) => query.requesterUserId === undefined || row.requesterUserId === query.requesterUserId)
      .filter((row) => query.categoryId === undefined || row.categoryId === query.categoryId)
      .filter((row) => query.departmentId === undefined || row.departmentId === query.departmentId)
      .filter((row) => query.mine !== true || isParty(row, viewer.userId))
      .filter((row) => query.unassigned !== true || row.ownerUserId === null)
      .filter((row) => query.submittedFrom === undefined || (row.submittedAt !== null && row.submittedAt.slice(0, 10) >= query.submittedFrom))
      .filter((row) => query.submittedTo === undefined || (row.submittedAt !== null && row.submittedAt.slice(0, 10) <= query.submittedTo))
      .filter((row) => query.targetFrom === undefined || (row.targetDate !== null && row.targetDate >= query.targetFrom))
      .filter((row) => query.targetTo === undefined || (row.targetDate !== null && row.targetDate <= query.targetTo))
      .filter((row) => matchesSearch(query.q, [row.reference, row.title, row.problemStatement]))
      .map((row) => rowOf(row, ctx.now));
    const key = query.sort === undefined ? null : (SORT_KEYS[query.sort] ?? null);
    const sorted = key === null ? sortRows(rows, (row) => row.submittedAt ?? today, 'desc') : sortRows(rows, key, query.dir);
    return ctx.fixtures.page(sorted);
  });

  mockRoute(app, e.getRequestSummary, (ctx) => {
    const viewer = viewerOf(ctx);
    const visible = REQUESTS.filter((row) => canSeeRequest(row, viewer));
    const open = visible.filter((row) => OPEN_STATUSES.includes(row.status));
    const statuses = [...new Set(visible.map((row) => row.status))];
    const byCurrency = new Map<string, Money[]>();
    for (const row of open) {
      if (row.estimatedValue !== null) {
        byCurrency.set(row.estimatedValue.currency, [...(byCurrency.get(row.estimatedValue.currency) ?? []), row.estimatedValue]);
      }
    }
    return {
      byStatus: statuses.map((status) => ({ status, count: visible.filter((row) => row.status === status).length })),
      openCount: open.length,
      unassignedCount: open.filter((row) => row.ownerUserId === null).length,
      awaitingMyDecisionCount: visible.filter(
        (row) => (row.status === 'submitted' || row.status === 'under_review') && row.approval?.currentApproverUserId === viewer.userId,
      ).length,
      openInfoRequestCount: INFO_REQUESTS.filter((info) => info.status === 'open' && visible.some((row) => row.id === info.requestId)).length,
      reapprovalRequiredCount: visible.filter((row) => reapprovalRequired(row)).length,
      openEstimatedValue: [...byCurrency.values()].map((values) => sumMoney(values)).filter((value): value is Money => value !== null),
    };
  });

  mockRoute(app, e.getRequestOptions, (ctx) => {
    const tenantId = ctx.requireTenant().tenant.id;
    const people = tenantPeople(tenantId);
    return {
      legalEntities: LEGAL_ENTITIES.filter((row) => row.tenantId === tenantId).map((row) => ({ id: row.id, name: row.name })),
      departments: DEPARTMENTS.filter((row) => row.tenantId === tenantId).map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        legalEntityId: row.legalEntityId,
      })),
      categories: CATEGORIES.filter((row) => row.tenantId === tenantId).map((row) => ({ id: row.id, code: row.code, name: row.name, parentId: row.parentId })),
      costCenters: COST_CENTERS.filter((row) => row.tenantId === tenantId).map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        departmentId: row.departmentId,
      })),
      fundingSources: FUNDING_SOURCES.filter((row) => row.tenantId === tenantId).map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        sourceType: row.sourceType,
      })),
      projects: PROJECTS.filter((row) => row.tenantId === tenantId).map((row) => ({ id: row.id, reference: row.reference, title: row.title })),
      people: people.flatMap((person) => {
        const roles: ('requester' | 'owner' | 'sponsor' | 'budget_owner' | 'plan_owner')[] = [];
        if (hasPermission(person, 'request.create')) {
          roles.push('requester', 'sponsor');
        } else if (hasPermission(person, 'approval.decide')) {
          roles.push('sponsor');
        }
        if (hasPermission(person, 'request.review')) {
          roles.push('owner');
        }
        if (hasPermission(person, 'request.funding_confirm')) {
          roles.push('budget_owner');
        }
        if (hasPermission(person, 'plan.manage')) {
          roles.push('plan_owner');
        }
        const unique = [...new Set(roles)];
        return unique.length === 0 ? [] : [{ userId: person.userId, fullName: person.fullName, capacity: person.capacity, roles: unique }];
      }),
      contracts: CONTRACTS.filter((row) => row.tenantId === tenantId).map((row) => ({
        id: row.id,
        reference: row.reference,
        title: row.title,
        expiresOn: row.expiresOn,
      })),
      suppliers: SUPPLIER_TENANTS.map((tenant) => ({ tenantId: tenant.id, name: tenant.name })),
      currencies: ['BWP', 'ZAR', 'USD'],
      budgetPeriods: [...(BUDGET_PERIODS[tenantId] ?? ['FY2026/27'])],
    };
  });

  mockRoute(app, e.getRequest, (ctx) => {
    const viewer = viewerOf(ctx);
    return detailOf(findVisible(ctx, viewer, ctx.params.requestId), viewer);
  });

  mockRoute(app, e.createRequest, (ctx) => {
    const viewer = viewerOf(ctx);
    checkReferences(ctx, viewer.tenantId, ctx.body);
    const now = nowIso(ctx.now);
    const year = dateInZone(ctx.now, tenantTimeZone(viewer.tenantId)).slice(0, 4);
    const base: FixtureRequest = {
      id: NEW_ID,
      tenantId: viewer.tenantId,
      reference: `PR-${year}-0900`,
      title: ctx.body.title,
      requesterUserId: viewer.userId,
      sponsorUserId: null,
      ownerUserId: null,
      budgetOwnerUserId: null,
      legalEntityId: null,
      departmentId: null,
      categoryId: null,
      costCenterId: null,
      fundingSourceId: null,
      projectId: null,
      problemStatement: null,
      expectedOutcomes: null,
      scopeDescription: null,
      quantities: null,
      deliveryLocations: null,
      targetDate: null,
      constraints: null,
      stakeholders: null,
      consequenceOfDelay: null,
      risks: null,
      needType: ctx.body.needType,
      replacesContractId: null,
      estimatedValue: null,
      estimationBasis: null,
      accountingReference: null,
      contractTermMonths: null,
      renewalOptions: null,
      estimatedTotalCommitment: null,
      fundingStatus: 'none',
      priority: 'normal',
      status: 'draft',
      revision: 1,
      combinedIntoId: null,
      routedContractId: null,
      convertedTenderId: null,
      submittedAt: null,
      decidedAt: null,
      decisionReason: null,
      deferredUntil: null,
      createdAt: now,
      updatedAt: now,
      approvedRevision: null,
      approvedAt: null,
      approvedByUserId: null,
      approvalConditions: null,
      approvedValue: null,
      materialChange: null,
      approval: null,
      funding: null,
    };
    const drafted = applyBusinessCase(base, ctx.body);
    const customFields = acceptCustomFields(viewer.tenantId, 'procurement_request', ctx.body.customFields, {}, customContextOf(drafted));
    return detailOf({ ...drafted, customFields }, viewer);
  });

  mockRoute(app, e.updateRequest, (ctx) => {
    const viewer = viewerOf(ctx);
    const row = findVisible(ctx, viewer, ctx.params.requestId);
    if (!(REQUEST_ACTION_STATUSES.edit as readonly ProcurementRequestsStatus[]).includes(row.status)) {
      ctx.fail(409, 'REQUEST_NOT_EDITABLE', `A request in status ${row.status} can no longer be edited.`);
    }
    requireParty(ctx, row, viewer);
    requireRevision(ctx, row, ctx.body.expectedRevision);
    checkReferences(ctx, viewer.tenantId, ctx.body);
    const applied = applyBusinessCase(row, ctx.body);
    const updated: FixtureRequest = {
      ...applied,
      customFields: acceptCustomFields(viewer.tenantId, 'procurement_request', ctx.body.customFields, customValuesOf(row), customContextOf(applied)),
    };
    const changed = changedFields(row, updated);
    const materialChanged = changed.filter((field) => (REQUEST_MATERIAL_FIELDS as readonly string[]).includes(field));
    const wasApproved = row.status === 'approved';
    const reapproval = wasApproved && materialChanged.length > 0;
    const now = nowIso(ctx.now);
    const revision = changed.length === 0 ? row.revision : row.revision + 1;
    const result: FixtureRequest = {
      ...updated,
      revision,
      updatedAt: changed.length === 0 ? row.updatedAt : now,
      status: reapproval ? 'under_review' : row.status,
      materialChange: reapproval ? { approvedRevision: row.approvedRevision ?? row.revision, changedFields: materialChanged, detectedAt: now } : row.materialChange,
      approval: reapproval ? null : row.approval,
    };
    return {
      request: detailOf(result, viewer),
      changeAssessment: {
        revision,
        changedFields: changed,
        material: materialChanged.length > 0,
        reapprovalRequired: reapproval,
        message:
          changed.length === 0
            ? 'Nothing changed.'
            : reapproval
              ? `Material change to ${materialChanged.join(', ')}: the approval of revision ${row.approvedRevision ?? row.revision} no longer applies and the request needs re-approval (BR-10).`
              : `Saved as revision ${revision}.`,
      },
    };
  });

  mockRoute(app, e.submitRequest, (ctx) => {
    const viewer = viewerOf(ctx);
    const row = findVisible(ctx, viewer, ctx.params.requestId);
    requireParty(ctx, row, viewer);
    requireStatus(ctx, row, 'submit');
    requireRevision(ctx, row, ctx.body.expectedRevision);
    if (hasOpenInfoRequest(row)) {
      ctx.fail(409, 'INFO_REQUEST_UNANSWERED', 'Answer the open information request before resubmitting.');
    }
    const missing = submissionReadiness(row).filter((item) => item.status === 'blocking');
    if (missing.length > 0) {
      ctx.fail(422, 'REQUEST_INCOMPLETE', `Complete before submitting: ${missing.map((item) => item.label).join(', ')}.`);
    }
    const now = nowIso(ctx.now);
    return detailOf({ ...row, status: 'submitted', submittedAt: now, updatedAt: now }, viewer);
  });

  mockRoute(app, e.withdrawRequest, (ctx) => {
    const viewer = viewerOf(ctx);
    const row = findVisible(ctx, viewer, ctx.params.requestId);
    requireParty(ctx, row, viewer);
    requireStatus(ctx, row, 'withdraw');
    const now = nowIso(ctx.now);
    return detailOf({ ...row, status: 'withdrawn', decidedAt: now, decisionReason: ctx.body.reason, updatedAt: now }, viewer);
  });

  mockRoute(app, e.assignRequest, (ctx) => {
    const viewer = viewerOf(ctx);
    const row = findVisible(ctx, viewer, ctx.params.requestId);
    requireStatus(ctx, row, 'assign');
    const assignee = tenantPeople(viewer.tenantId).find((person) => person.userId === ctx.body.ownerUserId);
    if (assignee === undefined || !hasPermission(assignee, 'request.review')) {
      ctx.fail(422, 'ASSIGNEE_NOT_ELIGIBLE', 'The owner must be a member of this organization who can review requests.');
    }
    const now = nowIso(ctx.now);
    return detailOf(
      { ...row, ownerUserId: ctx.body.ownerUserId, status: row.status === 'submitted' ? 'under_review' : row.status, updatedAt: now },
      viewer,
    );
  });

  mockRoute(app, e.requestInformation, (ctx) => {
    const viewer = viewerOf(ctx);
    const row = findVisible(ctx, viewer, ctx.params.requestId);
    requireStatus(ctx, row, 'request_info');
    const dueAt = ctx.body.dueAt ?? null;
    if (dueAt !== null && Date.parse(dueAt) <= ctx.now.getTime()) {
      ctx.fail(422, 'DUE_DATE_NOT_FUTURE', 'The due date must be in the future.');
    }
    return {
      id: NEW_ID,
      question: ctx.body.question,
      requestedBy: personRef(viewer.userId),
      requestedAt: nowIso(ctx.now),
      dueAt,
      responseText: null,
      respondedBy: null,
      respondedAt: null,
      status: 'open',
    };
  });

  mockRoute(app, e.respondToInfoRequest, (ctx) => {
    const viewer = viewerOf(ctx);
    const row = findVisible(ctx, viewer, ctx.params.requestId);
    const info = INFO_REQUESTS.find((candidate) => candidate.id === ctx.params.infoRequestId && candidate.requestId === row.id);
    if (info === undefined) {
      return ctx.notFound('No such information request.');
    }
    requireParty(ctx, row, viewer);
    if (info.status !== 'open') {
      ctx.fail(409, 'INFO_REQUEST_CLOSED', 'This information request is already answered or withdrawn.');
    }
    const now = nowIso(ctx.now);
    const answered: FixtureInfoRequest = { ...info, responseText: ctx.body.responseText, respondedByUserId: viewer.userId, respondedAt: now, status: 'answered' };
    const infoRequests = INFO_REQUESTS.filter((candidate) => candidate.requestId === row.id).map((candidate) => (candidate.id === info.id ? answered : candidate));
    const stillOpen = infoRequests.some((candidate) => candidate.status === 'open');
    const resubmit = ctx.body.resubmit && !stillOpen && row.status === 'information_requested';
    return detailOf(
      { ...row, status: resubmit ? 'submitted' : row.status, submittedAt: resubmit ? now : row.submittedAt, updatedAt: now },
      viewer,
      { infoRequests },
    );
  });

  mockRoute(app, e.combineRequests, (ctx) => {
    const viewer = viewerOf(ctx);
    const target = findVisible(ctx, viewer, ctx.params.requestId);
    requireStatus(ctx, target, 'combine');
    if (ctx.body.sourceRequestIds.includes(target.id)) {
      ctx.fail(422, 'COMBINE_SELF', 'A request cannot be combined into itself.');
    }
    const sources = ctx.body.sourceRequestIds.map((id) => {
      const source = REQUESTS.find((candidate) => candidate.id === id);
      if (source === undefined || !canSeeRequest(source, viewer) || (source.status !== 'submitted' && source.status !== 'under_review')) {
        return ctx.fail(409, 'COMBINE_SOURCE_INVALID', `Request ${id} cannot be combined: it must be submitted or under review in this organization.`);
      }
      return source;
    });
    const values = [target, ...sources].map(commitmentOf).filter((value): value is Money => value !== null);
    const aggregate = values.length === sources.length + 1 ? sumMoney(values) : null;
    if (aggregate === null) {
      return ctx.fail(422, 'COMBINE_CURRENCY_MISMATCH', 'Combined requests must share one currency and have estimates.');
    }
    const before = approverRoute(viewer.tenantId, 'request.approve', 'request_approval', approvalValue(target));
    const after = approverRoute(viewer.tenantId, 'request.approve', 'request_approval', aggregate);
    const now = nowIso(ctx.now);
    const updated: FixtureRequest = { ...target, status: 'under_review', revision: target.revision + 1, updatedAt: now };
    return {
      request: detailOf(updated, viewer, { combinedExtra: sources }),
      combined: sources.map((source) => ({ ...requestRefOf(source), status: 'closed' as const })),
      aggregateValue: aggregate,
      approvalRouteChanged: before.eligible[0]?.userId !== after.eligible[0]?.userId,
      eligibleApprovers: after.eligible,
    };
  });

  mockRoute(app, e.splitRequest, (ctx) => {
    const viewer = viewerOf(ctx);
    const row = findVisible(ctx, viewer, ctx.params.requestId);
    requireStatus(ctx, row, 'split');
    const original = estimateValue(row);
    const policyValue = approvalValue(row);
    if (original === null || policyValue === null) {
      return ctx.fail(422, 'SPLIT_TOTAL_MISMATCH', 'Record the estimated value before splitting the request.');
    }
    if (ctx.body.parts.some((part) => part.estimatedValue.currency !== original.currency)) {
      ctx.fail(422, 'SPLIT_CURRENCY_MISMATCH', `Every part must be in ${original.currency}.`);
    }
    const total = sumMoney(ctx.body.parts.map((part) => part.estimatedValue));
    if (total === null || Number(total.amount) !== Number(original.amount)) {
      ctx.fail(422, 'SPLIT_TOTAL_MISMATCH', `The parts must add up to the original estimate of ${original.currency} ${original.amount}.`);
    }
    const year = row.reference.slice(3, 7);
    const now = nowIso(ctx.now);
    return {
      request: detailOf({ ...row, status: 'under_review', revision: row.revision + 1, updatedAt: now }, viewer),
      parts: ctx.body.parts.map((part, index) => ({
        id: NEW_ID + index,
        reference: `PR-${year}-${String(NEW_ID + index).padStart(4, '0')}`,
        title: part.title,
        status: 'submitted' as const,
        estimatedValue: part.estimatedValue,
      })),
      policyValue,
    };
  });

  mockRoute(app, e.deferRequest, (ctx) => {
    const viewer = viewerOf(ctx);
    const row = findVisible(ctx, viewer, ctx.params.requestId);
    requireStatus(ctx, row, 'defer');
    if (ctx.body.deferredUntil <= dateInZone(ctx.now, tenantTimeZone(viewer.tenantId))) {
      ctx.fail(422, 'DEFER_DATE_NOT_FUTURE', 'Defer to a future date.');
    }
    const now = nowIso(ctx.now);
    return detailOf({ ...row, status: 'deferred', deferredUntil: ctx.body.deferredUntil, decidedAt: now, decisionReason: ctx.body.reason, updatedAt: now }, viewer);
  });

  mockRoute(app, e.getRoutingOptions, (ctx) => {
    const viewer = viewerOf(ctx);
    const row = findVisible(ctx, viewer, ctx.params.requestId);
    return { requestId: row.id, requestValue: approvalValue(row), options: routingOptionsOf(row) };
  });

  mockRoute(app, e.routeRequestToContract, (ctx) => {
    const viewer = viewerOf(ctx);
    const row = findVisible(ctx, viewer, ctx.params.requestId);
    requireStatus(ctx, row, 'route_to_contract');
    const option = eligibleContract(row, ctx.body.contractId);
    if (option === null || !option.eligible) {
      ctx.fail(409, 'CONTRACT_NOT_ELIGIBLE', option === null ? 'No such contract in this organization.' : option.reasons.join(' '));
    }
    const now = nowIso(ctx.now);
    return detailOf(
      { ...row, status: 'routed_to_existing', routedContractId: ctx.body.contractId, decidedAt: now, decisionReason: ctx.body.reason, updatedAt: now },
      viewer,
    );
  });

  mockRoute(app, e.getRequestDecision, (ctx) => {
    const viewer = viewerOf(ctx);
    return decisionViewOf(findVisible(ctx, viewer, ctx.params.requestId), viewer);
  });

  mockRoute(app, e.decideRequest, (ctx) => {
    const viewer = viewerOf(ctx);
    const row = findVisible(ctx, viewer, ctx.params.requestId);
    requireStatus(ctx, row, 'decide');
    if (ctx.body.subjectRevision !== row.revision) {
      ctx.fail(409, 'REVISION_CONFLICT', `The request changed to revision ${row.revision}; review the new version before deciding.`);
    }
    if (row.requesterUserId === viewer.userId) {
      ctx.fail(403, 'SELF_APPROVAL_BLOCKED', 'You requested this procurement, so another approver must decide it (segregation of duties).');
    }
    const approving = ctx.body.decision === 'approve' || ctx.body.decision === 'approve_with_conditions';
    const value = approvalValue(row);
    if (approving) {
      const check = authorityCheck(viewer.authorityLimit, 'request_approval', value);
      if (!check.sufficient) {
        const route = approverRoute(row.tenantId, 'request.approve', 'request_approval', value);
        const higher = route.eligible[0];
        ctx.fail(
          403,
          'AUTHORITY_EXCEEDED',
          higher === undefined
            ? 'The value exceeds your delegated authority and no approver in this organization holds enough authority.'
            : `The value exceeds your delegated authority; route the decision to ${higher.fullName}.`,
        );
      }
      if (row.fundingStatus !== 'approved_budget' && row.fundingStatus !== 'firm_commitment') {
        ctx.fail(409, 'FUNDING_NOT_CONFIRMED', 'Funding must be an approved budget or a firm commitment before approval.');
      }
    }
    const now = nowIso(ctx.now);
    const status: ProcurementRequestsStatus = approving ? 'approved' : ctx.body.decision === 'reject' ? 'rejected' : 'information_requested';
    const conditions = ctx.body.decision === 'approve_with_conditions' ? (ctx.body.conditions ?? null) : null;
    const decided: FixtureRequest = {
      ...row,
      status,
      decidedAt: now,
      decisionReason: ctx.body.reason,
      updatedAt: now,
      ...(approving
        ? {
            approvedRevision: row.revision,
            approvedAt: now,
            approvedByUserId: viewer.userId,
            approvalConditions: conditions,
            approvedValue: value,
            materialChange: null,
            approval: {
              approvalId: row.approval?.approvalId ?? NEW_ID,
              status: conditions === null ? ('approved' as const) : ('approved_with_conditions' as const),
              currentApproverUserId: null,
              requestedAt: row.approval?.requestedAt ?? now,
              dueAt: row.approval?.dueAt ?? null,
            },
          }
        : {}),
    };
    return decisionViewOf(decided, viewer, {
      history: [
        { id: NEW_ID, decision: ctx.body.decision, decidedBy: actorRef(row.tenantId, viewer.userId), decidedAt: now, revision: row.revision, reason: ctx.body.reason },
      ],
    });
  });

  mockRoute(app, e.escalateRequest, (ctx) => {
    const viewer = viewerOf(ctx);
    const row = findVisible(ctx, viewer, ctx.params.requestId);
    requireStatus(ctx, row, 'escalate');
    const value = approvalValue(row);
    if (authorityCheck(viewer.authorityLimit, 'request_approval', value).sufficient) {
      ctx.fail(409, 'AUTHORITY_SUFFICIENT', 'Your authority covers this value; decide the request yourself.');
    }
    const route = approverRoute(row.tenantId, 'request.approve', 'request_approval', value);
    const higher = route.eligible[0];
    if (higher === undefined) {
      return ctx.fail(409, 'NO_HIGHER_AUTHORITY', 'No approver in this organization holds enough authority for this value.');
    }
    const now = nowIso(ctx.now);
    const escalated: FixtureRequest = {
      ...row,
      status: 'under_review',
      updatedAt: now,
      approval: { approvalId: row.approval?.approvalId ?? NEW_ID, status: 'pending', currentApproverUserId: higher.userId, requestedAt: now, dueAt: row.approval?.dueAt ?? null },
    };
    return decisionViewOf(escalated, viewer, {
      history: [{ id: NEW_ID, decision: 'escalate', decidedBy: actorRef(row.tenantId, viewer.userId), decidedAt: now, revision: row.revision, reason: ctx.body.reason }],
    });
  });

  mockRoute(app, e.confirmFunding, (ctx) => {
    const viewer = viewerOf(ctx);
    const row = findVisible(ctx, viewer, ctx.params.requestId);
    requireStatus(ctx, row, 'confirm_funding');
    requireRevision(ctx, row, ctx.body.subjectRevision);
    if (!FUNDING_SOURCES.some((source) => source.id === ctx.body.fundingSourceId && source.tenantId === viewer.tenantId)) {
      ctx.fail(422, 'REFERENCE_NOT_FOUND', 'fundingSourceId does not name a funding source of this organization.');
    }
    const value = estimateValue(row);
    if (value !== null && ctx.body.confirmedAmount.currency !== value.currency) {
      ctx.fail(422, 'FUNDING_CURRENCY_MISMATCH', `Confirm the amount in ${value.currency}.`);
    }
    if (value !== null && ctx.body.fundingStatus !== 'indicative' && lt(ctx.body.confirmedAmount.amount, value.amount)) {
      ctx.fail(422, 'FUNDING_BELOW_ESTIMATE', `The confirmed amount is below the estimated value (${value.currency} ${value.amount}).`);
    }
    const now = nowIso(ctx.now);
    const funded: FixtureRequest = {
      ...row,
      fundingStatus: ctx.body.fundingStatus,
      fundingSourceId: ctx.body.fundingSourceId,
      accountingReference: ctx.body.accountingReference ?? row.accountingReference,
      funding: { confirmedByUserId: viewer.userId, confirmedAt: now, confirmedAmount: ctx.body.confirmedAmount, note: ctx.body.note ?? null },
      updatedAt: now,
    };
    return decisionViewOf(funded, viewer);
  });

  mockRoute(app, e.commentOnRequest, (ctx) => {
    const viewer = viewerOf(ctx);
    const row = findVisible(ctx, viewer, ctx.params.requestId);
    requireStatus(ctx, row, 'comment');
    const kind = viewer.permissions.has('request.review') ? 'review' : viewer.permissions.has('request.funding_confirm') ? 'funding' : 'decision';
    return { id: NEW_ID, author: actorRef(viewer.tenantId, viewer.userId), kind, text: ctx.body.text, createdAt: nowIso(ctx.now) };
  });

  mockRoute(app, e.rescindRequest, (ctx) => {
    const viewer = viewerOf(ctx);
    const row = findVisible(ctx, viewer, ctx.params.requestId);
    if (row.status === 'converted') {
      ctx.fail(409, 'REQUEST_ALREADY_CONVERTED', 'The request is already converted into a tender; cancel the tender instead.');
    }
    requireStatus(ctx, row, 'rescind');
    const now = nowIso(ctx.now);
    return detailOf({ ...row, status: 'rescinded', decidedAt: now, decisionReason: ctx.body.reason, updatedAt: now }, viewer);
  });

  mockRoute(app, e.reconsiderRequest, (ctx) => {
    const viewer = viewerOf(ctx);
    const row = findVisible(ctx, viewer, ctx.params.requestId);
    requireStatus(ctx, row, 'reconsider');
    const now = nowIso(ctx.now);
    return detailOf(
      { ...row, status: 'under_review', deferredUntil: null, decisionReason: `${ctx.body.reason} Changed basis: ${ctx.body.changedBasis}`, updatedAt: now },
      viewer,
    );
  });

  mockRoute(app, e.closeRequest, (ctx) => {
    const viewer = viewerOf(ctx);
    const row = findVisible(ctx, viewer, ctx.params.requestId);
    requireStatus(ctx, row, 'close');
    const now = nowIso(ctx.now);
    return detailOf({ ...row, status: 'closed', decisionReason: ctx.body.reason, updatedAt: now }, viewer);
  });
}
