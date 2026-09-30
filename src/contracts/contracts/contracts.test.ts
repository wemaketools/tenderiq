/**
 * The contracts contract (CON-01 … CON-11, SUP-23): endpoint catalog rules, audience partition, and the request
 * validations that carry business rules (BR-04, AC-28, AC-30, BR-36, BR-37).
 */
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';

import {
  CreateContractBody,
  CreateObligationBody,
  ObligationDecisionBody,
  RecordDisputeBody,
  RenewalDecisionBody,
  ReturnHandoverBody,
  SignBody,
  SupplierContractDetail,
  changeRequestLabel,
  contractsEndpoints,
} from '../contracts.js';
import { endpointPermissions } from '../endpoint.js';

const endpoints = Object.values(contractsEndpoints);

function codes(result: z.ZodSafeParseResult<unknown>): string[] {
  return result.success ? [] : result.error.issues.map((issue) => issue.message.split('|')[0] ?? '');
}

/** Every key a zod object schema can emit, recursively (arrays, nullables and optionals unwrapped). */
function schemaKeys(schema: z.ZodType, keys: Set<string> = new Set()): Set<string> {
  const def = (schema as unknown as { def: { type: string; shape?: Record<string, z.ZodType>; innerType?: z.ZodType; element?: z.ZodType } }).def;
  if (def.type === 'object' && def.shape !== undefined) {
    for (const [key, child] of Object.entries(def.shape)) {
      keys.add(key);
      schemaKeys(child, keys);
    }
  } else if (def.innerType !== undefined) {
    schemaKeys(def.innerType, keys);
  } else if (def.type === 'array' && def.element !== undefined) {
    schemaKeys(def.element, keys);
  }
  return keys;
}

const validContract = {
  title: 'Borehole pumps Lot 1: commissioning spares',
  tenderId: 1,
  supplierTenantId: 4,
  legalEntityId: 1,
  allocations: [{ lotOutcomeId: 14011, allocatedValue: { amount: '60000.00', currency: 'BWP' } }],
  value: { amount: '60000.00', currency: 'BWP' },
  scope: 'Commissioning spares.',
};

describe('contracts endpoint catalog', () => {
  it('defines unique ids and method-path pairs under the buyer and supplier audiences', () => {
    expect(new Set(endpoints.map((endpoint) => endpoint.id)).size).toBe(endpoints.length);
    expect(new Set(endpoints.map((endpoint) => `${endpoint.method} ${endpoint.path}`)).size).toBe(endpoints.length);
    for (const endpoint of endpoints) {
      expect(['buyer', 'supplier']).toContain(endpoint.audience);
      expect(endpoint.path.startsWith(`/api/v1/${endpoint.audience}/`)).toBe(true);
    }
  });

  it('covers every contract screen and SUP-23', () => {
    const screens = new Set(endpoints.flatMap((endpoint) => endpoint.screens));
    for (const screen of ['CON-01', 'CON-02', 'CON-03', 'CON-04', 'CON-05', 'CON-06', 'CON-07', 'CON-08', 'CON-09', 'CON-10', 'CON-11', 'SUP-23']) {
      expect(screens.has(screen), screen).toBe(true);
    }
  });

  it('requires contract.renewal.decide for renewal decisions and contract.change.approve for change decisions', () => {
    expect(endpointPermissions(contractsEndpoints.decideRenewal)).toEqual(['contract.renewal.decide']);
    expect(endpointPermissions(contractsEndpoints.decideChange)).toEqual(['contract.change.approve']);
    expect(contractsEndpoints.decideChange.errors).toContain('CUMULATIVE_AUTHORITY_EXCEEDED');
    expect(contractsEndpoints.sign.errors).toContain('DIFFERENCE_NOT_APPROVED');
    expect(contractsEndpoints.supplierSign.errors).toContain('DIFFERENCE_NOT_APPROVED');
  });

  it('never exposes renewal options, handover, allocations or approval internals in supplier responses (DD-03)', () => {
    const supplierKeys = new Set<string>();
    for (const endpoint of endpoints.filter((candidate) => candidate.audience === 'supplier')) {
      schemaKeys(endpoint.response, supplierKeys);
    }
    for (const forbidden of ['noticeWindowStart', 'noticeDeadline', 'options', 'handoverStatus', 'allocations', 'authority', 'approval', 'releaseApproval', 'authorizedDecision', 'finalizedBy']) {
      expect(supplierKeys.has(forbidden), forbidden).toBe(false);
    }
    expect(schemaKeys(SupplierContractDetail).has('obligations')).toBe(true);
  });
});

describe('contracts request validation', () => {
  it('accepts a valid contract from an awarded lot', () => {
    expect(CreateContractBody.safeParse(validContract).success).toBe(true);
  });

  it('requires the contracting legal entity (BR-04)', () => {
    const { legalEntityId: _omitted, ...body } = validContract;
    expect(codes(CreateContractBody.safeParse(body))).toContain('LEGAL_ENTITY_REQUIRED');
    expect(codes(CreateContractBody.safeParse({ ...validContract, legalEntityId: null }))).toContain('LEGAL_ENTITY_REQUIRED');
  });

  it('refuses an empty allocation list, a zero allocation and a term that ends before it starts', () => {
    expect(codes(CreateContractBody.safeParse({ ...validContract, allocations: [] }))).toContain('ALLOCATION_REQUIRED');
    expect(
      codes(CreateContractBody.safeParse({ ...validContract, allocations: [{ lotOutcomeId: 1, allocatedValue: { amount: '0.00', currency: 'BWP' } }] })),
    ).toContain('AMOUNT_MUST_BE_POSITIVE');
    expect(codes(CreateContractBody.safeParse({ ...validContract, termStart: '2027-01-01', termEnd: '2026-01-01' }))).toContain('TERM_END_BEFORE_START');
  });

  it('requires remediation, owner and due date to reject evidence but not to accept it (AC-30)', () => {
    expect(codes(ObligationDecisionBody.safeParse({ decision: 'rejected', reasons: 'Incomplete.' }))).toEqual(
      expect.arrayContaining(['REMEDIATION_REQUIRED', 'REMEDIATION_OWNER_REQUIRED', 'REMEDIATION_DUE_REQUIRED']),
    );
    expect(ObligationDecisionBody.safeParse({ decision: 'accepted', reasons: 'Complete.' }).success).toBe(true);
    expect(codes(ObligationDecisionBody.safeParse({ decision: 'accepted', reasons: ' ' }))).toContain('REASON_REQUIRED');
  });

  it('requires an amount and a milestone kind for a payment milestone', () => {
    expect(codes(CreateObligationBody.safeParse({ kind: 'milestone', party: 'supplier', title: 'Delivery', dueAt: '2027-01-01T10:00:00Z', isPaymentMilestone: true }))).toContain(
      'AMOUNT_REQUIRED',
    );
    expect(
      codes(CreateObligationBody.safeParse({ kind: 'obligation', party: 'supplier', title: 'Insurance', isPaymentMilestone: true, amount: { amount: '10.00', currency: 'BWP' } })),
    ).toContain('PAYMENT_MILESTONE_KIND');
  });

  it('requires confirmed funding to renew or extend, not to let an option expire (BR-36, BR-37)', () => {
    const base = { justification: 'Value for money.', performanceBasis: 'Meets targets.' };
    expect(codes(RenewalDecisionBody.safeParse({ ...base, decision: 'renew', fundingConfirmed: false }))).toContain('FUNDING_NOT_CONFIRMED');
    expect(RenewalDecisionBody.safeParse({ ...base, decision: 'let_expire', fundingConfirmed: false }).success).toBe(true);
  });

  it('requires the contract basis for remedies, credits, penalties and settlements', () => {
    expect(codes(RecordDisputeBody.safeParse({ disputeType: 'credit', description: 'Missed target.' }))).toContain('REMEDY_BASIS_REQUIRED');
    expect(RecordDisputeBody.safeParse({ disputeType: 'claim', description: 'Extra parts.' }).success).toBe(true);
  });

  it('requires omissions to return a handover and an explicit confirmation to sign', () => {
    expect(codes(ReturnHandoverBody.safeParse({ omissions: '' }))).toContain('OMISSIONS_REQUIRED');
    expect(codes(SignBody.safeParse({ confirm: false }))).toContain('CONFIRMATION_REQUIRED');
  });

  it('labels change requests as CR-0001 (DD-09)', () => {
    expect(changeRequestLabel(3)).toBe('CR-0003');
    expect(changeRequestLabel(12345)).toBe('CR-12345');
  });
});
