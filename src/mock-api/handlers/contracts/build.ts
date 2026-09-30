/**
 * Projections of the contracts fixtures into contract responses (buyer CON-01 … CON-11, supplier SUP-23).
 *
 * Every function here is pure: it reads the frozen fixtures and the request time and returns contract-shaped data.
 * Visibility is decided by the callers (`index.ts`): buyer projections take a contract already scoped to the active
 * buyer tenant, supplier projections a contract already scoped to the supplier tenant and past internal preparation.
 * Supplier projections never read `renewal_options` ([R], DD-03), handovers, allocations or approval internals.
 */
import { valueBandOf } from '../../../contracts/policy.js';
import type { CustomFieldContext } from '../../../contracts/policy.js';
import { customFieldValuesOf } from '../../custom-fields.js';
import { CATEGORIES as TENDER_CATEGORIES, TENDERS as TENDER_REGISTER } from '../../fixtures/tenders/index.js';
import type { Money, OfficialDeadline, PersonRef } from '../../../contracts/common.js';
import type {
  AcceptanceDecisionView,
  AwardSource,
  ChangeAuthorityCheck,
  ChangeRequestDetail,
  ChangeRequestRow,
  ContractApprovalRef,
  ContractCheck,
  ContractCloseout,
  ContractDetail,
  ContractDisputeView,
  ContractFinancials,
  ContractHandover,
  ContractIncidentView,
  ContractInvoiceView,
  ContractLotAllocation,
  ContractMilestone,
  ContractNextDecision,
  ContractPerformance,
  ContractPreparation,
  ContractRenewals,
  ContractRow,
  ContractSecurity,
  ContractSignatory,
  ContractSignature,
  ImprovementActionView,
  MeasureResultView,
  ObligationCounts,
  ObligationDetail,
  ObligationEvidenceView,
  ObligationRow,
  PerformanceReviewDetail,
  PerformanceReviewRow,
  RenewalOptionView,
  RenewalWindowState,
  SupplierChangeRequestRow,
  SupplierContractDetail,
  SupplierContractRow,
  SupplierObligationDetail,
  SupplierObligationRow,
  SupplierReviewView,
  SupplierSignatoryView,
} from '../../../contracts/contracts.js';
import { changeRequestLabel } from '../../../contracts/contracts.js';
import { add, div, formatMoney, gt, lt, mul, round, sub, sum } from '../../../contracts/decimal.js';
import type { ObligationsStatus } from '../../../contracts/enums.js';
import { PERSONAS } from '../../fixtures/platform.js';
import {
  CONTRACTS,
  CONTRACT_ACCEPTANCE_DECISIONS,
  CONTRACT_ALLOCATIONS,
  CONTRACT_APPROVALS,
  CONTRACT_CHANGES,
  CONTRACT_CLOSEOUTS,
  CONTRACT_DISPUTES,
  CONTRACT_EVIDENCE,
  CONTRACT_HANDOVERS,
  CONTRACT_HOLDS,
  CONTRACT_IMPROVEMENT_ACTIONS,
  CONTRACT_INCIDENTS,
  CONTRACT_INVOICES,
  CONTRACT_LEGAL_ENTITIES,
  CONTRACT_LOT_OUTCOMES,
  CONTRACT_MEASURES,
  CONTRACT_MEASURE_RESULTS,
  CONTRACT_OBLIGATIONS,
  CONTRACT_RENEWAL_OPTIONS,
  CONTRACT_REVIEWS,
  CONTRACT_SECURITIES,
  CONTRACT_SIGNATORIES,
} from '../../fixtures/contracts/index.js';
import type {
  FixtureChange,
  FixtureContract,
  FixtureContractApproval,
  FixtureDispute,
  FixtureInvoice,
  FixtureLegalEntity,
  FixtureObligation,
  FixtureRenewalOption,
  FixtureReview,
  FixtureSecurity,
  FixtureSignatory,
} from '../../fixtures/contracts/index.js';
import { findTenantById, membershipPermissions, personRef } from '../../persona.js';

// ---------------------------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------------------------

const DAY_MS = 86_400_000;

export function money(amount: string, currency: string): Money {
  return { amount: round(amount, 2), currency };
}

export function zero(currency: string): Money {
  return money('0', currency);
}

function moneySum(values: readonly (Money | null)[], currency: string): Money {
  return money(sum(values.filter((value): value is Money => value !== null).map((value) => value.amount)), currency);
}

export function personOrNull(userId: number | null): PersonRef | null {
  return userId === null ? null : personRef(userId);
}

export function tenantName(tenantId: number): string {
  return findTenantById(tenantId)?.name ?? `Organization ${tenantId}`;
}

export function timeZoneOf(contract: FixtureContract): string {
  return findTenantById(contract.tenantId)?.officialTimeZone ?? 'Africa/Gaborone';
}

export function deadline(at: string | null, timeZone: string): OfficialDeadline | null {
  return at === null ? null : { at, timeZone };
}

/** `1 invoice`, `2 invoices`: a count with the singular or plural noun. */
export function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** The calendar date of `now` in the given IANA zone (`YYYY-MM-DD`). */
export function localDate(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

function daysBetween(fromDate: string, toDate: string): number {
  return Math.round((Date.parse(`${toDate}T00:00:00Z`) - Date.parse(`${fromDate}T00:00:00Z`)) / DAY_MS);
}

export function isoInstant(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function matchesText(query: string | undefined, ...values: (string | null)[]): boolean {
  if (query === undefined || query.length === 0) {
    return true;
  }
  const needle = query.toLowerCase();
  return values.some((value) => value !== null && value.toLowerCase().includes(needle));
}

export function sortBy<T>(rows: T[], key: (row: T) => string | number | null, dir: 'asc' | 'desc'): T[] {
  const factor = dir === 'asc' ? 1 : -1;
  return rows.sort((a, b) => {
    const left = key(a);
    const right = key(b);
    if (left === right) {
      return 0;
    }
    if (left === null) {
      return 1;
    }
    if (right === null) {
      return -1;
    }
    return (left < right ? -1 : 1) * factor;
  });
}

// ---------------------------------------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------------------------------------

export function buyerContracts(tenantId: number): FixtureContract[] {
  return CONTRACTS.filter((contract) => contract.tenantId === tenantId);
}

export function findBuyerContract(tenantId: number, contractId: number): FixtureContract | undefined {
  return CONTRACTS.find((contract) => contract.id === contractId && contract.tenantId === tenantId);
}

/** Contracts past internal preparation are shared with the supplier legal party (PRD §13.1). */
export const SUPPLIER_HIDDEN_STATUSES: readonly string[] = ['draft', 'under_review'];

export function supplierContracts(supplierTenantId: number): FixtureContract[] {
  return CONTRACTS.filter(
    (contract) => contract.supplierTenantId === supplierTenantId && !SUPPLIER_HIDDEN_STATUSES.includes(contract.status),
  );
}

export function findSupplierContract(supplierTenantId: number, contractId: number): FixtureContract | undefined {
  return supplierContracts(supplierTenantId).find((contract) => contract.id === contractId);
}

export function legalEntityOf(contract: FixtureContract): FixtureLegalEntity {
  const entity = CONTRACT_LEGAL_ENTITIES.find((candidate) => candidate.legalEntityId === contract.legalEntityId);
  if (entity === undefined) {
    throw new Error(`Contract ${contract.reference} names unknown legal entity ${contract.legalEntityId}.`);
  }
  return entity;
}

function legalEntityRef(contract: FixtureContract) {
  const entity = legalEntityOf(contract);
  return { legalEntityId: entity.legalEntityId, name: entity.name, registrationNumber: entity.registrationNumber };
}

export function supplierRef(tenantId: number) {
  const tenant = findTenantById(tenantId);
  if (tenant === undefined) {
    throw new Error(`Unknown supplier tenant ${tenantId}.`);
  }
  return { tenantId: tenant.id, name: tenant.name, slug: tenant.slug };
}

export function obligationsOf(contractId: number): FixtureObligation[] {
  return CONTRACT_OBLIGATIONS.filter((obligation) => obligation.contractId === contractId);
}

export function changesOf(contractId: number): FixtureChange[] {
  return CONTRACT_CHANGES.filter((change) => change.contractId === contractId);
}

export function invoicesOf(contractId: number): FixtureInvoice[] {
  return CONTRACT_INVOICES.filter((invoice) => invoice.contractId === contractId);
}

export function reviewsOf(contractId: number): FixtureReview[] {
  return CONTRACT_REVIEWS.filter((review) => review.contractId === contractId);
}

export function disputesOf(contractId: number): FixtureDispute[] {
  return CONTRACT_DISPUTES.filter((dispute) => dispute.contractId === contractId);
}

export function securitiesOf(contractId: number): FixtureSecurity[] {
  return CONTRACT_SECURITIES.filter((security) => security.contractId === contractId);
}

export function renewalOptionsOf(contractId: number): FixtureRenewalOption[] {
  return CONTRACT_RENEWAL_OPTIONS.filter((option) => option.contractId === contractId);
}

export function signatoriesOf(contractId: number): FixtureSignatory[] {
  return CONTRACT_SIGNATORIES.filter((signatory) => signatory.contractId === contractId);
}

export function handoverOf(contractId: number) {
  return CONTRACT_HANDOVERS.find((handover) => handover.contractId === contractId);
}

export function closeoutOf(contractId: number) {
  return CONTRACT_CLOSEOUTS.find((closeout) => closeout.contractId === contractId);
}

export function holdsOf(contractId: number) {
  return CONTRACT_HOLDS.filter((hold) => hold.contractId === contractId);
}

export function approvalById(approvalId: number | null): FixtureContractApproval | undefined {
  return approvalId === null ? undefined : CONTRACT_APPROVALS.find((approval) => approval.id === approvalId);
}

export function approvalRef(approvalId: number | null): ContractApprovalRef | null {
  const approval = approvalById(approvalId);
  if (approval === undefined) {
    return null;
  }
  return {
    approvalId: approval.id,
    subjectType: approval.subjectType,
    status: approval.status,
    title: approval.title,
    amount: approval.amount,
    requestedBy: personRef(approval.requestedByUserId),
    requestedAt: approval.requestedAt,
    currentApprover: personOrNull(approval.currentApproverUserId),
    decidedAt: approval.decidedAt,
    inApprovalWorkspace: approval.inApprovalWorkspace,
  };
}

/** True when the contract differs from the award and its `contract_difference` approval is not approved (AC-28). */
export function differenceBlocks(contract: FixtureContract): boolean {
  if (!contract.differsFromAward) {
    return false;
  }
  const approval = approvalById(contract.differenceApprovalId);
  return approval === undefined || !['approved', 'approved_with_conditions'].includes(approval.status);
}

// ---------------------------------------------------------------------------------------------------------
// Values (DD-32: decimal strings only)
// ---------------------------------------------------------------------------------------------------------

const APPROVED_CHANGE_STATUSES: readonly string[] = ['agreed', 'incorporated'];
const PENDING_CHANGE_STATUSES: readonly string[] = ['submitted', 'impact_assessment', 'approval_pending'];

export function approvedChangesTotal(contract: FixtureContract): Money {
  return moneySum(
    changesOf(contract.id)
      .filter((change) => APPROVED_CHANGE_STATUSES.includes(change.status))
      .map((change) => change.costImpact),
    contract.value.currency,
  );
}

export function pendingChangesTotal(contract: FixtureContract): Money {
  return moneySum(
    changesOf(contract.id)
      .filter((change) => PENDING_CHANGE_STATUSES.includes(change.status))
      .map((change) => change.costImpact),
    contract.value.currency,
  );
}

export function currentValue(contract: FixtureContract): Money {
  return money(add(contract.value.amount, approvedChangesTotal(contract).amount), contract.value.currency);
}

export function remainingCeiling(contract: FixtureContract): Money | null {
  return contract.ceiling === null ? null : money(sub(contract.ceiling.amount, currentValue(contract).amount), contract.ceiling.currency);
}

// ---------------------------------------------------------------------------------------------------------
// Obligations
// ---------------------------------------------------------------------------------------------------------

const OPEN_OBLIGATION_STATUSES: readonly ObligationsStatus[] = [
  'planned',
  'due',
  'evidence_submitted',
  'under_review',
  'rejected',
  'overdue',
];

export function isObligationOpen(obligation: FixtureObligation): boolean {
  return OPEN_OBLIGATION_STATUSES.includes(obligation.status);
}

export function isObligationOverdue(obligation: FixtureObligation, now: Date): boolean {
  if (obligation.status === 'overdue') {
    return true;
  }
  return (
    (obligation.status === 'planned' || obligation.status === 'due') &&
    obligation.dueAt !== null &&
    Date.parse(obligation.dueAt) < now.getTime()
  );
}

function latestDecision(obligationId: number) {
  const decisions = CONTRACT_ACCEPTANCE_DECISIONS.filter((decision) => decision.obligationId === obligationId).sort(
    (a, b) => b.decidedAt.localeCompare(a.decidedAt),
  );
  const latest = decisions[0];
  return latest === undefined ? null : { decision: latest.decision, decidedAt: latest.decidedAt };
}

export function obligationRow(obligation: FixtureObligation, contract: FixtureContract, now: Date): ObligationRow {
  return {
    id: obligation.id,
    contractId: obligation.contractId,
    kind: obligation.kind,
    party: obligation.party,
    title: obligation.title,
    owner: personOrNull(obligation.ownerUserId),
    supplierContact: obligation.supplierContact,
    dueAt: deadline(obligation.dueAt, timeZoneOf(contract)),
    recurrence: obligation.recurrence,
    status: obligation.status,
    isPaymentMilestone: obligation.isPaymentMilestone,
    amount: obligation.amount,
    survivesCloseout: obligation.survivesCloseout,
    isOverdue: isObligationOverdue(obligation, now),
    evidenceCount: CONTRACT_EVIDENCE.filter((evidence) => evidence.obligationId === obligation.id).length,
    latestDecision: latestDecision(obligation.id),
  };
}

export function obligationCounts(contract: FixtureContract, now: Date): ObligationCounts {
  const rows = obligationsOf(contract.id);
  return {
    total: rows.length,
    open: rows.filter(isObligationOpen).length,
    overdue: rows.filter((row) => isObligationOverdue(row, now)).length,
    rejected: rows.filter((row) => row.status === 'rejected').length,
    awaitingReview: rows.filter((row) => row.status === 'evidence_submitted' || row.status === 'under_review').length,
    surviving: rows.filter((row) => row.survivesCloseout).length,
  };
}

export function evidenceView(evidenceId: number): ObligationEvidenceView {
  const evidence = CONTRACT_EVIDENCE.find((candidate) => candidate.id === evidenceId);
  if (evidence === undefined) {
    throw new Error(`Unknown evidence ${evidenceId}.`);
  }
  return {
    id: evidence.id,
    submittedBy: { ...personRef(evidence.submittedByUserId), capacity: capacityOf(evidence.submittedByUserId, evidence.organizationTenantId) },
    organizationName: tenantName(evidence.organizationTenantId),
    document: evidence.document,
    note: evidence.note,
    submittedAt: evidence.submittedAt,
  };
}

export function capacityOf(userId: number, tenantId: number): string | null {
  const persona = PERSONAS.find((candidate) => candidate.userId === userId);
  return persona?.memberships.find((membership) => membership.tenantId === tenantId)?.capacity ?? null;
}

export function decisionView(decisionId: number, contract: FixtureContract): AcceptanceDecisionView {
  const decision = CONTRACT_ACCEPTANCE_DECISIONS.find((candidate) => candidate.id === decisionId);
  if (decision === undefined) {
    throw new Error(`Unknown acceptance decision ${decisionId}.`);
  }
  return {
    id: decision.id,
    decision: decision.decision,
    reasons: decision.reasons,
    remediationRequired: decision.remediationRequired,
    remediationOwner: personOrNull(decision.remediationOwnerUserId),
    remediationDueAt: deadline(decision.remediationDueAt, timeZoneOf(contract)),
    decidedBy: personRef(decision.decidedByUserId),
    decidedAt: decision.decidedAt,
  };
}

function evidenceFor(obligationId: number, supplierTenantId: number | null): ObligationEvidenceView[] {
  return CONTRACT_EVIDENCE.filter(
    (evidence) =>
      evidence.obligationId === obligationId && (supplierTenantId === null || evidence.organizationTenantId === supplierTenantId),
  )
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
    .map((evidence) => evidenceView(evidence.id));
}

function decisionsFor(obligationId: number, contract: FixtureContract): AcceptanceDecisionView[] {
  return CONTRACT_ACCEPTANCE_DECISIONS.filter((decision) => decision.obligationId === obligationId)
    .sort((a, b) => a.decidedAt.localeCompare(b.decidedAt))
    .map((decision) => decisionView(decision.id, contract));
}

export function obligationPayment(obligation: FixtureObligation) {
  const invoice = CONTRACT_INVOICES.find((candidate) => candidate.obligationId === obligation.id);
  if (invoice === undefined) {
    return obligation.isPaymentMilestone
      ? { invoiceRef: null, acceptanceStatus: 'not_accepted' as const, paymentStatus: 'not_invoiced' as const, source: null, asOf: null }
      : null;
  }
  return {
    invoiceRef: invoice.invoiceRef,
    acceptanceStatus: invoice.acceptanceStatus,
    paymentStatus: invoice.paymentStatus,
    source: invoice.source,
    asOf: invoice.asOf,
  };
}

export function obligationDetail(obligation: FixtureObligation, contract: FixtureContract, now: Date): ObligationDetail {
  const dependsOn = obligation.dependsOnId === null ? undefined : CONTRACT_OBLIGATIONS.find((candidate) => candidate.id === obligation.dependsOnId);
  return {
    ...obligationRow(obligation, contract, now),
    description: obligation.description,
    acceptanceCriteria: obligation.acceptanceCriteria,
    evidenceRequired: obligation.evidenceRequired,
    consequence: obligation.consequence,
    dependsOn: dependsOn === undefined ? null : { obligationId: dependsOn.id, title: dependsOn.title },
    escalationUser: personOrNull(obligation.escalationUserId),
    waiverApproval: approvalRef(obligation.waiverApprovalId),
    evidence: evidenceFor(obligation.id, null),
    decisions: decisionsFor(obligation.id, contract),
    payment: obligationPayment(obligation),
  };
}

// ---------------------------------------------------------------------------------------------------------
// Renewal windows (BR-37: alerts only)
// ---------------------------------------------------------------------------------------------------------

export function renewalWindow(option: FixtureRenewalOption, contract: FixtureContract, now: Date): { state: RenewalWindowState; daysUntil: number | null } {
  if (option.noticeWindowStart === null) {
    return { state: option.noticeDeadline !== null && Date.parse(option.noticeDeadline) < now.getTime() ? 'closed' : 'open', daysUntil: null };
  }
  const today = localDate(now, timeZoneOf(contract));
  const daysUntil = daysBetween(today, option.noticeWindowStart);
  if (daysUntil > 0) {
    return { state: 'not_open', daysUntil };
  }
  if (option.noticeDeadline !== null && Date.parse(option.noticeDeadline) < now.getTime()) {
    return { state: 'closed', daysUntil };
  }
  return { state: 'open', daysUntil };
}

const UNDECIDED_OPTION_STATUSES: readonly string[] = ['available', 'under_review'];

export function isOptionUndecided(option: FixtureRenewalOption): boolean {
  return UNDECIDED_OPTION_STATUSES.includes(option.status) && option.decision === null;
}

export function renewalOptionView(option: FixtureRenewalOption, contract: FixtureContract, now: Date): RenewalOptionView {
  const window = renewalWindow(option, contract, now);
  return {
    id: option.id,
    optionType: option.optionType,
    periodMonths: option.periodMonths,
    noticeWindowStart: option.noticeWindowStart,
    noticeDeadline: deadline(option.noticeDeadline, timeZoneOf(contract)),
    windowState: window.state,
    daysUntilWindowOpens: window.daysUntil,
    status: option.status,
    decision: option.decision,
    justification: option.justification,
    performanceBasis: option.performanceBasis,
    fundingConfirmed: option.fundingConfirmed,
    approval: approvalRef(option.approvalRequestId),
    supplierConsentAt: option.supplierConsentAt,
    decidedBy: personOrNull(option.decidedByUserId),
    decidedAt: option.decidedAt,
    supplierNotifiedAt: option.supplierNotifiedAt,
  };
}

/** The undecided option with the earliest notice deadline. */
function nextRenewalOption(contract: FixtureContract): FixtureRenewalOption | undefined {
  return renewalOptionsOf(contract.id)
    .filter((option) => isOptionUndecided(option) && option.noticeDeadline !== null)
    .sort((a, b) => (a.noticeDeadline ?? '').localeCompare(b.noticeDeadline ?? ''))[0];
}

export function nextRenewalDeadline(contract: FixtureContract): OfficialDeadline | null {
  return deadline(nextRenewalOption(contract)?.noticeDeadline ?? null, timeZoneOf(contract));
}

export function nextRenewalWindow(contract: FixtureContract, now: Date): ContractRow['nextRenewalWindow'] {
  const option = nextRenewalOption(contract);
  if (option === undefined) {
    return null;
  }
  const window = renewalWindow(option, contract, now);
  return { windowStart: option.noticeWindowStart, state: window.state, daysUntilOpens: window.daysUntil };
}

/**
 * True when an undecided option needs attention within `days`: its notice window opens (or is already open) within
 * the horizon, or its notice deadline falls within it; options whose deadline has passed are not counted.
 */
export function renewalDecisionDueWithin(option: FixtureRenewalOption, contract: FixtureContract, now: Date, days: number): boolean {
  if (!isOptionUndecided(option)) {
    return false;
  }
  if (option.noticeDeadline !== null && Date.parse(option.noticeDeadline) < now.getTime()) {
    return false;
  }
  const horizon = now.getTime() + days * 86_400_000;
  if (option.noticeDeadline !== null && Date.parse(option.noticeDeadline) <= horizon) {
    return true;
  }
  const window = renewalWindow(option, contract, now);
  return window.state === 'open' || (window.daysUntil !== null && window.daysUntil <= days);
}

// ---------------------------------------------------------------------------------------------------------
// Register rows and detail
// ---------------------------------------------------------------------------------------------------------

export function nextDecision(contract: FixtureContract, now: Date): ContractNextDecision | null {
  const tz = timeZoneOf(contract);
  if (contract.differsFromAward && differenceBlocks(contract) && ['under_review', 'awaiting_signature'].includes(contract.status)) {
    return { kind: 'difference_approval', dueAt: null, detail: 'The differences from the award must be approved before signature.' };
  }
  if (contract.status === 'draft' || contract.status === 'under_review') {
    return { kind: 'review_approval', dueAt: null, detail: 'The final agreement awaits approval.' };
  }
  if (contract.status === 'awaiting_signature') {
    return { kind: 'signature', dueAt: null, detail: 'Signatures are outstanding.' };
  }
  if (contract.status === 'signed_not_effective') {
    return { kind: 'commencement', dueAt: null, detail: 'The effective date and notice to proceed are not recorded.' };
  }
  if (handoverOf(contract.id)?.status === 'submitted') {
    return { kind: 'handover_acceptance', dueAt: null, detail: 'The contract manager has not accepted the handover.' };
  }
  const renewal = renewalOptionsOf(contract.id)
    .filter((option) => isOptionUndecided(option) && option.noticeDeadline !== null)
    .map((option) => ({ option, window: renewalWindow(option, contract, now) }))
    .filter(({ window }) => window.state === 'open' || (window.daysUntil !== null && window.daysUntil <= 30))
    .sort((a, b) => (a.option.noticeDeadline ?? '').localeCompare(b.option.noticeDeadline ?? ''))[0];
  if (renewal !== undefined) {
    return {
      kind: 'renewal_notice',
      dueAt: deadline(renewal.option.noticeDeadline, tz),
      detail:
        renewal.window.state === 'open'
          ? 'The renewal notice window is open and no decision is recorded.'
          : `The renewal notice window opens in ${renewal.window.daysUntil ?? 0} days; no decision is recorded.`,
    };
  }
  if (changesOf(contract.id).some((change) => change.status === 'approval_pending')) {
    return { kind: 'change_approval', dueAt: null, detail: 'A change request awaits approval.' };
  }
  const expiring = securitiesOf(contract.id).find((security) => security.status === 'expiring');
  if (expiring !== undefined) {
    return { kind: 'security_expiry', dueAt: deadline(expiring.expiresAt, tz), detail: 'A security or insurance is about to expire.' };
  }
  if ((contract.status === 'expired' || contract.status === 'terminated') && closeoutOf(contract.id)?.status !== 'closed') {
    return { kind: 'closeout', dueAt: null, detail: 'Closeout is not complete.' };
  }
  return null;
}

export function contractRow(contract: FixtureContract, now: Date): ContractRow {
  return {
    id: contract.id,
    reference: contract.reference,
    title: contract.title,
    status: contract.status,
    supplier: supplierRef(contract.supplierTenantId),
    legalEntity: legalEntityRef(contract),
    tender: contract.tender,
    owner: personOrNull(contract.ownerUserId),
    contractManager: personOrNull(contract.contractManagerUserId),
    scopeSummary: contract.scopeSummary,
    value: contract.value,
    currentValue: currentValue(contract),
    ceiling: contract.ceiling,
    remainingCeiling: remainingCeiling(contract),
    termStart: contract.termStart,
    termEnd: contract.termEnd,
    nextRenewalDeadline: nextRenewalDeadline(contract),
    nextRenewalWindow: nextRenewalWindow(contract, now),
    nextDecision: nextDecision(contract, now),
    differsFromAward: contract.differsFromAward,
    handoverStatus: handoverOf(contract.id)?.status ?? null,
    overdueObligations: obligationCounts(contract, now).overdue,
    origin: contract.origin,
  };
}

function lotOutcome(lotOutcomeId: number) {
  const outcome = CONTRACT_LOT_OUTCOMES.find((candidate) => candidate.id === lotOutcomeId);
  if (outcome === undefined) {
    throw new Error(`Unknown lot outcome ${lotOutcomeId}.`);
  }
  return outcome;
}

export function allocatedTotal(lotOutcomeId: number, currency: string, excludeContractId: number | null = null): Money {
  return moneySum(
    CONTRACT_ALLOCATIONS.filter(
      (allocation) => allocation.lotOutcomeId === lotOutcomeId && allocation.contractId !== excludeContractId,
    ).map((allocation) => allocation.allocatedValue),
    currency,
  );
}

export function allocationsOf(contract: FixtureContract): ContractLotAllocation[] {
  return CONTRACT_ALLOCATIONS.filter((allocation) => allocation.contractId === contract.id).map((allocation) => {
    const outcome = lotOutcome(allocation.lotOutcomeId);
    const currency = allocation.allocatedValue.currency;
    const awarded = outcome.awardedValue ?? zero(currency);
    const elsewhere = allocatedTotal(outcome.id, currency, contract.id);
    return {
      id: allocation.id,
      lotOutcomeId: outcome.id,
      tenderReference: outcome.tender.reference,
      lotNumber: outcome.lotNumber,
      lotTitle: outcome.lotTitle,
      awardedValue: awarded,
      allocatedValue: allocation.allocatedValue,
      allocatedElsewhere: elsewhere,
      unallocated: money(sub(sub(awarded.amount, allocation.allocatedValue.amount), elsewhere.amount), currency),
    };
  });
}

function milestones(contract: FixtureContract): ContractMilestone[] {
  const blockedBySignature = contract.signedAt === null;
  const handover = handoverOf(contract.id);
  return [
    {
      key: 'signed',
      state: contract.signedAt !== null ? 'done' : differenceBlocks(contract) ? 'blocked' : 'pending',
      at: contract.signedAt,
      date: null,
      detail: contract.signedOutsideApp ? 'Signed outside the app; recorded from external evidence.' : null,
    },
    {
      key: 'effective',
      state: contract.effectiveDate !== null ? 'done' : blockedBySignature ? 'blocked' : 'pending',
      at: null,
      date: contract.effectiveDate,
      detail: null,
    },
    {
      key: 'notice_to_proceed',
      state: contract.noticeToProceedAt !== null ? 'done' : blockedBySignature ? 'blocked' : 'pending',
      at: contract.noticeToProceedAt,
      date: null,
      detail: null,
    },
    {
      key: 'delivery_start',
      state: contract.deliveryStartAt !== null ? 'done' : blockedBySignature ? 'blocked' : 'pending',
      at: contract.deliveryStartAt,
      date: null,
      detail: null,
    },
    {
      key: 'handover_accepted',
      state: handover?.status === 'accepted' ? 'done' : handover === undefined ? 'blocked' : 'pending',
      at: handover?.acceptedAt ?? null,
      date: null,
      detail:
        handover === undefined
          ? 'No procurement handover: imported historical contract.'
          : handover.status === 'returned'
            ? `Returned with omissions: ${handover.omissions ?? ''}`
            : null,
    },
  ];
}

export function securityView(security: FixtureSecurity): ContractSecurity {
  return {
    id: security.id,
    securityType: security.securityType,
    issuer: security.issuer,
    amount: security.amount,
    expiresAt: security.expiresAt,
    status: security.status,
    releasedAt: security.releasedAt,
    releaseApproval: approvalRef(security.releaseApprovalId),
    evidence: security.evidence,
  };
}

export function contractDetail(contract: FixtureContract, now: Date): ContractDetail {
  return {
    ...contractRow(contract, now),
    timeZone: timeZoneOf(contract),
    recommendationId: contract.recommendationId,
    scope: contract.scope,
    optionsSummary: contract.optionsSummary,
    serviceLocations: contract.serviceLocations,
    paymentTerms: contract.paymentTerms,
    securitiesSummary: contract.securitiesSummary,
    signedAt: contract.signedAt,
    effectiveDate: contract.effectiveDate,
    noticeToProceedAt: contract.noticeToProceedAt,
    deliveryStartAt: contract.deliveryStartAt,
    signedOutsideApp: contract.signedOutsideApp,
    externalSignatureEvidence: contract.externalSignatureEvidence,
    signedDocument: contract.signedDocument,
    differenceExplanation: contract.differenceExplanation,
    differenceApproval: approvalRef(contract.differenceApprovalId),
    allocations: allocationsOf(contract),
    milestones: milestones(contract),
    contacts: [...contract.contacts],
    securities: securitiesOf(contract.id).map(securityView),
    holds: holdsOf(contract.id).map((hold) => ({
      holdId: hold.id,
      holdType: hold.holdType,
      reason: hold.reason,
      blockedActions: [...hold.blockedActions],
      startedAt: hold.startedAt,
      reviewDate: hold.reviewDate,
      owner: personOrNull(hold.ownerUserId),
    })),
    obligationCounts: obligationCounts(contract, now),
    originalBusinessDate: contract.originalBusinessDate,
    createdAt: contract.createdAt,
    customFields: customFieldValuesOf(contract.tenantId, 'contract', contract.id),
  };
}

/** The core values the contract form's conditional custom fields read (the tender category and the value band). */
export function contractCustomContext(tenantId: number, tenderId: number | null, amount: string): CustomFieldContext {
  const categoryId = TENDER_REGISTER.find((tender) => tender.id === tenderId && tender.tenantId === tenantId)?.categoryId ?? null;
  return {
    category_code: TENDER_CATEGORIES.find((category) => category.id === categoryId)?.code ?? null,
    value_band: valueBandOf(amount),
  };
}

// ---------------------------------------------------------------------------------------------------------
// CON-02 preparation, award sources
// ---------------------------------------------------------------------------------------------------------

export function awardSource(outcomeId: number): AwardSource {
  const outcome = lotOutcome(outcomeId);
  const currency = outcome.awardedValue?.currency ?? 'BWP';
  const allocations = CONTRACT_ALLOCATIONS.filter((allocation) => allocation.lotOutcomeId === outcome.id);
  const allocated = allocatedTotal(outcome.id, currency);
  const remaining = outcome.awardedValue === null ? null : money(sub(outcome.awardedValue.amount, allocated.amount), currency);
  const finalAward = outcome.status === 'final_awarded' && outcome.supplierTenantId !== null;
  const hasRemaining = remaining !== null && gt(remaining.amount, '0');
  let unavailableReason: string | null = null;
  if (!finalAward) {
    unavailableReason = outcome.reason ?? 'The lot outcome is not final-awarded.';
  } else if (!hasRemaining) {
    unavailableReason = 'The awarded value is fully allocated to contracts.';
  }
  return {
    lotOutcomeId: outcome.id,
    tender: outcome.tender,
    lotNumber: outcome.lotNumber,
    lotTitle: outcome.lotTitle,
    supplier: outcome.supplierTenantId === null ? null : supplierRef(outcome.supplierTenantId),
    outcome: outcome.outcome,
    status: outcome.status,
    awardedValue: outcome.awardedValue,
    allocatedValue: allocated,
    remainingValue: remaining,
    contracts: allocations.map((allocation) => {
      const contract = CONTRACTS.find((candidate) => candidate.id === allocation.contractId);
      return { contractId: allocation.contractId, reference: contract?.reference ?? `C-${allocation.contractId}`, allocatedValue: allocation.allocatedValue };
    }),
    finalAwardedAt: outcome.finalAwardedAt,
    conditions: outcome.conditions,
    availableForContract: finalAward && hasRemaining,
    unavailableReason,
  };
}

export function preparationChecks(contract: FixtureContract): ContractCheck[] {
  const entity = legalEntityOf(contract);
  const allocations = allocationsOf(contract);
  const overAllocated = allocations.some((allocation) => lt(allocation.unallocated.amount, '0'));
  const checks: ContractCheck[] = [
    {
      id: 'legal_entity',
      label: 'Contracting legal entity and supplier legal party identified (BR-04)',
      detail: `${entity.name} and ${tenantName(contract.supplierTenantId)}.`,
      state: entity.active ? 'passed' : 'blocking',
    },
    {
      id: 'allocations',
      label: 'Allocations reconcile to the awarded values (BR-33)',
      detail:
        allocations.length === 0
          ? 'Imported historical contract without allocations.'
          : overAllocated
            ? 'The allocations exceed an awarded value.'
            : 'No lot outcome is allocated above its awarded value.',
      state: allocations.length === 0 ? 'warning' : overAllocated ? 'blocking' : 'passed',
    },
  ];
  if (contract.differsFromAward) {
    const approval = approvalById(contract.differenceApprovalId);
    checks.push({
      id: 'difference_approval',
      label: 'Differences from the award explained and approved (AC-28)',
      detail:
        approval === undefined
          ? 'No difference approval has been requested.'
          : `Difference approval ${approval.status}${approval.currentApproverUserId === null ? '' : `, with ${personRef(approval.currentApproverUserId).fullName}`}.`,
      state: differenceBlocks(contract) ? 'blocking' : 'passed',
    });
  } else {
    checks.push({ id: 'difference_approval', label: 'Contract matches the approved award', detail: null, state: 'passed' });
  }
  const holds = holdsOf(contract.id).filter((hold) => hold.blockedActions.includes('contract_sign'));
  checks.push({
    id: 'holds',
    label: 'No hold blocks signature',
    detail: holds.length === 0 ? null : holds.map((hold) => hold.reason).join(' '),
    state: holds.length === 0 ? 'passed' : 'blocking',
  });
  return checks;
}

export function contractPreparation(contract: FixtureContract): ContractPreparation {
  const history = [...contract.contractApprovalIds, ...(contract.differenceApprovalId === null ? [] : [contract.differenceApprovalId])]
    .map((approvalId) => approvalRef(approvalId))
    .filter((approval): approval is ContractApprovalRef => approval !== null)
    .sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
  return {
    contractId: contract.id,
    reference: contract.reference,
    status: contract.status,
    version: contract.version,
    awardedScope: allocationsOf(contract),
    agreedDocuments: [...contract.agreedDocuments],
    exceptions: [...contract.exceptions],
    differences: [...contract.differences],
    differsFromAward: contract.differsFromAward,
    differenceExplanation: contract.differenceExplanation,
    differenceApproval: approvalRef(contract.differenceApprovalId),
    approvalHistory: history,
    checks: preparationChecks(contract),
  };
}

// ---------------------------------------------------------------------------------------------------------
// CON-03 signature
// ---------------------------------------------------------------------------------------------------------

export function signatoryView(signatory: FixtureSignatory, contract: FixtureContract): ContractSignatory {
  const organizationName = signatory.party === 'buyer' ? tenantName(contract.tenantId) : tenantName(contract.supplierTenantId);
  return {
    id: signatory.id,
    party: signatory.party,
    user: personOrNull(signatory.userId),
    name: signatory.name,
    organizationName,
    authorityNote: signatory.authorityNote,
    authorityLimit: signatory.authorityLimit,
    authoritySufficient:
      signatory.party === 'supplier' || signatory.authorityLimit === null
        ? null
        : !gt(currentValue(contract).amount, signatory.authorityLimit.amount),
    status: signatory.status,
    method: signatory.method,
    signedAt: signatory.signedAt,
    verificationNote: signatory.verificationNote,
    refusalReason: signatory.refusalReason,
  };
}

export function allSignedExcept(contract: FixtureContract, signatoryId: number): boolean {
  return signatoriesOf(contract.id)
    .filter((signatory) => signatory.id !== signatoryId)
    .every((signatory) => signatory.status === 'signed' || signatory.status === 'recorded_external');
}

export function contractSignature(contract: FixtureContract): ContractSignature {
  const signatories = signatoriesOf(contract.id);
  const blocking = holdsOf(contract.id).filter((hold) => hold.blockedActions.includes('contract_sign'));
  const insufficient = signatories
    .map((signatory) => signatoryView(signatory, contract))
    .filter((signatory) => signatory.authoritySufficient === false);
  const signatureChecks: ContractCheck[] = [
    ...preparationChecks(contract).filter((check) => check.id !== 'holds' && check.id !== 'allocations'),
    {
      id: 'signatories',
      label: 'Buyer and supplier signatories named',
      detail: `${signatories.length} signatories.`,
      state:
        signatories.some((signatory) => signatory.party === 'buyer') && signatories.some((signatory) => signatory.party === 'supplier')
          ? 'passed'
          : contract.signedOutsideApp
            ? 'warning'
            : 'blocking',
    },
    {
      id: 'authority',
      label: 'Buyer signatories hold contract_signature authority for the value',
      detail: insufficient.length === 0 ? null : insufficient.map((signatory) => signatory.name).join(', '),
      state: insufficient.length === 0 ? 'passed' : 'blocking',
    },
    {
      id: 'holds',
      label: 'No hold blocks signature',
      detail: blocking.length === 0 ? null : blocking.map((hold) => hold.reason).join(' '),
      state: blocking.length === 0 ? 'passed' : 'blocking',
    },
  ];
  const bond = obligationsOf(contract.id).find((obligation) => obligation.title.toLowerCase().includes('performance bond'));
  const signed = contract.signedAt !== null;
  const commencementChecks: ContractCheck[] = [
    {
      id: 'signed',
      label: 'All signatures complete',
      detail: signed ? null : 'Commencement cannot be authorized before signature (BR-35).',
      state: signed ? 'passed' : 'blocking',
    },
    {
      id: 'performance_bond',
      label: 'Performance bond received',
      detail:
        bond === undefined
          ? securitiesOf(contract.id).some((security) => security.securityType === 'performance_bond')
            ? null
            : 'No performance bond is required.'
          : `Obligation "${bond.title}" is ${bond.status}.`,
      state: bond === undefined || bond.status === 'accepted' ? 'passed' : 'blocking',
    },
    {
      id: 'insurance',
      label: 'Insurance valid',
      detail: securitiesOf(contract.id).some((security) => security.securityType === 'insurance' && security.status === 'expiring')
        ? 'Insurance expires soon; renewal evidence is due.'
        : null,
      state: securitiesOf(contract.id).some((security) => security.securityType === 'insurance' && security.status === 'expired')
        ? 'blocking'
        : securitiesOf(contract.id).some((security) => security.securityType === 'insurance' && security.status === 'expiring')
          ? 'warning'
          : 'passed',
    },
  ];
  return {
    contractId: contract.id,
    reference: contract.reference,
    status: contract.status,
    timeZone: timeZoneOf(contract),
    contractValue: currentValue(contract),
    issuedVersion: contract.issuedVersion,
    issuedAt: contract.issuedAt,
    signedOutsideApp: contract.signedOutsideApp,
    externalSignatureEvidence: contract.externalSignatureEvidence,
    signatories: signatories.map((signatory) => signatoryView(signatory, contract)),
    signedAt: contract.signedAt,
    effectiveDate: contract.effectiveDate,
    noticeToProceedAt: contract.noticeToProceedAt,
    deliveryStartAt: contract.deliveryStartAt,
    differsFromAward: contract.differsFromAward,
    differenceApproval: approvalRef(contract.differenceApprovalId),
    signatureChecks,
    commencementChecks,
    milestones: milestones(contract),
  };
}

// ---------------------------------------------------------------------------------------------------------
// CON-04 handover
// ---------------------------------------------------------------------------------------------------------

export function contractHandover(contract: FixtureContract, handover: NonNullable<ReturnType<typeof handoverOf>>): ContractHandover {
  const obligations = obligationsOf(contract.id);
  const tz = timeZoneOf(contract);
  const required: { id: string; label: string; value: string | null }[] = [
    { id: 'final_scope', label: 'Final scope', value: handover.finalScope },
    { id: 'winning_commitments', label: 'Winning commitments', value: handover.winningCommitments },
    { id: 'performance_measures', label: 'Performance measures', value: handover.performanceMeasuresSummary },
    { id: 'risks', label: 'Risks', value: handover.risks },
    { id: 'outstanding_conditions', label: 'Outstanding conditions', value: handover.outstandingConditions },
  ];
  const checks: ContractCheck[] = required.map((item) => ({
    id: item.id,
    label: item.label,
    detail: item.value === null ? 'Missing from the handover package.' : null,
    state: item.value === null ? 'blocking' : 'passed',
  }));
  checks.push({
    id: 'contract_manager',
    label: 'Named contract manager',
    detail: handover.contractManagerUserId === null ? 'Name the contract manager who accepts the handover.' : personRef(handover.contractManagerUserId).fullName,
    state: handover.contractManagerUserId === null ? 'blocking' : 'passed',
  });
  const blocks = handover.status !== 'accepted';
  return {
    contractId: contract.id,
    reference: contract.reference,
    handoverId: handover.id,
    status: handover.status,
    tender: contract.tender,
    supplier: supplierRef(contract.supplierTenantId),
    finalScope: handover.finalScope,
    winningCommitments: handover.winningCommitments,
    negotiatedExceptions: handover.negotiatedExceptions,
    performanceMeasuresSummary: handover.performanceMeasuresSummary,
    risks: handover.risks,
    outstandingConditions: handover.outstandingConditions,
    renewalDatesSummary: handover.renewalDatesSummary,
    securityExpirySummary: handover.securityExpirySummary,
    keyContacts: [...contract.contacts],
    pricing: handover.pricing.map((line) => ({ ...line })),
    milestones: obligations
      .filter((obligation) => obligation.kind === 'milestone')
      .map((obligation) => ({ obligationId: obligation.id, title: obligation.title, dueAt: deadline(obligation.dueAt, tz), amount: obligation.amount })),
    obligationsCount: obligations.length,
    awardEvidence: [...handover.awardEvidence],
    contractManager: personOrNull(handover.contractManagerUserId),
    submittedBy: personOrNull(handover.submittedByUserId),
    submittedAt: handover.submittedAt,
    acceptedAt: handover.acceptedAt,
    returnedAt: handover.returnedAt,
    omissions: handover.omissions,
    closeoutGate: {
      tenderReference: contract.tender?.reference ?? null,
      blocksEventCloseout: blocks,
      detail: blocks
        ? `Event closeout of ${contract.tender?.reference ?? 'the tender'} stays blocked until the handover is accepted (AC-29).`
        : 'Handover accepted; the event closeout gate for this contract is satisfied.',
    },
    excludesLosingBids: true,
    checks,
  };
}

// ---------------------------------------------------------------------------------------------------------
// CON-07 performance
// ---------------------------------------------------------------------------------------------------------

export function reviewRow(review: FixtureReview): PerformanceReviewRow {
  return {
    id: review.id,
    contractId: review.contractId,
    periodStart: review.periodStart,
    periodEnd: review.periodEnd,
    status: review.status,
    overallRating: review.overallRating,
    summary: review.summary,
    supplierResponse: review.supplierResponse,
    supplierDisputes: review.supplierDisputes,
    sharedAt: review.sharedAt,
    respondedAt: review.respondedAt,
    finalizedBy: personOrNull(review.finalizedByUserId),
    finalizedAt: review.finalizedAt,
  };
}

export function measureResults(reviewId: number): MeasureResultView[] {
  return CONTRACT_MEASURE_RESULTS.filter((result) => result.reviewId === reviewId).map((result) => {
    const measure = CONTRACT_MEASURES.find((candidate) => candidate.id === result.measureId);
    if (measure === undefined) {
      throw new Error(`Unknown measure ${result.measureId}.`);
    }
    return {
      id: result.id,
      measureId: measure.id,
      measureName: measure.name,
      target: measure.target,
      unit: measure.unit,
      actual: result.actual,
      rating: result.rating,
      note: result.note,
    };
  });
}

export function incidentView(incidentId: number): ContractIncidentView {
  const incident = CONTRACT_INCIDENTS.find((candidate) => candidate.id === incidentId);
  if (incident === undefined) {
    throw new Error(`Unknown incident ${incidentId}.`);
  }
  return {
    id: incident.id,
    incidentType: incident.incidentType,
    severity: incident.severity,
    description: incident.description,
    occurredAt: incident.occurredAt,
    status: incident.status,
    correctiveAction: incident.correctiveAction,
    owner: personOrNull(incident.ownerUserId),
  };
}

export function improvementActions(contract: FixtureContract, reviewId: number | null = null): ImprovementActionView[] {
  const tz = timeZoneOf(contract);
  return CONTRACT_IMPROVEMENT_ACTIONS.filter(
    (action) => action.contractId === contract.id && (reviewId === null || action.reviewId === reviewId),
  ).map((action) => ({
    id: action.id,
    reviewId: action.reviewId,
    action: action.action,
    owner: action.owner,
    dueAt: deadline(action.dueAt, tz),
    status: action.status,
  }));
}

export function contractPerformance(contract: FixtureContract): ContractPerformance {
  const reviews = reviewsOf(contract.id).sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));
  const incidents = CONTRACT_INCIDENTS.filter((incident) => incident.contractId === contract.id);
  const actions = improvementActions(contract);
  const finalized = reviews.filter((review) => review.status === 'finalized' && review.overallRating !== null);
  const latestFinal = finalized[0];
  const proposed = reviews.find(
    (review) =>
      review.status !== 'finalized' &&
      review.status !== 'draft' &&
      review.overallRating !== null &&
      (latestFinal === undefined || review.periodEnd > latestFinal.periodEnd),
  );
  return {
    contractId: contract.id,
    reference: contract.reference,
    status: contract.status,
    measures: CONTRACT_MEASURES.filter((measure) => measure.contractId === contract.id).map((measure) => {
      const latest = CONTRACT_MEASURE_RESULTS.filter((result) => result.measureId === measure.id).sort((a, b) => b.reviewId - a.reviewId)[0];
      return {
        id: measure.id,
        name: measure.name,
        target: measure.target,
        unit: measure.unit,
        frequency: measure.frequency,
        active: measure.active,
        latestActual: latest?.actual ?? null,
        latestRating: latest?.rating ?? null,
      };
    }),
    reviews: reviews.map(reviewRow),
    incidents: incidents.map((incident) => incidentView(incident.id)),
    improvementActions: actions,
    scorecard: {
      reviewsFinalized: reviews.filter((review) => review.status === 'finalized').length,
      reviewsDisputed: reviews.filter((review) => review.supplierDisputes).length,
      latestRating: latestFinal?.overallRating ?? null,
      latestProposedRating:
        proposed === undefined || proposed.overallRating === null
          ? null
          : { reviewId: proposed.id, rating: proposed.overallRating, reviewStatus: proposed.status, supplierDisputes: proposed.supplierDisputes },
      openIncidents: incidents.filter((incident) => incident.status === 'open' || incident.status === 'corrective_action').length,
      openActions: actions.filter((action) => action.status === 'open' || action.status === 'overdue').length,
    },
  };
}

export function reviewDetail(review: FixtureReview, contract: FixtureContract): PerformanceReviewDetail {
  return { ...reviewRow(review), results: measureResults(review.id), improvementActions: improvementActions(contract, review.id) };
}

// ---------------------------------------------------------------------------------------------------------
// CON-08 financials
// ---------------------------------------------------------------------------------------------------------

export function invoiceView(invoice: FixtureInvoice): ContractInvoiceView {
  const obligation = invoice.obligationId === null ? undefined : CONTRACT_OBLIGATIONS.find((candidate) => candidate.id === invoice.obligationId);
  return {
    id: invoice.id,
    invoiceRef: invoice.invoiceRef,
    obligation: obligation === undefined ? null : { obligationId: obligation.id, title: obligation.title, status: obligation.status },
    amount: invoice.amount,
    invoiceDate: invoice.invoiceDate,
    acceptanceStatus: invoice.acceptanceStatus,
    paymentStatus: invoice.paymentStatus,
    source: invoice.source,
    asOf: invoice.asOf,
    disputeReason: invoice.disputeReason,
  };
}

function latestAsOf(invoices: readonly FixtureInvoice[]): string | null {
  return invoices.map((invoice) => invoice.asOf).sort().at(-1) ?? null;
}

function invoiceSourceSystem(invoices: readonly FixtureInvoice[]) {
  if (invoices.length === 0) {
    return null;
  }
  return invoices.every((invoice) => invoice.source === 'finance_system') ? ('finance_system' as const) : ('local_entry' as const);
}

export function contractFinancials(contract: FixtureContract, now: Date): ContractFinancials {
  const currency = contract.value.currency;
  const invoices = invoicesOf(contract.id);
  const allocations = allocationsOf(contract);
  const accepted = obligationsOf(contract.id).filter((obligation) => obligation.isPaymentMilestone && obligation.status === 'accepted');
  const acceptedTotal = moneySum(accepted.map((obligation) => obligation.amount), currency);
  const by = (predicate: (invoice: FixtureInvoice) => boolean) => invoices.filter(predicate);
  const figure = (amount: Money, source: string, rows: readonly FixtureInvoice[] | null, asOf: string | null, isEstimate = false) => ({
    amount,
    source,
    sourceSystem: rows === null ? null : invoiceSourceSystem(rows),
    asOf: rows === null ? asOf : latestAsOf(rows),
    isEstimate,
  });
  const invoiced = by((invoice) => invoice.paymentStatus !== 'not_invoiced');
  const approved = by((invoice) => invoice.paymentStatus === 'approved');
  const paid = by((invoice) => invoice.paymentStatus === 'paid');
  const disputed = by((invoice) => invoice.paymentStatus === 'disputed' || invoice.acceptanceStatus === 'disputed');
  const invoicedTotal = moneySum(invoiced.map((invoice) => invoice.amount), currency);
  const acceptedInvoiced = moneySum(
    invoices
      .filter((invoice) => invoice.obligationId !== null && accepted.some((obligation) => obligation.id === invoice.obligationId))
      .map((invoice) => invoice.amount),
    currency,
  );
  const invoicedNotAccepted = moneySum(
    invoices.filter((invoice) => invoice.acceptanceStatus === 'not_accepted').map((invoice) => invoice.amount),
    currency,
  );
  const pending = pendingChangesTotal(contract);
  const notes: string[] = [
    'Paid figures come only from invoices marked paid; estimates, pending changes and disputed amounts are never counted as spend.',
  ];
  if (gt(pending.amount, '0')) {
    notes.push(`Pending changes of ${formatMoney(pending.amount, currency)} are exposure, not approved value or spend.`);
  }
  if (gt(invoicedNotAccepted.amount, '0')) {
    notes.push(`Invoices of ${formatMoney(invoicedNotAccepted.amount, currency)} are not accepted; they are not ready for payment.`);
  }
  if (invoices.some((invoice) => invoice.source === 'local_entry')) {
    notes.push('Some invoice figures are entered locally and are not yet confirmed by the finance system.');
  }
  const ceiling = contract.ceiling;
  const remaining = remainingCeiling(contract);
  const contractAsOf = contract.createdAt;
  const awardTotal = allocations.length === 0 ? null : moneySum(allocations.map((allocation) => allocation.allocatedValue), currency);
  const changesAsOf = changesOf(contract.id).map((change) => change.supplierAgreedAt ?? change.createdAt).sort().at(-1) ?? null;
  return {
    contractId: contract.id,
    reference: contract.reference,
    currency,
    awardValue: awardTotal === null ? null : figure(awardTotal, 'Award record (allocated lot outcomes)', null, allocations.length === 0 ? null : lotOutcome(allocations[0]?.lotOutcomeId ?? 0).finalAwardedAt),
    originalValue: figure(contract.value, 'Contract record', null, contractAsOf),
    approvedChanges: figure(approvedChangesTotal(contract), 'Change register (agreed and incorporated)', null, changesAsOf),
    pendingChanges: figure(pending, 'Change register (not yet approved)', null, changesAsOf, true),
    currentValue: figure(currentValue(contract), 'Contract record plus approved changes', null, changesAsOf ?? contractAsOf),
    ceiling: ceiling === null ? null : figure(ceiling, 'Contract record', null, contractAsOf),
    remainingCeiling: remaining === null ? null : figure(remaining, 'Ceiling less current value', null, isoInstant(now)),
    acceptedMilestones: figure(acceptedTotal, 'Accepted payment milestones', null, isoInstant(now)),
    invoiced: figure(invoicedTotal, 'Invoices', invoiced, null),
    approvedForPayment: figure(moneySum(approved.map((invoice) => invoice.amount), currency), 'Invoices approved for payment', approved, null),
    paid: figure(moneySum(paid.map((invoice) => invoice.amount), currency), 'Invoices marked paid', paid, null),
    disputed: figure(moneySum(disputed.map((invoice) => invoice.amount), currency), 'Disputed invoices', disputed, null),
    invoices: invoices.sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate)).map(invoiceView),
    reconciliation: {
      acceptedNotInvoiced: money(sub(acceptedTotal.amount, acceptedInvoiced.amount), currency),
      invoicedNotAccepted,
      disputedInvoices: disputed.length,
    },
    notes,
  };
}

// ---------------------------------------------------------------------------------------------------------
// CON-09 changes and disputes; cumulative authority (AC-31)
// ---------------------------------------------------------------------------------------------------------

export interface ChangeApprover {
  readonly userId: number;
  readonly fullName: string;
  readonly limit: Money | null;
}

/** Members of the tenant who may approve contract changes, lowest authority first (unlimited last). */
export function changeApprovers(tenantId: number): ChangeApprover[] {
  const approvers: ChangeApprover[] = [];
  for (const persona of PERSONAS) {
    if (persona.status !== 'active') {
      continue;
    }
    const membership = persona.memberships.find((candidate) => candidate.tenantId === tenantId && candidate.status === 'active');
    if (membership === undefined) {
      continue;
    }
    const permissions = membershipPermissions(membership);
    if (permissions.includes('contract.change.approve') && permissions.includes('approval.decide')) {
      approvers.push({ userId: persona.userId, fullName: persona.fullName, limit: membership.authorityLimit });
    }
  }
  return approvers.sort((a, b) => {
    if (a.limit === null) {
      return 1;
    }
    if (b.limit === null) {
      return -1;
    }
    return lt(a.limit.amount, b.limit.amount) ? -1 : 1;
  });
}

function authorityOf(approver: ChangeApprover | undefined, amount: string): boolean {
  if (approver === undefined) {
    return false;
  }
  return approver.limit === null || !gt(amount, approver.limit.amount);
}

export function changeAuthority(change: FixtureChange, contract: FixtureContract, checkedUserId: number | null): ChangeAuthorityCheck | null {
  if (change.costImpact === null || change.cumulativeValueAfter === null) {
    return null;
  }
  const currency = contract.value.currency;
  const approvers = changeApprovers(contract.tenantId);
  const checked = checkedUserId === null ? approvers[0] : approvers.find((approver) => approver.userId === checkedUserId);
  const amount = change.cumulativeValueAfter.amount;
  const sufficient = authorityOf(checked, amount);
  const required = approvers.find((approver) => authorityOf(approver, amount));
  const cumulativeChanges = money(sub(amount, contract.value.amount), currency);
  const percent = round(mul(div(cumulativeChanges.amount, contract.value.amount, 6), '100'), 2);
  const checkedName = checked?.fullName ?? 'The approver';
  const limitText = checked?.limit === null || checked === undefined ? 'unlimited authority' : formatMoney(checked.limit.amount, checked.limit.currency);
  return {
    decisionType: 'change_approval',
    basis: 'cumulative_value',
    originalValue: contract.value,
    singleChangeAmount: change.costImpact,
    cumulativeChanges,
    cumulativeChangePercent: percent,
    checkedAmount: money(amount, currency),
    checkedApprover: checked === undefined ? null : { userId: checked.userId, fullName: checked.fullName },
    checkedLimit: checked?.limit ?? null,
    sufficient,
    requiredApprover: required === undefined ? null : { userId: required.userId, fullName: required.fullName },
    explanation: sufficient
      ? `${checkedName} holds ${limitText}, which covers the cumulative contract value of ${formatMoney(amount, currency)}.`
      : `This change is ${formatMoney(change.costImpact.amount, currency)}, but the cumulative contract value after it is ${formatMoney(amount, currency)} (${percent}% above the original). ${checkedName}'s authority of ${limitText} is not enough; ${required === undefined ? 'no member holds sufficient authority' : `${required.fullName} must approve`}.`,
  };
}

export function changeRow(change: FixtureChange): ChangeRequestRow {
  return {
    id: change.id,
    contractId: change.contractId,
    number: change.number,
    displayNumber: changeRequestLabel(change.number),
    title: change.title,
    raisedByParty: change.raisedByParty,
    raisedBy: personOrNull(change.raisedByUserId),
    status: change.status,
    costImpact: change.costImpact,
    scheduleImpactDays: change.scheduleImpactDays,
    cumulativeValueAfter: change.cumulativeValueAfter,
    affectsProcurementBasis: change.affectsProcurementBasis,
    supplierAgreedAt: change.supplierAgreedAt,
    approval: approvalRef(change.approvalRequestId),
    createdAt: change.createdAt,
  };
}

export function changeDetail(change: FixtureChange, contract: FixtureContract, checkedUserId: number | null): ChangeRequestDetail {
  return {
    ...changeRow(change),
    reason: change.reason,
    scopeChange: change.scopeChange,
    fundingNote: change.fundingNote,
    impactAssessment: change.impactAssessment,
    authority: changeAuthority(change, contract, checkedUserId),
  };
}

export function disputeView(dispute: FixtureDispute): ContractDisputeView {
  return {
    id: dispute.id,
    contractId: dispute.contractId,
    disputeType: dispute.disputeType,
    amount: dispute.amount,
    description: dispute.description,
    contractBasis: dispute.contractBasis,
    status: dispute.status,
    raisedBy:
      dispute.raisedByUserId === null
        ? null
        : { ...personRef(dispute.raisedByUserId), capacity: capacityOf(dispute.raisedByUserId, dispute.raisedByTenantId) },
    raisedByOrganization: tenantName(dispute.raisedByTenantId),
    raisedAt: dispute.raisedAt,
    authorizedDecision: approvalRef(dispute.authorizedDecisionId),
    resolutionNote: dispute.resolutionNote,
  };
}

// ---------------------------------------------------------------------------------------------------------
// CON-10 renewals and CON-11 closeout
// ---------------------------------------------------------------------------------------------------------

export function contractRenewals(contract: FixtureContract, now: Date): ContractRenewals {
  const performance = contractPerformance(contract);
  const alertRecipients = [contract.ownerUserId, contract.contractManagerUserId]
    .filter((userId, index, all): userId is number => userId !== null && all.indexOf(userId) === index)
    .map((userId) => personRef(userId));
  return {
    contractId: contract.id,
    reference: contract.reference,
    status: contract.status,
    termEnd: contract.termEnd,
    currentValue: currentValue(contract),
    remainingCeiling: remainingCeiling(contract),
    performance: {
      latestRating: performance.scorecard.latestRating,
      latestProposedRating: performance.scorecard.latestProposedRating,
      reviewsDisputed: performance.scorecard.reviewsDisputed,
      openIncidents: performance.scorecard.openIncidents,
      rejectedMilestones: obligationsOf(contract.id).filter((obligation) => obligation.status === 'rejected').length,
    },
    fundingNote: contract.fundingNote,
    transitionNeeds: contract.transitionNeeds,
    alertRecipients,
    options: renewalOptionsOf(contract.id).map((option) => renewalOptionView(option, contract, now)),
    noAutomaticRenewal: true,
  };
}

export const CLOSABLE_STATUSES: readonly string[] = ['expired', 'terminated'];

export function closeoutChecks(contract: FixtureContract): ContractCheck[] {
  const closeout = closeoutOf(contract.id);
  const openNonSurviving = obligationsOf(contract.id).filter((obligation) => isObligationOpen(obligation) && !obligation.survivesCloseout);
  const openDisputes = disputesOf(contract.id).filter((dispute) => dispute.status === 'open' || dispute.status === 'negotiating');
  const unreleased = securitiesOf(contract.id).filter((security) => security.status === 'active' || security.status === 'expiring');
  const unpaid = invoicesOf(contract.id).filter((invoice) => invoice.paymentStatus !== 'paid');
  const checks: ContractCheck[] = [
    {
      id: 'contract_ended',
      label: 'Contract expired or terminated',
      detail: CLOSABLE_STATUSES.includes(contract.status) || contract.status === 'closed' ? null : `The contract is ${contract.status}.`,
      state: CLOSABLE_STATUSES.includes(contract.status) || contract.status === 'closed' ? 'passed' : 'blocking',
    },
    {
      id: 'final_acceptance',
      label: 'Final acceptance recorded',
      detail: closeout?.finalAcceptanceAt ?? null,
      state: closeout?.finalAcceptanceAt ? 'passed' : 'blocking',
    },
    {
      id: 'obligations',
      label: 'Open obligations resolved (surviving obligations stay tracked)',
      detail: openNonSurviving.length === 0 ? null : openNonSurviving.map((obligation) => obligation.title).join('; '),
      state: openNonSurviving.length === 0 ? 'passed' : 'blocking',
    },
    {
      id: 'reconciliation',
      label: 'Final financial reconciliation',
      detail: unpaid.length === 0 ? closeout?.reconciliationNote ?? null : `${countLabel(unpaid.length, 'invoice', 'invoices')} not yet paid.`,
      state: unpaid.length === 0 && closeout?.reconciliationNote ? 'passed' : 'blocking',
    },
    {
      id: 'claims',
      label: 'Claims and disputes resolved',
      detail: openDisputes.length === 0 ? closeout?.outstandingClaims ?? null : openDisputes.map((dispute) => dispute.description).join('; '),
      state: openDisputes.length === 0 ? 'passed' : 'blocking',
    },
    {
      id: 'securities',
      label: 'Securities released or tracked with their warranty',
      detail:
        unreleased.length === 0
          ? null
          : `${countLabel(unreleased.length, 'security', 'securities')} held; release needs an approved decision, never a date alone (BR-37).`,
      state: unreleased.length === 0 ? 'passed' : 'warning',
    },
    {
      id: 'surviving',
      label: 'Surviving obligations stay tracked after closure',
      detail: `${countLabel(obligationsOf(contract.id).filter((obligation) => obligation.survivesCloseout).length, 'surviving obligation', 'surviving obligations')}.`,
      state: 'passed',
    },
    {
      id: 'lessons',
      label: 'Lessons learned recorded',
      detail: closeout?.lessonsLearned ?? null,
      state: closeout?.lessonsLearned ? 'passed' : 'warning',
    },
  ];
  return checks;
}

export function contractCloseout(contract: FixtureContract, now: Date): ContractCloseout {
  const closeout = closeoutOf(contract.id);
  const currency = contract.value.currency;
  const invoices = invoicesOf(contract.id);
  const invoiced = moneySum(invoices.map((invoice) => invoice.amount), currency);
  const paid = moneySum(invoices.filter((invoice) => invoice.paymentStatus === 'paid').map((invoice) => invoice.amount), currency);
  const disputed = moneySum(invoices.filter((invoice) => invoice.paymentStatus === 'disputed').map((invoice) => invoice.amount), currency);
  const final = currentValue(contract);
  const checks = closeoutChecks(contract);
  return {
    contractId: contract.id,
    reference: contract.reference,
    contractStatus: contract.status,
    closeoutId: closeout?.id ?? null,
    status: closeout?.status ?? null,
    finalAcceptanceAt: closeout?.finalAcceptanceAt ?? null,
    reconciliationNote: closeout?.reconciliationNote ?? null,
    outstandingClaims: closeout?.outstandingClaims ?? null,
    securitiesReleased: closeout?.securitiesReleased ?? null,
    warrantyUntil: closeout?.warrantyUntil ?? null,
    lessonsLearned: closeout?.lessonsLearned ?? null,
    retentionStart: closeout?.retentionStart ?? null,
    closedBy: personOrNull(closeout?.closedByUserId ?? null),
    closedAt: closeout?.closedAt ?? null,
    reconciliation: {
      finalValue: final,
      invoiced,
      paid,
      invoicedUnpaid: money(sub(sub(invoiced.amount, paid.amount), disputed.amount), currency),
      disputed,
      notYetInvoiced: money(sub(final.amount, invoiced.amount), currency),
    },
    survivingObligations: obligationsOf(contract.id)
      .filter((obligation) => obligation.survivesCloseout)
      .map((obligation) => obligationRow(obligation, contract, now)),
    securities: securitiesOf(contract.id).map(securityView),
    openDisputes: disputesOf(contract.id)
      .filter((dispute) => dispute.status === 'open' || dispute.status === 'negotiating')
      .map(disputeView),
    checks,
    canClose: closeout?.status !== 'closed' && checks.every((check) => check.state !== 'blocking'),
  };
}

// ---------------------------------------------------------------------------------------------------------
// SUP-23 supplier projections
// ---------------------------------------------------------------------------------------------------------

export function supplierObligationRow(obligation: FixtureObligation, contract: FixtureContract, now: Date): SupplierObligationRow {
  return {
    id: obligation.id,
    kind: obligation.kind,
    party: obligation.party,
    title: obligation.title,
    dueAt: deadline(obligation.dueAt, timeZoneOf(contract)),
    status: obligation.status,
    isPaymentMilestone: obligation.isPaymentMilestone,
    amount: obligation.amount,
    survivesCloseout: obligation.survivesCloseout,
    isOverdue: isObligationOverdue(obligation, now),
    latestDecision: latestDecision(obligation.id),
  };
}

export function supplierObligationDetail(obligation: FixtureObligation, contract: FixtureContract, now: Date): SupplierObligationDetail {
  return {
    ...supplierObligationRow(obligation, contract, now),
    description: obligation.description,
    acceptanceCriteria: obligation.acceptanceCriteria,
    evidenceRequired: obligation.evidenceRequired,
    evidence: evidenceFor(obligation.id, contract.supplierTenantId),
    decisions: decisionsFor(obligation.id, contract),
  };
}

export function supplierSignatoryView(signatory: FixtureSignatory, contract: FixtureContract, userId: number): SupplierSignatoryView {
  return {
    id: signatory.id,
    party: signatory.party,
    name: signatory.name,
    organizationName: signatory.party === 'buyer' ? tenantName(contract.tenantId) : tenantName(contract.supplierTenantId),
    isMe: signatory.userId === userId,
    status: signatory.status,
    method: signatory.method,
    signedAt: signatory.signedAt,
  };
}

export function supplierChangeRow(change: FixtureChange): SupplierChangeRequestRow {
  return {
    id: change.id,
    number: change.number,
    displayNumber: changeRequestLabel(change.number),
    title: change.title,
    reason: change.reason,
    raisedByParty: change.raisedByParty,
    status: change.status,
    costImpact: change.costImpact,
    scheduleImpactDays: change.scheduleImpactDays,
    supplierAgreedAt: change.supplierAgreedAt,
    createdAt: change.createdAt,
  };
}

/** Reviews are shared with the supplier from `shared_with_supplier` on; drafts stay internal. */
export function supplierReviews(contract: FixtureContract): SupplierReviewView[] {
  return reviewsOf(contract.id)
    .filter((review) => review.status !== 'draft')
    .map((review) => supplierReviewView(review));
}

export function supplierReviewView(review: FixtureReview): SupplierReviewView {
  const { finalizedBy: _finalizedBy, ...row } = reviewRow(review);
  return { ...row, results: measureResults(review.id) };
}

/** Obligation states in which the supplier still has to act (submit or resubmit evidence). */
const SUPPLIER_ACTION_STATUSES: readonly ObligationsStatus[] = ['planned', 'due', 'overdue', 'rejected'];

export function supplierContractRow(contract: FixtureContract, userId: number, now: Date): SupplierContractRow {
  const obligations = obligationsOf(contract.id);
  const mine = signatoriesOf(contract.id).find((signatory) => signatory.party === 'supplier' && signatory.userId === userId);
  const nextDue = obligations
    .filter((obligation) => obligation.party === 'supplier' && SUPPLIER_ACTION_STATUSES.includes(obligation.status) && obligation.dueAt !== null)
    .map((obligation) => obligation.dueAt as string)
    .sort()[0];
  return {
    id: contract.id,
    reference: contract.reference,
    title: contract.title,
    status: contract.status,
    buyer: { tenantId: contract.tenantId, name: tenantName(contract.tenantId) },
    legalEntity: legalEntityRef(contract),
    tender: contract.tender,
    value: contract.value,
    currentValue: currentValue(contract),
    termStart: contract.termStart,
    termEnd: contract.termEnd,
    mySignatureStatus: mine?.status ?? null,
    openObligations: obligations.filter((obligation) => obligation.party === 'supplier' && isObligationOpen(obligation)).length,
    overdueObligations: obligations.filter((obligation) => obligation.party === 'supplier' && isObligationOverdue(obligation, now)).length,
    pendingChangeRequests: changesOf(contract.id).filter((change) => PENDING_CHANGE_STATUSES.includes(change.status)).length,
    nextDueAt: deadline(nextDue ?? null, timeZoneOf(contract)),
  };
}

export function supplierContractDetail(contract: FixtureContract, userId: number, now: Date): SupplierContractDetail {
  const signatureBlockedReason =
    contract.status !== 'awaiting_signature'
      ? null
      : differenceBlocks(contract)
        ? 'The buyer is still approving changes to the agreed terms; signing opens once they are approved.'
        : null;
  return {
    ...supplierContractRow(contract, userId, now),
    timeZone: timeZoneOf(contract),
    scope: contract.scope,
    paymentTerms: contract.paymentTerms,
    serviceLocations: contract.serviceLocations,
    signedAt: contract.signedAt,
    effectiveDate: contract.effectiveDate,
    noticeToProceedAt: contract.noticeToProceedAt,
    deliveryStartAt: contract.deliveryStartAt,
    signedOutsideApp: contract.signedOutsideApp,
    signatureBlockedReason,
    signatories: signatoriesOf(contract.id).map((signatory) => supplierSignatoryView(signatory, contract, userId)),
    obligations: obligationsOf(contract.id).map((obligation) => supplierObligationRow(obligation, contract, now)),
    changeRequests: changesOf(contract.id)
      .filter((change) => change.status !== 'draft' || change.raisedByParty === 'supplier')
      .map(supplierChangeRow),
    reviews: supplierReviews(contract),
    incidents: CONTRACT_INCIDENTS.filter((incident) => incident.contractId === contract.id).map((incident) => {
      const { owner: _owner, ...view } = incidentView(incident.id);
      return view;
    }),
    improvementActions: improvementActions(contract),
    invoices: invoicesOf(contract.id).map((invoice) => {
      const { obligation, ...view } = invoiceView(invoice);
      return { ...view, obligationTitle: obligation?.title ?? null };
    }),
    securities: securitiesOf(contract.id).map((security) => {
      const { releaseApproval: _releaseApproval, ...view } = securityView(security);
      return view;
    }),
    disputes: disputesOf(contract.id).map((dispute) => {
      const { authorizedDecision: _authorizedDecision, ...view } = disputeView(dispute);
      return view;
    }),
    contacts: [...contract.contacts],
  };
}
