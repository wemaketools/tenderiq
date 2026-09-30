/**
 * Dashboard fixtures: the facts behind BUY-01 (deadlines, approvals, complaints, obligations, renewals, tasks and
 * the "requires attention" items) and SUP-01 (per-supplier invitations, pursuits, deadlines, qualifications,
 * evidence, outcomes and contract tasks). The handler computes KPIs, panels and filters from these rows, so every
 * filter of the dashboard really narrows the data.
 *
 * The rows mirror the owning domains' fixtures (tender timetables, workspace approvals, contract obligations and
 * renewal options, supplier evidence, qualification decisions, award notices) as of `REPORTING_AS_OF`.
 * Each row names the permission(s) a viewer needs to see it (any of). Rows a viewer cannot read are dropped before
 * anything is counted (BR-43).
 */
import type { Money } from '../../../contracts/common.js';
import type {
  ApprovalRequestsSubjectType,
  BidRevisionsStatus,
  BidsSubmissionState,
  ChipTone,
  EvidenceItemsEvidenceType,
  LotOutcomesOutcome,
  LotOutcomesStatus,
  ObligationsKind,
  ObligationsStatus,
  ParticipantsInvitationStatus,
  PursuitsDecision,
  RenewalOptionsOptionType,
  TenderMilestonesMilestone,
  VQualificationStatusEffectiveStatus,
} from '../../../contracts/enums.js';
import type { PermissionCode } from '../../../contracts/permissions.js';
import type { AttentionKey, BuyerDashboardKpiKey, SupplierDashboardKpiKey } from '../../../contracts/reporting.js';
import { APPROVALS } from '../approvals.js';
import { BIDS, BID_REVISIONS, SUBMISSION_RECEIPTS } from '../bids/responses.js';
import { TENANTS, TENANT_IDS } from '../platform.js';
import { PARTICIPANTS } from '../publication/participants.js';
import { PURSUITS } from '../publication/pursuits.js';
import { EVIDENCE_ITEMS, EVIDENCE_SHARES } from '../suppliers/evidence.js';
import { LOTS as TENDER_LOTS } from '../tenders/structure.js';
import { MILESTONES as TENDER_MILESTONES } from '../tenders/timetable.js';
import { KWU, LINKS, ODC, TENDER_FACTS, USERS, lotLabel, tenderFact } from './storyline.js';

const S = TENANT_IDS;

// ---------------------------------------------------------------------------------------------------------
// BUY-01
// ---------------------------------------------------------------------------------------------------------

export interface FixtureDeadline {
  readonly tenantId: number;
  readonly tenderId: number;
  readonly milestone: TenderMilestonesMilestone;
  readonly lotLabel: string | null;
  readonly at: string;
}

/** Milestones BUY-01 lists (site visits, briefings and internal contract starts are not deadlines). */
const DASHBOARD_MILESTONES: readonly TenderMilestonesMilestone[] = [
  'questions_deadline',
  'submission_deadline',
  'opening',
  'standstill_end',
  'expected_award',
];

/** The label of a lot-specific milestone, from the tenders-domain lot (`Lot 3: Pump controls …`). */
function milestoneLotLabel(lotId: number | null): string | null {
  if (lotId === null) {
    return null;
  }
  const lot = TENDER_LOTS.find((row) => row.id === lotId);
  if (lot === undefined) {
    throw new Error(`No tenders-domain lot ${lotId}.`);
  }
  return `Lot ${lot.lotNo}: ${lot.title}`;
}

/**
 * The milestones of the tender timetables (tenders domain, `../tenders/timetable.ts`), so every date on the
 * dashboards is the official timetable date, including the deadlines moved by addenda (T-2026-0002 to 21 Oct 2026,
 * T-2026-0011 to 23 Oct 2026). The handler keeps the ones still ahead at `REPORTING_AS_OF`.
 */
export const DASHBOARD_DEADLINES: readonly FixtureDeadline[] = TENDER_MILESTONES.filter(
  (row) =>
    DASHBOARD_MILESTONES.includes(row.milestone) &&
    TENDER_FACTS.some((tender) => tender.id === row.tenderId && tender.tenantId === row.tenantId && tender.status !== 'archived'),
).map((row) => ({ tenantId: row.tenantId, tenderId: row.tenderId, milestone: row.milestone, lotLabel: milestoneLotLabel(row.lotId), at: row.at }));

/** The official whole-event instant of a timetable milestone (tenders domain). */
export function timetableAt(tenderId: number, milestone: TenderMilestonesMilestone): string {
  const row = TENDER_MILESTONES.find((candidate) => candidate.tenderId === tenderId && candidate.milestone === milestone && candidate.lotId === null);
  if (row === undefined) {
    throw new Error(`No ${milestone} milestone on tender ${tenderId}.`);
  }
  return row.at;
}

export interface FixtureDashboardApproval {
  readonly tenantId: number;
  readonly approvalId: number;
  readonly title: string;
  readonly subjectType: ApprovalRequestsSubjectType;
  readonly amount: Money | null;
  readonly requestedBy: number;
  readonly requestedAt: string;
  readonly dueAt: string | null;
  /** The tender the approval belongs to (for dimension filters), if any. */
  readonly tenderId: number | null;
}

/** The tender an approval belongs to, read from its subject reference (`T-2026-0003 / …`). */
function approvalTenderId(subjectReference: string | null): number | null {
  if (subjectReference === null) {
    return null;
  }
  const match = /T-2026-(\d{4})/.exec(subjectReference);
  return match === null ? null : Number(match[1]);
}

/**
 * Pending approvals of the workspace approval fixtures (the owner of approval_requests). The handler lists only the
 * caller's own (requester, step approver or delegate), the rule `/me/approvals/{id}` applies.
 */
export const DASHBOARD_APPROVALS: readonly FixtureDashboardApproval[] = APPROVALS.filter((approval) => approval.status === 'pending').map(
  (approval) => ({
    tenantId: approval.tenantId,
    approvalId: approval.id,
    title: approval.title,
    subjectType: approval.subjectType,
    amount: approval.amount,
    requestedBy: approval.requestedByUserId,
    requestedAt: approval.requestedAt,
    dueAt: approval.dueAt,
    tenderId: approvalTenderId(approval.subjectReference),
  }),
);

export interface FixtureComplaintFact {
  readonly tenantId: number;
  readonly tenderId: number;
  /** Awards-domain complaint id (`../awards/cases.ts`). */
  readonly complaintId: number;
  readonly open: boolean;
}

export const DASHBOARD_COMPLAINTS: readonly FixtureComplaintFact[] = [
  { tenantId: KWU, tenderId: 7, complaintId: 92, open: true },
  { tenantId: KWU, tenderId: 2, complaintId: 94, open: true },
  { tenantId: KWU, tenderId: 1, complaintId: 91, open: false },
  { tenantId: ODC, tenderId: 11, complaintId: 93, open: true },
];

export interface FixtureObligationFact {
  readonly tenantId: number;
  readonly contractId: number;
  readonly tenderId: number | null;
  readonly title: string;
  readonly status: ObligationsStatus;
  readonly dueOn: string;
}

/** Overdue and rejected obligations of the contract fixtures. */
export const DASHBOARD_OBLIGATIONS: readonly FixtureObligationFact[] = [
  { tenantId: KWU, contractId: 1, tenderId: 10, title: 'Roadworthiness certificates for serviced heavy vehicles', status: 'overdue', dueOn: '2026-09-20' },
  { tenantId: KWU, contractId: 1, tenderId: 10, title: 'Q3 service report (July to September)', status: 'rejected', dueOn: '2026-09-15' },
  { tenantId: KWU, contractId: 4, tenderId: null, title: 'Final reconciliation of unread meters', status: 'overdue', dueOn: '2026-07-31' },
  { tenantId: KWU, contractId: 6, tenderId: null, title: 'Monthly valve inspection report', status: 'overdue', dueOn: '2026-09-10' },
];

export interface FixtureRenewalFact {
  readonly tenantId: number;
  readonly contractId: number;
  readonly tenderId: number | null;
  readonly optionType: RenewalOptionsOptionType;
  readonly noticeWindowOpensOn: string;
  readonly decisionDueOn: string;
  readonly decided: boolean;
}

/** Undecided renewal and extension options of the contract fixtures. */
export const DASHBOARD_RENEWALS: readonly FixtureRenewalFact[] = [
  { tenantId: KWU, contractId: 6, tenderId: null, optionType: 'renewal', noticeWindowOpensOn: '2026-09-01', decisionDueOn: '2026-10-31', decided: false },
  { tenantId: KWU, contractId: 1, tenderId: 10, optionType: 'renewal', noticeWindowOpensOn: '2026-10-11', decisionDueOn: '2026-12-31', decided: false },
  { tenantId: KWU, contractId: 1, tenderId: 10, optionType: 'extension', noticeWindowOpensOn: '2027-01-04', decisionDueOn: '2027-02-26', decided: false },
  { tenantId: ODC, contractId: 7, tenderId: null, optionType: 'renewal', noticeWindowOpensOn: '2026-10-01', decisionDueOn: '2026-11-13', decided: false },
];

/** Open and overdue task counts per person (from the task inbox), for the workload panel. */
export interface FixtureWorkloadTasks {
  readonly tenantId: number;
  readonly userId: number;
  readonly openTasks: number;
  readonly overdueTasks: number;
  readonly pendingApprovals: number;
}

export const DASHBOARD_WORKLOAD_TASKS: readonly FixtureWorkloadTasks[] = [
  { tenantId: KWU, userId: USERS.tebogo, openTasks: 9, overdueTasks: 2, pendingApprovals: 0 },
  { tenantId: KWU, userId: USERS.mpho, openTasks: 6, overdueTasks: 1, pendingApprovals: 4 },
  { tenantId: KWU, userId: USERS.boitumelo, openTasks: 4, overdueTasks: 1, pendingApprovals: 0 },
  { tenantId: KWU, userId: USERS.masego, openTasks: 5, overdueTasks: 1, pendingApprovals: 0 },
  { tenantId: KWU, userId: USERS.keabetswe, openTasks: 3, overdueTasks: 0, pendingApprovals: 3 },
  { tenantId: ODC, userId: USERS.officerOdc, openTasks: 3, overdueTasks: 0, pendingApprovals: 0 },
];

export interface FixtureAttentionItem {
  readonly tenantId: number;
  readonly key: AttentionKey;
  readonly label: string;
  readonly detail: string;
  readonly count: number;
  readonly tone: ChipTone;
  readonly to: string;
  /** The tender the item concerns (dimension filters), or `null` for organization-wide items. */
  readonly tenderId: number | null;
  /**
   * The item is about the tender itself (its approvals, complaints, evaluation, opening or publication), so only
   * people who may open that tender see it; contract items keyed to a tender follow contract access instead.
   */
  readonly tenderScoped: boolean;
  readonly visibleWith: readonly PermissionCode[];
}

/** Attention keys that concern a tender event rather than a contract or a supplier. */
const TENDER_ATTENTION_KEYS: readonly AttentionKey[] = [
  'approval_invalidated',
  'blocking_complaint',
  'failed_due_diligence',
  'evaluation_incomplete',
  'sealed_awaiting_opening',
  'integration_exception',
];

const ATTENTION_ROWS: readonly Omit<FixtureAttentionItem, 'tenderScoped'>[] = [
  { tenantId: KWU, key: 'approval_invalidated', label: 'Release approval invalidated', detail: 'T-2026-0005: a scope and value edit invalidated the release approval; request it again.', count: 1, tone: 'danger', to: LINKS.buyerTender(5), tenderId: 5, visibleWith: ['tender.view'] },
  { tenantId: KWU, key: 'blocking_complaint', label: 'Complaint holds the award', detail: 'T-2026-0007: Limpopo Environmental Services’ complaint blocks the final award during the investigation.', count: 1, tone: 'danger', to: LINKS.buyerComplaint(92), tenderId: 7, visibleWith: ['complaint.manage', 'tender.view'] },
  { tenantId: KWU, key: 'failed_due_diligence', label: 'Preferred bidder failed due diligence', detail: 'T-2026-0009: fallback decision recorded; the next-ranked bidder is under review.', count: 1, tone: 'warning', to: LINKS.buyerTender(9), tenderId: 9, visibleWith: ['tender.view'] },
  { tenantId: KWU, key: 'evaluation_incomplete', label: 'Evaluation incomplete', detail: 'T-2026-0003: one evaluator has a criterion not scored; the assessment cannot be finalized.', count: 1, tone: 'warning', to: LINKS.buyerTender(3), tenderId: 3, visibleWith: ['evaluation.chair', 'tender.view'] },
  { tenantId: KWU, key: 'sealed_awaiting_opening', label: 'Sealed submissions awaiting opening', detail: 'T-2026-0008: submissions stay sealed until the deferred opening session.', count: 1, tone: 'info', to: LINKS.buyerTender(8), tenderId: 8, visibleWith: ['bid.monitor', 'tender.view'] },
  { tenantId: KWU, key: 'integration_exception', label: 'External publication not confirmed', detail: 'T-2026-0002: the Government Gazette gateway rejected the Addendum 1 notice; the exception is assigned for republication and reconciliation.', count: 1, tone: 'danger', to: LINKS.buyerTenderPublication(2), tenderId: 2, visibleWith: ['tender.publish', 'tender.view'] },
  { tenantId: KWU, key: 'evidence_expiring', label: 'Supplier evidence expiring', detail: 'Chobe Pipe & Valve Supplies: public liability insurance expires on 8 Oct 2026 (qualified with conditions).', count: 1, tone: 'warning', to: LINKS.buyerSupplier(S['chobe-pipe']), tenderId: null, visibleWith: ['supplier.directory.view'] },
  { tenantId: KWU, key: 'obligation_rejected', label: 'Milestone evidence rejected', detail: 'C-2026-0001: the Q3 service report was rejected; remediation is required.', count: 1, tone: 'danger', to: LINKS.buyerContract(1), tenderId: 10, visibleWith: ['contract.view'] },
  { tenantId: KWU, key: 'change_authority_exceeded', label: 'Change requests above authority', detail: 'C-2026-0001: three change requests together exceed the officer’s authority and need approval.', count: 3, tone: 'warning', to: LINKS.buyerContract(1), tenderId: 10, visibleWith: ['contract.view'] },
  { tenantId: KWU, key: 'renewal_window', label: 'Renewal notice window open', detail: 'C-2025-0005: the renewal notice window opened on 1 Sep 2026; the decision is due by 31 Oct 2026 and none is recorded.', count: 1, tone: 'info', to: LINKS.buyerContract(6), tenderId: null, visibleWith: ['contract.view'] },
  { tenantId: ODC, key: 'renewal_window', label: 'Renewal notice window open', detail: 'C-2025-0004: the cleaning contract renewal window opened on 1 Oct 2026 with no decision yet.', count: 1, tone: 'info', to: LINKS.buyerContract(7), tenderId: null, visibleWith: ['contract.view'] },
];

export const DASHBOARD_ATTENTION: readonly FixtureAttentionItem[] = ATTENTION_ROWS.map((row) => ({
  ...row,
  tenderScoped: TENDER_ATTENTION_KEYS.includes(row.key),
}));

export interface FixtureKpiDelta {
  readonly tenantId: number;
  readonly key: BuyerDashboardKpiKey;
  readonly direction: 'up' | 'down' | 'flat';
  readonly value: number;
  readonly positive: boolean;
}

/** Movement against the previous month, shown only when no filter narrows the dashboard. */
export const DASHBOARD_KPI_DELTAS: readonly FixtureKpiDelta[] = [
  { tenantId: KWU, key: 'active_events', direction: 'up', value: 2, positive: true },
  { tenantId: KWU, key: 'pending_approvals', direction: 'up', value: 3, positive: false },
  { tenantId: KWU, key: 'open_complaints', direction: 'up', value: 1, positive: false },
  { tenantId: KWU, key: 'overdue_obligations', direction: 'up', value: 1, positive: false },
  { tenantId: ODC, key: 'active_events', direction: 'up', value: 1, positive: true },
];

// ---------------------------------------------------------------------------------------------------------
// SUP-01
// ---------------------------------------------------------------------------------------------------------

export interface FixtureSupplierInvitation {
  readonly supplierTenantId: number;
  readonly tenderId: number;
  readonly invitationStatus: ParticipantsInvitationStatus;
  readonly closingAt: string | null;
}

const T2_CLOSE = timetableAt(2, 'submission_deadline');
const T6_CLOSE = timetableAt(6, 'submission_deadline');
const T11_CLOSE = timetableAt(11, 'submission_deadline');

/** Submission deadlines still ahead at `REPORTING_AS_OF` (tenders domain timetables). */
const OPEN_CLOSING_AT: Readonly<Record<number, string>> = { 2: T2_CLOSE, 6: T6_CLOSE, 11: T11_CLOSE };

/** Tender statuses in which a supplier's pursuit is no longer active. */
const INACTIVE_TENDER_STATUSES: readonly string[] = ['awarded', 'information_collected', 'archived', 'cancelled'];

/** Invitations of the publication domain (`../publication/participants.ts`): only formally invited organizations. */
export const SUPPLIER_INVITATIONS: readonly FixtureSupplierInvitation[] = PARTICIPANTS.filter(
  (row) => row.invitationStatus !== 'not_invited',
).map((row) => ({
  supplierTenantId: row.supplierTenantId,
  tenderId: row.tenderId,
  invitationStatus: row.invitationStatus,
  closingAt: OPEN_CLOSING_AT[row.tenderId] ?? null,
}));

export interface FixtureSupplierPursuit {
  readonly supplierTenantId: number;
  readonly tenderId: number;
  /** The supplier's own current bid (bids domain id; the latest round), `null` when it has no bid on the event. */
  readonly bidId: number | null;
  readonly decision: PursuitsDecision;
  readonly submissionState: BidsSubmissionState;
  readonly latestRevisionStatus: BidRevisionsStatus | null;
  readonly effectiveReceiptNo: string | null;
  readonly closingAt: string | null;
  /** The tender is still active for the supplier (open, closed, under assessment or award pending). */
  readonly active: boolean;
  /** Last change of the bid (latest revision) or, without a bid, of the pursuit decision. */
  readonly updatedAt: string;
}

/** Receipt statuses that make a receipt the effective one (not superseded, withdrawn or rejected as late). */
const EFFECTIVE_RECEIPT_STATUSES: readonly string[] = ['received', 'selected_for_evaluation'];

/**
 * SUP-01 pursuits: the supplier's pursuit decisions (publication domain, `../publication/pursuits.ts`) joined with
 * its own bid (bids domain, `../bids/responses.ts`). Submission state, the latest revision status and the effective
 * receipt come from the bids domain, so only an official receipt shows a response as submitted (BR-18, AC-11).
 * When a supplier has several bids on one event (multi-stage T-2026-0009), the latest round is shown.
 */
export const SUPPLIER_PURSUITS: readonly FixtureSupplierPursuit[] = PURSUITS.map((pursuit): FixtureSupplierPursuit => {
  const bid = BIDS.filter((row) => row.supplierTenantId === pursuit.tenantId && row.tenderId === pursuit.tenderId).sort(
    (a, b) => b.id - a.id,
  )[0];
  const latestRevision =
    bid === undefined
      ? undefined
      : BID_REVISIONS.filter((row) => row.bidId === bid.id).sort((a, b) => b.revisionNo - a.revisionNo)[0];
  const receipt =
    bid === undefined
      ? undefined
      : SUBMISSION_RECEIPTS.find((row) => row.bidId === bid.id && EFFECTIVE_RECEIPT_STATUSES.includes(row.status));
  return {
    supplierTenantId: pursuit.tenantId,
    tenderId: pursuit.tenderId,
    bidId: bid?.id ?? null,
    decision: pursuit.decision,
    submissionState: bid?.submissionState ?? 'not_submitted',
    latestRevisionStatus: latestRevision?.status ?? null,
    effectiveReceiptNo: bid?.submissionState === 'submitted' ? (receipt?.receiptNo ?? null) : null,
    closingAt: OPEN_CLOSING_AT[pursuit.tenderId] ?? null,
    active: !INACTIVE_TENDER_STATUSES.includes(tenderFact(pursuit.tenderId).status),
    updatedAt: latestRevision?.updatedAt ?? pursuit.updatedAt,
  };
}).sort(
  (a, b) =>
    Number(b.active) - Number(a.active) ||
    (a.closingAt ?? '9999').localeCompare(b.closingAt ?? '9999') ||
    b.tenderId - a.tenderId,
);

export interface FixtureSupplierDeadline {
  readonly supplierTenantId: number;
  readonly tenderId: number;
  readonly milestone: TenderMilestonesMilestone;
  readonly at: string;
}

export const SUPPLIER_DEADLINES: readonly FixtureSupplierDeadline[] = [
  { supplierTenantId: S.tsodilo, tenderId: 6, milestone: 'submission_deadline', at: T6_CLOSE },
  { supplierTenantId: S.tsodilo, tenderId: 2, milestone: 'submission_deadline', at: T2_CLOSE },
  { supplierTenantId: S['chobe-pipe'], tenderId: 6, milestone: 'submission_deadline', at: T6_CLOSE },
  { supplierTenantId: S['chobe-pipe'], tenderId: 2, milestone: 'submission_deadline', at: T2_CLOSE },
  { supplierTenantId: S['serowe-ict'], tenderId: 2, milestone: 'questions_deadline', at: timetableAt(2, 'questions_deadline') },
  { supplierTenantId: S['serowe-ict'], tenderId: 2, milestone: 'submission_deadline', at: T2_CLOSE },
  { supplierTenantId: S['gaborone-meter'], tenderId: 2, milestone: 'submission_deadline', at: T2_CLOSE },
  { supplierTenantId: S.makgadikgadi, tenderId: 11, milestone: 'questions_deadline', at: timetableAt(11, 'questions_deadline') },
  { supplierTenantId: S.makgadikgadi, tenderId: 11, milestone: 'submission_deadline', at: T11_CLOSE },
  { supplierTenantId: S.makgadikgadi, tenderId: 7, milestone: 'standstill_end', at: timetableAt(7, 'standstill_end') },
  { supplierTenantId: S['limpopo-env'], tenderId: 7, milestone: 'standstill_end', at: timetableAt(7, 'standstill_end') },
];

export interface FixtureSupplierQualification {
  readonly supplierTenantId: number;
  readonly buyerTenantId: number;
  readonly programName: string;
  readonly status: VQualificationStatusEffectiveStatus;
  readonly scopeLabel: string | null;
  readonly effectiveTo: string | null;
  readonly conditions: string | null;
}

const WATER_PROGRAM = 'Water Infrastructure Suppliers — Category A';

/** Effective qualification status per supplier and program (qualification domain decisions). */
export const SUPPLIER_QUALIFICATIONS: readonly FixtureSupplierQualification[] = [
  { supplierTenantId: S.tsodilo, buyerTenantId: KWU, programName: WATER_PROGRAM, status: 'qualified', scopeLabel: 'WTR-PUMP, up to BWP 8,000,000', effectiveTo: '2028-04-14', conditions: null },
  {
    supplierTenantId: S['chobe-pipe'],
    buyerTenantId: KWU,
    programName: WATER_PROGRAM,
    status: 'qualified_with_conditions',
    scopeLabel: 'WTR-PIPE, up to BWP 5,000,000',
    effectiveTo: '2028-05-03',
    conditions: 'Supply a renewed public liability insurance certificate (cover of at least BWP 5,000,000) before the current policy expires on 8 Oct 2026.',
  },
  {
    supplierTenantId: S.makgadikgadi,
    buyerTenantId: KWU,
    programName: WATER_PROGRAM,
    status: 'not_assessed',
    scopeLabel: 'WTR-PUMP (applied)',
    effectiveTo: null,
    conditions: 'More information required: clarify the financial statement (requested by the financial reviewer).',
  },
  { supplierTenantId: S['serowe-ict'], buyerTenantId: KWU, programName: 'ICT and Telemetry Service Providers', status: 'qualified', scopeLabel: 'ICT-SCADA, up to BWP 5,000,000', effectiveTo: '2029-01-31', conditions: null },
  { supplierTenantId: S['gaborone-meter'], buyerTenantId: KWU, programName: 'Metering Equipment Suppliers', status: 'expired', scopeLabel: 'WTR-METER, up to BWP 3,000,000', effectiveTo: '2026-08-31', conditions: null },
  {
    supplierTenantId: S['limpopo-env'],
    buyerTenantId: KWU,
    programName: 'Environmental and Laboratory Services',
    status: 'suspended',
    scopeLabel: 'ENV-LEAK, up to BWP 2,000,000',
    effectiveTo: '2028-01-19',
    conditions: 'Suspended until a valid waste management licence is provided.',
  },
];

export interface FixtureSupplierEvidence {
  readonly supplierTenantId: number;
  readonly evidenceId: number;
  readonly title: string;
  readonly evidenceType: EvidenceItemsEvidenceType;
  readonly expiresAt: string;
  readonly sharedWith: readonly string[];
}

/** Evidence statuses that still stand in a supplier's library (replaced and withdrawn editions do not). */
const STANDING_EVIDENCE: readonly string[] = ['current', 'expired'];

/**
 * The dated evidence of the supplier libraries (suppliers domain, `../suppliers/evidence-items.ts`, the single source
 * of evidence items): ids, titles, types and expiry dates are the library's own, so every SUP-01 row opens the same
 * item on SUP-05. `sharedWith` names the buyers the edition is currently shared with (active `evidence_shares`).
 * The handler keeps the items expired or expiring within `SUPPLIER_EVIDENCE_WINDOW_DAYS`.
 */
export const SUPPLIER_EVIDENCE: readonly FixtureSupplierEvidence[] = EVIDENCE_ITEMS.flatMap((item) =>
  item.expiresAt === null || !STANDING_EVIDENCE.includes(item.status)
    ? []
    : [
        {
          supplierTenantId: item.tenantId,
          evidenceId: item.id,
          title: item.title,
          evidenceType: item.evidenceType,
          expiresAt: item.expiresAt,
          sharedWith: EVIDENCE_SHARES.filter((share) => share.evidenceItemId === item.id && share.withdrawnAt === null)
            .map((share) => TENANTS.find((tenant) => tenant.id === share.buyerTenantId)?.name ?? '')
            .filter((name) => name !== ''),
        },
      ],
);

export interface FixtureSupplierOutcome {
  readonly supplierTenantId: number;
  readonly tenderId: number;
  readonly lotLabel: string | null;
  readonly outcome: LotOutcomesOutcome | null;
  readonly outcomeStatus: LotOutcomesStatus | null;
  readonly successful: boolean;
  readonly noticeIssuedAt: string;
  readonly standstillEndsAt: string | null;
}

/** The supplier's own outcomes from the award notices (awards domain). */
export const SUPPLIER_OUTCOMES: readonly FixtureSupplierOutcome[] = [
  { supplierTenantId: S.tsodilo, tenderId: 1, lotLabel: lotLabel(1, 101), outcome: 'award', outcomeStatus: 'final_awarded', successful: true, noticeIssuedAt: '2026-09-04T09:00:00Z', standstillEndsAt: null },
  { supplierTenantId: S.tsodilo, tenderId: 10, lotLabel: null, outcome: 'award', outcomeStatus: 'final_awarded', successful: true, noticeIssuedAt: '2026-03-06T10:00:00Z', standstillEndsAt: null },
  { supplierTenantId: S['chobe-pipe'], tenderId: 1, lotLabel: lotLabel(1, 101), outcome: null, outcomeStatus: null, successful: false, noticeIssuedAt: '2026-09-04T09:00:00Z', standstillEndsAt: null },
  { supplierTenantId: S.makgadikgadi, tenderId: 7, lotLabel: null, outcome: 'award', outcomeStatus: 'intent_notified', successful: true, noticeIssuedAt: '2026-09-22T08:00:00Z', standstillEndsAt: '2026-10-08T15:00:00Z' },
  { supplierTenantId: S['limpopo-env'], tenderId: 7, lotLabel: null, outcome: null, outcomeStatus: null, successful: false, noticeIssuedAt: '2026-09-22T08:05:00Z', standstillEndsAt: '2026-10-08T15:00:00Z' },
  { supplierTenantId: S.tsodilo, tenderId: 7, lotLabel: null, outcome: null, outcomeStatus: null, successful: false, noticeIssuedAt: '2026-09-22T08:05:00Z', standstillEndsAt: '2026-10-08T15:00:00Z' },
];

export interface FixtureSupplierContractTask {
  readonly supplierTenantId: number;
  readonly contractId: number;
  readonly obligationTitle: string;
  readonly kind: ObligationsKind;
  readonly status: ObligationsStatus;
  readonly dueOn: string;
}

/** Supplier-party obligations of the contract fixtures that still need action. */
export const SUPPLIER_CONTRACT_TASKS: readonly FixtureSupplierContractTask[] = [
  { supplierTenantId: S.tsodilo, contractId: 1, obligationTitle: 'Q3 service report (July to September) — evidence rejected', kind: 'milestone', status: 'rejected', dueOn: '2026-09-15' },
  { supplierTenantId: S.tsodilo, contractId: 1, obligationTitle: 'Roadworthiness certificates for serviced heavy vehicles', kind: 'deliverable', status: 'overdue', dueOn: '2026-09-20' },
  { supplierTenantId: S.tsodilo, contractId: 1, obligationTitle: 'Monthly fleet availability report', kind: 'obligation', status: 'due', dueOn: '2026-10-05' },
  { supplierTenantId: S.tsodilo, contractId: 1, obligationTitle: 'Motor trade insurance renewal evidence', kind: 'obligation', status: 'due', dueOn: '2026-10-20' },
  { supplierTenantId: S.tsodilo, contractId: 2, obligationTitle: 'Performance bond (10%) before the notice to proceed', kind: 'obligation', status: 'planned', dueOn: '2026-10-25' },
  { supplierTenantId: S['gaborone-meter'], contractId: 4, obligationTitle: 'Final reconciliation of unread meters', kind: 'deliverable', status: 'overdue', dueOn: '2026-07-31' },
  { supplierTenantId: S['chobe-pipe'], contractId: 6, obligationTitle: 'Monthly valve inspection report', kind: 'obligation', status: 'overdue', dueOn: '2026-09-10' },
  { supplierTenantId: S['chobe-pipe'], contractId: 6, obligationTitle: 'Safety method statement for confined-space work', kind: 'obligation', status: 'due', dueOn: '2026-10-09' },
  { supplierTenantId: S['limpopo-env'], contractId: 7, obligationTitle: 'Monthly cleaning inspection sheet', kind: 'obligation', status: 'due', dueOn: '2026-10-03' },
];

/** Movement of the supplier KPIs against the previous month. */
export const SUPPLIER_KPI_DELTAS: ReadonlyArray<{
  readonly supplierTenantId: number;
  readonly key: SupplierDashboardKpiKey;
  readonly direction: 'up' | 'down' | 'flat';
  readonly value: number;
  readonly positive: boolean;
}> = [
  { supplierTenantId: S.tsodilo, key: 'submitted_responses', direction: 'up', value: 2, positive: true },
  { supplierTenantId: S['chobe-pipe'], key: 'expiring_evidence', direction: 'up', value: 1, positive: false },
];
