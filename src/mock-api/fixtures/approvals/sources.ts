/**
 * Approval requests read from the domains that own their subjects (single demo world): tender release approvals
 * (tenders), procurement request and strategy approvals (requests), exclusion decisions (opening) and preferred
 * bidder, negotiation mandate and process decisions (selection). Ids, subjects, versions, content hashes, amounts,
 * people, dates and outcomes come from those fixtures, so COM-04/COM-05 show exactly what BUY-04, BUY-06, BUY-13,
 * BUY-20 and the selection screens show, and every approval link of those screens opens here.
 *
 * Only the workspace view is added: the step route implied by the recorded decisions and the authority limits, and
 * a short version snapshot. Approvals the workspace owns outright stay in `../approvals.ts`.
 */
import type { Instant, Money } from '../../../contracts/common.js';
import type {
  ApprovalRequestsStatus,
  ApprovalRequestsSubjectType,
  ApprovalStepsStatus,
  AuthorityLimitsDecisionType,
} from '../../../contracts/enums.js';
import type {
  FixtureApproval,
  FixtureApprovalEvidence,
  FixtureApprovalStep,
  FixtureRouting,
  FixtureSnapshotFact,
  FixtureSod,
} from '../approvals.js';
import { CONTRACTS, CONTRACT_APPROVALS } from '../contracts/core.js';
import { EXCLUSIONS, OPENING_BIDS } from '../opening.js';
import { TENANTS, TENANT_IDS } from '../platform.js';
import { CATEGORIES as REQUEST_CATEGORIES, LEGAL_ENTITIES } from '../requests/reference.js';
import { REQUESTS, REQUEST_DECISIONS } from '../requests/requests.js';
import type { FixtureRequest } from '../requests/requests.js';
import { STRATEGIES } from '../requests/strategies.js';
import { NEGOTIATIONS, PREFERRED_BIDDERS, PROCESS_DECISIONS, SELECTION_BIDS } from '../selection/index.js';
import { CATEGORIES as TENDER_CATEGORIES } from '../tenders/reference.js';
import { CORRECTIONS, RELEASE_APPROVALS } from '../tenders/release.js';
import type { FxReleaseApproval } from '../tenders/types.js';
import { TENDERS } from '../tenders/tenders.js';
import { digest, uid } from './world.js';

// ---------------------------------------------------------------------------------------------------------
// Shared helpers (also used by the hand-written approvals)
// ---------------------------------------------------------------------------------------------------------

export const BWP = (amount: string): Money => ({ amount, currency: 'BWP' });

/** The approvals content-hash convention: `sha256("approval:<id>:v<version>")`. */
export const approvalHash = (approvalId: number, version: number): string => digest(`approval:${approvalId}:v${version}`);

/** `BWP 1,450,000.00` for a decimal string amount. */
export function formatMoney(money: Money): string {
  const [whole = '0', fraction = '00'] = money.amount.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${money.currency} ${grouped}.${fraction.padEnd(2, '0').slice(0, 2)}`;
}

/** The larger of two same-currency amounts (null-tolerant). */
function larger(a: Money | null, b: Money | null): Money | null {
  if (a === null) return b;
  if (b === null) return a;
  return Number(b.amount) > Number(a.amount) ? b : a;
}

function sum(values: readonly Money[]): Money | null {
  const first = values[0];
  if (first === undefined) return null;
  const cents = values.reduce((total, value) => total + Math.round(Number(value.amount) * 100), 0);
  return { amount: (cents / 100).toFixed(2), currency: first.currency };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** `at` shifted by whole days, as an ISO instant without milliseconds. */
export function shiftDays(at: Instant, days: number): Instant {
  return new Date(Date.parse(at) + days * DAY_MS).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** 15:00 UTC (17:00 in Gaborone) `days` after `at`: the usual approval due time. */
export function dueAfter(at: Instant, days: number): Instant {
  return `${shiftDays(at, days).slice(0, 10)}T15:00:00Z`;
}

/** The procurement manager's own limit: above it, KWU routes to the Chief Executive (authority_limits 11 and 12). */
const MANAGER_LIMIT = 2_000_000;

function tenantName(tenantId: number): string {
  return TENANTS.find((tenant) => tenant.id === tenantId)?.name ?? `Organization ${tenantId}`;
}

function legalEntityOf(tenantId: number, legalEntityId: number | null): FixtureApproval['legalEntity'] {
  const entity = LEGAL_ENTITIES.find((row) => row.tenantId === tenantId && (legalEntityId === null || row.id === legalEntityId));
  return entity === undefined ? null : { legalEntityId: entity.id, name: entity.name };
}

function categoryOf(
  table: readonly { id: number; tenantId: number; code: string; name: string }[],
  tenantId: number,
  categoryId: number | null,
): FixtureApproval['category'] {
  const category = table.find((row) => row.id === categoryId && row.tenantId === tenantId);
  return category === undefined ? null : { categoryId: category.id, name: `${category.code} — ${category.name}` };
}

export interface StepInput {
  readonly approverUserId: number | null;
  readonly type: AuthorityLimitsDecisionType | null;
  readonly status: ApprovalStepsStatus;
  readonly decidedByUserId?: number | null;
  readonly reason?: string | null;
  readonly conditions?: string | null;
  readonly decidedAt?: Instant | null;
  readonly checked?: Money | null;
}

/** Steps with ids `approvalId * 10 + sequence`. */
export function buildSteps(approvalId: number, inputs: readonly StepInput[]): FixtureApprovalStep[] {
  return inputs.map((input, index) => ({
    id: approvalId * 10 + index + 1,
    sequence: index + 1,
    approverUserId: input.approverUserId,
    committee: null,
    requiredDecisionType: input.type,
    status: input.status,
    decidedByUserId: input.decidedByUserId ?? null,
    actingForUserId: null,
    delegationId: null,
    decisionReason: input.reason ?? null,
    conditions: input.conditions ?? null,
    decidedAt: input.decidedAt ?? null,
    authorityCheckedAmount: input.checked ?? null,
  }));
}

/** The step status that records a decided approval (an invalidated one was decided before the change). */
function decidedStepStatus(status: ApprovalRequestsStatus): ApprovalStepsStatus {
  switch (status) {
    case 'approved':
    case 'invalidated':
      return 'approved';
    case 'approved_with_conditions':
      return 'approved_with_conditions';
    case 'rejected':
      return 'rejected';
    case 'returned':
      return 'returned';
    default:
      return 'pending';
  }
}

interface RowInput {
  readonly id: number;
  readonly tenantId: number;
  readonly subjectType: ApprovalRequestsSubjectType;
  readonly subjectId: number;
  /** A short record reference (`T-2026-0009`, `PR-2026-0001`) or `null` when the subject has none. */
  readonly subjectReference: string | null;
  readonly subjectLinkPath: string;
  readonly subjectVersion: number;
  readonly currentSubjectVersion: number;
  readonly contentHash: string;
  readonly title: string;
  readonly summary: string | null;
  readonly justification: string | null;
  readonly status: ApprovalRequestsStatus;
  readonly amount: Money | null;
  readonly legalEntity: FixtureApproval['legalEntity'];
  readonly category: FixtureApproval['category'];
  readonly requestedByUserId: number;
  readonly requestedAt: Instant;
  readonly dueAt: Instant | null;
  readonly decidedAt: Instant | null;
  readonly conditions: string | null;
  readonly conditionsPermitted: boolean;
  readonly steps: readonly FixtureApprovalStep[];
  readonly facts: readonly FixtureSnapshotFact[];
  readonly evidence?: readonly FixtureApprovalEvidence[];
  readonly routing?: FixtureRouting | null;
  readonly sod?: FixtureSod | null;
  readonly invalidatedAt?: Instant | null;
  readonly invalidatedReason?: string | null;
}

function row(input: RowInput): FixtureApproval {
  return {
    id: input.id,
    tenantId: input.tenantId,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    subjectReference: input.subjectReference,
    subjectLinkPath: input.subjectLinkPath,
    subjectVersion: input.subjectVersion,
    currentSubjectVersion: input.currentSubjectVersion,
    contentHash: input.contentHash,
    title: input.title,
    summary: input.summary,
    justification: input.justification,
    status: input.status,
    amount: input.amount,
    legalEntity: input.legalEntity,
    category: input.category,
    requestedByUserId: input.requestedByUserId,
    requestedAt: input.requestedAt,
    dueAt: input.dueAt,
    expiresAt: input.status === 'pending' ? dueAfter(input.requestedAt, 30) : null,
    decidedAt: input.decidedAt,
    routeMode: 'sequential',
    committee: null,
    conditions: input.conditions,
    invalidatedReason: input.invalidatedReason ?? null,
    invalidatedAt: input.invalidatedAt ?? null,
    conditionsPermitted: input.conditionsPermitted,
    steps: input.steps,
    evidence: input.evidence ?? [],
    snapshotCapturedAt: input.requestedAt,
    snapshotFacts: input.facts,
    routing: input.routing ?? null,
    invalidation: null,
    conflicts: [],
    sod: input.sod ?? null,
    holdActive: false,
  };
}

const fact = (key: string, label: string, value: string): FixtureSnapshotFact => ({ key, label, value, changedSince: false });

const PROCEDURE_LABELS: Readonly<Record<string, string>> = {
  open: 'Open procedure',
  restricted: 'Restricted procedure',
  invitation_only: 'Invitation only',
  direct: 'Direct award',
  negotiated: 'Negotiated procedure',
};

function humanize(value: string): string {
  const text = value.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// ---------------------------------------------------------------------------------------------------------
// Tender release approvals (tenders domain, BUY-13; AC-06)
// ---------------------------------------------------------------------------------------------------------

/** The release approval row of `approvalId` as the tenders domain records it. */
export function releaseApprovalSource(approvalId: number): FxReleaseApproval {
  const source = RELEASE_APPROVALS.find((candidate) => candidate.approvalId === approvalId);
  if (source === undefined) {
    throw new Error(`The tenders fixtures hold no release approval ${approvalId}.`);
  }
  return source;
}

/** A tender release approval derived from `tenders/release.ts`. */
export function releaseApproval(source: FxReleaseApproval): FixtureApproval {
  const tender = TENDERS.find((candidate) => candidate.id === source.tenderId);
  if (tender === undefined) {
    throw new Error(`Release approval ${source.approvalId} refers to an unknown tender ${source.tenderId}.`);
  }
  const amount = source.amount === null ? null : BWP(source.amount);
  const decided = source.decidedAt !== null;
  const returnNote = CORRECTIONS.filter(
    (correction) => correction.tenderId === tender.id && correction.requestedAt === source.decidedAt,
  )
    .map((correction) => correction.note)
    .join(' ');
  const approver = source.decidedBy ?? uid('mpho.manager');
  return row({
    id: source.approvalId,
    tenantId: source.tenantId,
    subjectType: 'tender_release',
    subjectId: tender.id,
    subjectReference: tender.reference,
    subjectLinkPath: `/buyer/tenders/${tender.id}/release`,
    subjectVersion: source.subjectVersion,
    currentSubjectVersion: Math.max(tender.draftRevision, source.subjectVersion),
    contentHash: source.contentHash,
    title: `Release ${tender.reference} ${tender.title}`,
    summary: tender.summary,
    justification: null,
    status: source.status,
    amount,
    legalEntity: legalEntityOf(source.tenantId, tender.legalEntityId),
    category: categoryOf(TENDER_CATEGORIES, source.tenantId, tender.categoryId),
    requestedByUserId: source.requestedBy,
    requestedAt: source.requestedAt,
    dueAt: dueAfter(source.requestedAt, 5),
    decidedAt: source.decidedAt,
    conditions: null,
    conditionsPermitted: true,
    steps: buildSteps(source.approvalId, [
      {
        approverUserId: approver,
        type: 'release_approval',
        status: decided ? decidedStepStatus(source.status) : 'pending',
        decidedByUserId: source.decidedBy,
        reason: returnNote === '' ? null : returnNote,
        decidedAt: source.decidedAt,
        checked: decided ? amount : null,
      },
    ]),
    facts: [
      fact('version', 'Tender revision', String(source.subjectVersion)),
      ...(amount === null ? [] : [fact('estimatedValue', 'Estimated value', formatMoney(amount))]),
      fact('procedure', 'Procedure', PROCEDURE_LABELS[tender.procedure] ?? humanize(tender.procedure)),
    ],
    invalidatedAt: source.invalidatedAt,
    invalidatedReason: source.invalidationReason,
  });
}

// ---------------------------------------------------------------------------------------------------------
// Procurement request approvals (requests domain, BUY-04; AC-05)
// ---------------------------------------------------------------------------------------------------------

function commitmentOf(request: FixtureRequest): Money | null {
  return larger(request.estimatedValue, request.estimatedTotalCommitment);
}

/**
 * The value the request's approval route uses: the whole contemplated commitment, and for a combined request the
 * sum of every original's commitment (FR-04, the requests domain's rule).
 */
export function requestApprovalValue(request: FixtureRequest): Money | null {
  const sources = REQUESTS.filter((candidate) => candidate.combinedIntoId === request.id);
  if (sources.length === 0) {
    return commitmentOf(request);
  }
  return sum([request, ...sources].map(commitmentOf).filter((value): value is Money => value !== null)) ?? commitmentOf(request);
}

/** The request whose approval route is `approvalId`. */
export function requestOfApproval(approvalId: number): FixtureRequest {
  const request = REQUESTS.find((candidate) => candidate.approval?.approvalId === approvalId);
  if (request === undefined) {
    throw new Error(`The requests fixtures hold no approval ${approvalId}.`);
  }
  return request;
}

/** A procurement request approval derived from `requests/requests.ts` and its recorded decisions. */
export function requestApproval(request: FixtureRequest): FixtureApproval {
  const approval = request.approval;
  if (approval === null) {
    throw new Error(`${request.reference} has no approval route.`);
  }
  const version = approval.status === 'pending' ? request.revision : (request.approvedRevision ?? request.revision);
  const amount = requestApprovalValue(request);
  const decisions = REQUEST_DECISIONS.filter(
    (decision) =>
      decision.tenantId === request.tenantId &&
      decision.requestId === request.id &&
      decision.revision === version &&
      ['escalate', 'approve', 'approve_with_conditions', 'reject', 'return'].includes(decision.decision),
  ).sort((a, b) => Date.parse(a.decidedAt) - Date.parse(b.decidedAt));
  const escalation = decisions.find((decision) => decision.decision === 'escalate');
  const final = decisions.find((decision) => decision.decision !== 'escalate');
  // KWU routes requests through its authority limits; ODC decides in its tender committee (no limit table).
  const type: AuthorityLimitsDecisionType | null = request.tenantId === TENANT_IDS.kwu ? 'request_approval' : null;
  const finalApprover = final?.decidedByUserId ?? approval.currentApproverUserId ?? uid('mpho.manager');
  const steps: StepInput[] = [
    ...(escalation === undefined
      ? []
      : [
          {
            approverUserId: escalation.decidedByUserId,
            type,
            status: 'skipped' as const,
            reason: escalation.reason,
            decidedAt: escalation.decidedAt,
            checked: amount,
          },
        ]),
    {
      approverUserId: finalApprover,
      type,
      status: final === undefined ? 'pending' : decidedStepStatus(approval.status),
      decidedByUserId: final?.decidedByUserId ?? null,
      reason: final?.reason ?? null,
      conditions: approval.status === 'approved_with_conditions' ? request.approvalConditions : null,
      decidedAt: final?.decidedAt ?? null,
      checked: final === undefined ? null : amount,
    },
  ];
  const routing: FixtureRouting | null =
    escalation === undefined
      ? null
      : {
          reason: 'authority_exceeded',
          skippedUserId: escalation.decidedByUserId,
          routedToUserId: finalApprover,
          routedAt: escalation.decidedAt,
          note: escalation.reason,
        };
  // The procurement manager is the first-level request approver: a request he raised himself goes to the next level
  // and he may not decide it (SoD requester_vs_request_approval, BR-07).
  const selfRequested = approval.status === 'pending' && request.requesterUserId === uid('mpho.manager') && finalApprover !== request.requesterUserId;
  return row({
    id: approval.approvalId,
    tenantId: request.tenantId,
    subjectType: 'procurement_request',
    subjectId: request.id,
    subjectReference: request.reference,
    subjectLinkPath: `/buyer/requests/${request.id}`,
    subjectVersion: version,
    currentSubjectVersion: request.revision,
    contentHash: approvalHash(approval.approvalId, version),
    title: `Approve ${request.reference} ${request.title}`,
    summary: request.scopeDescription,
    justification: request.problemStatement,
    status: approval.status,
    amount,
    legalEntity: legalEntityOf(request.tenantId, request.legalEntityId),
    category: categoryOf(REQUEST_CATEGORIES, request.tenantId, request.categoryId),
    requestedByUserId: request.requesterUserId,
    requestedAt: approval.requestedAt,
    dueAt: approval.dueAt,
    decidedAt: approval.status === 'pending' ? null : (final?.decidedAt ?? request.approvedAt),
    conditions: approval.status === 'approved_with_conditions' ? request.approvalConditions : null,
    conditionsPermitted: true,
    steps: buildSteps(approval.approvalId, steps),
    facts: [
      fact('version', 'Request revision', String(version)),
      ...(request.estimatedValue === null ? [] : [fact('estimatedValue', 'Estimated value', formatMoney(request.estimatedValue))]),
      ...(amount === null ? [] : [fact('approvalValue', 'Value used for the approval route', formatMoney(amount))]),
      fact('funding', 'Funding status', humanize(request.fundingStatus)),
      fact('priority', 'Priority', humanize(request.priority)),
    ],
    routing,
    sod: selfRequested
      ? {
          rule: 'requester_vs_request_approval',
          mode: 'enforced',
          blockedUserIds: [request.requesterUserId],
          alternativeOversightNote: null,
        }
      : null,
  });
}

// ---------------------------------------------------------------------------------------------------------
// Strategy approvals (requests domain, BUY-06)
// ---------------------------------------------------------------------------------------------------------

function strategyApprovals(): FixtureApproval[] {
  return STRATEGIES.flatMap((strategy) => {
    const approval = strategy.approval;
    if (approval === null) {
      return [];
    }
    const request = strategy.requestId === null ? undefined : REQUESTS.find((candidate) => candidate.id === strategy.requestId);
    const stated = strategy.estimatedValue !== null && Number(strategy.estimatedValue) > 0 ? BWP(strategy.estimatedValue) : null;
    const amount = stated ?? (request === undefined ? null : requestApprovalValue(request));
    const version = approval.approvedRevision ?? strategy.revision;
    const kwu = strategy.tenantId === TENANT_IDS.kwu;
    const approver =
      approval.decidedByUserId ??
      (amount !== null && Number(amount.amount) > MANAGER_LIMIT ? uid('keabetswe.approver') : uid('mpho.manager'));
    const requestedAt = approval.decidedAt === null ? strategy.updatedAt : shiftDays(approval.decidedAt, -1);
    return [
      row({
        id: approval.approvalId,
        tenantId: strategy.tenantId,
        subjectType: 'strategy',
        subjectId: strategy.id,
        // A strategy has no reference of its own: it carries its request's reference when it serves one.
        subjectReference: request?.reference ?? null,
        subjectLinkPath: `/buyer/strategies/${strategy.id}`,
        subjectVersion: version,
        currentSubjectVersion: strategy.revision,
        contentHash: approvalHash(approval.approvalId, version),
        title: `Approve the procurement strategy: ${strategy.title}`,
        summary: strategy.intendedOutcome,
        justification: strategy.competitionRationale,
        status: approval.status,
        amount,
        legalEntity: legalEntityOf(strategy.tenantId, null),
        category: categoryOf(REQUEST_CATEGORIES, strategy.tenantId, strategy.categoryId),
        requestedByUserId: strategy.ownerUserId,
        requestedAt,
        dueAt: dueAfter(requestedAt, 7),
        decidedAt: approval.decidedAt,
        conditions: approval.conditions,
        conditionsPermitted: true,
        steps: buildSteps(approval.approvalId, [
          {
            approverUserId: approver,
            type: kwu ? 'strategy_approval' : null,
            status: approval.decidedAt === null ? 'pending' : decidedStepStatus(approval.status),
            decidedByUserId: approval.decidedByUserId,
            reason: approval.reason,
            conditions: approval.conditions,
            decidedAt: approval.decidedAt,
            checked: approval.decidedAt === null ? null : amount,
          },
        ]),
        facts: [
          fact('version', 'Strategy revision', String(version)),
          fact('procedure', 'Procedure', PROCEDURE_LABELS[strategy.procedure] ?? humanize(strategy.procedure)),
          fact('eventType', 'Event type', strategy.eventType.toUpperCase()),
          fact('awardModel', 'Award model', humanize(strategy.awardModel)),
          ...(amount === null ? [] : [fact('estimatedValue', 'Estimated value', formatMoney(amount))]),
        ],
      }),
    ];
  });
}

// ---------------------------------------------------------------------------------------------------------
// Exclusion decisions (opening domain, BUY-11; the pending AC-17 exclusion 37 is written by hand)
// ---------------------------------------------------------------------------------------------------------

function exclusionApprovals(handWritten: ReadonlySet<number>): FixtureApproval[] {
  return EXCLUSIONS.flatMap((exclusion) => {
    if (exclusion.approvalRequestId === null || handWritten.has(exclusion.approvalRequestId) || exclusion.approvalStatus === null) {
      return [];
    }
    const bid = OPENING_BIDS.find((candidate) => candidate.bidId === exclusion.bidId);
    const tender = TENDERS.find((candidate) => candidate.id === bid?.tenderId);
    if (bid === undefined || tender === undefined) {
      throw new Error(`Exclusion ${exclusion.id} refers to an unknown bid or tender.`);
    }
    const supplier = tenantName(bid.supplierTenantId);
    const id = exclusion.approvalRequestId;
    const decided = exclusion.approvalDecidedAt !== null;
    return [
      row({
        id,
        tenantId: exclusion.tenantId,
        subjectType: 'exclusion',
        subjectId: exclusion.id,
        subjectReference: tender.reference,
        subjectLinkPath: `/buyer/compliance/exclusions/${exclusion.id}`,
        subjectVersion: 1,
        currentSubjectVersion: 1,
        contentHash: approvalHash(id, 1),
        title: `Exclude ${supplier} from ${tender.reference}`,
        summary: exclusion.grounds,
        justification: null,
        status: exclusion.approvalStatus,
        amount: null,
        legalEntity: legalEntityOf(exclusion.tenantId, tender.legalEntityId),
        category: categoryOf(TENDER_CATEGORIES, exclusion.tenantId, tender.categoryId),
        requestedByUserId: exclusion.proposedBy,
        requestedAt: exclusion.proposedAt,
        dueAt: dueAfter(exclusion.proposedAt, 4),
        decidedAt: exclusion.approvalDecidedAt,
        conditions: null,
        conditionsPermitted: false,
        steps: buildSteps(id, [
          {
            approverUserId: exclusion.approvalDecidedBy ?? uid('mpho.manager'),
            type: 'exclusion_approval',
            status: decided ? decidedStepStatus(exclusion.approvalStatus) : 'pending',
            decidedByUserId: exclusion.approvalDecidedBy,
            reason:
              exclusion.approvalStatus === 'rejected'
                ? (exclusion.withdrawnReason ?? 'Exclusion not approved: the bid stays in the evaluation.')
                : null,
            decidedAt: exclusion.approvalDecidedAt,
          },
        ]),
        facts: [
          fact('supplier', 'Supplier', supplier),
          fact('tender', 'Tender', `${tender.reference} ${tender.title}`),
          fact('effect', 'Effect', 'Excluded from further evaluation; the supplier is notified with the challenge route'),
        ],
      }),
    ];
  });
}

// ---------------------------------------------------------------------------------------------------------
// Selection decisions (selection domain, BUY-23…BUY-26)
// ---------------------------------------------------------------------------------------------------------

interface SelectionSource {
  readonly id: number;
  readonly tenantId: number;
  readonly subjectType: ApprovalRequestsSubjectType;
  readonly subjectId: number;
  readonly tenderId: number;
  readonly link: string;
  readonly title: string;
  readonly summary: string | null;
  readonly amount: Money | null;
  readonly version: number;
  readonly contentHash: string;
  readonly status: ApprovalRequestsStatus;
  readonly requestedAt: Instant;
  readonly decidedAt: Instant | null;
  readonly requestedBy: number;
  readonly approver: number;
  readonly type: AuthorityLimitsDecisionType | null;
}

const PROCESS_DECISION_TITLES: Readonly<Record<string, string>> = {
  fallback_to_next_bidder: 'Fall back to the next-ranked candidate',
  reopen_round: 'Reopen a round for final offers',
  other: 'Procedural decision on the variant offer',
};

function supplierOfBid(bidId: number): string {
  return SELECTION_BIDS.find((bid) => bid.bidId === bidId)?.supplierName ?? `Bid ${bidId}`;
}

function approverFor(amount: Money | null): number {
  return amount !== null && Number(amount.amount) > MANAGER_LIMIT ? uid('keabetswe.approver') : uid('mpho.manager');
}

function selectionSources(): SelectionSource[] {
  const tebogo = uid('tebogo.officer');
  const sources: SelectionSource[] = [];
  for (const preferred of PREFERRED_BIDDERS) {
    if (preferred.approval === null) continue;
    sources.push({
      id: preferred.approval.approvalRequestId,
      tenantId: preferred.tenantId,
      subjectType: 'preferred_bidder',
      subjectId: preferred.preferredBidderId,
      tenderId: preferred.tenderId,
      link: `/buyer/selection/preferred-bidders/${preferred.preferredBidderId}`,
      title: `Approve ${supplierOfBid(preferred.bidId)} as preferred bidder`,
      summary: preferred.rationale,
      amount: preferred.proposedValue,
      version: preferred.version,
      contentHash: preferred.contentHash,
      status: preferred.approval.status,
      requestedAt: preferred.approval.requestedAt,
      decidedAt: preferred.approval.decidedAt,
      requestedBy: tebogo,
      approver: approverFor(preferred.proposedValue),
      type: 'preferred_bidder_approval',
    });
  }
  for (const negotiation of NEGOTIATIONS) {
    if (negotiation.approval === null) continue;
    sources.push({
      id: negotiation.approval.approvalRequestId,
      tenantId: negotiation.tenantId,
      subjectType: 'negotiation_mandate',
      subjectId: negotiation.negotiationId,
      tenderId: negotiation.tenderId,
      link: `/buyer/selection/negotiations/${negotiation.negotiationId}`,
      title: `Approve the negotiation mandate with ${supplierOfBid(negotiation.bidId)}`,
      summary: `Allowed topics: ${negotiation.allowedTopics.join(', ')}.`,
      amount: negotiation.commercialAuthority,
      version: negotiation.version,
      contentHash: negotiation.contentHash,
      status: negotiation.approval.status,
      requestedAt: negotiation.approval.requestedAt,
      decidedAt: negotiation.approval.decidedAt,
      requestedBy: tebogo,
      approver: approverFor(negotiation.commercialAuthority),
      type: 'negotiation_mandate',
    });
  }
  for (const decision of PROCESS_DECISIONS) {
    if (decision.approval === null) continue;
    sources.push({
      id: decision.approval.approvalRequestId,
      tenantId: decision.tenantId,
      subjectType: 'process_decision',
      subjectId: decision.processDecisionId,
      tenderId: decision.tenderId,
      link: `/buyer/selection/tenders/${decision.tenderId}`,
      title: PROCESS_DECISION_TITLES[decision.decisionType] ?? `Process decision: ${humanize(decision.decisionType).toLowerCase()}`,
      summary: decision.reason,
      amount: null,
      version: decision.version,
      contentHash: decision.contentHash,
      status: decision.approval.status,
      requestedAt: decision.approval.requestedAt,
      decidedAt: decision.approval.decidedAt,
      requestedBy: decision.proposedBy,
      approver: decision.decidedBy ?? uid('mpho.manager'),
      type: null,
    });
  }
  return sources;
}

function selectionApprovals(): FixtureApproval[] {
  return selectionSources().map((source) => {
    const tender = TENDERS.find((candidate) => candidate.id === source.tenderId);
    if (tender === undefined) {
      throw new Error(`Selection approval ${source.id} refers to an unknown tender ${source.tenderId}.`);
    }
    const decided = source.decidedAt !== null;
    return row({
      id: source.id,
      tenantId: source.tenantId,
      subjectType: source.subjectType,
      subjectId: source.subjectId,
      subjectReference: tender.reference,
      subjectLinkPath: source.link,
      subjectVersion: source.version,
      currentSubjectVersion: source.version,
      contentHash: source.contentHash,
      title: `${source.title} (${tender.reference})`,
      summary: source.summary,
      justification: null,
      status: source.status,
      amount: source.amount,
      legalEntity: legalEntityOf(source.tenantId, tender.legalEntityId),
      category: categoryOf(TENDER_CATEGORIES, source.tenantId, tender.categoryId),
      requestedByUserId: source.requestedBy,
      requestedAt: source.requestedAt,
      dueAt: dueAfter(source.requestedAt, 5),
      decidedAt: source.decidedAt,
      conditions: null,
      conditionsPermitted: false,
      steps: buildSteps(source.id, [
        {
          approverUserId: source.approver,
          type: source.type,
          status: decided ? decidedStepStatus(source.status) : 'pending',
          decidedByUserId: decided ? source.approver : null,
          decidedAt: source.decidedAt,
          checked: decided ? source.amount : null,
        },
      ]),
      facts: [
        fact('tender', 'Tender', `${tender.reference} ${tender.title}`),
        fact('version', 'Record version', String(source.version)),
        ...(source.amount === null ? [] : [fact('value', 'Value', formatMoney(source.amount))]),
      ],
    });
  });
}

const CONTRACT_DECISION_TYPES: Readonly<Partial<Record<ApprovalRequestsSubjectType, AuthorityLimitsDecisionType>>> = {
  contract: 'contract_approval',
  contract_change: 'change_approval',
  renewal: 'renewal_approval',
  security_release: 'contract_approval',
};

/** The contract a contract approval is about (changes, renewals and securities name their contract in the title). */
function contractOfApproval(approval: (typeof CONTRACT_APPROVALS)[number]) {
  if (approval.subjectType === 'contract' || approval.subjectType === 'contract_difference') {
    return CONTRACTS.find((contract) => contract.id === approval.subjectId);
  }
  return CONTRACTS.find((contract) => approval.title.includes(contract.reference));
}

/** Contract approvals (contracts domain, `contracts/core.ts`) that `../approvals.ts` does not write by hand. */
function contractApprovals(handWritten: ReadonlySet<number>): FixtureApproval[] {
  return CONTRACT_APPROVALS.filter((approval) => !handWritten.has(approval.id)).map((approval) => {
    const contract = contractOfApproval(approval);
    if (contract === undefined) {
      throw new Error(`Contract approval ${approval.id} names no contract of the contracts fixtures.`);
    }
    const decided = approval.decidedAt !== null;
    const approver = approval.currentApproverUserId ?? approverFor(approval.amount);
    return row({
      id: approval.id,
      tenantId: approval.tenantId,
      subjectType: approval.subjectType,
      subjectId: approval.subjectId,
      subjectReference: contract.reference,
      subjectLinkPath: `/buyer/contracts/${contract.id}`,
      subjectVersion: 1,
      currentSubjectVersion: 1,
      contentHash: approvalHash(approval.id, 1),
      title: approval.title,
      summary: contract.title,
      justification: null,
      status: approval.status,
      amount: approval.amount,
      legalEntity: legalEntityOf(approval.tenantId, contract.legalEntityId),
      category: null,
      requestedByUserId: approval.requestedByUserId,
      requestedAt: approval.requestedAt,
      dueAt: dueAfter(approval.requestedAt, 5),
      decidedAt: approval.decidedAt,
      conditions: null,
      conditionsPermitted: false,
      steps: buildSteps(approval.id, [
        {
          approverUserId: approver,
          type: CONTRACT_DECISION_TYPES[approval.subjectType] ?? null,
          status: decided ? decidedStepStatus(approval.status) : 'pending',
          decidedByUserId: decided ? approver : null,
          decidedAt: approval.decidedAt,
          checked: decided ? approval.amount : null,
        },
      ]),
      facts: [
        fact('contract', 'Contract', `${contract.reference} ${contract.title}`),
        ...(approval.amount === null ? [] : [fact('value', 'Value', formatMoney(approval.amount))]),
      ],
    });
  });
}

/**
 * Every approval request the other domains refer to, except the ones `../approvals.ts` writes by hand (`handWritten`
 * ids, which take their facts from the same sources).
 */
export function sourcedApprovals(handWritten: ReadonlySet<number>): FixtureApproval[] {
  const releases = RELEASE_APPROVALS.filter((source) => !handWritten.has(source.approvalId)).map(releaseApproval);
  const requests = REQUESTS.filter((request) => request.approval !== null && !handWritten.has(request.approval.approvalId)).map(
    requestApproval,
  );
  const strategies = strategyApprovals().filter((approval) => !handWritten.has(approval.id));
  const selection = selectionApprovals().filter((approval) => !handWritten.has(approval.id));
  return [...releases, ...requests, ...strategies, ...exclusionApprovals(handWritten), ...selection, ...contractApprovals(handWritten)];
}
