/**
 * Approval fixtures (COM-04, COM-05; BR-06, BR-07, BR-10; DD-14, DD-24, DD-25): approval requests of the storyline,
 * their steps, the authority limits and delegations the authority checks use, exchange rates, conflicts and
 * segregation-of-duties positions.
 *
 * This is the single source of every approval id the SPA links to. Approvals whose subject another domain owns
 * (tender releases, requests, strategies, exclusions, selection decisions) are derived from that domain's fixtures
 * (`./approvals/sources.ts`); the rows below are written here with facts taken from the same sources.
 *
 * Scenario anchors:
 * - 31: release approval of T-2026-0005 revision 2, approved on 25 Sep and INVALIDATED on 28 Sep when revision 3
 *   added Lot 3 and raised the value (AC-06); the earlier returned approval 30 of revision 1 is its history.
 * - 305: PR-2026-0003 (total commitment BWP 5,120,000) exceeds Mpho Dikgang's BWP 2,000,000 limit and is routed to
 *   Keabetswe Nkwe (BWP 10,000,000) (AC-05).
 * - 306: PR-2026-0013 revision 2, raised by Mpho himself: routed to the Chief Executive (BR-07, BR-10).
 * - 328: a strategy within Mpho's authority, awaiting his decision.
 * - 36: a contract change decided by Mpho acting for Keabetswe under a delegation.
 * - 42: the award-to-contract difference of C-2026-0002 (AC-28), legal review first.
 * - 43: a late-submission exception blocked by Mpho's own conflict declaration pending review (DD-25).
 * - 44: an addendum Mpho drafted himself: self-approval blocked (BR-07).
 * - 35/41: historic approvals requested by the departed officer stay attributed (AC-04).
 * - Exchange rates stay available for foreign-currency amounts (BR-29, DD-24); the demo requests are all in BWP.
 */
import type { CalendarDate, Instant, Money } from '../../contracts/common.js';
import type {
  ApprovalRequestsRouteMode,
  ApprovalRequestsStatus,
  ApprovalRequestsSubjectType,
  ApprovalStepsStatus,
  AuthorityLimitsDecisionType,
  ConflictDeclarationsDisposition,
  SodPoliciesMode,
  SodPoliciesRuleCode,
} from '../../contracts/enums.js';
import type { ApprovalRoutingReason } from '../../contracts/approvals.js';
import {
  BWP,
  approvalHash,
  releaseApproval,
  releaseApprovalSource,
  requestApproval,
  requestOfApproval,
  sourcedApprovals,
} from './approvals/sources.js';
import { RECORDS, WORKSPACE_AS_OF, tid, uid } from './approvals/world.js';
import type { RecordKey } from './approvals/world.js';
import { MATERIAL_CHANGES } from './tenders/release.js';

export { WORKSPACE_AS_OF };

// ---------------------------------------------------------------------------------------------------------
// Authority (authority_limits, delegations, exchange_rates)
// ---------------------------------------------------------------------------------------------------------

export interface FixtureAuthorityLimit {
  readonly id: number;
  readonly tenantId: number;
  readonly userId: number;
  readonly decisionTypes: readonly AuthorityLimitsDecisionType[];
  /** `null` = unlimited within scope. */
  readonly maxAmount: Money | null;
  readonly effectiveFrom: CalendarDate;
  readonly effectiveTo: CalendarDate | null;
}

export interface FixtureDelegation {
  readonly id: number;
  readonly tenantId: number;
  readonly delegatorUserId: number;
  readonly delegateUserId: number;
  readonly decisionTypes: readonly AuthorityLimitsDecisionType[];
  readonly maxAmount: Money;
  readonly startsAt: Instant;
  readonly endsAt: Instant;
  readonly reason: string;
}

export interface FixtureExchangeRate {
  readonly fromCurrency: string;
  readonly toCurrency: string;
  readonly rate: string;
  readonly rateDate: CalendarDate;
  readonly source: string;
}

const MANAGER_DECISIONS: readonly AuthorityLimitsDecisionType[] = [
  'request_approval',
  'strategy_approval',
  'release_approval',
  'exclusion_approval',
  'shortlist_approval',
  'preferred_bidder_approval',
  'contract_approval',
  'change_approval',
  'renewal_approval',
  'qualification_decision',
  'late_submission_exception',
  'negotiation_mandate',
  'disposal_approval',
];

const EXECUTIVE_DECISIONS: readonly AuthorityLimitsDecisionType[] = [
  'request_approval',
  'strategy_approval',
  'preferred_bidder_approval',
  'negotiation_mandate',
  'award_approval',
  'contract_approval',
  'contract_signature',
  'change_approval',
  'renewal_approval',
];

export const AUTHORITY_LIMITS: readonly FixtureAuthorityLimit[] = Object.freeze([
  {
    id: 11,
    tenantId: tid('kwu'),
    userId: uid('mpho.manager'),
    decisionTypes: MANAGER_DECISIONS,
    maxAmount: BWP('2000000.00'),
    effectiveFrom: '2026-04-01',
    effectiveTo: null,
  },
  {
    id: 12,
    tenantId: tid('kwu'),
    userId: uid('keabetswe.approver'),
    decisionTypes: EXECUTIVE_DECISIONS,
    maxAmount: BWP('10000000.00'),
    effectiveFrom: '2026-04-01',
    effectiveTo: null,
  },
  {
    id: 13,
    tenantId: tid('kwu'),
    userId: uid('onalenna.budget'),
    decisionTypes: ['funding_confirmation'],
    maxAmount: BWP('5000000.00'),
    effectiveFrom: '2026-04-01',
    effectiveTo: null,
  },
] satisfies FixtureAuthorityLimit[]);

export const DELEGATIONS: readonly FixtureDelegation[] = Object.freeze([
  {
    id: 7,
    tenantId: tid('kwu'),
    delegatorUserId: uid('keabetswe.approver'),
    delegateUserId: uid('mpho.manager'),
    decisionTypes: ['change_approval'],
    maxAmount: BWP('500000.00'),
    startsAt: '2026-10-01T00:00:00Z',
    endsAt: '2026-10-20T22:00:00Z',
    reason: 'Chief Executive on leave 1–20 October 2026; contract changes up to BWP 500,000.00.',
  },
] satisfies FixtureDelegation[]);

export const EXCHANGE_RATES: readonly FixtureExchangeRate[] = Object.freeze([
  { fromCurrency: 'USD', toCurrency: 'BWP', rate: '13.6200', rateDate: '2026-10-02', source: 'Bank of Botswana reference rate' },
  { fromCurrency: 'ZAR', toCurrency: 'BWP', rate: '0.7480', rateDate: '2026-10-02', source: 'Bank of Botswana reference rate' },
] satisfies FixtureExchangeRate[]);

// ---------------------------------------------------------------------------------------------------------
// Approval requests
// ---------------------------------------------------------------------------------------------------------

export interface FixtureApprovalStep {
  readonly id: number;
  readonly sequence: number;
  readonly approverUserId: number | null;
  readonly committee: { committeeId: number; name: string; quorum: number | null } | null;
  readonly requiredDecisionType: AuthorityLimitsDecisionType | null;
  readonly status: ApprovalStepsStatus;
  readonly decidedByUserId: number | null;
  readonly actingForUserId: number | null;
  readonly delegationId: number | null;
  readonly decisionReason: string | null;
  readonly conditions: string | null;
  readonly decidedAt: Instant | null;
  readonly authorityCheckedAmount: Money | null;
}

export interface FixtureSnapshotFact {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly changedSince: boolean;
}

export interface FixtureConflict {
  readonly userId: number;
  readonly declarationRequired: boolean;
  readonly declared: boolean;
  readonly hasConflict: boolean | null;
  readonly disposition: ConflictDeclarationsDisposition | null;
}

export interface FixtureSod {
  readonly rule: SodPoliciesRuleCode;
  readonly mode: SodPoliciesMode;
  /** Users the rule blocks from deciding this approval (self-approval). */
  readonly blockedUserIds: readonly number[];
  readonly alternativeOversightNote: string | null;
}

export interface FixtureRouting {
  readonly reason: ApprovalRoutingReason;
  readonly skippedUserId: number | null;
  readonly routedToUserId: number | null;
  readonly routedAt: Instant;
  readonly note: string | null;
}

export interface FixtureInvalidation {
  readonly changedAt: Instant;
  readonly changedByUserId: number | null;
  readonly fromVersion: number;
  readonly toVersion: number;
  readonly changes: readonly { key: string; label: string; before: string | null; after: string | null }[];
  readonly replacementApprovalId: number | null;
}

/** The exact document version captured with the approval snapshot (PRD §14.1: evidence versions used at the time). */
export interface FixtureApprovalEvidence {
  readonly documentId: number;
  readonly versionId: number;
}

export interface FixtureApproval {
  readonly id: number;
  readonly tenantId: number;
  readonly subjectType: ApprovalRequestsSubjectType;
  readonly subjectId: number;
  readonly subjectReference: string;
  readonly subjectLinkPath: string;
  readonly subjectVersion: number;
  /** The subject's current version (differs after a material edit, AC-06). */
  readonly currentSubjectVersion: number;
  readonly contentHash: string;
  readonly title: string;
  readonly summary: string | null;
  readonly justification: string | null;
  readonly status: ApprovalRequestsStatus;
  readonly amount: Money | null;
  readonly legalEntity: { legalEntityId: number; name: string } | null;
  readonly category: { categoryId: number; name: string } | null;
  readonly requestedByUserId: number;
  readonly requestedAt: Instant;
  readonly dueAt: Instant | null;
  readonly expiresAt: Instant | null;
  readonly decidedAt: Instant | null;
  readonly routeMode: ApprovalRequestsRouteMode;
  readonly committee: { committeeId: number; name: string; quorum: number | null } | null;
  readonly conditions: string | null;
  readonly invalidatedReason: string | null;
  readonly invalidatedAt: Instant | null;
  readonly conditionsPermitted: boolean;
  readonly steps: readonly FixtureApprovalStep[];
  /** Evidence pinned to the version that was current when the snapshot was captured. */
  readonly evidence: readonly FixtureApprovalEvidence[];
  readonly snapshotCapturedAt: Instant;
  readonly snapshotFacts: readonly FixtureSnapshotFact[];
  readonly routing: FixtureRouting | null;
  readonly invalidation: FixtureInvalidation | null;
  readonly conflicts: readonly FixtureConflict[];
  readonly sod: FixtureSod | null;
  readonly holdActive: boolean;
}

const KWU_ENTITY = { legalEntityId: 1, name: 'Kalahari Water Utilities Corporation' };
const CATEGORY = {
  infrastructure: { categoryId: 1, name: 'WTR-INFRA — Water infrastructure' },
  pumps: { categoryId: 2, name: 'WTR-PUMP — Pumps and mechanical equipment' },
  meters: { categoryId: 4, name: 'WTR-METER — Water metering' },
  ict: { categoryId: 5, name: 'ICT-SCADA — SCADA and telemetry' },
  leak: { categoryId: 7, name: 'ENV-LEAK — Leak detection services' },
  civil: { categoryId: 8, name: 'CIV-WORKS — Civil works' },
  fleet: { categoryId: 9, name: 'FLEET-SVC — Fleet maintenance services' },
} as const;

interface StepSpec {
  readonly approver: string | null;
  readonly type: AuthorityLimitsDecisionType | null;
  readonly status: ApprovalStepsStatus;
  readonly decidedBy?: string;
  readonly actingFor?: string;
  readonly delegationId?: number;
  readonly reason?: string;
  readonly conditions?: string;
  readonly decidedAt?: Instant;
  readonly checked?: Money;
}

function steps(approvalId: number, specs: readonly StepSpec[]): FixtureApprovalStep[] {
  return specs.map((spec, index) => ({
    id: approvalId * 10 + index + 1,
    sequence: index + 1,
    approverUserId: spec.approver === null ? null : uid(spec.approver),
    committee: null,
    requiredDecisionType: spec.type,
    status: spec.status,
    decidedByUserId: spec.decidedBy === undefined ? null : uid(spec.decidedBy),
    actingForUserId: spec.actingFor === undefined ? null : uid(spec.actingFor),
    delegationId: spec.delegationId ?? null,
    decisionReason: spec.reason ?? null,
    conditions: spec.conditions ?? null,
    decidedAt: spec.decidedAt ?? null,
    authorityCheckedAmount: spec.checked ?? null,
  }));
}

function subject(key: RecordKey, path?: string): { subjectId: number; subjectReference: string; subjectLinkPath: string } {
  const record = RECORDS[key];
  return { subjectId: record.id, subjectReference: record.reference, subjectLinkPath: path ?? record.buyerLink };
}

const hash = approvalHash;

const NO_ROUTING = { routing: null, invalidation: null, conflicts: [], sod: null, holdActive: false } as const;

/** Labels of the tender sections a material change can touch (tenders `MATERIAL_CHANGES.section`). */
const SECTION_LABELS: Readonly<Record<string, string>> = {
  overview: 'Estimated value',
  lots: 'Lots',
  requirements: 'Requirements',
  documents: 'Documents',
  timetable: 'Timetable',
  evaluation_plan: 'Evaluation plan',
  pricing: 'Pricing schedule',
};

// ---- AC-06: the release approval of T-2026-0005 revision 2, invalidated by revision 3 (tenders/release.ts) ----
const AC06_SOURCE = releaseApprovalSource(31);
const AC06_CHANGES = MATERIAL_CHANGES.filter((change) => change.invalidatedApprovalId === AC06_SOURCE.approvalId).sort(
  (a, b) => Date.parse(a.changedAt) - Date.parse(b.changedAt),
);
const AC06_LAST_CHANGE = AC06_CHANGES[AC06_CHANGES.length - 1];
const AC06_BASE = releaseApproval(AC06_SOURCE);
const AC06: FixtureApproval = {
  ...AC06_BASE,
  justification:
    'The current chemical supply contracts expire on 31 December 2026; the framework consolidates the separate purchases of the five treatment works.',
  evidence: [{ documentId: 203, versionId: 2032 }],
  snapshotFacts: [
    { key: 'version', label: 'Tender revision', value: String(AC06_SOURCE.subjectVersion), changedSince: true },
    ...AC06_CHANGES.map((change) => ({
      key: change.section,
      label: SECTION_LABELS[change.section] ?? change.section,
      value: change.fromValue ?? '—',
      changedSince: true,
    })),
    ...AC06_BASE.snapshotFacts.filter((snapshot) => snapshot.key === 'procedure'),
  ],
  invalidation:
    AC06_LAST_CHANGE === undefined
      ? null
      : {
          changedAt: AC06_LAST_CHANGE.changedAt,
          changedByUserId: AC06_LAST_CHANGE.changedBy,
          fromVersion: AC06_SOURCE.subjectVersion,
          toVersion: AC06_LAST_CHANGE.draftRevision,
          changes: AC06_CHANGES.map((change) => ({
            key: change.section,
            label: SECTION_LABELS[change.section] ?? change.section,
            before: change.fromValue,
            after: change.toValue,
          })),
          replacementApprovalId: null,
        },
};

// ---- AC-05: PR-2026-0003 exceeds the procurement manager's authority and is routed up (requests/requests.ts) ----
const AC05: FixtureApproval = {
  ...requestApproval(requestOfApproval(305)),
  evidence: [
    { documentId: 204, versionId: 2041 },
    { documentId: 205, versionId: 2051 },
  ],
};

const HAND_WRITTEN: readonly FixtureApproval[] = [
  AC06,
  AC05,
  {
    id: 58,
    tenantId: tid('kwu'),
    subjectType: 'disposal',
    subjectId: 5,
    subjectReference: 'Disposal request 5',
    subjectLinkPath: '/buyer/admin/records/disposals/5',
    subjectVersion: 1,
    currentSubjectVersion: 1,
    contentHash: hash(58, 1),
    title: 'Destroy supplier financial statements submitted in 2019 (12)',
    summary: 'Retention of the 2019 financial evidence ended on 30 Jun 2025.',
    justification: 'Eligible when checked on 28 Jun 2026: no hold, dispute or live contract depends on the records.',
    status: 'approved',
    amount: null,
    legalEntity: KWU_ENTITY,
    category: null,
    requestedByUserId: uid('pule.auditor'),
    requestedAt: '2026-06-28T04:00:00Z',
    dueAt: '2026-07-12T15:00:00Z',
    expiresAt: null,
    decidedAt: '2026-07-10T09:00:00Z',
    routeMode: 'sequential',
    committee: null,
    conditions: null,
    invalidatedReason: null,
    invalidatedAt: null,
    conditionsPermitted: false,
    steps: steps(58, [
      {
        approver: 'mpho.manager',
        type: 'disposal_approval',
        status: 'approved',
        decidedBy: 'mpho.manager',
        reason: 'Retention ended; no hold, dispute or live contract depends on them.',
        decidedAt: '2026-07-10T09:00:00Z',
      },
    ]),
    evidence: [],
    snapshotCapturedAt: '2026-06-28T04:00:00Z',
    snapshotFacts: [
      { key: 'disposition', label: 'Disposition', value: 'Destroy', changedSince: false },
      { key: 'records', label: 'Records', value: 'Financial statements 2019 (12 submissions)', changedSince: false },
    ],
    ...NO_ROUTING,
  },
  {
    id: 59,
    tenantId: tid('kwu'),
    subjectType: 'disposal',
    subjectId: 6,
    subjectReference: 'Disposal request 6',
    subjectLinkPath: '/buyer/admin/records/disposals/6',
    subjectVersion: 1,
    currentSubjectVersion: 1,
    contentHash: hash(59, 1),
    title: 'Archive evaluation records of 2018 events (4)',
    summary: 'Retention of the 2018 evaluation records ended on 31 Dec 2025.',
    justification: 'Proposed by the scheduled retention check on 2 Aug 2026.',
    status: 'rejected',
    amount: null,
    legalEntity: KWU_ENTITY,
    category: null,
    requestedByUserId: uid('pule.auditor'),
    requestedAt: '2026-08-02T04:00:00Z',
    dueAt: '2026-08-16T15:00:00Z',
    expiresAt: null,
    decidedAt: '2026-08-12T14:00:00Z',
    routeMode: 'sequential',
    committee: null,
    conditions: null,
    invalidatedReason: null,
    invalidatedAt: null,
    conditionsPermitted: false,
    steps: steps(59, [
      {
        approver: 'mpho.manager',
        type: 'disposal_approval',
        status: 'rejected',
        decidedBy: 'mpho.manager',
        reason: 'Records support an open contract dispute; retain until it is resolved.',
        decidedAt: '2026-08-12T14:00:00Z',
      },
    ]),
    evidence: [],
    snapshotCapturedAt: '2026-08-02T04:00:00Z',
    snapshotFacts: [
      { key: 'disposition', label: 'Disposition', value: 'Archive', changedSince: false },
      { key: 'records', label: 'Records', value: 'Evaluation records 2018 (4 events)', changedSince: false },
    ],
    ...NO_ROUTING,
  },
  {
    id: 61,
    tenantId: tid('kwu'),
    subjectType: 'disposal',
    subjectId: 4,
    subjectReference: 'Disposal request 4',
    subjectLinkPath: '/buyer/admin/records/disposals/4',
    subjectVersion: 1,
    currentSubjectVersion: 1,
    contentHash: hash(61, 1),
    title: 'Destroy personal account data of two users deactivated in 2023',
    summary: 'Personal account data only; approvals, submissions and audit rows of these users are retained.',
    justification: 'Retention of the personal profiles ended in 2025 (BR-38, BR-39).',
    status: 'approved',
    amount: null,
    legalEntity: KWU_ENTITY,
    category: null,
    requestedByUserId: uid('pule.auditor'),
    requestedAt: '2026-09-13T04:00:00Z',
    dueAt: '2026-09-27T15:00:00Z',
    expiresAt: null,
    decidedAt: '2026-09-20T10:00:00Z',
    routeMode: 'sequential',
    committee: null,
    conditions: null,
    invalidatedReason: null,
    invalidatedAt: null,
    conditionsPermitted: false,
    steps: steps(61, [
      {
        approver: 'mpho.manager',
        type: 'disposal_approval',
        status: 'approved',
        decidedBy: 'mpho.manager',
        reason: 'Personal data only; their approvals and submissions stay in the business record (BR-38, BR-39).',
        decidedAt: '2026-09-20T10:00:00Z',
      },
    ]),
    evidence: [],
    snapshotCapturedAt: '2026-09-13T04:00:00Z',
    snapshotFacts: [
      { key: 'disposition', label: 'Disposition', value: 'Destroy', changedSince: false },
      { key: 'records', label: 'Records', value: 'Personal profiles deactivated 14 Mar 2023 and 2 Aug 2023', changedSince: false },
    ],
    ...NO_ROUTING,
  },
  {
    id: 34,
    tenantId: tid('kwu'),
    subjectType: 'funding',
    ...subject('pr8'),
    subjectVersion: 1,
    currentSubjectVersion: 1,
    contentHash: hash(34, 1),
    title: `Confirm funding for ${RECORDS.pr8.reference} ${RECORDS.pr8.title}`,
    summary: 'Annual supply of overalls, safety boots, gloves, hard hats and rain gear on call-off.',
    justification:
      'The requester marked the funding as indicative; the request cannot be approved before the budget holder confirms it.',
    status: 'pending',
    amount: BWP('840000.00'),
    legalEntity: KWU_ENTITY,
    category: null,
    requestedByUserId: uid('kagiso.requester'),
    requestedAt: '2026-09-28T08:30:00Z',
    dueAt: '2026-10-09T15:00:00Z',
    expiresAt: '2026-10-30T15:00:00Z',
    decidedAt: null,
    routeMode: 'sequential',
    committee: null,
    conditions: null,
    invalidatedReason: null,
    invalidatedAt: null,
    conditionsPermitted: false,
    steps: steps(34, [{ approver: 'onalenna.budget', type: 'funding_confirmation', status: 'pending' }]),
    evidence: [],
    snapshotCapturedAt: '2026-09-28T08:30:00Z',
    snapshotFacts: [
      { key: 'amount', label: 'Amount to commit (total contemplated commitment)', value: 'BWP 840,000.00', changedSince: false },
      { key: 'estimatedValue', label: 'Estimated annual value', value: 'BWP 420,000.00', changedSince: false },
      { key: 'fundingStatus', label: 'Funding status stated by the requester', value: 'Indicative', changedSince: false },
    ],
    ...NO_ROUTING,
  },
  {
    id: 35,
    tenantId: tid('kwu'),
    subjectType: 'award',
    ...subject('t1', `/buyer/awards/${RECORDS.t1.id}`),
    subjectVersion: 1,
    currentSubjectVersion: 1,
    contentHash: hash(35, 1),
    title: 'Award T-2026-0001 Lot 1 to Tsodilo Engineering',
    summary: 'Lot 1 — submersible pumps for the Boteti wellfield.',
    justification: 'Highest-ranked compliant tender for lot 1, within the approved lot 1 budget of BWP 5,500,000.00; funding confirmed on 27 Jul 2026.',
    status: 'approved',
    amount: BWP('5340000.00'),
    legalEntity: KWU_ENTITY,
    category: CATEGORY.pumps,
    requestedByUserId: uid('former.officer'),
    requestedAt: '2026-07-27T10:20:00Z',
    dueAt: '2026-08-07T15:00:00Z',
    expiresAt: null,
    decidedAt: '2026-08-05T13:00:00Z',
    routeMode: 'sequential',
    committee: null,
    conditions: null,
    invalidatedReason: null,
    invalidatedAt: null,
    conditionsPermitted: true,
    steps: steps(35, [
      {
        approver: 'keabetswe.approver',
        type: 'award_approval',
        status: 'approved',
        decidedBy: 'keabetswe.approver',
        reason: 'Evaluation, funding and diligence are complete; lot 2 cancellation reason is documented.',
        decidedAt: '2026-08-05T13:00:00Z',
        checked: BWP('5340000.00'),
      },
    ]),
    evidence: [{ documentId: 218, versionId: 2181 }],
    snapshotCapturedAt: '2026-07-27T10:20:00Z',
    snapshotFacts: [
      { key: 'lot', label: 'Lot', value: 'Lot 1 — Submersible pumps', changedSince: false },
      { key: 'supplier', label: 'Recommended supplier', value: 'Tsodilo Engineering (Pty) Ltd', changedSince: false },
      { key: 'value', label: 'Award value', value: 'BWP 5,340,000.00', changedSince: false },
    ],
    ...NO_ROUTING,
  },
  {
    id: 36,
    tenantId: tid('kwu'),
    subjectType: 'contract_change',
    subjectId: 3,
    subjectReference: `${RECORDS.c1.reference} CR-0003`,
    subjectLinkPath: `${RECORDS.c1.buyerLink}/changes`,
    subjectVersion: 1,
    currentSubjectVersion: 1,
    contentHash: hash(36, 1),
    title: 'Approve change CR-0003 to C-2026-0001 Fleet vehicle maintenance',
    summary: 'Add maintenance of 6 heavy tanker trucks from November 2026.',
    justification: 'Tanker fleet transferred from the Northern region; no in-house workshop capacity.',
    status: 'pending',
    amount: BWP('285000.00'),
    legalEntity: KWU_ENTITY,
    category: CATEGORY.fleet,
    requestedByUserId: uid('masego.contracts'),
    requestedAt: '2026-10-01T12:05:00Z',
    dueAt: '2026-10-10T15:00:00Z',
    expiresAt: '2026-10-31T15:00:00Z',
    decidedAt: null,
    routeMode: 'sequential',
    committee: null,
    conditions: null,
    invalidatedReason: null,
    invalidatedAt: null,
    conditionsPermitted: true,
    steps: steps(36, [{ approver: 'keabetswe.approver', type: 'change_approval', status: 'pending' }]),
    evidence: [
      { documentId: 216, versionId: 2161 },
      { documentId: 209, versionId: 2091 },
    ],
    snapshotCapturedAt: '2026-10-01T12:05:00Z',
    snapshotFacts: [
      { key: 'changeValue', label: 'Value of this change', value: 'BWP 285,000.00', changedSince: false },
      {
        key: 'cumulative',
        label: 'Cumulative changes (CR-0001 to CR-0003)',
        value: 'BWP 430,000.00 (23.24% of the original value of BWP 1,850,000.00)',
        changedSince: false,
      },
      { key: 'term', label: 'Term impact', value: 'None', changedSince: false },
    ],
    ...NO_ROUTING,
  },
  {
    id: 37,
    tenantId: tid('kwu'),
    subjectType: 'exclusion',
    subjectId: 5101,
    subjectReference: `${RECORDS.t3.reference} / Makgadikgadi Civil Works`,
    subjectLinkPath: '/buyer/compliance/exclusions/5101',
    subjectVersion: 1,
    currentSubjectVersion: 1,
    contentHash: hash(37, 1),
    title: 'Exclude Makgadikgadi Civil Works from T-2026-0003 (REQ-Q-03)',
    summary:
      'Mandatory requirement REQ-Q-03 (ISO 9001 certificate valid at closing) failed; the commercial envelope remains sealed.',
    justification:
      'The certificate submitted expired on 30 November 2025 and the clarification response confirms that no valid certificate was held at closing.',
    status: 'pending',
    amount: null,
    legalEntity: KWU_ENTITY,
    category: CATEGORY.ict,
    requestedByUserId: uid('boitumelo.chair'),
    requestedAt: '2026-09-29T11:00:00Z',
    dueAt: '2026-10-03T15:00:00Z',
    expiresAt: '2026-10-24T15:00:00Z',
    decidedAt: null,
    routeMode: 'sequential',
    committee: null,
    conditions: null,
    invalidatedReason: null,
    invalidatedAt: null,
    conditionsPermitted: false,
    steps: steps(37, [{ approver: 'mpho.manager', type: 'exclusion_approval', status: 'pending' }]),
    evidence: [{ documentId: 215, versionId: 2151 }],
    snapshotCapturedAt: '2026-09-29T11:00:00Z',
    snapshotFacts: [
      { key: 'requirement', label: 'Requirement', value: 'REQ-Q-03 ISO 9001 quality certificate (mandatory)', changedSince: false },
      { key: 'finding', label: 'Finding', value: 'Substantive non-compliance', changedSince: false },
      { key: 'effect', label: 'Effect', value: 'Excluded from ranking; commercial envelope not opened', changedSince: false },
    ],
    ...NO_ROUTING,
  },
  {
    id: 38,
    tenantId: tid('kwu'),
    subjectType: 'award',
    ...subject('t7', `/buyer/awards/${RECORDS.t7.id}`),
    subjectVersion: 1,
    currentSubjectVersion: 1,
    contentHash: hash(38, 1),
    title: 'Award T-2026-0007 Reservoir rehabilitation works (intent)',
    summary: 'Intent to award to the highest-ranked bidder; standstill period applies.',
    justification: 'Evaluation report signed off by the evaluation chair on 10 September 2026.',
    status: 'approved_with_conditions',
    amount: BWP('7850000.00'),
    legalEntity: KWU_ENTITY,
    category: CATEGORY.civil,
    requestedByUserId: uid('tebogo.officer'),
    requestedAt: '2026-09-14T09:00:00Z',
    dueAt: '2026-09-21T15:00:00Z',
    expiresAt: null,
    decidedAt: '2026-09-18T11:00:00Z',
    routeMode: 'sequential',
    committee: null,
    conditions: 'No contract may be signed before the standstill ends and any complaint is decided.',
    invalidatedReason: null,
    invalidatedAt: null,
    conditionsPermitted: true,
    steps: steps(38, [
      {
        approver: 'keabetswe.approver',
        type: 'award_approval',
        status: 'approved_with_conditions',
        decidedBy: 'keabetswe.approver',
        reason: 'The recommendation follows the published method; funding confirmed.',
        conditions: 'No contract may be signed before the standstill ends and any complaint is decided.',
        decidedAt: '2026-09-18T11:00:00Z',
        checked: BWP('7850000.00'),
      },
    ]),
    evidence: [{ documentId: 207, versionId: 2071 }],
    snapshotCapturedAt: '2026-09-14T09:00:00Z',
    snapshotFacts: [
      { key: 'value', label: 'Award value', value: 'BWP 7,850,000.00', changedSince: false },
      { key: 'standstill', label: 'Standstill ends', value: '8 Oct 2026, 17:00 (UTC+02:00) Africa/Gaborone', changedSince: false },
    ],
    ...NO_ROUTING,
  },
  {
    id: 39,
    tenantId: tid('kwu'),
    subjectType: 'award',
    ...subject('t9', `/buyer/awards/${RECORDS.t9.id}`),
    subjectVersion: 1,
    currentSubjectVersion: 1,
    contentHash: hash(39, 1),
    title: 'Award T-2026-0009 Acoustic leak detection services to Limpopo Environmental Services',
    summary: 'Conditional recommendation after the preferred bidder failed due diligence; the fallback decision is approved.',
    justification:
      'Limpopo Environmental Services is the next-ranked compliant bidder (82.97 points) within the approved budget of BWP 3,100,000.00.',
    status: 'pending',
    amount: BWP('2940000.00'),
    legalEntity: KWU_ENTITY,
    category: CATEGORY.leak,
    requestedByUserId: uid('tebogo.officer'),
    requestedAt: '2026-09-25T08:15:00Z',
    dueAt: '2026-10-09T15:00:00Z',
    expiresAt: '2026-10-30T15:00:00Z',
    decidedAt: null,
    routeMode: 'sequential',
    committee: null,
    conditions: null,
    invalidatedReason: null,
    invalidatedAt: null,
    conditionsPermitted: true,
    steps: steps(39, [{ approver: 'keabetswe.approver', type: 'award_approval', status: 'pending' }]),
    evidence: [],
    snapshotCapturedAt: '2026-09-25T08:15:00Z',
    snapshotFacts: [
      { key: 'supplier', label: 'Recommended supplier', value: 'Limpopo Environmental Services (Pty) Ltd', changedSince: false },
      { key: 'value', label: 'Award value', value: 'BWP 2,940,000.00', changedSince: false },
      { key: 'diligence', label: 'Due diligence', value: 'One award-blocking finding open (professional indemnity insurance)', changedSince: false },
    ],
    ...NO_ROUTING,
  },
  {
    id: 41,
    tenantId: tid('kwu'),
    subjectType: 'shortlist',
    ...subject('t9', '/buyer/selection/shortlists/9'),
    subjectVersion: 1,
    currentSubjectVersion: 1,
    contentHash: hash(41, 1),
    title: 'Approve shortlist for T-2026-0009 Acoustic leak detection services',
    summary: 'Two of three applicants advance to stage two.',
    justification: 'Shortlisting rule: stage-one non-price score of at least 49.00, up to two candidates in rank order.',
    status: 'approved',
    amount: null,
    legalEntity: KWU_ENTITY,
    category: CATEGORY.leak,
    requestedByUserId: uid('former.officer'),
    requestedAt: '2026-08-20T08:00:00Z',
    dueAt: '2026-08-27T15:00:00Z',
    expiresAt: null,
    decidedAt: '2026-08-24T13:00:00Z',
    routeMode: 'sequential',
    committee: null,
    conditions: null,
    invalidatedReason: null,
    invalidatedAt: null,
    conditionsPermitted: false,
    steps: steps(41, [
      {
        approver: 'mpho.manager',
        type: 'shortlist_approval',
        status: 'approved',
        decidedBy: 'mpho.manager',
        reason: 'Rule applied consistently; exclusion reasons recorded.',
        decidedAt: '2026-08-24T13:00:00Z',
      },
    ]),
    evidence: [],
    snapshotCapturedAt: '2026-08-20T08:00:00Z',
    snapshotFacts: [{ key: 'shortlisted', label: 'Shortlisted', value: '2 of 3 applicants', changedSince: false }],
    ...NO_ROUTING,
  },
  {
    id: 42,
    tenantId: tid('kwu'),
    subjectType: 'contract_difference',
    ...subject('c2', `${RECORDS.c2.buyerLink}/preparation`),
    subjectVersion: 2,
    currentSubjectVersion: 2,
    contentHash: hash(42, 2),
    title: 'Review differences between the Lot 1 award and C-2026-0002',
    summary: 'The contract for signature extends delivery to 16 weeks and adds BWP 48,000.00 for commissioning.',
    justification: 'Supplier requested the extension after factory lead times changed; commissioning was omitted from the schedule.',
    status: 'pending',
    amount: BWP('4668000.00'),
    legalEntity: KWU_ENTITY,
    category: CATEGORY.pumps,
    requestedByUserId: uid('masego.contracts'),
    requestedAt: '2026-10-01T08:10:00Z',
    dueAt: '2026-10-08T15:00:00Z',
    expiresAt: '2026-10-29T15:00:00Z',
    decidedAt: null,
    routeMode: 'sequential',
    committee: null,
    conditions: null,
    invalidatedReason: null,
    invalidatedAt: null,
    conditionsPermitted: true,
    steps: steps(42, [
      { approver: 'dineo.legal', type: null, status: 'pending' },
      { approver: 'keabetswe.approver', type: 'contract_approval', status: 'pending' },
    ]),
    evidence: [
      { documentId: 211, versionId: 2112 },
      { documentId: 212, versionId: 2121 },
      { documentId: 218, versionId: 2181 },
    ],
    snapshotCapturedAt: '2026-10-01T08:10:00Z',
    snapshotFacts: [
      { key: 'awardValue', label: 'Approved award value', value: 'BWP 4,620,000.00 (allocated from the BWP 5,340,000.00 lot 1 award)', changedSince: false },
      { key: 'contractValue', label: 'Contract value', value: 'BWP 4,668,000.00', changedSince: false },
      { key: 'delivery', label: 'Delivery period', value: '16 weeks (award: 12 weeks)', changedSince: false },
    ],
    ...NO_ROUTING,
  },
  {
    id: 43,
    tenantId: tid('kwu'),
    subjectType: 'late_submission_exception',
    subjectId: 204,
    subjectReference: `${RECORDS.t8.reference} / Chobe Pipe & Valve Supplies`,
    subjectLinkPath: `/buyer/submissions/${RECORDS.t8.id}`,
    subjectVersion: 1,
    currentSubjectVersion: 1,
    contentHash: hash(43, 1),
    title: 'Late submission exception — Chobe Pipe & Valve Supplies on T-2026-0008',
    summary: 'The replacement completed 38 seconds after the submission deadline; revision 1 (RCPT-2026-000024) remains effective.',
    justification: 'Supplier reports a slow upload on its own network; the service log shows no platform incident at the deadline.',
    status: 'pending',
    amount: null,
    legalEntity: KWU_ENTITY,
    category: CATEGORY.infrastructure,
    requestedByUserId: uid('tebogo.officer'),
    requestedAt: '2026-09-26T09:00:00Z',
    dueAt: '2026-10-07T15:00:00Z',
    expiresAt: '2026-10-17T15:00:00Z',
    decidedAt: null,
    routeMode: 'sequential',
    committee: null,
    conditions: null,
    invalidatedReason: null,
    invalidatedAt: null,
    conditionsPermitted: false,
    steps: steps(43, [{ approver: 'mpho.manager', type: 'late_submission_exception', status: 'pending' }]),
    evidence: [],
    snapshotCapturedAt: '2026-09-26T09:00:00Z',
    snapshotFacts: [
      { key: 'deadline', label: 'Deadline', value: '25 Sep 2026, 10:00 (UTC+02:00) Africa/Gaborone', changedSince: false },
      { key: 'received', label: 'Attempt recorded', value: '25 Sep 2026, 10:00:38 (UTC+02:00) Africa/Gaborone', changedSince: false },
    ],
    routing: null,
    invalidation: null,
    conflicts: [
      { userId: uid('mpho.manager'), declarationRequired: true, declared: true, hasConflict: true, disposition: 'pending_review' },
    ],
    sod: null,
    holdActive: false,
  },
  {
    id: 44,
    tenantId: tid('kwu'),
    subjectType: 'addendum',
    subjectId: 23,
    subjectReference: `${RECORDS.t2.reference} Addendum 3`,
    subjectLinkPath: '/buyer/clarifications/addenda/23',
    subjectVersion: 1,
    currentSubjectVersion: 1,
    contentHash: hash(44, 1),
    title: 'Approve Addendum 3 to T-2026-0002 (delivery schedule)',
    summary: 'Splits deliveries into two batches; no change to the submission deadline.',
    justification: 'Warehouse capacity at Francistown is limited until January 2027.',
    status: 'pending',
    amount: null,
    legalEntity: KWU_ENTITY,
    category: CATEGORY.meters,
    requestedByUserId: uid('mpho.manager'),
    requestedAt: '2026-10-05T07:00:00Z',
    dueAt: '2026-10-08T15:00:00Z',
    expiresAt: '2026-10-15T15:00:00Z',
    decidedAt: null,
    routeMode: 'sequential',
    committee: null,
    conditions: null,
    invalidatedReason: null,
    invalidatedAt: null,
    conditionsPermitted: false,
    steps: steps(44, [{ approver: 'mpho.manager', type: 'release_approval', status: 'pending' }]),
    evidence: [{ documentId: 201, versionId: 2012 }],
    snapshotCapturedAt: '2026-10-05T07:00:00Z',
    snapshotFacts: [
      { key: 'change', label: 'Change', value: 'Delivery in two batches (December 2026, February 2027)', changedSince: false },
    ],
    routing: null,
    invalidation: null,
    conflicts: [],
    sod: {
      rule: 'draft_vs_final_approval',
      mode: 'enforced',
      blockedUserIds: [uid('mpho.manager')],
      alternativeOversightNote: null,
    },
    holdActive: false,
  },
  {
    id: 45,
    tenantId: tid('kwu'),
    subjectType: 'funding',
    ...subject('pr11'),
    subjectVersion: 1,
    currentSubjectVersion: 1,
    contentHash: hash(45, 1),
    title: `Confirm funding for ${RECORDS.pr11.reference} ${RECORDS.pr11.title}`,
    summary: 'Design, supply and installation of solar pumping systems with battery backup at 22 remote boreholes.',
    justification:
      'The capital contribution depends on the resilience grant; the request was deferred on 24 Jun 2026 awaiting the grant decision.',
    status: 'expired',
    amount: BWP('3150000.00'),
    legalEntity: KWU_ENTITY,
    category: CATEGORY.infrastructure,
    requestedByUserId: uid('kagiso.requester'),
    requestedAt: '2026-06-03T08:00:00Z',
    dueAt: '2026-06-10T15:00:00Z',
    expiresAt: '2026-06-17T15:00:00Z',
    decidedAt: null,
    routeMode: 'sequential',
    committee: null,
    conditions: null,
    invalidatedReason: null,
    invalidatedAt: null,
    conditionsPermitted: false,
    steps: steps(45, [{ approver: 'onalenna.budget', type: 'funding_confirmation', status: 'pending' }]),
    evidence: [],
    snapshotCapturedAt: '2026-06-03T08:00:00Z',
    snapshotFacts: [
      { key: 'amount', label: 'Amount to commit (total contemplated commitment)', value: 'BWP 3,150,000.00', changedSince: false },
      { key: 'fundingStatus', label: 'Funding status stated by the requester', value: 'Indicative', changedSince: false },
    ],
    ...NO_ROUTING,
  },
];

/**
 * Every approval request of the demo world: the ones written here, then every approval the other domains refer to
 * (derived from their fixtures in `./approvals/sources.ts`, so the ids, subjects and outcomes agree everywhere).
 */
export const APPROVALS: readonly FixtureApproval[] = Object.freeze([
  ...HAND_WRITTEN,
  ...sourcedApprovals(new Set(HAND_WRITTEN.map((approval) => approval.id))),
] satisfies FixtureApproval[]);

/** The approval with `id`, or `undefined`. */
export function findFixtureApproval(id: number): FixtureApproval | undefined {
  return APPROVALS.find((approval) => approval.id === id);
}

/** The delegation letting `userId` act for someone on this approval's step, if one is in force. */
export function delegationFor(
  tenantId: number,
  delegateUserId: number,
  delegatorUserId: number,
  decisionType: AuthorityLimitsDecisionType | null,
  at: Instant = WORKSPACE_AS_OF,
): FixtureDelegation | undefined {
  const time = Date.parse(at);
  return DELEGATIONS.find(
    (delegation) =>
      delegation.tenantId === tenantId &&
      delegation.delegateUserId === delegateUserId &&
      delegation.delegatorUserId === delegatorUserId &&
      (decisionType === null || delegation.decisionTypes.includes(decisionType)) &&
      Date.parse(delegation.startsAt) <= time &&
      time < Date.parse(delegation.endsAt),
  );
}
