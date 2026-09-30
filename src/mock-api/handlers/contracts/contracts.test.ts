/**
 * Mock handlers of the contracts contract (CON-01 … CON-11, SUP-23): tenant and supplier isolation, permission
 * denials, the storyline scenarios AC-28 … AC-32, declared business errors and 422s. Real Supabase Auth (DD-43).
 */
import { readFileSync } from 'node:fs';

import { beforeAll, describe, expect, it } from 'vitest';

import { PLATFORM_ERRORS } from '../../../contracts/common.js';
import { contractsEndpoints as api } from '../../../contracts/contracts.js';
import { DEMO_AS_OF } from '../../fixtures/demo-clock.js';
import { createTestMockApp } from '../../testing/index.js';
import type { TestMockApp } from '../../testing/index.js';
import { register } from './index.js';

const NOW = new Date('2026-09-30T08:00:00Z');

const MASEGO = 'masego.contracts@tenderiq.local';
const TEBOGO = 'tebogo.officer@tenderiq.local';
const MPHO = 'mpho.manager@tenderiq.local';
const KEABETSWE = 'keabetswe.approver@tenderiq.local';
const PULE = 'pule.auditor@tenderiq.local';
const ADMIN_KWU = 'admin.kwu@tenderiq.local';
const SUPPORT = 'support.agent@tenderiq.local';
const OFFICER_ODC = 'officer.odc@tenderiq.local';
const TSODILO_SIGNATORY = 'tsodilo.signatory@tenderiq.local';
const TSODILO_ADMIN = 'tsodilo.admin@tenderiq.local';
const CHOBE_SIGNATORY = 'chobe-pipe.signatory@tenderiq.local';
const MAKGADIKGADI_ADMIN = 'makgadikgadi.admin@tenderiq.local';
const SAM = 'sam.dual@tenderiq.local';

const FLEET = 1;
const PUMPS_SUPPLY = 2;
const PUMPS_MAINTENANCE = 3;
const LEGACY_METER = 4;
const ODC_CLEANING = 7;
const PUMPS_SPARES = 8;
const KWU_CONTRACT_IDS = [1, 2, 3, 4, 5, 6, 8];

let app: TestMockApp;

beforeAll(async () => {
  app = await createTestMockApp({ modules: [{ name: 'contracts', register }], now: () => NOW });
});

function codeOf(body: unknown): string | undefined {
  return (body as { code?: string } | null)?.code;
}

/** Every object key in a JSON value, recursively. */
function jsonKeys(value: unknown, keys: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) {
      jsonKeys(item, keys);
    }
  } else if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      keys.add(key);
      jsonKeys(child, keys);
    }
  }
  return keys;
}

function fieldCodes(body: unknown): string[] {
  return ((body as { errors?: { code: string }[] } | null)?.errors ?? []).map((error) => error.code);
}

describe('contracts handler module', () => {
  it('registers every contract endpoint without failures', () => {
    expect(app.failed).toEqual([]);
    expect(app.loaded).toContain('contracts');
    for (const endpoint of Object.values(api)) {
      expect(app.endpointIds).toContain(endpoint.id);
    }
  });
});

describe('declared business errors', () => {
  it('uses only error codes that a contracts endpoint declares or the platform defines (never an undeclared 500)', () => {
    const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
    const used = new Set([...source.matchAll(/fail\(\s*\d+,\s*'([A-Z_]+)'/g)].map((match) => match[1]));
    const declared = new Set<string>([...Object.values(api).flatMap((endpoint) => endpoint.errors), ...Object.keys(PLATFORM_ERRORS)]);
    expect(used.size).toBeGreaterThan(20);
    expect([...used].filter((code) => code !== undefined && !declared.has(code))).toEqual([]);
  });
});

describe('buyer register and tenant isolation (CON-01)', () => {
  it('returns only the active buyer tenant’s contracts for the KWU contract manager', async () => {
    const response = await app.callAs(MASEGO, api.list, { tenant: 'kwu', query: { pageSize: 100 } });
    expect(response.status).toBe(200);
    const page = api.list.response.parse(response.body);
    expect(page.items.map((row) => row.id).sort((a, b) => a - b)).toEqual(KWU_CONTRACT_IDS);
    expect(page.total).toBe(KWU_CONTRACT_IDS.length);
    expect(page.items.some((row) => row.reference === 'C-2025-0004')).toBe(false);
  });

  it('returns only ODC contracts for the ODC officer', async () => {
    const response = await app.callAs(OFFICER_ODC, api.list, { tenant: 'odc' });
    const page = api.list.response.parse(response.body);
    expect(page.items.map((row) => row.reference)).toEqual(['C-2025-0004']);
  });

  it('answers 404 for another buyer’s contract', async () => {
    const response = await app.callAs(MASEGO, api.get, { tenant: 'kwu', params: { contractId: ODC_CLEANING } });
    expect(response.status).toBe(404);
  });

  it('filters by status, renewal window and page size', async () => {
    const active = api.list.response.parse(
      (await app.callAs(MASEGO, api.list, { tenant: 'kwu', query: { status: ['active', 'suspended'] } })).body,
    );
    expect(active.items.map((row) => row.reference).sort()).toEqual(['C-2025-0005', 'C-2026-0001']);
    const renewals = api.list.response.parse(
      (await app.callAs(MASEGO, api.list, { tenant: 'kwu', query: { renewalWithinDays: 95 } })).body,
    );
    expect(renewals.items.map((row) => row.reference).sort()).toEqual(['C-2025-0005', 'C-2026-0001']);
    const paged = api.list.response.parse((await app.callAs(MASEGO, api.list, { tenant: 'kwu', query: { pageSize: 2, page: 2 } })).body);
    expect(paged.items).toHaveLength(2);
    expect(paged.total).toBe(KWU_CONTRACT_IDS.length);
    expect(paged.summary.byStatus.reduce((total, entry) => total + entry.count, 0)).toBe(KWU_CONTRACT_IDS.length);
  });

  it('refuses a search longer than 200 characters with 422', async () => {
    const response = await app.callAs(MASEGO, api.list, { tenant: 'kwu', query: { q: 'x'.repeat(201) } });
    expect(response.status).toBe(422);
    expect(fieldCodes(response.body)).toContain('QUERY_TOO_LONG');
  });

  it('answers 403 FORBIDDEN to the organization administrator without contract permissions', async () => {
    const response = await app.callAs(ADMIN_KWU, api.list, { tenant: 'kwu' });
    expect(response.status).toBe(403);
    expect(codeOf(response.body)).toBe('FORBIDDEN');
  });

  it('answers 403 FORBIDDEN to a support agent whose grant is metadata only', async () => {
    const response = await app.callAs(SUPPORT, api.get, { tenant: 'kwu', params: { contractId: FLEET } });
    expect(response.status).toBe(403);
    expect(codeOf(response.body)).toBe('FORBIDDEN');
  });

  it('answers the identical tenant 403 when a supplier calls a buyer route', async () => {
    const response = await app.callAs(TSODILO_SIGNATORY, api.list, { tenant: 'tsodilo' });
    expect(response.status).toBe(403);
    expect(codeOf(response.body)).toBe('TENANT_ACCESS_DENIED');
  });
});

describe('every buyer read is contract-valid for every KWU contract', () => {
  const reads = [api.get, api.preparation, api.signature, api.performance, api.renewals, api.closeout, api.obligations] as const;
  for (const contractId of KWU_CONTRACT_IDS) {
    it(`serves overview, preparation, signature, obligations, performance, renewals and closeout of contract ${contractId}`, async () => {
      for (const endpoint of reads) {
        const response = await app.callAs(MASEGO, endpoint, { tenant: 'kwu', params: { contractId } });
        expect(response.status, endpoint.id).toBe(200);
        endpoint.response.parse(response.body);
      }
      const changes = await app.callAs(MASEGO, api.changes, { tenant: 'kwu', params: { contractId } });
      expect(changes.status).toBe(200);
      const disputes = await app.callAs(MASEGO, api.disputes, { tenant: 'kwu', params: { contractId } });
      expect(disputes.status).toBe(200);
      const financials = await app.callAs(PULE, api.financials, { tenant: 'kwu', params: { contractId } });
      expect(financials.status).toBe(200);
      api.financials.response.parse(financials.body);
    });
  }

  it('lists award sources with the remaining unallocated value of Lot 1 (BR-33)', async () => {
    const response = await app.callAs(TEBOGO, api.awardSources, { tenant: 'kwu' });
    const sources = api.awardSources.response.parse(response.body);
    const lot1 = sources.lotOutcomes.find((outcome) => outcome.lotOutcomeId === 14011);
    expect(lot1?.remainingValue?.amount).toBe('60000.00');
    expect(lot1?.availableForContract).toBe(true);
    expect(sources.lotOutcomes.find((outcome) => outcome.lotOutcomeId === 14012)?.availableForContract).toBe(false);
    expect(sources.legalEntities.map((entity) => entity.name)).toEqual(['Kalahari Water Utilities Corporation']);
  });

  it('lists signing assignees with their authority', async () => {
    const response = await app.callAs(TEBOGO, api.assignees, { tenant: 'kwu', query: { purpose: 'signatory' } });
    const items = api.assignees.response.parse(response.body).items;
    expect(items.find((item) => item.fullName === 'Keabetswe Nkwe')?.authorityLimit?.amount).toBe('10000000.00');
    expect(items.some((item) => item.fullName === 'Masego Rakgosi')).toBe(false);
  });

  it('answers 403 on the financial view to a procurement officer without contract.financials.view', async () => {
    const response = await app.callAs(TEBOGO, api.financials, { tenant: 'kwu', params: { contractId: FLEET } });
    expect(response.status).toBe(403);
  });
});

describe('contract formation (CON-02, BR-04, BR-33)', () => {
  const validBody = {
    title: 'Borehole pumps Lot 1: commissioning spares',
    tenderId: 1,
    supplierTenantId: 4,
    legalEntityId: 1,
    allocations: [{ lotOutcomeId: 14011, allocatedValue: { amount: '60000.00', currency: 'BWP' } }],
    value: { amount: '60000.00', currency: 'BWP' },
    scope: 'Commissioning spares for the Lot 1 pumps.',
  };

  it('creates a draft contract from the remaining awarded value', async () => {
    const response = await app.callAs(TEBOGO, api.create, { tenant: 'kwu', body: validBody });
    expect(response.status).toBe(201);
    const row = api.create.response.parse(response.body);
    expect(row.status).toBe('draft');
    expect(row.differsFromAward).toBe(false);
  });

  it('refuses an allocation above the unallocated award with ALLOCATION_EXCEEDS_AWARD', async () => {
    const response = await app.callAs(TEBOGO, api.create, {
      tenant: 'kwu',
      body: { ...validBody, allocations: [{ lotOutcomeId: 14011, allocatedValue: { amount: '60000.01', currency: 'BWP' } }], value: { amount: '60000.01', currency: 'BWP' } },
    });
    expect(response.status).toBe(422);
    expect(codeOf(response.body)).toBe('ALLOCATION_EXCEEDS_AWARD');
  });

  it('requires the contracting legal entity (422 LEGAL_ENTITY_REQUIRED)', async () => {
    const { legalEntityId: _omitted, ...body } = validBody;
    const response = await app.callAs(TEBOGO, api.create, { tenant: 'kwu', body });
    expect(response.status).toBe(422);
    expect(fieldCodes(response.body)).toContain('LEGAL_ENTITY_REQUIRED');
  });

  it('refuses a supplier who was not awarded the lot and a cancelled lot', async () => {
    const mismatch = await app.callAs(TEBOGO, api.create, { tenant: 'kwu', body: { ...validBody, supplierTenantId: 5 } });
    expect(codeOf(mismatch.body)).toBe('SUPPLIER_PARTY_MISMATCH');
    const cancelled = await app.callAs(TEBOGO, api.create, {
      tenant: 'kwu',
      body: { ...validBody, allocations: [{ lotOutcomeId: 14012, allocatedValue: { amount: '10.00', currency: 'BWP' } }] },
    });
    expect(codeOf(cancelled.body)).toBe('LOT_OUTCOME_NOT_FINAL');
  });

  it('requires an explanation when the value differs from the allocations (AC-28)', async () => {
    const response = await app.callAs(TEBOGO, api.create, { tenant: 'kwu', body: { ...validBody, value: { amount: '65000.00', currency: 'BWP' } } });
    expect(codeOf(response.body)).toBe('DIFFERENCE_EXPLANATION_REQUIRED');
  });

  it('flags the differences of C-2026-0002 with a pending difference approval', async () => {
    const response = await app.callAs(TEBOGO, api.preparation, { tenant: 'kwu', params: { contractId: PUMPS_SUPPLY } });
    const preparation = api.preparation.response.parse(response.body);
    expect(preparation.differsFromAward).toBe(true);
    // Approval 42 was requested by the contract manager; the procurement officer is neither requester nor decider.
    expect(preparation.differenceApproval).toMatchObject({ approvalId: 42, status: 'pending', inApprovalWorkspace: false });
    const asRequester = await app.callAs(MASEGO, api.preparation, { tenant: 'kwu', params: { contractId: PUMPS_SUPPLY } });
    expect(api.preparation.response.parse(asRequester.body).differenceApproval).toMatchObject({ approvalId: 42, inApprovalWorkspace: true });
    expect(preparation.differences.filter((difference) => difference.material)).toHaveLength(2);
    expect(preparation.differences.find((difference) => difference.field === 'value')?.amountDelta?.amount).toBe('48000.00');
    expect(preparation.checks.find((check) => check.id === 'difference_approval')?.state).toBe('blocking');
  });

  it('approves the under-review agreement of C-2026-0003 for the procurement manager', async () => {
    const response = await app.callAs(MPHO, api.reviewDecision, {
      tenant: 'kwu',
      params: { contractId: PUMPS_MAINTENANCE },
      body: { decision: 'approve', reason: 'Terms match the award.' },
    });
    expect(response.status).toBe(200);
    expect(api.reviewDecision.response.parse(response.body).status).toBe('awaiting_signature');
  });

  it('links the contract approval history only for viewers the approval workspace lets open the request', async () => {
    const asRequester = await app.callAs(TEBOGO, api.preparation, { tenant: 'kwu', params: { contractId: PUMPS_SUPPLY } });
    const requesterHistory = api.preparation.response.parse(asRequester.body).approvalHistory;
    expect(requesterHistory.find((approval) => approval.approvalId === 14302)?.inApprovalWorkspace).toBe(true);
    const asManager = await app.callAs(MASEGO, api.preparation, { tenant: 'kwu', params: { contractId: PUMPS_SUPPLY } });
    const managerHistory = api.preparation.response.parse(asManager.body).approvalHistory;
    expect(managerHistory.find((approval) => approval.approvalId === 14302)?.inApprovalWorkspace).toBe(false);
  });

  it('refuses to submit a contract that is not a draft', async () => {
    const response = await app.callAs(TEBOGO, api.submitForReview, { tenant: 'kwu', params: { contractId: FLEET } });
    expect(codeOf(response.body)).toBe('CONTRACT_NOT_DRAFT');
  });
});

describe('signature and commencement (CON-03, AC-28, BR-35)', () => {
  it('refuses the buyer signature while the difference from the award is unapproved', async () => {
    const response = await app.callAs(KEABETSWE, api.sign, {
      tenant: 'kwu',
      params: { contractId: PUMPS_SUPPLY, signatoryId: 14403 },
      body: { confirm: true },
    });
    expect(response.status).toBe(409);
    expect(codeOf(response.body)).toBe('DIFFERENCE_NOT_APPROVED');
  });

  it('refuses the supplier signature for the same reason', async () => {
    const response = await app.callAs(TSODILO_SIGNATORY, api.supplierSign, {
      tenant: 'tsodilo',
      params: { contractId: PUMPS_SUPPLY, signatoryId: 14404 },
      body: { confirm: true },
    });
    expect(response.status).toBe(409);
    expect(codeOf(response.body)).toBe('DIFFERENCE_NOT_APPROVED');
  });

  it('refuses commencement before signature approval', async () => {
    const response = await app.callAs(MASEGO, api.authorizeCommencement, {
      tenant: 'kwu',
      params: { contractId: PUMPS_SUPPLY },
      body: { effectiveDate: '2026-11-01' },
    });
    expect(codeOf(response.body)).toBe('DIFFERENCE_NOT_APPROVED');
  });

  it('requires an explicit confirmation to sign (422)', async () => {
    const response = await app.callAs(KEABETSWE, api.sign, {
      tenant: 'kwu',
      params: { contractId: PUMPS_SUPPLY, signatoryId: 14403 },
      body: { confirm: false },
    });
    expect(response.status).toBe(422);
    expect(fieldCodes(response.body)).toContain('CONFIRMATION_REQUIRED');
  });

  it('shows separate milestones on the signature page of the active contract', async () => {
    const response = await app.callAs(MASEGO, api.signature, { tenant: 'kwu', params: { contractId: FLEET } });
    const signature = api.signature.response.parse(response.body);
    expect(signature.milestones.map((milestone) => milestone.key)).toEqual([
      'signed',
      'effective',
      'notice_to_proceed',
      'delivery_start',
      'handover_accepted',
    ]);
    expect(signature.signatories.every((signatory) => signatory.method === 'in_app')).toBe(true);
  });
});

describe('handover (CON-04, AC-29)', () => {
  it('shows the accepted handover of C-2026-0001 without losing bids', async () => {
    const response = await app.callAs(MASEGO, api.handover, { tenant: 'kwu', params: { contractId: FLEET } });
    const handover = api.handover.response.parse(response.body);
    expect(handover.status).toBe('accepted');
    expect(handover.excludesLosingBids).toBe(true);
    expect(handover.closeoutGate.blocksEventCloseout).toBe(false);
  });

  it('keeps event closeout blocked by the returned handover of C-2026-0003 and refuses an incomplete submission', async () => {
    const handover = api.handover.response.parse(
      (await app.callAs(MASEGO, api.handover, { tenant: 'kwu', params: { contractId: PUMPS_MAINTENANCE } })).body,
    );
    expect(handover.closeoutGate.blocksEventCloseout).toBe(true);
    expect(handover.omissions).not.toBeNull();
    const submit = await app.callAs(TEBOGO, api.submitHandover, { tenant: 'kwu', params: { contractId: PUMPS_MAINTENANCE } });
    expect(codeOf(submit.body)).toBe('HANDOVER_INCOMPLETE');
  });

  it('lets only the named contract manager accept a submitted handover', async () => {
    const accepted = await app.callAs(MASEGO, api.acceptHandover, { tenant: 'kwu', params: { contractId: PUMPS_SPARES }, body: {} });
    expect(accepted.status).toBe(200);
    expect(api.acceptHandover.response.parse(accepted.body).status).toBe('accepted');
    const officer = await app.callAs(TEBOGO, api.acceptHandover, { tenant: 'kwu', params: { contractId: PUMPS_SPARES }, body: {} });
    expect(officer.status).toBe(403);
  });

  it('requires omissions to return a handover and reports imported contracts as not applicable', async () => {
    const missing = await app.callAs(MASEGO, api.returnHandover, { tenant: 'kwu', params: { contractId: PUMPS_SPARES }, body: { omissions: ' ' } });
    expect(fieldCodes(missing.body)).toContain('OMISSIONS_REQUIRED');
    const legacy = await app.callAs(MASEGO, api.handover, { tenant: 'kwu', params: { contractId: LEGACY_METER } });
    expect(codeOf(legacy.body)).toBe('HANDOVER_NOT_APPLICABLE');
  });
});

describe('milestones and acceptance (CON-06, AC-30)', () => {
  it('shows the rejected Q3 report with remediation and an unpaid, unaccepted invoice', async () => {
    const response = await app.callAs(MASEGO, api.obligation, { tenant: 'kwu', params: { contractId: FLEET, obligationId: 14702 } });
    const detail = api.obligation.response.parse(response.body);
    expect(detail.status).toBe('rejected');
    const decision = detail.decisions.at(-1);
    expect(decision?.decision).toBe('rejected');
    expect(decision?.remediationOwner?.fullName).toBe('Motsamai Tsodilo');
    expect(decision?.remediationDueAt?.timeZone).toBe('Africa/Gaborone');
    expect(detail.payment).toMatchObject({ acceptanceStatus: 'not_accepted', paymentStatus: 'invoiced' });
  });

  it('requires reasons, remediation, owner and due date to reject evidence', async () => {
    const response = await app.callAs(MASEGO, api.decideObligation, {
      tenant: 'kwu',
      params: { contractId: FLEET, obligationId: 14711 },
      body: { decision: 'rejected', reasons: 'Prices exceed the indexation limit.' },
    });
    expect(response.status).toBe(422);
    expect(fieldCodes(response.body)).toEqual(
      expect.arrayContaining(['REMEDIATION_REQUIRED', 'REMEDIATION_OWNER_REQUIRED', 'REMEDIATION_DUE_REQUIRED']),
    );
  });

  it('records a rejection without implying payment readiness', async () => {
    const response = await app.callAs(MASEGO, api.decideObligation, {
      tenant: 'kwu',
      params: { contractId: FLEET, obligationId: 14711 },
      body: {
        decision: 'rejected',
        reasons: 'Three prices exceed the 6% indexation limit.',
        remediationRequired: 'Correct the three prices or attach the manufacturer notices.',
        remediationOwnerUserId: 25,
        remediationDueAt: '2026-10-14T15:00:00Z',
      },
    });
    expect(response.status).toBe(200);
    const result = api.decideObligation.response.parse(response.body);
    expect(result.obligation.status).toBe('rejected');
    expect(result.decision.remediationOwner?.userId).toBe(25);
  });

  it('refuses a decision on evidence that is not under review', async () => {
    const response = await app.callAs(MASEGO, api.decideObligation, {
      tenant: 'kwu',
      params: { contractId: FLEET, obligationId: 14710 },
      body: { decision: 'accepted', reasons: 'Audit complete.' },
    });
    expect(codeOf(response.body)).toBe('OBLIGATION_NOT_UNDER_REVIEW');
  });

  it('filters obligations to overdue items', async () => {
    const response = await app.callAs(MASEGO, api.obligations, { tenant: 'kwu', params: { contractId: FLEET }, query: { overdue: true } });
    const page = api.obligations.response.parse(response.body);
    expect(page.items.map((row) => row.id)).toEqual([14705]);
    expect(page.counts.rejected).toBe(1);
  });

  it('refuses to release a security without an approved release decision (BR-37)', async () => {
    const response = await app.callAs(MASEGO, api.releaseSecurity, {
      tenant: 'kwu',
      params: { contractId: LEGACY_METER, securityId: 14963 },
      body: { reason: 'Warranty period is nearly over.' },
    });
    expect(codeOf(response.body)).toBe('SECURITY_RELEASE_NOT_APPROVED');
  });
});

describe('performance (CON-07)', () => {
  it('lets the ODC officer read performance but not finalize a review (no contract.manage)', async () => {
    const odc = await app.callAs(OFFICER_ODC, api.performance, { tenant: 'odc', params: { contractId: ODC_CLEANING } });
    expect(odc.status).toBe(200);
    expect(api.performance.response.parse(odc.body).reviews[0]?.status).toBe('shared_with_supplier');
    const finalize = await app.callAs(OFFICER_ODC, api.finalizePerformanceReview, {
      tenant: 'odc',
      params: { contractId: ODC_CLEANING, reviewId: 14794 },
      body: { overallRating: 'meets', finalizationNote: 'Scores confirmed.' },
    });
    expect(finalize.status).toBe(403);
    expect(codeOf(finalize.body)).toBe('FORBIDDEN');
  });

  it('never presents the disputed, unfinalized review rating as the latest final rating', async () => {
    const performance = api.performance.response.parse(
      (await app.callAs(MASEGO, api.performance, { tenant: 'kwu', params: { contractId: FLEET } })).body,
    );
    expect(performance.scorecard).toMatchObject({
      reviewsFinalized: 0,
      latestRating: null,
      latestProposedRating: { reviewId: 14791, rating: 'partially_meets', reviewStatus: 'supplier_responded', supplierDisputes: true },
    });
    const renewals = api.renewals.response.parse((await app.callAs(MASEGO, api.renewals, { tenant: 'kwu', params: { contractId: FLEET } })).body);
    expect(renewals.performance.latestRating).toBeNull();
    expect(renewals.performance.latestProposedRating?.reviewStatus).toBe('supplier_responded');
  });

  it('reports the finalized rating of C-2025-0005 as final with no newer proposal', async () => {
    const performance = api.performance.response.parse(
      (await app.callAs(MASEGO, api.performance, { tenant: 'kwu', params: { contractId: 6 } })).body,
    );
    expect(performance.scorecard).toMatchObject({ reviewsFinalized: 1, latestRating: 'does_not_meet', latestProposedRating: null });
  });

  it('finalizes the disputed review after the supplier response', async () => {
    const finalized = await app.callAs(MASEGO, api.finalizePerformanceReview, {
      tenant: 'kwu',
      params: { contractId: FLEET, reviewId: 14791 },
      body: { overallRating: 'partially_meets', finalizationNote: 'Body-work days excluded; rating unchanged on first-time fix.' },
    });
    expect(finalized.status).toBe(200);
    expect(api.finalizePerformanceReview.response.parse(finalized.body).status).toBe('finalized');
  });

  it('refuses to finalize a draft review', async () => {
    const response = await app.callAs(MASEGO, api.finalizePerformanceReview, {
      tenant: 'kwu',
      params: { contractId: FLEET, reviewId: 14792 },
      body: { overallRating: 'meets', finalizationNote: 'Final.' },
    });
    expect(codeOf(response.body)).toBe('REVIEW_NOT_SHARED');
  });
});

describe('financial view (CON-08)', () => {
  it('labels sources and never counts pending changes or unaccepted invoices as paid', async () => {
    const response = await app.callAs(MASEGO, api.financials, { tenant: 'kwu', params: { contractId: FLEET } });
    const financials = api.financials.response.parse(response.body);
    expect(financials.paid.amount.amount).toBe('120000.00');
    expect(financials.paid.sourceSystem).toBe('finance_system');
    expect(financials.pendingChanges).toMatchObject({ isEstimate: true, amount: { amount: '285000.00' } });
    expect(financials.currentValue.amount.amount).toBe('1995000.00');
    expect(financials.reconciliation.invoicedNotAccepted.amount).toBe('120000.00');
  });

  it('refuses a duplicate invoice reference', async () => {
    const response = await app.callAs(MASEGO, api.recordInvoice, {
      tenant: 'kwu',
      params: { contractId: FLEET },
      body: { invoiceRef: 'TSO-INV-2026-0712', amount: { amount: '100.00', currency: 'BWP' }, invoiceDate: '2026-09-29' },
    });
    expect(codeOf(response.body)).toBe('INVOICE_DUPLICATE_REFERENCE');
  });
});

describe('changes and disputes (CON-09, AC-31)', () => {
  it('shows the cumulative value and routes CR-0003 above the procurement manager’s authority', async () => {
    const response = await app.callAs(MASEGO, api.changes, { tenant: 'kwu', params: { contractId: FLEET } });
    const changes = api.changes.response.parse(response.body);
    expect(changes.items.map((item) => item.displayNumber)).toEqual(['CR-0001', 'CR-0002', 'CR-0003', 'CR-0004']);
    expect(changes.pendingAuthority).toMatchObject({
      basis: 'cumulative_value',
      sufficient: false,
      singleChangeAmount: { amount: '285000.00' },
      cumulativeChanges: { amount: '430000.00' },
      checkedAmount: { amount: '2280000.00' },
      checkedApprover: { fullName: 'Mpho Dikgang' },
      requiredApprover: { fullName: 'Keabetswe Nkwe' },
    });
    expect(changes.cumulativeExposure.amount).toBe('2280000.00');
  });

  it('links CR-0003 to approval 36 and the earlier CR-0001/CR-0002 approvals to the approval workspace', async () => {
    const changes = api.changes.response.parse((await app.callAs(MASEGO, api.changes, { tenant: 'kwu', params: { contractId: FLEET } })).body);
    const byNumber = new Map(changes.items.map((item) => [item.displayNumber, item.approval]));
    expect(byNumber.get('CR-0003')).toMatchObject({ approvalId: 36, inApprovalWorkspace: true, amount: { amount: '285000.00' } });
    expect(byNumber.get('CR-0001')).toMatchObject({ approvalId: 14305, inApprovalWorkspace: true });
    expect(byNumber.get('CR-0002')).toMatchObject({ approvalId: 14306, inApprovalWorkspace: true });
  });

  it('refuses the approval by the procurement manager with CUMULATIVE_AUTHORITY_EXCEEDED', async () => {
    const response = await app.callAs(MPHO, api.decideChange, {
      tenant: 'kwu',
      params: { contractId: FLEET, changeId: 14803 },
      body: { decision: 'approve', reason: 'Tanker maintenance justified.' },
    });
    expect(response.status).toBe(403);
    expect(codeOf(response.body)).toBe('CUMULATIVE_AUTHORITY_EXCEEDED');
  });

  it('lets the Chief Executive approve it on the cumulative figure', async () => {
    const response = await app.callAs(KEABETSWE, api.decideChange, {
      tenant: 'kwu',
      params: { contractId: FLEET, changeId: 14803 },
      body: { decision: 'approve', reason: 'Within the ceiling; funding confirmed.' },
    });
    expect(response.status).toBe(200);
    const detail = api.decideChange.response.parse(response.body);
    expect(detail.status).toBe('agreed');
    expect(detail.authority?.sufficient).toBe(true);
  });

  it('refuses the change approval to the contract manager without contract.change.approve', async () => {
    const response = await app.callAs(MASEGO, api.decideChange, {
      tenant: 'kwu',
      params: { contractId: FLEET, changeId: 14803 },
      body: { decision: 'approve', reason: 'Approve.' },
    });
    expect(response.status).toBe(403);
    expect(codeOf(response.body)).toBe('FORBIDDEN');
  });

  it('refuses to resolve a credit without an authorized decision', async () => {
    const response = await app.callAs(MASEGO, api.updateDispute, {
      tenant: 'kwu',
      params: { contractId: FLEET, disputeId: 14882 },
      body: { status: 'resolved', note: 'Credit applied.' },
    });
    expect(codeOf(response.body)).toBe('DECISION_NOT_AUTHORIZED');
  });

  it('requires the contract basis for a penalty (422 REMEDY_BASIS_REQUIRED)', async () => {
    const response = await app.callAs(MASEGO, api.recordDispute, {
      tenant: 'kwu',
      params: { contractId: FLEET },
      body: { disputeType: 'penalty', description: 'Late report.' },
    });
    expect(fieldCodes(response.body)).toContain('REMEDY_BASIS_REQUIRED');
  });
});

describe('renewal (CON-10, AC-32, BR-37)', () => {
  /** The mock API on the storyline clock (`fixtures/demo-clock.ts`), the "now" AC-32 is written for. */
  let storyline: TestMockApp;
  beforeAll(async () => {
    storyline = await createTestMockApp({ modules: [{ name: 'contracts', register }], now: () => new Date(DEMO_AS_OF) });
  });

  it('shows the renewal window opening in 5 days with no decision and no automatic renewal', async () => {
    const response = await storyline.callAs(MASEGO, api.renewals, { tenant: 'kwu', params: { contractId: FLEET } });
    const renewals = api.renewals.response.parse(response.body);
    expect(renewals.noAutomaticRenewal).toBe(true);
    const option = renewals.options.find((candidate) => candidate.id === 14951);
    expect(option).toMatchObject({ windowState: 'not_open', daysUntilWindowOpens: 5, decision: null, status: 'available' });
    expect(renewals.alertRecipients.map((person) => person.fullName)).toEqual(['Tebogo Molefe', 'Masego Rakgosi']);
  });

  it('flags the upcoming renewal decision in the register', async () => {
    const page = api.list.response.parse((await storyline.callAs(MASEGO, api.list, { tenant: 'kwu', query: { q: 'C-2026-0001' } })).body);
    expect(page.items[0]?.nextDecision?.kind).toBe('renewal_notice');
    expect(page.items[0]?.nextRenewalDeadline?.at).toBe('2026-12-31T15:00:00Z');
    expect(page.items[0]?.nextRenewalWindow).toEqual({ windowStart: '2026-10-11', state: 'not_open', daysUntilOpens: 5 });
  });

  it('counts a notice window opening within 90 days in the register KPI even when the deadline is further away', async () => {
    const page = api.list.response.parse((await storyline.callAs(MASEGO, api.list, { tenant: 'kwu' })).body);
    // C-2026-0001: window opens in 5 days (deadline in 86 days); C-2025-0005: window open, deadline 31 Oct 2026.
    expect(page.summary.renewalsWithin90Days).toBe(2);
    const filtered = api.list.response.parse((await storyline.callAs(MASEGO, api.list, { tenant: 'kwu', query: { renewalWithinDays: 90 } })).body);
    expect(filtered.items.map((row) => row.reference).sort()).toEqual(['C-2025-0005', 'C-2026-0001']);
  });

  it('refuses the renewal decision to the contract manager (no contract.renewal.decide)', async () => {
    const response = await app.callAs(MASEGO, api.decideRenewal, {
      tenant: 'kwu',
      params: { contractId: FLEET, optionId: 14951 },
      body: { decision: 'renew', justification: 'Good value.', performanceBasis: 'Meets most targets.', fundingConfirmed: true },
    });
    expect(response.status).toBe(403);
  });

  it('requires confirmed funding to renew and records an explicit decision pending approval', async () => {
    const unfunded = await app.callAs(KEABETSWE, api.decideRenewal, {
      tenant: 'kwu',
      params: { contractId: FLEET, optionId: 14951 },
      body: { decision: 'renew', justification: 'Good value.', performanceBasis: 'Meets most targets.', fundingConfirmed: false },
    });
    expect(fieldCodes(unfunded.body)).toContain('FUNDING_NOT_CONFIRMED');
    const decided = await app.callAs(KEABETSWE, api.decideRenewal, {
      tenant: 'kwu',
      params: { contractId: FLEET, optionId: 14951 },
      body: { decision: 'renew', justification: 'Good value.', performanceBasis: 'Meets most targets.', fundingConfirmed: true },
    });
    expect(decided.status).toBe(200);
    const result = api.decideRenewal.response.parse(decided.body);
    expect(result.option.status).toBe('under_review');
    expect(result.approvalRequired).toBe(true);
    expect(result.supplierConsentRequired).toBe(true);
  });

  it('refuses a second decision on an option already decided', async () => {
    const response = await app.callAs(KEABETSWE, api.decideRenewal, {
      tenant: 'kwu',
      params: { contractId: LEGACY_METER, optionId: 14953 },
      body: { decision: 'renew', justification: 'Reconsider.', performanceBasis: 'Good.', fundingConfirmed: true },
    });
    expect(codeOf(response.body)).toBe('RENEWAL_ALREADY_DECIDED');
  });
});

describe('closeout (CON-11)', () => {
  it('keeps the surviving warranty and blocks closure while an obligation is open', async () => {
    const closeout = api.closeout.response.parse(
      (await app.callAs(MASEGO, api.closeout, { tenant: 'kwu', params: { contractId: LEGACY_METER } })).body,
    );
    expect(closeout.survivingObligations.map((obligation) => obligation.title)).toContain('Handheld reader warranty until 30 June 2027');
    expect(closeout.canClose).toBe(false);
    expect(closeout.checks.find((check) => check.id === 'surviving')?.detail).toBe('1 surviving obligation.');
    const close = await app.callAs(MASEGO, api.closeContract, { tenant: 'kwu', params: { contractId: LEGACY_METER }, body: { confirm: true } });
    expect(codeOf(close.body)).toBe('CLOSEOUT_BLOCKED');
  });

  it('reconciles unpaid as invoiced less paid and disputed, never as the unpaid contract value', async () => {
    const closeout = api.closeout.response.parse((await app.callAs(MASEGO, api.closeout, { tenant: 'kwu', params: { contractId: FLEET } })).body);
    expect(closeout.reconciliation).toMatchObject({
      invoiced: { amount: '303050.00' },
      paid: { amount: '120000.00' },
      disputed: { amount: '24600.00' },
      invoicedUnpaid: { amount: '158450.00' },
      notYetInvoiced: { amount: '1691950.00' },
    });
  });

  it('refuses closeout of an active contract', async () => {
    const response = await app.callAs(MASEGO, api.closeContract, { tenant: 'kwu', params: { contractId: FLEET }, body: { confirm: true } });
    expect(codeOf(response.body)).toBe('CONTRACT_NOT_CLOSABLE');
  });
});

describe('supplier contracts (SUP-23) and audience isolation', () => {
  it('shows Tsodilo only its own contracts past internal preparation', async () => {
    const response = await app.callAs(TSODILO_SIGNATORY, api.supplierList, { tenant: 'tsodilo' });
    const page = api.supplierList.response.parse(response.body);
    expect(page.items.map((row) => row.reference).sort()).toEqual(['C-2026-0001', 'C-2026-0002']);
    const pumps = page.items.find((row) => row.id === PUMPS_SUPPLY);
    expect(pumps?.mySignatureStatus).toBe('pending');
  });

  it('answers 404 for a draft or under-review contract and for another supplier’s contract', async () => {
    const draft = await app.callAs(TSODILO_SIGNATORY, api.supplierGet, { tenant: 'tsodilo', params: { contractId: PUMPS_MAINTENANCE } });
    expect(draft.status).toBe(404);
    const other = await app.callAs(CHOBE_SIGNATORY, api.supplierGet, { tenant: 'chobe-pipe', params: { contractId: FLEET } });
    expect(other.status).toBe(404);
  });

  it('never exposes renewal options, handover, allocations or approval internals to the supplier', async () => {
    const response = await app.callAs(TSODILO_SIGNATORY, api.supplierGet, { tenant: 'tsodilo', params: { contractId: FLEET } });
    expect(response.status).toBe(200);
    const detail = api.supplierGet.response.parse(response.body);
    expect(detail.reviews.map((review) => review.status)).toEqual(['supplier_responded']);
    const keys = jsonKeys(response.body);
    for (const forbidden of ['noticeWindowStart', 'noticeDeadline', 'options', 'handoverStatus', 'allocations', 'authority', 'approval', 'releaseApproval', 'authorizedDecision', 'excludesLosingBids', 'finalizedBy']) {
      expect(keys.has(forbidden), forbidden).toBe(false);
    }
  });

  it('lets a supplier administrator read but not act, and shows an empty list to a supplier without contracts', async () => {
    const read = await app.callAs(TSODILO_ADMIN, api.supplierGet, { tenant: 'tsodilo', params: { contractId: FLEET } });
    expect(read.status).toBe(200);
    const act = await app.callAs(TSODILO_ADMIN, api.supplierSubmitEvidence, {
      tenant: 'tsodilo',
      params: { contractId: FLEET, obligationId: 14702 },
      body: { documentVersionId: 16001 },
    });
    expect(act.status).toBe(403);
    const empty = api.supplierList.response.parse((await app.callAs(MAKGADIKGADI_ADMIN, api.supplierList, { tenant: 'makgadikgadi' })).body);
    expect(empty.total).toBe(0);
  });

  it('answers 403 to a contributor without contract permissions', async () => {
    const response = await app.callAs(SAM, api.supplierList, { tenant: 'tsodilo' });
    expect(response.status).toBe(403);
  });

  it('accepts remediation evidence for the rejected Q3 report', async () => {
    const response = await app.callAs(TSODILO_SIGNATORY, api.supplierSubmitEvidence, {
      tenant: 'tsodilo',
      params: { contractId: FLEET, obligationId: 14702 },
      body: { documentVersionId: 16001, note: 'Resubmitted with downtime logs and the warranty register.' },
    });
    expect(response.status).toBe(201);
    expect(api.supplierSubmitEvidence.response.parse(response.body).obligation.status).toBe('evidence_submitted');
  });

  it('refuses evidence on a buyer obligation and responds to a shared review', async () => {
    const buyerObligation = await app.callAs(TSODILO_SIGNATORY, api.supplierSubmitEvidence, {
      tenant: 'tsodilo',
      params: { contractId: FLEET, obligationId: 14709 },
      body: { documentVersionId: 16002 },
    });
    expect(codeOf(buyerObligation.body)).toBe('OBLIGATION_WRONG_PARTY');
    const respond = await app.callAs(TSODILO_SIGNATORY, api.supplierRespondReview, {
      tenant: 'tsodilo',
      params: { contractId: FLEET, reviewId: 14791 },
      body: { response: 'We maintain our position on body-work days.', disputes: true },
    });
    expect(respond.status).toBe(200);
    const draft = await app.callAs(TSODILO_SIGNATORY, api.supplierRespondReview, {
      tenant: 'tsodilo',
      params: { contractId: FLEET, reviewId: 14792 },
      body: { response: 'n/a', disputes: false },
    });
    expect(draft.status).toBe(404);
  });

  it('records supplier agreement to a buyer change and refuses a repeated agreement', async () => {
    const agree = await app.callAs(TSODILO_SIGNATORY, api.supplierAgreeChange, {
      tenant: 'tsodilo',
      params: { contractId: FLEET, changeId: 14804 },
      body: { confirm: true },
    });
    expect(agree.status).toBe(200);
    const again = await app.callAs(TSODILO_SIGNATORY, api.supplierAgreeChange, {
      tenant: 'tsodilo',
      params: { contractId: FLEET, changeId: 14803 },
      body: { confirm: true },
    });
    expect(codeOf(again.body)).toBe('SUPPLIER_ALREADY_AGREED');
  });

  it('refuses a change request on a contract that is not active', async () => {
    const response = await app.callAs(TSODILO_SIGNATORY, api.supplierRequestChange, {
      tenant: 'tsodilo',
      params: { contractId: PUMPS_SUPPLY },
      body: { title: 'Earlier delivery', reason: 'Stock arrived early.' },
    });
    expect(codeOf(response.body)).toBe('CONTRACT_NOT_ACTIVE');
  });
});
