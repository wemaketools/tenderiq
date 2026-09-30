/**
 * The contracts fixtures parse against the contract schemas and are internally consistent with the demo storyline
 * (BR-33 allocations, AC-28 … AC-32 anchors, persona and tenant references).
 */
import { describe, expect, it } from 'vitest';

import {
  AwardDifference,
  ChangeRequestRow,
  ContractAgreedDocument,
  ContractCloseout,
  ContractContact,
  ContractDetail,
  ContractDocumentRef,
  ContractException,
  ContractFinancials,
  ContractPerformance,
  ContractPreparation,
  ContractRenewals,
  ContractRow,
  ContractSignature,
  ContractTenderRef,
  ObligationDetail,
  SupplierContractDetail,
} from '../../../contracts/contracts.js';
import { add, gt, sum } from '../../../contracts/decimal.js';
import {
  allocationsOf,
  contractCloseout,
  contractDetail,
  contractFinancials,
  contractPerformance,
  contractPreparation,
  contractRenewals,
  contractRow,
  contractSignature,
  currentValue,
  obligationDetail,
  supplierContractDetail,
} from '../../handlers/contracts/build.js';
import { APPROVALS } from '../approvals.js';
import { AWARD_TENDERS } from '../awards/base.js';
import { PERSONAS, TENANTS, TENANT_IDS } from '../platform.js';
import {
  CONTRACTS,
  CONTRACT_ACCEPTANCE_DECISIONS,
  CONTRACT_ALLOCATIONS,
  CONTRACT_APPROVALS,
  CONTRACT_CHANGES,
  CONTRACT_DISPUTES,
  CONTRACT_EVIDENCE,
  CONTRACT_HANDOVERS,
  CONTRACT_INVOICES,
  CONTRACT_LOT_OUTCOMES,
  CONTRACT_OBLIGATIONS,
  CONTRACT_RENEWAL_OPTIONS,
  CONTRACT_SIGNATORIES,
} from './index.js';

const NOW = new Date('2026-09-30T08:00:00Z');
const userIds = new Set(PERSONAS.map((persona) => persona.userId));
const tenantIds = new Set(TENANTS.map((tenant) => tenant.id));

function byReference(reference: string) {
  const contract = CONTRACTS.find((candidate) => candidate.reference === reference);
  if (contract === undefined) {
    throw new Error(`Missing ${reference}`);
  }
  return contract;
}

describe('contracts fixtures parse against the contract schemas', () => {
  it('parses every stored sub-shape', () => {
    for (const contract of CONTRACTS) {
      contract.contacts.forEach((contact) => ContractContact.parse(contact));
      contract.agreedDocuments.forEach((document) => ContractAgreedDocument.parse(document));
      contract.exceptions.forEach((exception) => ContractException.parse(exception));
      contract.differences.forEach((difference) => AwardDifference.parse(difference));
      if (contract.tender !== null) {
        ContractTenderRef.parse(contract.tender);
      }
      for (const document of [contract.signedDocument, contract.issuedVersion]) {
        if (document !== null) {
          ContractDocumentRef.parse(document);
        }
      }
    }
    CONTRACT_EVIDENCE.forEach((evidence) => ContractDocumentRef.parse(evidence.document));
  });

  it('projects every contract into contract-valid buyer responses', () => {
    for (const contract of CONTRACTS) {
      ContractRow.parse(contractRow(contract, NOW));
      ContractDetail.parse(contractDetail(contract, NOW));
      ContractPreparation.parse(contractPreparation(contract));
      ContractSignature.parse(contractSignature(contract));
      ContractPerformance.parse(contractPerformance(contract));
      ContractFinancials.parse(contractFinancials(contract, NOW));
      ContractRenewals.parse(contractRenewals(contract, NOW));
      ContractCloseout.parse(contractCloseout(contract, NOW));
    }
    for (const obligation of CONTRACT_OBLIGATIONS) {
      const contract = CONTRACTS.find((candidate) => candidate.id === obligation.contractId);
      expect(contract, `obligation ${obligation.id}`).toBeDefined();
      if (contract !== undefined) {
        ObligationDetail.parse(obligationDetail(obligation, contract, NOW));
      }
    }
    CONTRACT_CHANGES.forEach((change) =>
      ChangeRequestRow.shape.displayNumber.parse(`CR-${String(change.number).padStart(4, '0')}`),
    );
  });

  it('projects every supplier-visible contract into a contract-valid supplier response', () => {
    for (const contract of CONTRACTS.filter((candidate) => !['draft', 'under_review'].includes(candidate.status))) {
      SupplierContractDetail.parse(supplierContractDetail(contract, 27, NOW));
    }
  });
});

describe('contracts fixtures are internally consistent', () => {
  it('references known tenants, personas and contracts', () => {
    for (const contract of CONTRACTS) {
      expect(tenantIds.has(contract.tenantId)).toBe(true);
      expect(tenantIds.has(contract.supplierTenantId)).toBe(true);
      for (const userId of [contract.ownerUserId, contract.contractManagerUserId]) {
        expect(userId === null || userIds.has(userId)).toBe(true);
      }
    }
    const contractIds = new Set(CONTRACTS.map((contract) => contract.id));
    for (const row of [...CONTRACT_OBLIGATIONS, ...CONTRACT_SIGNATORIES, ...CONTRACT_HANDOVERS, ...CONTRACT_INVOICES, ...CONTRACT_CHANGES, ...CONTRACT_DISPUTES, ...CONTRACT_RENEWAL_OPTIONS]) {
      expect(contractIds.has(row.contractId)).toBe(true);
    }
    for (const signatory of CONTRACT_SIGNATORIES) {
      expect(signatory.userId === null || userIds.has(signatory.userId)).toBe(true);
    }
    for (const decision of CONTRACT_ACCEPTANCE_DECISIONS) {
      expect(userIds.has(decision.decidedByUserId)).toBe(true);
    }
    for (const approval of CONTRACT_APPROVALS) {
      expect(userIds.has(approval.requestedByUserId)).toBe(true);
    }
  });

  it('keeps contract references unique per buyer tenant', () => {
    const keys = CONTRACTS.map((contract) => `${contract.tenantId}:${contract.reference}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('never allocates more than a lot outcome’s awarded value (BR-33)', () => {
    for (const outcome of CONTRACT_LOT_OUTCOMES) {
      const allocated = sum(CONTRACT_ALLOCATIONS.filter((allocation) => allocation.lotOutcomeId === outcome.id).map((allocation) => allocation.allocatedValue.amount));
      expect(gt(allocated, outcome.awardedValue?.amount ?? '0')).toBe(false);
    }
    const lot1 = CONTRACT_LOT_OUTCOMES.find((outcome) => outcome.id === 14011);
    const allocated = sum(CONTRACT_ALLOCATIONS.filter((allocation) => allocation.lotOutcomeId === 14011).map((allocation) => allocation.allocatedValue.amount));
    expect(add(allocated, '60000.00')).toBe(lot1?.awardedValue?.amount);
  });

  it('allocates contracts only to final-awarded outcomes of their own supplier and tender', () => {
    for (const allocation of CONTRACT_ALLOCATIONS) {
      const outcome = CONTRACT_LOT_OUTCOMES.find((candidate) => candidate.id === allocation.lotOutcomeId);
      const contract = CONTRACTS.find((candidate) => candidate.id === allocation.contractId);
      expect(outcome?.status).toBe('final_awarded');
      expect(outcome?.supplierTenantId).toBe(contract?.supplierTenantId);
      expect(outcome?.tender.tenderId).toBe(contract?.tender?.tenderId);
    }
  });

  it('models AC-28: C-2026-0002 awaits signature, differs from the award and its difference approval is pending', () => {
    const contract = byReference('C-2026-0002');
    expect(contract.status).toBe('awaiting_signature');
    expect(contract.differsFromAward).toBe(true);
    expect(CONTRACT_APPROVALS.find((approval) => approval.id === contract.differenceApprovalId)).toMatchObject({
      subjectType: 'contract_difference',
      status: 'pending',
    });
    expect(allocationsOf(contract)[0]?.allocatedValue.amount).not.toBe(contract.value.amount);
    const milestones = CONTRACT_OBLIGATIONS.filter((obligation) => obligation.contractId === contract.id && obligation.isPaymentMilestone);
    expect(sum(milestones.map((obligation) => obligation.amount?.amount ?? '0'))).toBe(contract.value.amount);
  });

  it('models AC-29, AC-30 and AC-32 on C-2026-0001', () => {
    const contract = byReference('C-2026-0001');
    expect(contract.status).toBe('active');
    expect(CONTRACT_HANDOVERS.find((handover) => handover.contractId === contract.id)?.status).toBe('accepted');
    const q3 = CONTRACT_OBLIGATIONS.find((obligation) => obligation.title.startsWith('Q3 service report'));
    expect(q3?.status).toBe('rejected');
    const decision = CONTRACT_ACCEPTANCE_DECISIONS.find((candidate) => candidate.obligationId === q3?.id);
    expect(decision).toMatchObject({ decision: 'rejected' });
    expect(decision?.remediationOwnerUserId).not.toBeNull();
    expect(CONTRACT_INVOICES.find((invoice) => invoice.obligationId === q3?.id)).toMatchObject({ acceptanceStatus: 'not_accepted', paymentStatus: 'invoiced' });
    const renewal = CONTRACT_RENEWAL_OPTIONS.find((option) => option.contractId === contract.id && option.optionType === 'renewal');
    expect(renewal).toMatchObject({ noticeWindowStart: '2026-10-05', status: 'available', decision: null });
  });

  it('models AC-31: three changes whose cumulative value exceeds the BWP 2,000,000.00 authority', () => {
    const contract = byReference('C-2026-0001');
    const priced = CONTRACT_CHANGES.filter((change) => change.contractId === contract.id && change.costImpact !== null);
    expect(priced).toHaveLength(3);
    let running = contract.value.amount;
    for (const change of priced.sort((a, b) => a.number - b.number)) {
      running = add(running, change.costImpact?.amount ?? '0');
      expect(change.cumulativeValueAfter?.amount).toBe(running);
      expect(gt(change.costImpact?.amount ?? '0', '2000000.00')).toBe(false);
    }
    expect(gt(running, '2000000.00')).toBe(true);
    expect(currentValue(contract).amount).toBe('1995000.00');
  });

  it('keeps a surviving warranty obligation on the expired, imported C-2025-0007', () => {
    const contract = byReference('C-2025-0007');
    expect(contract).toMatchObject({ status: 'expired', origin: 'Legacy spreadsheet 2025' });
    expect(CONTRACT_OBLIGATIONS.some((obligation) => obligation.contractId === contract.id && obligation.survivesCloseout)).toBe(true);
  });

  it('gives ODC a live contract and leaves Makgadikgadi without one', () => {
    expect(CONTRACTS.filter((contract) => contract.tenantId === TENANT_IDS.odc).map((contract) => contract.status)).toEqual(['active']);
    expect(CONTRACTS.some((contract) => contract.supplierTenantId === TENANT_IDS.makgadikgadi)).toBe(false);
  });
});

describe('contracts fixtures agree with the other domains (single demo world)', () => {
  it('resolves every approval shown as a link in the approvals fixtures with the same subject, status and requester', () => {
    const linked = CONTRACT_APPROVALS.filter((approval) => approval.inApprovalWorkspace);
    expect(linked.map((approval) => approval.id).sort((a, b) => a - b)).toEqual(CONTRACT_APPROVALS.map((approval) => approval.id).sort((a, b) => a - b));
    for (const approval of linked) {
      const workspace = APPROVALS.find((candidate) => candidate.id === approval.id);
      expect(workspace, `approval ${approval.id}`).toBeDefined();
      expect(workspace).toMatchObject({
        tenantId: approval.tenantId,
        subjectType: approval.subjectType,
        status: approval.status,
        title: approval.title,
        requestedByUserId: approval.requestedByUserId,
        requestedAt: approval.requestedAt,
      });
    }
  });

  it('never reuses an approvals-domain id for an approval the approval workspace does not hold', () => {
    const workspaceIds = new Set(APPROVALS.map((approval) => approval.id));
    for (const approval of CONTRACT_APPROVALS.filter((candidate) => !candidate.inApprovalWorkspace)) {
      expect(workspaceIds.has(approval.id), `approval ${approval.id}`).toBe(false);
    }
  });

  it('points every contract, change, renewal and security approval reference at a contract approval', () => {
    const ids = new Set(CONTRACT_APPROVALS.map((approval) => approval.id));
    const references = [
      ...CONTRACTS.flatMap((contract) => [...contract.contractApprovalIds, ...(contract.differenceApprovalId === null ? [] : [contract.differenceApprovalId])]),
      ...CONTRACT_CHANGES.flatMap((change) => (change.approvalRequestId === null ? [] : [change.approvalRequestId])),
      ...CONTRACT_RENEWAL_OPTIONS.flatMap((option) => (option.approvalRequestId === null ? [] : [option.approvalRequestId])),
    ];
    for (const reference of references) {
      expect(ids.has(reference), `approval ${reference}`).toBe(true);
    }
    expect(byReference('C-2026-0002').differenceApprovalId).toBe(42);
    expect(CONTRACT_CHANGES.find((change) => change.number === 3 && change.contractId === byReference('C-2026-0001').id)?.approvalRequestId).toBe(36);
  });

  it('uses the lot titles and stages of the awards domain for T-2026-0001 (lot 3 has no outcome yet)', () => {
    const tender = AWARD_TENDERS.find((candidate) => candidate.ref.reference === 'T-2026-0001');
    expect(tender).toBeDefined();
    for (const lot of tender?.lots ?? []) {
      const outcome = CONTRACT_LOT_OUTCOMES.find((candidate) => candidate.tender.reference === 'T-2026-0001' && candidate.lotNumber === lot.lotNo);
      expect(outcome?.lotTitle, `lot ${lot.lotNo}`).toBe(lot.title);
      if (lot.stage === 'under_assessment') {
        expect(outcome).toMatchObject({ outcome: null, status: null, awardedValue: null });
      } else if (lot.stage === 'cancelled') {
        expect(outcome?.outcome).toBe('cancelled');
      } else {
        expect(outcome).toMatchObject({ outcome: 'award', status: 'final_awarded', awardedValue: { amount: '5340000.00' } });
      }
    }
  });

  it('keeps the CR-0003 figures of approval 36 and the C-2026-0002 figures that reconcile with the award', () => {
    const cr3 = CONTRACT_CHANGES.find((change) => change.approvalRequestId === 36);
    expect(cr3).toMatchObject({ costImpact: { amount: '285000.00' }, cumulativeValueAfter: { amount: '2280000.00' } });
    expect(APPROVALS.find((approval) => approval.id === 36)?.amount?.amount).toBe('285000.00');
    const supply = byReference('C-2026-0002');
    const allocation = CONTRACT_ALLOCATIONS.find((candidate) => candidate.contractId === supply.id);
    const delta = supply.differences.find((difference) => difference.field === 'value')?.amountDelta?.amount ?? '0';
    expect(add(allocation?.allocatedValue.amount ?? '0', delta)).toBe(supply.value.amount);
  });
});
