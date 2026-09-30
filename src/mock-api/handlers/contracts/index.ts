/**
 * Mock handlers of the contracts contract (`src/contracts/contracts.ts`; CON-01 … CON-11, SUP-23).
 *
 * - Buyer routes see only contracts of the active buyer tenant; another tenant's contract is simply not found.
 * - Supplier routes see only the supplier's own contracts, and only once they leave internal preparation
 *   (`draft` / `under_review` stay buyer-internal). Supplier projections never carry renewal options ([R], DD-03),
 *   handovers, allocations or approval internals.
 * - Commands validate the business state the fixtures imply (declared error codes) and answer with a static,
 *   contract-valid outcome. Nothing is persisted: the next read returns the fixture again.
 */
import type { Money, PersonRef } from '../../../contracts/common.js';
import { contractsEndpoints as api } from '../../../contracts/contracts.js';
import type {
  ChangeRequestDetail,
  ContractApprovalRef,
  ContractAssignee,
  ContractRow,
} from '../../../contracts/contracts.js';
import { add, formatMoney, gt, sub, sum } from '../../../contracts/decimal.js';
import type { PermissionCode } from '../../../contracts/permissions.js';
import { mockRoute } from '../../app.js';
import { acceptCustomFields, customFieldIssues, customFieldValuesOf } from '../../custom-fields.js';
import type { MockApp } from '../../app.js';
import {
  CONTRACT_EVIDENCE,
  CONTRACT_IMPROVEMENT_ACTIONS,
  CONTRACT_LEGAL_ENTITIES,
  CONTRACT_LOT_OUTCOMES,
  CONTRACT_MEASURES,
  CONTRACT_OBLIGATIONS,
} from '../../fixtures/contracts/index.js';
import type { FixtureChange, FixtureContract, FixtureObligation } from '../../fixtures/contracts/index.js';
import { PERSONAS } from '../../fixtures/platform.js';
import { membershipPermissions, personRef } from '../../persona.js';
import {
  CLOSABLE_STATUSES,
  allSignedExcept,
  allocatedTotal,
  allocationsOf,
  approvalById,
  approvalRef,
  awardSource,
  buyerContracts,
  capacityOf,
  changeApprovers,
  changeAuthority,
  changeDetail,
  changeRow,
  changesOf,
  closeoutChecks,
  closeoutOf,
  contractCloseout,
  contractCustomContext,
  contractDetail,
  contractFinancials,
  contractHandover,
  contractPerformance,
  contractPreparation,
  contractRenewals,
  contractRow,
  contractSignature,
  currentValue,
  deadline,
  differenceBlocks,
  disputeView,
  disputesOf,
  findBuyerContract,
  findSupplierContract,
  handoverOf,
  holdsOf,
  invoiceView,
  invoicesOf,
  isObligationOpen,
  isObligationOverdue,
  isOptionUndecided,
  isoInstant,
  localDate,
  matchesText,
  money,
  nextDecision,
  obligationCounts,
  obligationDetail,
  obligationPayment,
  obligationRow,
  obligationsOf,
  pendingChangesTotal,
  personOrNull,
  renewalOptionView,
  renewalDecisionDueWithin,
  renewalOptionsOf,
  reviewDetail,
  reviewRow,
  reviewsOf,
  securitiesOf,
  securityView,
  signatoriesOf,
  signatoryView,
  sortBy,
  supplierChangeRow,
  supplierContractDetail,
  supplierContractRow,
  supplierContracts,
  supplierObligationDetail,
  supplierObligationRow,
  supplierRef,
  supplierReviewView,
  supplierSignatoryView,
  tenantName,
  timeZoneOf,
} from './build.js';

/** First id of a record "created" by a static command (foundation-contract §2.3). */
const NEW_ID = 900;

const CLOSED_OBLIGATION_STATUSES: readonly string[] = ['accepted', 'waived', 'cancelled'];
const SUBMITTABLE_OBLIGATION_STATUSES: readonly string[] = ['planned', 'due', 'overdue', 'rejected'];
const WITHDRAWABLE_CHANGE_STATUSES: readonly string[] = ['draft', 'submitted', 'impact_assessment', 'approval_pending'];
const AGREEABLE_CHANGE_STATUSES: readonly string[] = ['submitted', 'impact_assessment', 'approval_pending'];
const REMEDY_TYPES: readonly string[] = ['remedy', 'credit', 'penalty', 'settlement'];
const APPROVED: readonly string[] = ['approved', 'approved_with_conditions'];

// ---------------------------------------------------------------------------------------------------------
// Members and eligibility
// ---------------------------------------------------------------------------------------------------------

interface Member {
  readonly userId: number;
  readonly fullName: string;
  readonly capacity: string | null;
  readonly permissions: readonly PermissionCode[];
  readonly authorityLimit: Money | null;
}

function membersOf(tenantId: number): Member[] {
  const members: Member[] = [];
  for (const persona of PERSONAS) {
    if (persona.status !== 'active') {
      continue;
    }
    const membership = persona.memberships.find((candidate) => candidate.tenantId === tenantId && candidate.status === 'active');
    if (membership === undefined) {
      continue;
    }
    members.push({
      userId: persona.userId,
      fullName: persona.fullName,
      capacity: membership.capacity,
      permissions: membershipPermissions(membership),
      authorityLimit: membership.authorityLimit,
    });
  }
  return members;
}

function hasAny(member: Member | undefined, codes: readonly PermissionCode[]): boolean {
  return member !== undefined && codes.some((code) => member.permissions.includes(code));
}

function memberOf(tenantId: number, userId: number): Member | undefined {
  return membersOf(tenantId).find((member) => member.userId === userId);
}

const MANAGER_CODES: readonly PermissionCode[] = ['contract.manage', 'contract.prepare'];

function isEligibleManager(tenantId: number, userId: number): boolean {
  return hasAny(memberOf(tenantId, userId), MANAGER_CODES);
}

// ---------------------------------------------------------------------------------------------------------
// Static command helpers
// ---------------------------------------------------------------------------------------------------------

function newApproval(
  subjectType: ContractApprovalRef['subjectType'],
  title: string,
  amount: Money | null,
  requestedBy: PersonRef,
  approver: PersonRef | null,
  requestedAt: string,
): ContractApprovalRef {
  return { approvalId: NEW_ID, subjectType, status: 'pending', title, amount, requestedBy, requestedAt, currentApprover: approver, decidedAt: null, inApprovalWorkspace: false };
}

/** Cumulative contract value after a change: current value + other pending changes + this change. */
function cumulativeAfter(contract: FixtureContract, change: Pick<FixtureChange, 'id' | 'costImpact' | 'status'>, costImpact: Money): Money {
  const others = changesOf(contract.id).filter(
    (candidate) =>
      candidate.id !== change.id &&
      ['submitted', 'impact_assessment', 'approval_pending'].includes(candidate.status) &&
      candidate.costImpact !== null,
  );
  const pendingOthers = sum(others.map((candidate) => (candidate.costImpact as Money).amount));
  return money(add(add(currentValue(contract).amount, pendingOthers), costImpact.amount), contract.value.currency);
}

function contractSummary(rows: readonly FixtureContract[], now: Date) {
  const statuses = [...new Set(rows.map((row) => row.status))];
  const currencies = [...new Set(rows.map((row) => row.value.currency))];
  return {
    byStatus: statuses.map((status) => ({ status, count: rows.filter((row) => row.status === status).length })),
    upcomingDecisions: rows.filter((row) => nextDecision(row, now) !== null).length,
    renewalsWithin90Days: rows.filter((row) => renewalOptionsOf(row.id).some((option) => renewalDecisionDueWithin(option, row, now, 90))).length,
    overdueObligations: rows.reduce((total, row) => total + obligationCounts(row, now).overdue, 0),
    currentValueByCurrency: currencies.map((currency) =>
      money(sum(rows.filter((row) => row.value.currency === currency).map((row) => currentValue(row).amount)), currency),
    ),
  };
}

function sortContracts(rows: ContractRow[], sort: string | undefined, dir: 'asc' | 'desc'): ContractRow[] {
  switch (sort) {
    case 'title':
      return sortBy(rows, (row) => row.title.toLowerCase(), dir);
    case 'status':
      return sortBy(rows, (row) => row.status, dir);
    case 'value':
      return sortBy(rows, (row) => Number(row.currentValue.amount), dir);
    case 'termEnd':
      return sortBy(rows, (row) => row.termEnd, dir);
    case 'nextDecision':
      return sortBy(rows, (row) => row.nextDecision?.dueAt?.at ?? row.nextRenewalDeadline?.at ?? null, dir);
    case 'supplier':
      return sortBy(rows, (row) => row.supplier.name.toLowerCase(), dir);
    default:
      return sortBy(rows, (row) => row.reference, sort === undefined ? 'desc' : dir);
  }
}

// ---------------------------------------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------------------------------------

export function register(app: MockApp): void {
  registerBuyerFormation(app);
  registerBuyerDelivery(app);
  registerBuyerCommercial(app);
  registerSupplier(app);
}

function registerBuyerFormation(app: MockApp): void {
  mockRoute(app, api.list, ({ requireTenant, query, fixtures, now }) => {
    const { tenant } = requireTenant();
    const all = buyerContracts(tenant.id);
    const rows = all
      .filter((contract) => query.status === undefined || query.status.includes(contract.status))
      .filter((contract) => query.ownerUserId === undefined || contract.ownerUserId === query.ownerUserId)
      .filter((contract) => query.contractManagerUserId === undefined || contract.contractManagerUserId === query.contractManagerUserId)
      .filter((contract) => query.supplierTenantId === undefined || contract.supplierTenantId === query.supplierTenantId)
      .filter((contract) => query.legalEntityId === undefined || contract.legalEntityId === query.legalEntityId)
      .filter((contract) => query.termEndFrom === undefined || (contract.termEnd !== null && contract.termEnd >= query.termEndFrom))
      .filter((contract) => query.termEndTo === undefined || (contract.termEnd !== null && contract.termEnd <= query.termEndTo))
      .filter((contract) => query.differsFromAward === undefined || contract.differsFromAward === query.differsFromAward)
      .filter((contract) => {
        const days = query.renewalWithinDays;
        return days === undefined || renewalOptionsOf(contract.id).some((option) => renewalDecisionDueWithin(option, contract, now, days));
      })
      .filter((contract) => query.upcomingDecision === undefined || (nextDecision(contract, now) !== null) === query.upcomingDecision)
      .filter((contract) =>
        matchesText(query.q, contract.reference, contract.title, contract.scopeSummary, tenantName(contract.supplierTenantId), contract.tender?.reference ?? null),
      )
      .map((contract) => contractRow(contract, now));
    return { ...fixtures.page(sortContracts(rows, query.sort, query.dir)), summary: contractSummary(all, now) };
  });

  mockRoute(app, api.get, ({ requireTenant, params, notFound, now }) => {
    const contract = findBuyerContract(requireTenant().tenant.id, params.contractId) ?? notFound();
    return contractDetail(contract, now);
  });

  mockRoute(app, api.awardSources, ({ requireTenant }) => {
    const { tenant } = requireTenant();
    return {
      lotOutcomes: CONTRACT_LOT_OUTCOMES.filter((outcome) => outcome.tenantId === tenant.id).map((outcome) => awardSource(outcome.id)),
      legalEntities: CONTRACT_LEGAL_ENTITIES.filter((entity) => entity.tenantId === tenant.id && entity.active).map((entity) => ({
        legalEntityId: entity.legalEntityId,
        name: entity.name,
        registrationNumber: entity.registrationNumber,
      })),
    };
  });

  mockRoute(app, api.assignees, ({ requireTenant, query }) => {
    const { tenant } = requireTenant();
    const purposeCodes: Record<string, readonly PermissionCode[]> = {
      owner: ['contract.prepare', 'contract.manage'],
      contract_manager: ['contract.manage'],
      obligation_owner: ['contract.manage', 'contract.prepare'],
      signatory: ['contract.sign'],
    };
    const codes: readonly PermissionCode[] =
      query.purpose === undefined ? ['contract.view'] : (purposeCodes[query.purpose] ?? ['contract.view']);
    const items: ContractAssignee[] = membersOf(tenant.id)
      .filter((member) => hasAny(member, codes))
      .filter((member) => matchesText(query.q, member.fullName, member.capacity))
      .map((member) => {
        const canSign = member.permissions.includes('contract.sign');
        const canApproveChanges = member.permissions.includes('contract.change.approve');
        return {
          userId: member.userId,
          fullName: member.fullName,
          capacity: member.capacity,
          canManage: member.permissions.includes('contract.manage'),
          canSign,
          canApproveChanges,
          authorityLimit: canSign || canApproveChanges ? member.authorityLimit : null,
        };
      });
    return { items };
  });

  mockRoute(app, api.create, ({ requireTenant, requirePersona, body, fail, now }) => {
    const { tenant } = requireTenant();
    const currency = body.value.currency;
    for (const allocation of body.allocations) {
      const outcome = CONTRACT_LOT_OUTCOMES.find((candidate) => candidate.id === allocation.lotOutcomeId && candidate.tenantId === tenant.id);
      if (outcome === undefined || outcome.status !== 'final_awarded' || outcome.awardedValue === null) {
        return fail(409, 'LOT_OUTCOME_NOT_FINAL', `Lot outcome ${allocation.lotOutcomeId} is not a final award of this organization.`);
      }
      if (outcome.tender.tenderId !== body.tenderId) {
        return fail(422, 'LOT_OUTCOME_OTHER_TENDER', `Lot ${outcome.lotNumber} belongs to ${outcome.tender.reference}, not to the chosen tender.`);
      }
      if (outcome.supplierTenantId !== body.supplierTenantId) {
        return fail(422, 'SUPPLIER_PARTY_MISMATCH', 'The supplier legal party must be the supplier awarded the lot.');
      }
      if (allocation.allocatedValue.currency !== outcome.awardedValue.currency || allocation.allocatedValue.currency !== currency) {
        return fail(422, 'CURRENCY_MISMATCH', 'Allocations must use the award and contract currency.');
      }
      const remaining = sub(outcome.awardedValue.amount, allocatedTotal(outcome.id, currency).amount);
      if (gt(allocation.allocatedValue.amount, remaining)) {
        return fail(
          422,
          'ALLOCATION_EXCEEDS_AWARD',
          `Only ${formatMoney(remaining, currency)} of lot ${outcome.lotNumber} is still unallocated (BR-33).`,
        );
      }
    }
    const entity = CONTRACT_LEGAL_ENTITIES.find((candidate) => candidate.legalEntityId === body.legalEntityId && candidate.tenantId === tenant.id);
    if (entity === undefined || !entity.active) {
      return fail(422, 'LEGAL_ENTITY_INACTIVE', 'Choose an active contracting legal entity of this organization (BR-04).');
    }
    const allocated = sum(body.allocations.map((allocation) => allocation.allocatedValue.amount));
    const differs = gt(body.value.amount, allocated) || gt(allocated, body.value.amount);
    if (differs && (body.differenceExplanation === undefined || body.differenceExplanation.length === 0)) {
      return fail(422, 'DIFFERENCE_EXPLANATION_REQUIRED', 'The contract value differs from the allocated award; explain the difference (AC-28).');
    }
    for (const userId of [body.ownerUserId, body.contractManagerUserId]) {
      if (userId !== undefined && !isEligibleManager(tenant.id, userId)) {
        return fail(422, 'ASSIGNEE_NOT_ELIGIBLE', 'The owner and the contract manager must be able to prepare or manage contracts.');
      }
    }
    acceptCustomFields(tenant.id, 'contract', body.customFields, {}, contractCustomContext(tenant.id, body.tenderId, body.value.amount));
    const year = localDate(now, tenant.officialTimeZone).slice(0, 4);
    const created: ContractRow = {
      id: NEW_ID,
      reference: `C-${year}-0900`,
      title: body.title,
      status: 'draft',
      supplier: supplierRef(body.supplierTenantId),
      legalEntity: { legalEntityId: entity.legalEntityId, name: entity.name, registrationNumber: entity.registrationNumber },
      tender: CONTRACT_LOT_OUTCOMES.find((outcome) => outcome.tender.tenderId === body.tenderId)?.tender ?? null,
      owner: personRef(body.ownerUserId ?? requirePersona().userId),
      contractManager: body.contractManagerUserId === undefined ? null : personRef(body.contractManagerUserId),
      scopeSummary: body.scope.length > 80 ? `${body.scope.slice(0, 77)}...` : body.scope,
      value: money(body.value.amount, currency),
      currentValue: money(body.value.amount, currency),
      ceiling: body.ceiling === undefined ? null : money(body.ceiling.amount, body.ceiling.currency),
      remainingCeiling: body.ceiling === undefined ? null : money(sub(body.ceiling.amount, body.value.amount), currency),
      termStart: body.termStart ?? null,
      termEnd: body.termEnd ?? null,
      nextRenewalDeadline: null,
      nextRenewalWindow: null,
      nextDecision: { kind: 'review_approval', dueAt: null, detail: 'Submit the draft for review.' },
      differsFromAward: differs,
      handoverStatus: null,
      overdueObligations: 0,
      origin: null,
    };
    return created;
  });

  mockRoute(app, api.update, ({ requireTenant, params, body, fail, notFound }) => {
    const contract = findBuyerContract(requireTenant().tenant.id, params.contractId) ?? notFound();
    if (contract.status !== 'draft' && contract.status !== 'under_review') {
      return fail(409, 'CONTRACT_NOT_EDITABLE', `The contract is ${contract.status}; only draft or under-review contracts can be edited.`);
    }
    if (body.value !== undefined && body.value.currency !== contract.value.currency) {
      return fail(422, 'CURRENCY_MISMATCH', 'Keep the contract currency.');
    }
    const value = body.value?.amount ?? contract.value.amount;
    const allocated = sum(allocationsOf(contract).map((allocation) => allocation.allocatedValue.amount));
    const differs = contract.differsFromAward || (allocated !== '0' && (gt(value, allocated) || gt(allocated, value)));
    const explanation = body.differenceExplanation === undefined ? contract.differenceExplanation : body.differenceExplanation;
    if (differs && (explanation === null || explanation.length === 0)) {
      return fail(422, 'DIFFERENCE_EXPLANATION_REQUIRED', 'The contract differs from the allocated award; explain the difference (AC-28).');
    }
    acceptCustomFields(
      contract.tenantId,
      'contract',
      body.customFields,
      customFieldValuesOf(contract.tenantId, 'contract', contract.id),
      contractCustomContext(contract.tenantId, contract.tender?.tenderId ?? null, value),
    );
    const material = body.value !== undefined || body.scope !== undefined || body.termStart !== undefined || body.termEnd !== undefined;
    return {
      contractId: contract.id,
      status: contract.status,
      version: material ? contract.version + 1 : contract.version,
      differsFromAward: differs,
      approvalsInvalidated: material && contract.status === 'under_review',
    };
  });

  mockRoute(app, api.preparation, ({ requireTenant, params, notFound }) => {
    const contract = findBuyerContract(requireTenant().tenant.id, params.contractId) ?? notFound();
    return contractPreparation(contract);
  });

  mockRoute(app, api.submitForReview, ({ requireTenant, params, fail, notFound }) => {
    const contract = findBuyerContract(requireTenant().tenant.id, params.contractId) ?? notFound();
    if (contract.status !== 'draft') {
      return fail(409, 'CONTRACT_NOT_DRAFT', `The contract is ${contract.status}.`);
    }
    if (contract.differsFromAward && contract.differenceExplanation === null) {
      return fail(422, 'DIFFERENCE_EXPLANATION_REQUIRED', 'Explain the differences from the award before review.');
    }
    if (allocationsOf(contract).some((allocation) => gt('0', allocation.unallocated.amount))) {
      return fail(422, 'ALLOCATION_EXCEEDS_AWARD', 'An allocation exceeds its awarded value (BR-33).');
    }
    const missingCustom = customFieldIssues(
      contract.tenantId,
      'contract',
      customFieldValuesOf(contract.tenantId, 'contract', contract.id),
      contractCustomContext(contract.tenantId, contract.tender?.tenderId ?? null, contract.value.amount),
      true,
    );
    if (missingCustom.length > 0) {
      return fail(422, 'CUSTOM_FIELDS_INCOMPLETE', `Complete the additional information: ${missingCustom.map((issue) => issue.message).join(' ')}`);
    }
    return {
      contractId: contract.id,
      reference: contract.reference,
      status: 'under_review',
      differsFromAward: contract.differsFromAward,
      differenceApprovalRequired: contract.differsFromAward,
      message: `${contract.reference} is submitted for review. Request the contract approval on the approval panel.`,
    };
  });

  mockRoute(app, api.reviewDecision, ({ requireTenant, requirePersona, params, body, fail, notFound }) => {
    const contract = findBuyerContract(requireTenant().tenant.id, params.contractId) ?? notFound();
    if (contract.status !== 'under_review') {
      return fail(409, 'CONTRACT_NOT_UNDER_REVIEW', `The contract is ${contract.status}.`);
    }
    const persona = requirePersona();
    const pending = contract.contractApprovalIds.map((id) => approvalById(id)).find((approval) => approval?.status === 'pending');
    if (pending !== undefined && pending.requestedByUserId === persona.userId) {
      return fail(403, 'SELF_APPROVAL_BLOCKED', 'You requested this approval and cannot decide it (BR-07).');
    }
    if (body.decision === 'approve' && differenceBlocks(contract)) {
      return fail(409, 'DIFFERENCE_NOT_APPROVED', 'The differences from the award must be approved first (AC-28).');
    }
    if (body.decision === 'approve' && holdsOf(contract.id).some((hold) => hold.blockedActions.includes('contract_sign'))) {
      return fail(409, 'HOLD_BLOCKS_CONTRACT', 'A hold blocks signature of this contract.');
    }
    const approve = body.decision === 'approve';
    return {
      contractId: contract.id,
      reference: contract.reference,
      status: approve ? 'awaiting_signature' : 'draft',
      differsFromAward: contract.differsFromAward,
      differenceApprovalRequired: differenceBlocks(contract),
      message: approve
        ? `${contract.reference} is approved and issued for signature.`
        : `${contract.reference} is returned to preparation: ${body.reason}`,
    };
  });

  mockRoute(app, api.assignOwners, ({ requireTenant, params, body, fail, notFound }) => {
    const { tenant } = requireTenant();
    const contract = findBuyerContract(tenant.id, params.contractId) ?? notFound();
    if (contract.status === 'closed') {
      return fail(409, 'CONTRACT_CLOSED', 'The contract is closed.');
    }
    if (body.ownerUserId !== undefined && !isEligibleManager(tenant.id, body.ownerUserId)) {
      return fail(422, 'ASSIGNEE_NOT_ELIGIBLE', 'The owner must be able to prepare or manage contracts.');
    }
    if (body.contractManagerUserId !== undefined && !hasAny(memberOf(tenant.id, body.contractManagerUserId), ['contract.manage'])) {
      return fail(422, 'ASSIGNEE_NOT_ELIGIBLE', 'The contract manager must hold contract management permission.');
    }
    return {
      contractId: contract.id,
      owner: personOrNull(body.ownerUserId ?? contract.ownerUserId),
      contractManager: personOrNull(body.contractManagerUserId ?? contract.contractManagerUserId),
    };
  });

  // CON-03
  mockRoute(app, api.signature, ({ requireTenant, params, notFound }) => {
    const contract = findBuyerContract(requireTenant().tenant.id, params.contractId) ?? notFound();
    return contractSignature(contract);
  });

  mockRoute(app, api.addSignatory, ({ requireTenant, params, body, fail, notFound }) => {
    const { tenant } = requireTenant();
    const contract = findBuyerContract(tenant.id, params.contractId) ?? notFound();
    if (contract.signedAt !== null) {
      return fail(409, 'CONTRACT_ALREADY_SIGNED', 'The contract is already signed.');
    }
    if (body.userId !== undefined && signatoriesOf(contract.id).some((signatory) => signatory.userId === body.userId)) {
      return fail(409, 'SIGNATORY_ALREADY_LISTED', 'This person is already a signatory.');
    }
    let authorityLimit: Money | null = null;
    if (body.party === 'buyer') {
      const member = body.userId === undefined ? undefined : memberOf(tenant.id, body.userId);
      if (member === undefined || !member.permissions.includes('contract.sign')) {
        return fail(403, 'SIGNATORY_AUTHORITY_INSUFFICIENT', 'Buyer signatories must hold contract signing permission.');
      }
      authorityLimit = member.authorityLimit;
      if (authorityLimit !== null && gt(currentValue(contract).amount, authorityLimit.amount)) {
        return fail(403, 'SIGNATORY_AUTHORITY_INSUFFICIENT', `${member.fullName}'s signing authority is below the contract value.`);
      }
    }
    return {
      id: NEW_ID,
      party: body.party,
      user: body.userId === undefined ? null : personRef(body.userId),
      name: body.name,
      organizationName: body.party === 'buyer' ? tenantName(contract.tenantId) : tenantName(contract.supplierTenantId),
      authorityNote: body.authorityNote ?? null,
      authorityLimit,
      authoritySufficient: body.party === 'buyer' ? true : null,
      status: 'pending',
      method: null,
      signedAt: null,
      verificationNote: null,
      refusalReason: null,
    };
  });

  mockRoute(app, api.sign, ({ requireTenant, requirePersona, params, fail, notFound, now }) => {
    const contract = findBuyerContract(requireTenant().tenant.id, params.contractId) ?? notFound();
    const signatory = signatoriesOf(contract.id).find((candidate) => candidate.id === params.signatoryId) ?? notFound();
    if (contract.status !== 'awaiting_signature') {
      return fail(409, 'CONTRACT_NOT_AWAITING_SIGNATURE', `The contract is ${contract.status}.`);
    }
    if (differenceBlocks(contract)) {
      return fail(409, 'DIFFERENCE_NOT_APPROVED', 'The contract differs from the approved award and the difference is not approved yet (AC-28).');
    }
    if (holdsOf(contract.id).some((hold) => hold.blockedActions.includes('contract_sign'))) {
      return fail(409, 'HOLD_BLOCKS_SIGNATURE', 'A hold blocks signature.');
    }
    if (signatory.party !== 'buyer' || signatory.userId !== requirePersona().userId) {
      return fail(403, 'NOT_YOUR_SIGNATURE', 'Only the named signatory can sign in the app.');
    }
    if (signatory.status !== 'pending') {
      return fail(409, 'SIGNATURE_ALREADY_RECORDED', 'This signature is already recorded.');
    }
    if (signatory.authorityLimit !== null && gt(currentValue(contract).amount, signatory.authorityLimit.amount)) {
      return fail(403, 'SIGNATORY_AUTHORITY_INSUFFICIENT', 'The contract value exceeds your signing authority.');
    }
    const allSigned = allSignedExcept(contract, signatory.id);
    return {
      signatory: { ...signatoryView(signatory, contract), status: 'signed', method: 'in_app', signedAt: isoInstant(now) },
      contractId: contract.id,
      contractStatus: allSigned ? 'signed_not_effective' : 'awaiting_signature',
      allSigned,
      message: allSigned ? 'All parties have signed. Record the effective date and the notice to proceed.' : 'Your signature is recorded; other signatures are outstanding.',
    };
  });

  mockRoute(app, api.recordExternalSignature, ({ requireTenant, params, body, fail, notFound }) => {
    const contract = findBuyerContract(requireTenant().tenant.id, params.contractId) ?? notFound();
    const signatory = signatoriesOf(contract.id).find((candidate) => candidate.id === params.signatoryId) ?? notFound();
    if (contract.status !== 'awaiting_signature') {
      return fail(409, 'CONTRACT_NOT_AWAITING_SIGNATURE', `The contract is ${contract.status}.`);
    }
    if (differenceBlocks(contract)) {
      return fail(409, 'DIFFERENCE_NOT_APPROVED', 'The difference from the award is not approved yet (AC-28).');
    }
    if (holdsOf(contract.id).some((hold) => hold.blockedActions.includes('contract_sign'))) {
      return fail(409, 'HOLD_BLOCKS_SIGNATURE', 'A hold blocks signature.');
    }
    if (signatory.status !== 'pending') {
      return fail(409, 'SIGNATURE_ALREADY_RECORDED', 'This signature is already recorded.');
    }
    const allSigned = allSignedExcept(contract, signatory.id);
    return {
      signatory: {
        ...signatoryView(signatory, contract),
        status: 'recorded_external',
        method: 'external_recorded',
        signedAt: body.signedAt,
        verificationNote: body.verificationNote,
      },
      contractId: contract.id,
      contractStatus: allSigned ? 'signed_not_effective' : 'awaiting_signature',
      allSigned,
      message: 'The external signature is recorded from its evidence; no in-app signature was created.',
    };
  });

  mockRoute(app, api.returnToReview, ({ requireTenant, params, body, fail, notFound }) => {
    const contract = findBuyerContract(requireTenant().tenant.id, params.contractId) ?? notFound();
    if (contract.status !== 'awaiting_signature') {
      return fail(409, 'CONTRACT_NOT_AWAITING_SIGNATURE', `The contract is ${contract.status}.`);
    }
    return {
      contractId: contract.id,
      reference: contract.reference,
      status: 'under_review',
      differsFromAward: contract.differsFromAward,
      differenceApprovalRequired: differenceBlocks(contract),
      message: `${contract.reference} goes back to review: ${body.reason}`,
    };
  });

  mockRoute(app, api.authorizeCommencement, ({ requireTenant, params, body, fail, notFound, now }) => {
    const contract = findBuyerContract(requireTenant().tenant.id, params.contractId) ?? notFound();
    if (differenceBlocks(contract)) {
      return fail(409, 'DIFFERENCE_NOT_APPROVED', 'The difference from the award is not approved (AC-28).');
    }
    if (contract.signedAt === null) {
      return fail(409, 'CONTRACT_NOT_SIGNED', 'Commencement needs every signature first (BR-35).');
    }
    if (holdsOf(contract.id).some((hold) => hold.blockedActions.includes('contract_start'))) {
      return fail(409, 'HOLD_BLOCKS_START', 'A hold blocks the start of work.');
    }
    const blocking = contractSignature(contract).commencementChecks.filter((check) => check.state === 'blocking');
    if (blocking.length > 0) {
      return fail(409, 'COMMENCEMENT_PRECONDITIONS_OPEN', blocking.map((check) => check.label).join('; '));
    }
    const today = localDate(now, timeZoneOf(contract));
    return {
      contractId: contract.id,
      status: body.effectiveDate <= today ? 'active' : 'signed_not_effective',
      effectiveDate: body.effectiveDate,
      noticeToProceedAt: body.noticeToProceedAt ?? null,
      deliveryStartAt: body.deliveryStartAt ?? null,
      message:
        body.effectiveDate <= today
          ? 'Commencement recorded; the contract is active.'
          : `Commencement recorded; the contract becomes active on ${body.effectiveDate}.`,
    };
  });

  // CON-04
  mockRoute(app, api.handover, ({ requireTenant, params, fail, notFound }) => {
    const contract = findBuyerContract(requireTenant().tenant.id, params.contractId) ?? notFound();
    const handover = handoverOf(contract.id);
    if (handover === undefined) {
      return fail(409, 'HANDOVER_NOT_APPLICABLE', 'Imported historical contracts have no procurement handover.');
    }
    return contractHandover(contract, handover);
  });

  mockRoute(app, api.submitHandover, ({ requireTenant, params, fail, notFound, now }) => {
    const contract = findBuyerContract(requireTenant().tenant.id, params.contractId) ?? notFound();
    const handover = handoverOf(contract.id);
    if (handover === undefined) {
      return fail(409, 'HANDOVER_NOT_APPLICABLE', 'Imported historical contracts have no procurement handover.');
    }
    if (handover.status !== 'draft' && handover.status !== 'returned') {
      return fail(409, 'HANDOVER_NOT_DRAFT', `The handover is ${handover.status}.`);
    }
    const missing = contractHandover(contract, handover).checks.filter((check) => check.state === 'blocking');
    if (missing.length > 0) {
      return fail(422, 'HANDOVER_INCOMPLETE', `Complete the handover first: ${missing.map((check) => check.label).join(', ')}.`);
    }
    return {
      contractId: contract.id,
      handoverId: handover.id,
      status: 'submitted',
      submittedAt: isoInstant(now),
      acceptedAt: null,
      returnedAt: null,
      omissions: null,
      message: `The handover is submitted to ${personOrNull(handover.contractManagerUserId)?.fullName ?? 'the contract manager'} for acceptance.`,
    };
  });

  mockRoute(app, api.acceptHandover, ({ requireTenant, requirePersona, params, fail, notFound, now }) => {
    const contract = findBuyerContract(requireTenant().tenant.id, params.contractId) ?? notFound();
    const handover = handoverOf(contract.id);
    if (handover === undefined) {
      return fail(409, 'HANDOVER_NOT_APPLICABLE', 'Imported historical contracts have no procurement handover.');
    }
    if (handover.status !== 'submitted') {
      return fail(409, 'HANDOVER_NOT_SUBMITTED', `The handover is ${handover.status}.`);
    }
    if (handover.contractManagerUserId !== requirePersona().userId) {
      return fail(403, 'NOT_NAMED_CONTRACT_MANAGER', 'Only the named contract manager can accept or return the handover.');
    }
    return {
      contractId: contract.id,
      handoverId: handover.id,
      status: 'accepted',
      submittedAt: handover.submittedAt,
      acceptedAt: isoInstant(now),
      returnedAt: null,
      omissions: null,
      message: 'Handover accepted. The event closeout gate for this contract is satisfied (AC-29).',
    };
  });

  mockRoute(app, api.returnHandover, ({ requireTenant, requirePersona, params, body, fail, notFound, now }) => {
    const contract = findBuyerContract(requireTenant().tenant.id, params.contractId) ?? notFound();
    const handover = handoverOf(contract.id);
    if (handover === undefined) {
      return fail(409, 'HANDOVER_NOT_APPLICABLE', 'Imported historical contracts have no procurement handover.');
    }
    if (handover.status !== 'submitted') {
      return fail(409, 'HANDOVER_NOT_SUBMITTED', `The handover is ${handover.status}.`);
    }
    if (handover.contractManagerUserId !== requirePersona().userId) {
      return fail(403, 'NOT_NAMED_CONTRACT_MANAGER', 'Only the named contract manager can accept or return the handover.');
    }
    return {
      contractId: contract.id,
      handoverId: handover.id,
      status: 'returned',
      submittedAt: handover.submittedAt,
      acceptedAt: null,
      returnedAt: isoInstant(now),
      omissions: body.omissions,
      message: 'Handover returned with omissions. Event closeout stays blocked until it is accepted (AC-29).',
    };
  });
}

function obligationOf(contract: FixtureContract, obligationId: number): FixtureObligation | undefined {
  return CONTRACT_OBLIGATIONS.find((obligation) => obligation.id === obligationId && obligation.contractId === contract.id);
}

function registerBuyerDelivery(app: MockApp): void {
  mockRoute(app, api.obligations, ({ requireTenant, params, query, fixtures, notFound, now }) => {
    const contract = findBuyerContract(requireTenant().tenant.id, params.contractId) ?? notFound();
    const dueFrom = query.dueFrom;
    const dueTo = query.dueTo;
    const tz = timeZoneOf(contract);
    const rows = obligationsOf(contract.id)
      .filter((obligation) => query.kind === undefined || query.kind.includes(obligation.kind))
      .filter((obligation) => query.party === undefined || obligation.party === query.party)
      .filter((obligation) => query.status === undefined || query.status.includes(obligation.status))
      .filter((obligation) => query.ownerUserId === undefined || obligation.ownerUserId === query.ownerUserId)
      .filter((obligation) => dueFrom === undefined || (obligation.dueAt !== null && localDate(new Date(obligation.dueAt), tz) >= dueFrom))
      .filter((obligation) => dueTo === undefined || (obligation.dueAt !== null && localDate(new Date(obligation.dueAt), tz) <= dueTo))
      .filter((obligation) => query.overdue === undefined || isObligationOverdue(obligation, now) === query.overdue)
      .filter((obligation) => query.survivesCloseout === undefined || obligation.survivesCloseout === query.survivesCloseout)
      .filter((obligation) => query.paymentMilestone === undefined || obligation.isPaymentMilestone === query.paymentMilestone)
      .filter((obligation) => matchesText(query.q, obligation.title, obligation.description))
      .map((obligation) => obligationRow(obligation, contract, now));
    const sorted =
      query.sort === 'title'
        ? sortBy(rows, (row) => row.title.toLowerCase(), query.dir)
        : query.sort === 'status'
          ? sortBy(rows, (row) => row.status, query.dir)
          : query.sort === 'kind'
            ? sortBy(rows, (row) => row.kind, query.dir)
            : sortBy(rows, (row) => row.dueAt?.at ?? null, query.dir);
    return { ...fixtures.page(sorted), counts: obligationCounts(contract, now) };
  });

  mockRoute(app, api.obligation, ({ requireTenant, params, notFound, now }) => {
    const contract = findBuyerContract(requireTenant().tenant.id, params.contractId) ?? notFound();
    const obligation = obligationOf(contract, params.obligationId) ?? notFound();
    return obligationDetail(obligation, contract, now);
  });

  mockRoute(app, api.createObligation, ({ requireTenant, params, body, fail, notFound, now }) => {
    const { tenant } = requireTenant();
    const contract = findBuyerContract(tenant.id, params.contractId) ?? notFound();
    if (contract.status === 'closed') {
      return fail(409, 'CONTRACT_CLOSED', 'The contract is closed.');
    }
    for (const userId of [body.ownerUserId, body.escalationUserId]) {
      if (userId !== undefined && !isEligibleManager(tenant.id, userId)) {
        return fail(422, 'ASSIGNEE_NOT_ELIGIBLE', 'Owners and escalation contacts must manage or prepare contracts.');
      }
    }
    if (body.dependsOnId !== undefined && obligationOf(contract, body.dependsOnId) === undefined) {
      return fail(422, 'DEPENDENCY_NOT_FOUND', 'The obligation it depends on is not part of this contract.');
    }
    if (body.amount !== undefined && body.amount.currency !== contract.value.currency) {
      return fail(422, 'CURRENCY_MISMATCH', 'Use the contract currency.');
    }
    return {
      id: NEW_ID,
      contractId: contract.id,
      kind: body.kind,
      party: body.party,
      title: body.title,
      owner: personOrNull(body.ownerUserId ?? null),
      supplierContact: body.supplierContact ?? null,
      dueAt: deadline(body.dueAt ?? null, timeZoneOf(contract)),
      recurrence: body.recurrence ?? null,
      status: body.dueAt !== undefined && Date.parse(body.dueAt) < now.getTime() ? 'overdue' : 'planned',
      isPaymentMilestone: body.isPaymentMilestone,
      amount: body.amount ?? null,
      survivesCloseout: body.survivesCloseout,
      isOverdue: body.dueAt !== undefined && Date.parse(body.dueAt) < now.getTime(),
      evidenceCount: 0,
      latestDecision: null,
    };
  });

  mockRoute(app, api.assignObligation, ({ requireTenant, params, body, fail, notFound, now }) => {
    const { tenant } = requireTenant();
    const contract = findBuyerContract(tenant.id, params.contractId) ?? notFound();
    const obligation = obligationOf(contract, params.obligationId) ?? notFound();
    if (CLOSED_OBLIGATION_STATUSES.includes(obligation.status)) {
      return fail(409, 'OBLIGATION_CLOSED', `The obligation is ${obligation.status}.`);
    }
    const escalation = body.escalationUserId;
    if (!isEligibleManager(tenant.id, body.ownerUserId) || (escalation !== undefined && escalation !== null && !isEligibleManager(tenant.id, escalation))) {
      return fail(422, 'ASSIGNEE_NOT_ELIGIBLE', 'Owners and escalation contacts must manage or prepare contracts.');
    }
    return { ...obligationRow(obligation, contract, now), owner: personRef(body.ownerUserId) };
  });

  mockRoute(app, api.escalateObligation, ({ requireTenant, params, fail, notFound, now }) => {
    const contract = findBuyerContract(requireTenant().tenant.id, params.contractId) ?? notFound();
    const obligation = obligationOf(contract, params.obligationId) ?? notFound();
    if (!isObligationOverdue(obligation, now)) {
      return fail(409, 'OBLIGATION_NOT_OVERDUE', 'Only overdue obligations are escalated.');
    }
    if (obligation.escalationUserId === null) {
      return fail(422, 'NO_ESCALATION_CONTACT', 'Name an escalation contact first.');
    }
    const escalatedTo = personRef(obligation.escalationUserId);
    return {
      obligationId: obligation.id,
      escalatedTo,
      escalatedAt: isoInstant(now),
      message: `${escalatedTo.fullName} has an escalation task for "${obligation.title}".`,
    };
  });

  mockRoute(app, api.startObligationReview, ({ requireTenant, params, fail, notFound, now }) => {
    const contract = findBuyerContract(requireTenant().tenant.id, params.contractId) ?? notFound();
    const obligation = obligationOf(contract, params.obligationId) ?? notFound();
    if (obligation.status !== 'evidence_submitted') {
      return fail(409, 'OBLIGATION_NO_EVIDENCE', 'There is no newly submitted evidence to review.');
    }
    return { ...obligationRow(obligation, contract, now), status: 'under_review' };
  });

  mockRoute(app, api.decideObligation, ({ requireTenant, requirePersona, params, body, fail, notFound, now }) => {
    const { tenant } = requireTenant();
    const contract = findBuyerContract(tenant.id, params.contractId) ?? notFound();
    const obligation = obligationOf(contract, params.obligationId) ?? notFound();
    if (obligation.status !== 'under_review') {
      return fail(409, 'OBLIGATION_NOT_UNDER_REVIEW', 'Start the review of the submitted evidence first.');
    }
    const ownerId = body.remediationOwnerUserId;
    if (
      body.decision === 'rejected' &&
      ownerId !== undefined &&
      !isEligibleManager(tenant.id, ownerId) &&
      memberOf(contract.supplierTenantId, ownerId) === undefined
    ) {
      return fail(422, 'ASSIGNEE_NOT_ELIGIBLE', 'The remediation owner must be a contract manager or a member of the supplier.');
    }
    const rejected = body.decision === 'rejected';
    return {
      obligation: {
        ...obligationRow(obligation, contract, now),
        status: rejected ? 'rejected' : 'accepted',
        latestDecision: { decision: body.decision, decidedAt: isoInstant(now) },
      },
      decision: {
        id: NEW_ID,
        decision: body.decision,
        reasons: body.reasons,
        remediationRequired: rejected ? (body.remediationRequired ?? null) : null,
        remediationOwner: rejected && ownerId !== undefined ? personRef(ownerId) : null,
        remediationDueAt: rejected ? deadline(body.remediationDueAt ?? null, timeZoneOf(contract)) : null,
        decidedBy: personRef(requirePersona().userId),
        decidedAt: isoInstant(now),
      },
      payment: obligationPayment(obligation),
      message: rejected
        ? 'Evidence rejected with reasons and remediation. Invoice and payment status are unchanged; nothing is payable (AC-30).'
        : 'Evidence accepted. Payment still follows the invoice and payment process; acceptance does not approve payment.',
    };
  });

  mockRoute(app, api.submitObligationEvidence, ({ requireTenant, requirePersona, params, body, fail, notFound, now }) => {
    const { tenant } = requireTenant();
    const contract = findBuyerContract(tenant.id, params.contractId) ?? notFound();
    const obligation = obligationOf(contract, params.obligationId) ?? notFound();
    if (obligation.party !== 'buyer') {
      return fail(409, 'OBLIGATION_WRONG_PARTY', 'The supplier submits evidence for supplier obligations.');
    }
    if (!SUBMITTABLE_OBLIGATION_STATUSES.includes(obligation.status)) {
      return fail(409, 'OBLIGATION_NOT_OPEN', `The obligation is ${obligation.status}.`);
    }
    if (CONTRACT_EVIDENCE.some((evidence) => evidence.document.versionId === body.documentVersionId)) {
      return fail(409, 'DOCUMENT_NOT_CONFIRMED', 'That document version is already used as evidence; upload a new version.');
    }
    const persona = requirePersona();
    return {
      obligation: { ...obligationRow(obligation, contract, now), status: 'evidence_submitted', evidenceCount: obligationRow(obligation, contract, now).evidenceCount + 1 },
      evidence: {
        id: NEW_ID,
        submittedBy: { userId: persona.userId, fullName: persona.fullName, capacity: capacityOf(persona.userId, tenant.id) },
        organizationName: tenant.name,
        document: { documentId: NEW_ID, versionId: body.documentVersionId, title: `Evidence for ${obligation.title}`, fileName: null },
        note: body.note ?? null,
        submittedAt: isoInstant(now),
      },
      message: 'Evidence submitted for review.',
    };
  });

  mockRoute(app, api.releaseSecurity, ({ requireTenant, params, fail, notFound, now }) => {
    const contract = findBuyerContract(requireTenant().tenant.id, params.contractId) ?? notFound();
    const security = securitiesOf(contract.id).find((candidate) => candidate.id === params.securityId) ?? notFound();
    if (security.status === 'released') {
      return fail(409, 'SECURITY_ALREADY_RELEASED', 'The security is already released.');
    }
    const approval = approvalById(security.releaseApprovalId);
    if (approval === undefined || !APPROVED.includes(approval.status)) {
      return fail(409, 'SECURITY_RELEASE_NOT_APPROVED', 'Release needs an approved security_release decision; a date alone never releases a security (BR-37).');
    }
    return { ...securityView(security), status: 'released', releasedAt: isoInstant(now) };
  });

  // CON-07
  mockRoute(app, api.performance, ({ requireTenant, params, notFound }) => {
    const contract = findBuyerContract(requireTenant().tenant.id, params.contractId) ?? notFound();
    return contractPerformance(contract);
  });

  mockRoute(app, api.performanceReview, ({ requireTenant, params, notFound }) => {
    const contract = findBuyerContract(requireTenant().tenant.id, params.contractId) ?? notFound();
    const review = reviewsOf(contract.id).find((candidate) => candidate.id === params.reviewId) ?? notFound();
    return reviewDetail(review, contract);
  });

  mockRoute(app, api.createPerformanceReview, ({ requireTenant, params, body, fail, notFound }) => {
    const contract = findBuyerContract(requireTenant().tenant.id, params.contractId) ?? notFound();
    if (contract.effectiveDate === null) {
      return fail(409, 'CONTRACT_NOT_STARTED', 'Performance is reviewed once the contract is effective.');
    }
    if (reviewsOf(contract.id).some((review) => review.periodStart <= body.periodEnd && body.periodStart <= review.periodEnd)) {
      return fail(409, 'REVIEW_PERIOD_OVERLAPS', 'A review already covers part of this period.');
    }
    if (body.results.some((result) => !CONTRACT_MEASURES.some((measure) => measure.id === result.measureId && measure.contractId === contract.id))) {
      return fail(422, 'MEASURE_NOT_FOUND', 'A result names a measure that is not part of this contract.');
    }
    return {
      id: NEW_ID,
      contractId: contract.id,
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
      status: 'draft',
      overallRating: body.overallRating ?? null,
      summary: body.summary,
      supplierResponse: null,
      supplierDisputes: false,
      sharedAt: null,
      respondedAt: null,
      finalizedBy: null,
      finalizedAt: null,
    };
  });

  mockRoute(app, api.sharePerformanceReview, ({ requireTenant, params, fail, notFound, now }) => {
    const contract = findBuyerContract(requireTenant().tenant.id, params.contractId) ?? notFound();
    const review = reviewsOf(contract.id).find((candidate) => candidate.id === params.reviewId) ?? notFound();
    if (review.status !== 'draft') {
      return fail(409, 'REVIEW_NOT_DRAFT', `The review is ${review.status}.`);
    }
    return { ...reviewRow(review), status: 'shared_with_supplier', sharedAt: isoInstant(now) };
  });

  mockRoute(app, api.finalizePerformanceReview, ({ requireTenant, requirePersona, params, body, fail, notFound, now }) => {
    const contract = findBuyerContract(requireTenant().tenant.id, params.contractId) ?? notFound();
    const review = reviewsOf(contract.id).find((candidate) => candidate.id === params.reviewId) ?? notFound();
    if (review.status === 'finalized') {
      return fail(409, 'REVIEW_ALREADY_FINALIZED', 'The review is already finalized.');
    }
    if (review.status === 'draft') {
      return fail(409, 'REVIEW_NOT_SHARED', 'Share the review with the supplier before finalizing it.');
    }
    if (review.status === 'shared_with_supplier') {
      return fail(409, 'SUPPLIER_RESPONSE_PENDING', 'The supplier has not responded yet; ratings are finalized after the response.');
    }
    return {
      ...reviewRow(review),
      status: 'finalized',
      overallRating: body.overallRating,
      finalizedBy: personRef(requirePersona().userId),
      finalizedAt: isoInstant(now),
    };
  });

  mockRoute(app, api.recordIncident, ({ requireTenant, params, body, fail, notFound }) => {
    const { tenant } = requireTenant();
    const contract = findBuyerContract(tenant.id, params.contractId) ?? notFound();
    if (contract.effectiveDate === null) {
      return fail(409, 'CONTRACT_NOT_STARTED', 'Incidents are recorded once the contract is effective.');
    }
    if (body.ownerUserId !== undefined && !isEligibleManager(tenant.id, body.ownerUserId)) {
      return fail(422, 'ASSIGNEE_NOT_ELIGIBLE', 'The owner must manage or prepare contracts.');
    }
    return {
      id: NEW_ID,
      incidentType: body.incidentType,
      severity: body.severity,
      description: body.description,
      occurredAt: body.occurredAt,
      status: body.correctiveAction === undefined ? 'open' : 'corrective_action',
      correctiveAction: body.correctiveAction ?? null,
      owner: personOrNull(body.ownerUserId ?? null),
    };
  });

  mockRoute(app, api.createImprovementAction, ({ requireTenant, params, body, fail, notFound }) => {
    const contract = findBuyerContract(requireTenant().tenant.id, params.contractId) ?? notFound();
    if (contract.status === 'closed') {
      return fail(409, 'CONTRACT_CLOSED', 'The contract is closed.');
    }
    if (body.reviewId !== undefined && !reviewsOf(contract.id).some((review) => review.id === body.reviewId)) {
      return fail(422, 'REVIEW_NOT_FOUND', 'The review is not part of this contract.');
    }
    return {
      id: NEW_ID,
      reviewId: body.reviewId ?? null,
      action: body.action,
      owner: body.owner,
      dueAt: deadline(body.dueAt ?? null, timeZoneOf(contract)),
      status: 'open',
    };
  });

  mockRoute(app, api.updateImprovementAction, ({ requireTenant, params, body, fail, notFound }) => {
    const contract = findBuyerContract(requireTenant().tenant.id, params.contractId) ?? notFound();
    const action =
      CONTRACT_IMPROVEMENT_ACTIONS.find((candidate) => candidate.id === params.actionId && candidate.contractId === contract.id) ?? notFound();
    if (action.status === 'done' || action.status === 'cancelled') {
      return fail(409, 'ACTION_CLOSED', `The action is ${action.status}.`);
    }
    return {
      id: action.id,
      reviewId: action.reviewId,
      action: action.action,
      owner: action.owner,
      dueAt: deadline(action.dueAt, timeZoneOf(contract)),
      status: body.status,
    };
  });
}

function registerBuyerCommercial(app: MockApp): void {
  // CON-08
  mockRoute(app, api.financials, ({ requireTenant, params, notFound, now }) => {
    const contract = findBuyerContract(requireTenant().tenant.id, params.contractId) ?? notFound();
    return contractFinancials(contract, now);
  });

  mockRoute(app, api.recordInvoice, ({ requireTenant, params, body, fail, notFound, now }) => {
    const contract = findBuyerContract(requireTenant().tenant.id, params.contractId) ?? notFound();
    if (body.amount.currency !== contract.value.currency) {
      return fail(422, 'CURRENCY_MISMATCH', 'Use the contract currency.');
    }
    const invoices = invoicesOf(contract.id);
    if (invoices.some((invoice) => invoice.invoiceRef.toLowerCase() === body.invoiceRef.toLowerCase())) {
      return fail(409, 'INVOICE_DUPLICATE_REFERENCE', 'An invoice with this reference is already recorded.');
    }
    const obligation = body.obligationId === undefined ? undefined : obligationOf(contract, body.obligationId);
    if (body.obligationId !== undefined && obligation === undefined) {
      return fail(422, 'OBLIGATION_NOT_FOUND', 'The milestone is not part of this contract.');
    }
    const cap = contract.ceiling ?? currentValue(contract);
    const invoiced = sum(invoices.map((invoice) => invoice.amount.amount));
    if (gt(add(invoiced, body.amount.amount), cap.amount)) {
      return fail(422, 'INVOICE_EXCEEDS_REMAINING_CEILING', `Invoices would exceed the ceiling of ${formatMoney(cap.amount, cap.currency)}.`);
    }
    return {
      id: NEW_ID,
      invoiceRef: body.invoiceRef,
      obligation: obligation === undefined ? null : { obligationId: obligation.id, title: obligation.title, status: obligation.status },
      amount: body.amount,
      invoiceDate: body.invoiceDate,
      acceptanceStatus: obligation?.status === 'accepted' ? 'accepted' : 'not_accepted',
      paymentStatus: 'invoiced',
      source: 'local_entry',
      asOf: isoInstant(now),
      disputeReason: null,
    };
  });

  mockRoute(app, api.disputeInvoice, ({ requireTenant, params, body, fail, notFound }) => {
    const contract = findBuyerContract(requireTenant().tenant.id, params.contractId) ?? notFound();
    const invoice = invoicesOf(contract.id).find((candidate) => candidate.id === params.invoiceId) ?? notFound();
    if (invoice.paymentStatus === 'paid') {
      return fail(409, 'INVOICE_ALREADY_PAID', 'A paid invoice is reconciled through a claim, not disputed.');
    }
    if (invoice.paymentStatus === 'disputed') {
      return fail(409, 'INVOICE_ALREADY_DISPUTED', 'The invoice is already disputed.');
    }
    return { ...invoiceView(invoice), acceptanceStatus: 'disputed', paymentStatus: 'disputed', disputeReason: body.reason };
  });

  // CON-09
  mockRoute(app, api.changes, ({ requireTenant, params, query, notFound }) => {
    const contract = findBuyerContract(requireTenant().tenant.id, params.contractId) ?? notFound();
    const all = changesOf(contract.id);
    const currency = contract.value.currency;
    const approved = sum(all.filter((change) => ['agreed', 'incorporated'].includes(change.status) && change.costImpact !== null).map((change) => (change.costImpact as Money).amount));
    const pending = pendingChangesTotal(contract);
    const pendingChange = all.find((change) => change.status === 'approval_pending');
    return {
      contractId: contract.id,
      reference: contract.reference,
      originalValue: contract.value,
      currentValue: currentValue(contract),
      ceiling: contract.ceiling,
      approvedChanges: money(approved, currency),
      pendingChanges: pending,
      cumulativeExposure: money(add(add(contract.value.amount, approved), pending.amount), currency),
      items: all
        .filter((change) => query.status === undefined || query.status.includes(change.status))
        .filter((change) => query.raisedByParty === undefined || change.raisedByParty === query.raisedByParty)
        .sort((a, b) => a.number - b.number)
        .map(changeRow),
      pendingAuthority: pendingChange === undefined ? null : changeAuthority(pendingChange, contract, null),
    };
  });

  mockRoute(app, api.changeRequest, ({ requireTenant, params, notFound }) => {
    const contract = findBuyerContract(requireTenant().tenant.id, params.contractId) ?? notFound();
    const change = changesOf(contract.id).find((candidate) => candidate.id === params.changeId) ?? notFound();
    return changeDetail(change, contract, null);
  });

  mockRoute(app, api.createChange, ({ requireTenant, requirePersona, params, body, fail, notFound, now }) => {
    const contract = findBuyerContract(requireTenant().tenant.id, params.contractId) ?? notFound();
    if (contract.status !== 'active' && contract.status !== 'suspended') {
      return fail(409, 'CONTRACT_NOT_ACTIVE', `Changes are raised on active contracts; this one is ${contract.status}.`);
    }
    if (body.costImpact !== undefined && body.costImpact.currency !== contract.value.currency) {
      return fail(422, 'CURRENCY_MISMATCH', 'Use the contract currency.');
    }
    const number = Math.max(0, ...changesOf(contract.id).map((change) => change.number)) + 1;
    const draft: FixtureChange = {
      id: NEW_ID,
      contractId: contract.id,
      number,
      title: body.title,
      reason: body.reason,
      scopeChange: body.scopeChange ?? null,
      costImpact: body.costImpact ?? null,
      scheduleImpactDays: body.scheduleImpactDays ?? null,
      fundingNote: body.fundingNote ?? null,
      cumulativeValueAfter: null,
      raisedByParty: 'buyer',
      raisedByUserId: requirePersona().userId,
      status: body.submit ? 'submitted' : 'draft',
      supplierAgreedAt: null,
      approvalRequestId: null,
      affectsProcurementBasis: false,
      impactAssessment: null,
      createdAt: isoInstant(now),
    };
    return {
      ...changeRow(draft),
      cumulativeValueAfter: body.costImpact === undefined ? null : cumulativeAfter(contract, draft, body.costImpact),
    };
  });

  mockRoute(app, api.assessChange, ({ requireTenant, params, body, fail, notFound }) => {
    const contract = findBuyerContract(requireTenant().tenant.id, params.contractId) ?? notFound();
    const change = changesOf(contract.id).find((candidate) => candidate.id === params.changeId) ?? notFound();
    if (change.status !== 'submitted' && change.status !== 'impact_assessment') {
      return fail(409, 'CHANGE_NOT_ASSESSABLE', `The change request is ${change.status}.`);
    }
    if (body.costImpact.currency !== contract.value.currency) {
      return fail(422, 'CURRENCY_MISMATCH', 'Use the contract currency.');
    }
    const assessed: FixtureChange = {
      ...change,
      status: 'impact_assessment',
      scopeChange: body.scopeChange,
      costImpact: body.costImpact,
      scheduleImpactDays: body.scheduleImpactDays,
      fundingNote: body.fundingNote,
      impactAssessment: body.impactAssessment,
      affectsProcurementBasis: body.affectsProcurementBasis,
      cumulativeValueAfter: cumulativeAfter(contract, change, body.costImpact),
    };
    return changeDetail(assessed, contract, null);
  });

  mockRoute(app, api.requestChangeApproval, ({ requireTenant, requirePersona, params, fail, notFound, now }) => {
    const contract = findBuyerContract(requireTenant().tenant.id, params.contractId) ?? notFound();
    const change = changesOf(contract.id).find((candidate) => candidate.id === params.changeId) ?? notFound();
    if (change.status !== 'impact_assessment') {
      return fail(409, 'CHANGE_NOT_ASSESSED', 'Complete the impact assessment before requesting approval.');
    }
    if (change.fundingNote === null || change.costImpact === null) {
      return fail(422, 'FUNDING_REVIEW_REQUIRED', 'Record the cost impact and funding before approval (BR-36).');
    }
    const detail = changeDetail(change, contract, null);
    const approver = detail.authority?.requiredApprover ?? null;
    const result: ChangeRequestDetail = {
      ...detail,
      status: 'approval_pending',
      approval: newApproval(
        'contract_change',
        `${contract.reference} ${detail.displayNumber}: ${change.title}`,
        change.cumulativeValueAfter,
        personRef(requirePersona().userId),
        approver,
        isoInstant(now),
      ),
    };
    return result;
  });

  mockRoute(app, api.decideChange, ({ requireTenant, requirePersona, params, body, fail, notFound, now }) => {
    const contract = findBuyerContract(requireTenant().tenant.id, params.contractId) ?? notFound();
    const change = changesOf(contract.id).find((candidate) => candidate.id === params.changeId) ?? notFound();
    if (change.status !== 'approval_pending') {
      return fail(409, 'CHANGE_NOT_PENDING_APPROVAL', `The change request is ${change.status}.`);
    }
    const persona = requirePersona();
    const approval = approvalById(change.approvalRequestId);
    if (approval !== undefined && approval.requestedByUserId === persona.userId) {
      return fail(403, 'SELF_APPROVAL_BLOCKED', 'You requested this approval and cannot decide it (BR-07).');
    }
    const detail = changeDetail(change, contract, persona.userId);
    if (body.decision === 'approve' && detail.authority !== null && !detail.authority.sufficient) {
      return fail(403, 'CUMULATIVE_AUTHORITY_EXCEEDED', detail.authority.explanation);
    }
    const status = body.decision === 'approve' ? (change.supplierAgreedAt === null ? 'approval_pending' : 'agreed') : body.decision === 'reject' ? 'rejected' : 'impact_assessment';
    const decided = approvalRef(change.approvalRequestId);
    return {
      ...detail,
      status,
      approval:
        decided === null
          ? null
          : {
              ...decided,
              status: body.decision === 'approve' ? 'approved' : body.decision === 'reject' ? 'rejected' : 'returned',
              currentApprover: null,
              decidedAt: isoInstant(now),
            },
    };
  });

  mockRoute(app, api.withdrawChange, ({ requireTenant, params, fail, notFound }) => {
    const contract = findBuyerContract(requireTenant().tenant.id, params.contractId) ?? notFound();
    const change = changesOf(contract.id).find((candidate) => candidate.id === params.changeId) ?? notFound();
    if (!WITHDRAWABLE_CHANGE_STATUSES.includes(change.status)) {
      return fail(409, 'CHANGE_NOT_WITHDRAWABLE', `The change request is ${change.status}.`);
    }
    return { ...changeRow(change), status: 'withdrawn' };
  });

  mockRoute(app, api.incorporateChange, ({ requireTenant, params, fail, notFound }) => {
    const contract = findBuyerContract(requireTenant().tenant.id, params.contractId) ?? notFound();
    const change = changesOf(contract.id).find((candidate) => candidate.id === params.changeId) ?? notFound();
    if (change.status !== 'agreed') {
      return fail(409, 'CHANGE_NOT_AGREED', `The change request is ${change.status}.`);
    }
    if (change.supplierAgreedAt === null) {
      return fail(409, 'SUPPLIER_AGREEMENT_PENDING', 'The supplier has not agreed to the change.');
    }
    return { ...changeRow(change), status: 'incorporated' };
  });

  mockRoute(app, api.disputes, ({ requireTenant, params, query, notFound }) => {
    const contract = findBuyerContract(requireTenant().tenant.id, params.contractId) ?? notFound();
    return {
      contractId: contract.id,
      reference: contract.reference,
      items: disputesOf(contract.id)
        .filter((dispute) => query.status === undefined || query.status.includes(dispute.status))
        .filter((dispute) => query.disputeType === undefined || query.disputeType.includes(dispute.disputeType))
        .map(disputeView),
      remedyRule: 'Remedies, credits, penalties and settlements apply only under the agreed terms and an authorized decision; a missed measure never authorizes a deduction by itself.',
    };
  });

  mockRoute(app, api.recordDispute, ({ requireTenant, requirePersona, params, body, fail, notFound, now }) => {
    const { tenant } = requireTenant();
    const contract = findBuyerContract(tenant.id, params.contractId) ?? notFound();
    if (contract.effectiveDate === null) {
      return fail(409, 'CONTRACT_NOT_STARTED', 'Disputes are recorded once the contract is effective.');
    }
    const persona = requirePersona();
    return {
      id: NEW_ID,
      contractId: contract.id,
      disputeType: body.disputeType,
      amount: body.amount ?? null,
      description: body.description,
      contractBasis: body.contractBasis ?? null,
      status: 'open',
      raisedBy: { userId: persona.userId, fullName: persona.fullName, capacity: capacityOf(persona.userId, tenant.id) },
      raisedByOrganization: tenant.name,
      raisedAt: isoInstant(now),
      authorizedDecision: null,
      resolutionNote: null,
    };
  });

  mockRoute(app, api.updateDispute, ({ requireTenant, params, body, fail, notFound }) => {
    const contract = findBuyerContract(requireTenant().tenant.id, params.contractId) ?? notFound();
    const dispute = disputesOf(contract.id).find((candidate) => candidate.id === params.disputeId) ?? notFound();
    if (dispute.status === 'resolved' || dispute.status === 'withdrawn') {
      return fail(409, 'DISPUTE_CLOSED', `The dispute is ${dispute.status}.`);
    }
    const decision = approvalById(dispute.authorizedDecisionId);
    if (body.status === 'resolved' && REMEDY_TYPES.includes(dispute.disputeType) && (decision === undefined || !APPROVED.includes(decision.status))) {
      return fail(409, 'DECISION_NOT_AUTHORIZED', 'Resolving a remedy, credit, penalty or settlement needs an approved dispute decision.');
    }
    return { ...disputeView(dispute), status: body.status, resolutionNote: body.note };
  });

  // CON-10
  mockRoute(app, api.renewals, ({ requireTenant, params, notFound, now }) => {
    const contract = findBuyerContract(requireTenant().tenant.id, params.contractId) ?? notFound();
    return contractRenewals(contract, now);
  });

  mockRoute(app, api.decideRenewal, ({ requireTenant, requirePersona, params, body, fail, notFound, now }) => {
    const contract = findBuyerContract(requireTenant().tenant.id, params.contractId) ?? notFound();
    const option = renewalOptionsOf(contract.id).find((candidate) => candidate.id === params.optionId) ?? notFound();
    if (!isOptionUndecided(option)) {
      return fail(409, 'RENEWAL_ALREADY_DECIDED', 'This option already has a decision.');
    }
    if (option.noticeDeadline !== null && Date.parse(option.noticeDeadline) < now.getTime()) {
      return fail(409, 'RENEWAL_DEADLINE_PASSED', 'The notice deadline has passed; the option can no longer be exercised.');
    }
    const fits =
      option.optionType === 'renewal'
        ? body.decision !== 'extend'
        : option.optionType === 'extension'
          ? body.decision !== 'renew'
          : body.decision === 'terminate' || body.decision === 'let_expire';
    if (!fits) {
      return fail(422, 'RENEWAL_OPTION_NOT_APPLICABLE', `A ${option.optionType.replace('_', ' ')} option cannot be decided as "${body.decision}".`);
    }
    const exercise = body.decision === 'renew' || body.decision === 'extend';
    const approver = changeApprovers(contract.tenantId).find((candidate) => candidate.limit === null || gt(candidate.limit.amount, currentValue(contract).amount)) ?? null;
    const persona = requirePersona();
    const view = renewalOptionView(option, contract, now);
    return {
      option: {
        ...view,
        status: 'under_review',
        decision: body.decision,
        justification: body.justification,
        performanceBasis: body.performanceBasis,
        fundingConfirmed: body.fundingConfirmed,
        approval: newApproval(
          'renewal',
          `${contract.reference}: ${body.decision.replace('_', ' ')} (${option.optionType.replace('_', ' ')} option)`,
          exercise ? currentValue(contract) : null,
          personRef(persona.userId),
          approver === null ? null : { userId: approver.userId, fullName: approver.fullName },
          isoInstant(now),
        ),
        decidedBy: personRef(persona.userId),
        decidedAt: isoInstant(now),
      },
      approvalRequired: true,
      supplierConsentRequired: exercise,
      message: exercise
        ? 'Decision recorded and sent for renewal approval. Nothing renews until it is approved and the supplier consents; no automatic renewal (BR-37).'
        : 'Decision recorded and sent for approval. The supplier is notified only after approval.',
    };
  });

  mockRoute(app, api.notifyRenewal, ({ requireTenant, params, fail, notFound, now }) => {
    const contract = findBuyerContract(requireTenant().tenant.id, params.contractId) ?? notFound();
    const option = renewalOptionsOf(contract.id).find((candidate) => candidate.id === params.optionId) ?? notFound();
    const approval = approvalById(option.approvalRequestId);
    if (option.decision === null || approval === undefined || !APPROVED.includes(approval.status)) {
      return fail(409, 'RENEWAL_NOT_APPROVED', 'Notify the supplier only after the decision is approved.');
    }
    return {
      optionId: option.id,
      noticeType: 'contract_notice',
      notifiedAt: isoInstant(now),
      message: `${tenantName(contract.supplierTenantId)} is notified of the decision by formal notice.`,
    };
  });

  // CON-11
  mockRoute(app, api.closeout, ({ requireTenant, params, notFound, now }) => {
    const contract = findBuyerContract(requireTenant().tenant.id, params.contractId) ?? notFound();
    return contractCloseout(contract, now);
  });

  mockRoute(app, api.saveCloseout, ({ requireTenant, params, fail, notFound }) => {
    const contract = findBuyerContract(requireTenant().tenant.id, params.contractId) ?? notFound();
    const closeout = closeoutOf(contract.id);
    if (closeout?.status === 'closed' || contract.status === 'closed') {
      return fail(409, 'CLOSEOUT_ALREADY_CLOSED', 'The contract is already closed.');
    }
    if (!CLOSABLE_STATUSES.includes(contract.status)) {
      return fail(409, 'CONTRACT_NOT_CLOSABLE', `Closeout starts when the contract has expired or been terminated; it is ${contract.status}.`);
    }
    return {
      contractId: contract.id,
      closeoutId: closeout?.id ?? NEW_ID,
      status: 'in_progress',
      message: 'Closeout details saved.',
    };
  });

  mockRoute(app, api.closeContract, ({ requireTenant, params, fail, notFound, now }) => {
    const contract = findBuyerContract(requireTenant().tenant.id, params.contractId) ?? notFound();
    if (contract.status === 'closed' || closeoutOf(contract.id)?.status === 'closed') {
      return fail(409, 'CLOSEOUT_ALREADY_CLOSED', 'The contract is already closed.');
    }
    if (!CLOSABLE_STATUSES.includes(contract.status)) {
      return fail(409, 'CONTRACT_NOT_CLOSABLE', `The contract is ${contract.status}.`);
    }
    const blocking = closeoutChecks(contract).filter((check) => check.state === 'blocking');
    if (blocking.length > 0) {
      return fail(409, 'CLOSEOUT_BLOCKED', `Resolve before closing: ${blocking.map((check) => check.label).join('; ')}.`);
    }
    const surviving = obligationsOf(contract.id).filter((obligation) => obligation.survivesCloseout).length;
    return {
      contractId: contract.id,
      status: 'closed',
      closedAt: isoInstant(now),
      survivingObligations: surviving,
      message: `${contract.reference} is closed. ${surviving} surviving obligations stay tracked.`,
    };
  });
}

function registerSupplier(app: MockApp): void {
  mockRoute(app, api.supplierList, ({ requireTenant, requirePersona, query, fixtures, now }) => {
    const { tenant } = requireTenant();
    const userId = requirePersona().userId;
    const rows = supplierContracts(tenant.id)
      .filter((contract) => query.status === undefined || query.status.includes(contract.status))
      .filter((contract) => query.buyerTenantId === undefined || contract.tenantId === query.buyerTenantId)
      .filter((contract) => matchesText(query.q, contract.reference, contract.title, tenantName(contract.tenantId)))
      .map((contract) => supplierContractRow(contract, userId, now))
      .filter(
        (row) =>
          query.actionRequired === undefined ||
          (row.mySignatureStatus === 'pending' || row.overdueObligations > 0 || row.pendingChangeRequests > 0) === query.actionRequired,
      );
    const sorted =
      query.sort === 'title'
        ? sortBy(rows, (row) => row.title.toLowerCase(), query.dir)
        : query.sort === 'status'
          ? sortBy(rows, (row) => row.status, query.dir)
          : query.sort === 'termEnd'
            ? sortBy(rows, (row) => row.termEnd, query.dir)
            : sortBy(rows, (row) => row.reference, query.sort === undefined ? 'desc' : query.dir);
    return fixtures.page(sorted);
  });

  mockRoute(app, api.supplierGet, ({ requireTenant, requirePersona, params, notFound, now }) => {
    const contract = findSupplierContract(requireTenant().tenant.id, params.contractId) ?? notFound();
    return supplierContractDetail(contract, requirePersona().userId, now);
  });

  mockRoute(app, api.supplierObligation, ({ requireTenant, params, notFound, now }) => {
    const contract = findSupplierContract(requireTenant().tenant.id, params.contractId) ?? notFound();
    const obligation = obligationOf(contract, params.obligationId) ?? notFound();
    return supplierObligationDetail(obligation, contract, now);
  });

  mockRoute(app, api.supplierSign, ({ requireTenant, requirePersona, params, fail, notFound, now }) => {
    const contract = findSupplierContract(requireTenant().tenant.id, params.contractId) ?? notFound();
    const signatory = signatoriesOf(contract.id).find((candidate) => candidate.id === params.signatoryId) ?? notFound();
    const userId = requirePersona().userId;
    if (contract.status !== 'awaiting_signature') {
      return fail(409, 'CONTRACT_NOT_AWAITING_SIGNATURE', `The contract is ${contract.status}.`);
    }
    if (signatory.party !== 'supplier' || signatory.userId !== userId) {
      return fail(403, 'NOT_YOUR_SIGNATURE', 'Only the named signatory can sign.');
    }
    if (differenceBlocks(contract)) {
      return fail(409, 'DIFFERENCE_NOT_APPROVED', 'The buyer is still approving changes to the agreed terms; signing opens once they are approved.');
    }
    if (signatory.status !== 'pending') {
      return fail(409, 'SIGNATURE_ALREADY_RECORDED', 'Your signature is already recorded.');
    }
    const allSigned = allSignedExcept(contract, signatory.id);
    return {
      signatory: { ...supplierSignatoryView(signatory, contract, userId), status: 'signed', method: 'in_app', signedAt: isoInstant(now) },
      contractId: contract.id,
      contractStatus: allSigned ? 'signed_not_effective' : 'awaiting_signature',
      allSigned,
      message: allSigned ? 'All parties have signed.' : 'Your signature is recorded; the buyer still has to sign.',
    };
  });

  mockRoute(app, api.supplierRefuseSignature, ({ requireTenant, requirePersona, params, fail, notFound }) => {
    const contract = findSupplierContract(requireTenant().tenant.id, params.contractId) ?? notFound();
    const signatory = signatoriesOf(contract.id).find((candidate) => candidate.id === params.signatoryId) ?? notFound();
    const userId = requirePersona().userId;
    if (contract.status !== 'awaiting_signature') {
      return fail(409, 'CONTRACT_NOT_AWAITING_SIGNATURE', `The contract is ${contract.status}.`);
    }
    if (signatory.party !== 'supplier' || signatory.userId !== userId) {
      return fail(403, 'NOT_YOUR_SIGNATURE', 'Only the named signatory can refuse.');
    }
    if (signatory.status !== 'pending') {
      return fail(409, 'SIGNATURE_ALREADY_RECORDED', 'Your signature decision is already recorded.');
    }
    return {
      signatory: { ...supplierSignatoryView(signatory, contract, userId), status: 'refused' },
      contractId: contract.id,
      contractStatus: 'awaiting_signature',
      allSigned: false,
      message: 'Refusal recorded with your reason. The contract stays unsigned until the buyer resolves it.',
    };
  });

  mockRoute(app, api.supplierSubmitEvidence, ({ requireTenant, requirePersona, params, body, fail, notFound, now }) => {
    const { tenant } = requireTenant();
    const contract = findSupplierContract(tenant.id, params.contractId) ?? notFound();
    const obligation = obligationOf(contract, params.obligationId) ?? notFound();
    if (obligation.party !== 'supplier') {
      return fail(409, 'OBLIGATION_WRONG_PARTY', 'This is a buyer obligation.');
    }
    if (!SUBMITTABLE_OBLIGATION_STATUSES.includes(obligation.status) || !isObligationOpen(obligation)) {
      return fail(409, 'OBLIGATION_NOT_OPEN', `The obligation is ${obligation.status}; evidence cannot be submitted now.`);
    }
    if (CONTRACT_EVIDENCE.some((evidence) => evidence.document.versionId === body.documentVersionId)) {
      return fail(409, 'DOCUMENT_NOT_CONFIRMED', 'That document version is already used as evidence; upload a new version.');
    }
    const persona = requirePersona();
    return {
      obligation: { ...supplierObligationRow(obligation, contract, now), status: 'evidence_submitted', isOverdue: false },
      evidence: {
        id: NEW_ID,
        submittedBy: { userId: persona.userId, fullName: persona.fullName, capacity: capacityOf(persona.userId, tenant.id) },
        organizationName: tenant.name,
        document: { documentId: NEW_ID, versionId: body.documentVersionId, title: `Evidence for ${obligation.title}`, fileName: null },
        note: body.note ?? null,
        submittedAt: isoInstant(now),
      },
      message: `Evidence submitted to ${tenantName(contract.tenantId)} for review. Acceptance and payment are decided separately.`,
    };
  });

  mockRoute(app, api.supplierRespondReview, ({ requireTenant, params, body, fail, notFound, now }) => {
    const contract = findSupplierContract(requireTenant().tenant.id, params.contractId) ?? notFound();
    const review = reviewsOf(contract.id).find((candidate) => candidate.id === params.reviewId && candidate.status !== 'draft') ?? notFound();
    if (review.status === 'finalized') {
      return fail(409, 'REVIEW_ALREADY_FINALIZED', 'The review is finalized.');
    }
    if (review.status !== 'shared_with_supplier' && review.status !== 'supplier_responded') {
      return fail(409, 'REVIEW_NOT_SHARED', 'The review is not open for a response.');
    }
    return {
      ...supplierReviewView(review),
      status: 'supplier_responded',
      supplierResponse: body.response,
      supplierDisputes: body.disputes,
      respondedAt: isoInstant(now),
    };
  });

  mockRoute(app, api.supplierRequestChange, ({ requireTenant, params, body, fail, notFound, now }) => {
    const contract = findSupplierContract(requireTenant().tenant.id, params.contractId) ?? notFound();
    if (contract.status !== 'active') {
      return fail(409, 'CONTRACT_NOT_ACTIVE', `Changes are requested on active contracts; this one is ${contract.status}.`);
    }
    if (body.costImpact !== undefined && body.costImpact.currency !== contract.value.currency) {
      return fail(422, 'CURRENCY_MISMATCH', 'Use the contract currency.');
    }
    const number = Math.max(0, ...changesOf(contract.id).map((change) => change.number)) + 1;
    return {
      id: NEW_ID,
      number,
      displayNumber: `CR-${String(number).padStart(4, '0')}`,
      title: body.title,
      reason: body.reason,
      raisedByParty: 'supplier',
      status: body.submit ? 'submitted' : 'draft',
      costImpact: body.costImpact ?? null,
      scheduleImpactDays: body.scheduleImpactDays ?? null,
      supplierAgreedAt: body.submit ? isoInstant(now) : null,
      createdAt: isoInstant(now),
    };
  });

  mockRoute(app, api.supplierAgreeChange, ({ requireTenant, params, fail, notFound, now }) => {
    const contract = findSupplierContract(requireTenant().tenant.id, params.contractId) ?? notFound();
    const change =
      changesOf(contract.id).find((candidate) => candidate.id === params.changeId && (candidate.status !== 'draft' || candidate.raisedByParty === 'supplier')) ??
      notFound();
    if (change.supplierAgreedAt !== null) {
      return fail(409, 'SUPPLIER_ALREADY_AGREED', 'Your agreement is already recorded.');
    }
    if (!AGREEABLE_CHANGE_STATUSES.includes(change.status)) {
      return fail(409, 'CHANGE_NOT_AGREEABLE', `The change request is ${change.status}.`);
    }
    return { ...supplierChangeRow(change), supplierAgreedAt: isoInstant(now) };
  });

  mockRoute(app, api.supplierRaiseDispute, ({ requireTenant, requirePersona, params, body, fail, notFound, now }) => {
    const { tenant } = requireTenant();
    const contract = findSupplierContract(tenant.id, params.contractId) ?? notFound();
    if (contract.effectiveDate === null) {
      return fail(409, 'CONTRACT_NOT_STARTED', 'Disputes and claims are raised once the contract is effective.');
    }
    const persona = requirePersona();
    return {
      id: NEW_ID,
      contractId: contract.id,
      disputeType: body.disputeType,
      amount: body.amount ?? null,
      description: body.description,
      contractBasis: body.contractBasis ?? null,
      status: 'open',
      raisedBy: { userId: persona.userId, fullName: persona.fullName, capacity: capacityOf(persona.userId, tenant.id) },
      raisedByOrganization: tenant.name,
      raisedAt: isoInstant(now),
      resolutionNote: null,
    };
  });
}

